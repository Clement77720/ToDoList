"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTaskAction } from "@/app/actions";
import type { TaskDTO } from "@/lib/types";
import { TaskList } from "./TaskList";
import { useToaster } from "./Toaster";

/**
 * Liste d'une journée passée encore corrigeable.
 *
 * Même coche optimiste que `TodayTasks` — sans le formulaire de tâche
 * bonus : on rattrape ce qui était prévu, on n'invente pas après coup une
 * tâche qu'on se serait donnée. C'est la seule chose qui sépare les deux
 * écrans, et c'est volontaire.
 */
export function RetroTasks({
  tasks,
  streak,
  joursRestants,
}: {
  tasks: TaskDTO[];
  streak: number;
  /** Jours restants pour corriger cette journée, celui-ci compris. */
  joursRestants: number;
}) {
  const { report } = useToaster();
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    tasks,
    (state: TaskDTO[], id: string) =>
      state.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  );

  const toggle = (id: string) => {
    startTransition(async () => {
      applyOptimistic(id);
      report(await toggleTaskAction(id));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-gold/35 bg-gold/10 px-3 py-2.5 text-[11px] leading-relaxed text-ink-2">
        <span className="font-semibold text-gold">⏪ Rattrapage</span> — journée
        déjà close. Cocher une tâche te rend le malus encaissé et recalcule ta
        série. Le bonus de ponctualité, lui, est perdu.
        <span className="mt-1 block text-ink-3">
          {joursRestants <= 1
            ? "Dernier jour pour la corriger."
            : `Encore ${joursRestants} jours pour la corriger.`}
        </span>
      </p>
      <TaskList
        tasks={optimistic}
        streak={streak}
        onToggle={toggle}
        rattrapage
      />
    </div>
  );
}
