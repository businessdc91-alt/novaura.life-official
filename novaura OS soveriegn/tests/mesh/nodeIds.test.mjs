// Node IDs come from identity keys; the native mesh (mesh.rs) and the relay
// compute the same ID, which relay/src/main.rs pins to the same vector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519.js';
import { meshNodeIdFor, meshNodeIdForPub, isMeshNodeId } from '../../src/services/meshNodeIds.js';

const pub = Buffer.from(ed25519.getPublicKey(new Uint8Array(32).fill(7))).toString('hex');

test('a node ID is derived from the public key, the same as on the native side', () => {
  assert.equal(meshNodeIdForPub(pub), 'NODE-FE812C12F3AB4CE6AC5DB69AC352F906');
  assert.equal(meshNodeIdForPub('0x' + pub.toUpperCase()), 'NODE-FE812C12F3AB4CE6AC5DB69AC352F906');
});

test('DIDs, keys and node IDs all resolve to a node; anything else does not', () => {
  const id = meshNodeIdForPub(pub);
  assert.equal(meshNodeIdFor(`did:nova:${pub}`), id);
  assert.equal(meshNodeIdFor(pub), id);
  assert.equal(meshNodeIdFor(id), id);
  assert.ok(isMeshNodeId(id));
  // The old hardware-based IDs were shorter; they are looked up by contact key instead.
  assert.equal(meshNodeIdFor('NODE-F60E82DB7BFC4F2C'), null);
  assert.equal(meshNodeIdFor('did:nova:peer_1_2_3_4'), null);
  assert.equal(meshNodeIdFor(''), null);
});
