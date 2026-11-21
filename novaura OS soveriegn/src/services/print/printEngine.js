// printEngine.js — 300 DPI Print House Rendering Engine for Sovereign OS.
// Renders publication-grade printable PNGs and US Letter gang sheets with bleed & crop marks for:
//   1. TCG Trading Cards (2.5"x3.5" @ 300 DPI = 750x1050, +3mm bleed = 822x1122, 9-Up Letter = 2550x3300)
//   2. Mail-Ready 5"x7" Bi-Fold Greeting & Holiday Cards (10"x7" flat @ 300 DPI = 3000x2100)
//   3. Standard Business Cards (3.5"x2.0" @ 300 DPI = 1050x600, bleed = 1125x675, 10-Up Letter = 2550x3300)

import { drawQrOnCanvas } from './qrEncoder.js';

export const PRINT_SPECS = Object.freeze({
  DPI: 300,
  TCG_STANDARD: { width: 750, height: 1050, label: '2.5" × 3.5" Standard TCG (300 DPI)' },
  TCG_BLEED: { width: 822, height: 1122, bleedPx: 36, label: '2.5" × 3.5" + 3mm Bleed & Crop Marks' },
  TCG_SHEET_9UP: { width: 2550, height: 3300, cols: 3, rows: 3, label: '8.5" × 11" US Letter (9-Up Sheet)' },
  GREETING_BIFOLD_5X7: { width: 3000, height: 2100, label: '5" × 7" Bi-Fold Mail Card (A7 Envelope, 300 DPI)' },
  BUSINESS_STANDARD: { width: 1050, height: 600, label: '3.5" × 2.0" Standard Business Card (300 DPI)' },
  BUSINESS_BLEED: { width: 1125, height: 675, bleedPx: 37, label: '3.5" × 2.0" + 1/8" Bleed (300 DPI)' },
  BUSINESS_SHEET_10UP: { width: 2550, height: 3300, cols: 2, rows: 5, label: '8.5" × 11" US Letter (10-Up Cut Sheet)' },
});

export const TCG_RARITIES = [
  { id: 'common', label: 'COMMON', color: '#cbd5e1', ribbon: '#334155', text: '#f8fafc' },
  { id: 'rare', label: 'RARE', color: '#38bdf8', ribbon: '#0c4a6e', text: '#e0f2fe' },
  { id: 'epic', label: 'EPIC', color: '#c084fc', ribbon: '#4c1d95', text: '#f3e8ff' },
  { id: 'legendary', label: 'LEGENDARY', color: '#fbbf24', ribbon: '#78350f', text: '#fef3c7' },
  { id: 'mythic', label: 'MYTHIC CATALYST', color: '#f472b6', ribbon: '#581c87', text: '#fdf2f8' },
];

export const TCG_BORDERS = [
  {
    id: 'celestial_gold',
    name: 'Arcane Gold & Teal',
    motif: 'filigree',
    outerBg: ['#e7d9bc', '#c8b48a'],
    framePrimary: '#d4a14a',
    frameSecondary: '#8c5f1f',
    inlay: '#16697a',
    accent: '#38e8ff',
    titleBg: '#123845',
    titleText: '#fef3c7',
    boxBg: '#efe4cc',
    boxBorder: '#b88635',
    boxText: '#1f160c',
    statBg: '#173847',
    statText: '#fef9c3',
    gemColor: '#38e8ff',
  },
  {
    id: 'clockwork_artificer',
    name: 'Clockwork Brass & Cobalt',
    motif: 'clockwork',
    outerBg: ['#11161e', '#0a0d13'],
    framePrimary: '#c69952',
    frameSecondary: '#6b4c1e',
    inlay: '#163d66',
    accent: '#38bdf8',
    titleBg: '#d8c5a3',
    titleText: '#1e140a',
    boxBg: '#d9ccb2',
    boxBorder: '#8c6630',
    boxText: '#1a130b',
    statBg: '#1b3654',
    statText: '#f8fafc',
    gemColor: '#38bdf8',
  },
  {
    id: 'amethyst_twin',
    name: 'Celestial Amethyst',
    motif: 'gemstone',
    outerBg: ['#1a0b2e', '#0c0518'],
    framePrimary: '#d8b464',
    frameSecondary: '#6d4c17',
    inlay: '#5b21b6',
    accent: '#d8b4fe',
    titleBg: '#271248',
    titleText: '#fef08a',
    boxBg: '#24133d',
    boxBorder: '#c084fc',
    boxText: '#f5f3ff',
    statBg: '#3b1768',
    statText: '#ffffff',
    gemColor: '#c084fc',
  },
  {
    id: 'emerald_jewel',
    name: 'Gem Weaver Gold',
    motif: 'jewel',
    outerBg: ['#0d1814', '#060c0a'],
    framePrimary: '#deb459',
    frameSecondary: '#7a581c',
    inlay: '#0f5132',
    accent: '#34d399',
    titleBg: '#123e33',
    titleText: '#fef9c3',
    boxBg: '#ece0c5',
    boxBorder: '#b88635',
    boxText: '#1b140b',
    statBg: '#154d47',
    statText: '#ecfdf5',
    gemColor: '#f43f5e',
  },
  {
    id: 'silver_astral',
    name: 'Moonlit Silver Astral',
    motif: 'astral',
    outerBg: ['#0a1120', '#060913'],
    framePrimary: '#cbd5e1',
    frameSecondary: '#475569',
    inlay: '#1e3a5f',
    accent: '#60a5fa',
    titleBg: '#dbeafe',
    titleText: '#0f172a',
    boxBg: '#0f1d36',
    boxBorder: '#94a3b8',
    boxText: '#e2e8f0',
    statBg: '#132847',
    statText: '#f8fafc',
    gemColor: '#38bdf8',
  },
  {
    id: 'quantum_cyber',
    name: 'Vertex Cyber-Circuit',
    motif: 'cyber',
    outerBg: ['#061326', '#030a15'],
    framePrimary: '#b8d4e8',
    frameSecondary: '#3b6787',
    inlay: '#0369a1',
    accent: '#22d3ee',
    titleBg: '#0a2540',
    titleText: '#ffffff',
    boxBg: '#081b33',
    boxBorder: '#38bdf8',
    boxText: '#e0f2fe',
    statBg: '#0c3559',
    statText: '#ffffff',
    gemColor: '#22d3ee',
  },
  {
    id: 'tidal_ocean',
    name: 'Abyssal Tidal Coral',
    motif: 'tidal',
    outerBg: ['#071e36', '#041221'],
    framePrimary: '#2ea8c9',
    frameSecondary: '#0f4c75',
    inlay: '#155e75',
    accent: '#67e8f9',
    titleBg: '#0e365c',
    titleText: '#f0f9ff',
    boxBg: '#e2cfb0',
    boxBorder: '#1d7a99',
    boxText: '#111827',
    statBg: '#0c3b5e',
    statText: '#e0f2fe',
    gemColor: '#67e8f9',
  },
  {
    id: 'verdant_vine',
    name: 'Verdant Living Vine',
    motif: 'vine',
    outerBg: ['#0b1c12', '#06110b'],
    framePrimary: '#86a34a',
    frameSecondary: '#3d5a24',
    inlay: '#166534',
    accent: '#86efac',
    titleBg: '#274223',
    titleText: '#ecfccb',
    boxBg: '#c8d6a8',
    boxBorder: '#5c7c32',
    boxText: '#14220f',
    statBg: '#1e4221',
    statText: '#f7fee7',
    gemColor: '#4ade80',
  },
  {
    id: 'void_obsidian',
    name: 'Umbra Obsidian Void',
    motif: 'void',
    outerBg: ['#090611', '#040207'],
    framePrimary: '#4c3f63',
    frameSecondary: '#1c1528',
    inlay: '#3b0764',
    accent: '#c084fc',
    titleBg: '#140c21',
    titleText: '#f5d0fe',
    boxBg: '#120a1f',
    boxBorder: '#a855f7',
    boxText: '#f3e8ff',
    statBg: '#190d2b',
    statText: '#ffffff',
    gemColor: '#d946ef',
  },
  {
    id: 'holo_prismatic',
    name: 'Prismatic Secret Rare',
    motif: 'holo',
    outerBg: ['#0f172a', '#1e1b4b'],
    framePrimary: '#38bdf8',
    frameSecondary: '#c084fc',
    inlay: '#1e1b4b',
    accent: '#f472b6',
    titleBg: '#13162d',
    titleText: '#ffffff',
    boxBg: '#111827',
    boxBorder: '#67e8f9',
    boxText: '#f8fafc',
    statBg: '#1e1b4b',
    statText: '#fef08a',
    gemColor: '#f472b6',
  },
];

