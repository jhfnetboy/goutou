"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleNotch, Plus, X } from "@phosphor-icons/react";

import { ProjectColorField } from "@/components/projects/project-color-field";
import { createProjectAction } from "@/lib/actions";
import {
  deriveSlug,
  normalizeSlugInput,
  SLUG_MAX_LENGTH,
} from "@/lib/codes";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-status";

const fieldClassName =
  "ui-input";

const textAreaClassName = "ui-textarea";

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
  // Portal to <body> so the overlay escapes any ancestor (e.g. the .ui-header
  // banner the trigger lives in) whose scoped CSS variables would otherwise
  // cascade into the modal and wash out its surface/text tokens.
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
        <div className="ui-modal-panel relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-md border border-border bg-surface-strong p-5 shadow-xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                Projects modal
              </p>
              <div>
                <h3 className="text-[1.2rem] font-medium tracking-[-0.022em] text-foreground">
                  {title}
                </h3>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
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

function NameSlugFields() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const slugWasTouched = useRef(false);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value;
    setName(nextName);
    if (!slugWasTouched.current) {
      setSlug(deriveSlug(nextName));
    }
  };

  const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    slugWasTouched.current = true;
    setSlug(normalizeSlugInput(event.target.value));
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Project name</span>
        <input
          name="name"
          required
          value={name}
          onChange={handleNameChange}
          className="ui-input"
          placeholder="Website revamp"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Key</span>
        <input
          name="slug"
          value={slug}
          onChange={handleSlugChange}
          maxLength={SLUG_MAX_LENGTH}
          className="ui-input font-mono uppercase tracking-[0.06em] sm:w-32"
          placeholder="WR"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    </div>
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
      {pending ? "Creating project..." : "Create project"}
    </button>
  );
}

type SpaceOption = { id: string; name: string; kind: "personal" | "company" };

export function CreateProjectModal({
  closeHref,
  defaultOpen = false,
  clearUrlOnClose = false,
  spaces = [],
}: {
  closeHref: string;
  defaultOpen?: boolean;
  clearUrlOnClose?: boolean;
  spaces?: SpaceOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleClose = () => {
    setIsOpen(false);

    if (clearUrlOnClose) {
      router.replace(closeHref, { scroll: false });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="ui-button-primary"
      >
        <Plus className="size-4" />
        Create project
      </button>

      {isOpen ? (
        <ModalShell
          onClose={handleClose}
          title="Create project"
          description="Set the container first, then open the workspace to handle requests, tasks, and notes without turning this overview into a long form."
        >
          <form action={createProjectAction} className="grid gap-4">
            {spaces.length > 1 ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Team</span>
                <select
                  name="spaceId"
                  defaultValue={
                    spaces.find((s) => s.kind === "personal")?.id ?? spaces[0]?.id
                  }
                  className="ui-select"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.kind === "personal" ? "Personal" : s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[13px] leading-6 text-muted">
                  Personal keeps it private to you; a team files it under that
                  team — invite people to the project to give them access.
                </p>
              </label>
            ) : null}

            <NameSlugFields />

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">
                Client name
              </span>
              <input
                name="clientName"
                className={fieldClassName}
                placeholder="Studio North"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Summary</span>
              <textarea
                name="summary"
                rows={4}
                className={textAreaClassName}
                placeholder="Short description, scope, or current focus."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select
                  name="status"
                  defaultValue="development"
                  className="ui-select"
                >
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">
                  Deadline
                </span>
                <input type="date" name="deadline" className={fieldClassName} />
              </label>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Color</span>
              <p className="text-[13px] leading-6 text-muted">
                Tints the project header. Leave unset for the default theme.
              </p>
              <ProjectColorField name="color" />
            </div>

            <SubmitButton />
          </form>
        </ModalShell>
      ) : null}
    </>
  );
}
