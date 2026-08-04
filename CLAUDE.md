# CLAUDE.md

Guide de travail pour ce dépôt. Le [README](README.md) explique le *produit* et
les règles du jeu ; ce fichier décrit comment y toucher sans rien casser.

**QuestList** — to-do list gamifiée. Next.js 16 (App Router) · React 19 ·
Tailwind 4 · Prisma 7 · PostgreSQL. Multi-utilisateurs (email + mot de passe).
Interface, commentaires et vocabulaire métier sont **en français** : garder
cette langue dans tout nouveau code.

## Commandes

Un PostgreSQL joignable est nécessaire — plus de fichier SQLite local :

```bash
docker run -d --name questlist-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=questlist -p 5432:5432 postgres:16

npm install          # postinstall lance `prisma generate`
cp .env.example .env # requis : DATABASE_URL n'est pas dans schema.prisma
npm run db:reset     # recrée la base + rejoue le seed
npm run dev          # http://localhost:3000
npm run build        # compile ET typecheck — le seul filet de sécurité
```

`npm run build` ne se connecte pas à la base (toutes les routes sont
dynamiques) : il reste lançable sans Postgres. `vercel-build` est la variante
de déploiement, elle joue `prisma migrate deploy` avant de compiler.

**Il n'y a ni tests ni linter.** `npm run build` est la vérification :
`next.config.ts` active `experimental.useTypeScriptCli`, donc le build fait
tourner `tsc` (TypeScript 7 n'expose plus l'API compilateur attendue par Next).
Toujours le lancer avant de committer.

Le client Prisma est généré dans `src/generated/` — **gitignoré**. Après un
clone frais ou un changement de schéma : `npx prisma generate`, sinon les
imports `@/generated/prisma/client` échouent.

## Architecture — les invariants

| Règle | Où |
|---|---|
| Toutes les mutations sont des Server Actions | `src/app/actions.ts` (métier) et `auth-actions.ts` (comptes) |
| Les écrans protégés vivent sous `(app)/`, la connexion sous `(auth)/` | la garde est dans le layout, pas dans les pages |
| Toutes les lectures serveur passent par des DTO plats | `src/lib/queries.ts` → `src/lib/types.ts` |
| **Aucun objet Prisma ne traverse la frontière serveur/client** | les composants ne reçoivent que des DTO |
| `db.ts`, `queries.ts`, `rollover.ts` sont marqués `server-only` | ne jamais les importer d'un composant client |
| Les pages (`src/app/*/page.tsx`) sont des composants **serveur** | elles lisent, elles ne mutent pas |
| Tout `src/components/*.tsx` est `"use client"` **sauf `ui.tsx`** | primitives partagées, sans état |
| Rendu à la demande | `export const dynamic = "force-dynamic"` dans `layout.tsx` |

Une Server Action doit toujours :
1. partir de `getCurrentUser()` et filtrer ses requêtes sur `userId` ;
2. revérifier côté serveur ce que l'UI a déjà contrôlé (ex. le quota de 4
   engagements — le client peut mentir) ;
3. appeler `grantEarnedBadges(user.id)` si l'action peut débloquer un badge ;
4. finir par `refresh()` (`revalidatePath("/", "layout")`) ;
5. renvoyer un `ActionResult` (`{ ok: true, xp?, coins?, badges?, levelUp? }`
   ou `{ ok: false, error }`) — jamais lever d'exception pour une erreur métier.

La mise à jour optimiste vit côté client (`useOptimistic` dans `TodayTasks`,
`WeekPlanner`, `RoutinesEditor`). Si tu ajoutes une action mutative visible
immédiatement, prévois le pendant optimiste, sinon la coche « clignote ».

### Authentification

Email + mot de passe, sans dépendance externe :

| Fichier | Rôle |
|---|---|
| `src/lib/password.ts` | scrypt (stdlib Node), sel par compte, comparaison en temps constant. **Pas `server-only`** — le seed en a besoin |
| `src/lib/auth.ts` | sessions : jeton aléatoire de 32 octets en cookie `httpOnly` + `sameSite: lax` |
| `src/app/auth-actions.ts` | inscription, connexion, déconnexion, profil |
| `src/lib/bootstrap.ts` | `createUserWithDefaults()` — catégories, routines et boutique à l'inscription |

`getSessionUser()` renvoie le compte connecté ou `null` ; `getCurrentUser()`
redirige vers `/connexion` s'il n'y en a pas. Les deux vivent dans
`queries.ts` et déclenchent `ensureRollover()` au passage, dédupliqué par
`cache()`.

La garde d'accès est **dans `(app)/layout.tsx`**, pas dans chaque page : une
page ajoutée plus tard est protégée d'office. `(auth)/layout.tsx` fait
l'inverse et renvoie un visiteur déjà connecté vers l'accueil.

Le message d'échec de connexion est volontairement le même pour un email
inconnu et un mot de passe faux — les distinguer permettrait d'énumérer les
comptes.

