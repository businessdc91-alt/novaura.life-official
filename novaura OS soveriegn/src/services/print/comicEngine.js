// comicEngine.js — 300 DPI Comic Book & Manga Page Designer Engine.
// Supports 7 multi-panel page templates (US Comic, Japanese RTL Manga, Webtoon, Cover Splash),
// interactive speech/thought/shout/narration/SFX overlays, real pixel-level B&W Manga Halftone/Screentone
// filter, and publication-grade 300 DPI PNG page export.

import { loadCanvasImage, wrapCanvasText } from './printEngine.js';

export const COMIC_FORMATS = [
  { id: 'us_comic', label: 'US Standard Comic (6.625" × 10.25")', width: 1656, height: 2562, dpiNote: '250-300 DPI Print' },
  { id: 'manga_tankobon', label: 'Japanese Manga Tankobon (5" × 7.5")', width: 1500, height: 2250, dpiNote: '300 DPI Print' },
  { id: 'webtoon_strip', label: 'Vertical Webtoon Scroll (800 × 2800)', width: 800, height: 2800, dpiNote: 'Digital HD' },
];

/**
 * Normalized panel rectangles { id, label, x, y, w, h } in [0..1] page space.
 */
export const COMIC_TEMPLATES = [
  {
    id: 'classic_4',
    name: 'Classic 4-Panel (2×2)',
    direction: 'ltr',
    panels: [
      { id: 'p1', label: 'Panel 1', x: 0.04, y: 0.04, w: 0.445, h: 0.445 },
      { id: 'p2', label: 'Panel 2', x: 0.515, y: 0.04, w: 0.445, h: 0.445 },
      { id: 'p3', label: 'Panel 3', x: 0.04, y: 0.515, w: 0.445, h: 0.445 },
      { id: 'p4', label: 'Panel 4', x: 0.515, y: 0.515, w: 0.445, h: 0.445 },
    ],
  },
  {
    id: 'action_5',
    name: 'Hero Splash + 4 Action Panels',
    direction: 'ltr',
    panels: [
      { id: 'p1', label: 'Top Splash', x: 0.04, y: 0.04, w: 0.92, h: 0.34 },
      { id: 'p2', label: 'Mid Left', x: 0.04, y: 0.405, w: 0.445, h: 0.265 },
      { id: 'p3', label: 'Mid Right', x: 0.515, y: 0.405, w: 0.445, h: 0.265 },
      { id: 'p4', label: 'Bottom Left', x: 0.04, y: 0.695, w: 0.58, h: 0.265 },
      { id: 'p5', label: 'Bottom Right', x: 0.645, y: 0.695, w: 0.315, h: 0.265 },
    ],
  },
  {
    id: 'classic_6',
    name: 'Classic 6-Panel Comic Grid',
    direction: 'ltr',
    panels: [
      { id: 'p1', label: 'Panel 1', x: 0.04, y: 0.04, w: 0.445, h: 0.29 },
      { id: 'p2', label: 'Panel 2', x: 0.515, y: 0.04, w: 0.445, h: 0.29 },
      { id: 'p3', label: 'Panel 3', x: 0.04, y: 0.355, w: 0.445, h: 0.29 },
      { id: 'p4', label: 'Panel 4', x: 0.515, y: 0.355, w: 0.445, h: 0.29 },
      { id: 'p5', label: 'Panel 5', x: 0.04, y: 0.67, w: 0.445, h: 0.29 },
      { id: 'p6', label: 'Panel 6', x: 0.515, y: 0.67, w: 0.445, h: 0.29 },
    ],
  },
  {
    id: 'manga_rtl_5',
    name: 'Manga 5-Panel (Right → Left)',
    direction: 'rtl',
    panels: [
      { id: 'p1', label: '1 (Top Right)', x: 0.42, y: 0.04, w: 0.54, h: 0.29 },
      { id: 'p2', label: '2 (Top Left)', x: 0.04, y: 0.04, w: 0.355, h: 0.29 },
      { id: 'p3', label: '3 (Wide Action)', x: 0.04, y: 0.355, w: 0.92, h: 0.26 },
      { id: 'p4', label: '4 (Bottom Right)', x: 0.52, y: 0.64, w: 0.44, h: 0.32 },
      { id: 'p5', label: '5 (Bottom Left)', x: 0.04, y: 0.64, w: 0.455, h: 0.32 },
    ],
  },
  {
    id: 'manga_splash_3',
    name: 'Manga Tall Splash + 2 Story',
    direction: 'rtl',
    panels: [
      { id: 'p1', label: '1 (Right Upper)', x: 0.54, y: 0.04, w: 0.42, h: 0.445 },
      { id: 'p2', label: '2 (Right Lower)', x: 0.54, y: 0.515, w: 0.42, h: 0.445 },
      { id: 'p3', label: '3 (Full-Height Left Splash)', x: 0.04, y: 0.04, w: 0.475, h: 0.92 },
    ],
  },
  {
    id: 'webtoon_4',
    name: 'Vertical Webtoon (4 Stacked)',
    direction: 'ltr',
    panels: [
      { id: 'p1', label: 'Beat 1', x: 0.05, y: 0.025, w: 0.9, h: 0.22 },
      { id: 'p2', label: 'Beat 2', x: 0.05, y: 0.265, w: 0.9, h: 0.22 },
      { id: 'p3', label: 'Beat 3', x: 0.05, y: 0.505, w: 0.9, h: 0.22 },
      { id: 'p4', label: 'Beat 4', x: 0.05, y: 0.745, w: 0.9, h: 0.23 },
    ],
  },
  {
    id: 'cover_splash',
    name: 'Full-Bleed Issue Cover',
    direction: 'ltr',
    panels: [
      { id: 'p1', label: 'Full Cover Splash', x: 0.03, y: 0.03, w: 0.94, h: 0.94 },
    ],
  },
];

