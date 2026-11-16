// WordRibbon.jsx — Literature Forge Ribbon Menu & Formatting Toolbar
import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Undo, Redo,
  Upload, Download, History, Share2, BookOpen, Sparkles,
  FileText, Code2, Printer, Split, X, Search, LayoutGrid, Feather
} from 'lucide-react';

export default function WordRibbon({
  ribbonTab,
  setRibbonTab,
  editorMode,
  setEditorMode,
  codeLanguage,
  setCodeLanguage,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  pageMargin,
  setPageMargin,
  pageOrientation,
  setPageOrientation,
  zoomLevel,
  setZoomLevel,
  isDarkCanvas,
  setIsDarkCanvas,
  isTypewriterScroll,
  setIsTypewriterScroll,
  activeDoc,
  meshPeerCount,
  onExec,
  onImportClick,
  onToggleExportMenu,
  isExportMenuOpen,
  onExportFormat,
  onOpenVersions,
  onOpenMeshShare,
  onOpenPublisher,
  onToggleAiPanel,
  isAiPanelOpen,
  onToggleSplitView,
  isSplitView,
  onToggleFindBar,
  isFindBarOpen,
  onOpenCorkboard,
  onClose
}) {
  const fontSizeToCommandSize = (pt) => {
    switch (pt) {
      case '11pt': return '2';
      case '12pt': return '3';
      case '14pt': return '4';
      case '16pt': return '5';
      case '18pt': return '6';
      case '24pt': return '7';
      default: return '3';
    }
  };

  return (
    <div style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderBottom: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>
      {/* ── Ribbon Tabs Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', height: '30px', backgroundColor: '#e2e8f0', borderBottom: '1px solid #cbd5e1', fontSize: '0.74rem', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0f172a', backgroundColor: 'rgba(2,132,199,0.14)', border: '1px solid rgba(2,132,199,0.35)', padding: '1px 7px', borderRadius: '4px', fontWeight: 800, marginRight: '0.6rem', letterSpacing: '0.04em', fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <Feather size={11} color="#0284c7" />
          <span>LITERATURE FORGE</span>
        </span>
        {[
          { id: 'home', label: 'Home' },
          { id: 'insert', label: 'Insert' },
          { id: 'layout', label: 'Layout' },
          { id: 'view', label: 'View' },
          { id: 'tools', label: 'Tools & Publishing' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setRibbonTab(tab.id)}
            style={{
              padding: '0 0.75rem',
              height: '100%',
              border: 'none',
              background: ribbonTab === tab.id ? '#f1f5f9' : 'transparent',
              color: ribbonTab === tab.id ? '#0284c7' : '#475569',
              fontWeight: ribbonTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              borderTop: ribbonTab === tab.id ? '2px solid #0284c7' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}

        {/* Editor Mode Toggle: Manuscript vs Monaco Code */}
        <div style={{ marginLeft: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#cbd5e1', padding: '2px', borderRadius: '4px' }}>
          <button
            onClick={() => setEditorMode('manuscript')}
            style={{
              padding: '2px 8px',
              borderRadius: '3px',
              border: 'none',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: editorMode === 'manuscript' ? '#ffffff' : 'transparent',
              color: editorMode === 'manuscript' ? '#0284c7' : '#64748b',
              boxShadow: editorMode === 'manuscript' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FileText size={12} />
            <span>Manuscript</span>
          </button>
          <button
            onClick={() => setEditorMode('code')}
            style={{
              padding: '2px 8px',
              borderRadius: '3px',
              border: 'none',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: editorMode === 'code' ? '#ffffff' : 'transparent',
              color: editorMode === 'code' ? '#7e22ce' : '#64748b',
              boxShadow: editorMode === 'code' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
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
              fontSize: '0.68rem',
              backgroundColor: '#ffffff',
              outline: 'none',
              color: '#334155'
            }}
          >
            <option value="html">HTML Structure</option>
            <option value="markdown">Markdown / Prose</option>
            <option value="json">JSON Lore / Bible</option>
            <option value="plaintext">Plain Script</option>
          </select>
        )}

        {/* Right Action Icons */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem', position: 'relative' }}>
          {onToggleFindBar && (
            <button
              onClick={onToggleFindBar}
              title="Find & Replace across chapter or entire manuscript (Ctrl+F)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: isFindBarOpen ? '1px solid #0284c7' : '1px solid #cbd5e1',
                backgroundColor: isFindBarOpen ? '#e0f2fe' : '#ffffff',
                color: isFindBarOpen ? '#0369a1' : '#475569',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Search size={12} />
              <span>Find / Replace</span>
            </button>
          )}

          <button
            onClick={onImportClick}
            title="Import Local File (.docx, .md, .txt, .html) into Literature Forge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Upload size={12} />
            <span>Import</span>
          </button>

          {/* Export Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              disabled={!activeDoc}
              onClick={onToggleExportMenu}
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
                fontSize: '0.68rem',
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
                minWidth: '175px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <button
                  onClick={() => onExportFormat('docx')}
                  style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: '4px', color: '#0284c7' }}
                >
                  Export Word Manuscript (.docx)
                </button>
                <button
                  onClick={() => onExportFormat('epub')}
                  style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: '4px', color: '#7e22ce' }}
                >
                  Export E-Book (.epub)
                </button>
                <button
                  onClick={() => onExportFormat('markdown')}
                  style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                >
                  Export Markdown (.md)
                </button>
                <button
                  onClick={() => onExportFormat('html')}
                  style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                >
                  Export HTML (.html)
                </button>
                <button
                  onClick={() => onExportFormat('txt')}
                  style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                >
                  Export Plain Text (.txt)
                </button>
                <button
                  onClick={() => onExportFormat('json')}
                  style={{ padding: '6px 10px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '4px', color: '#1e293b' }}
                >
                  Export Document JSON
                </button>
              </div>
            )}
          </div>

          <button
            disabled={!activeDoc}
            onClick={onOpenVersions}
            title="Local Version History Snapshots"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0284c7', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <History size={12} />
            <span>Revisions</span>
          </button>

          <button
            disabled={!activeDoc}
            onClick={onOpenMeshShare}
            title="Publish / Broadcast Chapter to Physical Sovereign Mesh"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#16a34a', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Share2 size={12} />
            <span>Mesh Share</span>
            {meshPeerCount > 0 && (
              <span style={{ fontSize: '0.6rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '10px', fontWeight: 700 }}>
                {meshPeerCount}
              </span>
            )}
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: 'encyclopedia' }))}
            title="Open Aura Codex / Wikipedia Reference Library"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(6,182,212,0.3)', backgroundColor: 'rgba(6,182,212,0.1)', color: '#0891b2', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <BookOpen size={12} />
            <span>Aura Codex</span>
          </button>

          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Ribbon Toolbar Content ── */}
      <div style={{ padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', minHeight: '42px' }}>
        {ribbonTab === 'home' && (
          <>
            <select value={fontFamily} onChange={e => { setFontFamily(e.target.value); onExec('fontName', e.target.value); }}
              style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.74rem', outline: 'none', backgroundColor: '#fff', color: '#1e293b' }}>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="Calibri, sans-serif">Calibri</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Courier Prime', monospace">Courier Prime (Manuscript)</option>
              <option value="Garamond, serif">Garamond</option>
            </select>

            <select
              value={fontSize}
              onChange={e => {
                const next = e.target.value;
                setFontSize(next);
                const sel = typeof window !== 'undefined' ? window.getSelection() : null;
                if (sel && sel.toString().trim()) {
                  onExec('fontSize', fontSizeToCommandSize(next));
                }
              }}
              style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.74rem', outline: 'none', backgroundColor: '#fff', color: '#1e293b' }}
            >
              <option value="11pt">11 pt</option>
              <option value="12pt">12 pt</option>
              <option value="14pt">14 pt</option>
              <option value="16pt">16 pt</option>
              <option value="18pt">18 pt</option>
              <option value="24pt">24 pt</option>
            </select>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }} />

            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => onExec('bold')} title="Bold (Ctrl+B)" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><Bold size={14} /></button>
              <button onClick={() => onExec('italic')} title="Italic (Ctrl+I)" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><Italic size={14} /></button>
              <button onClick={() => onExec('underline')} title="Underline (Ctrl+U)" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><Underline size={14} /></button>
              <button onClick={() => onExec('strikeThrough')} title="Strikethrough" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><Strikethrough size={14} /></button>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }} />

            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => onExec('justifyLeft')} title="Align Left" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><AlignLeft size={14} /></button>
              <button onClick={() => onExec('justifyCenter')} title="Center" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><AlignCenter size={14} /></button>
              <button onClick={() => onExec('justifyRight')} title="Align Right" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><AlignRight size={14} /></button>
              <button onClick={() => onExec('justifyFull')} title="Justify" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><AlignJustify size={14} /></button>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }} />

            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => onExec('insertUnorderedList')} title="Bulleted List" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><List size={14} /></button>
              <button onClick={() => onExec('insertOrderedList')} title="Numbered List" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><ListOrdered size={14} /></button>
              <button onClick={() => onExec('formatBlock', 'h1')} style={{ padding: '2px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#fff', cursor: 'pointer' }}>H1</button>
              <button onClick={() => onExec('formatBlock', 'h2')} style={{ padding: '2px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#fff', cursor: 'pointer' }}>H2</button>
              <button onClick={() => onExec('formatBlock', 'p')} style={{ padding: '2px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', fontSize: '0.68rem', backgroundColor: '#fff', cursor: 'pointer' }}>Normal</button>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }} />

            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => onExec('undo')} title="Undo (Ctrl+Z)" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><Undo size={14} /></button>
              <button onClick={() => onExec('redo')} title="Redo (Ctrl+Y)" style={{ padding: '3px 5px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><Redo size={14} /></button>
            </div>
          </>
        )}

        {ribbonTab === 'insert' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => onExec('insertHorizontalRule')} style={{ padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}>Scene Divider (—)</button>
            <button onClick={() => onExec('insertHTML', '<div style="text-align: center; margin: 2rem 0; letter-spacing: 0.5em; font-weight: bold;">* * *</div>')} style={{ padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}>Chapter Break (* * *)</button>
            <button onClick={() => onExec('insertHTML', '<hr style="page-break-after: always;"/>')} style={{ padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}>Page Break</button>
            <button onClick={() => onExec('insertText', '—')} style={{ padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}>Em Dash (—)</button>
            <button onClick={() => onExec('formatBlock', 'blockquote')} style={{ padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}>Blockquote</button>
          </div>
        )}

        {ribbonTab === 'layout' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.74rem' }}>
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
                <option value="portrait">Portrait (8.5 x 11)</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>
        )}

        {ribbonTab === 'view' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.74rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>Zoom:</span>
              <button onClick={() => setZoomLevel(Math.max(70, zoomLevel - 15))} style={{ padding: '1px 5px', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fff' }}>-</button>
              <span style={{ fontWeight: 600 }}>{zoomLevel}%</span>
              <button onClick={() => setZoomLevel(Math.min(150, zoomLevel + 15))} style={{ padding: '1px 5px', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fff' }}>+</button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={isDarkCanvas} onChange={e => setIsDarkCanvas(e.target.checked)} />
              <span>Dark Canvas Mode</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={isTypewriterScroll} onChange={e => setIsTypewriterScroll(e.target.checked)} />
              <span>Typewriter Center Scrolling</span>
            </label>
          </div>
        )}

        {ribbonTab === 'tools' && (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              onClick={onOpenPublisher}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.6rem',
                backgroundColor: '#0284c7',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={13} />
              <span>Compile & Publish E-Book / Shunn Manuscript</span>
            </button>

            {onOpenCorkboard && (
              <button
                onClick={onOpenCorkboard}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.25rem 0.6rem',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '4px',
                  color: '#b45309',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <LayoutGrid size={13} />
                <span>Corkboard & Beat Templates</span>
              </button>
            )}

            <button
              onClick={onToggleSplitView}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.6rem',
                backgroundColor: isSplitView ? '#f3e8ff' : '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                color: isSplitView ? '#7e22ce' : '#334155',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Split size={13} />
              <span>{isSplitView ? 'Close Split View' : 'Scrivener Split View'}</span>
            </button>

            <button
              onClick={onToggleAiPanel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.6rem',
                backgroundColor: isAiPanelOpen ? '#e0f2fe' : '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                color: isAiPanelOpen ? '#0369a1' : '#334155',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Sparkles size={13} />
              <span>{isAiPanelOpen ? 'Hide Co-Author' : 'Open Co-Author'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
