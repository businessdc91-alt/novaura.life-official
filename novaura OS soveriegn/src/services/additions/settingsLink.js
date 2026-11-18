// settingsLink.js — Opens Settings → Additions, optionally on one addition. The
// settings window may not exist yet when this runs, so the addition to show is kept
// here until the panel takes it.

let pendingFocus = null;

export function openAdditionSettings(appId = null) {
  pendingFocus = appId || null;
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'settings', props: { defaultTab: 'additions' }, toggle: false } }));
  window.dispatchEvent(new CustomEvent('novaura:open_settings_tab', { detail: 'additions' }));
  window.dispatchEvent(new CustomEvent('novaura:focus_addition', { detail: pendingFocus }));
}

/** The addition Settings was asked to show, once; null when there is none. */
export function takePendingAdditionFocus() {
  const appId = pendingFocus;
  pendingFocus = null;
  return appId;
}
