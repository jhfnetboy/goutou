import { describe, expect, it } from "vitest";

import {
  applyD1Id,
  extractD1Id,
  generateSecret,
  isEmail,
  isUrl,
  renderEnv,
} from "@/scripts/setup-lib";

// The wizard's input validators — guard that required prod fields reject junk.
describe("isEmail", () => {
  it("accepts valid addresses (returns null = no error)", () => {
    expect(isEmail("admin@admin.com")).toBeNull();
    expect(isEmail("a.b+c@example.co.uk")).toBeNull();
  });
  it("rejects invalid addresses", () => {
    expect(isEmail("not-an-email")).not.toBeNull();
    expect(isEmail("a@b")).not.toBeNull();
    expect(isEmail("")).not.toBeNull();
  });
});

describe("isUrl", () => {
  it("accepts absolute http/https URLs", () => {
    expect(isUrl("https://app.example.com")).toBeNull();
    expect(isUrl("http://localhost:3000")).toBeNull();
  });
  it("rejects relative or non-http URLs", () => {
    expect(isUrl("app.example.com")).not.toBeNull();
    expect(isUrl("ftp://example.com")).not.toBeNull();
    expect(isUrl("")).not.toBeNull();
  });
});

describe("generateSecret", () => {
  it("produces a long, unique base64 secret each call", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    // 32 random bytes → 44-char base64.
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe("change-me-in-production");
  });
});

// renderEnv backs every .env / .dev.vars the wizard writes.
describe("renderEnv", () => {
  it("formats KEY=value lines and trailing newline", () => {
    expect(renderEnv({ A: "1", B: "two" })).toBe("A=1\nB=two\n");
  });
  it("skips undefined and empty values (so optional fields are omitted)", () => {
    expect(renderEnv({ A: "1", B: undefined, C: "" })).toBe("A=1\n");
  });
});

// applyD1Id rewrites wrangler.jsonc after `wrangler d1 create`.
describe("applyD1Id", () => {
  const id = "12345678-1234-1234-1234-123456789abc";

  it("replaces both placeholder occurrences and reports changed", () => {
    const src = `"database_id": "<your-d1-database-id>",\n"preview_database_id": "<your-d1-database-id>"`;
    const { content, changed } = applyD1Id(src, id);
    expect(changed).toBe(true);
    expect(content).not.toContain("<your-d1-database-id>");
    expect(content.match(new RegExp(id, "g"))).toHaveLength(2);
  });

  it("reports unchanged when there is no placeholder (already filled)", () => {
    const src = `"database_id": "${id}"`;
    const { content, changed } = applyD1Id(src, id);
    expect(changed).toBe(false);
    expect(content).toBe(src);
  });
});

// extractD1Id parses `wrangler d1 create` output across formats/versions.
describe("extractD1Id", () => {
  const id = "12345678-1234-1234-1234-123456789abc";

  it("parses the TOML snippet (quoted, =)", () => {
    expect(extractD1Id(`database_id = "${id}"`)).toBe(id);
  });
  it("parses JSON output (quoted, :)", () => {
    expect(extractD1Id(`{ "database_id": "${id}" }`)).toBe(id);
  });
  it("parses an unquoted id", () => {
    expect(extractD1Id(`database_id = ${id}`)).toBe(id);
  });
  it("returns null when no database_id is present", () => {
    expect(extractD1Id("✅ Successfully created DB 'seeder'")).toBeNull();
    // An unrelated UUID without the database_id key must not match.
    expect(extractD1Id(`some_other_id = "${id}"`)).toBeNull();
  });
});
