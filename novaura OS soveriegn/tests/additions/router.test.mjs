import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createAdditionData } from '../../src/services/additions/dataStore.js';
import { createRouter } from '../../src/services/additions/router.js';

const addition = (extra = {}) => ({ id: 'user_notes', grants: { permissions: [], network: [] }, quotaBytes: 1024 ** 3, ...extra });

function setup({ grants, quotaBytes, services, limits } = {}) {
  let clock = 1_000_000;
  const data = createAdditionData(createFakeTable());
  const calls = { titles: [], closed: 0, blocked: [] };
  const router = createRouter({
    addition: addition({ ...(grants ? { grants: { permissions: grants, network: [] } } : {}), ...(quotaBytes ? { quotaBytes } : {}) }),
    data,
    ui: { theme: () => ({ mode: 'dark' }), setTitle: (t) => calls.titles.push(t), close: () => { calls.closed++; } },
    onBlocked: (o) => calls.blocked.push(o),
    now: () => clock,
    services,
    limits: { chunkBytes: 64, maxMessageBytes: 1000, requestsPerSecond: 50, ...limits },
  });
  let id = 0;
  const req = (m, a = {}) => router.handle({ id: ++id, m, a });
  return { router, data, calls, req, advance: (ms) => { clock += ms; } };
}

const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.e)); return r.v; };
const code = (r) => { assert.equal(r.ok, false, 'expected an error'); return r.e.code; };

test('an unknown method is refused', async () => {
  const { req } = setup();
  assert.equal(code(await req('storage.drop')), 'unknown_method');
  assert.equal(code(await req('__proto__')), 'unknown_method');
});

test('notify, ai.chat, files.open and files.save are denied by default and never reach a service', async () => {
  const reached = [];
  const services = { notify: () => reached.push('notify'), aiChat: () => reached.push('ai'), filesOpen: () => reached.push('open'), filesSave: () => reached.push('save') };
  const { req } = setup({ services });
  for (const m of ['notify', 'ai.chat', 'files.open', 'files.save']) assert.equal(code(await req(m, {})), 'permission_denied', m);
  assert.deepEqual(reached, []);
});

test('a granted but unbuilt service says not_available', async () => {
  const { req } = setup({ grants: ['ai', 'notifications', 'files'] });
  for (const m of ['notify', 'ai.chat', 'files.open', 'files.save']) assert.equal(code(await req(m, {})), 'not_available', m);
  const built = setup({ grants: ['notifications'], services: { notify: (a) => `shown ${a.title}` } });
  assert.equal(ok(await built.req('notify', { title: 'Hi' })), 'shown Hi');
});

test('the 51st request in a second is rate_limited and passes again later', async () => {
  const { req, advance } = setup();
  for (let i = 0; i < 50; i++) ok(await req('storage.usage'));
  const limited = await req('storage.usage');
  assert.equal(code(limited), 'rate_limited');
  assert.ok(limited.e.retryAfterMs > 0 && limited.e.retryAfterMs <= 20, `retryAfterMs ${limited.e.retryAfterMs}`);
  advance(limited.e.retryAfterMs);
  ok(await req('storage.usage'));
});

test('events do not count against the request budget', async () => {
  const { router, req } = setup();
  for (let i = 0; i < 100; i++) assert.equal(await router.handle({ t: 'blocked', uri: 'inline', directive: 'script-src' }), null);
  ok(await req('storage.usage'));
});

test('storage round trip, keys and usage', async () => {
  const { req } = setup();
  ok(await req('storage.set', { key: 'a', value: { n: 1 } }));
  ok(await req('storage.set', { key: 'b', value: 'text' }));
  assert.deepEqual(ok(await req('storage.get', { key: 'a' })), { value: { n: 1 } });
  assert.deepEqual(ok(await req('storage.get', { key: 'missing' })), { value: undefined });
  assert.deepEqual(ok(await req('storage.keys')).sort(), ['a', 'b']);
  ok(await req('storage.remove', { key: 'a' }));
  assert.deepEqual(ok(await req('storage.keys')), ['b']);
  assert.equal(ok(await req('storage.usage')), 1 + 4);
  assert.equal(code(await req('storage.set', { value: 1 })), 'bad_request');
});

