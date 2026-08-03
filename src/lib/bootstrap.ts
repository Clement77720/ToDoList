import "server-only";
import { prisma } from "./db";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_REWARDS,
  DEFAULT_ROUTINES,
} from "./catalog";

/**
 * Amorçage du compte unique, au premier chargement d'une base vide.
 *
 * Sans lui, un déploiement neuf répond 500 tant qu'on n'a pas lancé le seed
 * à la main depuis un poste de dev : la base est vide, `getCurrentUser()`
 * lève, et l'application entière est inaccessible.
 *
 * On installe ici les *valeurs par défaut* de `catalog.ts` — catégories,
 * routines, boutique — et rien d'autre. Pas d'historique : les six mois de
 * démo restent l'affaire de `prisma/seed.ts`, qui sert à explorer l'appli en
 * local, pas à remplir un vrai suivi de tâches de données inventées.
 */

/** Clé arbitraire mais stable, propre à cette opération. */
const BOOTSTRAP_LOCK = 4242;

const DEFAULT_NAME = "Aventurier";

export async function bootstrapUser(): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    // Deux requêtes concurrentes peuvent démarrer ensemble sur une base
    // vide — c'est même le cas courant en serverless, où le premier
    // visiteur réveille plusieurs instances à la fois. Le verrou consultatif
    // est tenu jusqu'à la fin de la transaction : la seconde requête attend,
    // puis trouve le compte déjà créé et ressort sans rien dupliquer.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK})`;

    const existing = await tx.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (existing) return { id: existing.id };

    const user = await tx.user.create({
      data: { name: DEFAULT_NAME, avatar: "🦊" },
    });

    const categoryIds = new Map<string, string>();
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
      const row = await tx.category.create({
        data: { ...c, order: i, userId: user.id },
      });
      categoryIds.set(c.slug, row.id);
    }

    await tx.routine.createMany({
      data: DEFAULT_ROUTINES.map((r, i) => ({
        userId: user.id,
        categoryId: categoryIds.get(r.category)!,
        title: r.title,
        difficulty: r.difficulty,
        days: r.days.join(","),
        time: r.time ?? null,
        order: i,
      })),
    });

    await tx.reward.createMany({
      data: DEFAULT_REWARDS.map((r, i) => ({
        ...r,
        note: r.note ?? null,
        order: i,
        userId: user.id,
      })),
    });

    return { id: user.id };
  });
}
