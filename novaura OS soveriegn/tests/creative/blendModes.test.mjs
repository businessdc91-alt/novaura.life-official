// Blend modes: the 16 canvas modes, their Photoshop names, and the fallbacks for PSD-only modes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLEND_MODES, PSD_FALLBACKS, blendLabel, toPsdBlend, fromPsdBlend } from '../../src/creative/blendModes.js';

test('16 modes in order', () => {
  assert.deepEqual(BLEND_MODES.map(m => m.id), [
    'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
    'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
  ]);
  assert.equal(BLEND_MODES[0].label, 'Normal');
  assert.equal(BLEND_MODES[6].label, 'Color Dodge');
  assert.equal(BLEND_MODES[0].psd, 'normal');
  assert.equal(BLEND_MODES[8].psd, 'hard light');
});

test('every mode round-trips through its PSD name with psdBlend null', () => {
  for (const m of BLEND_MODES) {
    assert.deepEqual(fromPsdBlend(m.psd), { blend: m.id, psdBlend: null }, m.id);
    assert.equal(toPsdBlend({ blend: m.id, psdBlend: null }), m.psd);
  }
});

test('every fallback maps per the table and keeps psdBlend', () => {
  assert.deepEqual(PSD_FALLBACKS, {
    dissolve: 'source-over', 'linear burn': 'color-burn', 'darker color': 'darken', 'lighter color': 'lighten',
    'linear dodge': 'lighter', 'vivid light': 'hard-light', 'linear light': 'hard-light', 'pin light': 'hard-light',
    'hard mix': 'hard-light', subtract: 'difference', divide: 'color-dodge',
  });
  for (const [key, blend] of Object.entries(PSD_FALLBACKS)) assert.deepEqual(fromPsdBlend(key), { blend, psdBlend: key });
});

test('pass through (a group mode) and unknown modes read as Normal', () => {
  assert.deepEqual(fromPsdBlend('pass through'), { blend: 'source-over', psdBlend: null });
  assert.deepEqual(fromPsdBlend('something new'), { blend: 'source-over', psdBlend: 'something new' });
});

test('toPsdBlend prefers psdBlend', () => {
  assert.equal(toPsdBlend({ blend: 'lighter', psdBlend: 'linear dodge' }), 'linear dodge');
  assert.equal(toPsdBlend({ blend: 'hard-light', psdBlend: 'pin light' }), 'pin light');
});

test('blendLabel shows "Linear Dodge (PSD)" for a fallback layer', () => {
  assert.equal(blendLabel({ blend: 'lighter', psdBlend: 'linear dodge' }), 'Linear Dodge (PSD)');
  assert.equal(blendLabel({ blend: 'multiply', psdBlend: null }), 'Multiply');
});
