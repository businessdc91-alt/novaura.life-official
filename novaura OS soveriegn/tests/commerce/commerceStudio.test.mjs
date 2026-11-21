import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  computeProductPricing,
  computeOrderSettlement,
  computeProportionalRefund,
  evaluateFulfillmentGuardrails,
  summarizeLedger,
  PLATFORM_PROFIT_FEE_PCT,
} from '../../src/services/commerce/pricingEngine.js';
import {
  sanitizeStoreSlug,
  buildStoreRoutes,
  generateCheapestDomainCandidates,
  checkDomainAvailability,
} from '../../src/services/commerce/domainService.js';
import {
  buildSquareCheckoutPayload,
  buildStripeCheckoutParams,
  buildPayPalOrderPayload,
  buildPayPalTrackingPayload,
  verifyStripeWebhookSignature,
  verifySquareWebhookSignature,
} from '../../src/services/commerce/paymentAdapters.js';
import {
  buildSupplierOrderPayload,
  searchSupplierCatalog,
  parseWholesaleCsv,
} from '../../src/services/commerce/supplierAdapters.js';
import {
  escapeHtml,
  buildStandaloneStorefrontHtml,
  buildDeployableCommerceServerBundle,
} from '../../src/services/commerce/storefrontBuilder.js';

// ── 1. Pricing Engine, 5% Net-Profit Split & Fulfillment Guardrails ───────────

test('pricingEngine computes integer-cent markup and exact 5% net-profit split (not 5% gross)', () => {
  assert.equal(PLATFORM_PROFIT_FEE_PCT, 5);

  const p = computeProductPricing({
    wholesaleCents: 1500,
    shippingCents: 500,
    overrideRetailCents: 5000,
    rail: 'stripe',
  });
  // Gateway fee on $50.00 = round(5000 * 0.029) + 30 = 175 cents
  assert.equal(p.gatewayFeeCents, 175);
  // Pre-platform profit = 5000 - 1500 - 500 - 175 = 2825 cents
  assert.equal(p.prePlatformProfitCents, 2825);
  // 5% of NET profit = round(2825 * 0.05) = 141 cents (NOT 5% of $50 gross = 250 cents!)
  assert.equal(p.platformProfitFeeCents, 141);
  assert.equal(p.merchantNetProfitCents, 2684);
  assert.ok(p.breakEvenRoas > 1 && p.breakEvenRoas < 3);

  // Unprofitable item must owe $0 platform profit fee
  const loss = computeProductPricing({
    wholesaleCents: 2500,
    shippingCents: 500,
    overrideRetailCents: 2000,
    rail: 'square',
  });
  assert.equal(loss.platformProfitFeeCents, 0);
  assert.equal(loss.passesMinMargin, false);

  // Auto-priced item rounds cleanly to .99
  const autoPriced = computeProductPricing({
    wholesaleCents: 1200,
    shippingCents: 400,
    targetMarginPct: 48,
    psychological99: true,
  });
  assert.equal(autoPriced.retailCents % 100, 99);
  assert.equal(autoPriced.passesMinMargin, true);
});

test('computeOrderSettlement excludes pass-through tax from profit and computeProportionalRefund reverses 5% fee', () => {
  const s = computeOrderSettlement({
    subtotalCents: 5000,
    shippingCollectedCents: 500,
    taxCents: 440,
    supplierCostCents: 1800,
    supplierShippingCents: 450,
    rail: 'square',
  });
  // Tax is pass-through, not revenue or profit
  assert.equal(s.grossRevenueCents, 5500);
  assert.equal(s.grossChargedCents, 5940);
  assert.equal(s.platformProfitFeeCents, Math.round(s.netBeforePlatformCents * 0.05));
  assert.equal(s.applicationFeeCents, s.platformProfitFeeCents);

  const halfRefund = computeProportionalRefund({
    orderSettlement: s,
    refundAmountCents: Math.round(s.grossChargedCents / 2),
  });
  assert.equal(halfRefund.refundPlatformFeeCents, Math.round(s.platformProfitFeeCents * halfRefund.ratio));

  const fullRefund = computeProportionalRefund({
    orderSettlement: s,
    refundAmountCents: s.grossChargedCents,
  });
  assert.equal(fullRefund.refundPlatformFeeCents, s.platformProfitFeeCents);
});

