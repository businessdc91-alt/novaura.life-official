/**
 * NovAura Sovereign Commerce — Integer-Cent Pricing, 5% Profit Split & Fulfillment Guardrail Engine
 * All currency math uses integer cents to prevent floating-point drift.
 */

export const PLATFORM_PROFIT_FEE_PCT = 5;

export const GATEWAY_FEE_PROFILES = Object.freeze({
  square: {
    id: 'square',
    label: 'Square (Cards + Cash App Pay + Square Checking)',
    pct: 0.029,
    fixedCents: 30,
    supportsCashAppPay: true,
    supportsVenmo: false,
    instantDebitRail: 'Square Checking Debit',
  },
  stripe: {
    id: 'stripe',
    label: 'Stripe (Cards + Apple Pay + Cash App Pay)',
    pct: 0.029,
    fixedCents: 30,
    supportsCashAppPay: true,
    supportsVenmo: false,
    instantDebitRail: 'Stripe Instant / Card Float',
  },
  paypal: {
    id: 'paypal',
    label: 'PayPal Commerce (Cards + PayPal + Venmo)',
    pct: 0.0349,
    fixedCents: 49,
    supportsCashAppPay: false,
    supportsVenmo: true,
    instantDebitRail: 'PayPal Business Debit',
  },
});

export function getGatewayProfile(rail = 'square') {
  return GATEWAY_FEE_PROFILES[rail] || GATEWAY_FEE_PROFILES.square;
}

export function estimateGatewayFeeCents(grossCents, rail = 'square') {
  const cleanGross = Math.round(Number(grossCents) || 0);
  if (cleanGross <= 0) return 0;
  const profile = getGatewayProfile(rail);
  return Math.round(cleanGross * profile.pct) + profile.fixedCents;
}

export function formatCentsUsd(cents) {
  const val = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

/**
 * Compute optimal retail price, fee breakdown, exact 5% net-profit platform split,
 * break-even CPA, and break-even ROAS for a single catalog item.
 */
export function computeProductPricing({
  wholesaleCents,
  shippingCents = 0,
  targetMarginPct = 48,
  minMarginPct = 30,
  adCpaBufferCents = 0,
  rail = 'square',
  platformFeePct = PLATFORM_PROFIT_FEE_PCT,
  psychological99 = true,
  overrideRetailCents = null,
}) {
  const wholesale = Math.max(0, Math.round(Number(wholesaleCents) || 0));
  const shipping = Math.max(0, Math.round(Number(shippingCents) || 0));
  const adBuffer = Math.max(0, Math.round(Number(adCpaBufferCents) || 0));
  const profile = getGatewayProfile(rail);
  const feePct = Math.max(0, Number(platformFeePct) || 0);

  let retailCents;
  if (overrideRetailCents !== null && overrideRetailCents !== undefined && Number(overrideRetailCents) > 0) {
    retailCents = Math.round(Number(overrideRetailCents));
  } else {
    const targetMarginRatio = Math.min(0.85, Math.max(0.05, Number(targetMarginPct) / 100));
    const denom = Math.max(0.1, 1 - profile.pct - targetMarginRatio);
    const rawRetail = Math.ceil((wholesale + shipping + adBuffer + profile.fixedCents) / denom);
    if (psychological99) {
      retailCents = Math.max(199, Math.ceil(rawRetail / 100) * 100 - 1);
    } else {
      retailCents = Math.max(100, rawRetail);
    }
  }

  const gatewayFeeCents = estimateGatewayFeeCents(retailCents, rail);
  const prePlatformProfitCents = retailCents - wholesale - shipping - gatewayFeeCents;
  // Platform takes 5% of positive NET profit only — never 5% of gross revenue.
  const platformProfitFeeCents =
    prePlatformProfitCents > 0 ? Math.round(prePlatformProfitCents * (feePct / 100)) : 0;
  const merchantNetProfitCents = prePlatformProfitCents - platformProfitFeeCents;
  const maxBreakEvenCpaCents = Math.max(0, merchantNetProfitCents);
  const breakEvenRoas =
    merchantNetProfitCents > 0 ? Number((retailCents / merchantNetProfitCents).toFixed(2)) : null;
  const effectiveMarginPct =
    retailCents > 0 ? Number(((merchantNetProfitCents / retailCents) * 100).toFixed(2)) : 0;
  const passesMinMargin = effectiveMarginPct >= Number(minMarginPct || 0) && prePlatformProfitCents > 0;

  return {
    rail: profile.id,
    wholesaleCents: wholesale,
    shippingCents: shipping,
    retailCents,
    gatewayFeeCents,
    prePlatformProfitCents,
    platformFeePct: feePct,
    platformProfitFeeCents,
    merchantNetProfitCents,
    maxBreakEvenCpaCents,
    breakEvenRoas,
    effectiveMarginPct,
    passesMinMargin,
  };
}

/**
 * Compute exact order-level settlement split (tax treated strictly as pass-through).
 */
export function computeOrderSettlement({
  subtotalCents,
  shippingCollectedCents = 0,
  taxCents = 0,
  supplierCostCents,
  supplierShippingCents = 0,
  rail = 'square',
  platformFeePct = PLATFORM_PROFIT_FEE_PCT,
}) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const shippingCollected = Math.max(0, Math.round(Number(shippingCollectedCents) || 0));
  const tax = Math.max(0, Math.round(Number(taxCents) || 0));
  const supCost = Math.max(0, Math.round(Number(supplierCostCents) || 0));
  const supShip = Math.max(0, Math.round(Number(supplierShippingCents) || 0));
  const feePct = Math.max(0, Number(platformFeePct) || 0);

  const grossRevenueCents = subtotal + shippingCollected;
  const grossChargedCents = grossRevenueCents + tax;
  const gatewayFeeCents = estimateGatewayFeeCents(grossChargedCents, rail);
  const netBeforePlatformCents = grossRevenueCents - supCost - supShip - gatewayFeeCents;
  const platformProfitFeeCents =
    netBeforePlatformCents > 0 ? Math.round(netBeforePlatformCents * (feePct / 100)) : 0;
  const merchantNetProfitCents = netBeforePlatformCents - platformProfitFeeCents;
  const effectiveMarginPct =
    grossRevenueCents > 0 ? Number(((merchantNetProfitCents / grossRevenueCents) * 100).toFixed(2)) : 0;

  return {
    rail: getGatewayProfile(rail).id,
    subtotalCents: subtotal,
    shippingCollectedCents: shippingCollected,
    taxCents: tax,
    grossRevenueCents,
    grossChargedCents,
    supplierCostCents: supCost,
    supplierShippingCents: supShip,
    gatewayFeeCents,
    netBeforePlatformCents,
    platformFeePct: feePct,
    platformProfitFeeCents,
    applicationFeeCents: platformProfitFeeCents,
    merchantNetProfitCents,
    effectiveMarginPct,
  };
}

