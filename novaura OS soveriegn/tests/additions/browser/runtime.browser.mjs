// Spec step 0 (headless half): can an app run in an opaque-origin frame served the
// way `cyprev` serves additions, with the addition CSP? Run with:
//   node scripts/browser-test.mjs tests/additions/browser/runtime.browser.mjs
import { test, assert } from '../../creative/browser/harness.js';
import { publish, clear, goldenCsp, frameFor, messageFrom, cyprevBase, newSessionId, ADDITION_SANDBOX } from './cyprev.js';

const html = (body) => ({ path: 'index.html', mime: 'text/html; charset=utf-8', content: `<!doctype html><meta charset="utf-8">${body}` });
const js = (path, content) => ({ path, mime: 'text/javascript', content });

async function launch(files, { hash = '' } = {}) {
  const session = newSessionId();
  await publish(session, files, { csp: await goldenCsp([]) });
  const frame = await frameFor(`${cyprevBase()}${session}/index.html${hash}`, ADDITION_SANDBOX);
  return { session, frame };
}

async function done({ session, frame }) {
  frame.remove();
  await clear(session);
}

test('a module app loads in an opaque-origin frame from cyprev', async () => {
  const app = await launch([
    html('<script type="module" src="./main.js"></script>'),
    js('main.js', "import { tag } from './util.js';\nparent.postMessage({ tag, origin: self.origin }, '*');"),
    js('util.js', "export const tag = 'util-loaded';"),
  ]);
  const { data } = await messageFrom(app.frame, (d) => d && 'tag' in d);
  assert.equal(data.tag, 'util-loaded');
  assert.equal(data.origin, 'null');
  await done(app);
});

test("localStorage can be replaced before the app's code runs", async () => {
  const shim =
    "const store = { k: 'v' };" +
    "const shim = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };" +
    "Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });";
  const app = await launch([
    html(`<script>${shim}</script><script type="module" src="./main.js"></script>`),
    js('main.js', "localStorage.setItem('n', 2);\nparent.postMessage({ got: localStorage.getItem('k'), n: localStorage.getItem('n') }, '*');"),
  ]);
  const { data } = await messageFrom(app.frame, (d) => d && 'got' in d);
  assert.equal(data.got, 'v');
  assert.equal(data.n, '2');
  await done(app);
});

test('the frame cannot fetch a local port or the IPC host', async () => {
  const app = await launch([
    html(`<script>
      const violations = [];
      document.addEventListener('securitypolicyviolation', (e) => violations.push(e.blockedURI));
      (async () => {
        const results = [];
        for (const url of ['http://127.0.0.1:1234/', 'http://ipc.localhost/']) {
          try { await fetch(url); results.push('fetched'); } catch { results.push('blocked'); }
        }
        await new Promise((r) => setTimeout(r, 200));
        parent.postMessage({ results, violations }, '*');
      })();
    </script>`),
  ]);
  const { data } = await messageFrom(app.frame, (d) => d && 'results' in d);
  assert.deepEqual(data.results, ['blocked', 'blocked']);
  assert.ok(data.violations.some((u) => u.includes('127.0.0.1:1234')), 'no violation for the local port');
  assert.ok(data.violations.some((u) => u.includes('ipc.localhost')), 'no violation for the IPC host');
  await done(app);
});

test('the frame cannot open a browser database', async () => {
  const app = await launch([
    html(`<script>
      (async () => {
        let outcome;
        try {
          const req = indexedDB.open('SovereignDB');
          outcome = await new Promise((res) => { req.onsuccess = () => res('opened'); req.onerror = () => res('error'); });
        } catch (e) { outcome = 'threw ' + e.name; }
        parent.postMessage({ outcome }, '*');
      })();
    </script>`),
  ]);
  const { data } = await messageFrom(app.frame, (d) => d && 'outcome' in d);
  assert.ok(data.outcome !== 'opened', `the frame opened a database (${data.outcome})`);
  await done(app);
});

test('a port handed over after hello reaches the app', async () => {
  const nonce = newSessionId();
  const app = await launch(
    [
      html(`<script>
        const nonce = new URLSearchParams(location.hash.slice(1)).get('nv');
        window.addEventListener('message', (e) => {
          if (e.data && e.data.__novaura === 'port' && e.ports[0]) {
            const port = e.ports[0];
            port.onmessage = (ev) => port.postMessage({ echo: ev.data });
          }
        });
        parent.postMessage({ __novaura: 'hello', nonce }, '*');
      </script>`),
    ],
    { hash: `#nv=${nonce}` },
  );
  const { data } = await messageFrom(app.frame, (d) => d && d.__novaura === 'hello');
  assert.equal(data.nonce, nonce);
  const channel = new MessageChannel();
  const reply = new Promise((resolve) => { channel.port1.onmessage = (e) => resolve(e.data); });
  app.frame.contentWindow.postMessage({ __novaura: 'port' }, '*', [channel.port2]);
  channel.port1.postMessage('ping');
  assert.deepEqual(await reply, { echo: 'ping' });
  channel.port1.close();
  await done(app);
});
