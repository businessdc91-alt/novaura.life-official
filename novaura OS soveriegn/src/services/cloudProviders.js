// cloudProviders.js — Bring-your-own-key frontier models.
//
// Sovereign is local-first; these are for people who already pay for a provider
// and want to use it here too. Keys stay in the local vault. In the desktop app,
// requests go through the native `cloud_ai_request` command (several providers
// refuse requests from a web page, and the key stays out of the web view's
// network log); a custom OpenAI-compatible endpoint is called directly.
//
// Each provider is one of four API shapes: anthropic, gemini, openai (the
// OpenAI-compatible chat API most providers offer) and bedrock (Amazon's Converse API).

import {
  resolveReasoningParams,
  anthropicEffort,
  openAiReasoningEffort,
  geminiThinkingConfig,
  reasoningTokenBudget,
} from './reasoningConfig.js';

export const PROVIDERS = [
  {
    id: 'claude', label: 'Claude', vendor: 'Anthropic', kind: 'anthropic',
    base: 'https://api.anthropic.com/v1', defaultModel: 'claude-opus-5-5',
    suggested: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'API usage is billed separately from a Claude Pro or Max subscription.',
  },
  {
    id: 'gemini', label: 'Gemini', vendor: 'Google AI Studio', kind: 'gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: '',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Google AI Studio keys are free to create and include a daily free allowance.',
  },
  {
    id: 'openai', label: 'OpenAI', vendor: 'OpenAI', kind: 'openai',
    base: 'https://api.openai.com/v1', defaultModel: '', jsonSchema: true, completionTokens: true,
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'kimi', label: 'Kimi', vendor: 'Moonshot AI', kind: 'openai',
    base: 'https://api.moonshot.ai/v1', defaultModel: '',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
  },
  {
    id: 'qwen', label: 'Qwen', vendor: 'Alibaba Cloud Model Studio', kind: 'openai',
    base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus',
    keyUrl: 'https://www.alibabacloud.com/help/en/model-studio/get-api-key',
  },
  {
    id: 'deepseek', label: 'DeepSeek', vendor: 'DeepSeek', kind: 'openai',
    base: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'mistral', label: 'Mistral', vendor: 'Mistral AI', kind: 'openai',
    base: 'https://api.mistral.ai/v1', defaultModel: '',
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'xai', label: 'Grok', vendor: 'xAI', kind: 'openai',
    base: 'https://api.x.ai/v1', defaultModel: '',
    keyUrl: 'https://console.x.ai',
  },
  {
    id: 'bedrock', label: 'Amazon Nova', vendor: 'Amazon Bedrock', kind: 'bedrock',
    defaultModel: 'us.amazon.nova-pro-v1:0', region: 'us-east-1',
    suggested: ['us.amazon.nova-premier-v1:0', 'us.amazon.nova-pro-v1:0', 'us.amazon.nova-lite-v1:0', 'us.amazon.nova-micro-v1:0'],
    keyUrl: 'https://console.aws.amazon.com/bedrock/home#/api-keys',
    note: 'Uses a Bedrock API key. Model ids and access differ by region; enable the model in the Bedrock console first.',
  },
  {
    id: 'openrouter', label: 'OpenRouter', vendor: 'OpenRouter (hundreds of models)', kind: 'openai',
    base: 'https://openrouter.ai/api/v1', defaultModel: '', jsonSchema: true,
    extraHeaders: { 'HTTP-Referer': 'https://novaura.life', 'X-Title': 'Novaura Sovereign OS' },
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'byok', label: 'Custom endpoint', vendor: 'Any OpenAI-compatible API', kind: 'openai', custom: true,
    base: 'https://api.openai.com/v1', defaultModel: '',
    note: 'For self-hosted servers (vLLM, a friend\'s LM Studio) or any provider with an OpenAI-compatible API.',
  },
];

export const getProvider = (id) => PROVIDERS.find(p => p.id === id) || null;

// Vault entry names: the key itself is stored under the provider id.
export const modelSetting = (id) => `${id}_model`;

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

/** The endpoint base for a provider, honouring user settings (custom URL, Bedrock region). */
export function providerBase(provider, getKey) {
  if (provider.custom) return String(getKey('byok_endpoint') || provider.base).replace(/\/+$/, '');
  if (provider.kind === 'bedrock') {
    const region = String(getKey('bedrock_region') || provider.region).trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(region)) throw new Error('The Bedrock region looks wrong (for example us-east-1).');
    return `https://bedrock-runtime.${region}.amazonaws.com`;
  }
  return provider.base;
}

