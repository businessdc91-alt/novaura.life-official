import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createChannel } from '../../src/services/sentinel/channel.js';

const freshDir = () => mkdtemp(join(tmpdir(), 'sentinel-chan-'));

test('a command is written and its matching observation is read back', async () => {
  const dir = await freshDir();
  try {
    const ch = createChannel(dir);
    const n = await ch.send({ op: 'echo' });
    assert.equal(n, 1);
    assert.deepEqual(JSON.parse(await readFile(join(dir, `cmd-${n}.json`), 'utf8')), { op: 'echo' });
    await writeFile(join(dir, `obs-${n}.json`), JSON.stringify({ status: 200 }), 'utf8');
    assert.deepEqual(await ch.waitObservation(n, { timeoutMs: 2000, pollMs: 20 }), { status: 200 });
    ch.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('observations are matched to their own command number', async () => {
  const dir = await freshDir();
  try {
    const ch = createChannel(dir);
    const n1 = await ch.send({ op: 'echo', a: 1 });
    const n2 = await ch.send({ op: 'echo', a: 2 });
    assert.notEqual(n1, n2);
    await writeFile(join(dir, `obs-${n2}.json`), JSON.stringify({ which: n2 }), 'utf8');
    await writeFile(join(dir, `obs-${n1}.json`), JSON.stringify({ which: n1 }), 'utf8');
    assert.deepEqual(await ch.waitObservation(n1, { timeoutMs: 2000, pollMs: 20 }), { which: n1 });
    assert.deepEqual(await ch.waitObservation(n2, { timeoutMs: 2000, pollMs: 20 }), { which: n2 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an observation written with a UTF-8 BOM is still parsed', async () => {
  const dir = await freshDir();
  try {
    const ch = createChannel(dir);
    const n = await ch.send({ op: 'echo' });
    await writeFile(join(dir, `obs-${n}.json`), '﻿' + JSON.stringify({ status: 204 }), 'utf8');
    assert.deepEqual(await ch.waitObservation(n, { timeoutMs: 2000, pollMs: 20 }), { status: 204 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('waiting past the timeout rejects', async () => {
  const dir = await freshDir();
  try {
    const ch = createChannel(dir);
    const n = await ch.send({ op: 'echo' });
    await assert.rejects(ch.waitObservation(n, { timeoutMs: 100, pollMs: 20 }), /timed out|timeout/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