/**
 * Calculate proportional 5% platform fee reversal on full or partial refunds.
 */
export function computeProportionalRefund({ orderSettlement, refundAmountCents }) {
  const gross = Math.max(0, Math.round(Number(orderSettlement?.grossChargedCents) || 0));
  const reqRefund = Math.max(0, Math.min(gross, Math.round(Number(refundAmountCents) || 0)));
  if (gross === 0 || reqRefund === 0) {
    return { refundAmountCents: 0, refundPlatformFeeCents: 0, ratio: 0 };
  }
  const ratio = reqRefund / gross;
  const origFee = Math.max(0, Math.round(Number(orderSettlement?.platformProfitFeeCents) || 0));
  return {
    refundAmountCents: reqRefund,
    refundPlatformFeeCents: Math.round(origFee * ratio),
    ratio: Number(ratio.toFixed(6)),
  };
}

function hasValidShippingAddress(shipping = {}) {
  if (!shipping || typeof shipping !== 'object') return false;
  const name = String(shipping.name || '').trim();
  const address1 = String(shipping.address1 || '').trim();
  const city = String(shipping.city || '').trim();
  const postalCode = String(shipping.postalCode || '').trim();
  const country = String(shipping.country || '').trim().toUpperCase();
  return Boolean(name && address1 && city && postalCode && /^[A-Z]{2}$/.test(country));
}

/**
 * Evaluate automated fulfillment guardrails before calling any paid supplier API.
 */
