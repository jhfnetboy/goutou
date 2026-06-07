import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { MembersManager } from "@/components/projects/members-manager";
import { requireViewer } from "@/lib/auth-server";
import { canAccessProject, canManageProjectMembers } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { projectMembers, projects, user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectMembersPage({ params }: PageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;

  if (!(await canAccessProject(viewer, projectId))) {
    notFound();
  }

  const canManage = await canManageProjectMembers(viewer, projectId);

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id, name: projects.name, ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) notFound();

  const [ownerRow, members] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, project.ownerId))
      .limit(1),
    db
      .select({
        membershipId: projectMembers.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        addedAt: projectMembers.createdAt,
      })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(desc(projectMembers.createdAt)),
  ]);

  const owner = ownerRow[0]
    ? {
        userId: ownerRow[0].id,
        name: ownerRow[0].name,
        email: ownerRow[0].email,
        role: ownerRow[0].role,
        image: ownerRow[0].image,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
          Project · Members
        </p>
        <h1 className="mt-2 text-[24px] font-medium tracking-[-0.022em] text-foreground">
          {project.name} — Members
        </h1>
        <p className="mt-1 max-w-prose text-[13px] leading-6 text-muted">
          Members can view and work on this project. The owner is always
          included. Add someone by their account email — they must have signed
          up via invite first.
        </p>
      </div>

      <MembersManager
        projectId={project.id}
        owner={owner}
        canManage={canManage}
        members={members.map((m) => ({
          membershipId: m.membershipId,
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          image: m.image,
          addedAt: m.addedAt,
        }))}
      />
    </div>
  );
}