## Modèle de données

Trois conventions héritées de SQLite, **conservées après le passage à
Postgres** — les convertir en vrais enums/tableaux toucherait le seed et
toutes les lectures pour un gain nul tant que TypeScript valide :

- `Task.kind` = `"quotidienne" | "hebdomadaire" | "bonus"`, `Task.difficulty` =
  `"facile" | "moyenne" | "difficile"`, `Reward.kind` = `"reel" | "cosmetique"`.
  Ce sont des **String** en base, validés uniquement par les types TypeScript de
  `src/lib/gamification.ts`. Une valeur hors liste passe l'insertion et casse à
  la lecture.
- `Routine.days` est du **CSV ISO** : `"1,2,3,4,5"` (1 = lundi, 7 = dimanche).
- Les dates sont des chaînes **`yyyy-mm-dd`**, jamais des `Date`.

`src/lib/dates.ts` fait tous les calculs **en UTC** pour que serveur et client
tombent d'accord. Seul `todayISO()` lit l'horloge locale : il s'appelle côté
serveur, et la date descend en props. **Ne jamais recalculer « aujourd'hui »
dans un composant client** — l'hydratation diverge au premier changement de
fuseau.

Une hebdomadaire encore en réserve a `date: null` et un `weekStart` renseigné.
C'est ce qui la distingue d'une hebdomadaire placée.

## Le rollover (`src/lib/rollover.ts`)

Le « job de minuit », rattrapé paresseusement au premier chargement du jour. Il
fige les `DayRecord`, débite les quotidiennes oubliées, applique le malus
hebdomadaire le dimanche, fait avancer la série (en consommant un joker) puis
matérialise les tâches du jour à partir des routines.

Deux garde-fous d'idempotence, **à ne jamais contourner** :
`User.lastRollover` (un jour n'est clos qu'une fois) et `Task.malusApplied`
(une tâche n'est débitée qu'une fois). Rattrapage plafonné à
`MAX_CATCHUP_DAYS = 120` jours.

### Concurrence — la réservation de la journée

`ensureRollover()` **réserve** la journée par compare-and-swap avant de
travailler : un `updateMany` conditionné sur la valeur de `lastRollover`
qui vient d'être lue. Postgres ne laisse passer qu'un écrivain ; les autres
voient `count === 0` et ressortent. Ne pas remplacer ce motif par un
`update` simple.

Le dégât évité n'est **pas** un double débit d'XP — celle-ci est écrite en
valeur absolue recalculée depuis le même instantané, donc des exécutions
concurrentes convergent. C'est `materializeRoutines()` et
`materializeWeeklyTemplates()` qui sont vulnérables : elles lisent ce qui
existe puis insèrent ce qui manque. Sans la réservation, 12 rollovers
concurrents créaient **24 quotidiennes au lieu de 2**.

La journée est marquée traitée *avant* le travail, et rendue si celui-ci
lève. Mieux vaut sauter un rollover qu'en jouer deux.

La boucle clôt les jours de `today - gap` à **hier inclus**. L'index est
délicat : une version antérieure itérait `addDays(today, -(gap - i))` sur
`i` de 1 à `gap` et ne clôturait jamais la veille quand `gap = 1` — soit le
cas de tous les jours pour qui ouvre l'application quotidiennement. Les
malus ne tombaient donc qu'après deux jours d'absence. Toute modification
de cette boucle doit être vérifiée avec `lastRollover = hier`.

### Régime de semaine

`WeekSetting` n'existe **que** pour les semaines mises en vacances : pas de
ligne = « normale ». Une semaine de vacances ne débite rien et **gèle la
série** (ni progression, ni rupture, ni joker consommé). Les tâches oubliées
y sont tout de même marquées `malusApplied` : elles sont *soldées*, donc
repasser la semaine en « normale » plus tard ne peut pas les débiter
rétroactivement.

Trois endroits doivent rester d'accord : `closeDay`/`closeWeek`
(`rollover.ts`), `applyTonightMalusAction` (`actions.ts`) et l'affichage
(`MalusRisk`, `WeekPlanner`). Les libellés sont dans `gamification.ts` —
`weeks.ts` est `server-only` et les composants clients en ont besoin.

## Où changer quoi

| Besoin | Fichier |
|---|---|
| Rééquilibrer XP, malus, séries, plafonds, niveaux | `src/lib/gamification.ts` — la source de vérité |
| Ajouter un badge, une catégorie, une routine/récompense par défaut | `src/lib/catalog.ts` |
| Calculer un compteur de badge | `metrics()` dans `src/lib/queries.ts:296` |
| Ajouter une mutation | `src/app/actions.ts` |
| Couleurs, tokens de design | `@theme` dans `src/app/globals.css` |
| Historique de démo | `prisma/seed.ts` |

