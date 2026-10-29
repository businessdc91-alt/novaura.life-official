// previewHost.js — Runs Cybeni builds in the browser, safely.
//
// In the desktop app, builds are published to the native `cyprev` protocol: a
// separate origin from the OS, so generated code cannot touch the OS's data or
// commands (see src-tauri/src/preview.rs). In a plain browser (dev only) the
// build is inlined into a sandboxed srcdoc frame with an opaque origin.

import { buildPreview } from './previewBuilder.js';

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

// Known console noise that is not an app error.
const NOISE = [/cdn\.tailwindcss\.com should not be used in production/i, /Download the React DevTools/i];

export function newSessionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('');
}

function protocolBase(session) {
  // Tauri serves custom protocols as http://<scheme>.localhost on Windows.
  const windows = /Windows/i.test(navigator.userAgent);
  return windows ? `http://cyprev.localhost/${session}/` : `cyprev://localhost/${session}/`;
}

/**
 * Publish files for a preview session.
 * Returns { src } (load in an iframe) or { srcdoc }, plus the frame sandbox to use
 * and any static issues found while building.
 */
export async function publishPreview(session, files) {
  if (isTauri()) {
    const base = protocolBase(session);
    const out = buildPreview(files, { mode: 'server', baseUrl: base });
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('cybeni_preview_publish', { session, files: out.serverFiles });
    // allow-same-origin here means the preview's own origin (cyprev), never the OS's.
    return { src: `${base}index.html?v=${Date.now()}`, sandbox: 'allow-scripts allow-same-origin allow-forms allow-modals', issues: out.issues, origin: new URL(base).origin };
  }
  const out = buildPreview(files, { mode: 'inline' });
  // No allow-same-origin: a srcdoc frame would otherwise share the OS's origin.
  return { srcdoc: out.html, sandbox: 'allow-scripts allow-forms allow-modals', issues: out.issues, origin: 'null' };
}

export async function clearPreview(session) {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('cybeni_preview_clear', { session });
  } catch { /* best effort */ }
}

export function isNoise(text) {
  return NOISE.some(re => re.test(String(text || '')));
}

/**
 * Run a build in a hidden frame and report what happened.
 * The app starts from empty storage (a first-time user's view); the person's own
 * preview data is restored afterwards. Acceptance tests, if given, run once the
 * app has loaded.
 * Resolves { errors: [string], blank, timedOut, logs, staticIssues, tests: [result] }.
 */
export async function verifyInHiddenFrame(files, { session = newSessionId(), timeoutMs = 15000, settleMs = 900, tests = [] } = {}) {
  const published = await publishPreview(session, files);
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', published.sandbox);
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none;';
  const errors = [];
  const logs = [];
  let ready = null;
  let testResults = [];

  const result = await new Promise((resolve) => {
    let settleTimer = null;
    let testTimer = null;
    const finish = (timedOut) => {
      window.removeEventListener('message', onMessage);
      clearTimeout(hardTimer);
      clearTimeout(settleTimer);
      clearTimeout(testTimer);
      resolve({ timedOut });
    };
    const startTests = () => {
      // Always sent, even with no tests: the agent then restores the person's storage.
      frame.contentWindow?.postMessage({ __cybeniTests: true, tests }, published.origin === 'null' ? '*' : published.origin);
      const budget = Math.min(180000, 5000 + tests.reduce((n, t) => n + 1500 + t.steps.length * 2800, 0));
      testTimer = setTimeout(() => {
        testResults = tests.map(t => ({ id: t.id, requirement: t.requirement || '', name: t.name, passed: false, failedStep: -1, message: 'The tests did not finish in time; the page may be stuck in a loop.' }));
        finish(false);
      }, budget);
    };
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow || !e.data?.__cybeni) return;
      const d = e.data;
      if (d.type === 'error') errors.push(d.message + (d.line ? ` (line ${d.line})` : ''));
      else if (d.type === 'console') {
        logs.push({ level: d.level, text: d.text });
        if (d.level === 'error' && !isNoise(d.text)) errors.push(d.text);
      } else if (d.type === 'ready' && !ready) {
        ready = d;
        clearTimeout(hardTimer);
        settleTimer = setTimeout(startTests, settleMs);
      } else if (d.type === 'test-results') {
        testResults = Array.isArray(d.results) ? d.results : [];
        finish(false);
      }
    };
    const hardTimer = setTimeout(() => finish(true), timeoutMs);
    window.addEventListener('message', onMessage);
    if (published.src) frame.src = `${published.src}&cybeni-isolate=1`;
    else frame.srcdoc = published.srcdoc;
    document.body.appendChild(frame);
  });

  frame.remove();
  clearPreview(session);
  const unique = [...new Set(errors)].slice(0, 10);
  if (result.timedOut && !ready) {
    unique.push(`The app did not finish loading within ${Math.round(timeoutMs / 1000)} seconds. An import may be failing, or the page may be stuck in a loop.`);
  }
  return { errors: unique, blank: ready ? Boolean(ready.empty) : true, timedOut: result.timedOut, logs, staticIssues: published.issues, tests: testResults };
}
