import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createFakeTable } from './fakeTable.js';
import { createAdditionData } from '../../src/services/additions/dataStore.js';
import { launchAddition, stopAddition, bootScript, ADDITION_SANDBOX } from '../../src/services/additions/launch.js';
import { NOVAURA_V1_SOURCE } from '../../src/services/additions/bridgeSource.js';
import { buildPreview } from '../../src/services/cybeni/previewBuilder.js';

const FILES = [
  { path: 'index.html', content: '<!doctype html><html><head><title>Notes</title></head><body><div id="root"></div><script type="module" src="./main.js"></script></body></html>' },
  { path: 'main.js', content: "import { note } from './note.js';\ndocument.getElementById('root').textContent = note;" },
  { path: 'note.js', content: "export const note = 'hi';" },
];

const addition = (extra = {}) => ({
  id: 'user_notes',
  slug: 'notes',
  name: 'Notes',
  manifest: { id: 'local.notes', name: 'Notes', version: '1.0.0', permissions: [], network: [] },
  grants: { permissions: [], network: ['https://api.weather.gov'] },
  requested: { network: ['https://api.weather.gov', 'https://maps.example.com'] },
  quotaBytes: 1024 ** 3,
  ...extra,
});

async function launch(extra = {}, depsExtra = {}) {
  const data = createAdditionData(createFakeTable());
  await data.writeLocalStorage('user_notes', [{ op: 'set', key: 'draft', value: 'buy milk' }]);
  const calls = [];
  const invoke = async (cmd, args) => { calls.push({ cmd, args }); return args.files?.length ?? null; };
  const out = await launchAddition(addition(extra), {
    data,
    invoke,
    loadFiles: async (slug) => { assert.equal(slug, 'notes'); return FILES; },
    hostOrigin: 'http://tauri.localhost',
    newSession: () => 'sess0001abcd',
    newNonce: () => 'n0nce0001',
    theme: { name: 'default', mode: 'dark', colors: {} },
    baseUrl: (s) => `http://cyprev.localhost/${s}/`,
    ...depsExtra,
  });
  return { out, calls };
}

test('publish gets the app files, the bridge and the boot file, and boot is served once', async () => {
  const { calls } = await launch();
  assert.equal(calls.length, 1);
  const { cmd, args } = calls[0];
  assert.equal(cmd, 'addition_publish');
  assert.equal(args.session, 'sess0001abcd');
  const paths = args.files.map((f) => f.path);
  for (const p of ['index.html', 'main.js', 'note.js', '__novaura/v1.js', '__novaura/boot.js']) assert.ok(paths.includes(p), `missing ${p}`);
  assert.deepEqual(args.once, ['__novaura/boot.js']);
  assert.equal(args.files.find((f) => f.path === '__novaura/v1.js').content, NOVAURA_V1_SOURCE);
  const boot = args.files.find((f) => f.path === '__novaura/boot.js').content;
  const ctx = { window: {} };
  vm.runInNewContext(boot, ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.__novauraBoot)), {
    app: { id: 'local.notes', name: 'Notes', version: '1.0.0', permissions: [] },
    snapshot: { draft: 'buy milk' },
    theme: { name: 'default', mode: 'dark', colors: {} },
    hostOrigin: 'http://tauri.localhost',
  });
});

test('only granted network origins go to the CSP, not merely requested ones', async () => {
  const { calls } = await launch();
  assert.deepEqual(calls[0].args.network, ['https://api.weather.gov']);
});

test('the frame URL carries the nonce in its fragment, and the sandbox has no allow-same-origin', async () => {
  const { out } = await launch();
  assert.equal(out.src, 'http://cyprev.localhost/sess0001abcd/index.html#nv=n0nce0001');
  assert.equal(out.nonce, 'n0nce0001');
  assert.equal(out.session, 'sess0001abcd');
  assert.equal(out.sandbox, 'allow-scripts allow-forms allow-modals');
  assert.equal(ADDITION_SANDBOX, out.sandbox);
  assert.ok(!out.sandbox.includes('allow-same-origin'));
});

