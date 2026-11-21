/**
 * NovAura Sovereign Commerce — Conversational AI Store, Niche & Ad Campaign Architect
 * Uses Sovereign OS AISubsystem (local Ollama/LM Studio/Built-in AI or BYOK cloud)
 * to design complete stores, price items around 5% net-profit split, and craft ad creatives.
 */

import { computeProductPricing, PLATFORM_PROFIT_FEE_PCT } from './pricingEngine.js';
import { sanitizeStoreSlug } from './domainService.js';

function stripThinkingAndFences(raw = '') {
  return String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function parseAiJson(raw) {
  const cleaned = stripThinkingAndFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI response did not return valid JSON store blueprint.');
  }
}

/**
 * Design a full niche dropshipping store, priced product catalog drafts, and ad angles
 * from natural-language conversation.
 */
export async function architectStoreFromPrompt({
  ai,
  prompt,
  history = [],
  preferredNiche = '',
  fundingMode = 'instant_float',
  targetMarginPct = 48,
  minMarginPct = 25,
  rail = 'square',
  ownerId = 'operator',
}) {
  if (!ai || typeof ai.chat !== 'function') {
    throw new Error('AISubsystem is unavailable. Configure a local model or API key in Settings.');
  }
  const userPrompt = String(prompt || '').trim();
  if (!userPrompt) {
    throw new Error('Describe what niche or products you want to sell.');
  }

  const systemPrompt = [
    'You are the NovAura Sovereign Commerce Architect.',
    'Design a high-converting niche dropshipping storefront and product catalog tailored to the user request.',
    'Respond ONLY with a single valid JSON object (no markdown commentary outside the JSON).',
    'JSON Schema:',
    '{',
    '  "brandName": string,',
    '  "slug": string (lowercase-kebab),',
    '  "tagline": string,',
    '  "niche": string,',
    '  "heroTitle": string,',
    '  "heroSubtitle": string,',
    '  "accentColor": string (hex color e.g. "#06b6d4"),',
    '  "aiReply": string (short explanation of the niche strategy & pricing logic),',
    '  "products": [',
    '    {',
    '      "title": string,',
    '      "sku": string,',
    '      "category": string,',
    '      "supplierQuery": string (exact search keyword to query CJdropshipping/Printful),',
    '      "suggestedWholesaleUsd": number (realistic wholesale USD cost e.g. 14.5),',
    '      "suggestedShippingUsd": number (realistic shipping USD cost e.g. 4.5),',
    '      "description": string,',
    '      "variants": [string]',
    '    }',
    '  ] (4 to 6 distinct items),',
    '  "adAngles": [',
    '    { "channel": "tiktok"|"meta"|"google", "hook": string, "headline": string, "primaryText": string, "cta": string }',
    '  ] (3 angles)',
    '}',
  ].join('\n');

  const recentTurns = (Array.isArray(history) ? history : [])
    .slice(-6)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));

  const enrichedUser = preferredNiche
    ? `Target niche: ${preferredNiche}\nOperator request: ${userPrompt}`
    : userPrompt;

  const raw = await ai.chat(
    [
      { role: 'system', content: systemPrompt },
      ...recentTurns,
      { role: 'user', content: enrichedUser },
    ],
    { temperature: 0.55, maxTokens: 3200, noCache: true }
  );

  const parsed = parseAiJson(raw);
  const now = new Date().toISOString();
  const brandName = String(parsed.brandName || 'NovAura Boutique').trim().slice(0, 64);
  const slug = sanitizeStoreSlug(parsed.slug || brandName);
  const niche = String(parsed.niche || preferredNiche || 'Curated Specialty Gear').trim();

  const storeDraft = {
    id: `store_${slug}_${Date.now().toString(36)}`,
    slug,
    ownerId: String(ownerId || 'operator'),
    name: brandName,
    tagline: String(parsed.tagline || `Curated ${niche} delivered direct`).trim(),
    niche,
    heroTitle: String(parsed.heroTitle || brandName).trim(),
    heroSubtitle: String(parsed.heroSubtitle || `Engineered essentials in ${niche}`).trim(),
    accentColor: /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor || '') ? parsed.accentColor : '#06b6d4',
    customDomain: '',
    meshDomain: `${slug}.nova`,
    meshCid: '',
    platformFeePct: PLATFORM_PROFIT_FEE_PCT,
    primaryRail: rail,
    fundingMode,
    pricingPolicy: {
      targetMarginPct: Number(targetMarginPct) || 48,
      minMarginPct: Number(minMarginPct) || 25,
      platformFeePct: PLATFORM_PROFIT_FEE_PCT,
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const rawProducts = Array.isArray(parsed.products) ? parsed.products.slice(0, 8) : [];
  const productDrafts = rawProducts.map((item, idx) => {
    const wholesaleCents = Math.max(200, Math.round((Number(item.suggestedWholesaleUsd) || 14) * 100));
    const shippingCents = Math.max(0, Math.round((Number(item.suggestedShippingUsd) || 4.5) * 100));
    const pricing = computeProductPricing({
      wholesaleCents,
      shippingCents,
      targetMarginPct,
      minMarginPct,
      rail,
      platformFeePct: PLATFORM_PROFIT_FEE_PCT,
      psychological99: true,
    });

    return {
      id: `prod_${slug}_${Date.now().toString(36)}_${idx}`,
      storeId: storeDraft.id,
      sku: String(item.sku || `${slug.slice(0, 4).toUpperCase()}-${101 + idx}`),
      title: String(item.title || `${niche} Item ${idx + 1}`).trim(),
      category: String(item.category || niche).trim(),
      description: String(item.description || '').trim(),
      supplier: 'unlinked',
      supplierProductId: '',
      supplierQuery: String(item.supplierQuery || item.title || '').trim(),
      supplierLinkStatus: 'draft_needs_supplier',
      status: 'draft',
      wholesaleCents,
      shippingCents,
      retailCents: pricing.retailCents,
      platformProfitFeeCents: pricing.platformProfitFeeCents,
      merchantNetProfitCents: pricing.merchantNetProfitCents,
      breakEvenRoas: pricing.breakEvenRoas,
      variants: Array.isArray(item.variants) && item.variants.length ? item.variants.map(String) : ['Standard'],
      images: [],
      stockCount: 0,
      updatedAt: now,
    };
  });

  const campaignDrafts = (Array.isArray(parsed.adAngles) ? parsed.adAngles.slice(0, 5) : []).map((ang, idx) => ({
    id: `cmp_${slug}_${Date.now().toString(36)}_${idx}`,
    storeId: storeDraft.id,
    channel: ['tiktok', 'meta', 'google'].includes(ang.channel) ? ang.channel : 'tiktok',
    productTitle: productDrafts[0]?.title || brandName,
    hook: String(ang.hook || '').trim(),
    headline: String(ang.headline || '').trim(),
    primaryText: String(ang.primaryText || '').trim(),
    cta: String(ang.cta || 'Shop Now').trim(),
    status: 'draft',
    spendCents: 0,
    createdAt: now,
  }));

  return {
    storeDraft,
    productDrafts,
    campaignDrafts,
    aiReply: String(parsed.aiReply || `Designed ${brandName} with ${productDrafts.length} curated items and a 5% net-profit platform split.`),
  };
}

