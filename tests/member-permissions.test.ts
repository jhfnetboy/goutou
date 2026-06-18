import { describe, expect, it } from "vitest";

import {
  PROJECT_CAPABILITIES,
  resolveMemberPermissions,
} from "@/lib/project-capabilities";

// The per-project "Member Access" RBAC. These guard the defaults (which must
// reproduce today's rules) and the override-resolution that authz + the save
// route rely on.
describe("PROJECT_CAPABILITIES defaults", () => {
  it("defaults the Work group ON and the Manage group OFF for Members", () => {
    for (const c of PROJECT_CAPABILITIES) {
      if (c.group === "Work") expect(c.defaultForMember, c.key).toBe(true);
      if (c.group === "Manage") expect(c.defaultForMember, c.key).toBe(false);
    }
  });

  it("has unique keys", () => {
    const keys = PROJECT_CAPABILITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("resolveMemberPermissions", () => {
  it("returns the code defaults when unset (null/undefined/empty)", () => {
    for (const raw of [null, undefined, ""]) {
      const r = resolveMemberPermissions(raw);
      expect(r["task.write"]).toBe(true); // Work default ON
      expect(r["note.write"]).toBe(false); // Manage default OFF
      expect(Object.keys(r).length).toBe(PROJECT_CAPABILITIES.length);
    }
  });

  it("applies known boolean overrides over the defaults", () => {
    const r = resolveMemberPermissions(
      JSON.stringify({ "note.write": true, "task.write": false }),
    );
    expect(r["note.write"]).toBe(true); // flipped on
    expect(r["task.write"]).toBe(false); // flipped off
    expect(r["comment.write"]).toBe(true); // untouched → default
  });

  it("ignores unknown keys and non-boolean values", () => {
    const r = resolveMemberPermissions(
      JSON.stringify({ "bogus.key": true, "task.write": "yes", "status.publish": 1 }),
    );
    expect(r).not.toHaveProperty("bogus.key");
    expect(r["task.write"]).toBe(true); // bad type ignored → default ON
    expect(r["status.publish"]).toBe(false); // bad type ignored → default OFF
  });

  it("falls back to defaults on malformed JSON", () => {
    const r = resolveMemberPermissions("{not json");
    expect(r["task.write"]).toBe(true);
    expect(r["note.write"]).toBe(false);
  });
});
