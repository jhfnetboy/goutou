import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { getRichTextExtensions } from "@/components/rich-text/extensions";
import { markdownToRichText } from "@/lib/markdown-to-rich-text";
import { parseRichText } from "@/lib/rich-text";

// Build the exact ProseMirror schema the editor + renderer use, so we can prove
// the converter's JSON is valid for them (nodeFromJSON throws on a bad node name
// or illegal nesting). getSchema + nodeFromJSON are DOM-free.
const schema = getSchema(getRichTextExtensions());

function expectValid(doc: unknown) {
  // Throws if any node/mark name is unknown or any content is illegally nested.
  expect(() => schema.nodeFromJSON(doc)).not.toThrow();
}

describe("markdownToRichText", () => {
  it("produces a schema-valid doc for a Jira-style description", () => {
    const md = [
      "**Slice 1 of original Phase 3.4.**",
      "",
      "## Scope",
      "",
      "* **Creditor master** with `is_in_einvoice = true`",
      "* see [LFMS-54](https://example.test/LFMS-54)",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    const doc = markdownToRichText(md);
    expectValid(doc);
  });

  it("renders headings as the schema's allowed levels (clamped to 2-3)", () => {
    const doc = markdownToRichText("# Title\n\n#### Deep");
    expectValid(doc);
    const headings = (doc.content ?? []).filter(
      (n): n is { type: string; attrs: { level: number } } =>
        (n as { type?: string }).type === "heading",
    );
    expect(headings.map((h) => h.attrs.level)).toEqual([2, 3]);
  });

  it("maps emphasis to bold/italic/strike/code marks", () => {
    const doc = markdownToRichText("**b** _i_ ~~s~~ `c`");
    expectValid(doc);
    const para = (doc.content ?? [])[0] as { content: { marks?: { type: string }[] }[] };
    const markTypes = para.content
      .flatMap((n) => n.marks ?? [])
      .map((m) => m.type);
    expect(markTypes).toEqual(
      expect.arrayContaining(["bold", "italic", "strike", "code"]),
    );
  });

  it("carries the href on link marks", () => {
    const doc = markdownToRichText("see [docs](https://example.test/x)");
    expectValid(doc);
    const para = (doc.content ?? [])[0] as {
      content: { marks?: { type: string; attrs?: { href?: string } }[] }[];
    };
    const link = para.content
      .flatMap((n) => n.marks ?? [])
      .find((m) => m.type === "link");
    expect(link?.attrs?.href).toBe("https://example.test/x");
  });

  it("builds an ordered list with a start attr", () => {
    const doc = markdownToRichText("3. third\n4. fourth");
    expectValid(doc);
    const list = (doc.content ?? [])[0] as { type: string; attrs: { start: number } };
    expect(list.type).toBe("orderedList");
    expect(list.attrs.start).toBe(3);
  });

  it("plain text without markdown becomes plain paragraphs", () => {
    const doc = markdownToRichText("just a line\n\nand another");
    expectValid(doc);
    expect((doc.content ?? []).every((n) => (n as { type: string }).type === "paragraph")).toBe(
      true,
    );
  });
});

describe("parseRichText", () => {
  it("returns editor JSON unchanged", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    expect(parseRichText(json)).toEqual(JSON.parse(json));
  });

  it("converts stored markdown (legacy/imported rows) on read", () => {
    const doc = parseRichText("## Heading\n\n* one\n* two");
    expectValid(doc);
    const types = (doc.content ?? []).map((n) => (n as { type: string }).type);
    expect(types).toContain("heading");
    expect(types).toContain("bulletList");
  });
});
