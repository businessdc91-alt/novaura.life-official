// LiteratureIDEWindow.jsx — Literature Forge: Sovereign Literary Studio & Narrative IDE
// An Integrated Development Environment tailored for high-craft narrative fiction and prose.
// Fuses Scrivener-style split-screen & Corkboard outliner, Novelcrafter-grade Codex, Sudowrite 5-senses expansion,
// and ProWritingAid cadence analytics with 100% offline sovereign privacy and universal frontier inference.

import '../../config/monacoConfig.js';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BookOpen, Plus, Trash2, X, FileText, CornerDownLeft, Sparkles,
  RotateCcw, History, Share2, ChevronUp, ChevronDown, Search, Replace,
  LayoutGrid, Wand2, RefreshCw, Tag
} from 'lucide-react';
import Editor from '@monaco-editor/react';

import {
  getManuscriptFiles, getActiveDocument, setActiveDocumentId,
  getOpenTabs, closeTab, updateDocumentContent, createManuscriptFile,
  deleteManuscriptFile, subscribeManuscriptStore, getManuscriptVersions,
  rollbackManuscriptVersion, exportManuscript, publishDocumentToMesh,
  updateManuscriptMetadata, moveManuscriptFile, replaceTextInHtml,
  replaceAcrossAllManuscripts
} from '../../services/manuscriptStore.js';
import { getPeerCount, getLocalIdentity } from '../../services/sovereignMesh.js';
import { sanitizeRichHtml, escapeHtml } from '../../services/htmlSanitizer.js';
import { db } from '../../database/sovereignDatabase.js';
import { contentToBytes } from '../../services/fileStorageService.js';
import { predictNextPhrase, expandBeatToSceneProse } from '../../services/literatureAiService.js';
import { spellCheckEngine, phraseRegex } from './literature/engines/SpellCheckEngine.js';
import { factChecker } from './literature/engines/FactChecker.js';
import { storyTimeline, BEAT_TEMPLATES } from './literature/engines/StoryTimeline.js';
import { parseDocxBytes } from './literature/engines/BookCompiler.js';

import ActivityBar from './literature/panels/ActivityBar.jsx';
import CodexPanel from './literature/panels/CodexPanel.jsx';
import TimelinePanel from './literature/panels/TimelinePanel.jsx';
import CausalityPanel from './literature/panels/CausalityPanel.jsx';
import GrammarPanel from './literature/panels/GrammarPanel.jsx';
import FactCheckPanel from './literature/panels/FactCheckPanel.jsx';
import NarrativeAuditPanel from './literature/panels/NarrativeAuditPanel.jsx';
import RemasterPanel from './literature/panels/RemasterPanel.jsx';
import PacingAnalyticsPanel from './literature/panels/PacingAnalyticsPanel.jsx';
import DrawingCanvas from './literature/panels/DrawingCanvas.jsx';
import SensoryFloatingBar from './literature/panels/SensoryFloatingBar.jsx';
import SplitEditorView from './literature/panels/SplitEditorView.jsx';
import WordRibbon from './literature/panels/WordRibbon.jsx';
import AICoAuthorPanel from './literature/panels/AICoAuthorPanel.jsx';
import EbookPublisherModal from './literature/panels/EbookPublisherModal.jsx';
import ZenFocusOverlay from './literature/panels/ZenFocusOverlay.jsx';

