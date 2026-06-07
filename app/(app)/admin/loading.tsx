// Route-level loading UI shared by every /admin/* page (dashboard, users,
// activity, invites, daily) — header band + a generic panel grid placeholder.
export default function AdminLoading() {
  return (
    <div className="grid gap-6">
      <div className="ui-skeleton h-32" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="ui-skeleton h-24" />
        ))}
      </div>
      <div className="ui-skeleton h-80" />
    </div>
  );
}
