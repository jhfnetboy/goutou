// Converts Markdown into the TipTap / ProseMirror JSON shape Seeder stores for
// rich-text fields (see lib/rich-text.ts). Used so Markdown pasted or imported
// through the MCP write tools (e.g. a Jira export) renders as real headings,
// lists, bold, links, code, and tables instead of literal `**`, `##`, `*`.
//
// Pure and DOM-free, so it runs both on the Cloudflare Worker (MCP / service
// write path) and in the browser bundle (parseRichText, used by the editor and
// renderer). We walk marked's lexer tokens straight into ProseMirror JSON,
// mapping node/mark names to the editor's schema (StarterKit + Link/Image/Table
// from components/rich-text/extensions.ts). Heading levels are clamped to [2, 3]
// — the only levels that schema enables, so an out-of-range heading would
// otherwise be dropped.
import { marked, type Token, type Tokens } from "marked";

import type { RichTextDoc } from "@/lib/rich-text";

type PMMark = { type: string; attrs?: Record<string, unknown> };
type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
};

const HEADING_MIN = 2;
const HEADING_MAX = 3;

export function markdownToRichText(markdown: string): RichTextDoc {
  const tokens = marked.lexer(markdown);
  const content = blocksFromTokens(tokens);
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

function blocksFromTokens(tokens: Token[]): PMNode[] {
  const nodes: PMNode[] = [];
  for (const token of tokens) {
    const mapped = blockFromToken(token);
    if (mapped) nodes.push(mapped);
  }
  return nodes;
}

function blockFromToken(token: Token): PMNode | null {
  switch (token.type) {
    case "space":
    case "def":
      return null;
    case "heading": {
      const t = token as Tokens.Heading;
      const level = Math.min(Math.max(t.depth, HEADING_MIN), HEADING_MAX);
      const content = inlineFromTokens(t.tokens ?? [], []);
      return content.length
        ? { type: "heading", attrs: { level }, content }
        : { type: "heading", attrs: { level } };
    }
    case "paragraph": {
      const t = token as Tokens.Paragraph;
      const image = singleImage(t.tokens ?? []);
      if (image) return imageNode(image);
      return paragraphFromInline(t.tokens ?? []);
    }
    case "text": {
      const t = token as Tokens.Text;
      const inline = t.tokens ?? [{ type: "text", text: t.text } as Token];
      return paragraphFromInline(inline);
    }
    case "blockquote": {
      const t = token as Tokens.Blockquote;
      const inner = blocksFromTokens(t.tokens ?? []);
      return {
        type: "blockquote",
        content: inner.length ? inner : [{ type: "paragraph" }],
      };
    }
    case "code": {
      const t = token as Tokens.Code;
      // StarterKit codeBlock keeps a single `language` attr (first word of the
      // info string); the body is one plain text node.
      const attrs = { language: t.lang ? t.lang.split(/\s+/)[0] || null : null };
      return t.text
        ? { type: "codeBlock", attrs, content: [{ type: "text", text: t.text }] }
        : { type: "codeBlock", attrs };
    }
    case "hr":
      return { type: "horizontalRule" };
    case "list":
      return listFromToken(token as Tokens.List);
    case "table":
      return tableFromToken(token as Tokens.Table);
    case "html": {
      const text = decodeEntities((token as Tokens.HTML).text ?? "").trim();
      // No HTML node in the schema — keep the raw text rather than drop it.
      return text ? { type: "paragraph", content: [{ type: "text", text }] } : null;
    }
    default: {
      const text = decodeEntities((token as { text?: string }).text ?? "").trim();
      return text ? { type: "paragraph", content: [{ type: "text", text }] } : null;
    }
  }
}

function paragraphFromInline(tokens: Token[]): PMNode {
  const content = inlineFromTokens(tokens, []);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function listFromToken(token: Tokens.List): PMNode {
  const items: PMNode[] = token.items.map((item) => {
    let content = blocksFromTokens(item.tokens ?? []);
    if (!content.length) content = [{ type: "paragraph" }];
    return { type: "listItem", content };
  });
  if (token.ordered) {
    const start = typeof token.start === "number" ? token.start : 1;
    return { type: "orderedList", attrs: { start }, content: items };
  }
  return { type: "bulletList", content: items };
}

function tableFromToken(token: Tokens.Table): PMNode {
  const headerRow: PMNode = {
    type: "tableRow",
    content: token.header.map((cell) => cellNode(cell, true)),
  };
  const bodyRows: PMNode[] = token.rows.map((row) => ({
    type: "tableRow",
    content: row.map((cell) => cellNode(cell, false)),
  }));
  return { type: "table", content: [headerRow, ...bodyRows] };
}

function cellNode(cell: Tokens.TableCell, header: boolean): PMNode {
  return {
    type: header ? "tableHeader" : "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [paragraphFromInline(cell.tokens ?? [])],
  };
}

function inlineFromTokens(tokens: Token[], marks: PMMark[]): PMNode[] {
  const out: PMNode[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if (t.tokens && t.tokens.length) {
          out.push(...inlineFromTokens(t.tokens, marks));
        } else {
          pushText(out, t.text, marks);
        }
        break;
      }
      case "escape":
        pushText(out, (token as Tokens.Escape).text, marks);
        break;
      case "strong":
        out.push(
          ...inlineFromTokens((token as Tokens.Strong).tokens, addMark(marks, "bold")),
        );
        break;
      case "em":
        out.push(
          ...inlineFromTokens((token as Tokens.Em).tokens, addMark(marks, "italic")),
        );
        break;
      case "del":
        out.push(
          ...inlineFromTokens((token as Tokens.Del).tokens, addMark(marks, "strike")),
        );
        break;
      case "codespan":
        pushText(out, (token as Tokens.Codespan).text, addMark(marks, "code"));
        break;
      case "link": {
        const t = token as Tokens.Link;
        out.push(
          ...inlineFromTokens(t.tokens, addMark(marks, "link", { href: t.href })),
        );
        break;
      }
      case "image": {
        // Image is a block node in the editor schema, so an inline image (mixed
        // with text) falls back to its alt text rather than producing an
        // invalid inline node.
        const t = token as Tokens.Image;
        pushText(out, t.text || t.title || t.href, marks);
        break;
      }
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "html":
        pushText(out, (token as Tokens.HTML).text, marks);
        break;
      default:
        pushText(out, (token as { text?: string }).text ?? "", marks);
    }
  }
  return out;
}

