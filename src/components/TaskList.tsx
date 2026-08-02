"use client";

import {
  DIFFICULTIES,
  isEngagement,
  MALUS,
  MAX_ENGAGEMENTS_PER_DAY,
  TASK_KINDS,
  taskReward,
  type TaskKind,
} from "@/lib/gamification";
import type { TaskDTO } from "@/lib/types";

function TaskRow({
  task,
  streak,
  onToggle,
}: {
  task: TaskDTO;
  streak: number;
  onToggle?: (id: string) => void;
}) {
  const diff = DIFFICULTIES[task.difficulty];
  const reward = taskReward(task.difficulty, { onTime: true, streakDays: streak });
  const malus = MALUS[task.kind];
  const readOnly = !onToggle;

  return (
    <li>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => onToggle?.(task.id)}
        aria-pressed={task.done}
        className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
          task.done
            ? "border-line-soft bg-panel-2/40"
            : "border-line bg-panel-2/80 hover:border-violet/40 hover:bg-panel-3"
        } ${readOnly ? "cursor-default" : ""}`}
      >
        <span
          aria-hidden
          className={`grid size-5 shrink-0 place-items-center rounded-md border-2 text-[11px] transition-all ${
            task.done
              ? "border-transparent text-bg"
              : "border-ink-3 group-hover:border-violet"
          }`}
          style={task.done ? { background: task.category.color } : undefined}
        >
          {task.done ? "✓" : ""}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm ${
              task.done ? "text-ink-3 line-through" : "text-ink"
            }`}
          >
            <span className="mr-1.5 text-[11px]" aria-hidden>
              {TASK_KINDS[task.kind].icon}
            </span>
            {task.title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: task.category.color }}
              />
              {task.category.label}
            </span>
            {task.time ? <span>· {task.time}</span> : null}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-3"
            title={`Difficulté : ${diff.label}`}
          >
            {diff.short}
          </span>
          <span className="w-16 text-right leading-tight">
            <span
              className={`block text-[11px] font-semibold tabular-nums ${
                task.done ? "text-ink-3" : "text-violet-bright"
              }`}
            >
              {task.done ? "✓ acquis" : `+${reward.xp} XP`}
            </span>
            {!task.done && malus > 0 ? (
              <span className="block text-[10px] font-semibold text-fire tabular-nums">
                −{malus} XP
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function Group({
  kind,
  tasks,
  streak,
  onToggle,
  note,
}: {
  kind: TaskKind;
  tasks: TaskDTO[];
  streak: number;
  onToggle?: (id: string) => void;
  note?: string;
}) {
  if (tasks.length === 0) return null;
  const meta = TASK_KINDS[kind];
  return (
    <div>
      <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-xs font-semibold tracking-wide text-ink-2 uppercase">
        <span aria-hidden>{meta.icon}</span>
        {meta.plural}
        <span className="font-normal text-ink-3 normal-case">
          — {note ?? meta.hint}
        </span>
      </h3>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} streak={streak} onToggle={onToggle} />
        ))}
      </ul>
    </div>
  );
}

export function TaskList({
  tasks,
  streak,
  onToggle,
  footer,
}: {
  tasks: TaskDTO[];
  streak: number;
  /** Absent → liste en lecture seule (jour passé, aperçu). */
  onToggle?: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const quotidiennes = tasks.filter((t) => t.kind === "quotidienne");
  const hebdo = tasks.filter((t) => t.kind === "hebdomadaire");
  const bonus = tasks.filter((t) => t.kind === "bonus");

  const engagements = tasks.filter((t) => isEngagement(t.kind));
  const engDone = engagements.filter((t) => t.done).length;
  const allEngagements = engDone === engagements.length && engagements.length > 0;
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
          allDone
            ? "border-gold/35 bg-gold/10"
            : allEngagements
              ? "border-cat-sante/35 bg-cat-sante/10"
              : "border-line bg-panel-2"
        }`}
      >
        <span className="text-xl" aria-hidden>
          {allDone ? "👑" : allEngagements ? "✅" : "🎯"}
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {allDone
              ? "Journée parfaite — engagements + bonus !"
              : allEngagements
                ? "Journée réussie — la série est sauvée, zéro malus"
                : `${engDone} / ${engagements.length} engagements`}
          </div>
          <div className="text-[11px] text-ink-3">
            {allDone
              ? "Compte pour le badge « Sans Faute » et le Mois Sacré."
              : allEngagements
                ? "Termine les bonus pour viser la journée parfaite."
                : "Quotidiennes et hebdomadaires décident de la série — et du malus."}
          </div>
        </div>
        <div className="flex gap-1" aria-hidden>
          {engagements.map((t) => (
            <span
              key={t.id}
              className="size-2.5 rounded-full transition-colors"
              style={{
                background: t.done
                  ? "var(--color-cat-sante)"
                  : "var(--color-panel-3)",
              }}
            />
          ))}
          {Array.from({
            length: Math.max(0, MAX_ENGAGEMENTS_PER_DAY - engagements.length),
          }).map((_, i) => (
            <span
              key={`free-${i}`}
              className="size-2.5 rounded-full border border-dashed border-line-soft"
            />
          ))}
        </div>
      </div>

      <Group
        kind="quotidienne"
        tasks={quotidiennes}
        streak={streak}
        onToggle={onToggle}
        note={`obligatoires du lundi au vendredi · −${MALUS.quotidienne} XP chacune ce soir`}
      />
      <Group
        kind="hebdomadaire"
        tasks={hebdo}
        streak={streak}
        onToggle={onToggle}
        note={`placées sur ce jour · −${MALUS.hebdomadaire} XP si non faites dimanche soir`}
      />
      <Group
        kind="bonus"
        tasks={bonus}
        streak={streak}
        onToggle={onToggle}
        note="aucun malus, que du gain"
      />

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">
          Rien de prévu ce jour-là.
        </p>
      ) : null}

      {footer}
    </div>
  );
}
