"use client";

import { useState, useTransition } from "react";
import { buyRewardAction } from "@/app/actions";
import type { RewardDTO } from "@/lib/types";
import { useToaster } from "./Toaster";
import { ProgressBar } from "./ui";

function ItemCard({
  item,
  coins,
  onBuy,
  busy,
}: {
  item: RewardDTO;
  coins: number;
  onBuy: (id: string) => void;
  busy: boolean;
}) {
  const affordable = coins >= item.price;
  const missing = item.price - coins;

  return (
    <li className="flex flex-col rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-panel-2 text-xl"
          aria-hidden
        >
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] leading-snug font-semibold">
            {item.label}
          </h3>
          {item.note ? (
            <p className="mt-0.5 text-[11px] text-ink-3">{item.note}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between text-[12px]">
        <span className="font-bold text-gold tabular-nums">
          {item.price.toLocaleString("fr-FR")} 🪙
        </span>
        {!affordable && !item.owned ? (
          <span className="text-[11px] text-ink-3 tabular-nums">
            il manque {missing.toLocaleString("fr-FR")}
          </span>
        ) : null}
      </div>

      {!affordable && !item.owned ? (
        <div className="mt-2">
          <ProgressBar
            value={coins}
            max={item.price}
            height={4}
            color="var(--color-gold)"
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={!affordable || item.owned || busy}
        onClick={() => onBuy(item.id)}
        className={`mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
          item.owned
            ? "cursor-default border border-cat-sante/40 bg-cat-sante/15 text-cat-sante"
            : affordable
              ? "bg-gold text-bg hover:bg-gold/85"
              : "cursor-not-allowed border border-line text-ink-3"
        }`}
      >
        {item.owned ? "✓ Débloqué" : affordable ? "Échanger" : "Trop cher"}
      </button>
    </li>
  );
}

export function Shop({
  rewards,
  coins,
}: {
  rewards: RewardDTO[];
  coins: number;
}) {
  const { report } = useToaster();
  const [tab, setTab] = useState<"reel" | "cosmetique">("reel");
  const [busy, startTransition] = useTransition();

  const items = rewards.filter((i) => i.kind === tab);

  const buy = (id: string) =>
    startTransition(async () => report(await buyRewardAction(id)));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-5 rounded-2xl border border-gold/25 bg-gold/8 p-5">
        <span className="text-3xl" aria-hidden>
          🪙
        </span>
        <div>
          <div className="text-2xl font-bold text-gold tabular-nums">
            {coins.toLocaleString("fr-FR")}
          </div>
          <div className="text-[12px] text-ink-2">pièces disponibles</div>
        </div>
        <p className="max-w-[46ch] text-[12px] leading-relaxed text-ink-3">
          Les pièces s&apos;échangent contre des récompenses{" "}
          <strong className="text-ink-2">réelles</strong>, que tu définis
          toi-même. C&apos;est ce qui relie l&apos;effort abstrait à une
          gratification concrète.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "reel", label: "🎁 Récompenses réelles" },
            { id: "cosmetique", label: "✨ Cosmétiques" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-full border px-4 py-1.5 text-[12px] transition-colors ${
              tab === t.id
                ? "border-violet/50 bg-violet/20 text-ink"
                : "border-line text-ink-2 hover:bg-panel-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {items.map((i) => (
          <ItemCard
            key={i.id}
            item={i}
            coins={coins}
            onBuy={buy}
            busy={busy}
          />
        ))}
      </ul>

      {tab === "reel" ? (
        <p className="mt-4 text-[11px] text-ink-3">
          Une récompense réelle se consomme : elle redevient disponible une fois
          échangée. Les cosmétiques, eux, restent acquis.
        </p>
      ) : null}
    </>
  );
}
