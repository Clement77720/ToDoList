"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { titleForLevel } from "@/lib/gamification";
import type { PlayerDTO } from "@/lib/types";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "🏠" },
  { href: "/semaine", label: "Ma semaine", icon: "🗂️" },
  { href: "/calendrier", label: "Calendrier", icon: "🗓️" },
  { href: "/badges", label: "Badges", icon: "🏅" },
  { href: "/boutique", label: "Boutique", icon: "🪙" },
  { href: "/stats", label: "Statistiques", icon: "📈" },
];

export function Sidebar({ player }: { player: PlayerDTO }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel/60 p-4 backdrop-blur-sm md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span
          className="grid size-9 place-items-center rounded-xl text-lg shadow-lg"
          style={{
            background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
            boxShadow: "0 8px 24px rgb(139 92 246 / 0.35)",
          }}
          aria-hidden
        >
          ⚔️
        </span>
        <span>
          <span className="block text-[15px] leading-tight font-bold">
            QuestList
          </span>
          <span className="block text-[11px] leading-tight text-ink-3">
            to-do gamifiée
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-violet/15 font-medium text-ink ring-1 ring-violet/30"
                  : "text-ink-2 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <span aria-hidden className="text-base">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-line bg-panel-2 p-3">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-full bg-panel-3 text-lg ring-2 ring-violet/40"
            aria-hidden
          >
            {player.avatar}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{player.name}</div>
            <div className="truncate text-[11px] text-ink-3">
              Nv.{player.level} · {titleForLevel(player.level)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
