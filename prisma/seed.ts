import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  BADGES,
  DEFAULT_CATEGORIES,
  DEFAULT_REWARDS,
  DEFAULT_ROUTINES,
  categoryXpToNext,
  type CategorySlug,
} from "../src/lib/catalog";
import {
  DIFFICULTIES,
  isEngagement,
  MALUS,
  MAX_ENGAGEMENTS_PER_DAY,
  xpToNextLevel,
  type DifficultyKey,
  type TaskKind,
} from "../src/lib/gamification";
import { addDays, isoWeekday, startOfWeek, todayISO } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";

/** Identifiants du compte de démonstration créé par le seed. */
const DEMO_EMAIL = "demo@questlist.local";
const DEMO_PASSWORD = "questlist";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
});

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante — copier .env.example vers .env.");
  return url;
}

/** PRNG à graine fixe : deux `db seed` produisent la même base. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HISTORY_DAYS = 181;

const EXTRA_TITLES: Record<CategorySlug, string[]> = {
  sante: ["10 000 pas", "Étirements du soir", "Course 5 km"],
  travail: ["Répondre aux mails", "Préparer la réunion", "Écrire le rapport"],
  maison: ["Vaisselle", "Courses", "Passer l'aspirateur"],
  creativite: ["Croquis du jour", "Écrire 500 mots", "Monter la vidéo"],
  social: ["Répondre aux messages", "Organiser la sortie"],
};

const DIFF_KEYS: DifficultyKey[] = ["facile", "moyenne", "difficile"];

/**
 * Poids de tirage par catégorie. Un historique parfaitement uniforme
 * donne un radar circulaire, donc illisible : c'est le déséquilibre
 * qui rend le graphe utile (ici, le Social est délaissé).
 */
const CATEGORY_WEIGHTS: Record<CategorySlug, number> = {
  sante: 0.27,
  travail: 0.31,
  maison: 0.2,
  creativite: 0.15,
  social: 0.07,
};

function pickCategory(rand: () => number): CategorySlug {
  let roll = rand();
  for (const c of DEFAULT_CATEGORIES) {
    roll -= CATEGORY_WEIGHTS[c.slug];
    if (roll <= 0) return c.slug;
  }
  return "travail";
}

type SeedTask = {
  title: string;
  category: CategorySlug;
  difficulty: DifficultyKey;
  kind: TaskKind;
  date: string | null;
  weekStart: string | null;
  done: boolean;
  time?: string;
  routineIndex?: number;
  malusApplied: boolean;
};

