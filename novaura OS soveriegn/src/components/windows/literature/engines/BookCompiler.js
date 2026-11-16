/**
 * BookCompiler.js — Turns manuscript chapters into real publishing files.
 *
 * - EPUB 3 e-book (zip: mimetype first and stored, OPF package, nav + NCX
 *   table of contents, one XHTML file per chapter). Opens in Apple Books,
 *   Calibre, Kobo, and Kindle via Send to Kindle.
 * - Standard manuscript format (William Shunn) as a Word .docx: Courier New
 *   12 pt, double spaced, 1-inch margins, half-inch first-line indents, contact
 *   block and word count on the title page, running "Surname / Title / page"
 *   header from page 2, each chapter on a new page, centered scene breaks.
 * - Print-ready HTML (print to PDF from any browser) and clean Markdown.
 *
 * Chapter HTML (as the editor stores it) is read into blocks of styled runs by
 * a small tokenizer, so this runs anywhere (no DOM) and is unit tested.
 */

import { compressZip, readZip } from '../../../../services/zipService.js';

// ── Reading chapter HTML ───────────────────────────────────────────────────

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article', 'ul', 'ol', 'pre']);
const SKIP_TAGS = new Set(['script', 'style', 'head', 'title']);
const SCENE_BREAK_RE = /^\s*(\*\s*){3}$|^\s*#\s*$|^\s*~+\s*$/;

/**
 * Chapter HTML → [{ kind: 'heading'|'para'|'break', level?, runs: [{ text, bold, italic }] }].
 * Empty paragraphs are dropped; "* * *", "#" and <hr> become scene breaks.
 */
export function htmlToBlocks(html) {
  const blocks = [];
  let current = null;
  let bold = 0;
  let italic = 0;
  let skip = 0;

  const flush = () => {
    if (!current) return;
    const text = current.runs.map(r => r.text).join('');
    if (text.trim()) {
      if (current.kind === 'para' && SCENE_BREAK_RE.test(text)) blocks.push({ kind: 'break', runs: [] });
      else {
        current.runs[0].text = current.runs[0].text.replace(/^\s+/, '');
        const last = current.runs[current.runs.length - 1];
        last.text = last.text.replace(/\s+$/, '');
        blocks.push(current);
      }
    }
    current = null;
  };
  const open = (kind, level) => { flush(); current = { kind, level, runs: [] }; };

  const re = /<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>|<!--[\s\S]*?-->|([^<]+)/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const [, closing, rawTag, selfClosing, text] = m;
    if (text !== undefined) {
      if (skip) continue;
      const clean = decodeEntities(text).replace(/\s+/g, ' ');
      if (!clean.trim() && !current) continue;
      if (!current) open('para');
      const prev = current.runs[current.runs.length - 1];
      const style = { bold: bold > 0, italic: italic > 0 };
      if (prev && prev.bold === style.bold && prev.italic === style.italic) prev.text += clean;
      else current.runs.push({ text: clean, ...style });
      continue;
    }
    if (!rawTag) continue; // comment
    const tag = rawTag.toLowerCase();
    if (SKIP_TAGS.has(tag)) { skip += closing ? -1 : 1; skip = Math.max(0, skip); continue; }
    if (tag === 'b' || tag === 'strong') { bold += closing ? -1 : 1; bold = Math.max(0, bold); continue; }
    if (tag === 'i' || tag === 'em') { italic += closing ? -1 : 1; italic = Math.max(0, italic); continue; }
    if (tag === 'hr') { flush(); blocks.push({ kind: 'break', runs: [] }); continue; }
    if (tag === 'br') { if (current) current.runs.push({ text: '\n', bold: false, italic: false }); continue; }
    if (BLOCK_TAGS.has(tag)) {
      if (closing || selfClosing) flush();
      else if (/^h[1-6]$/.test(tag)) open('heading', Number(tag[1]));
      else open('para');
    }
  }
  flush();
  return blocks;
}

/** A chapter's title: its first heading, else its file name without extension. */
export function chapterTitle(chapter) {
  const first = htmlToBlocks(chapter.content || chapter.html || '').find(b => b.kind === 'heading');
  if (first) return first.runs.map(r => r.text).join('').trim();
  return String(chapter.name || chapter.title || 'Chapter').replace(/\.(docx|md|html?)$/i, '');
}

