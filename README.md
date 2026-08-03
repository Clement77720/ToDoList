# QuestList — la to-do list gamifiée

Application Next.js 16 + React 19 + Tailwind 4, avec persistance **Prisma +
PostgreSQL**. Tout est écrit en base : cocher une tâche, la déplacer, encaisser
un malus, acheter une récompense. Pas encore d'authentification — un seul
compte, créé par le seed.

## Démarrer

Il faut un PostgreSQL joignable. Le plus rapide en local :

```bash
docker run -d --name questlist-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=questlist -p 5432:5432 postgres:16
```

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:reset
```

```bash
npm run dev
```

Puis ouvrir http://localhost:3000

`db:reset` recrée la base et la remplit avec **six mois d'historique** généré de
façon déterministe (PRNG à graine fixe) : une longue série au printemps, cassée
il y a cinq semaines, puis la remontée en cours. Les dates sont relatives à
*aujourd'hui*, donc la démo reste cohérente quel que soit le jour.

| Script | Rôle |
|---|---|
| `npm run db:reset` | recrée la base et rejoue le seed |
| `npm run db:seed` | rejoue le seed seul |
| `npm run db:deploy` | applique les migrations sans toucher aux données |
| `npm run db:studio` | ouvre Prisma Studio sur la base |

## Les 6 écrans

| Route | Contenu |
|---|---|
| `/` | Tableau de bord — tâches du jour, **risque de malus**, quêtes, niveaux par catégorie, badges, heatmap |
| `/semaine` | **Planificateur hebdo** : réserve à placer, 7 colonnes, quota de créneaux, éditeur de routines |
| `/calendrier` | Vue mois navigable, remplissage par taux de complétion, malus encaissés, détail du jour |
| `/badges` | Galerie 31 badges, filtres par famille, verrouillés visibles avec progression |
| `/boutique` | Pièces → récompenses **réelles** définies par l'utilisateur, + cosmétiques |
| `/stats` | Radar d'équilibre, XP nette par semaine, assiduité, **et le barème complet en clair** |

## Les trois types de tâche

| Type | Comportement | Malus si non faite |
|---|---|---|
| 🔁 **Quotidienne** | Routine récurrente, revient automatiquement les jours cochés (lun→ven par défaut) | **−15 XP** le soir même |
| 📅 **Hebdomadaire** | Engagement de la semaine, placé librement sur un jour, déplaçable à volonté | **−25 XP**, mais dimanche soir seulement |
| ✨ **Bonus** | Tout le reste | **aucun** — une tâche optionnelle qui punit n'est plus optionnelle |

Quotidiennes et hebdomadaires sont des **engagements** : elles partagent le
quota de **4 par jour** et décident à la fois de la série et du malus.

## Ce qui est persisté

Tout passe par des **Server Actions** (`src/app/actions.ts`), avec mise à jour
optimiste côté client (`useOptimistic`) pour que la coche soit instantanée.

- Cocher une tâche → XP et pièces avec multiplicateurs, XP de catégorie, montée
  de niveau, badges débloqués automatiquement
- Placer / retirer une hebdomadaire — le serveur revérifie le quota de 4
- Activer / désactiver un jour de routine — le passé n'est jamais réécrit
- Créer une tâche bonus ou un engagement hebdo
- Acheter une récompense (débite les pièces ; les cosmétiques restent acquis,
  les récompenses réelles se reconsomment)
- Débiter le malus du soir sans attendre minuit

## Le job de minuit

`src/lib/rollover.ts` clôt les journées écoulées : il fige le `DayRecord`,
débite les quotidiennes oubliées, applique le malus hebdomadaire le dimanche,
fait avancer la série (en consommant un joker si besoin) et matérialise les
tâches du jour à partir des routines.

En production ce serait un cron. Ici l'application est locale et
mono-utilisateur : le rollover est **rattrapé paresseusement** au premier
chargement de la journée, via `getCurrentUser()`. L'opération est idempotente —
`lastRollover` empêche de clore un jour deux fois, `malusApplied` de débiter une
tâche deux fois. Une absence de plusieurs semaines est rattrapée jour par jour
(plafonnée à 120 journées).

## Les règles du jeu

Tout est centralisé dans `src/lib/gamification.ts` — c'est le seul fichier à
toucher pour rééquilibrer.

| Règle | Valeur |
|---|---|
| XP par tâche | Facile 10 · Moyenne 25 · Difficile 60 |
| Bonus de ponctualité | +20 % si terminée le jour prévu |
| Courbe de niveau | `XP(n→n+1) = 100 × n^1,4` |
| Multiplicateur de série | ×1,10 (3 j) · ×1,25 (7 j) · ×1,40 (14 j) · ×1,60 (30 j+) |
| Malus | −15 XP (quotidienne) · −25 XP (hebdomadaire) · 0 (bonus) |
| Jokers 🛡️ | 1 tous les 7 jours de série, stock max 2 |
| Plafond anti-farm | 250 XP / jour |
| Plafond de malus | 60 XP / jour |
| Engagements | 4 par jour maximum, quotidiennes incluses |

### Les garde-fous (choix de design assumés)

- **Malus plafonné à 60 XP par jour** — une journée catastrophique reste
  rattrapable. Mettre `DAILY_MALUS_CAP` à `Infinity` pour la version dure.
- **On ne perd jamais un niveau** : l'XP s'arrête à zéro dans le niveau courant.
  Passer `LEVEL_FLOOR_PROTECTION` à `false` pour autoriser la rétrogradation.
- **Une hebdomadaire ratée un mardi ne coûte rien** : elle se repose ailleurs.
  Le malus n'arrive qu'en fin de semaine — c'est ce qui rend le format vivable.
- **Les bonus ne pénalisent jamais.** Sinon plus rien n'est optionnel et tout
  devient une dette.
- **La série ne dépend que des engagements**, pas de toutes les tâches — sinon
  la sur-planification garantit l'échec.
- **Les jokers empêchent l'effet « série cassée = désinstallation »**.
- **Difficulté figée à la création** : impossible de la gonfler après coup.

## Couleurs de données

La palette catégorielle et la rampe de la heatmap ne sont pas choisies à l'œil :
elles passent les contrôles calculés (bande de clarté OKLCH, plancher de chroma,
séparation sous daltonisme protan/deutan, contraste sur la surface sombre).

- Catégories : `#0FA372` `#8B5CF6` `#C57C05` `#EC4899` `#2B93E0` — ordre fixe,
  jamais recyclé
