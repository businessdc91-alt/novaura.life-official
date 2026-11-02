// AICoAuthorPanel.jsx — Universal AI Co-Author Studio with Model Selector & RAG Memory
import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, X, MessageSquare, Wand2, GitFork, Brain, Send, Copy, Check,
  CornerDownLeft, RefreshCw, BookmarkPlus, ArrowRight, Settings, Cpu
} from 'lucide-react';
import {
  chatLiteratureCoAuthor, craftGuidedStory, generatePlotBranches, expandBranchIntoProse,
  getActiveInferenceConfig, setActiveInferenceConfig, getAvailableInferenceRosters
} from '../../../../services/literatureAiService.js';
import {
  getAllMemories, rememberMemory, deleteMemory
} from '../../../../services/sovereignRagService.js';
import { storyTimeline } from '../engines/StoryTimeline.js';

export default function AICoAuthorPanel({
  activeDoc,
  activeDocContent,
  selectedText,
  wordCount,
  onInsertProse,
  onReplaceSelection,
  onCreateNewChapter,
  onClose
}) {
  const [panelTab, setPanelTab] = useState('chat'); // 'chat' | 'craft' | 'branch' | 'memories'
  const [modelConfig, setModelConfig] = useState(getActiveInferenceConfig());
  const [rosters, setRosters] = useState({ local: [], cloud: [] });

  // Co-Author Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'I am your sovereign AI co-author. I am linked directly to your active manuscript, Story Bible Codex, and private RAG memory vault. Ask me to critique scene pacing, test dialogue rhythms, outline twists, or draft text to weave into your chapter.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      usedMemories: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatIncludeDoc, setChatIncludeDoc] = useState(true);
  const [chatIncludeSelection, setChatIncludeSelection] = useState(true);
  const [chatUseRag, setChatUseRag] = useState(true);
  const [aiError, setAiError] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [insertedMsgId, setInsertedMsgId] = useState(null);
  const [rememberedMsgId, setRememberedMsgId] = useState(null);
  const chatBottomRef = useRef(null);

  // Guided Craft State
  const [craftGenre, setCraftGenre] = useState('Cyberpunk');
  const [craftTone, setCraftTone] = useState('Gritty & Atmospheric');
  const [craftProtagonist, setCraftProtagonist] = useState('Silas Vance, an air-gapped cryptographer');
  const [craftSetting, setCraftSetting] = useState('New Aethelgard Perimeter');
  const [craftPremise, setCraftPremise] = useState('Discovering an active signal from an archive presumed destroyed forty years ago');
  const [isCraftingStory, setIsCraftingStory] = useState(false);
  const [craftedResult, setCraftedResult] = useState(null);

  // Plot Branching State
  const [plotBranches, setPlotBranches] = useState([]);
  const [isGeneratingBranches, setIsGeneratingBranches] = useState(false);
  const [isExpandingBranch, setIsExpandingBranch] = useState(false);

  // Memories State
  const [memoriesList, setMemoriesList] = useState([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCat, setNewMemoryCat] = useState('lore');

  useEffect(() => {
    loadRosters();
    loadMemories();
  }, []);

  const loadRosters = async () => {
    const data = await getAvailableInferenceRosters();
    setRosters(data);
  };

  const loadMemories = async () => {
    try {
      const list = await getAllMemories();
      setMemoriesList(list);
    } catch {}
  };

  const handleModelChange = (e) => {
    const val = e.target.value;
    let newConfig = { ...modelConfig };
    if (val === 'auto') {
      newConfig = { provider: 'auto', model: '' };
    } else if (val.startsWith('local:') || val.startsWith('cloud:')) {
      // "local:<provider>:<model>"; Ollama model names contain colons themselves (llama3:8b).
      const rest = val.slice(val.indexOf(':') + 1);
      const cut = rest.indexOf(':');
      newConfig = { provider: rest.slice(0, cut), model: rest.slice(cut + 1) };
    }
    setModelConfig(newConfig);
    setActiveInferenceConfig(newConfig);
  };

  const handleSendChatMessage = async (textToSend = null) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isChatSending) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatSending(true);
    setAiError(null);

    const docText = chatIncludeDoc ? activeDocContent : '';
    const selText = chatIncludeSelection ? selectedText : '';

    try {
      const result = await chatLiteratureCoAuthor({
        messages: [...chatMessages, userMsg],
        documentContext: docText,
        selectionContext: selText,
        codexContext: storyTimeline.bibleContext(),
        activeDocName: activeDoc?.name || 'Manuscript',
        useRag: chatUseRag,
        provider: modelConfig.provider,
        model: modelConfig.model
      });

      const assistantMsg = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: result.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        usedMemories: result.usedMemories || []
      };

      setChatMessages(prev => [...prev, assistantMsg]);
      loadMemories();
    } catch (err) {
      setAiError(err.message || 'Failed to receive co-author response.');
    } finally {
      setIsChatSending(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleInsertAtCursor = (text, msgId) => {
    if (onInsertProse) {
      onInsertProse(text);
      setInsertedMsgId(msgId);
      setTimeout(() => setInsertedMsgId(null), 2500);
    }
  };

  const handleReplaceSelection = (text, msgId) => {
    if (onReplaceSelection) {
      onReplaceSelection(text);
      setInsertedMsgId(msgId);
      setTimeout(() => setInsertedMsgId(null), 2500);
    }
  };

  const handleCopyMessage = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2500);
  };

  const handleSaveToMemoryFromChat = async (text, msgId) => {
    try {
      await rememberMemory({
        category: 'lore',
        content: text.slice(0, 400),
        title: text.slice(0, 36) + '...',
        importance: 4
      });
      setRememberedMsgId(msgId);
      loadMemories();
      setTimeout(() => setRememberedMsgId(null), 2500);
    } catch (err) {
      setAiError(err.message || 'Failed to save to memory.');
    }
  };

  // Craft Story
  const handleCraftStory = async () => {
    setIsCraftingStory(true);
    setAiError(null);
    try {
      const result = await craftGuidedStory({
        genre: craftGenre,
        tone: craftTone,
        protagonist: craftProtagonist,
        premise: craftPremise,
        setting: craftSetting,
      });
      setCraftedResult(result);
    } catch (err) {
      setAiError(err?.message || 'Failed to craft story draft.');
    } finally {
      setIsCraftingStory(false);
    }
  };

  // Branching
  const handleGenerateBranches = async () => {
    if (!activeDocContent) return;
    setIsGeneratingBranches(true);
    setAiError(null);
    try {
      const branches = await generatePlotBranches(activeDocContent);
      setPlotBranches(branches);
    } catch (err) {
      setAiError(err?.message || 'Failed to generate plot branches.');
    } finally {
      setIsGeneratingBranches(false);
    }
  };

  const handleExpandBranch = async (branch) => {
    if (!activeDocContent) return;
    setIsExpandingBranch(true);
    setAiError(null);
    try {
      const prose = await expandBranchIntoProse(activeDocContent, branch);
      if (onInsertProse) onInsertProse(prose);
    } catch (err) {
      setAiError(err?.message || 'Failed to expand branch into prose.');
    } finally {
      setIsExpandingBranch(false);
    }
  };

  // Custom Memory Add
  const handleAddCustomMemory = async () => {
    if (!newMemoryText.trim()) return;
    try {
      await rememberMemory({
        category: newMemoryCat,
        content: newMemoryText.trim(),
        importance: 4
      });
      setNewMemoryText('');
      loadMemories();
    } catch (err) {
      setAiError(err.message || 'Failed to add memory.');
    }
  };

  const handleDeleteMemoryItem = async (id) => {
    await deleteMemory(id);
    loadMemories();
  };

  return (
    <div style={{
      width: '350px',
      backgroundColor: '#101424',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      fontSize: '0.74rem'
    }}>
      {/* Panel Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#00f0ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Bot size={15} color="#00f0ff" />
          <span>CO-AUTHOR STUDIO</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
          <X size={15} />
        </button>
      </div>

      {/* Model Selector Bar */}
      <div style={{ padding: '0.35rem 0.8rem', backgroundColor: '#090d16', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Cpu size={13} color="#38bdf8" />
        <select
          value={modelConfig.provider === 'auto' ? 'auto' : `${modelConfig.provider === 'ollama' || modelConfig.provider === 'lmstudio' ? 'local' : 'cloud'}:${modelConfig.provider}:${modelConfig.model}`}
          onChange={handleModelChange}
          style={{
            flex: 1,
            padding: '2px 6px',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: '4px',
            color: '#38bdf8',
            fontSize: '0.68rem',
            fontWeight: 600,
            outline: 'none'
          }}
        >
          <option value="auto">⚡ Auto Engine (Local MoE ➔ Gemini/Cloud BYOK)</option>
          {rosters.local.length > 0 && (
            <optgroup label="Local Models (Offline)">
              {rosters.local.map(m => (
                <option key={`local:${m.provider}:${m.model}`} value={`local:${m.provider}:${m.model}`}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          )}
          {rosters.cloud.length > 0 && (
            <optgroup label="Cloud Frontier (BYOK)">
              {rosters.cloud.map(p => (
                <option key={`cloud:${p.provider}:${p.model}`} value={`cloud:${p.provider}:${p.model}`}>
                  {p.label}: {p.model || 'Default'}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.25)' }}>
        {[
          { id: 'chat', label: 'Chat', icon: MessageSquare, color: '#00f0ff' },
          { id: 'craft', label: 'Craft', icon: Wand2, color: '#c084fc' },
          { id: 'branch', label: 'Branches', icon: GitFork, color: '#34d399' },
          { id: 'memories', label: `Memory (${memoriesList.length})`, icon: Brain, color: '#fbbf24' },
        ].map(t => {
          const Icon = t.icon;
          const isSel = panelTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setPanelTab(t.id)}
              style={{
                padding: '0.45rem 0.2rem',
                border: 'none',
                borderBottom: isSel ? `2px solid ${t.color}` : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isSel ? t.color : '#94a3b8',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem'
              }}
            >
              <Icon size={11} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Viewport */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {aiError && (
          <div style={{ margin: '0.6rem 0.8rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.72rem', color: '#fca5a5', lineHeight: '1.4' }}>
            {aiError}
          </div>
        )}

        {/* TAB 1: CHAT */}
        {panelTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Quick Inspiration Chips */}
            <div style={{ padding: '0.45rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.35rem', overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {[
                'Critique scene pacing & stakes',
                'Deepen atmosphere & sensory cues',
                'Sharpen dialogue friction',
                'Brainstorm sudden complication',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChatMessage(chip)}
                  style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', fontSize: '0.65rem', color: '#94a3b8', cursor: 'pointer' }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {chatMessages.map(msg => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontSize: '0.62rem', color: '#64748b', paddingLeft: isUser ? 0 : '0.2rem' }}>
                      {isUser ? 'You' : 'Co-Author AI'} • {msg.timestamp}
                    </div>

                    <div style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: '8px',
                      backgroundColor: isUser ? '#0284c7' : 'rgba(15,23,42,0.85)',
                      color: isUser ? '#ffffff' : '#e2e8f0',
                      border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}

                      {/* Action Toolbar on Assistant Messages */}
                      {!isUser && (
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleInsertAtCursor(msg.content, msg.id)}
                            style={{ padding: '0.2rem 0.45rem', backgroundColor: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            <CornerDownLeft size={10} />
                            <span>{insertedMsgId === msg.id ? 'Inserted' : 'Insert'}</span>
                          </button>

                          {selectedText && (
                            <button
                              onClick={() => handleReplaceSelection(msg.content, msg.id)}
                              style={{ padding: '0.2rem 0.45rem', backgroundColor: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#c084fc', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                            >
                              <RefreshCw size={10} />
                              <span>Replace Selection</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleCopyMessage(msg.content, msg.id)}
                            style={{ padding: '0.2rem 0.4rem', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', fontSize: '0.64rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            {copiedMsgId === msg.id ? <Check size={10} color="#34d399" /> : <Copy size={10} />}
                            <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            onClick={() => handleSaveToMemoryFromChat(msg.content, msg.id)}
                            style={{ padding: '0.2rem 0.4rem', backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.64rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            <BookmarkPlus size={10} />
                            <span>{rememberedMsgId === msg.id ? 'Saved' : 'Remember'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isChatSending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#00f0ff', padding: '0.4rem' }}>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Reasoning with narrative context...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Controls */}
            <div style={{ padding: '0.6rem 0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(2,6,23,0.9)', display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.62rem' }}>
                <button
                  onClick={() => setChatIncludeDoc(!chatIncludeDoc)}
                  style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', backgroundColor: chatIncludeDoc ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)', color: chatIncludeDoc ? '#00f0ff' : '#64748b', cursor: 'pointer' }}
                >
                  @Doc ({wordCount} words)
                </button>
                <button
                  onClick={() => setChatIncludeSelection(!chatIncludeSelection)}
                  style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', backgroundColor: selectedText && chatIncludeSelection ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', color: selectedText && chatIncludeSelection ? '#c084fc' : '#64748b', cursor: 'pointer' }}
                >
                  @Selection {selectedText ? `(${selectedText.split(/\s+/).filter(Boolean).length}w)` : '(None)'}
                </button>
                <button
                  onClick={() => setChatUseRag(!chatUseRag)}
                  style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', backgroundColor: chatUseRag ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)', color: chatUseRag ? '#fbbf24' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Brain size={10} />
                  <span>@RAG Memory</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                <textarea
                  rows={2}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Ask co-author, brainstorm plot, or draft scene... (Enter to send)"
                  style={{ flex: 1, padding: '0.45rem 0.6rem', backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: '1.4' }}
                />
                <button
                  onClick={() => handleSendChatMessage()}
                  disabled={isChatSending || !chatInput.trim()}
                  style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: isChatSending || !chatInput.trim() ? 0.4 : 1 }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CRAFT */}
        {panelTab === 'craft' && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Guided writing engine: Set narrative constraints and synthesize a full chapter manuscript draft.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.64rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>GENRE</label>
              <select value={craftGenre} onChange={e => setCraftGenre(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none' }}>
                <option value="Cyberpunk">Cyberpunk / Dystopian</option>
                <option value="Hard Sci-Fi">Hard Sci-Fi / Deep Space</option>
                <option value="Dark Fantasy">Dark Fantasy / Eldritch</option>
                <option value="Psychological Thriller">Psychological Thriller</option>
                <option value="Noir Mystery">Noir Mystery</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.64rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>TONE & CADENCE</label>
              <input value={craftTone} onChange={e => setCraftTone(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.64rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>PROTAGONIST</label>
              <input value={craftProtagonist} onChange={e => setCraftProtagonist(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.64rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>SETTING</label>
              <input value={craftSetting} onChange={e => setCraftSetting(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.64rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>CORE PREMISE & STAKES</label>
              <textarea rows={3} value={craftPremise} onChange={e => setCraftPremise(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <button onClick={handleCraftStory} disabled={isCraftingStory}
              style={{ padding: '0.55rem', backgroundColor: '#7e22ce', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Wand2 size={14} />
              <span>{isCraftingStory ? 'Synthesizing Story Draft...' : 'Craft Complete Story'}</span>
            </button>

            {craftedResult && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>{craftedResult.title}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: '1.4' }}>{craftedResult.synopsis}</div>
                <button
                  onClick={() => onCreateNewChapter && onCreateNewChapter(craftedResult.title, craftedResult.chapter1Prose)}
                  style={{ width: '100%', padding: '0.45rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                  Load as New Chapter Document
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BRANCHES */}
        {panelTab === 'branch' && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Analyze active manuscript prose and generate 3 branching narrative paths to continue the scene.
            </div>

            <button onClick={handleGenerateBranches} disabled={isGeneratingBranches}
              style={{ padding: '0.55rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <GitFork size={14} />
              <span>{isGeneratingBranches ? 'Evaluating Story Arcs...' : 'Generate 3 Story Branches'}</span>
            </button>

            {plotBranches.map(branch => (
              <div key={branch.id} style={{ padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#00f0ff' }}>{branch.title}</span>
                  <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '3px', backgroundColor: 'rgba(0,240,255,0.15)', color: '#00f0ff' }}>{branch.tag}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#cbd5e1', lineHeight: '1.4' }}>{branch.summary}</div>
                <button onClick={() => handleExpandBranch(branch)} disabled={isExpandingBranch}
                  style={{ marginTop: '0.3rem', padding: '0.35rem', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', color: '#34d399', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  <ArrowRight size={12} />
                  <span>Write & Insert Scene</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: MEMORIES */}
        {panelTab === 'memories' && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Persistent RAG Memory: Facts, character rules, and style preferences stored safely in your air-gapped Dexie database for continuous narrative coherence.
            </div>

            {/* Add Memory Box */}
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24' }}>Add Long-Term Memory</span>
                <select
                  value={newMemoryCat}
                  onChange={e => setNewMemoryCat(e.target.value)}
                  style={{ padding: '0.2rem 0.4rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.65rem' }}
                >
                  <option value="character">Character</option>
                  <option value="lore">World Lore</option>
                  <option value="style">Writing Style</option>
                  <option value="preference">Preference</option>
                  <option value="fact">Fact</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={newMemoryText}
                onChange={e => setNewMemoryText(e.target.value)}
                placeholder="e.g. Silas Vance always carries an unbooted titanium ledger..."
                style={{ width: '100%', padding: '0.4rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.72rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
              />
              <button
                onClick={handleAddCustomMemory}
                disabled={!newMemoryText.trim()}
                style={{ padding: '0.35rem 0.6rem', backgroundColor: '#d97706', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', opacity: !newMemoryText.trim() ? 0.4 : 1 }}
              >
                Commit to Memory
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {memoriesList.map(m => (
                <div key={m.id} style={{ padding: '0.6rem 0.75rem', backgroundColor: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>
                      {m.category}
                    </span>
                    <button onClick={() => handleDeleteMemoryItem(m.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#e2e8f0', lineHeight: '1.4' }}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
