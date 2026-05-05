import { Router } from 'express';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { secretService } from '../../services/secretService';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { OpenRouter } from '@openrouter/sdk';

const FREE_MODEL_ALLOWLIST = [
  'google/gemini-2.0-flash-001:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-24b-instruct-2501:free'
];

const router = Router();

// Factory for OpenRouter clients — returns a client for a specific user (BYOK) or the platform fallback
async function getOpenRouterClient(userId?: string): Promise<OpenRouter> {
  const apiKey = await getApiKey('openrouter', userId);
  if (!apiKey) throw new Error('OpenRouter API key not configured');
  
  return new OpenRouter({
    apiKey,
    httpReferer: 'https://novaura.life',
    appTitle: 'NovAura OS',
    appCategories: 'productivity',
  });
}

/**
 * Helper to call OpenRouter with exponential backoff for rate limits
 */
async function callOpenRouterWithRetry(
  client: OpenRouter, 
  params: any, 
  maxRetries = 3
): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 3s, 7s... with jitter
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`[OpenRouter] Rate limited. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return await client.chat.send(params);
    } catch (err: any) {
      lastError = err;
      // Only retry on 429 (Too Many Requests) or 502/503/504 (Provider temporary issues)
      const isRetryable = err.status === 429 || err.status >= 500;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
    }
  }
  throw lastError;
}

const PROVIDERS: Record<string, any> = {
  // OpenRouter — primary server-side inference gateway (1500+ models)
  openrouter: {
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://novaura.life',
      'X-Title': 'NovAura OS'
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, model?: string, conversation?: any[]) => ({
      model: model || 'google/gemini-2.0-flash-001',
      messages: [
        ...(conversation || []).map((m: any) => ({ role: m.role, content: m.text || m.content })),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  // AIML API — unified gateway (secondary)
  aiml: {
    url: () => 'https://api.aimlapi.com/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, model?: string) => ({
      model: model || 'google/gemma-3-27b-it',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  gemini: {
    url: (key: string, model?: string) => `https://generativelanguage.googleapis.com/v1beta/${model || 'models/gemini-2.0-flash'}:generateContent`,
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'X-goog-api-key': key
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens }
    }),
    parseResponse: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  },
  claude: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'claude-4.6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: temp
    }),
    parseResponse: (data: any) => data.content?.[0]?.text || ''
  },
  // Alias for anthropic
  anthropic: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'claude-4.6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: temp
    }),
    parseResponse: (data: any) => data.content?.[0]?.text || ''
  },
  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  // Azure AI Foundry (Primary)
  azure: {
    url: () => process.env.AZURE_OPENAI_ENDPOINT || 'https://livenovaura-resource.services.ai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'api-key': key
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, _model?: string, conversation?: any[]) => ({
      messages: [
        ...(conversation || []).map((m: any) => ({ role: m.role, content: m.text || m.content })),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  // Azure OpenAI alias
  azure_openai: {
    url: () => process.env.AZURE_OPENAI_ENDPOINT || 'https://novauralife-resource.openai.azure.com/openai/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'api-key': key
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, _model?: string, conversation?: any[]) => ({
      model: 'gpt-4o',
      messages: [
        ...(conversation || []).map((m: any) => ({ role: m.role, content: m.text || m.content })),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  kimi: {
    url: () => 'https://api.moonshot.cn/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, model?: string, conversation?: any[]) => ({
      model: model || 'moonshot-v1-8k',
      messages: [
        ...(conversation || []).map((m: any) => ({ role: m.role, content: m.text || m.content })),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  alibaba: {
    // Native Alibaba format (not OpenAI-compatible)
    url: () => 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'qwen-3.6-max',
      input: {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        max_tokens: maxTokens,
        temperature: temp,
        result_format: 'message'
      }
    }),
    parseResponse: (data: any) => {
      // Alibaba native format: data.output.choices[0].message.content
      return data.output?.choices?.[0]?.message?.content 
        || data.output?.text 
        || '';
    }
  },
  // Additional model providers
  novita: {
    url: () => 'https://api.novita.ai/v3/openai/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'Qwen/Qwen3-Coder-Next',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  scaleway: {
    url: () => 'https://api.scaleway.ai/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'google/gemma-3-27b-it',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  hyperbolic: {
    url: () => 'https://api.hyperbolic.xyz/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'Qwen/Qwen3-Next-80B-A3B-Thinking',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  lmstudio: {
    // LM Studio local server (OpenAI-compatible)
    url: () => process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'local-model',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  fireworks: {
    url: () => 'https://api.fireworks.ai/inference/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'zai-org/GLM-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  nova: {
    // Amazon Nova OpenAI-compatible API
    url: () => 'https://api.nova.amazon.com/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, model?: string) => ({
      model: model || 'amazon.nova-pro-v1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  }
};

/**
 * Helper to get numerical tier value from membership string
 */

/**
 * Helper to call fetch with exponential backoff for rate limits
 */
async function fetchWithRetry(
  url: string, 
  options: any, 
  maxRetries = 3
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const response = await fetch(url, options);
      if (response.status === 429 || response.status >= 500) {
        if (attempt === maxRetries) return response;
        continue;
      }
      return response;
    } catch (err: any) {
      lastError = err;
      if (attempt === maxRetries) throw err;
    }
  }
  throw lastError;
}

router.post('/chat', async (req, res) => {
  try {
    const { prompt, provider, model, maxTokens = 2048, temperature = 0.7, conversation } = req.body;
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {
        // Fallback to platform keys if token is invalid but not required
      }
    }

    const selectedProvider = provider || await detectProvider();

    // ── OpenRouter: use official SDK ─────────────────────────────────────────
    if (selectedProvider === 'openrouter') {
      try {
        const selectedModel = model || 'google/gemini-2.0-flash-001';
        
        // Tier & BYOK Check
        if (userId) {
          const userTier = await getUserTier(userId);
          const userHasKey = await hasUserKey(userId, 'openrouter');
          
          // If free tier and NO user key, restrict to "middle-tier free"
          if (userTier < 2 && !userHasKey) {
            const isModelFree = selectedModel.endsWith(':free');
            if (!isModelFree) {
              res.status(403).json({ 
                error: 'Premium Required', 
                message: 'This model requires a Catalyst tier ($29.99) or your own OpenRouter API key.',
                upgradeUrl: 'https://novaura.life/pricing'
              });
              return;
            }
          }
        }

        const client = await getOpenRouterClient(userId);
        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
          ...(conversation || []).map((m: any) => ({
            role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as 'user' | 'assistant' | 'system',
            content: (m.text || m.content || '') as string,
          })),
          { role: 'user' as const, content: prompt as string },
        ];

        const completion = await callOpenRouterWithRetry(client, {
          model: selectedModel,
          messages,
          max_tokens: maxTokens,
          temperature,
        });

        const content = completion.choices?.[0]?.message?.content || '';
        res.json({
          success: true,
          response: content,
          provider: 'openrouter',
          model: selectedModel,
          source: `openrouter/${selectedModel}`,
          usage: completion.usage,
        });
        return;
      } catch (orErr: any) {
        console.error('[OpenRouter SDK] Error:', orErr.message);
        res.status(502).json({ error: 'OpenRouter error', detail: orErr.message });
        return;
      }
    }


    // ── All other providers: raw fetch with resolved URL ────────────────────
    const config = PROVIDERS[selectedProvider];
    if (!config) {
      res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });
      return;
    }

    const apiKey = await getApiKey(selectedProvider, userId);
    if (!apiKey) {
      res.status(503).json({ error: `${selectedProvider} not configured` });
      return;
    }

    // Resolve the URL correctly (Gemini uses key in URL, others use static URL)
    const resolvedUrl = typeof config.url === 'function' ? config.url(apiKey, model) : config.url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetchWithRetry(resolvedUrl, {
        method: 'POST',
        headers: typeof config.headers === 'function' ? config.headers(apiKey) : config.headers,
        body: JSON.stringify(config.formatBody(prompt, maxTokens, temperature, model, conversation)),
        signal: controller.signal
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        res.status(504).json({ error: 'Gateway Timeout', detail: 'AI provider request timed out after 60s' });
      } else {
        throw fetchErr;
      }
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    // Gemini backup key fallback
    if (!response.ok && selectedProvider === 'gemini') {
      const backupKey = await getApiKey('gemini_backup');
      if (backupKey && backupKey !== apiKey) {
        console.warn('Gemini primary key failed. Retrying with backup key...');
        const backupController = new AbortController();
        const backupTimeoutId = setTimeout(() => backupController.abort(), 60000);
        try {
          response = await fetch(config.url(backupKey, model), {
            method: 'POST',
            headers: typeof config.headers === 'function' ? config.headers(backupKey) : config.headers,
            body: JSON.stringify(config.formatBody(prompt, maxTokens, temperature, model, conversation)),
            signal: backupController.signal
          });
        } finally {
          clearTimeout(backupTimeoutId);
        }
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(502).json({
        error: `${selectedProvider} error: ${response.status}`,
        detail: err.error?.message || err.message
      });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    res.json({
      success: true,
      response: content,
      provider: selectedProvider,
      model: model || selectedProvider,
      source: `${selectedProvider}/${model || selectedProvider}`,
    });
  } catch (err: any) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI request failed', detail: err.message });
  }
});

/**
 * POST /ai/tts
 * Synthesizes audio from text using the OpenRouter SDK.
 */
router.post('/tts', async (req, res) => {
  try {
    const { input, model = 'elevenlabs/eleven-turbo-v2', voice = 'alloy', speed = 1 } = req.body;

    if (!input) {
      res.status(400).json({ error: 'Input text required' });
      return;
    }

    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    // Tier & BYOK Check
    if (userId) {
      const userTier = await getUserTier(userId);
      const userHasKey = await hasUserKey(userId, 'openrouter');
      if (userTier < 2 && !userHasKey) {
        res.status(403).json({ 
          error: 'Premium Required', 
          message: 'Voice synthesis requires a Catalyst tier ($29.99) or your own OpenRouter API key.',
          upgradeUrl: 'https://novaura.life/pricing'
        });
        return;
      }
    }

    const client = await getOpenRouterClient(userId);
    const stream = await client.tts.createSpeech({
      speechRequest: { input, model, voice, speed },
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = (stream as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    console.error('[AI TTS] Error:', err.message);
    res.status(err.status || 500).json({ error: 'TTS failed', detail: err.message });
  }
});

/**
 * POST /ai/video/generate
 */
router.post('/video/generate', async (req, res) => {
  try {
    const { prompt, model = 'google/veo-3.1', aspectRatio = '16:9', duration = 8, resolution = '720p' } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt required' });
      return;
    }

    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    // Video gating: Nova Tier (3+) or BYOK
    if (userId) {
      const userTier = await getUserTier(userId);
      const userHasKey = await hasUserKey(userId, 'openrouter');
      if (userTier < 3 && !userHasKey) {
        res.status(403).json({ 
          error: 'Premium Required', 
          message: 'Video generation requires a Nova tier ($59.99) or your own OpenRouter API key.',
          upgradeUrl: 'https://novaura.life/pricing'
        });
        return;
      }
    }

    const client = await getOpenRouterClient(userId);
    const result = await client.videoGeneration.generate({
      videoGenerationRequest: { prompt, model, aspectRatio, duration, resolution },
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI Video] Generate Error:', err.message);
    res.status(err.status || 500).json({ error: 'Video generation failed', detail: err.message });
  }
});

/**
 * GET /ai/video/status/:jobId
 */
router.get('/video/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const client = await getOpenRouterClient(userId);
    const result = await client.videoGeneration.getGeneration({ jobId });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get status', detail: err.message });
  }
});

/**
 * GET /ai/video/content/:jobId
 */
router.get('/video/content/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const client = await getOpenRouterClient(userId);
    const stream = await client.videoGeneration.getVideoContent({ jobId });
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = (stream as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to stream video', detail: err.message });
  }
});

/**
 * POST /ai/beta/responses
 * Simplified OpenResponses API support.
 */
router.post('/beta/responses', async (req, res) => {
  try {
    const { input, model = 'google/gemini-2.0-flash-001' } = req.body;
    
    if (!input) {
      res.status(400).json({ error: 'Input text required' });
      return;
    }

    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    // Tier & BYOK Check
    if (userId) {
      const userTier = await getUserTier(userId);
      const userHasKey = await hasUserKey(userId, 'openrouter');
      // Require Catalyst (2) or higher for paid models without BYOK
      if (userTier < 2 && !userHasKey && !model.endsWith(':free')) {
        res.status(403).json({ 
          error: 'Premium Required', 
          message: 'Paid models on OpenResponses require Catalyst tier or your own API key.',
          upgradeUrl: 'https://novaura.life/pricing'
        });
        return;
      }
    }

    const client = await getOpenRouterClient(userId);
    const result = await client.beta.responses.send({
      responsesRequest: { input, model },
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI Beta Responses] Error:', err.message);
    res.status(err.status || 500).json({ error: 'OpenResponses call failed', detail: err.message });
  }
});

// ─── Workspace Management (Broker Infrastructure) ─────────────────────────

/**
 * GET /ai/workspaces
 * Lists all workspaces managed by NovAura.
 */
router.get('/workspaces', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const userTier = await getUserTier(userId);
    if (userTier < 3) { // Nova Tier or Admin required for full workspace list
      res.status(403).json({ error: 'Nova Tier required for Workspace Management' });
      return;
    }

    const client = await getOpenRouterClient(); // Uses platform key
    const result = await client.workspaces.list();
    const workspaces = [];
    for await (const page of result) {
      workspaces.push(...(page as any).data);
    }

    res.json({ success: true, workspaces });
  } catch (err: any) {
    console.error('[AI Workspace] List Error:', err.message);
    res.status(500).json({ error: 'Failed to list workspaces', detail: err.message });
  }
});

/**
 * POST /ai/workspaces
 * Creates a new managed workspace (Key Broker logic).
 */
router.post('/workspaces', async (req, res) => {
  try {
    const { name, description, defaultTextModel, defaultImageModel, slug } = req.body;
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const userTier = await getUserTier(userId);
    // Starter (0.5) or higher can have a workspace, but Free (0) cannot initiate new ones alone?
    // User said Starter is $5/mo or included in Catalyst.
    if (userTier < 0.5) { 
      res.status(403).json({ error: 'Starter membership required to provision managed AI workspaces' });
      return;
    }

    const client = await getOpenRouterClient();
    
    // Auto-scope for Free/Starter users (Tier <= 0.5)
    const isRestrictedTier = userTier <= 0.5; 
    const finalAllowedModels = isRestrictedTier ? FREE_MODEL_ALLOWLIST : (req.body.allowedModels || null);

    const result = await client.workspaces.create({
      createWorkspaceRequest: {
        name,
        description: description || `Managed by NovAura for user ${userId} (${isRestrictedTier ? 'Starter' : 'Premium'})`,
        defaultTextModel: defaultTextModel || CYBENI_MODELS.nova,
        defaultImageModel: defaultImageModel || 'openai/dall-e-3',
        defaultProviderSort: 'price',
        slug: slug || `novaura-${userId.slice(0, 8)}-${Date.now().toString().slice(-4)}`
      },
    });

    const workspaceId = (result as any).id;

    // Automatically create a "Zero-Cost" Guardrail for the new workspace if user is on Restricted tier
    if (isRestrictedTier) {
      await client.guardrails.create({
        createGuardrailRequest: {
          name: `Zero-Cost Policy (${userId.slice(0, 5)})`,
          limitUsd: 0.10, // Minimal "anti-spam" limit
          allowedModels: FREE_MODEL_ALLOWLIST,
          description: "Enforced $0.00 inference models only",
          resetInterval: 'monthly'
        }
      });
    }

    const isFreeOrBasic = (await getUserTier(userId)) < 2;

    // Store workspace mapping in Firestore for broker billing
    await admin.firestore().collection('managed_workspaces').add({
      workspaceId,
      ownerId: userId,
      status: 'active',
      isFreeTier: isFreeOrBasic,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      markup: 0.20 // 20% marking for the broker service
    });

    res.json({ success: true, workspace: result });
  } catch (err: any) {
    console.error('[AI Workspace] Create Error:', err.message);
    res.status(500).json({ error: 'Failed to create workspace', detail: err.message });
  }
});

/**
 * DELETE /ai/workspaces/:id
 */
router.delete('/workspaces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await getOpenRouterClient();
    const result = await client.workspaces.delete({ id });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete workspace', detail: err.message });
  }
});

/**
 * POST /ai/workspaces/:id/members
 * Bulk add members to a managed workspace.
 */
router.post('/workspaces/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body; // OpenRouter user IDs (OR-...)
    
    if (!userIds || !Array.isArray(userIds)) {
      res.status(400).json({ error: 'userIds array required' });
      return;
    }

    const client = await getOpenRouterClient();
    const result = await client.workspaces.bulkAddMembers({
      id,
      bulkAddWorkspaceMembersRequest: { userIds }
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add members', detail: err.message });
  }
});

// ─── Generation History & Auditing ────────────────────────────────────────

/**
 * GET /ai/generations/:id
 * Retrieves metadata and usage for a specific generation.
 * Essential for the Broker logic to calculate usage + 20% markup.
 */
router.get('/generations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const client = await getOpenRouterClient(userId);
    const result = await client.generations.getGeneration({ id });
    
    // Inject NovAura Broker calculations if needed
    const usage = (result as any).usage || {};
    const cost = (result as any).total_cost || 0;
    const brokerCost = cost * 1.20; // 20% markup applied

    res.json({ 
      success: true, 
      ...result,
      broker: {
        markup: '20%',
        totalCostWithMarkup: brokerCost
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve generation metadata', detail: err.message });
  }
});

/**
 * GET /ai/generations/:id/content
 * Retrieves the raw prompt and completion content for auditing.
 */
router.get('/generations/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const client = await getOpenRouterClient(userId);
    const result = await client.generations.listGenerationContent({ id });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve generation content', detail: err.message });
  }
});

