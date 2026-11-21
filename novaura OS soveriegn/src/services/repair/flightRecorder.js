// flightRecorder.js — Lightweight Always-On Error Flight Recorder, Live DOM/Environment
// Introspector, Cross-Window Repair Bridge, and Reversible Runtime Hotfix Overlay Engine.
// Runs safely on 100% of end-user PCs (no compiler or source repo required) and synchronizes
// cleanly between the main Sovereign Desktop and the detached Pop-Out Repair Window.

import { ipc } from '../../kernel/IPCBus.js';
import { db } from '../../database/sovereignDatabase.js';
import { scanAndRedactOutboundSecrets } from '../security/complianceService.js';

const FLIGHT_LOG_KEY = 'novaura_repair_flight_log_v1';
const MAX_FLIGHT_ENTRIES = 80;

let _installed = false;
const _activeLinkRedirects = new Map(); // hotfixId -> { fromPattern, toUrl }
let _linkInterceptorAttached = false;

function redactSafeText(raw, maxLen = 1500) {
  const text = String(raw || '').slice(0, maxLen);
  if (!text) return '';
  try {
    const res = scanAndRedactOutboundSecrets([{ role: 'user', content: text }]);
    return String(res?.messages?.[0]?.content || text);
  } catch {
    return text;
  }
}

export function getFlightLog() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FLIGHT_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearFlightLog() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(FLIGHT_LOG_KEY);
  } catch {}
}

/**
 * Record an unhandled error, promise rejection, or React ErrorBoundary crash into
 * the local secret-redacted ring buffer and notify the floating Crash Banner.
 */
