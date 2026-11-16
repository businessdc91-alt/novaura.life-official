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

import { probeLocalAi } from '../../services/nativeService.js';
import { cleanCompletion, runLocalChat } from '../../services/localModels.js';
import {
  resolveReasoningParams,
  ollamaThinkValue,
  openAiReasoningEffort,
  reasoningTokenBudget,
} from '../../services/reasoningConfig.js';

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
    this._selectedModels = {
      ollama: null,
      lmstudio: null,
      webgpu: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    };
    this._webllmEngine = null;
    this._webllmProgress = 0;
    this._error = null;
    this._isProbing = false;
    this._probePromise = null;
    this._lastProbeAt = 0;
  }

  init(kernel) {
    this._kernel = kernel;

    // Load persisted local AI settings
    const savedConfig = kernel.settings?.get('local_ai_config');
    if (savedConfig) {
      if (savedConfig.backend) this._activeBackend = savedConfig.backend;
      if (savedConfig.ollamaUrl) this._ollamaUrl = savedConfig.ollamaUrl;
      if (savedConfig.lmstudioUrl) this._lmstudioUrl = savedConfig.lmstudioUrl;
      if (savedConfig.selectedModels && typeof savedConfig.selectedModels === 'object') {
        Object.assign(this._selectedModels, savedConfig.selectedModels);
      }
      if (savedConfig.selectedModel) {
        this._selectedModel = savedConfig.selectedModel;
        this._selectedModels[this._activeBackend] = savedConfig.selectedModel;
      }
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
        if (value.selectedModels && typeof value.selectedModels === 'object') {
          Object.assign(this._selectedModels, value.selectedModels);
        }
        if (value.selectedModel) {
          this._selectedModel = value.selectedModel;
          this._selectedModels[this._activeBackend] = value.selectedModel;
        }
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
  get selectedModel() { return this._selectedModels[this._activeBackend] ?? this._selectedModel; }
  get isReady() { return this._state === STATE.READY; }
  get lastProbeAt() { return this._lastProbeAt; }
  get isWebGPUAvailable() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  hasModelsFor(backend) {
    if (backend === 'webgpu') return this.isWebGPUAvailable;
    return this._availableModels.some(m => m.backend === backend);
  }

  modelFor(backend, requestedModel = null) {
    if (requestedModel) return requestedModel;
    const backendModels = this._availableModels.filter(m => m.backend === backend);
    const chosen = this._selectedModels[backend];
    if (backendModels.length > 0) {
      if (chosen && backendModels.some(m => m.id === chosen)) return chosen;
      return backendModels[0].id;
    }
    return chosen || (backend === this._activeBackend ? this._selectedModel : null);
  }

  getStatus() {
    return {
      state: this._state,
      backend: this._activeBackend,
      models: this._availableModels,
      selectedModel: this.selectedModel,
      selectedModels: { ...this._selectedModels },
      isReady: this.isReady,
      ollamaUrl: this._ollamaUrl,
      lmstudioUrl: this._lmstudioUrl,
      webgpuAvailable: this.isWebGPUAvailable,
      error: this._error,
    };
  }

  // ─── Probing & Discovery ───────────────────────────────────────────────────

  async probeAll() {
    if (this._probePromise) return this._probePromise;
    this._probePromise = this._doProbeAll();
    try {
      return await this._probePromise;
    } finally {
      this._probePromise = null;
      this._isProbing = false;
      this._lastProbeAt = Date.now();
    }
  }

  async _doProbeAll() {
    this._isProbing = true;
    this._state = STATE.CHECKING;
    this._error = null;

    let foundOllama = false;
    let foundLMStudio = false;
    const models = [];

    // 1. Probe Ollama (:11434)
    try {
      const olProbe = await probeLocalAi(11434, '/api/tags');
      if (olProbe && olProbe.online) {
        const oModels = (olProbe.models || [])
          .filter(name => typeof name === 'string' && name.trim().length > 0 && !/embed/i.test(name))
          .map(name => ({
            id: name,
            name: name,
            backend: 'ollama',
          }));
        if (oModels.length > 0) {
          foundOllama = true;
          models.push(...oModels);
        }
      }
    } catch (err) {
      console.warn('[LocalModelSubsystem] probe Ollama note:', err);
    }

    // 2. Probe LM Studio (:1234)
    try {
      const lmProbe = await probeLocalAi(1234, '/v1/models');
      if (lmProbe && lmProbe.online) {
        const lmModels = (lmProbe.models || [])
          .filter(name => typeof name === 'string' && name.trim().length > 0 && !/embed/i.test(name))
          .map(name => ({
            id: name,
            name: name,
            backend: 'lmstudio',
          }));
        if (lmModels.length > 0) {
          foundLMStudio = true;
          models.push(...lmModels);
        }
      }
    } catch (err) {
      console.warn('[LocalModelSubsystem] probe LM Studio note:', err);
    }

    this._availableModels = models;

    // Reconcile per-backend selected model independently so backends never swap model IDs
    const ollamaModels = models.filter(m => m.backend === 'ollama');
    if (ollamaModels.length > 0) {
      if (!ollamaModels.some(m => m.id === this._selectedModels.ollama)) {
        this._selectedModels.ollama = ollamaModels[0].id;
      }
    } else {
      this._selectedModels.ollama = null;
    }

    const lmModels = models.filter(m => m.backend === 'lmstudio');
    if (lmModels.length > 0) {
      if (!lmModels.some(m => m.id === this._selectedModels.lmstudio)) {
        this._selectedModels.lmstudio = lmModels[0].id;
      }
    } else {
      this._selectedModels.lmstudio = null;
    }

    // Pick backend based on discovery & preference
    if (this._activeBackend === 'ollama' && foundOllama) {
      this._state = STATE.READY;
    } else if (this._activeBackend === 'lmstudio' && foundLMStudio) {
      this._state = STATE.READY;
    } else if (foundOllama) {
      this._activeBackend = 'ollama';
      this._state = STATE.READY;
    } else if (foundLMStudio) {
      this._activeBackend = 'lmstudio';
      this._state = STATE.READY;
    } else if (this.isWebGPUAvailable) {
      this._activeBackend = 'webgpu';
      this._state = STATE.READY;
      this._selectedModels.webgpu = this._selectedModels.webgpu || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
    } else {
      this._state = STATE.OFFLINE;
      this._error = 'No local AI runner detected (Ollama/LM Studio offline and WebGPU unavailable).';
    }

    this._selectedModel = this.selectedModel;
    this._isProbing = false;
    this._kernel?.ipc.emit('localmodel:status', this.getStatus());
    return this.getStatus();
  }

  setBackend(backend) {
    this._activeBackend = backend;
    this._selectedModel = this.modelFor(backend);
    this._kernel?.ipc.emit('localmodel:status', this.getStatus());
  }

  setModel(modelId) {
    const match = this._availableModels.find(m => m.id === modelId);
    const targetBackend = match?.backend || this._activeBackend;
    this._selectedModels[targetBackend] = modelId;
    if (targetBackend === this._activeBackend) {
      this._selectedModel = modelId;
    }
    this._kernel?.ipc.emit('localmodel:status', this.getStatus());
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  /**
   * Run chat inference on the active local provider.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options { temperature, maxTokens, model, stream, onToken, jsonSchema }
   */
  async chat(messages, options = {}) {
    const backend = options.backend || this._activeBackend;
    const model = this.modelFor(backend, options.model);

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
    const resolvedModel = model || this.modelFor('ollama');
    if (!resolvedModel) {
      throw new Error('No Ollama chat model available.');
    }

    const normalizedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const stream = !!options.onToken;
    const scope = options.scope || options.persona;
    const resolved = resolveReasoningParams({ ...options, scope });
    const effectiveMaxTokens = reasoningTokenBudget(options.maxTokens ?? 2048, resolved, {
      strictMaxTokens: options.strictMaxTokens || Boolean(options.jsonSchema && !resolved.think),
    });

    if (!stream && this._ollamaUrl === DEFAULT_OLLAMA_URL) {
      return runLocalChat(
        { runtime: 'ollama', model: resolvedModel },
        normalizedMessages,
        {
          maxTokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          jsonSchema: options.jsonSchema,
          think: options.think,
          reasoningEffort: options.reasoningEffort,
          effort: options.effort,
          scope,
          strictMaxTokens: options.strictMaxTokens,
          onThinking: options.onThinking,
        }
      );
    }

    const payload = {
      model: resolvedModel,
      messages: normalizedMessages,
      stream,
      think: ollamaThinkValue(resolvedModel, resolved),
      ...(options.jsonSchema ? { format: options.jsonSchema } : {}),
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: effectiveMaxTokens,
      },
    };

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
      if (data.message?.thinking) options.onThinking?.(data.message.thinking);
      return cleanCompletion(data.message?.content || '');
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
          const thinkingDelta = parsed.message?.thinking || '';
          if (thinkingDelta) options.onThinking?.(thinkingDelta);
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

    return cleanCompletion(fullText);
  }

  // LM Studio chat completions implementation (OpenAI standard)
  async _chatLMStudio(messages, model, options = {}) {
    const resolvedModel = model || this.modelFor('lmstudio');
    if (!resolvedModel) {
      throw new Error('No LM Studio chat model available.');
    }

    const normalizedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const stream = !!options.onToken;
    const scope = options.scope || options.persona;
    const resolved = resolveReasoningParams({ ...options, scope });
    const effectiveMaxTokens = reasoningTokenBudget(options.maxTokens ?? 2048, resolved, {
      strictMaxTokens: options.strictMaxTokens || Boolean(options.jsonSchema && !resolved.think),
    });

    if (!stream && this._lmstudioUrl === DEFAULT_LMSTUDIO_URL) {
      return runLocalChat(
        { runtime: 'lmstudio', model: resolvedModel },
        normalizedMessages,
        {
          maxTokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          jsonSchema: options.jsonSchema,
          think: options.think,
          reasoningEffort: options.reasoningEffort,
          effort: options.effort,
          scope,
          strictMaxTokens: options.strictMaxTokens,
          onThinking: options.onThinking,
        }
      );
    }

    const payload = {
      model: resolvedModel,
      messages: normalizedMessages,
      stream,
      temperature: options.temperature ?? 0.7,
      max_tokens: effectiveMaxTokens,
      reasoning_effort: openAiReasoningEffort(resolved),
      ...(options.jsonSchema ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: options.jsonSchema } } } : {}),
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
      const trace = data.choices?.[0]?.message?.reasoning_content || data.choices?.[0]?.message?.reasoning;
      if (trace) options.onThinking?.(trace);
      return cleanCompletion(data.choices?.[0]?.message?.content || '');
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
          const thinkingDelta = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.delta?.reasoning || '';
          if (thinkingDelta) options.onThinking?.(thinkingDelta);
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

    return cleanCompletion(fullText);
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
