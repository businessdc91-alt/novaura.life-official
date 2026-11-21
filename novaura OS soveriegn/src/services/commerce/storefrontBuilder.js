/**
 * NovAura Sovereign Commerce — Dual-Target Storefront HTML Builder & Deployable 24/7 Server Bundle
 * Generates:
 *  1) Self-contained XSS-escaped HTML storefront for `.nova` Mesh (`publishHostedSite`),
 *     platform subpath (`novaura.xyz/<slug>/storefront/merchandise`), and custom TLD root hosting.
 *  2) Zero-dependency Node.js 20+/22+ multi-tenant production server ZIP (`server.mjs`, `seed.json`,
 *     `package.json`, `Dockerfile`, `.env.example`, `README.md`).
 */

import { sanitizeStoreSlug, DEFAULT_PLATFORM_HOST } from './domainService.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Render a responsive, tenant-isolated standalone HTML storefront.
 * Keeps output well under Sovereign `.nova` mesh size cap (~448 KB).
 */
export function buildStandaloneStorefrontHtml({
  store = {},
  products = [],
  mode = 'mesh',
  apiBaseUrl = '',
}) {
  const slug = sanitizeStoreSlug(store.slug || store.name || 'store');
  const title = escapeHtml(store.name || 'NovAura Sovereign Store');
  const tagline = escapeHtml(store.tagline || 'Curated specialty goods');
  const heroTitle = escapeHtml(store.heroTitle || store.name || 'Sovereign Storefront');
  const heroSubtitle = escapeHtml(store.heroSubtitle || tagline);
  const niche = escapeHtml(store.niche || 'Specialty Goods');
  const accent = /^#[0-9a-fA-F]{6}$/.test(store.accentColor || '') ? store.accentColor : '#06b6d4';
  const safeApiBase = String(apiBaseUrl || '').trim().replace(/\/+$/, '');

  const catalogPayload = (Array.isArray(products) ? products : []).map((p) => ({
    id: String(p.id || p.sku || ''),
    sku: String(p.sku || ''),
    title: String(p.title || 'Product'),
    category: String(p.category || store.niche || 'Featured'),
    description: String(p.description || ''),
    retailCents: Math.max(100, Math.round(Number(p.retailCents) || 1999)),
    shippingCents: Math.max(0, Math.round(Number(p.shippingCents) || 0)),
    variants: Array.isArray(p.variants) && p.variants.length ? p.variants.map(String) : ['Standard'],
    image: Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : '',
    supplierLinkStatus: String(p.supplierLinkStatus || 'draft_needs_supplier'),
    stockCount: Number(p.stockCount ?? 0),
  }));

  const bootPayload = {
    slug,
    storeName: String(store.name || 'NovAura Store'),
    mode,
    apiBaseUrl: safeApiBase,
    fundingMode: String(store.fundingMode || 'instant_float'),
    primaryRail: String(store.primaryRail || 'square'),
    products: catalogPayload,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — Storefront</title>
<style>
  :root { --accent: ${accent}; --bg: #020617; --card: #0f172a; --border: #1e293b; --text: #f8fafc; --muted: #94a3b8; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  header { position: sticky; top: 0; z-index: 20; background: rgba(2,6,23,.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .brand { font-weight: 800; font-size: 18px; letter-spacing: -.02em; display: flex; align-items: center; gap: 10px; }
  .badge { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: rgba(6,182,212,.15); color: var(--accent); border: 1px solid rgba(6,182,212,.35); font-family: monospace; }
  .btn { cursor: pointer; border: 1px solid var(--border); background: var(--card); color: var(--text); padding: 9px 14px; border-radius: 10px; font-weight: 600; font-size: 13px; transition: opacity .15s; }
  .btn-primary { background: var(--accent); color: #020617; border-color: transparent; }
  .btn:hover { opacity: .9; }
  .hero { max-width: 1120px; margin: 28px auto 12px; padding: 36px 28px; border-radius: 20px; background: linear-gradient(135deg, #0f172a 0%, #020617 100%); border: 1px solid var(--border); }
  .hero h1 { font-size: clamp(26px, 4vw, 42px); line-height: 1.1; margin-bottom: 10px; }
  .hero p { color: var(--muted); max-width: 660px; font-size: 15px; line-height: 1.5; }
  .toolbar { max-width: 1120px; margin: 18px auto; padding: 0 24px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
  .search { background: var(--card); border: 1px solid var(--border); color: var(--text); border-radius: 10px; padding: 9px 12px; font-size: 13px; min-width: 240px; }
  .grid { max-width: 1120px; margin: 0 auto 60px; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
  .thumb { height: 170px; background: #0b1224; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 12px; overflow: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .card-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .card h3 { font-size: 15px; line-height: 1.3; }
  .card p { font-size: 12px; color: var(--muted); line-height: 1.45; flex: 1; }
  .price-row { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
  .price { font-size: 18px; font-weight: 800; color: var(--accent); font-family: monospace; }
  select, input { background: #020617; color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 7px 9px; font-size: 12px; width: 100%; }
  .drawer-backdrop { position: fixed; inset: 0; background: rgba(2,6,23,.75); display: none; justify-content: flex-end; z-index: 40; }
  .drawer-backdrop.open { display: flex; }
  .drawer { width: min(440px, 100vw); background: #0b1224; border-left: 1px solid var(--border); height: 100%; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .cart-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; background: var(--card); border: 1px solid var(--border); font-size: 13px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .notice { padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.45; background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.35); color: #fcd34d; }
  .err { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.4); color: #fca5a5; }
  footer { border-top: 1px solid var(--border); padding: 20px 24px; text-align: center; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <span>${title}</span>
    <span class="badge">${niche}</span>
  </div>
  <button id="open-cart" class="btn btn-primary" type="button">Cart (<span id="cart-count">0</span>)</button>
</header>

<section class="hero">
  <h1>${heroTitle}</h1>
  <p>${heroSubtitle}</p>
</section>

<div class="toolbar">
  <input id="search-input" class="search" type="search" placeholder="Search merchandise..." />
  <span class="badge">Accepts Cards &bull; Apple Pay &bull; Cash App Pay &bull; PayPal &bull; Venmo</span>
</div>

<main id="product-grid" class="grid"></main>

<div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true">
  <aside class="drawer">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="font-size:16px;">Checkout &amp; Shipping</h2>
      <button id="close-cart" class="btn" type="button">Close</button>
    </div>
    <div id="cart-items" style="display:flex;flex-direction:column;gap:8px;"></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:6px;border-top:1px solid var(--border);">
      <span>Subtotal</span>
      <span id="cart-total">$0.00</span>
    </div>
    <form id="checkout-form" style="display:flex;flex-direction:column;gap:8px;">
      <input name="name" required placeholder="Full Name" />
      <input name="email" type="email" required placeholder="Email for tracking updates" />
      <input name="phone" placeholder="Phone (for carrier delivery)" />
      <input name="address1" required placeholder="Street Address" />
      <div class="form-grid">
        <input name="city" required placeholder="City" />
        <input name="state" required placeholder="State / Province" />
      </div>
      <div class="form-grid">
        <input name="postalCode" required placeholder="ZIP / Postal Code" />
        <input name="country" required value="US" maxlength="2" placeholder="Country (US)" />
      </div>
      <label style="font-size:11px;color:var(--muted);">Payment Rail</label>
      <select name="rail" id="rail-select">
        <option value="square">Square (Cards, Apple Pay &amp; Cash App Pay)</option>
        <option value="stripe">Stripe (Cards, Apple Pay &amp; Cash App Pay)</option>
        <option value="paypal">PayPal Commerce (PayPal &amp; Venmo)</option>
      </select>
      <div id="checkout-status"></div>
      <button class="btn btn-primary" type="submit">Proceed to Secure Checkout</button>
    </form>
  </aside>
</div>

<footer>Powered by NovAura Sovereign Commerce &bull; Verified Multi-Rail Checkout &bull; ${escapeHtml(mode)} hosting</footer>

<script>
(() => {
  const BOOT = ${safeJsonForScript(bootPayload)};
  const CART_KEY = 'novaura_cart:' + BOOT.slug;
  const fmt = (c) => '$' + ((Number(c) || 0) / 100).toFixed(2);
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { cart = []; }
  const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} };

  const railSelect = document.getElementById('rail-select');
  if (railSelect && BOOT.primaryRail) railSelect.value = BOOT.primaryRail;

  function renderProducts(query = '') {
    const grid = document.getElementById('product-grid');
    const q = query.trim().toLowerCase();
    const list = BOOT.products.filter(p => !q || (p.title + ' ' + p.description + ' ' + p.category).toLowerCase().includes(q));
    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);text-align:center;padding:40px;">No products match your search yet.</div>';
      return;
    }
    grid.innerHTML = list.map((p) => {
      const thumb = p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" />' : '<span>' + esc(p.category) + '</span>';
      const opts = p.variants.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
      return '<article class="card">'
        + '<div class="thumb">' + thumb + '</div>'
        + '<div class="card-body">'
        + '<h3>' + esc(p.title) + '</h3>'
        + '<p>' + esc(p.description) + '</p>'
        + '<select data-var="' + esc(p.id) + '">' + opts + '</select>'
        + '<div class="price-row"><span class="price">' + fmt(p.retailCents) + '</span>'
        + '<button type="button" class="btn btn-primary" data-add="' + esc(p.id) + '">Add</button></div>'
        + '</div></article>';
    }).join('');
  }

  function renderCart() {
    const count = cart.reduce((n, i) => n + i.quantity, 0);
    document.getElementById('cart-count').textContent = String(count);
    const box = document.getElementById('cart-items');
    if (!cart.length) {
      box.innerHTML = '<div style="color:var(--muted);font-size:13px;">Your cart is empty.</div>';
      document.getElementById('cart-total').textContent = '$0.00';
      return;
    }
    let total = 0;
    box.innerHTML = cart.map((item, idx) => {
      total += item.retailCents * item.quantity;
      return '<div class="cart-item"><div><strong>' + esc(item.title) + '</strong><div style="font-size:11px;color:var(--muted);">'
        + esc(item.variant) + ' &times; ' + item.quantity + '</div></div>'
        + '<div style="display:flex;align-items:center;gap:6px;"><span>' + fmt(item.retailCents * item.quantity) + '</span>'
        + '<button type="button" class="btn" data-rm="' + idx + '" style="padding:4px 8px;">&times;</button></div></div>';
    }).join('');
    document.getElementById('cart-total').textContent = fmt(total);
  }

  document.getElementById('product-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const id = btn.getAttribute('data-add');
    const prod = BOOT.products.find(p => p.id === id);
    if (!prod) return;
    const varSel = document.querySelector('[data-var="' + id.replace(/"/g, '') + '"]');
    const variant = varSel ? varSel.value : 'Standard';
    const existing = cart.find(i => i.id === id && i.variant === variant);
    if (existing) existing.quantity += 1;
    else cart.push({ id: prod.id, sku: prod.sku, title: prod.title, variant, retailCents: prod.retailCents, quantity: 1 });
    saveCart();
    renderCart();
  });

  document.getElementById('cart-items').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rm]');
    if (!btn) return;
    cart.splice(Number(btn.getAttribute('data-rm')), 1);
    saveCart();
    renderCart();
  });

  const backdrop = document.getElementById('drawer-backdrop');
  document.getElementById('open-cart').onclick = () => backdrop.classList.add('open');
  document.getElementById('close-cart').onclick = () => backdrop.classList.remove('open');
  document.getElementById('search-input').addEventListener('input', (e) => renderProducts(e.target.value));

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('checkout-status');
    if (!cart.length) {
      statusEl.innerHTML = '<div class="notice err">Add at least one item before checking out.</div>';
      return;
    }
    if (!BOOT.apiBaseUrl) {
      statusEl.innerHTML = '<div class="notice">Static ' + esc(BOOT.mode) + ' mode: attach your live HTTPS Storefront Backend URL in Sovereign Commerce Studio &rarr; Domains &amp; Hosting to accept live Square / Stripe / PayPal / Venmo payments.</div>';
      return;
    }
    const fd = new FormData(e.target);
    const shipping = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      address1: String(fd.get('address1') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      state: String(fd.get('state') || '').trim(),
      postalCode: String(fd.get('postalCode') || '').trim(),
      country: String(fd.get('country') || 'US').trim().toUpperCase(),
    };
    const rail = String(fd.get('rail') || BOOT.primaryRail || 'square');
    statusEl.innerHTML = '<div class="notice">Creating verified ' + esc(rail) + ' checkout session...</div>';
    try {
      const res = await fetch(BOOT.apiBaseUrl + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rail, shipping, items: cart }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Checkout backend returned HTTP ' + res.status);
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      statusEl.innerHTML = '<div class="notice err">' + esc(err.message || 'Checkout failed.') + '</div>';
    }
  });

  renderProducts();
  renderCart();
})();
</script>
</body>
</html>`;
}

const SERVER_LINES = [
  '// NovAura Sovereign Commerce — 24/7 Multi-Tenant Storefront & Multi-Rail Webhook Server',
  '// Zero external npm dependencies (Node 20+ / 22+ native http + crypto + fs + fetch).',
  "import http from 'node:http';",
  "import crypto from 'node:crypto';",
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "import { fileURLToPath } from 'node:url';",
  '',
  'const __dirname = path.dirname(fileURLToPath(import.meta.url));',
  'const PORT = Number(process.env.PORT || 8787);',
  "const PLATFORM_HOST = String(process.env.PLATFORM_HOST || 'novaura.xyz').toLowerCase();",
  "const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));",
  "const STATE_FILE = path.join(DATA_DIR, 'commerce_state.json');",
  "const SEED_FILE = path.join(__dirname, 'seed.json');",
  "const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');",
  "const ADMIN_SYNC_TOKEN = process.env.ADMIN_SYNC_TOKEN || '';",
  'const PLATFORM_PROFIT_FEE_PCT = 5;',
  '',
  'fs.mkdirSync(DATA_DIR, { recursive: true });',
  '',
  'function saveState(state) {',
  "  const tmp = STATE_FILE + '.tmp';",
  "  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');",
  '  fs.renameSync(tmp, STATE_FILE);',
  '}',
  '',
  'function loadState() {',
  '  if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));',
  '  if (fs.existsSync(SEED_FILE)) {',
  '    const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));',
  '    saveState(seed);',
  '    return seed;',
  '  }',
  '  const blank = { merchants: [], stores: [], products: [], orders: [], ledger: [], renderedHtml: {} };',
  '  saveState(blank);',
  '  return blank;',
  '}',
  '',
  'const STATE = loadState();',
  '',
  'function json(res, status, data) {',
  '  res.writeHead(status, {',
  "    'Content-Type': 'application/json; charset=utf-8',",
  "    'X-Content-Type-Options': 'nosniff',",
  "    'X-Frame-Options': 'SAMEORIGIN',",
  "    'Referrer-Policy': 'strict-origin-when-cross-origin',",
  '  });',
  '  res.end(JSON.stringify(data));',
  '}',
  '',
  'function html(res, status, markup) {',
  '  res.writeHead(status, {',
  "    'Content-Type': 'text/html; charset=utf-8',",
  "    'X-Content-Type-Options': 'nosniff',",
  "    'X-Frame-Options': 'SAMEORIGIN',",
  "    'Referrer-Policy': 'strict-origin-when-cross-origin',",
  '    "Content-Security-Policy": "default-src \'self\' \'unsafe-inline\' https: data:; object-src \'none\'; base-uri \'self\';",',
  '  });',
  '  res.end(markup);',
  '}',
  '',
  'function readRawBody(req, maxBytes = 1048576) {',
  '  return new Promise((resolve, reject) => {',
  '    const chunks = [];',
  '    let total = 0;',
  "    req.on('data', (chunk) => {",
  '      total += chunk.length;',
  '      if (total > maxBytes) { reject(new Error("Payload too large.")); req.destroy(); return; }',
  '      chunks.push(chunk);',
  '    });',
  "    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));",
  "    req.on('error', reject);",
  '  });',
  '}',
  '',
  'function timingSafeStrEqual(a, b) {',
  "  const ba = Buffer.from(String(a || ''), 'utf8');",
  "  const bb = Buffer.from(String(b || ''), 'utf8');",
  '  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);',
  '}',
  '',
  'function hashPassword(pw) {',
  "  const salt = crypto.randomBytes(16).toString('hex');",
  "  const derived = crypto.scryptSync(String(pw), salt, 64).toString('hex');",
  "  return salt + ':' + derived;",
  '}',
  '',
  'function verifyPassword(pw, stored) {',
  "  const parts = String(stored || '').split(':');",
  '  if (parts.length !== 2) return false;',
  "  const derived = crypto.scryptSync(String(pw), parts[0], 64).toString('hex');",
  '  return timingSafeStrEqual(derived, parts[1]);',
  '}',
  '',
  'function signToken(payload) {',
  "  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');",
  "  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');",
  "  return body + '.' + sig;",
  '}',
  '',
  'function verifyToken(token) {',
  "  const parts = String(token || '').split('.');",
  '  if (parts.length !== 2) return null;',
  "  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest('base64url');",
  '  if (!timingSafeStrEqual(parts[1], expected)) return null;',
  '  try {',
  "    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));",
  '    return p.exp && Date.now() > p.exp ? null : p;',
  '  } catch { return null; }',
  '}',
  '',
  'function sanitizeSlug(s) {',
  "  return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'store';",
  '}',
  '',
  'function estimateGatewayFeeCents(gross, rail) {',
  '  if (gross <= 0) return 0;',
  "  return rail === 'paypal' ? Math.round(gross * 0.0349) + 49 : Math.round(gross * 0.029) + 30;",
  '}',
  '',
  'function computeSettlement({ subtotalCents, shippingCollectedCents = 0, taxCents = 0, supplierCostCents = 0, supplierShippingCents = 0, rail = "square" }) {',
  '  const grossRevenueCents = subtotalCents + shippingCollectedCents;',
  '  const grossChargedCents = grossRevenueCents + taxCents;',
  '  const gatewayFeeCents = estimateGatewayFeeCents(grossChargedCents, rail);',
  '  const netBeforePlatformCents = grossRevenueCents - supplierCostCents - supplierShippingCents - gatewayFeeCents;',
  '  const platformProfitFeeCents = netBeforePlatformCents > 0 ? Math.round(netBeforePlatformCents * (PLATFORM_PROFIT_FEE_PCT / 100)) : 0;',
  '  return { grossRevenueCents, grossChargedCents, gatewayFeeCents, netBeforePlatformCents, platformProfitFeeCents, merchantNetProfitCents: netBeforePlatformCents - platformProfitFeeCents };',
  '}',
  '',
  'function verifyStripeSig(rawBody, sigHeader, secret) {',
  '  if (!secret || !sigHeader) return false;',
  '  let ts = null;',
  '  const sigs = [];',
  "  for (const part of String(sigHeader).split(',')) {",
  "    const idx = part.indexOf('=');",
  '    if (idx === -1) continue;',
  '    const k = part.slice(0, idx).trim();',
  '    const v = part.slice(idx + 1).trim();',
  "    if (k === 't') ts = Number(v);",
  "    if (k === 'v1' && v) sigs.push(v);",
  '  }',
  '  if (!Number.isFinite(ts) || !sigs.length || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;',
  "  const expected = crypto.createHmac('sha256', secret).update(ts + '.' + rawBody).digest('hex');",
  '  return sigs.some((s) => timingSafeStrEqual(expected, s));',
  '}',
  '',
  'function verifySquareSig(url, rawBody, sigHeader, key) {',
  '  if (!key || !sigHeader) return false;',
  "  const expected = crypto.createHmac('sha256', key).update(url + rawBody).digest('base64');",
  '  return timingSafeStrEqual(expected, sigHeader);',
  '}',
  '',
  'function renderStorePage(store, products, apiBaseUrl) {',
  '  const pre = STATE.renderedHtml && STATE.renderedHtml[store.slug];',
  '  if (pre) return pre.replace(/"apiBaseUrl":"[^"]*"/, \'"apiBaseUrl":\' + JSON.stringify(apiBaseUrl));',
  "  return '<!doctype html><html><body style=\"background:#020617;color:#fff;font-family:system-ui;padding:32px\"><h1>' + String(store.name || '').replace(/</g, '&lt;') + '</h1></body></html>';",
  '}',
  '',
  'function recordOrderLedger(store, order, s) {',
  '  const now = new Date().toISOString();',
  '  const add = (type, amountCents) => STATE.ledger.push({ id: "led_" + crypto.randomBytes(6).toString("hex"), storeId: store.id, orderId: order.id, type, rail: order.rail, amountCents, createdAt: now });',
  "  add('sale_gross', s.grossRevenueCents);",
  "  add('gateway_fee', -s.gatewayFeeCents);",
  "  add('supplier_purchase', -order.supplierCostCents);",
  "  add('shipping_cost', -order.supplierShippingCents);",
  "  add('platform_profit_fee_5pct', s.platformProfitFeeCents);",
  '}',
  '',
  'async function createCheckout(store, body, origin) {',
  "  const rail = ['square', 'stripe', 'paypal'].includes(body.rail) ? body.rail : (store.primaryRail || 'square');",
  '  const shipping = body.shipping || {};',
  '  if (!shipping.name || !shipping.address1 || !shipping.city || !shipping.postalCode) {',
  '    return { status: 400, data: { error: "Complete shipping details are required." } };',
  '  }',
  '  const prods = STATE.products.filter((p) => p.storeId === store.id);',
  '  const items = [];',
  '  let subtotalCents = 0;',
  '  let supplierCostCents = 0;',
  '  let supplierShippingCents = 0;',
  '  for (const r of (body.items || [])) {',
  '    const p = prods.find((x) => x.id === r.id || x.sku === r.sku);',
  '    if (!p) continue;',
  '    const qty = Math.max(1, Math.min(25, Math.round(Number(r.quantity) || 1)));',
  '    subtotalCents += p.retailCents * qty;',
  '    supplierCostCents += (p.wholesaleCents || 0) * qty;',
  '    supplierShippingCents += (p.shippingCents || 0);',
  '    items.push({ id: p.id, sku: p.sku, supplier: p.supplier, supplierProductId: p.supplierProductId, title: p.title, quantity: qty, unitRetailCents: p.retailCents, unitWholesaleCents: p.wholesaleCents || 0 });',
  '  }',
  '  if (!items.length) return { status: 400, data: { error: "Cart contains no valid products." } };',
  "  const orderId = 'ord_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');",
  '  const settlement = computeSettlement({ subtotalCents, supplierCostCents, supplierShippingCents, rail });',
  "  const order = { id: orderId, storeId: store.id, rail, status: 'PENDING_PAYMENT', items, shipping, subtotalCents, supplierCostCents, supplierShippingCents, settlement, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };",
  "  if (rail === 'stripe') {",
  '    if (!process.env.STRIPE_SECRET_KEY) return { status: 503, data: { error: "Configure STRIPE_SECRET_KEY in .env." } };',
  '    const form = new URLSearchParams();',
  "    form.set('mode', 'payment');",
  "    form.set('success_url', origin + '/' + store.slug + '/storefront?paid=' + orderId);",
  "    form.set('cancel_url', origin + '/' + store.slug + '/storefront?cancelled=1');",
  "    form.set('client_reference_id', orderId);",
  "    form.set('payment_method_types[0]', 'card');",
  "    form.set('payment_method_types[1]', 'cashapp');",
  '    items.forEach((it, idx) => {',
  "      form.set('line_items[' + idx + '][quantity]', String(it.quantity));",
  "      form.set('line_items[' + idx + '][price_data][currency]', 'usd');",
  "      form.set('line_items[' + idx + '][price_data][unit_amount]', String(it.unitRetailCents));",
  "      form.set('line_items[' + idx + '][price_data][product_data][name]', it.title);",
  '    });',
  '    if (store.connectAccountId && settlement.platformProfitFeeCents > 0) {',
  "      form.set('payment_intent_data[application_fee_amount]', String(settlement.platformProfitFeeCents));",
  "      form.set('payment_intent_data[transfer_data][destination]', store.connectAccountId);",
  '    }',
  "    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });",
  '    const session = await res.json();',
  '    if (!res.ok || !session.url) return { status: 502, data: { error: session?.error?.message || "Stripe error." } };',
  '    order.externalPaymentId = session.id;',
  '    STATE.orders.push(order); saveState(STATE);',
  '    return { status: 200, data: { orderId, checkoutUrl: session.url, settlement } };',
  '  }',
  "  if (rail === 'square') {",
  '    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) return { status: 503, data: { error: "Configure SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID in .env." } };',
  '    const sqPayload = { idempotency_key: orderId, order: { location_id: process.env.SQUARE_LOCATION_ID, reference_id: orderId, line_items: items.map((it) => ({ name: it.title, quantity: String(it.quantity), base_price_money: { amount: it.unitRetailCents, currency: "USD" } })) }, checkout_options: { redirect_url: origin + "/" + store.slug + "/storefront?paid=" + orderId, accepted_payment_methods: { apple_pay: true, google_pay: true, cash_app_pay: true }, ask_for_shipping_address: true } };',
  "    const res = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.SQUARE_ACCESS_TOKEN, 'Content-Type': 'application/json', 'Square-Version': '2024-10-17' }, body: JSON.stringify(sqPayload) });",
  '    const sq = await res.json();',
  '    if (!res.ok || !sq?.payment_link?.url) return { status: 502, data: { error: sq?.errors?.[0]?.detail || "Square error." } };',
  '    order.externalPaymentId = sq.payment_link.id;',
  '    STATE.orders.push(order); saveState(STATE);',
  '    return { status: 200, data: { orderId, checkoutUrl: sq.payment_link.url, settlement } };',
  '  }',
  '  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return { status: 503, data: { error: "Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env." } };',
  "  const auth = Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');",
  "  const tok = await (await fetch('https://api-m.paypal.com/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })).json();",
  '  if (!tok.access_token) return { status: 502, data: { error: "PayPal OAuth failed." } };',
  "  const pp = await (await fetch('https://api-m.paypal.com/v2/checkout/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: orderId, amount: { currency_code: 'USD', value: (subtotalCents / 100).toFixed(2) } }] }) })).json();",
  "  const approve = (pp.links || []).find((l) => l.rel === 'approve')?.href;",
  '  if (!approve) return { status: 502, data: { error: "PayPal order error." } };',
  '  order.externalPaymentId = pp.id;',
  '  STATE.orders.push(order); saveState(STATE);',
  '  return { status: 200, data: { orderId, checkoutUrl: approve, settlement } };',
  '}',
  '',
  'function finalizePaidOrder(order, riskLevel = "normal") {',
  "  if (!order || order.status === 'ORDERED_WITH_SUPPLIER' || order.status === 'PAID_READY_TO_FULFILL') return;",
  '  const store = STATE.stores.find((s) => s.id === order.storeId);',
  '  if (!store) return;',
  "  if (riskLevel === 'elevated' || riskLevel === 'highest') order.status = 'HOLD_RISK_REVIEW';",
  "  else if (store.fundingMode === 'hold_until_settled') order.status = 'HOLD_AWAITING_SETTLEMENT';",
  "  else if ((order.settlement?.netBeforePlatformCents || 0) <= 0) order.status = 'HOLD_MARGIN_BREACH';",
  "  else { order.status = 'PAID_READY_TO_FULFILL'; recordOrderLedger(store, order, order.settlement); }",
  '  order.updatedAt = new Date().toISOString();',
  '  saveState(STATE);',
  '}',
  '',
  'const server = http.createServer(async (req, res) => {',
  '  try {',
  "    const parsed = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));",
  "    const pathname = parsed.pathname.replace(/\\/+$/, '') || '/';",
  "    const reqHost = String(req.headers.host || '').split(':')[0].toLowerCase();",
  "    const origin = (req.headers['x-forwarded-proto'] || 'https') + '://' + (req.headers.host || PLATFORM_HOST);",
  "    if (req.method === 'GET' && pathname === '/health') return json(res, 200, { ok: true, platformHost: PLATFORM_HOST, stores: STATE.stores.length, orders: STATE.orders.length });",
  '',
  '    const customStore = STATE.stores.find((s) => s.customDomain && s.customDomain.toLowerCase() === reqHost);',
  '    if (customStore) {',
  "      if (req.method === 'GET' && (pathname === '/' || pathname === '/merchandise')) {",
  "        return html(res, 200, renderStorePage(customStore, STATE.products.filter((p) => p.storeId === customStore.id), '/api/stores/' + customStore.slug));",
  '      }',
  "      if (req.method === 'POST' && pathname === '/api/checkout') {",
  '        const out = await createCheckout(customStore, JSON.parse((await readRawBody(req)) || "{}"), origin);',
  '        return json(res, out.status, out.data);',
  '      }',
  '    }',
  '',
  '    const subMatch = pathname.match(/^\\/([a-z0-9-]+)\\/storefront(?:\\/(merchandise|cart|api\\/checkout|api\\/products))?$/);',
  '    if (subMatch) {',
  '      const slug = subMatch[1];',
  "      const sub = subMatch[2] || '';",
  '      const store = STATE.stores.find((s) => s.slug === slug);',
  '      if (!store) return json(res, 404, { error: "Storefront not found: " + slug });',
  '      const prods = STATE.products.filter((p) => p.storeId === store.id);',
  "      if (req.method === 'GET' && (sub === '' || sub === 'merchandise' || sub === 'cart')) return html(res, 200, renderStorePage(store, prods, '/' + slug + '/storefront/api'));",
  "      if (req.method === 'GET' && sub === 'api/products') return json(res, 200, { store: { id: store.id, slug: store.slug, name: store.name }, products: prods });",
  "      if (req.method === 'POST' && sub === 'api/checkout') {",
  '        const out = await createCheckout(store, JSON.parse((await readRawBody(req)) || "{}"), origin);',
  '        return json(res, out.status, out.data);',
  '      }',
  '    }',
  '',
  '    const directMatch = pathname.match(/^\\/api\\/stores\\/([a-z0-9-]+)\\/checkout$/);',
  "    if (req.method === 'POST' && directMatch) {",
  '      const store = STATE.stores.find((s) => s.slug === directMatch[1]);',
  '      if (!store) return json(res, 404, { error: "Store not found." });',
  '      const out = await createCheckout(store, JSON.parse((await readRawBody(req)) || "{}"), origin);',
  '      return json(res, out.status, out.data);',
  '    }',
  '',
  "    if (req.method === 'POST' && pathname === '/api/merchants/signup') {",
  '      const body = JSON.parse((await readRawBody(req)) || "{}");',
  "      const email = String(body.email || '').trim().toLowerCase();",
  '      if (!email.includes("@") || String(body.password || "").length < 8) return json(res, 400, { error: "Email and 8+ char password required." });',
  '      if (STATE.merchants.some((m) => m.email === email)) return json(res, 409, { error: "Account already exists." });',
  "      const m = { id: 'm_' + crypto.randomBytes(6).toString('hex'), email, passwordHash: hashPassword(body.password), createdAt: new Date().toISOString() };",
  '      STATE.merchants.push(m); saveState(STATE);',
  '      return json(res, 201, { merchant: { id: m.id, email }, token: signToken({ merchantId: m.id, email, exp: Date.now() + 604800000 }), platformFeePct: PLATFORM_PROFIT_FEE_PCT });',
  '    }',
  '',
  "    if (req.method === 'POST' && pathname === '/api/merchants/login') {",
  '      const body = JSON.parse((await readRawBody(req)) || "{}");',
  "      const m = STATE.merchants.find((x) => x.email === String(body.email || '').trim().toLowerCase());",
  '      if (!m || !verifyPassword(body.password || "", m.passwordHash)) return json(res, 401, { error: "Invalid credentials." });',
  '      return json(res, 200, { merchant: { id: m.id, email: m.email }, token: signToken({ merchantId: m.id, email: m.email, exp: Date.now() + 604800000 }) });',
  '    }',
  '',
  "    if (pathname === '/api/merchants/stores') {",
  "      const claims = verifyToken(String(req.headers.authorization || '').replace(/^Bearer\\s+/i, ''));",
  '      if (!claims) return json(res, 401, { error: "Bearer token required." });',
  "      if (req.method === 'GET') return json(res, 200, { stores: STATE.stores.filter((s) => s.ownerId === claims.merchantId) });",
  "      if (req.method === 'POST') {",
  '        const body = JSON.parse((await readRawBody(req)) || "{}");',
  '        const slug = sanitizeSlug(body.slug || body.name);',
  '        if (STATE.stores.some((s) => s.slug === slug)) return json(res, 409, { error: "Slug taken." });',
  "        const store = { id: 'store_' + slug + '_' + crypto.randomBytes(3).toString('hex'), slug, ownerId: claims.merchantId, name: String(body.name || slug), tagline: String(body.tagline || ''), niche: String(body.niche || 'Specialty'), customDomain: String(body.customDomain || '').toLowerCase(), meshDomain: slug + '.nova', fundingMode: body.fundingMode === 'hold_until_settled' ? 'hold_until_settled' : 'instant_float', primaryRail: ['square', 'stripe', 'paypal'].includes(body.primaryRail) ? body.primaryRail : 'square', platformFeePct: PLATFORM_PROFIT_FEE_PCT, createdAt: new Date().toISOString() };",
  '        STATE.stores.push(store); saveState(STATE);',
  '        return json(res, 201, { store, urls: { subpath: "https://" + PLATFORM_HOST + "/" + slug + "/storefront/merchandise", mesh: "nova://" + slug + ".nova" } });',
  '      }',
  '    }',
  '',
  "    if (req.method === 'POST' && pathname === '/api/webhooks/stripe') {",
  '      const raw = await readRawBody(req);',
  "      if (!verifyStripeSig(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) return json(res, 401, { error: 'Bad signature.' });",
  '      const evt = JSON.parse(raw);',
  "      if (evt.type === 'checkout.session.completed') {",
  '        const ses = evt.data?.object || {};',
  '        const ord = STATE.orders.find((o) => o.id === ses.client_reference_id || o.externalPaymentId === ses.id);',
  "        finalizePaidOrder(ord, ses.metadata?.riskLevel || 'normal');",
  '      }',
  '      return json(res, 200, { received: true });',
  '    }',
  '',
  "    if (req.method === 'POST' && pathname === '/api/webhooks/square') {",
  '      const raw = await readRawBody(req);',
  "      const notifyUrl = process.env.SQUARE_WEBHOOK_URL || (origin + '/api/webhooks/square');",
  "      if (!verifySquareSig(notifyUrl, raw, req.headers['x-square-hmacsha256-signature'], process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)) return json(res, 401, { error: 'Bad signature.' });",
  '      const evt = JSON.parse(raw);',
  "      if (evt.type === 'payment.updated' && evt.data?.object?.payment?.status === 'COMPLETED') {",
  '        const ord = STATE.orders.find((o) => o.id === evt.data.object.payment.reference_id);',
  "        finalizePaidOrder(ord, 'normal');",
  '      }',
  '      return json(res, 200, { received: true });',
  '    }',
  '',
  "    if (req.method === 'POST' && pathname === '/api/webhooks/paypal') {",
  '      const evt = JSON.parse((await readRawBody(req)) || "{}");',
  "      if (evt.event_type === 'PAYMENT.CAPTURE.COMPLETED') {",
  '        const refId = evt.resource?.custom_id || evt.resource?.invoice_id;',
  '        finalizePaidOrder(STATE.orders.find((o) => o.id === refId), "normal");',
  '      }',
  '      return json(res, 200, { received: true });',
  '    }',
  '',
  "    if (pathname === '/api/admin/sync' && req.method === 'GET') {",
  "      const token = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '');",
  '      if (!ADMIN_SYNC_TOKEN || !timingSafeStrEqual(token, ADMIN_SYNC_TOKEN)) return json(res, 401, { error: "Unauthorized." });',
  '      return json(res, 200, { stores: STATE.stores, orders: STATE.orders, ledger: STATE.ledger });',
  '    }',
  '',
  '    return json(res, 404, { error: "Not found" });',
  '  } catch (err) {',
  '    return json(res, 500, { error: err?.message || "Server error" });',
  '  }',
  '});',
  '',
  'server.listen(PORT, () => {',
  '  console.log("[NovAura Commerce] Listening on :" + PORT + " (platform host: " + PLATFORM_HOST + ")");',
  '});',
];

/**
 * Build a complete deployable 24/7 multi-tenant Node.js server file bundle ready for ZIP export.
 */
export function buildDeployableCommerceServerBundle({
  stores = [],
  productsByStoreId = {},
  platformHost = DEFAULT_PLATFORM_HOST,
}) {
  const flatProducts = [];
  const renderedHtml = {};

  for (const store of stores) {
    const prods = productsByStoreId[store.id] || [];
    flatProducts.push(...prods);
    const slug = sanitizeStoreSlug(store.slug || store.name);
    renderedHtml[slug] = buildStandaloneStorefrontHtml({
      store,
      products: prods,
      mode: store.customDomain ? 'custom_tld' : 'subpath',
      apiBaseUrl: `/${slug}/storefront/api`,
    });
  }

  const seed = {
    merchants: [],
    stores,
    products: flatProducts,
    orders: [],
    ledger: [],
    renderedHtml,
  };

  const pkg = {
    name: 'novaura-commerce-runtime',
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: { start: 'node server.mjs' },
    engines: { node: '>=20.0.0' },
  };

  const envExample = [
    'PORT=8787',
    `PLATFORM_HOST=${platformHost}`,
    'SESSION_SECRET=replace-with-64-hex-random-secret',
    'ADMIN_SYNC_TOKEN=replace-with-sovereign-desktop-sync-token',
    '',
    '# Square Payments (Cards + Apple Pay + Cash App Pay + Square Checking)',
    'SQUARE_ACCESS_TOKEN=',
    'SQUARE_LOCATION_ID=',
    'SQUARE_WEBHOOK_SIGNATURE_KEY=',
    `SQUARE_WEBHOOK_URL=https://${platformHost}/api/webhooks/square`,
    '',
    '# Stripe Checkout (Cards + Apple Pay + Cash App Pay + Connect 5% Profit Split)',
    'STRIPE_SECRET_KEY=',
    'STRIPE_WEBHOOK_SECRET=',
    '',
    '# PayPal Commerce Platform (PayPal + Venmo)',
    'PAYPAL_CLIENT_ID=',
    'PAYPAL_CLIENT_SECRET=',
    '',
    '# Suppliers (CJdropshipping / Printful / Printify)',
    'CJ_ACCESS_TOKEN=',
    'PRINTFUL_API_KEY=',
    'PRINTIFY_API_KEY=',
    'PRINTIFY_SHOP_ID=',
  ].join('\n');

  const dockerfile = [
    'FROM node:22-alpine',
    'WORKDIR /app',
    'COPY package.json server.mjs seed.json ./',
    'EXPOSE 8787',
    'CMD ["node", "server.mjs"]',
  ].join('\n');

  const readme = [
    '# NovAura Sovereign Commerce 24/7 Storefront & Multi-Rail Server',
    '',
    `## Included Storefronts (${stores.length})`,
    ...stores.map((s) => {
      const slug = sanitizeStoreSlug(s.slug || s.name);
      return `- **${s.name}** — Subpath: \`https://${platformHost}/${slug}/storefront/merchandise\` | Mesh: \`nova://${s.meshDomain || `${slug}.nova`}\`${s.customDomain ? ` | Custom TLD: \`https://${s.customDomain}/\`` : ''}`;
    }),
    '',
    '## Quick Start',
    '1. Copy `.env.example` to `.env` and add Square / Stripe / PayPal & Supplier credentials.',
    '2. Run `node server.mjs` (zero npm dependencies) or deploy via `Dockerfile` to Railway, Fly.io, Render, or Google Cloud Run.',
    `3. Point DNS CNAME/A for \`${platformHost}\` (and any Custom TLD) to your host.`,
  ].join('\n');

  return [
    { path: 'package.json', content: JSON.stringify(pkg, null, 2) },
    { path: 'server.mjs', content: SERVER_LINES.join('\n') + '\n' },
    { path: 'seed.json', content: JSON.stringify(seed, null, 2) },
    { path: '.env.example', content: envExample },
    { path: 'Dockerfile', content: dockerfile },
    { path: 'README.md', content: readme },
  ];
}

