import Link from "next/link";
import { notFound } from "next/navigation";

import { requireViewer } from "@/lib/auth-server";
import { getSpaceDetail } from "@/lib/services/spaces";
import { PageHeader } from "@/components/app/page-header";
import { SpaceDetailView } from "@/components/spaces/space-detail-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ teamId: string }> };

export default async function TeamDetailPage({ params }: Props) {
  const viewer = await requireViewer();
  const { teamId } = await params;
  const detail = await getSpaceDetail(viewer, teamId);
  if (!detail) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={detail.kind === "company" ? "Team" : "Personal"}
        title={detail.name}
        description={
          detail.kind === "company"
            ? detail.leadName
              ? `Led by ${detail.leadName} · members open the projects they're invited to.`
              : "No lead assigned."
            : "Private to you."
        }
        action={
          <Link href="/team" className="ui-button-secondary">
            All teams
          </Link>
        }
      />
      <SpaceDetailView detail={detail} />
    </div>
  );
}
