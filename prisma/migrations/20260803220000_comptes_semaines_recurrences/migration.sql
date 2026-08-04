-- Comptes multi-utilisateurs, régime de semaine, engagements récurrents.

-- AlterTable : hebdomadaires issues d'un engagement récurrent
ALTER TABLE "Task" ADD COLUMN     "templateId" TEXT;

-- AlterTable : identifiants de connexion et photo de profil
--
-- `email` et `passwordHash` sont obligatoires, mais la table peut déjà
-- contenir le compte unique de l'époque sans authentification. On ajoute
-- donc les colonnes en nullable, on comble les lignes existantes, puis on
-- pose la contrainte — sinon la migration échoue sur une base peuplée.
ALTER TABLE "User" ADD COLUMN     "email" TEXT;
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN     "photo" TEXT;

-- Un hash vide ne correspond à aucun mot de passe : le compte hérité
-- devient inaccessible plutôt qu'ouvert à tous. C'est le sens sûr.
UPDATE "User"
SET "email" = COALESCE("email", 'compte-' || "id" || '@questlist.local'),
    "passwordHash" = COALESCE("passwordHash", '');

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "WeekSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeekSetting_userId_weekStart_key" ON "WeekSetting"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeeklyTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekSetting" ADD CONSTRAINT "WeekSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTemplate" ADD CONSTRAINT "WeeklyTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTemplate" ADD CONSTRAINT "WeeklyTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
