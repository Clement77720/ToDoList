import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

export { hashPassword, verifyPassword } from "./password";

/**
 * Sessions de connexion, sans dépendance externe.
 *
 * Le jeton est un aléa de 32 octets déposé dans un cookie `httpOnly` : donc
 * invisible à JavaScript, donc hors de portée d'un XSS. `sameSite: lax`
 * ferme la porte au CSRF sur les requêtes inter-sites.
 *
 * Le hachage des mots de passe vit dans `password.ts` — le seed en a besoin
 * et ne peut pas importer un module `server-only`.
 */

const SESSION_COOKIE = "questlist_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({ data: { id: token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: token } });
    jar.delete(SESSION_COOKIE);
  }
}

/** Identifiant du compte connecté, ou null. Ne lève jamais. */
export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    select: { userId: true, expiresAt: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { id: token } });
    return null;
  }
  return session.userId;
}

/* ── Validation des saisies ─────────────────────────────────── */

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Message d'erreur, ou null si la saisie est acceptable. */
export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    return "Adresse email invalide.";
  }
  if (password.length < 8) {
    return "Le mot de passe doit faire au moins 8 caractères.";
  }
  return null;
}
