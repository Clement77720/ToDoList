import { PageHeader } from "@/components/ui";
import { WeekPlanner } from "@/components/WeekPlanner";
import { RoutinesEditor } from "@/components/RoutinesEditor";
import { prisma } from "@/lib/db";
import {
  getCategories,
  getCurrentUser,
  getRoutines,
  getWeeklyTasks,
  getToday,
} from "@/lib/queries";
import { startOfWeek, weekDates } from "@/lib/dates";
import { getWeekKind } from "@/lib/weeks";
import type { DifficultyKey, TaskKind } from "@/lib/gamification";
import type { TaskDTO } from "@/lib/types";

export const metadata = { title: "Ma semaine — QuestList" };

export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const today = await getToday();
  const weekStart = startOfWeek(
    w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today,
  );
  const days = weekDates(weekStart);

  const user = await getCurrentUser();
  const [routines, weekly, categories, weekKind] = await Promise.all([
    getRoutines(),
    getWeeklyTasks(weekStart),
    getCategories(),
    getWeekKind(user.id, weekStart),
  ]);

  // Quotidiennes déjà créées en base pour cette semaine. Elles priment sur
  // la projection des routines — le passé ne se réécrit pas — et ce sont
  // elles qui portent l'état « faite », que la projection ignore.
  const rows = await prisma.task.findMany({
    where: {
      userId: user.id,
      kind: "quotidienne",
      date: { gte: days[0], lte: days[6] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      difficulty: true,
      kind: true,
      date: true,
      weekStart: true,
      done: true,
      time: true,
      category: { select: { slug: true, label: true, icon: true, color: true } },
    },
  });

  const daily: TaskDTO[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    difficulty: t.difficulty as DifficultyKey,
    kind: t.kind as TaskKind,
    date: t.date,
    weekStart: t.weekStart,
    done: t.done,
    time: t.time,
    category: t.category,
  }));

  return (
    <>
      <PageHeader
        title="Ma semaine"
        subtitle="Les quotidiennes reviennent toutes seules. Les hebdomadaires, c'est toi qui décides quand."
      />
      <WeekPlanner
        weekStart={weekStart}
        today={today}
        routines={routines}
        weekly={weekly}
        daily={daily}
        categories={categories}
        weekKind={weekKind}
      />
      <div className="mt-4">
        <RoutinesEditor routines={routines} />
      </div>
    </>
  );
}
