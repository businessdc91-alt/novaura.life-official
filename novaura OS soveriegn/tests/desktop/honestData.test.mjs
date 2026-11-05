// Crypto Pulse forecasts and Nova Phone numbers: no randomness, no shared defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast, scoreOutcome, trackRecord } from '../../src/services/crypto/forecast.js';
import { derivePhoneNumber, chooseMyNumber, samePhoneNumber, isSharedPlaceholder } from '../../src/services/phoneNumbers.js';

const btc = { price: 68000, change24h: 2, high24h: 69000, low24h: 66000 };

test('the same snapshot always gives the same forecast', () => {
  const runs = Array.from({ length: 20 }, () => forecast(btc, '24h'));
  for (const r of runs) assert.deepEqual(r, runs[0]);
  assert.equal(runs[0].changePct, 0.7); // 35% of +2%
  assert.equal(runs[0].direction, 'BULLISH');
});

test('the 1 hour horizon scales momentum down and every horizon is capped', () => {
  assert.equal(forecast(btc, '1h').changePct, 0.03);
  const wild = { price: 100, change24h: 80, high24h: 101, low24h: 20 };
  assert.ok(Math.abs(forecast(wild, '24h').changePct) <= 4);
  assert.ok(Math.abs(forecast(wild, '7d').changePct) <= 12);
});

test('stretched RSI flips momentum to a pull back', () => {
  const top = { price: 69000, change24h: 6, high24h: 69000, low24h: 60000 }; // at the top of the range, rising
  assert.equal(forecast(top, '24h').direction, 'BEARISH');
});

test('a forecast is scored on closeness, with a penalty for the wrong direction', () => {
  const pred = { entryPrice: 100, predictedPrice: 102 };
  assert.deepEqual(scoreOutcome(pred, 102), { directionCorrect: true, accuracyScore: 100 });
  const wrong = scoreOutcome(pred, 98);
  assert.equal(wrong.directionCorrect, false);
  assert.ok(wrong.accuracyScore < 65);
});

test('track record counts only scored forecasts for that asset and horizon', () => {
  const list = [
    { status: 'evaluated', symbol: 'BTCUSDT', targetHorizon: '24h', directionCorrect: true },
    { status: 'evaluated', symbol: 'BTCUSDT', targetHorizon: '24h', directionCorrect: false },
    { status: 'evaluated', symbol: 'BTCUSDT', targetHorizon: '1h', directionCorrect: true },
    { status: 'pending', symbol: 'BTCUSDT', targetHorizon: '24h' },
  ];
  assert.deepEqual(trackRecord(list, 'BTCUSDT', '24h'), { evaluated: 2, hitRate: 50 });
  assert.deepEqual(trackRecord(list, 'ETHUSDT', '24h'), { evaluated: 0, hitRate: null });
});

test('a default number comes from the node key, so two nodes differ', () => {
  const a = derivePhoneNumber('0x' + 'ab'.repeat(32));
  const b = derivePhoneNumber('cd'.repeat(32));
  assert.match(a, /^\+1-700-\d{4}-\d{4}$/);
  assert.notEqual(a, b);
  assert.equal(derivePhoneNumber('0x_nova_1234'), '');
});

test('old shared defaults count as no number chosen', () => {
  const pub = 'ab'.repeat(32);
  for (const old of ['+1-700-NOVA-0001', '+1-700-NOVA-8821', '+1-700-NOVA-NOVA', '+1-700-NOVA-1700']) {
    assert.ok(isSharedPlaceholder(old));
    assert.equal(chooseMyNumber({ chosen: [old], pubHex: pub }), derivePhoneNumber(pub));
  }
  assert.equal(chooseMyNumber({ chosen: ['', '+1-700-NOVA-4821'], pubHex: pub }), '+1-700-NOVA-4821');
});

test('numbers match however they were typed', () => {
  assert.ok(samePhoneNumber('+1-700-NOVA-4821', '1 700 nova 4821'));
  assert.ok(!samePhoneNumber('+1-700-NOVA-4821', '+1-700-NOVA-4822'));
  assert.ok(!samePhoneNumber('', ''));
});
