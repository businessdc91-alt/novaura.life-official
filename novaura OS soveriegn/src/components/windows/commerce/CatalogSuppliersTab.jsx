import React, { useState } from 'react';
import { Package, Search, Upload, Trash2, KeyRound, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  SUPPLIER_CATALOG,
  searchSupplierCatalog,
  parseWholesaleCsv,
} from '../../../services/commerce/supplierAdapters.js';
import {
  computeProductPricing,
  formatCentsUsd,
  PLATFORM_PROFIT_FEE_PCT,
} from '../../../services/commerce/pricingEngine.js';
import {
  getSupplierCredentials,
  saveSupplierCredentials,
} from '../../../services/commerce/commerceStoreService.js';

export default function CatalogSuppliersTab({
  activeStore,
  products,
  onSaveProduct,
  onDeleteProduct,
}) {
  const [selectedSupplier, setSelectedSupplier] = useState('cjdropshipping');
  const [credsMap, setCredsMap] = useState(() => getSupplierCredentials());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [csvText, setCsvText] = useState('');
  const [showCsv, setShowCsv] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    title: '',
    sku: '',
    wholesaleUsd: '14.00',
    shippingUsd: '4.50',
    stock: '100',
    description: '',
  });

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        Create or select a store in the AI Store Architect tab first.
      </div>
    );
  }

  const supplierMeta = SUPPLIER_CATALOG.find(s => s.id === selectedSupplier) || SUPPLIER_CATALOG[0];
  const currentCreds = credsMap[selectedSupplier] || {};
  const targetMarginPct = activeStore.pricingPolicy?.targetMarginPct ?? 48;
  const minMarginPct = activeStore.pricingPolicy?.minMarginPct ?? 25;
  const rail = activeStore.primaryRail || 'square';

  const handleCredChange = (field, val) => {
    const updated = saveSupplierCredentials(selectedSupplier, { ...currentCreds, [field]: val });
    setCredsMap({ ...updated });
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const items = await searchSupplierCatalog(selectedSupplier, {
        query: searchQuery,
        credentials: currentCreds,
      });
      setSearchResults(items);
    } catch (err) {
      setSearchError(err?.message || 'Supplier search failed.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleImportItem = async (item) => {
    const pricing = computeProductPricing({
      wholesaleCents: item.wholesaleCents,
      shippingCents: item.shippingCents,
      targetMarginPct,
      minMarginPct,
      rail,
      platformFeePct: PLATFORM_PROFIT_FEE_PCT,
    });
    await onSaveProduct({
      ...item,
      storeId: activeStore.id,
      retailCents: pricing.retailCents,
      platformProfitFeeCents: pricing.platformProfitFeeCents,
      merchantNetProfitCents: pricing.merchantNetProfitCents,
      breakEvenRoas: pricing.breakEvenRoas,
      status: 'active',
    });
  };

  const handleImportCsv = async () => {
    const parsed = parseWholesaleCsv(csvText);
    for (const item of parsed) {
      await handleImportItem(item);
    }
    setCsvText('');
    setShowCsv(false);
  };

  const handleSaveManual = async (e) => {
    e.preventDefault();
    if (!manualForm.title.trim()) return;
    await handleImportItem({
      supplier: 'custom_wholesale',
      supplierProductId: manualForm.sku.trim() || `SKU-${Date.now().toString(36)}`,
      sku: manualForm.sku.trim() || `SKU-${Date.now().toString(36)}`,
      title: manualForm.title.trim(),
      description: manualForm.description.trim(),
      wholesaleCents: Math.round((Number(manualForm.wholesaleUsd) || 0) * 100),
      shippingCents: Math.round((Number(manualForm.shippingUsd) || 0) * 100),
      stockCount: Math.max(0, Math.round(Number(manualForm.stock) || 0)),
      variants: ['Standard'],
      images: [],
      supplierLinkStatus: 'linked_manual',
    });
    setManualForm({ title: '', sku: '', wholesaleUsd: '14.00', shippingUsd: '4.50', stock: '100', description: '' });
    setShowManual(false);
  };

  return (
    <div className="space-y-5">
      {/* Supplier API Connection & Live Search */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Live Supplier API &amp; Catalog Importer</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCsv(!showCsv)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] border border-slate-700 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 rounded-lg text-[11px] border border-emerald-500/40 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Wholesale SKU</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Supplier Network</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            >
              {SUPPLIER_CATALOG.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.category}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">{supplierMeta.shippingNote}</p>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {supplierMeta.authFields.map((field) => (
              <div key={field}>
                <label className="text-[10px] text-slate-400 block mb-1 font-mono">{field}</label>
                <input
                  type={field.toLowerCase().includes('url') || field.toLowerCase().includes('id') ? 'text' : 'password'}
                  value={currentCreds[field] || ''}
                  onChange={(e) => handleCredChange(field, e.target.value)}
                  placeholder={`Enter ${supplierMeta.name} ${field}...`}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100"
                />
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search live ${supplierMeta.name} catalog (e.g. ergonomic mouse pad, pet water fountain)...`}
            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100"
          />
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{searching ? 'Searching...' : 'Search Live API'}</span>
          </button>
        </form>

        {searchError && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200">
            {searchError}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {searchResults.map((item) => {
              const quote = computeProductPricing({
                wholesaleCents: item.wholesaleCents,
                shippingCents: item.shippingCents,
                targetMarginPct,
                minMarginPct,
                rail,
              });
              return (
                <div key={item.supplierProductId} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-100 truncate">{item.title}</div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Wholesale {formatCentsUsd(item.wholesaleCents)} &rarr; Retail {formatCentsUsd(quote.retailCents)} &bull; Net {formatCentsUsd(quote.merchantNetProfitCents)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImportItem(item)}
                    className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                  >
                    Import + Auto-Price
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showCsv && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="text-[11px] text-slate-300 font-mono">
              CSV Header: sku,title,wholesale_usd,shipping_usd,stock,image_url,description
            </div>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'sku,title,wholesale_usd,shipping_usd,stock,image_url,description\nDESK-01,XL Anime Desk Mat,9.50,4.00,250,,Stitched edge microfiber mat'}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200"
            />
            <button
              type="button"
              onClick={handleImportCsv}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Parse &amp; Import SKUs
            </button>
          </div>
        )}

        {showManual && (
          <form onSubmit={handleSaveManual} className="p-3 bg-slate-950 border border-emerald-500/30 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <input
              required
              placeholder="Product title"
              value={manualForm.title}
              onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
              className="col-span-2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
            />
            <input
              placeholder="SKU"
              value={manualForm.sku}
              onChange={(e) => setManualForm({ ...manualForm, sku: e.target.value })}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Wholesale $"
              value={manualForm.wholesaleUsd}
              onChange={(e) => setManualForm({ ...manualForm, wholesaleUsd: e.target.value })}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Shipping $"
              value={manualForm.shippingUsd}
              onChange={(e) => setManualForm({ ...manualForm, shippingUsd: e.target.value })}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
            />
            <input
              type="number"
              placeholder="Stock"
              value={manualForm.stock}
              onChange={(e) => setManualForm({ ...manualForm, stock: e.target.value })}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
            />
            <input
              placeholder="Short description"
              value={manualForm.description}
              onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
              className="col-span-2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
            />
            <button
              type="submit"
              className="col-span-2 sm:col-span-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold cursor-pointer"
            >
              Add Wholesale Product with Auto Upcharge
            </button>
          </form>
        )}
      </div>

      {/* Store Product Catalog with Live Margin & 5% Profit Split */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>{activeStore.name} Catalog ({products.length} items)</span>
          </h3>
          <span className="text-[11px] text-slate-400">Platform fee = 5% of net profit only (never gross revenue)</span>
        </div>

        {products.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No products in this store yet. Use the AI Architect, live supplier search, CSV import, or Add Wholesale SKU above.
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const calc = computeProductPricing({
                wholesaleCents: p.wholesaleCents,
                shippingCents: p.shippingCents,
                overrideRetailCents: p.retailCents,
                minMarginPct,
                rail,
              });
              const isDraft = p.supplierLinkStatus === 'draft_needs_supplier';
              return (
                <div key={p.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-100">{p.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                        {p.sku}
                      </span>
                      {isDraft ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          <span>DRAFT_NEEDS_SUPPLIER</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{p.supplier}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1 flex flex-wrap gap-3">
                      <span>Wholesale: <strong className="text-slate-200">{formatCentsUsd(calc.wholesaleCents)}</strong></span>
                      <span>Ship: <strong className="text-slate-200">{formatCentsUsd(calc.shippingCents)}</strong></span>
                      <span>Gateway: <strong className="text-slate-300">{formatCentsUsd(calc.gatewayFeeCents)}</strong></span>
                      <span>5% Profit Fee: <strong className="text-cyan-300">{formatCentsUsd(calc.platformProfitFeeCents)}</strong></span>
                      <span>Merchant Net: <strong className="text-emerald-400">{formatCentsUsd(calc.merchantNetProfitCents)} ({calc.effectiveMarginPct}%)</strong></span>
                      {calc.breakEvenRoas && <span>BE ROAS: <strong className="text-purple-300">{calc.breakEvenRoas}x</strong></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400">
                      Retail $
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={(p.retailCents / 100).toFixed(2)}
                        onBlur={(e) => {
                          const cents = Math.max(100, Math.round((Number(e.target.value) || 0) * 100));
                          if (cents !== p.retailCents) {
                            onSaveProduct({ ...p, retailCents: cents });
                          }
                        }}
                        className="ml-1.5 w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onDeleteProduct(p.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800"
                      title="Remove product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

