import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { kernelStorage } from '@/kernel/kernelStorage.js';

export type AIProvider = 'gemini' | 'claude' | 'openai' | 'kimi' | 'vertex' | 'ollama' | 'lmstudio' | 'huggingface' | 'alibaba';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const OLLAMA_DEFAULT_ENDPOINT = 'http://localhost:11434';
const LMSTUDIO_DEFAULT_ENDPOINT = 'http://localhost:1234';

const normalizeLocalEndpointForProvider = (endpoint: string, provider: AIProvider): string => {
  const value = endpoint.trim();

  if (provider === 'ollama') {
    if (!value) return OLLAMA_DEFAULT_ENDPOINT;
    if (/:1234(?:\/|$)/i.test(value) || /\/v1(?:\/|$)/i.test(value)) {
      return OLLAMA_DEFAULT_ENDPOINT;
    }
    return value;
  }

  if (provider === 'lmstudio') {
    if (!value) return LMSTUDIO_DEFAULT_ENDPOINT;
    if (/:11434(?:\/|$)/i.test(value) || /\/api(?:\/|$)/i.test(value)) {
      return LMSTUDIO_DEFAULT_ENDPOINT;
    }
    return value;
  }

  return value;
};

interface AIState {
  provider: AIProvider;
  geminiKey: string;
  claudeKey: string;
  openaiKey: string;
  kimiKey: string;
  vertexKey: string;
  vertexProjectId: string;
  huggingfaceKey: string;
  alibabaKey: string;
  localEndpoint: string;
  messages: ChatMessage[];
  isThinking: boolean;
  isPersistentPersona: boolean;
  activeIDETab: 'editor' | 'preview';
  ideMainLayout: Record<string, number> | null;
  ideCenterLayout: Record<string, number> | null;

  // Actions
  setProvider: (provider: AIProvider) => void;
  setGeminiKey: (key: string) => void;
  setClaudeKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setKimiKey: (key: string) => void;
  setVertexKey: (key: string) => void;
  setVertexProjectId: (id: string) => void;
  setHuggingfaceKey: (key: string) => void;
  setAlibabaKey: (key: string) => void;
  setLocalEndpoint: (endpoint: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  setThinking: (thinking: boolean) => void;
  setPersistentPersona: (enabled: boolean) => void;
  setActiveIDETab: (tab: 'editor' | 'preview') => void;
  setIDELayout: (key: 'ideMainLayout' | 'ideCenterLayout', layout: Record<string, number>) => void;
  setAIState: (state: Partial<AIState>) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      provider: 'gemini',
      geminiKey: '',
      claudeKey: '',
      openaiKey: '',
      kimiKey: '',
      vertexKey: '',
      vertexProjectId: '',
      huggingfaceKey: '',
      alibabaKey: '',
      localEndpoint: OLLAMA_DEFAULT_ENDPOINT,
      messages: [],
      isThinking: false,
      isPersistentPersona: true,
      activeIDETab: 'preview',
      ideMainLayout: null,
      ideCenterLayout: null,

      setProvider: (provider) => set((state) => {
        if (provider === 'ollama' || provider === 'lmstudio') {
          return {
            provider,
            localEndpoint: normalizeLocalEndpointForProvider(state.localEndpoint, provider),
          };
        }

        return { provider };
      }),
      setGeminiKey: (geminiKey) => set({ geminiKey }),
      setClaudeKey: (claudeKey) => set({ claudeKey }),
      setOpenaiKey: (openaiKey) => set({ openaiKey }),
      setKimiKey: (kimiKey) => set({ kimiKey }),
      setVertexKey: (vertexKey) => set({ vertexKey }),
      setVertexProjectId: (vertexProjectId) => set({ vertexProjectId }),
      setHuggingfaceKey: (huggingfaceKey) => set({ huggingfaceKey }),
      setAlibabaKey: (alibabaKey) => set({ alibabaKey }),
      setLocalEndpoint: (localEndpoint) => set({ localEndpoint }),
      
      addMessage: (msg) => set((state) => ({
        messages: [
          ...state.messages,
          {
            ...msg,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString()
          }
        ]
      })),

      clearHistory: () => set({ messages: [] }),
      setThinking: (isThinking) => set({ isThinking }),
      setPersistentPersona: (isPersistentPersona) => set({ isPersistentPersona }),
      setActiveIDETab: (activeIDETab) => set({ activeIDETab }),
      setIDELayout: (key, layout) => set({ [key]: layout }),
      setAIState: (newState) => set((state) => ({ ...state, ...newState })),
    }),
    {
      name: 'novaura-ai-settings',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const userJson = kernelStorage.getItem('novaura_current_user');
          const userId = userJson ? JSON.parse(userJson).id : 'guest';
          return kernelStorage.getItem(`${name}_${userId}`);
        },
        setItem: (name, value) => {
          const userJson = kernelStorage.getItem('novaura_current_user');
          const userId = userJson ? JSON.parse(userJson).id : 'guest';
          kernelStorage.setItem(`${name}_${userId}`, value);
        },
        removeItem: (name) => {
          const userJson = kernelStorage.getItem('novaura_current_user');
          const userId = userJson ? JSON.parse(userJson).id : 'guest';
          kernelStorage.removeItem(`${name}_${userId}`);
        },
      })),
    }
  )
);
