// Pure date helpers for the Daily Ops planner. No dependencies — plain Date
// math, local-timezone, consistent with getStartOfDay/formatLocalDateKey in
// lib/data.ts. Weeks start on Monday to match the team's standup cadence.

export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(value: Date) {
  return isSameDay(value, new Date());
}

// YYYY-MM-DD in local TZ. en-CA forces ISO format (works in the Workers runtime).
export function formatDateKey(value: Date) {
  return value.toLocaleDateString("en-CA");
}

// Parse a YYYY-MM-DD key into a local start-of-day Date. Falls back to today
// for malformed input so callers never crash on a bad query param.
export function parseDateKey(key: string | null | undefined): Date {
  if (!key) return startOfDay(new Date());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return startOfDay(new Date());
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return startOfDay(new Date());
  return startOfDay(date);
}

// Monday as the first day of the week.
export function getStartOfWeek(value: Date) {
  const start = startOfDay(value);
  const day = start.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  return addDays(start, diff);
}

export function getWeekDays(anchor: Date): Date[] {
  const start = getStartOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// A month matrix of full weeks (Mon-start) covering every day of the anchor's
// month, padded with leading/trailing days so each row has 7 cells.
export function getMonthMatrix(anchor: Date): Date[][] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = getStartOfWeek(firstOfMonth);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  // Render until we've passed the last day of the month and completed the row.
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
    const lastCell = week[6];
    if (lastCell.getMonth() !== anchor.getMonth() && lastCell > firstOfMonth) {
      // Stop once we've rendered into the next month and the month is covered.
      if (cursor.getMonth() !== anchor.getMonth()) break;
    }
  }
  return weeks;
}

export function isInMonth(value: Date, anchor: Date) {
  return (
    value.getMonth() === anchor.getMonth() &&
    value.getFullYear() === anchor.getFullYear()
  );
}

// "May 26 – Jun 1, 2026" (or "May 26 – 30, 2026" when same month).
export function formatWeekRangeLabel(anchor: Date) {
  const days = getWeekDays(anchor);
  const start = days[0];
  const end = days[6];
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}

// "May 30 – 31, 2026" / "May 26 – Jun 1, 2026" for an explicit set of days
// (the visible range may be a partial week, e.g. today → Sunday).
export function formatDayRangeLabel(days: Date[]) {
  if (days.length === 0) return "";
  const start = days[0];
  const end = days[days.length - 1];
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth() && start.getDate() === end.getDate()) {
    return `${startMonth} ${start.getDate()}, ${year}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}

export function formatMonthLabel(anchor: Date) {
  return anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// "Mon" / "26" pieces for a day-column header.
export function formatWeekdayShort(value: Date) {
  return value.toLocaleDateString(undefined, { weekday: "short" });
}

export function formatDayNumber(value: Date) {
  return value.getDate();
}

// "Fri, May 30" — used in modals and toasts.
export function formatFriendlyDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
