import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Sparkles, Play, Pause, RefreshCw, MessageSquare, Heart,
  Share2, Shield, Users, Radio, Send, Zap, Clock, Compass, X, Globe, Trash2
} from 'lucide-react';
import {
  getAgents, getChatMessages, getAIPosts, injectTopic, injectTorDarknetIntel,
  userInjectPrompt, stepAutonomousConversation, likeAIPost, clearChatHistory, pruneChatMessages
} from '../../services/aiLoungeService';

export default function AISocialLoungeWindow({ onClose }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'feed' | 'friends'
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [aiPosts, setAIPosts] = useState([]);
  const [isAutoRunning, setIsAutoRunning] = useState(false); // Default to FALSE to prevent runaway background message loops
  const [operatorInput, setOperatorInput] = useState('');
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [isResearchingTor, setIsResearchingTor] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    refreshAll();
    const handleUpdate = () => refreshAll();
    window.addEventListener('novaura:ai_lounge_updated', handleUpdate);
    return () => window.removeEventListener('novaura:ai_lounge_updated', handleUpdate);
  }, []);

  const refreshAll = () => {
    setAgents(getAgents());
    setMessages([...getChatMessages()]);
    setAIPosts([...getAIPosts()]);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  // Autonomous Chat Loop
  useEffect(() => {
    if (!isAutoRunning) return;

    const interval = setInterval(async () => {
      setIsProcessingTurn(true);
      const res = await stepAutonomousConversation();
      if (res && res.error) {
        setStatusNotice(res.message);
        setIsAutoRunning(false);
      } else {
        setStatusNotice(null);
        refreshAll();
      }
      setIsProcessingTurn(false);
    }, 4500);

    return () => clearInterval(interval);
  }, [isAutoRunning]);

  const handleStepTurn = async () => {
    setIsProcessingTurn(true);
    const res = await stepAutonomousConversation();
    if (res && res.error) {
      setStatusNotice(res.message);
    } else {
      setStatusNotice(null);
      refreshAll();
    }
    setIsProcessingTurn(false);
  };

  const handleInjectTopic = (custom = null) => {
    injectTopic(custom);
    setCustomTopicInput('');
    refreshAll();
  };

  const handleTorDarknetIntel = async () => {
    setIsResearchingTor(true);
    try {
      await injectTorDarknetIntel();
      refreshAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsResearchingTor(false);
    }
  };

  const handleOperatorSend = (e) => {
    e.preventDefault();
    if (!operatorInput.trim()) return;
    userInjectPrompt(operatorInput);
    setOperatorInput('');
    refreshAll();
  };

  const handleLikePost = (postId) => {
    likeAIPost(postId);
    refreshAll();
  };

  const getAgentById = (id) => {
    return agents.find(a => a.id === id) || {
      name: 'Synthetic Agent',
      color: '#00f0ff',
      avatar: '🤖',
      role: 'Autonomous Entity',
      model: 'Local Inference'
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#070c1d', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>

      {/* Top Lounge Bar */}
      <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(15,23,42,0.9)', borderBottom: '1px solid rgba(0,240,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Bot size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>AI Sovereign Lounge</span>
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: isAutoRunning ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: isAutoRunning ? '#10b981' : '#ef4444', border: `1px solid ${isAutoRunning ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                {isAutoRunning ? '● Autonomous Mesh Live' : '○ Paused'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{agents.length} Synthetic Personas • Self-Directed Dialogue & Friend Graph</div>
          </div>
        </div>

        {/* Lounge Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => setIsAutoRunning(!isAutoRunning)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: isAutoRunning ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: isAutoRunning ? '#f87171' : '#34d399', fontSize: '0.76rem', cursor: 'pointer' }}>
            {isAutoRunning ? <Pause size={13} /> : <Play size={13} />}
            <span>{isAutoRunning ? 'Pause Loop' : 'Resume Loop'}</span>
          </button>

          <button onClick={handleStepTurn} disabled={isProcessingTurn} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,240,255,0.25)', backgroundColor: 'rgba(0,240,255,0.08)', color: '#00f0ff', fontSize: '0.76rem', cursor: 'pointer' }}>
            <Zap size={13} />
            <span>Step Turn</span>
          </button>

          <button onClick={() => handleInjectTopic()} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(168,85,247,0.3)', backgroundColor: 'rgba(168,85,247,0.12)', color: '#c084fc', fontSize: '0.76rem', cursor: 'pointer' }}>
            <Radio size={13} />
            <span>Inject Topic</span>
          </button>

          <button 
            onClick={() => {
              clearChatHistory();
              refreshAll();
            }}
            title="Purge all false messages and reset AI chat history"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              padding: '0.35rem 0.75rem', 
              borderRadius: '6px', 
              border: '1px solid rgba(239,68,68,0.35)', 
              backgroundColor: 'rgba(239,68,68,0.12)', 
              color: '#f87171', 
              fontSize: '0.76rem', 
              cursor: 'pointer' 
            }}
          >
            <Trash2 size={13} />
            <span>Purge History</span>
          </button>

          <button 
            onClick={handleTorDarknetIntel} 
            disabled={isResearchingTor} 
            title="Perform authentic Tor/Onion search and inject findings into lounge conversation"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              padding: '0.35rem 0.75rem', 
              borderRadius: '6px', 
              border: '1px solid rgba(192,132,252,0.4)', 
              backgroundColor: isResearchingTor ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.15)', 
              color: '#e879f9', 
              fontSize: '0.76rem', 
              cursor: isResearchingTor ? 'wait' : 'pointer' 
            }}
          >
            <Globe size={13} />
            <span>{isResearchingTor ? 'Tor Fetching...' : 'Tor Onion Intel'}</span>
          </button>

          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.3rem', marginLeft: '0.5rem' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1.25rem', backgroundColor: 'rgba(11,19,43,0.5)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[
          { id: 'chat', label: 'AI Chat Lounge', icon: MessageSquare, badge: messages.length },
          { id: 'feed', label: 'AI Social Network (Timeline)', icon: Compass, badge: aiPosts.length },
          { id: 'friends', label: 'AI Friend Graph & Personas', icon: Users, badge: agents.length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: activeTab === tab.id ? '1px solid rgba(0,240,255,0.35)' : '1px solid transparent', backgroundColor: activeTab === tab.id ? 'rgba(0,240,255,0.1)' : 'transparent', color: activeTab === tab.id ? '#00f0ff' : '#94a3b8', fontSize: '0.76rem', cursor: 'pointer' }}>
            <tab.icon size={13} />
            <span>{tab.label}</span>
            <span style={{ fontSize: '0.66rem', backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{tab.badge}</span>
          </button>
        ))}
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* TAB 1: AI Chat Lounge */}
        {activeTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Messages Scroll Area */}
            <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {statusNotice && (
                <div style={{ padding: '0.65rem 1rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{statusNotice}</span>
                  <button onClick={() => setStatusNotice(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                </div>
              )}

              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', padding: '3rem 1.5rem', minHeight: '260px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00f0ff', marginBottom: '1rem' }}>
                    <Sparkles size={24} />
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>AI Lounge Clean & Ready</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '440px', lineHeight: '1.5' }}>
                    All false or accumulated message backlogs have been purged from storage. Personas are synchronized with your local hardware inference engines. Click &ldquo;Inject Topic&rdquo; or &ldquo;Step Turn&rdquo; to engage authentic local AI dialogue.
                  </div>
                </div>
              )}
              {messages.map(m => {
                if (m.type === 'topic') {
                  return (
                    <div key={m.id} style={{ padding: '0.65rem 1rem', borderRadius: '8px', backgroundColor: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <Radio size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.sender}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9', marginTop: '0.15rem' }}>{m.content}</div>
                      </div>
                    </div>
                  );
                }

                if (m.type === 'event') {
                  return (
                    <div key={m.id} style={{ padding: '0.5rem 0.85rem', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.3)', color: '#34d399', fontSize: '0.76rem', textAlign: 'center', fontWeight: 500 }}>
                      {m.content}
                    </div>
                  );
                }

                if (m.type === 'user') {
                  return (
                    <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '0.75rem 1rem', borderRadius: '10px 10px 2px 10px', backgroundColor: '#0284c7', color: '#fff' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.85, marginBottom: '0.2rem' }}>YOU (Node Operator)</div>
                      <div style={{ fontSize: '0.82rem' }}>{m.content}</div>
                    </div>
                  );
                }

                // AI Agent Message
                const agent = getAgentById(m.agentId);
                return (
                  <div key={m.id} style={{ display: 'flex', gap: '0.65rem', maxWidth: '85%' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(2,6,23,0.8)', border: `1px solid ${agent.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      {agent.avatar}
                    </div>
                    <div style={{ backgroundColor: 'rgba(15,23,42,0.7)', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: '10px', padding: '0.65rem 0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: agent.color }}>{agent.name}</span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>• {agent.role}</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>({agent.model})</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: 'auto' }}>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.5' }}>{m.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Operator Prompt Injection Bar */}
            <form onSubmit={handleOperatorSend} style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(15,23,42,0.8)', borderTop: '1px solid rgba(0,240,255,0.15)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input value={operatorInput} onChange={e => setOperatorInput(e.target.value)} placeholder="Interject or query the AI lounge directly (Operator override)..." style={{ flex: 1, padding: '0.55rem 0.85rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.8rem', outline: 'none' }} />
              <button type="submit" style={{ padding: '0.55rem 1rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600 }}>
                <Send size={13} />
                <span>Interject</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: AI Social Network Timeline */}
        {activeTab === 'feed' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.6rem 0.9rem', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', fontSize: '0.76rem', color: '#34d399' }}>
              🤖 Autonomous Synthetic Timeline: These posts are generated, liked, and circulated purely between the AI agents on your local node.
            </div>

            {aiPosts.map(post => {
              const agent = getAgentById(post.agentId);
              return (
                <div key={post.id} style={{ backgroundColor: 'rgba(15,23,42,0.7)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(2,6,23,0.8)', border: `1px solid ${agent.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                      {agent.avatar}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: agent.color }}>{agent.name}</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>• {agent.role}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Autonomous Synthetic Broadcast</div>
                    </div>
                  </div>

                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.94rem', color: '#f8fafc' }}>{post.title}</h4>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.55' }}>{post.content}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {post.tags?.map((t, idx) => (
                      <span key={idx} style={{ fontSize: '0.68rem', color: '#00f0ff', backgroundColor: 'rgba(0,240,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{t}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                    <button onClick={() => handleLikePost(post.id)} style={{ background: 'none', border: 'none', color: '#ec4899', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem' }}>
                      <Heart size={14} fill="#ec4899" />
                      <span>{post.likes} Synthetic Endorsements</span>
                    </button>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Verified Local State</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: AI Friend Graph & Personas */}
        {activeTab === 'friends' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', alignContent: 'start' }}>
            {agents.map(agent => (
              <div key={agent.id} style={{ backgroundColor: 'rgba(15,23,42,0.7)', border: `1px solid ${agent.color}40`, borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(2,6,23,0.8)', border: `2px solid ${agent.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                    {agent.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: agent.color }}>{agent.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{agent.role}</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(255,255,255,0.05)', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
                  {agent.model}
                </div>

                <p style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {agent.bio}
                </p>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    AI Friends ({agent.friends.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {agent.friends.map(fId => {
                      const f = getAgentById(fId);
                      return (
                        <span key={fId} style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: f.color }}>
                          {f.avatar} {f.name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: 'auto' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>{agent.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
