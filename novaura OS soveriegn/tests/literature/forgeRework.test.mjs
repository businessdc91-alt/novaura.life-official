// Literature Forge rework: fact-claim extraction, canon states, find & replace,
// spelling, readability and .docx import.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

let lastVerify = null;
mock.module('../../src/services/literatureAiService.js', {
  namedExports: {
    verifyFactualClaim: async (args) => { lastVerify = args; return { status: 'VERIFIED', confidence: 90, explanation: 'mock', sources: [] }; },
  },
});

const { storyTimeline } = await import('../../src/components/windows/literature/engines/StoryTimeline.js');
const { FactChecker } = await import('../../src/components/windows/literature/engines/FactChecker.js');
const { SpellCheckEngine, computeReadabilityStats } = await import('../../src/components/windows/literature/engines/SpellCheckEngine.js');
const { buildShunnDocxFiles, parseDocxBytes, docxXmlToHtml } = await import('../../src/components/windows/literature/engines/BookCompiler.js');
const { compressZip } = await import('../../src/services/zipService.js');
const { replaceTextInHtml } = await import('../../src/services/manuscriptStore.js');

test('ordinary prose is not a factual claim; statements of record are', () => {
  storyTimeline.characters = [{ id: 'c1', name: 'Mara', aliases: [], state: 'Active', traits: [] }];
  storyTimeline.settings = [];
  const fc = new FactChecker();
  const plain = 'She had only a moment to decide. Mara was tired of running from them. He never looked back at the burning house.';
  assert.deepEqual(fc.extractPotentialClaims(plain), []);
  const claims = fc.extractPotentialClaims('The citadel was located in the northern wastes. Mara is the heir to the throne of Vel. Light cannot travel through the Veil.');
  assert.equal(claims.length, 3);
});

test('naming a dead character goes to the model with the state, not straight to "contradicts"', async () => {
  storyTimeline.characters = [{ id: 'c1', name: 'Kael', aliases: [], state: 'Deceased', traits: [] }];
  const result = await new FactChecker().verifyClaim({ sentence: 'Kael was buried beneath the old oaks at dawn.' });
  assert.equal(result.status, 'VERIFIED');
  assert.match(lastVerify.worldCanon, /Kael is currently Deceased/);
});

test('find & replace matches what the reader sees and inserts plain text', () => {
  assert.deepEqual(replaceTextInHtml('<p>Tom &amp; Jerry</p>', 'amp', 'X'), { html: '<p>Tom &amp; Jerry</p>', count: 0 });
  assert.deepEqual(replaceTextInHtml('<p>Tom &amp; Jerry</p>', 'Tom & Jerry', 'T&J'), { html: '<p>T&amp;J</p>', count: 1 });
  assert.equal(replaceTextInHtml('<p>Kael</p>', 'Kael', '<img src=x onerror=alert(1)>').html, '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.deepEqual(replaceTextInHtml('<p class="kael">Kael met kael.</p>', 'kael', 'Ren', { matchCase: true }), { html: '<p class="kael">Kael met Ren.</p>', count: 1 });
  // untouched segments keep their exact encoding
  assert.equal(replaceTextInHtml('<p>a&nbsp;b</p><p>Kael</p>', 'Kael', 'Ren').html, '<p>a&nbsp;b</p><p>Ren</p>');
});

test('spelling: common typos are caught with case kept, real words are not', () => {
  const engine = new SpellCheckEngine();
  const sp = engine.analyzeText('<p>Recieve the gift. The sky was lightening.</p>').filter(i => i.type === 'spelling');
  assert.deepEqual(sp.map(i => i.replacement), ['Receive']);
});

test('readability stats', () => {
  assert.equal(computeReadabilityStats('').wordCount, 0);
  const s = computeReadabilityStats('<p>The cat sat. The dog ran.</p>');
  assert.equal(s.wordCount, 6);
  assert.equal(s.sentenceCount, 2);
  assert.ok(s.fleschReadingEase >= 80);
});

test('.docx import reads back the app\'s own manuscript export', async () => {
  const files = buildShunnDocxFiles({ title: 'Test Book', author: 'A. Writer', chapters: [
    { name: 'Chapter One.docx', content: '<h1>Chapter One</h1><p>It was <em>cold</em> &amp; dark.</p><p>* * *</p><p>Morning came.</p>' },
  ] });
  const { html, plainText } = await parseDocxBytes(await compressZip(files));
  assert.match(plainText, /cold & dark/);
  assert.match(html, /<h2>Chapter One<\/h2><p>It was <em>cold<\/em> &amp; dark\.<\/p><hr\/><p>Morning came\.<\/p>/);
  assert.equal(docxXmlToHtml('<w:p/><w:p><w:r><w:t>One</w:t></w:r></w:p>'), '<p>One</p>');
  assert.equal(docxXmlToHtml('<w:p><w:r><w:t>&lt;script&gt;</w:t></w:r></w:p>'), '<p>&lt;script&gt;</p>');
});

test('corkboard and binder up/down move one step (not to the top)', async () => {
  const { StoryTimeline: TL, moveStep } = await import('../../src/components/windows/literature/engines/StoryTimeline.js');
  assert.deepEqual([moveStep('up'), moveStep('down'), moveStep(1), moveStep(-1)], [-1, 1, 1, -1]);
  const tl = new TL();
  tl.hydrated = true;
  tl.plotThreads = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id }));
  tl.movePlotBeat('c', 'down');
  assert.deepEqual(tl.plotThreads.map(b => b.id), ['a', 'b', 'd', 'c']);
  tl.movePlotBeat('d', 'up');
  assert.deepEqual(tl.plotThreads.map(b => b.id), ['a', 'd', 'b', 'c']);
  clearTimeout(tl._saveTimer);
});
