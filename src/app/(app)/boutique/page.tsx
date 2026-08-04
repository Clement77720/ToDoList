import { Shop } from "@/components/Shop";
import { PageHeader } from "@/components/ui";
import { getPlayer, getRewards } from "@/lib/queries";

export const metadata = { title: "Boutique — QuestList" };

export default async function BoutiquePage() {
  const [rewards, player] = await Promise.all([getRewards(), getPlayer()]);

  return (
    <>
      <PageHeader
        title="Boutique"
        subtitle="Dépense tes pièces en vraies récompenses — la partie du système qui sort de l'écran."
      />
      <Shop rewards={rewards} coins={player.coins} />
    </>
  );
}