// ─── Credit & Liquidity Management ────────────────────────────────────────

/**
 * GET /ai/credits
 * Returns the remaining credits and usage metadata for the authenticated management key.
 * Used by the NovAura Broker to monitor platform liquidity and workspace balances.
 */
router.get('/credits', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const userTier = await getUserTier(userId);
    if (userTier < 3) { // Nova Tier or Admin required to view platform credits
      res.status(403).json({ error: 'Nova Tier required for credit management' });
      return;
    }

    const client = await getOpenRouterClient(); // Uses platform management key
    const result = await client.credits.getCredits();

    res.json({ 
      success: true, 
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[AI Credits] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch credit data', detail: err.message });
  }
});

// ─── Guardrail Management (Cost & Policy Enforcement) ─────────────────────

/**
 * GET /ai/guardrails
 * Lists all guardrails managed by the platform.
 */
router.get('/guardrails', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const userTier = await getUserTier(userId);
    if (userTier < 3) { // Nova Tier or Admin required
      res.status(403).json({ error: 'Nova Tier required for guardrail management' });
      return;
    }

    const client = await getOpenRouterClient();
    const result = await client.guardrails.list();
    const guardrails = [];
    for await (const page of result) {
      guardrails.push(...(page as any).data);
    }

    res.json({ success: true, guardrails });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list guardrails', detail: err.message });
  }
});

