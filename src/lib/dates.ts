/**
 * Manipulation de dates au format « yyyy-mm-dd ».
 *
 * Tout est calculé en UTC pour que serveur et client tombent d'accord ;
 * seule la date du jour est lue sur l'horloge locale, puis passée en
 * props depuis les composants serveur — jamais recalculée côté client,
 * sinon l'hydratation diverge dès qu'un fuseau change.
 */

export type ISODate = string;

/** Date du jour selon l'horloge locale de la machine. */
export function todayISO(): ISODate {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = lundi … 7 = dimanche */
export function isoWeekday(date: ISODate): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -(isoWeekday(date) - 1));
}

/** Les 7 dates d'une semaine, à partir de son lundi. */
export const weekDates = (monday: ISODate): ISODate[] =>
  Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export const WEEKDAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const capitalize = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function formatLong(date: ISODate): string {
  return capitalize(
    new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  );
}

export function formatDayMonth(date: ISODate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function formatShort(date: ISODate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

export function formatMonthYear(year: number, month: number): string {
  return capitalize(
    new Date(Date.UTC(year, month, 1)).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  );
}

export const dayOfMonth = (date: ISODate): number =>
  new Date(`${date}T00:00:00Z`).getUTCDate();
