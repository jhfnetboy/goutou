// Route-level loading UI for the daily planner — header band + a row of
// day-column placeholders that mirror the real layout.
export default function DailyLoading() {
  return (
    <div className="grid gap-6">
      <div className="ui-skeleton h-44" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="ui-skeleton h-96 w-[280px] shrink-0" />
        ))}
      </div>
    </div>
  );
}