test('a relaunch can come back on the page the app was showing, but never outside its folder', async () => {
  assert.equal((await launch({}, { path: 'settings/profile?tab=2' })).out.src, 'http://cyprev.localhost/sess0001abcd/settings/profile?tab=2#nv=n0nce0001');
  for (const bad of ['../other/index.html', '/abs', 'a b', 'x#y', 'javascript:alert(1)']) {
    assert.equal((await launch({}, { path: bad })).out.src, 'http://cyprev.localhost/sess0001abcd/index.html#nv=n0nce0001', bad);
  }
});

test('in a plain browser it gives an inline document that carries the nonce in its boot data', async () => {
  const { out, calls } = await launch({}, { invoke: null });
  assert.equal(calls.length, 0);
  assert.equal(out.session, null);
  assert.ok(out.srcdoc.includes('window.__novauraBoot='));
  assert.ok(out.srcdoc.includes('"nonce":"n0nce0001"'));
  assert.ok(!out.srcdoc.includes('__novaura/boot.js'));
  assert.equal(out.sandbox, ADDITION_SANDBOX);
});

test('boot data cannot close its script tag', () => {
  const evil = '</script><script>alert(1)</script>\u2028\u2029<!--';
  const src = bootScript({ app: { id: 'local.x', name: evil, version: '1.0.0', permissions: [] }, snapshot: { [evil]: evil }, theme: null, hostOrigin: 'http://h' });
  assert.ok(!/<\/script/i.test(src));
  assert.ok(!src.includes('<!--'));
  assert.ok(!src.includes('\u2028') && !src.includes('\u2029'));
  const ctx = { window: {} };
  vm.runInNewContext(src, ctx);
  assert.equal(ctx.window.__novauraBoot.app.name, evil);
  assert.equal(ctx.window.__novauraBoot.snapshot[evil], evil);
});

test('addition mode loads boot and the bridge before the import map and leaves out the test agent', () => {
  const out = buildPreview(FILES, { mode: 'addition', baseUrl: 'http://cyprev.localhost/s1234567/' });
  const html = out.html;
  const boot = html.indexOf('<script src="http://cyprev.localhost/s1234567/__novaura/boot.js"></script>');
  const bridge = html.indexOf('<script src="http://cyprev.localhost/s1234567/__novaura/v1.js"></script>');
  const map = html.indexOf('<script type="importmap">');
  assert.ok(boot > 0 && bridge > boot && map > bridge, `order boot ${boot} bridge ${bridge} map ${map}`);
  assert.ok(!html.includes('__cybeniAppId'));
  assert.ok(!html.includes('__cybeniRunTests'), 'test agent left in');
  assert.ok(!html.includes('cybeni-isolate=1'), 'storage isolation left in');
  const server = buildPreview(FILES, { mode: 'server', baseUrl: 'http://cyprev.localhost/s1234567/' }).html;
  assert.ok(server.includes('__cybeniRunTests') && server.includes('cybeni-isolate=1'), 'the markers this test relies on are gone from server mode');
  assert.ok(out.serverFiles.some((f) => f.path === '__novaura/v1.js' && f.content === NOVAURA_V1_SOURCE));
  assert.ok(out.serverFiles.some((f) => f.path === 'index.html'));
  assert.ok(!out.serverFiles.some((f) => f.path === '__novaura/boot.js'), 'boot is per launch, not part of the build');
});

test('stopping an addition clears its session', async () => {
  const calls = [];
  await stopAddition('sess0001abcd', async (cmd, args) => calls.push({ cmd, args }));
  assert.deepEqual(calls, [{ cmd: 'addition_clear', args: { session: 'sess0001abcd' } }]);
  await stopAddition(null, async () => { throw new Error('should not be called'); });
  await stopAddition('sess0001abcd', async () => { throw new Error('gone'); });
});