- Rampe séquentielle (heatmap, remplissage du calendrier) : une seule teinte
  violette, clarté monotone, 5 pas
- Les jours sans donnée ne sont **pas** un pas de la rampe mais un état distinct

## Structure

```
prisma/
  schema.prisma     User · Category · Routine · Task · DayRecord ·
                    UnlockedBadge · Reward
  seed.ts           six mois d'historique déterministe
src/
  app/
    actions.ts      toutes les mutations (Server Actions)
    */page.tsx      un écran par route, composants serveur
  components/       UI + graphiques (radar, heatmap, barres) faits main
  lib/
    gamification.ts barèmes et formules — la source de vérité des règles
    catalog.ts      catalogue statique : badges, catégories et routines par défaut
    queries.ts      lectures serveur, typées en DTO
    rollover.ts     le job de minuit
    dates.ts        helpers yyyy-mm-dd, tout en UTC
    db.ts           client Prisma (singleton, adaptateur node-postgres)
```

Aucun objet Prisma ne traverse la frontière serveur/client : les composants ne
reçoivent que les DTO plats de `src/lib/types.ts`.

## Déployer sur Vercel + Neon

1. **Créer la base sur [Neon](https://neon.tech)** et copier la connection
   string **poolée** (son hôte contient `-pooler`).
2. **Importer le dépôt sur Vercel**, puis définir `DATABASE_URL` dans
   *Settings → Environment Variables* avec cette URL.
3. **Déployer.** Vercel exécute `vercel-build`, qui joue
   `prisma migrate deploy` avant `next build` : le schéma est appliqué tout
   seul à chaque déploiement.

C'est tout — il n'y a pas d'étape d'amorçage. Au premier chargement, une base
vide se voit créer son compte, ses cinq catégories, ses routines et sa boutique
par défaut (`src/lib/bootstrap.ts`). L'opération est protégée par un verrou
consultatif Postgres : plusieurs instances serverless démarrant en même temps
ne créent qu'un seul compte.

Le seed (`npm run db:seed`) reste réservé au **local** : il efface tout et
rejoue six mois d'historique fictif pour explorer l'application. Ce n'est pas
ce qu'on veut dans une base réelle.

### Ce qui reste à faire avant une vraie mise en ligne

- **Il n'y a pas d'authentification.** `getCurrentUser()` renvoie le premier
  compte de la base : sur une URL publique, n'importe quel visiteur voit tes
  tâches et peut les cocher ou dépenser tes pièces. Tant que ce point n'est pas
  traité, garder le déploiement privé (protection par mot de passe Vercel).
- **Le rollover reste paresseux**, déclenché par la première requête du jour.
  En serverless, deux requêtes concurrentes peuvent entrer ensemble dans
  `ensureRollover()` et appliquer deux fois malus et XP. Un Vercel Cron
  quotidien appelant le rollover réglerait les deux problèmes.
