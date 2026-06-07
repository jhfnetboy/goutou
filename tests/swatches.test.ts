import { describe, expect, it } from "vitest";

import { isValidProjectColor, PROJECT_SWATCHES } from "@/lib/swatches";

describe("isValidProjectColor", () => {
  it("accepts a known project swatch, case-insensitively", () => {
    expect(isValidProjectColor("#6b7077")).toBe(true);
    expect(isValidProjectColor("#6B7077")).toBe(true);
  });

  it("accepts every project swatch value", () => {
    for (const swatch of PROJECT_SWATCHES) {
      expect(isValidProjectColor(swatch.value)).toBe(true);
    }
  });

  it("rejects unknown colors and light-row swatches", () => {
    expect(isValidProjectColor("#000000")).toBe(false);
    expect(isValidProjectColor("")).toBe(false);
    // Light-row swatch — present in CATEGORY_SWATCHES but excluded from the
    // project picker.
    expect(isValidProjectColor("#b1b5bb")).toBe(false);
  });
});
