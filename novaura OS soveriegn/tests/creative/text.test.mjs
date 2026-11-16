// Text layout: wrapping, long words, uppercase, line breaks, and font fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutText, resolveFont, fontCss, FONT_CHOICES, TEXT_DEFAULTS } from '../../src/creative/text.js';

const measure = text => text.length * 10;
const layer = (extra = {}) => ({ ...TEXT_DEFAULTS, text: 'Text', fontSize: 20, lineHeight: 1.5, ...extra });
const texts = l => l.lines.map(x => x.text);

test('text defaults', () => {
  assert.deepEqual(TEXT_DEFAULTS, {
    text: 'Text', fontFamily: 'Inter', fontSize: 64, fontWeight: 400, italic: false, colour: '#000000', align: 'left',
    lineHeight: 1.2, strokeColour: '#000000', strokeWidth: 0, uppercase: false, x: 0, y: 0, rotation: 0, wrapWidth: null,
  });
  assert.ok(FONT_CHOICES.includes('Impact') && FONT_CHOICES.includes('Inter'));
});

test('wraps on spaces at wrapWidth 50', () => {
  const l = layoutText(layer({ text: 'aa bb cc', wrapWidth: 50 }), measure);
  assert.deepEqual(texts(l), ['aa bb', 'cc']);
  assert.equal(l.width, 50);
  assert.equal(l.lineHeightPx, 30);
  assert.deepEqual(l.lines.map(x => x.y), [0, 30]);
  assert.equal(l.height, 60);
});

test('breaks a long word', () => {
  assert.deepEqual(texts(layoutText(layer({ text: 'abcdefghij', wrapWidth: 30 }), measure)), ['abc', 'def', 'ghi', 'j']);
  assert.deepEqual(texts(layoutText(layer({ text: 'xy abcdefgh', wrapWidth: 40 }), measure)), ['xy', 'abcd', 'efgh']);
});

test('uppercase applies', () => {
  assert.deepEqual(texts(layoutText(layer({ text: 'Hello you', uppercase: true }), measure)), ['HELLO YOU']);
});

test('explicit newlines start new lines', () => {
  assert.deepEqual(texts(layoutText(layer({ text: 'one\ntwo\n\nfour' }), measure)), ['one', 'two', '', 'four']);
});

test('no wrapWidth → one line per paragraph', () => {
  const l = layoutText(layer({ text: 'a long line that never wraps\nnext' }), measure);
  assert.deepEqual(texts(l), ['a long line that never wraps', 'next']);
  assert.equal(l.width, 280);
});

test('resolveFont falls back to Inter', () => {
  assert.deepEqual(resolveFont('Impact', () => true), { family: 'Impact', fallback: false });
  assert.deepEqual(resolveFont('Nonexistent Sans', () => false), { family: 'Inter', fallback: true });
});

test('fontCss', () => {
  assert.equal(fontCss(layer({ fontFamily: 'Impact', fontWeight: 700, italic: true, fontSize: 30 })), 'italic 700 30px "Impact", "Inter", sans-serif');
  assert.equal(fontCss(layer({ fontFamily: 'Georgia' })), '400 20px "Georgia", "Inter", sans-serif');
});