/** Body blocks without the leading heading (used as the chapter title instead). */
function bodyBlocks(chapter) {
  const blocks = htmlToBlocks(chapter.content || chapter.html || '');
  if (blocks[0]?.kind === 'heading') blocks.shift();
  return blocks;
}

export function countWords(chapters) {
  return chapters.reduce((sum, ch) => sum + bodyBlocks(ch)
    .reduce((n, b) => n + b.runs.map(r => r.text).join(' ').split(/\s+/).filter(Boolean).length, 0), 0);
}

/** Shunn: word counts are rounded (to the nearest 100 under 25k words, else 500). */
export function roundedWordCount(words) {
  const step = words < 25000 ? 100 : 500;
  return Math.max(step, Math.round(words / step) * step);
}

const xml = (text) => String(text ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Characters XML 1.0 does not allow.
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '');

function download(bytes, fileName, mimeType) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(title) {
  return String(title || 'manuscript').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80) || 'manuscript';
}

// ── EPUB 3 ─────────────────────────────────────────────────────────────────

function runsToXhtml(runs) {
  return runs.map(r => {
    let t = xml(r.text).replace(/\n/g, '<br/>');
    if (r.italic) t = `<em>${t}</em>`;
    if (r.bold) t = `<strong>${t}</strong>`;
    return t;
  }).join('');
}

function chapterXhtml(title, blocks, lang) {
  let firstPara = true;
  const body = blocks.map(b => {
    if (b.kind === 'break') { firstPara = true; return '<p class="break">* * *</p>'; }
    if (b.kind === 'heading') { firstPara = true; return `<h3>${runsToXhtml(b.runs)}</h3>`; }
    const cls = firstPara ? ' class="first"' : '';
    firstPara = false;
    return `<p${cls}>${runsToXhtml(b.runs)}</p>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><section epub:type="chapter"><h2>${xml(title)}</h2>
${body}
</section></body></html>`;
}

const EPUB_CSS = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; margin: 0 5%; }
h1, h2 { text-align: center; font-weight: normal; margin: 3em 0 1.5em; page-break-before: always; }
h1 { font-size: 1.8em; } h2 { font-size: 1.4em; } h3 { font-size: 1.1em; margin: 1.5em 0 0.5em; }
p { margin: 0; text-indent: 1.5em; text-align: justify; }
p.first, p.break + p { text-indent: 0; }
p.break { text-align: center; text-indent: 0; margin: 1em 0; }
.title-page { text-align: center; margin-top: 30%; }
.title-page .author { font-size: 1.2em; margin-top: 1em; }`;

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}

/** EPUB 3 package files for compressZip, in the required order. */
export function buildEpubFiles({ title, author, language = 'en', chapters, identifier = `urn:uuid:${uuid()}`, modified = new Date() }) {
  const lang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language) ? language : 'en';
  const stamp = modified.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const items = chapters.map((ch, i) => ({ id: `ch${i + 1}`, href: `chapter-${i + 1}.xhtml`, title: chapterTitle(ch), blocks: bodyBlocks(ch) }));

  const titlePage = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><section class="title-page" epub:type="titlepage"><h1>${xml(title)}</h1><p class="author">${xml(author)}</p></section></body></html>`;

  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>Contents</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${items.map(it => `<li><a href="${it.href}">${xml(it.title)}</a></li>`).join('\n')}
</ol></nav></body></html>`;

  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${xml(identifier)}"/></head>
<docTitle><text>${xml(title)}</text></docTitle>
<navMap>
${items.map((it, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${xml(it.title)}</text></navLabel><content src="${it.href}"/></navPoint>`).join('\n')}
</navMap></ncx>`;

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${xml(identifier)}</dc:identifier>
<dc:title>${xml(title)}</dc:title>
<dc:creator>${xml(author)}</dc:creator>
<dc:language>${lang}</dc:language>
<meta property="dcterms:modified">${stamp}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${items.map(it => `<item id="${it.id}" href="${it.href}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine toc="ncx">
<itemref idref="title"/>
<itemref idref="nav"/>
${items.map(it => `<itemref idref="${it.id}"/>`).join('\n')}
</spine>
</package>`;

  return [
    { path: 'mimetype', content: 'application/epub+zip', store: true },
    { path: 'META-INF/container.xml', content: '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { path: 'OEBPS/content.opf', content: opf },
    { path: 'OEBPS/nav.xhtml', content: nav },
    { path: 'OEBPS/toc.ncx', content: ncx },
    { path: 'OEBPS/style.css', content: EPUB_CSS },
    { path: 'OEBPS/title.xhtml', content: titlePage },
    ...items.map(it => ({ path: `OEBPS/${it.href}`, content: chapterXhtml(it.title, it.blocks, lang) })),
  ];
}

// ── Standard manuscript format (.docx) ─────────────────────────────────────

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function wRuns(runs) {
  return runs.map(r => r.text.split('\n').map((part, i) => {
    const props = `${r.bold ? '<w:b/>' : ''}${r.italic ? '<w:i/>' : ''}`;
    return `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(part)}</w:t></w:r>`;
  }).join('')).join('');
}

const wPara = (inner, props = '') => `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${inner}</w:p>`;
const wText = (text) => `<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
// pPr children must follow the schema order (tabs, spacing, ind, jc) or Word reports the file as damaged.
const CENTER = '<w:ind w:firstLine="0"/><w:jc w:val="center"/>';
const NO_INDENT = '<w:ind w:firstLine="0"/>';
// Blank double-spaced lines; Shunn puts the title about halfway down page one
// and chapter titles about a third of the way down.
const blankLines = (n) => Array.from({ length: n }, () => wPara('', NO_INDENT)).join('');

