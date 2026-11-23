import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeHealth,
  describeVolumes,
  describeDirEntries,
  describeStaged,
  describeOutcome,
  humanSize,
  subpathOf,
  volumePath,
} from '../../src/services/aunlock/recoveryPanel.js';

const vol = (over = {}) => ({ driveLetter: 'E', fsType: 'NTFS', label: 'DATA', sizeBytes: 500e9, encrypted: false, readable: true, ...over });

test('describeHealth maps status to tone and builds a readable label', () => {
  const h = describeHealth({ status: 'ok', temperatureC: 34, powerOnHours: 1200, wearPct: 5 });
  assert.equal(h.tone, 'ok');
  assert.match(h.label, /Healthy/);
  assert.match(h.label, /34°C/);
  assert.match(h.label, /1200 h/);
  assert.match(h.label, /wear 5%/);
});

test('describeHealth: a failing drive says to image it first', () => {
  const h = describeHealth({ status: 'fail' });
  assert.equal(h.tone, 'fail');
  assert.match(h.label, /image/i);
});

test('describeHealth: warn, unknown status, and missing health', () => {
  assert.equal(describeHealth({ status: 'warn' }).tone, 'warn');
  assert.equal(describeHealth({ status: 'weird' }).tone, 'unknown');
  assert.equal(describeHealth(null).tone, 'unknown');
  assert.equal(describeHealth(undefined).tone, 'unknown');
});

test('describeVolumes: a clear NTFS volume is recoverable with no reason', () => {
  const [row] = describeVolumes([vol()]).rows;
  assert.equal(row.driveLetter, 'E');
  assert.equal(row.recoverable, true);
  assert.equal(row.reason, null);
  assert.match(row.label, /E:/);
  assert.match(row.sub, /NTFS/);
});

test('describeVolumes: an encrypted volume is not recoverable and carries a reclaim reason', () => {
  const [row] = describeVolumes([vol({ encrypted: true })]).rows;
  assert.equal(row.recoverable, false);
  assert.match(row.reason, /encrypted/i);
  assert.match(row.reason, /reclaim/i);
});

test('describeVolumes: unverifiable encryption is refused but NOT sent to reclaim (says run as administrator)', () => {
  // what the native side sends when BitLocker status can't be read: encrypted false, encryptionKnown false
  for (const v of [vol({ encrypted: false, readable: false, encryptionKnown: false }), vol({ encrypted: null })]) {
    const [row] = describeVolumes([v]).rows;
    assert.equal(row.recoverable, false);
    assert.match(row.reason, /could not be verified/i);
    assert.match(row.reason, /administrator/i);
    assert.doesNotMatch(row.reason, /reclaim/i);
  }
});

test('describeVolumes: RAW / unreadable volumes are refused with an unreadable reason', () => {
  const [raw] = describeVolumes([vol({ fsType: 'RAW', readable: false })]).rows;
  assert.equal(raw.recoverable, false);
  assert.match(raw.reason, /unreadable|unsupported/i);
});

test('describeVolumes tolerates a missing or non-array list', () => {
  assert.deepEqual(describeVolumes(undefined).rows, []);
  assert.deepEqual(describeVolumes(null).rows, []);
});

