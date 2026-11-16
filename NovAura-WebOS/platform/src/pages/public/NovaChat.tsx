import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, Hash, Users, Zap, Dice5, Trophy, Clock, AlertTriangle } from 'lucide-react';
import { socialHubService } from '@/services/SocialHubService';
import { apiKeyService } from '@/services/ApiKeyService';
import { useAuthStore } from '@/stores/authStore';
import { kernelStorage } from '@/kernel/kernelStorage.js';

// ─── Message persistence ──────────────────────────────────────────────────────

const MESSAGES_KEY = 'novaura_novachat_messages';
const MAX_STORED_MESSAGES = 200;

const SEED_MESSAGES: ChatMessage[] = [
  { id: 1, user: 'Aura', role: 'Ambassador', text: 'Welcome to NovaChat. R&D, Art, and Gaming channels are live.', type: 'system' },
  { id: 2, user: 'CyberKnight', role: 'Founder', text: 'Anyone seen the new TCG card designs?', type: 'user' },
  { id: 3, user: 'W48 · LostAtOnce', role: 'Dealer', text: '🌸 The W48 LostAtOnce table is open. 3 rolls per day. May the flowers be in your favour.', type: 'w48' },
];

const loadMessages = (): ChatMessage[] => {
  try {
    const raw = kernelStorage.getItem(MESSAGES_KEY);
    if (!raw) return SEED_MESSAGES;
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.length > 0 ? parsed : SEED_MESSAGES;
  } catch {
    return SEED_MESSAGES;
  }
};

const saveMessages = (msgs: ChatMessage[]): void => {
  // Keep only the most recent MAX_STORED_MESSAGES entries
  const toStore = msgs.slice(-MAX_STORED_MESSAGES);
  kernelStorage.setItem(MESSAGES_KEY, JSON.stringify(toStore));
};

// ─── W48 Daily Dice Limit ─────────────────────────────────────────────────────

const DICE_LIMIT = 3;
const DICE_KEY = 'w48_dice_usage';

interface DiceUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

const getDiceUsage = (): DiceUsage => {
  try {
    const raw = kernelStorage.getItem(DICE_KEY);
    if (!raw) return { date: getTodayKey(), count: 0 };
    const parsed = JSON.parse(raw) as DiceUsage;
    if (parsed.date !== getTodayKey()) return { date: getTodayKey(), count: 0 };
    return parsed;
  } catch {
    return { date: getTodayKey(), count: 0 };
  }
};