export function recordRuntimeError({
  source = 'runtime',
  appId = 'desktop',
  windowType = 'Sovereign OS',
  message = 'Unexpected error',
  stack = '',
  componentStack = '',
  severity = 'error',
  emitBanner = true,
} = {}) {
  const entry = {
    id: `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source,
    appId,
    windowType,
    severity,
    message: redactSafeText(message, 500),
    stack: redactSafeText(stack, 1800),
    componentStack: redactSafeText(componentStack, 1200),
  };

  if (typeof localStorage !== 'undefined') {
    try {
      const current = getFlightLog();
      const next = [entry, ...current].slice(0, MAX_FLIGHT_ENTRIES);
      localStorage.setItem(FLIGHT_LOG_KEY, JSON.stringify(next));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:repair_flight_updated', { detail: entry }));
    if (emitBanner) {
      window.dispatchEvent(new CustomEvent('novaura:crash_banner', { detail: entry }));
    }
  }
  return entry;
}

/**
 * Scan localStorage keys for corrupted JSON entries (common source of app boot glitches).
 */
export function scanCorruptedLocalStorage() {
  const corrupted = [];
  if (typeof localStorage === 'undefined') return corrupted;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.toLowerCase().startsWith('novaura')) continue;
    const val = localStorage.getItem(key);
    if (!val) continue;
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
      } catch (err) {
        corrupted.push({
          key,
          reason: err?.message || 'Malformed JSON',
          preview: trimmed.slice(0, 80),
        });
      }
    }
  }
  return corrupted;
}

/**
 * Live DOM, Window, Storage, and Local AI Engine Introspection.
 * Runs synchronously over the mounted UI plus fast bounded probes for local engines.
 */
export async function runLiveEnvironmentIntrospection({ probeEngines = true } = {}) {
  const issues = [];
  const stats = {
    brokenImages: 0,
    deadLinks: 0,
    unlabelledButtons: 0,
    crashedBoundaries: 0,
    offscreenWindows: 0,
    corruptedStorageKeys: 0,
  };

  // 1. Live DOM Audit (broken images, dead links, unlabelled/stuck buttons, crashed boundaries)
  if (typeof document !== 'undefined') {
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const img of imgs) {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
        stats.brokenImages++;
        if (stats.brokenImages <= 8) {
          issues.push({
            id: `img_${stats.brokenImages}`,
            kind: 'broken_image',
            severity: 'warn',
            detail: `Broken image asset failed to load: ${String(img.getAttribute('src')).slice(0, 100)}`,
            selector: img.alt || 'img',
          });
        }
      }
    }

    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const a of links) {
      const href = String(a.getAttribute('href') || '').trim();
      if (!href || href === '#' || href.toLowerCase().startsWith('javascript:')) {
        stats.deadLinks++;
        if (stats.deadLinks <= 8) {
          issues.push({
            id: `link_${stats.deadLinks}`,
            kind: 'dead_link',
            severity: 'warn',
            detail: `Dead or non-navigating link "${(a.textContent || '').trim().slice(0, 40) || 'unnamed'}" (href="${href || 'empty'}")`,
            href,
          });
        }
      }
    }

    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const label = (btn.textContent || '').trim() || btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
      if (!label && btn.offsetWidth > 0 && btn.offsetHeight > 0) {
        stats.unlabelledButtons++;
        if (stats.unlabelledButtons <= 5) {
          issues.push({
            id: `btn_${stats.unlabelledButtons}`,
            kind: 'unlabelled_button',
            severity: 'info',
            detail: `Interactive button missing accessible label/title inside ${btn.closest('[data-window-type]')?.getAttribute('data-window-type') || 'workspace'}`,
          });
        }
      }
    }

    const crashed = Array.from(document.querySelectorAll('[data-kernel-crash-boundary="true"]'));
    for (const el of crashed) {
      stats.crashedBoundaries++;
      issues.push({
        id: `crash_dom_${stats.crashedBoundaries}`,
        kind: 'crashed_window',
        severity: 'error',
        windowType: el.getAttribute('data-window-type') || 'Window',
        detail: `Mounted window "${el.getAttribute('data-window-type') || 'Window'}" is currently halted in an error boundary.`,
      });
    }

    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const winEls = Array.from(document.querySelectorAll('[data-window-id]'));
    for (const w of winEls) {
      const r = w.getBoundingClientRect();
      if (r.width > 0 && (r.right < 40 || r.left > vw - 40 || r.top < -40 || r.top > vh - 30)) {
        stats.offscreenWindows++;
        issues.push({
          id: `win_off_${stats.offscreenWindows}`,
          kind: 'offscreen_window',
          severity: 'warn',
          windowId: w.getAttribute('data-window-id'),
          detail: `Window "${w.getAttribute('data-window-id')}" drifted outside the visible viewport.`,
        });
      }
    }
  }

  // 2. Corrupted LocalStorage JSON Scan
  const corruptedStorage = scanCorruptedLocalStorage();
  stats.corruptedStorageKeys = corruptedStorage.length;
  for (const item of corruptedStorage) {
    issues.push({
      id: `ls_${item.key}`,
      kind: 'corrupted_storage',
      severity: 'error',
      storageKey: item.key,
      detail: `Corrupted JSON detected in localStorage key "${item.key}" (${item.reason}).`,
    });
  }

  // 3. Recent Flight Recorder Errors
  const flightErrors = getFlightLog().slice(0, 12);
  const recentCritical = flightErrors.filter(e => Date.now() - Date.parse(e.timestamp) < 15 * 60 * 1000);
  if (recentCritical.length > 0) {
    issues.push({
      id: 'recent_flight_errors',
      kind: 'runtime_exception',
      severity: 'error',
      detail: `${recentCritical.length} runtime error(s) captured in the last 15 minutes (latest: "${recentCritical[0].message.slice(0, 90)}").`,
    });
  }

  // 4. Optional Local AI Engine Probes (fast bounded timeout)
  const engines = { comfy: 'unchecked', ollama: 'unchecked', lmStudio: 'unchecked' };
  if (probeEngines && typeof fetch === 'function') {
    const check = async (url) => {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
        return r.ok ? 'online' : `http_${r.status}`;
      } catch {
        return 'offline';
      }
    };
    const [comfy, ollama, lmStudio] = await Promise.all([
      check('http://127.0.0.1:8188/system_stats'),
      check('http://127.0.0.1:11434/api/tags'),
      check('http://127.0.0.1:1234/v1/models'),
    ]);
    engines.comfy = comfy;
    engines.ollama = ollama;
    engines.lmStudio = lmStudio;
  }

  // 5. Health Score Computation
  let healthScore = 100;
  healthScore -= stats.crashedBoundaries * 25;
  healthScore -= stats.corruptedStorageKeys * 15;
  healthScore -= Math.min(25, recentCritical.length * 8);
  healthScore -= Math.min(15, stats.brokenImages * 4);
  healthScore -= Math.min(10, stats.deadLinks * 2);
  healthScore -= stats.offscreenWindows * 6;
  healthScore = Math.max(10, Math.min(100, healthScore));

  return {
    timestamp: new Date().toISOString(),
    healthScore,
    stats,
    issues,
    corruptedStorage,
    flightErrors,
    engines,
  };
}

// ── REVERSIBLE RUNTIME HOTFIX OVERLAY ENGINE (TIER 1) ────────────────────────

/** Reject dangerous CSS constructs (external network fetches, @import, expressions). */
export function sanitizeHotfixCss(css) {
  const s = String(css || '').trim();
  if (!s || s.length > 8000) return null;
  if (/@import|url\s*\(|expression\s*\(|javascript:/i.test(s)) return null;
  return s;
}

/** Validate redirect target URL (only https://, http://127.0.0.1, or nova://). */
export function validateSafeRedirectUrl(url) {
  const s = String(url || '').trim();
  if (/^https:\/\/[^\s<>"']+$/i.test(s)) return s;
  if (/^nova:\/\/[^\s<>"']+$/i.test(s)) return s;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/[^\s<>"']*)?$/i.test(s)) return s;
  return null;
}

function ensureLinkInterceptor() {
  if (_linkInterceptorAttached || typeof document === 'undefined') return;
  _linkInterceptorAttached = true;
  document.addEventListener(
    'click',
    (e) => {
      if (_activeLinkRedirects.size === 0) return;
      const anchor = e.target?.closest?.('a[href]');
      if (!anchor) return;
      const href = String(anchor.getAttribute('href') || '');
      for (const rule of _activeLinkRedirects.values()) {
        if (href === rule.fromPattern || href.includes(rule.fromPattern)) {
          e.preventDefault();
          if (rule.toUrl.startsWith('nova://')) {
            window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'browser', props: { url: rule.toUrl }, toggle: false } }));
          } else {
            window.open(rule.toUrl, '_blank', 'noopener,noreferrer');
          }
          return;
        }
      }
    },
    true
  );
}

function mountHotfixInDom(hotfix) {
  if (!hotfix?.enabled) return;
  if (hotfix.kind === 'css_hotfix' && typeof document !== 'undefined') {
    const safeCss = sanitizeHotfixCss(hotfix.payload?.css);
    if (!safeCss) return;
    let el = document.querySelector(`style[data-novaura-hotfix-id="${hotfix.id}"]`);
    if (!el) {
      el = document.createElement('style');
      el.setAttribute('data-novaura-hotfix-id', hotfix.id);
      document.head.appendChild(el);
    }
    el.textContent = safeCss;
  } else if (hotfix.kind === 'link_redirect') {
    const safeTo = validateSafeRedirectUrl(hotfix.payload?.toUrl);
    if (safeTo && hotfix.payload?.fromPattern) {
      ensureLinkInterceptor();
      _activeLinkRedirects.set(hotfix.id, { fromPattern: String(hotfix.payload.fromPattern), toUrl: safeTo });
    }
  }
}

function unmountHotfixFromDom(hotfixId) {
  _activeLinkRedirects.delete(hotfixId);
  if (typeof document !== 'undefined') {
    const el = document.querySelector(`style[data-novaura-hotfix-id="${hotfixId}"]`);
    if (el) el.remove();
  }
}

export async function listRuntimeHotfixes() {
  try {
    return (await db.repair_hotfixes.toArray()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return [];
  }
}

/**
 * Apply a safe, reversible Tier-1 Runtime Hotfix and persist a backup snapshot for 1-click rollback.
 */
export async function applyRuntimeHotfix({ kind, title, targetApp = 'desktop', payload = {} }) {
  const id = `hfx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  let backupSnapshot = null;

  if (kind === 'css_hotfix') {
    if (!sanitizeHotfixCss(payload.css)) {
      throw new Error('CSS hotfix rejected: external url()/@import or oversized rule blocked for security.');
    }
  } else if (kind === 'link_redirect') {
    if (!payload.fromPattern || !validateSafeRedirectUrl(payload.toUrl)) {
      throw new Error('Link redirect rejected: destination must be a valid https://, nova://, or localhost URL.');
    }
  } else if (kind === 'storage_sanitize') {
    const keys = Array.isArray(payload.keys) && payload.keys.length
      ? payload.keys
      : scanCorruptedLocalStorage().map(c => c.key);
    backupSnapshot = {};
    if (typeof localStorage !== 'undefined') {
      for (const k of keys) {
        backupSnapshot[k] = localStorage.getItem(k);
        localStorage.removeItem(k);
      }
    }
  } else if (kind === 'window_recover') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:repair_recover_window', { detail: { targetApp, windowId: payload.windowId } }));
      if (targetApp && targetApp !== 'desktop') {
        window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: targetApp, toggle: false } }));
      }
    }
  } else if (kind === 'engine_reconnect') {
    if (typeof localStorage !== 'undefined') {
      backupSnapshot = { novaura_comfyui_endpoint: localStorage.getItem('novaura_comfyui_endpoint') };
      if (payload.resetEndpoint) localStorage.removeItem('novaura_comfyui_endpoint');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:engines_changed'));
    }
  } else {
    throw new Error(`Unsupported runtime hotfix kind: ${kind}`);
  }

  const record = {
    id,
    kind,
    title: String(title || kind).slice(0, 120),
    targetApp,
    payload,
    backupSnapshot,
    enabled: true,
    createdAt: Date.now(),
  };

  try {
    await db.repair_hotfixes.put(record);
  } catch {
    // Allow pure unit testing without IndexedDB
  }

  mountHotfixInDom(record);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:repair_hotfixes_updated', { detail: { action: 'apply', id } }));
  }
  return record;
}

