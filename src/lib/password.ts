import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Dérivation et vérification de mots de passe.
 *
 * Volontairement séparé de `auth.ts`, qui est `server-only` : le seed en a
 * besoin, et c'est un script Node ordinaire. Rien ici ne touche à la base
 * ni aux cookies — que du calcul.
 *
 * scrypt vient de la bibliothèque standard : pas de dépendance, pas de
 * module natif à compiler. Sel aléatoire par compte, comparaison en temps
 * constant pour ne pas fuiter le hash octet par octet.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );

  // `timingSafeEqual` exige des longueurs égales — les comparer d'abord
  // évite l'exception, et un hash de longueur inattendue est de toute
  // façon invalide.
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}
