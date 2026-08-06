import type { BadgeDef, ChestTier, RewardFamily } from "./catalog";
import type { DifficultyKey, TaskKind } from "./gamification";

/**
 * Formes échangées entre serveur et client. Volontairement plates et
 * sérialisables : aucun objet Prisma ne traverse la frontière.
 */

export type CategoryRef = {
  slug: string;
  label: string;
  icon: string;
  color: string;
};

export type TaskDTO = {
  id: string;
  title: string;
  difficulty: DifficultyKey;
  kind: TaskKind;
  date: string | null;
  weekStart: string | null;
  done: boolean;
  time: string | null;
  category: CategoryRef;
};

export type DayDTO = {
  date: string;
  done: number;
  total: number;
  gained: number;
  malus: number;
  /** Net = gagné − perdu. */
  xp: number;
  ratio: number;
  success: boolean;
  perfect: boolean;
};

export type CategoryDTO = CategoryRef & {
  id: string;
  level: number;
  xp: number;
  xpMax: number;
};

export type PlayerDTO = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  /** Data URI, ou null si le joueur s'en tient à son emoji. */
  photo: string | null;
  /** Fuseau IANA — décide de l'heure à laquelle sa journée bascule. */
  timezone: string;
  level: number;
  xp: number;
  xpMax: number;
  coins: number;
  streak: number;
  bestStreak: number;
  shields: number;
};

export type RoutineDTO = {
  id: string;
  title: string;
  difficulty: DifficultyKey;
  days: number[];
  time: string | null;
  category: CategoryRef;
};

export type RewardDTO = {
  id: string;
  label: string;
  icon: string;
  price: number;
  kind: "reel" | "cosmetique";
  family: RewardFamily;
  /** Renseigné pour les coffres. */
  chestTier: ChestTier | null;
  note: string | null;
  /** Gain de coffre remporté, pas encore consommé. */
  owned: boolean;
  /** Millisecondes depuis le tirage, ou null. Sert à révéler le gain. */
  wonAgoMs: number | null;
};

export type BadgeDTO = BadgeDef & {
  unlocked: boolean;
  unlockedOn: string | null;
  progress: { current: number; goal: number } | null;
};
