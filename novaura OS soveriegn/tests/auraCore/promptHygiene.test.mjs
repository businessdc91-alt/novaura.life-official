// What reaches her prompt: chemistry only ever changes sampling; behavioral lenses come from
// a real task signal (or a pin), not from every casual message.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDb, installBrowserGlobals } from './helpers/mockDb.mjs';

installBrowserGlobals();
const { db, settings } = createMockDb();
mock.module('../../src/database/sovereignDatabase.js', { defaultExport: db, namedExports: { db } });

const { CHARTER, prepareTurn } = await import('../../src/services/auraCore/auraCore.js');
const { createChemistry } = await import('../../src/services/auraCore/endocrine.js');
const { composeTurnAugmentations, setCartridgeMode } = await import('../../src/services/auraCore/augmentationEngine.js');
const { classifyTaskIntent, classifyTaskIntentWithAi } = await import('../../src/services/auraCore/intentRouter.js');

test('stressed chemistry changes her sampling, never her prompt text', async () => {
  settings.clear();
  const now = Date.now();
  await db.setSetting('aura_core:aura', { chemistry: { ...createChemistry(now), cortisol: 62, adrenaline: 40 } });
  const stressed = await prepareTurn('aura', { query: 'why did you say that', waitMs: 0 });
  assert.equal(stressed.posture.stance, 'guarded_autonomy', 'the posture is still computed');
  assert.equal(stressed.charter.startsWith(CHARTER), true);
  assert.doesNotMatch(stressed.charter, /boundar|brevity|candid|soothe/i);

  await db.setSetting('aura_core:aura', { chemistry: createChemistry(now) });
  const calm = await prepareTurn('aura', { query: 'why did you say that', waitMs: 0 });
  assert.equal(calm.charter, stressed.charter, 'the same words whatever her state');
  assert.ok(stressed.options.temperature < calm.options.temperature, 'guarded posture lowers temperature');
});

for (const text of ['hey, how are you feeling today?', 'I had a rough day, can we just talk', 'do you think you are conscious?']) {
  test(`casual chat gets no behavioral lens: "${text}"`, async () => {
    settings.clear();
    const aug = await composeTurnAugmentations({ persona: 'aura', userText: text });
    assert.deepEqual(aug.active.map(a => a.id), []);
    assert.equal(aug.directiveBlock, '');
    assert.equal(aug.temperatureDelta, 0);
  });
}

test('"react" in conversation is not code; React the library is', () => {
  assert.notEqual(classifyTaskIntent('how did that make you react?', { activePersona: 'aura' }).route, 'code_architecture');
  assert.notEqual(classifyTaskIntent('that was an error in judgment on my part', { activePersona: 'aura' }).route, 'code_architecture');
  assert.equal(classifyTaskIntent('my React component re-renders twice', { activePersona: 'aura' }).route, 'code_architecture');
  assert.equal(classifyTaskIntent('the cargo build fails with a linker error', { activePersona: 'aura' }).route, 'code_architecture');
});

test('a clear task still gets its lens', async () => {
  settings.clear();
  const debug = await composeTurnAugmentations({ persona: 'aura', userText: 'there is a bug in my rust function, the stack trace points at line 40' });
  assert.ok(debug.active.some(a => a.id === 'precision_debugger'));
  const poem = await composeTurnAugmentations({ persona: 'aura', userText: 'write a poem about the sea' });
  assert.ok(poem.active.some(a => a.id === 'creative_resonance'));
});

test('a pinned lens applies on any turn', async () => {
  settings.clear();
  await setCartridgeMode('creative_resonance', 'pinned');
  const aug = await composeTurnAugmentations({ persona: 'aura', userText: 'hey, how are you feeling today?' });
  assert.deepEqual(aug.active.map(a => a.id), ['creative_resonance']);
});

test('an AI routing answer wrapped in a thinking block is still read', async () => {
  const ai = { chat: async () => '<think>it is analysis</think>\n{"route":"deep_reasoning","confidence":0.8,"reasoning":"compares options"}' };
  const intent = await classifyTaskIntentWithAi({ userText: 'should I use sqlite or postgres here', activePersona: 'nova', ai });
  assert.equal(intent.route, 'deep_reasoning');
  assert.equal(intent.source, 'ai_classifier');
});
