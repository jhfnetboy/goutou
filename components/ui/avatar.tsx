import Image from "next/image";

import { cn } from "@/lib/utils";

/** Up-to-two-letter initials from a name (falling back to the email local part). */
export function initialsOf(
  name: string | null | undefined,
  email?: string | null,
): string {
  const seed = (name?.trim() || email?.split("@")[0] || "").trim();
  if (!seed) return "?";
  if (seed.includes(" ")) {
    return (
      seed
        .split(/\s+/)
        .map((part) => part.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?"
    );
  }
  return seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

/**
 * Renders a user's profile picture when set, otherwise an initials box. `px` is
 * the rendered pixel size (also fed to next/image); `className` controls the
 * box sizing/rounding/font (e.g. "size-9 rounded-md text-[12px]").
 *
 * Uploaded avatars are served from the auth-gated `/api/uploads/...` route, so
 * `unoptimized` is required — the Next image optimizer can't pass the session
 * cookie, but the browser <img> can.
 */
export function Avatar({
  name,
  email,
  image,
  px,
  className,
}: {
  name: string | null | undefined;
  email?: string | null;
  image?: string | null;
  px: number;
  className?: string;
}) {
  const label = name?.trim() || email || "";

  if (image) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-md border border-border bg-background",
          className,
        )}
      >
        <Image
          src={image}
          alt={label}
          width={px}
          height={px}
          unoptimized
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background font-mono font-medium uppercase tracking-[0.04em] text-foreground",
        className,
      )}
    >
      {initialsOf(name, email)}
    </span>
  );
}
