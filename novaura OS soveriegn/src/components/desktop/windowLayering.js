// Desktop window layering — which chrome rides above or below the windows.
//
// WindowManager hands open windows z-indexes in roughly the 100..7000 range.
// The left app-menu sidebar (7500) and right telemetry HUD (7600) normally ride
// above that range so they stay reachable over floating/minimized windows.
//
// But a *maximized* window fills the whole desktop canvas, and a sidebar painted
// on top of it bleeds its words and icons over the window's edge (you couldn't
// read Cybeni fullscreen). So while any window is covering the desktop, the
// sidebars drop *beneath* the window layer; the moment nothing is maximized they
// snap back on top. The top system bar and bottom prompt bar are unaffected and
// always stay reachable.

export const SIDEBAR_Z_LEFT = 7500; // left app-menu sidebar, normal
export const SIDEBAR_Z_RIGHT = 7600; // right telemetry HUD, normal
export const SIDEBAR_Z_DEMOTED = 20; // below the window layer (~100+), above the wallpaper

/**
 * A window pushes the sidebars under itself only while it is genuinely covering
 * the screen: maximized AND visible. A maximized window that has been minimized
 * covers nothing, so the sidebars must come back.
 */
export function coversDesktop(win) {
  return Boolean(win && win.maximized && !win.minimized);
}

/**
 * Does any tracked window currently cover the desktop? Accepts a Set or an array
 * of window ids (whatever the desktop is tracking), tolerating null/undefined.
 */
export function anyCovers(ids) {
  if (!ids) return false;
  if (Array.isArray(ids)) return ids.length > 0;
  return (ids.size ?? 0) > 0;
}

/** The z-index a sidebar should use given whether it is demoted under a covering window. */
export function sidebarZIndex(base, demoted) {
  return demoted ? SIDEBAR_Z_DEMOTED : base;
}
