// Generates PWA icons at public/icons/icon-{192,512}.png
// Uses only Node.js built-ins (zlib + fs) — no npm packages required.
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  if (data.length) data.copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
}

function buildPNG(w, h, pixelFn) {
  // Build raw scanlines (filter byte 0 = None, then RGB triplets)
  const lines = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y, w, h);
      row[1 + x * 3]     = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    lines.push(row);
  }
  const raw        = Buffer.concat(lines);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Pessaro icon pixel function ─────────────────────────────────────────────
// Dark background #06070d, teal X shape #3ECFC7
const BG  = [6,   7,  13];
const FG  = [62, 207, 199];

function pessaroPixel(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const pad  = w * 0.12;           // padding from edge
  const thick = Math.max(2, w * 0.10); // stroke thickness

  // Two diagonals forming an X
  // Top-left → bottom-right  (y = x)
  // Top-right → bottom-left  (y = -x + w)
  const nx = x - cx, ny = y - cy;  // centred coords
  const r  = w / 2 - pad;          // radius of X arm endpoint

  // Distance from each diagonal line
  const d1 = Math.abs(nx - ny) / Math.SQRT2;   // dist to y=x diagonal
  const d2 = Math.abs(nx + ny) / Math.SQRT2;   // dist to y=-x diagonal

  // Only draw within the arm extent (not past the tips)
  const arm1 = Math.abs(nx) <= r && Math.abs(ny) <= r;
  const arm2 = Math.abs(nx) <= r && Math.abs(ny) <= r;

  const onX = (d1 < thick / 2 && arm1) || (d2 < thick / 2 && arm2);

  // Soft anti-alias blend
  const t1 = Math.max(0, 1 - d1 / (thick / 2));
  const t2 = Math.max(0, 1 - d2 / (thick / 2));
  const t  = Math.min(1, (arm1 ? t1 : 0) + (arm2 ? t2 : 0));

  if (t <= 0) return BG;
  return [
    Math.round(BG[0] + (FG[0] - BG[0]) * t),
    Math.round(BG[1] + (FG[1] - BG[1]) * t),
    Math.round(BG[2] + (FG[2] - BG[2]) * t),
  ];
}

// ─── Generate & write ─────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png  = buildPNG(size, size, pessaroPixel);
  const dest = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`✓ ${dest}  (${png.length} bytes)`);
}
