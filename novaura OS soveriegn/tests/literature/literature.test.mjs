// Literature IDE: grammar rules and chapters shared over the mesh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpellCheckEngine, phraseRegex, htmlToPlainText } from '../../src/components/windows/literature/engines/SpellCheckEngine.js';
import { sanitizeMeshManuscript, SHARED_LIMITS } from '../../src/services/meshManuscripts.js';

const DID = 'did:nova:' + 'ab'.repeat(32);
const passthrough = (html) => html;

test('flags whole words only, with which occurrence each is', () => {
  const issues = new SpellCheckEngine().analyzeText('<p>Everyone was very tired. It was very late.</p>');
  const very = issues.filter(i => i.text === 'very');
  assert.deepEqual(very.map(i => i.occurrence), [0, 1]);
  assert.ok(!issues.some(i => /^every/i.test(i.text)));
});

test('phrases and dialogue tags are flagged but not auto-cut', () => {
  const issues = new SpellCheckEngine().analyzeText('<p>She began  to run. "No," he stated. Suddenly it rained.</p>');
  const began = issues.find(i => i.type === 'filter_word' && /began/.test(i.text));
  assert.ok(began);
  assert.equal(began.replacement, null);
  assert.equal(issues.find(i => i.type === 'dialogue_tag')?.text, 'stated');
  assert.equal(issues.find(i => i.text === 'Suddenly')?.replacement, '');
});

test('ignoring a word hides it from every rule', () => {
  const engine = new SpellCheckEngine();
  engine.ignoreWord('very');
  assert.equal(engine.analyzeText('<p>It was very late.</p>').filter(i => i.text === 'very').length, 0);
});

test('results are capped', () => {
  const issues = new SpellCheckEngine().analyzeText(`<p>${'It was very late. '.repeat(800)}</p>`);
  assert.ok(issues.length <= 300);
});

test('phraseRegex and htmlToPlainText', () => {
  assert.ok(!phraseRegex('very').test('everyone'));
  assert.ok(phraseRegex('began to').test('he Began\nto'));
  assert.equal(htmlToPlainText('<p>a&nbsp;&amp;&nbsp;b</p>').trim(), 'a & b');
});

test('shared chapters are bound to their sender and capped', () => {
  const payload = { manuscript: { id: 'doc_1', name: 'x'.repeat(500), type: 'chapter', content: '<p>Hello there</p>' }, authorName: 'Pilot' };
  const doc = sanitizeMeshManuscript(payload, DID, { sanitize: passthrough });
  assert.equal(doc.id, `mesh_${'ab'.repeat(8)}_doc_1`);
  assert.equal(doc.type, 'shared');
  assert.equal(doc.name.length, 120);
  assert.equal(doc.wordCount, 2);
  assert.equal(doc.authorId, DID);

  const other = sanitizeMeshManuscript(payload, 'did:nova:' + 'cd'.repeat(32), { sanitize: passthrough });
  assert.notEqual(other.id, doc.id);

  const huge = { manuscript: { ...payload.manuscript, content: 'a'.repeat(SHARED_LIMITS.maxContentChars + 1) } };
  assert.equal(sanitizeMeshManuscript(huge, DID, { sanitize: passthrough }), null);
  assert.equal(sanitizeMeshManuscript(payload, 'not-a-did', { sanitize: passthrough }), null);
  assert.equal(sanitizeMeshManuscript({ manuscript: { ...payload.manuscript, id: '../..' } }, DID, { sanitize: passthrough }), null);
  assert.equal(sanitizeMeshManuscript({ manuscript: { ...payload.manuscript, id: 'a/b.c' } }, DID, { sanitize: passthrough }).id, `mesh_${'ab'.repeat(8)}_abc`);
});
