/**
 * NovAura OS — Local Model Subsystem
 * Runs a small LLM in-browser via WebLLM + WebGPU.
 *
 * ─ Nova uses this (local-first, private, zero-cost)
 * ─ Aura always bypasses this → cloud Gemini
 *
 * Boot flow:
 *  1. Check navigator.gpu exists
 *  2. Lazy-load WebLLM from CDN (@mlc-ai/web-llm)
 *  3. Download model on first activation (cached in browser Cache API forever)
 *  4. Expose chat() for the AISubsystem to call
 *
 * Model candidates (tried in order):
 *  - Qwen3-1.7B  (~2 GB VRAM, smartest)
 *  - Llama-3.2-1B (~880 MB VRAM, great quality)
 *  - SmolLM2-1.7B (~1.8 GB VRAM)
 *  - SmolLM2-360M (~376 MB VRAM, runs on anything)
 *
 * All weights served from HuggingFace CDN. Zero hosting cost.
 */

// Ordered preference: best quality-to-size ratio first
// All models auto-download from HuggingFace CDN, cached in browser forever
const MODEL_CANDIDATES = [
  'Qwen3-1.7B-q4f16_1-MLC',                   // 2036 MB VRAM — smartest small model
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',        //  879 MB VRAM — great quality, fits anywhere
  'SmolLM2-1.7B-Instruct-q4f16_1-MLC',        // 1774 MB VRAM — solid fallback
  'SmolLM2-360M-Instruct-q4f16_1-MLC',        //  376 MB VRAM — ultra-tiny, runs on integrated GPU
];

const STATE = {
  IDLE:        'idle',
  CHECKING:    'checking',
  DOWNLOADING: 'downloading',
  READY:       'ready',
  ERROR:       'error',
  DISABLED:    'disabled',
};

class LocalModelSubsystem {
  constructor() {
    this._kernel  = null;
    this._engine  = null;     // WebLLM CreateMLCEngine instance
    this._state   = STATE.IDLE;
    this._modelId = null;
    this._webllm  = null;     // lazily loaded module
    this._progress = 0;
    this._error   = null;
    this._enabled = false;    // user must opt-in via settings or toggle
  }

  init(kernel) {
    this._kernel = kernel;

    // Listen for user toggling WebGPU/local model
    kernel.ipc.on('settings:changed', ({ key, value }) => {
      if (key === 'webgpu_local_model') {
        if (value) this.activate();
        else this.deactivate();
      }
    });

    // Listen for explicit activation command
    kernel.ipc.on('localmodel:activate', () => this.activate());
    kernel.ipc.on('localmodel:deactivate', () => this.deactivate());
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  get state()    { return this._state; }
  get modelId()  { return this._modelId; }
  get progress() { return this._progress; }
  get isReady()  { return this._state === STATE.READY && this._engine !== null; }
  get isAvailable() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  /**
   * Check if WebGPU is supported without activating anything.
   */
  checkSupport() {
    const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    return {
      webgpu: hasWebGPU,
      state: this._state,
      modelId: this._modelId,
      ready: this.isReady,
    };
  }

  /**
   * Activate: load WebLLM, download model, warm up.
   * Emits progress events the whole way.
   */
  async activate() {
    if (this._state === STATE.READY || this._state === STATE.DOWNLOADING) return;

    if (!this.isAvailable) {
      this._setState(STATE.DISABLED);
      this._error = 'WebGPU not supported in this browser';
      this._kernel.ipc.emit('localmodel:status', this._snapshot());
      return;
    }

    this._setState(STATE.CHECKING);
    this._enabled = true;

    try {
      // Step 1: Lazy-load WebLLM
      if (!this._webllm) {
        this._kernel.ipc.emit('localmodel:status', { ...this._snapshot(), label: 'Loading WebLLM runtime...' });
        this._webllm = await import(/* @vite-ignore */ 'https://esm.run/@mlc-ai/web-llm@0.2.80');
      }

      // Step 2: Find best available model
      this._setState(STATE.DOWNLOADING);
      const modelId = await this._pickModel();

      if (!modelId) {
        throw new Error('No compatible model found');
      }

      this._modelId = modelId;
      this._kernel.ipc.emit('localmodel:status', { ...this._snapshot(), label: `Downloading ${modelId}...` });

      // Step 3: Create engine (downloads + compiles model, cached in IndexedDB)
      this._engine = await this._webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          this._progress = Math.round((progress.progress || 0) * 100);
          this._kernel.ipc.emit('localmodel:progress', {
            progress: this._progress,
            text: progress.text || '',
            modelId,
          });
        },
      });

