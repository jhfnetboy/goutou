"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Buildings,
  CircleNotch,
  Crown,
  Plus,
  Trash,
  User,
  UserPlus,
} from "@phosphor-icons/react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SpaceMember = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isLead: boolean;
};

type Space = {
  id: string;
  kind: "personal" | "company";
  name: string;
  leadId: string | null;
  leadName: string | null;
  isLead: boolean;
  canPost: boolean;
  memberCount: number;
  projectCount: number;
};

type Props = {
  spaces: Space[];
  membersBySpace: Record<string, SpaceMember[]>;
  canCreate: boolean;
};

type Op =
  | { op: "create"; name: string }
  | { op: "rename"; spaceId: string; name: string }
  | { op: "delete"; spaceId: string }
  | { op: "addMember"; spaceId: string; email: string }
  | { op: "removeMember"; spaceId: string; userId: string }
  | { op: "setLead"; spaceId: string; userId: string };

export function SpacesManager({ spaces, membersBySpace, canCreate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [emailBySpace, setEmailBySpace] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const call = (body: Op, successMessage: string) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await fetch("/api/spaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          toast(data.error ?? "Something went wrong.", "danger");
          resolve(false);
          return;
        }
        toast(successMessage, "success");
        router.refresh();
        resolve(true);
      });
    });

  const manageable = spaces.filter(
    (s) => s.kind === "company" && (s.isLead || canCreate),
  );
  const deleteTarget = spaces.find((s) => s.id === deleteId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
          Settings · Spaces
        </p>
        <h1 className="mt-2 text-[24px] font-medium tracking-[-0.022em] text-foreground">
          Spaces
        </h1>
        <p className="mt-1 max-w-prose text-[13px] leading-6 text-muted">
          A <strong className="text-foreground">company space</strong> is shared:
          everyone in it can see all its projects. Your{" "}
          <strong className="text-foreground">Personal</strong> space is private
          to you. Projects live in exactly one space.
        </p>
      </div>

      {canCreate ? (
        <div className="ui-panel-soft p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            Create company space
          </p>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            Name it after the company or team. You become its lead — add members
            to grant them access to every project in the space.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Northwind Retail"
              className="ui-input min-w-0 flex-1"
              disabled={isPending}
            />
            <button
              type="button"
              disabled={isPending || !newName.trim()}
              onClick={async () => {
                const ok = await call(
                  { op: "create", name: newName.trim() },
                  "Company space created",
                );
                if (ok) setNewName("");
              }}
              className="ui-button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {spaces.map((space) => {
          const members = membersBySpace[space.id] ?? [];
          const canManage = manageable.some((m) => m.id === space.id);
          return (
            <div key={space.id} className="ui-panel-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted">
                      {space.kind === "company" ? (
                        <Buildings className="size-4" />
                      ) : (
                        <User className="size-4" />
                      )}
                    </span>
                    <h2 className="text-[15px] font-medium text-foreground">
                      {space.name}
                    </h2>
                    <span
                      className={cn(
                        "inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em]",
                        space.kind === "company"
                          ? "border-aether-blue/40 text-aether-blue"
                          : "border-border bg-surface text-muted",
                      )}
                    >
                      {space.kind}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {space.kind === "company"
                      ? `Lead: ${space.leadName ?? "—"} · ${space.memberCount} member${space.memberCount === 1 ? "" : "s"} · ${space.projectCount} project${space.projectCount === 1 ? "" : "s"}`
                      : `${space.projectCount} project${space.projectCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeleteId(space.id)}
                    className="ui-button-ghost"
                    title="Delete space"
                    aria-label={`Delete ${space.name}`}
                  >
                    <Trash className="size-4" />
                  </button>
                ) : null}
              </div>

              {canManage ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="email"
                      value={emailBySpace[space.id] ?? ""}
                      onChange={(e) =>
                        setEmailBySpace((m) => ({
                          ...m,
                          [space.id]: e.target.value,
                        }))
                      }
                      placeholder="teammate@company.com"
                      className="ui-input min-w-0 flex-1"
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      disabled={isPending || !(emailBySpace[space.id] ?? "").trim()}
                      onClick={async () => {
                        const ok = await call(
                          {
                            op: "addMember",
                            spaceId: space.id,
                            email: (emailBySpace[space.id] ?? "").trim(),
                          },
                          "Member added",
                        );
                        if (ok)
                          setEmailBySpace((m) => ({ ...m, [space.id]: "" }));
                      }}
                      className="ui-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UserPlus className="size-4" />
                      Add
                    </button>
                  </div>

                  <div className="divide-y divide-border">
                    {members.map((m) => (
                      <div
                        key={m.userId}
                        className="flex flex-wrap items-center gap-2 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-medium text-foreground">
                            {m.name}
                          </span>
                          {m.isLead ? (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-sm border border-emerald/30 bg-emerald/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-emerald">
                              <Crown className="size-3" />
                              lead
                            </span>
                          ) : null}
                          <span className="ml-2 font-mono text-[11px] text-muted">
                            {m.email}
                          </span>
                        </div>
                        {!m.isLead ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                call(
                                  { op: "setLead", spaceId: space.id, userId: m.userId },
                                  `${m.name} is now lead`,
                                )
                              }
                              className="text-[12px] text-muted transition hover:text-foreground"
                            >
                              Make lead
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                call(
                                  {
                                    op: "removeMember",
                                    spaceId: space.id,
                                    userId: m.userId,
                                  },
                                  "Member removed",
                                )
                              }
                              className="ui-button-ghost"
                              title="Remove member"
                              aria-label={`Remove ${m.name}`}
                            >
                              <Trash className="size-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    ))}
                    {members.length === 0 ? (
                      <p className="py-2 text-[12px] text-muted">
                        No members yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name ?? ""}"?`}
        description={
          deleteTarget && deleteTarget.projectCount > 0
            ? `This space still has ${deleteTarget.projectCount} project${deleteTarget.projectCount === 1 ? "" : "s"}. Move or delete them first — deletion will be refused.`
            : "This removes the company space and its membership. Projects must be moved out first."
        }
        confirmLabel="Delete space"
        variant="danger"
        isPending={isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const ok = await call({ op: "delete", spaceId: deleteTarget.id }, "Space deleted");
          if (ok) setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
