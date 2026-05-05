import { kernelStorage } from '../kernel/kernelStorage.js';

// ─── OpenRouter Free Model Pool ──────────────────────────────────────────────
// Verified slugs from openrouter.ai/models — append :free for zero-cost inference
export const OR_MODELS = {
  // ─── 1T+ Powerhouses ──────────────────────────────────────────────────
  LING_1T:    'inclusionai/ling-2.6-1t:free',       // 1 Trillion Parameter Giant
  QWEN_480B:  'qwen/qwen3-coder-480b-a35b:free',   // Massive Coding Specialist
  QWEN_235B:  'qwen/qwen3-235b-a22b-instruct:free', // High-Reliability Giant
  HERMES_405B: 'nousresearch/hermes-3-llama-3.1-405b:free', // Logic Powerhouse
  
  // ─── Specialized Specialists ──────────────────────────────────────────
  NEMOTRON_SUPER: 'nvidia/nemotron-3-super:free',   // High-Fidelity Reasoning
  NEMOTRON_EMBED: 'nvidia/llama-nemotron-embed-vl-1b-v2:free', // Multimodal Retrieval
  HY3:            'tencent/hy3:free',               // Tencent Hy3 Preview
  VENICE:         'venice/venice-uncensored:free',  // Uncensored Roleplay/Logic
  
  // ─── Persona Primaries ────────────────────────────────────────────────
  NOVA:    'google/gemma-4-31b-it:free',            // Nova — Gemma 4 31B
  AURA:    'google/gemma-4-26b-a4b-it:free',        // Aura — Gemma 4 26B MoE (A4B active)
};
/**
 * NovAura AI Service — Centralized API layer
 *
 * All AI calls route through here. Handles:
 * - Cloud providers via backend proxy (Gemini, Claude, OpenAI, Kimi, Vertex)
 * - Local LLM direct-from-browser (Ollama, LM Studio)
 * - Smart routing based on task category and llmConfig
 * - Auth headers, error handling, provider fallback
 * - Auth headers, error handling, provider fallback
 */

export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-life.cloudfunctions.net/api').replace(/\/$/, '');

// ─── Auth ──────────────────────────────────────────────────────────────

