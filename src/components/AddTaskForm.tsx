"use client";

import { useState, useTransition } from "react";
import { DIFFICULTIES, type DifficultyKey } from "@/lib/gamification";
import type { CategoryDTO } from "@/lib/types";

export function AddTaskForm({
  categories,
  label,
  placeholder,
  onSubmit,
  /** Propose la case « chaque semaine » (réserve hebdomadaire seulement). */
  allowRecurring = false,
  /** Valeurs de départ : passe le formulaire en mode édition. */
  initial,
  onCancel,
}: {
  categories: CategoryDTO[];
  label: string;
  placeholder: string;
  onSubmit: (
    title: string,
    categorySlug: string,
    difficulty: DifficultyKey,
    recurring: boolean,
  ) => Promise<void>;
  allowRecurring?: boolean;
  initial?: { title: string; slug: string; difficulty: DifficultyKey };
  onCancel?: () => void;
}) {
  const editing = Boolean(initial);
  const [open, setOpen] = useState(editing);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? categories[0]?.slug ?? "");
  const [difficulty, setDifficulty] = useState<DifficultyKey>(
    initial?.difficulty ?? "facile",
  );
  const [recurring, setRecurring] = useState(false);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    onCancel?.();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm text-ink-3 transition-colors hover:border-violet/50 hover:text-ink-2"
      >
        <span aria-hidden>＋</span> {label}
      </button>
    );
  }

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await onSubmit(title, slug, difficulty, recurring);
      if (!editing) setTitle("");
      close();
    });
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-violet/35 bg-panel-2 p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") close();
        }}
        placeholder={placeholder}
        aria-label={label}
        className="rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-violet"
      />

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setSlug(c.slug)}
            aria-pressed={slug === c.slug}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
              slug === c.slug
                ? "border-transparent text-ink"
                : "border-line text-ink-3 hover:border-violet/40"
            }`}
            style={
              slug === c.slug
                ? { background: `color-mix(in oklab, ${c.color} 28%, transparent)` }
                : undefined
            }
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
          </button>
        ))}
      </div>

      {/* Le formulaire vit dans une colonne de 300 px : sans `flex-wrap`,
          difficultés et boutons d'action débordent hors de la carte. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDifficulty(k)}
              aria-pressed={difficulty === k}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                difficulty === k
                  ? "border-violet/50 bg-violet/20 text-ink"
                  : "border-line text-ink-3 hover:border-violet/40"
              }`}
            >
              {DIFFICULTIES[k].label}
              <span className="ml-1 text-violet-bright tabular-nums">
                {DIFFICULTIES[k].xp}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3 py-1.5 text-[12px] text-ink-3 hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-violet-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "…" : editing ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>

      {allowRecurring ? (
        <label className="flex cursor-pointer items-start gap-2 border-t border-line-soft pt-2.5">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="mt-0.5 size-3.5 accent-[var(--color-violet)]"
          />
          <span>
            <span className="block text-[12px]">Chaque semaine</span>
            <span className="block text-[10px] text-ink-3">
              Revient automatiquement en réserve — plus besoin de la recréer.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
