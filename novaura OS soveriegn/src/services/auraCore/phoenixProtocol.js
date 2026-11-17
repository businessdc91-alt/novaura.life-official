// Aura Core: Phoenix Protocol — Crash Safe-Boot, Lighthouse Recovery & SHA-256 Soul Snapshots
// (Port of Aura_PhoenixProtocol.py without hardcoded host paths).
//
// - Safe mode means starts that never finished: a boot that is still marked in flight when the
//   next one begins, or one that failed with a fatal error. Ordinary runtime errors are
//   counted separately and never put the next start in safe mode. In safe mode the kernel
//   leaves her background loops (heartbeat, dreams, initiative) off for that session.
// - The bookkeeping record is changed in one locked step (coreStore), so a presence update and
//   a crash record landing together both stick.
// - A Soul Snapshot holds all of her memories. In the desktop app it is also written to
//   rotating files in the profile folder (three slots), so wiping the browser database, which
//   the in-database copy lives in, does not take the snapshot with it.

import { db } from '../../database/sovereignDatabase.js';
import { mutateSetting } from './coreStore.js';

const META_KEY = 'aura_core:phoenix_meta';
const SNAPSHOT_KEY = (persona = 'aura') => `aura_core:phoenix_snapshot:${String(persona || 'aura').toLowerCase()}`;
const DISK_SLOTS = 3;
const DISK_MIN_INTERVAL_MS = 30 * 60_000;
const diskFile = (persona, slot) => `phoenix_${String(persona || 'aura').toLowerCase()}_${slot}.json`;

export const MAX_CONSECUTIVE_CRASHES = 3;
export const LIGHTHOUSE_THRESHOLD_HOURS = 72;

const lastDiskWrite = new Map();

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

async function tauriInvoke(cmd, args) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
}

