"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleNotch } from "@phosphor-icons/react";

import { setProjectSlugAction } from "@/lib/actions";
import {
  isValidSlug,
  normalizeSlugInput,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
} from "@/lib/codes";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="ui-button-primary px-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <CircleNotch className="size-4 animate-spin" /> : null}
      {pending ? "Saving…" : "Save key"}
    </button>
  );
}

export function ProjectSlugForm({
  projectId,
  currentSlug,
  returnTo,
}: {
  projectId: string;
  currentSlug: string | null;
  returnTo: string;
}) {
  const [value, setValue] = useState(currentSlug ?? "");

  const normalized = normalizeSlugInput(value);
  const isValid = isValidSlug(normalized);
  const isDirty = normalized !== (currentSlug ?? "");
  const showWarning = isDirty && Boolean(currentSlug);

  return (
    <form action={setProjectSlugAction} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-1.5">
          <span className="text-[13px] font-medium text-foreground">
            Project key
          </span>
          <input
            name="slug"
            value={value}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            placeholder="LFMS"
            maxLength={SLUG_MAX_LENGTH}
            className="ui-input font-mono uppercase tracking-[0.06em]"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            {SLUG_MIN_LENGTH}-{SLUG_MAX_LENGTH} chars · uppercase letters &
            numbers only
          </span>
        </label>
        <SubmitButton disabled={!isValid || !isDirty} />
      </div>

      {showWarning ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] leading-6 text-muted">
          Renaming the key changes every task and request code across the app
          (e.g.,{" "}
          <span className="font-mono font-semibold text-foreground">
            {currentSlug}-1
          </span>{" "}
          becomes{" "}
          <span className="font-mono font-semibold text-foreground">
            {normalized || "…"}-1
          </span>
          ). Any external links or notes referencing the old key will no longer
          match.
        </div>
      ) : null}
    </form>
  );
}
