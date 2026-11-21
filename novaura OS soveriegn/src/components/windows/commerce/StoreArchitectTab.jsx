import React, { useState } from 'react';
import { Sparkles, Send, Store, Plus, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';
import { architectStoreFromPrompt } from '../../../services/commerce/aiStoreArchitect.js';
import { formatCentsUsd } from '../../../services/commerce/pricingEngine.js';
import { buildStoreRoutes } from '../../../services/commerce/domainService.js';

const NICHE_PRESETS = [
  'Ergonomic Desk & Mechanical Keyboard Gear',
  'Minimalist Smart Pet Tech',
  'Anime & Desk Mat Collectibles',
  'Ultralight Camping & EDC Survival',
  'LED Ambient Room Aesthetics',
  'Recovery Fitness & Mobility Gear',
];

export default function StoreArchitectTab({
  kernel,
  stores,
  activeStore,
  platformHost,
  onSelectStore,
  onCreateBlankStore,
  onDeleteStore,
  onApplyBlueprint,
  onUpdateStore,
}) {
  const [prompt, setPrompt] = useState('');
  const [nicheHint, setNicheHint] = useState('');
  const [targetMarginPct, setTargetMarginPct] = useState(48);
  const [fundingMode, setFundingMode] = useState('instant_float');
  const [primaryRail, setPrimaryRail] = useState('square');
  const [ownerId, setOwnerId] = useState('operator');
  const [messages, setMessages] = useState([]);
  const [pendingBlueprint, setPendingBlueprint] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [newStoreName, setNewStoreName] = useState('');

  const handleArchitect = async (e) => {
    e?.preventDefault();
    if (!prompt.trim() || working) return;
    setWorking(true);
    setError('');
    const userMsg = prompt.trim();
    const nextHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(nextHistory);
    setPrompt('');

    try {
      const result = await architectStoreFromPrompt({
        ai: kernel?.ai,
        prompt: userMsg,
        history: nextHistory,
        preferredNiche: nicheHint,
        fundingMode,
        targetMarginPct,
        rail: primaryRail,
        ownerId,
      });
      setPendingBlueprint(result);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `${result.aiReply} (${result.productDrafts.length} catalog drafts priced at ${targetMarginPct}% target margin with 5% net-profit platform split.)`,
        },
      ]);
    } catch (err) {
      setError(err?.message || 'AI Store Architect failed.');
    } finally {
      setWorking(false);
    }
  };

  const handleLaunchBlueprint = async () => {
    if (!pendingBlueprint) return;
    await onApplyBlueprint(pendingBlueprint);
    setPendingBlueprint(null);
  };

  const handleManualCreate = async (e) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;
    await onCreateBlankStore({
      name: newStoreName.trim(),
      niche: nicheHint || 'Curated Specialty Gear',
      ownerId: ownerId.trim() || 'operator',
      fundingMode,
      primaryRail,
    });
    setNewStoreName('');
  };

  const routes = activeStore
    ? buildStoreRoutes({
        slug: activeStore.slug,
        customDomain: activeStore.customDomain,
        meshDomain: activeStore.meshDomain,
        platformHost,
      })
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: Multi-Tenant Store Switcher & Manual Create */}
      <div className="lg:col-span-4 space-y-4">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Managed Stores ({stores.length})</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              5% PROFIT FEE
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {stores.length === 0 ? (
              <div className="text-xs text-slate-500 p-4 text-center bg-slate-950 rounded-lg border border-slate-800">
                No stores yet. Chat with the AI Architect or create one below.
              </div>
            ) : (
              stores.map((s) => {
                const isSelected = activeStore?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => onSelectStore(s.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/50'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">{s.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        /{s.slug}/storefront &bull; {s.meshDomain}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteStore(s.id);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 rounded shrink-0"
                      title="Delete store"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleManualCreate} className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Quick Provision Storefront</div>
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="Store name (e.g. Ecchi Bonanza)..."
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="Merchant ID"
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Store</span>
              </button>
            </div>
          </form>
        </div>

        {/* Active Store Branding Quick Editor */}
        {activeStore && (
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Store Identity</h4>
            <div className="space-y-2 text-xs">
              <input
                type="text"
                value={activeStore.name || ''}
                onChange={(e) => onUpdateStore({ ...activeStore, name: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                placeholder="Store Name"
              />
              <input
                type="text"
                value={activeStore.tagline || ''}
                onChange={(e) => onUpdateStore({ ...activeStore, tagline: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                placeholder="Tagline"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={activeStore.niche || ''}
                  onChange={(e) => onUpdateStore({ ...activeStore, niche: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  placeholder="Niche"
                />
                <input
                  type="color"
                  value={activeStore.accentColor || '#06b6d4'}
                  onChange={(e) => onUpdateStore({ ...activeStore, accentColor: e.target.value })}
                  className="h-8 w-full bg-slate-950 border border-slate-800 rounded-lg px-1 cursor-pointer"
                  title="Accent color"
                />
              </div>
              {routes && (
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono space-y-1 text-slate-400">
                  <div className="truncate text-cyan-300">Web: {routes.subpath.merchandiseUrl}</div>
                  <div className="truncate text-emerald-300">Mesh: {routes.mesh.url}</div>
                  {routes.customTld && <div className="truncate text-amber-300">TLD: {routes.customTld.homeUrl}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Conversational AI Store Architect */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="p-4 bg-slate-900/90 border border-cyan-500/30 rounded-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">Conversational AI Store &amp; Niche Architect</h3>
            </div>
            <span className="text-[10px] text-slate-400">Runs on local Ollama / LM Studio / Built-in AI or BYOK Cloud</span>
          </div>

          {/* Preset Niche Chips */}
          <div className="flex flex-wrap gap-1.5">
            {NICHE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setNicheHint(preset);
                  setPrompt(`Build a high-margin automated dropshipping store for ${preset} with viral hooks and 5% profit split pricing.`);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-950 hover:bg-cyan-950/50 text-slate-300 hover:text-cyan-200 border border-slate-800 transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Architecture Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Target Margin %</label>
              <input
                type="number"
                min={15}
                max={80}
                value={targetMarginPct}
                onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Primary Payment Rail</label>
              <select
                value={primaryRail}
                onChange={(e) => setPrimaryRail(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              >
                <option value="square">Square + Cash App Pay</option>
                <option value="stripe">Stripe + Apple/Cash App Pay</option>
                <option value="paypal">PayPal Commerce + Venmo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Fulfillment Funding</label>
              <select
                value={fundingMode}
                onChange={(e) => setFundingMode(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              >
                <option value="instant_float">Instant Float (Card / Square Debit)</option>
                <option value="hold_until_settled">Hold-Until-Settled (Zero Float)</option>
              </select>
            </div>
          </div>

          {/* Conversation Feed */}
          <div className="h-44 overflow-y-auto p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2.5 text-xs">
            {messages.length === 0 ? (
              <div className="text-slate-500 leading-relaxed">
                Tell the AI what you want to sell (e.g. &ldquo;Design an anime desk mat &amp; collectibles shop called Ecchi Bonanza with 50% target margins and TikTok UGC scripts&rdquo;). The AI builds the brand, priced catalog drafts, supplier search terms, and ad angles.
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg ${
                    m.role === 'user'
                      ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-100 ml-8'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 mr-8'
                  }`}
                >
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-0.5">
                    {m.role === 'user' ? 'Operator' : 'Commerce Architect AI'}
                  </div>
                  <div className="leading-relaxed">{m.content}</div>
                </div>
              ))
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleArchitect} className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your niche, store vibe, products, or target customer..."
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={working || !prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{working ? 'Designing...' : 'Architect Store'}</span>
            </button>
          </form>
        </div>

        {/* Pending Blueprint Preview & 1-Click Materialize */}
        {pendingBlueprint && (
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Blueprint Ready: {pendingBlueprint.storeDraft.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  https://{platformHost}/{pendingBlueprint.storeDraft.slug}/storefront/merchandise &bull; nova://{pendingBlueprint.storeDraft.meshDomain}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLaunchBlueprint}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Create Store &amp; Populate {pendingBlueprint.productDrafts.length} Items
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pendingBlueprint.productDrafts.map((p) => (
                <div key={p.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <div className="font-semibold text-slate-100 truncate">{p.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Retail {formatCentsUsd(p.retailCents)} &bull; Cost {formatCentsUsd(p.wholesaleCents + p.shippingCents)} &bull; 5% Fee {formatCentsUsd(p.platformProfitFeeCents)} &bull; Net {formatCentsUsd(p.merchantNetProfitCents)}
                  </div>
                  <div className="text-[10px] text-amber-300 mt-1">
                    Draft — link live SKU in Catalog &amp; Suppliers (`{p.supplierQuery}`)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