function addMark(
  marks: PMMark[],
  type: string,
  attrs?: Record<string, unknown>,
): PMMark[] {
  const next = marks.filter((m) => m.type !== type);
  next.push(attrs ? { type, attrs } : { type });
  return next;
}

function pushText(out: PMNode[], raw: string | undefined, marks: PMMark[]): void {
  const text = decodeEntities(raw ?? "");
  if (!text) return; // ProseMirror text nodes must be non-empty
  out.push(
    marks.length
      ? { type: "text", text, marks: marks.map((m) => ({ ...m })) }
      : { type: "text", text },
  );
}

function singleImage(tokens: Token[]): Tokens.Image | null {
  const meaningful = tokens.filter(
    (t) => !(t.type === "text" && !(t as Tokens.Text).text.trim()),
  );
  if (meaningful.length === 1 && meaningful[0].type === "image") {
    return meaningful[0] as Tokens.Image;
  }
  return null;
}

function imageNode(token: Tokens.Image): PMNode {
  return {
    type: "image",
    attrs: { src: token.href, alt: token.text || null, title: token.title || null },
  };
}

// marked's inline text can carry a few HTML entities; decode the common ones so
// they don't surface literally. `&amp;` is decoded last to avoid double-decoding.
function decodeEntities(value: string): string {
  if (!value || !value.includes("&")) return value;
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
