// builderEditBridge.js — Lets edits made inside the Website Builder preview
// (typing into contenteditable text, dropping a photo on an image spot) flow
// back into the page source, so they are saved and published.
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

/** The page body with element `key` holding `innerHtml`, or the input unchanged. */
export function applyBuilderEdit(html, key, innerHtml) {
  if (!/^[ti]\d{1,4}$/.test(String(key))) return html;
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

// Runs inside the preview only. Photos are scaled to 1024 px and stored as
// WebP, so a page with several stays under the mesh's 512 KB site limit.
export const EDIT_BRIDGE_SCRIPT = `<script>(function () {
  function send(key, html) { parent.postMessage({ novauraBuilderEdit: 1, key: key, html: html }, '*'); }
  var timers = {};

  function processImageFile(file, el) {
    if (!file || file.type.indexOf('image/') !== 0) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var s = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      el.innerHTML = '<img src="' + c.toDataURL('image/webp', 0.82) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />';
      send(el.dataset.nb, el.innerHTML);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  document.addEventListener('input', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-nb^="t"]');
    if (!el) return;
    clearTimeout(timers[el.dataset.nb]);
    timers[el.dataset.nb] = setTimeout(function () { send(el.dataset.nb, el.innerHTML); }, 400);
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
})();</script>`;
