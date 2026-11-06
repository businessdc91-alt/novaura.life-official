// profiles.js — the people who use Sovereign on this PC, each with their own data
// (src-tauri/src/profiles.rs). The picker (components/ProfilePicker.jsx) runs at startup;
// entering a profile other than the one this process holds restarts the app into it.

import { isTauriApp } from './popoutWindows.js';

export const MAIN_PROFILE = 'main';
export const PROFILE_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185', '#f97316'];

async function call(command, args) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
}

/** Profiles need the native app; a browser preview has only the one it runs in. */
export const profilesAvailable = () => isTauriApp();

export const getProfilesState = () => call('profiles_state');
export const createProfile = (name, color, password) => call('profile_create', { name, color, password: password || null });
export const updateProfile = (id, name, color) => call('profile_update', { id, name, color });
/** Set, change (`current` needed when it has one) or remove (`next` empty) a password. */
export const setProfilePassword = (id, current, next) => call('profile_set_password', { id, current: current || null, next: next || null });
/** Resolves with the profile's Documents folder, which is kept. */
export const removeProfile = (id, password) => call('profile_remove', { id, password: password || null });
/** Resolves { relaunching }: true when the app is restarting into the profile. */
export const enterProfile = (id, password) => call('profile_enter', { id, password: password || null });
/** Restart to the profile picker. */
export const switchProfile = () => call('profile_switch');
export const getAutostart = () => call('autostart_get');
export const setAutostart = (enabled) => call('autostart_set', { enabled });

/** The profile "Skip sign in" opens: the last one used, else main, if it has no password. */
export function skipTarget(state) {
  const profiles = state?.profiles || [];
  const last = profiles.find(p => p.id === state?.lastUsed) || profiles.find(p => p.id === MAIN_PROFILE);
  return last && !last.hasPassword ? last : null;
}

/** One or two letters for a profile's badge. */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : [...words[0]].slice(0, 2).join('');
  return letters.toUpperCase();
}

/** The same rules profiles.rs applies, so the form can say what's wrong before asking. */
export function profileFormProblem({ name, password = '', confirm = '' }) {
  const trimmed = String(name || '').trim();
  if (!trimmed || [...trimmed].length > 32) return 'A profile name is 1 to 32 characters.';
  if (password && ([...password].length < 4 || [...password].length > 128)) return 'A password is 4 to 128 characters.';
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}
