import { useAIStore } from '../stores/aiStore';
import { useAuthStore } from '../stores/authStore';
import { memoryService } from './memoryService';
import { trainingDataService, type TrainingPlatform } from './trainingDataService';
import { apiClient } from './apiClient';

export interface AIResponse {
  content: string;
  error?: string;
}

type LocalProvider = 'ollama' | 'lmstudio';

type LocalRequestMode = 'ollama-chat' | 'ollama-generate' | 'lmstudio-chat';

interface LocalTarget {
  baseUrl: string;
  requestUrl: string;
  mode: LocalRequestMode;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

interface LMStudioModelsResponse {
  data?: Array<{ id?: string }>;
}

const LOCAL_DEFAULT_BASE: Record<LocalProvider, string> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
};

const ensureHttpProtocol = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  return `http://${value}`;
};

const trimKnownPath = (value: string): string => {
  return value
    .replace(/\/api\/(?:chat|generate|tags)$/i, '')
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1\/models$/i, '')
    .replace(/\/v1$/i, '')
    .replace(/\/+$/g, '');
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
};

const resolveLocalTarget = (endpoint: string, provider: LocalProvider): LocalTarget => {
  const rawInput = endpoint.trim();
  const initial = rawInput ? ensureHttpProtocol(rawInput) : LOCAL_DEFAULT_BASE[provider];
  const clean = initial.replace(/[?#].*$/, '').replace(/\/+$/g, '');
  const baseUrl = trimKnownPath(clean) || LOCAL_DEFAULT_BASE[provider];

  if (provider === 'ollama') {
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

  return { baseUrl, requestUrl: `${baseUrl}/v1/chat/completions`, mode: 'lmstudio-chat' };
};

const parseJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
};

const extractErrorMessage = (payload: unknown): string | undefined => {
  const obj = asRecord(payload);

  if (typeof obj.error === 'string') return obj.error;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.raw === 'string') return obj.raw;

  return undefined;
};

const extractLocalContent = (payload: unknown, provider: LocalProvider): string | undefined => {
  const obj = asRecord(payload);

  if (provider === 'ollama') {
    if (typeof obj.response === 'string') return obj.response;
    const message = asRecord(obj.message);
    if (typeof message.content === 'string') return message.content;
    return undefined;
  }

  const choices = Array.isArray(obj.choices) ? obj.choices : [];
  if (choices.length > 0) {
    const first = asRecord(choices[0]);
    const message = asRecord(first.message);
    if (typeof message.content === 'string') return message.content;
    if (typeof first.text === 'string') return first.text;
  }

  if (typeof obj.response === 'string') return obj.response;
  return undefined;
};

const discoverLocalModel = async (baseUrl: string, provider: LocalProvider): Promise<string | undefined> => {
  try {
    if (provider === 'ollama') {
      const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      if (!response.ok) return undefined;

      const data = (await parseJsonBody(response)) as OllamaTagsResponse;
      const model = data.models?.find((entry) => typeof entry.name === 'string' && entry.name.length > 0)?.name;
      return model;
    }

    const response = await fetch(`${baseUrl}/v1/models`, { method: 'GET' });
    if (!response.ok) return undefined;

    const data = (await parseJsonBody(response)) as LMStudioModelsResponse;
    const model = data.data?.find((entry) => typeof entry.id === 'string' && entry.id.length > 0)?.id;
    return model;
  } catch {
    return undefined;
  }
};

/**
 * Orchestrates AI requests through the backend proxy (keys stay server-side).
 * Local providers (Ollama/LM Studio) still go direct from browser.
 */
export const aiOrchestrator = {
  async sendMessage(prompt: string, context: string, trainingPlatform: TrainingPlatform = 'ide_console'): Promise<AIResponse> {
    const { provider, localEndpoint, isPersistentPersona } = useAIStore.getState();
    const { user } = useAuthStore.getState();

    let personaContext = "";
    let memorySnippets = "";

    if (user && isPersistentPersona) {
      if (typeof memoryService.getUserPersona === 'function') {
        personaContext = memoryService.getUserPersona(user.id);
      }
      if (typeof memoryService.getRelevantMemories === 'function') {
        memorySnippets = memoryService.getRelevantMemories(user.id, prompt);
      }
    }

    const platformMap = `
Available Navigation Paths:
- /: Home (Featured assets, trending)
- /browse: Asset Marketplace (Filters: category, search, engine)
- /creator/assets/new: Start Selling (For creators)
- /reader: External Free Asset Search (GitHub, HuggingFace)
- /hub: Ecosystem Hub (Community resources)
- /novalow: Domain Registration & Registry Infrastructure
- /registry: Verification & Licensing search
- /music-studio: Music creation studio
- /ai-studio: AI and systems studio showcase
- /settings: Account & Wallet settings
- /cart: Shopping Cart
- /orders: Purchase History & Licenses
- /agreements: Signed EULA repository
`;

    const systemPrompt = `
You are Aura, the NovAura platform's AI Guide. You are witty, a bit sarcastic, but deeply helpful.
You live in a futuristic, ethical creator marketplace where royalties are transparent and creators have a fair stake.

Current Platform Context: ${context}
${platformMap}

${isPersistentPersona ? `
Persistent Persona (What you know about the user):
${personaContext}

Relevant Memories (from past chats):
${memorySnippets}
` : ""}

User Message: ${prompt}

ACTIONS (Use these at the start or end of your response to interact with the UI):
- ACTION:[NAVIGATE](path) - Choose a path from the "Available Navigation Paths" above.
- ACTION:[SEARCH](query) - Trigger a marketplace search.
- ACTION:[DOMAIN](query) - Trigger a domain registration search on NovaLow.
- ACTION:[NOTIFY](message) - Show a non-intrusive toast notification.
- ACTION:[ESCALATE](reason) - Use this when the user requires management attention or staff assistance.
- ACTION:[SUPPORT](issue_details) - Lodge a formal support ticket for the Catalyst.

Response Guidelines:
1. Respond naturally, integrating your "memories" if they are relevant.
2. If a user is frustrated or needs direct staff assistance, use ACTION:[ESCALATE].
3. For navigation, always use the EXACT path from the Platform Map.
4. Keep your tone "Cyber-Witty" - you are an AI that knows its value.
`;

    // Tier-based model selection (2026 Standard)
    const tier = user?.membershipTier ?? 'free';

    const defaultGeminiModel =
      tier === 'catalyst' || tier === 'nova' || tier === 'catalytic-crew' ? 'gemini-3.1-pro-preview' :
      tier === 'emergent' ? 'gemini-2.5-flash' :
                            'gemini-2.5-flash';

    let result: AIResponse;

    // 1. Local Providers (Direct Browser Connection)
    if (provider === 'ollama' || provider === 'lmstudio') {
      result = await this.sendToLocal(systemPrompt, localEndpoint, provider);
    } else {
      // 2. Cloud Providers (via Backend Proxy)
      // If no provider is specified or it is 'local' (auto), we default to the platform's Gemini.
      const targetProvider = (provider === 'local' || !provider) ? 'gemini' : provider;
      const targetModel = (targetProvider === 'gemini' || targetProvider === 'vertex') ? defaultGeminiModel : undefined;

      result = await this.proxyChat(targetProvider, systemPrompt, targetModel);

      // 3. Fallback Logic: If the selected cloud provider fails, automatically fall back to Gemini
      if (result.error && targetProvider !== 'gemini') {
        console.warn(`Provider ${targetProvider} failed, falling back to Gemini...`);
        result = await this.proxyChat('gemini', systemPrompt, defaultGeminiModel);
      }
    }

    // Log to training pipeline if user has consented
    if (user && trainingDataService.hasConsent(user) && !result.error) {
      trainingDataService.logConversation(
        user.id,
        trainingPlatform,
        provider,
        user.membershipTier ?? 'free',
        prompt,
        result.content,
        context
      );
    }

    return result;
  },

  /**
   * Send a chat request through the backend AI proxy.
   * Keys stay server-side — frontend never sees them.
   */
  async proxyChat(provider: string, prompt: string, model?: string, maxTokens = 1024, temperature = 0.7): Promise<AIResponse> {
    try {
      const data = await apiClient.post<{ response?: string; error?: string }>('/ai/chat', {
        provider,
        prompt,
        model,
        maxTokens,
        temperature,
      });

      if (data.error) return { content: '', error: data.error };
      return { content: data.response || '' };
    } catch (err: any) {
      return { content: '', error: err.message || `Failed to reach AI proxy (${provider}).` };
    }
  },

  /**
   * Generate an image via the backend Vertex AI Imagen proxy.
   */
  async generateImage(
    prompt: string, 
    options: { 
      aspectRatio?: '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
      negativePrompt?: string;
      seed?: number;
      provider?: 'vertex' | 'pixai';
    } = {}
  ): Promise<{ imageUrl?: string; taskId?: string; error?: string }> {
    try {
      const { aspectRatio = '1:1', negativePrompt, seed, provider = 'vertex' } = options;
      
      if (provider === 'pixai') {
        // Use PixAI via generation route
        const data = await apiClient.post<{ success: boolean; taskId?: string; error?: string }>('/generation/image', {
          prompt,
          aspectRatio: aspectRatio === '1:1' ? '1:1' : '9:16',
          negativePrompt,
        });
        if (data.error) return { error: data.error };
        return { taskId: data.taskId };
      }
      
      // Use Vertex AI Imagen
      const data = await apiClient.post<{ success: boolean; imageUrl?: string; error?: string }>('/vertex/image', {
        prompt,
        aspectRatio,
        negativePrompt,
        seed,
      });
      if (data.error) return { error: data.error };
      return { imageUrl: data.imageUrl };
    } catch (err: any) {
      return { error: err.message || 'Failed to reach image generation proxy.' };
    }
  },

  /**
   * Local models (Ollama/LM Studio) run on the user's machine — no proxy needed.
   */
  async sendToLocal(prompt: string, endpoint: string, provider: 'ollama' | 'lmstudio'): Promise<AIResponse> {
    let target: LocalTarget | undefined;

    try {
      target = resolveLocalTarget(endpoint, provider);
      const discoveredModel = await discoverLocalModel(target.baseUrl, provider);

      const requestBody = provider === 'ollama'
        ? target.mode === 'ollama-generate'
          ? {
              model: discoveredModel || 'llama4:latest',
              prompt,
              stream: false,
            }
          : {
              model: discoveredModel || 'llama4:latest',
              messages: [{ role: 'user', content: prompt }],
              stream: false,
            }
        : {
            model: discoveredModel || 'gemma:2b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1024,
            stream: false,
          };

      const response = await fetch(target.requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const payload = await parseJsonBody(response);

      if (!response.ok) {
        const details = extractErrorMessage(payload) || `HTTP ${response.status}`;
        const hint = provider === 'lmstudio'
          ? 'Load a model in LM Studio and ensure the local server is running.'
          : 'Ensure Ollama is running and has at least one installed model.';

        return {
          content: '',
          error: `${provider.toUpperCase()} request failed at ${target.requestUrl}: ${details}. ${hint}`,
        };
      }

      const content = extractLocalContent(payload, provider);
      if (!content) {
        return {
          content: '',
          error: `${provider.toUpperCase()} returned an empty response from ${target.requestUrl}.`,
        };
      }

      return { content };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const attemptedUrl = target?.requestUrl || endpoint;

      return {
        content: '',
        error: `Failed to connect to ${provider} at ${attemptedUrl}. ${message}`,
      };
    }
  }
};
