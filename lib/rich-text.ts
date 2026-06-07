// Helpers around the rich-text storage format (TipTap JSON / ProseMirror doc).
//
// Existing description columns held plain text before this change — we
// gracefully wrap unparseable content into a single paragraph so the old
// rows still render in the new editor without a backfill.

export type RichTextDoc = {
  type: "doc";
  content?: unknown[];
};

const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };

export function parseRichText(value: string | null | undefined): RichTextDoc {
  if (!value) return EMPTY_DOC;

  const trimmed = value.trim();
  if (!trimmed) return EMPTY_DOC;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed as RichTextDoc;
    }
  } catch {
    // fall through to plain-text wrapping
  }

  // Old plain text — wrap each non-empty line into its own paragraph.
  const paragraphs = trimmed.split(/\r?\n\r?\n+/);
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => {
      const text = paragraph.replace(/\s+/g, " ").trim();
      return text
        ? { type: "paragraph", content: [{ type: "text", text }] }
        : { type: "paragraph" };
    }),
  };
}

export function serializeRichText(doc: RichTextDoc | null | undefined): string {
  if (!doc) return JSON.stringify(EMPTY_DOC);
  return JSON.stringify(doc);
}

export function richTextIsEmpty(doc: RichTextDoc | null | undefined): boolean {
  if (!doc || !doc.content || doc.content.length === 0) return true;
  // Walk the tree looking for any text node or media.
  let hasContent = false;
  const visit = (node: unknown) => {
    if (hasContent) return;
    if (typeof node !== "object" || node === null) return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && n.text && n.text.trim().length) {
      hasContent = true;
      return;
    }
    if (n.type === "image" || n.type === "horizontalRule") {
      hasContent = true;
      return;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) visit(child);
    }
  };
  visit(doc);
  return !hasContent;
}

/**
 * Rewrite asset `src` URLs inside a rich-text doc (e.g. embedded images). Used
 * to repoint a public client board's description images from the auth-gated
 * /api/uploads route to a token-scoped public route, so logged-out clients can
 * see them. Operates on a fresh parse, so the original stored value is untouched.
 */
export function rewriteRichTextUploadSrc(
  value: string | null | undefined,
  replace: (src: string) => string,
): string {
  const doc = parseRichText(value);
  const visit = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as { attrs?: Record<string, unknown>; content?: unknown[] };
    if (n.attrs && typeof n.attrs.src === "string") {
      n.attrs.src = replace(n.attrs.src);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) visit(child);
    }
  };
  visit(doc);
  return serializeRichText(doc);
}

export function richTextToPlainText(
  doc: RichTextDoc | null | undefined,
): string {
  if (!doc) return "";
  const out: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && n.text) {
      out.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) visit(child);
    }
  };
  visit(doc);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
