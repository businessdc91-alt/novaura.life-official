// manifest.js — The `novapp.json` manifest every addition carries (format novapp/1).
// validateManifest checks one and returns a cleaned copy; localManifest makes the
// manifest for an app built on this computer (Cybeni or the Forge), which asks for
// no permissions and no network.

import { cleanNetworkOrigin } from './network.js';

export const FORMAT = 'novapp/1';
export const API_VERSION = 1;
/** Everything an addition can be granted in API v1 (storage and ui need no permission). */
export const PERMISSIONS = ['ai', 'notifications', 'files'];
export const SOURCE_KINDS = ['cybeni', 'forge', 'file'];

const ID = /^[a-z0-9]{1,64}\.[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** A plain relative file path inside the bundle: no `..`, no backslashes, not absolute. */
export function safeBundlePath(path) {
  if (typeof path !== 'string' || !path || path.length > 300) return false;
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[a-z]+:/i.test(path)) return false;
  return path.split('/').every((seg) => seg && seg !== '.' && seg !== '..');
}

/** { ok, manifest?, errors } — manifest is a cleaned copy (origins lowercased, duplicates gone). */
export function validateManifest(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['The manifest is not an object.'] };
  const m = {};

  if (raw.format !== FORMAT) errors.push(`format must be "${FORMAT}"`);
  m.format = FORMAT;

  if (typeof raw.id !== 'string' || !ID.test(raw.id)) errors.push('id must look like "<publisher>.<slug>" in lowercase letters, digits and dashes');
  m.id = raw.id;

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name || name.length > 80) errors.push('name must be 1 to 80 characters');
  m.name = name;

  if (typeof raw.version !== 'string' || !SEMVER.test(raw.version)) errors.push('version must be semver, like 1.2.0');
  m.version = raw.version;

  if (raw.apiVersion !== API_VERSION) errors.push(`apiVersion must be ${API_VERSION}`);
  m.apiVersion = API_VERSION;

  if (!safeBundlePath(raw.entry)) errors.push('entry must be a plain relative path, like index.html');
  m.entry = raw.entry;

  if (raw.icon != null && !safeBundlePath(raw.icon)) errors.push('icon must be a plain relative path');
  if (raw.icon != null) m.icon = raw.icon;

  if (raw.description != null && (typeof raw.description !== 'string' || raw.description.length > 2000)) errors.push('description must be text, at most 2000 characters');
  m.description = typeof raw.description === 'string' ? raw.description : '';

  const permissions = raw.permissions ?? [];
  if (!Array.isArray(permissions)) errors.push('permissions must be a list');
  m.permissions = [];
  for (const p of Array.isArray(permissions) ? permissions : []) {
    if (!PERMISSIONS.includes(p)) errors.push(`unknown permission: ${p}`);
    else if (!m.permissions.includes(p)) m.permissions.push(p);
  }

  const network = raw.network ?? [];
  if (!Array.isArray(network)) errors.push('network must be a list');
  m.network = [];
  for (const o of Array.isArray(network) ? network : []) {
    const clean = cleanNetworkOrigin(o);
    if (!clean) errors.push(`network origin not allowed: ${o} (only https:// or wss:// names, never local addresses)`);
    else if (!m.network.includes(clean)) m.network.push(clean);
  }

  if (raw.publisher === null || raw.publisher === undefined) m.publisher = null;
  else if (typeof raw.publisher !== 'object' || typeof raw.publisher.name !== 'string' || !HEX64.test(raw.publisher.pub || '')) {
    errors.push('publisher must be null or { name, pub } with a 64-character hex key');
  } else m.publisher = { name: raw.publisher.name.slice(0, 80), pub: raw.publisher.pub };

  if (raw.source != null) {
    if (typeof raw.source !== 'object' || !SOURCE_KINDS.includes(raw.source.kind)) errors.push(`source.kind must be one of ${SOURCE_KINDS.join(', ')}`);
    else m.source = { kind: raw.source.kind, url: String(raw.source.url || ''), license: String(raw.source.license || '') };
  }

  const files = raw.files ?? {};
  if (!files || typeof files !== 'object' || Array.isArray(files)) errors.push('files must map paths to sha256 hashes');
  m.files = {};
  for (const [path, hash] of Object.entries(files && typeof files === 'object' ? files : {})) {
    if (!safeBundlePath(path)) errors.push(`file path not allowed: ${path}`);
    else if (!HEX64.test(hash)) errors.push(`file hash must be sha256 hex: ${path}`);
    else m.files[path] = hash;
  }

  return errors.length ? { ok: false, errors } : { ok: true, manifest: m, errors };
}

/** The manifest for an app made on this computer: no permissions, no network, no publisher. */
export function localManifest({ slug, name, kind = 'cybeni', permissions = [], network = [] }) {
  return {
    format: FORMAT,
    id: `local.${slug}`,
    name: String(name || slug).trim().slice(0, 80) || slug,
    version: '1.0.0',
    apiVersion: API_VERSION,
    entry: 'index.html',
    description: '',
    permissions: [...permissions],
    network: [...network],
    publisher: null,
    source: { kind: SOURCE_KINDS.includes(kind) ? kind : 'cybeni', url: '', license: '' },
    files: {},
  };
}
