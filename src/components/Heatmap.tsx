"use client";

import { useState } from "react";
import { isoWeekday } from "@/lib/dates";
import type { DayDTO } from "@/lib/types";

/* Rampe séquentielle : UNE seule teinte, clarté monotone, l'extrémité
   basse décolle de la surface (2,03:1). Les jours sans tâche faite ne
   sont pas un pas de la rampe mais un état « pas de donnée ». */
const RAMP = ["#4A3A94", "#6248C4", "#7F63E2", "#A288F2", "#C6B0FF"];
const EMPTY = "#1C1C26";

function stepFor(d: DayDTO): { color: string; empty: boolean } {
  if (d.total === 0 || d.done === 0) return { color: EMPTY, empty: true };
  const r = d.ratio;
  const i = r >= 1 ? 4 : r > 0.75 ? 3 : r > 0.5 ? 2 : r > 0.25 ? 1 : 0;
  return { color: RAMP[i], empty: false };
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function fmt(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function Heatmap({
  days,
  weeks = 26,
  cell = 13,
  gap = 3,
}: {
  days: DayDTO[];
  weeks?: number;
  cell?: number;
  gap?: number;
}) {
  const [hover, setHover] = useState<{
    d: DayDTO;
    x: number;
    y: number;
  } | null>(null);

  const data = days.slice(-weeks * 7);
  if (data.length === 0) return null;

  // La grille commence toujours un lundi : on décale du nombre de jours
  // manquants avant la première date, quelle qu'elle soit.
  const pad = isoWeekday(data[0].date) - 1;
  const cells: (DayDTO | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...data,
  ];
  const columns: (DayDTO | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  // Étiquette de mois posée sur la première colonne de chaque mois.
  const monthOf = (col: (DayDTO | null)[]) => {
    const first = col.find(Boolean);
    return first ? new Date(`${first.date}T00:00:00Z`) : null;
  };
  const monthLabels = columns.map((col, i) => {
    const d = monthOf(col);
    if (!d) return null;
    const prev = i > 0 ? monthOf(columns[i - 1]) : null;
    if (prev && prev.getUTCMonth() === d.getUTCMonth()) return null;
    return d
      .toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
      .replace(".", "");
  });

  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Colonne des jours */}
        <div
          className="flex shrink-0 flex-col pt-[18px] text-[9px] text-ink-3"
          style={{ gap }}
        >
          {DAY_LABELS.map((d, i) => (
            <span
              key={i}
              className="flex items-center justify-end pr-0.5"
              style={{ height: cell, width: 12 }}
            >
              {i % 2 === 0 ? d : ""}
            </span>
          ))}
        </div>

        <div>
          {/* Mois */}
          <div className="flex" style={{ gap, height: 18 }}>
            {columns.map((_, i) => (
              <span
                key={i}
                className="text-[9px] text-ink-3"
                style={{ width: cell }}
              >
                {monthLabels[i]}
              </span>
            ))}
          </div>

          {/* Grille */}
          <div className="flex" style={{ gap }}>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap }}>
                {col.map((d, ri) =>
                  d === null ? (
                    <span
                      key={`pad-${ci}-${ri}`}
                      aria-hidden
                      style={{ width: cell, height: cell }}
                    />
                  ) : (
                    (() => {
                      const { color, empty } = stepFor(d);
                      return (
                        <button
                          key={d.date}
                          type="button"
                          aria-label={`${fmt(d.date)} — ${d.done} sur ${d.total} tâches`}
                          onMouseEnter={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setHover({ d, x: r.left + r.width / 2, y: r.top });
                          }}
                          onMouseLeave={() => setHover(null)}
                          className="rounded-[3px] transition-transform hover:scale-125"
                          style={{
                            width: cell,
                            height: cell,
                            background: color,
                            outline: empty
                              ? "1px solid var(--color-line)"
                              : undefined,
                            outlineOffset: -1,
                          }}
                        />
                      );
                    })()
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-3">
        <span>Moins</span>
        <span
          className="rounded-[3px]"
          style={{
            width: 11,
            height: 11,
            background: EMPTY,
            outline: "1px solid var(--color-line)",
            outlineOffset: -1,
          }}
        />
        {RAMP.map((c) => (
          <span
            key={c}
            className="rounded-[3px]"
            style={{ width: 11, height: 11, background: c }}
          />
        ))}
        <span>Plus</span>
        <span className="ml-2">· part des tâches du jour terminées</span>
      </div>

      {/* Infobulle */}
      {hover ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-xl"
          style={{ left: hover.x, top: hover.y - 8 }}
          role="tooltip"
        >
          <div className="font-semibold text-ink">
            {hover.d.done} / {hover.d.total} tâches
          </div>
          <div className="text-ink-3">{fmt(hover.d.date)}</div>
          <div>
            <span className="text-violet-bright">+{hover.d.gained} XP</span>
            {hover.d.malus > 0 ? (
              <span className="text-fire"> · −{hover.d.malus} XP</span>
            ) : null}
            {hover.d.perfect ? (
              <span className="text-gold"> · parfaite 👑</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
