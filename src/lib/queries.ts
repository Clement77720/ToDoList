import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSessionUserId } from "./auth";
import { ensureRollover, materializeWeeklyTemplates } from "./rollover";
import { addDays, isoWeekday, startOfWeek, todayISOIn } from "./dates";
import { BADGES, categoryXpToNext } from "./catalog";
import type { ChestTier, RewardFamily } from "./catalog";
import {
  MARKET,
  offreDuJour,
  prixEffectif,
  tendance,
  type EtatMarche,
} from "./market";
import {
  DIFFICULTIES,
  isEngagement,
  MALUS,
  xpToNextLevel,
  type DifficultyKey,
  type TaskKind,
} from "./gamification";
import type {
  BadgeDTO,
  CategoryDTO,
  DayDTO,
  PlayerDTO,
  RewardDTO,
  RoutineDTO,
  TaskDTO,
} from "./types";

const HEATMAP_DAYS = 182;

type CategoryRow = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  color: string;
  level: number;
  xp: number;
};

type TaskRow = {
  id: string;
  title: string;
  difficulty: string;
  kind: string;
  date: string | null;
  weekStart: string | null;
  done: boolean;
  time: string | null;
  category: { slug: string; label: string; icon: string; color: string };
};

function toTask(t: TaskRow): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    difficulty: t.difficulty as DifficultyKey,
    kind: t.kind as TaskKind,
    date: t.date,
    weekStart: t.weekStart,
    done: t.done,
    time: t.time,
    category: t.category,
  };
}

const taskSelect = {
  id: true,
  title: true,
  difficulty: true,
  kind: true,
  date: true,
  weekStart: true,
  done: true,
  time: true,
  category: { select: { slug: true, label: true, icon: true, color: true } },
} as const;

/**
 * Compte connecté, ou `null`. C'est ici que se branche l'authentification :
 * tout le reste de l'application travaille déjà à partir d'un `userId`.
 *
 * Le rollover est déclenché au passage, une seule fois par requête grâce à
 * `cache()` qui déduplique l'appel.
 */
export const getSessionUser = cache(async () => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null; // session orpheline (compte supprimé)

  await ensureRollover(user.id, todayISOIn(user.timezone));
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
});

/**
 * « Aujourd'hui » du joueur connecté.
 *
 * **Toujours passer par ici côté serveur**, jamais par `todayISO()` : sur
 * Vercel l'horloge est en UTC, et la journée d'un joueur français
 * basculerait à 2 h du matin l'été — les malus du soir tomberaient en
 * pleine nuit et le tableau de bord afficherait la veille.
 */
export const getToday = cache(async (): Promise<string> => {
  const user = await getCurrentUser();
  return todayISOIn(user.timezone);
});

/**
 * Même chose, mais pour tout ce qui suppose un utilisateur : pages
 * protégées et Server Actions. Redirige vers la connexion plutôt que de
 * lever, pour qu'une session expirée ne produise pas une page d'erreur.
 */
export const getCurrentUser = async () => {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  return user;
};

export const getPlayer = cache(async (): Promise<PlayerDTO> => {
  const u = await getCurrentUser();
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    photo: u.photo,
    timezone: u.timezone,
    level: u.level,
    xp: u.xp,
    xpMax: xpToNextLevel(u.level),
    coins: u.coins,
    streak: u.streak,
    bestStreak: u.bestStreak,
    shields: u.shields,
  };
});

export const getCategories = cache(async (): Promise<CategoryDTO[]> => {
  const u = await getCurrentUser();
  const rows = await prisma.category.findMany({
    where: { userId: u.id },
    orderBy: { order: "asc" },
  });
  return rows.map((c: CategoryRow) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    icon: c.icon,
    color: c.color,
    level: c.level,
    xp: c.xp,
    xpMax: categoryXpToNext(c.level),
  }));
});

export async function getTasksForDate(date: string): Promise<TaskDTO[]> {
  const u = await getCurrentUser();
  const rows = await prisma.task.findMany({
    where: { userId: u.id, date },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    select: taskSelect,
  });
  return rows.map(toTask);
}

/** Bilan calculé à la volée — la journée en cours n'est pas encore close. */
export function dayFromTasks(date: string, tasks: TaskDTO[]): DayDTO {
  const done = tasks.filter((t) => t.done);
  const engagements = tasks.filter((t) => isEngagement(t.kind));
  const gained = done.reduce((s, t) => s + DIFFICULTIES[t.difficulty].xp, 0);
  const malus = tasks
    .filter((t) => t.kind === "quotidienne" && !t.done)
    .reduce((s) => s + MALUS.quotidienne, 0);
  return {
    date,
    done: done.length,
    total: tasks.length,
    gained,
    malus,
    xp: gained - malus,
    ratio: tasks.length === 0 ? 0 : done.length / tasks.length,
    success: engagements.length > 0 && engagements.every((t) => t.done),
    perfect: tasks.length > 0 && done.length === tasks.length,
  };
}

