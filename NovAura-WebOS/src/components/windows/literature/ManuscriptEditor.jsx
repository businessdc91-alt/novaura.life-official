import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, Quote, Heading1, Heading2, 
  Maximize2, Minimize2, Sparkles, Wand2, Type, Layout, AlignLeft, 
  AlignCenter, AlignRight, FileText, Settings, Search, Menu, X,
  Save, ChevronRight, Hash, Clock, History, Cloud, CornerDownLeft,
  PenTool, Eye
} from 'lucide-react';
import { useLiterature } from './LiteratureContext';
import { smartChat } from '../../../services/aiService';

/**
 * NovAura Manuscript Editor — Production Grade
 * Upgraded with Floating AI Toolbars, Typewriter Mode, and Goal Tracking.
 */

export default function ManuscriptEditor() {
  const { 
    activeFile, activeFileId, updateFileContent, setSelectedText, selectedText,
    settings, openTabs, openTab, closeTab, findFileById
  } = useLiterature();
  
  const editorRef = useRef(null);
  const typingTimer = useRef(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [ghostText, setGhostText] = useState('');
  const [isGhosting, setIsGhosting] = useState(false);

  // Floating Menu State
  const [selectionRect, setSelectionRect] = useState(null);
  const [isFloatingMenuVisible, setIsFloatingMenuVisible] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Word Goal State
  const WORD_GOAL = 2000;
  const wordCount = activeFile ? activeFile.content.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const goalProgress = Math.min((wordCount / WORD_GOAL) * 100, 100);

  // Sync content with the active file
  useEffect(() => {
    if (editorRef.current && activeFile) {
      if (editorRef.current.innerHTML !== activeFile.content) {
        editorRef.current.innerHTML = activeFile.content || '';
        setLastSaved(activeFile.lastModified || Date.now());
      }
    }
  }, [activeFileId]);

  const triggerGhostwriter = async (text) => {
    if (!text || text.length < 10) return;
    setIsGhosting(true);
    try {
      const words = text.split(' ').slice(-40).join(' '); // Get last 40 words
      const prompt = `You are an AI co-author. Based on the following text, write ONLY the next sentence (max 10-15 words) to continue the story smoothly. Do not use quotes or introductory text. TEXT: "${words}"`;
      const res = await smartChat(prompt, 'literature');
      if (res && res.response) {
        setGhostText(res.response.replace(/^["']|["']$/g, '').trim());
      }
    } catch (e) {
      console.log('Ghostwriter failed', e);
    }
    setIsGhosting(false);
  };

  const handleInput = useCallback(() => {
    if (editorRef.current && activeFile) {
      updateFileContent(activeFile.id, editorRef.current.innerHTML);
      setLastSaved(Date.now());
      
      // Keep Typewriter Mode Centered in Focus Mode
      if (isFocusMode) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
           const range = selection.getRangeAt(0);
           const rect = range.getBoundingClientRect();
           if (rect.top > window.innerHeight * 0.6) {
             editorRef.current.parentElement.scrollBy({ top: rect.top - window.innerHeight * 0.4, behavior: 'smooth' });
           }
        }
      }

      // Debounced Ghostwriter
      setGhostText('');
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        triggerGhostwriter(editorRef.current.innerText);
      }, 1500);
    }
  }, [activeFileId, updateFileContent, activeFile, isFocusMode]);

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && ghostText) {
      e.preventDefault();
      document.execCommand('insertText', false, ' ' + ghostText);
      setGhostText('');
    }
  };

  const handleSelect = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && sel.rangeCount > 0) {
      setSelectedText(sel.toString());
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate position relative to viewport
      setSelectionRect({
        top: rect.top,
        left: rect.left + (rect.width / 2),
      });
      setIsFloatingMenuVisible(true);
    } else {
      setSelectedText('');
      setIsFloatingMenuVisible(false);
    }
  }, [setSelectedText]);

  // Handle hiding floating menu on scroll or outside click
  useEffect(() => {
    const handleScroll = () => setIsFloatingMenuVisible(false);
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, []);

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    setIsFloatingMenuVisible(false);
  };

  const executeFloatingAIAction = async (actionType) => {
    if (!selectedText) return;
    setIsAiProcessing(true);
    try {
      let prompt = '';
      if (actionType === 'rewrite') prompt = `Rewrite the following text to make it flow better and have more emotional impact. Provide ONLY the rewritten text, no commentary: "${selectedText}"`;
      if (actionType === 'describe') prompt = `Describe the following subject in vivid, sensory detail. Provide ONLY the new description: "${selectedText}"`;
      if (actionType === 'expand') prompt = `Expand the following text with more details and depth. Provide ONLY the expanded text: "${selectedText}"`;

      const res = await smartChat(prompt, 'literature');
      if (res && res.response) {
        document.execCommand('insertText', false, res.response.trim());
      }
    } catch (e) {
      console.error('AI Action failed', e);
    }
    setIsAiProcessing(false);
    setIsFloatingMenuVisible(false);
  };

  // Calculate breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!activeFileId) return [];
    return ['Manuscript', activeFile?.name || 'Unknown'];
  }, [activeFileId, activeFile]);

  return (
    <div className={`flex-1 flex flex-col h-full bg-[#0d0d14] relative transition-all duration-500`}>
      
      {/* ─── TAB BAR ─── */}
      {!isFocusMode && (
        <div className="flex items-center bg-[#050508] border-b border-white/5 overflow-x-auto scrollbar-hide h-10 flex-shrink-0">
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => openTab(tab.id)}
              className={`group flex items-center gap-2 px-4 h-full border-r border-white/5 cursor-pointer transition-all min-w-[140px] max-w-[240px] relative shrink-0 ${
                tab.id === activeFileId 
                  ? 'bg-[#0d0d14] text-white' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
              }`}
            >
              {tab.id === activeFileId && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]" />
              )}
              <FileText className={`w-3.5 h-3.5 ${tab.id === activeFileId ? 'text-primary' : 'text-gray-600'}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider truncate flex-1">{tab.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all ml-2"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <div className="flex-1 h-full border-b border-white/5" />
        </div>
      )}

      {/* ─── TOOLBAR / BREADCRUMBS ─── */}
      {!isFocusMode && (
        <div className="h-10 flex-shrink-0 bg-[#0d0d14] border-b border-white/5 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                <span className={i === breadcrumbs.length - 1 ? 'text-gray-300' : ''}>{b}</span>
                {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3" />}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
               <button onClick={() => exec('bold')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"><Bold className="w-3.5 h-3.5" /></button>
               <button onClick={() => exec('italic')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"><Italic className="w-3.5 h-3.5" /></button>
               <div className="w-px h-3 bg-white/10 mx-1" />
               <button onClick={() => exec('formatBlock', 'h1')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all text-[10px] font-black">H1</button>
               <button onClick={() => exec('formatBlock', 'h2')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all text-[10px] font-black">H2</button>
               <button onClick={() => exec('underline')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"><Underline className="w-3.5 h-3.5" /></button>
               <button onClick={() => exec('justifyCenter')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"><AlignCenter className="w-3.5 h-3.5" /></button>
            </div>
            <button 
              onClick={() => setIsFocusMode(true)}
              className="p-1.5 text-gray-500 hover:text-primary transition-all"
              title="Enter Focus Mode"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── EDITOR SURFACE ─── */}
      <div 
        className={`flex-1 overflow-auto flex flex-col items-center transition-all duration-700 relative scrollbar-hide ${isFocusMode ? 'bg-[#050508] pt-32' : 'bg-[#0d0d14]'}`}
      >
        {isFocusMode && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
             <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
             <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
          </div>
        )}

        {!activeFile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-6 z-10">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border border-white/5 flex items-center justify-center opacity-20">
                <FileText className="w-12 h-12" />
              </div>
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Void Detected</p>
              <p className="text-[10px] opacity-40 uppercase tracking-widest">Select a frequency from the library to begin transmission.</p>
            </div>
          </div>
        ) : (
          <>
            {isFocusMode && (
              <button 
                onClick={() => setIsFocusMode(false)}
                className="fixed top-8 right-8 p-3 rounded-full bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all z-50 border border-white/10"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}

            <div 
              className={`w-full max-w-[750px] min-h-full transition-all duration-700 relative px-12 py-16 z-10 ${isFocusMode ? 'text-gray-200' : 'text-gray-300'}`}
              style={{ 
                fontFamily: settings.fontFamily || 'Inter, system-ui, sans-serif',
                fontSize: `${settings.fontSize || 18}px`,
                lineHeight: '2.2'
              }}
            >
              <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onMouseUp={handleSelect}
                onKeyUp={handleSelect}
                onKeyDown={handleKeyDown}
                className="outline-none min-h-[70vh] pb-96 selection:bg-primary/40 selection:text-white"
                spellCheck="true"
              />
              
              {/* Ghostwriter UI Layer */}
              {ghostText && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border border-primary/20 text-primary px-6 py-3 rounded-full flex items-center gap-4 shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)] animate-in fade-in slide-in-from-bottom-4">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span className="text-[14px] font-serif italic max-w-lg truncate opacity-90">"{ghostText}"</span>
                  <div className="flex items-center gap-1.5 bg-primary/20 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-primary/80">
                    <CornerDownLeft className="w-3 h-3" /> Tab to accept
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── FLOATING AI MENU ─── */}
      {isFloatingMenuVisible && selectionRect && (
        <div 
          className="fixed z-50 flex items-center gap-1 bg-[#1a1a24]/90 backdrop-blur-2xl border border-white/10 p-1.5 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: selectionRect.top - 60,
            left: selectionRect.left,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
        >
          {isAiProcessing ? (
             <div className="flex items-center gap-2 px-4 py-1 text-primary">
               <Sparkles className="w-4 h-4 animate-pulse" />
               <span className="text-[11px] font-bold uppercase tracking-widest">Muse is crafting...</span>
             </div>
          ) : (
             <>
                <button onClick={() => exec('bold')} className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"><Bold className="w-4 h-4" /></button>
                <button onClick={() => exec('italic')} className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"><Italic className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <button onClick={() => executeFloatingAIAction('rewrite')} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all uppercase tracking-wider"><PenTool className="w-3.5 h-3.5" /> Rewrite</button>
                <button onClick={() => executeFloatingAIAction('describe')} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-purple-400 hover:bg-purple-400/10 rounded-lg transition-all uppercase tracking-wider"><Eye className="w-3.5 h-3.5" /> Describe</button>
                <button onClick={() => executeFloatingAIAction('expand')} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all uppercase tracking-wider"><Wand2 className="w-3.5 h-3.5" /> Expand</button>
             </>
          )}
        </div>
      )}

      {/* ─── STATUS BAR WITH PROGRESS RING ─── */}
      {!isFocusMode && activeFile && (
        <div className="h-10 flex-shrink-0 bg-[#050508] border-t border-white/5 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {/* Goal Progress Ring & Word Count */}
            <div className="flex items-center gap-3">
              <div className="relative w-6 h-6 flex items-center justify-center" title={`Daily Goal: ${wordCount}/${WORD_GOAL} words`}>
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-white/10" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-primary transition-all duration-1000" strokeDasharray={`${goalProgress}, 100`} strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                {goalProgress >= 100 && <Sparkles className="absolute w-2.5 h-2.5 text-primary" />}
              </div>
              <div className="flex flex-col">
                <span className="text-gray-300 leading-none">{wordCount}</span>
                <span className="text-[7px] text-gray-600 leading-none mt-0.5">Words</span>
              </div>
            </div>
            
            <div className="w-px h-4 bg-white/10" />

            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-accent" />
              <span>Session: 0m</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                <Cloud className="w-3.5 h-3.5" />
                <span>Sync Active</span>
             </div>
             <div className="h-4 w-px bg-white/10" />
             <span className="text-[10px] font-mono text-gray-600">
               {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
             </span>
          </div>
        </div>
      )}
    </div>
  );
}
