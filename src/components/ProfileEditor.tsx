"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { updatePhotoAction, updateProfileAction } from "@/app/auth-actions";
import type { PlayerDTO } from "@/lib/types";
import { useToaster } from "./Toaster";
import { Avatar, Card, CardTitle } from "./ui";

/** Quelques emojis de repli, quand on ne veut pas de photo. */
const EMOJIS = ["🦊", "🐉", "🦉", "🐺", "🦁", "🐸", "🐙", "🦖", "🐝", "🦄"];

/** Côté le plus long de la photo une fois réduite. */
const MAX_SIDE = 256;
/** Qualité JPEG du rendu final. */
const QUALITY = 0.82;

/**
 * Réduit l'image dans le navigateur avant l'envoi. Sans ça, une photo de
 * téléphone de 4 Mo partirait telle quelle dans une colonne Postgres et
 * serait relue à chaque rendu de page.
 */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ce fichier n'est pas une image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Redimensionnement impossible."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileEditor({
  player,
  zones,
}: {
  player: PlayerDTO;
  /** Liste calculée côté serveur : `Intl.supportedValuesOf` peut différer
      entre Node et le navigateur, et l'hydratation divergerait. */
  zones: string[];
}) {
  const { report } = useToaster();
  const [state, formAction, saving] = useActionState(updateProfileAction, null);
  const [avatar, setAvatar] = useState(player.avatar);
  const [photo, setPhoto] = useState(player.photo);
  const [busy, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [zone, setZone] = useState(player.timezone);

  // L'heure ne peut pas être rendue au premier passage : le serveur et le
  // navigateur ne la liraient pas au même instant. On l'affiche après
  // montage, jamais pendant l'hydratation.
  const [heure, setHeure] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setHeure(
        new Date().toLocaleTimeString("fr-FR", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [zone]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUri = await shrink(file);
      startTransition(async () => {
        const res = await updatePhotoAction(dataUri);
        if (res.ok) setPhoto(dataUri);
        report(res.ok ? { ok: true } : { ok: false, error: res.error! });
      });
    } catch (e) {
      report({ ok: false, error: (e as Error).message });
    }
  };

  const removePhoto = () => {
    startTransition(async () => {
      const res = await updatePhotoAction(null);
      if (res.ok) setPhoto(null);
      report(res.ok ? { ok: true } : { ok: false, error: res.error! });
    });
  };

  return (
    <Card>
      <CardTitle>Mon profil</CardTitle>

      <div className="flex flex-col gap-5 sm:flex-row">
        {/* Photo */}
        <div className="flex flex-col items-center gap-2">
          <Avatar photo={photo} emoji={avatar} size={104} />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-[12px] transition-colors hover:border-violet/45 disabled:opacity-40"
          >
            {busy ? "…" : photo ? "Changer" : "Ajouter une photo"}
          </button>
          {photo ? (
            <button
              type="button"
              disabled={busy}
              onClick={removePhoto}
              className="text-[11px] text-ink-3 transition-colors hover:text-fire disabled:opacity-40"
            >
              Retirer la photo
            </button>
          ) : null}
        </div>

        {/* Surnom + emoji */}
        <form action={formAction} className="flex min-w-0 flex-1 flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
              Surnom
            </span>
            <input
              name="name"
              defaultValue={player.name}
              required
              maxLength={40}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-violet"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
              Emoji de repli
            </span>
            <input type="hidden" name="avatar" value={avatar} />
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setAvatar(e)}
                  aria-pressed={avatar === e}
                  className={`grid size-9 place-items-center rounded-lg border text-lg transition-colors ${
                    avatar === e
                      ? "border-violet/60 bg-violet/20"
                      : "border-line bg-panel-2 hover:border-violet/40"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-3">
              Utilisé quand aucune photo n&apos;est définie.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
              Fuseau horaire
            </span>
            <select
              name="timezone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-violet"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-3">
              Décide de l&apos;heure à laquelle ta journée bascule — donc du
              moment où tombent les malus.
              {heure ? ` Il est ${heure} dans ce fuseau.` : ""}
            </p>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
              Email
            </span>
            <p className="rounded-lg border border-line-soft bg-panel/60 px-3 py-2 text-sm text-ink-3">
              {player.email}
            </p>
          </div>

          {state && !state.ok ? (
            <p role="alert" className="text-[12px] text-fire">
              {state.error}
            </p>
          ) : state?.ok ? (
            <p className="text-[12px] text-cat-sante">Profil enregistré.</p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-bright disabled:opacity-40"
          >
            {saving ? "…" : "Enregistrer"}
          </button>
        </form>
      </div>
    </Card>
  );
}
