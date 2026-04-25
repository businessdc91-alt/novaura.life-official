/**
 * Music Generation Routes
 * Music is FREE with subscription - no credits deducted
 */

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
    }
  }
}

// Middleware to verify Firebase auth
const verifyAuth = async (req: Request, res: Response, next: Function): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'No token' });
      return;
    }
    
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Helper: Get API key (user or platform)
 * Users with their own keys get priority, unlimited usage
 */
async function getApiKey(userId: string): Promise<{ key: string; source: 'user' | 'platform' } | null> {
  // Check if user has their own key (premium feature)
  const userKeysDoc = await db.collection('user_api_keys').doc(userId).get();
  const userKeyData = userKeysDoc.data()?.['gemini'];
  
  if (userKeyData?.key) {
    try {
      const decrypted = decryptKey(userKeyData.key);
      return { key: decrypted, source: 'user' };
    } catch (e) {
      console.error('[Music] Failed to decrypt user key:', e);
    }
  }
  
  // Fall back to platform key
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'platform' };
  }
  
  return null;
}

// Generate music (FREE with subscription)
router.post('/generate', verifyAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      prompt, 
      duration = 30,
      temperature = 0.8,
      model = 'lyria-3-clip-preview'
    } = req.body;

    const userId = req.user!.uid;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Get API key (user or platform)
    const apiKeyData = await getApiKey(userId);
    if (!apiKeyData) {
      res.status(503).json({ error: 'Music generation service not configured' });
      return;
    }

    // Create generation record
    const generationRef = await db.collection('music_generations').add({
      userId,
      prompt,
      duration,
      temperature,
      model,
      apiSource: apiKeyData.source,
      status: 'generating',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Initialize Gemini client with appropriate key
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKeyData.key });

    // Generate music
    const response = await ai.models.generateContentStream({
      model: model,
      contents: prompt,
    });

    let audioBase64 = "";
    let lyrics = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    if (!audioBase64) {
      await generationRef.update({ 
        status: 'failed',
        error: 'No audio generated'
      });
      res.status(502).json({ error: 'No audio generated' });
      return;
    }

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `music/${userId}/${generationRef.id}.wav`;
    const file = bucket.file(fileName);
    
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await file.save(audioBuffer, { 
      metadata: { 
        contentType: mimeType,
        metadata: {
          userId,
          prompt,
          model,
          generationId: generationRef.id
        }
      } 
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    // Update generation record
    await generationRef.update({
      status: 'completed',
      audioUrl: url,
      storagePath: fileName,
      lyrics,
      mimeType,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log usage (for analytics, not billing)
    await db.collection('usage').add({
      userId,
      service: 'music',
      model,
      apiSource: apiKeyData.source,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      generationId: generationRef.id,
      status: 'completed',
      audioUrl: url,
      lyrics,
      mimeType,
      apiSource: apiKeyData.source,
      free: true // Indicate this is free
    });

  } catch (error: any) {
    console.error('[Music] Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Text to Speech (FREE)
router.post('/tts', verifyAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, voice = 'Kore' } = req.body;
    const userId = req.user!.uid;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    // Get API key
    const apiKeyData = await getApiKey(userId);
    if (!apiKeyData) {
      res.status(503).json({ error: 'TTS service not configured' });
      return;
    }

    const { GoogleGenAI, Modality } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKeyData.key });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(502).json({ error: 'No audio generated' });
      return;
    }

    // Upload to storage
    const bucket = admin.storage().bucket();
    const fileName = `tts/${userId}/${Date.now()}.wav`;
    const file = bucket.file(fileName);
    
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    await file.save(audioBuffer, { metadata: { contentType: 'audio/wav' } });
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      audioUrl: url,
      voice,
      free: true
    });

  } catch (error: any) {
    console.error('[Music] TTS error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get generation status
router.get('/status/:generationId', verifyAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { generationId } = req.params;
    const userId = req.user!.uid;

    const doc = await db.collection('music_generations').doc(generationId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    if (doc.data()?.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      generationId,
      ...doc.data()
    });

  } catch (error: any) {
    console.error('[Music] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's music generations
router.get('/history', verifyAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const { limit = 20 } = req.query;

    const snapshot = await db.collection('music_generations')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit as string))
      .get();

    const generations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ generations });

  } catch (error: any) {
    console.error('[Music] History error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Decrypt key
function decryptKey(encrypted: string): string {
  const xorKey = process.env.USER_KEY_ENCRYPTION_SECRET || 'novaura-user-secret';
  const buffer = Buffer.from(encrypted, 'base64');
  let result = '';
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i] ^ xorKey.charCodeAt(i % xorKey.length));
  }
  return result;
}

export default router;