/** Historique clos + journée en cours reconstituée. */
export const getHistory = cache(async (days = HEATMAP_DAYS): Promise<DayDTO[]> => {
  const u = await getCurrentUser();
  const today = await getToday();
  const from = addDays(today, -(days - 1));

  const rows = await prisma.dayRecord.findMany({
    where: { userId: u.id, date: { gte: from, lte: today } },
    orderBy: { date: "asc" },
  });

  const closed: DayDTO[] = rows.map((d) => ({
    date: d.date,
    done: d.done,
    total: d.total,
    gained: d.gained,
    malus: d.malus,
    xp: d.gained - d.malus,
    ratio: d.total === 0 ? 0 : d.done / d.total,
    success: d.success,
    perfect: d.perfect,
  }));

  if (!closed.some((d) => d.date === today)) {
    closed.push(dayFromTasks(today, await getTasksForDate(today)));
  }
  return closed;
});

/**
 * Tâches hebdomadaires d'une semaine : placées et encore en réserve.
 *
 * Les engagements récurrents sont matérialisés à la lecture, pour que
 * planifier la semaine prochaine les fasse apparaître sans attendre le
 * rollover. Jamais sur une semaine révolue : ce serait fabriquer après coup
 * des engagements en retard.
 */
export async function getWeeklyTasks(weekStart: string): Promise<TaskDTO[]> {
  const u = await getCurrentUser();

  if (weekStart >= startOfWeek(await getToday())) {
    await materializeWeeklyTemplates(u.id, weekStart);
  }

  const rows = await prisma.task.findMany({
    where: { userId: u.id, weekStart, kind: "hebdomadaire" },
    orderBy: { createdAt: "asc" },
    select: taskSelect,
  });
  return rows.map(toTask);
}

