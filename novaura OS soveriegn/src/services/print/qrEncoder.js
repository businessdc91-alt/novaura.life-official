// qrEncoder.js — Zero-dependency ISO/IEC 18004 QR Code encoder (Byte mode, ECC Level M, Versions 1-6).
// Produces genuinely scannable QR boolean matrices for Business Cards, Greeting Cards, and Print Sheets.

// GF(256) tables with primitive polynomial 0x11d
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

// Version specs for ECC Level M: { version, size, totalData, ecPerBlock, blocks: [count, dataPerBlock][], align }
const VERSION_M = [
  null,
  { v: 1, size: 21, totalData: 16, ecPerBlock: 10, blocks: [[1, 16]], align: [] },
  { v: 2, size: 25, totalData: 28, ecPerBlock: 16, blocks: [[1, 28]], align: [6, 18] },
  { v: 3, size: 29, totalData: 44, ecPerBlock: 26, blocks: [[1, 44]], align: [6, 22] },
  { v: 4, size: 33, totalData: 64, ecPerBlock: 18, blocks: [[2, 32]], align: [6, 26] },
  { v: 5, size: 37, totalData: 86, ecPerBlock: 24, blocks: [[2, 43]], align: [6, 30] },
  { v: 6, size: 41, totalData: 108, ecPerBlock: 16, blocks: [[4, 27]], align: [6, 34] },
];

// Precomputed 15-bit BCH format strings for ECC Level M (indicator 00) and masks 0..7
function computeFormatBits(mask) {
  const data = (0b00 << 3) | (mask & 0b111); // Level M = 00
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (rem & (1 << (i + 10))) rem ^= 0x537 << i;
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function encodeBytesToCodewords(bytes, spec) {
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  // Mode 0100 (Byte), 8-bit length (versions 1..9)
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const capacityBits = spec.totalData * 8;
  const term = Math.min(4, capacityBits - bits.length);
  pushBits(0, term);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let p = 0;
  while (codewords.length < spec.totalData) {
    codewords.push(padBytes[p & 1]);
    p++;
  }

  // Split blocks & compute Reed-Solomon EC
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (const [count, dataLen] of spec.blocks) {
    for (let b = 0; b < count; b++) {
      const slice = codewords.slice(offset, offset + dataLen);
      offset += dataLen;
      dataBlocks.push(slice);
      ecBlocks.push(Array.from(rsRemainder(slice, spec.ecPerBlock)));
    }
  }

  // Interleave data codewords then EC codewords
  const out = [];
  const maxData = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const blk of ecBlocks) out.push(blk[i]);
  }
  return out;
}

