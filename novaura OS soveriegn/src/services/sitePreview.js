// sitePreview.js — Show a one-page site in a frame with its inline scripts running.
//
// The OS window's CSP carries script hashes, and any hash or nonce switches off
// 'unsafe-inline'; srcdoc frames inherit that policy, so inline scripts never
// run in one. In the app the page is served from the isolated cyprev protocol
// instead (src-tauri/src/preview.rs) with a policy of its own: the preview
// policy for your own pages, a no-network policy (`strict`) for pages that came
// over the mesh. The frame stays sandboxed without allow-same-origin, so the
// page has an opaque origin either way and cannot reach the OS or its storage.

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

export function newSiteSession() {
  return 'site' + Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('');
}

function baseUrl(session) {
  // Tauri serves custom protocols as http://<scheme>.localhost on Windows.
  return /Windows/i.test(navigator.userAgent) ? `http://cyprev.localhost/${session}/` : `cyprev://localhost/${session}/`;
}

/** Load `html` into `frame`. Resolves once the page has been handed over (not when it has loaded). */
export async function loadSiteIntoFrame(frame, html, { session, strict = false, popups = true } = {}) {
  if (!frame) return;
  frame.setAttribute('sandbox', `allow-scripts allow-forms allow-modals${popups ? ' allow-popups' : ''}`);
  if (!isTauri()) {
    frame.removeAttribute('src');
    frame.srcdoc = html;
    return;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('site_preview_publish', { session, html, strict });
  frame.removeAttribute('srcdoc');
  frame.src = `${baseUrl(session)}index.html?v=${Date.now()}`;
}

export async function clearSitePreview(session) {
  if (!isTauri() || !session) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('cybeni_preview_clear', { session });
  } catch { /* best effort */ }
}
