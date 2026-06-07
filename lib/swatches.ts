// Shared swatch palette. Used by task category color picker and project color picker.
// Grouped into 3 visual rows: dim (dark, header-safe), mid, and light (too pale for white text).

export type Swatch = { value: string; label: string };

export const CATEGORY_SWATCHES: readonly Swatch[] = [
  // Row 1 — dim
  { value: "#6b7077", label: "Slate dim" },
  { value: "#c14747", label: "Red dim" },
  { value: "#c4488a", label: "Pink dim" },
  { value: "#c97534", label: "Orange dim" },
  { value: "#b8851e", label: "Amber dim" },
  { value: "#c9a912", label: "Yellow dim" },
  { value: "#6da417", label: "Lime dim" },
  { value: "#1f7e34", label: "Emerald dim" },
  { value: "#0e8a90", label: "Teal dim" },
  { value: "#0291a1", label: "Cyan dim" },
  { value: "#4651b8", label: "Indigo dim" },
  { value: "#7240e5", label: "Violet dim" },
  // Row 2 — mid
  { value: "#8a8f98", label: "Storm" },
  { value: "#eb5757", label: "Red" },
  { value: "#e85aa0", label: "Pink" },
  { value: "#ef8b3a", label: "Orange" },
  { value: "#d99e25", label: "Amber" },
  { value: "#ebc417", label: "Yellow" },
  { value: "#87c61f", label: "Lime" },
  { value: "#27a644", label: "Emerald" },
  { value: "#15a8af", label: "Teal" },
  { value: "#02b8cc", label: "Cyan" },
  { value: "#5e6ad2", label: "Aether" },
  { value: "#8b5cf6", label: "Amethyst" },
  // Row 3 — light (too pale for white-on-color header text — excluded from project picker)
  { value: "#b1b5bb", label: "Slate light" },
  { value: "#f08585", label: "Red light" },
  { value: "#f08bc0", label: "Pink light" },
  { value: "#f4a972", label: "Orange light" },
  { value: "#e8b755", label: "Amber light" },
  { value: "#f4dc5e", label: "Yellow light" },
  { value: "#a8df53", label: "Lime light" },
  { value: "#5cc676", label: "Emerald light" },
  { value: "#4cc4ca", label: "Teal light" },
  { value: "#4cd0df", label: "Cyan light" },
  { value: "#8590e0", label: "Indigo light" },
  { value: "#ab87f7", label: "Violet light" },
] as const;

// Header-safe colors only (dim + mid rows). The light row is rejected because
// white header text would be illegible.
export const PROJECT_SWATCHES: readonly Swatch[] = CATEGORY_SWATCHES.slice(0, 24);

const PROJECT_SWATCH_SET = new Set(
  PROJECT_SWATCHES.map((swatch) => swatch.value.toLowerCase()),
);

export function isValidProjectColor(value: string): boolean {
  return PROJECT_SWATCH_SET.has(value.toLowerCase());
}