export const BUBBLE_KINDS = [
  { id: 'speech', label: 'Speech Bubble' },
  { id: 'thought', label: 'Thought Cloud' },
  { id: 'shout', label: 'Action Shout' },
  { id: 'narration', label: 'Narration Box' },
  { id: 'sfx', label: 'SFX Sound Burst' },
];

// 4x4 Bayer threshold matrix for crisp authentic manga screentone dot halftone
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/**
 * Pure pixel-buffer B&W Manga Screentone / Halftone Ink filter (mutates Uint8ClampedArray RGBA).
 * Preserves sharp deep blacks & pure white highlights while converting midtones into crisp dot screentones.
 */
export function applyMangaScreentoneBuffer(rgba, width, height, { inkThreshold = 68, whiteThreshold = 212 } = {}) {
  for (let y = 0; y < height; y++) {
    const by = (y >> 1) & 3;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
      let out;
      if (lum <= inkThreshold) {
        out = 10;
      } else if (lum >= whiteThreshold) {
        out = 250;
      } else {
        const bx = (x >> 1) & 3;
        const threshold = ((BAYER_4X4[by * 4 + bx] + 0.5) / 16) * (whiteThreshold - inkThreshold) + inkThreshold;
        out = lum >= threshold ? 245 : 22;
      }
      rgba[idx] = out;
      rgba[idx + 1] = out;
      rgba[idx + 2] = out;
    }
  }
  return rgba;
}

