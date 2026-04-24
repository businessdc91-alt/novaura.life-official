import { kernelStorage } from '../kernel/kernelStorage.js';
import { useAuthStore } from '../../platform/src/stores/authStore';
/**
 * NovAura AI Service — Centralized API layer
 *
 * All AI calls route through here. Handles:
 * - Cloud providers via backend proxy (Gemini, Claude, OpenAI, Kimi, Vertex)
 * - Local LLM direct-from-browser (Ollama, LM Studio)
 * - Smart routing based on task category and llmConfig
 * - Auth headers, error handling, provider fallback
 */

export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-systems.cloudfunctions.net/api').replace(/\/$/, '');

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
async function ensureActionTokens(isIDE = false) {
  const { user } = useAuthStore.getState();
  const isPremium = user?.membershipTier === 'catalyst' ||
    user?.membershipTier === 'nova' ||
    user?.membershipTier === 'catalytic-crew' ||
    user?.membershipTier === 'spark' ||
    user?.membershipTier === 'emergent' ||
    user?.membershipTier === 'founding-spark' ||
    user?.membershipTier === 'founding-catalyst' ||
    user?.membershipTier === 'founding-nova' ||
    user?.membershipTier === 'catalyst-crew-founders' ||
    user?.membershipTier === 'strategic-investor' ||
    user?.email?.endsWith('@novaura.life');

  if (!isPremium && isIDE) {
    const { useActionTokens } = useAuthStore.getState();
    const success = await useActionTokens(0.25);
    if (!success) {
      throw new Error('Action tokens required for IDE usage (0.25/action). Please upgrade to Spark or purchase tokens.');
    }
  }
  return isPremium;
}

/**
 * Chat with a cloud AI provider through the backend
 * @param {string} prompt - User message
 * @param {object} options - { provider, model, maxTokens, temperature, conversation, isIDE }
 */
