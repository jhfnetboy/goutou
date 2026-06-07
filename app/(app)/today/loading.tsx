export default function TodayLoading() {
  return (
    <div className="grid gap-4">
      <div className="ui-skeleton h-32" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="ui-skeleton h-24" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="ui-skeleton h-64" />
          ))}
        </div>
        <div className="ui-skeleton h-80" />
      </div>
    </div>
  );
}
