import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, MessageCircle, User, Shield, 
  Search, Inbox, Clock, CheckCheck, 
  MoreVertical, Paperclip, Smile
} from 'lucide-react';
import { db } from '../../config/firebase';
import { 
  collection, query, orderBy, limit, onSnapshot, 
  addDoc, serverTimestamp, where, doc, getDocs 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

export default function DirectMessengerWindow() {
  const { user, isOwner } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null); // The userId of the other person
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef(null);

  // If user is NOT owner, they only see one conversation: the one with the "Admin/Owner"
  // If user IS owner, they see all conversations with users

  useEffect(() => {
    if (!user || !db) return;

    let convQuery;
    if (isOwner) {
      // Owner sees all active threads in the support queue
      convQuery = query(
        collection(db, 'support_threads'),
        orderBy('lastMessageAt', 'desc'),
        limit(50)
      );
    } else {
      // Standard user only sees their thread with the owner
      convQuery = query(
        collection(db, 'support_threads'),
        where('userId', '==', user.id)
      );
    }

    const unsub = onSnapshot(convQuery, (snapshot) => {
      const threads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(threads);
      
      if (!isOwner && threads.length > 0 && !activeConv) {
        setActiveConv(threads[0]);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [user, isOwner]);

  useEffect(() => {
    if (!activeConv || !db) return;

    const msgQuery = query(
      collection(db, `support_threads/${activeConv.id}/messages`),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(msgQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    });

    return () => unsub();
  }, [activeConv]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user || !db) return;

    const text = input.trim();
    setInput('');

    try {
      let threadId = activeConv?.id;

      // If no thread exists for user yet, create it
      if (!isOwner && !threadId) {
        const newThread = await addDoc(collection(db, 'support_threads'), {
          userId: user.id,
          username: user.username,
          avatar: user.avatar || null,
          lastMessage: text,
          lastMessageAt: serverTimestamp(),
          unreadCount: 1,
          membershipTier: user.membershipTier || 'free'
        });
        threadId = newThread.id;
      }

      await addDoc(collection(db, `support_threads/${threadId}/messages`), {
        text,
        senderId: user.id,
        senderName: user.username,
        timestamp: serverTimestamp(),
        isOwner: isOwner
      });

      // Update thread preview
      const threadRef = doc(db, 'support_threads', threadId);
      // We don't use updateDoc here for simplicity in the demo/scratch, 
      // but in production we'd update lastMessage and timestamp
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="h-full flex bg-[#05050a] text-white">
      {/* Sidebar - Only show for Owner to switch between users */}
      {isOwner && (
        <div className="w-64 border-r border-white/5 flex flex-col">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <Inbox className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold">Owner Inbox</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full p-4 flex items-center gap-3 border-b border-white/[0.02] hover:bg-white/5 transition-all text-left ${
                  activeConv?.id === conv.id ? 'bg-white/5 border-l-2 border-l-cyan-500' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                  {conv.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[11px] font-bold truncate">{conv.username}</span>
                    <span className="text-[8px] text-white/20 whitespace-nowrap">2m</span>
                  </div>
                  <p className="text-[10px] text-white/40 truncate">{conv.lastMessage}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
              {isOwner ? <User className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/90">
                {isOwner ? (activeConv?.username || 'Select a Member') : 'Direct Line to Founder'}
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Encrypted Connection</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button className="p-2 hover:bg-white/5 rounded-lg text-white/20">
               <MoreVertical className="w-4 h-4" />
             </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin scrollbar-thumb-white/5"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-10 opacity-40">
              <MessageCircle className="w-12 h-12 mb-4 text-cyan-500" />
              <h4 className="text-sm font-bold mb-2">
                {isOwner ? 'Select a user to view message history' : 'Direct Access to the Founder'}
              </h4>
              <p className="text-[11px] leading-relaxed max-w-[240px]">
                {isOwner 
                  ? 'Your private messages with platform members will appear here.' 
                  : 'Welcome to the inner circle. Your messages here are delivered directly to Dillan and the owner team.'}
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1`}>
                  <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-lg ${
                      isMe 
                        ? 'bg-cyan-600 text-white rounded-tr-none' 
                        : 'bg-white/5 border border-white/10 text-white/80 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1 opacity-30">
                       <span className="text-[8px] font-mono">12:45 PM</span>
                       {isMe && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5">
          <form 
            onSubmit={handleSendMessage}
            className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-cyan-500/30 transition-all"
          >
            <button type="button" className="text-white/20 hover:text-white/40"><Paperclip className="w-4 h-4" /></button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-2 text-white/90 placeholder-white/20"
            />
            <button type="button" className="text-white/20 hover:text-white/40"><Smile className="w-4 h-4" /></button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-20 disabled:grayscale transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
