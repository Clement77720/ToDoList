import { CalendarView } from "@/components/CalendarView";
import { PageHeader } from "@/components/ui";
import {
  getCategories,
  getMonth,
  getPlannedCounts,
  getPlayer,
  getProjectedDailies,
  getTasksForDate,
  getToday,
} from "@/lib/queries";
import { addDays } from "@/lib/dates";
import { vacationWeekStarts } from "@/lib/weeks";

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

  const [records, planned, reelles, projetees, categories, player] =
    await Promise.all([
      getMonth(year, month),
      getPlannedCounts(addDays(first, -7), addDays(last, 7)),
      getTasksForDate(selected),
      getProjectedDailies(selected),
      getCategories(),
      getPlayer(),
    ]);

  // Un jour à venir n'a pas encore ses quotidiennes en base : on complète
  // par la projection des routines, sinon l'encart de droite paraît vide.
  const selectedTasks = [...projetees, ...reelles];

  // La grille déborde du mois des deux côtés : on récupère tous les lundis
  // mis en vacances, puis le composant compare chaque jour à son propre
  // lundi. Passer un ensemble complet évite un aller-retour par semaine.
  const vacationWeeks = [...(await vacationWeekStarts(player.id))];

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
        vacationWeeks={vacationWeeks}
      />
    </>
  );
}