/** Word document parts for a Shunn-format novel manuscript. */
export function buildShunnDocxFiles({ title, author, penName = '', contact = [], chapters, sceneBreak = '#' }) {
  const words = countWords(chapters);
  const surname = (String(penName || author).trim().split(/\s+/).pop() || 'Author').replace(/[^\p{L}\p{N}'-]/gu, '');
  const keyword = (String(title).split(/\s+/).find(w => w.length > 3) || title || 'Title').toUpperCase().slice(0, 20);
  const byline = penName || author;

  const contactLines = [author, ...contact].filter(Boolean);
  const titlePage = [
    // Contact block at the top left, word count on the right of the first line.
    wPara(`${wText(contactLines[0] || '')}<w:r><w:tab/></w:r>${wText(`about ${roundedWordCount(words).toLocaleString('en-US')} words`)}`,
      `<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs><w:spacing w:line="240" w:lineRule="auto"/>${NO_INDENT}`),
    ...contactLines.slice(1).map(line => wPara(wText(line), `<w:spacing w:line="240" w:lineRule="auto"/>${NO_INDENT}`)),
    blankLines(Math.max(4, 10 - contactLines.length)),
    wPara(wText(String(title).toUpperCase()), CENTER),
    wPara(wText(`by ${byline}`), CENTER),
  ].join('');

  const body = chapters.map((ch, idx) => {
    const blocks = bodyBlocks(ch);
    const head = wPara(`<w:r><w:br w:type="page"/></w:r>`, NO_INDENT) + blankLines(5)
      + wPara(wText(chapterTitle(ch)), CENTER) + wPara('', NO_INDENT);
    const paras = blocks.map(b => {
      if (b.kind === 'break') return wPara(wText(sceneBreak || '#'), CENTER);
      if (b.kind === 'heading') return wPara(wRuns(b.runs), CENTER);
      return wPara(wRuns(b.runs));
    }).join('');
    const end = idx === chapters.length - 1 ? wPara('', NO_INDENT) + wPara(wText('END'), CENTER) : '';
    return head + paras + end;
  }).join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS}><w:body>${titlePage}${body}
<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/>
<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/><w:titlePg/></w:sectPr>
</w:body></w:document>`;

  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W_NS}><w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="right"/></w:pPr>
${wText(`${surname} / ${keyword} / `)}<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New" w:eastAsia="Courier New"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

  return [
    { path: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>` },
    { path: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
    { path: 'docProps/core.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>${xml(byline)}</dc:creator></cp:coreProperties>` },
    { path: 'word/_rels/document.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
</Relationships>` },
    { path: 'word/document.xml', content: document },
    { path: 'word/styles.xml', content: styles },
    { path: 'word/header1.xml', content: header },
  ];
}

// ── Print-ready HTML and Markdown ──────────────────────────────────────────

const esc = (t) => xml(t);

function runsToHtml(runs) {
  return runs.map(r => {
    let t = esc(r.text).replace(/\n/g, '<br>');
    if (r.italic) t = `<em>${t}</em>`;
    if (r.bold) t = `<strong>${t}</strong>`;
    return t;
  }).join('');
}

export function buildPrintHtml({ title, author, chapters }) {
  const chaptersHtml = chapters.map(ch => {
    let first = true;
    const body = bodyBlocks(ch).map(b => {
      if (b.kind === 'break') { first = true; return '<p class="break">* * *</p>'; }
      if (b.kind === 'heading') { first = true; return `<h3>${runsToHtml(b.runs)}</h3>`; }
      const cls = first ? ' class="first"' : '';
      first = false;
      return `<p${cls}>${runsToHtml(b.runs)}</p>`;
    }).join('\n');
    return `<section class="chapter"><h2>${esc(chapterTitle(ch))}</h2>\n${body}</section>`;
  }).join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: 6in 9in; margin: 0.75in 0.6in 0.8in; @bottom-center { content: counter(page); font: 9pt Georgia, serif; } }
body { font: 11pt/1.45 Georgia, "Times New Roman", serif; max-width: 34em; margin: 2em auto; color: #111; }
.title-page { text-align: center; padding-top: 30vh; page-break-after: always; }
.title-page h1 { font-size: 2.2em; font-weight: normal; margin: 0; } .title-page p { margin-top: 1em; font-size: 1.2em; }
h2 { text-align: center; font-weight: normal; font-size: 1.5em; margin: 3em 0 1.5em; }
.chapter { page-break-before: always; } p { margin: 0; text-indent: 1.4em; text-align: justify; hyphens: auto; }
p.first, p.break + p { text-indent: 0; } p.break { text-align: center; text-indent: 0; margin: 0.8em 0; }
@media screen { body { padding: 0 1em; } }
</style></head><body><div class="title-page"><h1>${esc(title)}</h1><p>${esc(author)}</p></div>
${chaptersHtml}</body></html>`;
}

function runsToMarkdown(runs) {
  return runs.map(r => {
    let t = r.text.replace(/([\\`*_[\]#])/g, '\\$1').replace(/\n/g, '  \n');
    if (!t.trim()) return t;
    if (r.italic) t = `*${t}*`;
    if (r.bold) t = `**${t}**`;
    return t;
  }).join('');
}

export function buildMarkdown({ title, author, chapters }) {
  const parts = [`# ${title}`, '', `*${author}*`, ''];
  for (const ch of chapters) {
    parts.push('', `## ${chapterTitle(ch)}`, '');
    for (const b of bodyBlocks(ch)) {
      if (b.kind === 'break') parts.push('* * *', '');
      else if (b.kind === 'heading') parts.push(`### ${runsToMarkdown(b.runs)}`, '');
      else parts.push(runsToMarkdown(b.runs), '');
    }
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ── Entry point for the publisher ──────────────────────────────────────────

/**
 * Converts WordprocessingML (`word/document.xml`) into clean semantic chapter HTML
 * (`<h1>`, `<h2>`, `<p>`, `<strong>`, `<em>`, `<hr/>`).
 */
export function docxXmlToHtml(xmlText) {
  const src = String(xmlText || '');
  if (!src.trim()) return '<p></p>';

  const out = [];
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
  let pm;
  while ((pm = pRe.exec(src)) !== null) {
    const pBody = pm[1];
    if (/<w:br\b[^>]*w:type=["']page["']/i.test(pBody) && !/<w:t\b/i.test(pBody)) {
      continue;
    }

    const pPrMatch = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/i.exec(pBody);
    const pPr = pPrMatch ? pPrMatch[1] : '';
    const styleMatch = /<w:pStyle\b[^>]*w:val=["']([^"']+)["']/i.exec(pPr);
    const styleVal = styleMatch ? styleMatch[1].toLowerCase() : '';
    const isCentered = /<w:jc\b[^>]*w:val=["']center["']/i.test(pPr);

    const runs = [];
    const rRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/gi;
    let rm;
    while ((rm = rRe.exec(pBody)) !== null) {
      const rBody = rm[1];
      // Skip dynamic field instructions like PAGE numbers in headers/title blocks
      if (/<w:instrText\b/i.test(rBody) || /<w:fldChar\b/i.test(rBody)) continue;
      if (/<w:tab\b/i.test(rBody)) {
        runs.push({ text: '\t', bold: false, italic: false });
      }
      if (/<w:br\b(?![^>]*w:type=["']page["'])/i.test(rBody)) {
        runs.push({ text: '\n', bold: false, italic: false });
      }
      const rPrMatch = /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/i.exec(rBody);
      const rPr = rPrMatch ? rPrMatch[1] : '';
      const bold = /<w:b\b(?![^>]*w:val=["'](?:0|false)["'])/i.test(rPr);
      const italic = /<w:i\b(?![^>]*w:val=["'](?:0|false)["'])/i.test(rPr);

      const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
      let tm;
      while ((tm = tRe.exec(rBody)) !== null) {
        const text = decodeEntities(tm[1]);
        if (!text) continue;
        const prev = runs[runs.length - 1];
        if (prev && prev.bold === bold && prev.italic === italic) {
          prev.text += text;
        } else {
          runs.push({ text, bold, italic });
        }
      }
    }

    const plain = runs.map(r => r.text).join('').trim();
    if (!plain) continue;
    // Skip Shunn manuscript title-page word count / END marker lines when round-tripping
    if (/\t.*about\s+[\d,]+\s+words$/i.test(plain)) continue;
    if (isCentered && /^END$/i.test(plain)) continue;

    if (SCENE_BREAK_RE.test(plain) || (isCentered && plain === '—')) {
      out.push('<hr/>');
      continue;
    }

    const htmlInner = runsToHtml(runs);
    if (/^heading\s*1|^title/i.test(styleVal)) {
      out.push(`<h1>${htmlInner}</h1>`);
    } else if (/^heading\s*[2-6]|^subtitle/i.test(styleVal)) {
      out.push(`<h2>${htmlInner}</h2>`);
    } else if (isCentered && out.length === 0 && plain.length < 120) {
      out.push(`<h1>${htmlInner}</h1>`);
    } else if (isCentered && plain.length < 90 && !/[.!?]$/.test(plain)) {
      out.push(`<h2>${htmlInner}</h2>`);
    } else {
      out.push(`<p>${htmlInner}</p>`);
    }
  }

  return out.length ? out.join('') : '<p></p>';
}

/**
 * Unpacks a `.docx` archive (Uint8Array or ArrayBuffer) and converts `word/document.xml`
 * into clean chapter HTML for the manuscript editor.
 */
export async function parseDocxBytes(inputBytes) {
  const entries = await readZip(inputBytes);
  const docEntry = entries.find(e => e.path.toLowerCase() === 'word/document.xml');
  if (!docEntry) {
    throw new Error('Invalid .docx file: missing word/document.xml.');
  }
  const xmlText = new TextDecoder().decode(docEntry.bytes);
  const html = docxXmlToHtml(xmlText);
  const plainText = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e] || ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return { html, plainText };
}

/** Builds the chosen format and downloads it. Returns the file name. */
export async function compileBook(format, options) {
  const base = safeFileName(options.title);
  if (format === 'epub') {
    const bytes = await compressZip(buildEpubFiles(options));
    download(bytes, `${base}.epub`, 'application/epub+zip');
    return `${base}.epub`;
  }
  if (format === 'shunn') {
    const bytes = await compressZip(buildShunnDocxFiles(options));
    download(bytes, `${base}_manuscript.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return `${base}_manuscript.docx`;
  }
  if (format === 'markdown') {
    download(buildMarkdown(options), `${base}.md`, 'text/markdown');
    return `${base}.md`;
  }
  download(buildPrintHtml(options), `${base}_print.html`, 'text/html');
  return `${base}_print.html`;
}
