"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

import type { Extensions } from "@tiptap/core";

// Shared extension list — used by both the editor and the renderer so a
// document written in one is rendered identically by the other.
export function getRichTextExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Link is registered as a separate extension below so we can configure
      // safer defaults (target=_blank, rel=noopener) and styling.
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
        class: "text-accent underline-offset-2 hover:underline",
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: "max-w-full rounded-md border border-border",
      },
    }),
    Table.configure({
      resizable: false,
      HTMLAttributes: {
        class: "ui-prose-table",
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      placeholder: placeholder ?? "Write something…",
    }),
  ];
}
