// One-shot converter: favicon.png at repo root -> public/favicon.ico.
// Wraps a 256x256 PNG in the ICO container (modern ICO format permits
// embedded PNG data, which all current browsers honor). The root layout
// serves the bundled favicon from /favicon.ico (i.e. public/favicon.ico).

import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "favicon.png";
const DST = "public/favicon.ico";
const SIZE = 256;

const png = await sharp(SRC)
  .resize(SIZE, SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry[0] = 0; // width: 0 == 256
entry[1] = 0; // height: 0 == 256
entry[2] = 0;
entry[3] = 0;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);

writeFileSync(DST, Buffer.concat([dir, entry, png]));
console.log(`Wrote ${DST} (${png.length + 22} bytes, embedded 256x256 PNG)`);
