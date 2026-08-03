import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// En dev, Next recharge les modules à chaque édition : sans ce cache global
// on ouvrirait un nouveau pool de connexions à chaque Fast Refresh.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL manquante. En local : copier .env.example vers .env. " +
        "Sur Vercel : la définir dans les variables d'environnement du projet.",
    );
  }

  // En serverless chaque instance a son propre pool, et elles se comptent en
  // dizaines : un pool large par instance épuise les connexions de la base.
  // Neon règle ça côté serveur avec son endpoint poolé (hôte en `-pooler`),
  // mais on garde une borne basse ici pour le cas d'une base non poolée.
  const adapter = new PrismaPg({ connectionString: url, max: 5 });
  return new PrismaClient({ adapter });
}

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  client ??= globalForPrisma.prisma ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

/**
 * Client instancié à la première requête, jamais à l'import.
 *
 * `next build` importe les modules de page pour en collecter les métadonnées
 * sans exécuter la moindre requête : créer le client (et donc exiger
 * `DATABASE_URL`) à l'import ferait échouer le build partout où la base n'est
 * pas joignable — typiquement un typecheck local ou une CI.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const value = Reflect.get(getClient(), prop);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
