// forgeService.js — Discovery Forge: find open-source apps, models and assets,
// check what their licenses allow, and turn them into the user's own branded,
// reviewed, improved apps.

import { db } from '../../database/sovereignDatabase.js';
import { SEARCHERS, SOURCES } from './sources.js';
import { analyzeLicense } from './licenses.js';
import { listCybeniModels, runModel, suggestRoles } from '../cybeni/models.js';
import { runPipeline } from '../cybeni/pipeline.js';
import { buildPreview, normalizePath } from '../cybeni/previewBuilder.js';
import { verifyInHiddenFrame } from '../cybeni/previewHost.js';
import { createProject, updateProject, listProjects, loadProjectFiles, replaceProjectFiles, createCheckpoint } from '../cybeni/projectStore.js';
import { generateImage, iconPrompt, makeIconPng } from '../engines/imageGen.js';
import { marketplacePublish } from '../marketplacePublishService.js';

const BRAND_KEY = 'forge_brand_profile';
const USER_APPS_KEY = 'user_apps';

const TEXT_EXT = /\.(html?|css|scss|less|m?jsx?|tsx?|json|md|txt|svg|xml|ya?ml|toml|vue|svelte|webmanifest)$/i;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|ico|bmp|mp3|wav|ogg|m4a|mp4|webm|woff2?|ttf|otf|eot)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|coverage|\.next|vendor|target|__pycache__)(\/|$)/;
const LEGAL_FILE = /^(license|licence|copying|notice|authors|credits)(\.\w+)?$/i;
const LIMITS = { files: 400, fileBytes: 400000, totalBytes: 3000000 };

// ── Text model ─────────────────────────────────────────────────────────────

async function cybeniRoles() {
  const saved = await db.getSetting('cybeni_settings', null).catch(() => null);
  const models = await listCybeniModels();
  const suggested = suggestRoles(models);
  const roles = { ...suggested, ...(saved?.roles || {}) };
  const available = new Set(models.map(m => m.key));
  for (const r of Object.keys(roles)) if (!available.has(roles[r])) roles[r] = suggested[r];
  return roles;
}

async function ask(system, user, opts = {}) {
  const roles = await cybeniRoles();
  if (!roles.architect) throw new Error('No AI model is available. Start LM Studio or Ollama.');
  return runModel(roles.architect, [{ role: 'system', content: system }, { role: 'user', content: user }], { maxTokens: 1500, temperature: 0.3, ...opts });
}

const jsonFrom = (text, open = '[', close = ']') => JSON.parse(text.slice(text.indexOf(open), text.lastIndexOf(close) + 1));

// ── Discover ───────────────────────────────────────────────────────────────

/** Heuristic plan when no model is available. */
export function heuristicPlan(request) {
  const r = request.toLowerCase();
  const sources = new Set();
  if (/\b(model|lora|checkpoint|gguf|llm|diffusion|tts|whisper|embedding)\b/.test(r)) sources.add('hf_models');
  if (/\b(sprite|tileset|asset|sound ?effects?|sfx|texture|font|music pack|pixel art)\b/.test(r)) sources.add('itch_assets');
  if (/\b(game|platformer|rpg|puzzle|shooter)\b/.test(r)) { sources.add('itch'); sources.add('github'); }
  if (/\b(app|tool|website|dashboard|tracker|editor|timer|player|manager|calculator|clone|template)\b/.test(r) || !sources.size) { sources.add('github'); sources.add('hf_spaces'); }
  const query = request.replace(/\b(find|me|an?|the|please|i want|i need|looking for|something|that|can|open source|free)\b/gi, ' ').replace(/\s+/g, ' ').trim() || request;
  return { sources: [...sources], queries: Object.fromEntries([...sources].map(s => [s, query])), intent: request };
}

