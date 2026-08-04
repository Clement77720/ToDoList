import Link from "next/link";
import { Card, CardTitle, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { TodayTasks } from "@/components/TodayTasks";
import { MalusRisk } from "@/components/MalusRisk";
import { Heatmap } from "@/components/Heatmap";
import {
  getBadges,
  getCategories,
  getHistory,
  getPlayer,
  getTasksForDate,
  getWeeklyTasks,
} from "@/lib/queries";
import { formatLong, startOfWeek, todayISO } from "@/lib/dates";
import { getWeekKind } from "@/lib/weeks";
import { DAILY_XP_CAP, isEngagement, RARITY } from "@/lib/gamification";

function QuestRow({
  label,
  progress,
  goal,
  reward,
}: {
  label: string;
  progress: number;
  goal: number;
  reward: string;
}) {
  const done = progress >= goal;
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-md text-[11px] ${
          done ? "bg-cat-sante text-bg" : "border-2 border-ink-3/60"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-[13px] ${done ? "text-ink-3 line-through" : ""}`}
          >
            {label}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-gold">
            {reward}
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar
            value={Math.min(progress, goal)}
            max={goal}
            height={4}
            color={done ? "var(--color-cat-sante)" : "var(--color-violet)"}
          />
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-ink-3 tabular-nums">
        {Math.min(progress, goal)}/{goal}
      </span>
    </li>
  );
}

export default async function Dashboard() {
  const today = todayISO();
  const weekStart = startOfWeek(today);

  const player = await getPlayer();
  const [tasks, categories, weekly, history, badges, weekKind] =
    await Promise.all([
      getTasksForDate(today),
      getCategories(),
      getWeeklyTasks(weekStart),
      getHistory(),
      getBadges(),
      getWeekKind(player.id, weekStart),
    ]);

  const engagements = tasks.filter((t) => isEngagement(t.kind));
  const pending = engagements.filter((t) => !t.done).length;
  const recentBadges = badges.filter((b) => b.unlocked).slice(-4).reverse();
  const weeklyPending = weekly.filter((t) => !t.done);

  const weekRecords = history.filter((d) => d.date >= weekStart);
  const weekSuccess = weekRecords.filter((d) => d.success).length;
  const perfectDays = history.filter((d) => d.perfect).length;
  const tasksDone = history.reduce((s, d) => s + d.done, 0);

  // Les quêtes ne sont plus décoratives : elles lisent l'état réel.
  const dailyRoutines = tasks.filter((t) => t.kind === "quotidienne");
  const touchedCategories = new Set(
    tasks.filter((t) => t.done).map((t) => t.category.slug),
  ).size;
  const hardDone = tasks.filter(
    (t) => t.done && t.difficulty === "difficile",
  ).length;

  const quests = [
    dailyRoutines.length > 0
      ? {
          id: "q1",
          label: `Termine tes ${dailyRoutines.length} quotidiennes`,
          progress: dailyRoutines.filter((t) => t.done).length,
          goal: dailyRoutines.length,
          reward: "+50 XP",
        }
      : {
          id: "q1",
          label: "Valide 2 tâches aujourd'hui",
          progress: tasks.filter((t) => t.done).length,
          goal: 2,
          reward: "+50 XP",
        },
    {
      id: "q2",
      label: "Touche à 3 catégories différentes",
      progress: touchedCategories,
      goal: 3,
      reward: "+40 XP",
    },
    {
      id: "q3",
      label: "Valide une tâche Difficile",
      progress: hardDone,
      goal: 1,
      reward: "+30 🪙",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Bonjour ${player.name} ${player.avatar}`}
        subtitle={`${formatLong(today)} — ${
          pending === 0
            ? "tous tes engagements sont tenus"
            : `${pending} engagement${pending > 1 ? "s" : ""} encore ouvert${pending > 1 ? "s" : ""}`
        }`}
        right={
          <Link
            href="/semaine"
            className="rounded-xl border border-violet/35 bg-violet/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-violet/25"
          >
            🗂️ Planifier ma semaine
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon="🔥"
          value={`${player.streak} j`}
          label="Série en cours"
          accent="var(--color-fire)"
          hint={`Record : ${player.bestStreak} jours`}
        />
        <Stat
          icon="👑"
          value={perfectDays}
          label="Journées parfaites"
          accent="var(--color-gold)"
        />
        <Stat
          icon="✅"
          value={tasksDone}
          label="Tâches terminées"
          accent="var(--color-cat-sante)"
        />
        <Stat
          icon="📅"
          value={`${weekSuccess}/${weekRecords.length}`}
          label="Journées réussies (semaine)"
          accent="var(--color-cat-social)"
          hint="Semaine validée dès 5 jours"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle right={`Plafond anti-farm : ${DAILY_XP_CAP} XP / jour`}>
            Aujourd&apos;hui
          </CardTitle>
          <TodayTasks
            date={today}
            tasks={tasks}
            streak={player.streak}
            categories={categories}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <MalusRisk
            todayTasks={tasks}
            weeklyPending={weeklyPending}
            weekKind={weekKind}
          />

          <Card>
            <CardTitle right="renouvelées chaque nuit">
              Quêtes du jour
            </CardTitle>
            <ul className="flex flex-col gap-3.5">
              {quests.map((q) => (
                <QuestRow key={q.id} {...q} />
              ))}
            </ul>
            <div className="mt-4 border-t border-line-soft pt-4">
              <h3 className="mb-3 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                Quête hebdomadaire
              </h3>
              <ul>
                <QuestRow
                  label="Place toutes tes hebdomadaires"
                  progress={weekly.filter((t) => t.date).length}
                  goal={Math.max(1, weekly.length)}
                  reward="+200 XP · 🛡️"
                />
              </ul>
            </div>
          </Card>

          <Card>
            <CardTitle right={<Link href="/stats">détail →</Link>}>
              Niveaux par catégorie
            </CardTitle>
            <ul className="flex flex-col gap-3">
              {categories.map((c) => (
                <li key={c.slug}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden>{c.icon}</span>
                      <span className="text-ink-2">{c.label}</span>
                    </span>
                    <span className="text-ink-3 tabular-nums">
                      Nv.{c.level} · {c.xp}/{c.xpMax}
                    </span>
                  </div>
                  <ProgressBar
                    value={c.xp}
                    max={c.xpMax}
                    color={c.color}
                    height={6}
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle right={<Link href="/badges">galerie →</Link>}>
              Derniers badges
            </CardTitle>
            <ul className="grid grid-cols-4 gap-2">
              {recentBadges.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-panel-2 p-2.5 text-center"
                  style={{ boxShadow: `0 0 18px ${RARITY[b.rarity].glow}` }}
                >
                  <span className="text-xl" aria-hidden>
                    {b.icon}
                  </span>
                  <span className="text-[10px] leading-tight text-ink-2">
                    {b.name}
                  </span>
                  <span
                    className="text-[8px] font-bold tracking-wide uppercase"
                    style={{ color: RARITY[b.rarity].color }}
                  >
                    {RARITY[b.rarity].label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardTitle right="26 dernières semaines">
          Ton année en un coup d&apos;œil
        </CardTitle>
        <Heatmap days={history} />
      </Card>
    </>
  );
}
