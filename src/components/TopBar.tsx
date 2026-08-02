"use client";

import {
  MAX_STREAK_SHIELDS,
  nextStreakTier,
  streakMultiplier,
  titleForLevel,
} from "@/lib/gamification";
import type { PlayerDTO } from "@/lib/types";
import { useToaster } from "./Toaster";

function LevelRing({ level, pct }: { level: number; pct: number }) {
  const r = 21;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-13 place-items-center">
      <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="var(--color-panel-3)"
          strokeWidth="4"
        />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="url(#lvl)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="lvl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[13px] font-bold tabular-nums">
        {level}
      </span>
    </div>
  );
}

export function TopBar({ player }: { player: PlayerDTO }) {
  const { toasts } = useToaster();
  const pct = player.xp / player.xpMax;
  const mult = streakMultiplier(player.streak);
  const next = nextStreakTier(player.streak);

  // Les badges et erreurs ont leur propre bandeau : ici, que les chiffres.
  const floating = toasts.filter(
    (t) => t.tone === "xp" || t.tone === "malus" || t.tone === "coins",
  );

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 lg:px-8">
        {/* Niveau + XP */}
        <div className="flex min-w-[240px] flex-1 items-center gap-3">
          <LevelRing level={player.level} pct={pct} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">
                {titleForLevel(player.level)}
              </span>
              <span className="text-[11px] tabular-nums text-ink-3">
                {player.xp.toLocaleString("fr-FR")} /{" "}
                {player.xpMax.toLocaleString("fr-FR")} XP
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-panel-3">
              <div
                className="xp-shimmer relative h-full overflow-hidden rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct * 100}%`,
                  background: "linear-gradient(90deg, #8B5CF6, #EC4899)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Série */}
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2">
          <span className="text-lg" aria-hidden>
            🔥
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tabular-nums">
              {player.streak} jours
              <span className="ml-1.5 text-[11px] font-semibold text-fire">
                ×{mult.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <div className="text-[10px] text-ink-3">
              {next
                ? `${next.days - player.streak} j → ×${next.multiplier
                    .toFixed(2)
                    .replace(".", ",")}`
                : "multiplicateur maximal"}
            </div>
          </div>
        </div>

        {/* Jokers */}
        <div
          className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2"
          title="Jokers de protection : absorbent une journée ratée sans casser la série"
        >
          {Array.from({ length: MAX_STREAK_SHIELDS }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={i < player.shields ? "" : "opacity-25 grayscale"}
            >
              🛡️
            </span>
          ))}
          <span className="ml-1 text-[11px] text-ink-3">
            {player.shields}/{MAX_STREAK_SHIELDS}
          </span>
        </div>

        {/* Pièces */}
        <div className="relative flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2">
          <span aria-hidden>🪙</span>
          <span className="text-sm font-bold tabular-nums text-gold">
            {player.coins.toLocaleString("fr-FR")}
          </span>

          <div className="pointer-events-none absolute -top-1 right-2 flex flex-col items-end">
            {floating.map((t) => (
              <span
                key={t.id}
                className="anim-float-up text-xs font-bold whitespace-nowrap"
                style={{
                  color:
                    t.tone === "coins"
                      ? "var(--color-gold)"
                      : t.tone === "malus"
                        ? "var(--color-fire)"
                        : "#C6B0FF",
                }}
              >
                {t.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
