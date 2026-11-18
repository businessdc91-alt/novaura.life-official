// The bridge that answers ai.chat() calls a Cybeni app makes inside its preview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAppAiBridge, APP_AI_MAX_CONCURRENT, APP_AI_MAX_TOKENS } from '../../src/services/cybeni/appAiBridge.js';

const until = async (fn, ms = 2000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 5)); }
  return false;
};

test('a reply goes back to the app with its request id', async () => {
  const calls = [];
  const bridge = createAppAiBridge({ chat: async (messages, opts) => { calls.push({ messages, opts }); return 'Hi there'; } });
  const replies = [];
  await bridge.handle({ requestId: 'ai_1', messages: [{ role: 'user', content: 'Hello' }] }, (p) => replies.push(p));
  assert.deepEqual(replies, [{ __cybeniAiReply: true, requestId: 'ai_1', text: 'Hi there' }]);
  assert.equal(calls[0].messages[0].role, 'system', 'a system message is added when the app sends none');
  assert.deepEqual(calls[0].messages[1], { role: 'user', content: 'Hello' });
});

test("the app's own system prompt is kept, and odd messages are cleaned up", async () => {
  let seen;
  const bridge = createAppAiBridge({ chat: async (messages) => { seen = messages; return 'ok'; } });
  await bridge.handle({
    requestId: 'ai_2',
    messages: [{ role: 'user', content: { evil: true } }, { role: 'tool', content: 'x' }, { role: 'assistant', content: 'prior' }, null],
    opts: { system: 'You are a recipe helper.' },
  }, () => {});
  assert.deepEqual(seen, [
    { role: 'system', content: 'You are a recipe helper.' },
    { role: 'user', content: '[object Object]' },
    { role: 'user', content: 'x' },
    { role: 'assistant', content: 'prior' },
  ]);
});

test(`no more than ${APP_AI_MAX_CONCURRENT} requests run at once; the next one is turned away, then allowed again`, async () => {
  const gates = [];
  const bridge = createAppAiBridge({ chat: () => new Promise(resolve => gates.push(resolve)) });
  const replies = [];
  const reply = (p) => replies.push(p);
  const running = [];
  for (let i = 0; i < APP_AI_MAX_CONCURRENT; i++) running.push(bridge.handle({ requestId: `r${i}`, messages: [{ role: 'user', content: 'x' }] }, reply));
  await until(() => gates.length === APP_AI_MAX_CONCURRENT);
  await bridge.handle({ requestId: 'extra', messages: [{ role: 'user', content: 'x' }] }, reply);
  const refused = replies.find(r => r.requestId === 'extra');
  assert.ok(refused?.error, 'the extra request gets an error straight away');
  assert.match(refused.error, /already has 2 AI requests running/);
  assert.equal(gates.length, APP_AI_MAX_CONCURRENT, 'the model was not called for it');

  gates.forEach(g => g('done'));
  await Promise.all(running);
  assert.equal(bridge.inFlight(), 0);
  const later = bridge.handle({ requestId: 'later', messages: [{ role: 'user', content: 'x' }] }, reply);
  assert.ok(await until(() => gates.length === APP_AI_MAX_CONCURRENT + 1), 'the model is called once a slot is free');
  gates[gates.length - 1]('after');
  await later;
  assert.equal(replies.find(r => r.requestId === 'later').text, 'after');
});

test('a failed request frees its slot and reports the error', async () => {
  const bridge = createAppAiBridge({ chat: async () => { throw new Error('No local AI is running.'); } });
  const replies = [];
  await bridge.handle({ requestId: 'f1', messages: [{ role: 'user', content: 'x' }] }, (p) => replies.push(p));
  assert.deepEqual(replies, [{ __cybeniAiReply: true, requestId: 'f1', error: 'No local AI is running.' }]);
  assert.equal(bridge.inFlight(), 0);
});

test('a streaming request sends each piece to the app before the reply', async () => {
  let opts;
  const bridge = createAppAiBridge({
    chat: async (_m, o) => { opts = o; o.onToken('Hel'); o.onToken('lo'); return 'Hello'; },
  });
  const replies = [];
  await bridge.handle({ requestId: 's1', messages: [{ role: 'user', content: 'x' }], opts: { stream: true } }, (p) => replies.push(p));
  assert.deepEqual(replies, [
    { __cybeniAiChunk: true, requestId: 's1', text: 'Hel' },
    { __cybeniAiChunk: true, requestId: 's1', text: 'lo' },
    { __cybeniAiReply: true, requestId: 's1', text: 'Hello' },
  ]);
  assert.equal(typeof opts.onToken, 'function');

  let plainOpts;
  const plain = createAppAiBridge({ chat: async (_m, o) => { plainOpts = o; return 'x'; } });
  await plain.handle({ requestId: 's2', messages: [{ role: 'user', content: 'x' }] }, () => {});
  assert.equal(plainOpts.onToken, undefined, 'no streaming unless the app asks for it');
});

test("the app's token limit is used, within the model-sized ceiling", async () => {
  const seen = [];
  const bridge = createAppAiBridge({ chat: async (_m, o) => { seen.push(o.maxTokens); return 'x'; } });
  const ask = (maxTokens) => bridge.handle({ requestId: 'm', messages: [{ role: 'user', content: 'x' }], opts: { maxTokens } }, () => {});
  await ask(8000);
  await ask(undefined);
  await ask(10_000_000);
  await ask('junk');
  assert.deepEqual(seen, [8000, 1024, APP_AI_MAX_TOKENS, 1024]);
});
