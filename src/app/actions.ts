"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getCurrentUser,
  getToday,
  grantEarnedBadges,
  prixDeVente,
} from "@/lib/queries";
import { applyXpDelta, materializeRoutines } from "@/lib/rollover";
import {
  categoryXpToNext,
  CHEST_TIERS,
  DEFAULT_REWARDS,
  type ChestTier,
} from "@/lib/catalog";
import { isoWeekday, startOfWeek } from "@/lib/dates";
import { getWeekKind } from "@/lib/weeks";
import {
  DAILY_MALUS_CAP,
  MALUS,
  MAX_ENGAGEMENTS_PER_DAY,
  taskReward,
  type DifficultyKey,
  type WeekKind,
} from "@/lib/gamification";

export type ActionResult =
  | {
      ok: true;
      xp?: number;
      coins?: number;
      badges?: string[];
      levelUp?: boolean;
    }
  | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

/** Ajoute (ou retire) de l'XP à une catégorie en gérant ses niveaux. */
async function addCategoryXp(categoryId: string, delta: number) {
  const cat = await prisma.category.findUniqueOrThrow({
    where: { id: categoryId },
  });
  let level = cat.level;
  let xp = cat.xp + delta;

  while (xp >= categoryXpToNext(level)) {
    xp -= categoryXpToNext(level);
    level += 1;
  }
  while (xp < 0 && level > 1) {
    level -= 1;
    xp += categoryXpToNext(level);
  }

  await prisma.category.update({
    where: { id: categoryId },
    data: { level, xp: Math.max(0, xp) },
  });
}

/** Coche ou décoche une tâche, et répercute gains et niveaux. */
export async function toggleTaskAction(taskId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!task) return { ok: false, error: "Tâche introuvable." };

  const today = await getToday();
  const reward = taskReward(task.difficulty as DifficultyKey, {
    onTime: task.date === today,
    streakDays: user.streak,
  });

  const nowDone = !task.done;
  const sign = nowDone ? 1 : -1;

  await prisma.task.update({
    where: { id: task.id },
    data: { done: nowDone, doneAt: nowDone ? new Date() : null },
  });

  const applied = applyXpDelta(user.level, user.xp, sign * reward.xp);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      level: applied.level,
      xp: applied.xp,
      coins: Math.max(0, user.coins + sign * reward.coins),
    },
  });
  await addCategoryXp(task.categoryId, sign * reward.xp);

  const badges = nowDone ? await grantEarnedBadges(user.id) : [];
  refresh();
  return {
    ok: true,
    xp: sign * reward.xp,
    coins: sign * reward.coins,
    badges,
    levelUp: applied.leveledUp,
  };
}

/** Place une hebdomadaire sur un jour, ou la renvoie en réserve. */
export async function placeWeeklyAction(
  taskId: string,
  date: string | null,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id, kind: "hebdomadaire" },
  });
  if (!task) return { ok: false, error: "Engagement introuvable." };

  if (date) {
    if (date < (await getToday())) {
      return { ok: false, error: "Impossible de planifier dans le passé." };
    }
    // Le quota du jour couvre quotidiennes ET hebdomadaires. Les
    // quotidiennes d'un jour futur ne sont pas encore matérialisées :
    // on les déduit des routines actives pour compter pareil que l'écran.
    const dow = isoWeekday(date);
    const routines = await prisma.routine.findMany({
      where: { userId: user.id, active: true },
      select: { days: true },
    });
    const fromRoutines = routines.filter((r) =>
      r.days.split(",").filter(Boolean).map(Number).includes(dow),
    ).length;

    const [materialized, placedWeekly] = await Promise.all([
      prisma.task.count({
        where: { userId: user.id, date, kind: "quotidienne" },
      }),
      prisma.task.count({
        where: {
          userId: user.id,
          date,
          kind: "hebdomadaire",
          id: { not: taskId },
        },
      }),
    ]);

    const used = Math.max(fromRoutines, materialized) + placedWeekly;
    if (used >= MAX_ENGAGEMENTS_PER_DAY) {
      return {
        ok: false,
        error: `Ce jour a déjà ${MAX_ENGAGEMENTS_PER_DAY} engagements.`,
      };
    }
  }

  await prisma.task.update({ where: { id: task.id }, data: { date } });
  refresh();
  return { ok: true };
}

/** Active ou désactive un jour sur une routine récurrente. */
export async function toggleRoutineDayAction(
  routineId: string,
  dow: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, userId: user.id },
  });
  if (!routine) return { ok: false, error: "Routine introuvable." };

  const days = routine.days.split(",").filter(Boolean).map(Number);
  const active = days.includes(dow);
  const next = active
    ? days.filter((d) => d !== dow)
    : [...days, dow].sort((a, b) => a - b);

  await prisma.routine.update({
    where: { id: routine.id },
    data: { days: next.join(",") },
  });

  // Répercuter sur aujourd'hui : on ne touche jamais au passé.
  const today = await getToday();
  if (dow === isoWeekday(today)) {
    if (active) {
      await prisma.task.deleteMany({
        where: { userId: user.id, routineId: routine.id, date: today, done: false },
      });
    } else {
      await materializeRoutines(user.id, today);
    }
  }

  refresh();
  return { ok: true };
}

