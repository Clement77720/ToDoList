import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/Toaster";
import { getPlayer } from "@/lib/queries";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const player = await getPlayer();

  return (
    <html lang="fr">
      <body className="min-h-dvh">
        <ToastProvider>
          <div className="relative z-10 flex">
            <Sidebar player={player} />
            <div className="min-w-0 flex-1">
              <TopBar player={player} />
              <main className="px-5 py-6 lg:px-8">{children}</main>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
