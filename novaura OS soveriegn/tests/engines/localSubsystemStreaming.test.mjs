// The OS AI's local chat streams through the native bridge (runLocalChat), like its
// non-streamed requests, instead of a direct fetch that LM Studio refuses by default.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const seen = [];
mock.module(new URL('../../src/services/nativeService.js', import.meta.url).href, {
  namedExports: { probeLocalAi: async () => ({ online: false, models: [] }) },
});
mock.module(new URL('../../src/services/localModels.js', import.meta.url).href, {
  namedExports: {
    cleanCompletion: (t) => String(t || '').trim(),
    runLocalChat: async (ref, messages, opts) => {
      seen.push({ ref, opts });
      opts.onToken?.('Hi');
      opts.onToken?.(' there');
      return 'Hi there';
    },
  },
});
globalThis.fetch = async () => { throw new Error('direct fetch should not be used'); };

const { LocalModelSubsystem } = await import('../../src/kernel/subsystems/LocalModelSubsystem.js');

for (const backend of ['lmstudio', 'ollama']) {
  test(`a streamed ${backend} chat goes through runLocalChat and its pieces reach onToken`, async () => {
    seen.length = 0;
    const lm = new LocalModelSubsystem();
    const got = [];
    const out = await lm.chat([{ role: 'user', content: 'hello' }], { backend, model: 'qwen3-8b', onToken: (t) => got.push(t) });
    assert.equal(out, 'Hi there');
    assert.deepEqual(got, ['Hi', ' there']);
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0].ref, { runtime: backend, model: 'qwen3-8b' });
  });
}
