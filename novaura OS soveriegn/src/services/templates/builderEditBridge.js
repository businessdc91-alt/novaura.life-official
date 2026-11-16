// builderEditBridge.js — Lets edits made inside the Website Builder preview
// (single-clicking into contenteditable text, clicking or dropping a photo on an
// image spot, or using the Quick Fill-in-the-Blanks drawer) flow back into the
// page source, so they are saved and published.
//
// The preview gets data-nb="t0", "t1"… on editable text and "i0", "i1"… on
// image spots (in document order). The bridge script in the preview posts
// { key, html } on each edit; applyBuilderEdit finds the same element in the
// source by the same ordering and replaces its contents. The published page
// never carries the attributes or the script.

const EDITABLE = '[contenteditable]:not([contenteditable="false"])';
const IMAGE_SPOT = '.img-placeholder';

function parseBody(html) {
  return new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, 'text/html').body;
}

function editTargets(body) {
  return [
    ...[...body.querySelectorAll(EDITABLE)].map((el, i) => [`t${i}`, el]),
    ...[...body.querySelectorAll(IMAGE_SPOT)].map((el, i) => [`i${i}`, el]),
  ];
}

/** The page body with each editable element marked for the preview. */
export function tagEditable(html) {
  const body = parseBody(html);
  for (const [key, el] of editTargets(body)) el.setAttribute('data-nb', key);
  return body.innerHTML;
}

/**
 * Extracts all editable text blanks and image dropzones from the template HTML
 * so the Quick Fill-in-the-Blanks drawer can render 1-click inputs and upload buttons.
 * Works in both the browser (via DOMParser) and Node.js test environments.
 */
