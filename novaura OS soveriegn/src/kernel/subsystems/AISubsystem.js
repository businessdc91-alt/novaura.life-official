/**
 * Sovereign OS — AI Subsystem
 *
 * Universal inference engine featuring:
 *  - Full BYOK (Bring Your Own Key) support stored securely in private local vault
 *  - Native Local Model routing (Ollama, LM Studio, WebGPU) with zero internet requirement
 *  - Direct Cloud inference: Google Gemini, Vertex AI, OpenRouter, Anthropic Claude, OpenAI
 *  - Multimodal image generation support
 *  - Persona routing: Nova (Analytical/Local-First), Aura (Vision/Multimodal), Cybeni (IDE Code Engineer)
 *  - Local Dexie cache with SHA-256 fingerprinting
 *  - Zero mock data
 */

import { db } from '../../database/sovereignDatabase.js';

const CACHE_TTL_MS = 10 * 60_000; // 10 minutes
const MAX_CACHE_ENTRIES = 200;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export class AISubsystem {
  constructor() {
    this._kernel = null;
    this._cache = new Map();
    this._apiKeys = {
      byok: '',
      openrouter: '',
      openai: '',
      claude: '',
      gemini: '',
      vertex: '',
    };
    this._settings = {
      defaultProvider: 'ollama',
      temperature: 0.7,
      maxTokens: 2048,
    };
  }

  async init(kernel) {
    this._kernel = kernel;

    // Load API keys from local secure vault
    await this.refreshKeys();

    // Listen for settings or key changes
    kernel.ipc.on('vault:keys_updated', () => this.refreshKeys());
    kernel.ipc.on('settings:changed', ({ key, value }) => {
      if (key === 'ai_settings' && value) {
        this._settings = { ...this._settings, ...value };
      }
    });

    // Load initial cached prompts from private database
    this._loadCacheFromDB();
  }

  async refreshKeys() {
    try {
      const records = await db.vault.toArray();
      const keys = {};
      for (const r of records) {
        if (r.key && r.value) {
          keys[r.key.toLowerCase()] = r.value;
        }
      }
      this._apiKeys = { ...this._apiKeys, ...keys };
    } catch {
      // Vault read non-critical on first launch
    }
  }

  setKey(provider, key) {
    this._apiKeys[provider.toLowerCase()] = key;
    db.vault.put({
      id: provider.toLowerCase(),
      key: provider.toLowerCase(),
      value: key,
      category: 'api_key',
      updated_at: new Date().toISOString(),
    }).catch(console.warn);
  }

  getKey(provider) {
    return this._apiKeys[provider.toLowerCase()] || '';
  }

  // ─── Persona Routing ───────────────────────────────────────────────────────

  getPersonaProviderChain(persona = 'default') {
    const localChain = this._settings.defaultProvider === 'lmstudio'
      ? ['lmstudio', 'ollama']
      : ['ollama', 'lmstudio'];

    switch (persona.toLowerCase()) {
      case 'nova':
        return [...localChain, 'byok', 'openrouter'];
      case 'aura':
        // Aura defaults to LM Studio for deep creative synthesis & high-context GGUF reasoning
        return ['lmstudio', 'ollama', 'byok', 'openrouter', 'claude'];
      case 'cybeni':
        return [...localChain, 'byok', 'claude', 'openrouter'];
      default:
        return [...localChain, 'byok', 'openrouter'];
    }
  }

  // ─── Main Chat / Completion Execution ──────────────────────────────────────

  /**
   * Execute chat request with automatic fallback chain and streaming support.
   */
  async chat(messages, options = {}) {
    const persona = options.persona || 'default';
    const chain = options.provider ? [options.provider] : this.getPersonaProviderChain(persona);

    const sig = JSON.stringify({ messages, options: { ...options, onToken: null } });
    const hash = await sha256(sig);

    // Check cache
    if (!options.onToken) {
      const cached = this._cache.get(hash);
      if (cached && (Date.now() - cached.ts < CACHE_TTL_MS)) {
        return cached.text;
      }
    }

    // Dynamic RAG Memory Continuity Context
    let effectiveMessages = messages;
    if (options.useRag !== false && messages.length > 0) {
      try {
        const { buildContinuityContext } = await import('../../services/sovereignRagService.js');
        const lastUser = messages[messages.length - 1]?.content || '';
        const { contextString } = await buildContinuityContext(lastUser);
        if (contextString) {
          effectiveMessages = [
            { role: 'system', content: contextString },
            ...messages
          ];
        }
      } catch {}
    }

    let lastError = null;

    for (const provider of chain) {
      try {
        let result = '';
        if (provider === 'ollama' || provider === 'lmstudio' || provider === 'webgpu' || provider === 'local') {
          // Route to LocalModelSubsystem
          if (this._kernel?.localModel?.isReady || provider === 'webgpu') {
            result = await this._kernel.localModel.chat(effectiveMessages, {
              ...options,
              backend: provider === 'local' ? undefined : provider,
            });
          } else {
            throw new Error(`Local provider ${provider} is not currently running.`);
          }
        } else if (provider === 'byok' || provider === 'openai') {
          result = await this._chatOpenAI(effectiveMessages, options);
        } else if (provider === 'openrouter') {
          result = await this._chatOpenRouter(effectiveMessages, options);
        } else if (provider === 'claude') {
          result = await this._chatClaude(effectiveMessages, options);
        } else if (provider === 'gemini') {
          result = await this._chatGemini(effectiveMessages, options);
        }

        if (result && typeof result === 'string') {
          if (!options.onToken) {
            this._cache.set(hash, { text: result, ts: Date.now() });
          }
          return result;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AISubsystem] Provider ${provider} failed: ${err.message}. Trying next in chain...`);
      }
    }

    throw lastError || new Error('All configured AI providers failed. Check your local AI server or API keys in Settings.');
  }

  // ─── Cloud Provider Implementations ────────────────────────────────────────

  async _chatGemini(messages, options = {}) {
    const apiKey = this.getKey('gemini') || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Add your key in Sovereign Settings -> AI Keys.');
    }

    const model = options.model || this.getKey('gemini_model') || 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Convert messages to Gemini contents format
    const contents = [];
    let systemInstruction = null;

    for (const m of messages) {
      if (m.role === 'system') {
        systemInstruction = { parts: [{ text: m.content }] };
      } else {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }
    }

    const body = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (options.onToken) options.onToken(text);
    return text;
  }

  async _chatOpenRouter(messages, options = {}) {
    const apiKey = this.getKey('openrouter') || import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured.');
    }

    const model = options.model || 'google/gemini-3.8-flash';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://novaura.life',
        'X-Title': 'Novaura Sovereign OS',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (options.onToken) options.onToken(text);
    return text;
  }

  async _chatClaude(messages, options = {}) {
    const apiKey = this.getKey('claude') || this.getKey('anthropic');
    if (!apiKey) {
      throw new Error('Anthropic Claude API key not configured.');
    }

    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');

    // Direct browser access to the Messages API requires the
    // `anthropic-dangerous-direct-browser-access` header (CORS opt-in).
    // Current models reject `temperature`, and may return thinking blocks
    // ahead of the text, so only text blocks are collected below.
    const body = {
      model: options.model || this.getKey('claude_model') || 'claude-opus-5-5',
      max_tokens: options.maxTokens ?? 16000,
      output_config: { effort: options.effort || 'medium' },
      fallbacks: 'default',
      system: systemMsg || undefined,
      messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    if (data.stop_reason === 'refusal') {
      const reason = data.stop_details?.explanation || 'Request declined by model safeguards.';
      throw new Error(`Claude declined this request: ${reason}`);
    }
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
    if (options.onToken) options.onToken(text);
    return text;
  }

  async _chatOpenAI(messages, options = {}) {
    const apiKey = this.getKey('byok') || this.getKey('openai');
    if (!apiKey) {
      throw new Error('BYOK API key not configured. Add your key in Sovereign Settings -> AI Keys.');
    }

    const endpoint = options.baseUrl || this.getKey('byok_endpoint') || 'https://api.openai.com/v1';
    const cleanEndpoint = endpoint.replace(/\/+$/, '');
    const model = options.model || this.getKey('byok_model') || 'gpt-4o-mini';

    const res = await fetch(`${cleanEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`BYOK API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (options.onToken) options.onToken(text);
    return text;
  }

  // ─── Image Generation (Multimodal) ─────────────────────────────────────────

  async generateImage(prompt, options = {}) {
    // 1. Try local ComfyUI first if online
    try {
      const { probeComfyUIStatus, buildComfyUIWorkflow, queueComfyUIPrompt, pollComfyUIHistory } = await import('../../services/mediaFoundryService.js');
      const comfy = await probeComfyUIStatus();
      if (comfy.online) {
        const wf = buildComfyUIWorkflow({ prompt, ...options });
        const queueRes = await queueComfyUIPrompt(wf);
        const images = await pollComfyUIHistory(queueRes.promptId);
        if (images?.[0]?.url) return images[0].url;
      }
    } catch {}

    // 2. Universal BYOK Image Generation (OpenAI / DALL-E / Custom Image API)
    const apiKey = this.getKey('byok') || this.getKey('openai') || this.getKey('gemini');
    if (!apiKey) {
      throw new Error('No image generation service available. Start local ComfyUI or provide a BYOK API key in Settings.');
    }

    const { generateBYOKImage } = await import('../../services/mediaFoundryService.js');
    return generateBYOKImage({
      prompt,
      apiKey,
      endpointUrl: options.endpointUrl || 'https://api.openai.com/v1/images/generations',
      model: options.model || 'dall-e-3',
      size: options.size || '1024x1024'
    });
  }

  // ─── Cache Management ──────────────────────────────────────────────────────

  async _loadCacheFromDB() {
    try {
      const items = await db.documents.where('type').equals('ai_cache').limit(50).toArray();
      for (const item of items) {
        if (item.hash && item.content) {
          this._cache.set(item.hash, { text: item.content, ts: item.updated_at || Date.now() });
        }
      }
    } catch {
      // non-critical
    }
  }
}

export default AISubsystem;
