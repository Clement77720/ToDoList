-- Familles de récompenses et coffres.
--
-- Additif : les boutiques existantes gardent leurs entrées, rangées par
-- défaut dans « divertissement ». Le catalogue enrichi est proposé aux
-- comptes déjà créés par le bouton « Compléter la boutique », jamais
-- imposé — quelqu'un a pu personnaliser sa liste, et l'écraser au passage
-- d'une migration serait une perte silencieuse.

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "chestTier" TEXT,
ADD COLUMN     "family" TEXT NOT NULL DEFAULT 'divertissement';

-- Les anciens cosmétiques n'ont jamais rien fait : on les range à part
-- pour qu'ils cessent d'occuper la première place du catalogue.
UPDATE "Reward" SET "family" = 'prestige' WHERE "kind" = 'cosmetique';

-- CreateIndex
CREATE INDEX "Reward_userId_family_idx" ON "Reward"("userId", "family");
