// Helpers for browser tests that need a stand-in for the OS's `cyprev` protocol.
// scripts/browser-test.mjs runs a second server on another 127.0.0.1 port (so a
// different origin from the runner) and passes its address as ?cyprev=<base>.

const GOLDEN_URL = new URL('../addition-csp.golden.txt', import.meta.url);

// Every message any frame posts to this page, so a test never misses one that
// arrived before it started waiting.
const inbox = [];
const waiters = new Set();
window.addEventListener('message', (event) => {
  inbox.push(event);
  for (const w of [...waiters]) w(event);
});

export const ADDITION_SANDBOX = 'allow-scripts allow-forms allow-modals';

export function cyprevBase() {
  const base = new URLSearchParams(location.search).get('cyprev');
  if (!base) throw new Error('No cyprev server: run through scripts/browser-test.mjs');
  return base.endsWith('/') ? base : `${base}/`;
}

export function newSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'tst' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Publish files ({ path, content, mime }) as one session, served with `csp`. */
export async function publish(session, files, { csp, once = [] } = {}) {
  const res = await fetch(`${cyprevBase()}__publish/${session}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files, csp, once }),
  });
  if (!res.ok) throw new Error(`publish failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function clear(session) {
  await fetch(`${cyprevBase()}__clear/${session}`, { method: 'POST' });
}

/** The exact ADDITION_CSP for `networkList`, from the golden file Rust is tested against. */
export async function goldenCsp(networkList = []) {
  const text = await (await fetch(GOLDEN_URL)).text();
  const want = networkList.join(' ');
  let network = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('network:')) network = line.slice('network:'.length).trim();
    else if (line.startsWith('csp: ') && network === want) return line.slice(5);
  }
  throw new Error(`No golden CSP for network "${want}"`);
}

/** Add an iframe with `sandbox` and `src`; resolves once it has loaded. */
export function frameFor(src, sandbox = ADDITION_SANDBOX) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', sandbox);
  frame.style.cssText = 'width:320px;height:200px;border:0';
  const loaded = new Promise((resolve) => frame.addEventListener('load', () => resolve(frame), { once: true }));
  frame.src = src;
  document.body.appendChild(frame);
  return loaded;
}

/** The first message from `frame` whose data passes `match`, including ones already received. */
export function messageFrom(frame, match = () => true, timeoutMs = 10_000) {
  const fits = (e) => e.source === frame.contentWindow && match(e.data);
  const seen = inbox.find(fits);
  if (seen) return Promise.resolve(seen);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(waiter);
      reject(new Error('no message from the frame in time'));
    }, timeoutMs);
    const waiter = (e) => {
      if (!fits(e)) return;
      clearTimeout(timer);
      waiters.delete(waiter);
      resolve(e);
    };
    waiters.add(waiter);
  });
}
