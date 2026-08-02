"use client";

import type { CategoryDTO } from "@/lib/types";

/**
 * Radar d'équilibre — une seule série (le joueur), donc pas de légende :
 * le titre nomme la série et chaque axe est étiqueté en direct.
 * Les pastilles de sommet reprennent la couleur de catégorie déjà
 * utilisée partout ailleurs dans l'app (encodage d'identité).
 */
export function RadarCategories({
  categories: CATEGORIES,
  size = 320,
}: {
  categories: CategoryDTO[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.32;
  const maxLevel = Math.max(15, ...CATEGORIES.map((c) => c.level));
  const n = CATEGORIES.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, ratio: number) => ({
    x: cx + Math.cos(angle(i)) * R * ratio,
    y: cy + Math.sin(angle(i)) * R * ratio,
  });

  const rings = [0.25, 0.5, 0.75, 1];
  const ringPath = (r: number) =>
    CATEGORIES.map((_, i) => {
      const p = point(i, r);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + " Z";

  const dataPath =
    CATEGORIES.map((c, i) => {
      const p = point(i, Math.max(0.08, c.level / maxLevel));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + " Z";

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Niveau par catégorie : ${CATEGORIES.map(
          (c) => `${c.label} niveau ${c.level}`,
        ).join(", ")}`}
      >
        {/* Grille récessive */}
        {rings.map((r) => (
          <path
            key={r}
            d={ringPath(r)}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={1}
          />
        ))}
        {CATEGORIES.map((_, i) => {
          const p = point(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          );
        })}

        {/* Surface de données */}
        <path
          d={dataPath}
          fill="color-mix(in oklab, var(--color-violet) 26%, transparent)"
          stroke="var(--color-violet-bright)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Sommets — 9px, anneau de surface 2px pour la lisibilité */}
        {CATEGORIES.map((c, i) => {
          const p = point(i, Math.max(0.08, c.level / maxLevel));
          return (
            <circle
              key={c.slug}
              cx={p.x}
              cy={p.y}
              r={4.5}
              fill={c.color}
              stroke="var(--color-panel)"
              strokeWidth={2}
            />
          );
        })}

        {/* Étiquettes directes */}
        {CATEGORIES.map((c, i) => {
          const p = point(i, 1.3);
          const a = angle(i);
          const anchor =
            Math.abs(Math.cos(a)) < 0.3
              ? "middle"
              : Math.cos(a) > 0
                ? "start"
                : "end";
          return (
            <g key={c.slug}>
              <text
                x={p.x}
                y={p.y - 4}
                textAnchor={anchor}
                className="fill-ink-2 text-[10px]"
              >
                {c.icon} {c.label}
              </text>
              <text
                x={p.x}
                y={p.y + 9}
                textAnchor={anchor}
                className="fill-ink text-[11px] font-bold"
              >
                Nv.{c.level}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 max-w-[38ch] text-center text-[11px] text-ink-3">
        Une branche atrophiée saute aux yeux : c'est le moteur du badge
        « Équilibriste » (toutes les catégories au niveau 5+).
      </p>
    </div>
  );
}
