// panelModel.js — What Settings → Additions shows for one addition, in plain words.

import { DEFAULT_QUOTA_BYTES } from './limits.js';
import { PERMISSIONS } from './manifest.js';

export const PERMISSION_LABELS = {
  ai: 'Use your AI model on this computer',
  notifications: 'Send you notifications',
  files: 'Open and save files you choose',
};

/** Notes kept as codes on the registry entry (migrate.js), worded here. */
export const LEGACY_NOTE_TEXT = {
  'browser-database': "This app used a browser database, which additions can't keep. Its saved data there was not moved.",
};

export const QUOTA_CHOICES = [1, 2, 5, 10, 50].map((g) => g * 1024 ** 3);

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 1536 → "1.5 KB"; one decimal below 10 of a unit, none above. */
export function formatBytes(n) {
  let v = Math.max(0, Number(n) || 0);
  let u = 0;
  while (v >= 1024 && u < UNITS.length - 1) { v /= 1024; u++; }
  if (u === 0) return `${Math.round(v)} B`;
  const text = v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString();
  return `${text} ${UNITS[u]}`;
}

export function describeAddition(addition, usageBytes) {
  const m = addition.manifest || {};
  const granted = new Set(addition.grants?.permissions || []);
  const grantedNet = new Set(addition.grants?.network || []);
  const declared = new Set(m.network || []);
  const origins = [...new Set([...(m.network || []), ...(addition.requested?.network || [])])];
  const quotaBytes = Number(addition.quotaBytes) > 0 ? Number(addition.quotaBytes) : DEFAULT_QUOTA_BYTES;
  return {
    id: addition.id,
    title: addition.name,
    version: m.version || '1.0.0',
    publisher: m.publisher?.name || 'Made on this computer',
    legacy: Boolean(addition.legacy),
    notes: (addition.legacyNotes || []).map((code) => LEGACY_NOTE_TEXT[code] || code),
    permissions: (m.permissions || [])
      .filter((p) => PERMISSIONS.includes(p))
      .map((id) => ({ id, label: PERMISSION_LABELS[id], granted: granted.has(id) })),
    network: origins.map((origin) => ({ origin, granted: grantedNet.has(origin), declared: declared.has(origin) })),
    usage: formatBytes(usageBytes),
    usageBytes: Number(usageBytes) || 0,
    quota: formatBytes(quotaBytes),
    quotaBytes,
  };
}