function buildMatrix(spec, finalCodewords, mask) {
  const n = spec.size;
  const modules = Array.from({ length: n }, () => new Uint8Array(n));
  const isFunc = Array.from({ length: n }, () => new Uint8Array(n));

  const setFunc = (r, c, dark) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    modules[r][c] = dark ? 1 : 0;
    isFunc[r][c] = 1;
  };

  // Finder patterns + separators
  const drawFinder = (tr, tc) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = tr + dr;
        const c = tc + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const dark =
          dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunc(r, c, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // Alignment patterns
  if (spec.align.length >= 2) {
    for (const r of spec.align) {
      for (const c of spec.align) {
        if ((r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setFunc(r + dr, c + dc, dark);
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Dark module & reserve format info areas
  setFunc(n - 8, 8, true);
  const fmtBits = computeFormatBits(mask);
  const writeFormat = () => {
    for (let i = 0; i <= 5; i++) setFunc(8, i, (fmtBits >>> (14 - i)) & 1);
    setFunc(8, 7, (fmtBits >>> 8) & 1);
    setFunc(8, 8, (fmtBits >>> 7) & 1);
    setFunc(7, 8, (fmtBits >>> 6) & 1);
    for (let i = 9; i < 15; i++) setFunc(14 - i, 8, (fmtBits >>> (14 - i)) & 1);

    for (let i = 0; i < 8; i++) setFunc(8, n - 1 - i, (fmtBits >>> i) & 1);
    for (let i = 8; i < 15; i++) setFunc(n - 15 + i, 8, (fmtBits >>> i) & 1);
  };
  writeFormat();

  // Place data bits zig-zag upward/downward from right
  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < n; step++) {
      const r = upward ? n - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx;
        if (isFunc[r][c]) continue;
        let bit = 0;
        if (bitIdx < totalBits) {
          bit = (finalCodewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
        }
        let flip = false;
        if (mask === 0) flip = (r + c) % 2 === 0;
        else if (mask === 1) flip = r % 2 === 0;
        else if (mask === 2) flip = c % 3 === 0;
        else if (mask === 3) flip = (r + c) % 3 === 0;
        else if (mask === 4) flip = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        else if (mask === 5) flip = ((r * c) % 2) + ((r * c) % 3) === 0;
        else if (mask === 6) flip = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        else if (mask === 7) flip = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
        modules[r][c] = flip ? bit ^ 1 : bit;
      }
    }
    upward = !upward;
  }

  return modules;
}

function penaltyScore(modules) {
  const n = modules.length;
  let penalty = 0;
  // Run length penalty rows & cols
  for (let r = 0; r < n; r++) {
    let runRow = 1;
    let runCol = 1;
    for (let c = 1; c < n; c++) {
      if (modules[r][c] === modules[r][c - 1]) {
        runRow++;
        if (runRow === 5) penalty += 3;
        else if (runRow > 5) penalty += 1;
      } else runRow = 1;

      if (modules[c][r] === modules[c - 1][r]) {
        runCol++;
        if (runCol === 5) penalty += 3;
        else if (runCol > 5) penalty += 1;
      } else runCol = 1;
    }
  }
  // 2x2 blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) penalty += 3;
    }
  }
  // Dark ratio balance
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += modules[r][c];
  const pct = Math.abs(Math.round((dark * 100) / (n * n)) - 50);
  penalty += Math.floor(pct / 5) * 10;
  return penalty;
}

/**
 * Encode text into a scannable QR code matrix `{ size, version, modules }`.
 * Automatically truncates gracefully to Version 6 byte capacity (106 bytes) if overlong.
 */
export function encodeQrMatrix(text) {
  const encoder = new TextEncoder();
  let bytes = Array.from(encoder.encode(String(text || 'https://novaura.life')));
  if (bytes.length > 106) bytes = bytes.slice(0, 106);

  // Overhead is 12 bits + 4 terminator bits = 2 bytes minimum
  const needed = bytes.length + 2;
  let spec = VERSION_M[6];
  for (let v = 1; v <= 6; v++) {
    if (VERSION_M[v].totalData >= needed) {
      spec = VERSION_M[v];
      break;
    }
  }

  const finalCodewords = encodeBytesToCodewords(bytes, spec);
  let bestMask = 0;
  let bestScore = Infinity;
  let bestModules = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(spec, finalCodewords, mask);
    const s = penaltyScore(m);
    if (s < bestScore) {
      bestScore = s;
      bestMask = mask;
      bestModules = m;
    }
  }

  return {
    version: spec.v,
    size: spec.size,
    mask: bestMask,
    modules: bestModules,
  };
}

/** Render a scannable QR code as a crisp inline SVG data URI. */
export function qrMatrixToSvgDataUrl(text, { dark = '#0f172a', light = '#ffffff', quiet = 3 } = {}) {
  const { size, modules } = encodeQrMatrix(text);
  const total = size + quiet * 2;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${light}"/><g fill="${dark}">${rects.join('')}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Draw a scannable QR code directly onto a 2D Canvas context at (x, y, pxSize). */
export function drawQrOnCanvas(ctx, text, x, y, pxSize, { dark = '#0f172a', light = '#ffffff', quiet = 3 } = {}) {
  const { size, modules } = encodeQrMatrix(text);
  const total = size + quiet * 2;
  const cell = pxSize / total;
  ctx.save();
  ctx.fillStyle = light;
  ctx.fillRect(x, y, pxSize, pxSize);
  ctx.fillStyle = dark;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        ctx.fillRect(
          Math.floor(x + (c + quiet) * cell),
          Math.floor(y + (r + quiet) * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }
  ctx.restore();
}

