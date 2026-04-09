/**
 * Admin Key Management
 * Server-side secure API key storage and management
 * Only accessible by users with admin role
 */

import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

// Middleware: Check if user is admin
async function requireAdmin(req: any, res: any, next: any): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Check admin claim or admin collection
    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
    const isAdmin = decoded.admin === true || userDoc.data()?.role === 'admin';
    
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(requireAdmin);

// Available AI services that Novaura provides
const AI_SERVICES = [
  { id: 'gemini', name: 'Google Gemini', description: 'Primary LLM for chat and text generation' },
  { id: 'vertex', name: 'Google Vertex AI', description: 'Imagen, Veo, Lyria via Vertex' },
  { id: 'pixai', name: 'PixAI', description: 'Anime/character image generation' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4, DALL-E fallback' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models' },
  { id: 'stability', name: 'Stability AI', description: 'Stable Diffusion' },
];

/**
 * GET /admin/keys/services
 * List all available services and their configuration status
 */
router.get('/services', async (req, res) => {
  try {
    // Check which services have keys configured
    const services = await Promise.all(AI_SERVICES.map(async service => ({
      ...service,
      isConfigured: !!(await getServiceKey(service.id)),
      lastUpdated: null // Could track this in Firestore
    })));
    
    res.json({ services });
  } catch (error: any) {
    console.error('[Admin Keys] Error listing services:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/keys/:serviceId
 * Update an API key for a service (writes to Firebase Config)
 */
router.post('/:serviceId', async (req, res): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { apiKey, enabled = true } = req.body;
    
    if (!apiKey) {
      res.status(400).json({ error: 'API key required' });
      return;
    }
    
    // Validate the service exists
    const service = AI_SERVICES.find(s => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Unknown service' });
      return;
    }
    
    // Test the key before saving
    const isValid = await testApiKey(serviceId, apiKey);
    if (!isValid) {
      res.status(400).json({ error: 'API key validation failed' });
      return;
    }
    
    // Store in Firestore (secure, only admins can read)
    await admin.firestore().collection('admin_config').doc('api_keys').set({
      [serviceId]: {
        key: encryptKey(apiKey), // Encrypt before storing
        enabled,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user.uid
      }
    }, { merge: true });
    
    // Log the action
    await admin.firestore().collection('admin_logs').add({
      action: 'api_key_updated',
      serviceId,
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ 
      success: true, 
      serviceId,
      message: `${service.name} API key updated successfully`,
      validated: true
    });
    
  } catch (error: any) {
    console.error('[Admin Keys] Error updating key:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/keys/:serviceId/status
 * Check if a service key is valid and working
 */
router.get('/:serviceId/status', async (req, res): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const key = await getDecryptedKey(serviceId);
    
    if (!key) {
      res.json({ 
        serviceId, 
        configured: false,
        valid: false,
        message: 'No key configured'
      });
      return;
    }
    
    const isValid = await testApiKey(serviceId, key);
    
    res.json({
      serviceId,
      configured: true,
      valid: isValid,
      message: isValid ? 'Key is valid' : 'Key validation failed'
    });
    
  } catch (error: any) {
    console.error('[Admin Keys] Error checking status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/keys/:serviceId/test
 * Test an API key without saving it
 */
router.post('/:serviceId/test', async (req, res): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { apiKey } = req.body;
    
    if (!apiKey) {
      res.status(400).json({ error: 'API key required' });
      return;
    }
    
    const isValid = await testApiKey(serviceId, apiKey);
    
    res.json({
      serviceId,
      valid: isValid,
      message: isValid ? 'Key is valid and working' : 'Key validation failed'
    });
    return;
    
  } catch (error: any) {
    console.error('[Admin Keys] Error testing key:', error);
    res.status(500).json({ error: error.message });
    return;
  }
});

/**
 * GET /admin/keys/usage
 * Get usage statistics for each service
 */
router.get('/usage', async (req, res) => {
  try {
    // Aggregate usage from Firestore
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usage: Record<string, any> = {};
    
    for (const service of AI_SERVICES) {
      const stats = await admin.firestore()
        .collection('usage')
        .where('service', '==', service.id)
        .where('timestamp', '>=', thirtyDaysAgo)
        .get();
      
      const totalCalls = stats.size;
      const totalCost = stats.docs.reduce((sum, doc) => sum + (doc.data().cost || 0), 0);
      
      usage[service.id] = {
        service: service.name,
        calls30Days: totalCalls,
        estimatedCost30Days: totalCost,
        avgPerDay: Math.round(totalCalls / 30)
      };
    }
    
    res.json({ usage, period: '30 days' });
    
  } catch (error: any) {
    console.error('[Admin Keys] Error getting usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get service key from environment or Firestore
async function getServiceKey(serviceId: string): Promise<string | null> {
  const envKey = process.env[`${serviceId.toUpperCase()}_API_KEY`];
  if (envKey) return envKey;
  
  // Check Firestore
  const configDoc = await admin.firestore().collection('admin_config').doc('api_keys').get();
  const keyData = configDoc.data()?.[serviceId];
  if (keyData?.key) {
    return decryptKey(keyData.key);
  }
  
  return null;
}

// Helper: Get decrypted key from Firestore
async function getDecryptedKey(serviceId: string): Promise<string | null> {
  const doc = await admin.firestore().collection('admin_config').doc('api_keys').get();
  const data = doc.data()?.[serviceId];
  
  if (!data?.key) return null;
  
  return decryptKey(data.key);
}

// Helper: Test an API key
async function testApiKey(serviceId: string, apiKey: string): Promise<boolean> {
  try {
    switch (serviceId) {
      case 'gemini':
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        // Simple test call
        await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: 'Hi'
        });
        return true;
        
      case 'openai':
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return response.ok;
        
      case 'pixai':
        const pixaiResponse = await fetch('https://api.pixai.art/v1/user/me', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return pixaiResponse.ok;
        
      default:
        // For services we can't easily test, just check key format
        return apiKey.length > 10;
    }
  } catch (error) {
    console.error(`[Admin Keys] Test failed for ${serviceId}:`, error);
    return false;
  }
}

// Helper: Simple encryption (in production, use KMS)
function encryptKey(key: string): string {
  // XOR with a static key (not secure, but better than plaintext)
  // In production, use Google Cloud KMS
  const xorKey = process.env.KEY_ENCRYPTION_SECRET || 'novaura-secret';
  let result = '';
  for (let i = 0; i < key.length; i++) {
    result += String.fromCharCode(key.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
  }
  return Buffer.from(result).toString('base64');
}

function decryptKey(encrypted: string): string {
  const xorKey = process.env.KEY_ENCRYPTION_SECRET || 'novaura-secret';
  const buffer = Buffer.from(encrypted, 'base64');
  let result = '';
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i] ^ xorKey.charCodeAt(i % xorKey.length));
  }
  return result;
}

export default router;
