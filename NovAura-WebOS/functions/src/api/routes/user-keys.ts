/**
 * User Key Management
 * Allows premium users ($29.99+ tier) to add their own API keys
 * Keys are stored encrypted in user's Firestore document
 * User keys override platform defaults
 */

import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

// Minimum tier required for custom keys
const MIN_TIER_FOR_CUSTOM_KEYS = 2; // Tier 2 = $29.99 (Catalyst)

const TIER_NAMES: Record<number, string> = {
  0: 'free',
  1: 'spark',
  2: 'catalyst',
  3: 'nova',
  4: 'catalytic-crew'
};

// Services users can add their own keys for
const USER_CONFIGURABLE_SERVICES = [
  { 
    id: 'openai', 
    name: 'OpenAI', 
    description: 'Use your own GPT-4, DALL-E credits',
    keyPrefix: 'sk-',
    website: 'https://platform.openai.com/api-keys'
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic', 
    description: 'Use your own Claude API credits',
    keyPrefix: 'sk-ant-',
    website: 'https://console.anthropic.com/settings/keys'
  },
  { 
    id: 'stability', 
    name: 'Stability AI', 
    description: 'Use your own Stable Diffusion credits',
    keyPrefix: '',
    website: 'https://platform.stability.ai/account/keys'
  },
  { 
    id: 'pixai', 
    name: 'PixAI', 
    description: 'Use your own PixAI credits for anime generation',
    keyPrefix: '',
    website: 'https://pixai.art/account'
  },
  { 
    id: 'elevenlabs', 
    name: 'ElevenLabs', 
    description: 'Use your own voice synthesis credits',
    keyPrefix: '',
    website: 'https://elevenlabs.io/app/settings/api-keys'
  },
  { 
    id: 'perplexity', 
    name: 'Perplexity', 
    description: 'Use your own Perplexity search API',
    keyPrefix: 'pplx-',
    website: 'https://www.perplexity.ai/settings/api'
  },
];

// Middleware: Auth + Tier check
async function requirePremium(req: any, res: any, next: any): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Get user's tier
    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
    const userTier = userDoc.data()?.membershipTier || 'free';
    const tierLevel = getTierLevel(userTier);
    
    if (tierLevel < MIN_TIER_FOR_CUSTOM_KEYS) {
      res.status(403).json({ 
        error: 'Premium tier required',
        requiredTier: 'Catalyst ($29.99/month)',
        currentTier: userTier,
        upgradeUrl: '/pricing'
      });
    }
    
    req.user = decoded;
    req.userTier = tierLevel;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * GET /user/keys/services
 * List services available for user configuration
 */
router.get('/services', async (req, res) => {
  // No auth required to see what's available
  res.json({
    services: USER_CONFIGURABLE_SERVICES,
    minTier: MIN_TIER_FOR_CUSTOM_KEYS,
    minTierName: TIER_NAMES[MIN_TIER_FOR_CUSTOM_KEYS]
  });
});

/**
 * GET /user/keys
 * Get user's configured keys (masked)
 */
