/**
 * Image & Video Generation Routes
 * Images = FREE with subscription
 * Video = Costs credits (expensive)
 */

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Credit costs
const CREDIT_COSTS: Record<string, number> = {
  'veo-3': 5,        // Video generation
  'gemini-image': 0.1, // Gemini/Imagen images (0.1 credit each)
};

// PixAI Models - FREE for all users
const PIXAI_MODELS = {
  TSUBAKI_2: {
    id: '1983308862240288769',
    name: 'Tsubaki.2',
    description: 'Strong prompt understanding & execution, seamless anatomy'
  },
  HARUKA_V2: {
    id: '1861558740588989558',
    name: 'Haruka v2',
    description: 'Stable quality, refined details, accurate hands'
  },
  HOSHINO_V2: {
    id: '1954632828118619567',
    name: 'Hoshino v2',
    description: 'Highly popular style in Japan'
  }
};

// Authentication middleware
const SUPERUSERS = ['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz'];

async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized - No token provided' });
      return;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    
    // Inject superuser privileges
    if (decoded.email && SUPERUSERS.includes(decoded.email)) {
      req.user.tier = 'catalyst';
      req.unlimitedCredits = true;
    }
    
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// Rate limiting (generous for images, strict for video)
const rateLimits = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS = {
  image: { requests: 100, window: 3600000 },      // 100 images/hour
  video: { requests: 10, window: 3600000 }        // 10 videos/hour (paid)
};

function checkRateLimit(userId: string, type: 'image' | 'video'): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const limit = RATE_LIMITS[type];
  const key = `${userId}:${type}`;
  
  const entry = rateLimits.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + limit.window });
    return { allowed: true, remaining: limit.requests - 1, resetIn: limit.window };
  }
  
  if (entry.count >= limit.requests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }
  
  entry.count++;
  return { allowed: true, remaining: limit.requests - entry.count, resetIn: entry.resetTime - now };
}

/**
 * Helper: Get API key (user or platform)
 */
async function getApiKey(userId: string): Promise<{ key: string; source: 'user' | 'platform' } | null> {
  // Check user keys first
  const userKeysDoc = await db.collection('user_api_keys').doc(userId).get();
  const userKeyData = userKeysDoc.data()?.['gemini'];
  
  if (userKeyData?.key) {
    try {
      const decrypted = decryptKey(userKeyData.key);
      return { key: decrypted, source: 'user' };
    } catch (e) {
      console.error('[Generation] Failed to decrypt user key:', e);
    }
  }
  
  // Fall back to platform key
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'platform' };
  }
  
  return null;
}

/**
 * POST /generation/image - Generate images with Gemini (0.1 credit each)
 */
