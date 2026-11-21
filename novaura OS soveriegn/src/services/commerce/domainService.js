/**
 * NovAura Sovereign Commerce — Cheapest-TLD Finder, Domain Availability & Dual-Hosting Router
 * Supports:
 *  - .nova Sovereign Mesh hosting (`<slug>.nova`)
 *  - Platform subpath hosting (`https://novaura.xyz/<slug>/storefront/merchandise`)
 *  - Custom TLD hosting with cheapest-first auto-generation & real RDAP/Porkbun/Cloudflare/Namecheap checks
 */

export const DEFAULT_PLATFORM_HOST = 'novaura.xyz';

const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'webhooks',
  'assets',
  'static',
  'health',
  'auth',
  'login',
  'signup',
  'checkout',
  'billing',
]);

/**
 * Cheapest-first baseline wholesale TLD estimates. Always flagged as `baseline_estimate`
 * unless confirmed via live registrar API (e.g. Porkbun).
 */
export const TLD_BASELINE_CATALOG = Object.freeze([
  { tld: '.xyz', estimatedWholesaleCents: 200, label: 'Ultra-Low Entry (.xyz)', popular: true },
  { tld: '.shop', estimatedWholesaleCents: 250, label: 'E-Commerce Promo (.shop)', popular: true },
  { tld: '.store', estimatedWholesaleCents: 300, label: 'Retail Storefront (.store)', popular: true },
  { tld: '.online', estimatedWholesaleCents: 350, label: 'Web Presence (.online)', popular: false },
  { tld: '.site', estimatedWholesaleCents: 350, label: 'Brand Site (.site)', popular: false },
  { tld: '.club', estimatedWholesaleCents: 450, label: 'Community Brand (.club)', popular: false },
  { tld: '.fun', estimatedWholesaleCents: 450, label: 'Creator / Niche (.fun)', popular: false },
  { tld: '.co', estimatedWholesaleCents: 1199, label: 'Startup Standard (.co)', popular: false },
  { tld: '.com', estimatedWholesaleCents: 1099, label: 'Classic Flagship (.com)', popular: true },
]);

export function sanitizeStoreSlug(input) {
  let clean = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);

  if (clean.length < 3) {
    clean = clean ? `${clean}-shop` : 'sovereign-store';
  }
  if (RESERVED_SLUGS.has(clean)) {
    clean = `${clean}-store`;
  }
  return clean;
}

/**
 * Build deterministic dual-hosting URLs:
 *  - subpath (`novaura.xyz/<slug>/storefront/merchandise`)
 *  - customTld (`customDomain/merchandise`)
 *  - mesh (`nova://<slug>.nova`)
 */