test('chunked put and get give back the same string and the same bytes', async () => {
  const { req } = setup(); // chunkBytes 64
  const text = 'xé😀'.repeat(40);
  const { uploadId } = ok(await req('storage.put.begin', { key: 't', kind: 'string', size: Buffer.byteLength(text) }));
  const parts = text.match(/[\s\S]{1,20}/gu);
  for (let i = 0; i < parts.length; i++) ok(await req('storage.put.chunk', { uploadId, index: i, data: parts[i] }));
  ok(await req('storage.put.commit', { uploadId, count: parts.length }));
  const got = ok(await req('storage.get', { key: 't' }));
  assert.ok(got.chunked, 'large value should come back in chunks');
  let back = '';
  for (let i = 0; i < got.chunked.count; i++) {
    const piece = ok(await req('storage.get.chunk', { readId: got.chunked.readId, index: i }));
    assert.ok(Buffer.byteLength(piece) <= 64);
    back += piece;
  }
  assert.equal(back, text);

  const bytes = new Uint8Array(150).map((_, i) => i);
  const up = ok(await req('storage.put.begin', { key: 'b', kind: 'bytes', size: 150, view: 'Uint8Array' })).uploadId;
  for (let i = 0; i < 3; i++) ok(await req('storage.put.chunk', { uploadId: up, index: i, data: bytes.buffer.slice(i * 64, Math.min(150, (i + 1) * 64)) }));
  ok(await req('storage.put.commit', { uploadId: up, count: 3 }));
  const head = ok(await req('storage.get', { key: 'b' })).chunked;
  assert.equal(head.kind, 'bytes');
  assert.equal(head.view, 'Uint8Array');
  const pieces = [];
  for (let i = 0; i < head.count; i++) pieces.push(new Uint8Array(ok(await req('storage.get.chunk', { readId: head.readId, index: i }))));
  assert.deepEqual(pieces.flatMap((p) => [...p]), [...bytes]);
});

test('a chunked upload that skips a piece or overruns its size is refused', async () => {
  const { req } = setup();
  const { uploadId } = ok(await req('storage.put.begin', { key: 't', kind: 'string', size: 10 }));
  assert.equal(code(await req('storage.put.chunk', { uploadId, index: 1, data: 'abc' })), 'bad_request');
  ok(await req('storage.put.chunk', { uploadId, index: 0, data: 'abcdefgh' }));
  assert.equal(code(await req('storage.put.chunk', { uploadId, index: 1, data: 'ijklmnop' })), 'too_large');
  assert.equal(code(await req('storage.put.commit', { uploadId: 'nope', count: 1 })), 'bad_request');
});

test('a chunked upload left unfinished for 60 s is dropped', async () => {
  const { req, advance } = setup();
  const { uploadId } = ok(await req('storage.put.begin', { key: 't', kind: 'string', size: 10 }));
  advance(60_001);
  assert.equal(code(await req('storage.put.chunk', { uploadId, index: 0, data: 'a' })), 'bad_request');
});

test('a request over 16 MB is too_large', async () => {
  const { req } = setup(); // maxMessageBytes 1000 here
  assert.equal(code(await req('storage.set', { key: 'k', value: 'x'.repeat(1001) })), 'too_large');
  assert.equal(code(await req('storage.set', { key: 'k', value: { nested: [new Uint8Array(1200)] } })), 'too_large');
  ok(await req('storage.set', { key: 'k', value: 'x'.repeat(900) }));
});

test('over the quota is quota_exceeded', async () => {
  const { req } = setup({ quotaBytes: 100 });
  ok(await req('storage.set', { key: 'k', value: 'small' }));
  assert.equal(code(await req('storage.set', { key: 'k', value: 'y'.repeat(200) })), 'quota_exceeded');
  assert.equal(code(await req('storage.put.begin', { key: 'big', kind: 'string', size: 5000 })), 'quota_exceeded');
  assert.deepEqual(ok(await req('storage.get', { key: 'k' })), { value: 'small' });
});

