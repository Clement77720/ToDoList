/**
 * Règles du jeu — la source de vérité des barèmes.
 * Volontairement séparé des données : ces fonctions resteront identiques
 * quand la maquette sera branchée sur une vraie base.
 */

export type DifficultyKey = "facile" | "moyenne" | "difficile";

/*
 * Les pièces sont **découplées de l'XP** : elles ne servent qu'à la
 * boutique, jamais aux niveaux. On peut donc recalibrer l'économie sans
 * toucher à la progression, aux malus ni aux badges.
 *
 * Calibrage : un joueur assidu (deux quotidiennes tenues + deux
 * hebdomadaires, série longue) gagne environ 1 100 pièces par mois. Le
 * catalogue s'étale de 30 pièces — un plaisir du jour — à 8 000, atteint
 * en sept mois de régularité. Au taux précédent, le haut du catalogue
 * demandait plus de trois ans : ces récompenses n'étaient pas des
 * objectifs mais de la décoration.
 */
export const DIFFICULTIES: Record<
  DifficultyKey,
  { label: string; xp: number; coins: number; short: string }
> = {
  facile: { label: "Facile", short: "F", xp: 10, coins: 6 },
  moyenne: { label: "Moyenne", short: "M", xp: 25, coins: 15 },
  difficile: { label: "Difficile", short: "D", xp: 60, coins: 36 },
};

/* ── Types de tâche ─────────────────────────────────────────────
   quotidienne  : routine récurrente, revient automatiquement les
                  jours cochés (par défaut lundi → vendredi)
   hebdomadaire : engagement de la semaine, placé librement sur un
                  jour ; peut être déplacé tant que la semaine court
   bonus        : tout le reste — jamais obligatoire, jamais pénalisé
   ────────────────────────────────────────────────────────────── */
export type TaskKind = "quotidienne" | "hebdomadaire" | "bonus";

export const TASK_KINDS: Record<
  TaskKind,
  { label: string; plural: string; icon: string; hint: string }
> = {
  quotidienne: {
    label: "Quotidienne",
    plural: "Quotidiennes",
    icon: "🔁",
    hint: "Revient automatiquement les jours cochés",
  },
  hebdomadaire: {
    label: "Hebdomadaire",
    plural: "Hebdomadaires",
    icon: "📅",
    hint: "À placer où tu veux dans la semaine",
  },
  bonus: {
    label: "Bonus",
    plural: "Bonus",
    icon: "✨",
    hint: "Optionnelle — rapporte, mais ne pénalise jamais",
  },
};

/** Une tâche « engageante » compte dans le quota du jour. */
export const isEngagement = (kind: TaskKind) => kind !== "bonus";

/* ── Régime de semaine ──────────────────────────────────────────
   Une semaine de vacances n'inflige aucun malus et gèle la série :
   sans ce gel, partir en congés coûterait le multiplicateur accumulé,
   ce qui reviendrait à punir les vacances qu'on vient d'autoriser.
   ────────────────────────────────────────────────────────────── */
export type WeekKind = "normale" | "vacances";

export const WEEK_KINDS: Record<
  WeekKind,
  { label: string; icon: string; hint: string }
> = {
  normale: {
    label: "Normale",
    icon: "⚔️",
    hint: "Les engagements non tenus coûtent de l'XP.",
  },
  vacances: {
    label: "Vacances",
    icon: "🌴",
    hint: "Aucun malus, et la série reste figée.",
  },
};

/** Bonus appliqué si la tâche est terminée le jour prévu. */
export const PUNCTUALITY_BONUS = 0.2;

/** Plafond anti-farm : découper une tâche en dix ne rapporte plus rien. */
export const DAILY_XP_CAP = 250;

/** Quotidiennes + hebdomadaires placées sur un même jour. */
export const MAX_ENGAGEMENTS_PER_DAY = 4;

