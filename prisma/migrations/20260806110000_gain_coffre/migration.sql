-- Instant du tirage d'un coffre.
--
-- La révélation doit se lire dans les données : `refresh()` revalide le
-- layout et remonte les composants, un état local ne survivrait donc pas
-- à l'ouverture du coffre.

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "wonAt" TIMESTAMP(3);