export const getRoutines = cache(async (): Promise<RoutineDTO[]> => {
  const u = await getCurrentUser();
  const rows = await prisma.routine.findMany({
    where: { userId: u.id, active: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      difficulty: true,
      days: true,
      time: true,
      category: { select: { slug: true, label: true, icon: true, color: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    difficulty: r.difficulty as DifficultyKey,
    days: r.days.split(",").filter(Boolean).map(Number),
    time: r.time,
    category: r.category,
  }));
});

/** Journées d'un mois, pour la grille du calendrier. */
export async function getMonth(
  year: number,
  month: number,
): Promise<Record<string, DayDTO>> {
  const u = await getCurrentUser();
  const today = await getToday();
  const first = new Date(Date.UTC(year, month, 1));
  const from = addDays(first.toISOString().slice(0, 10), -7);
  const to = addDays(
    new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
    7,
  );

  const rows = await prisma.dayRecord.findMany({
    where: { userId: u.id, date: { gte: from, lte: to } },
  });

  const out: Record<string, DayDTO> = {};
  for (const d of rows) {
    out[d.date] = {
      date: d.date,
      done: d.done,
      total: d.total,
      gained: d.gained,
      malus: d.malus,
      xp: d.gained - d.malus,
      ratio: d.total === 0 ? 0 : d.done / d.total,
      success: d.success,
      perfect: d.perfect,
    };
  }

  if (today >= from && today <= to && !out[today]) {
    out[today] = dayFromTasks(today, await getTasksForDate(today));
  }
  return out;
}

/** Nombre de tâches prévues par jour à venir — pastilles du calendrier. */
export async function getPlannedCounts(
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const u = await getCurrentUser();
  const today = await getToday();

  const rows = await prisma.task.groupBy({
    by: ["date"],
    where: { userId: u.id, date: { gte: from, lte: to } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) if (r.date) out[r.date] = r._count._all;

  // Les quotidiennes d'un jour futur n'existent pas encore en base : le
  // rollover ne les crée que le jour venu. Sans cette projection, le
  // calendrier annonce « 1 prévue » là où trois engagements attendent.
  const routines = await prisma.routine.findMany({
    where: { userId: u.id, active: true },
    select: { days: true },
  });
  const parJour = new Map<number, number>();
  for (const r of routines) {
    for (const d of r.days.split(",").filter(Boolean).map(Number)) {
      parJour.set(d, (parJour.get(d) ?? 0) + 1);
    }
  }

  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (date <= today) continue;
    out[date] = (out[date] ?? 0) + (parJour.get(isoWeekday(date)) ?? 0);
  }
  return out;
}

/**
 * Quotidiennes *prévues* un jour à venir.
 *
 * Même raison : elles ne sont matérialisées que le jour venu, alors que
 * les routines disent déjà lesquelles s'appliqueront. Les projeter évite
 * qu'un écran de planification mente par omission.
 *
 * Ce sont des DTO synthétiques, jamais persistés — leur `id` est préfixé
 * pour qu'on ne puisse pas les confondre avec une vraie tâche, ni les
 * cocher : les listes d'un jour futur sont en lecture seule.
 */
export async function getProjectedDailies(date: string): Promise<TaskDTO[]> {
  const u = await getCurrentUser();
  if (date <= (await getToday())) return [];

  const dow = isoWeekday(date);
  const [routines, existing] = await Promise.all([
    prisma.routine.findMany({
      where: { userId: u.id, active: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        difficulty: true,
        days: true,
        time: true,
        category: { select: { slug: true, label: true, icon: true, color: true } },
      },
    }),
    prisma.task.findMany({
      where: { userId: u.id, date, kind: "quotidienne" },
      select: { routineId: true },
    }),
  ]);
  const already = new Set(existing.map((t) => t.routineId));

  return routines
    .filter(
      (r) =>
        !already.has(r.id) &&
        r.days.split(",").filter(Boolean).map(Number).includes(dow),
    )
    .map((r) => ({
      id: `projection:${r.id}`,
      title: r.title,
      difficulty: r.difficulty as DifficultyKey,
      kind: "quotidienne" as TaskKind,
      date,
      weekStart: null,
      done: false,
      time: r.time,
      category: r.category,
    }));
}

type LigneMarche = { id: string; createdAt: Date };

/**
 * Demande observée pour chaque récompense : nombre d'achats dans la
 * fenêtre, et ancienneté du dernier achat — à défaut, de l'entrée en
 * boutique, pour qu'une récompense jamais achetée finisse par se solder.
 */
async function etatsDuMarche(
  userId: string,
  rows: LigneMarche[],
): Promise<Map<string, EtatMarche>> {
  const depuis = new Date(Date.now() - MARKET.FENETRE_JOURS * 86_400_000);
  const [recents, derniers] = await Promise.all([
    prisma.purchase.groupBy({
      by: ["rewardId"],
      where: { userId, at: { gte: depuis } },
      _count: { _all: true },
    }),
    prisma.purchase.groupBy({
      by: ["rewardId"],
      where: { userId },
      _max: { at: true },
    }),
  ]);

  const nb = new Map(recents.map((r) => [r.rewardId, r._count._all]));
  const dernier = new Map(derniers.map((r) => [r.rewardId, r._max.at]));
  const jours = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

  return new Map(
    rows.map((r) => [
      r.id,
      {
        achatsRecents: nb.get(r.id) ?? 0,
        joursDepuisAchat: jours(dernier.get(r.id) ?? r.createdAt),
        enPromo: false,
      },
    ]),
  );
}

/**
 * Prix réellement dû pour une récompense, marché et offre du jour compris.
 *
 * **Les Server Actions doivent débiter ce prix**, jamais celui de la base :
 * afficher un prix soldé puis en débiter un autre serait le pire défaut
 * possible d'un marché.
 */
export async function prixDeVente(
  userId: string,
  rewardId: string,
): Promise<number | null> {
  const reward = await prisma.reward.findFirst({
    where: { id: rewardId, userId },
  });
  if (!reward) return null;

  const [etats, eligibles] = await Promise.all([
    etatsDuMarche(userId, [reward]),
    prisma.reward.findMany({
      where: { userId, chestTier: null },
      select: { id: true },
    }),
  ]);
  const promoId = offreDuJour(
    `${userId}:${todayISOIn((await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } })).timezone)}`,
    eligibles.map((r) => r.id),
  );

  return prixEffectif(reward.price, {
    ...etats.get(reward.id)!,
    enPromo: reward.id === promoId,
  });
}

export const getRewards = cache(async (): Promise<RewardDTO[]> => {
  const u = await getCurrentUser();
  const today = await getToday();
  const rows = await prisma.reward.findMany({
    where: { userId: u.id },
    orderBy: { order: "asc" },
  });

  const etats = await etatsDuMarche(u.id, rows);

  // L'offre du jour ne porte jamais sur un coffre : son prix commande le
  // palier du tirage, le solder fausserait le pari.
  const eligibles = rows.filter((r) => !r.chestTier).map((r) => r.id);
  const promoId = offreDuJour(`${u.id}:${today}`, eligibles);

  return rows.map((r) => {
    const etat = { ...etats.get(r.id)!, enPromo: r.id === promoId };
    const price = prixEffectif(r.price, etat);
    return {
      id: r.id,
      label: r.label,
      icon: r.icon,
      price,
      basePrice: r.price,
      promo: etat.enPromo,
      tendance: tendance(r.price, prixEffectif(r.price, { ...etat, enPromo: false })),
      kind: r.kind as "reel" | "cosmetique",
      family: r.family as RewardFamily,
      chestTier: (r.chestTier as ChestTier | null) ?? null,
      note: r.note,
      owned: r.owned,
      wonAgoMs: r.wonAt ? Date.now() - r.wonAt.getTime() : null,
    };
  });
});

/* ── Badges ─────────────────────────────────────────────────── */

const metrics = cache(async (): Promise<Record<string, number>> => {
  const u = await getCurrentUser();
  const today = await getToday();

  const [doneCount, byCategory, days, categories] = await Promise.all([
    prisma.task.count({ where: { userId: u.id, done: true } }),
    prisma.task.groupBy({
      by: ["categoryId"],
      where: { userId: u.id, done: true },
      _count: { _all: true },
    }),
    prisma.dayRecord.findMany({
      where: { userId: u.id },
      orderBy: { date: "asc" },
      select: { perfect: true, malus: true },
    }),
    getCategories(),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c.slug]));

  let perfectStreak = 0;
  let run = 0;
  for (const d of days) {
    run = d.perfect ? run + 1 : 0;
    perfectStreak = Math.max(perfectStreak, run);
  }

  // Jours consécutifs sans malus, en remontant depuis le plus récent.
  let noMalusDays = 0;
  for (let i = days.length - 1; i >= 0 && days[i].malus === 0; i--) {
    noMalusDays += 1;
  }

  const weekly = await getWeeklyTasks(startOfWeek(today));
  const weeklyPlaced =
    weekly.length === 0
      ? 100
      : Math.round((weekly.filter((t) => t.date).length / weekly.length) * 100);

  const out: Record<string, number> = {
    tasks: doneCount,
    perfectDays: days.filter((d) => d.perfect).length,
    perfectStreak,
    streak: Math.max(u.streak, u.bestStreak),
    noMalusDays,
    balancedCategories: Math.min(
      ...categories.map((c) => c.level),
      Number.MAX_SAFE_INTEGER,
    ),
    weeklyPlaced,
  };
  for (const g of byCategory) {
    const slug = catById.get(g.categoryId);
    if (slug) out[`cat:${slug}`] = g._count._all;
  }
  return out;
});

export const getBadges = cache(async (): Promise<BadgeDTO[]> => {
  const u = await getCurrentUser();
  const [unlockedRows, m] = await Promise.all([
    prisma.unlockedBadge.findMany({ where: { userId: u.id } }),
    metrics(),
  ]);
  const unlocked = new Map(
    unlockedRows.map((r) => [
      r.badgeId,
      r.unlockedAt.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ]),
  );

  return BADGES.map((b) => ({
    ...b,
    unlocked: unlocked.has(b.id),
    unlockedOn: unlocked.get(b.id) ?? null,
    progress:
      b.metric && b.goal !== undefined && !unlocked.has(b.id)
        ? { current: Math.min(m[b.metric] ?? 0, b.goal), goal: b.goal }
        : null,
  }));
});

/** Badges nouvellement mérités — appelé après chaque mutation. */
export async function grantEarnedBadges(userId: string): Promise<string[]> {
  const [existing, m] = await Promise.all([
    prisma.unlockedBadge.findMany({ where: { userId } }),
    metrics(),
  ]);
  const have = new Set(existing.map((r) => r.badgeId));

  const earned = BADGES.filter(
    (b) =>
      !have.has(b.id) &&
      b.metric &&
      b.goal !== undefined &&
      (m[b.metric] ?? 0) >= b.goal,
  ).map((b) => b.id);

  if (earned.length > 0) {
    await prisma.unlockedBadge.createMany({
      data: earned.map((badgeId) => ({ userId, badgeId })),
    });
  }
  return earned;
}

/* ── Agrégats de la page Statistiques ───────────────────────── */

export async function getWeeklyXp(): Promise<{ label: string; xp: number }[]> {
  const history = await getHistory(84);
  const weeks: { label: string; xp: number }[] = [];

  // On aligne les paquets de 7 sur le lundi de la première semaine pleine.
  const offset = (isoWeekday(history[0]?.date ?? (await getToday())) - 1) % 7;
  const aligned = history.slice(offset);

  for (let i = 0; i + 7 <= aligned.length; i += 7) {
    const slice = aligned.slice(i, i + 7);
    weeks.push({
      label: new Date(`${slice[0].date}T00:00:00Z`).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      }),
      xp: slice.reduce((s, d) => s + d.xp, 0),
    });
  }
  return weeks;
}