router.get('/', requirePremium, async (req, res): Promise<void> => {
  try {
    const userId = req.user.uid;
    
    const doc = await admin.firestore().collection('user_api_keys').doc(userId).get();
    const data = doc.data() || {};
    
    // Return masked versions
    const masked = Object.entries(data).reduce((acc, [serviceId, value]: [string, any]) => {
      if (serviceId === '_lastUpdated') return acc;
      acc[serviceId] = {
        configured: true,
        masked: maskKey(decryptKey(value.key)),
        addedAt: value.addedAt
      };
      return acc;
    }, {} as Record<string, any>);
    
    // Add unconfigured services
    for (const service of USER_CONFIGURABLE_SERVICES) {
      if (!masked[service.id]) {
        masked[service.id] = { configured: false };
      }
    }
    
    res.json({ keys: masked });
    
  } catch (error: any) {
    console.error('[User Keys] Error fetching keys:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /user/keys/:serviceId
 * Add or update a user's API key
 */
router.post('/:serviceId', requirePremium, async (req, res): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { apiKey, label } = req.body;
    const userId = req.user.uid;
    
    // Validate service
    const service = USER_CONFIGURABLE_SERVICES.find(s => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Service not available for user configuration' });
      return;
    }
    
    if (!apiKey) {
      res.status(400).json({ error: 'API key required' });
      return;
    }
    
    // Test the key
    const isValid = await testUserApiKey(serviceId, apiKey);
    if (!isValid) {
      res.status(400).json({ 
        error: 'API key validation failed',
        message: 'Please check your key and try again'
      });
      return;
    }
    
    // Encrypt and store
    await admin.firestore().collection('user_api_keys').doc(userId).set({
      [serviceId]: {
        key: encryptKey(apiKey),
        label: label || 'My Key',
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastValidated: admin.firestore.FieldValue.serverTimestamp()
      },
      _lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    res.json({
      success: true,
      serviceId,
      masked: maskKey(apiKey),
      message: `${service.name} API key saved successfully`
    });
    
  } catch (error: any) {
    console.error('[User Keys] Error saving key:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /user/keys/:serviceId
 * Remove a user's API key
 */
router.delete('/:serviceId', requirePremium, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userId = req.user.uid;
    
    await admin.firestore().collection('user_api_keys').doc(userId).update({
      [serviceId]: admin.firestore.FieldValue.delete(),
      _lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      serviceId,
      message: 'API key removed'
    });
    
  } catch (error: any) {
    console.error('[User Keys] Error removing key:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /user/keys/:serviceId/test
 * Test a key without saving
 */
router.post('/:serviceId/test', requirePremium, async (req, res): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { apiKey } = req.body;
    
    const service = USER_CONFIGURABLE_SERVICES.find(s => s.id === serviceId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    
    if (!apiKey) {
      res.status(400).json({ error: 'API key required' });
      return;
    }
    
    const isValid = await testUserApiKey(serviceId, apiKey);
    
    res.json({
      serviceId,
      valid: isValid,
      service: service.name,
      message: isValid ? 'Key is valid!' : 'Key validation failed'
    });
    return;
    
  } catch (error: any) {
    console.error('[User Keys] Error testing key:', error);
    res.status(500).json({ error: error.message });
    return;
  }
});

/**
 * GET /user/keys/:serviceId
 * Get decrypted key (internal use by other services)
 * This endpoint should only be called server-side
 */
router.get('/:serviceId/decrypted', async (req, res): Promise<void> => {
  // This endpoint is for internal service use
  // It requires a service account token, not a user token
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Service ')) {
      res.status(401).json({ error: 'Service authentication required' });
      return;
    }
    
    const serviceToken = authHeader.split('Service ')[1];
    // Validate service token against environment
    if (serviceToken !== process.env.INTERNAL_SERVICE_TOKEN) {
      res.status(403).json({ error: 'Invalid service token' });
      return;
    }
    
    const { serviceId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    
    const doc = await admin.firestore().collection('user_api_keys').doc(userId as string).get();
    const data = doc.data()?.[serviceId];
    
    if (!data?.key) {
      res.json({ configured: false });
      return;
    }
    
    res.json({
      configured: true,
      key: decryptKey(data.key)
    });
    return;
    
  } catch (error: any) {
    console.error('[User Keys] Error getting decrypted key:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get tier level from name
function getTierLevel(tier: string): number {
  const levels: Record<string, number> = {
    'free': 0,
    'spark': 1,
    'catalyst': 2,
    'nova': 3,
    'catalytic-crew': 4
  };
  return levels[tier] || 0;
}

// Helper: Test user API key
async function testUserApiKey(serviceId: string, apiKey: string): Promise<boolean> {
  try {
    switch (serviceId) {
      case 'openai':
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return response.ok;
        
      case 'anthropic':
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        });
        return anthropicResponse.ok;
        
      case 'pixai':
        const pixaiResponse = await fetch('https://api.pixai.art/v1/user/me', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return pixaiResponse.ok;
        
      case 'stability':
        const stabilityResponse = await fetch('https://api.stability.ai/v1/user/account', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return stabilityResponse.ok;
        
      case 'elevenlabs':
        const elevenResponse = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': apiKey }
        });
        return elevenResponse.ok;
        
      case 'perplexity':
        // Perplexity doesn't have a simple test endpoint, so we just check format
        return apiKey.startsWith('pplx-') && apiKey.length > 20;
        
      default:
        return apiKey.length > 10;
    }
  } catch (error) {
    return false;
  }
}

// Helper: Mask key for display
function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Helper: Encrypt key
function encryptKey(key: string): string {
  const xorKey = process.env.USER_KEY_ENCRYPTION_SECRET || 'novaura-user-secret';
  let result = '';
  for (let i = 0; i < key.length; i++) {
    result += String.fromCharCode(key.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
  }
  return Buffer.from(result).toString('base64');
}

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
