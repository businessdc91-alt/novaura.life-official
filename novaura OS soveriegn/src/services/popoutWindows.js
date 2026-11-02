/**
 * popoutWindows.js — Sovereign apps in their own native windows.
 *
 * A popped-out app runs in a separate Tauri window that loads only that app
 * (`?popout=<appId>`), so it can sit on any monitor next to normal programs.
 * Every window shares IndexedDB, localStorage and the native mesh, but each
 * has its own JS memory. To keep them consistent:
 * - The main window stays the only one that handles incoming mesh packets
 *   (see sovereignMesh.js), so nothing is processed twice.
 * - A BroadcastChannel bridge carries `novaura:*` UI events between windows.
 *   Popouts receive state notifications (…_updated, …_changed, …). The main
 *   window also receives commands from popouts (open a window, open a
 *   project), because only it has a desktop to act on.
 */

export const POPOUT_PARAM = 'popout';
const BRIDGE_CHANNEL = 'novaura_window_bridge';
const STATE_EVENT = /^novaura:[a-z_]*(_updated|_changed|_received|_resolved|_discovered|_lost|_sent|_failed|_saved|_deleted|_logged|_delivered|_results|_response|_room_switched)$/;
const SHARED_EVENTS = new Set(['novaura-theme', 'novaura-graphics']);
const COMMAND_EVENTS = new Set(['novaura-open-window']);

export function isTauriApp() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

/** The app this window hosts, or null in the main desktop window. */
export function popoutAppId() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(POPOUT_PARAM);
}

export function isPopoutWindow() {
  return Boolean(popoutAppId());
}

/** Props handed to the popped-out app (JSON in the URL hash). */
export function popoutProps() {
  try {
    const raw = new URLSearchParams(window.location.hash.slice(1)).get('props');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function serializableProps(props) {
  try {
    return JSON.parse(JSON.stringify(props || {}));
  } catch {
    return {};
  }
}

// Where the cursor sits in a new window's native title bar when it is dragged
// out of the desktop.
const TITLE_BAR_GRAB_Y = 14;

/**
 * Opens `appId` in its own native window. `rect` is the in-desktop window's
 * bounding box in CSS pixels; the native window opens over the same spot on
 * screen. Resolves once the window exists.
 *
 * Dragged out of the desktop: `at` = { screenX, screenY, grabX } puts the new
 * window under the cursor, and when `stillHeld()` is true once it exists, the
 * window keeps following the mouse (native move) until the button is released.
 */
export async function popOutApp(appId, { props = {}, title = appId, rect = null, size = null, at = null, stillHeld = null } = {}) {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');

  const width = Math.round(rect?.width || size?.width || 900);
  const height = Math.round(rect?.height || size?.height || 620);
  const geometry = { width, height, minWidth: 360, minHeight: 260 };
  if (at) {
    // Screen coordinates from pointer events are logical pixels, like Tauri's.
    const grabX = Math.max(20, Math.min(width - 140, at.grabX ?? width / 2));
    geometry.x = Math.round(at.screenX - grabX);
    geometry.y = Math.round(at.screenY - TITLE_BAR_GRAB_Y);  } else if (rect) {
    try {
      const main = getCurrentWindow();
      const scale = await main.scaleFactor();
      const inner = await main.innerPosition();
      geometry.x = Math.round(inner.x / scale + rect.left);
      geometry.y = Math.round(inner.y / scale + rect.top);
    } catch {
      geometry.center = true;
    }
  } else {
    geometry.center = true;
  }

  const query = new URLSearchParams({ [POPOUT_PARAM]: appId });
  const hash = new URLSearchParams({ props: JSON.stringify(serializableProps(props)) });
  const label = `popout-${appId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now().toString(36)}`;
  const win = new WebviewWindow(label, {
    url: `/?${query}#${hash}`,
    title: `${title} — Novaura Sovereign`,
    ...geometry,
    resizable: true,
    decorations: true,
    focus: true,
    // Same as the main window: HTML5 drag-and-drop instead of native file drops.
    dragDropEnabled: false,
  });

  await new Promise((resolve, reject) => {
    win.once('tauri://created', resolve);
    win.once('tauri://error', (e) => reject(new Error(String(e?.payload || 'Could not open the window'))));
  });
  // Only while the button is still down: a native move started after release
  // would leave the window stuck to the cursor until the next click.
  if (stillHeld?.()) {
    await win.startDragging().catch((err) => console.warn('[Popout] Could not continue the drag:', err));
  }
  return label;
}

/** From a popout: put the app back on the desktop and close this window. */
export async function returnToDesktop(appId, props = {}) {
  postBridge({ type: 'novaura-open-window', detail: { appId, props: serializableProps(props), toggle: false } });
  // Let the message leave before this window goes away.
  await new Promise(r => setTimeout(r, 150));
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}

// ── Event bridge ──────────────────────────────────────────────────────────

let bridge = null;
let nativeDispatch = null;

function postBridge(message) {
  if (!bridge) return;
  try {
    bridge.postMessage({ ...message, from: isPopoutWindow() ? 'popout' : 'main' });
  } catch {
    // Detail not cloneable (functions, DOM nodes): stays local.
  }
}

/** Whether this window sends a local event to the other windows. */
export function forwardable(type) {
  return STATE_EVENT.test(type) || SHARED_EVENTS.has(type) || (isPopoutWindow() && (type.startsWith('novaura:') || COMMAND_EVENTS.has(type)));
}

/** Whether this window replays an event that arrived from another window. */
export function acceptable(type, from) {
  if (STATE_EVENT.test(type) || SHARED_EVENTS.has(type)) return true;
  // Commands only make sense where the desktop is.
  return !isPopoutWindow() && from === 'popout';
}

/** Start relaying UI events between this window and the others. Idempotent. */
export function startWindowBridge() {
  if (bridge || typeof window === 'undefined' || !window.BroadcastChannel || !isTauriApp()) return;
  try {
    bridge = new BroadcastChannel(BRIDGE_CHANNEL);
  } catch {
    return;
  }

  nativeDispatch = window.dispatchEvent.bind(window);
  window.dispatchEvent = (event) => {
    const result = nativeDispatch(event);
    if (event instanceof CustomEvent && !event.__novauraBridged && forwardable(event.type)) {
      postBridge({ type: event.type, detail: event.detail });
    }
    return result;
  };

  bridge.onmessage = ({ data }) => {
    if (!data?.type || !acceptable(data.type, data.from)) return;
    const event = new CustomEvent(data.type, { detail: data.detail });
    event.__novauraBridged = true;
    nativeDispatch(event);
  };
}