export const GREETING_BORDERS = [
  { id: 'gold_filigree', name: 'Royal Gold Filigree', bg: '#fffdf7', innerBg: '#fffcf4', primary: '#b4822c', secondary: '#e6c57a', text: '#1f1810', dark: false },
  { id: 'winter_frost', name: 'Winter Holiday Frost', bg: '#0c1d36', innerBg: '#f8fbff', primary: '#7dd3fc', secondary: '#e0f2fe', text: '#ffffff', dark: true },
  { id: 'holiday_crimson', name: 'Classic Holiday Crimson', bg: '#4c0d19', innerBg: '#fffaf5', primary: '#eab308', secondary: '#fef08a', text: '#fffbeb', dark: true },
  { id: 'botanical_floral', name: 'Spring Botanical Vine', bg: '#f5faf5', innerBg: '#fbfffb', primary: '#15803d', secondary: '#86efac', text: '#14291b', dark: false },
  { id: 'festive_ribbon', name: 'Celebration Confetti', bg: '#1e1136', innerBg: '#fdfaff', primary: '#f472b6', secondary: '#fbbf24', text: '#ffffff', dark: true },
  { id: 'cyber_holo', name: 'Sovereign Cyber Holo', bg: '#060d1f', innerBg: '#0b142a', primary: '#22d3ee', secondary: '#a855f7', text: '#f8fafc', dark: true },
];

export const BUSINESS_CARD_STYLES = [
  { id: 'cosmic', name: 'Cosmic Holo', bg: ['#090d16', '#1e1b4b', '#0369a1'], text: '#ffffff', accent: '#38bdf8', border: '#38bdf8', dark: true },
  { id: 'carbon', name: 'Executive Carbon', bg: ['#0f172a', '#1e293b', '#0f172a'], text: '#f8fafc', accent: '#94a3b8', border: '#64748b', dark: true },
  { id: 'gold', name: 'Obsidian Gold', bg: ['#09090b', '#18181b', '#27200e'], text: '#fef08a', accent: '#eab308', border: '#eab308', dark: true },
  { id: 'neon', name: 'Cyberpunk Neon', bg: ['#050510', '#2e0854', '#0f172a'], text: '#ffffff', accent: '#f43f5e', border: '#f43f5e', dark: true },
  { id: 'minimal', name: 'Clean Titanium', bg: ['#18181b', '#27272a', '#18181b'], text: '#f4f4f5', accent: '#22c55e', border: '#22c55e', dark: true },
  { id: 'ivory', name: 'Archival Ivory Press', bg: ['#fdfbf7', '#f5efe6', '#ede4d5'], text: '#18181b', accent: '#b45309', border: '#b45309', dark: false },
  { id: 'emerald', name: 'Emerald Sovereign', bg: ['#041f1a', '#064e3b', '#022c22'], text: '#ecfdf5', accent: '#34d399', border: '#34d399', dark: true },
  { id: 'prismatic', name: 'Holo Foil Prism', bg: ['#0f172a', '#31104a', '#0c4a6e'], text: '#ffffff', accent: '#f472b6', border: '#38bdf8', dark: true },
];

