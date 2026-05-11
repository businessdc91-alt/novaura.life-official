import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, Send, MessageSquare, Users, Shield, 
  Sparkles, Zap, Star, MoreVertical, Trash2,
  Clock, Check, CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../config/firebase';
import { 
  collection, query, orderBy, limit, onSnapshot, 
  addDoc, serverTimestamp, doc, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

/**
 * NovAura Founding Catalyst Chat — The Council Chamber
 * High-tier exclusive communication channel for Founders and Investors.
 * This is the Founding Fathers Lounge.
 */
export default function FoundingFathersChatWindow() {
  const { user, isOwner } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [boardroomActive, setBoardroomActive] = useState(false);
  const scrollRef = useRef(null);

  // Check if user has access (Any Founders Pass or Owner)
  // The Tier is "founding-catalyst" (and variations), the Lounge is "Founding Fathers Lounge"
  const isFoundingMember = [
    'founding-spark', 
    'founding-catalyst', 
    'founding-nova', 
    'founding-father',
    'council-member',
    'catalyst-crew-founders', 
    'catalyst-crew',
    'catalytic-crew',
    'strategic-investor'
  ].includes(user?.membershipTier) || 
  ['spark', 'catalyst', 'nova'].includes(user?.membershipTier) || 
  user?.email?.endsWith('@novaura.xyz') ||
  user?.email?.endsWith('@novaura.life') ||
  isOwner;

  useEffect(() => {
    if (!isFoundingMember || !db) return;

    // Use the original collection path
    const chatQuery = query(
      collection(db, 'chats/founding-fathers/messages'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse();
      setMessages(msgs);
      setIsLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [isFoundingMember]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user || !db) return;

    const text = input.trim();
    setInput('');

    try {
      await addDoc(collection(db, 'chats/founding-fathers/messages'), {
        text,
        userId: user.id,
        username: user.username,
        avatar: user.avatar || null,
        tier: user.membershipTier,
        timestamp: serverTimestamp(),
        isOwner: useAuthStore.getState().isOwner()
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setInput(text); // Restore input on failure
    }
  };

  if (!isFoundingMember) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20">
          <Crown className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Founding Members Only</h2>
        <p className="text-sm text-slate-400 max-w-xs mb-6">
          This exclusive chamber is reserved for all Founding Spark, Catalyst, Nova, Crew, and Strategic Investor members.
        </p>
        <button 
          onClick={() => window.open('https://novaura.life#founders', '_blank')}
          className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 rounded-full text-sm font-bold shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform"
        >
          Become a Founder
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#05050a] text-white">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-900/20 via-slate-900 to-slate-900 border-b border-amber-500/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center relative">
            <Crown className="w-5 h-5 text-amber-500" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#05050a]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/90 flex items-center gap-1.5">
              Founding Fathers Lounge
              <Shield className="w-3 h-3 text-cyan-400" />
            </h3>
            <p className="text-[10px] text-amber-500/60 font-medium tracking-wide uppercase">Private Council Chamber</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setBoardroomActive(!boardroomActive)}
            className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
              boardroomActive 
                ? 'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse' 
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            Boardroom Mode
          </button>
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-[#05050a] bg-slate-800" />
            ))}
            <div className="w-6 h-6 rounded-full border-2 border-[#05050a] bg-amber-500/20 flex items-center justify-center text-[8px] font-bold text-amber-500">
              +12
            </div>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg text-white/40">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Boardroom Banner */}
      <AnimatePresence>
        {boardroomActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500/10 border-b border-amber-500/20 overflow-hidden"
          >
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em]">Council Active:</span>
                <div className="flex gap-3">
                  <span className="text-[9px] text-white/60 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5 text-cyan-400" /> The Visionary</span>
                  <span className="text-[9px] text-white/60 flex items-center gap-1"><Shield className="w-2.5 h-2.5 text-purple-400" /> The Architect</span>
                  <span className="text-[9px] text-white/60 flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-emerald-400" /> The Enforcer</span>
                </div>
              </div>
              <span className="text-[8px] text-white/20 font-mono italic">Debating current project trajectory...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-amber-500/20"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
            <Sparkles className="w-8 h-8 animate-pulse text-amber-500" />
            <span className="text-[10px] uppercase tracking-widest font-bold">Summoning Council...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-10">
            <div className="p-4 rounded-full bg-amber-500/5 mb-4 border border-amber-500/10">
              <MessageSquare className="w-8 h-8 text-amber-500/40" />
            </div>
            <h4 className="text-sm font-bold text-white/60 mb-2">The chamber is silent</h4>
            <p className="text-[11px] text-white/30 italic">"The future begins with the first word spoken in this room."</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.userId === user?.id;
            const isOwner = msg.isOwner;
            const isCatalystCrew = msg.tier === 'catalyst-crew' || msg.tier === 'catalyst-crew-founders';
            
            return (
              <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className="shrink-0 pt-1 relative">
                    {msg.avatar ? (
                      <img src={msg.avatar} alt={msg.username} className="w-8 h-8 rounded-lg object-cover ring-2 ring-white/5 shadow-lg" />
                    ) : (
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-lg ${
                        isOwner ? 'bg-amber-500 text-[#05050a]' : 
                        isCatalystCrew ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-black' :
                        'bg-slate-800 text-white/70'
                      }`}>
                        {msg.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    {isCatalystCrew && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-300 rounded-full border-2 border-[#05050a] flex items-center justify-center shadow-lg">
                        <span className="text-[10px] font-black text-black">M</span>
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className={`text-[10px] font-bold ${
                        isOwner ? 'text-amber-400' : 
                        isCatalystCrew ? 'text-slate-200 animate-pulse bg-gradient-to-r from-slate-200 via-white to-slate-400 bg-clip-text' :
                        'text-white/60'
                      }`}>
                        {msg.username}
                      </span>
                      {isOwner && <Shield className="w-2.5 h-2.5 text-cyan-400" />}
                      {msg.tier && (
                        <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          msg.tier === 'nova' || msg.tier === 'founding-nova' ? 'bg-cyan-500/20 text-cyan-400' : 
                          msg.tier === 'catalyst' || msg.tier === 'founding-catalyst' || msg.tier === 'founding-father' ? 'bg-purple-500/20 text-purple-400' :
                          msg.tier === 'catalyst-crew' || msg.tier === 'catalyst-crew-founders' ? 'bg-slate-100 text-black' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {isCatalystCrew ? 'High Roller' : msg.tier}
                        </span>
                      )}
                    </div>
                    
                    <div className={`relative px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-xl border ${
                      isMe 
                        ? 'bg-amber-500/10 border-amber-500/20 text-white/90 rounded-tr-none' 
                        : 'bg-white/5 border-white/10 text-white/80 rounded-tl-none'
                    }`}>
                      {msg.text}
                      <div className={`absolute bottom-1 ${isMe ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                         <Clock className="w-2.5 h-2.5 text-white/20" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 px-1">
                       <span className="text-[8px] text-white/10 font-mono">
                        {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                       </span>
                       {isMe && <CheckCheck className="w-2.5 h-2.5 text-amber-500/40" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/3 border-t border-white/5">
        <form 
          onSubmit={handleSendMessage}
          className="relative flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-amber-500/30 transition-all shadow-inner"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Address the council..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/20 resize-none outline-none max-h-[150px] py-1"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-[9px] text-white/10 text-center mt-2 uppercase tracking-[0.2em] font-medium">
          Encrypted Council Communication
        </p>
      </div>
    </div>
  );
}