// ── Transport ──────────────────────────────────────────────────────────────

async function send(provider, { url, method = 'POST', headers = {}, body, timeoutSecs = 600 }) {
  const json = body === undefined ? undefined : JSON.stringify(body);
  if (isTauri() && !provider.custom) {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke('cloud_ai_request', {
      request: { url, method, headers: Object.entries(headers), body: json ?? null, timeout_secs: timeoutSecs },
    });
    return { status: res.status, text: res.body };
  }
  const res = await fetch(url, { method, headers, body: json });
  return { status: res.status, text: await res.text() };
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function errorMessage(provider, status, text) {
  const data = parseJson(text);
  const detail = data?.error?.message || data?.message || data?.error || data?.detail || String(text || '').slice(0, 300);
  const hint = status === 401 || status === 403 ? ' Check the key in Settings → AI Keys & Models.'
    : status === 404 ? ' The model name may be wrong or not available to your account.'
      : status === 429 ? ' Rate limit or quota reached; wait a moment or check your plan.' : '';
  const message = (typeof detail === 'string' ? detail : JSON.stringify(detail)).trim();
  return `${provider.label} error (${status}): ${message}${hint && !/[.!?]$/.test(message) ? '.' : ''}${hint}`;
}

async function request(provider, opts) {
  const res = await send(provider, opts);
  if (res.status < 200 || res.status >= 300) throw new Error(errorMessage(provider, res.status, res.text));
  const data = parseJson(res.text);
  if (!data) throw new Error(`${provider.label} returned a reply that is not JSON.`);
  return data;
}

// ── Message shapes ─────────────────────────────────────────────────────────

// Providers that need alternating turns get consecutive same-role messages merged.
function splitSystem(messages) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const turns = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n\n${m.content}`;
    else turns.push({ role, content: String(m.content ?? '') });
  }
  return { system, turns };
}

// Gemini and some OpenAI-compatible APIs accept only a subset of JSON Schema.
function stripSchema(schema) {
  if (Array.isArray(schema)) return schema.map(stripSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    out[k] = stripSchema(v);
  }
  return out;
}

// ── Adapters ───────────────────────────────────────────────────────────────

const ADAPTERS = {
  async anthropic(provider, base, key, model, messages, o) {
    const { system, turns } = splitSystem(messages);
    const resolved = resolveReasoningParams(o);
    const outputConfig = { effort: anthropicEffort(resolved) };
    if (o.jsonSchema) outputConfig.format = { type: 'json_schema', schema: o.jsonSchema };
    const maxTokens = reasoningTokenBudget(o.maxTokens ?? 16000, resolved, { strictMaxTokens: Boolean(o.jsonSchema && !resolved.think) });
    // Current Claude models choose their own sampling, so temperature is not sent.
    // Server-side fallback re-runs a policy-declined request on a suitable model.
    const fallback = /^claude-(opus-5|fable)/.test(model);
    const data = await request(provider, {
      url: `${base}/messages`,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        ...(fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
        ...(isTauri() ? {} : { 'anthropic-dangerous-direct-browser-access': 'true' }),
      },
      body: {
        model,
        max_tokens: maxTokens,
        output_config: outputConfig,
        ...(fallback ? { fallbacks: 'default' } : {}),
        ...(system ? { system } : {}),
        messages: turns,
      },
    });
    if (data.stop_reason === 'refusal') {
      throw new Error(`Claude declined this request: ${data.stop_details?.explanation || 'declined by model safeguards.'}`);
    }
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  },

  async gemini(provider, base, key, model, messages, o) {
    const { system, turns } = splitSystem(messages);
    const resolved = resolveReasoningParams(o);
    const maxOutputTokens = reasoningTokenBudget(o.maxTokens ?? 8192, resolved, { strictMaxTokens: Boolean(o.jsonSchema && !resolved.think) });
    const generationConfig = {
      temperature: o.temperature ?? 0.7,
      maxOutputTokens,
      thinkingConfig: geminiThinkingConfig(resolved),
    };
    if (o.jsonSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = stripSchema(o.jsonSchema);
    }
    const callGemini = (cfg) => request(provider, {
      url: `${base}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: turns.map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
        generationConfig: cfg,
      },
    });
    let data;
    try {
      data = await callGemini(generationConfig);
    } catch (err) {
      if (/\(400\)|thinking/i.test(String(err?.message || ''))) {
        const { thinkingConfig: _drop, ...fallbackCfg } = generationConfig;
        data = await callGemini(fallbackCfg);
      } else {
        throw err;
      }
    }
    const candidate = data.candidates?.[0];
    if (!candidate && data.promptFeedback?.blockReason) throw new Error(`Gemini blocked this request (${data.promptFeedback.blockReason}).`);
    return (candidate?.content?.parts || []).map(p => p.text || '').join('');
  },

  async openai(provider, base, key, model, messages, o) {
    const resolved = resolveReasoningParams(o);
    const maxBudget = reasoningTokenBudget(o.maxTokens ?? 8192, resolved, { strictMaxTokens: Boolean(o.jsonSchema && !resolved.think) });
    const buildBody = (includeEffort) => {
      const body = { model, messages: messages.map(m => ({ role: m.role, content: m.content })) };
      if (provider.completionTokens) {
        body.max_completion_tokens = maxBudget;
      } else {
        body.max_tokens = maxBudget;
        body.temperature = o.temperature ?? 0.7;
      }
      if (includeEffort) {
        body.reasoning_effort = openAiReasoningEffort(resolved);
      }
      if (o.jsonSchema) {
        body.response_format = provider.jsonSchema
          ? { type: 'json_schema', json_schema: { name: 'result', strict: false, schema: o.jsonSchema } }
          : { type: 'json_object' };
      }
      return body;
    };
    const callOpenAi = (includeEffort) => request(provider, {
      url: `${base}/chat/completions`,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...(provider.extraHeaders || {}) },
      body: buildBody(includeEffort),
    });
    let data;
    try {
      data = await callOpenAi(true);
    } catch (err) {
      if (/\(400\)|reasoning_effort|unknown|unrecognized|unsupported/i.test(String(err?.message || ''))) {
        data = await callOpenAi(false);
      } else {
        throw err;
      }
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(c => c.text || '').join('');
    throw new Error(`${provider.label} returned no text.`);
  },

  async bedrock(provider, base, key, model, messages, o) {
    const { system, turns } = splitSystem(messages);
    const data = await request(provider, {
      url: `${base}/model/${encodeURIComponent(model)}/converse`,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: {
        ...(system ? { system: [{ text: system }] } : {}),
        messages: turns.map(t => ({ role: t.role, content: [{ text: t.content }] })),
        inferenceConfig: { maxTokens: Math.min(o.maxTokens ?? 8192, 10000), temperature: o.temperature ?? 0.7 },
      },
    });
    return (data.output?.message?.content || []).map(c => c.text || '').join('');
  },
};

