/**
 * NovAura Sovereign Commerce — Multi-Rail Payment & Webhook Signature Verification Adapters
 * Supports Square (Cards + Cash App Pay + Square Checking), Stripe (Cards + Apple Pay + Cash App Pay),
 * and PayPal Commerce (Cards + PayPal + Venmo) with 5% net-profit platform fee split.
 */

export const PAYMENT_RAILS = Object.freeze([
  {
    id: 'square',
    name: 'Square + Cash App Pay',
    methods: ['Visa / Mastercard / Amex', 'Apple Pay', 'Google Pay', 'Cash App Pay'],
    settlementPath: 'Square Checking Debit Card (near-instant settled funds)',
    supportsNativePlatformSplit: true,
    credentialFields: ['accessToken', 'locationId', 'webhookSignatureKey'],
  },
  {
    id: 'stripe',
    name: 'Stripe + Cash App Pay',
    methods: ['Cards', 'Apple Pay', 'Google Pay', 'Cash App Pay', 'Link'],
    settlementPath: 'Stripe Connect Express + Business Card Float / Payout Webhook',
    supportsNativePlatformSplit: true,
    credentialFields: ['secretKey', 'webhookSecret', 'connectAccountId'],
  },
  {
    id: 'paypal',
    name: 'PayPal Commerce + Venmo',
    methods: ['PayPal', 'Venmo', 'Cards'],
    settlementPath: 'PayPal Business Debit Card + Automated Package Tracking Sync',
    supportsNativePlatformSplit: true,
    credentialFields: ['clientId', 'clientSecret', 'webhookId'],
  },
]);

function timingSafeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function hexToBytes(hex) {
  const clean = String(hex || '').trim().toLowerCase();
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/.test(clean)) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

async function hmacSha256Bytes(secret, message) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(String(message)));
  return new Uint8Array(sig);
}

/**
 * Square Online Checkout Payment Link payload (Cards + Apple Pay + Cash App Pay + 5% net-profit app_fee_money).
 */
export function buildSquareCheckoutPayload({
  store,
  order,
  settlement,
  redirectUrl,
  locationId,
  connectMerchantId = '',
}) {
  const lineItems = (order.items || []).map(it => ({
    name: String(it.title || it.sku || 'Item'),
    quantity: String(Math.max(1, Math.round(Number(it.quantity) || 1))),
    base_price_money: {
      amount: Math.max(100, Math.round(Number(it.unitRetailCents) || 0)),
      currency: 'USD',
    },
  }));

  if (Number(order.shippingCollectedCents) > 0) {
    lineItems.push({
      name: 'Standard Shipping',
      quantity: '1',
      base_price_money: {
        amount: Math.round(Number(order.shippingCollectedCents)),
        currency: 'USD',
      },
    });
  }

  const payload = {
    idempotency_key: String(order.id || `sq_${Date.now()}`),
    description: `${store?.name || 'NovAura Store'} — Order ${order.id}`,
    order: {
      location_id: String(locationId || store?.railConfig?.squareLocationId || ''),
      reference_id: String(order.id || ''),
      line_items: lineItems,
    },
    checkout_options: {
      allow_tipping: false,
      redirect_url: redirectUrl,
      accepted_payment_methods: {
        apple_pay: true,
        google_pay: true,
        cash_app_pay: true,
        afterpay_clearpay: false,
      },
      ask_for_shipping_address: true,
    },
  };

  if (connectMerchantId && settlement?.platformProfitFeeCents > 0) {
    payload.checkout_options.app_fee_money = {
      amount: settlement.platformProfitFeeCents,
      currency: 'USD',
    };
  }

  return payload;
}

/**
 * Stripe Checkout Session params (Cards + Cash App Pay + Link + 5% net-profit application_fee_amount).
 */
