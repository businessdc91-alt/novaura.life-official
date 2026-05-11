/**
 * NovAura Skimmer Service — Asset Discovery Pipeline
 *
 * Scans multiple open-source platforms for eligible white-label,
 * redeployable, and forkable assets:
 *   - Hugging Face (models, spaces, datasets)
 *   - GitHub (repos with permissive licenses)
 *   - itch.io (open-license games/tools)
 *   - Godot Asset Library
 *   - OpenSERP (search engine for discovery)
 *
 * Each source returns normalized { SkimResult } objects that the
 * NECHQ Relabeling Station can review, brand, and deploy.
 */

import { BACKEND_URL, getAuthHeaders } from './aiService';

// ─── License Eligibility ─────────────────────────────────────────────
const ELIGIBLE_LICENSES = new Set([
  'mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc',
  'unlicense', 'cc0-1.0', 'cc-by-4.0', 'cc-by-sa-4.0',
  'wtfpl', 'zlib', 'mpl-2.0', 'lgpl-2.1', 'lgpl-3.0',
  'artistic-2.0', 'bsl-1.0', 'ofl-1.1',
  // HF-specific
  'openrail', 'openrail++', 'bigscience-openrail-m',
  'creativeml-openrail-m', 'bigcode-openrail-m',
]);

function isEligibleLicense(license) {
  if (!license) return false;
  const normalized = license.toLowerCase().replace(/\s+/g, '-');
  return ELIGIBLE_LICENSES.has(normalized);
}

// ─── Normalized Result Shape ─────────────────────────────────────────
/**
 * @typedef {Object} SkimResult
 * @property {string} id          - Unique identifier (platform:owner/name)
 * @property {string} platform    - Source platform
 * @property {string} name        - Asset name
 * @property {string} author      - Owner/organization
 * @property {string} description - Short description
 * @property {string} license     - SPDX identifier
 * @property {string} url         - Direct link
 * @property {string} type        - model | space | dataset | repo | game | asset
 * @property {number} stars       - Popularity metric
 * @property {number} downloads   - Download count
 * @property {string} updatedAt   - ISO timestamp
 * @property {string[]} tags      - Relevant tags
 * @property {string} thumbnail   - Preview image URL (if available)
 * @property {string} eligibility - 'white-label' | 'redeployable' | 'template' | 'reference'
 */

function classifyEligibility(license, type) {
  const lic = (license || '').toLowerCase();
  if (['mit', 'unlicense', 'cc0-1.0', 'wtfpl', 'isc', 'bsd-2-clause'].some(l => lic.includes(l))) {
    return 'white-label'; // Full rebrand allowed
  }
  if (['apache-2.0', 'bsd-3-clause', 'mpl-2.0'].some(l => lic.includes(l))) {
    return 'redeployable'; // Can redeploy with attribution
  }
  if (['cc-by-4.0', 'cc-by-sa-4.0', 'ofl-1.1'].some(l => lic.includes(l))) {
    return 'template'; // Can use as template with credits
  }
  return 'reference'; // Study only
}

// ─── Hugging Face API ────────────────────────────────────────────────

const HF_API = 'https://huggingface.co/api';

/**
 * Search Hugging Face models
 * @param {Object} opts
 * @param {string} opts.query - Search query
 * @param {string} [opts.type='model'] - model | space | dataset
 * @param {number} [opts.limit=20] - Max results
 * @param {string} [opts.sort='downloads'] - Sort by: downloads, likes, modified
 * @param {string} [opts.filter] - Pipeline tag filter (e.g., 'text-generation')
 * @returns {Promise<SkimResult[]>}
 */
