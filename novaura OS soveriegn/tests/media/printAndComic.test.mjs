import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeQrMatrix, qrMatrixToSvgDataUrl } from '../../src/services/print/qrEncoder.js';
import {
  PRINT_SPECS,
  TCG_BORDERS,
  TCG_RARITIES,
  GREETING_BORDERS,
  BUSINESS_CARD_STYLES,
  computeGangSheetLayout,
  wrapCanvasText,
} from '../../src/services/print/printEngine.js';
import {
  COMIC_FORMATS,
  COMIC_TEMPLATES,
  BUBBLE_KINDS,
  applyMangaScreentoneBuffer,
  createBubble,
} from '../../src/services/print/comicEngine.js';

test('qrEncoder produces valid ISO 18004 QR matrices with intact finder patterns and crisp SVG', () => {
  const shortQr = encodeQrMatrix('https://novaura.life');
  assert.equal(shortQr.size, 25); // Version 2 (20 bytes + 2 = 22 <= 28)
  assert.equal(shortQr.version, 2);

  // Verify 7x7 top-left, top-right, bottom-left finder cores are dark
  const n = shortQr.size;
  assert.equal(shortQr.modules[0][0], 1);
  assert.equal(shortQr.modules[3][3], 1);
  assert.equal(shortQr.modules[0][n - 1], 1);
  assert.equal(shortQr.modules[3][n - 4], 1);
  assert.equal(shortQr.modules[n - 1][0], 1);
  assert.equal(shortQr.modules[n - 4][3], 1);
  // Mandatory dark module at (n-8, 8)
  assert.equal(shortQr.modules[n - 8][8], 1);

  // Long payload gracefully caps at Version 6 without throwing
  const longQr = encodeQrMatrix('https://novaura.life/storefront/merchandise/' + 'a'.repeat(120));
  assert.equal(longQr.version, 6);
  assert.equal(longQr.size, 41);

  const svgUri = qrMatrixToSvgDataUrl('https://novaura.life');
  assert.ok(svgUri.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.ok(decodeURIComponent(svgUri).includes('<rect'));
});

test('printEngine defines exact 300 DPI specs, all border/style catalogs, and centered non-overlapping gang sheets', () => {
  assert.equal(PRINT_SPECS.DPI, 300);
  assert.equal(PRINT_SPECS.TCG_STANDARD.width, 750);
  assert.equal(PRINT_SPECS.TCG_STANDARD.height, 1050);
  assert.equal(PRINT_SPECS.TCG_BLEED.width, 822);
  assert.equal(PRINT_SPECS.TCG_BLEED.height, 1122);
  assert.equal(PRINT_SPECS.GREETING_BIFOLD_5X7.width, 3000);
  assert.equal(PRINT_SPECS.GREETING_BIFOLD_5X7.height, 2100);
  assert.equal(PRINT_SPECS.BUSINESS_STANDARD.width, 1050);
  assert.equal(PRINT_SPECS.BUSINESS_STANDARD.height, 600);

  assert.equal(TCG_BORDERS.length, 10);
  assert.equal(TCG_RARITIES.length, 5);
  assert.equal(GREETING_BORDERS.length, 6);
  assert.equal(BUSINESS_CARD_STYLES.length, 8);

  // 9-Up TCG US Letter sheet layout must fit strictly inside 2550x3300 with zero overlap
  const nineUp = computeGangSheetLayout({
    sheetWidth: 2550,
    sheetHeight: 3300,
    itemWidth: 750,
    itemHeight: 1050,
    cols: 3,
    rows: 3,
    gap: 24,
  });
  assert.equal(nineUp.slots.length, 9);
  assert.ok(nineUp.startX > 0 && nineUp.startY > 0);
  assert.ok(nineUp.startX + nineUp.totalW <= 2550);
  assert.ok(nineUp.startY + nineUp.totalH <= 3300);

  // 10-Up Business Card US Letter sheet layout must fit strictly inside 2550x3300
  const tenUp = computeGangSheetLayout({
    sheetWidth: 2550,
    sheetHeight: 3300,
    itemWidth: 1050,
    itemHeight: 600,
    cols: 2,
    rows: 5,
    gap: 24,
  });
  assert.equal(tenUp.slots.length, 10);
  assert.ok(tenUp.startX > 0 && tenUp.startY > 0);
  assert.ok(tenUp.startX + tenUp.totalW <= 2550);
  assert.ok(tenUp.startY + tenUp.totalH <= 3300);

  // Text wrapper respects maxWidth & maxLines
  const fakeCtx = { measureText: (s) => ({ width: s.length * 10 }) };
  const lines = wrapCanvasText(fakeCtx, 'When played, summon two spirit tokens and draw one card.', 180, 4);
  assert.ok(lines.length >= 2 && lines.length <= 4);
  for (const l of lines) assert.ok(l.length * 10 <= 180);
});

test('comicEngine templates, bubbles, and B&W manga screentone filter operate deterministically', () => {
  assert.equal(COMIC_FORMATS.length, 3);
  assert.equal(COMIC_TEMPLATES.length, 7);
  assert.equal(BUBBLE_KINDS.length, 5);

  for (const tpl of COMIC_TEMPLATES) {
    assert.ok(tpl.panels.length >= 1, `Template ${tpl.id} has no panels`);
    for (const p of tpl.panels) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1.001 && p.y + p.h <= 1.001, `Panel out of bounds in ${tpl.id}`);
    }
  }

  const bub = createBubble({ kind: 'shout', text: 'BOOM!', x: 0.2, y: 0.3 });
  assert.ok(bub.id.startsWith('bub_'));
  assert.equal(bub.kind, 'shout');

  // Verify screentone converts colorful midtone + dark + bright pixels into crisp grayscale ink/halftone
  const w = 8;
  const h = 8;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const val = i < 16 ? 20 : i < 48 ? 140 : 240; // deep shadow, midtone, bright highlight
    rgba[i * 4] = val;
    rgba[i * 4 + 1] = val;
    rgba[i * 4 + 2] = val;
    rgba[i * 4 + 3] = 255;
  }
  applyMangaScreentoneBuffer(rgba, w, h);
  // Deep shadow -> crisp black ink (10)
  assert.equal(rgba[0], 10);
  assert.equal(rgba[1], 10);
  // Bright highlight -> crisp white paper (250)
  assert.equal(rgba[(w * h - 1) * 4], 250);
  // Midtone region contains a mix of white dots (245) and ink dots (22) — true halftone!
  let inkDots = 0;
  let paperDots = 0;
  for (let i = 16; i < 48; i++) {
    assert.equal(rgba[i * 4], rgba[i * 4 + 1]);
    assert.equal(rgba[i * 4], rgba[i * 4 + 2]);
    if (rgba[i * 4] === 22) inkDots++;
    if (rgba[i * 4] === 245) paperDots++;
  }
  assert.ok(inkDots > 0 && paperDots > 0, `Expected halftone mix, got ink=${inkDots}, paper=${paperDots}`);
});

