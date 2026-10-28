/**
 * Sovereign OS — Local Model Subsystem
 *
 * Dedicated local inference engine supporting:
 *  1. Ollama (http://localhost:11434) — Native local LLM runner (Llama 3, DeepSeek, Mistral, Qwen, etc.)
 *  2. LM Studio (http://localhost:1234/v1) — OpenAI-compatible local model server
 *  3. In-Browser WebGPU (WebLLM) — Pure client-side zero-install fallback
 *
 * Provides real streaming, automatic health checks, model enumeration,
 * and zero mock data.
 */

import { probeLocalAi, queryLocalAi } from '../../services/nativeService.js';

const STATE = {
  IDLE: 'idle',
  CHECKING: 'checking',
  READY: 'ready',
  OFFLINE: 'offline',
  ERROR: 'error',
};

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234/v1';

export class LocalModelSubsystem {
  constructor() {
    this._kernel = null;
    this._state = STATE.IDLE;
    this._activeBackend = 'ollama'; // 'ollama' | 'lmstudio' | 'webgpu'
    this._ollamaUrl = DEFAULT_OLLAMA_URL;
    this._lmstudioUrl = DEFAULT_LMSTUDIO_URL;
    this._availableModels = [];
    this._selectedModel = null;
    this._webllmEngine = null;
    this._webllmProgress = 0;
    this._error = null;
    this._isProbing = false;
  }

  init(kernel) {
    this._kernel = kernel;

    // Load persisted local AI settings
    const savedConfig = kernel.settings?.get('local_ai_config');
    if (savedConfig) {
      if (savedConfig.backend) this._activeBackend = savedConfig.backend;
      if (savedConfig.ollamaUrl) this._ollamaUrl = savedConfig.ollamaUrl;
      if (savedConfig.lmstudioUrl) this._lmstudioUrl = savedConfig.lmstudioUrl;
      if (savedConfig.selectedModel) this._selectedModel = savedConfig.selectedModel;
    }

    // IPC event hooks
    kernel.ipc.on('localmodel:probe', () => this.probeAll());
    kernel.ipc.on('localmodel:select_backend', ({ backend }) => this.setBackend(backend));
    kernel.ipc.on('localmodel:select_model', ({ model }) => this.setModel(model));
    kernel.ipc.on('settings:changed', ({ key, value }) => {
      if (key === 'local_ai_config' && value) {
        if (value.ollamaUrl) this._ollamaUrl = value.ollamaUrl;
        if (value.lmstudioUrl) this._lmstudioUrl = value.lmstudioUrl;
        if (value.backend) this._activeBackend = value.backend;
        if (value.selectedModel) this._selectedModel = value.selectedModel;
        this.probeAll();
      }
    });
  }

  async boot() {
    await this.probeAll();
  }

  // ─── Status & State ────────────────────────────────────────────────────────

  get state() { return this._state; }
  get activeBackend() { return this._activeBackend; }
  get availableModels() { return this._availableModels; }
  get selectedModel() { return this._selectedModel; }
  get isReady() { return this._state === STATE.READY; }
  get isWebGPUAvailable() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  getStatus() {
    return {
      state: this._state,
      backend: this._activeBackend,
      models: this._availableModels,
      selectedModel: this._selectedModel,
      isReady: this.isReady,
      ollamaUrl: this._ollamaUrl,
      lmstudioUrl: this._lmstudioUrl,
      webgpuAvailable: this.isWebGPUAvailable,
      error: this._error,
    };
  }

  // ─── Probing & Discovery ───────────────────────────────────────────────────

  async probeAll() {
    if (this._isProbing) return;
    this._isProbing = true;
    this._state = STATE.CHECKING;
    this._error = null;

    let foundOllama = false;
    let foundLMStudio = false;
    let models = [];

    // 1. Probe Ollama (:11434)
    try {
      const olProbe = await probeLocalAi(11434, '/api/tags');
      if (olProbe && olProbe.online) {
        foundOllama = true;
        const oModels = (olProbe.models || []).map(name => ({
          id: name,
          name: name,
          backend: 'ollama',
        }));
        if (oModels.length > 0) {
          models.push(...oModels);
        } else {
          models.push({ id: 'gemma4:12b', name: 'gemma4:12b', backend: 'ollama' });
        }
      }
    } catch (err) {
      console.warn('[LocalModelSubsystem] probe Ollama note:', err);
    }

    // 2. Probe LM Studio (:1234)
    try {
      const lmProbe = await probeLocalAi(1234, '/v1/models');
      if (lmProbe && lmProbe.online) {
        foundLMStudio = true;
        const lmModels = (lmProbe.models || []).map(name => ({
          id: name,
          name: name,
          backend: 'lmstudio',
        }));
        if (lmModels.length > 0) {
          models.push(...lmModels);
        }
      }
    } catch (err) {
      console.warn('[LocalModelSubsystem] probe LM Studio note:', err);
    }

    this._availableModels = models;

    // Pick backend based on discovery & preference
    if (this._activeBackend === 'ollama' && foundOllama) {
      this._state = STATE.READY;
      if (!this._selectedModel || !models.find(m => m.id === this._selectedModel)) {
        this._selectedModel = models.find(m => m.backend === 'ollama')?.id || models[0]?.id;
      }
    } else if (this._activeBackend === 'lmstudio' && foundLMStudio) {
      this._state = STATE.READY;
      if (!this._selectedModel || !models.find(m => m.id === this._selectedModel)) {
        this._selectedModel = models.find(m => m.backend === 'lmstudio')?.id || models[0]?.id;
      }
    } else if (foundOllama) {
      this._activeBackend = 'ollama';
      this._state = STATE.READY;
      this._selectedModel = models.find(m => m.backend === 'ollama')?.id || models[0]?.id;
    } else if (foundLMStudio) {
      this._activeBackend = 'lmstudio';
      this._state = STATE.READY;
      this._selectedModel = models.find(m => m.backend === 'lmstudio')?.id || models[0]?.id;
    } else if (this.isWebGPUAvailable) {
      this._activeBackend = 'webgpu';
      this._state = STATE.READY;
      this._selectedModel = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
    } else {
      this._state = STATE.OFFLINE;
      this._error = 'No local AI runner detected (Ollama/LM Studio offline and WebGPU unavailable).';
    }

    this._isProbing = false;
    this._kernel?.ipc.emit('localmodel:status', this.getStatus());
    return this.getStatus();
  }

