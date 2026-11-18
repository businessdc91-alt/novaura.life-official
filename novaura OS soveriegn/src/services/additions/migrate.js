// migrate.js — Moves apps added before additions existed ("my apps") over, once.
// They all ran on one shared preview origin and shared its localStorage, so their
// old data is split up by app:
//   - keys @cybeni/backend saved under an app's name (`__cybeni_db__:<slug>:…`) go
//     only to that app, without the name (an addition's backend runs with none);
//   - plain keys go to every old app, since every one of them could already read them;
//   - backend keys of projects that were never installed, or saved with no name at all
//     (previews), and Cybeni's own internal keys stay behind.
// Each moved app gets a manifest with no permissions and no network, and is marked
// "added before permissions". The old shared storage is only ever read.

import * as registryModule from './registry.js';
import { getAdditionData } from './dataStore.js';
import { localManifest } from './manifest.js';
import { usesBrowserDatabase } from './detect.js';

export { usesBrowserDatabase };

const NAMESPACED = [
  { prefix: '__cybeni_db__:', rename: (rest) => `__cybeni_db__:${rest}` },
  { prefix: '__cybeni_kv__:', rename: (rest) => `__cybeni_kv__:${rest}` },
];
const AUTH = [
  { re: /^__cybeni_auth_users__:([^:]+):$/, key: '__cybeni_auth_users__' },
  { re: /^__cybeni_auth_session__:([^:]+):$/, key: '__cybeni_auth_session__' },
];

/** Map<slug, Record<key, value>> of what each listed old app should get. */
export function attributeLegacyStorage(snapshot, slugs) {
  const out = new Map(slugs.map((s) => [s, {}]));
  const plain = {};
  for (const [key, raw] of Object.entries(snapshot || {})) {
    const value = String(raw);
    let handled = false;
    for (const { prefix, rename } of NAMESPACED) {
      if (!key.startsWith(prefix)) continue;
      handled = true;
      const rest = key.slice(prefix.length);
      const colon = rest.indexOf(':');
      if (colon > 0 && out.has(rest.slice(0, colon))) out.get(rest.slice(0, colon))[rename(rest.slice(colon + 1))] = value;
    }
    for (const { re, key: target } of AUTH) {
      const m = re.exec(key);
      if (m) {
        handled = true;
        if (out.has(m[1])) out.get(m[1])[target] = value;
      }
    }
    if (!handled && !key.startsWith('__cybeni')) plain[key] = value;
  }
  for (const kv of out.values()) {
    for (const [k, v] of Object.entries(plain)) if (!(k in kv)) kv[k] = v;
  }
  return out;
}

async function copyInto(data, addition, kv) {
  const ops = Object.entries(kv).map(([key, value]) => ({ op: 'set', key, value }));
  if (ops.length) await data.writeLocalStorage(addition.id, ops, { quotaBytes: addition.quotaBytes });
  return ops.length;
}

/**
 * deps: { registry, data, readSharedStorage() -> Promise<Record<string,string>>,
 * loadFiles(slug), isDesktop, kindOf?(slug) -> 'cybeni' | 'forge' }.
 */
export async function migrateLegacyApps({ registry, data, readSharedStorage, loadFiles, isDesktop, kindOf = async () => 'cybeni' }) {
  const legacy = (await registry.listAdditions()).filter((a) => !a.manifest);
  if (!legacy.length) return { migrated: [] };
  const attributed = isDesktop ? attributeLegacyStorage(await readSharedStorage(), legacy.map((a) => a.slug)) : new Map();
  const migrated = [];
  for (const a of legacy) {
    const files = await Promise.resolve(loadFiles(a.slug)).catch(() => []);
    const notes = usesBrowserDatabase(files) ? ['browser-database'] : [];
    // Data first: if this fails the app keeps no manifest and is moved on the next launch.
    if (isDesktop) await copyInto(data, a, attributed.get(a.slug) || {});
    const kind = await Promise.resolve(kindOf(a.slug)).catch(() => 'cybeni');
    await registry.updateAddition(a.id, {
      manifest: localManifest({ slug: a.slug, name: a.name, kind }),
      legacy: true,
      legacyNotes: notes,
      migratedAt: Date.now(),
    });
    migrated.push(a.id);
  }
  return { migrated };
}