export function getAuthHeaders() {
  const token = kernelStorage.getItem('novaura-auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Provider Status ───────────────────────────────────────────────────

/** Check which cloud AI providers the backend has configured */
export async function getProviderStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/ai/providers`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return data.providers || {};
  } catch {
    return {};
  }
}

/** Health check — also returns provider info */
export async function checkHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return await res.json();
  } catch {
    return { status: 'unreachable' };
  }
}

// ─── Cloud AI (via backend proxy) ──────────────────────────────────────

/** Helper to check membership and deduct tokens for IDE usage */
export async function ensureActionTokens(isIDE = false) {
  let user = null;
  let isPartner = false;
  try {
    const userData = JSON.parse(kernelStorage.getItem('user_data') || 'null');
    user = userData;
    isPartner = !!userData?.partnership || 
                userData?.email?.endsWith('@novaura.xyz') || 
                userData?.email?.endsWith('@novaura.life') ||
                userData?.email === 'lostitonce420@gmail.com';
  } catch (e) {
    console.warn('Failed to parse user data from kernel storage:', e);
  }

  const isPremium = user?.membershipTier === 'catalyst' ||
    user?.membershipTier === 'nova' ||
    user?.membershipTier === 'catalytic-crew' ||
    user?.membershipTier === 'founding-father' ||
    user?.membershipTier === 'council-member' ||
    user?.membershipTier === 'strategic-investor' ||
    isPartner;

  const burnRate = isPartner ? 0.125 : 0.25;

  if (isIDE) {
    try {
      const { db } = await import('../config/firebase');
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      if (db && user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const currentTokens = data.actionTokens || 0;
          if (currentTokens < burnRate) {
            throw new Error(`Action tokens required for IDE usage (${burnRate}/action). Please upgrade to Spark or purchase tokens.`);
          }
          await updateDoc(userRef, { actionTokens: currentTokens - burnRate });
        }
      }
    } catch (e) {
      if (e.message.includes('Action tokens required')) throw e;
      console.warn('Failed to deduct tokens:', e);
    }
  }
  return isPremium || user?.email?.endsWith('@novaura.xyz') || user?.email?.endsWith('@novaura.life');
}

/**
 * Chat with a cloud AI provider through the backend
 * @param {string} prompt - User message
 * @param {object} options - { provider, model, maxTokens, temperature, conversation, isIDE }
 */
export async function chatCloud(prompt, options = {}) {
  const isPremium = await ensureActionTokens(options.isIDE);

  // ── Kimi (Moonshot) BYOK ────────────────────────────────────────────────
  const userKimiKey = kernelStorage.getItem('kimi_key');
  if (userKimiKey && options.provider === 'kimi') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userKimiKey}`,
        },
        body: JSON.stringify({
          model: options.model || 'moonshot-v1-8k',
          messages: [
            ...(options.conversation || []).map(m => ({ role: m.role, content: m.text || m.content })),
            { role: 'user', content: prompt }
          ],
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Kimi Error: ${res.status} - ${errorData.error?.message || 'Unknown Error'}`);
      }

      const data = await res.json();
      return {
        response: data.choices[0].message.content,
        source: 'kimi (BYOK)',
        model: options.model || 'moonshot-v1-8k',
      };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Kimi request timed out (45s)');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Azure OpenAI BYOK ───────────────────────────────────────────────────
  const userAzureData = kernelStorage.getItem('azure_key') || kernelStorage.getItem('user_azure_key');
  if (userAzureData && options.provider === 'azure') {
    let azureKey = userAzureData;
    let azureEndpoint = 'https://livenovaura-resource.services.ai.azure.com/';

    if (userAzureData.includes('|')) {
      const [savedKey, savedEndpoint] = userAzureData.split('|');
      azureKey = savedKey;
      azureEndpoint = savedEndpoint;
    }

    const deployment = options.model || 'gpt-4o';
    const apiVersion = '2024-05-01-preview';
    const baseUrl = azureEndpoint.endsWith('/') ? azureEndpoint : `${azureEndpoint}/`;

    let url;
    if (baseUrl.includes('/openai/deployments/')) {
      url = baseUrl.includes('api-version=') ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}api-version=${apiVersion}`;
    } else if (baseUrl.includes('.services.ai.azure.com')) {
      url = `${baseUrl}models/chat/completions?api-version=${apiVersion}`;
    } else {
      url = `${baseUrl}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureKey,
        },
        body: JSON.stringify({
          messages: [
            ...(options.conversation || []).map(m => ({ role: m.role, content: m.text || m.content })),
            { role: 'user', content: prompt }
          ],
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Azure Error: ${res.status} - ${errorData.error?.message || 'Unknown Error'}`);
      }

      const data = await res.json();
      return {
        response: data.choices[0].message.content,
        source: 'azure (BYOK)',
        model: deployment,
      };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Azure request timed out (45s)');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const userOpenAIKey = kernelStorage.getItem('openai_api_key') || kernelStorage.getItem('user_openai_key');

  if (userOpenAIKey && (options.provider === 'openai' || !options.provider)) {
    if (!isPremium) {
      throw new Error('Catalyst Membership ($29.99) required for BYOK access.');
    }
    // Direct call to OpenAI bypasses backend if user has a key
    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userOpenAIKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        messages: [
          ...options.conversation.map(m => ({ role: m.role, content: m.text || m.content })),
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 8192,
        temperature: options.temperature ?? 0.7,
      }),
    });

    const openAIData = await openAIRes.json();
    if (!openAIRes.ok) throw new Error(openAIData.error?.message || 'OpenAI request failed');

    return {
      response: openAIData.choices[0].message.content,
      source: 'openai (BYOK)',
      model: openAIData.model,
    };
  }

  // OpenRouter (free-tier models for testing: Llama, Mistral, Gemma)
  const userOpenRouterKey = kernelStorage.getItem('openrouter_api_key') || kernelStorage.getItem('user_openrouter_key');
  if (userOpenRouterKey && (options.provider === 'openrouter' || (!options.provider && userOpenRouterKey))) {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userOpenRouterKey}`,
        'HTTP-Referer': 'https://novaura.life',
        'X-Title': 'NovAura OS',
      },
      body: JSON.stringify({
        model: options.model || 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          ...(options.conversation || []).map(m => ({ role: m.role, content: m.text || m.content })),
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
      }),
    });
    const orData = await orRes.json();
    if (!orRes.ok) throw new Error(orData.error?.message || 'OpenRouter request failed');
    return {
      response: orData.choices[0].message.content,
      source: 'openrouter (BYOK)',
      model: orData.model,
    };
  }

  const userAIMLKey = kernelStorage.getItem('aimlapi_key') || kernelStorage.getItem('user_aimlapi_key');
  if (userAIMLKey && (options.provider === 'aimlapi' || (options.model && options.model.toLowerCase().includes('gemma')))) {
    const aimlRes = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAIMLKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'google/gemma-3-27b-it',
        messages: [
          ...(options.conversation || []).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : m.role,
            content: m.text || m.content || ''
          })),
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
      }),
    });

    const aimlData = await aimlRes.json();
    if (!aimlRes.ok) throw new Error(aimlData.error?.message || aimlData.error || 'AIML API request failed');

    return {
      response: aimlData.choices[0].message.content,
      source: 'aimlapi (BYOK)',
      model: aimlData.model,
    };
  }

  const userAWSKey = kernelStorage.getItem('aws-bedrock_key') || kernelStorage.getItem('user_aws-bedrock_key');
  if (userAWSKey && (options.provider === 'aws-bedrock' || options.provider === 'nova')) {
    // AWS Bedrock key format: "AccessKey:SecretKey:Region"
    const [accessKey, secretKey, region] = userAWSKey.split(':');
    const res = await fetch(`${BACKEND_URL}/ai/aws/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        prompt,
        accessKey,
        secretKey,
        region: region || 'us-east-1',
        model: options.model || 'amazon.nova-pro-v1:0',
        conversation: options.conversation || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AWS Bedrock request failed');
    return {
      response: data.response,
      source: 'aws-bedrock (BYOK)',
      model: data.model,
    };
  }

  const userAlibabaKey = kernelStorage.getItem('alibaba_key') || kernelStorage.getItem('user_alibaba_key');
  if (userAlibabaKey && (options.provider === 'alibaba' || options.provider === 'qwen')) {
    const res = await fetch(`${BACKEND_URL}/ai/alibaba/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        prompt,
        apiKey: userAlibabaKey,
        model: options.model || 'qwen-3.6-max',
        conversation: options.conversation || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Alibaba Cloud request failed');
    return {
      response: data.response,
      source: 'alibaba (BYOK)',
      model: data.model,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let res;
  try {
    res = await fetch(`${BACKEND_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        prompt,
        provider: options.provider,
        model: options.model,
        maxTokens: options.maxTokens || 8192,
        temperature: options.temperature ?? 0.7,
        conversation: options.conversation || [],
        // Note: API keys are handled server-side based on user tier
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('AI request timed out after 60s');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.detail || `AI request failed (${res.status})`);
  }

  return {
    response: data.response,
    source: data.source || 'cloud',
    model: data.model,
    rateLimit: data.rate_limit,
  };
}