Le catalogue statique (badges, catégories) est une **règle**, pas une donnée :
la base ne mémorise que ce qui est propre au joueur (possession d'un badge,
niveau d'une catégorie, jours actifs d'une routine).

## Style

- **Aucun hex en dur dans un composant.** Passer par les tokens de
  `globals.css` (`bg-panel`, `text-ink-2`, `border-line`, `--color-cat-*`,
  `--color-seq-*`).
- Les couleurs de données ont été **validées au calcul** (bande de clarté
  OKLCH, plancher de chroma, séparation daltonisme protan/deutan, contraste sur
  la surface sombre) — ne pas en ajouter à l'œil. La palette catégorielle est
  d'ordre fixe et jamais recyclée.
- Thème sombre unique, assumé : pas de bascule clair/sombre.
- Réutiliser `Card`, `CardTitle`, `PageHeader`, `ProgressBar`, `Stat`,
  `CategoryChip` de `src/components/ui.tsx` avant d'inventer une variante.
- Graphiques (radar, heatmap, barres) faits main en SVG/CSS — pas de
  bibliothèque de charts, ne pas en introduire.
- Alias d'import : `@/*` → `src/*`.

## Pièges connus

Points réels du code actuel, à connaître avant de conclure à un bug :

- **`DAILY_XP_CAP` (250 XP/jour) n'est pas appliqué.** La constante est
  seulement *affichée* (`src/app/page.tsx:181`, `src/app/stats/page.tsx:242`) ;
  ni `toggleTaskAction` ni `closeDay` ne la font respecter. L'interface annonce
  un plafond anti-farm qui n'existe pas côté serveur.
- **10 badges sur 31 ne peuvent jamais se débloquer.** `grantEarnedBadges()`
  n'accorde qu'un badge portant `metric` + `goal`. Les 4 temporels autres
  qu'`anticipateur` et les 6 secrets n'en ont pas : ils sont décoratifs. Leur
  donner une `metric` implique de l'implémenter dans `metrics()`.
- **Niveau de catégorie et niveau de joueur ne suivent pas la même règle.**
  `LEVEL_FLOOR_PROTECTION` empêche le joueur de rétrograder
  (`applyXpDelta`), mais `addCategoryXp` (`src/app/actions.ts:32`) fait bien
  redescendre une catégorie. Deux courbes distinctes également :
  `xpToNextLevel` = `100 × n^1,4` (joueur) contre `categoryXpToNext` =
  `80 × n^1,25` (catégorie).
- **Rééquilibrer ne réécrit pas le passé.** Les `DayRecord` sont figés : changer
  un barème ne recalcule pas l'historique. Pour une démo cohérente après un
  changement de règles, refaire `npm run db:reset`.
- **Le seed est relatif à aujourd'hui.** Le PRNG est à graine fixe (`4242`),
  mais les dates sont calculées depuis `todayISO()` : rejouer le seed un autre
  jour produit un historique décalé. Un bug « qui n'apparaît que le dimanche »
  est plausible — le rollover a une branche `isoWeekday(date) === 7`.
- **`schema.prisma` n'a pas d'`url` dans son bloc `datasource`** : elle vient de
  `prisma.config.ts` via `DATABASE_URL`. Sans `.env`, toutes les commandes
  Prisma échouent.
- Le seed crée un utilisateur nommé **« Clément »** avec des routines et
  récompenses personnelles (`prisma/seed.ts:95`, `src/lib/catalog.ts`). À
  neutraliser si le dépôt devient vraiment public.

## Déploiement (Vercel + Neon)

`vercel-build` joue `prisma migrate deploy` avant `next build` : le schéma
suit tout seul. `DATABASE_URL` se définit dans les variables d'environnement
Vercel, avec la connection string **poolée** de Neon (hôte en `-pooler`) —
sans elle, les pools des instances serverless épuisent les connexions.

Aucune étape d'amorçage manuel : chaque inscription crée le compte et ses
valeurs par défaut issues de `catalog.ts` (`bootstrap.ts`, en une transaction).
`npm run db:seed` reste réservé au local — il **efface tout** et rejoue six mois
d'historique fictif.

**Le rollover tourne en cron** : `vercel.json` déclenche
`GET /api/cron/rollover` tous les jours à 00h15 UTC. La route exige
`Authorization: Bearer $CRON_SECRET` — Vercel l'envoie automatiquement quand
la variable est définie — et répond 500 plutôt que de rester ouverte si le
secret manque. `CRON_SECRET` se définit dans les variables d'environnement
Vercel, au même endroit que `DATABASE_URL`.

Le chemin paresseux (`getSessionUser()` → `ensureRollover()`) reste en place :
il couvre les comptes créés après le passage du cron et le cas où celui-ci
échoue. Les deux ne peuvent pas se marcher dessus, cf. ci-dessous.

## Git

Développement sur `feat/questlist-app-qqficz`. Push : `git push -u origin feat/questlist-app-qqficz`.