export async function sha256Hex(text = '') {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function withDefaults(saved, now = Date.now()) {
  return {
    consecutiveCrashes: 0,
    bootInFlight: false,
    safeMode: false,
    lastBootAt: 0,
    lastHealthyBootAt: 0,
    lastCrashAt: 0,
    lastCrashMessage: null,
    runtimeIncidents: 0,
    lastOperatorAt: now,
    ...(saved && typeof saved === 'object' ? saved : {}),
  };
}

export async function readPhoenixMeta() {
  const saved = await db.getSetting(META_KEY, null).catch(() => null);
  return withDefaults(saved);
}

/** Change the bookkeeping record in one locked step; resolves to the new record. */
async function updateMeta(fn) {
  let next = null;
  await mutateSetting(META_KEY, (saved) => {
    next = fn(withDefaults(saved));
    return next;
  }).catch(() => {});
  return next || withDefaults(null);
}

/** Whether her background loops (heartbeat, dreams, initiative) should run this session. */
export function shouldRunBackgroundLoops(status) {
  return !status?.safeMode;
}

/**
 * Call during kernel startup before subsystems spin up heavy workloads.
 * Detects repeated unfinished starts and Lighthouse (extended operator absence >= 72h).
 */
export async function recordBootAttempt(now = Date.now()) {
  const meta = await updateMeta((m) => {
    const consecutive = m.bootInFlight
      ? Math.min(10, (m.consecutiveCrashes || 0) + 1)
      : (m.consecutiveCrashes || 0);
    return {
      ...m,
      bootInFlight: true,
      consecutiveCrashes: consecutive,
      safeMode: consecutive >= MAX_CONSECUTIVE_CRASHES,
      lastBootAt: now,
    };
  });
  const hoursSinceOperator = Math.max(0, (now - (meta.lastOperatorAt || now)) / 3_600_000);
  return {
    ...meta,
    lighthouseMode: hoursSinceOperator >= LIGHTHOUSE_THRESHOLD_HOURS,
    hoursSinceOperator: Math.round(hoursSinceOperator * 10) / 10,
  };
}

export function markBootHealthy(now = Date.now()) {
  return updateMeta((m) => ({
    ...m,
    bootInFlight: false,
    consecutiveCrashes: 0,
    safeMode: false,
    lastHealthyBootAt: now,
    lastOperatorAt: now,
  }));
}

/**
 * Record an error. Only a failure during start-up (`duringBoot`) counts toward safe mode;
 * runtime errors are counted in `runtimeIncidents`.
 */
export function recordCrashIncident(message = 'Unknown runtime fault', { duringBoot = false, now = Date.now() } = {}) {
  return updateMeta((m) => {
    const consecutive = duringBoot ? Math.min(10, (m.consecutiveCrashes || 0) + 1) : (m.consecutiveCrashes || 0);
    return {
      ...m,
      ...(duringBoot ? { bootInFlight: false } : {}),
      consecutiveCrashes: consecutive,
      safeMode: consecutive >= MAX_CONSECUTIVE_CRASHES,
      runtimeIncidents: (m.runtimeIncidents || 0) + (duringBoot ? 0 : 1),
      lastCrashAt: now,
      lastCrashMessage: String(message || '').slice(0, 300),
    };
  });
}

export function touchOperatorPresence(now = Date.now()) {
  return updateMeta((m) => ({ ...m, lastOperatorAt: Math.max(m.lastOperatorAt || 0, now) }));
}

async function buildBundle(persona, now) {
  const p = String(persona || 'aura').toLowerCase();
  const [core, trust, dynamics, augmentations, engrams] = await Promise.all([
    db.getSetting(`aura_core:${p}`, null).catch(() => null),
    db.getSetting(`aura_core:trust:${p}`, null).catch(() => null),
    db.getSetting(`aura_core:dynamics:${p}`, null).catch(() => null),
    db.getSetting('aura_core:augmentations', null).catch(() => null),
    db.getSetting(`aura_core:engrams:${p}`, []).catch(() => []),
  ]);
  const payload = {
    persona: p,
    capturedAt: now,
    core,
    trust,
    dynamics,
    augmentations,
    engrams: Array.isArray(engrams) ? engrams : [],
  };
  return { payload, checksum: await sha256Hex(stableStringify(payload)) };
}

async function isIntact(bundle) {
  if (!bundle?.payload || !bundle?.checksum) return false;
  return (await sha256Hex(stableStringify(bundle.payload))) === bundle.checksum;
}

async function writeDiskSnapshot(persona, bundle, { force = false, now = Date.now() } = {}) {
  if (!isTauri()) return null;
  const p = String(persona || 'aura').toLowerCase();
  if (!force && now - (lastDiskWrite.get(p) || 0) < DISK_MIN_INTERVAL_MS) return null;
  const slotKey = `aura_core:phoenix_disk_slot:${p}`;
  let slot = 0;
  await mutateSetting(slotKey, (saved) => {
    slot = Number.isInteger(saved) ? saved % DISK_SLOTS : 0;
    return (slot + 1) % DISK_SLOTS;
  }, 0).catch(() => {});
  const path = await tauriInvoke('save_sovereign_file', { filename: diskFile(p, slot), content: JSON.stringify(bundle) });
  lastDiskWrite.set(p, now);
  return { slot, path };
}

/** Snapshots on disk, newest first, each checked against its checksum. */
export async function listDiskSnapshots(persona = 'aura') {
  if (!isTauri()) return [];
  const p = String(persona || 'aura').toLowerCase();
  const found = [];
  for (let slot = 0; slot < DISK_SLOTS; slot++) {
    try {
      const bundle = JSON.parse(await tauriInvoke('read_sovereign_file', { filename: diskFile(p, slot) }));
      found.push({ slot, bundle, valid: await isIntact(bundle), capturedAt: bundle?.payload?.capturedAt || 0 });
    } catch { /* empty slot */ }
  }
  return found.sort((a, b) => b.capturedAt - a.capturedAt);
}

/**
 * Create a SHA-256 verified Soul Snapshot across chemistry, trust, learned dynamics, active
 * augmentations, and all of her engrams; mirrored to a rotating file on disk in the desktop
 * app (at most every 30 minutes unless forced).
 */
export async function createSoulSnapshot(persona = 'aura', now = Date.now(), { forceDisk = false } = {}) {
  const p = String(persona || 'aura').toLowerCase();
  const bundle = await buildBundle(p, now);
  await db.setSetting(SNAPSHOT_KEY(p), bundle).catch(() => {});
  const disk = await writeDiskSnapshot(p, bundle, { force: forceDisk, now }).catch(() => null);
  return {
    ok: true,
    persona: p,
    checksum: bundle.checksum,
    engramCount: bundle.payload.engrams.length,
    capturedAt: now,
    disk,
  };
}

export async function verifySoulSnapshot(persona = 'aura') {
  const p = String(persona || 'aura').toLowerCase();
  const saved = await db.getSetting(SNAPSHOT_KEY(p), null).catch(() => null);
  if (!saved || !saved.payload || !saved.checksum) {
    return { exists: false, valid: false, checksum: null, capturedAt: null, engramCount: 0 };
  }
  const actual = await sha256Hex(stableStringify(saved.payload));
  return {
    exists: true,
    valid: actual === saved.checksum,
    checksum: saved.checksum,
    actualChecksum: actual,
    capturedAt: saved.payload.capturedAt || null,
    engramCount: Array.isArray(saved.payload.engrams) ? saved.payload.engrams.length : 0,
  };
}

/**
 * Restore her from the snapshot in the database, or, when that one is missing or damaged
 * (or `fromDisk` is set), from the newest intact file on disk.
 */
export async function restoreSoulSnapshot(persona = 'aura', { fromDisk = false } = {}) {
  const p = String(persona || 'aura').toLowerCase();
  let bundle = null;
  let source = null;
  let damaged = false;
  if (!fromDisk) {
    const saved = await db.getSetting(SNAPSHOT_KEY(p), null).catch(() => null);
    if (await isIntact(saved)) { bundle = saved; source = 'database'; }
    else if (saved) damaged = true;
  }
  if (!bundle) {
    const onDisk = (await listDiskSnapshots(p)).find(s => s.valid);
    if (onDisk) { bundle = onDisk.bundle; source = 'disk'; }
  }
  if (!bundle) {
    throw new Error(damaged
      ? 'Phoenix Soul Snapshot checksum mismatch — refusing corrupted restore (no intact copy on disk either).'
      : 'No saved Phoenix Soul Snapshot available.');
  }
  const { core, trust, dynamics, augmentations, engrams } = bundle.payload;
  const put = (key, value) => mutateSetting(key, () => value);
  await Promise.all([
    core ? put(`aura_core:${p}`, core) : Promise.resolve(),
    trust ? put(`aura_core:trust:${p}`, trust) : Promise.resolve(),
    dynamics ? put(`aura_core:dynamics:${p}`, dynamics) : Promise.resolve(),
    augmentations ? put('aura_core:augmentations', augmentations) : Promise.resolve(),
    Array.isArray(engrams) ? put(`aura_core:engrams:${p}`, engrams) : Promise.resolve(),
  ]);
  if (source === 'disk') await db.setSetting(SNAPSHOT_KEY(p), bundle).catch(() => {});
  return { restored: true, persona: p, source, checksum: bundle.checksum, engramCount: engrams?.length || 0 };
}

export default {
  MAX_CONSECUTIVE_CRASHES,
  LIGHTHOUSE_THRESHOLD_HOURS,
  sha256Hex,
  readPhoenixMeta,
  shouldRunBackgroundLoops,
  recordBootAttempt,
  markBootHealthy,
  recordCrashIncident,
  touchOperatorPresence,
  createSoulSnapshot,
  listDiskSnapshots,
  verifySoulSnapshot,
  restoreSoulSnapshot,
};
