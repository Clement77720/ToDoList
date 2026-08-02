"use client";

import { useOptimistic, useTransition } from "react";
import { toggleRoutineDayAction } from "@/app/actions";
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/dates";
import { DIFFICULTIES, MALUS, TASK_KINDS } from "@/lib/gamification";
import type { RoutineDTO } from "@/lib/types";
import { useToaster } from "./Toaster";
import { Card, CardTitle } from "./ui";

export function RoutinesEditor({ routines }: { routines: RoutineDTO[] }) {
  const { report } = useToaster();
  const [, startTransition] = useTransition();
  const [items, applyToggle] = useOptimistic(
    routines,
    (state: RoutineDTO[], change: { id: string; dow: number }) =>
      state.map((r) =>
        r.id === change.id
          ? {
              ...r,
              days: r.days.includes(change.dow)
                ? r.days.filter((d) => d !== change.dow)
                : [...r.days, change.dow].sort((a, b) => a - b),
            }
          : r,
      ),
  );

  const toggle = (id: string, dow: number) => {
    startTransition(async () => {
      applyToggle({ id, dow });
      report(await toggleRoutineDayAction(id, dow));
    });
  };

  return (
    <Card>
      <CardTitle right={`−${MALUS.quotidienne} XP par oubli, le soir même`}>
        {TASK_KINDS.quotidienne.icon} Mes quotidiennes
      </CardTitle>

      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: r.category.color }}
            />
            <span className="min-w-[150px] flex-1">
              <span className="block text-[13px]">{r.title}</span>
              <span className="text-[10px] text-ink-3">
                {r.category.label} · {DIFFICULTIES[r.difficulty].label}
                {r.time ? ` · ${r.time}` : ""}
              </span>
            </span>

            <span className="flex gap-1">
              {WEEKDAY_SHORT.map((label, i) => {
                const dow = i + 1;
                const active = r.days.includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggle(r.id, dow)}
                    aria-pressed={active}
                    aria-label={`${r.title} — ${WEEKDAY_LABELS[i]}`}
                    title={WEEKDAY_LABELS[i]}
                    className={`grid size-7 place-items-center rounded-lg text-[10px] font-semibold transition-colors ${
                      active
                        ? "text-bg"
                        : "border border-line text-ink-3 hover:border-violet/40"
                    }`}
                    style={active ? { background: r.category.color } : undefined}
                  >
                    {label[0]}
                  </button>
                );
              })}
            </span>

            <span className="w-14 text-right text-[10px] text-ink-3 tabular-nums">
              {r.days.length} j/sem
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Clique sur un jour pour l&apos;activer ou le désactiver. Les journées
        déjà passées ne bougent pas — seul le futur est recalculé.
      </p>
    </Card>
  );
}
