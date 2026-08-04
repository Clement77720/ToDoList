import "server-only";
import { prisma } from "./db";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_REWARDS,
  DEFAULT_ROUTINES,
} from "./catalog";

/**
 * Création d'un compte avec ses valeurs par défaut.
 *
 * Un compte n'est utilisable que s'il possède ses catégories : tout le reste
 * (tâches, routines, statistiques) s'y rattache. On installe donc en une
 * seule transaction les catégories, les routines obligatoires et la boutique
 * de `catalog.ts` — jamais d'historique, qui reste l'affaire du seed local.
 */
export async function createUserWithDefaults(data: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data });

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
