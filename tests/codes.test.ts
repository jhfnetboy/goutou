import { describe, expect, it } from "vitest";

import {
  deriveSlug,
  formatRequestCode,
  formatTaskCode,
  isValidSlug,
  normalizeSlugInput,
} from "@/lib/codes";

describe("deriveSlug", () => {
  it("uses initials for multi-word names", () => {
    expect(deriveSlug("Law Firm Management System")).toBe("LFMS");
  });

  it("falls back to the first chars for single-word names", () => {
    expect(deriveSlug("Marketing")).toBe("MARK");
  });

  it("returns empty for blank input", () => {
    expect(deriveSlug("   ")).toBe("");
  });

  it("caps at the max length", () => {
    expect(deriveSlug("A B C D E F G H I J K L").length).toBeLessThanOrEqual(10);
  });

  it("returns '' rather than an invalid 1-char slug for single-char names", () => {
    expect(deriveSlug("X")).toBe("");
  });

  it("only ever suggests a slug that is empty or valid", () => {
    const names = [
      "X",
      "Marketing",
      "Law Firm Management System",
      "A",
      "AB",
      "Project 2026",
      "你好 world",
      "a-b-c",
      "  spaced  out  name  ",
      "QA",
    ];
    for (const name of names) {
      const slug = deriveSlug(name);
      expect(slug === "" || isValidSlug(slug)).toBe(true);
    }
  });
});

describe("normalizeSlugInput", () => {
  it("uppercases and strips non-alphanumerics", () => {
    expect(normalizeSlugInput(" my-proj_1 ")).toBe("MYPROJ1");
  });
});

describe("isValidSlug", () => {
  it("accepts 2-10 uppercase alphanumerics", () => {
    expect(isValidSlug("AB")).toBe(true);
    expect(isValidSlug("PROJECT123")).toBe(true);
  });

  it("rejects short, long, lowercase, or symbol slugs", () => {
    expect(isValidSlug("A")).toBe(false);
    expect(isValidSlug("TOOLONGSLUG1")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("AB-CD")).toBe(false);
  });
});

describe("formatTaskCode / formatRequestCode", () => {
  it("formats codes when slug and number are present", () => {
    expect(formatTaskCode("ACME", 12)).toBe("ACME-12");
    expect(formatRequestCode("ACME", 3)).toBe("ACME-CR-3");
  });

  it("returns null when slug or number is missing", () => {
    expect(formatTaskCode(null, 12)).toBeNull();
    expect(formatTaskCode("ACME", null)).toBeNull();
    expect(formatRequestCode(null, null)).toBeNull();
  });
});