async function main() {
  const today = todayISO();
  const rand = mulberry32(4242);

  console.log(`→ Réinitialisation de la base (aujourd'hui : ${today})`);
  await prisma.user.deleteMany(); // les cascades nettoient tout le reste

  // Compte de démonstration. Le hash est calculé ici plutôt que codé en
  // dur pour que le sel reste aléatoire à chaque seed.
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      name: "Clément",
      avatar: "🦊",
      level: 1,
      xp: 0,
      coins: 0,
    },
  });

  // ── Catégories ────────────────────────────────────────────────
  const categories = new Map<CategorySlug, string>();
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    const row = await prisma.category.create({
      data: { ...c, order: i, userId: user.id },
    });
    categories.set(c.slug, row.id);
  }

  // ── Routines ──────────────────────────────────────────────────
  const routineIds: string[] = [];
  for (const [i, r] of DEFAULT_ROUTINES.entries()) {
    const row = await prisma.routine.create({
      data: {
        userId: user.id,
        categoryId: categories.get(r.category)!,
        title: r.title,
        difficulty: r.difficulty,
        days: r.days.join(","),
        time: r.time ?? null,
        order: i,
      },
    });
    routineIds.push(row.id);
  }

  /**
   * Qualité d'une journée. Le scénario compte autant que les chiffres :
   * une longue série au printemps, cassée net il y a cinq semaines, puis
   * la remontée en cours — c'est exactement ce que raconte le badge Phénix.
   */
  function qualityFor(daysAgo: number): number {
    if (daysAgo <= 14) return 1; // la série en cours
    if (daysAgo <= 21) return 0.55; // la reprise laborieuse
    if (daysAgo <= 38) return 0.2; // le creux, la série est morte
    if (daysAgo <= 76) return 1; // l'ancienne série — le record
    if (daysAgo <= 110) return 0.8;
    return 0.62;
  }

  // ── Génération des journées passées ───────────────────────────
  const tasks: SeedTask[] = [];
  const dayRecords: {
    date: string;
    done: number;
    total: number;
    gained: number;
    malus: number;
    success: boolean;
    perfect: boolean;
  }[] = [];

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const date = addDays(today, -daysAgo);
    const dow = isoWeekday(date);
    const quality = qualityFor(daysAgo);
    const dayTasks: SeedTask[] = [];

    // Quotidiennes issues des routines actives ce jour-là.
    DEFAULT_ROUTINES.forEach((r, i) => {
      if (!r.days.includes(dow)) return;
      dayTasks.push({
        title: r.title,
        category: r.category,
        difficulty: r.difficulty,
        kind: "quotidienne",
        date,
        weekStart: null,
        done: rand() < quality,
        time: r.time,
        routineIndex: i,
        malusApplied: true,
      });
    });

    // Le week-end n'a pas de routine : il porte plus d'hebdomadaires.
    // Le quota d'engagements vaut aussi pour l'historique, sinon le
    // planning afficherait des journées à 5/4.
    const freeSlots = MAX_ENGAGEMENTS_PER_DAY - dayTasks.length;
    const nWeekly = Math.max(
      0,
      Math.min(freeSlots, (dayTasks.length === 0 ? 2 : 1) + Math.floor(rand() * 2)),
    );
    // Au moins un bonus par jour, sinon « réussie » et « parfaite » se
    // confondent et les couronnes ne veulent plus rien dire.
    const nBonus = 1 + Math.floor(rand() * 2);

    const pushExtra = (kind: TaskKind) => {
      const slug = pickCategory(rand);
      const titles = EXTRA_TITLES[slug];
      dayTasks.push({
        title: titles[Math.floor(rand() * titles.length)],
        category: slug,
        difficulty: DIFF_KEYS[Math.floor(rand() * DIFF_KEYS.length)],
        kind,
        date,
        weekStart: kind === "hebdomadaire" ? startOfWeek(date) : null,
        done: rand() < quality * (kind === "bonus" ? 0.8 : 1),
        malusApplied: true,
      });
    };
    for (let i = 0; i < nWeekly; i++) pushExtra("hebdomadaire");
    for (let i = 0; i < nBonus; i++) pushExtra("bonus");

    const done = dayTasks.filter((t) => t.done).length;
    const engagements = dayTasks.filter((t) => isEngagement(t.kind));
    const gained = dayTasks
      .filter((t) => t.done)
      .reduce((s, t) => s + DIFFICULTIES[t.difficulty].xp, 0);
    const malus = dayTasks
      .filter((t) => !t.done)
      .reduce((s, t) => s + MALUS[t.kind], 0);

    dayRecords.push({
      date,
      done,
      total: dayTasks.length,
      gained,
      malus,
      success: engagements.length > 0 && engagements.every((t) => t.done),
      perfect: dayTasks.length > 0 && done === dayTasks.length,
    });
    tasks.push(...dayTasks);
  }

  // ── Aujourd'hui : rien n'est encore fait ──────────────────────
  const todayDow = isoWeekday(today);
  const thisWeek = startOfWeek(today);
  const nextWeek = addDays(thisWeek, 7);

  DEFAULT_ROUTINES.forEach((r, i) => {
    if (!r.days.includes(todayDow)) return;
    tasks.push({
      title: r.title,
      category: r.category,
      difficulty: r.difficulty,
      kind: "quotidienne",
      date: today,
      weekStart: null,
      done: false,
      time: r.time,
      routineIndex: i,
      malusApplied: false,
    });
  });

  const weeklyFixtures: {
    title: string;
    category: CategorySlug;
    difficulty: DifficultyKey;
    date: string | null;
    weekStart: string;
  }[] = [
    { title: "Ranger le garage", category: "maison", difficulty: "difficile", date: today, weekStart: thisWeek },
    { title: "Prendre RDV dentiste", category: "sante", difficulty: "facile", date: null, weekStart: thisWeek },
    { title: "Écrire l'article de blog", category: "creativite", difficulty: "moyenne", date: null, weekStart: thisWeek },
    { title: "Grand ménage de printemps", category: "maison", difficulty: "difficile", date: null, weekStart: nextWeek },
    { title: "Appeler mamie", category: "social", difficulty: "facile", date: null, weekStart: nextWeek },
    { title: "Réserver les vacances", category: "social", difficulty: "moyenne", date: null, weekStart: nextWeek },
    { title: "Monter la vidéo", category: "creativite", difficulty: "difficile", date: null, weekStart: nextWeek },
  ];
  for (const w of weeklyFixtures) {
    tasks.push({ ...w, kind: "hebdomadaire", done: false, malusApplied: false });
  }

  for (const b of [
    { title: "30 min de guitare", category: "creativite" as const, difficulty: "facile" as const },
    { title: "Arroser les plantes", category: "maison" as const, difficulty: "facile" as const },
  ]) {
    tasks.push({
      ...b,
      kind: "bonus",
      date: today,
      weekStart: null,
      done: false,
      malusApplied: false,
    });
  }

  // ── Écriture ──────────────────────────────────────────────────
  await prisma.task.createMany({
    data: tasks.map((t) => ({
      userId: user.id,
      categoryId: categories.get(t.category)!,
      routineId:
        t.routineIndex !== undefined ? routineIds[t.routineIndex] : null,
      title: t.title,
      difficulty: t.difficulty,
      kind: t.kind,
      date: t.date,
      weekStart: t.weekStart,
      done: t.done,
      doneAt: t.done && t.date ? new Date(`${t.date}T12:00:00Z`) : null,
      time: t.time ?? null,
      malusApplied: t.malusApplied,
    })),
  });

  await prisma.dayRecord.createMany({
    data: dayRecords.map((d) => ({ ...d, userId: user.id })),
  });

  await prisma.reward.createMany({
    data: DEFAULT_REWARDS.map((r, i) => ({
      ...r,
      note: r.note ?? null,
      order: i,
      userId: user.id,
    })),
  });

  // ── Niveaux dérivés de l'historique ───────────────────────────
  const netXp = dayRecords.reduce((s, d) => s + d.gained - d.malus, 0);
  const coins = tasks
    .filter((t) => t.done)
    .reduce((s, t) => s + DIFFICULTIES[t.difficulty].coins, 0);

  let level = 1;
  let remaining = netXp;
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }

  // Série : jours réussis consécutifs en remontant depuis hier.
  let streak = 0;
  for (let i = dayRecords.length - 1; i >= 0 && dayRecords[i].success; i--) {
    streak += 1;
  }
  let best = 0;
  let run = 0;
  for (const d of dayRecords) {
    run = d.success ? run + 1 : 0;
    best = Math.max(best, run);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      level,
      xp: remaining,
      coins: Math.round(coins * 0.35), // une partie a déjà été dépensée
      streak,
      bestStreak: best,
      shields: Math.min(2, Math.floor(streak / 7)),
      lastRollover: addDays(today, -1),
    },
  });

  // Niveaux par catégorie, à partir de l'XP réellement gagnée.
  for (const c of DEFAULT_CATEGORIES) {
    const catXp = tasks
      .filter((t) => t.done && t.category === c.slug)
      .reduce((s, t) => s + DIFFICULTIES[t.difficulty].xp, 0);
    let cl = 1;
    let rest = catXp;
    while (rest >= categoryXpToNext(cl)) {
      rest -= categoryXpToNext(cl);
      cl += 1;
    }
    await prisma.category.update({
      where: { userId_slug: { userId: user.id, slug: c.slug } },
      data: { level: cl, xp: rest },
    });
  }

  // ── Badges déjà obtenus ───────────────────────────────────────
  const doneTasks = tasks.filter((t) => t.done);
  const perfectDays = dayRecords.filter((d) => d.perfect).length;
  let perfectStreak = 0;
  let prun = 0;
  for (const d of dayRecords) {
    prun = d.perfect ? prun + 1 : 0;
    perfectStreak = Math.max(perfectStreak, prun);
  }
  const catCounts = new Map<string, number>();
  for (const t of doneTasks) {
    catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1);
  }

  const metrics: Record<string, number> = {
    tasks: doneTasks.length,
    perfectDays,
    perfectStreak,
    streak: best,
    noMalusDays: 0,
    balancedCategories: 0,
    weeklyPlaced: 0,
  };
  for (const [slug, n] of catCounts) metrics[`cat:${slug}`] = n;

  const unlocked = BADGES.filter(
    (b) => b.metric && b.goal !== undefined && (metrics[b.metric] ?? 0) >= b.goal,
  ).map((b) => b.id);

  // Deux badges narratifs que les compteurs seuls ne peuvent pas déduire.
  unlocked.push("phenix", "marathonien");

  await prisma.unlockedBadge.createMany({
    data: [...new Set(unlocked)].map((badgeId) => ({
      userId: user.id,
      badgeId,
      unlockedAt: new Date(),
    })),
  });

  console.log(
    `✓ ${tasks.length} tâches · ${dayRecords.length} journées · niveau ${level} · série ${streak} j · ${unlocked.length} badges`,
  );
  console.log(`✓ connexion : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
