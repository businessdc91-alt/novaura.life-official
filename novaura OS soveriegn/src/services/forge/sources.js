// sources.js — Search adapters for the Discovery Forge.
// Every adapter returns normalised results:
// { source, id, title, author, url, description, kind, license, stats: {...}, rating?, price?, thumb?, importable, meta }

import { analyzeLicense } from './licenses.js';

export const SOURCES = {
  github: { label: 'GitHub', kinds: ['app', 'library', 'game'] },
  hf_spaces: { label: 'Hugging Face Spaces', kinds: ['app'] },
  hf_models: { label: 'Hugging Face Models', kinds: ['model'] },
  itch: { label: 'itch.io', kinds: ['game', 'asset'] },
  drive: { label: 'Google Drive', kinds: ['file'] },
};

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

async function vaultKey(name) {
  try {
    const { db } = await import('../../database/sovereignDatabase.js');
    const rec = await db.vault.get(name);
    return rec?.value || '';
  } catch {
    return '';
  }
}

// ── GitHub ─────────────────────────────────────────────────────────────────

export function mapGithubRepo(r) {
  return {
    source: 'github',
    id: r.full_name,
    title: r.name,
    author: r.owner?.login || r.full_name.split('/')[0],
    url: r.html_url,
    description: r.description || '',
    kind: /game/i.test(`${r.description} ${(r.topics || []).join(' ')}`) ? 'game' : 'app',
    license: analyzeLicense(r.license?.spdx_id),
    licenseId: r.license?.spdx_id || '',
    stats: { stars: r.stargazers_count, forks: r.forks_count, openIssues: r.open_issues_count, updated: r.pushed_at },
    language: r.language || '',
    topics: r.topics || [],
    homepage: r.homepage || '',
    importable: true,
    meta: { owner: r.owner?.login, repo: r.name, branch: r.default_branch, archived: r.archived },
  };
}

export async function searchGithub(query, { limit = 12, fetchImpl = fetch } = {}) {
  const token = await vaultKey('github');
  const res = await fetchImpl(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 403) throw new Error('GitHub search limit reached (10 per minute without a token). Add a GitHub token in Settings to raise it.');
  if (!res.ok) throw new Error(`GitHub search failed (${res.status}).`);
  const data = await res.json();
  return (data.items || []).map(mapGithubRepo);
}

// ── Hugging Face ───────────────────────────────────────────────────────────

const hfLicense = (tags = []) => (tags.find(t => t.startsWith('license:')) || '').replace('license:', '');

export async function searchHfSpaces(query, { limit = 12, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://huggingface.co/api/spaces?search=${encodeURIComponent(query)}&sort=likes&direction=-1&limit=${limit}&full=true`);
  if (!res.ok) throw new Error(`Hugging Face search failed (${res.status}).`);
  return (await res.json()).map(s => ({
    source: 'hf_spaces',
    id: s.id,
    title: s.cardData?.title || s.id.split('/')[1],
    author: s.id.split('/')[0],
    url: `https://huggingface.co/spaces/${s.id}`,
    description: s.cardData?.short_description || '',
    kind: 'app',
    license: analyzeLicense(hfLicense(s.tags) || s.cardData?.license),
    licenseId: hfLicense(s.tags) || s.cardData?.license || '',
    stats: { likes: s.likes, updated: s.lastModified },
    sdk: s.sdk,
    // Static Spaces are plain web apps that run in the preview as they are.
    importable: s.sdk === 'static',
    meta: { space: s.id },
  }));
}

export async function searchHfModels(query, { limit = 12, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=${limit}`);
  if (!res.ok) throw new Error(`Hugging Face search failed (${res.status}).`);
  return (await res.json()).map(m => ({
    source: 'hf_models',
    id: m.id,
    title: m.id.split('/')[1] || m.id,
    author: m.id.split('/')[0],
    url: `https://huggingface.co/${m.id}`,
    description: m.pipeline_tag ? `${m.pipeline_tag.replace(/-/g, ' ')} model` : 'Model',
    kind: 'model',
    license: analyzeLicense(hfLicense(m.tags)),
    licenseId: hfLicense(m.tags),
    stats: { downloads: m.downloads, likes: m.likes, updated: m.lastModified },
    pipeline: m.pipeline_tag || '',
    importable: false,
    meta: { model: m.id },
  }));
}

