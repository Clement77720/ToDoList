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
import { vacationWeekStarts } from "./weeks";

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

/** Malus d'une journée : les quotidiennes oubliées, sous plafond. */
function malusQuotidien(oubliees: number, onVacation: boolean): number {
  return onVacation
    ? 0
    : Math.min(oubliees * MALUS.quotidienne, DAILY_MALUS_CAP);
}

/** Malus d'une semaine : les hebdomadaires oubliées, sous plafond. */
function malusHebdomadaire(oubliees: number, onVacation: boolean): number {
  return onVacation
    ? 0
    : Math.min(oubliees * MALUS.hebdomadaire, DAILY_MALUS_CAP);
}

export async function ensureRollover(userId: string, today: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  if (user.lastRollover === today) return; // déjà à jour

  const previous = user.lastRollover;

  /*
   * Réservation atomique de la journée.
   *
   * Lire `lastRollover` puis l'écrire à la fin laissait une fenêtre : en
   * serverless, plusieurs instances (ou une requête et le cron) entraient
   * ensemble. Le dégât n'est pas sur l'XP — écrite en valeur absolue
   * recalculée depuis le même instantané, elle converge — mais sur
   * `materializeRoutines` et `materializeWeeklyTemplates`, qui lisent ce
   * qui existe puis insèrent ce qui manque : chacune lit « rien » et
   * insère. Mesuré à 12 rollovers concurrents : 24 quotidiennes créées au
   * lieu de 2.
   *
   * Ce `updateMany` conditionné sur la valeur lue est un compare-and-swap :
   * Postgres ne laisse passer qu'un seul écrivain, les autres voient
   * `count === 0` et ressortent sans rien faire.
   *
   * On marque donc la journée traitée *avant* de travailler. C'est
   * volontaire : mieux vaut sauter un rollover en cas d'incident que le
   * jouer deux fois.
   */
  const claim = await prisma.user.updateMany({
    where: { id: userId, lastRollover: previous },
    data: { lastRollover: today },
  });
  if (claim.count === 0) return; // un autre processus s'en charge

  try {
    await runRollover(user, today, previous);
  } catch (error) {
    // Rendre la réservation pour que la prochaine tentative reprenne le
    // travail, plutôt que de laisser une journée définitivement sautée.
    await prisma.user.updateMany({
      where: { id: userId, lastRollover: today },
      data: { lastRollover: previous },
    });
    throw error;
  }
}

async function runRollover(
  user: { id: string; level: number; xp: number; streak: number; bestStreak: number; shields: number },
  today: string,
  previous: string | null,
) {
  const userId = user.id;
  const from = previous ?? addDays(today, -1);
  const gap = Math.min(daysBetween(from, today), MAX_CATCHUP_DAYS);

  let { level, xp, streak, bestStreak, shields } = user;

  const vacations = await vacationWeekStarts(userId);

  // Jours à clore : de `today - gap` jusqu'à hier inclus.
  //
  // L'ancienne formule `addDays(today, -(gap - i))` sur `i` de 1 à gap
  // décalait d'un jour : avec gap = 1 — le cas de loin le plus courant,
  // celui où l'on ouvre l'application tous les jours — elle produisait
  // `today`, sortait aussitôt, et ne clôturait donc jamais la veille. Ni
  // DayRecord, ni malus, ni série : les pénalités ne tombaient qu'après
  // une absence d'au moins deux jours.
  //
  // Partir de `today - gap` conserve le plafonnement : lors d'un long
  // retour de vacances, on rattrape les MAX_CATCHUP_DAYS jours les plus
  // récents, pas les plus anciens.
  const first = addDays(today, -gap);

  for (let i = 0; i < gap; i++) {
    const date = addDays(first, i);
    if (date >= today) break;

    const onVacation = vacations.has(startOfWeek(date));
    const closed = await closeDay(userId, date, onVacation);

    // Malus de fin de semaine : les hebdomadaires non faites tombent
    // le dimanche soir, jamais avant — elles restent déplaçables.
    let aDebiter = closed.restant;
    if (isoWeekday(date) === 7) {
      aDebiter += await closeWeek(userId, startOfWeek(date), onVacation);
    }

    // Série : un joker absorbe une journée ratée avant de la casser.
    // En vacances elle est gelée — ni progression, ni rupture, ni joker
    // consommé : c'est la contrepartie de l'absence de malus.
    if (closed.success) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      if (streak % 7 === 0) shields = Math.min(MAX_STREAK_SHIELDS, shields + 1);
    } else if (onVacation) {
      // rien
    } else if (shields > 0) {
      shields -= 1;
    } else {
      streak = 0;
    }

    // La clôture ne *rapporte* rien : l'XP d'une tâche est versée une
    // seule fois, quand on la coche. `closed.gained` reste le bilan de la
    // journée — une donnée d'affichage, pas une écriture au grand livre.
    // L'ajouter ici créditait tout une seconde fois à minuit.
    const applied = applyXpDelta(level, xp, -aDebiter);
    level = applied.level;
    xp = applied.xp;
  }

  await materializeRoutines(userId, today);
  await materializeWeeklyTemplates(userId, startOfWeek(today));

  await prisma.user.update({
    where: { id: userId },
    data: { level, xp, streak, bestStreak, shields, lastRollover: today },
  });
}

