// Literature IDE: grammar rules and chapters shared over the mesh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SpellCheckEngine,
  phraseRegex,
  htmlToPlainText,
  computeReadabilityStats
} from '../../src/components/windows/literature/engines/SpellCheckEngine.js';
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

test('spelling typos preserve capitalization and punctuation-adjacent repetition tracks occurrence', () => {
  const engine = new SpellCheckEngine();
  const issues = engine.analyzeText(
    '<p>Definately a strange signal occured in the shadow, shadow, shadow, shadow, shadow of the spire.</p>'
  );
  const defTypo = issues.find(i => i.type === 'spelling' && i.text === 'Definately');
  assert.ok(defTypo);
  assert.equal(defTypo.replacement, 'Definitely');

  const occTypo = issues.find(i => i.type === 'spelling' && i.text === 'occured');
  assert.ok(occTypo);
  assert.equal(occTypo.replacement, 'occurred');

  const reps = issues.filter(i => i.type === 'repetition' && i.text.toLowerCase() === 'shadow');
  assert.equal(reps.length, 4);
  assert.ok(reps[0].index > 0);
  assert.deepEqual(reps.map(r => r.occurrence), [1, 2, 3, 4]);
});

test('computeReadabilityStats calculates Flesch Reading Ease, Grade Level, and Lexical Diversity', () => {
  const stats = computeReadabilityStats(
    '<p>The rain fell cold across the neon boulevard. Silas checked his encrypted terminal twice before stepping into the alley.</p>'
  );
  assert.equal(stats.wordCount, 19);
  assert.equal(stats.sentenceCount, 2);
  assert.ok(stats.fleschReadingEase > 0 && stats.fleschReadingEase <= 100);
  assert.ok(stats.lexicalDiversity > 70);
  assert.equal(stats.readingTimeMinutes, 1);
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

// ── Book compiler, DOCX binary unpacking, StoryTimeline & remaster diff ────
import {
  htmlToBlocks,
  chapterTitle,
  buildEpubFiles,
  buildShunnDocxFiles,
  buildMarkdown,
  roundedWordCount,
  parseDocxBytes
} from '../../src/components/windows/literature/engines/BookCompiler.js';
import { compressZip } from '../../src/services/zipService.js';
import { diffText } from '../../src/components/windows/literature/engines/RemasterEngine.js';
import { StoryTimeline } from '../../src/components/windows/literature/engines/StoryTimeline.js';

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

test('Shunn manuscript: Courier 12, double spaced, header from page 2, and round-trips through parseDocxBytes', async () => {
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

  // Round-trip the compiled .docx ZIP bytes back into clean HTML via parseDocxBytes
  const zipBytes = await compressZip(files);
  const unpacked = await parseDocxBytes(zipBytes);
  assert.match(unpacked.html, /<em>hard<\/em>/);
  assert.match(unpacked.plainText, /The Sea & Me/);
});

test('StoryTimeline supports World Lore, Beat Templates, matched scene entities, and global rename', () => {
  const tl = new StoryTimeline();
  const silas = tl.addCharacter({
    name: 'Silas Vance',
    aliases: ['The Cipher'],
    archetype: 'Protagonist',
    secret: 'Carries the master decryption key'
  });
  const spire = tl.addLoreEntry({
    name: 'New Aethelgard',
    category: 'Location',
    description: 'Rain-slicked arcology',
    rules: 'Gravity is 0.88G'
  });
  tl.addRelationship({
    sourceId: silas.id,
    targetId: silas.id,
    type: 'Ally',
    notes: 'Trusted operative'
  });

  const matched = tl.getMatchedEntities('The Cipher arrived in New Aethelgard at dusk.');
  assert.equal(matched.characters.length, 1);
  assert.equal(matched.characters[0].name, 'Silas Vance');
  assert.equal(matched.lore.length, 1);
  assert.equal(matched.lore[0].name, 'New Aethelgard');

  const ctx = tl.bibleContext(2500, 'The Cipher arrived in New Aethelgard');
  assert.match(ctx, /Silas Vance \(also The Cipher\) \[ACTIVE IN SCENE\]/);
  assert.match(ctx, /secret: Carries the master decryption key/);
  assert.match(ctx, /canon rule: Gravity is 0.88G/);

  const beats = tl.applyBeatTemplate('save_the_cat', false);
  assert.equal(beats.length, 15);
  assert.equal(beats[0].title, '1. Opening Image');

  const changes = tl.renameEntityInBible('Silas Vance', 'Kaelen Vance');
  assert.ok(changes >= 1);
  assert.equal(tl.characters[0].name, 'Kaelen Vance');
  assert.ok(spire.id);
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
