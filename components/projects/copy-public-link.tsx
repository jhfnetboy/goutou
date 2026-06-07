"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowSquareOut,
  Check,
  Copy,
  LinkSimple,
  LockSimple,
  X,
} from "@phosphor-icons/react";

import { enableClientShareAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

type CopyPublicLinkProps = {
  /** Whether the public client board is published (clientShareEnabled). */
  enabled: boolean;
  /** The rotatable share token, or null when the board has never been published. */
  token: string | null;
  /** Deployed origin from server env (set in production; empty in local dev). */
  baseUrl?: string;
  /** Project id, used for the inline publish action. */
  projectId: string;
  /** Where to send the owner to rotate / unpublish the board. */
  settingsHref: string;
};

/**
 * Header control for the public client board. Renders a compact trigger button
 * (works on web + mobile) that opens a modal:
 * - Published: shows the rotatable /client/<token> URL with copy + open-in-new-tab.
 * - Private:   a one-click "Publish board" action (no Settings detour); after
 *   publishing, the modal re-renders into the link view.
 *
 * The modal is portaled to <body> so the colored .ui-header banner's scoped CSS
 * variables don't wash it out.
 */
export function CopyPublicLink({
  enabled,
  token,
  baseUrl,
  projectId,
  settingsHref,
}: CopyPublicLinkProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState(baseUrl ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe portal mount flag.
    setMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser-only origin after mount so the field shows an absolute URL locally too (no hydration mismatch).
    if (!baseUrl && typeof window !== "undefined") setOrigin(window.location.origin);
  }, [baseUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isPublished = enabled && Boolean(token);
  const path = token ? `/client/${token}` : "";
  const fullUrl = `${origin}${path}`;
  const href = fullUrl || path;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context) — fail silently.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] font-medium text-muted transition hover:border-border-strong hover:bg-surface-strong hover:text-foreground"
      >
        {isPublished ? (
          <LinkSimple className="size-4" />
        ) : (
          <LockSimple className="size-4" />
        )}
        {isPublished ? "Public link" : "Client board private"}
      </button>

      {open && mounted && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 p-4 sm:p-6">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="ui-modal-backdrop absolute inset-0 bg-[rgba(10,10,10,0.44)] backdrop-blur-xs"
              />
              <div className="relative flex min-h-full items-end justify-center sm:items-center">
                <div className="ui-modal-panel relative w-full max-w-lg rounded-md border border-border bg-surface-strong p-5 shadow-xl sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                        Client board
                      </p>
                      <div>
                        <h3 className="text-[1.2rem] font-medium tracking-[-0.022em] text-foreground">
                          {isPublished
                            ? "Share the public board"
                            : "Client board is private"}
                        </h3>
                        <p className="mt-2 text-[13px] leading-6 text-muted">
                          {isPublished
                            ? "Anyone with this link can view a read-only version of the board. Rotate or unpublish it in Settings."
                            : "Publish the board to get a shareable, read-only link for your client."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:border-border-strong hover:bg-surface-strong hover:text-foreground"
                    >
                      <X className="size-4" />
                      <span className="sr-only">Close</span>
                    </button>
                  </div>

                  {isPublished ? (
                    <div className="grid gap-3">
                      <div className="flex items-center gap-2">
                        <span className="relative flex min-w-0 flex-1 items-center">
                          <LinkSimple className="pointer-events-none absolute left-3 size-4 text-muted" />
                          <input
                            readOnly
                            value={fullUrl}
                            onFocus={(event) => event.currentTarget.select()}
                            aria-label="Public client board link"
                            className="w-full rounded-md border border-border bg-surface py-2.5 pl-9 pr-3 font-mono text-[13px] text-foreground outline-none focus:border-border-strong"
                          />
                        </span>
                        <button
                          type="button"
                          onClick={handleCopy}
                          aria-label="Copy public link"
                          className={cn(
                            "inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-md px-4 text-[13px] font-medium transition",
                            copied
                              ? "border border-accent/40 bg-accent-soft text-accent"
                              : "ui-button-primary",
                          )}
                        >
                          {copied ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="ui-button-secondary w-full justify-center"
                      >
                        <ArrowSquareOut className="size-4" />
                        Open in new tab
                      </a>
                      <Link
                        href={settingsHref}
                        className="text-center text-[12px] text-muted transition hover:text-foreground"
                      >
                        Rotate or unpublish in Settings
                      </Link>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <form action={enableClientShareAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <button
                          type="submit"
                          className="ui-button-primary w-full justify-center"
                        >
                          <LinkSimple className="size-4" />
                          Publish board
                        </button>
                      </form>
                      <Link
                        href={settingsHref}
                        className="text-center text-[12px] text-muted transition hover:text-foreground"
                      >
                        Manage in Settings
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