test('evaluateFulfillmentGuardrails enforces all circuit breakers and allows clean orders', () => {
  const baseOrder = {
    id: 'ord_1',
    externalPaymentId: 'pay_abc123',
    rail: 'square',
    riskLevel: 'normal',
    subtotalCents: 5499,
    shippingCollectedCents: 0,
    supplierCostCents: 1500,
    supplierShippingCents: 450,
    items: [{ sku: 'MAT-01', quantity: 1 }],
    shipping: {
      name: 'Alex Mercer',
      address1: '742 Evergreen Terrace',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
  };

  // 1. Duplicate idempotency lock
  const dup = evaluateFulfillmentGuardrails({
    order: baseOrder,
    existingOrderIds: new Set(['pay_abc123']),
  });
  assert.equal(dup.approved, false);
  assert.equal(dup.status, 'DUPLICATE_IGNORED');

  // 2. Fraud risk gate
  const fraud = evaluateFulfillmentGuardrails({
    order: { ...baseOrder, riskLevel: 'elevated' },
  });
  assert.equal(fraud.approved, false);
  assert.equal(fraud.status, 'HOLD_RISK_REVIEW');

  // 3. Invalid shipping address
  const badAddr = evaluateFulfillmentGuardrails({
    order: { ...baseOrder, shipping: { name: 'Alex', country: 'USA' } },
  });
  assert.equal(badAddr.approved, false);
  assert.equal(badAddr.status, 'HOLD_ADDRESS_INVALID');

  // 4. Hold-Until-Settled mode (true $0 float)
  const unsettled = evaluateFulfillmentGuardrails({
    order: baseOrder,
    fundingMode: 'hold_until_settled',
    settlementStatus: 'pending',
  });
  assert.equal(unsettled.approved, false);
  assert.equal(unsettled.status, 'HOLD_AWAITING_SETTLEMENT');

  // 5. Supplier OOS check
  const oos = evaluateFulfillmentGuardrails({
    order: baseOrder,
    liveSupplierQuote: { stock: 0, wholesaleCents: 1500, shippingCents: 450 },
  });
  assert.equal(oos.approved, false);
  assert.equal(oos.status, 'HOLD_OUT_OF_STOCK');

  // 6. Supplier price spike circuit breaker
  const spike = evaluateFulfillmentGuardrails({
    order: baseOrder,
    liveSupplierQuote: { stock: 50, wholesaleCents: 4900, shippingCents: 600 },
    storePricingPolicy: { minMarginPct: 25 },
  });
  assert.equal(spike.approved, false);
  assert.equal(spike.status, 'HOLD_MARGIN_BREACH');

  // 7. Clean pass
  const ok = evaluateFulfillmentGuardrails({
    order: baseOrder,
    liveSupplierQuote: { stock: 20, wholesaleCents: 1500, shippingCents: 450 },
    storePricingPolicy: { minMarginPct: 25 },
    fundingMode: 'hold_until_settled',
    settlementStatus: 'settled',
  });
  assert.equal(ok.approved, true);
  assert.equal(ok.status, 'AUTO_PURCHASE');
  assert.ok(ok.settlement.platformProfitFeeCents > 0);
});

test('summarizeLedger aggregates revenue, COGS, fees, ad spend, 5% split, and merchant net profit', () => {
  const pnl = summarizeLedger([
    { orderId: 'o1', type: 'sale_gross', amountCents: 5000 },
    { orderId: 'o1', type: 'gateway_fee', amountCents: -175 },
    { orderId: 'o1', type: 'supplier_purchase', amountCents: -1500 },
    { orderId: 'o1', type: 'shipping_cost', amountCents: -500 },
    { orderId: 'o1', type: 'platform_profit_fee_5pct', amountCents: 141 },
    { type: 'ad_spend', amountCents: -800 },
  ]);
  assert.equal(pnl.grossRevenueCents, 5000);
  assert.equal(pnl.platformProfitFeeCents, 141);
  assert.equal(pnl.merchantNetProfitCents, 5000 - 175 - 1500 - 500 - 141 - 800);
});

// ── 2. Cheapest-TLD Domain Service & Dual Hosting Subpath Router ──────────────

test('domainService builds novaura.xyz/<slug>/storefront/merchandise, custom TLD, mesh routes & cheapest TLDs', async () => {
  assert.equal(sanitizeStoreSlug('Ecchi Bonanza!'), 'ecchi-bonanza');
  assert.equal(sanitizeStoreSlug('api'), 'api-store');

  const routes = buildStoreRoutes({
    slug: 'ecchibonanza',
    customDomain: 'ecchibonanza.xyz',
    platformHost: 'novaura.xyz',
  });
  assert.equal(routes.subpath.merchandiseUrl, 'https://novaura.xyz/ecchibonanza/storefront/merchandise');
  assert.equal(routes.customTld.homeUrl, 'https://ecchibonanza.xyz/');
  assert.equal(routes.mesh.url, 'nova://ecchibonanza.nova');

  const candidates = generateCheapestDomainCandidates({
    storeName: 'Ecchi Bonanza',
    niche: 'anime collectibles',
    tldMarkupCents: 250,
    maxResults: 8,
  });
  assert.equal(candidates[0].tld, '.xyz');
  assert.equal(candidates[0].customerPriceCents, candidates[0].estimatedWholesaleCents + 250);

  // RDAP 404 => available, 200 => taken
  const rdapAvail = await checkDomainAvailability({
    domain: 'ecchibonanza.xyz',
    registrar: 'rdap',
    fetchImpl: async () => ({ status: 404, ok: false }),
  });
  assert.equal(rdapAvail.available, true);
  assert.equal(rdapAvail.priceSource, 'rdap_availability_only');

  const porkbunLive = await checkDomainAvailability({
    domain: 'ecchibonanza.xyz',
    registrar: 'porkbun',
    credentials: { apiKey: 'pk', secretApiKey: 'sk' },
    tldMarkupCents: 200,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'SUCCESS', response: { avail: 'yes', price: '2.10' } }),
    }),
  });
  assert.equal(porkbunLive.available, true);
  assert.equal(porkbunLive.wholesaleCents, 210);
  assert.equal(porkbunLive.customerPriceCents, 410);
  assert.equal(porkbunLive.priceSource, 'porkbun_live');
});