export function buildStripeCheckoutParams({
  store,
  order,
  settlement,
  successUrl,
  cancelUrl,
  connectAccountId = '',
}) {
  const params = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ['card', 'cashapp', 'link'],
    shipping_address_collection: {
      allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
    },
    client_reference_id: String(order.id || ''),
    metadata: {
      storeId: String(store?.id || ''),
      storeSlug: String(store?.slug || ''),
      orderId: String(order.id || ''),
      platformFeePct: '5',
      platformProfitFeeCents: String(settlement?.platformProfitFeeCents || 0),
    },
    line_items: (order.items || []).map(it => ({
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      price_data: {
        currency: 'usd',
        unit_amount: Math.max(50, Math.round(Number(it.unitRetailCents) || 0)),
        product_data: {
          name: String(it.title || it.sku || 'Product'),
          metadata: { sku: String(it.sku || '') },
        },
      },
    })),
  };

  if (connectAccountId && settlement?.platformProfitFeeCents > 0) {
    params.payment_intent_data = {
      application_fee_amount: settlement.platformProfitFeeCents,
      transfer_data: {
        destination: connectAccountId,
      },
    };
  }

  return params;
}

/**
 * PayPal Orders v2 payload (PayPal + Venmo + Cards + 5% net-profit platform_fees split).
 */
export function buildPayPalOrderPayload({
  store,
  order,
  settlement,
  returnUrl,
  cancelUrl,
  merchantPayerId = '',
}) {
  const totalAmount = ((Math.max(100, Number(settlement?.grossChargedCents || order.subtotalCents || 0))) / 100).toFixed(2);
  const purchaseUnit = {
    reference_id: String(order.id || ''),
    custom_id: String(store?.slug || ''),
    description: `${store?.name || 'NovAura Store'} Order`,
    amount: {
      currency_code: 'USD',
      value: totalAmount,
    },
  };

  if (merchantPayerId && settlement?.platformProfitFeeCents > 0) {
    purchaseUnit.payee = { merchant_id: merchantPayerId };
    purchaseUnit.payment_instruction = {
      disbursement_mode: 'INSTANT',
      platform_fees: [
        {
          amount: {
            currency_code: 'USD',
            value: (settlement.platformProfitFeeCents / 100).toFixed(2),
          },
        },
      ],
    };
  }

  return {
    intent: 'CAPTURE',
    purchase_units: [purchaseUnit],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: String(store?.name || 'NovAura Store'),
          shipping_preference: 'GET_FROM_FILE',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };
}

/**
 * Build PayPal Package Tracking sync payload (accelerates release of new-merchant settlement holds).
 */
export function buildPayPalTrackingPayload({ captureId, trackingNumber, carrier = 'USPS' }) {
  if (!captureId || !trackingNumber) {
    throw new Error('captureId and trackingNumber are required to sync PayPal tracking.');
  }
  return {
    trackers: [
      {
        capture_id: String(captureId),
        tracking_number: String(trackingNumber),
        status: 'SHIPPED',
        carrier: String(carrier || 'OTHER').toUpperCase(),
        notify_buyer: true,
      },
    ],
  };
}

/**
 * Verify Stripe-Signature HMAC-SHA256 header (`t=...,v1=...`) with replay window check.
 */
export async function verifyStripeWebhookSignature({
  rawBody,
  signatureHeader,
  webhookSecret,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
}) {
  if (!rawBody || !signatureHeader || !webhookSecret) return false;
  const parts = String(signatureHeader).split(',').map(p => p.trim());
  let timestamp = null;
  const v1Sigs = [];

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === 't') timestamp = Number(v);
    if (k === 'v1' && v) v1Sigs.push(v);
  }

  if (!Number.isFinite(timestamp) || v1Sigs.length === 0) return false;
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false;

  const expectedBytes = await hmacSha256Bytes(webhookSecret, `${timestamp}.${rawBody}`);
  for (const hexSig of v1Sigs) {
    const candidate = hexToBytes(hexSig);
    if (candidate && timingSafeEqualBytes(expectedBytes, candidate)) {
      return true;
    }
  }
  return false;
}

/**
 * Verify Square `x-square-hmacsha256-signature` header over `notificationUrl + rawBody`.
 */
export async function verifySquareWebhookSignature({
  notificationUrl,
  rawBody,
  signatureHeader,
  signatureKey,
}) {
  if (!notificationUrl || rawBody === undefined || !signatureHeader || !signatureKey) {
    return false;
  }
  const digestBytes = await hmacSha256Bytes(signatureKey, `${notificationUrl}${rawBody}`);
  const expectedB64 = bytesToBase64(digestBytes);
  const enc = new TextEncoder();
  return timingSafeEqualBytes(enc.encode(expectedB64), enc.encode(String(signatureHeader).trim()));
}

