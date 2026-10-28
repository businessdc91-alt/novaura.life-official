// LiteratureIDEWindow.jsx — Microsoft Word clone on a crisp white page, wrapped in a VS Code style environment
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Files, BookOpen, Sparkles, Wand2, GitFork, Settings, Play,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Undo, Redo, ZoomIn,
  ZoomOut, Maximize2, Minimize2, Save, Plus, X, Trash2, ChevronRight,
  ChevronDown, Type, Eye, Palette, CheckCircle2, AlertCircle, CornerDownLeft,
  FileText, ArrowRight, Compass, Shield, Terminal, RefreshCw, Layers,
  Code2, FileCode, MessageSquare, Send, Copy, Check, Brain, BookmarkPlus, Bot,
  History, Download, Upload, Clock, RotateCcw, Share2, BookPlus
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import {
  getManuscriptFiles, getActiveDocument, setActiveDocumentId,
  getOpenTabs, closeTab, updateDocumentContent, createManuscriptFile,
  deleteManuscriptFile, subscribeManuscriptStore, getManuscriptVersions,
  rollbackManuscriptVersion, exportManuscript, publishDocumentToMesh
} from '../../services/manuscriptStore';
import { getPeerCount, getLocalIdentity } from '../../services/sovereignMesh';
import {
  predictNextPhrase, generatePlotBranches, expandBranchIntoProse,
  craftGuidedStory, transformStyle, chatLiteratureCoAuthor
} from '../../services/literatureAiService';
import {
  getAllMemories, rememberMemory, deleteMemory
} from '../../services/sovereignRagService';

