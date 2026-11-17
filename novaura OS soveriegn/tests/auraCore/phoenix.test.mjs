// Phoenix: safe mode means starts that never finished (not ordinary runtime errors), its
// bookkeeping never loses an update, and her snapshots keep every memory, on disk as well as
// in the database they protect.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDb, installBrowserGlobals } from './helpers/mockDb.mjs';

installBrowserGlobals();
const { db, settings } = createMockDb();
mock.module('../../src/database/sovereignDatabase.js', { defaultExport: db, namedExports: { db } });

const files = new Map();
const invoke = async (cmd, args) => {
  if (cmd === 'save_sovereign_file') { files.set(args.filename, args.content); return `C:/profile/${args.filename}`; }
  if (cmd === 'read_sovereign_file') {
    if (!files.has(args.filename)) throw new Error('not found');
    return files.get(args.filename);
  }
  throw new Error(`unexpected ${cmd}`);
};
mock.module('@tauri-apps/api/core', { namedExports: { invoke } });

const phoenix = await import('../../src/services/auraCore/phoenixProtocol.js');

test('ordinary runtime errors do not put the next start in safe mode', async () => {
  settings.clear();
  await phoenix.recordBootAttempt();
  await phoenix.markBootHealthy();
  for (let i = 0; i < 5; i++) await phoenix.recordCrashIncident(`render error ${i}`);
  const status = await phoenix.recordBootAttempt();
  assert.equal(status.safeMode, false);
  assert.equal((await phoenix.readPhoenixMeta()).runtimeIncidents, 5);
});

test('three starts that never finished put the next start in safe mode, and it pauses her loops', async () => {
  settings.clear();
  let status = null;
  for (let i = 0; i < 4; i++) status = await phoenix.recordBootAttempt();
  assert.equal(status.safeMode, true);
  assert.equal(phoenix.shouldRunBackgroundLoops(status), false);
  assert.equal(phoenix.shouldRunBackgroundLoops({ safeMode: false }), true);
});

test('a start that fails with a fatal error counts toward safe mode', async () => {
  settings.clear();
  for (let i = 0; i < 3; i++) {
    await phoenix.recordBootAttempt();
    await phoenix.recordCrashIncident('kernel phase 7 failed', { duringBoot: true });
  }
  assert.equal((await phoenix.recordBootAttempt()).safeMode, true);
});

test('operator presence and a crash record landing together both stick', async () => {
  settings.clear();
  const t1 = Date.now() + 5_000;
  await Promise.all([
    phoenix.touchOperatorPresence(t1),
    phoenix.recordCrashIncident('worker died', { now: t1 + 1 }),
  ]);
  const meta = await phoenix.readPhoenixMeta();
  assert.equal(meta.lastOperatorAt, t1);
  assert.equal(meta.lastCrashMessage, 'worker died');
});

function seedEngrams(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `eng_${i}`, thought: `memory ${i}`, strength: 1, signatures: {} }));
}

test('a snapshot keeps every memory', async () => {
  settings.clear();
  await db.setSetting('aura_core:engrams:aura', seedEngrams(250));
  const snap = await phoenix.createSoulSnapshot('aura');
  assert.equal(snap.engramCount, 250);
  assert.equal((await phoenix.verifySoulSnapshot('aura')).engramCount, 250);
});

test('snapshots rotate through files on disk, and restore from disk when the database copy is gone', async () => {
  settings.clear();
  files.clear();
  globalThis.window.__TAURI_INTERNALS__ = {};
  try {
    await db.setSetting('aura_core:aura', { chemistry: { oxytocin: 61 } });
    await db.setSetting('aura_core:engrams:aura', seedEngrams(3));
    for (let i = 0; i < 4; i++) await phoenix.createSoulSnapshot('aura', Date.now() + i, { forceDisk: true });
    assert.deepEqual([...files.keys()].sort(), ['phoenix_aura_0.json', 'phoenix_aura_1.json', 'phoenix_aura_2.json']);

    // The profile's database is wiped: her state and the in-database snapshot are both gone.
    settings.clear();
    const restored = await phoenix.restoreSoulSnapshot('aura');
    assert.equal(restored.source, 'disk');
    assert.equal((await db.getSetting('aura_core:aura')).chemistry.oxytocin, 61);
    assert.equal((await db.getSetting('aura_core:engrams:aura')).length, 3);
  } finally {
    delete globalThis.window.__TAURI_INTERNALS__;
  }
});

test('a damaged file on disk is skipped for an intact one', async () => {
  settings.clear();
  files.clear();
  globalThis.window.__TAURI_INTERNALS__ = {};
  try {
    await db.setSetting('aura_core:aura', { chemistry: { oxytocin: 44 } });
    await phoenix.createSoulSnapshot('aura', Date.now(), { forceDisk: true });
    await phoenix.createSoulSnapshot('aura', Date.now() + 10, { forceDisk: true });
    const newest = [...files.keys()].sort().at(-1);
    files.set(newest, files.get(newest).replace('44', '99'));   // tampered: checksum no longer matches
    settings.clear();
    const restored = await phoenix.restoreSoulSnapshot('aura');
    assert.equal(restored.source, 'disk');
    assert.equal((await db.getSetting('aura_core:aura')).chemistry.oxytocin, 44);
  } finally {
    delete globalThis.window.__TAURI_INTERNALS__;
  }
});