/**
 * Generate channel-specific ad script + copy grounded in real product break-even CPA/ROAS.
 */
export async function generateAdCampaignPack({ ai, store, product, channel = 'tiktok', rail = 'square' }) {
  if (!ai || typeof ai.chat !== 'function') {
    throw new Error('AISubsystem is unavailable.');
  }
  const pricing = computeProductPricing({
    wholesaleCents: product.wholesaleCents || 1200,
    shippingCents: product.shippingCents || 400,
    overrideRetailCents: product.retailCents,
    rail,
  });

  const systemPrompt = [
    'You are an expert e-commerce performance creative strategist.',
    'Output ONLY valid JSON matching:',
    '{ "hook": string, "script": string, "headline": string, "primaryText": string, "cta": string, "targetingKeywords": [string] }',
  ].join('\n');

  const userMsg = [
    `Brand: ${store?.name || 'Store'} (${store?.niche || 'Niche'})`,
    `Channel: ${channel}`,
    `Product: ${product?.title}`,
    `Retail Price: $${(pricing.retailCents / 100).toFixed(2)}`,
    `Max Break-Even CPA after COGS, Gateway & 5% Platform Profit Fee: $${(pricing.maxBreakEvenCpaCents / 100).toFixed(2)} (Break-Even ROAS: ${pricing.breakEvenRoas || 'N/A'}x)`,
    `Description: ${product?.description || 'Quality specialty product'}`,
  ].join('\n');

  const raw = await ai.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ],
    { temperature: 0.65, maxTokens: 1500, noCache: true }
  );

  const parsed = parseAiJson(raw);
  return {
    id: `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    storeId: store?.id || '',
    productId: product?.id || '',
    productTitle: product?.title || '',
    channel,
    hook: String(parsed.hook || '').trim(),
    script: String(parsed.script || '').trim(),
    headline: String(parsed.headline || '').trim(),
    primaryText: String(parsed.primaryText || '').trim(),
    cta: String(parsed.cta || 'Shop Now').trim(),
    targetingKeywords: Array.isArray(parsed.targetingKeywords) ? parsed.targetingKeywords.map(String) : [],
    maxBreakEvenCpaCents: pricing.maxBreakEvenCpaCents,
    breakEvenRoas: pricing.breakEvenRoas,
    spendCents: 0,
    status: 'ready',
    createdAt: new Date().toISOString(),
  };
}

