import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Écrans publics. Un visiteur déjà connecté n'a rien à y faire. */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (await getSessionUser()) redirect("/");

  return (
    <div className="relative z-10 grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