export function buildStoreRoutes({
  slug,
  customDomain = '',
  meshDomain = '',
  platformHost = DEFAULT_PLATFORM_HOST,
}) {
  const safeSlug = sanitizeStoreSlug(slug);
  const host = String(platformHost || DEFAULT_PLATFORM_HOST).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const cleanMesh = String(meshDomain || `${safeSlug}.nova`).trim().toLowerCase();
  const cleanCustom = String(customDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const basePath = `/${safeSlug}/storefront`;
  const subpath = {
    basePath,
    homeUrl: `https://${host}${basePath}`,
    merchandiseUrl: `https://${host}${basePath}/merchandise`,
    cartUrl: `https://${host}${basePath}/cart`,
    apiBaseUrl: `https://${host}${basePath}/api`,
  };

  const customTld = cleanCustom
    ? {
        domain: cleanCustom,
        homeUrl: `https://${cleanCustom}/`,
        merchandiseUrl: `https://${cleanCustom}/merchandise`,
        cartUrl: `https://${cleanCustom}/cart`,
        apiBaseUrl: `https://${cleanCustom}/api`,
      }
    : null;

  const mesh = {
    domain: cleanMesh,
    url: `nova://${cleanMesh}`,
  };

  return {
    slug: safeSlug,
    subpath,
    customTld,
    mesh,
  };
}

/**
 * Autogenerate matching brand domains sorted cheapest TLD first.
 */
export function generateCheapestDomainCandidates({
  storeName,
  niche = '',
  tldMarkupCents = 200,
  maxResults = 10,
}) {
  const baseSlug = sanitizeStoreSlug(storeName).replace(/-/g, '');
  const hyphenSlug = sanitizeStoreSlug(storeName);
  const nicheToken = sanitizeStoreSlug(niche.split(/\s+/)[0] || '').replace(/-/g, '');

  const stems = Array.from(
    new Set(
      [
        baseSlug,
        hyphenSlug,
        `${baseSlug}shop`,
        `${baseSlug}store`,
        nicheToken && !baseSlug.includes(nicheToken) ? `${baseSlug}${nicheToken}` : '',
      ].filter(s => s && s.length >= 3 && s.length <= 42)
    )
  );

  const markup = Math.max(0, Math.round(Number(tldMarkupCents) || 0));
  const sortedTlds = [...TLD_BASELINE_CATALOG].sort(
    (a, b) => a.estimatedWholesaleCents - b.estimatedWholesaleCents
  );

  const candidates = [];
  for (const tldRow of sortedTlds) {
    for (const stem of stems) {
      candidates.push({
        domain: `${stem}${tldRow.tld}`,
        tld: tldRow.tld,
        label: tldRow.label,
        estimatedWholesaleCents: tldRow.estimatedWholesaleCents,
        platformMarkupCents: markup,
        customerPriceCents: tldRow.estimatedWholesaleCents + markup,
        priceSource: 'baseline_estimate',
      });
      if (candidates.length >= maxResults) return candidates;
    }
  }
  return candidates;
}

/**
 * Real domain availability check via Porkbun, Cloudflare, Namecheap, or public RDAP.
 * Never fabricates availability or pricing on network failure.
 */
export async function checkDomainAvailability({
  domain,
  registrar = 'rdap',
  credentials = {},
  tldMarkupCents = 200,
  fetchImpl = fetch,
}) {
  const cleanDomain = String(domain || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.[a-z]{2,16}$/.test(cleanDomain)) {
    throw new Error(`Invalid domain name: "${cleanDomain}"`);
  }
  const markup = Math.max(0, Math.round(Number(tldMarkupCents) || 0));

  if (registrar === 'porkbun') {
    if (!credentials?.apiKey || !credentials?.secretApiKey) {
      throw new Error('Porkbun live pricing check requires apiKey and secretApiKey.');
    }
    const res = await fetchImpl(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${encodeURIComponent(cleanDomain)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: credentials.apiKey,
        secretapikey: credentials.secretApiKey,
      }),
    });
    const data = await res.json();
    if (!res.ok || data?.status !== 'SUCCESS') {
      throw new Error(data?.message || `Porkbun availability check failed (${res.status}).`);
    }
    const wholesaleUsd = Number(data?.response?.price || 0);
    const wholesaleCents = wholesaleUsd > 0 ? Math.round(wholesaleUsd * 100) : null;
    return {
      domain: cleanDomain,
      registrar: 'porkbun',
      available: String(data?.response?.avail || '').toLowerCase() === 'yes',
      wholesaleCents,
      platformMarkupCents: markup,
      customerPriceCents: wholesaleCents !== null ? wholesaleCents + markup : null,
      priceSource: 'porkbun_live',
      checkedAt: new Date().toISOString(),
    };
  }

  if (registrar === 'cloudflare') {
    if (!credentials?.apiToken || !credentials?.accountId) {
      throw new Error('Cloudflare Registrar check requires apiToken and accountId.');
    }
    const res = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/registrar/domains/${encodeURIComponent(cleanDomain)}`,
      { headers: { Authorization: `Bearer ${credentials.apiToken}` } }
    );
    const data = await res.json();
    if (!res.ok && res.status !== 404) {
      throw new Error(data?.errors?.[0]?.message || `Cloudflare Registrar check failed (${res.status}).`);
    }
    const available = res.status === 404 || data?.result?.available === true;
    return {
      domain: cleanDomain,
      registrar: 'cloudflare',
      available,
      wholesaleCents: null,
      platformMarkupCents: markup,
      customerPriceCents: null,
      priceSource: 'cloudflare_at_cost',
      checkedAt: new Date().toISOString(),
    };
  }

  if (registrar === 'namecheap') {
    if (!credentials?.apiUser || !credentials?.apiKey || !credentials?.clientIp) {
      throw new Error('Namecheap API check requires apiUser, apiKey, and clientIp.');
    }
    const url =
      `https://api.namecheap.com/xml.response?ApiUser=${encodeURIComponent(credentials.apiUser)}` +
      `&ApiKey=${encodeURIComponent(credentials.apiKey)}&UserName=${encodeURIComponent(credentials.apiUser)}` +
      `&Command=namecheap.domains.check&ClientIp=${encodeURIComponent(credentials.clientIp)}&DomainList=${encodeURIComponent(cleanDomain)}`;
    const res = await fetchImpl(url);
    const xml = await res.text();
    if (!res.ok) throw new Error(`Namecheap check failed (${res.status}).`);
    const available = /Available="true"/i.test(xml);
    return {
      domain: cleanDomain,
      registrar: 'namecheap',
      available,
      wholesaleCents: null,
      platformMarkupCents: markup,
      customerPriceCents: null,
      priceSource: 'namecheap_availability_only',
      checkedAt: new Date().toISOString(),
    };
  }

  // Default: public RDAP availability lookup (404 = unregistered / likely available, 200 = registered)
  const rdapRes = await fetchImpl(`https://rdap.org/domain/${encodeURIComponent(cleanDomain)}`, {
    method: 'GET',
    headers: { Accept: 'application/rdap+json, application/json' },
  });
  if (rdapRes.status === 404) {
    return {
      domain: cleanDomain,
      registrar: 'rdap',
      available: true,
      wholesaleCents: null,
      platformMarkupCents: markup,
      customerPriceCents: null,
      priceSource: 'rdap_availability_only',
      checkedAt: new Date().toISOString(),
    };
  }
  if (rdapRes.ok) {
    return {
      domain: cleanDomain,
      registrar: 'rdap',
      available: false,
      wholesaleCents: null,
      platformMarkupCents: markup,
      customerPriceCents: null,
      priceSource: 'rdap_availability_only',
      checkedAt: new Date().toISOString(),
    };
  }
  throw new Error(`RDAP lookup failed with HTTP ${rdapRes.status}.`);
}

