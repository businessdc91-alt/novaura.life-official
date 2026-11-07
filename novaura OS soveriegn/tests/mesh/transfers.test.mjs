// File transfers between nodes: piece keys, encryption, offers, acknowledgements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import {
  CHUNK_BYTES, WINDOW, newTransferId, isTransferId, chunkCount, chunkLength, chunkIv,
  deriveTransferKey, encryptChunk, decryptChunk, admitOffer, cleanMeta, advance, nextToSend,
} from '../../src/services/meshTransferProtocol.js';
import { packetBatches } from '../../src/services/meshSocial.js';
import { MESH_PAYLOAD_BYTES, formatBytes } from '../../src/config/meshLimits.js';

const identity = () => {
  const secret = ed25519.utils.randomSecretKey();
  return { secret, pub: ed25519.getPublicKey(secret) };
};
const shared = (mine, theirPub) => x25519.getSharedSecret(ed25519.utils.toMontgomerySecret(mine.secret), ed25519.utils.toMontgomery(theirPub));

test('both nodes derive the same piece key, and no one else does', async () => {
  const alice = identity();
  const bob = identity();
  const eve = identity();
  const id = newTransferId();
  const salt = '00112233445566778899aabbccddeeff';
  const kA = await deriveTransferKey(shared(alice, bob.pub), salt, id);
  const kB = await deriveTransferKey(shared(bob, alice.pub), salt, id);
  const kE = await deriveTransferKey(shared(eve, alice.pub), salt, id);
  const plain = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
  const cipher = await encryptChunk(kA, id, 3, plain);
  assert.deepEqual(await decryptChunk(kB, id, 3, cipher), plain);
  await assert.rejects(decryptChunk(kE, id, 3, cipher), 'a third identity cannot read it');
  await assert.rejects(decryptChunk(kB, id, 4, cipher), 'a piece moved to another position fails');
  await assert.rejects(decryptChunk(kB, newTransferId(), 3, cipher), 'a piece replayed into another transfer fails');
  cipher[100] ^= 1;
  await assert.rejects(decryptChunk(kB, id, 3, cipher), 'an altered piece fails');
  const otherSalt = await deriveTransferKey(shared(bob, alice.pub), 'ffeeddccbbaa99887766554433221100', id);
  await assert.rejects(decryptChunk(otherSalt, id, 3, await encryptChunk(kA, id, 3, plain)));
});

test('pieces cover the file exactly, with a nonce per position', () => {
  assert.equal(chunkCount(0), 0);
  assert.equal(chunkCount(1), 1);
  assert.equal(chunkCount(CHUNK_BYTES), 1);
  assert.equal(chunkCount(CHUNK_BYTES + 1), 2);
  const fiveGb = 5 * 1024 ** 3 + 123;
  const n = chunkCount(fiveGb);
  assert.equal(n, 1281);
  assert.equal(chunkLength(n - 1, fiveGb), 123);
  assert.equal(chunkLength(0, fiveGb), CHUNK_BYTES);
  let total = 0;
  for (let i = 0; i < n; i++) total += chunkLength(i, fiveGb);
  assert.equal(total, fiveGb);
  assert.deepEqual([...chunkIv(1)], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual([...chunkIv(258)].slice(10), [1, 2]);
  assert.ok(isTransferId(newTransferId()));
  assert.equal(isTransferId('xf_../../x'), false);
});

test('an offer is checked before anyone sees it', () => {
  const good = { id: newTransferId(), size: 9_000_000_000, chunkBytes: CHUNK_BYTES, chunks: chunkCount(9_000_000_000), salt: 'a'.repeat(32), replyTo: 'NODE-AB12', name: 'game-project.zip', mime: 'application/zip' };
  const offer = admitOffer(good);
  assert.equal(offer.size, 9_000_000_000);
  assert.equal(offer.name, 'game-project.zip');
  assert.equal(admitOffer({ ...good, chunks: 3 }), null, 'piece count must match the size');
  assert.equal(admitOffer({ ...good, size: -1 }), null);
  assert.equal(admitOffer({ ...good, size: 2 ** 60 }), null);
  assert.equal(admitOffer({ ...good, chunkBytes: 1024 }), null);
  assert.equal(admitOffer({ ...good, salt: 'zz' }), null);
  assert.equal(admitOffer({ ...good, replyTo: '' }), null);
  assert.equal(admitOffer({ ...good, id: 'file_1' }), null);
  const sealed = admitOffer({ ...good, name: undefined, sealedMeta: { iv: 'ab'.repeat(12), ciphertext: 'cd'.repeat(40) } });
  assert.ok(sealed.sealedMeta && !('name' in sealed));
  assert.equal(admitOffer({ ...good, sealedMeta: { iv: 'xyz', ciphertext: '00' } }), null);
  assert.deepEqual(cleanMeta({ name: 'a\u0000b.txt', mime: 'text/html; charset=x' }), { name: 'ab.txt', mime: 'application/octet-stream' });
  assert.equal(cleanMeta({}).name, 'received-file');
});

test('acknowledgements only move past pieces that are all on disk', () => {
  const pending = new Set();
  let next = 0;
  next = advance(next, pending, 1);
  next = advance(next, pending, 2);
  assert.equal(next, 0, 'piece 0 is still missing');
  next = advance(next, pending, 0);
  assert.equal(next, 3);
  assert.equal(pending.size, 0);
  assert.equal(advance(next, pending, 1), 3, 'a duplicate changes nothing');
  assert.equal(nextToSend({ sendNext: 0, acked: 0, chunks: 10 }), 0);
  assert.equal(nextToSend({ sendNext: WINDOW, acked: 0, chunks: 10 }), -1, 'window full');
  assert.equal(nextToSend({ sendNext: 7, acked: 5, chunks: 10 }), 7);
  assert.equal(nextToSend({ sendNext: 2, acked: 5, chunks: 10 }), 5, 'after a go-back, never below the ack');
  assert.equal(nextToSend({ sendNext: 10, acked: 9, chunks: 10 }), -1);
});

test('packets carry megabytes now, and a feed sync answer has a total budget', () => {
  assert.ok(MESH_PAYLOAD_BYTES > 15 * 1024 * 1024);
  const items = Array.from({ length: 10 }, (_, i) => ({ i, x: 'y'.repeat(1_000_000) }));
  const all = packetBatches(items, 4_100_000);
  assert.equal(all.flat().length, 10);
  assert.ok(all.every(b => JSON.stringify(b).length <= 4_100_000 + b.length));
  const capped = packetBatches(items, 4_100_000, 3_500_000);
  assert.equal(capped.flat().length, 3);
  assert.equal(formatBytes(5 * 1024 ** 3), '5.0 GB');
  assert.equal(formatBytes(15.5 * 1024 * 1024), '16 MB');
  assert.equal(formatBytes(2048), '2 KB');
});
