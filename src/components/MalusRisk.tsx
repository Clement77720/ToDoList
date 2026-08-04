"use client";

import Link from "next/link";
import { useTransition } from "react";
import { applyTonightMalusAction } from "@/app/actions";
import {
  DAILY_MALUS_CAP,
  LEVEL_FLOOR_PROTECTION,
  MALUS,
  tonightMalus,
  weekEndMalus,
  type WeekKind,
} from "@/lib/gamification";
import type { TaskDTO } from "@/lib/types";
import { useToaster } from "./Toaster";
import { Card, CardTitle, ProgressBar } from "./ui";

export function MalusRisk({
  todayTasks,
  weeklyPending,
  weekKind,
}: {
  todayTasks: TaskDTO[];
  /** Hebdomadaires de la semaine encore ouvertes. */
  weeklyPending: TaskDTO[];
  weekKind: WeekKind;
}) {
  const { report } = useToaster();
  const [pending, startTransition] = useTransition();

  const onVacation = weekKind === "vacances";
  const pendingDaily = todayTasks.filter(
    (t) => t.kind === "quotidienne" && !t.done,
  );
  // En vacances, plus rien n'est en jeu : on affiche zéro plutôt que de
  // laisser une menace chiffrée que le serveur n'appliquera jamais.
  const tonight = onVacation ? 0 : tonightMalus(todayTasks);
  const unplaced = weeklyPending.filter((w) => !w.date);
  const weekEnd = onVacation ? 0 : weekEndMalus(weeklyPending);
  const clean = tonight === 0;

  const apply = () =>
    startTransition(async () => report(await applyTonightMalusAction()));

  return (
    <Card className={clean ? "border-cat-sante/30" : "border-fire/35"}>
      <CardTitle right={onVacation ? "🌴 vacances" : "à minuit"}>
        Risque de malus
      </CardTitle>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-2">Ce soir</span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            clean ? "text-cat-sante" : "text-fire"
          }`}
        >
          {clean ? "0 XP" : `−${tonight} XP`}
        </span>
      </div>

      {pendingDaily.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {pendingDaily.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 text-[12px] text-ink-2"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: t.category.color }}
              />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="shrink-0 font-semibold text-fire tabular-nums">
                −{MALUS.quotidienne}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-ink-3">
          {todayTasks.some((t) => t.kind === "quotidienne")
            ? "Toutes tes quotidiennes sont faites. Rien à perdre cette nuit."
            : "Pas de quotidienne aujourd'hui — le week-end ne pénalise pas."}
        </p>
      )}

      {tonight > 0 ? (
        <div className="mt-3">
          <ProgressBar
            value={tonight}
            max={DAILY_MALUS_CAP}
            height={4}
            color="var(--color-fire)"
          />
          <p className="mt-1 text-[10px] text-ink-3 tabular-nums">
            plafonné à {DAILY_MALUS_CAP} XP par jour
          </p>
        </div>
      ) : null}

      <div className="mt-4 border-t border-line-soft pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-ink-2">Dimanche soir</span>
          <span
            className={`text-lg font-bold tabular-nums ${
              weekEnd === 0 ? "text-cat-sante" : "text-fire"
            }`}
          >
            {weekEnd === 0 ? "0 XP" : `−${weekEnd} XP`}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
          {weeklyPending.length} hebdomadaire
          {weeklyPending.length > 1 ? "s" : ""} encore ouverte
          {weeklyPending.length > 1 ? "s" : ""}
          {unplaced.length > 0 ? (
            <>
              , dont{" "}
              <strong className="text-fire">
                {unplaced.length} non placée{unplaced.length > 1 ? "s" : ""}
              </strong>
            </>
          ) : null}
          . Elles restent déplaçables jusqu&apos;à dimanche.
        </p>
        <Link
          href="/semaine"
          className="mt-2 inline-block text-[11px] text-violet-bright hover:underline"
        >
          Ouvrir le planning →
        </Link>
      </div>

      <button
        type="button"
        onClick={apply}
        disabled={pending || tonight === 0}
        className={`mt-4 w-full rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
          tonight === 0
            ? "cursor-not-allowed border border-line text-ink-3"
            : "border border-fire/45 bg-fire/15 text-fire hover:bg-fire/25"
        }`}
      >
        {pending ? "…" : "⏱ Débiter maintenant"}
      </button>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
        {LEVEL_FLOOR_PROTECTION
          ? "La barre s'arrête à zéro dans le niveau courant : tu perds ta progression, jamais ton niveau."
          : "Protection de niveau désactivée : l'XP peut faire redescendre d'un niveau."}
      </p>
    </Card>
  );
}
