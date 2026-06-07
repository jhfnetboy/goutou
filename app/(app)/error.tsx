"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="ui-panel max-w-xl p-8 text-center">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
          Something broke
        </p>
        <h1 className="mt-2 text-[28px] font-medium tracking-tighter text-foreground">
          The workspace could not finish this view.
        </h1>
        <p className="mt-2 text-[13px] leading-7 text-muted">
          {error.message || "An unexpected application error occurred."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="ui-button-primary"
          >
            Try again
          </button>
          <Link href="/projects" className="ui-button-secondary">
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