/**
 * POST /ai/guardrails
 * Creates a new guardrail for policy enforcement (e.g., $5/month limit for free keys).
 */
router.post('/guardrails', async (req, res) => {
  try {
    const { name, limitUsd, allowedModels, allowedProviders, resetInterval = 'monthly' } = req.body;
    
    const client = await getOpenRouterClient();
    const result = await client.guardrails.create({
      createGuardrailRequest: {
        name,
        limitUsd: limitUsd || 10,
        allowedModels: allowedModels || null,
        allowedProviders: allowedProviders || null,
        resetInterval,
        description: `Enforced by NovAura for policy compliance`,
        enforceZdr: false
      },
    });

    res.json({ success: true, guardrail: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create guardrail', detail: err.message });
  }
});

/**
 * POST /ai/guardrails/:id/keys
 * Assigns specific API keys to a guardrail for hard-limit enforcement.
 */
router.post('/guardrails/:id/keys', async (req, res) => {
  try {
    const { id } = req.params;
    const { keyHashes } = req.body;
    
    if (!keyHashes || !Array.isArray(keyHashes)) {
      res.status(400).json({ error: 'keyHashes array required' });
      return;
    }

    const client = await getOpenRouterClient();
    const result = await client.guardrails.bulkAssignKeys({
      id,
      bulkAssignKeysRequest: { keyHashes }
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to assign keys to guardrail', detail: err.message });
  }
});

/**
 * Specialized AWS Bedrock Route (BYOK)
 * Handles direct Bedrock invocation with Access/Secret Keys
 */
router.post('/aws/chat', async (req, res) => {
  try {
    const { prompt, accessKey, secretKey, region = 'us-east-1', model = 'amazon.nova-pro-v1:0' } = req.body;
    
    if (!prompt || !accessKey || !secretKey) {
      res.status(400).json({ error: 'Missing prompt or AWS credentials' });
      return;
    }

    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      }
    });

    // Prepare Bedrock payload (Nova uses Converse-like or specialized format)
    // For now, using standard InvokeModel format for Nova
    const payload = {
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: 8192,
        temperature: 0.7,
        topP: 0.9,
      }
    };

    const command = new InvokeModelCommand({
      modelId: model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    // Nova response format check
    const content = result.results?.[0]?.outputText || result.outputText || JSON.stringify(result);

    res.json({
      success: true,
      response: content,
      provider: 'aws-bedrock',
      model
    });
  } catch (err: any) {
    console.error('AWS Bedrock error:', err);
    res.status(500).json({ error: 'AWS Bedrock request failed', detail: err.message });
  }
});

/**
 * Specialized Alibaba Cloud Route (BYOK)
 */
router.post('/alibaba/chat', async (req, res) => {
  try {
    const { prompt, apiKey, model = 'qwen-max' } = req.body;
    
    if (!prompt || !apiKey) {
      res.status(400).json({ error: 'Missing prompt or Alibaba API key' });
      return;
    }

    const config = PROVIDERS.alibaba;
    const response = await fetch(config.url(), {
      method: 'POST',
      headers: config.headers(apiKey),
      body: JSON.stringify(config.formatBody(prompt, 8192, 0.7))
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(response.status).json({ 
        error: `Alibaba error: ${response.status}`,
        detail: err.error?.message || err.message 
      });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    res.json({
      success: true,
      response: content,
      provider: 'alibaba',
      model
    });
  } catch (err: any) {
    console.error('Alibaba error:', err);
    res.status(500).json({ error: 'Alibaba request failed', detail: err.message });
  }
});

/**
 * Code/Website Builder endpoint
 * Specialized for generating code, websites, and projects
 */
router.post('/builder', async (req, res) => {
  try {
    const { 
      prompt, 
      mode = 'code', // 'code', 'website', 'component'
      template,
      maxTokens = 4096,
      provider,
      model
    } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt required' });
      return;
    }

    const selectedProvider = provider || await detectProvider();
    const config = PROVIDERS[selectedProvider];
    
    if (!config) {
      res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });
      return;
    }

    const apiKey = await getApiKey(selectedProvider);
    if (!apiKey) {
      res.status(503).json({ error: `${selectedProvider} not configured` });
      return;
    }

    // Build enhanced prompt for code generation
    let enhancedPrompt = prompt;
    if (mode === 'website') {
      enhancedPrompt = `Create a complete website: ${prompt}\n\nTemplate: ${template || 'modern responsive'}\n\nProvide:\n1. HTML (complete file)\n2. CSS (complete file)\n3. JavaScript (complete file)\n\nFormat your response with clear file sections.`;
    } else if (mode === 'component') {
      enhancedPrompt = `Create a React component: ${prompt}\n\nInclude:\n- Full component code\n- Props interface\n- Usage example\n- Styling (Tailwind CSS)`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min for builder

    const response = await fetch(config.url(apiKey), {
      method: 'POST',
      headers: typeof config.headers === 'function' ? config.headers(apiKey) : config.headers,
      body: JSON.stringify(config.formatBody(enhancedPrompt, maxTokens, 0.7, model)),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(502).json({ 
        error: `${selectedProvider} error: ${response.status}`,
        detail: err.error?.message || err.message 
      });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    // Parse generated code into sections
    const generatedCode = {
      raw: content,
      html: extractCodeBlock(content, 'html') || '',
      css: extractCodeBlock(content, 'css') || '',
      js: extractCodeBlock(content, 'javascript') || extractCodeBlock(content, 'js') || '',
      react: extractCodeBlock(content, 'jsx') || extractCodeBlock(content, 'tsx') || ''
    };

    res.json({
      success: true,
      generated_code: generatedCode,
      html: generatedCode.html,
      css: generatedCode.css,
      js: generatedCode.js,
      provider: selectedProvider,
      model: model || selectedProvider,
      mode
    });
  } catch (err: any) {
    console.error('Builder error:', err);
    res.status(500).json({ error: 'Builder request failed', detail: err.message });
  }
});

// Helper to extract code blocks from markdown
function extractCodeBlock(text: string, language: string): string | null {
  const regex = new RegExp(`\\\`\\\`\\\`${language}\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\``, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

router.get('/providers', (req, res) => {
  res.json({
    providers: {
      openrouter: !!process.env.OPENROUTER_API_KEY,
      azure: !!process.env.AZURE_OPENAI_KEY,
      azure_openai: !!process.env.AZURE_OPENAI_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      kimi: !!process.env.KIMI_API_KEY,
      alibaba: !!process.env.ALIBABA_API_KEY,
      huggingface: !!process.env.HUGGINGFACE_API_KEY,
      novita: !!process.env.NOVITA_API_KEY,
      scaleway: !!process.env.SCALEWAY_API_KEY,
      hyperbolic: !!process.env.HYPERBOLIC_API_KEY,
      fireworks: !!process.env.FIREWORKS_API_KEY,
      aiml: !!process.env.AIML_API_KEY
    }
  });
});

// ─── OpenRouter Model Catalog ───────────────────────────────────────────────
// In-memory cache: 1-hour TTL so we don't hammer the models API on every request
let _modelsCache: { data: any[]; fetchedAt: number } | null = null;
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Category heuristics — map model name keywords to NovAura task categories
function inferCategory(modelId: string, description: string = ''): string[] {
  const id = modelId.toLowerCase();
  const desc = description.toLowerCase();
  const cats: string[] = [];
  if (/coder|code|coding|programming|devstral|starcoder|codestral/.test(id + desc)) cats.push('coding');
  if (/vision|vl|image|multimodal|claude-3/.test(id + desc)) cats.push('vision');
  if (/instruct|chat|assistant|hermes|llama|gemma|mistral|qwen/.test(id + desc)) cats.push('general');
  if (/reasoning|think|r1|qwq|deepseek|o1|o3|reflection/.test(id + desc)) cats.push('reasoning');
  if (/creative|story|novel|write|roleplay/.test(id + desc)) cats.push('creative');
  if (cats.length === 0) cats.push('general');
  return cats;
}

// Shared enrichment: normalize raw OpenRouter model shape into NovAura model record
function enrichModel(m: any) {
  const isFree = m.id.endsWith(':free') ||
    (m.pricing?.prompt === '0' && m.pricing?.completion === '0');
  return {
    id: m.id,
    name: m.name || m.id,
    description: m.description || '',
    contextLength: m.contextLength ?? m.context_length ?? 0,
    maxOutput: m.topProvider?.maxCompletionTokens ?? m.top_provider?.max_completion_tokens ?? null,
    pricing: {
      prompt: m.pricing?.prompt ?? '?',
      completion: m.pricing?.completion ?? '?',
    },
    isFree,
    categories: inferCategory(m.id, m.description || ''),
    architecture: m.architecture?.modality || 'text',
    provider: m.id.split('/')[0] || 'unknown',
    tier: m.id.endsWith(':free') ? (m.context_length >= 128000 ? 'high-free' : 'low-free') : 'paid'
  };
}

// Helper: Get user tier level (0: free, 1: spark, 2: catalyst, 3: nova)
async function getUserTier(userId: string): Promise<number> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const tier = userDoc.data()?.membershipTier || 'free';
    const levels: Record<string, number> = {
      'free': 0,
      'spark': 1,
      'catalyst': 2,
      'nova': 3,
      'catalytic-crew': 4,
      'founding-father': 5
    };
    return levels[tier] || 0;
  } catch (err) {
    return 0;
  }
}

// Helper: Check if a user has BYOK (Bring Your Own Key) for a provider
async function hasUserKey(userId: string, provider: string): Promise<boolean> {
  const doc = await admin.firestore().collection('vault_user_api_keys').doc(userId).get();
  return !!doc.data()?.[provider]?.key;
}

// Fetch and cache the full model list via the SDK
async function fetchAndCacheModels(userId?: string): Promise<any[]> {
  const client = await getOpenRouterClient(userId);
  // If user has their own key, use listForUser to respect their privacy/tier settings
  const result = await client.models.list();
  const rawModels: any[] = (result as any).data ?? (result as any).models ?? [];
  const enriched = rawModels.map(enrichModel);
  
  // Only cache the platform-level models
  if (!userId) {
    _modelsCache = { data: enriched, fetchedAt: Date.now() };
  }
  return enriched;
}

/**
 * GET /ai/models
 * Returns live model catalog from OpenRouter via the official SDK.
 */
router.get('/models', async (req, res) => {
  try {
    const { free, category, q, fresh } = req.query;
    const now = Date.now();

    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    // Serve from cache if warm enough and no user-specific key is involved
    if (!fresh && !userId && _modelsCache && (now - _modelsCache.fetchedAt) < MODELS_CACHE_TTL_MS) {
      let models = _modelsCache.data;
      models = applyModelFilters(models, { free, category, q } as any);
      res.json({ success: true, models, count: models.length, cached: true, cachedAt: _modelsCache.fetchedAt });
      return;
    }

    const enriched = await fetchAndCacheModels(userId);
    let models = applyModelFilters(enriched, { free, category, q } as any);

    // If unauthenticated or free tier (no key), filter out "purchase-only" models
    if (userId) {
      const userTier = await getUserTier(userId);
      const userHasKey = await hasUserKey(userId, 'openrouter');
      if (userTier < 2 && !userHasKey) {
        // Only show free models to free users
        models = models.filter(m => m.isFree);
      }
    } else {
      // Unauthenticated users only see free models
      models = models.filter(m => m.isFree);
    }

    res.json({
      success: true,
      models,
      count: models.length,
      total: enriched.length,
      cached: !userId && !!_modelsCache,
      fetchedAt: userId ? now : (_modelsCache?.fetchedAt || now),
    });
  } catch (err: any) {
    console.error('[Models] SDK error:', err.message);
    if (_modelsCache) {
      let models = applyModelFilters(_modelsCache.data, req.query as any);
      res.json({ success: true, models, count: models.length, cached: true, stale: true, cachedAt: _modelsCache.fetchedAt });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch model catalog', detail: err.message });
  }
});

function applyModelFilters(models: any[], filters: { free?: string; category?: string; q?: string }): any[] {
  let result = models;
  if (filters.free === 'true') result = result.filter(m => m.isFree);
  if (filters.category) result = result.filter(m => m.categories.includes(filters.category));
  if (filters.q) {
    const search = filters.q.toLowerCase();
    result = result.filter(m =>
      m.id.toLowerCase().includes(search) ||
      m.name.toLowerCase().includes(search) ||
      m.description?.toLowerCase().includes(search)
    );
  }
  return result;
}

/**
 * GET /ai/models/free
 * Shorthand: returns only free models via SDK, sorted by context length desc.
 * Optional: ?category=coding
 */
/**
 * GET /ai/models/free
 * Shorthand: returns only free models via SDK, sorted by context length desc.
 */
router.get('/models/free', async (req, res) => {
  try {
    const now = Date.now();
    
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    let allModels: any[];
    if (!userId && _modelsCache && (now - _modelsCache.fetchedAt) < MODELS_CACHE_TTL_MS) {
      allModels = _modelsCache.data;
    } else {
      allModels = await fetchAndCacheModels(userId);
    }

    let free = allModels.filter(m => m.isFree);
    if (req.query.category) {
      free = free.filter(m => m.categories.includes(req.query.category as string));
    }
    free.sort((a, b) => (b.contextLength || 0) - (a.contextLength || 0));

    res.json({ success: true, models: free, count: free.length });
  } catch (err: any) {
    console.error('[Models/Free] SDK error:', err.message);
    if (_modelsCache) {
      const free = _modelsCache.data.filter(m => m.isFree);
      res.json({ success: true, models: free, count: free.length, stale: true });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch free models', detail: err.message });
  }
});

/**
 * Get live API key for client-side services (Gemini Live, etc.)
 * Requires Firebase Auth
 */
router.get('/live-key', async (req, res) => {
  try {
    // Verify Firebase Auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    if (!decoded.uid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    // Return Gemini key securely
    const geminiKey = await secretService.getSecret('GEMINI_API_KEY');
    if (!geminiKey) {
      res.status(503).json({ error: 'Gemini not configured' });
      return;
    }
    
    res.json({
      key: geminiKey,
      provider: 'gemini',
      user: decoded.uid
    });
  } catch (err: any) {
    console.error('Live key error:', err);
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

// Redundant OAuth routes removed (moved to user-keys.ts)

/**
 * GET /ai/status
 * Returns basic health status and available providers.
 */
router.get('/status', async (req, res) => {
  const available: string[] = [];
  for (const p of Object.keys(PROVIDERS)) {
    const key = await getApiKey(p);
    if (key) available.push(p);
  }
  res.json({ 
    status: available.length > 0 ? 'ok' : 'no_providers', 
    ai: available.length > 0 ? 'ready' : 'degraded',
    providers: available,
    totalConfigured: available.length,
    totalKnown: Object.keys(PROVIDERS).length
  });
});

/**
 * Deep health-check: actually ping each configured provider with a tiny prompt
 * Returns per-provider status, latency, errors, and key validity
 */
router.get('/health-check', async (req, res) => {
  const TEST_PROMPT = 'Reply with the single word OK.';
  const TIMEOUT_MS = 12000;
  const CORE_PROVIDERS = ['gemini', 'claude', 'openai', 'nova', 'alibaba', 'kimi', 'aiml', 'novita', 'scaleway', 'hyperbolic', 'fireworks', 'azure'];

  const results: Record<string, any> = {};

  await Promise.all(
    CORE_PROVIDERS.map(async (name) => {
      const config = PROVIDERS[name];
      if (!config) {
        results[name] = { status: 'unsupported', configured: false };
        return;
      }

      const apiKey = await getApiKey(name);
      if (!apiKey) {
        results[name] = { status: 'no_key', configured: false, error: 'API key not set' };
        return;
      }

      const start = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const url = typeof config.url === 'function' ? config.url(apiKey) : config.url;
        const headers = typeof config.headers === 'function' ? config.headers(apiKey) : config.headers;

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(config.formatBody(TEST_PROMPT, 10, 0.1)),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const latencyMs = Date.now() - start;

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          results[name] = {
            status: 'error',
            configured: true,
            httpStatus: response.status,
            latencyMs,
            error: errBody.error?.message || errBody.message || errBody.detail || `HTTP ${response.status}`,
          };
          return;
        }

        const data = await response.json();
        const content = config.parseResponse(data);

        results[name] = {
          status: content ? 'ok' : 'empty_response',
          configured: true,
          latencyMs,
          response: content ? content.slice(0, 100) : null,
        };
      } catch (err: any) {
        results[name] = {
          status: err.name === 'AbortError' ? 'timeout' : 'error',
          configured: true,
          latencyMs: Date.now() - start,
          error: err.name === 'AbortError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message,
        };
      }
    })
  );

  const okCount = Object.values(results).filter((r: any) => r.status === 'ok').length;
  const total = CORE_PROVIDERS.length;

  res.json({
    status: okCount > 0 ? 'operational' : 'degraded',
    summary: `${okCount}/${total} providers healthy`,
    timestamp: new Date().toISOString(),
    providers: results,
  });
});

async function getApiKey(provider: string, userId?: string): Promise<string | undefined> {
  // 1. Check user-specific key in Firestore Vault if userId is provided (BYOK)
  if (userId) {
    try {
      const doc = await admin.firestore().collection('vault_user_api_keys').doc(userId).get();
      const userKeyData = doc.data()?.[provider];
      if (userKeyData?.key) {
        return secretService.decrypt(userKeyData.key);
      }
    } catch (err) {
      console.warn(`[getApiKey] Error fetching user secret for ${provider} (user: ${userId}):`, err);
    }
  }

  // 2. Fallback to platform secrets (Firebase Secrets)
  const envVarMap: Record<string, string> = {
    'openrouter': 'OPENROUTER_API_KEY',
    'claude': 'ANTHROPIC_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'alibaba': 'ALIBABA_API_KEY',
    'alibaba_id': 'ALIBABA_ACCESS_KEY_ID',
    'alibaba_secret': 'ALIBABA_ACCESS_KEY_SECRET',
    'qwen': 'QWEN_API_KEY',
    'kimi': 'KIMI_API_KEY',
    'gemini': 'GEMINI_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'huggingface': 'HUGGINGFACE_API_KEY',
    'novita': 'NOVITA_API_KEY',
    'scaleway': 'SCALEWAY_API_KEY',
    'hyperbolic': 'HYPERBOLIC_API_KEY',
    'fireworks': 'FIREWORKS_API_KEY',
    'azure': 'AZURE_OPENAI_KEY',
    'azure_openai': 'AZURE_OPENAI_KEY',
    'lmstudio': 'LM_STUDIO_API_KEY',
    'gemini_backup': 'GEMINI_API_KEY_BACKUP',
    'nova': 'AWS_NOVA_API_KEY'
  };
  
  const envKey = envVarMap[provider] || provider.toUpperCase() + '_API_KEY';
  const secret = await secretService.getSecret(envKey);
  return secret || undefined;
}

// Provider priority: OpenRouter (primary, 1500+ models) > Gemini (fallback) > Azure > Claude > OpenAI
async function detectProvider(): Promise<string> {
  const providers = ['openrouter', 'gemini', 'azure', 'claude', 'openai', 'alibaba', 'kimi'];
  for (const p of providers) {
    if (await getApiKey(p)) return p;
  }
  return 'openrouter'; // Default to OpenRouter for the new Cybeni pipeline
}

// ─── Cybeni Pipeline: Standardized Model Assignments (2026 Standard) ────────
// Using true modern powerhouses for high-performance platform inference

/**
 * Advanced Gemini Multimodal & Streaming Bridge
 * Supports images, video, audio, and Google Search grounding.
 */
router.post('/gemini/advanced', async (req, res) => {
  try {
    const { 
      prompt, 
      model = 'gemini-2.0-flash-exp', 
      temperature = 0.7, 
      maxTokens = 4096,
      stream = false,
      systemInstruction,
      media, // Array of { mimeType: string, data: string (base64) }
      useGrounding = false
    } = req.body;

    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const apiKey = await getApiKey('gemini', userId);
    if (!apiKey) {
      res.status(503).json({ error: 'Gemini API key not configured' });
      return;
    }

    // Prepare contents
    const contents: any[] = [];
    const parts: any[] = [{ text: prompt }];

    // Add media parts if provided
    if (media && Array.isArray(media)) {
      for (const m of media) {
        parts.push({
          inlineData: {
            mimeType: m.mimeType,
            data: m.data
          }
        });
      }
    }

    contents.push({ role: 'user', parts });

    // Prepare tools for grounding
    const tools = useGrounding ? [{ googleSearchRetrieval: {} }] : [];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`;

    const body = {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'text/plain'
      },
      tools
    };

    if (stream) {
      // Server-Sent Events for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.body) throw new Error('No response body from Gemini');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // Gemini streaming returns a JSON array of objects, one per chunk
        res.write(`data: ${chunk}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Gemini error');

      res.json({
        success: true,
        response: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        usage: data.usageMetadata,
        groundingMetadata: data.candidates?.[0]?.groundingMetadata
      });
    }
  } catch (err: any) {
    console.error('[Gemini Advanced] Error:', err.message);
    res.status(500).json({ error: 'Gemini advanced error', detail: err.message });
  }
});

/**
 * GET /ai/gemini/models
 * Lists models available through the Gemini API.
 */
router.get('/gemini/models', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const apiKey = await getApiKey('gemini', userId);
    if (!apiKey) {
      res.status(503).json({ error: 'Gemini API key not configured' });
      return;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || 'Failed to list models');

    res.json({
      success: true,
      models: data.models,
      nextPageToken: data.nextPageToken
    });
  } catch (err: any) {
    console.error('[Gemini Models List] Error:', err.message);
    res.status(500).json({ error: 'Failed to list Gemini models', detail: err.message });
  }
});

/**
 * GET /ai/gemini/models/:modelId
 * Gets metadata for a specific Gemini model.
 */
router.get('/gemini/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      } catch (e) {}
    }

    const apiKey = await getApiKey('gemini', userId);
    if (!apiKey) {
      res.status(503).json({ error: 'Gemini API key not configured' });
      return;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}?key=${apiKey}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || 'Failed to get model info');

    res.json({
      success: true,
      model: data
    });
  } catch (err: any) {
    console.error('[Gemini Model Get] Error:', err.message);
    res.status(500).json({ error: 'Failed to get Gemini model info', detail: err.message });
  }
});

export const CYBENI_MODELS = {
  nova: 'google/gemma-4-31b-it:free',        // Primary Intelligence (Gemma 4 Flagship)
  aura: 'qwen/qwen3-next-80b-a3b-instruct:free', // Creative MoE (Qwen 3 Next)
  coder: 'qwen/qwen3-coder:free',           // Logic/Software Engineering (Qwen 3 Coder)
  reasoner: 'nvidia/nemotron-3-super-120b-a12b:free', // Long-Context Logic (1M tokens)
  general: 'qwen/qwen3-235b-a22b-instruct:free', // High-Reliability Giant
};

export default router;
