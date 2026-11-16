// manuscriptStore.js — Durable Local Storage & Versioning Engine for Literature Forge
// Backed by Dexie IndexedDB (NovauraSovereignPrivateCloud) with an in-memory sync cache
// for zero-latency UI reads, debounced persistence, and automatic local version tracking.

import { db } from '../database/sovereignDatabase.js';
import { ipc } from '../kernel/IPCBus.js';
import { compileBook } from '../components/windows/literature/engines/BookCompiler.js';

const LEGACY_STORAGE_KEY = 'novaura_sovereign_manuscripts_v1';
const STATE_KEY = 'literature_workspace_state';

// In-memory synchronous cache
let _cache = {
  files: [],
  activeFileId: null,
  openTabs: [],
  isHydrated: false,
};

const _subscribers = new Set();

function notifySubscribers() {
  const snapshot = { ..._cache };
  for (const sub of _subscribers) {
    try {
      sub(snapshot);
    } catch (err) {
      console.error('[ManuscriptStore] Subscriber notification error:', err);
    }
  }
}

/**
 * Subscribe to workspace state changes (files, active document, open tabs).
 * Returns an unsubscribe cleanup function.
 */
export function subscribeManuscriptStore(callback) {
  _subscribers.add(callback);
  if (_cache.isHydrated) {
    callback({ ..._cache });
  }
  return () => _subscribers.delete(callback);
}

// Track debounced version saving per document
const _versionTimers = new Map();

async function recordDocumentVersion(doc) {
  if (!doc || !doc.id) return;
  try {
    const plain = (doc.content || '').replace(/<[^>]+>/g, ' ').trim();
    const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    
    // Check last recorded version to avoid saving identical snapshots
    const lastVersion = await db.manuscript_versions
      .where('docId')
      .equals(doc.id)
      .reverse()
      .sortBy('createdAt')
      .then(versions => versions[0]);

    if (lastVersion && lastVersion.content === doc.content) {
      return; // No content change
    }

    await db.manuscript_versions.add({
      docId: doc.id,
      docName: doc.name,
      content: doc.content,
      wordCount,
      createdAt: new Date().toISOString(),
    });

    // Prune excessive revisions (keep last 50 revisions per doc)
    const count = await db.manuscript_versions.where('docId').equals(doc.id).count();
    if (count > 50) {
      const oldest = await db.manuscript_versions
        .where('docId')
        .equals(doc.id)
        .sortBy('createdAt')
        .then(res => res.slice(0, count - 50));
      for (const v of oldest) {
        await db.manuscript_versions.delete(v.id);
      }
    }

    // Cascading reactive sovereign event to OS & Chain Logic Weaver
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:document_saved', {
        detail: {
          id: doc.id,
          name: doc.name,
          content: plain,
          wordCount,
          timestamp: Date.now(),
          source: 'manuscript_store',
        },
      }));
    }
    ipc.emit('document:saved', {
      id: doc.id,
      name: doc.name,
      content: plain,
      wordCount,
      timestamp: Date.now(),
      source: 'manuscript_store',
    });
  } catch (err) {
    console.warn('[ManuscriptStore] Failed to record version snapshot:', err);
  }
}

/**
 * Force immediate version snapshot and event broadcast
 */
export async function flushDocumentVersion(docId) {
  const doc = _cache.files.find(f => f.id === docId);
  if (!doc) return;
  if (_versionTimers.has(docId)) {
    clearTimeout(_versionTimers.get(docId));
    _versionTimers.delete(docId);
  }
  await recordDocumentVersion(doc);
}

/**
 * Schedule a debounced version snapshot (15 seconds of typing stability)
 */
function scheduleVersionSnapshot(doc) {
  if (_versionTimers.has(doc.id)) {
    clearTimeout(_versionTimers.get(doc.id));
  }
  const timer = setTimeout(() => {
    recordDocumentVersion(doc);
    _versionTimers.delete(doc.id);
  }, 15000);
  _versionTimers.set(doc.id, timer);
}

/**
 * Asynchronously hydrates the in-memory cache from Dexie IndexedDB.
 * Migrates any legacy localStorage records without deleting the legacy copy.
 */
let _hydration = null;

export function initManuscriptStore() {
  if (!_hydration) _hydration = hydrateManuscriptStore();
  return _hydration;
}

