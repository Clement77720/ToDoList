"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { addWeeklyTaskAction, placeWeeklyAction } from "@/app/actions";
import {
  addDays,
  dayOfMonth,
  formatDayMonth,
  isoWeekday,
  weekDates,
  WEEKDAY_SHORT,
} from "@/lib/dates";
import {
  DIFFICULTIES,
  MALUS,
  MAX_ENGAGEMENTS_PER_DAY,
  TASK_KINDS,
  type DifficultyKey,
} from "@/lib/gamification";
import type { CategoryDTO, RoutineDTO, TaskDTO } from "@/lib/types";
import { AddTaskForm } from "./AddTaskForm";
import { useToaster } from "./Toaster";
import { Card, CardTitle } from "./ui";

export function WeekPlanner({
  weekStart,
  today,
  routines,
  weekly,
  materialized,
  categories,
}: {
  weekStart: string;
  today: string;
  routines: RoutineDTO[];
  weekly: TaskDTO[];
  /** Quotidiennes déjà créées en base, par date. */
  materialized: Record<string, number>;
  categories: CategoryDTO[];
}) {
  const { report } = useToaster();
  const [selected, setSelected] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [tasks, applyMove] = useOptimistic(
    weekly,
    (state: TaskDTO[], move: { id: string; date: string | null }) =>
      state.map((t) => (t.id === move.id ? { ...t, date: move.date } : t)),
  );

  const days = weekDates(weekStart);
  const reserve = tasks.filter((t) => !t.date);
  const placedCount = tasks.length - reserve.length;
  const pending = tasks.filter((t) => !t.done);
  const atRisk = pending.length * MALUS.hebdomadaire;

  const routinesFor = (dow: number) => routines.filter((r) => r.days.includes(dow));

  const occupancy = (date: string) =>
    Math.max(routinesFor(isoWeekday(date)).length, materialized[date] ?? 0) +
    tasks.filter((t) => t.date === date).length;

  const move = (id: string, date: string | null) => {
    setSelected(null);
    startTransition(async () => {
      applyMove({ id, date });
      report(await placeWeeklyAction(id, date));
    });
  };

  const add = async (title: string, slug: string, difficulty: DifficultyKey) => {
    report(await addWeeklyTaskAction(weekStart, title, slug, difficulty));
  };

  const isCurrentWeek = today >= weekStart && today <= days[6];

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* Réserve */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle right={`${placedCount}/${tasks.length} placées`}>
            Réserve de la semaine
          </CardTitle>

          {reserve.length === 0 ? (
            <p className="rounded-xl border border-cat-sante/30 bg-cat-sante/10 px-3 py-4 text-center text-[12px] text-ink-2">
              ✅ Tout est placé. Plus rien ne traîne.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reserve.map((w) => {
                const isSel = selected === w.id;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(isSel ? null : w.id)}
                      aria-pressed={isSel}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        isSel
                          ? "border-violet-bright bg-violet/20 ring-2 ring-violet/40"
                          : "border-line bg-panel-2 hover:border-violet/40"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: w.category.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">
                          {w.title}
                        </span>
                        <span className="text-[10px] text-ink-3">
                          {DIFFICULTIES[w.difficulty].label} · −
                          {MALUS.hebdomadaire} XP dimanche
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-violet-bright">
                        {isSel ? "choisir un jour ↓" : "placer"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3">
            <AddTaskForm
              categories={categories}
              label="Ajouter un engagement hebdo"
              placeholder="Ex. Prendre RDV dentiste"
              onSubmit={add}
            />
          </div>
        </Card>

        <Card className={atRisk > 0 ? "border-fire/35" : "border-cat-sante/30"}>
          <CardTitle right="dimanche soir">En jeu cette semaine</CardTitle>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tabular-nums ${
                atRisk > 0 ? "text-fire" : "text-cat-sante"
              }`}
            >
              {atRisk > 0 ? `−${atRisk} XP` : "0 XP"}
            </span>
            <span className="text-[11px] text-ink-3">
              {pending.length} non terminée{pending.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Une hebdomadaire ratée un mardi ne coûte rien : tu la reposes
            ailleurs. Le malus ne tombe qu&apos;au bout de la semaine.
          </p>
        </Card>
      </div>

      {/* Les 7 jours */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/semaine?w=${addDays(weekStart, -7)}`}
              aria-label="Semaine précédente"
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-panel-2"
            >
              ‹
            </Link>
            <h2 className="min-w-[210px] text-center text-[15px] font-bold">
              {formatDayMonth(weekStart)} — {formatDayMonth(days[6])}
              {isCurrentWeek ? (
                <span className="ml-2 rounded-full bg-violet/20 px-2 py-0.5 text-[10px] font-semibold text-violet-bright">
                  en cours
                </span>
              ) : null}
            </h2>
            <Link
              href={`/semaine?w=${addDays(weekStart, 7)}`}
              aria-label="Semaine suivante"
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-panel-2"
            >
              ›
            </Link>
          </div>
          <span className="text-[11px] text-ink-3">
            {MAX_ENGAGEMENTS_PER_DAY} engagements maximum par jour
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {days.map((date, i) => {
            const dayRoutines = routinesFor(isoWeekday(date));
            const placed = tasks.filter((t) => t.date === date);
            const used = occupancy(date);
            const free = MAX_ENGAGEMENTS_PER_DAY - used;
            const isToday = date === today;
            const isPast = date < today;
            const canDrop = Boolean(selected) && free > 0 && !isPast;

            return (
              <div
                key={date}
                className={`flex min-h-[210px] flex-col rounded-xl border p-2.5 ${
                  isToday
                    ? "border-violet-bright bg-violet/8"
                    : isPast
                      ? "border-line-soft bg-panel/40"
                      : "border-line bg-panel-2/50"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span
                    className={`text-[12px] font-semibold ${
                      isToday ? "text-violet-bright" : "text-ink-2"
                    }`}
                  >
                    {WEEKDAY_SHORT[i]} {dayOfMonth(date)}
                  </span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      free === 0 ? "text-fire" : "text-ink-3"
                    }`}
                  >
                    {used}/{MAX_ENGAGEMENTS_PER_DAY}
                  </span>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {dayRoutines.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-1.5 rounded-lg border border-line-soft bg-panel/60 px-2 py-1.5 text-[11px] text-ink-3"
                      title="Routine récurrente — non déplaçable"
                    >
                      <span aria-hidden>{TASK_KINDS.quotidienne.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    </li>
                  ))}

                  {placed.map((w) => (
                    <li key={w.id}>
                      <div
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] ${
                          w.done
                            ? "border-cat-sante/35 bg-cat-sante/10 text-ink-3"
                            : "border-violet/35 bg-violet/12"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: w.category.color }}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            w.done ? "line-through" : ""
                          }`}
                        >
                          {w.title}
                        </span>
                        {w.done ? (
                          <span aria-hidden className="text-cat-sante">
                            ✓
                          </span>
                        ) : isPast ? null : (
                          <button
                            type="button"
                            onClick={() => move(w.id, null)}
                            aria-label={`Retirer ${w.title} du ${WEEKDAY_SHORT[i]}`}
                            className="shrink-0 text-ink-3 transition-colors hover:text-fire"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  {canDrop ? (
                    <button
                      type="button"
                      onClick={() => move(selected!, date)}
                      className="anim-pop-in w-full rounded-lg border border-dashed border-violet-bright bg-violet/15 py-2 text-[11px] font-semibold text-violet-bright transition-colors hover:bg-violet/25"
                    >
                      ＋ placer ici
                    </button>
                  ) : selected && !isPast ? (
                    <span className="block rounded-lg border border-dashed border-line py-2 text-center text-[10px] text-ink-3">
                      complet
                    </span>
                  ) : free > 0 && !isPast ? (
                    <span className="block text-center text-[10px] text-ink-3">
                      {free} créneau{free > 1 ? "x" : ""} libre
                      {free > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 border-t border-line-soft pt-3 text-[11px] leading-relaxed text-ink-3">
          Les <strong className="text-ink-2">🔁 quotidiennes</strong> occupent
          leurs créneaux automatiquement et ne se déplacent pas. Le week-end est
          libre : c&apos;est là que se logent les grosses hebdomadaires.
        </p>
      </Card>
    </div>
  );
}