/**
 * Écrit le bilan d'une journée et débite ses quotidiennes oubliées.
 *
 * En semaine de vacances, les oubliées sont marquées `malusApplied` sans
 * rien débiter : elles sont *soldées*. Repasser la semaine en « normale »
 * plus tard ne peut donc pas les débiter rétroactivement.
 *
 * Deux montants, à ne pas confondre : `malus` est ce que la journée coûte
 * au total — c'est lui qu'on inscrit au journal, et c'est sur lui qu'un
 * rattrapage se calera pour savoir quoi rendre — tandis que `restant` est
 * ce qu'il reste à débiter, le joueur ayant pu solder sa soirée à l'avance
 * par `applyTonightMalusAction`. Les confondre inscrivait « −0 XP » sur une
 * journée qui avait bel et bien coûté 30.
 */
async function closeDay(userId: string, date: string, onVacation: boolean) {
  const tasks = await prisma.task.findMany({ where: { userId, date } });

  const done = tasks.filter((t) => t.done);
  const engagements = tasks.filter((t) => isEngagement(t.kind as TaskKind));
  const gained = done.reduce(
    (s, t) => s + DIFFICULTIES[t.difficulty as keyof typeof DIFFICULTIES].xp,
    0,
  );

  const oubliees = tasks.filter((t) => t.kind === "quotidienne" && !t.done);
  const dejaSoldees = oubliees.filter((t) => t.malusApplied);
  const malus = malusQuotidien(oubliees.length, onVacation);
  const restant = malus - malusQuotidien(dejaSoldees.length, onVacation);

  const aSolder = oubliees.filter((t) => !t.malusApplied);
  if (aSolder.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: aSolder.map((t) => t.id) } },
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
    restant,
    success: engagements.length > 0 && engagements.every((t) => t.done),
  };
}

/** Débite les hebdomadaires non faites d'une semaine révolue. */
async function closeWeek(
  userId: string,
  weekStart: string,
  onVacation: boolean,
): Promise<number> {
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

  // Marquées soldées dans les deux cas — voir `closeDay`.
  await prisma.task.updateMany({
    where: { id: { in: pending.map((t) => t.id) } },
    data: { malusApplied: true },
  });

  return malusHebdomadaire(pending.length, onVacation);
}

/* ── Rattrapage ─────────────────────────────────────────────────
   Corriger une journée déjà close revient à rendre le malus qu'elle
   avait coûté — jamais à la tâche : le plafond `DAILY_MALUS_CAP`
   rendrait le compte faux dès cinq oublis (5 × 15 = 75 demandés, 60
   débités). On recalcule donc le coût de la journée entière et on
   applique la *différence* avec ce qui est inscrit au journal, qui
   fait foi.

   L'XP de la tâche, elle, suit le chemin ordinaire : versée par
   l'action qui la coche, une fois et une seule.
   ────────────────────────────────────────────────────────────── */

/**
 * Refait le bilan d'une journée close après une correction.
 * Renvoie le **malus** à rendre (positif) ou à reprendre (négatif).
 *
 * Rien d'autre : l'XP de la tâche rattrapée est versée par l'action qui
 * la coche, comme pour n'importe quelle tâche. Le bilan `gained` est mis
 * à jour pour l'affichage, il n'entre pas dans le calcul rendu.
 */