/** Load an image URL / Data URL safely for HTMLCanvasElement drawing. */
export function loadCanvasImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load artwork image for print rendering.'));
    img.src = url;
  });
}

/** Pure text wrapper returning array of lines fitting within maxWidth. */
export function wrapCanvasText(ctx, text, maxWidth, maxLines = 10) {
  const paragraphs = String(text || '').split(/\r?\n/);
  const lines = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
        if (lines.length >= maxLines) return lines;
      }
    }
    if (lines.length < maxLines) lines.push(current);
  }
  return lines.slice(0, maxLines);
}

/** Compute exact 9-Up (3x3 TCG) or 10-Up (2x5 Business) US Letter imposition grid geometry. */
export function computeGangSheetLayout({ sheetWidth, sheetHeight, itemWidth, itemHeight, cols, rows, gap = 18 }) {
  const totalW = cols * itemWidth + (cols - 1) * gap;
  const totalH = rows * itemHeight + (rows - 1) * gap;
  const startX = Math.round((sheetWidth - totalW) / 2);
  const startY = Math.round((sheetHeight - totalH) / 2);
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        index: r * cols + c,
        row: r,
        col: c,
        x: startX + c * (itemWidth + gap),
        y: startY + r * (itemHeight + gap),
        width: itemWidth,
        height: itemHeight,
      });
    }
  }
  return { startX, startY, totalW, totalH, gap, slots };
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawCropMarks(ctx, x, y, w, h, markLen = 22, offset = 6) {
  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * offset, cy);
    ctx.lineTo(cx + dx * (offset + markLen), cy);
    ctx.moveTo(cx, cy + dy * offset);
    ctx.lineTo(cx, cy + dy * (offset + markLen));
    ctx.stroke();
  }
  ctx.restore();
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img) return;
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawMotifOrnaments(ctx, border, x, y, w, h) {
  ctx.save();
  if (border.motif === 'cyber') {
    // PCB glowing circuit traces along sides
    ctx.strokeStyle = border.accent;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2.5;
    for (const side of [-1, 1]) {
      const bx = side < 0 ? x + 16 : x + w - 16;
      ctx.beginPath();
      ctx.moveTo(bx, y + 140);
      ctx.lineTo(bx, y + 360);
      ctx.lineTo(bx + side * -12, y + 380);
      ctx.lineTo(bx + side * -12, y + 660);
      ctx.lineTo(bx, y + 680);
      ctx.lineTo(bx, y + h - 140);
      ctx.stroke();
      for (const ny of [220, 440, 620, 790]) {
        ctx.beginPath();
        ctx.arc(bx, y + ny, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = border.accent;
        ctx.fill();
      }
    }
  } else if (border.motif === 'clockwork') {
    // Rivets & glowing conduits
    ctx.strokeStyle = border.accent;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.65;
    ctx.strokeRect(x + 22, y + 95, w - 44, h - 190);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = border.framePrimary;
    for (let ry = y + 150; ry < y + h - 140; ry += 90) {
      for (const rx of [x + 18, x + w - 18]) {
        ctx.beginPath();
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (border.motif === 'gemstone' || border.motif === 'jewel') {
    // Faceted gemstone studs along left & right rails
    const gemPalette = border.motif === 'jewel'
      ? ['#38bdf8', '#f43f5e', '#34d399', '#fbbf24', '#c084fc']
      : [border.gemColor, '#a855f7', '#e879f9'];
    let idx = 0;
    for (let gy = y + 170; gy < y + h - 190; gy += 110) {
      for (const gx of [x + 22, x + w - 22]) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 13);
        ctx.lineTo(-9, 0);
        ctx.closePath();
        ctx.fillStyle = gemPalette[idx % gemPalette.length];
        ctx.fill();
        ctx.strokeStyle = border.framePrimary;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
        idx++;
      }
    }
  } else if (border.motif === 'vine') {
    // Woven leaf accents along side rails
    ctx.strokeStyle = border.accent;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.7;
    for (let vy = y + 160; vy < y + h - 180; vy += 84) {
      for (const side of [-1, 1]) {
        const vx = side < 0 ? x + 22 : x + w - 22;
        ctx.beginPath();
        ctx.ellipse(vx, vy, 7, 15, side * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (border.motif === 'void') {
    // Neon violet plasma inner aura & dark corner spikes
    ctx.shadowColor = border.accent;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = border.accent;
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, x + 26, y + 26, w - 52, h - 52, 24);
    ctx.stroke();
  } else {
    // Sculpted filigree side diamonds & corner scrollwork
    ctx.fillStyle = border.gemColor;
    ctx.strokeStyle = border.framePrimary;
    ctx.lineWidth = 3;
    for (const gx of [x + 22, x + w - 22]) {
      ctx.beginPath();
      ctx.moveTo(gx, y + h * 0.47 - 16);
      ctx.lineTo(gx + 13, y + h * 0.47);
      ctx.lineTo(gx, y + h * 0.47 + 16);
      ctx.lineTo(gx - 13, y + h * 0.47);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHoloFoilOverlay(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Diagonal prismatic foil streaks
  const foil = ctx.createLinearGradient(x, y, x + w, y + h);
  foil.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
  foil.addColorStop(0.22, 'rgba(244, 114, 182, 0.22)');
  foil.addColorStop(0.45, 'rgba(250, 204, 21, 0.16)');
  foil.addColorStop(0.68, 'rgba(52, 211, 153, 0.22)');
  foil.addColorStop(0.88, 'rgba(168, 85, 247, 0.20)');
  foil.addColorStop(1, 'rgba(56, 189, 248, 0.10)');
  ctx.fillStyle = foil;
  ctx.fillRect(x, y, w, h);

  // Subtle holographic micro-lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 2;
  for (let d = -h; d < w + h; d += 26) {
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d - h * 0.45, y + h);
    ctx.stroke();
  }

  // Specular 4-point foil stars
  const stars = [
    [x + w * 0.18, y + h * 0.22, 16],
    [x + w * 0.82, y + h * 0.30, 20],
    [x + w * 0.68, y + h * 0.56, 14],
    [x + w * 0.28, y + h * 0.62, 12],
    [x + w * 0.52, y + h * 0.16, 13],
  ];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  for (const [sx, sy, sr] of stars) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - sr);
    ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + sr);
    ctx.quadraticCurveTo(sx, sy, sx - sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - sr);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Render a true 300 DPI TCG Trading Card onto a target HTMLCanvasElement.
 * Supports 750x1050 standard or 822x1122 with 3mm print bleed + corner crop marks.
 */
export async function renderTcgCardToCanvas(canvas, card, { bleed = false, cropMarks = true } = {}) {
  const trimW = PRINT_SPECS.TCG_STANDARD.width;
  const trimH = PRINT_SPECS.TCG_STANDARD.height;
  const pad = bleed ? PRINT_SPECS.TCG_BLEED.bleedPx : 0;
  const totalW = trimW + pad * 2;
  const totalH = trimH + pad * 2;

  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  const border = TCG_BORDERS.find(b => b.id === card.borderId) || TCG_BORDERS[0];
  const rarity = TCG_RARITIES.find(r => r.id === card.rarity) || TCG_RARITIES[3];

  // 1. Full-bleed outer background
  const outerGrad = ctx.createLinearGradient(0, 0, totalW, totalH);
  outerGrad.addColorStop(0, border.outerBg[0]);
  outerGrad.addColorStop(1, border.outerBg[1]);
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, totalW, totalH);

  // Translate to trim coordinate origin
  ctx.save();
  ctx.translate(pad, pad);

  // Full-art print-through mode (for pre-framed artwork imported directly from disk)
  if (card.fullArtDirect && card.artworkUrl) {
    const artImg = await loadCanvasImage(card.artworkUrl).catch(() => null);
    if (artImg) {
      drawRoundedRect(ctx, 0, 0, trimW, trimH, bleed ? 0 : 28);
      ctx.clip();
      drawCoverImage(ctx, artImg, -pad, -pad, totalW, totalH);
      if (card.holoFoil) drawHoloFoilOverlay(ctx, 0, 0, trimW, trimH);
    }
    ctx.restore();
    if (bleed && cropMarks) drawCropMarks(ctx, pad, pad, trimW, trimH);
    return canvas;
  }

  // 2. Outer metallic sculpted frame plate
  const frameGrad = ctx.createLinearGradient(0, 0, trimW, trimH);
  if (border.id === 'holo_prismatic') {
    frameGrad.addColorStop(0, '#38bdf8');
    frameGrad.addColorStop(0.25, '#c084fc');
    frameGrad.addColorStop(0.5, '#f472b6');
    frameGrad.addColorStop(0.75, '#facc15');
    frameGrad.addColorStop(1, '#34d399');
  } else {
    frameGrad.addColorStop(0, border.framePrimary);
    frameGrad.addColorStop(0.5, border.frameSecondary);
    frameGrad.addColorStop(1, border.framePrimary);
  }

  drawRoundedRect(ctx, 14, 14, trimW - 28, trimH - 28, 28);
  ctx.fillStyle = border.inlay;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  // Inner metallic bevel
  drawRoundedRect(ctx, 28, 28, trimW - 56, trimH - 56, 20);
  ctx.lineWidth = 4;
  ctx.strokeStyle = border.framePrimary;
  ctx.stroke();

  // 3. Artwork Window (generous hero frame like Pantheon/Catalyst cards)
  const artX = 44;
  const artY = 92;
  const artW = trimW - 88;
  const artH = 600;

  ctx.save();
  drawRoundedRect(ctx, artX, artY, artW, artH, 16);
  ctx.clip();

  // Rich fallback nebula gradient behind art
  const artBg = ctx.createRadialGradient(trimW / 2, artY + artH * 0.4, 40, trimW / 2, artY + artH * 0.5, 420);
  artBg.addColorStop(0, border.accent + '55');
  artBg.addColorStop(0.55, border.inlay);
  artBg.addColorStop(1, '#050814');
  ctx.fillStyle = artBg;
  ctx.fillRect(artX, artY, artW, artH);

  if (card.artworkUrl) {
    const artImg = await loadCanvasImage(card.artworkUrl).catch(() => null);
    if (artImg) drawCoverImage(ctx, artImg, artX, artY, artW, artH);
  } else {
    // Crisp emblem glyph when no artwork uploaded yet
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '180px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.art || '🐉', trimW / 2, artY + artH * 0.48);
  }

  // Subtle vignette along art edges for seamless frame integration
  const vig = ctx.createLinearGradient(0, artY + artH - 90, 0, artY + artH);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(artX, artY + artH - 90, artW, 90);
  ctx.restore();

  // Sculpted art window border
  drawRoundedRect(ctx, artX, artY, artW, artH, 16);
  ctx.lineWidth = 6;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  // 4. Motif Ornaments (gears, gemstones, PCB traces, vines, void glow)
  drawMotifOrnaments(ctx, border, 0, 0, trimW, trimH);

  // 5. Top Title Banner & Header
  const bannerX = 114;
  const bannerY = 30;
  const bannerW = trimW - 228;
  const bannerH = 62;
  drawRoundedRect(ctx, bannerX, bannerY, bannerW, bannerH, 14);
  ctx.fillStyle = border.titleBg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  // Auto-fit Card Name
  const cardName = String(card.name || 'Untitled Card').trim();
  let nameSize = 31;
  ctx.font = `bold ${nameSize}px Georgia, "Times New Roman", serif`;
  while (ctx.measureText(cardName).width > bannerW - 28 && nameSize > 18) {
    nameSize -= 1;
    ctx.font = `bold ${nameSize}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillStyle = border.titleText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cardName, trimW / 2, bannerY + bannerH / 2 + 1);

  // 6. Top-Left Mana / Energy Cost Medallion
  const costCx = 72;
  const costCy = 66;
  ctx.save();
  if (border.motif === 'cyber') {
    // Hexagonal quantum mana badge
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const hx = costCx + Math.cos(ang) * 42;
      const hy = costCy + Math.sin(ang) * 42;
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  } else {
    if (border.motif === 'clockwork') {
      // Gear teeth behind circle
      ctx.fillStyle = border.framePrimary;
      for (let t = 0; t < 12; t++) {
        ctx.save();
        ctx.translate(costCx, costCy);
        ctx.rotate((t * Math.PI) / 6);
        ctx.fillRect(-7, -48, 14, 14);
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(costCx, costCy, 40, 0, Math.PI * 2);
  }
  const costGrad = ctx.createRadialGradient(costCx - 10, costCy - 12, 4, costCx, costCy, 44);
  costGrad.addColorStop(0, border.accent);
  costGrad.addColorStop(1, border.statBg);
  ctx.fillStyle = costGrad;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(card.cost ?? 0), costCx, costCy + 2);
  ctx.restore();

  // 7. Top-Right Element & Type Medallion
  const sealCx = trimW - 72;
  const sealCy = 66;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sealCx, sealCy, 34, 0, Math.PI * 2);
  ctx.fillStyle = border.statBg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  // Inner faceted star gem
  ctx.beginPath();
  ctx.moveTo(sealCx, sealCy - 20);
  ctx.lineTo(sealCx + 15, sealCy);
  ctx.lineTo(sealCx, sealCy + 20);
  ctx.lineTo(sealCx - 15, sealCy);
  ctx.closePath();
  ctx.fillStyle = border.gemColor;
  ctx.fill();
  ctx.restore();

  // 8. Subtype / Element Divider Bar right below artwork
  const subBarY = artY + artH - 18;
  drawRoundedRect(ctx, 118, subBarY, trimW - 236, 36, 18);
  ctx.fillStyle = border.titleBg;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  const subtypeLine = [
    String(card.element || 'Arcane').toUpperCase(),
    String(card.type || 'Construct').toUpperCase(),
    card.subtype ? String(card.subtype).toUpperCase() : '',
  ].filter(Boolean).join('  •  ');
  ctx.fillStyle = border.titleText;
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(subtypeLine, trimW / 2, subBarY + 19);

  // 9. Ability, Reaction/Trigger & Lore Text Box
  const boxX = 52;
  const boxY = subBarY + 30;
  const boxW = trimW - 104;
  const boxH = 224;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 16);
  ctx.fillStyle = border.boxBg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = border.boxBorder;
  ctx.stroke();

  // Subtle inner frame accent
  drawRoundedRect(ctx, boxX + 8, boxY + 8, boxW - 16, boxH - 16, 10);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = border.framePrimary + '88';
  ctx.stroke();

  // Render structured Ability + Reaction + Lore cleanly
  const textPadX = boxX + 26;
  const textMaxW = boxW - 52;
  let cursorY = boxY + 34;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = border.boxText;

  if (card.ability && String(card.ability).trim()) {
    ctx.font = 'bold 21px Georgia, "Times New Roman", serif';
    const abilityLines = wrapCanvasText(ctx, `ABILITY: ${String(card.ability).trim()}`, textMaxW, 3);
    for (const line of abilityLines) {
      ctx.fillText(line, textPadX, cursorY);
      cursorY += 27;
    }
    cursorY += 6;
  }

  if (card.reaction && String(card.reaction).trim()) {
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = border.motif === 'cyber' || border.motif === 'void' || border.motif === 'amethyst_twin' || border.motif === 'silver_astral' || border.motif === 'holo'
      ? border.accent
      : '#9a3412';
    const reactionLines = wrapCanvasText(ctx, `⚡ REACTION: ${String(card.reaction).trim()}`, textMaxW, 2);
    for (const line of reactionLines) {
      ctx.fillText(line, textPadX, cursorY);
      cursorY += 24;
    }
    cursorY += 6;
  }

  if (card.flavor && String(card.flavor).trim()) {
    // Divider hairline
    ctx.strokeStyle = border.boxBorder + '70';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(textPadX, Math.min(cursorY, boxY + boxH - 54));
    ctx.lineTo(textPadX + textMaxW, Math.min(cursorY, boxY + boxH - 54));
    ctx.stroke();

    ctx.fillStyle = border.boxText;
    ctx.globalAlpha = 0.78;
    ctx.font = 'italic 17px Georgia, "Times New Roman", serif';
    const flavorLines = wrapCanvasText(ctx, `"${String(card.flavor).trim()}"`, textMaxW, 2);
    let fy = Math.min(cursorY + 8, boxY + boxH - 48);
    for (const line of flavorLines) {
      ctx.fillText(line, textPadX, fy);
      fy += 21;
    }
    ctx.globalAlpha = 1;
  }

  // 10. Bottom Rarity Ribbon + Collector Set Serial
  const ribW = 310;
  const ribH = 44;
  const ribX = (trimW - ribW) / 2;
  const ribY = trimH - 96;
  drawRoundedRect(ctx, ribX, ribY, ribW, ribH, 10);
  ctx.fillStyle = rarity.ribbon;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = frameGrad;
  ctx.stroke();

  ctx.fillStyle = rarity.text;
  ctx.font = 'bold 21px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rarity.label, trimW / 2, ribY + ribH / 2 + 1);

  // Set Code & Serial Number footer
  const serial = String(card.setCode || 'NVA-001/100').trim();
  ctx.fillStyle = border.titleText;
  ctx.globalAlpha = 0.8;
  ctx.font = 'bold 14px ui-monospace, Consolas, monospace';
  ctx.fillText(`${serial}  •  NOVAURA SOVEREIGN FORGE`, trimW / 2, trimH - 32);
  ctx.globalAlpha = 1;

  // 11. Bottom-Left ATK & Bottom-Right DEF Stat Medallions (for Construct / Catalyst / Creature cards)
  if (card.type !== 'spell' && card.type !== 'trap') {
    const drawStatBadge = (cx, cy, value, label, accentCol) => {
      ctx.save();
      if (border.motif === 'cyber') {
        // Diamond tactical stat node
        ctx.beginPath();
        ctx.moveTo(cx, cy - 48);
        ctx.lineTo(cx + 48, cy);
        ctx.lineTo(cx, cy + 48);
        ctx.lineTo(cx - 48, cy);
        ctx.closePath();
      } else {
        // Heraldic shield badge
        ctx.beginPath();
        ctx.moveTo(cx - 44, cy - 40);
        ctx.lineTo(cx + 44, cy - 40);
        ctx.lineTo(cx + 44, cy + 6);
        ctx.quadraticCurveTo(cx + 42, cy + 34, cx, cy + 50);
        ctx.quadraticCurveTo(cx - 42, cy + 34, cx - 44, cy + 6);
        ctx.closePath();
      }
      ctx.fillStyle = border.statBg;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = frameGrad;
      ctx.stroke();

      ctx.fillStyle = accentCol;
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy - 22);

      ctx.fillStyle = border.statText;
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText(String(value ?? 0), cx, cy + 12);
      ctx.restore();
    };

    drawStatBadge(86, trimH - 86, card.attack ?? 0, 'ATK', '#fb7185');
    drawStatBadge(trimW - 86, trimH - 86, card.defense ?? 0, 'DEF', '#34d399');
  }

  // 12. Optional Custom Transparent Frame Overlay PNG
  if (card.customFrameUrl) {
    const frameImg = await loadCanvasImage(card.customFrameUrl).catch(() => null);
    if (frameImg) ctx.drawImage(frameImg, 0, 0, trimW, trimH);
  }

  // 13. Optional Holographic Prismatic Foil Overlay
  if (card.holoFoil || border.id === 'holo_prismatic') {
    drawHoloFoilOverlay(ctx, 0, 0, trimW, trimH);
  }

  ctx.restore();

  // 14. Crop Marks in Bleed Margin
  if (bleed && cropMarks) {
    drawCropMarks(ctx, pad, pad, trimW, trimH);
  }

  return canvas;
}

/**
 * Render a 9-Up US Letter (2550x3300 @ 300 DPI) print sheet of TCG cards with precision cut marks.
 */
export async function renderTcgNineUpSheet(canvas, cardList) {
  const { width, height, cols, rows } = PRINT_SPECS.TCG_SHEET_9UP;
  const itemW = PRINT_SPECS.TCG_STANDARD.width;
  const itemH = PRINT_SPECS.TCG_STANDARD.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const layout = computeGangSheetLayout({
    sheetWidth: width,
    sheetHeight: height,
    itemWidth: itemW,
    itemHeight: itemH,
    cols,
    rows,
    gap: 24,
  });

  const list = Array.isArray(cardList) && cardList.length ? cardList : [];
  if (!list.length) return canvas;

  const offscreen = document.createElement('canvas');
  for (let i = 0; i < 9; i++) {
    const card = list[i % list.length];
    const slot = layout.slots[i];
    await renderTcgCardToCanvas(offscreen, card, { bleed: false, cropMarks: false });
    ctx.drawImage(offscreen, slot.x, slot.y, itemW, itemH);
    drawCropMarks(ctx, slot.x, slot.y, itemW, itemH, 14, 3);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '18px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NovAura Sovereign Print Sheet • 9-Up Standard 2.5" × 3.5" TCG (300 DPI, Print at 100% Scale)', width / 2, height - 24);
  return canvas;
}

// ── MAIL-READY 5"×7" BI-FOLD GREETING & HOLIDAY CARD RENDERER (300 DPI) ──────

function drawDecorativeGreetingBorder(ctx, style, x, y, w, h) {
  ctx.save();
  // Outer double-line border
  ctx.strokeStyle = style.primary;
  ctx.lineWidth = 8;
  ctx.strokeRect(x + 48, y + 48, w - 96, h - 96);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = style.secondary;
  ctx.strokeRect(x + 68, y + 68, w - 136, h - 136);

  // Corner rosettes / snowflakes / botanical accents
  const corners = [
    [x + 68, y + 68],
    [x + w - 68, y + 68],
    [x + 68, y + h - 68],
    [x + w - 68, y + h - 68],
  ];
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = style.primary;
    ctx.strokeStyle = style.secondary;
    ctx.lineWidth = 3;
    if (style.id === 'winter_frost') {
      for (let a = 0; a < 6; a++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(0, 28);
        ctx.stroke();
      }
    } else if (style.id === 'cyber_holo') {
      ctx.strokeRect(-22, -22, 44, 44);
      ctx.fillRect(-8, -8, 16, 16);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = style.bg;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Render a 300 DPI Mail-Ready 5"x7" Bi-Fold Greeting Card sheet (3000x2100 px).
 * side = 'exterior' (Left = Back Cover Colophon, Right = Front Cover)
 * side = 'interior' (Left = Optional Quote/Art, Right = Personal Greeting & Signature)
 */
export async function renderGreetingCardSheet(canvas, cardData, side = 'exterior') {
  const { width, height } = PRINT_SPECS.GREETING_BIFOLD_5X7;
  const halfW = width / 2; // 1500 px = 5.0"
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const border = GREETING_BORDERS.find(b => b.id === cardData.printBorderId) || GREETING_BORDERS[0];

  if (side === 'exterior') {
    // Full background
    ctx.fillStyle = border.bg;
    ctx.fillRect(0, 0, width, height);

    // LEFT HALF: Back Panel (return signature & colophon)
    drawDecorativeGreetingBorder(ctx, border, 0, 0, halfW, height);
    ctx.fillStyle = border.text;
    ctx.globalAlpha = 0.72;
    ctx.textAlign = 'center';
    ctx.font = 'italic 34px Georgia, serif';
    ctx.fillText(cardData.backColophon || 'Crafted with warmth & love', halfW / 2, height - 340);
    ctx.font = 'bold 26px ui-monospace, Consolas, monospace';
    ctx.fillStyle = border.primary;
    ctx.fillText(`FROM: ${cardData.senderName || 'NovAura Studio'}`, halfW / 2, height - 270);
    ctx.globalAlpha = 0.45;
    ctx.font = '20px ui-monospace, Consolas, monospace';
    ctx.fillStyle = border.text;
    ctx.fillText('5" × 7" ARCHIVAL PRINT EDITION  •  FITS A7 ENVELOPE', halfW / 2, height - 180);
    ctx.globalAlpha = 1;

    // RIGHT HALF: Front Cover
    drawDecorativeGreetingBorder(ctx, border, halfW, 0, halfW, height);

    const coverCenterX = halfW + halfW / 2;
    if (cardData.coverArtUrl) {
      const img = await loadCanvasImage(cardData.coverArtUrl).catch(() => null);
      if (img) {
        ctx.save();
        drawRoundedRect(ctx, halfW + 140, 180, halfW - 280, 1140, 28);
        ctx.clip();
        drawCoverImage(ctx, img, halfW + 140, 180, halfW - 280, 1140);
        ctx.restore();
        drawRoundedRect(ctx, halfW + 140, 180, halfW - 280, 1140, 28);
        ctx.lineWidth = 6;
        ctx.strokeStyle = border.primary;
        ctx.stroke();
      }
    } else {
      ctx.font = '240px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cardData.coverEmoji || '🎉', coverCenterX, 740);
    }

    // Cover Title & Recipient Line
    ctx.fillStyle = border.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let titlePx = 96;
    ctx.font = `bold ${titlePx}px Georgia, "Times New Roman", serif`;
    while (ctx.measureText(cardData.title || 'Happy Holidays').width > halfW - 240 && titlePx > 46) {
      titlePx -= 4;
      ctx.font = `bold ${titlePx}px Georgia, "Times New Roman", serif`;
    }
    ctx.fillText(cardData.title || 'Warmest Wishes', coverCenterX, 1520);

    if (cardData.recipientName) {
      ctx.fillStyle = border.primary;
      ctx.font = 'italic 48px Georgia, serif';
      ctx.fillText(`For ${cardData.recipientName}`, coverCenterX, 1660);
    }
  } else {
    // INTERIOR SHEET (Light archival paper tone for easy handwriting & crisp legibility)
    ctx.fillStyle = border.innerBg;
    ctx.fillRect(0, 0, width, height);
    const inkColor = border.id === 'cyber_holo' ? '#f8fafc' : '#1e1b18';

    drawDecorativeGreetingBorder(ctx, { ...border, bg: border.innerBg }, 0, 0, halfW, height);
    drawDecorativeGreetingBorder(ctx, { ...border, bg: border.innerBg }, halfW, 0, halfW, height);

    // Inside Left: Optional Dedication / Quote
    if (cardData.insideQuote) {
      ctx.fillStyle = inkColor;
      ctx.globalAlpha = 0.72;
      ctx.font = 'italic 42px Georgia, serif';
      ctx.textAlign = 'center';
      const qLines = wrapCanvasText(ctx, `"${cardData.insideQuote}"`, halfW - 320, 8);
      const startY = height / 2 - (qLines.length * 60) / 2;
      qLines.forEach((l, i) => ctx.fillText(l, halfW / 2, startY + i * 60));
      ctx.globalAlpha = 1;
    }

    // Inside Right: Main Greeting Message + Signature
    const rightCenterX = halfW + halfW / 2;
    ctx.fillStyle = border.primary;
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText(cardData.recipientName ? `Dear ${cardData.recipientName},` : (cardData.title || 'Warm Wishes,'), rightCenterX, 340);

    ctx.fillStyle = inkColor;
    ctx.font = '44px Georgia, "Times New Roman", serif';
    const msgLines = wrapCanvasText(ctx, cardData.message || '', halfW - 300, 14);
    let my = 520;
    for (const line of msgLines) {
      ctx.fillText(line, rightCenterX, my);
      my += 72;
    }

    ctx.fillStyle = border.primary;
    ctx.font = 'italic bold 52px Georgia, serif';
    ctx.fillText(cardData.signatureLine || `With warmth, ${cardData.senderName || 'Your Friend'}`, rightCenterX, height - 300);
  }

  // Subtle center fold score guide (top & bottom ticks only so it never mars printed artwork)
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(halfW, 0);
  ctx.lineTo(halfW, 70);
  ctx.moveTo(halfW, height - 70);
  ctx.lineTo(halfW, height);
  ctx.stroke();
  ctx.restore();

  return canvas;
}

// ── 300 DPI BUSINESS CARD RENDERER + 10-UP US LETTER CUT SHEET ───────────────

/**
 * Render Front or Back of a 300 DPI Business Card (1050x600 standard or 1125x675 w/ bleed).
 * Back side automatically bakes a genuinely scannable ISO QR Code!
 */
export async function renderBusinessCardSide(canvas, cardData, side = 'front', { bleed = false, cropMarks = true } = {}) {
  const trimW = PRINT_SPECS.BUSINESS_STANDARD.width;
  const trimH = PRINT_SPECS.BUSINESS_STANDARD.height;
  const pad = bleed ? PRINT_SPECS.BUSINESS_BLEED.bleedPx : 0;
  const totalW = trimW + pad * 2;
  const totalH = trimH + pad * 2;

  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  const style = BUSINESS_CARD_STYLES.find(s => s.id === cardData.templateId) || BUSINESS_CARD_STYLES[0];
  const bg = ctx.createLinearGradient(0, 0, totalW, totalH);
  bg.addColorStop(0, style.bg[0]);
  bg.addColorStop(0.5, style.bg[1]);
  bg.addColorStop(1, style.bg[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, totalW, totalH);

  ctx.save();
  ctx.translate(pad, pad);

  // Subtle architectural border accent
  ctx.strokeStyle = style.border + '99';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, trimW - 48, trimH - 48);

  // Decorative corner accents
  ctx.fillStyle = style.accent;
  ctx.fillRect(24, 24, 96, 6);
  ctx.fillRect(trimW - 120, trimH - 30, 96, 6);

  if (side === 'front') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = style.accent;
    ctx.font = 'bold 20px ui-monospace, Consolas, monospace';
    ctx.fillText(String(cardData.company || 'ORGANIZATION').toUpperCase(), 64, 62);

    ctx.fillStyle = style.text;
    ctx.font = 'bold 58px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(cardData.name || 'Full Name', 64, 114);

    ctx.fillStyle = style.accent;
    ctx.font = '600 28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(cardData.title || 'Title', 64, 188);

    // Optional uploaded Logo / Avatar on top-right
    if (cardData.logoUrl) {
      const logo = await loadCanvasImage(cardData.logoUrl).catch(() => null);
      if (logo) {
        ctx.save();
        drawRoundedRect(ctx, trimW - 220, 62, 150, 150, 22);
        ctx.clip();
        drawCoverImage(ctx, logo, trimW - 220, 62, 150, 150);
        ctx.restore();
        drawRoundedRect(ctx, trimW - 220, 62, 150, 150, 22);
        ctx.strokeStyle = style.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // Contact Details Block
    ctx.fillStyle = style.text;
    ctx.globalAlpha = 0.92;
    ctx.font = '26px ui-monospace, Consolas, monospace';
    let cy = 300;
    for (const line of [cardData.email, cardData.phone, cardData.website].filter(Boolean)) {
      ctx.fillText(line, 64, cy);
      cy += 42;
    }

    // Footer tagline divider
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, trimH - 102);
    ctx.lineTo(trimW - 64, trimH - 102);
    ctx.stroke();

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = style.text;
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText(cardData.tagline || '', 64, trimH - 84);
    ctx.globalAlpha = 1;
  } else {
    // BACK SIDE: Brand Header + Real Scannable QR Code!
    const qrPayload =
      cardData.qrValue ||
      cardData.website ||
      `MECARD:N:${cardData.name || ''};EMAIL:${cardData.email || ''};TEL:${cardData.phone || ''};;`;

    const qrSize = 276;
    const qrX = (trimW - qrSize) / 2;
    const qrY = 86;
    drawRoundedRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    drawQrOnCanvas(ctx, qrPayload, qrX, qrY, qrSize, { dark: '#0f172a', light: '#ffffff', quiet: 2 });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = style.text;
    ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(cardData.company || cardData.name || '').toUpperCase(), trimW / 2, 396);

    ctx.fillStyle = style.accent;
    ctx.font = '24px ui-monospace, Consolas, monospace';
    ctx.fillText(cardData.website || cardData.email || '', trimW / 2, 448);

    ctx.fillStyle = style.text;
    ctx.globalAlpha = 0.65;
    ctx.font = '20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Scan QR to connect', trimW / 2, 496);
    ctx.globalAlpha = 1;
  }

  if (style.id === 'prismatic') drawHoloFoilOverlay(ctx, 0, 0, trimW, trimH);

  ctx.restore();
  if (bleed && cropMarks) drawCropMarks(ctx, pad, pad, trimW, trimH);
  return canvas;
}

/**
 * Render a 10-Up US Letter (2550x3300 @ 300 DPI) business card print sheet (2 cols x 5 rows).
 */
export async function renderBusinessTenUpSheet(canvas, cardData, side = 'front') {
  const { width, height, cols, rows } = PRINT_SPECS.BUSINESS_SHEET_10UP;
  const itemW = PRINT_SPECS.BUSINESS_STANDARD.width;
  const itemH = PRINT_SPECS.BUSINESS_STANDARD.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const layout = computeGangSheetLayout({
    sheetWidth: width,
    sheetHeight: height,
    itemWidth: itemW,
    itemHeight: itemH,
    cols,
    rows,
    gap: 24,
  });

  const single = document.createElement('canvas');
  await renderBusinessCardSide(single, cardData, side, { bleed: false, cropMarks: false });

  for (const slot of layout.slots) {
    ctx.drawImage(single, slot.x, slot.y, itemW, itemH);
    drawCropMarks(ctx, slot.x, slot.y, itemW, itemH, 14, 3);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '18px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `NovAura Sovereign Print Sheet • 10-Up Standard 3.5" × 2.0" Business Card (${side.toUpperCase()}, 300 DPI, 100% Scale)`,
    width / 2,
    height - 24
  );
  return canvas;
}

/** Trigger browser PNG download from an HTMLCanvasElement. */
export function downloadCanvasPng(canvas, filename) {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return url;
}

