import type { DifficultyKey, Rarity } from "./gamification";

/**
 * Catalogue statique — ce sont des *règles*, pas des données utilisateur.
 * La base ne mémorise que ce qui est propre au joueur : possession d'un
 * badge, niveau d'une catégorie, jours actifs d'une routine.
 */

/* ── Catégories par défaut ─────────────────────────────────────
   Palette catégorielle validée : bande de clarté OKLCH [0.48–0.67],
   chroma ≥ 0.10, séparation daltonisme ΔE 12.8 (protan), contraste
   ≥ 3:1 sur la surface #14141C. Ordre fixe, jamais recyclé.
   ────────────────────────────────────────────────────────────── */
export type CategorySlug =
  | "sante"
  | "travail"
  | "maison"
  | "creativite"
  | "social";

export const DEFAULT_CATEGORIES: {
  slug: CategorySlug;
  label: string;
  icon: string;
  color: string;
}[] = [
  { slug: "sante", label: "Santé & Sport", icon: "🏋️", color: "#0FA372" },
  { slug: "travail", label: "Travail & Études", icon: "💼", color: "#8B5CF6" },
  { slug: "maison", label: "Maison", icon: "🏠", color: "#C57C05" },
  { slug: "creativite", label: "Créativité", icon: "🎨", color: "#EC4899" },
  { slug: "social", label: "Social", icon: "👥", color: "#2B93E0" },
];

/** XP nécessaire pour passer un niveau de catégorie (courbe plus douce). */
export function categoryXpToNext(level: number): number {
  return Math.round(80 * Math.pow(level, 1.25));
}

/* ── Routines par défaut ────────────────────────────────────────
   Les seules quotidiennes obligatoires. Volontairement deux, et pas
   plus : chaque ligne ajoutée ici est une dette quotidienne imposée à
   tout nouveau compte, malus compris. Le reste se crée à la demande.
   ────────────────────────────────────────────────────────────── */
export const DEFAULT_ROUTINES: {
  title: string;
  category: CategorySlug;
  difficulty: DifficultyKey;
  days: number[];
  time?: string;
}[] = [
  { title: "Faire du sport", category: "sante", difficulty: "moyenne", days: [1, 2, 3, 4, 5], time: "07:30" },
  { title: "Ne pas grignoter", category: "sante", difficulty: "facile", days: [1, 2, 3, 4, 5] },
];

/* ── Boutique par défaut ────────────────────────────────────── */
export const DEFAULT_REWARDS: {
  label: string;
  icon: string;
  price: number;
  kind: "reel" | "cosmetique";
  note?: string;
}[] = [
  { label: "Un épisode de ma série", icon: "📺", price: 40, kind: "reel" },
  { label: "2h de jeu vidéo sans culpabilité", icon: "🎮", price: 80, kind: "reel" },
  { label: "Grasse matinée du dimanche", icon: "😴", price: 120, kind: "reel" },
  { label: "Commander une pizza", icon: "🍕", price: 200, kind: "reel" },
  { label: "Sortie ciné", icon: "🍿", price: 350, kind: "reel" },
  { label: "L'achat que je repousse", icon: "🛍️", price: 800, kind: "reel" },
  { label: "Week-end escapade", icon: "🌴", price: 3000, kind: "reel" },
  { label: "Thème « Crépuscule »", icon: "🌇", price: 150, kind: "cosmetique", note: "Palette chaude" },
  { label: "Avatar — Dragon", icon: "🐉", price: 250, kind: "cosmetique" },
  { label: "Cadre de badge doré", icon: "🖼️", price: 400, kind: "cosmetique" },
  { label: "Animation « Confettis »", icon: "🎉", price: 300, kind: "cosmetique", note: "À chaque tâche validée" },
];

/* ── Badges ─────────────────────────────────────────────────── */
export type BadgeFamily =
  | "progression"
  | "perfection"
  | "regularite"
  | "thematique"
  | "temporel"
  | "secret";

/** Compteur auquel un badge se rattache — évalué côté serveur. */
export type BadgeMetric =
  | "tasks"
  | "perfectDays"
  | "perfectStreak"
  | "streak"
  | "noMalusDays"
  | "balancedCategories"
  | "weeklyPlaced"
  | `cat:${CategorySlug}`;

export type BadgeDef = {
  id: string;
  name: string;
  icon: string;
  family: BadgeFamily;
  rarity: Rarity;
  description: string;
  /** Absent = badge secret : aucune barre de progression affichée. */
  metric?: BadgeMetric;
  goal?: number;
};

export const BADGE_FAMILIES: { id: BadgeFamily; label: string }[] = [
  { id: "progression", label: "Progression" },
  { id: "perfection", label: "Perfection" },
  { id: "regularite", label: "Régularité" },
  { id: "thematique", label: "Thématiques" },
  { id: "temporel", label: "Temporels" },
  { id: "secret", label: "Secrets" },
];

