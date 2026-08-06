/**
 * Le marché — règles de variation des prix de la boutique.
 *
 * Volontairement séparé des données et sans `server-only` : ce sont des
 * fonctions pures, vérifiables sans base, et le client affiche le même
 * résultat que celui débité par le serveur.
 *
 * Deux forces opposées :
 * — ce qu'on achète souvent renchérit, pour que la boutique ne se réduise
 *   pas à un distributeur à pizzas ;
 * — ce qu'on délaisse se solde, pour ramener l'attention sur des envies
 *   oubliées.
 *
 * Plus une offre du jour à −30 %, tirée au sort mais **déterministe** :
 * même joueur, même jour, même offre. Sans cette garantie, le prix
 * changerait à chaque rechargement et le prix affiché ne serait pas celui
 * débité.
 */

export const MARKET = {
  /** Fenêtre sur laquelle se mesure la demande. */
  FENETRE_JOURS: 30,
  /** Renchérissement par achat dans la fenêtre. */
  HAUSSE_PAR_ACHAT: 0.15,
  /** Une récompense ne peut pas plus que passer du simple au +60 %. */
  PLAFOND: 1.6,
  /** Ni descendre sous les trois quarts de son prix. */
  PLANCHER: 0.75,
  /** Jours d'indifférence avant que la remise commence. */
  DELAISSEE_JOURS: 21,
  /** Puis 1 % par jour supplémentaire. */
  BAISSE_PAR_JOUR: 0.01,
  /** Remise de l'offre du jour. */
  PROMO: 0.3,
} as const;

export type Tendance = "hausse" | "baisse" | "stable";

export type EtatMarche = {
  /** Achats de cette récompense dans la fenêtre. */
  achatsRecents: number;
  /** Jours depuis le dernier achat — ou depuis l'entrée en boutique. */
  joursDepuisAchat: number;
  enPromo: boolean;
};

/** Multiplicateur appliqué au prix de base, hors promo. */
export function multiplicateur({
  achatsRecents,
  joursDepuisAchat,
}: Pick<EtatMarche, "achatsRecents" | "joursDepuisAchat">): number {
  if (achatsRecents > 0) {
    return Math.min(
      MARKET.PLAFOND,
      1 + MARKET.HAUSSE_PAR_ACHAT * achatsRecents,
    );
  }
  const exces = joursDepuisAchat - MARKET.DELAISSEE_JOURS;
  if (exces <= 0) return 1;
  return Math.max(MARKET.PLANCHER, 1 - MARKET.BAISSE_PAR_JOUR * exces);
}

/**
 * Prix effectif. Arrondi à la dizaine : un prix à trois décimales
 * donnerait l'impression d'un bug plutôt que d'un marché.
 */
export function prixEffectif(base: number, etat: EtatMarche): number {
  const m = multiplicateur(etat) * (etat.enPromo ? 1 - MARKET.PROMO : 1);
  return Math.max(10, Math.round((base * m) / 10) * 10);
}

export function tendance(base: number, effectif: number): Tendance {
  if (effectif > base) return "hausse";
  if (effectif < base) return "baisse";
  return "stable";
}

/**
 * Offre du jour, tirée de façon déterministe.
 *
 * Le tirage dérive de `graine` — en pratique `${userId}:${date}` — et non
 * de `Math.random()` : deux rendus de la même journée doivent désigner la
 * même récompense, sinon le prix affiché n'est pas celui débité. La liste
 * est triée avant tirage pour que l'ordre de lecture en base n'entre pas
 * dans le résultat.
 */
export function offreDuJour(graine: string, ids: string[]): string | null {
  if (ids.length === 0) return null;

  // FNV-1a : court, stable, sans dépendance.
  let h = 2166136261;
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const tries = [...ids].sort();
  return tries[Math.abs(h) % tries.length];
}