export async function skimHuggingFace({
  query = '',
  type = 'model',
  limit = 20,
  sort = 'downloads',
  filter = '',
  direction = -1,
} = {}) {
  try {
    const endpoint = type === 'model' ? 'models'
      : type === 'space' ? 'spaces'
      : type === 'dataset' ? 'datasets'
      : 'models';

    const params = new URLSearchParams({
      search: query,
      sort,
      direction: String(direction),
      limit: String(limit),
    });

    if (filter) params.append('filter', filter);

    const res = await fetch(`${HF_API}/${endpoint}?${params}`);
    if (!res.ok) throw new Error(`HF API error ${res.status}`);
    const items = await res.json();

    return items
      .filter(item => {
        // Filter to eligible licenses only
        const lic = item.license || item.cardData?.license || '';
        return isEligibleLicense(lic);
      })
      .map(item => {
        const license = item.license || item.cardData?.license || 'unknown';
        const author = item.author || item.id?.split('/')[0] || 'unknown';
        const name = item.modelId || item.id || item.name || 'Untitled';

        return {
          id: `hf:${name}`,
          platform: 'huggingface',
          name: name.split('/').pop(),
          author,
          description: item.description || item.cardData?.description || `${type} on Hugging Face`,
          license,
          url: `https://huggingface.co/${name}`,
          type,
          stars: item.likes || 0,
          downloads: item.downloads || 0,
          updatedAt: item.lastModified || item.updatedAt || new Date().toISOString(),
          tags: item.tags || item.pipeline_tag ? [item.pipeline_tag, ...(item.tags || [])].filter(Boolean) : [],
          thumbnail: type === 'space'
            ? `https://huggingface.co/spaces/${name}/resolve/main/screenshot.png`
            : null,
          eligibility: classifyEligibility(license, type),
        };
      });
  } catch (err) {
    console.error('[Skimmer] HuggingFace error:', err);
    return [];
  }
}

/**
 * Get detailed info for a specific HF model/space/dataset
 */
export async function getHuggingFaceDetail(modelId, type = 'model') {
  try {
    const endpoint = type === 'model' ? 'models'
      : type === 'space' ? 'spaces'
      : 'datasets';
    const res = await fetch(`${HF_API}/${endpoint}/${modelId}`);
    if (!res.ok) throw new Error(`HF detail error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[Skimmer] HF detail error:', err);
    return null;
  }
}

// ─── GitHub API ──────────────────────────────────────────────────────

const GH_API = 'https://api.github.com';

/**
 * Search GitHub repos with permissive licenses
 * @param {Object} opts
 * @param {string} opts.query - Search query
 * @param {number} [opts.limit=20]
 * @param {string} [opts.sort='stars'] - stars, forks, updated
 * @param {string} [opts.language] - Filter by language
 * @param {string} [opts.license] - SPDX license filter (e.g., 'mit')
 * @param {string} [opts.token] - GitHub PAT for higher rate limits
 * @returns {Promise<SkimResult[]>}
 */
export async function skimGitHub({
  query = '',
  limit = 20,
  sort = 'stars',
  language = '',
  license = '',
  token = '',
} = {}) {
  try {
    let q = query;
    if (language) q += ` language:${language}`;
    if (license) q += ` license:${license}`;

    // Default to permissive licenses if none specified
    if (!license) {
      q += ' license:mit OR license:apache-2.0 OR license:bsd-2-clause OR license:bsd-3-clause OR license:unlicense';
    }

    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `token ${token}`;

    const params = new URLSearchParams({
      q,
      sort,
      order: 'desc',
      per_page: String(limit),
    });

    const res = await fetch(`${GH_API}/search/repositories?${params}`, { headers });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const data = await res.json();

    return (data.items || []).map(repo => {
      const license = repo.license?.spdx_id || repo.license?.key || 'unknown';
      return {
        id: `gh:${repo.full_name}`,
        platform: 'github',
        name: repo.name,
        author: repo.owner?.login || 'unknown',
        description: repo.description || 'No description',
        license,
        url: repo.html_url,
        type: 'repo',
        stars: repo.stargazers_count || 0,
        downloads: 0, // GitHub doesn't track downloads directly
        updatedAt: repo.updated_at,
        tags: [repo.language, ...(repo.topics || [])].filter(Boolean),
        thumbnail: repo.owner?.avatar_url || null,
        eligibility: classifyEligibility(license, 'repo'),
      };
    });
  } catch (err) {
    console.error('[Skimmer] GitHub error:', err);
    return [];
  }
}

// ─── itch.io Scraper (via backend proxy) ─────────────────────────────

/**
 * Search itch.io for open-license games and tools
 * Routes through the NovAura backend to avoid CORS
 */
export async function skimItchIo({
  query = '',
  type = 'games', // games | tools | assets
  limit = 20,
} = {}) {
  try {
    const res = await fetch(`${BACKEND_URL}/skimmer/itch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ query, type, limit }),
    });

    if (!res.ok) {
      // Fallback: return empty if backend doesn't have itch endpoint yet
      console.warn('[Skimmer] itch.io backend not available yet');
      return [];
    }

    const data = await res.json();
    return (data.results || []).map(item => ({
      id: `itch:${item.id || item.url}`,
      platform: 'itch.io',
      name: item.title || item.name || 'Untitled',
      author: item.author || item.user?.username || 'unknown',
      description: item.short_text || item.description || '',
      license: item.license || 'unknown',
      url: item.url || `https://itch.io`,
      type: type === 'games' ? 'game' : 'asset',
      stars: item.rating_count || 0,
      downloads: item.downloads_count || 0,
      updatedAt: item.published_at || new Date().toISOString(),
      tags: item.tags || [],
      thumbnail: item.cover_url || item.still_cover_url || null,
      eligibility: classifyEligibility(item.license, type),
    }));
  } catch (err) {
    console.error('[Skimmer] itch.io error:', err);
    return [];
  }
}

