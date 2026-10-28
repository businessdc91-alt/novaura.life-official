/**
 * NovAura Sovereign OS — Dual Inference Engine (Nova & Aura)
 * 
 * Implements the Dual Neural Model Architecture:
 * 1. NOVA ENGINE (Executive / Fast):
 *    - Purpose: OS control, intent parsing, real-time command execution, tool calling.
 *    - Recommended Models: Gemma 4 26B-A4B (gemma4:26b-a4b - 4B active), Qwen MoE 35B-A3B (qwen3.6:35b-a3b - 3B active), Gemma 4 A4B.
 *    - Priority: Ultra-low latency (<500ms), sparse active parameter MoE execution.
 * 
 * 2. AURA ENGINE (Creative / Deep):
 *    - Purpose: Literature prose synthesis, architectural system design, deep code generation.
 *    - Recommended Models: Gemma 4 26B-A4B (256K context), Qwen MoE 35B-A3B, Qwen 2.5 Coder 32B, or BYOK Cloud.
 *    - Priority: Maximum reasoning depth, rich vocabulary, high token context.
 * 
 * Features:
 * - Zero-Friction Auto-Handshake with live ping to Ollama (:11434) and LM Studio (:1234).
 * - Automatic model role assignment based on MoE sparse active parameter detection (A3B/A4B).
 * - 1-Click manual role binding and dynamic custom model tag assignment.
 */

import { FRONTIER_2026_CATALOG, frontierCatalog } from './frontierModelCatalogService.js';
import { probeLocalAi } from './nativeService.js';

const STORAGE_KEY = 'novaura_dual_inference_config';

export { FRONTIER_2026_CATALOG, frontierCatalog };

class DualInferenceService {
  constructor() {
    this._nova = {
      backend: 'ollama', // 'ollama' | 'lmstudio' | 'byok'
      url: 'http://localhost:11434',
      model: 'gemma4:12b', // Operator Favorite: Gemma 4 12B Dense (or discovered model)
      temperature: 0.2,
      status: 'probing',
      latency: null,
    };

    this._aura = {
      backend: 'lmstudio', // 'lmstudio' | 'ollama' | 'byok'
      url: 'http://localhost:1234/v1',
      model: 'gemma4:26b-a4b', // Operator Favorite: Gemma 4 26B-A4B MoE (or discovered model)
      temperature: 0.75,
      status: 'probing',
      latency: null,
    };

    this._coder = {
      backend: 'ollama',
      url: 'http://localhost:11434',
      model: 'qwen-coder:80b-moe', // Operator Option: Qwen Coder 80B MoE (or Qwen 2.5 Coder 32B)
      temperature: 0.2,
      status: 'probing',
      latency: null,
    };

    this._discoveredModels = [];
    this._listeners = new Set();
    this._isProbing = false;

    this.loadPersistedConfig();
  }

  loadPersistedConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nova) this._nova = { ...this._nova, ...parsed.nova };
        if (parsed.aura) this._aura = { ...this._aura, ...parsed.aura };
        if (parsed.coder) this._coder = { ...this._coder, ...parsed.coder };
      }
    } catch (err) {
      console.warn('[DualInference] Load config note:', err);
    }
  }

  saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        nova: this._nova,
        aura: this._aura,
        coder: this._coder,
      }));
    } catch (err) {
      console.warn('[DualInference] Save config note:', err);
    }
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    for (const listener of this._listeners) {
      try {
        listener(this.getState());
      } catch (err) {
        console.error('[DualInference] Listener error:', err);
      }
    }
  }

  getState() {
    return {
      nova: { ...this._nova },
      aura: { ...this._aura },
      coder: { ...this._coder },
      discoveredModels: [...this._discoveredModels],
      isProbing: this._isProbing,
    };
  }

  /**
   * Return authentic configuration copy for the given role ('nova' | 'aura' | 'coder')
   */
  getRoleConfig(role) {
    const r = (role || 'nova').toLowerCase();
    if (r === 'nova') return { ...this._nova };
    if (r === 'aura') return { ...this._aura };
    if (r === 'coder') return { ...this._coder };
    return { ...this._nova };
  }

  /**
   * Probe both Ollama (:11434) and LM Studio (:1234) with live latency measurement.
   */
  async probeEndpoints() {
    if (this._isProbing) return;
    this._isProbing = true;
    this._notify();

    const discovered = [];
    let ollamaLatency = null;
    let lmStudioLatency = null;

    // 1. Probe Ollama (:11434)
    try {
      const olProbe = await probeLocalAi(11434, '/api/tags');
      if (olProbe && olProbe.online) {
        ollamaLatency = olProbe.latency_ms;
        const models = (olProbe.models || []).map(name => {
          const lower = name.toLowerCase();
          const isSmall = lower.includes('4b') || lower.includes('a4b') || lower.includes('2b') || lower.includes('3b') || lower.includes('mini');
          return {
            id: name,
            name: name,
            backend: 'ollama',
            url: 'http://localhost:11434',
            sizeBytes: 0,
            recommendedRole: isSmall ? 'nova' : 'aura',
          };
        });
        if (models.length === 0) {
          models.push({
            id: 'gemma4:12b',
            name: 'gemma4:12b',
            backend: 'ollama',
            url: 'http://localhost:11434',
            sizeBytes: 0,
            recommendedRole: 'aura',
          });
        }
        discovered.push(...models);
      }
    } catch {
      // Ollama offline
    }

    // 2. Probe LM Studio (:1234)
    try {
      const lmProbe = await probeLocalAi(1234, '/v1/models');
      if (lmProbe && lmProbe.online) {
        lmStudioLatency = lmProbe.latency_ms;
        const models = (lmProbe.models || []).map(name => {
          const lower = name.toLowerCase();
          const isSmall = lower.includes('4b') || lower.includes('a4b') || lower.includes('2b') || lower.includes('3b') || lower.includes('mini');
          return {
            id: name,
            name: name,
            backend: 'lmstudio',
            url: 'http://localhost:1234/v1',
            sizeBytes: 0,
            recommendedRole: isSmall ? 'nova' : 'aura',
          };
        });
        discovered.push(...models);
      }
    } catch {
      // LM Studio offline
    }

    this._discoveredModels = discovered;

    // Update Nova Status
    if (this._nova.backend === 'ollama') {
      this._nova.status = ollamaLatency !== null ? 'online' : 'offline';
      this._nova.latency = ollamaLatency;
    } else if (this._nova.backend === 'lmstudio') {
      this._nova.status = lmStudioLatency !== null ? 'online' : 'offline';
      this._nova.latency = lmStudioLatency;
    }

    // Update Aura Status
    if (this._aura.backend === 'lmstudio') {
      this._aura.status = lmStudioLatency !== null ? 'online' : 'offline';
      this._aura.latency = lmStudioLatency;
    } else if (this._aura.backend === 'ollama') {
      this._aura.status = ollamaLatency !== null ? 'online' : 'offline';
      this._aura.latency = ollamaLatency;
    }

    // Update Coder Status
    if (this._coder.backend === 'ollama') {
      this._coder.status = ollamaLatency !== null ? 'online' : 'offline';
      this._coder.latency = ollamaLatency;
    } else if (this._coder.backend === 'lmstudio') {
      this._coder.status = lmStudioLatency !== null ? 'online' : 'offline';
      this._coder.latency = lmStudioLatency;
    }

    // Auto-assign models if unassigned or invalid
    if (discovered.length > 0) {
      const novaMatch = discovered.find(m => m.id === this._nova.model);
      if (!novaMatch) {
        const fastCandidate = discovered.find(m => m.recommendedRole === 'nova') || discovered[0];
        this._nova.model = fastCandidate.id;
        this._nova.backend = fastCandidate.backend;
        this._nova.url = fastCandidate.url;
      }

      const auraMatch = discovered.find(m => m.id === this._aura.model);
      if (!auraMatch) {
        const deepCandidate = discovered.find(m => m.recommendedRole === 'aura' && m.id !== this._nova.model) || discovered[discovered.length - 1];
        this._aura.model = deepCandidate.id;
        this._aura.backend = deepCandidate.backend;
        this._aura.url = deepCandidate.url;
      }

      const coderMatch = discovered.find(m => m.id === this._coder.model);
      if (!coderMatch) {
        const coderCandidate = discovered.find(m => m.id.toLowerCase().includes('coder') || m.id.toLowerCase().includes('qwen')) || discovered[0];
        this._coder.model = coderCandidate.id;
        this._coder.backend = coderCandidate.backend;
        this._coder.url = coderCandidate.url;
      }
    }

    this._isProbing = false;
    this.saveConfig();
    this._notify();

    return this.getState();
  }

  setCustomModel(role, modelTag) {
    if (!modelTag || !modelTag.trim()) return;
    const clean = modelTag.trim();
    if (role === 'nova') {
      this._nova.model = clean;
    } else if (role === 'aura') {
      this._aura.model = clean;
    } else if (role === 'coder') {
      this._coder.model = clean;
    }
    this.saveConfig();
    this._notify();
  }

  assignNovaModel(modelId, backend, url) {
    this._nova.model = modelId;
    if (backend) this._nova.backend = backend;
    if (url) this._nova.url = url;
    this.saveConfig();
    this._notify();
  }

  assignAuraModel(modelId, backend, url) {
    this._aura.model = modelId;
    if (backend) this._aura.backend = backend;
    if (url) this._aura.url = url;
    this.saveConfig();
    this._notify();
  }

  assignCoderModel(modelId, backend, url) {
    this._coder.model = modelId;
    if (backend) this._coder.backend = backend;
    if (url) this._coder.url = url;
    this.saveConfig();
    this._notify();
  }

  /**
   * Universal engine dispatch: routes queries dynamically to 'nova', 'aura', or 'coder'.
   */
  async queryEngine(role, messages, options = {}) {
    const r = (role || 'nova').toLowerCase();
    if (r === 'aura') {
      return this.queryAura(messages, options);
    }
    if (r === 'coder') {
      return this.queryCoder(messages, options);
    }
    return this.queryNova(messages, options);
  }

  /**
   * Execute coding / multi-cloud architectural reasoning using CODER Engine.
   */
  async queryCoder(messages, options = {}) {
    const config = this._coder;
    return this._dispatchInference(config, messages, {
      temperature: options.temperature || config.temperature,
      max_tokens: options.max_tokens || 4096,
    });
  }

  /**
   * Execute executive OS-level reasoning using the fast NOVA Engine.
   */
  async queryNova(messages, options = {}) {
    const config = this._nova;
    return this._dispatchInference(config, messages, {
      temperature: options.temperature || config.temperature,
      max_tokens: options.max_tokens || 800,
    });
  }

  /**
   * Execute deep literature prose / architectural code synthesis using the AURA Engine.
   */
  async queryAura(messages, options = {}) {
    const config = this._aura;
    return this._dispatchInference(config, messages, {
      temperature: options.temperature || config.temperature,
      max_tokens: options.max_tokens || 2048,
    });
  }

  async _dispatchInference(config, messages, opts) {
    if (config.backend === 'lmstudio') {
      try {
        const formattedMessages = Array.isArray(messages)
          ? messages.map(m => (typeof m === 'string' ? { role: 'user', content: m } : m))
          : [{ role: 'user', content: String(messages) }];

        const res = await fetch(`${config.url}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages: formattedMessages,
            temperature: opts.temperature,
            max_tokens: opts.max_tokens,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`LM Studio HTTP ${res.status}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      } catch (err) {
        if (opts.allowSwarmFallback) {
          console.info('[DualInference] Local LM Studio offline, falling back to Sovereign Swarm inference...');
          return await this.querySwarmInference(messages, opts);
        }
        throw err;
      }
    }

    if (config.backend === 'ollama') {
      try {
        const res = await fetch(`${config.url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages,
            stream: false,
            options: { temperature: opts.temperature },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json();
          return data.message?.content || '';
        }
      } catch (err) {
        if (opts.allowSwarmFallback) {
          console.info('[DualInference] Local Ollama offline, falling back to Sovereign Swarm inference...');
          return await this.querySwarmInference(messages, opts);
        }
        throw err;
      }
    }

    if (opts.allowSwarmFallback) {
      return await this.querySwarmInference(messages, opts);
    }

    throw new Error(`Unsupported inference backend: ${config.backend}`);
  }

  /**
   * Query peer inference over the decentralized Sovereign Mesh
   */
  async querySwarmInference(messages, options = {}) {
    try {
      const { requestPeerInference } = await import('./sovereignMesh.js');
      const promptText = Array.isArray(messages)
        ? messages.map(m => `${m.role?.toUpperCase()}: ${m.content}`).join('\n\n')
        : String(messages);

      const res = await requestPeerInference(options.peerId || null, {
        prompt: promptText,
        role: options.role || 'aura',
        maxTokens: options.max_tokens || 1024,
        timeoutMs: options.timeoutMs || 30000,
      });
      return res?.answer || '';
    } catch (err) {
      console.warn('[DualInference] Swarm inference note:', err);
      throw err;
    }
  }
}

export const dualInference = new DualInferenceService();
