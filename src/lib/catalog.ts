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

/* ── Boutique par défaut ────────────────────────────────────────
   Sept familles, du plaisir immédiat au grand objectif. L'échelle est
   volontairement large : sans un sommet lointain, il n'y a rien à
   épargner ; sans un bas accessible, rien à se offrir cette semaine.
   Prix calibrés sur ~1 100 pièces/mois — cf. DIFFICULTIES.
   ────────────────────────────────────────────────────────────── */

export type RewardFamily =
  | "divertissement"
  | "nourriture"
  | "achats"
  | "temps-libre"
  | "experiences"
  | "social"
  | "prestige"
  | "coffre";

export const REWARD_FAMILIES: {
  id: RewardFamily;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { id: "divertissement", label: "Divertissement", icon: "🎮", hint: "De quoi souffler ce soir" },
  { id: "nourriture", label: "Nourriture", icon: "🍔", hint: "Les petits plaisirs qui se mangent" },
  { id: "temps-libre", label: "Temps libre", icon: "😴", hint: "Le droit de ne rien faire, sans culpabilité" },
  { id: "social", label: "Social", icon: "❤️", hint: "À dépenser avec les autres" },
  { id: "achats", label: "Achats", icon: "🛍️", hint: "Ce que tu repousses depuis des mois" },
  { id: "experiences", label: "Expériences", icon: "✈️", hint: "Ça se prépare, ça se mérite" },
  { id: "prestige", label: "Prestige", icon: "🏆", hint: "Le sommet — plusieurs mois d'épargne" },
  { id: "coffre", label: "Coffres", icon: "🎁", hint: "Le contenu est tiré au sort" },
];

/**
 * Paliers des coffres. Un coffre tire au sort une récompense dont le prix
 * ne dépasse pas `max` : il vaut donc statistiquement plus cher que son
 * prix, et c'est tout l'intérêt du pari.
 */
export const CHEST_TIERS = {
  commun: { label: "Coffre commun", price: 100, max: 500 },
  rare: { label: "Coffre rare", price: 500, max: 2500 },
  legendaire: { label: "Coffre légendaire", price: 2000, max: Infinity },
} as const;

export type ChestTier = keyof typeof CHEST_TIERS;

