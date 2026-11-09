// Two nodes run the real transfer service (meshTransfers.js) against each other.
// The mesh, the database and the native disk writer (a stand-in with the same
// rules as transfers.rs) are simulated in process; the network can drop, repeat,
// delay or alter packets. Needs --experimental-test-module-mocks (npm test sets it).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { meshNodeIdFor, meshNodeIdForPub } from '../../src/services/meshNodeIds.js';

const als = new AsyncLocalStorage();
const nodes = new Map();
const net = { filter: null, log: [] };
const here = () => als.getStore();
const src = (p) => new URL(`../../src/${p}`, import.meta.url).href;
const hex = (b) => Buffer.from(b).toString('hex');
const unhex = (h) => new Uint8Array(Buffer.from(h, 'hex'));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

globalThis.window = new EventTarget();
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(
      (b) => { this.result = `data:application/octet-stream;base64,${Buffer.from(b).toString('base64')}`; this.onload(); },
      (e) => { this.error = e; this.onerror(); },
    );
  }
};

// Mail sealing as sovereignMesh.js does it (X25519 of the identity keys, AES-GCM).
async function aesKey(mySecretHex, theirPubHex) {
  const shared = x25519.getSharedSecret(ed25519.utils.toMontgomerySecret(unhex(mySecretHex)), ed25519.utils.toMontgomery(unhex(theirPubHex)));
  return crypto.subtle.importKey('raw', shared, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptMailPayload(recipientPubHex, senderSecretHex, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(senderSecretHex, recipientPubHex), new TextEncoder().encode(JSON.stringify(obj)));
  return { encrypted: true, iv: hex(iv), ciphertext: hex(new Uint8Array(ct)) };
}
async function decryptMailPayload(env, recipientSecretHex) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(env.iv) }, await aesKey(recipientSecretHex, env.senderPub), unhex(env.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** Sends like the mesh: a signed packet whose sender is the node's DID. `net.filter` may drop, repeat, delay or change it. */
async function sendDirectMeshPacket(recipientId, type, payload) {
  const from = here();
  const to = nodes.get(recipientId);
  if (!to || to.offline) return false;
  const copies = net.filter ? net.filter({ from, to, type, payload: clone(payload) }) : [{ payload: clone(payload) }];
  for (const { payload: p, delayMs = 0 } of copies) {
    net.log.push({ from: from.name, to: to.name, type, payload: p });
    const packet = { sender_id: from.did, sender_pubkey: from.pub, sender_name: from.name, payload: p };
    setTimeout(() => als.run(to, () => {
      const handler = to.handlers.get(type);
      if (handler) Promise.resolve().then(() => handler(p, packet)).catch(err => console.error(`${to.name} ${type}`, err));
    }), delayMs);
  }
  return true;
}

// The native receiver, with the same rules as src-tauri/src/transfers.rs.
async function invoke(cmd, args, options) {
  const node = here();
  if (cmd === 'transfer_recv_open') {
    const part = path.join(node.dir, '.partial', `${args.id}.part`);
    fs.mkdirSync(path.dirname(part), { recursive: true });
    if (!fs.existsSync(part)) fs.writeFileSync(part, '');
    node.open.set(args.id, { part, name: args.name, size: args.size });
    return Math.min(fs.statSync(part).size, args.size);
  }
  if (cmd === 'transfer_recv_write') {
    const o = node.open.get(options.headers['x-transfer-id']);
    const offset = Number(options.headers['x-offset']);
    if (!o) throw new Error('This transfer is not open.');
    if (offset + args.length > o.size) throw new Error('A piece reaches past the announced file size.');
    const fd = fs.openSync(o.part, 'r+');
    fs.writeSync(fd, args, 0, args.length, offset);
    fs.closeSync(fd);
    node.bytesWritten += args.length;
    return null;
  }
  if (cmd === 'transfer_recv_finish') {
    const o = node.open.get(args.id);
    node.open.delete(args.id);
    const data = fs.readFileSync(o.part);
    if (data.length !== o.size) throw new Error('The file is incomplete.');
    if (createHash('sha256').update(data).digest('hex') !== args.sha256.toLowerCase()) {
      fs.unlinkSync(o.part);
      throw new Error('The file arrived damaged (its checksum does not match).');
    }
    const target = path.join(node.dir, o.name);
    fs.renameSync(o.part, target);
    return target;
  }
  if (cmd === 'transfer_recv_cancel') {
    node.open.delete(args.id);
    fs.rmSync(path.join(node.dir, '.partial', `${args.id}.part`), { force: true });
    return null;
  }
  return null;
}

const table = {
  get: async (id) => clone(here().db.get(id)),
  put: async (rec) => { here().db.set(rec.id, clone(rec)); },
  delete: async (id) => { here().db.delete(id); },
  toArray: async () => [...here().db.values()].map(clone),
  orderBy: () => ({ reverse: () => ({ toArray: async () => [...here().db.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(clone) }) }),
};

mock.module(src('database/sovereignDatabase.js'), { namedExports: { db: { mesh_transfers: table } } });
mock.module(src('services/popoutWindows.js'), { namedExports: { isPopoutWindow: () => false } });
mock.module('@tauri-apps/api/core', { namedExports: { invoke } });
mock.module(src('services/sovereignMesh.js'), {
  namedExports: {
    registerMeshHandler: (type, fn) => here().handlers.set(type, fn),
    sendDirectMeshPacket,
    getMeshNodeId: async () => here().nodeId,
    getLocalIdentity: () => ({ secretKeyHex: here().secretHex, publicKey: here().pub }),
    resolveRecipientPublicKey: async (peerId) => (here().knows.has(peerId) ? nodes.get(peerId).pub : null),
    encryptMailPayload,
    decryptMailPayload,
    didToPubHex: (did) => /^did:nova:([0-9a-f]{64})$/.exec(String(did || ''))?.[1] || null,
    getConnectedPeers: () => [...nodes.values()].map(n => ({ id: n.nodeId, name: n.name })),
    resolveMeshNode: async (id) => meshNodeIdFor(id) || String(id || ''),
  },
});

let seq = 0;
async function makeNode(name) {
  const secret = ed25519.utils.randomSecretKey();
  const pub = hex(ed25519.getPublicKey(secret));
  const node = {
    name, nodeId: meshNodeIdForPub(pub), secretHex: hex(secret), pub, did: `did:nova:${pub}`, seq: ++seq,
    handlers: new Map(), db: new Map(), open: new Map(), knows: new Set(), bytesWritten: 0,
    dir: fs.mkdtempSync(path.join(os.tmpdir(), `nv-xfer-${name}-`)),
  };
  nodes.set(node.nodeId, node);
  node.api = await als.run(node, () => import(`${src('services/meshTransfers.js')}?${node.nodeId}`));
  node.do = (fn) => als.run(node, () => fn(node.api));
  node.rec = (id) => node.db.get(id);
  return node;
}

async function until(check, what, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(15);
  }
  const state = [...nodes.values()].flatMap(n => [...n.db.values()].map(r => `${n.name}:${r.direction}:${r.status}:${r.next}/${r.chunks}:${r.error || ''}`));
  const types = net.log.reduce((m, p) => ({ ...m, [p.type]: (m[p.type] || 0) + 1 }), {});
  assert.fail(`timed out waiting for ${what}\n${state.slice(-6).join('\n')}\n${JSON.stringify(types)}`);
}

const MARKER = Buffer.from('PLAINTEXT-MARKER-THAT-MUST-NEVER-BE-ON-THE-WIRE');
function makeFile(size, name = 'game-project.zip') {
  const data = randomBytes(size);
  MARKER.copy(data, 0);
  MARKER.copy(data, size - MARKER.length);
  return { data, file: new File([data], name, { type: 'application/zip' }) };
}

test('a file crosses encrypted, is checked, and lands on disk intact', async () => {
  net.filter = null;
  net.log = [];
  const alice = await makeNode('alice');
  const bob = await makeNode('bob');
  const { data, file } = makeFile(18 * 1024 * 1024 + 12345);
  const { transferId } = await alice.do(api => api.sendFileToPeer(bob.nodeId, file));
  await until(() => bob.rec(transferId)?.status === 'offered', 'the offer');
  assert.equal(bob.rec(transferId).fileName, 'game-project.zip', 'name in the clear when the key is unknown');
  assert.equal(bob.rec(transferId).size, data.length);
  await bob.do(api => api.acceptTransfer(transferId));
  await until(() => alice.rec(transferId)?.status === 'completed', 'delivery');
  const got = bob.rec(transferId);
  assert.equal(got.status, 'completed');
  assert.ok(fs.readFileSync(got.path).equals(data), 'byte-identical');
  assert.equal(alice.rec(transferId).next, 5);
  const chunks = net.log.filter(p => p.type === 'MESH_XFER_CHUNK');
  assert.equal(chunks.length, 5);
  for (const c of chunks) assert.ok(!Buffer.from(c.payload.data, 'base64').includes(MARKER), 'pieces on the wire are ciphertext');
  assert.ok(chunks.every(c => c.payload.data.length < 6 * 1024 * 1024), 'each piece fits one mesh packet');
});

test('dropped, repeated, delayed and altered pieces are recovered; the name stays sealed when the key is known', async () => {
  net.log = [];
  const alice = await makeNode('alice');
  const bob = await makeNode('bob');
  alice.knows.add(bob.nodeId);
  const { data, file } = makeFile(6 * 4 * 1024 * 1024 + 99, 'secret-plans.blend');
  const seen = new Map();
  net.filter = ({ type, payload }) => {
    if (type !== 'MESH_XFER_CHUNK') return [{ payload }];
    const n = (seen.get(payload.i) || 0) + 1;
    seen.set(payload.i, n);
    if (payload.i === 1 && n === 1) return []; // lost
    if (payload.i === 2 && n === 1) return [{ payload }, { payload }]; // repeated
    if (payload.i === 3 && n === 1) return [{ payload, delayMs: 80 }]; // late, arrives after 4
    if (payload.i === 4 && n === 1) { // altered in transit
      const bytes = Buffer.from(payload.data, 'base64');
      bytes[1000] ^= 0xff;
      return [{ payload: { ...payload, data: bytes.toString('base64') } }];
    }
    return [{ payload }];
  };
  const { transferId } = await alice.do(api => api.sendFileToPeer(bob.nodeId, file));
  const offer = net.log.find(p => p.type === 'MESH_XFER_OFFER').payload;
  assert.ok(offer.sealedMeta && !('name' in offer), 'the file name is sealed');
  await until(() => bob.rec(transferId)?.status === 'offered', 'the offer');
  assert.equal(bob.rec(transferId).fileName, 'secret-plans.blend');
  await bob.do(api => api.acceptTransfer(transferId));
  await until(() => alice.rec(transferId)?.status === 'completed', 'delivery despite faults');
  assert.ok(fs.readFileSync(bob.rec(transferId).path).equals(data));
  assert.ok(seen.get(1) >= 2 && seen.get(4) >= 2, 'the lost and the altered piece were sent again');
  net.filter = null;
});

test('a sender restart resumes from the last acknowledged piece, and only with the same file', async () => {
  net.log = [];
  const alice = await makeNode('alice');
  const bob = await makeNode('bob');
  const { data, file } = makeFile(10 * 4 * 1024 * 1024 + 7);
  let acks = 0;
  net.filter = ({ type, payload }) => {
    if (type === 'MESH_XFER_ACK' && ++acks === 4) setTimeout(() => alice.do(api => api.stopLocalTransfers()), 0);
    return [{ payload }];
  };
  const { transferId } = await alice.do(api => api.sendFileToPeer(bob.nodeId, file));
  await until(() => bob.rec(transferId)?.status === 'offered', 'the offer');
  await bob.do(api => api.acceptTransfer(transferId));
  await until(() => acks >= 4, 'some progress');
  await sleep(300);
  net.filter = null;
  const doneBefore = bob.rec(transferId).next;
  assert.ok(doneBefore >= 3 && doneBefore < 10, `stopped part way (${doneBefore})`);
  // Sovereign restarts: a fresh copy of the service marks the transfer interrupted.
  alice.api = await als.run(alice, () => import(`${src('services/meshTransfers.js')}?${alice.nodeId}-restarted`));
  await until(() => alice.rec(transferId)?.status === 'interrupted', 'interrupted after restart');
  await assert.rejects(alice.do(api => api.sendFileToPeer(bob.nodeId, makeFile(1234).file, { resumeId: transferId })), /not the same file/);
  const written = bob.bytesWritten;
  const firstSession = net.log.find(p => p.type === 'MESH_XFER_OFFER').payload.session;
  net.log = [];
  await alice.do(api => api.sendFileToPeer(bob.nodeId, file, { resumeId: transferId }));
  const resumedSession = net.log.find(p => p.type === 'MESH_XFER_OFFER').payload.session;
  assert.match(resumedSession, /^[0-9a-f]{32}$/);
  assert.notEqual(resumedSession, firstSession, 'a resume brings a new session key');
  await until(() => alice.rec(transferId)?.status === 'completed', 'the resumed transfer');
  assert.ok(fs.readFileSync(bob.rec(transferId).path).equals(data), 'whole-file hash still matches');
  const resent = net.log.filter(p => p.type === 'MESH_XFER_CHUNK').length;
  assert.ok(resent <= 10 - doneBefore + 4, `resumed from the gap, not the start (${resent} pieces resent)`);
  assert.ok(bob.bytesWritten - written < data.length);
});

test('declining, cancelling, a bad checksum and an impostor', async () => {
  net.filter = null;
  const alice = await makeNode('alice');
  const bob = await makeNode('bob');
  const mallory = await makeNode('mallory');

  const one = await alice.do(api => api.sendFileToPeer(bob.nodeId, makeFile(5000).file));
  await until(() => bob.rec(one.transferId)?.status === 'offered', 'offer one');
  await bob.do(api => api.declineTransfer(one.transferId));
  await until(() => alice.rec(one.transferId)?.status === 'declined', 'the decline');

  // A third node that learns a transfer id can't accept it (bob's key is known),
  // cancel it, or feed pieces and acknowledgements into it.
  alice.knows.add(bob.nodeId);
  const two = await alice.do(api => api.sendFileToPeer(bob.nodeId, makeFile(9 * 1024 * 1024).file));
  await until(() => bob.rec(two.transferId)?.status === 'offered', 'offer two');
  await mallory.do(() => sendDirectMeshPacket(alice.nodeId, 'MESH_XFER_ACCEPT', { id: two.transferId, next: 0, replyTo: mallory.nodeId }));
  await mallory.do(() => sendDirectMeshPacket(bob.nodeId, 'MESH_XFER_CANCEL', { id: two.transferId }));
  await sleep(100);
  assert.equal(alice.rec(two.transferId).status, 'waiting', 'an accept from another identity is ignored');
  assert.equal(bob.rec(two.transferId).status, 'offered', 'a cancel from another identity is ignored');
  await bob.do(api => api.acceptTransfer(two.transferId));
  await mallory.do(() => sendDirectMeshPacket(bob.nodeId, 'MESH_XFER_CHUNK', { id: two.transferId, i: 0, data: Buffer.alloc(64).toString('base64') }));
  await mallory.do(() => sendDirectMeshPacket(alice.nodeId, 'MESH_XFER_ACK', { id: two.transferId, next: 3 }));
  await until(() => alice.rec(two.transferId)?.status === 'completed', 'transfer two despite the impostor');
  assert.equal(bob.rec(two.transferId).status, 'completed');

  net.filter = ({ type, payload }) => [{ payload: type === 'MESH_XFER_DONE' ? { ...payload, sha256: '0'.repeat(64) } : payload }];
  const three = await alice.do(api => api.sendFileToPeer(bob.nodeId, makeFile(5 * 1024 * 1024).file));
  await until(() => bob.rec(three.transferId)?.status === 'offered', 'offer three');
  await bob.do(api => api.acceptTransfer(three.transferId));
  await until(() => alice.rec(three.transferId)?.status === 'failed', 'the checksum failure');
  assert.match(alice.rec(three.transferId).error, /damaged/);
  assert.equal(bob.rec(three.transferId).status, 'failed');
  assert.equal(fs.existsSync(path.join(bob.dir, '.partial', `${three.transferId}.part`)), false, 'nothing half-written is left');
  net.filter = null;

  // With bob's key unknown, an accept from another node is still ignored: the
  // offer went to bob's node, and an identity's node comes from its key.
  alice.knows.delete(bob.nodeId);
  const five = await alice.do(api => api.sendFileToPeer(bob.nodeId, makeFile(5000).file));
  await until(() => bob.rec(five.transferId)?.status === 'offered', 'offer five');
  const offered = net.log.findLast(p => p.type === 'MESH_XFER_OFFER' && p.payload.id === five.transferId).payload;
  await mallory.do(() => sendDirectMeshPacket(alice.nodeId, 'MESH_XFER_ACCEPT', { id: five.transferId, next: 0, replyTo: mallory.nodeId, session: offered.session }));
  await sleep(100);
  assert.equal(alice.rec(five.transferId).status, 'waiting', 'an accept from a node that was not offered the file is ignored');
  await bob.do(api => api.acceptTransfer(five.transferId));
  await until(() => alice.rec(five.transferId)?.status === 'completed', 'transfer five');

  const four = await alice.do(api => api.sendFileToPeer(bob.nodeId, makeFile(30 * 1024 * 1024).file));
  await until(() => bob.rec(four.transferId)?.status === 'offered', 'offer four');
  await bob.do(api => api.acceptTransfer(four.transferId));
  await until(() => (bob.rec(four.transferId)?.next || 0) >= 1, 'progress');
  await bob.do(api => api.cancelTransfer(four.transferId));
  await until(() => alice.rec(four.transferId)?.status === 'cancelled', 'the cancel reaching the sender');
  assert.equal(fs.existsSync(path.join(bob.dir, '.partial', `${four.transferId}.part`)), false);
});
