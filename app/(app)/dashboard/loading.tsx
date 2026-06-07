export default function DashboardLoading() {
  return (
    <div className="grid gap-6">
      <section className="ui-panel p-5 sm:p-6">
        <div className="h-3 w-20 animate-pulse rounded-sm bg-surface-strong" />
        <div className="mt-4 h-10 w-72 animate-pulse rounded-md bg-surface-strong" />
        <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded-sm bg-surface-strong" />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="ui-panel p-4">
            <div className="h-3 w-16 animate-pulse rounded-sm bg-surface-strong" />
            <div className="mt-2 h-7 w-12 animate-pulse rounded-sm bg-surface-strong" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded-sm bg-surface-strong" />
          </div>
        ))}
      </div>

      <section className="ui-panel p-5 sm:p-6">
        <div className="h-4 w-32 animate-pulse rounded-sm bg-surface-strong" />
        <div className="mt-5 h-44 w-full animate-pulse rounded-sm bg-surface-strong" />
      </section>

      <section className="ui-panel p-5 sm:p-6">
        <div className="h-4 w-32 animate-pulse rounded-sm bg-surface-strong" />
        <div className="mt-5 h-32 w-full animate-pulse rounded-sm bg-surface-strong" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-panel p-5 sm:p-6">
          <div className="h-4 w-40 animate-pulse rounded-sm bg-surface-strong" />
          <div className="mt-5 h-56 w-full animate-pulse rounded-sm bg-surface-strong" />
        </section>
        <section className="ui-panel p-5 sm:p-6">
          <div className="h-4 w-40 animate-pulse rounded-sm bg-surface-strong" />
          <div className="mt-5 h-56 w-full animate-pulse rounded-sm bg-surface-strong" />
        </section>
      </div>

      <section className="ui-panel p-5 sm:p-6">
        <div className="h-4 w-32 animate-pulse rounded-sm bg-surface-strong" />
        <div className="mt-5 h-64 w-full animate-pulse rounded-sm bg-surface-strong" />
      </section>
    </div>
  );
}
