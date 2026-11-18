// launch.js — Starts one run of an addition: builds its files in addition mode,
// writes this launch's boot data (app info, its localStorage snapshot, the theme and
// the OS origin) as `__novaura/boot.js`, and publishes them as a new `cyprev` addition
// session whose CSP allows only the network origins the person granted. The frame
// URL carries a fresh nonce in its fragment. In a plain browser (development) the
// addition is one inline document instead, with the nonce in its boot data.

import { buildPreview } from '../cybeni/previewBuilder.js';
import { NOVAURA_V1_SOURCE } from './bridgeSource.js';
import { additionCsp } from './network.js';

/** Never allow-same-origin: each running addition gets its own opaque origin. */
export const ADDITION_SANDBOX = 'allow-scripts allow-forms allow-modals';
export const BOOT_PATH = '__novaura/boot.js';

/** The boot data as a classic script that can't end its own <script> element. */
export function bootScript({ app, snapshot, theme, hostOrigin, nonce }) {
  const data = { app, snapshot, theme, hostOrigin };
  if (nonce) data.nonce = nonce;
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `window.__novauraBoot=${json};\n`;
}

/** A page inside the addition to come back to after a relaunch, or index.html. */
function entryFor(path) {
  const p = String(path || '');
  if (!p || p.startsWith('/') || !/^[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]+$/.test(p)) return 'index.html';
  const [route] = p.split('?');
  if (!route) return `index.html${p}`;
  // No ':' in the route, so it can never read as a scheme, and no dot segments.
  if (route.includes(':') || route.split('/').some((seg) => seg === '.' || seg === '..')) return 'index.html';
  return p;
}

/**
 * Launch `addition` (a registry entry). deps: { data, invoke (null in a plain browser),
 * loadFiles(slug), hostOrigin, newSession(), newNonce(), theme, baseUrl(session), path? }.
 * Returns { session, nonce, src | srcdoc, sandbox, issues }.
 */
export async function launchAddition(addition, { data, invoke, loadFiles, hostOrigin, newSession, newNonce, theme, baseUrl, path = '' }) {
  const files = await loadFiles(addition.slug);
  if (!files?.length) throw new Error('This app has no files any more. It may have been deleted in Cybeni.');
  const snapshot = await data.snapshotLocalStorage(addition.id);
  const m = addition.manifest || {};
  const app = {
    id: m.id || `local.${addition.slug}`,
    name: m.name || addition.name,
    version: m.version || '1.0.0',
    permissions: [...(addition.grants?.permissions || [])],
  };
  const nonce = newNonce();

  if (!invoke) {
    // Development in a plain browser: the same policy, as a meta tag.
    const boot = bootScript({ app, snapshot, theme, hostOrigin, nonce });
    const csp = additionCsp(addition.grants?.network || []);
    const out = buildPreview(files, { mode: 'addition', inlineScripts: { boot, bridge: NOVAURA_V1_SOURCE, csp } });
    return { session: null, nonce, srcdoc: out.html, sandbox: ADDITION_SANDBOX, issues: out.issues };
  }

  const session = newSession();
  const base = baseUrl(session);
  const out = buildPreview(files, { mode: 'addition', baseUrl: base });
  const published = [...out.serverFiles, { path: BOOT_PATH, content: bootScript({ app, snapshot, theme, hostOrigin }), mime: 'text/javascript' }];
  await invoke('addition_publish', {
    session,
    files: published,
    network: [...(addition.grants?.network || [])],
    once: [BOOT_PATH],
  });
  return { session, nonce, src: `${base}${entryFor(path)}#nv=${nonce}`, sandbox: ADDITION_SANDBOX, issues: out.issues };
}

/** Drop a launch's files from memory. Best effort: the window may already be gone. */
export async function stopAddition(session, invoke) {
  if (!session || !invoke) return;
  try {
    await invoke('addition_clear', { session });
  } catch { /* already gone */ }
}
