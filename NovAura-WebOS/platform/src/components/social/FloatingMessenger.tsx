import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  X, 
  Minimize2, 
  Send, 
  Sparkles, 
  Shield, 
  Users,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { 
  getRoomMessages, 
  sendRoomMessage, 
  getUserConversations,
  getMessagesBetween,
  sendMessage
} from '@/services/messageService';
import { UserBadge } from '../ui/UserBadge';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Helper to fetch user from Firestore
const getUserById = async (userId: string) => {
  if (!db || !userId) return null;
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (e) {
    console.error('Error fetching user:', e);
  }
  return null;
};

const CHANNELS = [
  { id: 'ROOM_CREATORS', name: 'Creators Hub', role: 'creator', description: 'Exclusive space for creative pros', icon: Sparkles, color: 'text-neon-magenta' },
  { id: 'ROOM_DEVS', name: 'Dev Sanctuary', role: 'admin', description: 'Behind-the-scenes engineering talk', icon: Shield, color: 'text-neon-cyan' },
];

export default function FloatingMessenger() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Define load functions with useCallback BEFORE useEffect hooks that use them
  const loadMessages = useCallback(() => {
    if (!activeId) return;
    if (activeId.startsWith('ROOM_')) {
      setMessages(getRoomMessages(activeId));
    } else {
      setMessages(getMessagesBetween(user!.id, activeId));
    }
  }, [activeId, user]);

  const loadConversations = useCallback(() => {
    if (!user) return;
    const convs = getUserConversations(user.id);
    const enriched = convs.map(c => {
      const otherId = c.lastMessage?.senderId === user.id ? c.lastMessage?.recipientId : c.lastMessage?.senderId;
      return { ...c, otherUser: getUserById(otherId || '') };
    }).filter(c => c.otherUser);
    setConversations(enriched);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeId) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeId, user, loadMessages]);

  useEffect(() => {
    if (isOpen && activeTab === 'dms') {
      loadConversations();
    }
  }, [isOpen, activeTab, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !user || !activeId) return;

    if (activeId.startsWith('ROOM_')) {
      sendRoomMessage(user.id, activeId, messageInput.trim());
    } else {
      sendMessage(user.id, activeId, messageInput.trim());
    }
    
    setMessageInput('');
    loadMessages();
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 md:w-96 h-[500px] bg-void/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col mb-4 overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-neon-cyan/20 rounded-lg">
                  <MessageCircle className="w-4 h-4 text-neon-cyan" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Ecosystem Chat</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-text-secondary uppercase tracking-tighter">Connected</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setIsExpanded(false); setIsOpen(false); }}
                  className="p-1.5 text-text-muted hover:text-neon-red hover:bg-neon-red/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {activeId ? (
              <div className="flex-grow flex flex-col overflow-hidden">
                <div className="p-3 border-b border-white/5 flex items-center gap-3 bg-white/5">
                  <button 
                    onClick={() => setActiveId(null)}
                    className="p-1 text-text-muted hover:text-text-primary"
                  >
                    <ChevronUp className="w-4 h-4 rotate-270" />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {activeId.startsWith('ROOM_') ? CHANNELS.find(c => c.id === activeId)?.name : getUserById(activeId)?.username}
                    </span>
                    {activeId.startsWith('ROOM_') && (
                      <div className="px-1.5 py-0.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded text-[8px] font-bold text-neon-cyan uppercase">
                        Channel
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                  {messages.map((m) => {
                    const isOwn = m.senderId === user.id;
                    const sender = getUserById(m.senderId);
                    return (
                      <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1 mb-1">
                          {!isOwn && <span className="text-[10px] font-bold text-text-secondary">{sender?.username}</span>}
                          {sender?.badges?.map(badge => (
                            <UserBadge key={badge} type={badge as any} size="sm" />
                          ))}
                        </div>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                          isOwn ? 'bg-neon-cyan text-void rounded-br-sm' : 'bg-void-light border border-white/5 rounded-bl-sm'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-white/5 flex gap-2">
                  <Input 
                    placeholder="Type message..." 
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="bg-void border-white/5 text-xs h-9"
                  />
                  <Button size="icon" className="h-9 w-9 bg-neon-cyan text-void" onClick={handleSendMessage}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-white/5">
                  <button 
                    onClick={() => setActiveTab('channels')}
                    className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'channels' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Channels
                  </button>
                  <button 
                    onClick={() => setActiveTab('dms')}
                    className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'dms' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Messages
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto">
                  {activeTab === 'channels' ? (
                    <div className="p-2 space-y-1">
                      {CHANNELS.filter(c => user.role === 'admin' || user.role === c.role).map((channel) => {
                        const Icon = channel.icon;
                        return (
                          <button
                            key={channel.id}
                            onClick={() => setActiveId(channel.id)}
                            className="w-full p-3 flex items-start gap-3 hover:bg-white/5 rounded-xl transition-all group"
                          >
                            <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 ${channel.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold text-text-primary">{channel.name}</p>
                              <p className="text-[10px] text-text-secondary">{channel.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {conversations.length > 0 ? conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setActiveId(conv.otherUser.id)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-white/5 rounded-xl transition-all"
                        >
                          <img 
                            src={conv.otherUser.avatar} 
                            alt={conv.otherUser.username} 
                            className="w-10 h-10 rounded-full border border-white/10" 
                          />
                          <div className="text-left flex-grow overflow-hidden">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-text-primary">{conv.otherUser.username}</p>
                              {conv.otherUser.badges?.map((badge: string) => (
                                <UserBadge key={badge} type={badge as any} size="sm" />
                              ))}
                            </div>
                            <p className="text-[10px] text-text-secondary truncate">{conv.lastMessage?.content}</p>
                          </div>
                        </button>
                      )) : (
                        <div className="flex flex-col items-center justify-center h-40 text-text-muted">
                          <Users className="w-10 h-10 mb-2 opacity-20" />
                          <p className="text-xs">No direct messages yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => {
          if (!isOpen) setIsOpen(true);
          setIsExpanded(!isExpanded);
        }}
        className={`h-14 ${isExpanded ? 'w-14 rounded-full' : 'px-6 rounded-2xl'} bg-gradient-rgb text-void shadow-neon hover:scale-105 transition-all duration-300 relative group overflow-hidden pointer-events-auto`}
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
        <div className="relative flex items-center gap-2">
          {isExpanded ? (
            <Minimize2 className="w-6 h-6" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6" />
              <span className="font-bold text-sm">Ecosystem</span>
              <div className="flex items-center -space-x-2 ml-2">
                <div className="w-5 h-5 rounded-full border-2 border-void bg-green-500" />
                <div className="w-5 h-5 rounded-full border-2 border-void bg-neon-cyan" />
              </div>
            </>
          )}
        </div>
        
        {/* Unread dot */}
        <div className="absolute top-2 right-2 w-3 h-3 bg-neon-magenta rounded-full border-2 border-void animate-bounce" />
      </Button>
    </div>
  );
}
