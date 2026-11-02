// LiteratureIDEWindow.jsx — Sovereign Literary Studio & IDE
// An Integrated Development Environment tailored for high-craft narrative fiction and prose.
// Fuses Scrivener-style split-screen & outliner, Novelcrafter-grade Codex, Sudowrite 5-senses expansion,
// and ProWritingAid cadence analytics with 100% offline sovereign privacy and universal frontier inference.

import '../../config/monacoConfig.js';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Files, BookOpen, Clock, SpellCheck, CheckCircle2, GitFork, BarChart2,
  MessageSquare, Plus, Trash2, X, FileText, CornerDownLeft, Sparkles,
  RotateCcw, History, Share2, Layers, Check, Bot
} from 'lucide-react';
import Editor from '@monaco-editor/react';

import {
  getManuscriptFiles, getActiveDocument, setActiveDocumentId,
  getOpenTabs, closeTab, updateDocumentContent, createManuscriptFile,
  deleteManuscriptFile, subscribeManuscriptStore, getManuscriptVersions,
  rollbackManuscriptVersion, exportManuscript, publishDocumentToMesh
} from '../../services/manuscriptStore.js';
import { getPeerCount, getLocalIdentity } from '../../services/sovereignMesh.js';
import { sanitizeRichHtml, escapeHtml } from '../../services/htmlSanitizer.js';
import { predictNextPhrase } from '../../services/literatureAiService.js';
import { phraseRegex } from './literature/engines/SpellCheckEngine.js';

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

export default function LiteratureIDEWindow({ onClose }) {
  // ── Workspace & File Tree State ──
  const [files, setFiles] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [openTabsList, setOpenTabsList] = useState([]);
  const [wordCount, setWordCount] = useState(0);

  // ── Modular IDE Layout State ──
  const [activeActivity, setActiveActivity] = useState('explorer'); // 'explorer' | 'codex' | 'timeline' | 'grammar' | 'factcheck' | 'remaster' | 'pacing'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  // ── Word Ribbon & Formatting State ──
  const [ribbonTab, setRibbonTab] = useState('home'); // 'home' | 'insert' | 'layout' | 'view' | 'tools'
  const [fontFamily, setFontFamily] = useState('Georgia, serif');
  const [fontSize, setFontSize] = useState('12pt');
  const [pageMargin, setPageMargin] = useState('normal'); // 'normal' | 'narrow' | 'wide'
  const [pageOrientation, setPageOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDarkCanvas, setIsDarkCanvas] = useState(false);
  const [isTypewriterScroll, setIsTypewriterScroll] = useState(false);
  const [editorMode, setEditorMode] = useState('manuscript'); // 'manuscript' | 'code'
  const [codeLanguage, setCodeLanguage] = useState('html');

  // ── Editor Canvas & Prediction State ──
  const editorRef = useRef(null);
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

  // Load the stored text into the editor when it changed anywhere else (Zen
  // mode, a restored version, Monaco) or the editor element is new (coming back
  // from Monaco remounts it). Text the editor wrote itself is left alone so the
  // caret stays put. Runs after every render; the check is two comparisons.
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

  // ── 2. Editor Input & Ghostwriter Inline Prediction ──
  const handleEditorInput = useCallback(() => {
    if (!editorRef.current || !activeDoc) return;
    const content = editorRef.current.innerHTML;
    editorRef.current.__syncedContent = content;
    updateDocumentContent(activeDoc.id, content);

    const plain = editorRef.current.innerText || '';
    const words = plain.trim() ? plain.trim().split(/\s+/).filter(Boolean).length : 0;
    setWordCount(words);

    // Debounced ghostwriter prediction. A prediction that arrives after more
    // typing is for old text and is dropped.
    const seq = ++ghostSeqRef.current;
    setGhostPrediction('');
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      const prediction = await predictNextPhrase(plain);
      if (prediction && seq === ghostSeqRef.current) setGhostPrediction(prediction);
    }, 1100);
  }, [activeDoc]);

  // Tab key to accept ghostwriter completion
  const handleEditorKeyDown = (e) => {
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

  // ── 3. File Actions ──
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
    const initialProse = customContent || `<h1>${title}</h1><p>Begin writing chapter here...</p>`;
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

  // ── 4. Insert / Replace Utilities ──
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

  // Applies a Grammar fix to exactly the flagged words: the issue's nth
  // whole-word match in the editor's text, never a match inside another word
  // or inside the HTML. Goes through the editor's undo history.
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
        // Cutting a word also takes one neighbouring space, so no double space is left.
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

  // ── 5. Import & Export ──
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const name = file.name || 'Imported Document.docx';
      let html = '';
      // Imported files are untrusted: HTML is cleaned before it is stored, and
      // text is escaped so it shows as written.
      if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        html = sanitizeRichHtml(content, { allowRemoteImages: false });
      } else if (file.name.endsWith('.md')) {
        html = content.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`).join('');
      } else {
        html = `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>`;
      }
      const newDoc = createManuscriptFile(name, 'chapter', html);
      setActiveDocumentId(newDoc.id);
      refreshWorkspace();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportFormat = (fmt) => {
    if (!activeDoc) return;
    exportManuscript(activeDoc.id, fmt);
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

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#181824', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>

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
      />

      {/* ── 2. MODULAR PRIMARY SIDEBAR (Collapsible, Adaptive 240px-380px) ── */}
      {isSidebarOpen && (
        <div style={{
          width: (activeActivity === 'causality' || activeActivity === 'sketch') ? '380px' : '240px',
          backgroundColor: '#12121e',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.18s ease'
        }}>
          {activeActivity === 'explorer' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                <span>Manuscript Files</span>
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
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelectFile(file.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.8rem',
                          cursor: 'pointer',
                          backgroundColor: isActive ? 'rgba(0,240,255,0.1)' : 'transparent',
                          borderLeft: isActive ? '2px solid #00f0ff' : '2px solid transparent',
                          color: isActive ? '#00f0ff' : '#cbd5e1',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                          <FileText size={14} color={isActive ? '#00f0ff' : '#64748b'} style={{ flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.64rem', color: '#64748b' }}>{file.wordCount}w</span>
                          <button onClick={(e) => handleDeleteFile(file.id, e)} title="Delete file" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                            <Trash2 size={12} />
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

          {activeActivity === 'codex' && <CodexPanel />}
          {activeActivity === 'timeline' && <TimelinePanel activeDocContent={activeDoc?.content || ''} activeDocName={activeDoc?.name || ''} />}
          {activeActivity === 'causality' && <CausalityPanel activeDocContent={activeDoc?.content || ''} activeDocName={activeDoc?.name || ''} />}
          {activeActivity === 'grammar' && (
            <GrammarPanel
              activeDocContent={activeDoc?.content || ''}
              onReplaceText={handleReplaceSpecificText}
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

      {/* ── 3. CENTER AREA: EDITOR TABS + RIBBON + EDITING PAGE ── */}
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

        {/* Word Ribbon Toolbar */}
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
          onClose={onClose}
        />

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
              <div style={{ flex: 1, backgroundColor: isDarkCanvas ? '#090d16' : '#cbd5e1', overflowY: 'auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                
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

                {/* 8.5 x 11 in Word Sheet */}
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
