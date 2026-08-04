import "server-only";
import { prisma } from "./db";
import type { WeekKind } from "./gamification";

/**
 * Lecture du régime d'une semaine.
 *
 * On ne stocke une ligne que pour les semaines mises en vacances : l'absence
 * d'enregistrement vaut « normale ». Les libellés et la règle elle-même
 * vivent dans `gamification.ts` — ce fichier est `server-only`, et les
 * composants clients ont besoin des libellés.
 */

export async function getWeekKind(
  userId: string,
  weekStart: string,
): Promise<WeekKind> {
  const row = await prisma.weekSetting.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    select: { kind: true },
  });
  return row?.kind === "vacances" ? "vacances" : "normale";
}

/** Tous les lundis mis en vacances — pour le rollover, qui balaie des jours. */
export async function vacationWeekStarts(userId: string): Promise<Set<string>> {
  const rows = await prisma.weekSetting.findMany({
    where: { userId, kind: "vacances" },
    select: { weekStart: true },
  });
  return new Set(rows.map((r) => r.weekStart));
}
