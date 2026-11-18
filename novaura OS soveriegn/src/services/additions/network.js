// Which network origins an addition may be allowed to reach. Mirrors
// src-tauri/src/addition_csp_rules.rs (the CSP itself is only ever built in Rust);
// both are checked against tests/additions/network-origins.cases.txt.
//
// Only https:// and wss:// with a dotted DNS name are accepted. IP literals,
// localhost and every *.localhost name (including ipc.localhost, the OS's own IPC
// host) are refused, so an addition can never be granted a local server.

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The cleaned origin (`scheme://host[:port]`, lowercase), or null. */
export function cleanNetworkOrigin(input) {
  if (typeof input !== 'string') return null;
  const s = input.endsWith('/') ? input.slice(0, -1) : input;
  const sep = s.indexOf('://');
  if (sep < 0) return null;
  const scheme = s.slice(0, sep).toLowerCase();
  if (scheme !== 'https' && scheme !== 'wss') return null;
  const rest = s.slice(sep + 3);
  if (!rest || !/^[A-Za-z0-9.:-]+$/.test(rest)) return null;

  const colon = rest.indexOf(':');
  const host = (colon < 0 ? rest : rest.slice(0, colon)).toLowerCase();
  let port = null;
  if (colon >= 0) {
    const p = rest.slice(colon + 1);
    if (!/^\d{1,5}$/.test(p)) return null;
    port = Number(p);
    if (port < 1 || port > 65535) return null;
  }

  if (host.length > 253 || host.endsWith('.')) return null;
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  const last = labels[labels.length - 1];
  if (/^\d+$/.test(last) || last === 'localhost') return null;

  return port == null ? `${scheme}://${host}` : `${scheme}://${host}:${port}`;
}

/** scheme://host[:port] of any network URL (http, https, ws, wss), or null. */
export function originOf(url) {
  try {
    const u = new URL(url);
    if (!/^(https?|wss?):$/.test(u.protocol)) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
