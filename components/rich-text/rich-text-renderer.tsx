"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import type { Content } from "@tiptap/core";

import { getRichTextExtensions } from "@/components/rich-text/extensions";
import { parseRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null | undefined;
  className?: string;
  fallback?: React.ReactNode;
};

export default function RichTextRenderer({ value, className, fallback }: Props) {
  const doc = parseRichText(value);

  const editor = useEditor({
    extensions: getRichTextExtensions(),
    content: doc as Content,
    editable: false,
    immediatelyRender: false,
  });

  const hasContent = Boolean(doc.content && doc.content.length);
  if (!hasContent && fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (!editor) {
    // Render a static fallback (raw text) while the editor mounts so SSR has
    // something meaningful and the layout doesn't shift dramatically.
    return (
      <div className={cn("ui-prose text-[13px] leading-6 text-muted", className)}>
        {/* ProseMirror needs the client to render; show nothing-yet placeholder. */}
      </div>
    );
  }

  return <EditorContent editor={editor} className={cn("ui-prose", className)} />;
}