export async function chatCloud(prompt, options = {}) {
  const { user } = useAuthStore.getState();
  const isPremium = await ensureActionTokens(options.isIDE);

  // Azure OpenAI (Kimi) BYOK / System Fallback
  const userKimiData = kernelStorage.getItem('kimi_key');
  const userAzureData = kernelStorage.getItem('azure_key') || kernelStorage.getItem('user_azure_key');

  let azureOpenAIKey = 'l1EbAyY4Y8xoQiTr6cdCUgmRX23TqEqpJ0pMZJ4y6RXEDAwR0a8yJQQJ99CCACHYHv6XJ3w3AAAAACOG1UQ9';
  let azureEndpoint = 'https://livenovaura-resource.openai.azure.com/';

  // Priority: 1. Specific provider key, 2. Generic azure key, 3. System fallback
  const effectiveData = (options.provider === 'kimi' && userKimiData) ? userKimiData : (userAzureData || userKimiData);

  if (effectiveData && effectiveData.includes('|')) {
    const [savedKey, savedEndpoint] = effectiveData.split('|');
    azureOpenAIKey = savedKey;
    azureEndpoint = savedEndpoint;
  }

  if (options.provider === 'kimi' || options.provider === 'azure') {
    const deployment = options.model || (options.provider === 'kimi' ? 'kimi' : 'gpt-4o');
    const apiVersion = '2024-05-01-preview';
    const baseUrl = azureEndpoint.endsWith('/') ? azureEndpoint : `${azureEndpoint}/`;

    // Intelligent URL construction based on Azure service type
    let url;
    if (baseUrl.includes('/openai/deployments/')) {
      // User pasted a full deployment-specific URL
      url = baseUrl.includes('api-version=') ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}api-version=${apiVersion}`;
    } else if (baseUrl.includes('.services.ai.azure.com')) {
      // Azure AI Foundry / MaaS (Kimi, Llama, etc.)
      url = `${baseUrl}models/chat/completions?api-version=${apiVersion}`;
    } else {
      // Standard Azure OpenAI Base URL
      url = `${baseUrl}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureOpenAIKey,
      },
      body: JSON.stringify({
        messages: [
          ...(options.conversation || []).map(m => ({ role: m.role, content: m.text || m.content })),
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`Azure OpenAI Error: ${res.status} - ${errorData.error?.message || 'Unknown Error'}`);
    }

    const data = await res.json();
    return {
      response: data.choices[0].message.content,
      source: userAzureData ? 'azure (BYOK)' : 'azure (system)',
      model: deployment,
    };
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
        max_tokens: options.maxTokens || 1024,
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

  const userAIMLKey = kernelStorage.getItem('aimlapi_key') || kernelStorage.getItem('user_aimlapi_key');
  if (userAIMLKey && (options.provider === 'aimlapi' || (options.model && options.model.toLowerCase().includes('gemma')))) {
    const aimlRes = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAIMLKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'google/gemma-7b-it',
        messages: [
          ...(options.conversation || []).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : m.role,
            content: m.text || m.content || ''
          })),
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 1024,
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
        model: options.model || 'qwen-max',
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

  const res = await fetch(`${BACKEND_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      prompt,
      provider: options.provider,
      model: options.model,
      maxTokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      conversation: options.conversation || [],
      // Note: API keys are handled server-side based on user tier
    }),
  });

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
  const { user } = useAuthStore.getState();
  const isPremium = user?.membershipTier === 'catalyst' ||
    user?.membershipTier === 'nova' ||
    user?.membershipTier === 'catalytic-crew' ||
    user?.membershipTier === 'spark' ||
    user?.membershipTier === 'emergent' ||
    user?.membershipTier === 'founding-spark' ||
    user?.membershipTier === 'founding-catalyst' ||
    user?.membershipTier === 'founding-nova' ||
    user?.membershipTier === 'catalyst-crew-founders' ||
    user?.membershipTier === 'strategic-investor' ||
    user?.email?.endsWith('@novaura.life');

  // IDE usage charge for Free tier: 0.25 action tokens per action
  if (!isPremium && config.isIDE) {
    const { useActionTokens } = useAuthStore.getState();
    const success = await useActionTokens(0.25);
    if (!success) {
      throw new Error('Action tokens required for IDE usage (0.25/action). Please upgrade to Spark or purchase tokens.');
    }
  } else if (!isPremium && !config.isIDE) {
    // Regular local chat is free for everyone, but we still verify access exists
    // (Local AI Chat is permitted for free users as long as it's not IDE)
  }

  const target = resolveLocalTarget(config.url, config.type);
  const discoveredModel = await discoverLocalModel(target.baseUrl, config.type);
  const selectedModel = config.model || discoveredModel || (config.type === 'ollama' ? 'llama4:latest' : 'local-model');

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
          num_predict: config.maxTokens || 1024,
        },
      }
      : {
        model: selectedModel,
        messages,
        stream: false,
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens || 1024,
        },
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
      max_tokens: config.maxTokens || 1024,
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

  const chatModel = has('llama4:latest') ? 'llama4:latest'
    : has('llama4') ? models.find(m => m.includes('llama4'))
      : has('gemma3') ? models.find(m => m.includes('gemma3'))
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

  // Specialized Persona Routing
  if (taskCategory === 'nova') {
    return await chatCloud(message, { provider: 'aws-bedrock', model: 'amazon.nova-pro-v1:0', conversation: llmConfig.conversation });
  }
  if (taskCategory === 'cybeni') {
    return await chatCloud(message, { provider: 'alibaba', model: 'qwen-max', conversation: llmConfig.conversation });
  }
  if (taskCategory === 'aura') {
    return await chatCloud(message, { provider: 'gemini', model: 'gemini-2.0-flash', conversation: llmConfig.conversation });
  }

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
      // Fall through to cloud
    }
  }

  return await chatCloud(message, {
    provider: 'gemini',
    model: resolved.model || 'gemini-2.5-flash',
  });
}
