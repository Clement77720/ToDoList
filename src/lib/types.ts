import type { BadgeDef } from "./catalog";
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
  avatar: string;
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
  note: string | null;
  owned: boolean;
};

export type BadgeDTO = BadgeDef & {
  unlocked: boolean;
  unlockedOn: string | null;
  progress: { current: number; goal: number } | null;
};
