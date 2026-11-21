import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Sparkles, Package, Globe, CreditCard, Megaphone, TrendingUp, RefreshCw
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import {
  listStores,
  saveStore,
  deleteStore,
  createBlankStore,
  listStoreProducts,
  saveProduct,
  deleteProduct,
  listStoreOrders,
  listLedgerEntries,
  appendLedgerEntry,
  listCampaigns,
  saveCampaign,
  getPaymentRailSettings,
  savePaymentRailSettings,
  processOrderThroughGuardrails,
  refundStoreOrder,
} from '../../services/commerce/commerceStoreService.js';
import StoreArchitectTab from './commerce/StoreArchitectTab.jsx';
import CatalogSuppliersTab from './commerce/CatalogSuppliersTab.jsx';
import DomainsHostingTab from './commerce/DomainsHostingTab.jsx';
import PaymentsFulfillmentTab from './commerce/PaymentsFulfillmentTab.jsx';
import AdStudioTab from './commerce/AdStudioTab.jsx';
import ProfitLedgerTab from './commerce/ProfitLedgerTab.jsx';

const TABS = [
  { id: 'architect', label: 'AI Store Architect', icon: Sparkles },
  { id: 'catalog', label: 'Catalog & Suppliers', icon: Package },
  { id: 'domains', label: 'Domains & Hosting', icon: Globe },
  { id: 'payments', label: 'Payments & Orders', icon: CreditCard },
  { id: 'ads', label: 'Ad Studio', icon: Megaphone },
  { id: 'ledger', label: 'P&L & 5% Split', icon: TrendingUp },
];

