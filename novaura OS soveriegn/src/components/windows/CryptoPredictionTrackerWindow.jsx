import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Activity, Zap, ShieldCheck,
  RefreshCw, BarChart2, Layers, Award, Clock, ArrowUpRight, ArrowDownRight,
  Sparkles, CheckCircle2, AlertCircle, ShoppingCart
} from 'lucide-react';
import {
  cryptoTracker,
  NFT_COLLECTIONS
} from '../../services/cryptoTrackerService.js';

const timeOf = (ms) => (ms ? new Date(ms).toLocaleString() : 'never');

export default function CryptoPredictionTrackerWindow() {
  const [activeTab, setActiveTab] = useState('market'); // 'market' | 'predictions' | 'accuracy' | 'trading'
  const [cryptoAssets, setCryptoAssets] = useState(() => cryptoTracker.lastKnownPrices());
  const [marketStatus, setMarketStatus] = useState(() => ({ ...cryptoTracker.status }));
  const [nftCollections, setNftCollections] = useState(() => NFT_COLLECTIONS.map(c => ({ ...c, loaded: false })));
  const [nftLoading, setNftLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');
  const [selectedHorizon, setSelectedHorizon] = useState('24h');
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [accuracyStats, setAccuracyStats] = useState({ hitRate: 0, evaluatedCount: 0, pendingCount: 0, avgAccuracyScore: 0, list: [] });
  const [paperPortfolio, setPaperPortfolio] = useState({ cashUsd: 100000, holdings: {}, trades: [] });
  const [tradeAmount, setTradeAmount] = useState('1000');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tradeNotice, setTradeNotice] = useState('');

  // Initial data load & live subscriptions
  useEffect(() => {
    loadData();
    const unsubscribe = cryptoTracker.subscribe((updatedAssets) => {
      setCryptoAssets(updatedAssets);
      setMarketStatus({ ...cryptoTracker.status });
    });
    const timer = setInterval(() => {
      cryptoTracker.fetchLivePrices();
    }, 12000);

    setNftLoading(true);
    cryptoTracker.fetchNftFloors({ onUpdate: setNftCollections })
      .then(rows => setNftCollections(rows))
      .catch(() => {})
      .finally(() => setNftLoading(false));

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const live = await cryptoTracker.fetchLivePrices();
      if (live) setCryptoAssets(live);
      const acc = await cryptoTracker.evaluateHistoricalPredictions();
      setAccuracyStats(acc);
      const port = await cryptoTracker.getPaperPortfolio();
      setPaperPortfolio(port);
    } catch (e) {
      console.warn('Load data err:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRunPrediction = async () => {
    setIsPredicting(true);
    setPredictionError('');
    try {
      const pred = await cryptoTracker.generatePrediction(selectedAsset, selectedHorizon);
      setCurrentPrediction(pred);
      const acc = await cryptoTracker.evaluateHistoricalPredictions();
      setAccuracyStats(acc);
    } catch (e) {
      setPredictionError(e.message);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleExecuteTrade = async (action) => {
    const amt = parseFloat(tradeAmount);
    if (!amt || amt <= 0) return;
    try {
      const updated = await cryptoTracker.executePaperTrade(selectedAsset, action, amt);
      setPaperPortfolio(updated);
      setTradeNotice(`Simulated ${action} of $${amt.toLocaleString()} executed!`);
      setTimeout(() => setTradeNotice(''), 3000);
    } catch (err) {
      setTradeNotice(`Trade error: ${err.message}`);
      setTimeout(() => setTradeNotice(''), 4000);
    }
  };

  const activeAssetData = cryptoAssets.find(a => a.symbol === selectedAsset) || cryptoAssets[0] || null;
  const fmtPrice = (p) => (Number.isFinite(p) ? p.toLocaleString(undefined, { minimumFractionDigits: p > 10 ? 2 : 4 }) : '—');

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <TrendingUp className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">NovaPulse Crypto & NFT Terminal</h2>
              {marketStatus.live ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-mono">
                  Live · {marketStatus.source || 'Binance'}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-mono" title={marketStatus.error || ''}>
                  Offline · {marketStatus.at ? `prices from ${timeOf(marketStatus.at)}` : 'no prices yet'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Market data, rule-based forecasts scored against real prices, and paper trading</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveTab('market')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'market' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Market & NFTs
            </button>
            <button
              onClick={() => setActiveTab('predictions')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === 'predictions' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              Forecasts
            </button>
            <button
              onClick={() => setActiveTab('accuracy')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === 'accuracy' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3 h-3" />
              Accuracy Tracker ({accuracyStats.hitRate}%)
            </button>
            <button
              onClick={() => setActiveTab('trading')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'trading' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Paper Trading
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh prices"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: MARKET & NFTS */}
        {activeTab === 'market' && (
          <div className="space-y-6">
            {/* Crypto Overview Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Cryptocurrencies
                </h3>
                <span className={`text-[11px] font-mono ${marketStatus.live ? 'text-slate-400' : 'text-amber-300'}`}>
                  {marketStatus.live
                    ? `${marketStatus.source || 'Binance'} 24h ticker, refreshed every 12 s (last ${new Date(marketStatus.at).toLocaleTimeString()})`
                    : marketStatus.at
                      ? `Not live: the last prices this PC fetched, at ${timeOf(marketStatus.at)}`
                      : 'Not live'}
                </span>
              </div>

              {cryptoAssets.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-slate-700 text-xs text-slate-400">
                  No prices yet. This PC could not reach Binance{marketStatus.error ? ` (${marketStatus.error})` : ''} and has no earlier prices saved.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {cryptoAssets.map((asset) => {
                  const isPositive = asset.change24h >= 0;
                  return (
                    <div
                      key={asset.symbol}
                      onClick={() => { setSelectedAsset(asset.symbol); setActiveTab('predictions'); }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${
                        selectedAsset === asset.symbol
                          ? 'bg-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-white text-xs">{asset.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{asset.base}</span>
                      </div>
                      <div className={`text-base font-extrabold font-mono ${asset.source === 'live' ? 'text-white' : 'text-slate-400'}`}>
                        ${fmtPrice(asset.price)}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
                        <span className="text-slate-400 font-mono">Vol: {asset.volume}</span>
                        <div className={`flex items-center font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          <span>{isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NFT Floor Tracker */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  NFT Collections (Floor Prices)
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {nftLoading ? 'Fetching from CoinGecko, one at a time…' : 'CoinGecko, refreshed at most every 10 minutes'}
                </span>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Collection</th>
                      <th className="py-3 px-4">Network</th>
                      <th className="py-3 px-4 text-right">Floor Price</th>
                      <th className="py-3 px-4 text-right">Floor (USD)</th>
                      <th className="py-3 px-4 text-right">24h Change</th>
                      <th className="py-3 px-4 text-right">24h Vol (USD)</th>
                      <th className="py-3 px-4 text-right">Owners</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {nftCollections.map((nft) => (
                      <tr key={nft.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white font-sans">{nft.name}</td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                            {nft.chain}
                          </span>
                        </td>
                        {nft.loaded ? (
                          <>
                            <td className="py-3 px-4 text-right text-purple-300 font-bold">{nft.floorNative} {nft.nativeSymbol}</td>
                            <td className="py-3 px-4 text-right text-slate-200">${Math.round(nft.floorUsd).toLocaleString()}</td>
                            <td className={`py-3 px-4 text-right font-bold ${(nft.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {nft.change24h == null ? '—' : `${nft.change24h >= 0 ? '+' : ''}${nft.change24h.toFixed(2)}%`}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-400">{nft.volume24hUsd == null ? '—' : `$${Math.round(nft.volume24hUsd).toLocaleString()}`}</td>
                            <td className="py-3 px-4 text-right text-slate-400">{nft.owners == null ? '—' : nft.owners.toLocaleString()}</td>
                          </>
                        ) : (
                          <td colSpan={5} className="py-3 px-4 text-right text-slate-500 font-sans">
                            {nft.error || (nftLoading ? 'Loading…' : 'Not loaded')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI PREDICTIONS */}
        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration Column */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Target Asset & Horizon
                </h3>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Cryptocurrency</label>
                  <select
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {cryptoAssets.map(a => (
                      <option key={a.symbol} value={a.symbol}>{a.name} ({a.base}) — ${fmtPrice(a.price)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Forecast Horizon</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['1h', '24h', '7d'].map((h) => (
                      <button
                        key={h}
                        onClick={() => setSelectedHorizon(h)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          selectedHorizon === h
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {h.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Technical Snapshot */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs font-mono">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Technical Grounding</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Price:</span>
                    <span className="text-white font-bold">${fmtPrice(activeAssetData?.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">24h High:</span>
                    <span className="text-cyan-400">${fmtPrice(activeAssetData?.high24h)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Support Floor:</span>
                    <span className="text-emerald-400">${fmtPrice(activeAssetData ? activeAssetData.low24h * 0.985 : NaN)}</span>
                  </div>
                </div>

                <button
                  onClick={handleRunPrediction}
                  disabled={isPredicting || !marketStatus.live}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-xl shadow-purple-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPredicting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Working out the forecast...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Make forecast</span>
                    </>
                  )}
                </button>
                {!marketStatus.live && (
                  <p className="text-[11px] text-amber-300">Forecasts need live prices, and neither Binance nor Binance.US can be reached right now.</p>
                )}
                {predictionError && <p className="text-[11px] text-rose-400">{predictionError}</p>}
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Rule-based: 35% of the last 24 hours' move carries on, unless RSI (read roughly from the 24h range) is stretched. Every forecast is scored against Binance's real price at its target time. Not financial advice.
                </p>
              </div>

              {/* Prediction Result Display */}
              <div className="lg:col-span-2">
                {currentPrediction ? (
                  <div className="bg-slate-900/60 border border-purple-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-purple-400">Forecast</div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                          <span>{currentPrediction.assetName}</span>
                          <span className="text-xs text-slate-400 font-mono">({currentPrediction.symbol})</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40">
                            {currentPrediction.targetHorizon} Target
                          </span>
                        </h2>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Track record ({currentPrediction.symbol}, {currentPrediction.targetHorizon})</div>
                        {currentPrediction.trackRecord?.evaluated ? (
                          <div className="text-lg font-bold text-emerald-400 font-mono" title="Share of past forecasts that got the direction right">
                            {currentPrediction.trackRecord.hitRate}% <span className="text-[11px] text-slate-400">of {currentPrediction.trackRecord.evaluated}</span>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-slate-400 mt-1">None scored yet</div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Entry Base</div>
                        <div className="text-sm font-bold text-slate-200 mt-1">${currentPrediction.entryPrice}</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Target Forecast</div>
                        <div className="text-sm font-bold text-purple-300 mt-1">${currentPrediction.predictedPrice}</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Direction</div>
                        <div className={`text-sm font-bold mt-1 ${currentPrediction.predictedDirection === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currentPrediction.predictedDirection}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Expected Delta</div>
                        <div className={`text-sm font-bold mt-1 ${currentPrediction.predictedChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currentPrediction.predictedChangePct >= 0 ? '+' : ''}{currentPrediction.predictedChangePct}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        AI commentary
                      </div>
                      {currentPrediction.aiReasoning
                        ? <p>{currentPrediction.aiReasoning}</p>
                        : <p className="text-slate-500">No AI engine answered, so there is no commentary. The forecast above does not depend on it.</p>}
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-mono">
                      <span>Prediction ID: {currentPrediction.id}</span>
                      <span className="text-amber-400">Saved; scored at {new Date(currentPrediction.targetTimestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[300px] bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                    <Sparkles className="w-10 h-10 text-slate-600 mb-3" />
                    <h4 className="text-sm font-bold text-slate-300">No Forecast Generated Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Pick an asset and a horizon on the left, then make a forecast.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACCURACY SCORECARD */}
        {activeTab === 'accuracy' && (
          <div className="space-y-6">
            {/* Accuracy Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl font-mono">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Directional Hit Rate</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{accuracyStats.hitRate}%</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Correct trend prediction</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl font-mono">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Avg Accuracy Score</div>
                <div className="text-2xl font-black text-purple-400 mt-1">{accuracyStats.avgAccuracyScore} / 100</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Price proximity metric</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl font-mono">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Evaluated Forecasts</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">{accuracyStats.evaluatedCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Time horizons elapsed</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl font-mono">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Pending Evaluation</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{accuracyStats.pendingCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Target time active</div>
              </div>
            </div>

            {/* Historical Verification Audit Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  Historical Prediction Audit Log
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">Tamper-proof local ledger</span>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {accuracyStats.list.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Asset</th>
                        <th className="py-3 px-4">Horizon</th>
                        <th className="py-3 px-4 text-right">Entry</th>
                        <th className="py-3 px-4 text-right">Target</th>
                        <th className="py-3 px-4 text-right">Actual</th>
                        <th className="py-3 px-4 text-center">Outcome</th>
                        <th className="py-3 px-4 text-right">Score</th>
                        <th className="py-3 px-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {accuracyStats.list.map((pred) => (
                        <tr key={pred.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-white font-sans">{pred.assetName || pred.symbol}</td>
                          <td className="py-3 px-4 text-purple-300">{pred.targetHorizon}</td>
                          <td className="py-3 px-4 text-right text-slate-300">${pred.entryPrice}</td>
                          <td className="py-3 px-4 text-right text-purple-300 font-bold">${pred.predictedPrice}</td>
                          <td className="py-3 px-4 text-right text-slate-200">
                            {pred.actualPrice ? `$${pred.actualPrice}` : <span className="text-amber-400 italic">Pending...</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {pred.status === 'evaluated' ? (
                              pred.directionCorrect ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px]">
                                  HIT
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-500/40 text-[10px]">
                                  MISS
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/40 text-[10px]">
                                RUNNING
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-cyan-300">
                            {pred.accuracyScore !== null ? `${pred.accuracyScore}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-400 text-[10px]">
                            {new Date(pred.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No predictions logged yet. Make your first one in the Forecasts tab.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PAPER TRADING TERMINAL */}
        {activeTab === 'trading' && (
          <div className="space-y-6">
            {/* Account Balance Strip */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Simulated Sovereign Portfolio Balance</div>
                <div className="text-3xl font-black text-white font-mono mt-1">${paperPortfolio.cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-slate-400">USDT</span></div>
              </div>
              <div className="flex items-center gap-3">
                {tradeNotice && (
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                    {tradeNotice}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Order Placement Terminal */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-400" />
                  Order Execution
                </h3>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Asset</label>
                  <select
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {cryptoAssets.map(a => (
                      <option key={a.symbol} value={a.symbol}>{a.name} ({a.base}) — ${fmtPrice(a.price)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Order Value (USD)</label>
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="1000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleExecuteTrade('BUY')}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    BUY / LONG
                  </button>
                  <button
                    onClick={() => handleExecuteTrade('SELL')}
                    className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                  >
                    SELL / CLOSE
                  </button>
                </div>
              </div>

              {/* Holdings & History */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Active Holdings</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono">
                    {Object.entries(paperPortfolio.holdings || {}).map(([base, data]) => {
                      const asset = cryptoAssets.find(a => a.base === base);
                      const currentVal = asset ? (data.amount * asset.price).toFixed(2) : '0';
                      return (
                        <div key={base} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                          <div className="text-xs font-bold text-white">{base}</div>
                          <div className="text-sm text-cyan-300 mt-1 font-bold">{data.amount.toFixed(4)}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Val: ${parseFloat(currentVal).toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Trade History */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent Trade Log</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
                    {(paperPortfolio.trades || []).slice(0, 10).map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.action === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                            {trade.action}
                          </span>
                          <span className="text-white font-bold">{trade.base}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-200">${trade.amountUsd.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500 ml-2">@{trade.executionPrice}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
