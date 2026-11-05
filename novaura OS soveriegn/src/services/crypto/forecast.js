/**
 * forecast.js — The rule-based forecast behind Crypto Pulse.
 *
 * No randomness: the same market snapshot always gives the same forecast.
 * 35% of the last 24 hours' move is assumed to carry on (scaled down for the
 * 1 hour horizon), unless RSI is stretched, where a pull back is expected.
 * RSI here is read from the position in the 24h range, so it is rough.
 */

export const HORIZONS = {
  '1h': { hours: 1, maxMovePct: 1.2 },
  '24h': { hours: 24, maxMovePct: 4 },
  '7d': { hours: 168, maxMovePct: 12 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const priceDecimals = (price) => (price > 10 ? 2 : 4);

export function indicators({ price, change24h, high24h, low24h }) {
  const range = high24h - low24h;
  const positionInRange = range > 0 ? (price - low24h) / range : 0.5;
  const rsi = clamp(Math.round(positionInRange * 60 + (change24h > 0 ? 20 : 0)), 10, 95);

  let signal = 'NEUTRAL';
  if (rsi < 35 && change24h > -5) signal = 'STRONG BUY (Oversold)';
  else if (rsi < 45) signal = 'ACCUMULATE';
  else if (rsi > 75) signal = 'STRONG SELL (Overbought)';
  else if (rsi > 60) signal = 'TAKE PROFIT';

  const d = priceDecimals(price);
  return {
    rsi,
    signal,
    volatility: price > 0 ? ((range / price) * 100).toFixed(2) + '%' : '0%',
    support: (low24h * 0.985).toFixed(d),
    resistance: (high24h * 1.015).toFixed(d),
  };
}

export function forecast(asset, horizon = '24h') {
  const h = HORIZONS[horizon] || HORIZONS['24h'];
  const tech = indicators(asset);
  let changePct = asset.change24h * 0.35 * Math.min(1, h.hours / 24);
  if (tech.rsi < 30) changePct = Math.abs(changePct) + 0.3 * h.maxMovePct;
  else if (tech.rsi > 70) changePct = -(Math.abs(changePct) + 0.3 * h.maxMovePct);
  changePct = parseFloat(clamp(changePct, -h.maxMovePct, h.maxMovePct).toFixed(2));

  return {
    direction: changePct >= 0 ? 'BULLISH' : 'BEARISH',
    changePct,
    predictedPrice: parseFloat((asset.price * (1 + changePct / 100)).toFixed(priceDecimals(asset.price))),
    hours: h.hours,
    tech,
  };
}

/** 0-100 from how close the forecast came, minus 35 when the direction was wrong. */
export function scoreOutcome({ entryPrice, predictedPrice }, actualPrice) {
  const priceDeltaPct = Math.abs((actualPrice - predictedPrice) / predictedPrice) * 100;
  const directionCorrect = (predictedPrice - entryPrice >= 0) === (actualPrice - entryPrice >= 0);
  let score = Math.max(0, 100 - priceDeltaPct * 5);
  if (!directionCorrect) score = Math.max(0, score - 35);
  return { directionCorrect, accuracyScore: Math.round(score) };
}

/** How often past forecasts for this asset and horizon got the direction right. */
export function trackRecord(predictions, symbol, horizon) {
  const done = (predictions || []).filter(p => p.status === 'evaluated' && p.symbol === symbol && p.targetHorizon === horizon);
  if (!done.length) return { evaluated: 0, hitRate: null };
  const right = done.filter(p => p.directionCorrect).length;
  return { evaluated: done.length, hitRate: Math.round((right / done.length) * 100) };
}
