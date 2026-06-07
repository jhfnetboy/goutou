"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Trash } from "@phosphor-icons/react";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type InviteItem = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  link: string;
  status: "pending" | "accepted" | "expired";
};

const statusStyles: Record<InviteItem["status"], string> = {
  pending: "border-accent/30 bg-accent-soft text-accent",
  accepted: "border-emerald/30 bg-emerald/10 text-emerald",
  expired: "border-border bg-surface text-muted",
};

export function InviteList({ items }: { items: InviteItem[] }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const copyLink = async (item: InviteItem) => {
    try {
      await navigator.clipboard.writeText(item.link);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1500);
      toast("Invite link copied", "success");
    } catch {
      toast("Could not copy link", "danger");
    }
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const response = await fetch(
        `/api/admin/invites?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast("Could not delete invitation", "danger");
        return;
      }
      toast("Invitation deleted", "success");
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-center text-[13px] leading-7 text-muted">
        No invitations yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
        Recent invitations
      </p>
      <div className="ui-panel-soft divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {item.email}
                </p>
                <span
                  className={cn(
                    "inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em]",
                    statusStyles[item.status],
                  )}
                >
                  {item.status}
                </span>
                <span className="ui-badge">{item.role}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted">
                Created {item.createdAt.toLocaleDateString()} · Expires{" "}
                {item.expiresAt.toLocaleDateString()}
              </p>
            </div>

            {item.status === "pending" ? (
              <button
                type="button"
                onClick={() => copyLink(item)}
                className="ui-button-secondary"
                title="Copy invite link"
              >
                <Copy className="size-4" />
                {copiedId === item.id ? "Copied" : "Copy link"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => remove(item.id)}
              disabled={isPending}
              className="ui-button-ghost"
              title="Delete invitation"
              aria-label="Delete invitation"
            >
              <Trash className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
