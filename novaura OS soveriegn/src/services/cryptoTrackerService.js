/**
 * cryptoTrackerService.js — Crypto Pulse: live prices, NFT floors, forecasts
 * with a real track record, and paper trading.
 *
 * 1. Prices: Binance's public 24h ticker (no key). When Binance cannot be
 *    reached, the last prices this PC actually fetched are shown, marked stale
 *    with their time. Nothing is ever made up.
 * 2. NFT floors: CoinGecko's public NFT endpoint (no key, rate limited, so the
 *    collections are fetched one at a time and cached for 10 minutes).
 * 3. Forecasts: rule-based (services/crypto/forecast.js), only from live
 *    prices, with optional AI commentary. A forecast is scored against
 *    Binance's price at its target time, so the hit rate is real.
 * 4. Paper trading at live prices only.
 */

import { db } from '../database/sovereignDatabase.js';
import { dualInference } from './dualInferenceService.js';
import { forecast, indicators, scoreOutcome, trackRecord } from './crypto/forecast.js';

export const CRYPTO_ASSETS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', base: 'BTC' },
  { symbol: 'ETHUSDT', name: 'Ethereum', base: 'ETH' },
  { symbol: 'SOLUSDT', name: 'Solana', base: 'SOL' },
  { symbol: 'BNBUSDT', name: 'BNB', base: 'BNB' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE' },
  { symbol: 'ADAUSDT', name: 'Cardano', base: 'ADA' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', base: 'AVAX' },
  { symbol: 'LINKUSDT', name: 'Chainlink', base: 'LINK' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', base: 'NEAR' },
  { symbol: 'SUIUSDT', name: 'Sui Network', base: 'SUI' },
];

// CoinGecko NFT ids.
export const NFT_COLLECTIONS = [
  { id: 'cryptopunks', name: 'CryptoPunks', chain: 'Ethereum' },
  { id: 'bored-ape-yacht-club', name: 'Bored Ape Yacht Club', chain: 'Ethereum' },
  { id: 'pudgy-penguins', name: 'Pudgy Penguins', chain: 'Ethereum' },
  { id: 'milady-maker', name: 'Milady Maker', chain: 'Ethereum' },
  { id: 'mad-lads', name: 'Mad Lads', chain: 'Solana' },
  { id: 'azuki', name: 'Azuki', chain: 'Ethereum' },
];

// binance.com refuses US connections (HTTP 451); Binance.US serves the same API there.
const BINANCE_HOSTS = [
  { base: 'https://api.binance.com/api/v3', label: 'Binance' },
  { base: 'https://api.binance.us/api/v3', label: 'Binance.US' },
];
const LAST_PRICES_KEY = 'novapulse-last-live-prices';
const NFT_CACHE_KEY = 'novapulse-nft-floors';
const PORTFOLIO_KEY = 'novaura_paper_trading_portfolio';
const LIVE_MAX_AGE_MS = 2 * 60_000;
const NFT_CACHE_MS = 10 * 60_000;
const NFT_SPACING_MS = 2500;
const MAX_EVALUATIONS_PER_PASS = 20;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function formatVolume(quoteVolume) {
  const v = parseFloat(quoteVolume) || 0;
  return v > 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(1)}M`;
}

class CryptoTrackerService {
  constructor() {
    this.priceCache = new Map();
    this.subscribers = new Set();
    // live: prices came from Binance just now; at: when the shown prices were fetched.
    this.status = { live: false, at: null, error: null, source: null };
    this._nftRun = null;
    this._host = null; // the Binance host that answered last
  }

  /** GET a Binance API path from whichever host answers here, the last good one first. */
  async _binance(path) {
    const hosts = this._host ? [this._host, ...BINANCE_HOSTS.filter(h => h !== this._host)] : BINANCE_HOSTS;
    let lastError = null;
    for (const host of hosts) {
      try {
        const res = await fetch(`${host.base}${path}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`${host.label} answered HTTP ${res.status}${res.status === 451 ? ' (not available in this country)' : ''}`);
        const data = await res.json();
        this._host = host;
        return { data, source: host.label };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Binance could not be reached');
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(data) {
    for (const sub of this.subscribers) {
      try { sub(data); } catch (e) { console.error('Crypto subscription err:', e); }
    }
  }

  /** The last prices this PC fetched, marked stale, or [] when it never fetched any. */
  lastKnownPrices() {
    const snap = readJson(LAST_PRICES_KEY);
    return Array.isArray(snap?.assets) ? snap.assets.map(a => ({ ...a, source: 'stale' })) : [];
  }

  async fetchLivePrices() {
    const symbols = CRYPTO_ASSETS.map(a => a.symbol);
    let error = null;
    try {
      const { data: raw, source } = await this._binance(`/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);
      if (!Array.isArray(raw)) throw new Error('Binance returned no prices');
      const now = Date.now();
      const assets = CRYPTO_ASSETS.map(meta => {
        const item = raw.find(r => r.symbol === meta.symbol);
        if (!item) return null;
        return {
          ...meta,
          price: parseFloat(item.lastPrice),
          change24h: parseFloat(item.priceChangePercent),
          high24h: parseFloat(item.highPrice),
          low24h: parseFloat(item.lowPrice),
          volume: formatVolume(item.quoteVolume),
          timestamp: now,
          source: 'live',
        };
      }).filter(a => a && Number.isFinite(a.price));
      if (!assets.length) throw new Error('Binance returned no prices');

      assets.forEach(a => this.priceCache.set(a.symbol, a));
      writeJson(LAST_PRICES_KEY, { at: now, assets, source });
      this.status = { live: true, at: now, error: null, source };
      this.notify(assets);
      return assets;
    } catch (err) {
      error = err.message;
      console.warn('[CryptoPulse] Binance unreachable:', err.message);
    }

    const stale = this.lastKnownPrices();
    stale.forEach(a => this.priceCache.set(a.symbol, a));
    const snap = readJson(LAST_PRICES_KEY);
    this.status = { live: false, at: snap?.at || null, error, source: snap?.source || null };
    this.notify(stale);
    return stale;
  }

  /** A price fetched from Binance within the last 2 minutes, or null. */
  livePrice(symbol) {
    const a = this.priceCache.get(symbol);
    return a?.source === 'live' && Date.now() - a.timestamp < LIVE_MAX_AGE_MS ? a : null;
  }

  calculateIndicators(currentPrice, change24h, high24h, low24h) {
    return indicators({ price: currentPrice, change24h, high24h, low24h });
  }

  async generatePrediction(symbol, horizon = '24h') {
    const asset = this.livePrice(symbol);
    if (!asset) throw new Error('Live prices are not available right now, so there is nothing to forecast from.');
    const f = forecast(asset, horizon);

    let aiReasoning = '';
    try {
      const prompt = `Analyze ${asset.name} (${asset.symbol}) currently trading at $${asset.price}. 24h Change: ${asset.change24h}%, RSI (approximate, from the 24h range): ${f.tech.rsi}, Range: $${asset.low24h} - $${asset.high24h}. Horizon: ${horizon}. Give a 2-sentence technical outlook.`;
      // The forecast never waits long on commentary.
      const res = await Promise.race([
        dualInference.queryEngine('aura', [{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 120 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI commentary timed out')), 30_000)),
      ]);
      aiReasoning = String(res?.text || '').trim();
    } catch {
      // No AI engine answered: the window says so instead of showing canned text.
    }

    let past = [];
    try { past = await db.crypto_predictions.toArray(); } catch { /* no history yet */ }

    const predictionRecord = {
      id: `pred_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
      symbol: asset.symbol,
      assetName: asset.name,
      entryPrice: asset.price,
      targetHorizon: horizon,
      targetTimestamp: Date.now() + f.hours * 3600 * 1000,
      predictedPrice: f.predictedPrice,
      predictedDirection: f.direction,
      predictedChangePct: f.changePct,
      method: 'momentum-rsi-v1',
      trackRecord: trackRecord(past, asset.symbol, horizon),
      actualPrice: null,
      accuracyScore: null,
      aiReasoning,
      status: 'pending', // 'pending' | 'evaluated'
      createdAt: Date.now(),
    };

    try {
      await db.crypto_predictions.put(predictionRecord);
    } catch (e) {
      console.warn('Could not persist crypto prediction to DB:', e);
    }
    return predictionRecord;
  }

  /** Binance's price for the minute containing `timestampMs`, or null. */
  async priceAt(symbol, timestampMs) {
    try {
      const { data: rows } = await this._binance(`/klines?symbol=${encodeURIComponent(symbol)}&interval=1m&startTime=${Math.floor(timestampMs)}&limit=1`);
      const open = parseFloat(rows?.[0]?.[1]);
      return Number.isFinite(open) ? open : null;
    } catch {
      return null;
    }
  }

  /** Scores forecasts whose target time has passed against the real price at that time. */
  async evaluateHistoricalPredictions() {
    const empty = { totalPredictions: 0, evaluatedCount: 0, pendingCount: 0, hitRate: 0, avgAccuracyScore: 0, list: [] };
    try {
      const predictions = await db.crypto_predictions.toArray();
      if (!predictions?.length) return empty;

      const now = Date.now();
      const due = predictions.filter(p => p.status === 'pending' && now >= p.targetTimestamp).slice(0, MAX_EVALUATIONS_PER_PASS);
      for (const pred of due) {
        const actualPrice = await this.priceAt(pred.symbol, pred.targetTimestamp);
        if (actualPrice == null) continue; // offline: stays pending, never scored against a guess
        const { directionCorrect, accuracyScore } = scoreOutcome(pred, actualPrice);
        await db.crypto_predictions.put({ ...pred, actualPrice, accuracyScore, directionCorrect, status: 'evaluated', evaluatedAt: now });
      }

      const all = await db.crypto_predictions.orderBy('createdAt').reverse().toArray();
      const evaluated = all.filter(p => p.status === 'evaluated');
      const correctDirection = evaluated.filter(p => p.directionCorrect).length;
      return {
        totalPredictions: all.length,
        evaluatedCount: evaluated.length,
        pendingCount: all.length - evaluated.length,
        hitRate: evaluated.length ? Math.round((correctDirection / evaluated.length) * 100) : 0,
        avgAccuracyScore: evaluated.length ? Math.round(evaluated.reduce((acc, p) => acc + (p.accuracyScore || 0), 0) / evaluated.length) : 0,
        list: all.slice(0, 50),
      };
    } catch (e) {
      console.error('Error evaluating crypto predictions:', e);
      return empty;
    }
  }

  /**
   * NFT floors from CoinGecko, one collection at a time (its free tier allows a
   * few requests a minute). onUpdate gets the rows as each one arrives.
   */
  fetchNftFloors({ force = false, onUpdate } = {}) {
    const cached = readJson(NFT_CACHE_KEY);
    if (!force && cached?.at && Date.now() - cached.at < NFT_CACHE_MS && Array.isArray(cached.rows)) {
      return Promise.resolve(cached.rows);
    }
    if (this._nftRun) return this._nftRun;

    this._nftRun = (async () => {
      const previous = new Map((cached?.rows || []).filter(r => r.loaded).map(r => [r.id, r]));
      const rows = NFT_COLLECTIONS.map(c => previous.get(c.id) || { ...c, loaded: false });
      for (let i = 0; i < NFT_COLLECTIONS.length; i++) {
        if (i) await sleep(NFT_SPACING_MS);
        const meta = NFT_COLLECTIONS[i];
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/nfts/${meta.id}`, { headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.status === 429 ? 'CoinGecko rate limit, try again in a minute' : `CoinGecko HTTP ${res.status}`);
          const j = await res.json();
          const floor = j.floor_price || {};
          if (!Number.isFinite(floor.usd)) throw new Error('No floor price published');
          rows[i] = {
            ...meta,
            loaded: true,
            floorNative: floor.native_currency,
            nativeSymbol: meta.chain === 'Solana' ? 'SOL' : 'ETH',
            floorUsd: floor.usd,
            change24h: Number.isFinite(j.floor_price_in_usd_24h_percentage_change) ? j.floor_price_in_usd_24h_percentage_change : null,
            volume24hUsd: Number.isFinite(j.volume_24h?.usd) ? j.volume_24h.usd : null,
            owners: Number.isFinite(j.number_of_unique_addresses) ? j.number_of_unique_addresses : null,
            fetchedAt: Date.now(),
          };
        } catch (err) {
          // Keep an earlier real reading if there is one, marked with its own time.
          if (!rows[i].loaded) rows[i] = { ...meta, loaded: false, error: err.message };
        }
        onUpdate?.([...rows]);
      }
      writeJson(NFT_CACHE_KEY, { at: Date.now(), rows });
      return rows;
    })().finally(() => { this._nftRun = null; });
    return this._nftRun;
  }

  async getPaperPortfolio() {
    const saved = readJson(PORTFOLIO_KEY);
    if (saved) return saved;
    // Paper money only; it starts as cash, with no holdings bought at made-up prices.
    const fresh = { cashUsd: 100000.0, holdings: {}, trades: [] };
    writeJson(PORTFOLIO_KEY, fresh);
    return fresh;
  }

  async executePaperTrade(symbol, action, amountUsd) {
    const portfolio = await this.getPaperPortfolio();
    const asset = this.livePrice(symbol);
    if (!asset) throw new Error('Live prices are not available right now, so paper trades are paused.');

    const base = asset.base;
    const currentPrice = asset.price;
    const coins = amountUsd / currentPrice;

    if (action === 'BUY') {
      if (portfolio.cashUsd < amountUsd) throw new Error('Insufficient paper cash balance');
      portfolio.cashUsd -= amountUsd;
      if (!portfolio.holdings[base]) portfolio.holdings[base] = { amount: 0, avgEntry: 0 };
      const currentHolding = portfolio.holdings[base];
      const newTotalAmount = currentHolding.amount + coins;
      const newAvgEntry = ((currentHolding.amount * currentHolding.avgEntry) + amountUsd) / newTotalAmount;
      portfolio.holdings[base] = { amount: newTotalAmount, avgEntry: newAvgEntry };
    } else if (action === 'SELL') {
      if (!portfolio.holdings[base] || portfolio.holdings[base].amount < coins) {
        throw new Error(`Insufficient ${base} holdings to sell`);
      }
      portfolio.cashUsd += amountUsd;
      portfolio.holdings[base].amount -= coins;
      if (portfolio.holdings[base].amount <= 0.000001) delete portfolio.holdings[base];
    }

    portfolio.trades.unshift({
      id: `trade_${Date.now()}`,
      symbol,
      base,
      action,
      amountUsd,
      coins,
      executionPrice: currentPrice,
      timestamp: Date.now(),
    });

    writeJson(PORTFOLIO_KEY, portfolio);
    return portfolio;
  }
}

export const cryptoTracker = new CryptoTrackerService();
