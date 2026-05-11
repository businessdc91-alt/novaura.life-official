import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export type AIProvider = 'claude' | 'gemini' | 'kimi' | 'openrouter';

export const DEFAULT_PROVIDER: AIProvider = 'openrouter';

export interface Message { role: 'user' | 'assistant'; content: string; }

export interface AIResponse { text: string; model: string; provider: string; }

export async function chat(
  provider: AIProvider = DEFAULT_PROVIDER,
  messages: Message[],
  model?: string
): Promise<AIResponse> {
  const cmd =
    provider === 'claude'     ? 'call_claude'     :
    provider === 'gemini'     ? 'call_gemini'     :
    provider === 'kimi'       ? 'call_kimi'       :
    provider === 'openrouter' ? 'call_openrouter' :
                                'call_openrouter'; // fallback to OpenRouter
  return invoke<AIResponse>(cmd, { messages, model });
}

export async function streamClaude(
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const streamId = crypto.randomUUID();
  const unlistenChunk = await listen<string>(`stream_chunk_${streamId}`, e => onChunk(e.payload));
  const unlistenDone = await listen(`stream_done_${streamId}`, () => {
    onDone();
    unlistenChunk();
    unlistenDone();
  });
  await invoke('stream_claude', { messages, streamId });
}

// Context-aware codebase prompt builder
export function buildCodeContext(files: Record<string, string>): string {
  const parts = Object.entries(files).map(([path, content]) =>
    `### ${path}\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\``
  );
  return `The following NovAura platform files are provided for context:\n\n${parts.join('\n\n')}`;
}

export const PROVIDER_LABELS: Record<AIProvider, { name: string; color: string; description: string }> = {
  openrouter: { name: 'Gemma 4 31B', color: '#7c3aed', description: 'Default — OpenRouter, free → paid fallback' },
  claude:     { name: 'Claude',      color: '#cc785c', description: 'Deep reasoning, architecture, long code' },
  gemini:     { name: 'Gemini',      color: '#4285f4', description: 'Research, multimodal, fast analysis' },
  kimi:       { name: 'Kimi K2',     color: '#00d4aa', description: 'Long context, code generation, 128k' },
};
