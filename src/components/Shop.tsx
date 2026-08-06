"use client";

import { useState, useTransition } from "react";
import {
  buyRewardAction,
  consumeRewardAction,
  openChestAction,
  syncShopAction,
} from "@/app/actions";
import { REWARD_FAMILIES, type RewardFamily } from "@/lib/catalog";
import type { RewardDTO } from "@/lib/types";
import { useToaster } from "./Toaster";
import { Card, CardTitle, ProgressBar } from "./ui";

/** Un gain reste « frais » quelques secondes après le tirage. */
const REVELATION_MS = 12_000;

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
  const isChest = Boolean(item.chestTier);
  const varie = item.price !== item.basePrice;

  return (
    <li
      className={`flex flex-col rounded-2xl border p-4 ${
        isChest ? "border-gold/40 bg-gold/6" : "border-line bg-panel"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl ${
            isChest ? "bg-gold/15" : "bg-panel-2"
          }`}
          aria-hidden
        >
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] leading-snug font-semibold">
            {item.label}
            {item.promo ? (
              <span className="ml-1.5 rounded-md bg-fire/20 px-1.5 py-0.5 text-[10px] font-bold text-fire">
                −30 %
              </span>
            ) : null}
          </h3>
          {item.note ? (
            <p className="mt-0.5 text-[11px] text-ink-3">{item.note}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 text-[12px]">
        <span className="flex items-baseline gap-1.5">
          <span className="font-bold text-gold tabular-nums">
            {item.price.toLocaleString("fr-FR")} 🪙
          </span>
          {varie ? (
            <span className="text-[10px] text-ink-3 line-through tabular-nums">
              {item.basePrice.toLocaleString("fr-FR")}
            </span>
          ) : null}
          {item.tendance === "hausse" ? (
            <span className="text-[10px] text-fire" title="Tu l'achètes souvent : la demande fait monter le prix">
              ▲ demandée
            </span>
          ) : item.tendance === "baisse" ? (
            <span className="text-[10px] text-cat-sante" title="Délaissée depuis longtemps : le prix baisse">
              ▼ soldée
            </span>
          ) : null}
        </span>
        {!affordable ? (
          <span className="text-[11px] text-ink-3 tabular-nums">
            il manque {missing.toLocaleString("fr-FR")}
          </span>
        ) : null}
      </div>

      {!affordable ? (
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
        disabled={!affordable || busy}
        onClick={() => onBuy(item.id)}
        className={`mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
          affordable
            ? "bg-gold text-bg hover:bg-gold/85"
            : "cursor-not-allowed border border-line text-ink-3"
        }`}
      >
        {!affordable ? "Trop cher" : isChest ? "Ouvrir" : "Échanger"}
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
  const [famille, setFamille] = useState<RewardFamily | "tout">("tout");
  const [ecarte, setEcarte] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // Le gain fraîchement tiré, lu dans les données : `refresh()` revalide
  // le layout et remonte ce composant, un état local ne survivrait pas au
  // retour de l'action.
  const gain =
    rewards
      .filter((r) => r.owned && r.wonAgoMs !== null && r.wonAgoMs < REVELATION_MS)
      .sort((a, b) => (a.wonAgoMs ?? 0) - (b.wonAgoMs ?? 0))[0] ?? null;
  const revele = gain && gain.id !== ecarte ? gain : null;

  // Les gains remportés sortent du catalogue : ils ne se rachètent pas,
  // ils se consomment.
  const gagnes = rewards.filter((r) => r.owned);
  const catalogue = rewards.filter((r) => !r.owned);
  const visibles =
    famille === "tout" ? catalogue : catalogue.filter((r) => r.family === famille);

  const presentes = REWARD_FAMILIES.filter((f) =>
    catalogue.some((r) => r.family === f.id),
  );
  const offre = catalogue.find((r) => r.promo) ?? null;

  const buy = (id: string) =>
    startTransition(async () => {
      const item = rewards.find((r) => r.id === id);
      if (item?.chestTier) {
        report(await openChestAction(id));
        return;
      }
      report(await buyRewardAction(id));
    });

  const consume = (id: string) =>
    startTransition(async () => report(await consumeRewardAction(id)));

  const sync = () => startTransition(async () => report(await syncShopAction()));

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
        <p className="max-w-[42ch] text-[12px] leading-relaxed text-ink-3">
          Les pièces s&apos;échangent contre des récompenses{" "}
          <strong className="text-ink-2">réelles</strong>. C&apos;est ce qui
          relie l&apos;effort abstrait à une gratification concrète.
        </p>
        <button
          type="button"
          onClick={sync}
          disabled={busy}
          className="ml-auto rounded-lg border border-line px-3 py-1.5 text-[11px] text-ink-3 transition-colors hover:border-gold/45 hover:text-ink-2 disabled:opacity-40"
          title="Ajoute les récompenses du catalogue qui te manquent, sans toucher aux tiennes"
        >
          ＋ Compléter la boutique
        </button>
      </div>

      {/* L'offre du jour */}
      {offre ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-fire/35 bg-fire/8 px-5 py-3">
          <span className="text-2xl" aria-hidden>
            {offre.icon}
          </span>
          <span>
            <span className="block text-[11px] font-semibold tracking-wide text-fire uppercase">
              Offre du jour · −30 %
            </span>
            <span className="text-[13px] font-semibold">{offre.label}</span>{" "}
            <span className="text-[12px] text-ink-2">
              à {offre.price.toLocaleString("fr-FR")} 🪙 au lieu de{" "}
              {offre.basePrice.toLocaleString("fr-FR")}
            </span>
          </span>
          <span className="ml-auto text-[11px] text-ink-3">
            change chaque jour
          </span>
        </div>
      ) : null}

      {/* Révélation du coffre */}
      {revele ? (
        <button
          type="button"
          onClick={() => setEcarte(revele.id)}
          className="anim-pop-in mb-5 flex w-full items-center gap-4 rounded-2xl border border-gold/50 bg-gold/12 p-5 text-left"
        >
          <span className="text-4xl" aria-hidden>
            {revele.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-wide text-gold uppercase">
              🎁 Coffre ouvert
            </span>
            <span className="block text-lg font-bold">{revele.label}</span>
            <span className="block text-[12px] text-ink-2">
              Valeur : {revele.price.toLocaleString("fr-FR")} 🪙 — elle
              t&apos;attend dans « Mes gains ».
            </span>
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-ink-3">fermer ✕</span>
        </button>
      ) : null}

      {/* Gains remportés */}
      {gagnes.length > 0 ? (
        <Card className="mb-5 border-cat-sante/35">
          <CardTitle right={`${gagnes.length} en attente`}>Mes gains</CardTitle>
          <ul className="flex flex-wrap gap-2">
            {gagnes.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => consume(g.id)}
                  className="flex items-center gap-2 rounded-xl border border-cat-sante/40 bg-cat-sante/12 px-3 py-2 text-[12px] transition-colors hover:bg-cat-sante/20 disabled:opacity-40"
                  title="Marquer comme consommée"
                >
                  <span aria-hidden>{g.icon}</span>
                  {g.label}
                  <span className="text-[10px] text-ink-3">
                    j&apos;en profite ✓
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-3">
            Remportées au coffre : elles sont à toi sans rien payer. Une fois
            consommées, elles retournent au catalogue.
          </p>
        </Card>
      ) : null}

      {/* Filtres par famille */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFamille("tout")}
          aria-pressed={famille === "tout"}
          className={`rounded-full border px-4 py-1.5 text-[12px] transition-colors ${
            famille === "tout"
              ? "border-violet/50 bg-violet/20 text-ink"
              : "border-line text-ink-2 hover:bg-panel-2"
          }`}
        >
          Tout ({catalogue.length})
        </button>
        {presentes.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFamille(f.id)}
            aria-pressed={famille === f.id}
            title={f.hint}
            className={`rounded-full border px-4 py-1.5 text-[12px] transition-colors ${
              famille === f.id
                ? "border-violet/50 bg-violet/20 text-ink"
                : "border-line text-ink-2 hover:bg-panel-2"
            }`}
          >
            <span aria-hidden>{f.icon}</span> {f.label}
          </button>
        ))}
      </div>

      {famille !== "tout" ? (
        <p className="mb-3 text-[12px] text-ink-3">
          {REWARD_FAMILIES.find((f) => f.id === famille)?.hint}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visibles
          .slice()
          .sort((a, b) => a.price - b.price)
          .map((i) => (
            <ItemCard key={i.id} item={i} coins={coins} onBuy={buy} busy={busy} />
          ))}
      </ul>

      <p className="mt-4 text-[11px] text-ink-3">
        Une récompense s&apos;échange puis redevient disponible : la boutique ne
        s&apos;épuise pas. Les 🎁 coffres tirent au sort une récompense de leur
        palier — statistiquement plus chère que le coffre lui-même.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        <strong className="text-ink-2">Le marché bouge.</strong> Ce que tu
        achètes souvent renchérit (jusqu&apos;à +60 %), ce que tu délaisses se
        solde (jusqu&apos;à −25 %), et une récompense passe à −30 % chaque jour.
        Le prix affiché est celui qui sera débité.
      </p>
    </>
  );
}