router.post('/image', requireAuth, async (req: Request, res: Response) => {
  try {
    const { 
      prompt, 
      aspectRatio = '1:1',
      negativePrompt,
      model = 'gemini-flash-image'
    } = req.body;

    const userId = (req as any).user.uid;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt required' });
      return;
    }

    // Check credits - Gemini images cost 0.1 credit
    const creditCost = CREDIT_COSTS['gemini-image'];
    const isSuperUser = (req as any).unlimitedCredits;
    
    if (!isSuperUser) {
      const userCredits = await db.collection('user_credits').doc(userId).get();
      const imageCredits = userCredits.exists ? userCredits.data()?.image || 0 : 0;
      
      if (imageCredits < creditCost) {
        res.status(403).json({ 
          error: 'Insufficient credits',
          required: creditCost,
          available: imageCredits,
          message: 'Images cost 0.1 credits each. Use PixAI for free anime images!'
        });
        return;
      }
    }

    // Rate limiting
    const rateLimit = checkRateLimit(userId, 'image');
    if (!rateLimit.allowed) {
      res.status(429).json({ 
        error: 'Rate limit exceeded - try again later',
        resetIn: Math.ceil(rateLimit.resetIn / 1000)
      });
      return;
    }

    // Get API key
    const apiKeyData = await getApiKey(userId);
    if (!apiKeyData) {
      res.status(503).json({ error: 'Image generation service not configured' });
      return;
    }

    // Initialize client
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKeyData.key });

    // Generate image
    const modelName = model === 'gemini-flash-image' 
      ? 'gemini-3.1-flash-image-preview'
      : 'imagen-3.0-generate-002';

    const fullPrompt = negativePrompt 
      ? `${prompt} (avoid: ${negativePrompt})`
      : prompt;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!imageData) {
      res.status(502).json({ error: 'No image generated' });
      return;
    }

    // Upload to storage
    const bucket = admin.storage().bucket();
    const fileName = `images/${userId}/${Date.now()}.png`;
    const file = bucket.file(fileName);
    
    const imageBuffer = Buffer.from(imageData, 'base64');
    await file.save(imageBuffer, { 
      metadata: { 
        contentType: 'image/png',
        metadata: { userId, prompt, model }
      } 
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    // Deduct credits if using platform key (skip for superusers)
    if (apiKeyData.source === 'platform' && !isSuperUser) {
      await db.collection('user_credits').doc(userId).update({
        image: admin.firestore.FieldValue.increment(-creditCost)
      });
    }

    // Log usage
    await db.collection('usage').add({
      userId,
      service: 'image',
      model,
      creditCost: apiKeyData.source === 'platform' ? creditCost : 0,
      apiSource: apiKeyData.source,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      imageUrl: url,
      model,
      creditCost: apiKeyData.source === 'platform' ? creditCost : 0,
      apiSource: apiKeyData.source,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: Math.ceil(rateLimit.resetIn / 1000)
      }
    });

  } catch (err: any) {
    console.error('[Generation] Image error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /generation/image/pixai - Generate anime images with PixAI (ALWAYS FREE)
 */
router.post('/image/pixai', requireAuth, async (req: Request, res: Response) => {
  try {
    const { 
      prompt, 
      modelId = PIXAI_MODELS.TSUBAKI_2.id,
      aspectRatio = '9:16',
      negativePrompt = ''
    } = req.body;

    const userId = (req as any).user.uid;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt required' });
      return;
    }

    // Rate limiting - generous for PixAI since it's free
    const rateLimit = checkRateLimit(userId, 'image');
    if (!rateLimit.allowed) {
      res.status(429).json({ 
        error: 'Rate limit exceeded - try again later',
        resetIn: Math.ceil(rateLimit.resetIn / 1000)
      });
      return;
    }

    // Get PixAI API key (user key preferred, then platform)
    let apiKey: string | null = null;
    let apiSource: 'user' | 'platform' = 'platform';
    
    // Check user keys first
    const userKeysDoc = await db.collection('user_api_keys').doc(userId).get();
    const userKeyData = userKeysDoc.data()?.['pixai'];
    if (userKeyData?.key) {
      try {
        apiKey = decryptKey(userKeyData.key);
        apiSource = 'user';
      } catch (e) {
        console.error('[PixAI] Failed to decrypt user key');
      }
    }
    
    // Fall back to platform key
    if (!apiKey) {
      apiKey = process.env.PIXAI_API_KEY || null;
    }
    
    if (!apiKey) {
      res.status(503).json({ error: 'PixAI service not configured' });
      return;
    }

    // Call PixAI API
    const pixaiResponse = await fetch('https://api.pixai.art/v2/image/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        modelId,
        prompt: negativePrompt ? `${prompt} ### ${negativePrompt}` : prompt,
        aspectRatio,
        mode: 'standard'
      })
    });

    if (!pixaiResponse.ok) {
      const errorData = await pixaiResponse.json().catch(() => ({}));
      res.status(502).json({ 
        error: 'PixAI API error', 
        status: pixaiResponse.status,
        detail: errorData.message || 'Unknown error'
      });
      return;
    }

    const data = await pixaiResponse.json();
    
    // Store generation record
    const generationRef = await db.collection('image_generations').add({
      userId,
      prompt,
      model: 'pixai',
      modelId,
      taskId: data.id,
      apiSource,
      status: 'generating',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      generationId: generationRef.id,
      taskId: data.id,
      status: 'generating',
      message: 'Image generation started. Poll /generation/image/pixai/status/:generationId',
      free: true,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: Math.ceil(rateLimit.resetIn / 1000)
      }
    });

  } catch (err: any) {
    console.error('[PixAI] Generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /generation/image/pixai/status/:generationId
 * Check PixAI generation status
 */
router.get('/image/pixai/status/:generationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { generationId } = req.params;
    const userId = (req as any).user.uid;

    const doc = await db.collection('image_generations').doc(generationId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    const data = doc.data();
    if (!data || data.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // If completed or failed, return current status
    if (data.status === 'completed' || data.status === 'failed') {
      res.json({
        generationId,
        ...data
      });
      return;
    }

    // Check with PixAI
    const apiKey = process.env.PIXAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'PixAI service not configured' });
      return;
    }

    const pixaiResponse = await fetch(`https://api.pixai.art/v1/task/${data.taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!pixaiResponse.ok) {
      res.status(502).json({ error: 'Failed to check status' });
      return;
    }

    const taskData = await pixaiResponse.json();
    
    if (taskData.status === 'completed') {
      const imageUrl = taskData.outputs?.mediaUrls?.[0];
      
      if (imageUrl) {
        await doc.ref.update({
          status: 'completed',
          imageUrl,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
          generationId,
          status: 'completed',
          imageUrl,
          free: true
        });
        return;
      }
    }
    
    if (taskData.status === 'failed' || taskData.status === 'cancelled') {
      await doc.ref.update({ 
        status: 'failed',
        error: 'Generation failed'
      });
      
      res.json({
        generationId,
        status: 'failed',
        error: 'Generation failed'
      });
      return;
    }

    // Still processing
    res.json({
      generationId,
      status: 'processing',
      pixaiStatus: taskData.status
    });

  } catch (err: any) {
    console.error('[PixAI] Status error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /generation/video - Generate videos (COSTS CREDITS)
 */
router.post('/video', requireAuth, async (req: Request, res: Response) => {
  try {
    const { 
      prompt, 
      imageBase64,
      aspectRatio = '16:9'
    } = req.body;

    const userId = (req as any).user.uid;
    const userTier = (req as any).user?.tier || 'free';

    if (!prompt && !imageBase64) {
      res.status(400).json({ error: 'Prompt or image required' });
      return;
    }

    // Video generation requires paid tier
    if (userTier === 'free') {
      res.status(403).json({ 
        error: 'Video generation requires paid subscription',
        upgradeUrl: '/pricing'
      });
      return;
    }

    // Check rate limit
    const rateLimit = checkRateLimit(userId, 'video');
    if (!rateLimit.allowed) {
      res.status(429).json({ 
        error: 'Video rate limit exceeded',
        resetIn: Math.ceil(rateLimit.resetIn / 1000)
      });
      return;
    }

    // Check credits - ONLY VIDEO COSTS CREDITS
    const creditCost = CREDIT_COSTS['veo-3'];
    const isSuperUser = (req as any).unlimitedCredits;

    if (!isSuperUser) {
      const userCredits = await db.collection('user_credits').doc(userId).get();
      const videoCredits = userCredits.exists ? userCredits.data()?.video || 0 : 0;
      
      if (videoCredits < creditCost) {
        res.status(403).json({ 
          error: 'Insufficient video credits',
          required: creditCost,
          available: videoCredits,
          message: 'Video generation requires credits. Purchase more or upgrade your plan.'
        });
        return;
      }
    }

    // Get API key
    const apiKeyData = await getApiKey(userId);
    if (!apiKeyData) {
      res.status(503).json({ error: 'Video generation service not configured' });
      return;
    }

    // Initialize client
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKeyData.key });

    // Start generation
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || undefined,
      image: imageBase64 ? {
        imageBytes: imageBase64,
        mimeType: 'image/jpeg'
      } : undefined,
      config: {
        numberOfVideos: 1,
        aspectRatio: aspectRatio
      }
    });

    // Create generation record
    const generationRef = await db.collection('video_generations').add({
      userId,
      prompt,
      aspectRatio,
      creditCost, // Track cost
      apiSource: apiKeyData.source,
      operationId: operation.name || '',
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Deduct credits immediately for video (skip for superusers)
    if (apiKeyData.source === 'platform' && !isSuperUser) {
      await db.collection('user_credits').doc(userId).update({
        video: admin.firestore.FieldValue.increment(-creditCost)
      });
    }

    res.json({
      success: true,
      generationId: generationRef.id,
      operationId: operation.name || '',
      status: 'processing',
      creditCost, // Tell user how much was charged
      message: 'Video generation started. Poll /generation/video/status/:generationId',
      estimatedTime: '2-3 minutes'
    });

  } catch (err: any) {
    console.error('[Generation] Video error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /generation/video/status/:generationId
 * Check video generation status
 */
router.get('/video/status/:generationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { generationId } = req.params;
    const userId = (req as any).user.uid;

    const doc = await db.collection('video_generations').doc(generationId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    const data = doc.data();
    if (!data || data.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // If completed or failed, return current status
    if (data.status === 'completed' || data.status === 'failed') {
      res.json({
        generationId,
        ...data
      });
      return;
    }

    // Check with API
    const apiKeyData = await getApiKey(userId);
    if (!apiKeyData) {
      res.status(503).json({ error: 'Service not available' });
      return;
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKeyData.key });

    const operation = await ai.operations.getVideosOperation({ 
      operation: { name: data?.operationId || '', _fromAPIResponse: () => ({}) } as any
    });

    if (operation.done) {
      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (videoUri) {
        // Download and store video
        const response = await fetch(videoUri, {
          headers: { 'x-goog-api-key': apiKeyData.key }
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          
          // Upload to storage
          const bucket = admin.storage().bucket();
          const fileName = `videos/${userId}/${generationId}.mp4`;
          const file = bucket.file(fileName);
          
          await file.save(Buffer.from(arrayBuffer), { 
            metadata: { contentType: 'video/mp4' } 
          });
          
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000
          });

          await doc.ref.update({
            status: 'completed',
            videoUrl: url,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          res.json({
            generationId,
            status: 'completed',
            videoUrl: url,
            creditCost: data.creditCost
          });
          return;
        }
      }
      
      // Failed - refund credits if using platform key (skip for superusers)
      const isSuperUser = (req as any).unlimitedCredits;
      if (data.apiSource === 'platform' && !isSuperUser) {
        await db.collection('user_credits').doc(userId).update({
          video: admin.firestore.FieldValue.increment(data.creditCost)
        });
      }
      
      await doc.ref.update({ status: 'failed', error: 'Generation failed' });
      
      res.json({ 
        generationId, 
        status: 'failed',
        refund: data.apiSource === 'platform' ? data.creditCost : 0
      });
      return;
    }

    // Still processing
    res.json({
      generationId,
      status: 'processing',
      progress: 0 // Veo doesn't provide progress
    });

  } catch (err: any) {
    console.error('[Generation] Video status error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /generation/models
 * List available models
 */
router.get('/models', (req, res) => {
  res.json({
    image: [
      { 
        id: 'gemini-flash-image', 
        name: 'Gemini Flash Image', 
        description: 'Fast, high-quality image generation',
        cost: 'FREE'
      },
      { 
        id: 'imagen-3', 
        name: 'Imagen 3', 
        description: 'Highest quality photorealistic images',
        cost: 'FREE'
      },
      { 
        id: 'pixai-tsubaki', 
        name: 'PixAI Tsubaki', 
        description: 'Anime/character generation - FREE',
        cost: 'FREE',
        provider: 'PixAI'
      }
    ],
    video: [
      { 
        id: 'veo-3', 
        name: 'Veo 3.1', 
        description: 'High-quality video generation',
        cost: '20 credits per video',
        minTier: 'catalyst'
      }
    ]
  });
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
