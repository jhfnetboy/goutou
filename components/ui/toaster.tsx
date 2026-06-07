"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

import { subscribeToToasts, type ToastItem } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Solid surface for the body so we never composite over whatever's behind
// the portal. Variant accent comes from a colored left rail + icon.
const VARIANT_STYLES: Record<ToastItem["variant"], string> = {
  default: "border-border",
  success: "border-emerald border-l-[3px] border-l-emerald",
  danger: "border-danger border-l-[3px] border-l-danger",
};

const VARIANT_ICON_COLORS: Record<ToastItem["variant"], string> = {
  default: "text-muted",
  success: "text-emerald",
  danger: "text-danger",
};

const VARIANT_ICONS: Record<ToastItem["variant"], React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle,
  danger: WarningCircle,
};

const DEFAULT_DURATION_MS = 3500;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return subscribeToToasts((item) => {
      setItems((current) => [...current, item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((t) => t.id !== item.id));
      }, DEFAULT_DURATION_MS);
    });
  }, []);

  if (!mounted || items.length === 0) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {items.map((item) => {
        const Icon = VARIANT_ICONS[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-2.5 rounded-md border bg-surface-strong px-3 py-2.5 text-[13px] leading-5 text-foreground shadow-md transition",
              VARIANT_STYLES[item.variant],
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", VARIANT_ICON_COLORS[item.variant])} />
            <p className="min-w-0 flex-1 whitespace-pre-wrap">{item.message}</p>
            <button
              type="button"
              onClick={() => {
                setItems((current) => current.filter((t) => t.id !== item.id));
              }}
              aria-label="Dismiss notification"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted transition hover:bg-surface hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
