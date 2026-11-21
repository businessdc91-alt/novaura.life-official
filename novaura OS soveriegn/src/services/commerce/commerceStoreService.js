/**
 * NovAura Sovereign Commerce — Dexie Storefront Persistence & Fulfillment Orchestrator
 * Manages all 6 commerce_* tables, Ed25519-signed `.nova` mesh publishing,
 * idempotent order guardrail execution, proportional refunds, and ZIP server export.
 */

import { db } from '../../database/sovereignDatabase.js';
import {
  evaluateFulfillmentGuardrails,
  computeProportionalRefund,
  PLATFORM_PROFIT_FEE_PCT,
} from './pricingEngine.js';
import { submitSupplierOrder } from './supplierAdapters.js';
import { sanitizeStoreSlug, DEFAULT_PLATFORM_HOST } from './domainService.js';
import { buildStandaloneStorefrontHtml, buildDeployableCommerceServerBundle } from './storefrontBuilder.js';

const SUPPLIER_CREDS_KEY = 'novaura_commerce_supplier_creds_v1';
const PAYMENT_CREDS_KEY = 'novaura_commerce_payment_creds_v1';
const REGISTRAR_CREDS_KEY = 'novaura_commerce_registrar_creds_v1';

function readLocalJson(key, fallback = {}) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getSupplierCredentials() {
  return readLocalJson(SUPPLIER_CREDS_KEY, {});
}

export function saveSupplierCredentials(supplierId, creds) {
  const all = getSupplierCredentials();
  all[supplierId] = creds;
  writeLocalJson(SUPPLIER_CREDS_KEY, all);
  return all;
}

export function getPaymentRailSettings() {
  return readLocalJson(PAYMENT_CREDS_KEY, {
    square: { locationId: '', connectMerchantId: '', enabled: true },
    stripe: { connectAccountId: '', enabled: true },
    paypal: { merchantPayerId: '', enabled: true },
    platformHost: DEFAULT_PLATFORM_HOST,
    tldMarkupCents: 200,
    liveBackendUrl: '',
  });
}

export function savePaymentRailSettings(patch) {
  const next = { ...getPaymentRailSettings(), ...(patch || {}) };
  writeLocalJson(PAYMENT_CREDS_KEY, next);
  return next;
}

export function getRegistrarCredentials() {
  return readLocalJson(REGISTRAR_CREDS_KEY, {});
}

export function saveRegistrarCredentials(registrarId, creds) {
  const all = getRegistrarCredentials();
  all[registrarId] = creds;
  writeLocalJson(REGISTRAR_CREDS_KEY, all);
  return all;
}

