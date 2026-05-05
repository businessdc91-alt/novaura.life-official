/**
 * User Key Management
 * Allows premium users ($29.99+ tier) to add their own API keys
 * Keys are stored encrypted in user's Firestore document
 * User keys override platform defaults
 */

import { Router } from 'express';
import * as admin from 'firebase-admin';
import { OpenRouter } from '@openrouter/sdk';
import * as nodemailer from 'nodemailer';
import { secretService } from '../../services/secretService';

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
  { 
    id: 'aimlapi', 
    name: 'AIML API', 
    description: 'Access 100+ models including Gemma 3, Llama 3.1, and more',
    keyPrefix: '',
    website: 'https://aimlapi.com/app/keys'
  },
  { 
    id: 'aws-bedrock', 
    name: 'AWS Bedrock', 
    description: 'Connect to Amazon Nova, Titan, and Anthropic via AWS',
    keyPrefix: '',
    website: 'https://console.aws.amazon.com/bedrock/'
  },
  { 
    id: 'alibaba', 
    name: 'Alibaba Cloud', 
    description: 'Connect to Qwen (Cybeni) for advanced reasoning',
    keyPrefix: '',
    website: 'https://dashscope.console.aliyun.com/'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified access to 1500+ models with user-controlled billing',
    keyPrefix: 'sk-or-',
    website: 'https://openrouter.ai/keys',
    hasOAuth: true
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Multimodal AI with text, image, audio, video, and code capabilities',
    keyPrefix: '',
    website: 'https://aistudio.google.com/app/apikey'
  }
];

// Middleware: Auth + Tier check

// Middleware: Auth + Tier check
const SUPERUSERS = ['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz'];

async function requirePremium(req: any, res: any, next: any): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Check for superuser status first
    if (decoded.email && SUPERUSERS.includes(decoded.email)) {
      req.user = decoded;
      (req as any).platformTransport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      } as nodemailer.TransportOptions);
      req.userTier = 4; // Max tier for internal logic
      next();
      return;
    }

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
      return;
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
    const userId = (req as any).user.uid;
    
    const doc = await admin.firestore().collection('vault_user_api_keys').doc(userId).get();
    const data = doc.data() || {};
    
    // Return masked versions
    const masked = Object.entries(data).reduce((acc, [serviceId, value]: [string, any]) => {
      if (serviceId === '_lastUpdated') return acc;
      acc[serviceId] = {
        configured: true,
        masked: secretService.maskKey(secretService.decrypt(value.key)),
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
    const userId = (req as any).user.uid;
    
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
    await admin.firestore().collection('vault_user_api_keys').doc(userId).set({
      [serviceId]: {
        key: secretService.encrypt(apiKey),
        label: label || 'My Key',
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastValidated: admin.firestore.FieldValue.serverTimestamp()
      },
      _lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    res.json({
      success: true,
      serviceId,
      masked: secretService.maskKey(apiKey),
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
    const userId = (req as any).user.uid;
    
    await admin.firestore().collection('vault_user_api_keys').doc(userId).update({
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

// ─── OpenRouter OAuth (PKCE) ───────────────────────────────────────────────

/**
 * GET /user/keys/oauth/init
 * Starts the OpenRouter OAuth flow
 */
router.get('/oauth/init', requirePremium, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { verifier, challenge } = secretService.generatePKCE();
    const state = secretService.encrypt(userId).slice(0, 16); // Derived state

    // Store verifier for later exchange (10 min expiry)
    await admin.firestore().collection('oauth_states').doc(state).set({
      userId,
      verifier,
      provider: 'openrouter',
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 600000),
    });

    const callbackUrl = `${process.env.BACKEND_URL || 'https://api.novaura.life'}/user/keys/oauth/callback`;
    const oauthUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;

    res.json({ url: oauthUrl });
  } catch (err: any) {
    res.status(500).json({ error: 'OAuth initialization failed', detail: err.message });
  }
});

/**
 * GET /user/keys/oauth/callback
 * Finishes the OpenRouter OAuth flow
 */
router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`https://novaura.life/settings?oauth_error=${encodeURIComponent(error as string)}`);
    return;
  }

  try {
    const stateDoc = await admin.firestore().collection('oauth_states').doc(state as string).get();
    if (!stateDoc.exists) {
      res.status(400).send('Invalid or expired state');
      return;
    }

    const { userId, verifier } = stateDoc.data()!;
    
    // Create temporary SDK client for exchange
    const client = new OpenRouter({ apiKey: '' });
    const result = await client.oAuth.exchangeAuthCodeForAPIKey({
      requestBody: {
        code: code as string,
        codeChallengeMethod: 'S256',
        codeVerifier: verifier,
      },
    });

    const apiKey = (result as any).key || (result as any).apiKey;
    if (!apiKey) throw new Error('No API key returned from OpenRouter');

    // Encrypt and store in vault
    await admin.firestore().collection('vault_user_api_keys').doc(userId).set({
      ['openrouter']: {
        key: secretService.encrypt(apiKey),
        label: 'OpenRouter OAuth Key',
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastValidated: admin.firestore.FieldValue.serverTimestamp()
      },
      _lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Clean up state
    await stateDoc.ref.delete();

    res.redirect('https://novaura.life/settings?oauth=success&provider=openrouter');
  } catch (err: any) {
    console.error('[OAuth Callback] Error:', err.message);
    res.redirect(`https://novaura.life/settings?oauth_error=${encodeURIComponent(err.message)}`);
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
    
    const doc = await admin.firestore().collection('vault_user_api_keys').doc(userId as string).get();
    const data = doc.data()?.[serviceId];
    
    if (!data?.key) {
      res.json({ configured: false });
      return;
    }
    
    res.json({
      configured: true,
      key: secretService.decrypt(data.key)
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
        
      case 'aws-bedrock':
        // Expect format AccessKey:SecretKey:Region
        const awsParts = apiKey.split(':');
        return awsParts.length >= 2;
        
      case 'alibaba':
        const dashResponse = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'qwen-plus', input: { messages: [{ role: 'user', content: 'ping' }] } })
        });
        return dashResponse.ok || dashResponse.status === 400; // 400 might be model error but key is ok

      case 'gemini':
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
        });
        return geminiRes.ok;

      default:
        return apiKey.length > 10;
    }
  } catch (error) {
    return false;
  }
}

export default router;
