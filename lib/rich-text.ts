// Helpers around the rich-text storage format (TipTap JSON / ProseMirror doc).
//
// A description is stored as one of: TipTap JSON (the editor's own output),
// Markdown (a Jira-style import sent through the MCP write tools), or — for rows
// that predate the editor — plain text. parseRichText accepts all three: JSON is
// used as-is, anything else is run through the Markdown converter (which degrades
// to plain paragraphs for text without any Markdown), and a converter failure
// falls back to wrapping lines into paragraphs.
import { markdownToRichText } from "@/lib/markdown-to-rich-text";

export type RichTextDoc = {
  type: "doc";
  content?: unknown[];
};

const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };

/** A TipTap doc JSON string, if `value` is one; otherwise null. */
function asRichTextDocJson(value: string): RichTextDoc | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed as RichTextDoc;
    }
  } catch {
    // not JSON
  }
  return null;
}

export function parseRichText(value: string | null | undefined): RichTextDoc {
  if (!value) return EMPTY_DOC;

  const trimmed = value.trim();
  if (!trimmed) return EMPTY_DOC;

  const asJson = asRichTextDocJson(trimmed);
  if (asJson) return asJson;

  // Not the editor's JSON — treat it as Markdown (covers Jira/MCP imports and
  // legacy plain text, which the converter renders as plain paragraphs).
  try {
    return markdownToRichText(trimmed);
  } catch {
    // Converter blew up on pathological input — wrap lines into paragraphs.
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
}

/**
 * Normalize a description string for STORAGE: editor JSON is kept verbatim;
 * anything else (Markdown / plain text from an MCP client) is converted to
 * canonical TipTap JSON so the stored value is always the editor's own format.
 * Returns undefined for empty input. Used by the task/request write services so
 * an MCP import lands as rich content, identical to typing it in the editor.
 */
export function normalizeRichTextInput(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (asRichTextDocJson(trimmed)) return trimmed; // already editor JSON
  try {
    return serializeRichText(markdownToRichText(trimmed));
  } catch {
    return trimmed; // store raw; parseRichText still renders it on read
  }
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
