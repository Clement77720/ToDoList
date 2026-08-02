import { Card, CardTitle, PageHeader, Stat } from "@/components/ui";
import { RadarCategories } from "@/components/RadarCategories";
import { WeeklyXpChart } from "@/components/WeeklyXpChart";
import { Heatmap } from "@/components/Heatmap";
import { getCategories, getHistory, getPlayer, getWeeklyXp } from "@/lib/queries";
import {
  DAILY_MALUS_CAP,
  DAILY_XP_CAP,
  DIFFICULTIES,
  LEVEL_FLOOR_PROTECTION,
  MALUS,
  MAX_ENGAGEMENTS_PER_DAY,
  PUNCTUALITY_BONUS,
  TASK_KINDS,
} from "@/lib/gamification";

export const metadata = { title: "Statistiques — QuestList" };

const STREAK_TABLE = [
  { days: "3 jours", mult: "×1,10" },
  { days: "7 jours", mult: "×1,25" },
  { days: "14 jours", mult: "×1,40" },
  { days: "30 jours et +", mult: "×1,60" },
];

const MALUS_TABLE = [
  {
    kind: "quotidienne" as const,
    when: "Le soir même, à minuit",
    note: "Elle ne reviendra pas : la journée est passée.",
  },
  {
    kind: "hebdomadaire" as const,
    when: "Dimanche soir seulement",
    note: "Déplaçable toute la semaine — c'est tout l'intérêt du format.",
  },
  {
    kind: "bonus" as const,
    when: "Jamais",
    note: "Une tâche optionnelle qui punit n'est plus optionnelle.",
  },
];

export default async function StatsPage() {
  const [history, categories, player, weeks] = await Promise.all([
    getHistory(),
    getCategories(),
    getPlayer(),
    getWeeklyXp(),
  ]);

  const last30 = history.slice(-30);
  const successRate = Math.round(
    (last30.filter((d) => d.success).length / Math.max(1, last30.length)) * 100,
  );
  const totalXp = history.reduce((s, d) => s + d.xp, 0);
  const malus30 = last30.reduce((s, d) => s + d.malus, 0);
  const avgTasks = (
    last30.reduce((s, d) => s + d.done, 0) / Math.max(1, last30.length)
  ).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <>
      <PageHeader
        title="Statistiques"
        subtitle="Six mois d'historique — ce que le système mesure, et selon quelles règles."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon="⚡"
          value={totalXp.toLocaleString("fr-FR")}
          label="XP nette gagnée"
        />
        <Stat
          icon="🎯"
          value={`${successRate} %`}
          label="Journées réussies (30 j)"
          accent="var(--color-cat-sante)"
        />
        <Stat
          icon="💥"
          value={`−${malus30.toLocaleString("fr-FR")}`}
          label="XP perdue en malus (30 j)"
          accent="var(--color-fire)"
          hint={`${avgTasks} tâches faites par jour`}
        />
        <Stat
          icon="🏆"
          value={`${player.bestStreak} j`}
          label="Meilleure série"
          accent="var(--color-fire)"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardTitle right="niveau atteint par catégorie">
            Équilibre des catégories
          </CardTitle>
          <RadarCategories categories={categories} />
        </Card>

        <Card>
          <CardTitle right="12 dernières semaines">
            XP nette par semaine
          </CardTitle>
          <WeeklyXpChart weeks={weeks} />
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle right="26 dernières semaines">
          Assiduité jour par jour
        </CardTitle>
        <Heatmap days={history} />
      </Card>

      {/* Le barème, visible en clair : la transparence évite le sentiment
          d'arbitraire qui tue la motivation. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Les trois types de tâche</CardTitle>
          <ul className="flex flex-col gap-3">
            {MALUS_TABLE.map(({ kind, when, note }) => {
              const meta = TASK_KINDS[kind];
              const cost = MALUS[kind];
              return (
                <li
                  key={kind}
                  className="border-b border-line-soft pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold">
                      <span aria-hidden className="mr-1.5">
                        {meta.icon}
                      </span>
                      {meta.plural}
                    </span>
                    <span
                      className={`text-[13px] font-bold tabular-nums ${
                        cost > 0 ? "text-fire" : "text-cat-sante"
                      }`}
                    >
                      {cost > 0 ? `−${cost} XP` : "0 XP"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-2">{when}</p>
                  <p className="mt-0.5 text-[11px] text-ink-3">{note}</p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>Gains</CardTitle>
          <table className="w-full text-[12px]">
            <thead className="text-ink-3">
              <tr className="border-b border-line-soft">
                <th className="pb-2 text-left font-medium">Difficulté</th>
                <th className="pb-2 text-right font-medium">XP</th>
                <th className="pb-2 text-right font-medium">Pièces</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(DIFFICULTIES).map(([k, d]) => (
                <tr key={k} className="border-b border-line-soft">
                  <td className="py-2">{d.label}</td>
                  <td className="py-2 text-right font-semibold text-violet-bright tabular-nums">
                    {d.xp}
                  </td>
                  <td className="py-2 text-right font-semibold text-gold tabular-nums">
                    {d.coins}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 mb-3 text-[11px] leading-relaxed text-ink-3">
            +{PUNCTUALITY_BONUS * 100} % si terminée le jour prévu. Difficulté
            figée à la création.
          </p>

          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Multiplicateur de série
          </h3>
          <ul className="flex flex-col gap-1.5 text-[12px]">
            {STREAK_TABLE.map((s) => (
              <li key={s.days} className="flex items-center justify-between">
                <span className="text-ink-2">{s.days}</span>
                <span className="font-semibold text-fire tabular-nums">
                  {s.mult}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Garde-fous</CardTitle>
          <ul className="flex flex-col gap-3 text-[12px] leading-relaxed text-ink-2">
            <li className="flex gap-2">
              <span aria-hidden>🧯</span>
              <span>
                <strong className="text-ink">
                  Malus plafonné à {DAILY_MALUS_CAP} XP par jour.
                </strong>{" "}
                Une journée catastrophique reste rattrapable.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>🪜</span>
              <span>
                <strong className="text-ink">
                  {LEVEL_FLOOR_PROTECTION
                    ? "On ne perd jamais un niveau."
                    : "Protection de niveau désactivée."}
                </strong>{" "}
                {LEVEL_FLOOR_PROTECTION
                  ? "La barre s'arrête à zéro dans le niveau courant."
                  : "L'XP peut faire redescendre d'un niveau entier."}
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>⭐</span>
              <span>
                <strong className="text-ink">
                  {MAX_ENGAGEMENTS_PER_DAY} engagements maximum par jour
                </strong>{" "}
                — quotidiennes incluses. Empêche la sur-planification, cause n°1
                des journées ratées.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>🧢</span>
              <span>
                <strong className="text-ink">
                  Plafond de {DAILY_XP_CAP} XP par jour.
                </strong>{" "}
                Découper une tâche en dix ne rapporte rien de plus.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>🛡️</span>
              <span>
                <strong className="text-ink">Un joker tous les 7 jours</strong>{" "}
                de série, stock max 2 — il absorbe une journée ratée avant de
                casser la série.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
