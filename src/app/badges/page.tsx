import { BadgeGallery } from "@/components/BadgeGallery";
import { PageHeader } from "@/components/ui";
import { getBadges } from "@/lib/queries";

export const metadata = { title: "Badges — QuestList" };

export default async function BadgesPage() {
  const badges = await getBadges();

  return (
    <>
      <PageHeader
        title="Badges"
        subtitle="Les badges verrouillés restent visibles : une collection incomplète, ça donne envie de la finir."
      />
      <BadgeGallery badges={badges} />
    </>
  );
}
