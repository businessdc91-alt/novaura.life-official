import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Send, Smile, Paperclip, Code2, Plus, AtSign } from 'lucide-react';
import {
  subscribeToChannels, subscribeToMessages, sendMessage, addReaction, seedChannels,
  type Channel, type ChatMessage
} from '../../services/chatService';
import { useAppStore } from '../../stores/appStore';
import { format } from 'date-fns';

const QUICK_REACTIONS = ['👍', '🔥', '✅', '❌', '🚀', '👀', '💡', '⚡'];

export default function ChatPanel() {
  const { activeChannelId, setActiveChannelId, user } = useAppStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [msgType, setMsgType] = useState<'text' | 'code'>('text');
  const [codeLang, setCodeLang] = useState('typescript');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    seedChannels();
    const unsub = subscribeToChannels(chs => {
      setChannels(chs);
      if (!activeChannelId && chs.length > 0) setActiveChannelId(chs[0].id);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    const unsub = subscribeToMessages(activeChannelId, msgs => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return unsub;
  }, [activeChannelId]);

  const handleSend = async () => {
    if (!input.trim() || !activeChannelId || sending) return;
    setSending(true);
    try {
      await sendMessage(activeChannelId, input.trim(), msgType,
        msgType === 'code' ? { codeLanguage: codeLang } : {});
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);

  return (
    <div className="h-full flex">
      {/* Channel list */}
      <aside className="w-52 bg-void-light border-r border-white/5 flex flex-col p-3 gap-1 flex-shrink-0">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">Channels</p>
        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => setActiveChannelId(ch.id)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${
              activeChannelId === ch.id
                ? 'bg-white/5 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            <Hash className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
      </aside>

      {/* Messages */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <Hash className="w-4 h-4 text-white/40" />
          <span className="text-white font-semibold">{activeChannel?.name || '...'}</span>
          {activeChannel?.description && (
            <span className="text-white/30 text-sm ml-2">{activeChannel.description}</span>
          )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 selectable">
          {messages.map((msg, i) => {
            const isOwn = msg.userId === user?.uid;
            const showAvatar = i === 0 || messages[i - 1].userId !== msg.userId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 group ${showAvatar ? 'mt-4' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${showAvatar ? 'visible' : 'invisible'}`}
                  style={{ background: isOwn ? 'rgba(0,240,255,0.2)' : 'rgba(139,92,246,0.2)' }}>
                  {msg.userDisplayName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  {showAvatar && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-white text-sm font-semibold">{msg.userDisplayName}</span>
                      <span className="text-white/30 text-[10px]">
                        {msg.createdAt ? format(msg.createdAt.toDate(), 'h:mm a') : ''}
                      </span>
                    </div>
                  )}

                  {msg.type === 'code' ? (
                    <pre className="bg-void-lighter border border-white/5 rounded-lg p-3 text-xs font-mono text-green-300 overflow-x-auto selectable">
                      <code>{msg.content}</code>
                    </pre>
                  ) : (
                    <p className="text-white/80 text-sm leading-relaxed break-words">{msg.content}</p>
                  )}

                  {/* Reactions */}
                  {Object.keys(msg.reactions || {}).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(activeChannelId!, msg.id, emoji)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
                        >
                          {emoji} <span className="text-white/50">{(users as string[]).length}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick reactions on hover */}
                  <div className="hidden group-hover:flex gap-1 mt-1">
                    {QUICK_REACTIONS.map(e => (
                      <button key={e} onClick={() => addReaction(activeChannelId!, msg.id, e)}
                        className="text-sm hover:scale-110 transition-transform opacity-40 hover:opacity-100">
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setMsgType(msgType === 'text' ? 'code' : 'text')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${msgType === 'code' ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30' : 'text-white/30 hover:text-white/60'}`}
            >
              <Code2 className="w-3.5 h-3.5" /> Code
            </button>
            {msgType === 'code' && (
              <select
                value={codeLang}
                onChange={e => setCodeLang(e.target.value)}
                className="bg-void-lighter border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none"
              >
                {['typescript', 'javascript', 'rust', 'python', 'sql', 'bash', 'json'].map(l =>
                  <option key={l} value={l}>{l}</option>
                )}
              </select>
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              className="flex-1 bg-void-lighter border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-neon-cyan/40 transition-colors selectable font-mono"
              rows={msgType === 'code' ? 4 : 1}
              placeholder={msgType === 'code' ? `Paste ${codeLang} code...` : `Message #${activeChannel?.name || '...'}`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && msgType === 'text') {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan hover:bg-neon-cyan/20 transition-all disabled:opacity-30 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