// ─── Godot Asset Library ─────────────────────────────────────────────

const GODOT_API = 'https://godotengine.org/asset-library/api';

/**
 * Search the Godot Asset Library
 */
export async function skimGodotAssets({
  query = '',
  limit = 20,
  category = '',
} = {}) {
  try {
    const params = new URLSearchParams({
      filter: query,
      max_results: String(limit),
      sort: 'rating',
    });
    if (category) params.append('category', category);

    const res = await fetch(`${GODOT_API}/asset?${params}`);
    if (!res.ok) throw new Error(`Godot API error ${res.status}`);
    const data = await res.json();

    return (data.result || []).map(asset => ({
      id: `godot:${asset.asset_id}`,
      platform: 'godot',
      name: asset.title || 'Untitled',
      author: asset.author || 'unknown',
      description: asset.blurb || asset.description || '',
      license: asset.cost || 'MIT', // Godot assets are typically MIT
      url: `https://godotengine.org/asset-library/asset/${asset.asset_id}`,
      type: 'asset',
      stars: asset.rating ? Math.round(asset.rating) : 0,
      downloads: asset.download_count || 0,
      updatedAt: asset.modify_date || new Date().toISOString(),
      tags: [asset.category, asset.godot_version].filter(Boolean),
      thumbnail: asset.icon_url || null,
      eligibility: 'white-label', // Godot assets are MIT by default
    }));
  } catch (err) {
    console.error('[Skimmer] Godot error:', err);
    return [];
  }
}

// ─── OpenSERP Discovery ──────────────────────────────────────────────

/**
 * Use OpenSERP for broader discovery of white-label assets
 * Requires a self-hosted OpenSERP instance or the NovAura backend proxy
 * @see https://github.com/karust/openserp
 */
