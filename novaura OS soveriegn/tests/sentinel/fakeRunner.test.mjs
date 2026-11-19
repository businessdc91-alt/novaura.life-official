import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRunner } from '../../src/services/sentinel/runner/probeRunner.js';

test('the fake runner serves content and answers an echo command', async () => {
  const runner = createFakeRunner();
  const session = await runner.start({
    token: { targetId: 'tgt_project_x', mode: 'safe' },
    contentFiles: [
      { path: 'index.html', content: '<h1>hi</h1>' },
      { path: 'app.js', content: 'console.log(1)' },
    ],
    ioDir: null,
  });
  const n = await session.channel.send({ op: 'echo' });
  const obs = await session.channel.waitObservation(n, { timeoutMs: 1000, pollMs: 10 });
  assert.equal(obs.status, 200);
  assert.ok(Array.isArray(obs.servedPaths));
  assert.ok(obs.servedPaths.includes('index.html'));
  await runner.stop(session);
});

test('the fake runner reports 404 when there is no index.html', async () => {
  const runner = createFakeRunner();
  const session = await runner.start({ token: { targetId: 't', mode: 'safe' }, contentFiles: [{ path: 'main.js', content: 'x' }], ioDir: null });
  const n = await session.channel.send({ op: 'echo' });
  const obs = await session.channel.waitObservation(n, { timeoutMs: 1000, pollMs: 10 });
  assert.equal(obs.status, 404);
  await runner.stop(session);
});
