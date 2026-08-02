"use client";

import { useOptimistic, useTransition } from "react";
import { addBonusTaskAction, toggleTaskAction } from "@/app/actions";
import type { CategoryDTO, TaskDTO } from "@/lib/types";
import type { DifficultyKey } from "@/lib/gamification";
import { AddTaskForm } from "./AddTaskForm";
import { TaskList } from "./TaskList";
import { useToaster } from "./Toaster";

/**
 * Liste du jour. La coche est optimiste — React reprend la valeur du
 * serveur dès que l'action revient, donc pas de état dupliqué à
 * resynchroniser à la main.
 */
export function TodayTasks({
  date,
  tasks,
  streak,
  categories,
}: {
  date: string;
  tasks: TaskDTO[];
  streak: number;
  categories: CategoryDTO[];
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

  const add = async (
    title: string,
    slug: string,
    difficulty: DifficultyKey,
  ) => {
    report(await addBonusTaskAction(date, title, slug, difficulty));
  };

  return (
    <TaskList
      tasks={optimistic}
      streak={streak}
      onToggle={toggle}
      footer={
        <AddTaskForm
          categories={categories}
          label="Ajouter une tâche bonus"
          placeholder="Ex. Ranger le bureau"
          onSubmit={add}
        />
      }
    />
  );
}
