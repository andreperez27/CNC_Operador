import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');

mkdirSync(OUT, { recursive: true });

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePng(size, path) {
  const px = Buffer.alloc(size * (size * 4 + 1));

  const inRounded = (x, y, s0, s1, r) => {
    if (x < s0 + r && y < s0 + r) { const dx = x - (s0 + r - 0.5), dy = y - (s0 + r - 0.5); return dx * dx + dy * dy <= r * r; }
    if (x > s1 - r && y < s0 + r) { const dx = x - (s1 - r + 0.5), dy = y - (s0 + r - 0.5); return dx * dx + dy * dy <= r * r; }
    if (x < s0 + r && y > s1 - r) { const dx = x - (s0 + r - 0.5), dy = y - (s1 - r + 0.5); return dx * dx + dy * dy <= r * r; }
    if (x > s1 - r && y > s1 - r) { const dx = x - (s1 - r + 0.5), dy = y - (s1 - r + 0.5); return dx * dx + dy * dy <= r * r; }
    return x >= s0 && x <= s1 && y >= s0 && y <= s1;
  };

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    px[row] = 0;
    const yr = y + 0.5;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const xr = x + 0.5;
      const corner = size * 0.12;
      let inside = true;
      if (xr < corner && yr < corner) inside = (xr - corner) * (xr - corner) + (yr - corner) * (yr - corner) <= corner * corner;
      else if (xr > size - corner && yr < corner) inside = (xr - (size - corner)) * (xr - (size - corner)) + (yr - corner) * (yr - corner) <= corner * corner;
      else if (xr < corner && yr > size - corner) inside = (xr - corner) * (xr - corner) + (yr - (size - corner)) * (yr - (size - corner)) <= corner * corner;
      else if (xr > size - corner && yr > size - corner) inside = (xr - (size - corner)) * (xr - (size - corner)) + (yr - (size - corner)) * (yr - (size - corner)) <= corner * corner;

      if (!inside) { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 0; continue; }

      const s0 = size * 0.22, s1 = size * 0.78, rr = size * 0.07;
      const inSquare = inRounded(xr, yr, s0, s1, rr);
      const bar = size * 0.10, bx0 = size * 0.5 - bar / 2, bx1 = size * 0.5 + bar / 2, by0 = size * 0.3, by1 = size * 0.7;
      const cross = (xr >= bx0 && xr <= bx1 && yr >= by0 && yr <= by1) || (yr >= bx0 && yr <= bx1 && xr >= by0 && xr <= by1);

      if (inSquare && !cross) { px[i] = 0xf0; px[i + 1] = 0xa5; px[i + 2] = 0x00; px[i + 3] = 255; }
      else { px[i] = 0x0a; px[i + 1] = 0x0c; px[i + 2] = 0x0f; px[i + 3] = 255; }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(px, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  writeFileSync(path, png);
  console.log(`${path} (${size}x${size}) - ${png.length} bytes`);
}

writePng(512, join(OUT, 'icon-512.png'));
writePng(192, join(OUT, 'icon-192.png'));
writePng(180, join(OUT, 'apple-touch-icon.png'));