// ── itch.io ────────────────────────────────────────────────────────────────

const unescape = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Parse itch.io search/browse HTML into results (works without a DOM). */
export function parseItchHtml(html, kind = 'game') {
  const cells = String(html).split(/<div[^>]*class="game_cell[\s"]/).slice(1);
  const out = [];
  for (const cell of cells) {
    const title = /class="title game_link"[^>]*href="([^"]+)"[^>]*>([^<]+)</.exec(cell);
    if (!title) continue;
    const rating = /data-tooltip="([\d.]+) average rating from (\d+) total ratings?"/.exec(cell);
    const price = /class="price_value">([^<]+)</.exec(cell);
    const text = /class="game_text"[^>]*>([^<]*)</.exec(cell);
    const author = /class="game_author"><a[^>]*>([^<]+)</.exec(cell);
    const thumb = /data-lazy_src="([^"]+)"/.exec(cell);
    out.push({
      source: 'itch',
      id: title[1],
      title: unescape(title[2]).trim(),
      author: unescape(author?.[1] || '').trim(),
      url: title[1],
      description: unescape(text?.[1] || '').trim(),
      kind,
      // itch pages rarely state a license in search results; treat as unknown until checked.
      license: analyzeLicense(''),
      licenseId: '',
      stats: {},
      rating: rating ? { average: Number(rating[1]), count: Number(rating[2]) } : null,
      price: price ? price[1].trim() : 'Free',
      thumb: thumb?.[1] || '',
      importable: false,
      meta: {},
    });
  }
  return out;
}

export async function searchItch(query, { limit = 12, kind = 'game' } = {}) {
  if (!isTauri()) throw new Error('itch.io search needs the Sovereign desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  const path = kind === 'asset' ? 'game-assets' : 'search';
  const url = kind === 'asset'
    ? `https://itch.io/game-assets/free?q=${encodeURIComponent(query)}`
    : `https://itch.io/${path}?q=${encodeURIComponent(query)}`;
  const html = await invoke('forge_fetch_text', { url });
  return parseItchHtml(html, kind).slice(0, limit);
}

// ── Google Drive ───────────────────────────────────────────────────────────

export async function searchDrive(query, { limit = 12 } = {}) {
  const { searchGoogleDriveFiles } = await import('../fileStorageService.js');
  // The Drive helper builds a quoted query; strip quotes so names cannot break it.
  const files = await searchGoogleDriveFiles(String(query).replace(/['"\\]/g, ' ').trim());
  return files.slice(0, limit).map(f => ({
    source: 'drive',
    id: f.id,
    title: f.name,
    author: 'Your Google Drive',
    url: `https://drive.google.com/file/d/${f.id}/view`,
    description: f.mimeType,
    kind: 'file',
    license: { ...analyzeLicense('unlicense'), verdict: 'Your own file', summary: 'A file in your own Drive.' },
    licenseId: 'own',
    stats: { updated: f.modifiedTime, size: Number(f.size) || 0 },
    importable: /zip|html|javascript|json|text/.test(f.mimeType),
    meta: { mimeType: f.mimeType },
  }));
}

export const SEARCHERS = {
  github: searchGithub,
  hf_spaces: searchHfSpaces,
  hf_models: searchHfModels,
  itch: (q, o) => searchItch(q, { ...o, kind: 'game' }),
  itch_assets: (q, o) => searchItch(q, { ...o, kind: 'asset' }),
  drive: searchDrive,
};