/**
 * Generate code or website through the builder endpoint
 * @param {string} prompt - Generation prompt
 * @param {object} options - { provider, model, mode, template, files, maxTokens }
 */
export async function generateCode(prompt, options = {}) {
  await ensureActionTokens(true);
  const res = await fetch(`${BACKEND_URL}/ai/builder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      prompt,
      provider: options.provider,
      model: options.model,
      mode: options.mode || 'code',
      template: options.template,
      files: options.files || [],
      maxTokens: options.maxTokens || 4096,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Builder generation failed (${res.status})`);
  }

  return {
    code: data.generated_code,
    html: data.html,
    css: data.css,
    js: data.js,
    source: data.source,
    model: data.model,
    rateLimit: data.rate_limit,
  };
}

/**
 * Generate a website
 * @param {string} prompt - Description of the website
 * @param {string} template - Template ID (landing, portfolio, etc.)
 * @param {object} requirements - { responsive, modern, framework }
 */
export async function generateWebsite(prompt, template, requirements = {}) {
  await ensureActionTokens(true);
  const res = await fetch(`${BACKEND_URL}/ai/website/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ prompt, template, requirements }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Website generation failed (${res.status})`);
  }

  return {
    html: data.html || '',
    css: data.css || '',
    js: data.js || '',
    raw: data.raw,
    source: data.source,
    model: data.model,
    rateLimit: data.rate_limit,
  };
}