/**
 * Crée un engagement hebdomadaire dans la réserve d'une semaine.
 *
 * `recurring` en fait un engagement permanent : un `WeeklyTemplate` est
 * posé en plus de la tâche, et chaque nouvelle semaine le rematérialisera
 * en réserve — plus besoin de le recréer à la main.
 */
export async function addWeeklyTaskAction(
  weekStart: string,
  title: string,
  categorySlug: string,
  difficulty: DifficultyKey,
  recurring = false,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!title.trim()) return { ok: false, error: "Le titre est vide." };

  const category = await prisma.category.findUnique({
    where: { userId_slug: { userId: user.id, slug: categorySlug } },
  });
  if (!category) return { ok: false, error: "Catégorie inconnue." };

  let templateId: string | null = null;
  if (recurring) {
    const count = await prisma.weeklyTemplate.count({ where: { userId: user.id } });
    const template = await prisma.weeklyTemplate.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: title.trim(),
        difficulty,
        order: count,
      },
    });
    templateId = template.id;
  }

  await prisma.task.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      title: title.trim(),
      difficulty,
      kind: "hebdomadaire",
      weekStart,
      date: null,
      templateId,
    },
  });
  refresh();
  return { ok: true };
}

/** Crée une tâche bonus sur une date donnée. */
export async function addBonusTaskAction(
  date: string,
  title: string,
  categorySlug: string,
  difficulty: DifficultyKey,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!title.trim()) return { ok: false, error: "Le titre est vide." };

  const category = await prisma.category.findUnique({
    where: { userId_slug: { userId: user.id, slug: categorySlug } },
  });
  if (!category) return { ok: false, error: "Catégorie inconnue." };

  await prisma.task.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      title: title.trim(),
      difficulty,
      kind: "bonus",
      date,
    },
  });
  refresh();
  return { ok: true };
}

/** Bascule une semaine entre régime normal et vacances. */
export async function setWeekKindAction(
  weekStart: string,
  kind: WeekKind,
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (kind === "normale") {
    // L'absence de ligne vaut « normale » : on nettoie plutôt que d'écrire.
    await prisma.weekSetting.deleteMany({ where: { userId: user.id, weekStart } });
  } else {
    await prisma.weekSetting.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      create: { userId: user.id, weekStart, kind },
      update: { kind },
    });
  }

  refresh();
  return { ok: true };
}

/**
 * Modifie un engagement hebdomadaire encore en réserve.
 *
 * On peut corriger un intitulé, une catégorie ou une difficulté, mais pas
 * supprimer l'engagement : s'en débarrasser d'un clic viderait le format de
 * son sens. Une fois la tâche validée, elle n'est plus modifiable non plus —
 * sinon on pourrait la requalifier après coup pour changer son gain.
 */
export async function updateWeeklyTaskAction(
  taskId: string,
  title: string,
  categorySlug: string,
  difficulty: DifficultyKey,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!title.trim()) return { ok: false, error: "Le titre est vide." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id, kind: "hebdomadaire" },
  });
  if (!task) return { ok: false, error: "Engagement introuvable." };
  if (task.done) return { ok: false, error: "Déjà validé — plus modifiable." };

  const category = await prisma.category.findUnique({
    where: { userId_slug: { userId: user.id, slug: categorySlug } },
  });
  if (!category) return { ok: false, error: "Catégorie inconnue." };

  await prisma.task.update({
    where: { id: task.id },
    data: { title: title.trim(), categoryId: category.id, difficulty },
  });

  refresh();
  return { ok: true };
}

/** Retire un engagement récurrent : il cessera de revenir en réserve. */
export async function deactivateTemplateAction(
  templateId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const updated = await prisma.weeklyTemplate.updateMany({
    where: { id: templateId, userId: user.id },
    data: { active: false },
  });
  if (updated.count === 0) return { ok: false, error: "Engagement introuvable." };

  refresh();
  return { ok: true };
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const deleted = await prisma.task.deleteMany({
    where: { id: taskId, userId: user.id, done: false },
  });
  if (deleted.count === 0) {
    return { ok: false, error: "Tâche introuvable ou déjà validée." };
  }
  refresh();
  return { ok: true };
}

