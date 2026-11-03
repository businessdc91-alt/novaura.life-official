// .novabackup: archive round trip, passphrase, and tamper detection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packArchive, unpackArchive, encryptBackup, decryptBackup, readBackupHeader } from '../../src/services/backup/novaBackupFormat.js';

const SECRET = 'a3f1c0ffee5ec12e7b00b5cafe0000000000000000000000000000000000beef';
const FAST = { iterations: 100_000, chunkSize: 1024 }; // small chunks: many of them, quickly

function sampleTables() {
  const song = new Uint8Array(5000).map((_, i) => (i * 7) & 255);
  return {
    identities: [{ id: 'primary_operator', handle: 'dillan', secretKeyHex: SECRET, createdAt: new Date('2026-11-03T08:00:00Z') }],
    media_blobs: [{ id: 'audio_1', kind: 'audio', blob: new Blob([song], { type: 'audio/mpeg' }) }],
    documents: [
      { id: 'd1', name: 'notes.md', content: '# hi' },
      { id: 'd2', name: 'app.zip', content: new Uint8Array([80, 75, 3, 4]) },
      { id: 'd3', name: 'raw.bin', content: new Uint8Array([9, 8, 7]).buffer },
      { id: 'd4', name: 'pcm', content: new Int16Array([-2, 300]) },
    ],
  };
}

async function makeBackup(passphrase = 'correct horse battery') {
  const archive = packArchive({ tables: sampleTables(), localStorage: { 'novaura-theme': 'dark' } });
  return encryptBackup(archive, passphrase, { ...FAST, info: { node: 'dillan' } });
}

async function codeOf(promise) {
  try { await promise; return 'ok'; } catch (e) { return e.code || e.message; }
}

test('a backup round-trips rows, blobs, byte arrays, dates and settings', async () => {
  const file = await makeBackup();
  const { header, plain } = await decryptBackup(file, 'correct horse battery');
  assert.equal(header.node, 'dillan');
  const { tables, localStorage } = await unpackArchive(plain);
  assert.equal(tables.identities[0].secretKeyHex, SECRET);
  assert.ok(tables.identities[0].createdAt instanceof Date);
  assert.equal(tables.identities[0].createdAt.toISOString(), '2026-11-03T08:00:00.000Z');
  const blob = tables.media_blobs[0].blob;
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'audio/mpeg');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array(5000).map((_, i) => (i * 7) & 255));
  assert.equal(tables.documents[0].content, '# hi');
  assert.ok(tables.documents[1].content instanceof Uint8Array);
  assert.deepEqual([...tables.documents[1].content], [80, 75, 3, 4]);
  assert.ok(tables.documents[2].content instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(tables.documents[2].content)], [9, 8, 7]);
  assert.ok(tables.documents[3].content instanceof Int16Array);
  assert.deepEqual([...tables.documents[3].content], [-2, 300]);
  assert.deepEqual(localStorage, { 'novaura-theme': 'dark' });
});

test('nothing secret is readable in the file', async () => {
  const bytes = Buffer.from(await (await makeBackup()).arrayBuffer());
  assert.equal(bytes.includes(SECRET), false);
  assert.equal(bytes.includes('secretKeyHex'), false);
  assert.equal(bytes.includes('notes.md'), false);
});

test('a wrong passphrase is reported as such', async () => {
  assert.equal(await codeOf(decryptBackup(await makeBackup(), 'wrong passphrase!!')), 'PASSPHRASE');
});

test('cutting, editing or reordering chunks is detected', async () => {
  const bytes = new Uint8Array(await (await makeBackup()).arrayBuffer());
  const { dataStart } = await readBackupHeader(new Blob([bytes]));
  // Walk the chunk table.
  const chunks = [];
  for (let at = dataStart; at < bytes.length;) {
    const len = new DataView(bytes.buffer, at, 4).getUint32(0);
    chunks.push([at, at + 4 + len]);
    at += 4 + len;
  }
  assert.ok(chunks.length > 4, `expected several chunks, got ${chunks.length}`);
  const pass = 'correct horse battery';

  const cut = bytes.slice(0, chunks.at(-1)[0]); // drop the last chunk
  assert.equal(await codeOf(decryptBackup(new Blob([cut]), pass)), 'CORRUPT');

  const flipped = bytes.slice();
  flipped[chunks[2][0] + 20] ^= 1;
  assert.equal(await codeOf(decryptBackup(new Blob([flipped]), pass)), 'CORRUPT');

  const swapped = new Blob([bytes.slice(0, chunks[1][0]), bytes.slice(...chunks[2]), bytes.slice(...chunks[1]), bytes.slice(chunks[2][1])]);
  assert.equal(await codeOf(decryptBackup(swapped, pass)), 'CORRUPT');

  // The header (salt, nonce, info) is bound to every chunk too.
  const relabeled = Buffer.from(bytes);
  const at = relabeled.subarray(0, dataStart).indexOf('"node":"dillan"');
  assert.ok(at > 0);
  relabeled.write('"node":"mallet"', at, 'latin1');
  assert.equal(await codeOf(decryptBackup(new Blob([relabeled]), pass)), 'PASSPHRASE');
});

test('other files and hostile headers are refused before any work', async () => {
  assert.equal(await codeOf(readBackupHeader(new Blob(['{"version":1}']))), 'NOT_BACKUP');
  const header = new TextEncoder().encode(JSON.stringify({ v: 1, cipher: 'AES-256-GCM', kdf: { name: 'PBKDF2', iterations: 2_000_000_000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }, nonce: 'AAAAAAAAAAA=', chunkSize: 4096 }));
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, header.length);
  assert.equal(await codeOf(readBackupHeader(new Blob([new TextEncoder().encode('NOVABAK1'), len, header]))), 'CORRUPT');
  assert.equal(await codeOf(encryptBackup(new Blob(['x']), '')), 'PASSPHRASE');
});
