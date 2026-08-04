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

  // Quotidiennes déjà créées en base pour cette semaine : elles priment
  // sur les routines actuelles, car le passé ne se réécrit pas.
  const rows = await prisma.task.groupBy({
    by: ["date"],
    where: {
      userId: user.id,
      kind: "quotidienne",
      date: { gte: days[0], lte: days[6] },
    },
    _count: { _all: true },
  });
  const materialized: Record<string, number> = {};
  for (const r of rows) if (r.date) materialized[r.date] = r._count._all;

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
        materialized={materialized}
        categories={categories}
        weekKind={weekKind}
      />
      <div className="mt-4">
        <RoutinesEditor routines={routines} />
      </div>
    </>
  );
}