async function planSearch(request) {
  try {
    const text = await ask(
      'You plan searches for open-source software, AI models and creative assets. Reply with JSON only.',
      [
        `Request: ${request}`,
        `Sources: github (code repos and apps), hf_spaces (Hugging Face web apps), hf_models (AI models), itch (indie games), itch_assets (free game assets), drive (the user's own Google Drive files).`,
        'Return {"sources": [...], "queries": {"<source>": "<short search query>"}, "intent": "<one sentence restating what the user wants>"}.',
        'For github, you may use qualifiers such as language:JavaScript or topic:pwa. Prefer web technologies (HTML/JS/React) when the user wants an app, since those can be previewed and rebranded.',
      ].join('\n'),
      { maxTokens: 400, temperature: 0.2 },
    );
    const plan = jsonFrom(text, '{', '}');
    const sources = (plan.sources || []).filter(s => SEARCHERS[s]);
    if (sources.length) return { sources, queries: plan.queries || {}, intent: plan.intent || request, planned: 'ai' };
  } catch (err) {
    console.warn('[Forge] AI search planning unavailable:', err.message);
  }
  return { ...heuristicPlan(request), planned: 'heuristic' };
}

function popularity(r) {
  const s = r.stats || {};
  const signal = (s.stars || 0) + (s.likes || 0) * 3 + (s.downloads || 0) / 200 + (r.rating ? r.rating.average * Math.min(r.rating.count, 50) : 0);
  return Math.log10(1 + signal);
}

