import { describe, expect, it } from "vitest";

import { isUniqueConstraintError, resolveDueDate } from "@/lib/services/_shared";

// Guards the code-number race fix: only a genuine unique-index violation should
// trigger a retry; anything else must propagate.
describe("isUniqueConstraintError", () => {
  it("matches D1/SQLite unique-constraint messages", () => {
    expect(
      isUniqueConstraintError(
        new Error(
          "D1_ERROR: UNIQUE constraint failed: tasks.project_id, tasks.code_number: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isUniqueConstraintError(new Error("no such table: tasks"))).toBe(false);
    expect(isUniqueConstraintError(new Error("network down"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError("UNIQUE constraint failed")).toBe(true);
  });
});

// Guards the due-date contract: empty → null, valid ISO → Date, garbage → throw
// (so an AI client gets an error instead of a silently dropped field).
describe("resolveDueDate", () => {
  it("returns null for empty/undefined", () => {
    expect(resolveDueDate(undefined)).toBeNull();
    expect(resolveDueDate("")).toBeNull();
  });

  it("parses a valid ISO date", () => {
    const d = resolveDueDate("2026-06-04");
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2026);
  });

  it("throws on an unparseable non-empty value", () => {
    expect(() => resolveDueDate("not-a-date")).toThrow(/Invalid due date/);
  });
});
