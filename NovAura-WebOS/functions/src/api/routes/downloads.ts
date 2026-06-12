import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

const STAFF_EMAIL = 'business.dc91@gmail.com';

// Static manifest — can be overridden per-entry in Firestore `downloads_manifest/{appId}`
const DEFAULT_APPS: Record<string, any> = {
  desktop: {
    id: 'desktop',
    name: 'NovAura Desktop',
    version: '1.2.0',
    description: 'The full WebOS experience for your PC. Native game launching, local AI inference with WebGPU, and offline capabilities.',
    staffOnly: false,
    platforms: [
      { id: 'windows', name: 'Windows', type: '.exe', size: '142 MB', storagePath: 'downloads/desktop/windows/NovAura-Desktop-Setup.exe' },
      { id: 'macos',   name: 'macOS',   type: '.dmg', size: '135 MB', storagePath: 'downloads/desktop/macos/NovAura-Desktop.dmg' },
      { id: 'linux',   name: 'Linux',   type: '.AppImage', size: '110 MB', storagePath: 'downloads/desktop/linux/NovAura-Desktop.AppImage' },
    ],
  },
  mobile: {
    id: 'mobile',
    name: 'NovAura Mobile',
    version: '0.9.5-beta',
    description: 'Stay connected on the go. Access your workspace, chat with AI, and manage files from your smartphone.',
    staffOnly: false,
    platforms: [
      { id: 'android', name: 'Android', type: '.apk', size: '45 MB', storagePath: 'downloads/mobile/android/NovAura.apk' },
      { id: 'ios',     name: 'iOS',     type: 'App Store', size: '42 MB', externalUrl: null },
    ],
  },
  'code-partner': {
    id: 'code-partner',
    name: 'NovAura Code Partner',
    version: '2.1.0',
    description: 'Pair-program with the NovAura AI Swarm directly from VS Code.',
    staffOnly: false,
    platforms: [
      { id: 'vscode', name: 'VS Code Extension', type: '.vsix', size: '5 MB', storagePath: 'downloads/code-partner/NovAura-CodingPartner.vsix' },
    ],
  },
  ops: {
    id: 'ops',
    name: 'NovAura Ops',
    version: '1.0.0-rc',
    description: 'Staff client for platform management, AI Swarm monitoring, and master control console.',
    staffOnly: true,
    platforms: [
      { id: 'windows', name: 'Windows', type: '.exe', size: '120 MB', storagePath: 'downloads/ops/windows/NovAura-Ops-Setup.exe' },
    ],
  },
};

async function resolveStaff(authHeader?: string): Promise<{ ok: boolean; uid?: string; email?: string }> {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false };
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    if (decoded.email === STAFF_EMAIL) return { ok: true, uid: decoded.uid, email: decoded.email };
    const snap = await admin.firestore().collection('users').doc(decoded.uid).get();
    const data = snap.data() || {};
    if (data.isStaff === true || data.role === 'staff' || data.role === 'admin') {
      return { ok: true, uid: decoded.uid, email: decoded.email };
    }
    return { ok: false, uid: decoded.uid, email: decoded.email };
  } catch {
    return { ok: false };
  }
}

async function resolveUid(authHeader?: string): Promise<string | undefined> {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    return decoded.uid;
  } catch {
    return undefined;
  }
}

async function loadManifest(): Promise<Record<string, any>> {
  try {
    const snap = await admin.firestore().collection('downloads_manifest').get();
    if (snap.empty) return DEFAULT_APPS;
    const out: Record<string, any> = { ...DEFAULT_APPS };
    snap.docs.forEach(d => { out[d.id] = { ...out[d.id], ...d.data(), id: d.id }; });
    return out;
  } catch {
    return DEFAULT_APPS;
  }
}

async function signedUrl(storagePath: string): Promise<string> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('not_uploaded');
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 30 * 60 * 1000,
  });
  return url;
}

// GET /downloads — manifest (locked = staff items for non-staff)
router.get('/', async (req: Request, res: Response) => {
  try {
    const staff = await resolveStaff(req.headers.authorization);
    const manifest = await loadManifest();
    const apps = Object.values(manifest).map(app => ({
      ...app,
      platforms: app.platforms?.map((p: any) => ({ ...p, storagePath: undefined })),
      locked: app.staffOnly && !staff.ok,
    }));
    res.json({ success: true, apps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /downloads/:appId/:platformId/url — signed download URL
router.get('/:appId/:platformId/url', async (req: Request, res: Response) => {
  const { appId, platformId } = req.params;
  try {
    const [staff, uid] = await Promise.all([
      resolveStaff(req.headers.authorization),
      resolveUid(req.headers.authorization),
    ]);

    const manifest = await loadManifest();
    const app = manifest[appId];
    if (!app) return res.status(404).json({ error: 'App not found' });

    if (app.staffOnly && !staff.ok) {
      return res.status(403).json({ error: 'Staff only', message: 'This download requires staff access.' });
    }

    const platform = (app.platforms || []).find((p: any) => p.id === platformId);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });

    if (platform.externalUrl) {
      return res.json({ success: true, url: platform.externalUrl, external: true });
    }

    if (!platform.storagePath) {
      return res.status(503).json({ error: 'not_ready', message: 'This release is being prepared. Check back soon.' });
    }

    try {
      const url = await signedUrl(platform.storagePath);

      // Fire-and-forget download log
      admin.firestore().collection('download_logs').add({
        appId, platformId,
        userId: uid || 'anonymous',
        version: app.version,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});

      return res.json({ success: true, url, expires: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    } catch (storageErr: any) {
      if (storageErr.message === 'not_uploaded') {
        return res.status(503).json({ error: 'not_ready', message: 'Release artifacts are being finalized. Check back soon.' });
      }
      throw storageErr;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
    return;
  }
});

// POST /downloads/admin/register — staff-only: upsert a download artifact's storagePath/version
router.post('/admin/register', async (req: Request, res: Response) => {
  const staff = await resolveStaff(req.headers.authorization);
  if (!staff.ok) return res.status(403).json({ error: 'Staff only' });

  const { appId, platformId, version, storagePath, externalUrl, size, enabled = true } = req.body;
  if (!appId || !platformId) return res.status(400).json({ error: 'Missing appId or platformId' });

  try {
    const db = admin.firestore();
    const docRef = db.collection('downloads_manifest').doc(appId);
    const snap = await docRef.get();
    const existing = snap.exists ? snap.data() : (DEFAULT_APPS[appId] || {});
    const platforms: any[] = existing.platforms || DEFAULT_APPS[appId]?.platforms || [];
    const idx = platforms.findIndex((p: any) => p.id === platformId);
    const updated = { id: platformId, ...(platforms[idx] || {}), ...(size && { size }), ...(storagePath && { storagePath }), ...(externalUrl !== undefined && { externalUrl }), enabled };
    if (idx >= 0) platforms[idx] = updated;
    else platforms.push(updated);

    await docRef.set({ ...existing, platforms, ...(version && { version }), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ success: true, message: `Registered ${appId}/${platformId}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