/**
 * Generate an image via Vertex Imagen
 * @param {string} prompt - Image description
 * @param {string} aspectRatio - e.g. "1:1", "16:9"
 */
export async function generateImage(prompt, aspectRatio = '1:1') {
  const res = await fetch(`${BACKEND_URL}/ai/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ prompt, aspectRatio }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Image generation failed (${res.status})`);
  }

  return { imageUrl: data.imageUrl };
}

/**
 * Generate a video via Vertex AI (Veo or Imagen Video)
 * @param {string} prompt - Video description
 * @param {object} options - { duration, aspectRatio }
 */
export async function generateVideo(prompt, options = {}) {
  const res = await fetch(`${BACKEND_URL}/ai/video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      prompt,
      duration: options.duration || 8,
      aspectRatio: options.aspectRatio || '16:9',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Video generation failed (${res.status})`);
  }

  return { videoUrl: data.videoUrl };
}

/** Get Gemini API key for live WebSocket connections */
export async function getGeminiLiveKey() {
  const res = await fetch(`${BACKEND_URL}/ai/live-key`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data.configured) {
    throw new Error(data.error || 'Gemini Live not configured');
  }
  return data.key;
}

// ─── Local LLM (direct browser connection) ─────────────────────────────

function ensureHttpProtocol(value = '') {
  if (/^https?:\/\//i.test(value)) return value;
  return `http://${value}`;
}

function trimKnownLocalPath(value = '') {
  return value
    .replace(/\/api\/(chat|generate|tags)$/i, '')
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1\/models$/i, '')
    .replace(/\/v1$/i, '')
    .replace(/\/+$/g, '');
}

