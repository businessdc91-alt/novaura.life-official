// runModel: streamed pieces reach onToken once each, and reference images reach cloud models.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

let localImpl = null;
let cloudCalls = [];
mock.module(new URL('../../src/services/localModels.js', import.meta.url).href, {
  namedExports: {
    discoverLocalModels: async () => [],
    describeModelRef: (r) => r,
    runLocalChat: (...args) => localImpl(...args),
  },
});
mock.module(new URL('../../src/services/inferenceExchange.js', import.meta.url).href, {
  namedExports: { listRemoteModels: async () => [], callRemoteModel: async () => 'from exchange' },
});
mock.module(new URL('../../src/kernel/NovaKernel.js', import.meta.url).href, {
  namedExports: { kernel: { ai: { chat: async (messages, opts) => { cloudCalls.push({ messages, opts }); return 'from cloud'; } } } },
});

const { runModel } = await import('../../src/services/cybeni/models.js');
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('a local model streams its pieces to onToken, each once', async () => {
  localImpl = async (_ref, _messages, opts) => { opts.onToken('Hel'); opts.onToken('lo'); return 'Hello'; };
  const got = [];
  assert.equal(await runModel('local|lmstudio:qwen3', [{ role: 'user', content: 'x' }], { onToken: (t) => got.push(t) }), 'Hello');
  assert.deepEqual(got, ['Hel', 'lo'], 'not followed by the whole reply again');
});

test('reference images go to a cloud model with the request', async () => {
  cloudCalls = [];
  await runModel('cloud|claude|claude-opus-5-5', [{ role: 'system', content: 's' }, { role: 'user', content: 'Match this design' }], {
    images: [{ dataUrl: PNG, name: 'mock.png' }, { dataUrl: 'https://example.com/not-inline.png' }],
  });
  assert.equal(cloudCalls.length, 1);
  assert.deepEqual(cloudCalls[0].opts.images, [PNG], 'only inline images are sent');
  assert.equal(cloudCalls[0].messages[1].content, 'Match this design', 'the messages stay plain text for the provider adapter');
});

test('no images, no images option', async () => {
  cloudCalls = [];
  await runModel('cloud|openai|gpt-6', [{ role: 'user', content: 'x' }], {});
  assert.equal('images' in cloudCalls[0].opts, false);
});