// ── 3. Multi-Rail Payment Payloads & HMAC Webhook Verification ────────────────

test('paymentAdapters verifies Stripe & Square HMAC-SHA256 webhooks and injects 5% net-profit split', async () => {
  const secret = 'whsec_test_secret_123';
  const rawBody = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const nowSec = 1760000000;
  const sigHex = crypto.createHmac('sha256', secret).update(`${nowSec}.${rawBody}`).digest('hex');

  assert.equal(
    await verifyStripeWebhookSignature({ rawBody, signatureHeader: `t=${nowSec},v1=${sigHex}`, webhookSecret: secret, nowSec }),
    true
  );
  assert.equal(
    await verifyStripeWebhookSignature({ rawBody: rawBody + ' ', signatureHeader: `t=${nowSec},v1=${sigHex}`, webhookSecret: secret, nowSec }),
    false
  );
  assert.equal(
    await verifyStripeWebhookSignature({ rawBody, signatureHeader: `t=${nowSec - 600},v1=${sigHex}`, webhookSecret: secret, nowSec }),
    false,
    'expired replay timestamp must fail'
  );

  const sqUrl = 'https://novaura.xyz/api/webhooks/square';
  const sqKey = 'sq_sig_key_456';
  const sqSig = crypto.createHmac('sha256', sqKey).update(`${sqUrl}${rawBody}`).digest('base64');
  assert.equal(
    await verifySquareWebhookSignature({ notificationUrl: sqUrl, rawBody, signatureHeader: sqSig, signatureKey: sqKey }),
    true
  );
  assert.equal(
    await verifySquareWebhookSignature({ notificationUrl: sqUrl, rawBody: '{}', signatureHeader: sqSig, signatureKey: sqKey }),
    false
  );

  const settlement = computeOrderSettlement({ subtotalCents: 5000, supplierCostCents: 1500, supplierShippingCents: 500, rail: 'square' });
  const order = { id: 'ord_99', items: [{ title: 'Desk Mat', sku: 'DM-1', quantity: 1, unitRetailCents: 5000 }] };
  const store = { id: 's1', slug: 'ecchibonanza', name: 'Ecchi Bonanza' };

  const sq = buildSquareCheckoutPayload({ store, order, settlement, redirectUrl: 'https://novaura.xyz/ok', locationId: 'LOC1', connectMerchantId: 'M1' });
  assert.equal(sq.checkout_options.accepted_payment_methods.cash_app_pay, true);
  assert.equal(sq.checkout_options.app_fee_money.amount, settlement.platformProfitFeeCents);

  const st = buildStripeCheckoutParams({ store, order, settlement, successUrl: 'https://novaura.xyz/ok', cancelUrl: 'https://novaura.xyz/no', connectAccountId: 'acct_123' });
  assert.ok(st.payment_method_types.includes('cashapp'));
  assert.equal(st.payment_intent_data.application_fee_amount, settlement.platformProfitFeeCents);

  const pp = buildPayPalOrderPayload({ store, order, settlement, returnUrl: 'https://novaura.xyz/ok', cancelUrl: 'https://novaura.xyz/no', merchantPayerId: 'PAYER1' });
  assert.equal(pp.purchase_units[0].payment_instruction.platform_fees[0].amount.value, (settlement.platformProfitFeeCents / 100).toFixed(2));

  const track = buildPayPalTrackingPayload({ captureId: 'CAP1', trackingNumber: '9400111899223', carrier: 'USPS' });
  assert.equal(track.trackers[0].capture_id, 'CAP1');
});