export function createBlankStore({
  name,
  niche = 'Curated Specialty Gear',
  ownerId = 'operator',
  fundingMode = 'instant_float',
  primaryRail = 'square',
} = {}) {
  const now = new Date().toISOString();
  const cleanName = String(name || 'My Sovereign Store').trim();
  const slug = sanitizeStoreSlug(cleanName);
  return {
    id: `store_${slug}_${Date.now().toString(36)}`,
    slug,
    ownerId,
    name: cleanName,
    tagline: `Curated ${niche}`,
    niche,
    heroTitle: cleanName,
    heroSubtitle: `Direct-to-door ${niche} powered by NovAura Commerce`,
    accentColor: '#06b6d4',
    customDomain: '',
    meshDomain: `${slug}.nova`,
    meshCid: '',
    platformFeePct: PLATFORM_PROFIT_FEE_PCT,
    primaryRail,
    fundingMode,
    pricingPolicy: {
      targetMarginPct: 48,
      minMarginPct: 25,
      platformFeePct: PLATFORM_PROFIT_FEE_PCT,
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export async function listStores() {
  const rows = await db.commerce_stores.toArray();
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function saveStore(store) {
  const now = new Date().toISOString();
  const slug = sanitizeStoreSlug(store.slug || store.name);
  const record = {
    ...store,
    id: store.id || `store_${slug}_${Date.now().toString(36)}`,
    slug,
    meshDomain: store.meshDomain || `${slug}.nova`,
    platformFeePct: Number(store.platformFeePct ?? PLATFORM_PROFIT_FEE_PCT),
    updatedAt: now,
    createdAt: store.createdAt || now,
  };
  await db.commerce_stores.put(record);
  return record;
}

export async function deleteStore(storeId) {
  await db.commerce_stores.delete(storeId);
  const [prods, orders, ledger, camps, domains] = await Promise.all([
    db.commerce_products.where('storeId').equals(storeId).primaryKeys(),
    db.commerce_orders.where('storeId').equals(storeId).primaryKeys(),
    db.commerce_ledger.where('storeId').equals(storeId).primaryKeys(),
    db.commerce_campaigns.where('storeId').equals(storeId).primaryKeys(),
    db.commerce_domains.where('storeId').equals(storeId).primaryKeys(),
  ]);
  await Promise.all([
    db.commerce_products.bulkDelete(prods),
    db.commerce_orders.bulkDelete(orders),
    db.commerce_ledger.bulkDelete(ledger),
    db.commerce_campaigns.bulkDelete(camps),
    db.commerce_domains.bulkDelete(domains),
  ]);
}

export async function listStoreProducts(storeId) {
  if (!storeId) return [];
  const rows = await db.commerce_products.where('storeId').equals(storeId).toArray();
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function saveProduct(product) {
  const record = {
    ...product,
    id: product.id || `prod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    updatedAt: new Date().toISOString(),
  };
  await db.commerce_products.put(record);
  return record;
}

export async function deleteProduct(productId) {
  await db.commerce_products.delete(productId);
}

export async function listStoreOrders(storeId) {
  const rows = storeId
    ? await db.commerce_orders.where('storeId').equals(storeId).toArray()
    : await db.commerce_orders.toArray();
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function saveOrder(order) {
  const now = new Date().toISOString();
  const record = {
    ...order,
    id: order.id || `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: order.createdAt || now,
    updatedAt: now,
  };
  await db.commerce_orders.put(record);
  return record;
}

export async function listLedgerEntries(storeId = null) {
  const rows = storeId
    ? await db.commerce_ledger.where('storeId').equals(storeId).toArray()
    : await db.commerce_ledger.toArray();
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function appendLedgerEntry(entry) {
  const record = {
    ...entry,
    id: entry.id || `led_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  await db.commerce_ledger.put(record);
  return record;
}

export async function listCampaigns(storeId) {
  if (!storeId) return [];
  const rows = await db.commerce_campaigns.where('storeId').equals(storeId).toArray();
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function saveCampaign(campaign) {
  const record = {
    ...campaign,
    id: campaign.id || `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: campaign.createdAt || new Date().toISOString(),
  };
  await db.commerce_campaigns.put(record);
  return record;
}

export async function listDomains(storeId) {
  if (!storeId) return [];
  return await db.commerce_domains.where('storeId').equals(storeId).toArray();
}

export async function saveDomainRecord(rec) {
  const record = {
    ...rec,
    id: rec.id || `dom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    updatedAt: new Date().toISOString(),
  };
  await db.commerce_domains.put(record);
  return record;
}

/**
 * Publish a cryptographically Ed25519-signed storefront directly onto the `.nova` Sovereign Mesh.
 */
export async function publishStoreToNovaMesh(storeId) {
  const store = await db.commerce_stores.get(storeId);
  if (!store) throw new Error('Store not found.');
  const products = await listStoreProducts(storeId);
  const railSettings = getPaymentRailSettings();
  const apiBaseUrl = railSettings.liveBackendUrl
    ? `${String(railSettings.liveBackendUrl).replace(/\/+$/, '')}/api/stores/${store.slug}`
    : '';

  const htmlContent = buildStandaloneStorefrontHtml({
    store,
    products,
    mode: 'mesh',
    apiBaseUrl,
  });

  const { publishHostedSite } = await import('../sovereignMesh.js');
  const meshDomain = store.meshDomain || `${store.slug}.nova`;
  const siteRecord = await publishHostedSite({
    domain: meshDomain,
    title: `${store.name} — Sovereign Storefront`,
    favicon: '🛍️',
    category: 'Commerce & Storefronts',
    htmlContent,
    isPinned: true,
  });

  const updated = await saveStore({
    ...store,
    meshDomain: siteRecord.domain,
    meshCid: siteRecord.cid,
    status: store.customDomain ? 'live' : 'published_mesh',
  });

  return { store: updated, siteRecord, htmlLength: htmlContent.length };
}

/**
 * Export all Sovereign Commerce stores + products as a deployable 24/7 multi-tenant ZIP archive.
 */
export async function exportDeployableServerZip({ platformHost = DEFAULT_PLATFORM_HOST } = {}) {
  const stores = await listStores();
  const productsByStoreId = {};
  for (const s of stores) {
    productsByStoreId[s.id] = await listStoreProducts(s.id);
  }
  const files = buildDeployableCommerceServerBundle({ stores, productsByStoreId, platformHost });
  const { buildZip } = await import('../zipService.js');
  const bytes = buildZip(files.map(f => ({ name: f.path, data: new TextEncoder().encode(f.content) })));
  return { bytes, files };
}

/**
 * Run an incoming paid order through all fulfillment guardrails, optionally submit live supplier purchase,
 * and write immutable double-entry ledger records including the 5% net-profit platform split.
 */
export async function processOrderThroughGuardrails({
  store,
  order,
  liveSupplierQuote = null,
  supplierCredentials = null,
  settlementStatus = 'pending',
  autoSubmitSupplier = true,
}) {
  const existingOrders = await listStoreOrders(store.id);
  const existingIds = new Set(existingOrders.map(o => o.externalPaymentId).filter(Boolean));
  const check = evaluateFulfillmentGuardrails({
    order,
    existingOrderIds: existingIds,
    liveSupplierQuote,
    storePricingPolicy: store.pricingPolicy || {},
    fundingMode: store.fundingMode || 'instant_float',
    settlementStatus,
  });

  if (!check.approved) {
    const heldOrder = await saveOrder({
      ...order,
      storeId: store.id,
      status: check.status,
      guardrailReason: check.reason,
      settlement: check.settlement || order.settlement || null,
    });
    return { order: heldOrder, decision: check };
  }

  let supplierOrderId = order.supplierOrderId || '';
  let finalStatus = 'PAID_READY_TO_FULFILL';
  let supplierNote = '';

  const primarySupplier = order.items?.[0]?.supplier || 'unlinked';
  if (autoSubmitSupplier && primarySupplier !== 'unlinked') {
    const creds = supplierCredentials || getSupplierCredentials()[primarySupplier];
    try {
      const submitted = await submitSupplierOrder(primarySupplier, {
        order,
        items: order.items,
        credentials: creds,
      });
      supplierOrderId = submitted.supplierOrderId;
      finalStatus = 'ORDERED_WITH_SUPPLIER';
    } catch (err) {
      finalStatus = 'FAILED_SUPPLIER_ERROR';
      supplierNote = err?.message || 'Supplier API rejected order.';
    }
  }

  const savedOrder = await saveOrder({
    ...order,
    storeId: store.id,
    status: finalStatus,
    supplierOrderId,
    guardrailReason: supplierNote || check.reason,
    settlement: check.settlement,
  });

  const s = check.settlement;
  await Promise.all([
    appendLedgerEntry({ storeId: store.id, orderId: savedOrder.id, type: 'sale_gross', rail: savedOrder.rail, amountCents: s.grossRevenueCents }),
    appendLedgerEntry({ storeId: store.id, orderId: savedOrder.id, type: 'gateway_fee', rail: savedOrder.rail, amountCents: -s.gatewayFeeCents }),
    appendLedgerEntry({ storeId: store.id, orderId: savedOrder.id, type: 'supplier_purchase', rail: savedOrder.rail, amountCents: -s.supplierCostCents }),
    appendLedgerEntry({ storeId: store.id, orderId: savedOrder.id, type: 'shipping_cost', rail: savedOrder.rail, amountCents: -s.supplierShippingCents }),
    appendLedgerEntry({ storeId: store.id, orderId: savedOrder.id, type: 'platform_profit_fee_5pct', rail: savedOrder.rail, amountCents: s.platformProfitFeeCents }),
  ]);

  return { order: savedOrder, decision: check };
}

/**
 * Refund an order and proportionally reverse the 5% platform net-profit fee.
 */
export async function refundStoreOrder({ store, order, refundAmountCents }) {
  const targetRefund = refundAmountCents ?? order.settlement?.grossChargedCents ?? order.subtotalCents ?? 0;
  const calc = computeProportionalRefund({
    orderSettlement: order.settlement || { grossChargedCents: targetRefund, platformProfitFeeCents: 0 },
    refundAmountCents: targetRefund,
  });

  const updated = await saveOrder({
    ...order,
    status: 'REFUNDED',
    refundedCents: calc.refundAmountCents,
    refundedPlatformFeeCents: calc.refundPlatformFeeCents,
  });

  await appendLedgerEntry({
    storeId: store.id,
    orderId: order.id,
    type: 'refund',
    rail: order.rail || 'square',
    amountCents: -calc.refundAmountCents,
  });

  if (calc.refundPlatformFeeCents > 0) {
    await appendLedgerEntry({
      storeId: store.id,
      orderId: order.id,
      type: 'platform_profit_fee_5pct',
      rail: order.rail || 'square',
      amountCents: -calc.refundPlatformFeeCents,
    });
  }

  return { order: updated, refund: calc };
}

