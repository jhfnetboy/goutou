export default function ProjectsLoading() {
  return (
    <div className="grid gap-4">
      <div className="ui-skeleton h-48" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ui-skeleton h-24" />
        <div className="ui-skeleton h-24" />
        <div className="ui-skeleton h-24" />
      </div>
      <div className="ui-skeleton h-12" />
      <div className="grid gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="ui-skeleton h-24" />
        ))}
      </div>
    </div>
  );
}
