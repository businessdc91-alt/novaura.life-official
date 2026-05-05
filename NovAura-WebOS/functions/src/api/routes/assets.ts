import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as crypto from 'crypto';
import { moderateAsset } from '../../services/moderationService';

const router = Router();

// ─── Helper: generate a signed download URL from Firebase Storage ─────────────
async function getSignedDownloadUrl(storagePath: string): Promise<string> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
  });
  return url;
}

// ─── POST /assets/upload ──────────────────────────────────────────────────────
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const {
      creatorId,
      title,
      description,
      shortDescription,
      category,
      licenseTier,
      price,
      tags,
      foundationAssets,
      revenueSplits,
      // Base64 encoded files
      mainFileData,      // { name, type, base64 }
      thumbnailData,     // { name, type, base64 }
      previewFilesData,  // [{ name, type, base64 }]
    } = req.body;

    if (!creatorId || !title || (!mainFileData && !req.body.mainFilePath)) {
      return res.status(400).json({ error: 'Missing required fields: creatorId, title, and file data' });
    }

    // Verify creator exists
    const creatorDoc = await db.collection('users').doc(creatorId).get();
    if (!creatorDoc.exists) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const assetId = db.collection('assets').doc().id;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Upload main file or use existing path
    let mainPath = '';
    let mainFileSize = 0;
    let mainFileName = '';
    let mainFileType = '';

    if (req.body.mainFilePath) {
      mainPath = req.body.mainFilePath;
      mainFileSize = req.body.mainFileSize || 0;
      mainFileName = req.body.mainFileName || 'asset.zip';
      mainFileType = req.body.mainFileType || 'application/octet-stream';
    } else if (mainFileData) {
      const mainExt = path.extname(mainFileData.name) || '';
      mainPath = `assets/${assetId}/main${mainExt}`;
      const mainBuffer = Buffer.from(mainFileData.base64, 'base64');
      await bucket.file(mainPath).save(mainBuffer, {
        metadata: { contentType: mainFileData.type, metadata: { assetId, creatorId } }
      });
      mainFileSize = mainBuffer.length;
      mainFileName = mainFileData.name;
      mainFileType = mainFileData.type;
    } else {
      return res.status(400).json({ error: 'No main file provided' });
    }

    // Upload thumbnail if provided
    let thumbnailUrl = '';
    let thumbnailPath = '';
    if (thumbnailData) {
      const thumbExt = path.extname(thumbnailData.name) || '.jpg';
      thumbnailPath = `assets/${assetId}/thumbnail${thumbExt}`;
      const thumbBuffer = Buffer.from(thumbnailData.base64, 'base64');
      await bucket.file(thumbnailPath).save(thumbBuffer, {
        metadata: { contentType: thumbnailData.type }
      });
      await bucket.file(thumbnailPath).makePublic();
      thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailPath}`;
    }

    // Upload preview files if provided
    const previewUrls: string[] = [];
    if (previewFilesData && Array.isArray(previewFilesData)) {
      for (let i = 0; i < previewFilesData.length; i++) {
        const preview = previewFilesData[i];
        const prevExt = path.extname(preview.name) || '';
        const prevPath = `assets/${assetId}/preview_${i}${prevExt}`;
        const prevBuffer = Buffer.from(preview.base64, 'base64');
        await bucket.file(prevPath).save(prevBuffer, {
          metadata: { contentType: preview.type }
        });
        await bucket.file(prevPath).makePublic();
        previewUrls.push(`https://storage.googleapis.com/${bucket.name}/${prevPath}`);
      }
    }

    // ─── IMPLEMENT BACKUP EXISTENCE ───────────────────────────────────────────
    const backupPath = `backups/assets/${assetId}_${mainFileName}`;
    try {
      await bucket.file(mainPath).copy(bucket.file(backupPath));
    } catch (err) {
      console.warn('[Assets Upload] Backup copy failed (continuing):', err);
    }

    const licenseKey = `NVA-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Save asset metadata to Firestore
    const assetData: any = {
      id: assetId,
      slug,
      title,
      description: description || '',
      shortDescription: shortDescription || '',
      category: category || 'other',
      licenseTier: licenseTier || 'opensource',
      price: Number(price) || 0,
      tags: Array.isArray(tags) ? tags : (tags ? JSON.parse(tags) : []),
      foundationAssets: foundationAssets || [],
      revenueSplits: revenueSplits || [],
      creatorId,
      mainFilePath: mainPath,
      backupFilePath: backupPath,
      mainFileName,
      mainFileSize,
      mainFileType,
      files: [
        {
          id: 'main',
          fileName: mainFileName,
          fileSize: mainFileSize,
          fileType: mainFileType,
          path: mainPath,
        }
      ],
      thumbnailUrl,
      previewUrls,
      licenseKey,
      status: 'pending',
      downloadCount: 0,
      salesCount: 0,
      rating: 0,
      reviewCount: 0,
      moderationReason: '',
      moderationConfidence: 0,
      createdAt: now,
      updatedAt: now,
    };

    // ─── AI MODERATION (NOVA) ────────────────────────────────────────────────
    try {
      const modResult = await moderateAsset({
        title,
        description,
        tags: assetData.tags,
        thumbnailUrl,
        isContestEntry: req.body.isContest || false
      });
      
      assetData.status = modResult.status;
      assetData.moderationReason = modResult.reason;
      assetData.moderationConfidence = modResult.confidence;
    } catch (err) {
      console.warn('[Assets Upload] AI Moderation failed:', err);
    }

    await db.collection('assets').doc(assetId).set(assetData);

    await db.collection('users').doc(creatorId).update({
      assetIds: admin.firestore.FieldValue.arrayUnion(assetId)
    });

    return res.json({
      success: true,
      assetId,
      slug,
      thumbnailUrl,
      status: assetData.status,
      message: assetData.status === 'approved' 
        ? 'Asset uploaded and auto-approved by Nova.' 
        : 'Asset uploaded. Pending review.',
    });
  } catch (error: any) {
    console.error('[Assets Upload] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── GET /assets/:id ──────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('assets').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Asset not found' });
    const data = doc.data()!;
    const { mainFilePath, licenseKey, ...publicData } = data;
    return res.json(publicData);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── GET /assets/:id/download ─────────────────────────────────────────────────
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;
    const assetId = req.params.id;

    const assetDoc = await db.collection('assets').doc(assetId).get();
    if (!assetDoc.exists) return res.status(404).json({ error: 'Asset not found' });
    const assetData = assetDoc.data()!;

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const purchasedAssets: string[] = userData?.purchasedAssetIds || [];

    const isFree = assetData.price === 0;
    const hasPurchased = purchasedAssets.includes(assetId);
    const isCreator = assetData.creatorId === userId;

    if (!isFree && !hasPurchased && !isCreator) {
      return res.status(403).json({ error: 'Purchase required' });
    }

    const signedUrl = await getSignedDownloadUrl(assetData.mainFilePath);

    await db.collection('downloads').add({
      userId,
      assetId,
      fileName: assetData.mainFileName,
      downloadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('assets').doc(assetId).update({
      downloadCount: admin.firestore.FieldValue.increment(1)
    });

    return res.json({
      url: signedUrl,
      fileName: assetData.mainFileName,
      expiresIn: 7200,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── GET /assets (browse/list) ────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const { category, limit = '20', sort = 'createdAt' } = req.query;
    let query: admin.firestore.Query = db.collection('assets').where('status', '==', 'approved');
    if (category) query = query.where('category', '==', category);
    query = query.orderBy(sort as string, 'desc').limit(Number(limit));
    const snapshot = await query.get();
    const assets = snapshot.docs.map(doc => {
      const { mainFilePath, licenseKey, ...data } = doc.data();
      return data;
    });
    return res.json({ assets, total: assets.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
