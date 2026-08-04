import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuestList — la to-do list gamifiée",
  description:
    "Transforme tes tâches quotidiennes en quêtes : XP, niveaux par catégorie, séries, badges et récompenses réelles.",
};

/**
 * Chaque écran lit l'état du joueur et la date du jour. Prérendre au build
 * figerait les deux : tout le rendu doit se faire à la demande.
 */
export const dynamic = "force-dynamic";

/** Racine minimale : la coquille applicative vit dans `(app)/layout.tsx`,
 *  pour que la connexion et l'inscription n'héritent ni de la barre
 *  latérale ni de la lecture du joueur — qui exigerait d'être connecté. */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
