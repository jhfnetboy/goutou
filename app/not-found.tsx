import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="ui-panel max-w-xl p-8 text-center">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
          Not Found
        </p>
        <h1 className="mt-2 text-[28px] font-medium tracking-tighter text-foreground">
          That project workspace does not exist.
        </h1>
        <p className="mt-2 text-[13px] leading-7 text-muted">
          The link may be stale, or the project may no longer belong to the current owner account.
        </p>
        <Link href="/projects" className="ui-button-primary mt-5 inline-flex">
          Return to projects
        </Link>
      </div>
    </main>
  );
}
