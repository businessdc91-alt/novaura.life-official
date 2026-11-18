// host.js — The OS end of one addition launch. The frame says hello with the launch
// nonce; the host checks that the message came from this window's own frame and that
// the nonce matches, then hands the frame one MessageChannel port. Everything after
// that goes through the port to the router. A page the frame navigates to never
// learns the nonce, and the port is only ever handed over once.

import { DRAIN_MS } from './limits.js';

/** Compare two strings without returning early on the first difference. */
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function connectAddition({ frame, nonce, hostWindow = window, router, onRelaunch = () => {}, drainMs = DRAIN_MS }) {
  let port = null;
  let accepting = true;
  let disposed = false;

  function reply(msg) {
    if (!port) return;
    try {
      port.postMessage(msg);
    } catch (err) {
      if (typeof msg?.id === 'number') port.postMessage({ id: msg.id, ok: false, e: { code: 'internal', message: String(err?.message || err) } });
    }
  }

  function onPortMessage(ev) {
    Promise.resolve()
      .then(() => router.handle(ev.data))
      .then((out) => { if (out) reply(out); })
      .catch((err) => {
        const id = ev.data?.id;
        if (typeof id === 'number') reply({ id, ok: false, e: { code: 'internal', message: String(err?.message || err) } });
      });
  }

  function onMessage(e) {
    if (!frame.contentWindow || e.source !== frame.contentWindow) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.__novaura === 'relaunch') {
      if (!disposed) onRelaunch({ path: typeof d.path === 'string' ? d.path : '' });
      return;
    }
    if (d.__novaura !== 'hello' || !accepting || port) return;
    if (!sameText(String(d.nonce ?? ''), nonce)) return;
    accepting = false;
    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = onPortMessage;
    // The frame has an opaque origin, so there is no origin to name here; the port
    // goes to this one window.
    frame.contentWindow.postMessage({ __novaura: 'port' }, '*', [channel.port2]);
  }

  hostWindow.addEventListener('message', onMessage);

  return {
    pushTheme(theme) {
      if (port && !disposed) reply({ t: 'theme', theme });
    },
    /** Stop accepting; messages already on the port are still answered for `drainMs`. */
    dispose() {
      if (disposed) return;
      disposed = true;
      accepting = false;
      hostWindow.removeEventListener('message', onMessage);
      const closing = port;
      setTimeout(() => {
        try { closing?.close(); } catch { /* already closed */ }
        if (port === closing) port = null;
      }, drainMs);
    },
  };
}
