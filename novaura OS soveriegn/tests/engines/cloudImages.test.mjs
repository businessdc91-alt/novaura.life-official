// Reference images reach each cloud provider in the shape its API expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerChat } from '../../src/services/cloudProviders.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQ=';
const keys = { claude: 'k', gemini: 'k', openai: 'k', bedrock: 'k', deepseek: 'k' };
const getKey = (name) => keys[name] || '';
const MESSAGES = [
  { role: 'system', content: 'You build apps.' },
  { role: 'user', content: 'Earlier turn' },
  { role: 'assistant', content: 'Sure.' },
  { role: 'user', content: 'Match this design' },
];

const REPLIES = {
  anthropic: { content: [{ type: 'text', text: 'ok' }] },
  gemini: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
  openai: { choices: [{ message: { content: 'ok' } }] },
  bedrock: { output: { message: { content: [{ text: 'ok' }] } } },
};

function fakeFetch(kind, { refuseImages = false } = {}) {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    const hasImage = JSON.stringify(body).includes('iVBORw0KGgo');
    if (refuseImages && hasImage) return { status: 400, text: async () => JSON.stringify({ error: { message: 'This model does not support image input.' } }) };
    return { status: 200, text: async () => JSON.stringify(REPLIES[kind]) };
  };
  return bodies;
}

test('Claude gets base64 image blocks before the text of the last user turn', async () => {
  const bodies = fakeFetch('anthropic');
  assert.equal(await providerChat('claude', MESSAGES, getKey, { model: 'claude-opus-5-5', images: [PNG, JPG] }), 'ok');
  const last = bodies[0].messages.at(-1);
  assert.deepEqual(last, {
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQ=' } },
      { type: 'text', text: 'Match this design' },
    ],
  });
  assert.equal(bodies[0].messages[0].content, 'Earlier turn', 'earlier turns stay plain text');
});

test('Gemini gets inline data parts', async () => {
  const bodies = fakeFetch('gemini');
  await providerChat('gemini', MESSAGES, getKey, { model: 'gemini-3-pro', images: [PNG] });
  assert.deepEqual(bodies[0].contents.at(-1), {
    role: 'user',
    parts: [{ text: 'Match this design' }, { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }],
  });
});

test('OpenAI-compatible providers get image_url parts', async () => {
  const bodies = fakeFetch('openai');
  await providerChat('openai', MESSAGES, getKey, { model: 'gpt-6', images: [PNG] });
  assert.deepEqual(bodies[0].messages.at(-1), {
    role: 'user',
    content: [{ type: 'text', text: 'Match this design' }, { type: 'image_url', image_url: { url: PNG } }],
  });
  assert.equal(bodies[0].messages[0].content, 'You build apps.');
});

test('Amazon Bedrock gets Converse image blocks', async () => {
  const bodies = fakeFetch('bedrock');
  await providerChat('bedrock', MESSAGES, getKey, { model: 'us.amazon.nova-pro-v1:0', images: [JPG] });
  assert.deepEqual(bodies[0].messages.at(-1), {
    role: 'user',
    content: [{ text: 'Match this design' }, { image: { format: 'jpeg', source: { bytes: '/9j/4AAQ=' } } }],
  });
});

test('a model that refuses images is asked again without them', async () => {
  const bodies = fakeFetch('openai', { refuseImages: true });
  assert.equal(await providerChat('deepseek', MESSAGES, getKey, { model: 'deepseek-chat', images: [PNG] }), 'ok');
  const last = bodies.at(-1).messages.at(-1);
  assert.equal(last.content, 'Match this design', 'the last request is text only');
  assert.ok(bodies.some(b => JSON.stringify(b).includes('iVBORw0KGgo')), 'the images were offered first');
});

test('without images the request is unchanged', async () => {
  const bodies = fakeFetch('anthropic');
  await providerChat('claude', MESSAGES, getKey, { model: 'claude-opus-5-5' });
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].messages.at(-1).content, 'Match this design');
});
