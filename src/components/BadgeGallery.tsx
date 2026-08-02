"use client";

import { useState } from "react";
import { BADGE_FAMILIES, type BadgeFamily } from "@/lib/catalog";
import { RARITY } from "@/lib/gamification";
import type { BadgeDTO } from "@/lib/types";
import { ProgressBar } from "./ui";

function BadgeTile({ badge }: { badge: BadgeDTO }) {
  const r = RARITY[badge.rarity];

  return (
    <li
      className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition-transform hover:-translate-y-0.5 ${
        badge.unlocked
          ? "border-line bg-panel"
          : "border-dashed border-line bg-panel/40"
      }`}
      style={
        badge.unlocked
          ? { boxShadow: `0 0 26px ${r.glow}`, borderColor: `${r.color}44` }
          : undefined
      }
    >
      <span
        className={`grid size-14 place-items-center rounded-full text-2xl ${
          badge.unlocked ? "" : "opacity-30 grayscale"
        }`}
        style={{
          background: badge.unlocked
            ? `radial-gradient(circle at 50% 30%, ${r.color}33, transparent 70%)`
            : "var(--color-panel-2)",
        }}
        aria-hidden
      >
        {badge.unlocked ? badge.icon : "🔒"}
      </span>

      <h3
        className={`mt-2 text-[13px] font-semibold ${
          badge.unlocked ? "" : "text-ink-3"
        }`}
      >
        {badge.name}
      </h3>

      <span
        className="mt-0.5 text-[9px] font-bold tracking-widest uppercase"
        style={{ color: badge.unlocked ? r.color : "var(--color-ink-3)" }}
      >
        {r.label}
      </span>

      <p className="mt-2 text-[11px] leading-snug text-ink-3">
        {badge.description}
      </p>

      {badge.unlocked ? (
        <span className="mt-2 text-[10px] text-ink-3">
          Obtenu le {badge.unlockedOn}
        </span>
      ) : badge.progress ? (
        <div className="mt-3 w-full">
          <ProgressBar
            value={badge.progress.current}
            max={badge.progress.goal}
            height={4}
            color={r.color}
          />
          <span className="mt-1 block text-[10px] text-ink-3 tabular-nums">
            {badge.progress.current} / {badge.progress.goal}
          </span>
        </div>
      ) : (
        <span className="mt-2 text-[10px] text-ink-3 italic">
          Badge secret — à découvrir
        </span>
      )}
    </li>
  );
}

export function BadgeGallery({ badges }: { badges: BadgeDTO[] }) {
  const [family, setFamily] = useState<BadgeFamily | "all">("all");

  const shown =
    family === "all" ? badges : badges.filter((b) => b.family === family);
  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-panel p-5">
        <span className="text-3xl" aria-hidden>
          🏅
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">Collection</span>
            <span className="text-sm tabular-nums text-ink-2">
              {unlocked} / {badges.length}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={unlocked}
              max={badges.length}
              color="var(--color-gold)"
            />
          </div>
        </div>
        <div className="flex gap-4 text-center">
          {(["bronze", "argent", "or", "platine"] as const).map((k) => {
            const n = badges.filter(
              (b) => b.rarity === k && b.unlocked,
            ).length;
            const total = badges.filter((b) => b.rarity === k).length;
            return (
              <div key={k}>
                <div
                  className="text-lg font-bold tabular-nums"
                  style={{ color: RARITY[k].color }}
                >
                  {n}
                  <span className="text-xs text-ink-3">/{total}</span>
                </div>
                <div className="text-[10px] text-ink-3">{RARITY[k].label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ id: "all" as const, label: "Toutes" }, ...BADGE_FAMILIES].map(
          (f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFamily(f.id)}
              aria-pressed={family === f.id}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
                family === f.id
                  ? "border-violet/50 bg-violet/20 text-ink"
                  : "border-line text-ink-2 hover:bg-panel-2"
              }`}
            >
              {f.label}
            </button>
          ),
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {shown.map((b) => (
          <BadgeTile key={b.id} badge={b} />
        ))}
      </ul>
    </>
  );
}
