/**
 * Generates placeholder PWA icons.
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(rowSize * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;

    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      const center = size / 2;
      const distance = Math.hypot(x - center, y - center);
      const inCircle = distance < size * 0.38;

      if (inCircle) {
        raw[pixelStart] = 29;
        raw[pixelStart + 1] = 155;
        raw[pixelStart + 2] = 240;
      } else {
        raw[pixelStart] = 15;
        raw[pixelStart + 1] = 20;
        raw[pixelStart + 2] = 25;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(iconsDir, { recursive: true });
writeFileSync(join(iconsDir, "icon-192.png"), createPng(192));
writeFileSync(join(iconsDir, "icon-512.png"), createPng(512));
writeFileSync(join(iconsDir, "notification-badge.png"), createPng(96));

console.log("Generated PWA icons in public/icons/");
