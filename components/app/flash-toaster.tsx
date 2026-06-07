"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FLASH_MESSAGES } from "@/lib/flash";
import { toast } from "@/lib/toast";

/**
 * Reads a one-shot ?flash=<key> after a server-action redirect, shows the
 * matching toast, then strips the param (preserving any other query params).
 * Mounted once in the app layout so it covers every authenticated route. Keys
 * not in FLASH_MESSAGES are ignored (e.g. the daily planner's own keys, which
 * its page-level reader handles), so the two never collide.
 */
export function FlashToaster() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const flash = searchParams.get("flash");
    if (!flash) return;
    const entry = FLASH_MESSAGES[flash];
    if (!entry) return;

    toast(entry.message, entry.variant);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("flash");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname]);

  return null;
}