const STATUS_BADGES = {
  Draft: { color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
  Revised: { color: '#38bdf8', bg: 'rgba(56,189,248,0.16)' },
  Final: { color: '#10b981', bg: 'rgba(16,185,129,0.18)' },
};

export default function LiteratureIDEWindow({ onClose, props: windowProps }) {
  // ── Workspace & File Tree State ──
  const [files, setFiles] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [openTabsList, setOpenTabsList] = useState([]);
  const [wordCount, setWordCount] = useState(0);

  // ── Modular IDE Layout State ──
  const [activeActivity, setActiveActivity] = useState('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  // ── Word Ribbon & Formatting State ──
  const [ribbonTab, setRibbonTab] = useState('home');
  const [fontFamily, setFontFamily] = useState('Georgia, serif');
  const [fontSize, setFontSize] = useState('12pt');
  const [pageMargin, setPageMargin] = useState('normal');
  const [pageOrientation, setPageOrientation] = useState('portrait');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDarkCanvas, setIsDarkCanvas] = useState(false);
  const [isTypewriterScroll, setIsTypewriterScroll] = useState(false);
  const [editorMode, setEditorMode] = useState('manuscript');
  const [codeLanguage, setCodeLanguage] = useState('html');

  // ── Find & Replace Bar State ──
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findWholeWord, setFindWholeWord] = useState(false);
  const [findScope, setFindScope] = useState('current'); // 'current' | 'all'
  const [findFeedback, setFindFeedback] = useState('');
  const [findMatchIndex, setFindMatchIndex] = useState(0);

  // ── @Mention Entity Autocomplete State ──
  const [mentionPopup, setMentionPopup] = useState(null); // { query, items, selectedIdx, top, left }

  // ── Corkboard / Beat Sheet Outliner State ──
  const [plotBeats, setPlotBeats] = useState(() => [...storyTimeline.plotThreads]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('save_the_cat');
  const [newBeatTitle, setNewBeatTitle] = useState('');
  const [newBeatAct, setNewBeatAct] = useState('Act I');
  const [newBeatSynopsis, setNewBeatSynopsis] = useState('');
  const [draftingBeatId, setDraftingBeatId] = useState(null);

  // ── Editor Canvas & Prediction State ──
  const editorRef = useRef(null);
  const rootRef = useRef(null);
  const canvasScrollRef = useRef(null);
  const typingTimerRef = useRef(null);
  const ghostSeqRef = useRef(0);
  const [ghostPrediction, setGhostPrediction] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState(null);

  // ── Modals & Overlays State ──
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionsList, setVersionsList] = useState([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPublisherOpen, setIsPublisherOpen] = useState(false);
  const fileImportInputRef = useRef(null);

  // ── Sovereign Mesh P2P Sharing State ──
  const [isMeshShareModalOpen, setIsMeshShareModalOpen] = useState(false);
  const [meshShareNote, setMeshShareNote] = useState('');
  const [meshShareStatus, setMeshShareStatus] = useState(null);
  const [isMeshPublishing, setIsMeshPublishing] = useState(false);
  const [incomingDocAlert, setIncomingDocAlert] = useState(null);
  const [meshPeerCount, setMeshPeerCount] = useState(0);

  // ── Live Linter & Fact Badge Counts ──
  const grammarIssueCount = useMemo(() => {
    if (!activeDoc?.content) return 0;
    return spellCheckEngine.analyzeText(activeDoc.content).length;
  }, [activeDoc?.content]);

  const factIssueCount = useMemo(() => {
    if (!activeDoc?.content) return 0;
    return factChecker.extractPotentialClaims(activeDoc.content).length;
  }, [activeDoc?.content]);

  // ── 1. Workspace Subscriptions & Initialization ──
  useEffect(() => {
    refreshWorkspace();

    const updatePeerStats = () => setMeshPeerCount(getPeerCount());
    updatePeerStats();
    window.addEventListener('novaura:mesh_updated', updatePeerStats);
    window.addEventListener('novaura:peer_discovered', updatePeerStats);
    window.addEventListener('novaura:peer_lost', updatePeerStats);

    const handleIncomingLit = (e) => {
      if (e.detail) setIncomingDocAlert(e.detail);
    };
    window.addEventListener('novaura:literature_received', handleIncomingLit);

    const syncTimeline = () => setPlotBeats([...storyTimeline.plotThreads]);
    window.addEventListener('novaura:timeline_updated', syncTimeline);

    const handleGlobalKeyDown = (e) => {
      // Only while focus is inside this window: other apps keep their own Ctrl+F.
      if (!rootRef.current?.contains(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'h')) {
        e.preventDefault();
        setIsFindBarOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    const unsubscribe = subscribeManuscriptStore((state) => {
      setFiles(state.files || []);
      const active = (state.files || []).find(f => f.id === state.activeFileId) || state.files?.[0] || null;
      setActiveDoc(active);
      const open = (state.openTabs || []).map(id => state.files.find(f => f.id === id)).filter(Boolean);
      setOpenTabsList(open);
      setWordCount(active ? active.wordCount || 0 : 0);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('novaura:mesh_updated', updatePeerStats);
      window.removeEventListener('novaura:peer_discovered', updatePeerStats);
      window.removeEventListener('novaura:peer_lost', updatePeerStats);
      window.removeEventListener('novaura:literature_received', handleIncomingLit);
      window.removeEventListener('novaura:timeline_updated', syncTimeline);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const refreshWorkspace = () => {
    const allFiles = getManuscriptFiles();
    setFiles(allFiles);
    const active = getActiveDocument();
    setActiveDoc(active);
    setOpenTabsList(getOpenTabs());
    setWordCount(active ? active.wordCount || 0 : 0);
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el || !activeDoc) return;
    const content = activeDoc.content || '';
    if (el.dataset.docId !== activeDoc.id || el.__syncedContent !== content) {
      el.innerHTML = sanitizeRichHtml(content);
      el.__syncedContent = content;
      el.dataset.docId = activeDoc.id;
    }
  });

  useEffect(() => {
    if (activeDoc) {
      setWordCount(activeDoc.wordCount || 0);
      setGhostPrediction('');
    }
  }, [activeDoc?.id]);

  // ── Typewriter Vertical Centering Helper ──
  const scrollCaretToCenter = useCallback(() => {
    if (!isTypewriterScroll || !canvasScrollRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.top === 0) return;
    const container = canvasScrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const offset = rect.top - containerRect.top - containerRect.height * 0.45;
    if (Math.abs(offset) > 28) {
      container.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }, [isTypewriterScroll]);

  // ── @Mention Detection Helper ──
  const detectMentionTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setMentionPopup(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      setMentionPopup(null);
      return;
    }
    const textBefore = node.data.slice(0, range.startOffset);
    const match = textBefore.match(/@([\w-]{0,24})$/);
    if (!match) {
      setMentionPopup(null);
      return;
    }
    const query = match[1].toLowerCase();
    const allMentionables = storyTimeline.getAllMentionables();
    const filtered = allMentionables
      .filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.aliases || []).some(a => String(a).toLowerCase().includes(query))
      )
      .slice(0, 6);
    if (filtered.length === 0) {
      setMentionPopup(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const canvas = canvasScrollRef.current;
    const box = canvas?.getBoundingClientRect();
    setMentionPopup({
      query: match[1],
      items: filtered,
      selectedIdx: 0,
      // Relative to the scrolling canvas: the window frame's backdrop blur makes
      // position:fixed measure from the window, not the screen.
      top: rect.bottom - (box?.top || 0) + (canvas?.scrollTop || 0) + 6,
      left: Math.max(8, rect.left - (box?.left || 0) + (canvas?.scrollLeft || 0))
    });
  }, []);

  const applyMentionSelection = (item) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE) {
      const textBefore = node.data.slice(0, range.startOffset);
      const match = textBefore.match(/@([\w-]{0,24})$/);
      if (match) {
        const replaceRange = document.createRange();
        replaceRange.setStart(node, range.startOffset - match[0].length);
        replaceRange.setEnd(node, range.startOffset);
        sel.removeAllRanges();
        sel.addRange(replaceRange);
        document.execCommand('insertText', false, item.name + ' ');
      }
    }
    setMentionPopup(null);
    handleEditorInput();
  };

  // ── 2. Editor Input & Ghostwriter Inline Prediction ──
  const handleEditorInput = useCallback(() => {
    if (!editorRef.current || !activeDoc) return;
    const content = editorRef.current.innerHTML;
    editorRef.current.__syncedContent = content;
    updateDocumentContent(activeDoc.id, content);

    const plain = editorRef.current.innerText || '';
    const words = plain.trim() ? plain.trim().split(/\s+/).filter(Boolean).length : 0;
    setWordCount(words);

    scrollCaretToCenter();
    detectMentionTrigger();

    const seq = ++ghostSeqRef.current;
    setGhostPrediction('');
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      const prediction = await predictNextPhrase(plain);
      if (prediction && seq === ghostSeqRef.current) setGhostPrediction(prediction);
    }, 1100);
  }, [activeDoc, scrollCaretToCenter, detectMentionTrigger]);

  // Keyboard navigation for @Mention popup and Ghostwriter Tab completion
  const handleEditorKeyDown = (e) => {
    if (mentionPopup && mentionPopup.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionPopup(prev => ({
          ...prev,
          selectedIdx: (prev.selectedIdx + 1) % prev.items.length
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionPopup(prev => ({
          ...prev,
          selectedIdx: (prev.selectedIdx - 1 + prev.items.length) % prev.items.length
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMentionSelection(mentionPopup.items[mentionPopup.selectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionPopup(null);
        return;
      }
    }

    if (e.key === 'Tab' && ghostPrediction) {
      e.preventDefault();
      document.execCommand('insertText', false, ' ' + ghostPrediction);
      setGhostPrediction('');
      handleEditorInput();
    }
  };

  // Selection detection for sensory floating toolbar
  const handleEditorSelect = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && sel.rangeCount > 0) {
      setSelectedText(sel.toString().trim());
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPosition({
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
      });
    } else {
      setSelectedText('');
      setSelectionPosition(null);
    }
  };

  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  };

  // ── 3. File & Chapter Metadata Actions ──
  const handleSelectFile = (id) => {
    setActiveDocumentId(id);
    refreshWorkspace();
  };

  const handleCloseTab = (id, e) => {
    e.stopPropagation();
    closeTab(id);
    refreshWorkspace();
  };

  const handleCreateNewChapter = (customTitle = null, customContent = null) => {
    const num = files.filter(f => f.type === 'chapter').length + 1;
    const title = customTitle || `Chapter ${num} - Untitled`;
    const initialProse = customContent
      ? (customContent.trim().startsWith('<')
          ? sanitizeRichHtml(customContent)
          : `<h1>${escapeHtml(title)}</h1>` + customContent.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join(''))
      : `<h1>${escapeHtml(title)}</h1><p>Begin writing chapter here...</p>`;
    const newDoc = createManuscriptFile(title, 'chapter', initialProse);
    refreshWorkspace();
    setActiveDocumentId(newDoc.id);
  };

  const handleCreateNewNote = () => {
    const newDoc = createManuscriptFile(`Lore Dossier ${Date.now().toString(36).substring(3)}`, 'bible', `<h2>New Lore Dossier</h2><p>Record worldbuilding or notes here...</p>`);
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

  const handleMoveChapter = (id, direction, e) => {
    e.stopPropagation();
    moveManuscriptFile(id, direction);
    refreshWorkspace();
  };

  const handleCycleStatus = (file, e) => {
    e.stopPropagation();
    const order = ['Draft', 'Revised', 'Final'];
    const nextStatus = order[(order.indexOf(file.status || 'Draft') + 1) % order.length];
    updateManuscriptMetadata(file.id, { status: nextStatus });
    refreshWorkspace();
  };

  // ── 4. Insert / Replace / Focus Utilities ──
  const handleInsertProseAtCursor = (prose) => {
    if (!prose) return;
    if (editorRef.current) {
      editorRef.current.focus();
      const html = prose.split('\n\n').map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
      document.execCommand('insertHTML', false, sanitizeRichHtml(html));
      handleEditorInput();
    }
  };

  const handleReplaceSelectionWithProse = (prose) => {
    if (!prose || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, prose);
    handleEditorInput();
    setSelectedText('');
    setSelectionPosition(null);
  };

  // Focuses and selects a specific Grammar issue occurrence in the live editor
  const handleFocusSpecificText = (issue) => {
    const el = editorRef.current;
    if (!el || !activeDoc || !issue?.text) return;
    const re = phraseRegex(issue.text);
    let remaining = issue.occurrence ?? 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(node.data)) !== null) {
        if (remaining-- > 0) continue;
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        el.focus();
        const rect = range.getBoundingClientRect();
        if (rect && canvasScrollRef.current) {
          const cRect = canvasScrollRef.current.getBoundingClientRect();
          canvasScrollRef.current.scrollBy({
            top: rect.top - cRect.top - cRect.height * 0.4,
            behavior: 'smooth'
          });
        }
        return;
      }
    }
  };

  const handleReplaceSpecificText = (issue) => {
    const el = editorRef.current;
    if (!el || !activeDoc || !issue?.text) return;
    const re = phraseRegex(issue.text);
    let remaining = issue.occurrence ?? 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(node.data)) !== null) {
        if (remaining-- > 0) continue;
        let start = m.index;
        let end = m.index + m[0].length;
        const replacement = issue.replacement || '';
        if (!replacement) {
          if (node.data[end] === ' ') end++;
          else if (node.data[start - 1] === ' ') start--;
        }
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        el.focus();
        document.execCommand(replacement ? 'insertText' : 'delete', false, replacement);
        handleEditorInput();
        return;
      }
    }
  };

  // ── Find & Replace Handlers ──
  const handleFindNext = () => {
    const el = editorRef.current;
    if (!el || !findQuery) return;
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = findWholeWord ? `\\b${escaped}\\b` : escaped;
    const flags = findMatchCase ? 'g' : 'gi';
    const re = new RegExp(pattern, flags);

    const matches = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(node.data)) !== null) {
        matches.push({ node, start: m.index, end: m.index + m[0].length });
      }
    }

    if (matches.length === 0) {
      setFindFeedback('0 matches');
      return;
    }

    const idx = findMatchIndex % matches.length;
    const target = matches[idx];
    const range = document.createRange();
    range.setStart(target.node, target.start);
    range.setEnd(target.node, target.end);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    el.focus();
    setFindMatchIndex((idx + 1) % matches.length);
    setFindFeedback(`${idx + 1} of ${matches.length}`);
  };

  const handleExecuteReplace = async () => {
    if (!findQuery) return;
    if (findScope === 'all') {
      if (!window.confirm(`Replace every "${findQuery}" with "${replaceQuery}" in all chapters and lore notes? Each chapter's version history keeps the old text.`)) return;
      const stats = await replaceAcrossAllManuscripts(findQuery, replaceQuery, {
        matchCase: findMatchCase,
        wholeWord: findWholeWord
      });
      refreshWorkspace();
      setFindFeedback(`Replaced ${stats.totalReplacements} across ${stats.docsModified} file(s)`);
    } else if (activeDoc) {
      const { html, count } = replaceTextInHtml(activeDoc.content || '', findQuery, replaceQuery, {
        matchCase: findMatchCase,
        wholeWord: findWholeWord
      });
      if (count > 0) {
        updateDocumentContent(activeDoc.id, html);
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeRichHtml(html);
          editorRef.current.__syncedContent = html;
        }
        refreshWorkspace();
      }
      setFindFeedback(`Replaced ${count} occurrence(s)`);
    }
  };

  // ── Corkboard / Beat Sheet Handlers ──
  const handleApplyBeatTemplate = () => {
    // Applying over existing cards replaces them (and their synopses), so ask first.
    if (plotBeats.length > 0) {
      const label = BEAT_TEMPLATES[selectedTemplateId]?.label || 'this template';
      if (!window.confirm(`Replace your ${plotBeats.length} beat card${plotBeats.length === 1 ? '' : 's'} with ${label}? Their synopses will be lost.`)) return;
    }
    storyTimeline.applyBeatTemplate(selectedTemplateId, plotBeats.length > 0);
    setPlotBeats([...storyTimeline.plotThreads]);
  };

  const handleAddCustomBeat = () => {
    if (!newBeatTitle.trim()) return;
    storyTimeline.addPlotBeat({
      title: newBeatTitle.trim(),
      act: newBeatAct,
      synopsis: newBeatSynopsis.trim(),
      status: 'Planned'
    });
    setNewBeatTitle('');
    setNewBeatSynopsis('');
    setPlotBeats([...storyTimeline.plotThreads]);
  };

  const handleDraftChapterFromBeat = async (beat) => {
    if (draftingBeatId) return;
    setDraftingBeatId(beat.id);
    try {
      const prose = await expandBeatToSceneProse({
        beat,
        storyBible: storyTimeline.bibleContext(3000, `${beat.title} ${beat.synopsis}`)
      });
      const newDoc = createManuscriptFile(
        `${beat.act ? beat.act + ' — ' : ''}${beat.title}`,
        'chapter',
        `<h1>${escapeHtml(beat.title)}</h1>` + prose.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('')
      );
      storyTimeline.updatePlotBeat(beat.id, { status: 'Drafted', linkedDocId: newDoc.id });
      setPlotBeats([...storyTimeline.plotThreads]);
      setActiveDocumentId(newDoc.id);
      refreshWorkspace();
    } catch (err) {
      console.warn('[Corkboard] Failed to draft chapter from beat:', err);
      alert(`Could not draft this beat: ${err.message || err}`);
    } finally {
      setDraftingBeatId(null);
    }
  };

  // ── 5. Import & Export (including Real .DOCX Binary Unpacking) ──
  const importText = (name, content) => {
    let html = '';
    if (/\.html?$/i.test(name)) {
      html = sanitizeRichHtml(content, { allowRemoteImages: false });
    } else if (/\.(md|markdown)$/i.test(name)) {
      html = content.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`).join('');
    } else {
      html = `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>`;
    }
    const newDoc = createManuscriptFile(name, 'chapter', html);
    setActiveDocumentId(newDoc.id);
    refreshWorkspace();
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name || 'Imported Document.txt';
    if (/\.docx$/i.test(fileName)) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = await parseDocxBytes(new Uint8Array(event.target.result));
          const cleanName = fileName.replace(/\.docx$/i, '');
          const newDoc = createManuscriptFile(cleanName, 'chapter', sanitizeRichHtml(parsed.html));
          setActiveDocumentId(newDoc.id);
          refreshWorkspace();
        } catch (err) {
          alert('Failed to unpack .docx archive: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => importText(fileName, event.target.result);
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const lastImportRef = useRef(null);
  const importVaultFile = async (fileId, openId) => {
    if (openId && lastImportRef.current === openId) return;
    lastImportRef.current = openId || null;
    try {
      const doc = await db.documents.get(fileId);
      if (!doc || doc.type !== 'file') return;
      if (/\.docx$/i.test(doc.name || '')) {
        const bytes = await contentToBytes(doc.content);
        const parsed = await parseDocxBytes(bytes);
        const newDoc = createManuscriptFile(doc.name.replace(/\.docx$/i, ''), 'chapter', sanitizeRichHtml(parsed.html));
        setActiveDocumentId(newDoc.id);
        refreshWorkspace();
        return;
      }
      const text = typeof doc.content === 'string' && !doc.content.startsWith('data:')
        ? doc.content
        : new TextDecoder().decode(await contentToBytes(doc.content));
      importText(doc.name, text);
    } catch (err) {
      console.warn('[Literature] Could not open the file:', err);
    }
  };
  const importVaultFileRef = useRef(importVaultFile);
  useEffect(() => { importVaultFileRef.current = importVaultFile; });
  useEffect(() => {
    if (windowProps?.importFileId) importVaultFileRef.current(windowProps.importFileId, windowProps.openId);
  }, [windowProps?.importFileId, windowProps?.openId]);
  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId === 'literature' && e.detail.props?.importFileId) importVaultFileRef.current(e.detail.props.importFileId, e.detail.props.openId);
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, []);

  const handleExportFormat = async (fmt) => {
    if (!activeDoc) return;
    try {
      await exportManuscript(activeDoc.id, fmt);
    } catch (err) {
      alert(`Export failed: ${err.message || err}`);
    }
    setIsExportMenuOpen(false);
  };

  // ── 6. Versions & Revisions ──
  const loadVersions = async () => {
    if (!activeDoc) return;
    setIsLoadingVersions(true);
    try {
      const list = await getManuscriptVersions(activeDoc.id);
      setVersionsList(list);
    } catch (err) {
      console.warn('[Literature] Versions load error:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleRollback = async (versionId) => {
    if (!activeDoc) return;
    if (window.confirm('Restore this historical version? Current text will be replaced.')) {
      try {
        await rollbackManuscriptVersion(activeDoc.id, versionId);
        setIsVersionModalOpen(false);
        refreshWorkspace();
      } catch (err) {
        alert('Rollback error: ' + err.message);
      }
    }
  };

  // ── 7. Sovereign Mesh Sharing ──
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

  const totalPages = Math.max(1, Math.ceil(wordCount / 250));
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 230));

  return (
    <div ref={rootRef} style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#181824', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>

      {/* ── 1. ACTIVITY BAR (Far Left, 48px) ── */}
      <ActivityBar
        activePanel={activeActivity}
        setActivePanel={setActiveActivity}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSplitView={isSplitView}
        setIsSplitView={setIsSplitView}
        isZenMode={isZenMode}
        setIsZenMode={setIsZenMode}
        isAiPanelOpen={isAiPanelOpen}
        setIsAiPanelOpen={setIsAiPanelOpen}
        grammarIssueCount={grammarIssueCount}
        factIssueCount={factIssueCount}
      />

      {/* ── 2. MODULAR PRIMARY SIDEBAR (Collapsible, Adaptive 260px-380px) ── */}
      {isSidebarOpen && (
        <div style={{
          width: (activeActivity === 'causality' || activeActivity === 'sketch' || activeActivity === 'corkboard') ? '380px' : '265px',
          backgroundColor: '#12121e',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.18s ease'
        }}>
          {/* EXPLORER SIDEBAR */}
          {activeActivity === 'explorer' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                <span>Manuscript Binder</span>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  <button onClick={() => handleCreateNewChapter()} title="New Chapter" style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer', padding: '2px' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                <div style={{ padding: '0.3rem 0.8rem', fontSize: '0.66rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Chapters ({files.filter(f => f.type === 'chapter').length})
                </div>

                {files.filter(f => f.type === 'chapter').length === 0 ? (
                  <div style={{ padding: '1.5rem 0.8rem', textAlign: 'center', color: '#64748b', fontSize: '0.74rem' }}>
                    <FileText size={20} style={{ margin: '0 auto 0.4rem', opacity: 0.4 }} />
                    <p style={{ margin: '0 0 0.6rem' }}>No chapters drafted yet</p>
                    <button onClick={() => handleCreateNewChapter()} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.7rem', cursor: 'pointer' }}>
                      + New Chapter
                    </button>
                  </div>
                ) : (
                  files.filter(f => f.type === 'chapter').map(file => {
                    const isActive = activeDoc?.id === file.id;
                    const statusStyle = STATUS_BADGES[file.status || 'Draft'] || STATUS_BADGES.Draft;
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelectFile(file.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          cursor: 'pointer',
                          backgroundColor: isActive ? 'rgba(0,240,255,0.1)' : 'transparent',
                          borderLeft: isActive ? '2px solid #00f0ff' : '2px solid transparent',
                          color: isActive ? '#00f0ff' : '#cbd5e1',
                          fontSize: '0.76rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', flex: 1 }}>
                          <FileText size={13} color={isActive ? '#00f0ff' : '#64748b'} style={{ flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                          <button
                            onClick={(e) => handleCycleStatus(file, e)}
                            title="Click to cycle chapter status (Draft → Revised → Final)"
                            style={{ fontSize: '0.56rem', padding: '1px 5px', borderRadius: '3px', border: 'none', backgroundColor: statusStyle.bg, color: statusStyle.color, fontWeight: 700, cursor: 'pointer' }}
                          >
                            {file.status || 'Draft'}
                          </button>
                          <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{file.wordCount}w</span>
                          <button onClick={(e) => handleMoveChapter(file.id, 'up', e)} title="Move Chapter Up" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '1px' }}>
                            <ChevronUp size={11} />
                          </button>
                          <button onClick={(e) => handleMoveChapter(file.id, 'down', e)} title="Move Chapter Down" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '1px' }}>
                            <ChevronDown size={11} />
                          </button>
                          <button onClick={(e) => handleDeleteFile(file.id, e)} title="Delete file" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '1px' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {[
                  { type: 'bible', label: 'Notes & Lore', onAdd: handleCreateNewNote },
                  { type: 'shared', label: 'Shared with you' },
                ].map(section => {
                  const sectionFiles = files.filter(f => f.type === section.type);
                  if (!sectionFiles.length && !section.onAdd) return null;
                  return (
                    <div key={section.type} style={{ marginTop: '0.6rem' }}>
                      <div style={{ padding: '0.3rem 0.8rem', fontSize: '0.66rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{section.label} ({sectionFiles.length})</span>
                        {section.onAdd && (
                          <button onClick={() => section.onAdd()} title={`New ${section.label} entry`} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer', padding: '2px' }}>
                            <Plus size={12} />
                          </button>
                        )}
                      </div>
                      {sectionFiles.map(file => {
                        const isActive = activeDoc?.id === file.id;
                        return (
                          <div
                            key={file.id}
                            onClick={() => handleSelectFile(file.id)}
                            title={file.author ? `Shared by ${file.author}` : file.name}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.8rem', cursor: 'pointer', backgroundColor: isActive ? 'rgba(0,240,255,0.1)' : 'transparent', borderLeft: isActive ? '2px solid #00f0ff' : '2px solid transparent', color: isActive ? '#00f0ff' : '#cbd5e1', fontSize: '0.76rem' }}
                          >
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                            <button onClick={(e) => handleDeleteFile(file.id, e)} title="Delete file" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CORKBOARD & BEAT SHEET OUTLINER */}
          {activeActivity === 'corkboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.74rem' }}>
              <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, color: '#fb923c' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <LayoutGrid size={15} />
                  <span>CORKBOARD & BEAT SHEET ({plotBeats.length})</span>
                </div>
              </div>

              {/* Structural Beat Template Bar */}
              <div style={{ padding: '0.5rem 0.8rem', backgroundColor: '#090d16', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase' }}>Load Story Structure Template:</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    style={{ flex: 1, padding: '0.28rem', backgroundColor: '#12121e', border: '1px solid rgba(251,146,60,0.35)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem', outline: 'none' }}
                  >
                    {Object.entries(BEAT_TEMPLATES).map(([id, tpl]) => (
                      <option key={id} value={id}>{tpl.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleApplyBeatTemplate}
                    style={{ padding: '0.25rem 0.6rem', backgroundColor: 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.45)', borderRadius: '4px', color: '#fb923c', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Apply Beats
                  </button>
                </div>

                {/* Custom Beat Quick Add */}
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <input
                    value={newBeatTitle}
                    onChange={e => setNewBeatTitle(e.target.value)}
                    placeholder="Custom Beat Title..."
                    style={{ flex: 1, padding: '0.25rem 0.45rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem', outline: 'none' }}
                  />
                  <select
                    value={newBeatAct}
                    onChange={e => setNewBeatAct(e.target.value)}
                    style={{ padding: '0.25rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.68rem' }}
                  >
                    <option value="Act I">Act I</option>
                    <option value="Act II-A">Act II-A</option>
                    <option value="Act II-B">Act II-B</option>
                    <option value="Act III">Act III</option>
                  </select>
                  <button
                    onClick={handleAddCustomBeat}
                    disabled={!newBeatTitle.trim()}
                    style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ea580c', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Card
                  </button>
                </div>
              </div>

              {/* Beat Cards Stream */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {plotBeats.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                    <LayoutGrid size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0 }}>Corkboard is empty.</p>
                    <p style={{ fontSize: '0.66rem', margin: '0.25rem 0 0' }}>Select a structural template above (Save the Cat!, Hero's Journey, 7-Point, or 3-Act) and click "Apply Beats".</p>
                  </div>
                ) : (
                  plotBeats.map((beat, idx) => (
                    <div
                      key={beat.id}
                      style={{
                        padding: '0.6rem 0.75rem',
                        backgroundColor: 'rgba(2,6,23,0.7)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderLeft: `3px solid ${beat.status === 'Drafted' ? '#10b981' : '#fb923c'}`,
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c', fontWeight: 700 }}>
                            {beat.act || `Beat ${idx + 1}`}
                          </span>
                          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.74rem' }}>{beat.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <button onClick={() => { storyTimeline.movePlotBeat(beat.id, 'up'); setPlotBeats([...storyTimeline.plotThreads]); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '1px' }}><ChevronUp size={11} /></button>
                          <button onClick={() => { storyTimeline.movePlotBeat(beat.id, 'down'); setPlotBeats([...storyTimeline.plotThreads]); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '1px' }}><ChevronDown size={11} /></button>
                          <button onClick={() => { storyTimeline.deletePlotBeat(beat.id); setPlotBeats([...storyTimeline.plotThreads]); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '1px' }}><Trash2 size={11} /></button>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={beat.synopsis || ''}
                        onChange={(e) => {
                          storyTimeline.updatePlotBeat(beat.id, { synopsis: e.target.value });
                          setPlotBeats([...storyTimeline.plotThreads]);
                        }}
                        placeholder="Scene goal, conflict, and outcome..."
                        style={{ width: '100%', padding: '0.3rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.68rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.6rem', color: beat.status === 'Drafted' ? '#34d399' : '#64748b' }}>
                          ● {beat.status || 'Planned'}
                        </span>
                        <button
                          onClick={() => handleDraftChapterFromBeat(beat)}
                          disabled={draftingBeatId === beat.id}
                          style={{ padding: '2px 8px', backgroundColor: 'rgba(0,240,255,0.14)', border: '1px solid rgba(0,240,255,0.35)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          {draftingBeatId === beat.id ? <RefreshCw size={10} className="animate-spin" /> : <Wand2 size={10} />}
                          <span>{draftingBeatId === beat.id ? 'Drafting Scene...' : 'Draft Chapter from Beat'}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeActivity === 'codex' && <CodexPanel onGlobalRenameComplete={refreshWorkspace} />}
          {activeActivity === 'timeline' && <TimelinePanel activeDocContent={activeDoc?.content || ''} activeDocName={activeDoc?.name || ''} />}
          {activeActivity === 'causality' && <CausalityPanel activeDocContent={activeDoc?.content || ''} activeDocName={activeDoc?.name || ''} />}
          {activeActivity === 'grammar' && (
            <GrammarPanel
              activeDocContent={activeDoc?.content || ''}
              onReplaceText={handleReplaceSpecificText}
              onFocusIssue={handleFocusSpecificText}
            />
          )}
          {activeActivity === 'factcheck' && <FactCheckPanel activeDocContent={activeDoc?.content || ''} />}
          {activeActivity === 'audit' && <NarrativeAuditPanel activeDocContent={activeDoc?.content || ''} activeDocName={activeDoc?.name || ''} />}
          {activeActivity === 'remaster' && (
            <RemasterPanel
              activeDocContent={activeDoc?.content || ''}
              selectedText={selectedText}
              onInsertProse={handleInsertProseAtCursor}
              onCreateNewFileWithProse={handleCreateNewChapter}
            />
          )}
          {activeActivity === 'pacing' && <PacingAnalyticsPanel activeDocContent={activeDoc?.content || ''} />}
          {activeActivity === 'sketch' && <DrawingCanvas width={380} height={580} />}
        </div>
      )}

      {/* ── 3. CENTER AREA: EDITOR TABS + RIBBON + FIND BAR + EDITING PAGE ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        
        {/* Editor Tabs Bar */}
        <div style={{ height: '35px', backgroundColor: '#0f0f18', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', overflowX: 'auto', flexShrink: 0 }}>
          {openTabsList.map(tab => {
            const isActive = activeDoc?.id === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => handleSelectFile(tab.id)}
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0 0.85rem',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#1e1e2d' : 'transparent',
                  borderTop: isActive ? '2px solid #00f0ff' : '2px solid transparent',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  fontSize: '0.76rem',
                  minWidth: '130px',
                  maxWidth: '220px'
                }}
              >
                <FileText size={13} color={isActive ? '#00f0ff' : '#64748b'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{tab.name}</span>
                <button onClick={(e) => handleCloseTab(tab.id, e)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Literature Forge Ribbon Toolbar */}
        <WordRibbon
          ribbonTab={ribbonTab}
          setRibbonTab={setRibbonTab}
          editorMode={editorMode}
          setEditorMode={setEditorMode}
          codeLanguage={codeLanguage}
          setCodeLanguage={setCodeLanguage}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          fontSize={fontSize}
          setFontSize={setFontSize}
          pageMargin={pageMargin}
          setPageMargin={setPageMargin}
          pageOrientation={pageOrientation}
          setPageOrientation={setPageOrientation}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          isDarkCanvas={isDarkCanvas}
          setIsDarkCanvas={setIsDarkCanvas}
          isTypewriterScroll={isTypewriterScroll}
          setIsTypewriterScroll={setIsTypewriterScroll}
          activeDoc={activeDoc}
          meshPeerCount={meshPeerCount}
          onExec={exec}
          onImportClick={() => fileImportInputRef.current?.click()}
          onToggleExportMenu={() => setIsExportMenuOpen(!isExportMenuOpen)}
          isExportMenuOpen={isExportMenuOpen}
          onExportFormat={handleExportFormat}
          onOpenVersions={() => { loadVersions(); setIsVersionModalOpen(true); }}
          onOpenMeshShare={() => setIsMeshShareModalOpen(true)}
          onOpenPublisher={() => setIsPublisherOpen(true)}
          onToggleAiPanel={() => setIsAiPanelOpen(!isAiPanelOpen)}
          isAiPanelOpen={isAiPanelOpen}
          onToggleSplitView={() => setIsSplitView(!isSplitView)}
          isSplitView={isSplitView}
          onToggleFindBar={() => setIsFindBarOpen(!isFindBarOpen)}
          isFindBarOpen={isFindBarOpen}
          onOpenCorkboard={() => { setActiveActivity('corkboard'); setIsSidebarOpen(true); }}
          onClose={onClose}
        />

        {/* Collapsible Find & Replace Bar (Ctrl+F / Ctrl+H) */}
        {isFindBarOpen && (
          <div style={{ padding: '0.4rem 0.9rem', backgroundColor: '#111827', borderBottom: '1px solid rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)' }}>
              <Search size={12} color="#38bdf8" />
              <input
                value={findQuery}
                onChange={e => { setFindQuery(e.target.value); setFindMatchIndex(0); }}
                onKeyDown={e => { if (e.key === 'Enter') handleFindNext(); }}
                placeholder="Find in prose..."
                style={{ background: 'none', border: 'none', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', width: '140px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)' }}>
              <Replace size={12} color="#c084fc" />
              <input
                value={replaceQuery}
                onChange={e => setReplaceQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleExecuteReplace(); }}
                placeholder="Replace with..."
                style={{ background: 'none', border: 'none', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', width: '140px' }}
              />
            </div>

            <button onClick={handleFindNext} style={{ padding: '2px 8px', backgroundColor: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: '4px', color: '#38bdf8', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
              Find Next
            </button>

            <button onClick={handleExecuteReplace} style={{ padding: '2px 8px', backgroundColor: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '4px', color: '#c084fc', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
              Replace All
            </button>

            <select
              value={findScope}
              onChange={e => setFindScope(e.target.value)}
              style={{ padding: '2px 6px', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.68rem' }}
            >
              <option value="current">Current Chapter</option>
              <option value="all">All Manuscript Chapters</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#94a3b8', fontSize: '0.66rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={findMatchCase} onChange={e => setFindMatchCase(e.target.checked)} />
              Match Case
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#94a3b8', fontSize: '0.66rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={findWholeWord} onChange={e => setFindWholeWord(e.target.checked)} />
              Whole Word
            </label>

            {findFeedback && (
              <span style={{ color: '#34d399', fontSize: '0.68rem', fontWeight: 600 }}>{findFeedback}</span>
            )}

            <button onClick={() => setIsFindBarOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        <input
          type="file"
          ref={fileImportInputRef}
          onChange={handleImportFile}
          style={{ display: 'none' }}
          accept=".txt,.md,.html,.htm,.docx"
        />

        {/* ── Split Screen Canvas Container ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          
          {/* Main Editor Pane (Left or Single) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {editorMode === 'code' ? (
              <div style={{ flex: 1, backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Editor
                  height="100%"
                  theme="vs-dark"
                  path={activeDoc ? `${activeDoc.id}.${codeLanguage === 'html' ? 'html' : codeLanguage === 'markdown' ? 'md' : 'txt'}` : 'literature.txt'}
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
            ) : (
              <div
                ref={canvasScrollRef}
                style={{ flex: 1, backgroundColor: isDarkCanvas ? '#090d16' : '#cbd5e1', overflowY: 'auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
              >
                {/* Incoming Peer Chapter Alert */}
                {incomingDocAlert && (
                  <div style={{ width: '100%', maxWidth: '816px', marginBottom: '1rem', padding: '0.6rem 1rem', backgroundColor: '#090d16', border: '1px solid #10b981', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f8fafc', fontSize: '0.78rem', zIndex: 40 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Share2 size={16} color="#10b981" />
                      <span><strong>Peer Chapter:</strong> {incomingDocAlert.name} by {incomingDocAlert.author}</span>
                    </div>
                    <button
                      onClick={() => { handleSelectFile(incomingDocAlert.id); setIncomingDocAlert(null); }}
                      style={{ padding: '3px 10px', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '4px', color: '#34d399', fontSize: '0.72rem', cursor: 'pointer' }}
                    >
                      Open in Studio
                    </button>
                  </div>
                )}

                {/* 8.5 x 11 in Manuscript Sheet */}
                {activeDoc && (
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
                    {/* Editable Prose Surface */}
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
                      <div style={{ position: 'sticky', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 40, pointerEvents: 'none' }}>
                        <div style={{ pointerEvents: 'auto', backgroundColor: 'rgba(15,23,42,0.92)', color: '#00f0ff', padding: '0.45rem 1rem', borderRadius: '24px', border: '1px solid rgba(0,240,255,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: '90%' }}>
                          <Sparkles size={14} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            "{ghostPrediction}"
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(0,240,255,0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, color: '#00f0ff' }}>
                            <CornerDownLeft size={11} /> TAB TO ACCEPT
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline @Mention Codex Autocomplete Popup */}
                {mentionPopup && mentionPopup.items.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${mentionPopup.top}px`,
                      left: `${mentionPopup.left}px`,
                      width: '240px',
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(56,189,248,0.45)',
                      borderRadius: '6px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      zIndex: 99999,
                      padding: '0.25rem',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    <div style={{ padding: '2px 6px', fontSize: '0.6rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                      Story Bible @Mention
                    </div>
                    {mentionPopup.items.map((item, idx) => (
                      <div
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyMentionSelection(item);
                        }}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: idx === mentionPopup.selectedIdx ? 'rgba(56,189,248,0.2)' : 'transparent',
                          color: '#f8fafc',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Tag size={11} color="#38bdf8" />
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{item.badge}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scrivener-Style Dual Pane Split Screen */}
          {isSplitView && (
            <SplitEditorView
              files={files}
              activeDocId={activeDoc?.id}
              onClose={() => setIsSplitView(false)}
              onInsertReferenceProse={handleInsertProseAtCursor}
            />
          )}

          {/* Sudowrite-Style Sensory Expander Floating Toolbar */}
          <SensoryFloatingBar
            selectedText={selectedText}
            selectionPosition={selectionPosition}
            contextText={activeDoc?.content || ''}
            onInsertProse={handleInsertProseAtCursor}
            onReplaceSelection={handleReplaceSelectionWithProse}
            onClose={() => { setSelectedText(''); setSelectionPosition(null); }}
          />

        </div>

        {/* ── Status Bar ── */}
        <div style={{ height: '26px', backgroundColor: '#007acc', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0 0.8rem', fontSize: '0.72rem', zIndex: 20, whiteSpace: 'nowrap', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Page {totalPages} of {totalPages}</span>
            <span>{wordCount.toLocaleString()} words (~{readingTimeMin}m read)</span>
            <span>{activeDoc?.name || 'Untitled'} [{activeDoc?.status || 'Draft'}]</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>
              {editorMode === 'code' ? `Monaco (${codeLanguage.toUpperCase()})` : 'Forge Manuscript'}
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

      {/* ── 4. AI CO-AUTHOR STUDIO PANEL (Right, 350px) ── */}
      {isAiPanelOpen && (
        <AICoAuthorPanel
          activeDoc={activeDoc}
          activeDocContent={activeDoc?.content || ''}
          selectedText={selectedText}
          wordCount={wordCount}
          onInsertProse={handleInsertProseAtCursor}
          onReplaceSelection={handleReplaceSelectionWithProse}
          onCreateNewChapter={handleCreateNewChapter}
          onClose={() => setIsAiPanelOpen(false)}
        />
      )}

      {/* ── 5. E-BOOK PUBLISHER & TYPESETTER MODAL ── */}
      {isPublisherOpen && (
        <EbookPublisherModal
          files={files}
          activeDoc={activeDoc}
          authorName={getLocalIdentity()?.displayName || ''}
          onClose={() => setIsPublisherOpen(false)}
        />
      )}

      {/* ── 6. ZEN FOCUS OVERLAY (Typewriter Mode) ── */}
      {isZenMode && activeDoc && (
        <ZenFocusOverlay
          activeDoc={activeDoc}
          activeDocContent={activeDoc.content}
          onUpdateContent={updateDocumentContent}
          initialWordCount={wordCount}
          onClose={() => setIsZenMode(false)}
        />
      )}

      {/* ── 7. REVISIONS / HISTORICAL SNAPSHOTS MODAL ── */}
      {isVersionModalOpen && activeDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ width: '90%', maxWidth: '560px', backgroundColor: '#0f172a', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', color: '#f8fafc', fontSize: '0.76rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={16} color="#00f0ff" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Revisions: {activeDoc.name}</span>
              </div>
              <button onClick={() => setIsVersionModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {isLoadingVersions ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#00f0ff' }}>Loading revisions...</div>
              ) : versionsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No revision snapshots recorded yet.</div>
              ) : (
                versionsList.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ color: '#f1f5f9' }}>{new Date(v.createdAt).toLocaleString()}</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{v.wordCount} words</span>
                    </div>
                    <button
                      onClick={() => handleRollback(v.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', backgroundColor: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <RotateCcw size={11} /> Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 8. SOVEREIGN MESH SHARE MODAL ── */}
      {isMeshShareModalOpen && activeDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ width: '90%', maxWidth: '500px', backgroundColor: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', color: '#f8fafc', fontSize: '0.76rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={16} color="#10b981" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Publish Chapter to Sovereign Mesh</span>
              </div>
              <button onClick={() => setIsMeshShareModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', backgroundColor: 'rgba(2, 6, 23, 0.6)', padding: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div><strong>Document:</strong> {activeDoc.name} ({wordCount} words)</div>
              <div><strong>Author:</strong> {getLocalIdentity().displayName} ({getLocalIdentity().address})</div>
              <div><strong>Mesh Peers:</strong> {meshPeerCount > 0 ? `● ${meshPeerCount} Physical Peer(s) Online` : '○ 0 Peers discovered (broadcasting on LAN/Relay)'}</div>
            </div>

            <textarea
              value={meshShareNote}
              onChange={e => setMeshShareNote(e.target.value)}
              placeholder="Note or critique request for peers..."
              rows={2}
              style={{ width: '100%', padding: '0.5rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />

            {meshShareStatus && (
              <div style={{ padding: '0.4rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#86efac', textAlign: 'center' }}>
                {meshShareStatus}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <button onClick={() => setIsMeshShareModalOpen(false)} style={{ padding: '0.35rem 0.8rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handlePublishToMesh} disabled={isMeshPublishing} style={{ padding: '0.35rem 1rem', backgroundColor: '#10b981', border: 'none', borderRadius: '4px', color: '#022c22', fontWeight: 700, cursor: 'pointer' }}>
                {isMeshPublishing ? 'Broadcasting...' : 'Broadcast to Mesh'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
