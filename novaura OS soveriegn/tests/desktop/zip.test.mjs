// ZIP service: round trips, safety, corruption, and interop with Python's zipfile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildZip, compressZip, readZip, safeEntryPath, crc32 } from '../../src/services/zipService.js';

const text = (bytes) => new TextDecoder().decode(bytes);
const big = 'const answer = 42;\n'.repeat(400);
// Pseudo-random bytes: incompressible, so they should be stored rather than deflated.
let seed = 12345;
const binary = Uint8Array.from({ length: 300 }, () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24);

function python() {
  for (const cmd of ['python', 'python3']) {
    try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); return cmd; } catch { /* try next */ }
  }
  return null;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('compressZip → readZip round-trips text, binary and folders, and actually compresses', async () => {
  const zip = await compressZip([
    { path: 'site', dir: true },
    { path: 'site/index.js', content: big },
    { path: 'site/logo.bin', bytes: binary },
    { path: 'site/empty.txt', content: '' },
  ]);
  assert.ok(zip.length < big.length / 4, `expected deflate to shrink the archive (got ${zip.length} bytes)`);
  const entries = await readZip(zip);
  assert.deepEqual(entries.map(e => [e.path, e.dir]), [['site', true], ['site/index.js', false], ['site/logo.bin', false], ['site/empty.txt', false]]);
  assert.equal(text(entries[1].bytes), big);
  assert.deepEqual(entries[2].bytes, binary);
  assert.equal(entries[3].bytes.length, 0);
});

test('stored zips from buildZip read back', async () => {
  const entries = await readZip(buildZip([{ path: '/a/b.txt', content: 'hello' }]));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, 'a/b.txt');
  assert.equal(text(entries[0].bytes), 'hello');
});

test('paths that climb out of the archive are dropped', async () => {
  assert.equal(safeEntryPath('../evil.txt'), '');
  assert.equal(safeEntryPath('a/../../evil.txt'), '');
  assert.equal(safeEntryPath('\\win\\style\\path.txt'), 'win/style/path.txt');
  const zip = buildZip([{ path: 'ok.txt', content: 'fine' }]);
  // Hand-craft an entry named "../x" by patching a stored zip's name bytes.
  const evil = buildZip([{ path: 'zz/x', content: 'nope' }]);
  const s = new TextDecoder('latin1').decode(evil).replaceAll('zz/x', '../x');
  const patched = Uint8Array.from(s, c => c.charCodeAt(0));
  assert.deepEqual((await readZip(patched)).map(e => e.path), []);
  assert.equal((await readZip(zip))[0].path, 'ok.txt');
});

test('corrupted data and non-zips are rejected with a clear error', async () => {
  const zip = buildZip([{ path: 'a.txt', content: 'abcdef' }]);
  const broken = zip.slice();
  broken[30 + 'a.txt'.length] ^= 0xff; // flip the first data byte
  await assert.rejects(readZip(broken), /checksum/);
  await assert.rejects(readZip(new TextEncoder().encode('definitely not a zip file at all')), /Not a ZIP/);
});

test('interop: Python opens our archive, and we open Python’s deflated archive', async (t) => {
  const py = python();
  if (!py) { t.skip('python not available'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'nova-zip-'));
  try {
    const ours = join(dir, 'ours.zip');
    writeFileSync(ours, await compressZip([{ path: 'docs/readme.md', content: big }, { path: 'docs/img.bin', bytes: binary }]));
    const listed = execFileSync(py, ['-I', '-c', [
      'import sys, zipfile',
      'z = zipfile.ZipFile(sys.argv[1])',
      'assert z.testzip() is None',
      'print(",".join(i.filename + ":" + str(i.compress_type) for i in z.infolist()))',
    ].join('\n'), ours]).toString().trim();
    assert.equal(listed, 'docs/readme.md:8,docs/img.bin:0');

    const theirs = join(dir, 'theirs.zip');
    execFileSync(py, ['-I', '-c', [
      'import sys, zipfile',
      'with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:',
      '    z.writestr("notes/a.txt", "x" * 5000)',
      '    z.writestr("notes/sub/", "")',
    ].join('\n'), theirs]);
    const entries = await readZip(readFileSync(theirs));
    assert.deepEqual(entries.map(e => e.path), ['notes/a.txt', 'notes/sub']);
    assert.equal(text(entries[0].bytes), 'x'.repeat(5000));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
