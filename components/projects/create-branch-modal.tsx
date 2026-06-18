"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { GitBranch, CircleNotch, Plus, X } from "@phosphor-icons/react";

import { createBranchAction } from "@/lib/actions";

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Portal to <body> so the .ui-header banner's scoped CSS vars don't wash out
  // the modal (same reason as CreateProjectModal).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe portal: render null on the server, then portal after client mount to avoid a hydration mismatch.
    setMounted(true);
  }, []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="ui-modal-backdrop absolute inset-0 bg-[rgba(10,10,10,0.44)] backdrop-blur-xs"
      />
      <div className="relative flex min-h-full items-end justify-center sm:items-center">
        <div className="ui-modal-panel relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-md border border-border bg-surface-strong p-5 shadow-xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                Branches modal
              </p>
              <div>
                <h3 className="text-[1.2rem] font-medium tracking-[-0.022em] text-foreground">
                  {title}
                </h3>
                <p className="mt-2 max-w-md text-[13px] leading-6 text-muted">
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:border-border-strong hover:bg-surface-strong hover:text-foreground"
            >
              <X className="size-4" />
              <span className="sr-only">Close modal</span>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="ui-button-primary mt-2 w-full px-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <CircleNotch className="size-4 animate-spin" /> : null}
      {pending ? "Creating branch..." : "Create branch"}
    </button>
  );
}

export function CreateBranchModal({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="ui-button-primary"
      >
        <Plus className="size-4" />
        New branch
      </button>

      {isOpen ? (
        <ModalShell
          onClose={() => setIsOpen(false)}
          title="Create branch"
          description="A branch is a separate workstream for a feature — it starts empty. Add tasks and requirements to it, or move existing ones over from another branch."
        >
          <form action={createBranchAction} className="grid gap-4">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">
                Branch name
              </span>
              <div className="relative">
                <GitBranch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  name="name"
                  required
                  maxLength={60}
                  autoFocus
                  className="ui-input pl-9"
                  placeholder="feature/checkout"
                  autoComplete="off"
                />
              </div>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">
                Description{" "}
                <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                className="ui-textarea"
                placeholder="What this branch is for."
              />
            </label>
            <SubmitButton />
          </form>
        </ModalShell>
      ) : null}
    </>
  );
}
