// userApps.js — Puts the user's saved apps (additions) into the launcher at boot and
// whenever the Forge or Cybeni adds or removes one.

import { db } from '../../database/sovereignDatabase.js';
import { registerUserApps } from '../../config/appRegistry.js';
import { ensureMigrated } from '../additions/migrate.js';

const iconUrls = new Map();

async function load() {
  // Apps added before additions existed are moved over (once) before they're listed.
  await ensureMigrated();
  const apps = await db.getSetting('user_apps', []).catch(() => []);
  const list = [];
  for (const a of apps) {
    let iconUrl = null;
    if (a.iconBlobId) {
      iconUrl = iconUrls.get(a.iconBlobId);
      if (!iconUrl) {
        const blob = (await db.media_blobs.get(a.iconBlobId).catch(() => null))?.blob;
        if (blob) {
          iconUrl = URL.createObjectURL(blob);
          iconUrls.set(a.iconBlobId, iconUrl);
        }
      }
    }
    list.push({ ...a, iconUrl });
  }
  registerUserApps(list);
}

if (typeof window !== 'undefined') {
  load();
  window.addEventListener('novaura:user_apps_changed', load);
}
