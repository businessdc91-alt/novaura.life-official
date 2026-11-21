// sanitizationCert.js — picks the NIST SP 800-88 method for a device's media and builds a
// tamper-evident sanitization certificate. The cert carries a sha256 of its own canonical body,
// so any later change to a field (method, authorization, serial…) is detectable. These certs are
// what make a wiped device resale-ready and on-record.

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const enc = (s) => new TextEncoder().encode(s);

/** Deterministic JSON with recursively sorted keys. */
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

/** NIST 800-88: flash/SSD media is Purged; magnetic or unknown media is Cleared. */
export function sanitizationMethodFor(device) {
  const storage = String(device?.specs?.storage || '').toLowerCase();
  return /ssd|nvme|flash|emmc|solid[\s-]?state/.test(storage) ? 'purge' : 'clear';
}

/** The hex sha256 of a cert body, excluding any `hash` field. */
export function certHash(body) {
  const { hash, ...rest } = body; // eslint-disable-line no-unused-vars
  return bytesToHex(sha256(enc(stableStringify(rest))));
}

/**
 * buildCert({ job, device, provenance, method, startedAt, finishedAt, operator, now }) -> cert
 * cert: { id, jobId, device:{serial,model,kind}, method, startedAt, finishedAt, operator,
 *         authorization, standard, createdAt, hash }.
 */
export function buildCert({ job, device, provenance, method, startedAt, finishedAt, operator, now = Date.now }) {
  const t = now();
  const body = {
    id: `cert_${t}_${Math.random().toString(36).slice(2, 8)}`,
    jobId: job.id,
    device: { serial: device.serial ?? null, model: device.model ?? null, kind: device.kind ?? null },
    method,
    startedAt,
    finishedAt,
    operator,
    authorization: provenance?.authorization ?? null,
    standard: 'NIST SP 800-88 Rev.1',
    createdAt: t,
  };
  return { ...body, hash: certHash(body) };
}