export async function skimOpenSERP({
  query = '',
  limit = 20,
  engine = 'google', // google | yandex | baidu
} = {}) {
  try {
    // Route through backend which hosts the OpenSERP Go binary
    const res = await fetch(`${BACKEND_URL}/skimmer/openserp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        query: `${query} open source white label license:MIT`,
        engine,
        limit,
      }),
    });

    if (!res.ok) {
      console.warn('[Skimmer] OpenSERP backend not available yet');
      return [];
    }

    const data = await res.json();
    return (data.results || []).map((item, i) => ({
      id: `serp:${engine}:${i}:${item.url}`,
      platform: 'openserp',
      name: item.title || 'Untitled',
      author: new URL(item.url).hostname,
      description: item.description || item.snippet || '',
      license: 'unknown', // Will be determined during review
      url: item.url,
      type: 'repo',
      stars: 0,
      downloads: 0,
      updatedAt: new Date().toISOString(),
      tags: ['discovered', engine],
      thumbnail: null,
      eligibility: 'reference', // Needs manual review
    }));
  } catch (err) {
    console.error('[Skimmer] OpenSERP error:', err);
    return [];
  }
}

// ─── Unified Multi-Platform Skim ─────────────────────────────────────

/**
 * Run a skim across all configured platforms simultaneously
 * @param {Object} opts
 * @param {string} opts.query - Search query
 * @param {string[]} [opts.platforms] - Which platforms to search
 * @param {number} [opts.limit=10] - Per-platform limit
 * @param {Object} [opts.tokens] - API tokens { github: '...', huggingface: '...' }
 * @returns {Promise<{ results: SkimResult[], meta: Object }>}
 */
export async function skimAll({
  query = '',
  platforms = ['huggingface', 'github', 'godot'],
  limit = 10,
  tokens = {},
} = {}) {
  const startTime = Date.now();
  const promises = [];
  const platformNames = [];

  if (platforms.includes('huggingface')) {
    // Skim models, spaces, and datasets in parallel
    promises.push(skimHuggingFace({ query, type: 'model', limit, sort: 'downloads' }));
    platformNames.push('hf-models');
    promises.push(skimHuggingFace({ query, type: 'space', limit: Math.floor(limit / 2), sort: 'likes' }));
    platformNames.push('hf-spaces');
    promises.push(skimHuggingFace({ query, type: 'dataset', limit: Math.floor(limit / 2), sort: 'downloads' }));
    platformNames.push('hf-datasets');
  }

  if (platforms.includes('github')) {
    promises.push(skimGitHub({ query, limit, token: tokens.github || '' }));
    platformNames.push('github');
  }

  if (platforms.includes('itch')) {
    promises.push(skimItchIo({ query, limit }));
    platformNames.push('itch.io');
  }

  if (platforms.includes('godot')) {
    promises.push(skimGodotAssets({ query, limit }));
    platformNames.push('godot');
  }

  if (platforms.includes('openserp')) {
    promises.push(skimOpenSERP({ query, limit }));
    platformNames.push('openserp');
  }

  const settled = await Promise.allSettled(promises);
  const allResults = [];
  const errors = [];

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    } else {
      errors.push({ platform: platformNames[i], error: result.reason?.message });
    }
  });

  // Sort by eligibility priority, then by downloads/stars
  const eligibilityOrder = { 'white-label': 0, 'redeployable': 1, 'template': 2, 'reference': 3 };
  allResults.sort((a, b) => {
    const eDiff = (eligibilityOrder[a.eligibility] || 3) - (eligibilityOrder[b.eligibility] || 3);
    if (eDiff !== 0) return eDiff;
    return (b.downloads + b.stars) - (a.downloads + a.stars);
  });

  return {
    results: allResults,
    meta: {
      query,
      platforms: platformNames,
      totalResults: allResults.length,
      errors,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      breakdown: {
        whiteLabel: allResults.filter(r => r.eligibility === 'white-label').length,
        redeployable: allResults.filter(r => r.eligibility === 'redeployable').length,
        template: allResults.filter(r => r.eligibility === 'template').length,
        reference: allResults.filter(r => r.eligibility === 'reference').length,
      },
    },
  };
}

// ─── Pipeline Tags for HF Discovery ─────────────────────────────────

export const HF_PIPELINE_TAGS = [
  'text-generation', 'text-to-image', 'image-to-text',
  'text-classification', 'token-classification',
  'question-answering', 'summarization', 'translation',
  'fill-mask', 'text-to-speech', 'automatic-speech-recognition',
  'image-classification', 'object-detection', 'image-segmentation',
  'depth-estimation', 'video-classification',
  'reinforcement-learning', 'tabular-classification',
  'text-to-video', 'image-to-image', 'unconditional-image-generation',
];

export const SKIMMER_PLATFORMS = [
  { id: 'huggingface', name: 'Hugging Face', icon: '🤗', color: '#FFD21E' },
  { id: 'github', name: 'GitHub', icon: '🐙', color: '#238636' },
  { id: 'godot', name: 'Godot Assets', icon: '🎮', color: '#478CBF' },
  { id: 'itch', name: 'itch.io', icon: '🕹️', color: '#FA5C5C' },
  { id: 'openserp', name: 'OpenSERP', icon: '🔍', color: '#4285F4' },
];