/**
 * Roll back a previously applied Tier-1 Runtime Hotfix, restoring backed-up state cleanly.
 */
export async function rollbackRuntimeHotfix(hotfixId) {
  let rec = null;
  try {
    rec = await db.repair_hotfixes.get(hotfixId);
  } catch {}

  unmountHotfixFromDom(hotfixId);

  if (rec?.backupSnapshot && typeof localStorage !== 'undefined') {
    for (const [k, v] of Object.entries(rec.backupSnapshot)) {
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }

  if (rec) {
    try {
      await db.repair_hotfixes.update(hotfixId, { enabled: false, rolledBackAt: Date.now() });
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:repair_hotfixes_updated', { detail: { action: 'rollback', id: hotfixId } }));
  }
  return { rolledBack: true, id: hotfixId };
}

/** Re-apply all enabled runtime hotfixes on desktop startup or bridge sync. */
export async function reapplyActiveHotfixes() {
  const all = await listRuntimeHotfixes();
  for (const h of all) {
    if (h.enabled) mountHotfixInDom(h);
    else unmountHotfixFromDom(h.id);
  }
  return all.filter(h => h.enabled).length;
}

/**
 * Install global error capture, cross-window introspection responder, and hotfix sync. Idempotent.
 */
export function installFlightRecorder() {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  window.addEventListener('error', (event) => {
    const msg = event?.error?.message || event?.message || 'Unhandled script error';
    // Ignore benign browser ResizeObserver loop noise
    if (/ResizeObserver loop/i.test(msg)) return;
    recordRuntimeError({
      source: 'window.onerror',
      message: msg,
      stack: event?.error?.stack || `${event?.filename || ''}:${event?.lineno || 0}`,
      severity: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : 'Unhandled Promise rejection');
    recordRuntimeError({
      source: 'unhandledrejection',
      message: msg,
      stack: reason?.stack || '',
      severity: 'error',
    });
  });

  ipc.on('crash:boundary', (payload) => {
    recordRuntimeError({
      source: 'KernelErrorBoundary',
      appId: payload?.appType || payload?.windowType || 'window',
      windowType: payload?.windowType || 'Window',
      message: payload?.error?.message || 'Component render crash',
      stack: payload?.error?.stack || '',
      componentStack: payload?.componentStack || '',
      severity: 'critical',
    });
  });

  // Answer introspection probes triggered from the detached Pop-Out Repair Window
  window.addEventListener('novaura:repair_probe_request', async (e) => {
    const requestId = e?.detail?.requestId || 'probe';
    const snapshot = await runLiveEnvironmentIntrospection({ probeEngines: Boolean(e?.detail?.probeEngines ?? true) });
    window.dispatchEvent(new CustomEvent('novaura:repair_probe_results', { detail: { requestId, snapshot } }));
  });

  window.addEventListener('novaura:repair_hotfixes_updated', () => {
    reapplyActiveHotfixes().catch(() => {});
  });

  reapplyActiveHotfixes().catch(() => {});
}

