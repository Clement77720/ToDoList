import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { ensureRollover } from "@/lib/rollover";

/**
 * Le « job de minuit », pour de vrai.
 *
 * Sans lui, le rollover n'est rattrapé qu'au premier chargement de page :
 * qui n'ouvre pas l'application ne se voit jamais débiter, et sa série ne
 * bouge pas. Le cron clôt les journées de tout le monde à heure fixe.
 *
 * Le chemin paresseux de `getSessionUser()` reste en place : il couvre les
 * comptes créés après le passage du cron, et le cas où le cron échoue. Les
 * deux ne peuvent pas se marcher dessus — `ensureRollover()` réserve la
 * journée par compare-and-swap avant de travailler.
 */

export const dynamic = "force-dynamic";
/** Le rattrapage peut porter sur plusieurs comptes et plusieurs jours. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuser plutôt que de laisser la route ouverte : elle écrit en base.
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET non défini." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const today = todayISO();
  const users = await prisma.user.findMany({ select: { id: true } });

  let traites = 0;
  const echecs: string[] = [];

  // Séquentiel et isolé : un compte en erreur ne doit pas priver les
  // autres de leur rollover.
  for (const { id } of users) {
    try {
      await ensureRollover(id, today);
      traites += 1;
    } catch (error) {
      echecs.push(`${id}: ${(error as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: echecs.length === 0,
    date: today,
    comptes: users.length,
    traites,
    echecs,
  });
}