export async function buyRewardAction(
  rewardId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const reward = await prisma.reward.findFirst({
    where: { id: rewardId, userId: user.id },
  });
  if (!reward) return { ok: false, error: "Récompense introuvable." };
  if (reward.chestTier) return openChestAction(rewardId);
  if (reward.owned) return { ok: false, error: "Déjà remportée — profites-en." };

  // Le prix du marché, jamais celui de la base : afficher un prix soldé
  // puis en débiter un autre serait le pire défaut possible d'un marché.
  const prix = (await prixDeVente(user.id, reward.id)) ?? reward.price;
  if (user.coins < prix) return { ok: false, error: "Pas assez de pièces." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: user.coins - prix },
    }),
    prisma.reward.update({
      where: { id: reward.id },
      data: { owned: reward.kind === "cosmetique" },
    }),
    // Consigner l'achat : c'est lui qui fera monter le prix la prochaine fois.
    prisma.purchase.create({
      data: { userId: user.id, rewardId: reward.id, price: prix },
    }),
  ]);

  refresh();
  return { ok: true, coins: -prix };
}

/**
 * Ouvre un coffre : débite son prix et tire une récompense au sort parmi
 * celles de son palier.
 *
 * Le tirage se fait **côté serveur** — un tirage côté client serait
 * rejouable jusqu'au résultat souhaité. On écarte les coffres eux-mêmes
 * (sinon on pourrait gagner un coffre en ouvrant un coffre) et les gains
 * déjà remportés mais pas encore consommés, pour ne pas offrir deux fois
 * la même chose tant que la première n'a pas servi.
 */
export async function openChestAction(
  chestId: string,
): Promise<ActionResult & { won?: { label: string; icon: string; price: number } }> {
  const user = await getCurrentUser();
  const chest = await prisma.reward.findFirst({
    where: { id: chestId, userId: user.id },
  });
  if (!chest?.chestTier) return { ok: false, error: "Coffre introuvable." };

  const prix = (await prixDeVente(user.id, chest.id)) ?? chest.price;
  if (user.coins < prix) return { ok: false, error: "Pas assez de pièces." };

  const tier = CHEST_TIERS[chest.chestTier as ChestTier];
  const pool = await prisma.reward.findMany({
    where: {
      userId: user.id,
      chestTier: null,
      owned: false,
      price: { lte: Number.isFinite(tier.max) ? tier.max : undefined },
    },
  });
  if (pool.length === 0) {
    return { ok: false, error: "Rien à gagner dans ce palier pour l'instant." };
  }

  const won = pool[Math.floor(Math.random() * pool.length)];

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: user.coins - prix },
    }),
    prisma.reward.update({
      where: { id: won.id },
      data: { owned: true, wonAt: new Date() },
    }),
    prisma.purchase.create({
      data: { userId: user.id, rewardId: chest.id, price: prix },
    }),
  ]);

  refresh();
  return {
    ok: true,
    coins: -prix,
    won: { label: won.label, icon: won.icon, price: won.price },
  };
}

/** Consomme un gain remporté : il retourne au catalogue. */
export async function consumeRewardAction(
  rewardId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const updated = await prisma.reward.updateMany({
    where: { id: rewardId, userId: user.id, owned: true },
    data: { owned: false, wonAt: null },
  });
  if (updated.count === 0) return { ok: false, error: "Gain introuvable." };

  refresh();
  return { ok: true };
}

/**
 * Complète la boutique d'un compte existant avec les entrées du catalogue
 * qui lui manquent, sans toucher aux siennes.
 *
 * Volontairement additif : quelqu'un a pu personnaliser sa liste, et
 * l'écraser au passage d'une migration serait une perte silencieuse.
 */
export async function syncShopAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const existing = await prisma.reward.findMany({
    where: { userId: user.id },
    select: { label: true },
  });
  const connus = new Set(existing.map((r) => r.label));

  const manquants = DEFAULT_REWARDS.filter((r) => !connus.has(r.label));
  if (manquants.length === 0) {
    return { ok: false, error: "La boutique est déjà complète." };
  }

  await prisma.reward.createMany({
    data: manquants.map((r, i) => ({
      ...r,
      note: r.note ?? null,
      chestTier: r.chestTier ?? null,
      order: existing.length + i,
      userId: user.id,
    })),
  });

  refresh();
  return { ok: true };
}

/**
 * Applique tout de suite le malus dû ce soir, sans attendre minuit.
 * Le rollover nocturne ne redébitera pas : `malusApplied` fait foi.
 */
export async function applyTonightMalusAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const today = await getToday();

  if ((await getWeekKind(user.id, startOfWeek(today))) === "vacances") {
    return { ok: false, error: "Semaine de vacances : aucun malus." };
  }

  const missed = await prisma.task.findMany({
    where: {
      userId: user.id,
      date: today,
      kind: "quotidienne",
      done: false,
      malusApplied: false,
    },
  });
  if (missed.length === 0) return { ok: false, error: "Rien à débiter." };

  const malus = Math.min(
    missed.length * MALUS.quotidienne,
    DAILY_MALUS_CAP,
  );

  const applied = applyXpDelta(user.level, user.xp, -malus);
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: missed.map((t) => t.id) } },
      data: { malusApplied: true },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { level: applied.level, xp: applied.xp },
    }),
  ]);

  refresh();
  return { ok: true, xp: -malus };
}
