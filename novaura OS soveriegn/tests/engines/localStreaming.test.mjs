// Live streaming from local models: parsing the servers' stream formats, and runLocalChat
// handing pieces to onToken while keeping its retries and its final answer.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
let streamImpl = null;
let queryImpl = null;
mock.module(new URL('../../src/services/nativeService.js', import.meta.url).href, {
  namedExports: {
    probeLocalAi: async () => ({ online: false }),
    queryLocalAi: async (port, path, method, body) => { calls.push({ how: 'query', port, path, body }); return queryImpl(port, path, body); },
    streamLocalAi: async (port, path, body, onText) => { calls.push({ how: 'stream', port, path, body }); return streamImpl(port, path, body, onText); },
  },
});
mock.module(new URL('../../src/services/engines/mediaRoom.js', import.meta.url).href, {
  namedExports: { releaseComfyModels: async () => false },
});

const { createStreamReader, assembleStream } = await import('../../src/services/localStream.js');
const { runLocalChat } = await import('../../src/services/localModels.js');

const pieces = (text, size) => text.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g'));

test("Ollama's one-JSON-per-line stream gives its pieces in order, however it is split", () => {
  const body = [
    JSON.stringify({ message: { role: 'assistant', content: '', thinking: 'Let me think. ' } }),
    JSON.stringify({ message: { role: 'assistant', content: 'Hello' } }),
    JSON.stringify({ message: { role: 'assistant', content: ' wörld ✓' } }),
    JSON.stringify({ done: true, message: { role: 'assistant', content: '' } }),
  ].join('\n') + '\n';
  for (const size of [1, 7, body.length]) {
    const got = [];
    const reader = createStreamReader('ollama', (d) => got.push(d));
    pieces(body, size).forEach(p => reader.push(p));
    assert.deepEqual(got.map(d => d.content).filter(Boolean), ['Hello', ' wörld ✓'], `split into ${size}-char pieces`);
    assert.deepEqual(got.map(d => d.thinking).filter(Boolean), ['Let me think. ']);
  }
  assert.deepEqual(assembleStream('ollama', body), { message: { content: 'Hello wörld ✓', thinking: 'Let me think. ' } });
});

test('an OpenAI-style event stream gives its pieces and ignores comments and [DONE]', () => {
  const ev = (delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\r\n\r\n`;
  const body = ': keep-alive\r\n\r\n' + ev({ role: 'assistant' }) + ev({ reasoning_content: 'hmm ' }) + ev({ content: 'export ' }) + ev({ content: 'default 1;' }) + 'data: [DONE]\r\n\r\n';
  for (const size of [1, 9, body.length]) {
    const got = [];
    const reader = createStreamReader('openai', (d) => got.push(d));
    pieces(body, size).forEach(p => reader.push(p));
    assert.deepEqual(got.map(d => d.content).filter(Boolean), ['export ', 'default 1;'], `split into ${size}-char pieces`);
    assert.deepEqual(got.map(d => d.thinking).filter(Boolean), ['hmm ']);
  }
  assert.deepEqual(assembleStream('openai', body), { choices: [{ message: { content: 'export default 1;', reasoning_content: 'hmm ' } }] });
});

test('an error in the middle of a stream is reported, not mistaken for an answer', () => {
  const ollama = JSON.stringify({ message: { content: 'par' } }) + '\n' + JSON.stringify({ error: 'model runner has unexpectedly stopped' }) + '\n';
  assert.deepEqual(assembleStream('ollama', ollama), { error: 'model runner has unexpectedly stopped' });
  const openai = `data: ${JSON.stringify({ error: { message: 'Context length exceeded' } })}\n\n`;
  assert.deepEqual(assembleStream('openai', openai), { error: { message: 'Context length exceeded' } });
});

test('with onToken, LM Studio is asked for a stream and each piece reaches onToken as it arrives', async () => {
  calls.length = 0;
  const ev = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  streamImpl = async (_port, _path, _body, onText) => {
    const body = ev('<think>plan</think>') + ev('const a') + ev(' = 1;') + 'data: [DONE]\n\n';
    for (const p of pieces(body, 11)) onText(p);
    return { status: 200, body };
  };
  const got = [];
  const out = await runLocalChat('lmstudio:qwen3-coder-30b', [{ role: 'user', content: 'x' }], { maxTokens: 100, onToken: (t) => got.push(t) });
  assert.equal(out, 'const a = 1;', 'the reply is cleaned as before');
  assert.equal(got.join(''), '<think>plan</think>const a = 1;');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].how, 'stream');
  assert.equal(calls[0].port, 1234);
  assert.equal(calls[0].path, '/v1/chat/completions');
  assert.equal(calls[0].body.stream, true);
});

test('with onToken, a server error before the stream still gets the usual retry', async () => {
  calls.length = 0;
  streamImpl = async (_port, _path, body, onText) => {
    if ('think' in body) return { status: 400, body: JSON.stringify({ error: '"gemma3" does not support thinking' }) };
    const out = JSON.stringify({ message: { content: 'ok' } }) + '\n';
    onText(out);
    return { status: 200, body: out };
  };
  const got = [];
  const out = await runLocalChat('ollama:gemma3:12b', [{ role: 'user', content: 'x' }], { onToken: (t) => got.push(t), think: true });
  assert.equal(out, 'ok');
  assert.deepEqual(got, ['ok']);
  assert.equal(calls.length, 2, 'asked again without the think option');
  assert.equal(calls[1].path, '/api/chat');
});

test('when streaming is not available, the reply comes in one piece instead', async () => {
  calls.length = 0;
  streamImpl = async () => { throw new Error('Command query_local_ai_stream not found'); };
  queryImpl = async () => ({ choices: [{ message: { content: 'whole reply' } }] });
  const got = [];
  const out = await runLocalChat('lmstudio:m', [{ role: 'user', content: 'x' }], { onToken: (t) => got.push(t) });
  assert.equal(out, 'whole reply');
  assert.deepEqual(got, ['whole reply'], 'onToken still hears the reply once');
  assert.deepEqual(calls.map(c => c.how), ['stream', 'query']);
  assert.equal(calls[1].body.stream, false);
});

test('without onToken nothing changes: one request, not streamed', async () => {
  calls.length = 0;
  queryImpl = async () => ({ message: { content: 'plain' } });
  assert.equal(await runLocalChat('ollama:llama3', [{ role: 'user', content: 'x' }]), 'plain');
  assert.deepEqual(calls.map(c => c.how), ['query']);
  assert.equal(calls[0].body.stream, false);
});
