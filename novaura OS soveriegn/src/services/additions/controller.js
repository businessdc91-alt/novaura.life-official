// controller.js — Runs one addition inside its window: launches it into the window's
// frame, connects the host and router for that launch, and relaunches it (new
// session, new nonce) when the app reloads itself or when something that shapes a
// launch changes: what the person granted, its quota, its manifest, or its data
// being copied over again. Merely noting a blocked origin does not relaunch it.
// When the app tries to reach a network origin it may be allowed, the window shows
// one banner for it.

import { ADDITION_SANDBOX, launchAddition, stopAddition } from './launch.js';
import { connectAddition } from './host.js';
import { createRouter } from './router.js';
import { currentTheme, subscribeTheme } from './theme.js';
import { getAddition, noteBlockedOrigin } from './registry.js';
import { getAdditionData } from './dataStore.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** What a launch was built from; a change to any of it needs a relaunch. */
const launchKey = (a) => JSON.stringify({
  grants: a.grants,
  quota: a.quotaBytes,
  manifest: a.manifest ? [a.manifest.id, a.manifest.name, a.manifest.version] : null,
  name: a.name,
  slug: a.slug,
  copied: a.oldDataCopiedAt || 0,
});

/**
 * deps: { ensureMigrated, getAddition, launch(addition, { path }), stop(session),
 * connect({ frame, nonce, router, onRelaunch }), createRouter({ addition, ui, onBlocked }),
 * noteBlockedOrigin(appId, origin), subscribeTheme(fn), events, setTitle(text), close(),
 * currentTheme?, settleMs?, blankTimeoutMs? }. onState receives partial view state:
 * { doc, error, issues } after each launch and { banner } for a blocked origin.
 */
export function createAdditionController({ appId, deps, onState = () => {} }) {
  const settleMs = deps.settleMs ?? 150;
  const blankTimeoutMs = deps.blankTimeoutMs ?? 500;
  let frame = null;
  let conn = null;
  let session = null;
  let disposed = false;
  let generation = 0;
  let key = null;
  let name = '';
  let unsubTheme = null;
  const banners = new Set();
  const blockedListeners = new Set();

  function teardown() {
    conn?.dispose();
    conn = null;
    if (session) {
      Promise.resolve(deps.stop(session)).catch(() => {});
      session = null;
    }
  }

  function navigate(doc) {
    if (!frame) return;
    if (doc.srcdoc != null) {
      frame.srcdoc = doc.srcdoc;
    } else {
      frame.removeAttribute?.('srcdoc');
      frame.src = doc.src;
    }
  }

  // Unload the running page first, so localStorage writes it makes as it goes reach
  // the OS before the next launch reads its snapshot.
  async function blank() {
    if (!frame) return;
    await new Promise((resolve) => {
      const done = () => { clearTimeout(timer); frame.removeEventListener?.('load', done); resolve(); };
      const timer = setTimeout(done, blankTimeoutMs);
      frame.addEventListener?.('load', done);
      frame.removeAttribute?.('srcdoc');
      frame.src = 'about:blank';
    });
    await sleep(settleMs);
  }

  function handleBlocked(origin) {
    Promise.resolve(deps.noteBlockedOrigin(appId, origin))
      .then((isNew) => {
        if (disposed || !isNew || banners.has(origin)) return;
        banners.add(origin);
        const banner = { origin, name };
        onState({ banner });
        for (const fn of blockedListeners) fn(banner);
      })
      .catch(() => {});
  }

  async function launchInto(gen, path) {
    const addition = await deps.getAddition(appId);
    if (gen !== generation || disposed) return null;
    if (!addition) {
      onState({ doc: null, error: 'This addition was removed.' });
      return null;
    }
    name = addition.name;
    const ui = {
      theme: () => deps.currentTheme?.(),
      setTitle: (text) => deps.setTitle(text || addition.name),
      close: () => deps.close(),
    };
    const router = deps.createRouter({ addition, ui, onBlocked: handleBlocked });
    let doc;
    try {
      doc = await deps.launch(addition, { path });
    } catch (err) {
      if (gen === generation && !disposed) onState({ doc: null, error: String(err?.message || err) });
      return null;
    }
    if (gen !== generation || disposed) {
      if (doc?.session) Promise.resolve(deps.stop(doc.session)).catch(() => {});
      return null;
    }
    conn = deps.connect({ frame, nonce: doc.nonce, router, onRelaunch: (info) => { relaunch(info?.path || ''); } });
    session = doc.session;
    key = launchKey(addition);
    navigate(doc);
    // A banner for an origin the person has since allowed has done its job.
    const granted = addition.grants?.network || [];
    const shown = [...banners].at(-1);
    onState({ doc, error: '', issues: doc.issues || [], ...(shown && granted.includes(shown) ? { banner: null } : {}) });
    return doc;
  }

  async function relaunch(path = '') {
    if (disposed || !frame) return null;
    const gen = ++generation;
    teardown();
    await blank();
    if (gen !== generation || disposed) return null;
    return launchInto(gen, path);
  }

  const onChanged = (e) => {
    if (disposed || e.detail !== appId) return;
    Promise.resolve(deps.getAddition(appId))
      .then((a) => { if (a && !disposed && launchKey(a) !== key) relaunch(); })
      .catch(() => {});
  };

  return {
    /** Launch into `frameEl` (an iframe the window keeps for its whole life). */
    async start(frameEl) {
      frame = frameEl;
      frame.setAttribute?.('sandbox', ADDITION_SANDBOX);
      deps.events.addEventListener('novaura:addition_changed', onChanged);
      unsubTheme = deps.subscribeTheme((theme) => conn?.pushTheme(theme));
      await deps.ensureMigrated();
      if (disposed) return null;
      return launchInto(++generation, '');
    },
    relaunch,
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      teardown();
      unsubTheme?.();
      unsubTheme = null;
      deps.events.removeEventListener('novaura:addition_changed', onChanged);
    },
    onBlocked(fn) {
      blockedListeners.add(fn);
      return () => blockedListeners.delete(fn);
    },
  };
}

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
const newNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

/** The real wiring, for an addition shown in OS window `windowId`. */
export function defaultControllerDeps({ windowId, onClose }) {
  const tauriInvoke = async () => (isTauri() ? (await import('@tauri-apps/api/core')).invoke : null);
  return {
    ensureMigrated: async () => (await import('./migrate.js')).ensureMigrated(),
    getAddition,
    async launch(addition, { path }) {
      const [{ loadProjectFiles }, { newSessionId, protocolBase }, invoke] = await Promise.all([
        import('../cybeni/projectStore.js'),
        import('../cybeni/previewHost.js'),
        tauriInvoke(),
      ]);
      return launchAddition(addition, {
        data: getAdditionData(),
        invoke,
        loadFiles: loadProjectFiles,
        hostOrigin: window.location.origin,
        newSession: newSessionId,
        newNonce,
        theme: currentTheme(),
        baseUrl: protocolBase,
        path,
      });
    },
    stop: async (session) => stopAddition(session, await tauriInvoke()),
    connect: (opts) => connectAddition(opts),
    createRouter: (opts) => createRouter({ ...opts, data: getAdditionData() }),
    noteBlockedOrigin,
    subscribeTheme: (fn) => subscribeTheme(fn),
    currentTheme: () => currentTheme(),
    events: window,
    setTitle: (text) => {
      import('../../kernel/NovaKernel.js').then(({ kernel }) => kernel?.wm?.setTitle?.(windowId, text)).catch(() => {});
    },
    close: () => onClose?.(),
  };
}