export function evaluateFulfillmentGuardrails({
  order,
  existingOrderIds = new Set(),
  liveSupplierQuote = null,
  storePricingPolicy = {},
  fundingMode = 'instant_float',
  settlementStatus = 'pending',
}) {
  if (!order || typeof order !== 'object') {
    return { approved: false, status: 'HOLD_INVALID_ORDER', reason: 'Missing order object.' };
  }

  if (order.externalPaymentId && existingOrderIds.has(order.externalPaymentId)) {
    return {
      approved: false,
      status: 'DUPLICATE_IGNORED',
      reason: `Payment idempotency lock: ${order.externalPaymentId} already processed.`,
    };
  }

  if (order.riskLevel === 'elevated' || order.riskLevel === 'highest') {
    return {
      approved: false,
      status: 'HOLD_RISK_REVIEW',
      reason: `Payment fraud risk flagged (${order.riskLevel}); paused for operator review.`,
    };
  }

  if (!hasValidShippingAddress(order.shipping)) {
    return {
      approved: false,
      status: 'HOLD_ADDRESS_INVALID',
      reason: 'Customer shipping address is incomplete or missing 2-letter ISO country code.',
    };
  }

  if (fundingMode === 'hold_until_settled' && settlementStatus !== 'settled') {
    return {
      approved: false,
      status: 'HOLD_AWAITING_SETTLEMENT',
      reason: 'Store is set to Hold-Until-Settled mode; waiting for gateway payout confirmation.',
    };
  }

  const totalQty = Array.isArray(order.items) && order.items.length > 0
    ? order.items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)
    : 1;

  if (liveSupplierQuote && Number.isFinite(Number(liveSupplierQuote.stock))) {
    if (Number(liveSupplierQuote.stock) < totalQty) {
      return {
        approved: false,
        status: 'HOLD_OUT_OF_STOCK',
        reason: `Supplier stock (${liveSupplierQuote.stock}) is below ordered quantity (${totalQty}).`,
      };
    }
  }

  const supplierCostCents =
    liveSupplierQuote?.wholesaleCents !== undefined
      ? Math.round(Number(liveSupplierQuote.wholesaleCents)) * totalQty
      : Math.round(Number(order.supplierCostCents) || 0);
  const supplierShippingCents =
    liveSupplierQuote?.shippingCents !== undefined
      ? Math.round(Number(liveSupplierQuote.shippingCents))
      : Math.round(Number(order.supplierShippingCents) || 0);

  const settlement = computeOrderSettlement({
    subtotalCents: order.subtotalCents,
    shippingCollectedCents: order.shippingCollectedCents || 0,
    taxCents: order.taxCents || 0,
    supplierCostCents,
    supplierShippingCents,
    rail: order.rail || 'square',
    platformFeePct: storePricingPolicy.platformFeePct ?? PLATFORM_PROFIT_FEE_PCT,
  });

  const minMarginPct = Number(storePricingPolicy.minMarginPct ?? 20);
  if (settlement.netBeforePlatformCents <= 0 || settlement.effectiveMarginPct < minMarginPct) {
    return {
      approved: false,
      status: 'HOLD_MARGIN_BREACH',
      reason: `Effective margin ${settlement.effectiveMarginPct}% is below minimum circuit breaker (${minMarginPct}%).`,
      settlement,
    };
  }

  return {
    approved: true,
    status: 'AUTO_PURCHASE',
    reason: 'All risk, settlement, stock, and margin guardrails passed.',
    settlement,
  };
}

/**
 * Summarize immutable ledger entries into a multi-store / single-store P&L statement.
 */
export function summarizeLedger(entries = []) {
  const out = {
    grossRevenueCents: 0,
    supplierCostCents: 0,
    shippingCostCents: 0,
    gatewayFeesCents: 0,
    adSpendCents: 0,
    refundsCents: 0,
    platformProfitFeeCents: 0,
    domainRevenueCents: 0,
    merchantNetProfitCents: 0,
    orderCount: 0,
  };

  const orderIds = new Set();
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const amt = Math.round(Number(e.amountCents) || 0);
    if (e.orderId) orderIds.add(e.orderId);
    switch (e.type) {
      case 'sale_gross':
        out.grossRevenueCents += amt;
        break;
      case 'supplier_purchase':
        out.supplierCostCents += Math.abs(amt);
        break;
      case 'shipping_cost':
        out.shippingCostCents += Math.abs(amt);
        break;
      case 'gateway_fee':
        out.gatewayFeesCents += Math.abs(amt);
        break;
      case 'ad_spend':
        out.adSpendCents += Math.abs(amt);
        break;
      case 'refund':
        out.refundsCents += Math.abs(amt);
        break;
      case 'platform_profit_fee_5pct':
        out.platformProfitFeeCents += amt;
        break;
      case 'domain_registration':
        out.domainRevenueCents += amt;
        break;
      default:
        break;
    }
  }

  out.orderCount = orderIds.size;
  out.merchantNetProfitCents =
    out.grossRevenueCents -
    out.supplierCostCents -
    out.shippingCostCents -
    out.gatewayFeesCents -
    out.adSpendCents -
    out.refundsCents -
    out.platformProfitFeeCents;

  return out;
}

