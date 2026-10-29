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

import { getProvider, providerChat } from '../../services/cloudProviders.js';
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
        } else if (getProvider(provider)) {
          result = await providerChat(provider, effectiveMessages, (name) => this._cloudKey(name), options);
          if (options.onToken) options.onToken(result);
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

  // ─── Cloud providers (bring your own key) ─────────────────────────────────

  /** Vault value for a cloud provider setting, with the dev-only env fallbacks. */
  _cloudKey(name) {
    const value = this.getKey(name);
    if (value) return value;
    if (name === 'gemini') return import.meta.env.VITE_GEMINI_API_KEY || '';
    if (name === 'openrouter') return import.meta.env.VITE_OPENROUTER_API_KEY || '';
    if (name === 'claude') return this.getKey('anthropic');
    return '';
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
