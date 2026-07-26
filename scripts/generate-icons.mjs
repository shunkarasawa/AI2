/**
 * PWA 用の PNG アイコンを生成する。
 *
 * 画像ライブラリを入れずに済ませたいので、円を自前でラスタライズして
 * PNG のチャンクを組み立てている（zlib は Node 標準）。
 * 3x3 のスーパーサンプリングで縁を滑らかにしている。
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG_TOP = [0x16, 0x20, 0x2b];
const BG_BOTTOM = [0x0b, 0x0e, 0x13];
const ACCENT = [0x6f, 0xd0, 0xbe];
const ACCENT_LIGHT = [0xb7, 0xed, 0xe2];
const ACCENT_DEEP = [0x3d, 0x9d, 0x90];

const SS = 3;

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * アイコン 1 枚の色を返す。座標は 0〜1。
 * scale は中身の大きさ（maskable は角が切られるので小さくする）。
 */
function shade(x, y, scale) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy);

  // 背景。上から光が差すグラデーション
  let color = mix(BG_TOP, BG_BOTTOM, clamp01(Math.hypot(dx, y - 0.08) / 0.95));

  // 外周のリング
  const ringR = 0.4 * scale;
  const ringW = 0.012 * scale;
  const ring = 1 - smooth(ringW * 0.5, ringW * 0.5 + 0.004, Math.abs(r - ringR));
  color = mix(color, ACCENT, ring * 0.3);

  // 玉のまわりの光
  const glow = 1 - smooth(0, 0.34 * scale, r);
  color = mix(color, ACCENT, glow * glow * 0.34);

  // 玉本体。左上をわずかに明るくして立体感を出す
  const orbR = 0.235 * scale;
  const inside = 1 - smooth(orbR - 0.004, orbR + 0.004, r);
  if (inside > 0) {
    const lit = clamp01(Math.hypot(x - 0.5 + 0.06 * scale, y - 0.5 + 0.07 * scale) / (orbR * 1.5));
    const orb = lit < 0.46 ? mix(ACCENT_LIGHT, ACCENT, lit / 0.46) : mix(ACCENT, ACCENT_DEEP, (lit - 0.46) / 0.54);
    color = mix(color, orb, inside);
  }

  return color;
}

function render(size, scale) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const c = shade(x, y, scale);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

// ------------------------------------------------------------------ PNG 出力

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // 各行の先頭にフィルタ種別のバイトを足した生データ
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ 実行

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  // maskable は端まで塗って、中身を安全領域（内側 80%）に収める
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8 },
];

for (const { file, size, scale } of targets) {
  writeFileSync(join(OUT_DIR, file), png(size, render(size, scale)));
  console.log(`${file}  ${size}x${size}`);
}