export const BADGES: BadgeDef[] = [
  // Progression
  { id: "premier-pas", name: "Premier Pas", icon: "👣", family: "progression", rarity: "bronze", description: "Terminer sa toute première tâche", metric: "tasks", goal: 1 },
  { id: "sur-les-rails", name: "Sur les rails", icon: "🛤️", family: "progression", rarity: "bronze", description: "25 tâches terminées", metric: "tasks", goal: 25 },
  { id: "centurion", name: "Centurion", icon: "🛡️", family: "progression", rarity: "argent", description: "100 tâches terminées", metric: "tasks", goal: 100 },
  { id: "machine", name: "Machine", icon: "⚙️", family: "progression", rarity: "or", description: "500 tâches terminées", metric: "tasks", goal: 500 },
  { id: "millenaire", name: "Millénaire", icon: "🏛️", family: "progression", rarity: "platine", description: "1000 tâches terminées", metric: "tasks", goal: 1000 },
  // Perfection
  { id: "sans-faute", name: "Sans Faute", icon: "✨", family: "perfection", rarity: "bronze", description: "Une journée parfaite (engagements + bonus)", metric: "perfectDays", goal: 1 },
  { id: "semaine-impeccable", name: "Semaine Impeccable", icon: "💎", family: "perfection", rarity: "or", description: "7 journées parfaites d'affilée", metric: "perfectStreak", goal: 7 },
  { id: "mois-sacre", name: "Mois Sacré", icon: "👑", family: "perfection", rarity: "platine", description: "30 journées parfaites d'affilée", metric: "perfectStreak", goal: 30 },
  { id: "zero-malus", name: "Zéro Malus", icon: "🧊", family: "perfection", rarity: "or", description: "30 jours d'affilée sans perdre un seul XP", metric: "noMalusDays", goal: 30 },
  // Régularité
  { id: "etincelle", name: "Étincelle", icon: "⚡", family: "regularite", rarity: "bronze", description: "3 jours de série", metric: "streak", goal: 3 },
  { id: "braise", name: "Braise", icon: "🔥", family: "regularite", rarity: "argent", description: "7 jours de série", metric: "streak", goal: 7 },
  { id: "flamme", name: "Flamme", icon: "🌋", family: "regularite", rarity: "or", description: "30 jours de série", metric: "streak", goal: 30 },
  { id: "brasier", name: "Brasier", icon: "☄️", family: "regularite", rarity: "platine", description: "100 jours de série", metric: "streak", goal: 100 },
  { id: "soleil", name: "Soleil", icon: "🌞", family: "regularite", rarity: "platine", description: "365 jours de série", metric: "streak", goal: 365 },
  // Thématiques
  { id: "athlete", name: "Athlète", icon: "🏋️", family: "thematique", rarity: "argent", description: "50 tâches Santé & Sport", metric: "cat:sante", goal: 50 },
  { id: "bourreau", name: "Bourreau de travail", icon: "💼", family: "thematique", rarity: "or", description: "100 tâches Travail & Études", metric: "cat:travail", goal: 100 },
  { id: "maitre-maison", name: "Maître de maison", icon: "🏠", family: "thematique", rarity: "argent", description: "50 tâches Maison", metric: "cat:maison", goal: 50 },
  { id: "artisan", name: "Artisan", icon: "🎨", family: "thematique", rarity: "argent", description: "50 tâches Créativité", metric: "cat:creativite", goal: 50 },
  { id: "sociable", name: "Sociable", icon: "👥", family: "thematique", rarity: "argent", description: "50 tâches Social", metric: "cat:social", goal: 50 },
  { id: "equilibriste", name: "Équilibriste", icon: "⚖️", family: "thematique", rarity: "or", description: "Toutes les catégories au niveau 5+", metric: "balancedCategories", goal: 5 },
  // Temporels
  { id: "anticipateur", name: "Anticipateur", icon: "🗺️", family: "temporel", rarity: "bronze", description: "Toutes ses hebdomadaires placées d'un coup", metric: "weeklyPlaced", goal: 100 },
  { id: "leve-tot", name: "Lève-tôt", icon: "🌅", family: "temporel", rarity: "bronze", description: "10 tâches validées avant 8h" },
  { id: "nocturne", name: "Nocturne", icon: "🦉", family: "temporel", rarity: "bronze", description: "10 tâches validées après 22h" },
  { id: "guerrier-weekend", name: "Guerrier du week-end", icon: "⚔️", family: "temporel", rarity: "argent", description: "20 tâches sur un seul week-end" },
  { id: "saisonnier", name: "Saisonnier", icon: "🍂", family: "temporel", rarity: "or", description: "Une série active à chaque saison de l'année" },
  // Secrets
  { id: "phenix", name: "Phénix", icon: "🔥", family: "secret", rarity: "or", description: "Relancer une série de 7 jours après en avoir cassé une de 30+" },
  { id: "marathonien", name: "Marathonien", icon: "🏃", family: "secret", rarity: "argent", description: "10 tâches en une seule journée" },
  { id: "grand-menage", name: "Grand Ménage", icon: "🧹", family: "secret", rarity: "bronze", description: "Vider toutes ses tâches en retard d'un coup" },
  { id: "revenant", name: "Revenant", icon: "👻", family: "secret", rarity: "bronze", description: "???" },
  { id: "sniper", name: "Sniper", icon: "🎯", family: "secret", rarity: "or", description: "???" },
  { id: "insomniaque", name: "Insomniaque", icon: "🌙", family: "secret", rarity: "platine", description: "???" },
];

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);
