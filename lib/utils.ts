import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Single source of truth for displayed dates: always dd/mm/yyyy, independent of
// server/browser locale (so SSR and client never disagree). Use this for every
// user-facing date so the whole app reads the same way.
export function formatDate(
  value: Date | string | number | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function safeReturnPath(
  returnTo: string | null | undefined,
  fallback: string,
) {
  if (!returnTo || !returnTo.startsWith("/")) {
    return fallback;
  }

  return returnTo;
}

export function withSearchParams(
  path: string,
  params: Record<string, string | null | undefined>,
) {
  const url = new URL(path, "http://localhost");
  const searchParams = new URLSearchParams(url.search);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
  }

  const query = searchParams.toString();

  return query ? `${url.pathname}?${query}` : url.pathname;
}
