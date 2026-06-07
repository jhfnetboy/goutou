"use client";

import { cn } from "@/lib/utils";

const FALLBACK_DARK = "/dark-logo.png";
const FALLBACK_LIGHT = "/light-logo.png";

type BrandLogoProps = {
  systemName: string;
  // Uploaded (already versioned) URLs, or null to use the bundled logo.
  darkUrl: string | null;
  lightUrl: string | null;
  imgClassName?: string;
  wrapperClassName?: string;
};

// If an uploaded logo fails to load (object deleted, bad upload), swap to the
// bundled default rather than showing a broken image. Guard against a loop if
// the bundled asset itself is the source.
function handleError(fallback: string) {
  return (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.dataset.fellBack === "true") return;
    img.dataset.fellBack = "true";
    img.src = fallback;
  };
}

/**
 * Brand wordmark. Renders the dark + light variants and lets the existing
 * .logo-dark / .logo-light CSS swap them by theme. When a custom logo is
 * uploaded it replaces the bundled asset; a missing/broken upload falls back to
 * the bundled default. Plain <img> (not next/image) so the dynamic R2 URLs don't
 * need the image-optimizer remote allowlist.
 */
export function BrandLogo({
  systemName,
  darkUrl,
  lightUrl,
  imgClassName,
  wrapperClassName,
}: BrandLogoProps) {
  return (
    <span
      className={cn("inline-flex items-center", wrapperClassName)}
      aria-label={systemName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darkUrl ?? FALLBACK_DARK}
        alt={systemName}
        onError={handleError(FALLBACK_DARK)}
        className={cn("logo-dark w-auto", imgClassName)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightUrl ?? FALLBACK_LIGHT}
        alt={systemName}
        onError={handleError(FALLBACK_LIGHT)}
        className={cn("logo-light w-auto", imgClassName)}
      />
    </span>
  );
}