      this._setState(STATE.READY);
      this._progress = 100;
      this._kernel.ipc.emit('localmodel:status', this._snapshot());
      this._kernel.ipc.emit('localmodel:ready', { modelId });

    } catch (err) {
      this._error = err.message;
      this._setState(STATE.ERROR);
      this._kernel.ipc.emit('localmodel:status', this._snapshot());
      console.error('[LocalModel] Activation failed:', err);
    }
  }

  /**
   * Deactivate: unload model from GPU memory.
   */
  async deactivate() {
    this._enabled = false;
    if (this._engine) {
      try { await this._engine.unload(); } catch {}
      this._engine = null;
    }
    this._setState(STATE.IDLE);
    this._progress = 0;
    this._modelId = null;
    this._kernel.ipc.emit('localmodel:status', this._snapshot());
  }

  /**
   * Chat completion — mirrors the OpenAI chat format.
   * @param {string} prompt - User message
   * @param {object} options
   * @returns {{ response: string, provider: string, model: string, tokens: object }}
   */
  async chat(prompt, options = {}) {
    if (!this.isReady) {
      throw new Error('Local model not ready — call activate() first');
    }

    const messages = [];

    // System prompt for Nova persona
    messages.push({
      role: 'system',
      content: options.systemPrompt || 
        'You are Nova, a fast and private AI assistant running locally on NovAura OS. ' +
        'You are helpful, concise, and friendly. You run entirely on the user\'s device with no cloud dependency. ' +
        'Keep responses focused and efficient since you are a smaller model.',
    });

    // Conversation history if provided
    if (options.conversation?.length) {
      for (const msg of options.conversation) {
        messages.push({
          role: msg.role || (msg.isUser ? 'user' : 'assistant'),
          content: msg.content || msg.text,
        });
      }
    }

    // Current prompt
    messages.push({ role: 'user', content: prompt });

    const startTime = Date.now();

    const reply = await this._engine.chat.completions.create({
      messages,
      max_tokens: options.maxTokens || 512,
      temperature: options.temperature ?? 0.7,
      stream: false,
    });

    const elapsed = Date.now() - startTime;
    const responseText = reply.choices?.[0]?.message?.content || '';

    return {
      response: responseText,
      provider: 'webgpu-local',
      model: this._modelId,
      tokens: {
        prompt: reply.usage?.prompt_tokens || 0,
        completion: reply.usage?.completion_tokens || 0,
        total: reply.usage?.total_tokens || 0,
      },
      latencyMs: elapsed,
      local: true,
    };
  }

  /**
   * Streaming chat — returns an async generator.
   */
  async *chatStream(prompt, options = {}) {
    if (!this.isReady) {
      throw new Error('Local model not ready');
    }

    const messages = [];
    messages.push({
      role: 'system',
      content: options.systemPrompt ||
        'You are Nova, a fast and private AI assistant running locally on NovAura OS. Be concise and helpful.',
    });

    if (options.conversation?.length) {
      for (const msg of options.conversation) {
        messages.push({
          role: msg.role || (msg.isUser ? 'user' : 'assistant'),
          content: msg.content || msg.text,
        });
      }
    }

    messages.push({ role: 'user', content: prompt });

    const stream = await this._engine.chat.completions.create({
      messages,
      max_tokens: options.maxTokens || 512,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  async _pickModel() {
    if (!this._webllm) return null;

    for (const id of MODEL_CANDIDATES) {
      try {
        // Check if the model is in WebLLM's model list
        const available = this._webllm.prebuiltAppConfig?.model_list || [];
        const found = available.find(m => m.model_id === id || m.local_id === id);
        if (found) return id;
      } catch {}
    }

    // Fallback: try first candidate anyway — WebLLM may fetch it
    return MODEL_CANDIDATES[0];
  }

  _setState(newState) {
    this._state = newState;
  }

  _snapshot() {
    return {
      state: this._state,
      modelId: this._modelId,
      progress: this._progress,
      ready: this.isReady,
      available: this.isAvailable,
      enabled: this._enabled,
      error: this._error,
    };
  }

  boot() {
    // On boot, just check support — don't auto-download
    const support = this.checkSupport();
    this._kernel.ipc.emit('localmodel:status', {
      ...support,
      enabled: this._enabled,
      label: support.webgpu ? 'WebGPU available — activate to enable local AI' : 'WebGPU not available',
    });

    // Auto-activate if user previously enabled it
    const saved = this._kernel.settings?.get('webgpu_local_model');
    if (saved) {
      this.activate();
    }
  }
}

export default LocalModelSubsystem;
