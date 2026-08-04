-- Fuseau horaire par compte.
--
-- L'horloge du serveur est en UTC sur Vercel : sans cette colonne, la
-- journée d'un joueur français basculait à 2 h du matin l'été. La valeur
-- par défaut rattrape les comptes existants sans les casser.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';