/* ── Malus ──────────────────────────────────────────────────────
   XP retirée pour une tâche engageante non faite.

   Quand ? Une quotidienne non faite est débitée à minuit. Une
   hebdomadaire ne l'est qu'à la fin de la semaine : elle reste
   déplaçable entre-temps, c'est tout l'intérêt du format.
   ────────────────────────────────────────────────────────────── */
export const MALUS: Record<TaskKind, number> = {
  quotidienne: 15,
  hebdomadaire: 25,
  bonus: 0,
};

/** Perte maximale sur une seule journée. Mettre à Infinity pour la version dure. */
export const DAILY_MALUS_CAP = 60;

/** Si true, l'XP ne descend jamais sous le seuil du niveau atteint. */
export const LEVEL_FLOOR_PROTECTION = true;

/** Malus dû ce soir : uniquement les quotidiennes non faites. */
export function tonightMalus(
  tasks: { kind: TaskKind; done: boolean }[],
): number {
  const raw = tasks
    .filter((t) => t.kind === "quotidienne" && !t.done)
    .reduce((s, t) => s + MALUS[t.kind], 0);
  return Math.min(raw, DAILY_MALUS_CAP);
}

/** Malus dû dimanche soir : hebdomadaires non faites, placées ou non. */
export function weekEndMalus(tasks: { done: boolean }[]): number {
  return Math.min(
    tasks.filter((t) => !t.done).length * MALUS.hebdomadaire,
    DAILY_MALUS_CAP,
  );
}

/** XP à accumuler pour passer du niveau n au niveau n+1. */
export function xpToNextLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.4));
}

const TITLES: { from: number; title: string }[] = [
  { from: 50, title: "Légende" },
  { from: 35, title: "Maître" },
  { from: 20, title: "Discipliné" },
  { from: 10, title: "Régulier" },
  { from: 5, title: "Apprenti" },
  { from: 1, title: "Novice" },
];

export function titleForLevel(level: number): string {
  return TITLES.find((t) => level >= t.from)?.title ?? "Novice";
}

const STREAK_TIERS: { days: number; multiplier: number }[] = [
  { days: 30, multiplier: 1.6 },
  { days: 14, multiplier: 1.4 },
  { days: 7, multiplier: 1.25 },
  { days: 3, multiplier: 1.1 },
];

export function streakMultiplier(days: number): number {
  return STREAK_TIERS.find((t) => days >= t.days)?.multiplier ?? 1;
}

/** Palier suivant de la série, pour afficher « plus que X jours ». */
export function nextStreakTier(
  days: number,
): { days: number; multiplier: number } | null {
  const upcoming = [...STREAK_TIERS].reverse().find((t) => t.days > days);
  return upcoming ?? null;
}

/** Un joker de protection gagné tous les 7 jours de série, stock max 2. */
export const MAX_STREAK_SHIELDS = 2;

export type Rarity = "bronze" | "argent" | "or" | "platine";

export const RARITY: Record<
  Rarity,
  { label: string; color: string; glow: string }
> = {
  bronze: { label: "Bronze", color: "#B87333", glow: "rgb(184 115 51 / 0.28)" },
  argent: { label: "Argent", color: "#C0C6D4", glow: "rgb(192 198 212 / 0.26)" },
  or: { label: "Or", color: "#F5B942", glow: "rgb(245 185 66 / 0.30)" },
  platine: { label: "Platine", color: "#7FE3D2", glow: "rgb(127 227 210 / 0.30)" },
};

/** Gain final d'une tâche, tous multiplicateurs appliqués. */
export function taskReward(
  difficulty: DifficultyKey,
  opts: { onTime: boolean; streakDays: number },
): { xp: number; coins: number } {
  const base = DIFFICULTIES[difficulty];
  const punctuality = opts.onTime ? 1 + PUNCTUALITY_BONUS : 1;
  const multiplier = punctuality * streakMultiplier(opts.streakDays);
  return {
    xp: Math.round(base.xp * multiplier),
    coins: Math.round(base.coins * multiplier),
  };
}