/** Copy an old app's share of the old storage over its data again. Returns how many keys. */
export async function copyOldDataAgain(appId, deps) {
  const { registry, data, readSharedStorage, isDesktop } = deps || (await defaultDeps());
  if (!isDesktop) return 0;
  const a = await registry.getAddition(appId);
  if (!a) throw new Error(`No addition ${appId}`);
  const kv = attributeLegacyStorage(await readSharedStorage(), [a.slug]).get(a.slug) || {};
  const n = await copyInto(data, a, kv);
  await registry.updateAddition(appId, { oldDataCopiedAt: Date.now() });
  return n;
}

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

/**
 * The old storage, as posted by `frame` with `token`. Rejects after `timeoutMs`, so a
 * slow read fails the move (tried again next launch) instead of moving nothing.
 */
export function awaitLegacyStorage(win, frame, token, timeoutMs) {
  return new Promise((resolve, reject) => {
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow || e.data?.__novauraLegacyStorage !== token) return;
      clearTimeout(timer);
      win.removeEventListener('message', onMessage);
      resolve(e.data.items && typeof e.data.items === 'object' ? e.data.items : {});
    };
    const timer = setTimeout(() => {
      win.removeEventListener('message', onMessage);
      reject(new Error("Couldn't read the old app data in time; moving older apps over will be tried again next launch."));
    }, timeoutMs);
    win.addEventListener('message', onMessage);
  });
}

/**
 * Read the old shared preview origin's localStorage: publish a one-page preview
 * session and open it in a hidden frame on that origin, which posts its storage back
 * with a one-time token. Fails after 10 s.
 */
export async function readSharedStorageViaCyprev({ timeoutMs = 10_000 } = {}) {
  const { invoke } = await import('@tauri-apps/api/core');
  const { newSessionId, protocolBase } = await import('../cybeni/previewHost.js');
  const session = newSessionId();
  const token = newSessionId();
  const page = '<!doctype html><meta charset="utf-8"><script>(function(){var o={};'
    + 'try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);o[k]=localStorage.getItem(k);}}catch(e){}'
    + `parent.postMessage({__novauraLegacyStorage:${JSON.stringify(token)},items:o},'*');})();</script>`;
  await invoke('cybeni_preview_publish', { session, files: [{ path: 'index.html', content: page, mime: 'text/html; charset=utf-8' }] });
  const frame = document.createElement('iframe');
  // Its own origin is the old shared preview origin; never the OS's.
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:10px;height:10px;border:0;opacity:0;pointer-events:none;';
  try {
    const answer = awaitLegacyStorage(window, frame, token, timeoutMs);
    frame.src = `${protocolBase(session)}index.html`;
    document.body.appendChild(frame);
    return await answer;
  } finally {
    frame.remove();
    invoke('cybeni_preview_clear', { session }).catch(() => {});
  }
}

async function defaultDeps() {
  const { loadProjectFiles, listProjects } = await import('../cybeni/projectStore.js');
  return {
    registry: registryModule,
    data: getAdditionData(),
    readSharedStorage: () => readSharedStorageViaCyprev(),
    loadFiles: loadProjectFiles,
    isDesktop: isTauri(),
    kindOf: async (slug) => ((await listProjects()).find((p) => p.slug === slug)?.origin ? 'forge' : 'cybeni'),
  };
}

let once = null;

/** Move old apps over, once per session. A failure is logged and tried again next launch. */
export function ensureMigrated() {
  if (!once) {
    once = defaultDeps()
      .then((deps) => migrateLegacyApps(deps))
      .catch((err) => {
        console.warn('[additions] Moving older apps over failed; it will be tried again next launch.', err);
        return { migrated: [], error: String(err?.message || err) };
      });
  }
  return once;
}