export async function reconcilierJour(
  userId: string,
  date: string,
): Promise<number> {
  const onVacation = (await vacationWeekStarts(userId)).has(startOfWeek(date));
  const tasks = await prisma.task.findMany({ where: { userId, date } });

  const done = tasks.filter((t) => t.done);
  const engagements = tasks.filter((t) => isEngagement(t.kind as TaskKind));
  const gained = done.reduce(
    (s, t) => s + DIFFICULTIES[t.difficulty as keyof typeof DIFFICULTIES].xp,
    0,
  );
  const oubliees = tasks.filter((t) => t.kind === "quotidienne" && !t.done);
  const malus = malusQuotidien(oubliees.length, onVacation);

  const avant = await prisma.dayRecord.findUnique({
    where: { userId_date: { userId, date } },
  });

  const bilan = {
    done: done.length,
    total: tasks.length,
    gained,
    malus,
    success: engagements.length > 0 && engagements.every((t) => t.done),
    perfect: tasks.length > 0 && done.length === tasks.length,
  };
  await prisma.dayRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...bilan },
    update: bilan,
  });

  // La journée est close : toute quotidienne non faite y est soldée, y
  // compris celle qu'on vient de décocher. On ne lève jamais la marque —
  // c'est `DayRecord.malus` qui porte le compte, pas le drapeau, et une
  // tâche rattrapée puis décochée doit redevenir débitable.
  const aSolder = oubliees.filter((t) => !t.malusApplied);
  if (aSolder.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: aSolder.map((t) => t.id) } },
      data: { malusApplied: true },
    });
  }

  return (avant?.malus ?? 0) - malus;
}

/** Marque soldées les hebdomadaires encore ouvertes d'une semaine close. */
export async function solderSemaine(userId: string, weekStart: string) {
  await prisma.task.updateMany({
    where: {
      userId,
      weekStart,
      kind: "hebdomadaire",
      done: false,
      malusApplied: false,
    },
    data: { malusApplied: true },
  });
}

/**
 * Malus hebdomadaire dû par une semaine close, d'après l'état courant.
 *
 * Aucun journal à la maille de la semaine : on le relit des tâches. Lu
 * avant puis après une correction, l'écart donne exactement ce qu'il faut
 * rendre — plafond compris.
 */
export async function malusDeLaSemaine(
  userId: string,
  weekStart: string,
): Promise<number> {
  const onVacation = (await vacationWeekStarts(userId)).has(weekStart);
  const oubliees = await prisma.task.count({
    where: {
      userId,
      weekStart,
      kind: "hebdomadaire",
      done: false,
      malusApplied: true,
    },
  });
  return malusHebdomadaire(oubliees, onVacation);
}

/**
 * Recalcule série, record et jokers depuis le journal des journées closes.
 *
 * La série était purement incrémentale : rien ne permettait de la corriger
 * après coup. Un rattrapage pouvant transformer une journée ratée en
 * journée réussie, on la redérive de l'historique — la seule définition
 * qui reste vraie quelles que soient les corrections. Les règles
 * appliquées ici sont celles de `runRollover`, à la virgule près : toute
 * modification de l'une doit suivre dans l'autre.
 *
 * Le record, lui, ne redescend jamais : le journal peut être plus court
 * que la mémoire du compte.
 */
export async function rejouerSerie(userId: string, today: string) {
  const [records, vacations, user] = await Promise.all([
    prisma.dayRecord.findMany({
      where: { userId, date: { lt: today } },
      orderBy: { date: "asc" },
      select: { date: true, success: true },
    }),
    vacationWeekStarts(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bestStreak: true },
    }),
  ]);

  let streak = 0;
  let best = 0;
  let shields = 0;

  for (const r of records) {
    if (r.success) {
      streak += 1;
      best = Math.max(best, streak);
      if (streak % 7 === 0) shields = Math.min(MAX_STREAK_SHIELDS, shields + 1);
    } else if (vacations.has(startOfWeek(r.date))) {
      // série gelée
    } else if (shields > 0) {
      shields -= 1;
    } else {
      streak = 0;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { streak, bestStreak: Math.max(best, user.bestStreak), shields },
  });
  return { streak, shields };
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
 * Crée les hebdomadaires de la semaine à partir des engagements récurrents.
 *
 * Même logique que `materializeRoutines`, à la maille de la semaine : on ne
 * crée que ce qui manque, en s'appuyant sur `templateId` pour reconnaître ce
 * qui existe déjà. Rejouable sans risque de doublon.
 */
export async function materializeWeeklyTemplates(
  userId: string,
  weekStart: string,
) {
  const templates = await prisma.weeklyTemplate.findMany({
    where: { userId, active: true },
  });
  if (templates.length === 0) return;

  const existing = await prisma.task.findMany({
    where: { userId, weekStart, templateId: { in: templates.map((t) => t.id) } },
    select: { templateId: true },
  });
  const already = new Set(existing.map((t) => t.templateId));

  const missing = templates.filter((t) => !already.has(t.id));
  if (missing.length === 0) return;

  await prisma.task.createMany({
    data: missing.map((t) => ({
      userId,
      categoryId: t.categoryId,
      templateId: t.id,
      title: t.title,
      difficulty: t.difficulty,
      kind: "hebdomadaire",
      weekStart,
      date: null,
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