export function extractTemplateFields(html) {
  const src = String(html || '');
  if (typeof DOMParser !== 'undefined') {
    const body = parseBody(src);
    const textFields = [...body.querySelectorAll(EDITABLE)].map((el, i) => {
      const tag = (el.tagName || 'DIV').toLowerCase();
      const label = tag === 'h1' ? 'Main Headline'
        : tag === 'h2' ? 'Section Heading'
        : tag === 'h3' || tag === 'h4' ? 'Card Title'
        : tag === 'p' ? 'Paragraph Copy'
        : 'Editable Text';
      // The input shows `value`; it is not trimmed, or a space typed at the end would vanish.
      const value = (el.textContent || '').replace(/\s+/g, ' ');
      return {
        key: `t${i}`,
        tag,
        label: `${label} #${i + 1}`,
        text: value.trim(),
        value,
      };
    });

    const imageSlots = [...body.querySelectorAll(IMAGE_SPOT)].map((el, i) => {
      const img = el.querySelector('img');
      const rawLabel = (el.textContent || '').trim();
      return {
        key: `i${i}`,
        label: rawLabel && rawLabel.length < 56 ? rawLabel : `Image Slot #${i + 1}`,
        hasImage: Boolean(img),
        src: img ? img.getAttribute('src') : null,
      };
    });

    return { textFields, imageSlots, imageSpots: imageSlots };
  }

  // Node.js fallback parser when DOMParser is unavailable
  const textFields = [];
  const textRe = /<([a-z0-9]+)\b[^>]*\bcontenteditable=(?:"true"|'true'|true)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  let tIdx = 0;
  while ((m = textRe.exec(src)) !== null) {
    const tag = m[1].toLowerCase();
    const val = m[2].replace(/<[^>]+>/g, '').trim();
    textFields.push({
      key: `t${tIdx}`,
      tag,
      label: `Editable ${tag.toUpperCase()} #${tIdx + 1}`,
      text: val,
      value: val,
    });
    tIdx++;
  }

  const imageSlots = [];
  const imgRe = /<([a-z0-9]+)\b[^>]*\bclass=["'][^"']*\bimg-placeholder\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let iIdx = 0;
  while ((m = imgRe.exec(src)) !== null) {
    const inner = m[2];
    const hasImage = /<img\b/i.test(inner);
    const rawLabel = inner.replace(/<[^>]+>/g, '').trim();
    imageSlots.push({
      key: `i${iIdx}`,
      label: rawLabel || `Image Slot #${iIdx + 1}`,
      hasImage,
      src: null,
    });
    iIdx++;
  }

  return { textFields, imageSlots, imageSpots: imageSlots };
}

/** The page body with element `key` holding `innerHtml`, or the input unchanged. */
export function applyBuilderEdit(html, key, innerHtml) {
  if (!/^[ti]\d{1,4}$/.test(String(key))) return html;
  if (typeof DOMParser === 'undefined') {
    const targetIdx = Number(String(key).slice(1));
    const isText = String(key).startsWith('t');
    const re = isText
      ? /(<([a-z0-9]+)\b[^>]*\bcontenteditable=(?:"true"|'true'|true)[^>]*>)([\s\S]*?)(<\/\2>)/gi
      : /(<([a-z0-9]+)\b[^>]*\bclass=["'][^"']*\bimg-placeholder\b[^"']*["'][^>]*>)([\s\S]*?)(<\/\2>)/gi;
    let cur = 0;
    return String(html || '').replace(re, (full, open, _tag, _body, close) => {
      if (cur++ === targetIdx) return `${open}${innerHtml}${close}`;
      return full;
    });
  }
  const body = parseBody(html);
  const hit = editTargets(body).find(([k]) => k === key);
  if (!hit) return html;
  const [, el] = hit;
  // Pasted text can bring markup along; anything that runs code is dropped.
  const scratch = parseBody(innerHtml);
  scratch.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach(n => n.remove());
  scratch.querySelectorAll('*').forEach((n) => {
    for (const a of [...n.attributes]) {
      if (/^on/i.test(a.name) || (/^(src|href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
    }
  });
  if (el.innerHTML === scratch.innerHTML) return html;
  el.innerHTML = scratch.innerHTML;
  return body.innerHTML;
}

// Runs inside the preview only. Photos are scaled to 2560 px and stored as
// WebP, so a page with several stays inside one mesh packet (meshLimits.js).
export const EDIT_BRIDGE_SCRIPT = `<style>
  [data-nb^="t"] {
    transition: outline 0.15s ease, background-color 0.15s ease;
    border-radius: 4px;
  }
  [data-nb^="t"]:hover {
    outline: 1px dashed rgba(0, 240, 255, 0.55);
    outline-offset: 3px;
  }
  [data-nb^="t"]:focus {
    outline: 2px solid #00f0ff;
    outline-offset: 4px;
    background-color: rgba(0, 240, 255, 0.05);
  }
  [data-nb^="i"] {
    position: relative;
    cursor: pointer !important;
    transition: outline 0.15s ease, transform 0.15s ease;
  }
  [data-nb^="i"]:hover {
    outline: 2px dashed #00f0ff;
    outline-offset: 2px;
  }
  [data-nb^="i"]::after {
    content: '📷 Click or Drop Image';
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(5, 8, 20, 0.85);
    color: #00f0ff;
    border: 1px solid rgba(0, 240, 255, 0.45);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 700;
    font-family: system-ui, sans-serif;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  [data-nb^="i"]:hover::after {
    opacity: 1;
  }
</style>
<script>(function () {
  function send(key, html) { parent.postMessage({ novauraBuilderEdit: 1, key: key, html: html }, '*'); }
  var timers = {};

  function processImageFile(file, el) {
    if (!file || file.type.indexOf('image/') !== 0) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var s = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      el.innerHTML = '<img src="' + c.toDataURL('image/webp', 0.9) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />';
      send(el.dataset.nb, el.innerHTML);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  document.addEventListener('input', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-nb^="t"]');
    if (!el) return;
    clearTimeout(timers[el.dataset.nb]);
    timers[el.dataset.nb] = setTimeout(function () { send(el.dataset.nb, el.innerHTML); }, 300);
  }, true);

  document.addEventListener('dragover', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-nb^="i"]');
    if (el) { e.preventDefault(); el.classList.add('drag-hover'); }
  }, true);

  document.addEventListener('dragleave', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-nb^="i"]');
    if (el) { el.classList.remove('drag-hover'); }
  }, true);

  document.addEventListener('drop', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-nb^="i"]');
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!el || !file) return;
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-hover');
    processImageFile(file, el);
  }, true);

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-nb^="i"]');
    if (!el || el.querySelector('input[type="file"]')) return;
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.onchange = function () {
      var file = inp.files && inp.files[0];
      if (file) processImageFile(file, el);
    };
    document.body.appendChild(inp);
    inp.click();
    setTimeout(function () { inp.remove(); }, 1000);
  }, true);

  // Listen for live updates from the parent Quick Fill-in-the-Blanks drawer
  window.addEventListener('message', function (e) {
    if (e.source !== parent || !e.data || !e.data.novauraDrawerPatch || typeof e.data.html !== 'string') return;
    var target = document.querySelector('[data-nb="' + e.data.key + '"]');
    if (target) {
      target.innerHTML = e.data.html;
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
})();</script>`;
