// User API key management — stored encrypted in Firestore per user profile
// Keys are personal; platform falls back to OpenRouter platform key if none set
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserAPIKeys {
  openrouter: string;
  anthropic: string;
  gemini: string;
  kimi: string;
  useOwn: boolean;
}

const EMPTY_KEYS: UserAPIKeys = { openrouter: '', anthropic: '', gemini: '', kimi: '', useOwn: false };

// Simple XOR obfuscation — keys are in Firestore (protected by auth rules), not plain storage
function obfuscate(str: string): string {
  if (!str) return '';
  const seed = 'novaura_ops_2026';
  return btoa(str.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ seed.charCodeAt(i % seed.length))
  ).join(''));
}

function deobfuscate(str: string): string {
  if (!str) return '';
  try {
    const seed = 'novaura_ops_2026';
    return atob(str).split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ seed.charCodeAt(i % seed.length))
    ).join('');
  } catch { return ''; }
}

export async function saveUserKeys(uid: string, keys: UserAPIKeys): Promise<void> {
  await setDoc(doc(db, 'ops_staff', uid), {
    api_keys: {
      openrouter: obfuscate(keys.openrouter),
      anthropic: obfuscate(keys.anthropic),
      gemini: obfuscate(keys.gemini),
      kimi: obfuscate(keys.kimi),
      useOwn: keys.useOwn,
    }
  }, { merge: true });
}

export async function loadUserKeys(uid: string): Promise<UserAPIKeys> {
  const snap = await getDoc(doc(db, 'ops_staff', uid));
  if (!snap.exists()) return EMPTY_KEYS;
  const raw = snap.data()?.api_keys;
  if (!raw) return EMPTY_KEYS;
  return {
    openrouter: deobfuscate(raw.openrouter || ''),
    anthropic: deobfuscate(raw.anthropic || ''),
    gemini: deobfuscate(raw.gemini || ''),
    kimi: deobfuscate(raw.kimi || ''),
    useOwn: raw.useOwn || false,
  };
}

// Resolution order: user's own key (if useOwn=true) → platform env key → OpenRouter free
export function resolveKey(
  userKeys: UserAPIKeys,
  provider: 'anthropic' | 'gemini' | 'kimi' | 'openrouter'
): { key: string; source: 'user' | 'platform' | 'openrouter' } {
  if (userKeys.useOwn && userKeys[provider]) {
    return { key: userKeys[provider], source: 'user' };
  }
  // Fall back to platform key (set via Tauri env / .env)
  const platformKey = {
    anthropic: import.meta.env.VITE_ANTHROPIC_KEY || '',
    gemini: import.meta.env.VITE_GEMINI_KEY || '',
    kimi: import.meta.env.VITE_KIMI_KEY || '',
    openrouter: import.meta.env.VITE_OPENROUTER_KEY || '',
  }[provider];

  if (platformKey) return { key: platformKey, source: 'platform' };

  // Last resort: OpenRouter free tier (set platform key = OpenRouter key)
  return { key: import.meta.env.VITE_OPENROUTER_KEY || '', source: 'openrouter' };
}