/** Create a clean default bubble record in normalized page coordinates. */
export function createBubble({ kind = 'speech', text = 'New dialogue...', x = 0.25, y = 0.18, w = 0.28, h = 0.11, tail = 'bottom-left', fontSize = 30 } = {}) {
  return {
    id: `bub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    text,
    x,
    y,
    w,
    h,
    tail,
    fontSize,
  };
}

function drawBubbleOnCanvas(ctx, bubble, pageW, pageH) {
  const bx = bubble.x * pageW;
  const by = bubble.y * pageH;
  const bw = Math.max(120, bubble.w * pageW);
  const bh = Math.max(68, bubble.h * pageH);
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const fontPx = Math.max(18, Math.round((bubble.fontSize || 30) * (pageW / 1656)));

  ctx.save();
  if (bubble.kind === 'sfx') {
    ctx.translate(cx, cy);
    ctx.rotate(-0.12);
    ctx.font = `900 ${Math.round(fontPx * 2.1)}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(8, Math.round(fontPx * 0.35));
    ctx.strokeStyle = '#09090b';
    ctx.strokeText(String(bubble.text || 'KRAK!').toUpperCase(), 0, 0);
    const sfxGrad = ctx.createLinearGradient(0, -fontPx, 0, fontPx);
    sfxGrad.addColorStop(0, '#fef08a');
    sfxGrad.addColorStop(0.5, '#f97316');
    sfxGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = sfxGrad;
    ctx.fillText(String(bubble.text || 'KRAK!').toUpperCase(), 0, 0);
    ctx.restore();
    return;
  }

  if (bubble.kind === 'narration') {
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = Math.max(4, Math.round(pageW * 0.003));
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
  } else if (bubble.kind === 'shout') {
    // Spiky starburst bubble
    const spikes = 16;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i * Math.PI) / spikes;
      const rx = (i % 2 === 0 ? bw * 0.56 : bw * 0.42);
      const ry = (i % 2 === 0 ? bh * 0.58 : bh * 0.42);
      const px = cx + Math.cos(ang) * rx;
      const py = cy + Math.sin(ang) * ry;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(4, Math.round(pageW * 0.0035));
    ctx.strokeStyle = '#09090b';
    ctx.stroke();
  } else {
    // Speech or Thought oval
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = Math.max(4, Math.round(pageW * 0.003));

    if (bubble.kind === 'speech' && bubble.tail && bubble.tail !== 'none') {
      const tx = bubble.tail.includes('left') ? bx + bw * 0.22 : bx + bw * 0.78;
      const ty = bubble.tail.includes('top') ? by - bh * 0.34 : by + bh * 1.34;
      const baseLeft = cx - bw * 0.1;
      const baseRight = cx + bw * 0.1;
      const baseY = bubble.tail.includes('top') ? by + bh * 0.2 : by + bh * 0.8;
      ctx.beginPath();
      ctx.moveTo(baseLeft, baseY);
      ctx.lineTo(tx, ty);
      ctx.lineTo(baseRight, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (bubble.kind === 'thought' && bubble.tail && bubble.tail !== 'none') {
      const dirX = bubble.tail.includes('left') ? -1 : 1;
      const dirY = bubble.tail.includes('top') ? -1 : 1;
      for (const [step, rad] of [[1, 13], [2, 8]]) {
        ctx.beginPath();
        ctx.arc(cx + dirX * bw * 0.22 * step, cy + dirY * (bh * 0.52 + step * 22), rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Bubble typography
  ctx.fillStyle = '#09090b';
  ctx.font = bubble.kind === 'narration'
    ? `italic bold ${fontPx}px Georgia, serif`
    : `bold ${fontPx}px "Comic Sans MS", "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapCanvasText(ctx, String(bubble.text || '').toUpperCase(), bw * 0.78, 5);
  const lineH = fontPx * 1.18;
  const startY = cy - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, idx) => ctx.fillText(line, cx, startY + idx * lineH));
  ctx.restore();
}

/**
 * Render a full Comic Book or Manga Page to an HTMLCanvasElement at print resolution.
 */
export async function renderComicPageToCanvas(
  canvas,
  {
    formatId = 'us_comic',
    templateId = 'classic_4',
    pageTitle = '',
    issueLabel = '',
    panelImages = {},
    bubbles = [],
    mangaFilter = false,
    gutterColor = '#ffffff',
  }
) {
  const fmt = COMIC_FORMATS.find(f => f.id === formatId) || COMIC_FORMATS[0];
  const tpl = COMIC_TEMPLATES.find(t => t.id === templateId) || COMIC_TEMPLATES[0];

  canvas.width = fmt.width;
  canvas.height = fmt.height;
  const ctx = canvas.getContext('2d');

  // Paper / gutter background
  ctx.fillStyle = gutterColor;
  ctx.fillRect(0, 0, fmt.width, fmt.height);

  const borderPx = Math.max(5, Math.round(fmt.width * 0.0045));

  for (const panel of tpl.panels) {
    const px = Math.round(panel.x * fmt.width);
    const py = Math.round(panel.y * fmt.height);
    const pw = Math.round(panel.w * fmt.width);
    const ph = Math.round(panel.h * fmt.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();

    const imgUrl = panelImages[panel.id];
    if (imgUrl) {
      const img = await loadCanvasImage(imgUrl).catch(() => null);
      if (img) {
        const imgRatio = img.width / img.height;
        const boxRatio = pw / ph;
        let sx = 0; let sy = 0; let sw = img.width; let sh = img.height;
        if (imgRatio > boxRatio) {
          sw = img.height * boxRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / boxRatio;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, px, py, pw, ph);

        if (mangaFilter) {
          const imgData = ctx.getImageData(px, py, pw, ph);
          applyMangaScreentoneBuffer(imgData.data, pw, ph);
          ctx.putImageData(imgData, px, py);
        }
      }
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#64748b';
      ctx.font = `bold ${Math.round(fmt.width * 0.02)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(panel.label, px + pw / 2, py + ph / 2);
    }
    ctx.restore();

    // Crisp ink panel border
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = borderPx;
    ctx.strokeRect(px, py, pw, ph);
  }

  // Optional Comic Cover Masthead
  if (pageTitle && String(pageTitle).trim()) {
    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(fmt.width * 0.06, fmt.height * 0.045, fmt.width * 0.88, fmt.height * 0.075);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fef08a';
    ctx.font = `900 ${Math.round(fmt.width * 0.05)}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pageTitle).toUpperCase(), fmt.width / 2, fmt.height * 0.082);
    if (issueLabel) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(fmt.width * 0.016)}px ui-monospace, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(issueLabel, fmt.width * 0.92, fmt.height * 0.062);
    }
    ctx.restore();
  }

  // Speech bubbles, narration & SFX overlays
  for (const b of bubbles) {
    drawBubbleOnCanvas(ctx, b, fmt.width, fmt.height);
  }

  return canvas;
}

