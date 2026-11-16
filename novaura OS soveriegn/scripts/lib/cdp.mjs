// cdp.mjs — Drive headless Edge or Chrome over the DevTools protocol, for smoke tests.
//
//   const b = await launchBrowser({ width: 1600, height: 1000 });
//   await b.navigate(url); await b.evaluate('1 + 1'); await b.drag([x0, y0], [x1, y1]);
//   b.errors  // page exceptions and console errors seen so far
//   await b.close();

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error('No Edge or Chrome found; set CHROME_PATH.');
  return found;
}

export async function launchBrowser({ width = 1400, height = 900 } = {}) {
  const port = 9600 + Math.floor(Math.random() * 300);
  const profile = mkdtempSync(join(tmpdir(), 'novaura-smoke-'));
  const proc = spawn(findBrowser(), [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });

  let ws = null;
  for (let i = 0; i < 100 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      }
    } catch { ws = null; await sleep(150); }
  }
  if (!ws) throw new Error('Could not connect to the browser.');

  let nextId = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(`exception: ${(d.exception?.description || d.text || '').split('\n')[0]}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(`console.error: ${msg.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(`evaluate failed: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
    return r.result?.result?.value;
  };
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });

  return {
    send, evaluate, errors,
    async navigate(url) { await send('Page.navigate', { url }); },
    async waitFor(expression, timeoutMs = 20000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (await evaluate(expression).catch(() => false)) return true;
        await sleep(200);
      }
      return false;
    },
    async screenshot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(r.result.data, 'base64'));
    },
    async drag([x0, y0], [x1, y1], steps = 20) {
      await mouse('mouseMoved', x0, y0, { buttons: 0 });
      await mouse('mousePressed', x0, y0);
      for (let i = 1; i <= steps; i++) await mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
      await mouse('mouseReleased', x1, y1);
    },
    async click(x, y) {
      await mouse('mousePressed', x, y);
      await mouse('mouseReleased', x, y);
    },
    /** A key with optional modifiers: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift. */
    async key(key, code, keyCode, modifiers = 0) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
    },
    async close() {
      try { ws.close(); } catch { /* closing */ }
      proc.kill();
      await sleep(300);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* still held */ }
    },
  };
}
