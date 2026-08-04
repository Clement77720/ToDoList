import { CalendarView } from "@/components/CalendarView";
import { PageHeader } from "@/components/ui";
import {
  getCategories,
  getMonth,
  getPlannedCounts,
  getPlayer,
  getTasksForDate,
  getToday,
} from "@/lib/queries";
import { addDays } from "@/lib/dates";

export const metadata = { title: "Calendrier — QuestList" };

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const { m, d } = await searchParams;
  const today = await getToday();

  const selected = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : Number(today.slice(0, 4));
  const month = match ? Number(match[2]) - 1 : Number(today.slice(5, 7)) - 1;

  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);

  const [records, planned, selectedTasks, categories, player] =
    await Promise.all([
      getMonth(year, month),
      getPlannedCounts(addDays(first, -7), addDays(last, 7)),
      getTasksForDate(selected),
      getCategories(),
      getPlayer(),
    ]);

  return (
    <>
      <PageHeader
        title="Calendrier"
        subtitle="Chaque case se remplit à mesure que tu valides. Clique sur un jour pour voir son détail."
      />
      <CalendarView
        year={year}
        month={month}
        today={today}
        selected={selected}
        records={records}
        planned={planned}
        selectedTasks={selectedTasks}
        streak={player.streak}
        categories={categories}
      />
    </>
  );
}
