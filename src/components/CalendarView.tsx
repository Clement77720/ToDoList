"use client";

import Link from "next/link";
import { formatLong, formatMonthYear } from "@/lib/dates";
import type { CategoryDTO, DayDTO, TaskDTO } from "@/lib/types";
import { TaskList } from "./TaskList";
import { TodayTasks } from "./TodayTasks";
import { Card, CardTitle } from "./ui";

const RAMP = ["#4A3A94", "#6248C4", "#7F63E2", "#A288F2", "#C6B0FF"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Jours du mois affiché, calés sur une grille commençant le lundi. */
function buildGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    };
  });
}

function rampFor(ratio: number) {
  const i =
    ratio >= 1 ? 4 : ratio > 0.75 ? 3 : ratio > 0.5 ? 2 : ratio > 0.25 ? 1 : 0;
  return RAMP[i];
}

const monthParam = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

function DayCell({
  date,
  day,
  inMonth,
  record,
  planned,
  today,
  selected,
  href,
}: {
  date: string;
  day: number;
  inMonth: boolean;
  record?: DayDTO;
  planned: number;
  today: string;
  selected: boolean;
  href: string;
}) {
  const isToday = date === today;
  const isFuture = date > today;
  const tint = record && record.done > 0 ? rampFor(record.ratio) : null;

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={isToday ? "date" : undefined}
      aria-label={`${day} — ${
        record
          ? `${record.done} sur ${record.total} tâches`
          : isFuture
            ? `${planned} tâches prévues`
            : "aucune donnée"
      }`}
      className={`relative flex h-[92px] flex-col rounded-xl border p-2 text-left transition-all ${
        inMonth ? "" : "opacity-35"
      } ${
        selected
          ? "border-violet-bright ring-2 ring-violet/45"
          : "border-line hover:border-violet/40"
      }`}
      style={{
        background: tint
          ? `color-mix(in oklab, ${tint} 26%, var(--color-panel))`
          : "var(--color-panel)",
      }}
    >
      <span className="flex items-center justify-between">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            isToday
              ? "grid size-6 place-items-center rounded-full bg-violet text-white"
              : record?.perfect
                ? "text-gold"
                : "text-ink-2"
          }`}
        >
          {day}
        </span>
        <span className="flex items-center gap-0.5 text-[10px]">
          {record?.perfect ? <span aria-hidden>👑</span> : null}
          {record?.success && !record.perfect ? (
            <span aria-hidden>🔥</span>
          ) : null}
          {record && record.malus > 0 ? (
            <span
              className="font-bold text-fire tabular-nums"
              title={`${record.malus} XP perdus`}
            >
              −{record.malus}
            </span>
          ) : null}
        </span>
      </span>

      {record ? (
        <>
          <span className="mt-auto text-[10px] text-ink-3 tabular-nums">
            {record.done}/{record.total} ·{" "}
            <span className={record.xp < 0 ? "text-fire" : undefined}>
              {record.xp < 0 ? `−${Math.abs(record.xp)}` : record.xp} XP
            </span>
          </span>
          <span className="mt-1 flex gap-[3px]">
            {Array.from({ length: record.total }).map((_, i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{
                  background:
                    i < record.done
                      ? rampFor(record.ratio)
                      : "var(--color-panel-3)",
                }}
              />
            ))}
          </span>
        </>
      ) : isFuture ? (
        <span className="mt-auto text-[10px] text-ink-3">
          {planned === 0
            ? "libre"
            : `${planned} prévue${planned > 1 ? "s" : ""}`}
        </span>
      ) : null}
    </Link>
  );
}

export function CalendarView({
  year,
  month,
  today,
  selected,
  records,
  planned,
  selectedTasks,
  streak,
  categories,
}: {
  year: number;
  month: number;
  today: string;
  selected: string;
  records: Record<string, DayDTO>;
  planned: Record<string, number>;
  selectedTasks: TaskDTO[];
  streak: number;
  categories: CategoryDTO[];
}) {
  const grid = buildGrid(year, month);
  const prev = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month + 1, 1));

  const monthRecords = grid
    .filter((g) => g.inMonth)
    .map((g) => records[g.date])
    .filter(Boolean);
  const monthXp = monthRecords.reduce((s, d) => s + d.xp, 0);
  const monthMalus = monthRecords.reduce((s, d) => s + d.malus, 0);
  const monthSuccess = monthRecords.filter((d) => d.success).length;

  const rec = records[selected];
  const isToday = selected === today;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/calendrier?m=${monthParam(prev.getUTCFullYear(), prev.getUTCMonth())}&d=${selected}`}
              scroll={false}
              aria-label="Mois précédent"
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-panel-2"
            >
              ‹
            </Link>
            <h2 className="min-w-[170px] text-center text-lg font-bold">
              {formatMonthYear(year, month)}
            </h2>
            <Link
              href={`/calendrier?m=${monthParam(next.getUTCFullYear(), next.getUTCMonth())}&d=${selected}`}
              scroll={false}
              aria-label="Mois suivant"
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-panel-2"
            >
              ›
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span aria-hidden>🔥</span> journée réussie
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden>👑</span> parfaite
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-bold text-fire">−15</span> malus
            </span>
            <span className="flex items-center gap-1">
              moins
              {RAMP.map((c) => (
                <span
                  key={c}
                  className="size-2.5 rounded-[3px]"
                  style={{ background: c }}
                />
              ))}
              plus
            </span>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d) => (
            <span
              key={d}
              className="text-center text-[11px] font-medium text-ink-3"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {grid.map((g) => (
            <DayCell
              key={g.date}
              {...g}
              today={today}
              record={records[g.date]}
              planned={planned[g.date] ?? 0}
              selected={g.date === selected}
              href={`/calendrier?m=${monthParam(year, month)}&d=${g.date}`}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-6 border-t border-line-soft pt-4 text-[12px]">
          <span className="text-ink-3">
            Journées réussies ·{" "}
            <strong className="text-ink tabular-nums">{monthSuccess}</strong>
          </span>
          <span className="text-ink-3">
            XP nette du mois ·{" "}
            <strong className="text-violet-bright tabular-nums">
              {monthXp.toLocaleString("fr-FR")}
            </strong>
          </span>
          <span className="text-ink-3">
            Malus encaissés ·{" "}
            <strong className="text-fire tabular-nums">
              −{monthMalus.toLocaleString("fr-FR")}
            </strong>
          </span>
        </div>
      </Card>

      <Card>
        <CardTitle
          right={
            rec
              ? `${rec.done}/${rec.total}${isToday ? "" : ` · ${rec.xp} XP`}`
              : selected > today
                ? "planifié"
                : undefined
          }
        >
          {formatLong(selected)}
        </CardTitle>

        {isToday ? (
          <TodayTasks
            date={selected}
            tasks={selectedTasks}
            streak={streak}
            categories={categories}
          />
        ) : (
          <TaskList tasks={selectedTasks} streak={streak} />
        )}
      </Card>
    </div>
  );
}