export default function SovereignCommerceWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('architect');
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [railSettings, setRailSettings] = useState(() => getPaymentRailSettings());
  const [loading, setLoading] = useState(false);

  const activeStore = stores.find(s => s.id === selectedStoreId) || stores[0] || null;
  const resolvedStoreId = activeStore?.id || '';

  const reloadAll = useCallback(async (targetStoreId = null) => {
    setLoading(true);
    try {
      const [allStores, allLedger] = await Promise.all([listStores(), listLedgerEntries()]);
      setStores(allStores);
      setLedgerEntries(allLedger);
      const effectiveId = targetStoreId || selectedStoreId || allStores[0]?.id || '';
      if (effectiveId) {
        const [prods, ords, camps] = await Promise.all([
          listStoreProducts(effectiveId),
          listStoreOrders(effectiveId),
          listCampaigns(effectiveId),
        ]);
        setProducts(prods);
        setOrders(ords);
        setCampaigns(camps);
      } else {
        setProducts([]);
        setOrders([]);
        setCampaigns([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [allStores, allLedger] = await Promise.all([listStores(), listLedgerEntries()]);
      if (cancelled) return;
      setStores(allStores);
      setLedgerEntries(allLedger);
      const effectiveId = selectedStoreId || allStores[0]?.id || '';
      if (!effectiveId) return;
      const [prods, ords, camps] = await Promise.all([
        listStoreProducts(effectiveId),
        listStoreOrders(effectiveId),
        listCampaigns(effectiveId),
      ]);
      if (cancelled) return;
      setProducts(prods);
      setOrders(ords);
      setCampaigns(camps);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId]);

  const handleSelectStore = (id) => {
    setSelectedStoreId(id);
  };

  const handleCreateBlankStore = async (opts) => {
    const draft = createBlankStore(opts);
    const saved = await saveStore(draft);
    setSelectedStoreId(saved.id);
    await reloadAll(saved.id);
  };

  const handleDeleteStore = async (storeId) => {
    await deleteStore(storeId);
    const nextId = selectedStoreId === storeId ? '' : selectedStoreId;
    setSelectedStoreId(nextId);
    await reloadAll(nextId);
  };

  const handleApplyBlueprint = async ({ storeDraft, productDrafts, campaignDrafts }) => {
    const saved = await saveStore(storeDraft);
    for (const prod of productDrafts || []) {
      await saveProduct({ ...prod, storeId: saved.id });
    }
    for (const cmp of campaignDrafts || []) {
      await saveCampaign({ ...cmp, storeId: saved.id });
    }
    setSelectedStoreId(saved.id);
    await reloadAll(saved.id);
  };

  const handleUpdateStore = async (updated) => {
    const saved = await saveStore(updated);
    setStores(prev => prev.map(s => (s.id === saved.id ? saved : s)));
  };

  const handleSaveProduct = async (prod) => {
    await saveProduct(prod);
    await reloadAll(resolvedStoreId);
  };

  const handleDeleteProduct = async (productId) => {
    await deleteProduct(productId);
    await reloadAll(resolvedStoreId);
  };

  const handleSaveRailSettings = (patch) => {
    const next = savePaymentRailSettings(patch);
    setRailSettings(next);
  };

  const handleReleaseOrder = async (order) => {
    if (!activeStore) return;
    await processOrderThroughGuardrails({
      store: activeStore,
      order: { ...order, externalPaymentId: '' },
      settlementStatus: 'settled',
      autoSubmitSupplier: true,
    });
    await reloadAll(resolvedStoreId);
  };

  const handleRefundOrder = async (order) => {
    if (!activeStore) return;
    await refundStoreOrder({ store: activeStore, order });
    await reloadAll(resolvedStoreId);
  };

  const handleSaveCampaign = async (cmp) => {
    await saveCampaign(cmp);
    await reloadAll(resolvedStoreId);
  };

  const handleLogAdSpend = async ({ channel, amountCents }) => {
    if (!activeStore) return;
    await appendLedgerEntry({
      storeId: activeStore.id,
      type: 'ad_spend',
      rail: channel,
      amountCents: -Math.abs(amountCents),
    });
    await reloadAll(resolvedStoreId);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-bold text-slate-100">Sovereign Commerce Studio</h2>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                DUAL MESH + WEB
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30">
                5% NET-PROFIT SPLIT
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {activeStore
                ? `${activeStore.name} • /${activeStore.slug}/storefront/merchandise • ${activeStore.meshDomain}`
                : 'AI Dropshipping, Multi-Rail Checkout (Square / Stripe / PayPal + Cash App Pay + Venmo) & Cheapest TLD Hosting'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stores.length > 0 && (
            <select
              value={resolvedStoreId}
              onChange={(e) => handleSelectStore(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name} (/{s.slug})</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => reloadAll(resolvedStoreId)}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex gap-1.5 overflow-x-auto shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 select-text">
        {activeTab === 'architect' && (
          <StoreArchitectTab
            kernel={kernel}
            stores={stores}
            activeStore={activeStore}
            platformHost={railSettings.platformHost || 'novaura.xyz'}
            onSelectStore={handleSelectStore}
            onCreateBlankStore={handleCreateBlankStore}
            onDeleteStore={handleDeleteStore}
            onApplyBlueprint={handleApplyBlueprint}
            onUpdateStore={handleUpdateStore}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogSuppliersTab
            activeStore={activeStore}
            products={products}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeTab === 'domains' && (
          <DomainsHostingTab
            kernel={kernel}
            activeStore={activeStore}
            products={products}
            railSettings={railSettings}
            onSaveRailSettings={handleSaveRailSettings}
            onUpdateStore={handleUpdateStore}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsFulfillmentTab
            activeStore={activeStore}
            orders={orders}
            railSettings={railSettings}
            onSaveRailSettings={handleSaveRailSettings}
            onUpdateStore={handleUpdateStore}
            onRefundOrder={handleRefundOrder}
            onReleaseOrder={handleReleaseOrder}
          />
        )}

        {activeTab === 'ads' && (
          <AdStudioTab
            kernel={kernel}
            activeStore={activeStore}
            products={products}
            campaigns={campaigns}
            onSaveCampaign={handleSaveCampaign}
            onLogAdSpend={handleLogAdSpend}
          />
        )}

        {activeTab === 'ledger' && (
          <ProfitLedgerTab
            stores={stores}
            activeStore={activeStore}
            ledgerEntries={ledgerEntries}
          />
        )}
      </div>
    </div>
  );
}