test('describeDirEntries puts folders first, then files, each sorted by name', () => {
  const { rows } = describeDirEntries([
    { name: 'b.txt', isDir: false, size: 2048 },
    { name: 'Zeta', isDir: true, size: 0 },
    { name: 'a.txt', isDir: false, size: 10 },
    { name: 'alpha', isDir: true, size: 0 },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['alpha', 'Zeta', 'a.txt', 'b.txt']);
  assert.equal(rows[0].humanSize, null);
  assert.equal(rows[3].humanSize, '2.0 KB');
});

test('describeDirEntries: links, online-only cloud files and EFS files carry their reason and cannot be selected', () => {
  const { rows } = describeDirEntries([
    { name: 'My Documents', isDir: false, size: 0, note: 'link (junction/symlink) — not followed' },
    { name: 'cloud.docx', isDir: false, size: 10, note: 'online-only cloud file — not downloaded' },
    { name: 'secret.txt', isDir: false, size: 5, note: 'file-based encryption (EFS) — not recovered' },
    { name: 'plain.txt', isDir: false, size: 5, note: null },
  ]);
  const by = (n) => rows.find((r) => r.name === n);
  assert.equal(by('plain.txt').selectable, true);
  assert.equal(by('plain.txt').note, null);
  for (const n of ['My Documents', 'cloud.docx', 'secret.txt']) {
    assert.equal(by(n).selectable, false);
    assert.ok(by(n).note);
  }
});

test('describeStaged lists rows and sums their sizes', () => {
  const r = describeStaged([
    { path: 'a', size: 1024, stagedRef: 'r1', checksum: 'c1' },
    { path: 'b', size: 2048, stagedRef: 'r2', checksum: 'c2' },
    { path: 'c', size: undefined, stagedRef: 'r3', checksum: 'c3' },
  ]);
  assert.equal(r.rows.length, 3);
  assert.equal(r.totalBytes, 3072);
  assert.equal(r.totalLabel, '3.0 KB');
  assert.equal(r.rows[0].humanSize, '1.0 KB');
});

test('describeOutcome: a complete recovery is ok-toned', () => {
  const o = describeOutcome({ ok: true, manifest: [{ size: 1024 }, { size: 1024 }], skipped: [], complete: true, stopReason: null });
  assert.equal(o.tone, 'ok');
  assert.match(o.label, /2 files/);
  assert.deepEqual(o.skipped, []);
});

test('describeOutcome: a partial recovery warns and lists what was skipped and why it stopped', () => {
  const o = describeOutcome({
    ok: true,
    manifest: [{ size: 10 }],
    skipped: [{ path: 'Users/sam/big.iso', reason: 'disk full' }],
    complete: false,
    stopReason: 'disk full',
  });
  assert.equal(o.tone, 'warn');
  assert.match(o.label, /1 file\b/);
  assert.match(o.label, /1 skipped/);
  assert.match(o.label, /disk full/);
  assert.deepEqual(o.skipped, [{ path: 'Users/sam/big.iso', reason: 'disk full' }]);
});

test('describeOutcome: links are listed as informational and do not make a complete run partial', () => {
  const o = describeOutcome({
    ok: true,
    manifest: [{ size: 1024 }],
    skipped: [],
    links: [{ path: 'E:\\Users\\sam\\My Documents', reason: 'link (junction/symlink) — not followed' }],
    complete: true,
    stopReason: null,
  });
  assert.equal(o.tone, 'ok');
  assert.match(o.label, /1 link not followed/);
  assert.equal(o.links.length, 1);
});

test('describeOutcome: a run that recovered nothing is not shown as a success', () => {
  const o = describeOutcome({ ok: true, manifest: [], skipped: [], links: [], complete: true, stopReason: null });
  assert.equal(o.tone, 'warn');
  assert.match(o.label, /Nothing was recovered/);
});

test('describeOutcome: a refused or failed recovery is fail-toned with its reason', () => {
  const o = describeOutcome({ ok: false, reason: 'No recoverable volume was found — reclaim the device instead.' });
  assert.equal(o.tone, 'fail');
  assert.match(o.label, /reclaim/);
  assert.equal(describeOutcome(null).tone, 'fail');
});

test('subpathOf builds the volume-relative folder path list_dir expects', () => {
  assert.equal(subpathOf([]), '');
  assert.equal(subpathOf(['Users', 'sam']), 'Users\\sam');
  assert.equal(subpathOf(undefined), '');
});

test('subpathOf drops empty, dot and dot-dot segments so a path can never climb out', () => {
  assert.equal(subpathOf(['Users', '..', '.', '', 'sam']), 'Users\\sam');
  assert.equal(subpathOf(['a\\b', 'c/d']), '');
});

test('volumePath builds the absolute drive-prefixed path recover_files expects', () => {
  assert.equal(volumePath('e', ['Users', 'sam', 'Documents']), 'E:\\Users\\sam\\Documents');
  assert.equal(volumePath('F:', ['a.txt']), 'F:\\a.txt');
  assert.equal(volumePath('E', ['..', 'Windows']), 'E:\\Windows');
});

test('volumePath refuses a missing or malformed drive letter', () => {
  assert.equal(volumePath('', ['a']), null);
  assert.equal(volumePath('EF', ['a']), null);
  assert.equal(volumePath('1', ['a']), null);
  assert.equal(volumePath(undefined, ['a']), null);
});

test('humanSize formats binary units and rejects junk', () => {
  assert.equal(humanSize(0), '0 B');
  assert.equal(humanSize(512), '512 B');
  assert.equal(humanSize(1536), '1.5 KB');
  assert.equal(humanSize(5 * 1024 ** 3), '5.0 GB');
  assert.equal(humanSize(-1), null);
  assert.equal(humanSize(NaN), null);
  assert.equal(humanSize(undefined), null);
});
