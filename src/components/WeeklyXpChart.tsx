"use client";

import { useState } from "react";

/**
 * XP par semaine — une seule série de magnitude : pas de légende,
 * pas d'étiquette sur chaque barre (seulement le max et la semaine
 * en cours), grille récessive, extrémités arrondies 4px ancrées
 * à la ligne de base.
 */
export function WeeklyXpChart({
  weeks: WEEKLY_XP,
  height = 190,
}: {
  weeks: { label: string; xp: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (WEEKLY_XP.length === 0) return null;
  const max = Math.max(1, ...WEEKLY_XP.map((w) => w.xp));
  const last = WEEKLY_XP.length - 1;
  const peak = WEEKLY_XP.findIndex((w) => w.xp === max);

  const ticks = [0, 0.5, 1];

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Grille */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t border-line-soft"
            style={{ bottom: t * (height - 22) + 22 }}
          >
            <span className="absolute -top-2 right-0 bg-panel pl-1 text-[9px] text-ink-3 tabular-nums">
              {Math.round(max * t)}
            </span>
          </div>
        ))}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-[2px]">
          {WEEKLY_XP.map((w, i) => {
            const h = Math.max(3, (w.xp / max) * (height - 30));
            const highlight = i === last || i === peak;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {highlight || hover === i ? (
                  <span className="text-[9px] font-semibold text-ink-2 tabular-nums">
                    {w.xp}
                  </span>
                ) : null}
                <div
                  className="w-full rounded-t-[4px] transition-colors"
                  style={{
                    height: h,
                    background:
                      hover === i
                        ? "var(--color-violet-bright)"
                        : i === last
                          ? "var(--color-violet)"
                          : "color-mix(in oklab, var(--color-violet) 62%, var(--color-panel-3))",
                  }}
                  title={`Semaine du ${w.label} — ${w.xp} XP`}
                />
                <span className="text-[8px] whitespace-nowrap text-ink-3">
                  {i % 2 === 0 ? w.label : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        XP nette : les malus encaissés sont déjà déduits de chaque barre.
      </p>
    </div>
  );
}
