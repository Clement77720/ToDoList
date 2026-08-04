"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createUserWithDefaults } from "@/lib/bootstrap";
import {
  createSession,
  destroySession,
  hashPassword,
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from "@/lib/auth";
import { getCurrentUser } from "@/lib/queries";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/dates";

export type AuthResult = { ok: false; error: string };

/**
 * Les actions réussies redirigent et ne rendent donc jamais la main :
 * seul le cas d'échec a une valeur de retour.
 */

export async function signUpAction(
  _prev: AuthResult | null,
  form: FormData,
): Promise<AuthResult | null> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();

  if (!name) return { ok: false, error: "Choisis un surnom." };
  if (name.length > 40) return { ok: false, error: "Surnom trop long (40 caractères max)." };

  const invalid = validateCredentials(email, password);
  if (invalid) return { ok: false, error: invalid };

  // Le navigateur transmet son fuseau à l'inscription ; il est révisable
  // ensuite depuis le profil. Une valeur inconnue retombe sur le défaut.
  const proposed = String(form.get("timezone") ?? "");
  const timezone = isValidTimeZone(proposed) ? proposed : DEFAULT_TIMEZONE;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "Un compte existe déjà avec cet email." };

  const user = await createUserWithDefaults({
    email,
    passwordHash: await hashPassword(password),
    name,
    timezone,
  });

  await createSession(user.id);
  redirect("/");
}

export async function signInAction(
  _prev: AuthResult | null,
  form: FormData,
): Promise<AuthResult | null> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });

  // Message unique et volontairement vague : distinguer « email inconnu »
  // de « mot de passe faux » permettrait d'énumérer les comptes existants.
  const failure = { ok: false as const, error: "Email ou mot de passe incorrect." };
  if (!user) return failure;
  if (!(await verifyPassword(password, user.passwordHash))) return failure;

  await createSession(user.id);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/connexion");
}

/* ── Profil ─────────────────────────────────────────────────── */

export type ProfileResult = { ok: boolean; error?: string };

export async function updateProfileAction(
  _prev: ProfileResult | null,
  form: FormData,
): Promise<ProfileResult> {
  const user = await getCurrentUser();

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Le surnom ne peut pas être vide." };
  if (name.length > 40) return { ok: false, error: "Surnom trop long (40 caractères max)." };

  const avatar = String(form.get("avatar") ?? "").trim() || "🦊";

  const proposed = String(form.get("timezone") ?? "");
  const timezone = isValidTimeZone(proposed) ? proposed : user.timezone;

  await prisma.user.update({
    where: { id: user.id },
    data: { name, avatar, timezone },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Taille maximale d'une photo une fois encodée en data URI. */
const MAX_PHOTO_BYTES = 400_000;

export async function updatePhotoAction(
  dataUri: string | null,
): Promise<ProfileResult> {
  const user = await getCurrentUser();

  if (dataUri !== null) {
    // Le redimensionnement se fait côté navigateur, mais le client peut
    // mentir : on revalide format et taille avant d'écrire en base.
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUri)) {
      return { ok: false, error: "Format d'image non reconnu." };
    }
    if (dataUri.length > MAX_PHOTO_BYTES) {
      return { ok: false, error: "Image trop lourde après redimensionnement." };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { photo: dataUri },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
