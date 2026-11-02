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

// ── Book compiler and remaster diff ────────────────────────────────────────
import { htmlToBlocks, chapterTitle, buildEpubFiles, buildShunnDocxFiles, buildMarkdown, roundedWordCount } from '../../src/components/windows/literature/engines/BookCompiler.js';
import { diffText } from '../../src/components/windows/literature/engines/RemasterEngine.js';

const chapter = { name: 'Ch1.docx', content: '<h1>The Sea &amp; Me</h1><p>She ran <em>hard</em>.</p><p>* * *</p><p>3 &lt; 4<br>done</p><hr><script>x()</script><p></p>' };

test('chapter HTML becomes blocks with styles and scene breaks', () => {
  const blocks = htmlToBlocks(chapter.content);
  assert.deepEqual(blocks.map(b => b.kind), ['heading', 'para', 'break', 'para', 'break']);
  assert.deepEqual(blocks[1].runs, [{ text: 'She ran ', bold: false, italic: false }, { text: 'hard', bold: false, italic: true }, { text: '.', bold: false, italic: false }]);
  assert.equal(blocks[3].runs.map(r => r.text).join(''), '3 < 4\ndone');
  assert.equal(chapterTitle(chapter), 'The Sea & Me');
});

test('EPUB starts with a stored mimetype and escapes text', () => {
  const files = buildEpubFiles({ title: 'A <Book>', author: 'J & K', chapters: [chapter] });
  assert.equal(files[0].path, 'mimetype');
  assert.equal(files[0].store, true);
  assert.equal(files[0].content, 'application/epub+zip');
  const opf = files.find(f => f.path === 'OEBPS/content.opf').content;
  assert.match(opf, /<dc:title>A &lt;Book&gt;<\/dc:title>/);
  assert.match(opf, /properties="nav"/);
  const ch = files.find(f => f.path === 'OEBPS/chapter-1.xhtml').content;
  assert.match(ch, /<em>hard<\/em>/);
  assert.match(ch, /3 &lt; 4<br\/>done/);
  assert.doesNotMatch(ch, /script/);
});

test('Shunn manuscript: Courier 12, double spaced, header from page 2', () => {
  const files = buildShunnDocxFiles({ title: 'Night Tide', author: 'Jane Writer', chapters: [chapter] });
  const styles = files.find(f => f.path === 'word/styles.xml').content;
  assert.match(styles, /w:ascii="Courier New"/);
  assert.match(styles, /<w:sz w:val="24"\/>/);
  assert.match(styles, /w:line="480"/);
  const doc = files.find(f => f.path === 'word/document.xml').content;
  assert.match(doc, /<w:titlePg\/><\/w:sectPr>/);
  assert.match(doc, /NIGHT TIDE/);
  assert.match(files.find(f => f.path === 'word/header1.xml').content, /Writer \/ NIGHT \/ /);
  assert.equal(roundedWordCount(12345), 12300);
  assert.equal(roundedWordCount(80420), 80500);
});

test('Markdown keeps emphasis and breaks', () => {
  const md = buildMarkdown({ title: 'T', author: 'A', chapters: [chapter] });
  assert.match(md, /## The Sea & Me/);
  assert.match(md, /She ran \*hard\*\./);
  assert.match(md, /\* \* \*/);
});

test('remaster diff marks added and removed words', () => {
  const d = diffText('the old grey cat sat', 'the young cat sat down');
  assert.equal(d.granularity, 'words');
  assert.deepEqual(d.segments, [
    { op: 'same', text: 'the' }, { op: 'del', text: 'old grey' }, { op: 'add', text: 'young' },
    { op: 'same', text: 'cat sat' }, { op: 'add', text: 'down' },
  ]);
  assert.equal(diffText('same words', 'same words').changedPercent, 0);
  const long = 'word '.repeat(3000);
  assert.equal(diffText(long, long + 'extra.').granularity, 'sentences');
});
