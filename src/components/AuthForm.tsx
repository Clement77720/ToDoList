"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthResult } from "@/app/auth-actions";

const field =
  "w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-violet";

export function AuthForm({
  mode,
  action,
}: {
  mode: "connexion" | "inscription";
  action: (
    prev: AuthResult | null,
    form: FormData,
  ) => Promise<AuthResult | null>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const isSignUp = mode === "inscription";

  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-6 backdrop-blur-sm">
      <header className="mb-5 text-center">
        <div className="text-3xl" aria-hidden>
          ⚔️
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          {isSignUp ? "Créer un compte" : "QuestList"}
        </h1>
        <p className="mt-1 text-[13px] text-ink-2">
          {isSignUp
            ? "Tes quêtes n'attendent que toi."
            : "Reprends là où tu t'es arrêté."}
        </p>
      </header>

      <form action={formAction} className="flex flex-col gap-3">
        {isSignUp ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
              Surnom
            </span>
            <input
              name="name"
              required
              maxLength={40}
              autoComplete="nickname"
              placeholder="Ton nom d'aventurier"
              className={field}
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="toi@exemple.fr"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
            Mot de passe
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder={isSignUp ? "8 caractères minimum" : "••••••••"}
            className={field}
          />
        </label>

        {state?.error ? (
          <p
            role="alert"
            className="rounded-lg border border-fire/35 bg-fire/10 px-3 py-2 text-[12px] text-fire"
          >
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-lg bg-violet px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "…" : isSignUp ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      <p className="mt-5 border-t border-line-soft pt-4 text-center text-[12px] text-ink-3">
        {isSignUp ? "Déjà un compte ? " : "Pas encore de compte ? "}
        <Link
          href={isSignUp ? "/connexion" : "/inscription"}
          className="font-semibold text-violet-bright hover:underline"
        >
          {isSignUp ? "Se connecter" : "En créer un"}
        </Link>
      </p>
    </div>
  );
}
