import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/Toaster";
import { getPlayer, getSessionUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Coquille des écrans protégés. La garde est ici plutôt que dans chaque
 * page : un oubli sur une page future exposerait sinon les données d'un
 * compte à un visiteur anonyme.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await getSessionUser())) redirect("/connexion");
  const player = await getPlayer();

  return (
    <ToastProvider>
      <div className="relative z-10 flex">
        <Sidebar player={player} />
        <div className="min-w-0 flex-1">
          <TopBar player={player} />
          <main className="px-5 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