async function hydrateManuscriptStore() {
  if (_cache.isHydrated) return _cache;

  try {
    let files = await db.manuscripts.toArray();
    let state = await db.manuscript_state.get(STATE_KEY);

    // If IndexedDB is clean, inspect legacy localStorage for user data
    if ((!files || files.length === 0) && typeof window !== 'undefined') {
      const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (rawLegacy) {
        try {
          const parsed = JSON.parse(rawLegacy);
          if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
            console.info(`[ManuscriptStore] Migrating ${parsed.files.length} documents from localStorage into durable IndexedDB...`);
            
            const isStockSeed = parsed.files.length === 4 &&
              parsed.files.some(f => f.id === 'doc_chap_1' && f.name.includes('The Awakening')) &&
              parsed.files.some(f => f.id === 'doc_lore_world' && f.content.includes('Shattered Lattice'));

            if (!isStockSeed) {
              for (const f of parsed.files) {
                await db.manuscripts.put(f);
              }
              files = parsed.files;
              if (parsed.activeFileId) {
                state = {
                  key: STATE_KEY,
                  activeFileId: parsed.activeFileId,
                  openTabs: Array.isArray(parsed.openTabs) ? parsed.openTabs : [parsed.activeFileId],
                };
                await db.manuscript_state.put(state);
              }
            }
          }
        } catch (e) {
          console.warn('[ManuscriptStore] Legacy migration parse note:', e);
        }
      }
    }

    // Chapters received over the mesh used to be stored as the author's own
    // chapters; they have their own "shared" section now.
    const sorted = (Array.isArray(files) ? files : [])
      .map(f => (f.isMeshShared && f.type !== 'shared' ? { ...f, type: 'shared' } : f))
      .sort((a, b) => (Number.isFinite(a.order) && Number.isFinite(b.order)) ? a.order - b.order : 0);

    _cache.files = sorted;
    _cache.activeFileId = state?.activeFileId || (_cache.files[0] ? _cache.files[0].id : null);
    _cache.openTabs = Array.isArray(state?.openTabs) ? state.openTabs.filter(id => _cache.files.some(f => f.id === id)) : [];
    
    if (_cache.activeFileId && !_cache.openTabs.includes(_cache.activeFileId)) {
      _cache.openTabs.push(_cache.activeFileId);
    }

    _cache.isHydrated = true;
    notifySubscribers();
    return _cache;
  } catch (err) {
    console.error('[ManuscriptStore] Initialization error:', err);
    _cache.isHydrated = true;
    return _cache;
  }
}

// Trigger initial hydration in browser environment
if (typeof window !== 'undefined') {
  initManuscriptStore();
}

/**
 * Persist UI workspace state (active doc, open tabs) to IndexedDB
 */
async function persistWorkspaceState() {
  try {
    await db.manuscript_state.put({
      key: STATE_KEY,
      activeFileId: _cache.activeFileId,
      openTabs: _cache.openTabs,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[ManuscriptStore] Persist state error:', err);
  }
}

/**
 * Synchronous read of all loaded manuscripts
 */
export function getManuscriptFiles() {
  return _cache.files;
}

/**
 * Synchronous read of the active manuscript document
 */
export function getActiveDocument() {
  if (!_cache.files || _cache.files.length === 0) return null;
  return _cache.files.find(f => f.id === _cache.activeFileId) || _cache.files[0] || null;
}

/**
 * Set active document and open tab
 */
export function setActiveDocumentId(id) {
  _cache.activeFileId = id;
  if (id && !_cache.openTabs.includes(id)) {
    _cache.openTabs.push(id);
  }
  notifySubscribers();
  persistWorkspaceState();
}

/**
 * Get active open tabs
 */
export function getOpenTabs() {
  return _cache.openTabs.map(id => _cache.files.find(f => f.id === id)).filter(Boolean);
}

/**
 * Close a tab
 */
export function closeTab(id) {
  _cache.openTabs = _cache.openTabs.filter(t => t !== id);
  if (_cache.activeFileId === id) {
    _cache.activeFileId = _cache.openTabs[0] || (_cache.files[0] ? _cache.files[0].id : null);
  }
  notifySubscribers();
  persistWorkspaceState();
}

/**
 * Update HTML prose content of a document
 */
export function updateDocumentContent(id, htmlContent) {
  const current = _cache.files.find(f => f.id === id);
  if (!current) return;

  const plain = htmlContent.replace(/<[^>]+>/g, ' ').trim();
  const now = new Date().toISOString();
  const file = {
    ...current,
    content: htmlContent,
    lastModified: now,
    updatedAt: now,
    wordCount: plain ? plain.split(/\s+/).filter(Boolean).length : 0,
  };
  _cache.files = _cache.files.map(f => (f.id === id ? file : f));

  notifySubscribers();

  db.manuscripts.put(file).catch(err => {
    console.error('[ManuscriptStore] Failed to update document in Dexie:', err);
  });

  scheduleVersionSnapshot(file);
}

/**
 * Update chapter metadata (status badge, target word count, synopsis, or file name)
 */
export function updateManuscriptMetadata(id, updates = {}) {
  const current = _cache.files.find(f => f.id === id);
  if (!current) return null;

  const now = new Date().toISOString();
  const file = {
    ...current,
    ...updates,
    lastModified: now,
    updatedAt: now,
  };
  _cache.files = _cache.files.map(f => (f.id === id ? file : f));
  notifySubscribers();
  db.manuscripts.put(file).catch(() => {});
  return file;
}

/**
 * Reorder a chapter up (-1) or down (+1) within its type group
 */
export function moveManuscriptFile(id, direction = -1) {
  const idx = _cache.files.findIndex(f => f.id === id);
  if (idx === -1) return;
  const currentType = _cache.files[idx].type;
  // The binder passes 'up' / 'down'; idx + 'up' would be the string "3up".
  const step = direction === 'up' ? -1 : direction === 'down' ? 1 : (Math.sign(Number(direction)) || -1);
  let targetIdx = idx + step;
  while (targetIdx >= 0 && targetIdx < _cache.files.length && _cache.files[targetIdx].type !== currentType) {
    targetIdx += step;
  }
  if (targetIdx < 0 || targetIdx >= _cache.files.length) return;

  const copy = [..._cache.files];
  const [item] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, item);
  _cache.files = copy.map((f, i) => ({ ...f, order: i }));
  notifySubscribers();
  for (const f of _cache.files) {
    db.manuscripts.put(f).catch(() => {});
  }
}

/**
 * Safely replaces text inside HTML text segments (never corrupting HTML tag names or attributes)
 * across either a single document or all editable chapters & lore notes.
 */
export function replaceTextInHtml(html, searchTerm, replacement, { matchCase = false, wholeWord = false } = {}) {
  const query = String(searchTerm || '');
  if (!query) return { html, count: 0 };
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = wholeWord ? `(?<![\\w'-])${escaped}(?![\\w'-])` : escaped;
  const flags = matchCase ? 'g' : 'gi';
  const re = new RegExp(pattern, flags);

  let count = 0;
  // Split into HTML tags vs text segments so tags are untouched. Text is
  // matched as the reader sees it ("Tom & Jerry", never the "amp" inside
  // "&amp;"), and a changed segment is escaped again, so the replacement is
  // always plain text, never markup.
  const parts = String(html || '').split(/(<[^>]+>)/g);
  const updated = parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) return part;
    let hits = 0;
    const replaced = decodeTextEntities(part).replace(re, () => {
      hits++;
      return String(replacement ?? '');
    });
    if (!hits) return part;
    count += hits;
    return encodeTextEntities(replaced);
  }).join('');

  return { html: updated, count };
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

function decodeTextEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

function encodeTextEntities(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}

/**
 * Global Find & Replace across all chapters and lore dossiers in the workspace.
 */
export function replaceAcrossAllManuscripts(searchTerm, replacement, options = {}) {
  let totalReplacements = 0;
  let docsModified = 0;

  for (const doc of _cache.files) {
    if (doc.type === 'shared') continue;
    const { html, count } = replaceTextInHtml(doc.content, searchTerm, replacement, options);
    if (count > 0) {
      totalReplacements += count;
      docsModified++;
      updateDocumentContent(doc.id, html);
    }
  }
  return { totalReplacements, docsModified };
}

/**
 * Create a new manuscript file (chapter or lore dossier)
 */
export function createManuscriptFile(name, type = 'chapter', content = '', extra = {}) {
  const newId = 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const cleanName = name.endsWith('.docx') || name.endsWith('.md') ? name : `${name}.docx`;
  
  const initialContent = content || (
    type === 'chapter'
      ? `<h1>${cleanName.replace(/\.docx$/, '')}</h1><p></p>`
      : `<h2>${cleanName.replace(/\.docx$/, '')}</h2><p></p>`
  );

  const plain = initialContent.replace(/<[^>]+>/g, ' ').trim();
  const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;

  const newDoc = {
    id: newId,
    name: cleanName,
    type,
    status: extra.status || 'Draft',
    targetWords: Number(extra.targetWords) || 2000,
    synopsis: extra.synopsis || '',
    order: _cache.files.length,
    wordCount,
    lastModified: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: initialContent,
  };

  _cache.files = [..._cache.files, newDoc];
  _cache.activeFileId = newId;
  if (!_cache.openTabs.includes(newId)) {
    _cache.openTabs.push(newId);
  }

  notifySubscribers();
  persistWorkspaceState();

  db.manuscripts.put(newDoc).then(() => {
    recordDocumentVersion(newDoc);
  }).catch(err => {
    console.error('[ManuscriptStore] Failed to save new document:', err);
  });

  return newDoc;
}

/**
 * Delete a manuscript file and its version history
 */