test('ls.batch is written', async () => {
  const { router, data } = setup();
  assert.equal(await router.handle({ t: 'ls.batch', ops: [{ op: 'set', key: 'theme', value: 'dark' }, { op: 'set', key: 'n', value: '1' }, { op: 'remove', key: 'n' }] }), null);
  assert.deepEqual(await data.snapshotLocalStorage('user_notes'), { theme: 'dark' });
});

test('a blocked https or wss origin is passed on; a local one is not', async () => {
  const { router, calls } = setup();
  for (const uri of ['https://API.example.com/x?y=1', 'wss://live.example.com/s', 'http://127.0.0.1:1234/', 'http://ipc.localhost/', 'https://localhost/', 'inline', 'http://plain.example.com/']) {
    await router.handle({ t: 'blocked', uri, directive: 'connect-src' });
  }
  assert.deepEqual(calls.blocked, ['https://api.example.com', 'wss://live.example.com']);
});

test('setTitle is trimmed and shortened', async () => {
  const { req, calls } = setup();
  ok(await req('ui.setTitle', { text: '   Hello   ' }));
  ok(await req('ui.setTitle', { text: 'x'.repeat(300) }));
  ok(await req('ui.setTitle', { text: 'line\nbreak\u0000' }));
  assert.deepEqual(calls.titles, ['Hello', 'x'.repeat(120), 'line break']);
  ok(await req('ui.close'));
  assert.equal(calls.closed, 1);
});

test('a message that is not a request or a known event is ignored', async () => {
  const { router } = setup();
  for (const msg of [null, 'text', 42, { t: 'unknown' }, { id: 'x', m: 'storage.usage' }]) assert.equal(await router.handle(msg), null);
});

test('a Map or Set cannot slip past the message limit or the quota', async () => {
  const { req } = setup({ quotaBytes: 5000 });
  assert.equal(code(await req('storage.set', { key: 'k', value: new Map([['a', 'x'.repeat(2000)]]) })), 'too_large');
  ok(await req('storage.set', { key: 'k', value: new Set(['y'.repeat(800)]) }));
  assert.ok(ok(await req('storage.usage')) >= 800);
});

test('an event flood is cut off: ls.batch has its own budget and blocked origins are capped', async () => {
  const { router, data, calls } = setup();
  for (let i = 0; i < 200; i++) await router.handle({ t: 'ls.batch', ops: [{ op: 'set', key: `k${i}`, value: 'v' }] });
  const kept = Object.keys(await data.snapshotLocalStorage('user_notes')).length;
  assert.ok(kept >= 20 && kept <= 60, `kept ${kept} of 200 batches sent at once`);
  for (let i = 0; i < 100; i++) await router.handle({ t: 'blocked', uri: `https://h${i}.example.com/`, directive: 'connect-src' });
  await router.handle({ t: 'blocked', uri: 'https://h0.example.com/again', directive: 'connect-src' });
  assert.equal(calls.blocked.length, 32);
});

test('a huge ls.batch is dropped instead of written', async () => {
  const { router, data } = setup({ limits: { maxEventOps: 10 } });
  await router.handle({ t: 'ls.batch', ops: Array.from({ length: 11 }, (_, i) => ({ op: 'set', key: `k${i}`, value: 'v' })) });
  assert.deepEqual(await data.snapshotLocalStorage('user_notes'), {});
});

test('a large value has one pending read per key, and pending reads are capped', async () => {
  const { req } = setup({ limits: { maxPendingReadBytes: 300 } });
  ok(await req('storage.set', { key: 'a', value: 'a'.repeat(200) }));
  ok(await req('storage.set', { key: 'b', value: 'b'.repeat(200) }));
  const first = ok(await req('storage.get', { key: 'a' })).chunked;
  const second = ok(await req('storage.get', { key: 'a' })).chunked;
  assert.equal(code(await req('storage.get.chunk', { readId: first.readId, index: 0 })), 'bad_request');
  ok(await req('storage.get.chunk', { readId: second.readId, index: 0 }));
  assert.equal(code(await req('storage.get', { key: 'b' })), 'rate_limited');
});