export const DEFAULT_REWARDS: {
  label: string;
  icon: string;
  price: number;
  family: RewardFamily;
  kind: "reel" | "cosmetique";
  note?: string;
  chestTier?: ChestTier;
}[] = [
  // 🎮 Divertissement
  { label: "Écouter un album sans interruption", icon: "🎵", price: 30, family: "divertissement", kind: "reel" },
  { label: "Regarder un épisode de série", icon: "📺", price: 40, family: "divertissement", kind: "reel" },
  { label: "1h de jeu vidéo", icon: "🎮", price: 80, family: "divertissement", kind: "reel" },
  { label: "Commander une pizza", icon: "🍕", price: 200, family: "divertissement", kind: "reel" },
  { label: "Soirée jeux de société", icon: "🎲", price: 250, family: "divertissement", kind: "reel" },
  { label: "Aller au cinéma", icon: "🍿", price: 350, family: "divertissement", kind: "reel" },
  { label: "Acheter un livre", icon: "📚", price: 500, family: "divertissement", kind: "reel" },

  // 🍔 Nourriture
  { label: "Une gourmandise", icon: "🍫", price: 50, family: "nourriture", kind: "reel" },
  { label: "Une glace", icon: "🍦", price: 100, family: "nourriture", kind: "reel" },
  { label: "Le café de ton coffee shop préféré", icon: "☕", price: 120, family: "nourriture", kind: "reel" },
  { label: "Dessert au restaurant", icon: "🍰", price: 150, family: "nourriture", kind: "reel" },
  { label: "Fast-food", icon: "🍔", price: 250, family: "nourriture", kind: "reel" },
  { label: "Restaurant", icon: "🍣", price: 800, family: "nourriture", kind: "reel" },

  // 😴 Temps libre
  { label: "30 min de réseaux sociaux", icon: "📱", price: 40, family: "temps-libre", kind: "reel" },
  { label: "Faire une sieste", icon: "😴", price: 60, family: "temps-libre", kind: "reel" },
  { label: "Grasse matinée", icon: "🌞", price: 120, family: "temps-libre", kind: "reel" },
  { label: "Après-midi sans culpabilité", icon: "🛋️", price: 300, family: "temps-libre", kind: "reel" },
  { label: "Journée sans tâches", icon: "🚫", price: 2000, family: "temps-libre", kind: "reel", note: "Les malus tombent quand même — ça s'assume" },

  // ❤️ Social
  { label: "Appeler un ami pendant une heure", icon: "☎️", price: 60, family: "social", kind: "reel" },
  { label: "Bowling", icon: "🎳", price: 300, family: "social", kind: "reel" },
  { label: "Sortie avec des amis", icon: "🍻", price: 400, family: "social", kind: "reel" },
  { label: "Restaurant en couple", icon: "🍽️", price: 900, family: "social", kind: "reel" },

  // 🛍️ Achats
  { label: "Achat plaisir en ligne", icon: "📦", price: 1000, family: "achats", kind: "reel", note: "Le plafond que tu t'accordes" },
  { label: "Acheter un vêtement", icon: "👕", price: 1500, family: "achats", kind: "reel" },
  { label: "Nouveau jeu Steam ou Switch", icon: "🎮", price: 2000, family: "achats", kind: "reel" },
  { label: "Nouvel accessoire tech", icon: "🎧", price: 3000, family: "achats", kind: "reel" },
  { label: "Le gadget que tu repousses", icon: "📱", price: 5000, family: "achats", kind: "reel" },

  // ✈️ Expériences
  { label: "Balade à vélo", icon: "🚲", price: 150, family: "experiences", kind: "reel" },
  { label: "Journée plage", icon: "🏖️", price: 400, family: "experiences", kind: "reel" },
  { label: "Concert", icon: "🎤", price: 1200, family: "experiences", kind: "reel" },
  { label: "Camping", icon: "🏕️", price: 2500, family: "experiences", kind: "reel" },
  { label: "Week-end", icon: "🚗", price: 3000, family: "experiences", kind: "reel" },
  { label: "Parc d'attractions", icon: "🎡", price: 5000, family: "experiences", kind: "reel" },
  { label: "Vacances", icon: "🌴", price: 6000, family: "experiences", kind: "reel" },

  // 🏆 Prestige
  { label: "Nouveau clavier", icon: "💻", price: 2500, family: "prestige", kind: "reel" },
  { label: "Nouvelle paire de chaussures", icon: "👟", price: 3000, family: "prestige", kind: "reel" },
  { label: "Une montre", icon: "⌚", price: 4000, family: "prestige", kind: "reel" },
  { label: "Écran PC", icon: "🖥️", price: 5000, family: "prestige", kind: "reel" },
  { label: "Nouvelle console", icon: "🎮", price: 7000, family: "prestige", kind: "reel" },
  { label: "Nouveau téléphone", icon: "📱", price: 8000, family: "prestige", kind: "reel" },
  { label: "Un voyage", icon: "✈️", price: 8000, family: "prestige", kind: "reel" },

  // 🎁 Coffres
  { label: CHEST_TIERS.commun.label, icon: "🎁", price: CHEST_TIERS.commun.price, family: "coffre", kind: "reel", chestTier: "commun", note: "Une récompense jusqu'à 500 pièces" },
  { label: CHEST_TIERS.rare.label, icon: "🎁", price: CHEST_TIERS.rare.price, family: "coffre", kind: "reel", chestTier: "rare", note: "Une récompense jusqu'à 2 500 pièces" },
  { label: CHEST_TIERS.legendaire.label, icon: "🎁", price: CHEST_TIERS.legendaire.price, family: "coffre", kind: "reel", chestTier: "legendaire", note: "N'importe quelle récompense du catalogue" },
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