export default function LiteratureIDEWindow({ onClose }) {
  // ── Workspace State ──
  const [files, setFiles] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [openTabsList, setOpenTabsList] = useState([]);
  const [activeActivity, setActiveActivity] = useState('explorer'); // 'explorer', 'bible', 'craft', 'branch', 'settings'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);

  // ── Word Ribbon State ──
  const [ribbonTab, setRibbonTab] = useState('home'); // 'home', 'insert', 'layout', 'references', 'view'
  const [fontFamily, setFontFamily] = useState('Georgia, serif');
  const [fontSize, setFontSize] = useState('12pt');
  const [pageMargin, setPageMargin] = useState('normal'); // 'normal', 'narrow', 'wide'
  const [pageOrientation, setPageOrientation] = useState('portrait'); // 'portrait', 'landscape'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDarkCanvas, setIsDarkCanvas] = useState(false);
  const [editorMode, setEditorMode] = useState('manuscript'); // 'manuscript' (Word) | 'code' (Monaco)
  const [codeLanguage, setCodeLanguage] = useState('html');

  // ── Editor State ──
  const editorRef = useRef(null);
  const typingTimerRef = useRef(null);
  const [ghostPrediction, setGhostPrediction] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // ── AI Guided Story Craft State ──
  const [craftGenre, setCraftGenre] = useState('Cyberpunk');
  const [craftTone, setCraftTone] = useState('Gritty & Atmospheric');
  const [craftProtagonist, setCraftProtagonist] = useState('Silas Vance, an air-gapped cryptographer');
  const [craftSetting, setCraftSetting] = useState('New Aethelgard Perimeter');
  const [craftPremise, setCraftPremise] = useState('Discovering an active signal from an archive presumed destroyed forty years ago');
  const [isCraftingStory, setIsCraftingStory] = useState(false);
  const [craftedResult, setCraftedResult] = useState(null);

  // ── Plot Branching State ──
  const [plotBranches, setPlotBranches] = useState([]);
  const [isGeneratingBranches, setIsGeneratingBranches] = useState(false);
  const [isExpandingBranch, setIsExpandingBranch] = useState(false);
  const [aiError, setAiError] = useState(null);

  // ── AI Co-Author Discussion & Persistent RAG Memory State ──
  const [aiPanelTab, setAiPanelTab] = useState('chat'); // 'chat' | 'craft' | 'branch' | 'memories'
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'I am your sovereign AI co-author. I am linked directly to your active chapter manuscript and your private RAG memory vault. Ask me to critique scenes, test dialogue rhythms, outline plot twists, or draft text to insert into your document.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      usedMemories: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatUseRag, setChatUseRag] = useState(true);
  const [chatIncludeDoc, setChatIncludeDoc] = useState(true);
  const [chatIncludeSelection, setChatIncludeSelection] = useState(true);
  const [memoriesList, setMemoriesList] = useState([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCat, setNewMemoryCat] = useState('lore');
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [insertedMsgId, setInsertedMsgId] = useState(null);
  const [rememberedMsgId, setRememberedMsgId] = useState(null);
  const chatBottomRef = useRef(null);

  // ── Version History & Export/Import State ──
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionsList, setVersionsList] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const fileImportInputRef = useRef(null);

  // ── Sovereign Mesh P2P Sharing State ──
  const [isMeshShareModalOpen, setIsMeshShareModalOpen] = useState(false);
  const [meshShareNote, setMeshShareNote] = useState('');
  const [meshShareStatus, setMeshShareStatus] = useState(null);
  const [isMeshPublishing, setIsMeshPublishing] = useState(false);
  const [incomingDocAlert, setIncomingDocAlert] = useState(null);
  const [meshPeerCount, setMeshPeerCount] = useState(0);

  // Load initial workspace and subscribe to store updates
  useEffect(() => {
    refreshWorkspace();
    loadMemories();

    const updatePeerStats = () => setMeshPeerCount(getPeerCount());
    updatePeerStats();
    window.addEventListener('novaura:mesh_updated', updatePeerStats);
    window.addEventListener('novaura:peer_discovered', updatePeerStats);
    window.addEventListener('novaura:peer_lost', updatePeerStats);

    const handleIncomingLit = (e) => {
      if (e.detail) {
        setIncomingDocAlert(e.detail);
      }
    };
    window.addEventListener('novaura:literature_received', handleIncomingLit);

    const unsubscribe = subscribeManuscriptStore((state) => {
      setFiles(state.files || []);
      const active = (state.files || []).find(f => f.id === state.activeFileId) || state.files?.[0] || null;
      setActiveDoc(active);
      const open = (state.openTabs || []).map(id => state.files.find(f => f.id === id)).filter(Boolean);
      setOpenTabsList(open);
      if (active) {
        setWordCount(active.wordCount || 0);
      } else {
        setWordCount(0);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('novaura:mesh_updated', updatePeerStats);
      window.removeEventListener('novaura:peer_discovered', updatePeerStats);
      window.removeEventListener('novaura:peer_lost', updatePeerStats);
      window.removeEventListener('novaura:literature_received', handleIncomingLit);
    };
  }, []);

  const loadMemories = async () => {
    try {
      const list = await getAllMemories();
      setMemoriesList(list);
    } catch {}
  };

  const refreshWorkspace = () => {
    const allFiles = getManuscriptFiles();
    setFiles(allFiles);
    const active = getActiveDocument();
    setActiveDoc(active);
    setOpenTabsList(getOpenTabs());
    if (active) {
      setWordCount(active.wordCount || 0);
    }
  };

  const handlePublishToMesh = async () => {
    if (!activeDoc) return;
    setIsMeshPublishing(true);
    setMeshShareStatus(null);
    try {
      await publishDocumentToMesh(activeDoc.id, meshShareNote);
      setMeshShareStatus('Chapter published and broadcasted to sovereign mesh!');
      setTimeout(() => {
        setMeshShareStatus(null);
        setIsMeshShareModalOpen(false);
        setMeshShareNote('');
      }, 1800);
    } catch (err) {
      setMeshShareStatus('Error: ' + err.message);
    } finally {
      setIsMeshPublishing(false);
    }
  };

  const loadDocumentVersions = async (docId) => {
    if (!docId) return;
    setIsLoadingVersions(true);
    try {
      const list = await getManuscriptVersions(docId);
      setVersionsList(list);
    } catch (err) {
      console.warn('[LiteratureIDE] Version load error:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleRollbackVersion = async (versionId) => {
    if (!activeDoc) return;
    if (window.confirm('Restore this historical version? Your current text will be replaced.')) {
      try {
        await rollbackManuscriptVersion(activeDoc.id, versionId);
        loadDocumentVersions(activeDoc.id);
        setIsVersionModalOpen(false);
      } catch (err) {
        setAiError(err.message || 'Rollback failed.');
      }
    }
  };

  const handleExportFormat = (format) => {
    if (!activeDoc) return;
    exportManuscript(activeDoc.id, format);
    setIsExportMenuOpen(false);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const name = file.name || 'Imported Document.docx';
      let html = '';
      if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        html = content;
      } else if (file.name.endsWith('.md')) {
        // Convert Markdown paragraphs
        html = content.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
      } else {
        html = `<p>${content.replace(/\n/g, '<br/>')}</p>`;
      }
      const newDoc = createManuscriptFile(name, 'chapter', html);
      setActiveDocumentId(newDoc.id);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Sync editor content when activeDoc changes
  useEffect(() => {
    if (editorRef.current && activeDoc) {
      if (editorRef.current.innerHTML !== activeDoc.content) {
        editorRef.current.innerHTML = activeDoc.content || '';
      }
      setWordCount(activeDoc.wordCount || 0);
      setGhostPrediction('');
    }
  }, [activeDoc?.id]);

  // ── Document Input & Ghostwriter ──
  const handleEditorInput = useCallback(() => {
    if (!editorRef.current || !activeDoc) return;
    const content = editorRef.current.innerHTML;
    updateDocumentContent(activeDoc.id, content);
    
    const plain = editorRef.current.innerText || '';
    const words = plain.trim() ? plain.trim().split(/\s+/).filter(Boolean).length : 0;
    setWordCount(words);

    // Debounced ghostwriter prediction
    setGhostPrediction('');
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      setIsPredicting(true);
      const prediction = await predictNextPhrase(plain);
      if (prediction) {
        setGhostPrediction(prediction);
      }
      setIsPredicting(false);
    }, 1200);
  }, [activeDoc]);

  // Handle Tab key to accept ghostwriter prediction
  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab' && ghostPrediction) {
      e.preventDefault();
      document.execCommand('insertText', false, ' ' + ghostPrediction);
      setGhostPrediction('');
      handleEditorInput();
    }
  };

  // Selection detection for floating toolbar
  const handleEditorSelect = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && sel.rangeCount > 0) {
      setSelectedText(sel.toString().trim());
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPosition({
        top: rect.top - 48,
        left: rect.left + rect.width / 2,
      });
    } else {
      setSelectedText('');
      setSelectionPosition(null);
    }
  };

  // Word formatting command
  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  };

  // ── File Management ──
  const handleSelectFile = (id) => {
    setActiveDocumentId(id);
    refreshWorkspace();
  };

  const handleCloseTab = (id, e) => {
    e.stopPropagation();
    closeTab(id);
    refreshWorkspace();
  };

  const handleCreateNewChapter = () => {
    const num = files.filter(f => f.type === 'chapter').length + 1;
    const newDoc = createManuscriptFile(`Chapter ${num} - Untitled`, 'chapter', `<h1>Chapter ${num}: Untitled</h1><p>Begin writing the chapter here...</p>`);
    refreshWorkspace();
    setActiveDocumentId(newDoc.id);
  };

  const handleCreateNewNote = () => {
    const newDoc = createManuscriptFile(`Lore Note ${Date.now().toString(36).substring(3)}`, 'bible', `<h2>New Lore Dossier</h2><p>Record worldbuilding or character details here...</p>`);
    refreshWorkspace();
    setActiveDocumentId(newDoc.id);
  };

  const handleDeleteFile = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this manuscript file?')) {
      deleteManuscriptFile(id);
      refreshWorkspace();
    }
  };

  // ── AI Guided Story Crafting ──
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

  const handleInsertCraftedStory = () => {
    if (!craftedResult) return;
    const newDoc = createManuscriptFile(craftedResult.title, 'chapter', craftedResult.chapter1Prose);
    refreshWorkspace();
    setActiveDocumentId(newDoc.id);
  };

  // ── Plot Branching ──
  const handleGenerateBranches = async () => {
    if (!editorRef.current) return;
    setIsGeneratingBranches(true);
    setAiError(null);
    try {
      const branches = await generatePlotBranches(editorRef.current.innerText);
      setPlotBranches(branches);
    } catch (err) {
      setAiError(err?.message || 'Failed to generate plot branches.');
    } finally {
      setIsGeneratingBranches(false);
    }
  };

  const handleExpandBranch = async (branch) => {
    if (!editorRef.current) return;
    setIsExpandingBranch(true);
    setAiError(null);
    try {
      const prose = await expandBranchIntoProse(editorRef.current.innerText, branch);
      // Insert at end of document
      editorRef.current.innerHTML += `<br/>` + prose;
      handleEditorInput();
    } catch (err) {
      setAiError(err?.message || 'Failed to expand branch into prose.');
    } finally {
      setIsExpandingBranch(false);
    }
  };

  // ── In-place Transformation ──
  const handleTransformSelection = async (mode) => {
    if (!selectedText) return;
    setIsTransforming(true);
    setAiError(null);
    try {
      const transformed = await transformStyle(selectedText, mode);
      document.execCommand('insertText', false, transformed);
      handleEditorInput();
      setSelectedText('');
      setSelectionPosition(null);
    } catch (err) {
      setAiError(err?.message || 'Failed to transform selection style.');
    } finally {
      setIsTransforming(false);
    }
  };

  // ── Co-Author Chat & RAG Handlers ──
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

    const docText = chatIncludeDoc && editorRef.current ? editorRef.current.innerText : '';
    const selText = chatIncludeSelection ? selectedText : '';

    try {
      const result = await chatLiteratureCoAuthor({
        messages: [...chatMessages, userMsg],
        documentContext: docText,
        selectionContext: selText,
        activeDocName: activeDoc?.name || 'Manuscript',
        useRag: chatUseRag,
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
    if (editorRef.current) {
      editorRef.current.focus();
      const html = text.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
      document.execCommand('insertHTML', false, html);
      handleEditorInput();
      setInsertedMsgId(msgId);
      setTimeout(() => setInsertedMsgId(null), 2500);
    }
  };

  const handleReplaceSelectionWithText = (text, msgId) => {
    if (editorRef.current && selectedText) {
      editorRef.current.focus();
      document.execCommand('insertText', false, text);
      handleEditorInput();
      setSelectedText('');
      setSelectionPosition(null);
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
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#181824', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>

      {/* ── 1. VS CODE ACTIVITY BAR (Far Left, 48px) ── */}
      <div style={{ width: '48px', backgroundColor: '#0d0d16', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.6rem 0', gap: '0.6rem', flexShrink: 0, zIndex: 30 }}>
        <button onClick={() => { setActiveActivity('explorer'); setIsSidebarOpen(true); }} title="Manuscript Explorer (Chapters & Files)"
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: activeActivity === 'explorer' && isSidebarOpen ? 'rgba(0,240,255,0.15)' : 'none', color: activeActivity === 'explorer' && isSidebarOpen ? '#00f0ff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Files size={19} />
        </button>

        <button onClick={() => { setActiveActivity('bible'); setIsSidebarOpen(true); }} title="Story Bible & World Lore"
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: activeActivity === 'bible' && isSidebarOpen ? 'rgba(0,240,255,0.15)' : 'none', color: activeActivity === 'bible' && isSidebarOpen ? '#00f0ff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <BookOpen size={19} />
        </button>

        <button onClick={() => { setAiPanelTab('chat'); setIsAiPanelOpen(true); }} title="Co-Author AI Chat & Discussion"
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: aiPanelTab === 'chat' && isAiPanelOpen ? 'rgba(0,240,255,0.2)' : 'none', color: aiPanelTab === 'chat' && isAiPanelOpen ? '#00f0ff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <MessageSquare size={19} />
        </button>

        <button onClick={() => { setAiPanelTab('craft'); setIsAiPanelOpen(true); }} title="Guided Story Studio (Craft Complete Story)"
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: aiPanelTab === 'craft' && isAiPanelOpen ? 'rgba(168,85,247,0.2)' : 'none', color: aiPanelTab === 'craft' && isAiPanelOpen ? '#c084fc' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Wand2 size={19} />
        </button>

        <button onClick={() => { setAiPanelTab('branch'); setIsAiPanelOpen(true); }} title="Plot Branching & Continue Story"
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: aiPanelTab === 'branch' && isAiPanelOpen ? 'rgba(16,185,129,0.2)' : 'none', color: aiPanelTab === 'branch' && isAiPanelOpen ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <GitFork size={19} />
        </button>

        <button onClick={() => { setAiPanelTab('memories'); setIsAiPanelOpen(true); }} title="Sovereign RAG Memory Vault"
          style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: aiPanelTab === 'memories' && isAiPanelOpen ? 'rgba(168,85,247,0.2)' : 'none', color: aiPanelTab === 'memories' && isAiPanelOpen ? '#c084fc' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Brain size={19} />
        </button>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Primary Sidebar"
            style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', background: 'none', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Layers size={18} />
          </button>
        </div>
      </div>

      {/* ── 2. VS CODE PRIMARY SIDEBAR (Collapsible, 230px) ── */}
      {isSidebarOpen && (
        <div style={{ width: '230px', backgroundColor: '#12121e', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
            <span>{activeActivity === 'bible' ? 'Story Bible' : 'Manuscript Files'}</span>
            <div style={{ display: 'flex', gap: '0.2rem' }}>
              <button onClick={handleCreateNewChapter} title="Add Chapter" style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer', padding: '2px' }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* File Tree List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
            <div style={{ padding: '0.3rem 0.8rem', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              {activeActivity === 'bible' ? 'Lore & Characters' : 'Chapters'}
            </div>

            {files.filter(f => activeActivity === 'bible' ? f.type === 'bible' : f.type === 'chapter').length === 0 && (
              <div style={{ padding: '1.5rem 0.8rem', textAlign: 'center', color: '#64748b', fontSize: '0.74rem' }}>
                <BookOpen size={20} style={{ margin: '0 auto 0.4rem', opacity: 0.4 }} />
                <p style={{ margin: '0 0 0.6rem' }}>{activeActivity === 'bible' ? 'No lore notes yet' : 'No chapters yet'}</p>
                <button
                  onClick={activeActivity === 'bible' ? handleCreateNewNote : handleCreateNewChapter}
                  style={{ padding: '0.3rem 0.6rem', backgroundColor: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  {activeActivity === 'bible' ? '+ New Lore Note' : '+ New Chapter'}
                </button>
              </div>
            )}

            {files
              .filter(f => activeActivity === 'bible' ? f.type === 'bible' : f.type === 'chapter')
              .map(file => {
                const isActive = activeDoc?.id === file.id;
                return (
                  <div key={file.id} onClick={() => handleSelectFile(file.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.8rem', cursor: 'pointer', backgroundColor: isActive ? 'rgba(0,240,255,0.1)' : 'transparent', borderLeft: isActive ? '2px solid #00f0ff' : '2px solid transparent', color: isActive ? '#00f0ff' : '#cbd5e1', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                      <FileText size={14} color={isActive ? '#00f0ff' : '#64748b'} style={{ flexShrink: 0 }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{file.wordCount}w</span>
                      <button onClick={(e) => handleDeleteFile(file.id, e)} title="Delete file" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* Quick Actions Footer inside Sidebar */}
            <div style={{ padding: '0.8rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={handleCreateNewChapter} style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                <Plus size={12} />
                <span>New Chapter</span>
              </button>
              <button onClick={handleCreateNewNote} style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '4px', color: '#c084fc', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                <BookOpen size={12} />
                <span>New Lore / Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. CENTER AREA (Word Ribbon + White Page Canvas) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        
        {/* VS Code Editor Tabs Bar */}
        <div style={{ height: '35px', backgroundColor: '#0f0f18', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', overflowX: 'auto', flexShrink: 0 }}>
          {openTabsList.map(tab => {
            const isActive = activeDoc?.id === tab.id;
            return (
              <div key={tab.id} onClick={() => handleSelectFile(tab.id)}
                style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.85rem', cursor: 'pointer', backgroundColor: isActive ? '#1e1e2d' : 'transparent', borderTop: isActive ? '2px solid #00f0ff' : '2px solid transparent', borderRight: '1px solid rgba(255,255,255,0.05)', color: isActive ? '#f8fafc' : '#94a3b8', fontSize: '0.76rem', minWidth: '130px', maxWidth: '210px' }}>
                <FileText size={13} color={isActive ? '#00f0ff' : '#64748b'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{tab.name}</span>
                <button onClick={(e) => handleCloseTab(tab.id, e)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── MICROSOFT WORD RIBBON MENU ── */}
        <div style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderBottom: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>
          
          {/* Ribbon Tabs Header (Home / Insert / Layout / View) */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', height: '30px', backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1', fontSize: '0.76rem', fontWeight: 600 }}>
            <span style={{ color: '#0284c7', fontWeight: 800, marginRight: '0.75rem', letterSpacing: '0.04em' }}>WORD</span>
            {[
              { id: 'home', label: 'Home' },
              { id: 'insert', label: 'Insert' },
              { id: 'layout', label: 'Layout' },
              { id: 'view', label: 'View' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setRibbonTab(tab.id)}
                style={{ padding: '0 0.75rem', height: '100%', border: 'none', background: ribbonTab === tab.id ? '#f1f5f9' : 'transparent', color: ribbonTab === tab.id ? '#0284c7' : '#475569', fontWeight: ribbonTab === tab.id ? 700 : 500, cursor: 'pointer', borderTop: ribbonTab === tab.id ? '2px solid #0284c7' : '2px solid transparent' }}>
                {tab.label}
              </button>
            ))}

            <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#cbd5e1', padding: '2px', borderRadius: '4px' }}>
              <button
                onClick={() => {
                  setEditorMode('manuscript');
                  if (editorRef.current && activeDoc) {
                    editorRef.current.innerHTML = activeDoc.content || '';
                  }
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: '3px',
                  border: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: editorMode === 'manuscript' ? '#ffffff' : 'transparent',
                  color: editorMode === 'manuscript' ? '#0284c7' : '#64748b',
                  boxShadow: editorMode === 'manuscript' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FileText size={12} />
                <span>Manuscript</span>
              </button>
              <button
                onClick={() => {
                  if (editorRef.current && activeDoc) {
                    const html = editorRef.current.innerHTML;
                    updateDocumentContent(activeDoc.id, html);
                  }
                  setEditorMode('code');
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: '3px',
                  border: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: editorMode === 'code' ? '#ffffff' : 'transparent',
                  color: editorMode === 'code' ? '#7e22ce' : '#64748b',
                  boxShadow: editorMode === 'code' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Code2 size={12} />
                <span>Monaco Code</span>
              </button>
            </div>

            {editorMode === 'code' && (
              <select
                value={codeLanguage}
                onChange={e => setCodeLanguage(e.target.value)}
                style={{
                  marginLeft: '0.5rem',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.7rem',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  color: '#334155'
                }}
              >
                <option value="html">HTML Structure</option>
                <option value="markdown">Markdown / Prose</option>
                <option value="json">JSON Lore / Bible</option>
                <option value="javascript">JavaScript Scripting</option>
                <option value="plaintext">Plain Script / Fountain</option>
              </select>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
              <input
                type="file"
                ref={fileImportInputRef}
                onChange={handleImportFile}
                style={{ display: 'none' }}
                accept=".txt,.md,.html,.htm,.docx"
              />

              <button
                onClick={() => fileImportInputRef.current?.click()}
                title="Import Local File into Manuscript Studio"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Upload size={12} />
                <span>Import</span>
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  disabled={!activeDoc}
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  title="Export Manuscript"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: activeDoc ? '#475569' : '#94a3b8',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: activeDoc ? 'pointer' : 'not-allowed',
                    opacity: activeDoc ? 1 : 0.5
                  }}
                >
                  <Download size={12} />
                  <span>Export</span>
                </button>

                {isExportMenuOpen && activeDoc && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                    padding: '4px',
                    zIndex: 100,
                    minWidth: '130px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <button
                      onClick={() => handleExportFormat('html')}
                      style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Export HTML (.html)
                    </button>
                    <button
                      onClick={() => handleExportFormat('markdown')}
                      style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Export Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleExportFormat('txt')}
                      style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Export Plain Text (.txt)
                    </button>
                    <button
                      onClick={() => handleExportFormat('json')}
                      style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Export Document JSON
                    </button>
                  </div>
                )}
              </div>

              <button
                disabled={!activeDoc}
                onClick={() => {
                  if (activeDoc) {
                    loadDocumentVersions(activeDoc.id);
                    setIsVersionModalOpen(true);
                  }
                }}
                title="View Local Version History & Rolling Snapshots"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: activeDoc ? '#0284c7' : '#94a3b8',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: activeDoc ? 'pointer' : 'not-allowed',
                  opacity: activeDoc ? 1 : 0.5
                }}
              >
                <History size={12} />
                <span>Revisions</span>
              </button>

              <button
                disabled={!activeDoc}
                onClick={() => {
                  if (activeDoc) {
                    setIsMeshShareModalOpen(true);
                  }
                }}
                title="Publish / Broadcast Chapter to Physical Sovereign Mesh"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: activeDoc ? '#16a34a' : '#94a3b8',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: activeDoc ? 'pointer' : 'not-allowed',
                  opacity: activeDoc ? 1 : 0.5
                }}
              >
                <Share2 size={12} />
                <span>Mesh Share</span>
                {meshPeerCount > 0 && (
                  <span style={{ fontSize: '0.62rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '10px', fontWeight: 700 }}>
                    {meshPeerCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: 'encyclopedia' }))}
                title="Open Aura Codex / Wikipedia Reference Library"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(6,182,212,0.3)',
                  backgroundColor: 'rgba(6,182,212,0.1)',
                  color: '#0891b2',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <BookOpen size={13} />
                <span>Aura Codex</span>
              </button>

              <button onClick={() => setIsAiPanelOpen(!isAiPanelOpen)} title="Toggle AI Ghostwriter Studio"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(168,85,247,0.3)', backgroundColor: isAiPanelOpen ? 'rgba(168,85,247,0.15)' : 'transparent', color: '#7e22ce', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                <Sparkles size={13} />
                <span>AI Co-Author</span>
              </button>
              {onClose && (
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Ribbon Toolbar Content (Based on Active Tab) */}
          <div style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minHeight: '44px' }}>
            
            {ribbonTab === 'home' && (
              <>
                {/* Font Selector */}
                <select value={fontFamily} onChange={e => { setFontFamily(e.target.value); exec('fontName', e.target.value); }}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.76rem', outline: 'none', backgroundColor: '#fff', color: '#1e293b' }}>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="Calibri, sans-serif">Calibri</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="'Courier Prime', monospace">Courier Prime</option>
                  <option value="Garamond, serif">Garamond</option>
                </select>

                {/* Font Size */}
                <select value={fontSize} onChange={e => { setFontSize(e.target.value); exec('fontSize', e.target.value === '18pt' ? '5' : e.target.value === '14pt' ? '4' : '3'); }}
                  style={{ padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.76rem', outline: 'none', backgroundColor: '#fff', color: '#1e293b' }}>
                  <option value="11pt">11</option>
                  <option value="12pt">12</option>
                  <option value="14pt">14</option>
                  <option value="16pt">16</option>
                  <option value="18pt">18</option>
                  <option value="24pt">24</option>
                </select>

                <div style={{ width: '1px', height: '22px', backgroundColor: '#cbd5e1' }} />

                {/* Formatting Buttons */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => exec('bold')} title="Bold (Ctrl+B)" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><Bold size={15} /></button>
                  <button onClick={() => exec('italic')} title="Italic (Ctrl+I)" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><Italic size={15} /></button>
                  <button onClick={() => exec('underline')} title="Underline (Ctrl+U)" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><Underline size={15} /></button>
                  <button onClick={() => exec('strikeThrough')} title="Strikethrough" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><Strikethrough size={15} /></button>
                </div>

                <div style={{ width: '1px', height: '22px', backgroundColor: '#cbd5e1' }} />

                {/* Alignment */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => exec('justifyLeft')} title="Align Left" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><AlignLeft size={15} /></button>
                  <button onClick={() => exec('justifyCenter')} title="Center" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><AlignCenter size={15} /></button>
                  <button onClick={() => exec('justifyRight')} title="Align Right" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><AlignRight size={15} /></button>
                  <button onClick={() => exec('justifyFull')} title="Justify" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><AlignJustify size={15} /></button>
                </div>

                <div style={{ width: '1px', height: '22px', backgroundColor: '#cbd5e1' }} />

                {/* Lists & Headings */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => exec('insertUnorderedList')} title="Bulleted List" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><List size={15} /></button>
                  <button onClick={() => exec('insertOrderedList')} title="Numbered List" style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', borderRadius: '3px', cursor: 'pointer', color: '#334155' }}><ListOrdered size={15} /></button>
                  <button onClick={() => exec('formatBlock', 'h1')} style={{ padding: '2px 6px', borderRadius: '3px', border: '1px solid #cbd5e1', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#fff', cursor: 'pointer' }}>H1</button>
                  <button onClick={() => exec('formatBlock', 'h2')} style={{ padding: '2px 6px', borderRadius: '3px', border: '1px solid #cbd5e1', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#fff', cursor: 'pointer' }}>H2</button>
                  <button onClick={() => exec('formatBlock', 'p')} style={{ padding: '2px 6px', borderRadius: '3px', border: '1px solid #cbd5e1', fontSize: '0.72rem', backgroundColor: '#fff', cursor: 'pointer' }}>Normal</button>
                </div>

                <div style={{ width: '1px', height: '22px', backgroundColor: '#cbd5e1' }} />

                {/* Undo / Redo */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => exec('undo')} title="Undo" style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><Undo size={14} /></button>
                  <button onClick={() => exec('redo')} title="Redo" style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><Redo size={14} /></button>
                </div>
              </>
            )}

            {ribbonTab === 'insert' && (
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button onClick={() => exec('insertHorizontalRule')} style={{ padding: '0.25rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.74rem', cursor: 'pointer' }}>Horizontal Rule</button>
                <button onClick={() => exec('insertHTML', '<hr style="page-break-after: always;"/>')} style={{ padding: '0.25rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.74rem', cursor: 'pointer' }}>Page Break</button>
                <button onClick={() => exec('insertText', '—')} style={{ padding: '0.25rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.74rem', cursor: 'pointer' }}>Em Dash (—)</button>
                <button onClick={() => exec('formatBlock', 'blockquote')} style={{ padding: '0.25rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.74rem', cursor: 'pointer' }}>Quote Block</button>
              </div>
            )}

            {ribbonTab === 'layout' && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.76rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Margins:</span>
                  <select value={pageMargin} onChange={e => setPageMargin(e.target.value)} style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}>
                    <option value="normal">Normal (1.0 in)</option>
                    <option value="narrow">Narrow (0.5 in)</option>
                    <option value="wide">Wide (1.5 in)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Orientation:</span>
                  <select value={pageOrientation} onChange={e => setPageOrientation(e.target.value)} style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            )}

            {ribbonTab === 'view' && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.76rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Zoom:</span>
                  <button onClick={() => setZoomLevel(Math.max(70, zoomLevel - 15))} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fff' }}>-</button>
                  <span style={{ fontWeight: 600 }}>{zoomLevel}%</span>
                  <button onClick={() => setZoomLevel(Math.min(150, zoomLevel + 15))} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fff' }}>+</button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isDarkCanvas} onChange={e => setIsDarkCanvas(e.target.checked)} />
                  <span>Dark Canvas Mode</span>
                </label>
              </div>
            )}

          </div>
        </div>

        {/* ── 4. MAIN EDITING CANVAS: MONACO CODE OR WORD DOCUMENT ── */}
        {editorMode === 'code' ? (
          <div style={{ flex: 1, backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: '32px', backgroundColor: '#090d16', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={13} color="#c084fc" />
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>Literature Code & Script Editor</span>
                <span style={{ color: '#64748b' }}>({codeLanguage.toUpperCase()})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.68rem', color: '#38bdf8' }}>Synchronized with Manuscript Database</span>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                height="100%"
                theme="vs-dark"
                path={activeDoc ? `${activeDoc.id}.${codeLanguage === 'html' ? 'html' : codeLanguage === 'markdown' ? 'md' : codeLanguage === 'json' ? 'json' : 'txt'}` : 'literature.txt'}
                language={codeLanguage}
                value={activeDoc?.content || ''}
                onChange={(val) => {
                  if (activeDoc) {
                    updateDocumentContent(activeDoc.id, val || '');
                    const plain = (val || '').replace(/<[^>]+>/g, ' ').trim();
                    setWordCount(plain ? plain.split(/\s+/).filter(Boolean).length : 0);
                  }
                }}
                options={{
                  minimap: { enabled: true },
                  fontSize: 13,
                  fontFamily: 'Fira Code, Consolas, monospace',
                  lineNumbers: 'on',
                  smoothScrolling: true,
                  automaticLayout: true,
                  wordWrap: 'on',
                }}
              />
            </div>
          </div>
        ) : (
          /* ── THE MICROSOFT WORD CANVAS (White Page in the Middle) ── */
          <div style={{ flex: 1, backgroundColor: isDarkCanvas ? '#090d16' : '#cbd5e1', overflowY: 'auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            
            {incomingDocAlert && (
              <div style={{
                width: '100%',
                maxWidth: '816px',
                marginBottom: '1rem',
                padding: '0.6rem 1rem',
                backgroundColor: '#090d16',
                border: '1px solid #10b981',
                borderRadius: '8px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#f8fafc',
                fontSize: '0.78rem',
                zIndex: 40
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Share2 size={16} color="#10b981" />
                  <div>
                    <span style={{ fontWeight: 700, color: '#34d399' }}>Received from Sovereign Peer:</span>{' '}
                    <span>{incomingDocAlert.name}</span>{' '}
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>by {incomingDocAlert.author}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => {
                      handleSelectFile(incomingDocAlert.id);
                      setIncomingDocAlert(null);
                    }}
                    style={{
                      padding: '3px 10px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      borderRadius: '4px',
                      color: '#34d399',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Open in Editor
                  </button>
                  <button
                    onClick={() => setIncomingDocAlert(null)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {!activeDoc ? (
              <div style={{
                width: '100%',
                maxWidth: '720px',
                margin: 'auto',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(0,240,255,0.2)',
                borderRadius: '12px',
                padding: '3rem 2.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                color: '#e2e8f0',
              }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '14px', backgroundColor: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: '#00f0ff' }}>
                  <BookOpen size={30} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Literature Sovereign Studio
                </h2>
                <p style={{ fontSize: '0.86rem', color: '#94a3b8', maxWidth: '500px', lineHeight: '1.6', margin: '0 0 2rem' }}>
                  Air-gapped, local-first word processor and manuscript studio. Your chapters, lore, and revisions persist directly in your private database with zero telemetry.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', width: '100%', maxWidth: '620px' }}>
                  <button onClick={handleCreateNewChapter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.2rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: '8px', color: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(0,240,255,0.15)', color: '#00f0ff' }}>
                      <Plus size={20} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Create New Chapter</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Start writing in clean WYSIWYG</span>
                  </button>

                  <button onClick={handleCreateNewNote} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.2rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '8px', color: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
                      <BookPlus size={20} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Story Bible & Lore</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Character dossiers & worldbuilding</span>
                  </button>

                  <button onClick={() => fileImportInputRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.2rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', color: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                      <Upload size={20} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Import Existing File</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Load .docx, .md, .html, or .txt</span>
                  </button>
                </div>
              </div>
            ) : (
            /* Word Document Sheet (8.5 x 11 in Aspect Ratio) */
            <div style={{
              width: pageOrientation === 'landscape' ? '1050px' : '820px',
              minHeight: '1060px',
              backgroundColor: isDarkCanvas ? '#111827' : '#ffffff',
              color: isDarkCanvas ? '#f1f5f9' : '#1e293b',
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
              borderRadius: '2px',
              padding: pageMargin === 'narrow' ? '2.5rem' : pageMargin === 'wide' ? '4.5rem' : '3.5rem 3.8rem',
              fontFamily: fontFamily,
              fontSize: fontSize,
              lineHeight: '1.85',
              position: 'relative',
              boxSizing: 'border-box',
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
            }}>

              {/* Editable Manuscript Surface */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onMouseUp={handleEditorSelect}
                onKeyUp={handleEditorSelect}
                spellCheck="true"
                style={{
                  outline: 'none',
                  minHeight: '800px',
                  wordBreak: 'break-word',
                }}
              />

              {/* Ghostwriter Inline Suggestion Pill */}
              {ghostPrediction && (
                <div style={{ position: 'sticky', bottom: '20px', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 40, pointerEvents: 'none' }}>
                  <div style={{ pointerEvents: 'auto', backgroundColor: 'rgba(15,23,42,0.92)', color: '#00f0ff', padding: '0.5rem 1rem', borderRadius: '24px', border: '1px solid rgba(0,240,255,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: '90%' }}>
                    <Sparkles size={15} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.84rem', fontStyle: 'italic', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{ghostPrediction}"
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(0,240,255,0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, color: '#00f0ff', letterSpacing: '0.04em' }}>
                      <CornerDownLeft size={11} /> TAB TO ACCEPT
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Selection AI Toolbar */}
              {selectedText && selectionPosition && (
                <div style={{ position: 'fixed', top: `${selectionPosition.top}px`, left: `${selectionPosition.left}px`, transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: '#0f172a', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '8px', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
                  {isTransforming ? (
                    <span style={{ fontSize: '0.74rem', color: '#00f0ff' }}>AI Refining...</span>
                  ) : (
                    <>
                      <button onClick={() => handleTransformSelection('show_dont_tell')} title="Transform abstract claims into sensory actions"
                        style={{ padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px', backgroundColor: 'rgba(0,240,255,0.15)', color: '#00f0ff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                        Show, Don't Tell
                      </button>
                      <button onClick={() => handleTransformSelection('intensify_conflict')} title="Increase stakes and tension"
                        style={{ padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px', backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                        Intensify
                      </button>
                      <button onClick={() => handleTransformSelection('dialogue_punch')} title="Sharpen dialogue"
                        style={{ padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                        Punch Dialogue
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
            )}
          </div>
        )}

        {/* ── VS CODE STATUS BAR (Bottom, 26px) ── */}
        <div style={{ height: '26px', backgroundColor: '#007acc', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.8rem', fontSize: '0.72rem', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Page 1 of 1</span>
            <span>{wordCount} words</span>
            <span>{activeDoc?.name || 'Untitled'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>
              {editorMode === 'code' ? `Monaco (${codeLanguage.toUpperCase()})` : 'Word WYSIWYG'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Sparkles size={12} />
              <span>Ghostwriter: Active</span>
            </span>
            <span>UTF-8</span>
            <span>{zoomLevel}%</span>
          </div>
        </div>

      </div>

      {/* ── 4. VS CODE SECONDARY AI CO-AUTHOR PANEL (Right, 350px) ── */}
      {isAiPanelOpen && (
        <div style={{ width: '350px', backgroundColor: '#101424', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          
          {/* Panel Header */}
          <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.74rem', fontWeight: 700, color: '#00f0ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Bot size={15} color="#00f0ff" />
              <span>AI CO-AUTHOR STUDIO</span>
              <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(0,240,255,0.1)', color: '#00f0ff', fontWeight: 600 }}>RAG ACTIVE</span>
            </div>
            <button onClick={() => setIsAiPanelOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>

          {/* Panel Modes Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.25)' }}>
            <button onClick={() => setAiPanelTab('chat')}
              style={{ padding: '0.45rem 0.2rem', border: 'none', borderBottom: aiPanelTab === 'chat' ? '2px solid #00f0ff' : '2px solid transparent', backgroundColor: 'transparent', color: aiPanelTab === 'chat' ? '#00f0ff' : '#94a3b8', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <MessageSquare size={12} />
              <span>Chat</span>
            </button>
            <button onClick={() => setAiPanelTab('craft')}
              style={{ padding: '0.45rem 0.2rem', border: 'none', borderBottom: aiPanelTab === 'craft' ? '2px solid #c084fc' : '2px solid transparent', backgroundColor: 'transparent', color: aiPanelTab === 'craft' ? '#c084fc' : '#94a3b8', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <Wand2 size={12} />
              <span>Craft</span>
            </button>
            <button onClick={() => setAiPanelTab('branch')}
              style={{ padding: '0.45rem 0.2rem', border: 'none', borderBottom: aiPanelTab === 'branch' ? '2px solid #34d399' : '2px solid transparent', backgroundColor: 'transparent', color: aiPanelTab === 'branch' ? '#34d399' : '#94a3b8', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <GitFork size={12} />
              <span>Branches</span>
            </button>
            <button onClick={() => setAiPanelTab('memories')}
              style={{ padding: '0.45rem 0.2rem', border: 'none', borderBottom: aiPanelTab === 'memories' ? '2px solid #fbbf24' : '2px solid transparent', backgroundColor: 'transparent', color: aiPanelTab === 'memories' ? '#fbbf24' : '#94a3b8', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <Brain size={12} />
              <span>Memory ({memoriesList.length})</span>
            </button>
          </div>

          {/* Panel Content Viewport */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {aiError && (
              <div style={{ margin: '0.6rem 0.8rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.72rem', color: '#fca5a5', lineHeight: '1.4' }}>
                {aiError}
              </div>
            )}

            {/* TAB 1: CO-AUTHOR CHAT & DISCUSSION (VS Code Copilot / Cursor Style) */}
            {aiPanelTab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Quick Inspiration Chips */}
                <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.35rem', overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {[
                    'Critique scene pacing & stakes',
                    'Deepen atmosphere & sensory cues',
                    'Sharpen dialogue friction',
                    'Brainstorm sudden complication',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChatMessage(chip)}
                      style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', fontSize: '0.65rem', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#00f0ff'; e.currentTarget.style.borderColor = '#00f0ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)'; }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Messages Stream */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {chatMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '92%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.62rem', color: '#64748b', paddingLeft: isUser ? '0' : '0.2rem' }}>
                          <span>{isUser ? 'You' : 'Co-Author AI'}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          style={{
                            padding: '0.65rem 0.8rem',
                            borderRadius: '8px',
                            backgroundColor: isUser ? '#0284c7' : 'rgba(15,23,42,0.85)',
                            color: isUser ? '#ffffff' : '#e2e8f0',
                            border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.74rem',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                          {/* Used Memories Indicator */}
                          {!isUser && msg.usedMemories && msg.usedMemories.length > 0 && (
                            <div style={{ marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.6rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Brain size={10} /> RAG Memory Grounded:
                              </span>
                              {msg.usedMemories.map((m) => (
                                <span key={m.id} style={{ fontSize: '0.58rem', padding: '1px 4px', backgroundColor: 'rgba(251,191,36,0.1)', color: '#fde68a', borderRadius: '3px' }}>
                                  {m.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Toolbar on Assistant Messages */}
                          {!isUser && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleInsertAtCursor(msg.content, msg.id)}
                                title="Insert directly into document at current cursor position"
                                style={{ padding: '0.2rem 0.45rem', backgroundColor: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                {insertedMsgId === msg.id ? <Check size={10} /> : <CornerDownLeft size={10} />}
                                <span>{insertedMsgId === msg.id ? 'Inserted!' : 'Insert in Doc'}</span>
                              </button>

                              {selectedText && (
                                <button
                                  onClick={() => handleReplaceSelectionWithText(msg.content, msg.id)}
                                  title="Replace highlighted editor text with this output"
                                  style={{ padding: '0.2rem 0.45rem', backgroundColor: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#c084fc', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <RefreshCw size={10} />
                                  <span>Replace Selection</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                                title="Copy to clipboard"
                                style={{ padding: '0.2rem 0.4rem', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', fontSize: '0.64rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                {copiedMsgId === msg.id ? <Check size={10} color="#34d399" /> : <Copy size={10} />}
                                <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                              </button>

                              <button
                                onClick={() => handleSaveToMemoryFromChat(msg.content, msg.id)}
                                title="Save this fact/rule into Sovereign RAG memory for permanent continuity"
                                style={{ padding: '0.2rem 0.4rem', backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.64rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                {rememberedMsgId === msg.id ? <Check size={10} /> : <BookmarkPlus size={10} />}
                                <span>{rememberedMsgId === msg.id ? 'Saved to Memory' : 'Remember'}</span>
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
                      <span>Co-author reasoning with RAG memory...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Bottom Context Pills & Input */}
                <div style={{ padding: '0.6rem 0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(2,6,23,0.9)', display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                  {/* Context Attachment Toggles */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.62rem' }}>
                    <button
                      onClick={() => setChatIncludeDoc(!chatIncludeDoc)}
                      style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', backgroundColor: chatIncludeDoc ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)', color: chatIncludeDoc ? '#00f0ff' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <span>@Doc ({wordCount} words)</span>
                    </button>

                    <button
                      onClick={() => setChatIncludeSelection(!chatIncludeSelection)}
                      style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', backgroundColor: selectedText && chatIncludeSelection ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', color: selectedText && chatIncludeSelection ? '#c084fc' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <span>@Selection {selectedText ? `(${selectedText.split(/\s+/).length} words)` : '(None)'}</span>
                    </button>

                    <button
                      onClick={() => setChatUseRag(!chatUseRag)}
                      style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', backgroundColor: chatUseRag ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)', color: chatUseRag ? '#fbbf24' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <Brain size={10} />
                      <span>@RAG Memory ({memoriesList.length})</span>
                    </button>
                  </div>

                  {/* Input Box */}
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
                      style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: isChatSending || !chatInput.trim() ? 0.4 : 1, transition: 'all 0.15s', shrink: 0 }}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CRAFT COMPLETE STORY WIZARD */}
            {aiPanelTab === 'craft' && (
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Guided writing engine: Set narrative constraints and synthesize a full chapter manuscript draft.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>GENRE</label>
                  <select value={craftGenre} onChange={e => setCraftGenre(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.76rem', outline: 'none' }}>
                    <option value="Cyberpunk">Cyberpunk / Dystopian</option>
                    <option value="Hard Sci-Fi">Hard Sci-Fi / Deep Space</option>
                    <option value="Dark Fantasy">Dark Fantasy / Eldritch</option>
                    <option value="Psychological Thriller">Psychological Thriller</option>
                    <option value="Noir Mystery">Noir Mystery</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>TONE & CADENCE</label>
                  <input value={craftTone} onChange={e => setCraftTone(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>PROTAGONIST</label>
                  <input value={craftProtagonist} onChange={e => setCraftProtagonist(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>SETTING</label>
                  <input value={craftSetting} onChange={e => setCraftSetting(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>CORE PREMISE & STAKES</label>
                  <textarea rows={3} value={craftPremise} onChange={e => setCraftPremise(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>

                <button onClick={handleCraftStory} disabled={isCraftingStory}
                  style={{ padding: '0.55rem', backgroundColor: '#7e22ce', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <Wand2 size={14} />
                  <span>{isCraftingStory ? 'Synthesizing Story Foundation...' : 'Craft Complete Story'}</span>
                </button>

                {craftedResult && (
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>{craftedResult.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: '1.4' }}>{craftedResult.synopsis}</div>
                    <button onClick={handleInsertCraftedStory}
                      style={{ width: '100%', padding: '0.45rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                      Load as New Chapter Document
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PLOT BRANCHING & SCENE EXPANSION */}
            {aiPanelTab === 'branch' && (
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Analyze current manuscript text and generate 3 branching narrative paths to continue the scene.
                </div>

                <button onClick={handleGenerateBranches} disabled={isGeneratingBranches}
                  style={{ padding: '0.55rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <GitFork size={14} />
                  <span>{isGeneratingBranches ? 'Evaluating Story Arcs...' : 'Generate 3 Story Branches'}</span>
                </button>

                {plotBranches.map(branch => (
                  <div key={branch.id} style={{ padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00f0ff' }}>{branch.title}</span>
                      <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '3px', backgroundColor: 'rgba(0,240,255,0.15)', color: '#00f0ff' }}>{branch.tag}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#cbd5e1', lineHeight: '1.4' }}>{branch.summary}</div>
                    <button onClick={() => handleExpandBranch(branch)} disabled={isExpandingBranch}
                      style={{ marginTop: '0.3rem', padding: '0.35rem', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', color: '#34d399', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                      <ArrowRight size={12} />
                      <span>Write & Insert Scene</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: SOVEREIGN RAG MEMORY VAULT */}
            {aiPanelTab === 'memories' && (
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Persistent RAG Memory: Facts, character rules, and style preferences stored safely in your air-gapped Dexie database for continuous narrative coherence.
                </div>

                {/* Add New Memory Box */}
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24' }}>Add Long-Term Memory</span>
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
                    placeholder="e.g., Silas Vance always carries an unbooted titanium ledger..."
                    style={{ width: '100%', padding: '0.4rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.72rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={handleAddCustomMemory}
                    disabled={!newMemoryText.trim()}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#d97706', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', opacity: !newMemoryText.trim() ? 0.4 : 1 }}
                  >
                    Commit to Memory
                  </button>
                </div>

                {/* Memories List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {memoriesList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.72rem' }}>
                      No memories recorded yet. Add one above or chat with the AI co-author to auto-index lore.
                    </div>
                  ) : (
                    memoriesList.map((m) => (
                      <div
                        key={m.id}
                        style={{ padding: '0.6rem 0.75rem', backgroundColor: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>
                            {m.category}
                          </span>
                          <button
                            onClick={() => handleDeleteMemoryItem(m.id)}
                            title="Delete memory"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                          {m.content}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                          <span>Used: {m.usageCount || 0} times</span>
                          <span>Importance: {m.importance}/5</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Version History Modal ── */}
      {isVersionModalOpen && activeDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            width: '90%',
            maxWidth: '560px',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(0,240,255,0.3)',
            borderRadius: '10px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#00f0ff" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Revision History: {activeDoc.name}</span>
              </div>
              <button onClick={() => setIsVersionModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              Automatic local revision snapshots captured during typing sessions. All revisions are stored offline on this device.
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {isLoadingVersions ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#00f0ff', fontSize: '0.8rem' }}>
                  Loading revision snapshots...
                </div>
              ) : versionsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.8rem' }}>
                  No historical snapshots recorded yet. Continue writing and snapshots will automatically accumulate.
                </div>
              ) : (
                versionsList.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.8rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#f1f5f9' }}>
                        <Clock size={13} color="#00f0ff" />
                        <span>{new Date(v.createdAt).toLocaleString()}</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{v.wordCount} words</span>
                    </div>

                    <button
                      onClick={() => handleRollbackVersion(v.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.3rem 0.6rem',
                        backgroundColor: 'rgba(0,240,255,0.15)',
                        border: '1px solid rgba(0,240,255,0.3)',
                        borderRadius: '4px',
                        color: '#00f0ff',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <RotateCcw size={12} />
                      <span>Restore</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setIsVersionModalOpen(false)}
                style={{ padding: '0.4rem 1rem', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.76rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. SOVEREIGN MESH SHARE MODAL ── */}
      {isMeshShareModalOpen && activeDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            width: '90%',
            maxWidth: '520px',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Share2 size={18} color="#10b981" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Publish Chapter to Sovereign Mesh</span>
              </div>
              <button onClick={() => setIsMeshShareModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: 'rgba(2, 6, 23, 0.6)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Document:</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{activeDoc.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Word Count:</span>
                <span style={{ color: '#00f0ff' }}>{activeDoc.wordCount || wordCount} words</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Author Identity:</span>
                <span style={{ color: '#f1f5f9' }}>{getLocalIdentity().displayName} ({getLocalIdentity().address})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Physical Mesh Status:</span>
                {meshPeerCount > 0 ? (
                  <span style={{ color: '#34d399', fontWeight: 600 }}>● {meshPeerCount} Physical Peer(s) Online</span>
                ) : (
                  <span style={{ color: '#eab308' }}>○ 0 Peers discovered (Broadcasting on LAN & Relay)</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Message or Note for Peers (Optional):
              </label>
              <textarea
                value={meshShareNote}
                onChange={e => setMeshShareNote(e.target.value)}
                placeholder="e.g. Chapter 1 draft for critique or co-authoring review..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  backgroundColor: '#090d16',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.76rem',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {meshShareStatus && (
              <div style={{
                padding: '0.5rem 0.8rem',
                borderRadius: '6px',
                backgroundColor: meshShareStatus.startsWith('Error') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: meshShareStatus.startsWith('Error') ? '1px solid #ef4444' : '1px solid #10b981',
                color: meshShareStatus.startsWith('Error') ? '#fca5a5' : '#86efac',
                fontSize: '0.74rem',
                textAlign: 'center'
              }}>
                {meshShareStatus}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setIsMeshShareModalOpen(false)}
                style={{ padding: '0.45rem 1rem', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#94a3b8', fontSize: '0.76rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={isMeshPublishing}
                onClick={handlePublishToMesh}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1.2rem',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#022c22',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: isMeshPublishing ? 'wait' : 'pointer',
                  opacity: isMeshPublishing ? 0.7 : 1
                }}
              >
                <Share2 size={13} />
                <span>{isMeshPublishing ? 'Broadcasting...' : 'Broadcast to Mesh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
