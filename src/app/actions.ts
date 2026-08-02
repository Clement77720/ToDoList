"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, grantEarnedBadges } from "@/lib/queries";
import { applyXpDelta, materializeRoutines } from "@/lib/rollover";
import { categoryXpToNext } from "@/lib/catalog";
import { isoWeekday, todayISO } from "@/lib/dates";
import {
  DAILY_MALUS_CAP,
  MALUS,
  MAX_ENGAGEMENTS_PER_DAY,
  taskReward,
  type DifficultyKey,
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

  const today = todayISO();
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
    if (date < todayISO()) {
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
  const today = todayISO();
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

/** Crée un engagement hebdomadaire dans la réserve d'une semaine. */
export async function addWeeklyTaskAction(
  weekStart: string,
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
      kind: "hebdomadaire",
      weekStart,
      date: null,
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
  if (reward.owned) return { ok: false, error: "Déjà débloquée." };
  if (user.coins < reward.price) {
    return { ok: false, error: "Pas assez de pièces." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: user.coins - reward.price },
    }),
    prisma.reward.update({
      where: { id: reward.id },
      data: { owned: reward.kind === "cosmetique" },
    }),
  ]);

  refresh();
  return { ok: true, coins: -reward.price };
}

/**
 * Applique tout de suite le malus dû ce soir, sans attendre minuit.
 * Le rollover nocturne ne redébitera pas : `malusApplied` fait foi.
 */
export async function applyTonightMalusAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const today = todayISO();

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