function heuristicRank(results) {
  return results
    .map(r => ({ ...r, score: popularity(r) + (r.license.whiteLabel ? 1.5 : r.license.rebrand ? 0.5 : -1) + (r.importable ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Search the chosen (or AI-planned) sources and rank the results for the request.
 * Returns { plan, results, errors }.
 */
export async function discover(request, { sources: chosen, onStatus } = {}) {
  onStatus?.('Planning the search…');
  const plan = await planSearch(request);
  const sources = chosen?.length ? chosen : plan.sources;
  onStatus?.(`Searching ${sources.map(s => SOURCES[s.replace('_assets', '')]?.label || s).join(', ')}…`);
  const errors = {};
  const batches = await Promise.all(sources.map(async (s) => {
    try {
      return await SEARCHERS[s](plan.queries[s] || request, { limit: 10 });
    } catch (err) {
      errors[s] = err.message;
      return [];
    }
  }));
  let results = heuristicRank(batches.flat());

  if (results.length) {
    onStatus?.('Reviewing the results…');
    try {
      const top = results.slice(0, 18);
      const text = await ask(
        'You review search results for someone who wants to build on open source. Be honest and specific. Reply with JSON only.',
        [
          `What the user wants: ${plan.intent}`,
          'Results:',
          ...top.map((r, i) => `${i}. [${r.source}] ${r.title} by ${r.author}: ${r.description.slice(0, 200)} | license: ${r.licenseId || 'none'} (${r.license.verdict}) | ${JSON.stringify(r.stats)}${r.rating ? ` | rated ${r.rating.average} from ${r.rating.count}` : ''}`),
          'Return a JSON array, best match first: [{"i": <index>, "fit": 0-10, "summary": "<what it is and why it fits, 1-2 sentences>", "watchOut": "<risks: license, abandoned, quality; or empty>"}]. Leave out results that do not fit.',
        ].join('\n'),
        { maxTokens: 1800, temperature: 0.2 },
      );
      const reviews = jsonFrom(text);
      const reviewed = reviews
        .filter(x => top[x.i])
        .map(x => ({ ...top[x.i], fit: Math.max(0, Math.min(10, Number(x.fit) || 0)), summary: String(x.summary || ''), watchOut: String(x.watchOut || '') }));
      const seen = new Set(reviewed.map(r => r.id));
      results = [...reviewed, ...results.filter(r => !seen.has(r.id))];
    } catch (err) {
      console.warn('[Forge] AI review unavailable; using popularity ranking:', err.message);
    }
  }
  return { plan: { ...plan, sources }, results, errors };
}

// ── Import ─────────────────────────────────────────────────────────────────

async function githubFiles({ owner, repo, branch }, fetchImpl = fetch) {
  const tree = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!tree.ok) throw new Error(`Could not read the repository (${tree.status}).`);
  const items = (await tree.json()).tree || [];
  return {
    entries: items.filter(i => i.type === 'blob').map(i => ({ path: i.path, size: i.size || 0 })),
    raw: (p) => `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${p.split('/').map(encodeURIComponent).join('/')}`,
  };
}

async function spaceFiles(space, fetchImpl = fetch) {
  const res = await fetchImpl(`https://huggingface.co/api/spaces/${space}/tree/main?recursive=true`);
  if (!res.ok) throw new Error(`Could not read the Space (${res.status}).`);
  const items = await res.json();
  return {
    entries: items.filter(i => i.type === 'file').map(i => ({ path: i.path, size: i.size || i.lfs?.size || 0 })),
    raw: (p) => `https://huggingface.co/spaces/${space}/resolve/main/${p.split('/').map(encodeURIComponent).join('/')}`,
  };
}

/**
 * Plan which files to take. Text files are imported; binary assets stay at their
 * source and are referenced by URL; legal files are always kept.
 */
export function selectFiles(entries) {
  const take = [];
  const assets = [];
  const skipped = [];
  let total = 0;
  for (const e of entries) {
    const p = normalizePath(e.path);
    const name = p.split('/').pop();
    if (SKIP_DIR.test(p)) { skipped.push(p); continue; }
    if (LEGAL_FILE.test(name)) { take.push(p); total += e.size; continue; }
    if (ASSET_EXT.test(p)) { assets.push(p); continue; }
    if (!TEXT_EXT.test(p) || e.size > LIMITS.fileBytes || /package-lock\.json|yarn\.lock|pnpm-lock\.yaml/.test(name)) { skipped.push(p); continue; }
    if (take.length >= LIMITS.files || total + e.size > LIMITS.totalBytes) { skipped.push(p); continue; }
    take.push(p);
    total += e.size;
  }
  return { take, assets, skipped };
}

/** Path from a folder to a file, e.g. ("assets/css", "assets/image/a.png") -> "../image/a.png". */
export function relativePath(fromDir, target) {
  const from = fromDir ? fromDir.split('/') : [];
  const to = target.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  return [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/');
}

/** Point references to binary assets at their source URLs (HTML, CSS and JS). */
export function linkAssets(files, assets, rawUrl) {
  if (!assets.length) return files;
  return files.map(f => {
    if (!/\.(html?|css|m?jsx?|tsx?|vue|svelte)$/i.test(f.path)) return f;
    let content = f.content;
    // CSS and HTML resolve paths against their own folder; path strings in scripts
    // resolve against the page (the root index.html).
    const dir = /\.(css|html?)$/i.test(f.path) && f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
    for (const a of assets) {
      const url = rawUrl(a);
      const rel = relativePath(dir, a);
      // Root-absolute and the path relative to this file are the only forms that
      // really point at the asset; a bare "img/x.png" inside css/ means css/img/x.png.
      const forms = [...new Set([`/${a}`, rel, rel.startsWith('.') ? null : `./${rel}`].filter(Boolean))];
      for (const form of forms) {
        const esc = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        content = content.replace(new RegExp(`(["'(\\s=])${esc}(?=["')\\s?#])`, 'g'), `$1${url}`);
      }
    }
    return { ...f, content };
  });
}

/**
 * Import a search result as a new Cybeni project.
 * Returns { project, imported, assets, skipped }.
 */
export async function importResult(result, { onStatus } = {}) {
  if (!result.importable) throw new Error('This item cannot be imported automatically. Open its page to get it.');
  if (!result.license.rebrand && result.licenseId !== 'own') {
    throw new Error(`Its license does not allow modified versions (${result.license.verdict}).`);
  }
  onStatus?.('Reading the file list…');
  const listing = result.source === 'github' ? await githubFiles(result.meta) : await spaceFiles(result.meta.space);
  const { take, assets, skipped } = selectFiles(listing.entries);
  if (!take.length) throw new Error('No source files that Sovereign can work with were found.');
  const files = [];
  for (let i = 0; i < take.length; i++) {
    onStatus?.(`Downloading ${i + 1} of ${take.length}: ${take[i]}`);
    const res = await fetch(listing.raw(take[i]));
    if (res.ok) files.push({ path: take[i], content: await res.text() });
  }
  const linked = linkAssets(files, assets, listing.raw);
  const origin = {
    source: result.source,
    id: result.id,
    url: result.url,
    author: result.author,
    license: result.licenseId || '',
    licenseVerdict: result.license.verdict,
    obligations: result.license.obligations,
    importedAt: Date.now(),
  };
  linked.push({
    path: 'ATTRIBUTION.md',
    content: `# Attribution\n\nThis app is based on **${result.title}** by ${result.author}.\n\n- Source: ${result.url}\n- License: ${result.licenseId || 'see the original'} (${result.license.verdict})\n\n${result.license.obligations.map(o => `- ${o}`).join('\n')}\n\nThe original license and notices are kept in this project and must stay with any copy you distribute.\n`,
  });
  const project = await createProject(`${result.title}`, 'blank');
  await replaceProjectFiles(project.slug, linked);
  await updateProject(project.slug, { origin, forge: { status: 'imported', assetCount: assets.length } });
  return { project: { ...project, origin }, imported: linked.length, assets: assets.length, skipped: skipped.length };
}

// ── Brand ──────────────────────────────────────────────────────────────────

export async function getBrandProfile() {
  return { name: '', tagline: '', primary: '#7c3aed', secondary: '#06b6d4', tone: 'friendly and modern', company: '', ...(await db.getSetting(BRAND_KEY, {}).catch(() => ({}))) };
}

export async function setBrandProfile(patch) {
  const next = { ...(await getBrandProfile()), ...patch };
  await db.setSetting(BRAND_KEY, next);
  return next;
}

function rebrandRequest(brand, origin, extra = '') {
  return [
    `Rebrand this app as "${brand.name}"${brand.tagline ? ` with the tagline "${brand.tagline}"` : ''}.`,
    `Brand colours: primary ${brand.primary}, secondary ${brand.secondary}. Voice and tone: ${brand.tone}.${brand.company ? ` Made by ${brand.company}.` : ''}`,
    'Replace the old product name, logo text, titles, metadata and colour scheme throughout. Keep the features working.',
    'Make sure the app runs in the browser preview (index.html at the root, ES modules).',
    `License duties you must respect (${origin?.license || 'see ATTRIBUTION.md'}): ${(origin?.obligations || []).join(' ')} Never delete LICENSE, NOTICE or ATTRIBUTION.md files, and keep the original copyright lines in them.`,
    extra,
  ].filter(Boolean).join('\n');
}

/**
 * Rebrand (or apply any change to) an imported project with the Cybeni pipeline.
 * hooks: { onPhase, onLog, onFiles, ask, isCancelled }
 */
export async function runForgeChange(slug, request, { mode = 'standard', hooks = {} } = {}) {
  const roles = await cybeniRoles();
  const before = await loadProjectFiles(slug);
  const checkpointId = await createCheckpoint(slug, `Forge: ${request.slice(0, 120)}`, before);
  const result = await runPipeline({ request, files: before, mode, roles, security: 'hardened', quality: 'strict' }, {
    runModel,
    verify: (snapshot) => verifyInHiddenFrame(snapshot),
    ...hooks,
  });
  // Legal files must survive any change.
  const legal = before.filter(f => LEGAL_FILE.test(f.path.split('/').pop()) || f.path === 'ATTRIBUTION.md');
  const files = [...result.files.filter(f => !legal.some(l => l.path === f.path)), ...legal];
  await replaceProjectFiles(slug, files);
  return { ...result, files, checkpointId };
}

export async function rebrandProject(slug, { brand, mode = 'standard', extra = '', hooks } = {}) {
  const project = (await listProjects()).find(p => p.slug === slug);
  const b = brand || await getBrandProfile();
  if (!b.name) throw new Error('Set a brand name first.');
  const result = await runForgeChange(slug, rebrandRequest(b, project?.origin, extra), { mode, hooks });
  await updateProject(slug, {
    name: b.name,
    brand: b,
    forge: { ...(project?.forge || {}), status: result.status === 'done' ? 'complete' : 'needs-attention', approved: result.approved, rebrandedAt: Date.now() },
  });
  return result;
}

/** AI-suggested improvements: [{ title, why, change, effort }]. */
export async function suggestEnhancements(slug) {
  const files = await loadProjectFiles(slug);
  const overview = files.slice(0, 40).map(f => `### ${f.path}\n${f.content.slice(0, 1500)}`).join('\n\n');
  const text = await ask(
    'You are a product engineer reviewing an app for improvements and genuinely new ideas. Reply with JSON only.',
    [
      'Suggest 6 concrete enhancements: a mix of quick polish, missing essentials (accessibility, empty states, persistence, keyboard shortcuts) and one or two innovative features that would make it stand out.',
      'Return [{"title","why","change" (exact instruction a developer could follow),"effort" ("small"|"medium"|"large")}].',
      overview,
    ].join('\n\n'),
    { maxTokens: 1600, temperature: 0.6 },
  );
  return jsonFrom(text).filter(x => x && x.title && x.change).slice(0, 8);
}

export async function forgeProjects() {
  return (await listProjects()).filter(p => p.origin);
}

// ── Icons ──────────────────────────────────────────────────────────────────

export async function generateAppIcon(name, description = '', { onProgress } = {}) {
  const raw = await generateImage({ prompt: iconPrompt(`${name}${description ? `, ${description}` : ''}`), width: 1024, height: 1024, steps: 25, onProgress, prefix: 'icons/Sovereign' });
  const png = await makeIconPng(raw, 512);
  const iconBlobId = `icon_${Date.now().toString(36)}`;
  await db.media_blobs.put({ id: iconBlobId, kind: 'icon', blob: png, createdAt: Date.now() });
  return iconBlobId;
}

// ── Ship ───────────────────────────────────────────────────────────────────

export async function listUserApps() {
  return db.getSetting(USER_APPS_KEY, []).catch(() => []);
}

/** Add a project to Sovereign as its own app (runs in the isolated preview). */
export async function integrateAsApp(slug, { name, color = '#7c3aed', iconBlobId = null }) {
  const apps = (await listUserApps()).filter(a => a.slug !== slug);
  const app = { id: `user_${slug}`, slug, name: name.slice(0, 40), color, iconBlobId, addedAt: Date.now() };
  await db.setSetting(USER_APPS_KEY, [...apps, app]);
  window.dispatchEvent(new CustomEvent('novaura:user_apps_changed'));
  return app;
}

export async function removeUserApp(slug) {
  await db.setSetting(USER_APPS_KEY, (await listUserApps()).filter(a => a.slug !== slug));
  window.dispatchEvent(new CustomEvent('novaura:user_apps_changed'));
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Install as a standalone desktop app with its own icon. Returns the shortcut path. */
export async function installToDesktop(slug, { name, iconBlobId }) {
  const { html, issues } = buildPreview(await loadProjectFiles(slug), { mode: 'inline' });
  if (issues.some(i => i.type === 'no-entry')) throw new Error('This project has nothing to run yet.');
  const icon = iconBlobId ? (await db.media_blobs.get(iconBlobId))?.blob : null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('forge_install_desktop_app', {
    slug,
    name: name.replace(/[^\p{L}\p{N} \-_.&'!]/gu, '').slice(0, 60) || slug,
    html,
    iconPngBase64: icon ? await blobToBase64(icon) : null,
  });
}

export async function publishProject(slug, { category = 'apps', description = '' } = {}) {
  const project = (await listProjects()).find(p => p.slug === slug);
  const files = await loadProjectFiles(slug);
  const credit = project?.origin ? `\n\nBased on ${project.origin.url} (${project.origin.license || 'see attribution'}).` : '';
  await marketplacePublish.publishCreation({
    title: project?.name || slug,
    category,
    description: `${description || project?.brand?.tagline || 'Built and rebranded in Sovereign.'}${credit}`,
    tags: [category, 'sovereign', project?.origin?.source].filter(Boolean),
    content: JSON.stringify({ format: 'cybeni-project-v1', files }),
    license: project?.origin?.license ? `${project.origin.license} (original) + your changes` : 'All rights reserved by the creator',
  });
  await updateProject(slug, { forge: { ...(project?.forge || {}), publishedAt: Date.now(), publishedAs: category } });
}

export { analyzeLicense };
