import React, { useState } from 'react';
import { Megaphone, Sparkles, DollarSign, Copy, Check } from 'lucide-react';
import { generateAdCampaignPack } from '../../../services/commerce/aiStoreArchitect.js';
import { computeProductPricing, formatCentsUsd } from '../../../services/commerce/pricingEngine.js';

export default function AdStudioTab({
  kernel,
  activeStore,
  products,
  campaigns,
  onSaveCampaign,
  onLogAdSpend,
}) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [channel, setChannel] = useState('tiktok');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [spendInput, setSpendInput] = useState('');

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        Create or select a store first to design AI ad campaigns and track break-even ROAS.
      </div>
    );
  }

  const resolvedProduct = products.find(p => p.id === selectedProductId) || products[0] || null;
  const pricing = resolvedProduct
    ? computeProductPricing({
        wholesaleCents: resolvedProduct.wholesaleCents,
        shippingCents: resolvedProduct.shippingCents,
        overrideRetailCents: resolvedProduct.retailCents,
        rail: activeStore.primaryRail || 'square',
      })
    : null;

  const handleGenerate = async () => {
    if (!resolvedProduct) {
      setError('Add at least one product in Catalog & Suppliers first.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const pack = await generateAdCampaignPack({
        ai: kernel?.ai,
        store: activeStore,
        product: resolvedProduct,
        channel,
        rail: activeStore.primaryRail || 'square',
      });
      await onSaveCampaign(pack);
    } catch (err) {
      setError(err?.message || 'Ad creative generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRecordSpend = async (e) => {
    e.preventDefault();
    const cents = Math.round((Number(spendInput) || 0) * 100);
    if (cents <= 0) return;
    await onLogAdSpend({ channel, amountCents: cents });
    setSpendInput('');
  };

  const copyCampaign = (cmp) => {
    const text = `[${cmp.channel.toUpperCase()}] ${cmp.headline}\nHOOK: ${cmp.hook}\nBODY: ${cmp.primaryText}\n${cmp.script ? `SCRIPT:\n${cmp.script}\n` : ''}CTA: ${cmp.cta}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(cmp.id);
    setTimeout(() => setCopiedId(''), 1800);
  };

  return (
    <div className="space-y-5">
      {/* AI Creative Generator + Break-Even CPA Guardrail */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">AI Ad Studio &amp; Break-Even ROAS Calculator</h3>
          </div>
          {pricing && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                Max Break-Even CPA: {formatCentsUsd(pricing.maxBreakEvenCpaCents)}
              </span>
              {pricing.breakEvenRoas && (
                <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30">
                  Break-Even ROAS: {pricing.breakEvenRoas}x
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Target Product</label>
            <select
              value={resolvedProduct?.id || ''}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            >
              {products.length === 0 ? (
                <option value="">No products yet</option>
              ) : (
                products.map(p => (
                  <option key={p.id} value={p.id}>{p.title} ({formatCentsUsd(p.retailCents)})</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Ad Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            >
              <option value="tiktok">TikTok / Reels UGC Short-Form Video</option>
              <option value="meta">Meta (Facebook &amp; Instagram Feeds)</option>
              <option value="google">Google Shopping &amp; Search</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !resolvedProduct}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generating ? 'Crafting Ad Pack...' : 'Generate AI Ad Creative'}</span>
            </button>
          </div>
        </div>

        {error && <div className="text-xs text-amber-300">{error}</div>}

        {/* Log Real Ad Spend Into P&L Ledger */}
        <form onSubmit={handleRecordSpend} className="pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>Log Paid Ad Spend into P&amp;L Ledger:</span>
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={spendInput}
            onChange={(e) => setSpendInput(e.target.value)}
            placeholder="e.g. 25.00"
            className="w-28 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded font-mono text-slate-100"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-semibold cursor-pointer"
          >
            Record {channel.toUpperCase()} Spend
          </button>
        </form>
      </div>

      {/* Saved Ad Creative Packs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {campaigns.length === 0 ? (
          <div className="md:col-span-2 p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No ad packs generated yet. Select a product above to craft a hook, UGC script, and copy calibrated to your break-even CPA.
          </div>
        ) : (
          campaigns.map((cmp) => (
            <div key={cmp.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                    {cmp.channel}
                  </span>
                  <span className="font-bold text-slate-100 truncate">{cmp.productTitle || activeStore.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyCampaign(cmp)}
                  className="p-1 text-slate-400 hover:text-cyan-300 rounded"
                  title="Copy ad creative"
                >
                  {copiedId === cmp.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              {cmp.hook && (
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="text-[10px] text-amber-400 uppercase font-mono block">3-Second Hook</span>
                  <span className="text-slate-100">{cmp.hook}</span>
                </div>
              )}
              {cmp.headline && <div className="font-semibold text-cyan-300">{cmp.headline}</div>}
              {cmp.primaryText && <p className="text-slate-300 leading-relaxed">{cmp.primaryText}</p>}
              {cmp.script && (
                <pre className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-300 whitespace-pre-wrap font-sans">
                  {cmp.script}
                </pre>
              )}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                <span>CTA: {cmp.cta || 'Shop Now'}</span>
                {cmp.breakEvenRoas && <span>BE ROAS: {cmp.breakEvenRoas}x</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