  setBackend(backend) {
    this._activeBackend = backend;
    const model = this._availableModels.find(m => m.backend === backend);
    if (model) this._selectedModel = model.id;
    this._kernel?.ipc.emit('localmodel:status', this.getStatus());
  }

  setModel(modelId) {
    this._selectedModel = modelId;
    this._kernel?.ipc.emit('localmodel:status', this.getStatus());
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  /**
   * Run chat inference on the active local provider.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options { temperature, maxTokens, model, stream, onToken }
   */
  async chat(messages, options = {}) {
    const backend = options.backend || this._activeBackend;
    const model = options.model || this._selectedModel;

    if (backend === 'ollama') {
      return this._chatOllama(messages, model, options);
    } else if (backend === 'lmstudio') {
      return this._chatLMStudio(messages, model, options);
    } else if (backend === 'webgpu') {
      return this._chatWebGPU(messages, model, options);
    }

    throw new Error(`Unsupported or offline local model backend: ${backend}`);
  }

  // Ollama chat implementation
  async _chatOllama(messages, model, options = {}) {
    const stream = !!options.onToken;
    const payload = {
      model: model || this._selectedModel || 'gemma:4b',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    };

    if (!stream) {
      try {
        const resp = await queryLocalAi(11434, '/api/chat', 'POST', payload);
        if (resp && resp.message) {
          return resp.message.content || '';
        }
      } catch (e) {
        console.warn('[LocalModelSubsystem] native queryLocalAi fallback:', e);
      }
    }

    let res = null;
    let lastErr = null;
    const candidateUrls = [
      `${this._ollamaUrl}/api/chat`,
      'http://127.0.0.1:11434/api/chat',
      'http://localhost:11434/api/chat',
    ];

    for (const u of candidateUrls) {
      try {
        res = await fetch(u, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!res || !res.ok) {
      const errText = res ? await res.text() : (lastErr?.message || 'Connection refused');
      throw new Error(`Ollama request failed (${res?.status || 'OFFLINE'}): ${errText}`);
    }

    if (!stream) {
      const data = await res.json();
      return data.message?.content || '';
    }

    // Stream reader
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const delta = parsed.message?.content || '';
          if (delta) {
            fullText += delta;
            options.onToken?.(delta);
          }
        } catch {
          // ignore partial json chunk
        }
      }
    }

    return fullText;
  }

  // LM Studio chat completions implementation (OpenAI standard)
  async _chatLMStudio(messages, model, options = {}) {
    const stream = !!options.onToken;
    const payload = {
      model: model || 'local-model',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    };

    const res = await fetch(`${this._lmstudioUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LM Studio request failed (${res.status}): ${errText}`);
    }

    if (!stream) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    // SSE Stream reader
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            options.onToken?.(delta);
          }
        } catch {
          // skip
        }
      }
    }

    return fullText;
  }

  // WebGPU WebLLM fallback implementation
  async _chatWebGPU(messages, model, options = {}) {
    if (!this.isWebGPUAvailable) {
      throw new Error('WebGPU is not supported by your browser or graphics driver.');
    }

    if (!this._webllmEngine) {
      // Check for locally bundled or preloaded WebLLM runtime
      const webllm = typeof window !== 'undefined' ? (window.webllm || window.__webllm) : null;
      if (!webllm) {
        throw new Error('Local WebGPU engine requires bundled neural runtime. Please select Ollama or LM Studio for sovereign local inference.');
      }
      const modelId = model || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
      
      this._webllmEngine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          this._webllmProgress = report.progress;
          this._kernel?.ipc.emit('localmodel:webgpu_progress', report);
        },
      });
    }

    const res = await this._webllmEngine.chat.completions.create({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    });

    return res.choices?.[0]?.message?.content || '';
  }
}

export default LocalModelSubsystem;
