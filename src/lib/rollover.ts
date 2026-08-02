import "server-only";
import { prisma } from "./db";
import { addDays, daysBetween, isoWeekday, startOfWeek } from "./dates";
import {
  DAILY_MALUS_CAP,
  DIFFICULTIES,
  isEngagement,
  LEVEL_FLOOR_PROTECTION,
  MALUS,
  MAX_STREAK_SHIELDS,
  xpToNextLevel,
} from "./gamification";
import type { TaskKind } from "./gamification";

/**
 * Le « job de minuit ».
 *
 * En production ce serait un cron. Ici l'application est mono-utilisateur et
 * locale : on la rattrape paresseusement au premier chargement de la journée.
 * L'opération est idempotente — `lastRollover` garantit qu'un jour n'est
 * jamais clôturé deux fois, et `malusApplied` qu'une tâche n'est jamais
 * débitée deux fois.
 */

/** Nombre maximum de journées rattrapées d'un coup (retour de vacances). */
const MAX_CATCHUP_DAYS = 120;

export async function ensureRollover(userId: string, today: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  if (user.lastRollover === today) return; // déjà à jour

  const from = user.lastRollover ?? addDays(today, -1);
  const gap = Math.min(daysBetween(from, today), MAX_CATCHUP_DAYS);

  let { level, xp, streak, bestStreak, shields } = user;

  for (let i = 1; i <= gap; i++) {
    const date = addDays(today, -(gap - i));
    if (date >= today) break;

    const closed = await closeDay(userId, date);

    // Malus de fin de semaine : les hebdomadaires non faites tombent
    // le dimanche soir, jamais avant — elles restent déplaçables.
    let malus = closed.malus;
    if (isoWeekday(date) === 7) {
      malus += await closeWeek(userId, startOfWeek(date));
    }

    // Série : un joker absorbe une journée ratée avant de la casser.
    if (closed.success) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      if (streak % 7 === 0) shields = Math.min(MAX_STREAK_SHIELDS, shields + 1);
    } else if (shields > 0) {
      shields -= 1;
    } else {
      streak = 0;
    }

    const applied = applyXpDelta(level, xp, closed.gained - malus);
    level = applied.level;
    xp = applied.xp;
  }

  await materializeRoutines(userId, today);

  await prisma.user.update({
    where: { id: userId },
    data: { level, xp, streak, bestStreak, shields, lastRollover: today },
  });
}

/** Écrit le bilan d'une journée et débite ses quotidiennes oubliées. */
async function closeDay(userId: string, date: string) {
  const tasks = await prisma.task.findMany({ where: { userId, date } });

  const done = tasks.filter((t) => t.done);
  const engagements = tasks.filter((t) => isEngagement(t.kind as TaskKind));
  const gained = done.reduce(
    (s, t) => s + DIFFICULTIES[t.difficulty as keyof typeof DIFFICULTIES].xp,
    0,
  );

  const missedDaily = tasks.filter(
    (t) => t.kind === "quotidienne" && !t.done && !t.malusApplied,
  );
  const malus = Math.min(
    missedDaily.length * MALUS.quotidienne,
    DAILY_MALUS_CAP,
  );

  if (missedDaily.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: missedDaily.map((t) => t.id) } },
      data: { malusApplied: true },
    });
  }

  await prisma.dayRecord.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      done: done.length,
      total: tasks.length,
      gained,
      malus,
      success: engagements.length > 0 && engagements.every((t) => t.done),
      perfect: tasks.length > 0 && done.length === tasks.length,
    },
    update: { gained, malus },
  });

  return {
    gained,
    malus,
    success: engagements.length > 0 && engagements.every((t) => t.done),
  };
}

/** Débite les hebdomadaires non faites d'une semaine révolue. */
async function closeWeek(userId: string, weekStart: string): Promise<number> {
  const pending = await prisma.task.findMany({
    where: {
      userId,
      weekStart,
      kind: "hebdomadaire",
      done: false,
      malusApplied: false,
    },
  });
  if (pending.length === 0) return 0;

  await prisma.task.updateMany({
    where: { id: { in: pending.map((t) => t.id) } },
    data: { malusApplied: true },
  });

  return Math.min(pending.length * MALUS.hebdomadaire, DAILY_MALUS_CAP);
}

/** Crée les tâches du jour à partir des routines actives. */
export async function materializeRoutines(userId: string, date: string) {
  const dow = isoWeekday(date);
  const routines = await prisma.routine.findMany({
    where: { userId, active: true },
  });

  const applicable = routines.filter((r) =>
    r.days.split(",").filter(Boolean).map(Number).includes(dow),
  );
  if (applicable.length === 0) return;

  const existing = await prisma.task.findMany({
    where: { userId, date, routineId: { in: applicable.map((r) => r.id) } },
    select: { routineId: true },
  });
  const already = new Set(existing.map((t) => t.routineId));

  const missing = applicable.filter((r) => !already.has(r.id));
  if (missing.length === 0) return;

  await prisma.task.createMany({
    data: missing.map((r) => ({
      userId,
      categoryId: r.categoryId,
      routineId: r.id,
      title: r.title,
      difficulty: r.difficulty,
      kind: "quotidienne",
      date,
      time: r.time,
    })),
  });
}

/**
 * Applique un delta d'XP en gérant la montée de niveau et le plancher.
 * Avec LEVEL_FLOOR_PROTECTION, la barre s'arrête à zéro dans le niveau
 * courant : on perd sa progression, jamais son niveau.
 */
export function applyXpDelta(
  level: number,
  xp: number,
  delta: number,
): { level: number; xp: number; leveledUp: boolean } {
  let l = level;
  let total = xp + delta;
  let leveledUp = false;

  while (total >= xpToNextLevel(l)) {
    total -= xpToNextLevel(l);
    l += 1;
    leveledUp = true;
  }

  if (total < 0) {
    if (LEVEL_FLOOR_PROTECTION) {
      total = 0;
    } else {
      while (total < 0 && l > 1) {
        l -= 1;
        total += xpToNextLevel(l);
      }
      total = Math.max(0, total);
    }
  }

  return { level: l, xp: total, leveledUp };
}