function resolveLocalTarget(url, type) {
  const input = (url || '').trim();
  const fallback = type === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234';
  const raw = input ? ensureHttpProtocol(input) : fallback;
  const clean = raw.replace(/[?#].*$/, '').replace(/\/+$/g, '');
  const baseUrl = trimKnownLocalPath(clean) || fallback;

  if (type === 'ollama') {
    if (/\/api\/generate$/i.test(clean)) {
      return { baseUrl, requestUrl: clean, mode: 'ollama-generate' };
    }

    return {
      baseUrl,
      requestUrl: /\/api\/chat$/i.test(clean) ? clean : `${baseUrl}/api/chat`,
      mode: 'ollama-chat',
    };
  }

  if (/\/v1\/chat\/completions$/i.test(clean)) {
    return { baseUrl, requestUrl: clean, mode: 'lmstudio-chat' };
  }

  if (/\/v1$/i.test(clean)) {
    return { baseUrl, requestUrl: `${clean}/chat/completions`, mode: 'lmstudio-chat' };
  }

  return {
    baseUrl,
    requestUrl: `${baseUrl}/v1/chat/completions`,
    mode: 'lmstudio-chat',
  };
}

async function discoverLocalModel(baseUrl, type) {
  try {
    if (type === 'ollama') {
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return undefined;
      const data = await res.json();
      return data.models?.find((m) => typeof m?.name === 'string' && m.name.length > 0)?.name;
    }

    const res = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.data?.find((m) => typeof m?.id === 'string' && m.id.length > 0)?.id;
  } catch {
    return undefined;
  }
}

/**
 * Chat with a local LLM (Ollama or LM Studio) directly from the browser
 * @param {string} message - User message
 * @param {object} config - { url, type, model }
 */
/**
 * Chat with a local LLM (Ollama or LM Studio) directly from the browser
 * @param {string} message - User message
 * @param {object} config - { url, type, model, systemPrompt, conversation }
 */
export async function chatLocal(message, config) {
  let user = null;
  try {
    user = JSON.parse(kernelStorage.getItem('user_data') || 'null');
  } catch (e) {
    console.error('Failed to parse user data from kernel storage:', e);
  }

  const isPremium = user?.membershipTier === 'catalyst' ||
    user?.membershipTier === 'nova' ||
    user?.membershipTier === 'catalytic-crew' ||
    user?.membershipTier === 'spark' ||
    user?.membershipTier === 'emergent' ||
    user?.membershipTier === 'founding-spark' ||
    user?.membershipTier === 'founding-catalyst' ||
    user?.membershipTier === 'founding-nova' ||
    user?.membershipTier === 'founding-father' ||
    user?.membershipTier === 'council-member' ||
    user?.membershipTier === 'catalyst-crew-founders' ||
    user?.membershipTier === 'strategic-investor' ||
    user?.email?.endsWith('@novaura.xyz') ||
    user?.email?.endsWith('@novaura.life');

  // IDE usage charge for Free tier: 0.25 action tokens per action
  if (!isPremium && config.isIDE) {
    // Direct Firestore update for tokens in WebOS
    try {
      const { db } = await import('../config/firebase');
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      if (db && user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const currentTokens = data.actionTokens || 0;
          if (currentTokens < 0.25) {
            throw new Error('Action tokens required for IDE usage (0.25/action). Please upgrade to Spark or purchase tokens.');
          }
          await updateDoc(userRef, { actionTokens: currentTokens - 0.25 });
        }
      }
    } catch (e) {
      if (e.message.includes('Action tokens required')) throw e;
      console.warn('Failed to deduct tokens:', e);
    }
  } else if (!isPremium && !config.isIDE) {
    // Regular local chat is free for everyone, but we still verify access exists
    // (Local AI Chat is permitted for free users as long as it's not IDE)
  }

  const target = resolveLocalTarget(config.url, config.type);
  const discoveredModel = await discoverLocalModel(target.baseUrl, config.type);
  const selectedModel = config.model || discoveredModel || (config.type === 'ollama' ? 'gemma3:27b' : 'local-model');

  if (config.type === 'ollama') {
    const messages = [];
    if (config.systemPrompt) {
      messages.push({ role: 'system', content: config.systemPrompt });
    }
    // Append conversation history if provided
    if (config.conversation?.length) {
      messages.push(...config.conversation);
    }
    messages.push({ role: 'user', content: message });

    const body = target.mode === 'ollama-generate'
      ? {
        model: selectedModel,
        prompt: [
          config.systemPrompt ? `System: ${config.systemPrompt}` : '',
          config.conversation?.length ? config.conversation.map((m) => `${m.role}: ${m.content}`).join('\n') : '',
          `User: ${message}`,
        ].filter(Boolean).join('\n\n'),
        stream: false,
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens || 8192,
        },
      }
      : {
        model: selectedModel,
        messages,
        stream: false,
      };

    const res = await fetch(target.requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Ollama error ${res.status} at ${target.requestUrl}: ${err || 'No response body'}`);
    }
    const data = await res.json();
    return {
      response: data.message?.content || data.response || 'No response from Ollama',
      source: `ollama (${selectedModel})`,
      model: selectedModel,
    };
  }

  // LM Studio / OpenAI-compatible
  const messages = [];
  if (config.systemPrompt) {
    messages.push({ role: 'system', content: config.systemPrompt });
  }
  if (config.conversation?.length) {
    messages.push(...config.conversation);
  }
  messages.push({ role: 'user', content: message });

  const res = await fetch(target.requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens || 8192,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`LM Studio error ${res.status} at ${target.requestUrl}: ${err || 'No response body'}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || 'No response';
  return {
    response: content,
    source: `lmstudio (${selectedModel})`,
    model: selectedModel,
  };
}

/**
 * Probe a local Ollama server and return available models
 * @param {string} url - Ollama base URL (default localhost:11434)
 * @returns {{ connected: boolean, models: string[], error?: string }}
 */
export async function probeOllama(url = 'http://localhost:11434') {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { connected: false, models: [], error: `Status ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map(m => m.name || 'unknown');
    return { connected: true, models };
  } catch (e) {
    return { connected: false, models: [], error: e.message };
  }
}

/**
 * Build a default task routing config based on available local models
 * Maps task categories to the best available model for that job
 */
export function buildTaskRouting(models = []) {
  const has = (q) => models.some(m => m.toLowerCase().includes(q));

  // Pick best model per category from what's available (2026 Standard)
  const codingModel = has('llama4') ? models.find(m => m.includes('llama4'))
    : has('gemma3') ? models.find(m => m.includes('gemma3'))
      : models[0];

  const chatModel = has('gemma3:27b') ? 'gemma3:27b'
    : has('gemma3') ? models.find(m => m.includes('gemma3'))
      : has('llama4') ? models.find(m => m.includes('llama4'))
        : models[0];

  const fastModel = has('gemma3:2b') ? 'gemma3:2b'
    : models[0];

  return {
    general: { provider: 'ollama', model: chatModel },
    conversations: { provider: 'ollama', model: chatModel },
    coding: { provider: 'ollama', model: codingModel },
    creative: { provider: 'ollama', model: chatModel },
    analysis: { provider: 'ollama', model: chatModel },
    quick: { provider: 'ollama', model: fastModel },
  };
}

// ─── Smart Router ──────────────────────────────────────────────────────

/**
 * Resolve which provider to use based on llmConfig and task category.
 * Returns a config object for either local or cloud routing.
 *
 * @param {string} taskCategory - 'general', 'coding', 'conversations', etc.
 * @param {object} llmConfig - From localStorage llm_config
 */
export function resolveProvider(taskCategory = 'general', llmConfig = {}) {
  const routing = llmConfig?.taskRouting?.[taskCategory]
    || llmConfig?.taskRouting?.general
    || { provider: 'auto', model: '' };

  if (routing.provider === 'ollama') {
    return {
      type: 'local',
      localType: 'ollama',
      url: llmConfig.ollamaUrl || 'http://localhost:11434',
      model: routing.model || llmConfig.ollamaModels?.[0] || 'llama3.1:8b',
    };
  }
  if (routing.provider === 'lmstudio') {
    return {
      type: 'local',
      localType: 'lmstudio',
      url: llmConfig.lmstudioUrl || 'http://localhost:1234',
      model: routing.model || llmConfig.lmstudioModels?.[0] || 'local-model',
    };
  }
  if (['gemini', 'vertex'].includes(routing.provider)) {
    return { type: 'cloud', provider: routing.provider, model: routing.model };
  }
  if (routing.provider === 'openrouter') {
    return { type: 'cloud', provider: 'openrouter', model: routing.model || 'meta-llama/llama-3.1-8b-instruct:free' };
  }
  if (routing.provider === 'huggingface') {
    return { type: 'cloud', provider: 'huggingface', model: routing.model || 'microsoft/DialoGPT-medium' };
  }

  // Auto: try local first, fallback to cloud
  if (llmConfig?.useLocalLLM && llmConfig?.localLLMUrl) {
    const url = llmConfig.localLLMUrl.replace(/\/$/, '');
    const looksOllamaByPath = /\/api\/(chat|generate|tags)$/i.test(url);
    const looksLMStudioByPath = /\/v1(\/chat\/completions|\/models)?$/i.test(url);
    const isOllama = looksOllamaByPath || (!looksLMStudioByPath && (url.includes(':11434') || url.toLowerCase().includes('ollama')));

    return {
      type: 'local',
      localType: isOllama ? 'ollama' : 'lmstudio',
      url,
      model: llmConfig.availableModels?.[0] || (isOllama ? 'llama3.1:8b' : 'local-model'),
    };
  }

  return { type: 'cloud', provider: undefined }; // let backend pick best available
}

/**
 * Smart chat — routes to local or cloud based on llmConfig
 * @param {string} message - User message
 * @param {string} taskCategory - Task routing category
 * @param {object} llmConfig - From localStorage llm_config
 * @returns {{ response: string, source: string, model?: string }}
 */
export async function smartChat(message, taskCategory = 'general', llmConfig = {}) {
  const resolved = resolveProvider(taskCategory, llmConfig);

  // ── Persona Routing ────────────────────────────────────────────────────────

  // Nova: Gemma 4 31B via OpenRouter → Gemini fallback
  if (taskCategory === 'nova') {
    try {
      return await chatCloud(message, {
        provider: 'openrouter',
        model: OR_MODELS.NOVA,
        conversation: llmConfig.conversation,
        maxTokens: 8192,
      });
    } catch (e) {
      console.warn('[Nova] OpenRouter failed, falling back to Gemini:', e.message);
      return await chatCloud(message, { provider: 'gemini', model: 'gemini-2.0-flash', conversation: llmConfig.conversation });
    }
  }

  // Aura: Gemma 4 26B A4B via OpenRouter → Gemini Pro fallback
  if (taskCategory === 'aura') {
    try {
      return await chatCloud(message, {
        provider: 'openrouter',
        model: OR_MODELS.AURA,
        conversation: llmConfig.conversation,
        maxTokens: 8192,
      });
    } catch (e) {
      console.warn('[Aura] OpenRouter failed, falling back to Gemini Pro:', e.message);
      return await chatCloud(message, { provider: 'gemini', model: 'gemini-3.1-pro', conversation: llmConfig.conversation });
    }
  }

  // Cybeni: Qwen via Alibaba (unchanged — paid, high quality)
  if (taskCategory === 'cybeni') {
    return await chatCloud(message, { provider: 'alibaba', model: 'qwen-3.6-max', conversation: llmConfig.conversation });
  }

  // Claude: Anthropic direct
  if (taskCategory === 'claude') {
    return await chatCloud(message, { provider: 'anthropic', model: 'claude-4.7-sonnet', conversation: llmConfig.conversation });
  }

  // ── Coding: Qwen3 Coder 480B → Hermes 3 405B → Gemini fallback ────────────
  if (taskCategory === 'coding' || taskCategory === 'ide') {
    try {
      return await chatCloud(message, {
        provider: 'openrouter',
        model: OR_MODELS.QWEN_CODER,
        conversation: llmConfig.conversation,
        maxTokens: 8192,
      });
    } catch {
      try {
        return await chatCloud(message, {
          provider: 'openrouter',
          model: OR_MODELS.HERMES,
          conversation: llmConfig.conversation,
          maxTokens: 8192,
        });
      } catch (e) {
        console.warn('[Coding] OpenRouter failed, falling back to Gemini:', e.message);
        // Fall through to default
      }
    }
  }

  // ── Local LLM (user-configured) ───────────────────────────────────────────
  if (resolved.type === 'local') {
    try {
      return await chatLocal(message, {
        url: resolved.url,
        type: resolved.localType,
        model: resolved.model,
        isIDE: taskCategory === 'coding' || taskCategory === 'literature',
      });
    } catch (localError) {
      console.warn('Local LLM failed, falling back to cloud:', localError);
    }
  }

  // ── General: OpenRouter free pool → Gemini fallback ───────────────────────
  // Try Nemotron → Qwen3 80B → GPT OSS → Gemini
  const generalPool = [OR_MODELS.NEMOTRON, OR_MODELS.QWEN_80B, OR_MODELS.GPT_OSS];
  for (const orModel of generalPool) {
    try {
      return await chatCloud(message, {
        provider: 'openrouter',
        model: orModel,
        conversation: llmConfig.conversation,
        maxTokens: 8192,
      });
    } catch {
      console.warn(`[General] OpenRouter model ${orModel} failed, trying next...`);
    }
  }

  // Hard fallback: Gemini
  return await chatCloud(message, {
    provider: 'gemini',
    model: resolved.model || 'gemini-2.0-flash',
  });
}

/**
 * Simplified OpenResponses API call.
 * @param {string} input - User message or multimodal input
 * @param {string} model - Model slug
 */
export async function sendOpenResponse(input, model = 'google/gemini-2.0-flash-001') {
  const res = await fetch(`${BACKEND_URL}/ai/beta/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ input, model }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'OpenResponses request failed');
  }

  return data;
}
