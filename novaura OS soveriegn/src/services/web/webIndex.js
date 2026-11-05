/**
 * webIndex.js — Full-text index of mesh sites, for Nova Search.
 *
 * Pure: text extraction from site HTML, a small inverted index and BM25
 * ranking with the domain and title weighted above the body. Runs the same
 * in the app and in tests.
 */

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with your you'.split(' '));
const MAX_BODY_CHARS = 60_000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') {
      const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return ENTITIES[k] ?? m;
  });
}

const clean = (s) => decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** { title, description, headings, body } from a page's HTML; scripts and styles are dropped. */
export function extractPage(html) {
  const src = String(html || '').slice(0, 2 * MAX_BODY_CHARS * 4);
  const title = clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(src) || [])[1]);
  const description = clean((/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(src) || [])[1]);
  const stripped = src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/i, ' ');
  const headings = [...stripped.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => clean(m[1])).filter(Boolean).join(' · ');
  const body = clean(stripped).slice(0, MAX_BODY_CHARS);
  return { title, description, headings, body };
}

export function tokenize(text) {
  return (String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || [])
    .filter(t => t.length > 1 && !STOP.has(t));
}

const FIELD_WEIGHT = { domain: 4, title: 3, headings: 2, description: 2, body: 1 };

/**
 * Build an index from [{ domain, title, html, ... }] (any extra fields are kept
 * and returned with results).
 */
export function buildIndex(docs) {
  const entries = [];
  const postings = new Map(); // term -> Map(docIndex -> weighted tf)
  let totalLen = 0;
  for (const doc of docs) {
    const page = extractPage(doc.html || '');
    const fields = {
      domain: String(doc.domain || '').replace(/\./g, ' '),
      title: doc.title || page.title,
      headings: page.headings,
      description: page.description,
      body: page.body,
    };
    const i = entries.length;
    let len = 0;
    for (const [field, text] of Object.entries(fields)) {
      for (const term of tokenize(text)) {
        len++;
        if (!postings.has(term)) postings.set(term, new Map());
        const m = postings.get(term);
        m.set(i, (m.get(i) || 0) + FIELD_WEIGHT[field]);
      }
    }
    totalLen += len;
    const { html, ...meta } = doc;
    entries.push({ meta, page: { ...page, title: fields.title }, len });
  }
  return { entries, postings, avgLen: entries.length ? totalLen / entries.length : 0 };
}

/** A short excerpt of the body around the first query term found. */
export function snippet(body, terms, size = 180) {
  const text = String(body || '');
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, size) + (text.length > size ? '…' : '');
  const start = Math.max(0, at - Math.floor(size / 3));
  return (start > 0 ? '…' : '') + text.slice(start, start + size).trim() + (start + size < text.length ? '…' : '');
}

/** BM25 over the weighted terms. Returns [{ ...meta, title, snippet, score }], best first. */
export function searchIndex(index, query, { limit = 20 } = {}) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !index.entries.length) return [];
  const N = index.entries.length;
  const k1 = 1.2;
  const b = 0.75;
  const scores = new Map();
  for (const term of terms) {
    // Prefix matches count too ("light" finds "lighthouse"), at half weight.
    const matches = [...index.postings.entries()].filter(([t]) => t === term || (term.length >= 3 && t.startsWith(term)));
    for (const [t, docs] of matches) {
      const idf = Math.log(1 + (N - docs.size + 0.5) / (docs.size + 0.5));
      const exact = t === term ? 1 : 0.5;
      for (const [i, tf] of docs) {
        const len = index.entries[i].len || 1;
        const s = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / (index.avgLen || 1))))) * exact;
        scores.set(i, (scores.get(i) || 0) + s);
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b2) => b2[1] - a[1])
    .slice(0, limit)
    .map(([i, score]) => {
      const e = index.entries[i];
      return {
        ...e.meta,
        title: e.page.title || e.meta.domain,
        snippet: e.page.description && terms.some(t => e.page.description.toLowerCase().includes(t))
          ? e.page.description
          : snippet(e.page.body, terms),
        score: Math.round(score * 100) / 100,
      };
    });
}