/**
 * Chat with a provider. getKey(name) reads the vault.
 * options: { model?, maxTokens?, temperature?, jsonSchema?, effort? }
 */
export async function providerChat(id, messages, getKey, options = {}) {
  const provider = getProvider(id);
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  const key = getKey(id);
  if (!key) throw new Error(`No ${provider.label} key yet. Add one in Settings → AI Keys & Models.`);
  const model = options.model || getKey(modelSetting(id)) || provider.defaultModel;
  if (!model) throw new Error(`Choose a ${provider.label} model in Settings → AI Keys & Models.`);
  const base = providerBase(provider, getKey);
  return ADAPTERS[provider.kind](provider, base, key, model, messages, options);
}

/** Models the key can use, newest first where the API says so. Bedrock has no listing; its suggestions are returned. */
export async function listProviderModels(id, getKey) {
  const provider = getProvider(id);
  if (!provider) return [];
  const key = getKey(id);
  if (!key) throw new Error(`Add a ${provider.label} key first.`);
  const base = providerBase(provider, getKey);
  if (provider.kind === 'bedrock') return provider.suggested || [];
  if (provider.kind === 'anthropic') {
    const data = await request(provider, { url: `${base}/models?limit=100`, method: 'GET', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', ...(isTauri() ? {} : { 'anthropic-dangerous-direct-browser-access': 'true' }) } });
    return (data.data || []).map(m => m.id);
  }
  if (provider.kind === 'gemini') {
    const data = await request(provider, { url: `${base}/models?pageSize=200`, method: 'GET', headers: { 'x-goog-api-key': key } });
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''));
  }
  const data = await request(provider, { url: `${base}/models`, method: 'GET', headers: { authorization: `Bearer ${key}`, ...(provider.extraHeaders || {}) } });
  return (data.data || []).map(m => m.id).filter(Boolean).sort();
}

/** One short round trip to prove the key and model work. Resolves with the reply. */
export async function testProvider(id, getKey) {
  return providerChat(id, [
    { role: 'system', content: 'You are a connection test. Reply with exactly: OK' },
    { role: 'user', content: 'Reply with OK.' },
  ], getKey, { maxTokens: 64, temperature: 0, effort: 'low' });
}