const incrementDiceUsage = (): DiceUsage => {
  const usage = getDiceUsage();
  const updated: DiceUsage = { ...usage, count: usage.count + 1 };
  kernelStorage.setItem(DICE_KEY, JSON.stringify(updated));
  return updated;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  user: string;
  role: string;
  text: string;
  type: 'user' | 'system' | 'w48';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NovaChat() {
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);

  const [input, setInput] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const [diceUsage, setDiceUsage] = useState<DiceUsage>(getDiceUsage);
  const [activeChannel, setActiveChannel] = useState('general');

  const rollsRemaining = Math.max(0, DICE_LIMIT - diceUsage.count);
  const isDiceLocked = rollsRemaining === 0;

  useEffect(() => {
    saveMessages(messages);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() }]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    addMessage({
      user: user?.username ?? 'You',
      role: 'Member',
      text: input,
      type: 'user',
    });

    if (user) {
      const keys = apiKeyService.getKeys(user.id);
      const activeEndpointKey = keys.find((k) => k.endpoint);
      if (activeEndpointKey) {
        try {
          await apiKeyService.routeMessage(activeEndpointKey.key, {
            user: user.username,
            text: input,
            channel: activeChannel,
          });
        } catch {
          // routing failure is non-fatal
        }
      }
    }

    setInput('');
  };

  const handleDiceRoll = async () => {
    if (isDiceLocked || isRolling) return;

    setIsRolling(true);
    const updated = incrementDiceUsage();
    setDiceUsage(updated);
    const remaining = Math.max(0, DICE_LIMIT - updated.count);

    try {
      const result = await socialHubService.rollDice(user?.id ?? 'guest', 10);

      addMessage({
        user: 'W48 · LostAtOnce',
        role: 'Dealer',
        text: `🎲 ${user?.username ?? 'Guest'} rolled ${result.roll} — ${
          result.success ? '✅ WIN! +20 Aura Coins' : '❌ BUST! -10 Aura Coins'
        }${
          remaining === 0
            ? '  ·  ⌛ Daily limit reached. Come back tomorrow.'
            : `  ·  ${remaining} roll${remaining !== 1 ? 's' : ''} remaining today.`
        }`,
        type: 'w48',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Roll failed.';
      addMessage({
        user: 'W48 · LostAtOnce',
        role: 'Dealer',
        text: `⚠️ ${message}`,
        type: 'w48',
      });
    }

    setIsRolling(false);
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] bg-void text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-void p-6 space-y-8 flex-shrink-0">
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Channels</h3>
          <div className="space-y-1">
            {['general', 'r-and-d', 'art-lounge', 'gaming-pit', 'tcg-math'].map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group ${
                  activeChannel === ch
                    ? 'bg-neon-pink/10 text-neon-pink border border-neon-pink/20'
                    : 'hover:bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <Hash
                  size={14}
                  className={activeChannel === ch ? 'text-neon-pink' : 'text-zinc-600 group-hover:text-neon-pink'}
                />
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* W48 LostAtOnce panel */}
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">W48 · LostAtOnce</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            High-stakes flower poker table. 3 rolls per day. Every roll is final.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Dice5 size={12} className="text-zinc-500" />
              <span className="text-[11px] text-zinc-400">Today</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: DICE_LIMIT }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < diceUsage.count ? 'bg-neon-pink' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
          {isDiceLocked && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <Clock size={10} />
              <span>Resets at midnight</span>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Active Now</h3>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="w-2 h-2 rounded-full bg-neon-lime" />
            Aura [Ambassador]
          </div>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between bg-void/50 backdrop-blur-xl z-10 flex-shrink-0">
          <h2 className="font-bold flex items-center gap-2">
            <Hash className="text-neon-pink" size={18} />
            {activeChannel}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handleDiceRoll}
              disabled={isDiceLocked || isRolling}
              title={
                isDiceLocked
                  ? 'Daily limit reached — resets at midnight'
                  : `${rollsRemaining} roll${rollsRemaining !== 1 ? 's' : ''} remaining today`
              }
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                isDiceLocked
                  ? 'bg-white/5 border border-white/10 text-zinc-600 cursor-not-allowed'
                  : 'bg-neon-pink/10 border border-neon-pink/20 text-neon-pink hover:bg-neon-pink/20'
              }`}
            >
              {isDiceLocked ? (
                <>
                  <AlertTriangle size={13} />
                  LOCKED
                </>
              ) : (
                <>
                  <Dice5 size={13} className={isRolling ? 'animate-spin' : ''} />
                  ROLL · {rollsRemaining} left
                </>
              )}
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-all">
              <Users size={13} /> 12 Online
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-4 ${m.type === 'system' ? 'opacity-70' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    m.type === 'w48'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : m.user === 'Aura'
                      ? 'bg-neon-pink text-void'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {m.type === 'w48' ? '🎲' : m.user.charAt(0)}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-bold ${
                        m.type === 'w48'
                          ? 'text-yellow-400'
                          : m.user === 'Aura'
                          ? 'text-neon-pink'
                          : 'text-white'
                      }`}
                    >
                      {m.user}
                    </span>
                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-500 uppercase font-mono">
                      {m.role}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed break-words">{m.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        <footer className="p-6 bg-gradient-to-t from-void to-transparent flex-shrink-0">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-pink to-neon-lime rounded-2xl opacity-20 group-focus-within:opacity-40 transition-opacity blur" />
            <div className="relative bg-void border border-white/10 rounded-2xl flex items-center p-2 gap-2">
              <button className="p-3 text-zinc-500 hover:text-neon-pink transition-colors">
                <ImageIcon size={20} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={`Message #${activeChannel}...`}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-2 placeholder:text-zinc-600 outline-none"
              />
              <button
                onClick={handleSend}
                className="p-3 bg-neon-pink text-void rounded-xl hover:scale-105 active:scale-95 transition-all"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-zinc-600 font-mono uppercase tracking-widest px-2">
            <div className="flex items-center gap-1">
              <Zap size={10} className="text-neon-lime" /> End-to-End Encrypted
            </div>
            <div className="flex items-center gap-1">
              <Hash size={10} /> Powered by Aura-Mesh
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
