// buildInfo.js — which build this is. vite.config.js stamps in the version from
// src-tauri/tauri.conf.json and the time of the build; scripts/tauri-gnu.ps1 raises
// the version by one for every packaged build, so no two installers share a number.
/* global __APP_VERSION__, __BUILD_TIME__ */

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : null;

/** When this build was made, e.g. "Nov 6, 2026, 2:10 AM". */
export function buildDateLabel() {
  if (!BUILD_TIME) return 'not a packaged build';
  return new Date(BUILD_TIME).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
