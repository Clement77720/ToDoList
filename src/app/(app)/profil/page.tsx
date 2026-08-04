import { ProfileEditor } from "@/components/ProfileEditor";
import { Card, CardTitle, ProgressBar, Stat } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { RARITY, titleForLevel, xpToNextLevel } from "@/lib/gamification";
import { getBadges, getCategories, getHistory, getPlayer } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const [player, categories, badges, history] = await Promise.all([
    getPlayer(),
    getCategories(),
    getBadges(),
    getHistory(),
  ]);

  const unlocked = badges.filter((b) => b.unlocked);
  const perfectDays = history.filter((d) => d.perfect).length;
  const tasksDone = history.reduce((s, d) => s + d.done, 0);
  const netXp = history.reduce((s, d) => s + d.xp, 0);

  const rarest = [...unlocked].sort(
    (a, b) =>
      ["bronze", "argent", "or", "platine"].indexOf(b.rarity) -
      ["bronze", "argent", "or", "platine"].indexOf(a.rarity),
  )[0];

  return (
    <>
      <PageHeader
        title="Profil"
        subtitle={`${titleForLevel(player.level)} · niveau ${player.level}`}
      />

      <div className="flex flex-col gap-4">
        <ProfileEditor player={player} />

        {/* Grade et progression */}
        <Card>
          <CardTitle right={`${player.xp} / ${xpToNextLevel(player.level)} XP`}>
            Grade
          </CardTitle>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold">
              {titleForLevel(player.level)}
            </span>
            <span className="text-sm text-ink-2">
              niveau {player.level} → {player.level + 1}
            </span>
          </div>
          <ProgressBar
            value={player.xp}
            max={xpToNextLevel(player.level)}
            height={10}
            shimmer
          />
          <p className="mt-2 text-[11px] text-ink-3">
            Encore {Math.max(0, xpToNextLevel(player.level) - player.xp)} XP
            avant le niveau suivant.
          </p>
        </Card>

        {/* Chiffres clés */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="🔥" value={player.streak} label="Série en cours"
            hint={`Record : ${player.bestStreak} j`} accent="var(--color-fire)" />
          <Stat icon="✅" value={tasksDone} label="Tâches terminées"
            hint={`${perfectDays} journée${perfectDays > 1 ? "s" : ""} parfaite${perfectDays > 1 ? "s" : ""}`} />
          <Stat icon="🪙" value={player.coins} label="Pièces disponibles"
            accent="var(--color-gold)" />
          <Stat icon="🏅" value={`${unlocked.length}/${badges.length}`}
            label="Badges débloqués"
            hint={rarest ? `Plus rare : ${rarest.name}` : undefined}
            accent={rarest ? RARITY[rarest.rarity].color : undefined} />
        </div>

        {/* Niveaux par catégorie */}
        <Card>
          <CardTitle right={`${netXp} XP nette cumulée`}>
            Niveaux par catégorie
          </CardTitle>
          <ul className="flex flex-col gap-3">
            {categories.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px]">
                    <span aria-hidden>{c.icon}</span>
                    {c.label}
                  </span>
                  <span className="text-[11px] text-ink-3 tabular-nums">
                    Nv.{c.level} · {c.xp}/{c.xpMax}
                  </span>
                </div>
                <ProgressBar value={c.xp} max={c.xpMax} color={c.color} height={6} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
