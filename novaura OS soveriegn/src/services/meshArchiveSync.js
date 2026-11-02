/**
 * meshArchiveSync.js — Catch-up for listings published while this node was offline.
 *
 * The relay keeps publisher-signed listings (relay/src/archive.rs). Each time the
 * relay tunnel comes up, this node asks for everything archived after the last
 * batch it finished, and remembers the new cursor per relay address. Replayed
 * packets go through the normal mesh handler, which re-verifies each signature.
 */

import { getPhysicalMeshStatus, sendDirectMeshPacket } from './sovereignMesh.js';

const CURSOR_KEY = 'novaura-archive-cursors';

function readCursors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CURSOR_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCursor(relay, untilMs) {
  try {
    const cursors = readCursors();
    if (untilMs > (Number(cursors[relay]) || 0)) {
      cursors[relay] = untilMs;
      localStorage.setItem(CURSOR_KEY, JSON.stringify(cursors));
    }
  } catch {
    // Storage unavailable: the next sync simply starts from the beginning.
  }
}

/** Ask the connected relay for listings archived since the last finished sync. */
export async function requestArchiveSync() {
  const status = await getPhysicalMeshStatus();
  if (!status?.relay_connected || !status.relay_address) return false;
  const since = Number(readCursors()[status.relay_address]) || 0;
  return sendDirectMeshPacket('relay_supervisor', 'MESH_ARCHIVE_SYNC', { since_ms: since });
}

let started = false;

/** Start syncing on every relay connection (desktop app only). Safe to call twice. */
export function startArchiveSync() {
  if (started || typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
  started = true;

  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('novaura://mesh-relay-connected', () => {
      requestArchiveSync().catch(() => {});
    }).catch(() => {});
    listen('novaura://mesh-archive-done', (event) => {
      const { relay, until_ms: untilMs } = event.payload || {};
      if (relay && Number(untilMs) > 0) saveCursor(relay, Number(untilMs));
    }).catch(() => {});
  });

  // The tunnel may already be up before these listeners were attached.
  requestArchiveSync().catch(() => {});
}

// Runs at import: SovereignDesktop imports this module once at boot.
startArchiveSync();
