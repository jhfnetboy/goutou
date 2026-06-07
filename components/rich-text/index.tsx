"use client";

// Re-export the heavy TipTap components via next/dynamic so route bundles
// only pull them in when a modal/editor actually mounts.

import dynamic from "next/dynamic";

export const RichTextEditor = dynamic(
  () => import("./rich-text-editor"),
  {
    ssr: false,
    loading: () => <div className="ui-skeleton h-32 rounded-md" aria-hidden />,
  },
);

export const RichTextRenderer = dynamic(
  () => import("./rich-text-renderer"),
  {
    ssr: false,
    loading: () => null,
  },
);
