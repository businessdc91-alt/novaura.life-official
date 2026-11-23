// recoveryPanel.js — the pure view model behind Aunlock's recovery view: drive health, the volume
// list (and why a volume can't be recovered), a folder listing, the staged-results list, and the
// outcome of a recovery run. No I/O — the window renders what these return.
//
// Whether a volume is recoverable is decided ONCE, by volumeRules.isRecoverableVolume (the same
// deny-by-default rule the controller enforces); this file only explains the answer.

import { isRecoverableVolume } from './volumeRules.js';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** Bytes as a short binary-unit label ("1.5 KB"), or null for anything that isn't a size. */
export function humanSize(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${UNITS[i]}`;
}

const sizeOf = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0);

const HEALTH_LABEL = {
  ok: 'Healthy',
  warn: 'Warning — consider imaging before recovery',
  fail: 'Failing — image this drive first',
  unknown: 'Health unknown',
};

/**
 * describeHealth(health) -> { label, tone }
 * tone ∈ ok|warn|fail|unknown. A failing drive's label tells the operator to image it first.
 */
export function describeHealth(health) {
  const tone = ['ok', 'warn', 'fail'].includes(health?.status) ? health.status : 'unknown';
  const parts = [HEALTH_LABEL[tone]];
  if (Number.isFinite(health?.temperatureC)) parts.push(`${health.temperatureC}°C`);
  if (Number.isFinite(health?.powerOnHours)) parts.push(`${health.powerOnHours} h`);
  if (Number.isFinite(health?.wearPct)) parts.push(`wear ${health.wearPct}%`);
  return { label: parts.join(' · '), tone };
}

/** Why a volume was refused — encrypted, unknown encryption state, or an unreadable filesystem. */
function refusalReason(v) {
  if (v.encrypted === true) {
    return 'Encrypted (BitLocker) — Aunlock never recovers encrypted volumes. Reclaim the device instead.';
  }
  if (v.encrypted !== false) {
    return 'Encryption status unknown — refused until it can be verified. Reclaim the device instead.';
  }
  return 'Unreadable or unsupported filesystem — reclaim the device instead.';
}

/**
 * describeVolumes(volumes) -> { rows }
 * row: { driveLetter, label, sub, recoverable, reason } — reason is null for a recoverable volume,
 * otherwise the refusal explanation.
 */
export function describeVolumes(volumes) {
  const rows = (Array.isArray(volumes) ? volumes : []).map((raw) => {
    const v = raw ?? {};
    const recoverable = isRecoverableVolume(v);
    const letter = String(v.driveLetter ?? '').trim();
    return {
      driveLetter: letter || null,
      label: [letter ? `${letter}:` : '(no letter)', v.label].filter(Boolean).join(' '),
      sub: [v.fsType || 'unknown filesystem', humanSize(v.sizeBytes)].filter(Boolean).join(' · '),
      recoverable,
      reason: recoverable ? null : refusalReason(v),
    };
  });
  return { rows };
}

/**
 * describeDirEntries(entries) -> { rows }
 * Folders first, then files, each sorted by name (case-insensitive).
 * row: { name, isDir, size, humanSize } — folders carry no size.
 */
export function describeDirEntries(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e.name === 'string');
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const dirs = list.filter((e) => e.isDir).sort(byName);
  const files = list.filter((e) => !e.isDir).sort(byName);
  return {
    rows: [...dirs, ...files].map((e) => ({
      name: e.name,
      isDir: Boolean(e.isDir),
      size: e.isDir ? null : (e.size ?? null),
      humanSize: e.isDir ? null : humanSize(e.size),
    })),
  };
}

/**
 * describeStaged(recovered) -> { rows, totalBytes, totalLabel }
 * The staged-results list (recovered catalog rows — metadata only, never contents).
 */
export function describeStaged(recovered) {
  let totalBytes = 0;
  const rows = (Array.isArray(recovered) ? recovered : []).map((raw) => {
    const r = raw ?? {};
    totalBytes += sizeOf(r.size);
    return {
      path: r.path ?? '',
      size: r.size ?? null,
      humanSize: humanSize(r.size),
      stagedRef: r.stagedRef ?? null,
      checksum: r.checksum ?? null,
    };
  });
  return { rows, totalBytes, totalLabel: humanSize(totalBytes) };
}

/**
 * describeOutcome(result) -> { tone, label, skipped }
 * result: the controller's recover() return. ok+complete ⇒ 'ok'; ok but partial ⇒ 'warn' with the
 * skip list and why it stopped; refused/failed ⇒ 'fail' with the reason.
 */
export function describeOutcome(result) {
  if (!result || result.ok !== true) {
    return { tone: 'fail', label: result?.reason || 'Recovery did not run.', skipped: [] };
  }
  const files = Array.isArray(result.manifest) ? result.manifest : [];
  const skipped = (Array.isArray(result.skipped) ? result.skipped : []).map((s) => ({
    path: String(s?.path ?? ''),
    reason: String(s?.reason ?? ''),
  }));
  const bytes = files.reduce((n, f) => n + sizeOf(f?.size), 0);
  const count = `${files.length} file${files.length === 1 ? '' : 's'}`;
  if (result.complete === true && skipped.length === 0) {
    return { tone: 'ok', label: `Recovered ${count} (${humanSize(bytes)})`, skipped };
  }
  const parts = [`Partial recovery: ${count} (${humanSize(bytes)})`, `${skipped.length} skipped`];
  if (result.stopReason) parts.push(`stopped — ${result.stopReason}`);
  return { tone: 'warn', label: parts.join(' · '), skipped };
}
