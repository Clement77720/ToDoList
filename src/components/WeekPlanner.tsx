"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import {
  addWeeklyTaskAction,
  placeWeeklyAction,
  setWeekKindAction,
  updateWeeklyTaskAction,
} from "@/app/actions";
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
  WEEK_KINDS,
  type DifficultyKey,
  type WeekKind,
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
  daily,
  categories,
  weekKind,
}: {
  weekStart: string;
  today: string;
  routines: RoutineDTO[];
  weekly: TaskDTO[];
  /** Quotidiennes réellement créées en base — elles portent l'état « faite ». */
  daily: TaskDTO[];
  categories: CategoryDTO[];
  weekKind: WeekKind;
}) {
  const { report } = useToaster();
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [tasks, applyMove] = useOptimistic(
    weekly,
    (state: TaskDTO[], move: { id: string; date: string | null }) =>
      state.map((t) => (t.id === move.id ? { ...t, date: move.date } : t)),
  );
  const [kind, applyKind] = useOptimistic(weekKind, (_: WeekKind, k: WeekKind) => k);

  const days = weekDates(weekStart);
  const reserve = tasks.filter((t) => !t.date);
  const placedCount = tasks.length - reserve.length;
  const pending = tasks.filter((t) => !t.done);
  const onVacation = kind === "vacances";
  const atRisk = onVacation ? 0 : pending.length * MALUS.hebdomadaire;

  const routinesFor = (dow: number) => routines.filter((r) => r.days.includes(dow));
  const dailyFor = (date: string) => daily.filter((t) => t.date === date);

  const occupancy = (date: string) =>
    Math.max(routinesFor(isoWeekday(date)).length, dailyFor(date).length) +
    tasks.filter((t) => t.date === date).length;

  const move = (id: string, date: string | null) => {
    setSelected(null);
    setDragging(null);
    setOver(null);
    startTransition(async () => {
      applyMove({ id, date });
      report(await placeWeeklyAction(id, date));
    });
  };

  const add = async (
    title: string,
    slug: string,
    difficulty: DifficultyKey,
    recurring: boolean,
  ) => {
    report(await addWeeklyTaskAction(weekStart, title, slug, difficulty, recurring));
  };

  const edit = async (
    id: string,
    title: string,
    slug: string,
    difficulty: DifficultyKey,
  ) => {
    report(await updateWeeklyTaskAction(id, title, slug, difficulty));
  };

  const setKind = (next: WeekKind) => {
    startTransition(async () => {
      applyKind(next);
      report(await setWeekKindAction(weekStart, next));
    });
  };

  /** Un jour accepte-t-il encore un dépôt ? */
  const accepts = (date: string) =>
    date >= today && MAX_ENGAGEMENTS_PER_DAY - occupancy(date) > 0;

  /* ── Habillage ──────────────────────────────────────────────────
     Une semaine de vacances bascule sur la rampe verte : c'est le seul
     signal qui distingue les deux régimes une fois la page défilée.
     La teinte du « fait » suit, sinon un coche vert sur fond vert
     disparaîtrait. Le reste de la grille est identique — même densité,
     mêmes places : seule la couleur change.
     ────────────────────────────────────────────────────────────── */
  const doneClasses = onVacation
    ? "border-vac-5/45 bg-vac-5/12 text-ink-3"
    : "border-cat-sante/35 bg-cat-sante/10 text-ink-3";
  const checkClass = onVacation ? "text-vac-5" : "text-cat-sante";
  const placedClasses = onVacation
    ? "border-vac-4/45 bg-vac-4/15"
    : "border-violet/35 bg-violet/12";
  const todayCell = onVacation
    ? "border-vac-4 bg-vac-4/10"
    : "border-violet-bright bg-violet/8";
  const overCell = onVacation
    ? "border-vac-5 bg-vac-4/25 ring-2 ring-vac-4/45"
    : "border-violet-bright bg-violet/20 ring-2 ring-violet/40";
  const dropZone = onVacation
    ? "border-vac-5 bg-vac-4/20 text-vac-5 hover:bg-vac-4/30"
    : "border-violet-bright bg-violet/15 text-violet-bright hover:bg-violet/25";

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

                if (editing === w.id) {
                  return (
                    <li key={w.id}>
                      <AddTaskForm
                        categories={categories}
                        label="Modifier"
                        placeholder="Intitulé de l'engagement"
                        initial={{
                          title: w.title,
                          slug: w.category.slug,
                          difficulty: w.difficulty,
                        }}
                        onCancel={() => setEditing(null)}
                        onSubmit={(title, slug, difficulty) =>
                          edit(w.id, title, slug, difficulty)
                        }
                      />
                    </li>
                  );
                }

                return (
                  <li key={w.id}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDragging(w.id);
                        setSelected(w.id);
                        e.dataTransfer.effectAllowed = "move";
                        // Firefox exige une charge utile pour démarrer le glissé.
                        e.dataTransfer.setData("text/plain", w.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        dragging === w.id
                          ? "opacity-40"
                          : isSel
                            ? "border-violet-bright bg-violet/20 ring-2 ring-violet/40"
                            : "border-line bg-panel-2 hover:border-violet/40"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="cursor-grab text-ink-3 active:cursor-grabbing"
                        title="Glisser vers un jour"
                      >
                        ⠿
                      </span>
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: w.category.color }}
                      />

                      <button
                        type="button"
                        onClick={() => setSelected(isSel ? null : w.id)}
                        aria-pressed={isSel}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-[13px]">
                          {w.title}
                        </span>
                        <span className="text-[10px] text-ink-3">
                          {DIFFICULTIES[w.difficulty].label}
                          {onVacation
                            ? " · aucun malus 🌴"
                            : ` · −${MALUS.hebdomadaire} XP dimanche`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditing(w.id)}
                        aria-label={`Modifier ${w.title}`}
                        className="shrink-0 text-[11px] text-ink-3 transition-colors hover:text-violet-bright"
                      >
                        ✎
                      </button>
                      <span className="shrink-0 text-[10px] font-semibold text-violet-bright">
                        {isSel ? "↓" : ""}
                      </span>
                    </div>
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
              allowRecurring
            />
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
            Glisse un engagement sur un jour, ou clique-le puis choisis le jour.
            Il se modifie mais ne se supprime pas — s&apos;en débarrasser d&apos;un
            clic n&apos;en serait plus un.
          </p>
        </Card>

        <Card
          className={
            onVacation
              ? "border-vac-4/45"
              : atRisk > 0
                ? "border-fire/35"
                : "border-cat-sante/30"
          }
        >
          <CardTitle right={onVacation ? "🌴 rien en jeu" : "dimanche soir"}>
            En jeu cette semaine
          </CardTitle>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tabular-nums ${
                onVacation
                  ? "text-vac-5"
                  : atRisk > 0
                    ? "text-fire"
                    : "text-cat-sante"
              }`}
            >
              {atRisk > 0 ? `−${atRisk} XP` : "0 XP"}
            </span>
            <span className="text-[11px] text-ink-3">
              {pending.length} non terminée{pending.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            {onVacation
              ? "Semaine de vacances : rien n'est débité dimanche soir."
              : "Une hebdomadaire ratée un mardi ne coûte rien : tu la reposes ailleurs. Le malus ne tombe qu'au bout de la semaine."}
          </p>
        </Card>
      </div>

      {/* Les 7 jours */}
      <Card className={onVacation ? "border-vac-4/45" : ""}>
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
          <div className="flex items-center gap-3">
            {/* Régime de la semaine */}
            <div
              role="group"
              aria-label="Type de semaine"
              className={`flex rounded-lg border p-0.5 ${
                onVacation ? "border-vac-4/45" : "border-line"
              }`}
            >
              {(Object.keys(WEEK_KINDS) as WeekKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  title={WEEK_KINDS[k].hint}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    kind === k
                      ? k === "vacances"
                        ? "bg-vac-4/30 text-vac-5"
                        : "bg-violet/25 text-violet-bright"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  <span aria-hidden>{WEEK_KINDS[k].icon}</span>{" "}
                  {WEEK_KINDS[k].label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-ink-3">
              {MAX_ENGAGEMENTS_PER_DAY} max / jour
            </span>
          </div>
        </div>

        {onVacation ? (
          <p className="mb-3 rounded-xl border border-vac-4/40 bg-vac-4/12 px-3 py-2 text-[11px] leading-relaxed text-ink-2">
            🌴 <strong className="text-vac-5">Semaine de vacances</strong> —
            aucun malus, et la série est gelée : elle ne progresse pas, mais
            elle ne casse pas non plus. Les tâches cochées rapportent
            normalement. Les journées déjà closes ne sont pas réécrites.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {days.map((date, i) => {
            const dayRoutines = routinesFor(isoWeekday(date));
            const dayDaily = dailyFor(date);
            const placed = tasks.filter((t) => t.date === date);
            const used = occupancy(date);
            const free = MAX_ENGAGEMENTS_PER_DAY - used;
            const isToday = date === today;
            const isPast = date < today;
            const canDrop = Boolean(selected) && free > 0 && !isPast;

            const dropOk = accepts(date);
            const isOver = over === date && dropOk;

            return (
              <div
                key={date}
                onDragOver={(e) => {
                  if (!dragging || !dropOk) return;
                  // Sans preventDefault, le navigateur refuse le dépôt.
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOver(date);
                }}
                onDragLeave={() => setOver((d) => (d === date ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  if (id && dropOk) move(id, date);
                }}
                className={`flex min-h-[210px] flex-col rounded-xl border p-2.5 transition-colors ${
                  isOver
                    ? overCell
                    : isToday
                      ? todayCell
                      : isPast
                        ? "border-line-soft bg-panel/40"
                        : "border-line bg-panel-2/50"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span
                    className={`text-[12px] font-semibold ${
                      isToday
                        ? onVacation
                          ? "text-vac-5"
                          : "text-violet-bright"
                        : "text-ink-2"
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
                  {/* Les quotidiennes réellement créées portent l'état
                      « faite » ; on ne retombe sur la projection des
                      routines que pour les jours pas encore matérialisés. */}
                  {dayDaily.length > 0
                    ? dayDaily.map((t) => (
                        <li
                          key={t.id}
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] ${
                            t.done
                              ? doneClasses
                              : "border-line-soft bg-panel/60 text-ink-3"
                          }`}
                          title={
                            t.done
                              ? `${t.title} — faite`
                              : "Routine récurrente — non déplaçable"
                          }
                        >
                          <span aria-hidden>{TASK_KINDS.quotidienne.icon}</span>
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              t.done ? "line-through" : ""
                            }`}
                          >
                            {t.title}
                          </span>
                          {t.done ? (
                            <span aria-hidden className={checkClass}>
                              ✓
                            </span>
                          ) : null}
                        </li>
                      ))
                    : dayRoutines.map((r) => (
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
                          w.done ? doneClasses : placedClasses
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
                          <span aria-hidden className={checkClass}>
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
                      className={`anim-pop-in w-full rounded-lg border border-dashed py-2 text-[11px] font-semibold transition-colors ${dropZone}`}
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
