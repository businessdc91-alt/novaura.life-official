/**
 * htmlSanitizer.js — allowlist HTML sanitizer for rich text that did not come from
 * the operator typing in this window (mesh manuscripts, AI output, imports).
 *
 * Why it exists: the Literature IDE writes document content into a contentEditable
 * node with innerHTML. That node lives in the OS's own origin, so a stray
 * <img onerror=...> from a peer would run with full access to the Tauri bridge and
 * the vault. Everything is parsed in an inert DOMParser document (no script runs,
 * no resource loads), rebuilt from an allowlist, and only then serialised.
 *
 * Removed outright (with their content): script, style, iframe, object, embed, svg,
 * math, form controls, media, link/meta/base, template, noscript.
 * Removed attributes: every on* handler, srcdoc, formaction, target, data-*, and any
 * style declaration that can load a resource or run code.
 */

const ALLOWED_TAGS = new Set([
  'A', 'ABBR', 'ARTICLE', 'ASIDE', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CENTER', 'CITE', 'CODE', 'COL',
  'COLGROUP', 'DD', 'DEL', 'DETAILS', 'DIV', 'DL', 'DT', 'EM', 'FIGCAPTION', 'FIGURE', 'FONT', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'I', 'IMG', 'INS', 'KBD', 'LI', 'MAIN', 'MARK',
  'NAV', 'OL', 'P', 'PRE', 'Q', 'S', 'SAMP', 'SECTION', 'SMALL', 'SPAN', 'STRIKE', 'STRONG', 'SUB',
  'SUMMARY', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL', 'VAR',
]);

const DROP_WITH_CONTENT = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'SVG', 'MATH', 'FORM',
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO', 'SOURCE', 'TRACK', 'CANVAS', 'LINK', 'META',
  'BASE', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'HEAD', 'DIALOG', 'PORTAL',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'align', 'valign', 'color',
  'face', 'size', 'dir', 'lang', 'start', 'type', 'class', 'style', 'open',
]);

const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i;
const UNSAFE_STYLE = /url\s*\(|expression\s*\(|javascript:|vbscript:|behavior|binding|@import|\\/i;
// Content is drawn inside the OS's own page, so it may not lift itself out of its
// box: a fixed, full-screen layer could pose as an OS dialog (asking for a vault
// passphrase, say). Positioning, stacking and transforms are dropped, both as
// styles and as the OS's own utility classes (offsets such as top-0 do nothing
// once the positioning itself is gone).
const POSITIONING_STYLE = /^\s*(position|z-index|inset|transform|translate|scale|rotate)\s*:/i;
const POSITIONING_CLASS = /^-?(fixed|absolute|sticky|relative|z|translate|scale|rotate|transform|w-screen|h-screen|min-h-screen|min-w-screen|max-h-screen|max-w-screen)(-|$)/;

/** Strip characters browsers ignore inside a scheme ("java\nscript:") before testing it. */
function normaliseUrl(value) {
  return String(value || '').replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '');
}

function safeLink(value) {
  const v = normaliseUrl(value);
  if (!v) return null;
  if (v.startsWith('#')) return v;
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(v);
  if (!scheme) return null; // relative links would resolve against the OS origin
  return SAFE_LINK_SCHEMES.has(scheme[1].toLowerCase()) ? String(value).trim() : null;
}

function safeImageSrc(value, allowRemoteImages) {
  const raw = String(value || '').trim();
  if (SAFE_DATA_IMAGE.test(raw)) return raw;
  const v = normaliseUrl(raw);
  if (allowRemoteImages && /^https:\/\//i.test(v)) return raw;
  return null;
}

export function cleanStyle(value) {
  return String(value || '')
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !UNSAFE_STYLE.test(d) && !POSITIONING_STYLE.test(d))
    .join('; ');
}

// Variants such as md:fixed or hover:z-50 count as the utility they apply
export function cleanClass(value) {
  return String(value || '')
    .split(/\s+/)
    .filter((c) => c && !POSITIONING_CLASS.test(c.slice(c.lastIndexOf(':') + 1).replace(/^!/, '')))
    .join(' ');
}

function cleanNode(node, doc, allowRemoteImages) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) continue; // text
    if (child.nodeType !== 1) {
      child.remove(); // comments, processing instructions, CDATA
      continue;
    }
    const tag = child.tagName.toUpperCase();
    if (DROP_WITH_CONTENT.has(tag)) {
      child.remove();
      continue;
    }
    // Sanitise descendants first so an unwrapped element never re-exposes unclean children.
    cleanNode(child, doc, allowRemoteImages);
    if (!ALLOWED_TAGS.has(tag)) {
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      child.remove();
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) {
        child.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href') {
        const link = safeLink(attr.value);
        if (link === null) child.removeAttribute(attr.name);
        else child.setAttribute('href', link);
      } else if (name === 'src') {
        const src = tag === 'IMG' ? safeImageSrc(attr.value, allowRemoteImages) : null;
        if (src === null) child.removeAttribute(attr.name);
        else child.setAttribute('src', src);
      } else if (name === 'style') {
        const style = cleanStyle(attr.value);
        if (style) child.setAttribute('style', style);
        else child.removeAttribute('style');
      } else if (name === 'class') {
        const cls = cleanClass(attr.value);
        if (cls) child.setAttribute('class', cls);
        else child.removeAttribute('class');
      }
    }
    if (tag === 'A') child.setAttribute('rel', 'noopener noreferrer');
    if (tag === 'IMG') {
      child.setAttribute('referrerpolicy', 'no-referrer');
      if (!child.getAttribute('src')) {
        child.remove(); // an image with no safe source would only be a broken box
      }
    }
  }
}

/**
 * @param {string} html
 * @param {{ allowRemoteImages?: boolean }} [options] remote https images leak the
 *   reader's IP to whoever wrote the page; pass false for anything peer-supplied.
 * @returns {string} markup that is safe to assign to innerHTML
 */
export function sanitizeRichHtml(html, { allowRemoteImages = true } = {}) {
  if (html === null || html === undefined || html === '') return '';
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${String(html)}</body></html>`, 'text/html');
  cleanNode(doc.body, doc, allowRemoteImages);
  return doc.body.innerHTML;
}

/** Escape plain text so it can be placed inside markup (AI/chat text in <p> wrappers). */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
