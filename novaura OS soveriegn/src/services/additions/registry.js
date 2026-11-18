// registry.js — The installed additions, kept in the `user_apps` setting (the same
// list the launcher reads). An addition's id is its user_apps id, `user_<slug>`.
// Entries saved before additions existed have no manifest until they are moved over
// (migrate.js). Only the person grants permissions and network origins, and only
// ones the manifest declares or the app was seen trying to reach.

import { db } from '../../database/sovereignDatabase.js';
import { getAdditionData } from './dataStore.js';
import { cleanNetworkOrigin } from './network.js';
import { PERMISSIONS, localManifest } from './manifest.js';
import { DEFAULT_QUOTA_BYTES } from './limits.js';

const KEY = 'user_apps';
const MAX_REQUESTED_ORIGINS = 32;
const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function normalize(a) {
  return {
    ...a,
    id: a.id,
    slug: a.slug,
    name: a.name,
    color: a.color,
    iconBlobId: a.iconBlobId ?? null,
    addedAt: a.addedAt,
    manifest: a.manifest ?? null,
    grants: { permissions: list(a.grants?.permissions), network: list(a.grants?.network) },
    requested: { network: list(a.requested?.network) },
    legacy: a.legacy === true,
    legacyNotes: list(a.legacyNotes),
    quotaBytes: Number(a.quotaBytes) > 0 ? Number(a.quotaBytes) : DEFAULT_QUOTA_BYTES,
  };
}

function announce(appId) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('novaura:user_apps_changed'));
  window.dispatchEvent(new CustomEvent('novaura:addition_changed', { detail: appId }));
}

// Every change is a read-modify-write of one setting, so changes run one at a time.
let tail = Promise.resolve();
function change(fn) {
  const run = tail.then(fn, fn);
  tail = run.catch(() => {});
  return run;
}

async function readAll() {
  const apps = await db.getSetting(KEY, []).catch(() => []);
  return Array.isArray(apps) ? apps : [];
}

/** Apply `edit(entry) -> entry | null` to one entry (null removes it); returns the normalized result. */
function editEntry(appId, edit) {
  return change(async () => {
    const apps = await readAll();
    const i = apps.findIndex((a) => a.id === appId);
    if (i < 0) throw new Error(`No addition ${appId}`);
    const next = edit(normalize(apps[i]));
    const out = next ? [...apps.slice(0, i), next, ...apps.slice(i + 1)] : [...apps.slice(0, i), ...apps.slice(i + 1)];
    await db.setSetting(KEY, out);
    announce(appId);
    return next ? normalize(next) : null;
  });
}

export async function listAdditions() {
  return (await readAll()).map(normalize);
}

export async function getAddition(appId) {
  const found = (await readAll()).find((a) => a.id === appId);
  return found ? normalize(found) : null;
}

export function updateAddition(appId, patch) {
  return editEntry(appId, (a) => ({ ...a, ...patch }));
}

/** Grant only what the manifest declares, or (network) what the app was seen asking for. */
export function setGrants(appId, { permissions, network } = {}) {
  return editEntry(appId, (a) => {
    const grants = { ...a.grants };
    if (permissions) {
      const asked = list(a.manifest?.permissions);
      grants.permissions = PERMISSIONS.filter((p) => permissions.includes(p) && asked.includes(p));
    }
    if (network) {
      const asked = new Set([...list(a.manifest?.network), ...a.requested.network]);
      grants.network = [];
      for (const o of network) {
        const clean = cleanNetworkOrigin(o);
        if (clean && asked.has(clean) && !grants.network.includes(clean)) grants.network.push(clean);
      }
    }
    return { ...a, grants };
  });
}

/**
 * The app tried to reach `origin` and its CSP blocked it. Returns true when this is a
 * new origin it may be allowed (https/wss, never local), now listed for the person to
 * review; false for a local address, one already known, or an unknown addition.
 */
export async function noteBlockedOrigin(appId, origin) {
  const clean = cleanNetworkOrigin(origin);
  if (!clean) return false;
  return change(async () => {
    const apps = await readAll();
    const i = apps.findIndex((a) => a.id === appId);
    if (i < 0) return false;
    const a = normalize(apps[i]);
    if ([...list(a.manifest?.network), ...a.requested.network, ...a.grants.network].includes(clean)) return false;
    // An app can't bury the person in requests: at most this many are ever listed.
    if (a.requested.network.length >= MAX_REQUESTED_ORIGINS) return false;
    apps[i] = { ...a, requested: { network: [...a.requested.network, clean] } };
    await db.setSetting(KEY, apps);
    announce(appId);
    return true;
  });
}

export function setQuota(appId, bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 1024 ** 2) return Promise.reject(new Error('A quota must be at least 1 MB.'));
  return editEntry(appId, (a) => ({ ...a, quotaBytes: Math.floor(n) }));
}

export async function removeAddition(appId, { keepData = true } = {}) {
  await editEntry(appId, () => null);
  if (!keepData) await getAdditionData().clearApp(appId);
}

/**
 * Add (or update) an app made on this computer, as Cybeni and the Forge do. An existing
 * entry keeps what the person granted, what it asked for, its quota and its notes.
 */
export function upsertLocalAddition({ slug, name, color = '#7c3aed', iconBlobId = null, kind = 'cybeni' }) {
  return change(async () => {
    const apps = await readAll();
    const id = `user_${slug}`;
    const old = apps.find((a) => a.slug === slug || a.id === id);
    const base = old ? normalize(old) : { grants: { permissions: [], network: [] }, requested: { network: [] } };
    const entry = {
      ...base,
      id,
      slug,
      name: String(name || slug).slice(0, 40),
      color,
      iconBlobId,
      addedAt: Date.now(),
      manifest: localManifest({ slug, name, kind }),
    };
    await db.setSetting(KEY, [...apps.filter((a) => a.slug !== slug && a.id !== id), entry]);
    announce(id);
    return normalize(entry);
  });
}