// ── 4. Real Supplier Adapters & Wholesale CSV Parser ──────────────────────────

test('supplierAdapters builds customer-populated order payloads across all 5 adapters & fails honestly when unconfigured', async () => {
  const order = {
    id: 'ord_77',
    shipping: {
      name: 'Sora Takahashi',
      email: 'sora@example.com',
      phone: '+15125550101',
      address1: '100 Congress Ave',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
  };
  const items = [{ sku: 'SKU-42', supplierProductId: '9001', variantId: '9001-L', quantity: 2 }];

  const cj = buildSupplierOrderPayload('cjdropshipping', { order, items });
  assert.equal(cj.shippingCustomerName, 'Sora Takahashi');
  assert.equal(cj.shippingAddress, '100 Congress Ave');
  assert.equal(cj.products[0].quantity, 2);

  const pf = buildSupplierOrderPayload('printful', { order, items });
  assert.equal(pf.recipient.zip, '78701');
  assert.equal(pf.items[0].quantity, 2);

  const py = buildSupplierOrderPayload('printify', { order, items });
  assert.equal(py.address_to.first_name, 'Sora');
  assert.equal(py.address_to.last_name, 'Takahashi');

  const ae = buildSupplierOrderPayload('aliexpress', { order, items });
  assert.equal(ae.param_place_order_request4_open_api_d_t_o.logistics_address.full_name, 'Sora Takahashi');

  const cw = buildSupplierOrderPayload('custom_wholesale', { order, items });
  assert.equal(cw.shipping.postalCode, '78701');

  await assert.rejects(
    () => searchSupplierCatalog('cjdropshipping', { query: 'keyboard', credentials: {} }),
    /requires accessToken/i
  );

  const parsedCsv = parseWholesaleCsv(
    'sku,title,wholesale_usd,shipping_usd,stock,image_url,description\n' +
    'DM-1,"XL Desk Mat, Stitched",9.50,4.25,120,https://cdn.example/m.jpg,"Heavy microfiber"'
  );
  assert.equal(parsedCsv.length, 1);
  assert.equal(parsedCsv[0].title, 'XL Desk Mat, Stitched');
  assert.equal(parsedCsv[0].wholesaleCents, 950);
  assert.equal(parsedCsv[0].shippingCents, 425);
});

// ── 5. Storefront HTML XSS Escaping, Cart Isolation & Exportable server.mjs ───

test('storefrontBuilder escapes XSS, isolates cart per slug, stays under mesh limit, and emits syntax-valid server.mjs', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');

  const store = {
    id: 'store_eb',
    slug: 'ecchibonanza',
    name: 'Ecchi <script>alert(1)</script> Bonanza',
    tagline: 'Collectibles',
    niche: 'Anime Gear',
    customDomain: 'ecchibonanza.xyz',
    meshDomain: 'ecchibonanza.nova',
  };
  const products = [
    {
      id: 'p1',
      storeId: 'store_eb',
      sku: 'EB-01',
      title: 'Limited Mat <img src=x onerror=alert(1)>',
      description: 'Premium stitched mat',
      retailCents: 3999,
      wholesaleCents: 1100,
      shippingCents: 400,
      variants: ['XL', 'XXL'],
    },
  ];

  const html = buildStandaloneStorefrontHtml({ store, products, mode: 'mesh', apiBaseUrl: '' });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'store title XSS must be escaped');
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'product XSS must be escaped');
  assert.ok(html.includes("const CART_KEY = 'novaura_cart:' + BOOT.slug;"), 'cart must be tenant-scoped by slug');
  assert.ok(html.length < 400_000, 'mesh HTML must remain comfortably under MAX_SITE_HTML_CHARS');

  const bundle = buildDeployableCommerceServerBundle({
    stores: [store],
    productsByStoreId: { store_eb: products },
    platformHost: 'novaura.xyz',
  });
  const serverFile = bundle.find(f => f.path === 'server.mjs');
  assert.ok(serverFile, 'bundle must include server.mjs');
  assert.ok(serverFile.content.includes('/storefront'), 'server.mjs must implement subpath storefront router');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novaura-commerce-check-'));
  const tmpServer = path.join(tmpDir, 'server.mjs');
  try {
    fs.writeFileSync(tmpServer, serverFile.content, 'utf8');
    const res = spawnSync(process.execPath, ['--check', tmpServer], { encoding: 'utf8' });
    assert.equal(res.status, 0, `Generated server.mjs failed node --check: ${res.stderr}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