export function deleteManuscriptFile(id) {
  _cache.files = _cache.files.filter(f => f.id !== id);
  _cache.openTabs = _cache.openTabs.filter(t => t !== id);
  if (_cache.activeFileId === id) {
    _cache.activeFileId = _cache.openTabs[0] || (_cache.files[0] ? _cache.files[0].id : null);
  }

  notifySubscribers();
  persistWorkspaceState();

  db.manuscripts.delete(id).catch(err => {
    console.warn('[ManuscriptStore] Dexie delete error:', err);
  });

  db.manuscript_versions.where('docId').equals(id).delete().catch(() => {});
}

/**
 * Retrieve version history for a given manuscript
 */
export async function getManuscriptVersions(docId) {
  try {
    return await db.manuscript_versions
      .where('docId')
      .equals(docId)
      .reverse()
      .sortBy('createdAt');
  } catch (err) {
    console.error('[ManuscriptStore] Error fetching versions:', err);
    return [];
  }
}

/**
 * Rollback document to a historical version
 */
export async function rollbackManuscriptVersion(docId, versionId) {
  const version = await db.manuscript_versions.get(versionId);
  if (!version || version.docId !== docId) {
    throw new Error('Historical version not found');
  }

  updateDocumentContent(docId, version.content);
  return version;
}

/**
 * Export manuscript in chosen format (docx, epub, html, markdown, json, txt)
 */
export async function exportManuscript(docId, format = 'html') {
  const doc = _cache.files.find(f => f.id === docId);
  if (!doc) throw new Error('Document not found');

  const cleanTitle = doc.name.replace(/\.[^/.]+$/, '');
  if (format === 'docx' || format === 'shunn') {
    return await compileBook('shunn', {
      title: cleanTitle,
      author: 'Sovereign Author',
      chapters: [doc],
    });
  }
  if (format === 'epub') {
    return await compileBook('epub', {
      title: cleanTitle,
      author: 'Sovereign Author',
      chapters: [doc],
    });
  }

  let output = '';
  let mimeType = 'text/plain';
  let extension = 'txt';

  if (format === 'html') {
    output = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.name}</title></head><body>${doc.content}</body></html>`;
    mimeType = 'text/html';
    extension = 'html';
  } else if (format === 'markdown' || format === 'md') {
    output = doc.content
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n---\n\n')
      .replace(/<[^>]+>/g, '');
    mimeType = 'text/markdown';
    extension = 'md';
  } else if (format === 'json') {
    output = JSON.stringify(doc, null, 2);
    mimeType = 'application/json';
    extension = 'json';
  } else {
    output = doc.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    mimeType = 'text/plain';
    extension = 'txt';
  }

  const blob = new Blob([output], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanTitle}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Store a chapter another node shared (already validated by meshManuscripts.js).
 */
export async function receiveSharedManuscript(doc, { maxPerSender, maxTotal }) {
  await initManuscriptStore();
  const existing = _cache.files.find(f => f.id === doc.id);
  if (existing && existing.type !== 'shared') return false;

  let files = existing ? _cache.files.map(f => (f.id === doc.id ? doc : f)) : [..._cache.files, doc];
  const byAge = (a, b) => String(a.sharedAt || '').localeCompare(String(b.sharedAt || ''));
  const drop = new Set();
  const fromSender = files.filter(f => f.type === 'shared' && f.authorId === doc.authorId).sort(byAge);
  fromSender.slice(0, Math.max(0, fromSender.length - maxPerSender)).forEach(f => drop.add(f.id));
  const shared = files.filter(f => f.type === 'shared' && !drop.has(f.id)).sort(byAge);
  shared.slice(0, Math.max(0, shared.length - maxTotal)).forEach(f => drop.add(f.id));
  drop.delete(doc.id);
  files = files.filter(f => !drop.has(f.id));

  _cache.files = files;
  _cache.openTabs = _cache.openTabs.filter(id => !drop.has(id));
  if (drop.has(_cache.activeFileId)) _cache.activeFileId = _cache.openTabs[0] || files[0]?.id || null;
  notifySubscribers();

  await db.manuscripts.put(doc);
  if (drop.size) {
    await db.manuscripts.bulkDelete([...drop]);
    for (const id of drop) await db.manuscript_versions.where('docId').equals(id).delete();
  }
  return true;
}

/**
 * Publish / broadcast manuscript to physical P2P sovereign mesh
 */
export async function publishDocumentToMesh(docId, note = '') {
  const doc = _cache.files.find(f => f.id === docId);
  if (!doc) throw new Error('Document not found');
  const { SHARED_LIMITS } = await import('./meshManuscripts.js');
  if ((doc.content || '').length > SHARED_LIMITS.maxContentChars) {
    throw new Error('This chapter is too long to share in one piece. Split it into smaller chapters first.');
  }
  const { publishManuscriptToMesh } = await import('./sovereignMesh.js');
  return publishManuscriptToMesh(doc, note);
}
