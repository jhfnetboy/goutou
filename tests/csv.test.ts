import { describe, expect, it } from "vitest";

import { csvField, csvRow } from "@/lib/csv";

describe("csvField", () => {
  it("passes plain text through unquoted", () => {
    expect(csvField("hello")).toBe("hello");
  });

  it("returns empty string for null/undefined", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("quotes values with comma, quote, or newline (RFC 4180)", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formula-injection prefixes", () => {
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-1")).toBe("'-1");
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)");
    // Contains quotes + a comma, so it is prefixed AND RFC-4180 quoted.
    expect(csvField('=HYPERLINK("http://evil","x")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""x"")"',
    );
    // Whatever the quoting, the result must never begin with a bare formula char.
    expect(csvField('=HYPERLINK("http://evil","x")')).not.toMatch(/^[=+\-@]/);
  });

  it("both neutralizes and RFC-4180-quotes when needed", () => {
    expect(csvField("=A1,B1")).toBe("\"'=A1,B1\"");
  });

  it("does not mangle genuine negative numbers", () => {
    expect(csvField(-5)).toBe("-5");
  });
});

describe("csvRow", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["a", 1, null])).toBe("a,1,");
  });

  it("neutralizes a malicious cell inside a row", () => {
    expect(csvRow(["ok", "=cmd"])).toBe("ok,'=cmd");
  });
});
