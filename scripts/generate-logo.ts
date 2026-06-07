/**
 * Seeder logo generator.
 *
 *   Mark: an outlined document with a sprouting plant inside — a seed breaking
 *         into growth. Rendered in brand emerald.
 *   Wordmark: "Seeder" hand-drawn as 5×7 pixel-art letters (CLI terminal vibe).
 *
 * Outputs:
 *   public/seeder-mark.svg       — 1×1 mark, currentColor (source of truth)
 *   public/seeder-logo.svg       — horizontal lockup, currentColor
 *   public/dark-logo.png         — horizontal lockup, emerald, 2x retina
 *   public/light-logo.png        — same as dark (emerald reads on both themes)
 *   favicon.png                  — 256×256 mark for the ico pipeline
 */

import { writeFileSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#10b981";

// ─── Mark: outlined document with a plant growing inside (viewBox 0 0 64 64) ──
const MARK_PATHS = `
  <!-- Document body with diagonal-cut top-right corner -->
  <path d="M16 8h22l14 14v30a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
        stroke="currentColor" stroke-width="3" stroke-linejoin="round" fill="none"/>
  <!-- Folded-corner crease showing the dog-ear -->
  <path d="M38 8v8a6 6 0 0 0 6 6h8"
        stroke="currentColor" stroke-width="3" stroke-linejoin="round" fill="none"/>

  <!-- Plant stem rising from the page floor -->
  <path d="M32 52V36" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Left leaf -->
  <path d="M32 40 C 24 40, 18 36, 16 28 C 24 30, 30 34, 32 40 Z" fill="currentColor"/>
  <!-- Right leaf -->
  <path d="M32 36 C 40 36, 46 32, 48 24 C 40 26, 34 30, 32 36 Z" fill="currentColor"/>
`;

const markSvg = (color = "currentColor") =>
  `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: ${color}">
  ${MARK_PATHS.trim()}
</svg>`;

// ─── Pixel-art letters (5 cols × 8 rows, descenders in row 7) ────────────────
const LETTERS: Record<string, string[]> = {
  S: [
    ".XXXX",
    "X....",
    "X....",
    ".XXX.",
    "....X",
    "....X",
    "XXXX.",
    ".....",
  ],
  e: [
    ".....",
    ".....",
    ".XXX.",
    "X...X",
    "XXXXX",
    "X....",
    ".XXX.",
    ".....",
  ],
  d: [
    "....X",
    "....X",
    ".XXXX",
    "X...X",
    "X...X",
    "X...X",
    ".XXXX",
    ".....",
  ],
  r: [
    ".....",
    ".....",
    "X.XXX",
    "XX...",
    "X....",
    "X....",
    "X....",
    ".....",
  ],
};

const TEXT = "Seeder";
const PIXEL = 4;
const LETTER_W = 5;
const LETTER_H = 8;
const LETTER_GAP = 1; // 1 blank pixel column between letters

const textCols = TEXT.length * LETTER_W + (TEXT.length - 1) * LETTER_GAP;
const TEXT_W = textCols * PIXEL;
const TEXT_H = LETTER_H * PIXEL;

const MARK_SIZE = 52; // displayed mark size in the lockup
const GAP = 14;

const LOGO_W = MARK_SIZE + GAP + TEXT_W;
const LOGO_H = MARK_SIZE;

const textOriginX = MARK_SIZE + GAP;
const textOriginY = Math.round((LOGO_H - TEXT_H) / 2);

function pixelRects(originX: number, originY: number): string {
  const rects: string[] = [];
  for (let i = 0; i < TEXT.length; i++) {
    const bm = LETTERS[TEXT[i]];
    const lx = originX + i * (LETTER_W + LETTER_GAP) * PIXEL;
    for (let r = 0; r < LETTER_H; r++) {
      for (let c = 0; c < LETTER_W; c++) {
        if (bm[r][c] === "X") {
          const x = lx + c * PIXEL;
          const y = originY + r * PIXEL;
          rects.push(
            `<rect x="${x}" y="${y}" width="${PIXEL}" height="${PIXEL}"/>`
          );
        }
      }
    }
  }
  return rects.join("");
}

const horizontalSvg = (color = "currentColor") => {
  const markScale = MARK_SIZE / 64;
  return `<svg width="${LOGO_W}" height="${LOGO_H}" viewBox="0 0 ${LOGO_W} ${LOGO_H}" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: ${color}" shape-rendering="crispEdges">
  <g transform="translate(0 ${(LOGO_H - MARK_SIZE) / 2}) scale(${markScale})">
    ${MARK_PATHS.trim()}
  </g>
  <g fill="currentColor">
    ${pixelRects(textOriginX, textOriginY)}
  </g>
</svg>`;
};

// ─── Write SVG sources ───────────────────────────────────────────────────────
writeFileSync("public/seeder-mark.svg", markSvg() + "\n");
writeFileSync("public/seeder-logo.svg", horizontalSvg() + "\n");

// ─── Rasterize PNGs ──────────────────────────────────────────────────────────
const horizontalEmerald = Buffer.from(horizontalSvg(BRAND));
const markEmerald = Buffer.from(markSvg(BRAND));

// Display size is h-7 (28px) in sidebar; render at 96px tall = ~3.4x retina.
const PNG_HEIGHT = 96;
const PNG_WIDTH = Math.round((LOGO_W / LOGO_H) * PNG_HEIGHT);

await sharp(horizontalEmerald)
  .resize(PNG_WIDTH, PNG_HEIGHT, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile("public/dark-logo.png");

await sharp(horizontalEmerald)
  .resize(PNG_WIDTH, PNG_HEIGHT, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile("public/light-logo.png");

// Favicon source: 256×256 mark only, transparent bg.
await sharp(markEmerald)
  .resize(256, 256, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile("favicon.png");

// PWA app icons: emerald mark, square, transparent — referenced by app/manifest.ts.
for (const size of [192, 512]) {
  await sharp(markEmerald)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`public/seeder-icon-${size}.png`);
}

console.log(
  `Generated:
  public/seeder-mark.svg
  public/seeder-logo.svg
  public/dark-logo.png       (${PNG_WIDTH}×${PNG_HEIGHT})
  public/light-logo.png      (${PNG_WIDTH}×${PNG_HEIGHT})
  public/seeder-icon-192.png (192×192)
  public/seeder-icon-512.png (512×512)
  favicon.png                (256×256, next: bun run scripts/png-to-ico.ts)`
);
