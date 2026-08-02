"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { badgeById } from "@/lib/catalog";
import type { ActionResult } from "@/app/actions";

export type Toast = {
  id: number;
  text: string;
  tone: "xp" | "malus" | "coins" | "badge" | "error";
};

type Ctx = {
  toasts: Toast[];
  push: (text: string, tone: Toast["tone"]) => void;
  /** Traduit le retour d'une Server Action en notifications. */
  report: (result: ActionResult) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((text: string, tone: Toast["tone"]) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      tone === "badge" || tone === "error" ? 2600 : 1400,
    );
  }, []);

  const report = useCallback(
    (result: ActionResult) => {
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      if (result.xp) {
        push(
          `${result.xp > 0 ? "+" : "−"}${Math.abs(result.xp)} XP`,
          result.xp > 0 ? "xp" : "malus",
        );
      }
      if (result.coins) {
        push(
          `${result.coins > 0 ? "+" : "−"}${Math.abs(result.coins)} 🪙`,
          "coins",
        );
      }
      for (const id of result.badges ?? []) {
        const badge = badgeById(id);
        if (badge) push(`${badge.icon} ${badge.name} débloqué !`, "badge");
      }
    },
    [push],
  );

  const value = useMemo(() => ({ toasts, push, report }), [toasts, push, report]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <ErrorToasts />
    </ToastCtx.Provider>
  );
}

/** Les erreurs et les badges méritent mieux qu'un chiffre qui s'envole. */
function ErrorToasts() {
  const { toasts } = useToaster();
  const notable = toasts.filter(
    (t) => t.tone === "error" || t.tone === "badge",
  );
  if (notable.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {notable.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`anim-pop-in rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-2xl backdrop-blur-sm ${
            t.tone === "error"
              ? "border-fire/45 bg-fire/20 text-ink"
              : "border-gold/45 bg-gold/20 text-ink"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function useToaster(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToaster doit être utilisé dans <ToastProvider>");
  return ctx;
}
