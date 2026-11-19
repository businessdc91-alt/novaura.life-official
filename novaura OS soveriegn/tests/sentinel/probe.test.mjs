import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '../../src/services/web/novaNames.js';
import { createFakeTable } from './fakeTable.js';
import { createFakeRunner } from '../../src/services/sentinel/runner/probeRunner.js';

// Real scope-token flow over a mocked node identity.
const sk = ed25519.utils.randomSecretKey();
const identity = { secretKeyHex: bytesToHex(sk), publicKey: bytesToHex(ed25519.getPublicKey(sk)) };
mock.module(new URL('../../src/services/sovereignMesh.js', import.meta.url).href, {
  namedExports: { getLocalIdentity: () => identity },
});

// Target store over fake tables.
const targets = createFakeTable('id');
const runs = createFakeTable('id');
const findings = createFakeTable(['runId', 'id']);
const db = { probe_targets: targets, probe_runs: runs, probe_findings: findings };
mock.module(new URL('../../src/database/sovereignDatabase.js', import.meta.url).href, {
  defaultExport: db,
  namedExports: { db },
});

// Ownership gate — controllable per test.
let resolveImpl = async () => ({ ok: false, reason: 'refused' });
mock.module(new URL('../../src/services/sentinel/ownership.js', import.meta.url).href, {
  namedExports: { resolveTarget: async (q) => resolveImpl(q) },
});

const { runProbe } = await import('../../src/services/sentinel/probe.js');

const OWNED = {
  ok: true,
  target: { id: 'tgt_project_app', kind: 'project', ref: 'app', name: 'App', content: { files: [{ path: 'index.html', content: '<h1>hi</h1>' }] } },
};

function reset() {
  targets.rows.clear();
  runs.rows.clear();
  findings.rows.clear();
}
const freshRoot = () => mkdtemp(join(tmpdir(), 'sentinel-run-'));

test('a third-party target is refused and nothing is stored', async () => {
  reset();
  resolveImpl = async () => ({ ok: false, reason: 'not owned by this node' });
  const workRoot = await freshRoot();
  try {
    const r = await runProbe({ kind: 'mesh', name: 'evil.example' }, { runner: createFakeRunner(), now: Date.now, workRoot });
    assert.equal(r.ok, false);
    assert.match(r.reason, /not owned/);
    assert.equal(runs.rows.size, 0);
    assert.equal(findings.rows.size, 0);
    assert.deepEqual(await readdir(workRoot), []);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('an owned target runs the echo and stores one redacted finding', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const workRoot = await freshRoot();
  try {
    const r = await runProbe({ kind: 'project', slug: 'app' }, { runner: createFakeRunner(), now: Date.now, workRoot });
    assert.equal(r.ok, true);
    assert.ok(r.runId);
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].checkId, 'echo');
    assert.equal(runs.rows.size, 1);
    assert.equal(findings.rows.size, 1);
    const run = [...runs.rows.values()][0];
    assert.equal(run.status, 'complete');
    assert.equal(run.targetId, 'tgt_project_app');
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('the stored finding carries no raw body — only shapes and safe scalars', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const sensitiveRunner = {
    async start() {
      return {
        channel: {
          async send() { return 1; },
          async waitObservation() {
            return { status: 200, headers: ['content-type', 'deadbeef'.repeat(8)], servedPaths: ['index.html'], body: '<secret>raw body here</secret>' };
          },
          close() {},
        },
      };
    },
    async stop() {},
  };
  const workRoot = await freshRoot();
  try {
    await runProbe({ kind: 'project', slug: 'app' }, { runner: sensitiveRunner, now: Date.now, workRoot });
    const stored = [...findings.rows.values()][0];
    assert.equal(stored.proof.status, 200);
    assert.ok(stored.proof.headerNames.includes('content-type'));
    assert.ok(stored.proof.headerNames.includes('[redacted]'));         // the hex "header" was redacted
    assert.equal(stored.proof.body, undefined);                          // runProbe never copied the body
    const blob = JSON.stringify(stored);
    assert.ok(!blob.includes('raw body') && !blob.includes('deadbeefdeadbeef'));
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('the working folder is wiped after the run', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const workRoot = await freshRoot();
  try {
    const r = await runProbe({ kind: 'project', slug: 'app' }, { runner: createFakeRunner(), now: Date.now, workRoot });
    assert.equal(r.ok, true);
    assert.deepEqual(await readdir(workRoot), []);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('a runner that fails to start ends the run failed with nothing stored and the folder wiped', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const throwingRunner = { async start() { throw new Error('no sandbox'); }, async stop() {} };
  const workRoot = await freshRoot();
  try {
    const r = await runProbe({ kind: 'project', slug: 'app' }, { runner: throwingRunner, now: Date.now, workRoot });
    assert.equal(r.ok, false);
    assert.match(r.reason, /failed to start|no sandbox/i);
    const allRuns = [...runs.rows.values()];
    assert.equal(allRuns.length, 1);
    assert.equal(allRuns[0].status, 'failed');
    assert.equal(findings.rows.size, 0);
    assert.deepEqual(await readdir(workRoot), []);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('probing in deep mode does not mark the target as staging', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const workRoot = await freshRoot();
  try {
    await runProbe({ kind: 'project', slug: 'app', mode: 'deep' }, { runner: createFakeRunner(), now: Date.now, workRoot });
    const t = [...targets.rows.values()][0];
    assert.equal(t.isStaging, false);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('the working folder is wiped even when the runner stop throws', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const base = createFakeRunner();
  const runner = { start: (...a) => base.start(...a), async stop() { throw new Error('stop blew up'); } };
  const workRoot = await freshRoot();
  try {
    const r = await runProbe({ kind: 'project', slug: 'app' }, { runner, now: Date.now, workRoot });
    assert.equal(r.ok, true);
    assert.deepEqual(await readdir(workRoot), []);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test('a mid-run failure records a failed run and returns a reason, not a throw', async () => {
  reset();
  resolveImpl = async () => OWNED;
  const hangRunner = {
    async start() {
      return { channel: { async send() { return 1; }, async waitObservation() { throw new Error('timed out waiting for observation 1'); }, close() {} } };
    },
    async stop() {},
  };
  const workRoot = await freshRoot();
  try {
    const r = await runProbe({ kind: 'project', slug: 'app' }, { runner: hangRunner, now: Date.now, workRoot });
    assert.equal(r.ok, false);
    assert.match(r.reason, /timed out|observation|failed/i);
    const allRuns = [...runs.rows.values()];
    assert.equal(allRuns.length, 1);
    assert.equal(allRuns[0].status, 'failed');
    assert.equal(findings.rows.size, 0);
    assert.deepEqual(await readdir(workRoot), []);
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});
