// Aura Core: Phoenix Protocol — Crash Safe-Boot, Lighthouse Recovery & SHA-256 Soul Snapshots
// (Port of Aura_PhoenixProtocol.py without hardcoded host paths).

import { db } from '../../database/sovereignDatabase.js';

const META_KEY = 'aura_core:phoenix_meta';
const SNAPSHOT_KEY = (persona = 'aura') => `aura_core:phoenix_snapshot:${String(persona || 'aura').toLowerCase()}`;

export const MAX_CONSECUTIVE_CRASHES = 3;
export const LIGHTHOUSE_THRESHOLD_HOURS = 72;

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

export async function readPhoenixMeta() {
  const saved = await db.getSetting(META_KEY, null).catch(() => null);
  return {
    consecutiveCrashes: 0,
    bootInFlight: false,
    safeMode: false,
    lastBootAt: 0,
    lastHealthyBootAt: 0,
    lastCrashAt: 0,
    lastCrashMessage: null,
    lastOperatorAt: Date.now(),
    ...(saved && typeof saved === 'object' ? saved : {}),
  };
}

/**
 * Call during kernel startup before subsystems spin up heavy workloads.
 * Detects repeated uncleaned boots and Lighthouse (extended operator absence >= 72h).
 */
export async function recordBootAttempt(now = Date.now()) {
  const meta = await readPhoenixMeta();
  const consecutive = meta.bootInFlight
    ? Math.min(10, (meta.consecutiveCrashes || 0) + 1)
    : (meta.consecutiveCrashes || 0);
  const safeMode = consecutive >= MAX_CONSECUTIVE_CRASHES;
  const hoursSinceOperator = Math.max(0, (now - (meta.lastOperatorAt || now)) / 3_600_000);
  const lighthouseMode = hoursSinceOperator >= LIGHTHOUSE_THRESHOLD_HOURS;

  const next = {
    ...meta,
    bootInFlight: true,
    consecutiveCrashes: consecutive,
    safeMode,
    lastBootAt: now,
  };
  await db.setSetting(META_KEY, next).catch(() => {});
  return {
    ...next,
    lighthouseMode,
    hoursSinceOperator: Math.round(hoursSinceOperator * 10) / 10,
  };
}

export async function markBootHealthy(now = Date.now()) {
  const meta = await readPhoenixMeta();
  const next = {
    ...meta,
    bootInFlight: false,
    consecutiveCrashes: 0,
    safeMode: false,
    lastHealthyBootAt: now,
    lastOperatorAt: now,
  };
  await db.setSetting(META_KEY, next).catch(() => {});
  return next;
}

export async function recordCrashIncident(message = 'Unknown runtime fault', now = Date.now()) {
  const meta = await readPhoenixMeta();
  const consecutive = Math.min(10, (meta.consecutiveCrashes || 0) + 1);
  const next = {
    ...meta,
    bootInFlight: false,
    consecutiveCrashes: consecutive,
    safeMode: consecutive >= MAX_CONSECUTIVE_CRASHES,
    lastCrashAt: now,
    lastCrashMessage: String(message || '').slice(0, 300),
  };
  await db.setSetting(META_KEY, next).catch(() => {});
  return next;
}

export async function touchOperatorPresence(now = Date.now()) {
  const meta = await readPhoenixMeta();
  const next = { ...meta, lastOperatorAt: now };
  await db.setSetting(META_KEY, next).catch(() => {});
  return next;
}

/**
 * Create a SHA-256 verified Soul Snapshot across chemistry, trust, learned dynamics,
 * active augmentations, and core engram IDs.
 */
export async function createSoulSnapshot(persona = 'aura', now = Date.now()) {
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
    engrams: Array.isArray(engrams) ? engrams.slice(0, 100) : [],
  };
  const checksum = await sha256Hex(stableStringify(payload));
  const bundle = { payload, checksum };
  await db.setSetting(SNAPSHOT_KEY(p), bundle).catch(() => {});
  return { ok: true, persona: p, checksum, engramCount: payload.engrams.length, capturedAt: now };
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

export async function restoreSoulSnapshot(persona = 'aura') {
  const p = String(persona || 'aura').toLowerCase();
  const saved = await db.getSetting(SNAPSHOT_KEY(p), null).catch(() => null);
  if (!saved?.payload || !saved?.checksum) {
    throw new Error('No saved Phoenix Soul Snapshot available.');
  }
  const actual = await sha256Hex(stableStringify(saved.payload));
  if (actual !== saved.checksum) {
    throw new Error('Phoenix Soul Snapshot checksum mismatch — refusing corrupted restore.');
  }
  const { core, trust, dynamics, augmentations, engrams } = saved.payload;
  await Promise.all([
    core ? db.setSetting(`aura_core:${p}`, core) : Promise.resolve(),
    trust ? db.setSetting(`aura_core:trust:${p}`, trust) : Promise.resolve(),
    dynamics ? db.setSetting(`aura_core:dynamics:${p}`, dynamics) : Promise.resolve(),
    augmentations ? db.setSetting('aura_core:augmentations', augmentations) : Promise.resolve(),
    Array.isArray(engrams) ? db.setSetting(`aura_core:engrams:${p}`, engrams) : Promise.resolve(),
  ]);
  return { restored: true, persona: p, checksum: saved.checksum, engramCount: engrams?.length || 0 };
}

export default {
  MAX_CONSECUTIVE_CRASHES,
  LIGHTHOUSE_THRESHOLD_HOURS,
  sha256Hex,
  readPhoenixMeta,
  recordBootAttempt,
  markBootHealthy,
  recordCrashIncident,
  touchOperatorPresence,
  createSoulSnapshot,
  verifySoulSnapshot,
  restoreSoulSnapshot,
};

