import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectAddition } from '../../src/services/additions/host.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setup({ nonce = 'n0nce123', drainMs = 30 } = {}) {
  const hostWindow = new EventTarget();
  const toFrame = [];
  const contentWindow = { postMessage: (msg, target, transfer = []) => toFrame.push({ msg, target, port: transfer[0] }) };
  const frame = { contentWindow };
  const handled = [];
  const router = { handle: async (msg) => { handled.push(msg); return typeof msg.id === 'number' ? { id: msg.id, ok: true, v: `did ${msg.m}` } : null; } };
  const relaunches = [];
  const conn = connectAddition({ frame, nonce, hostWindow, router, onRelaunch: (info) => relaunches.push(info), drainMs });
  const fromFrame = (data, source = contentWindow) => hostWindow.dispatchEvent(Object.assign(new Event('message'), { data, source, origin: 'null' }));
  const ports = () => toFrame.filter((t) => t.msg?.__novaura === 'port').map((t) => t.port);
  const cleanup = () => { conn.dispose(); for (const p of ports()) p?.close(); };
  return { conn, frame, fromFrame, toFrame, ports, handled, relaunches, cleanup };
}

const ask = (port, msg) => new Promise((resolve) => { port.onmessage = (e) => resolve(e.data); port.postMessage(msg); });

test('a hello from another window is ignored', () => {
  const s = setup();
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' }, { postMessage() {} });
  assert.equal(s.ports().length, 0);
  s.cleanup();
});

test('a wrong nonce is ignored', () => {
  const s = setup();
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce124' });
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce12' });
  s.fromFrame({ __novaura: 'hello' });
  assert.equal(s.ports().length, 0);
  s.cleanup();
});

test('only the first hello gets a port', () => {
  const s = setup();
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' });
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' });
  assert.equal(s.ports().length, 1);
  assert.equal(s.toFrame[0].target, '*');
  s.cleanup();
});

test('requests reach the router and replies come back', async () => {
  const s = setup();
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' });
  const [port] = s.ports();
  assert.deepEqual(await ask(port, { id: 1, m: 'storage.keys', a: {} }), { id: 1, ok: true, v: 'did storage.keys' });
  port.postMessage({ t: 'ls.batch', ops: [] });
  await wait(10);
  assert.deepEqual(s.handled.map((m) => m.m || m.t), ['storage.keys', 'ls.batch']);
  s.cleanup();
});

test('theme changes are pushed to the frame', async () => {
  const s = setup();
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' });
  const [port] = s.ports();
  const got = new Promise((resolve) => { port.onmessage = (e) => resolve(e.data); });
  s.conn.pushTheme({ mode: 'light' });
  assert.deepEqual(await got, { t: 'theme', theme: { mode: 'light' } });
  s.cleanup();
});

test('relaunch from the frame calls onRelaunch; from elsewhere it does not', () => {
  const s = setup();
  s.fromFrame({ __novaura: 'relaunch', path: 'settings/profile' });
  s.fromFrame({ __novaura: 'relaunch' }, { postMessage() {} });
  assert.deepEqual(s.relaunches, [{ path: 'settings/profile' }]);
  s.fromFrame({ __novaura: 'relaunch', path: 42 });
  assert.deepEqual(s.relaunches[1], { path: '' });
  s.cleanup();
});

test('after dispose no new hello is accepted, but queued messages are still handled during the drain', async () => {
  const late = setup();
  late.conn.dispose();
  late.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' });
  late.fromFrame({ __novaura: 'relaunch', path: '' });
  assert.equal(late.ports().length, 0);
  assert.deepEqual(late.relaunches, []);

  const s = setup({ drainMs: 40 });
  s.fromFrame({ __novaura: 'hello', nonce: 'n0nce123' });
  const [port] = s.ports();
  s.conn.dispose();
  assert.deepEqual(await ask(port, { id: 7, m: 'storage.set', a: {} }), { id: 7, ok: true, v: 'did storage.set' });
  await wait(80);
  const after = await Promise.race([ask(port, { id: 8, m: 'storage.set', a: {} }), wait(60).then(() => 'no reply')]);
  assert.equal(after, 'no reply');
  port.close();
});
