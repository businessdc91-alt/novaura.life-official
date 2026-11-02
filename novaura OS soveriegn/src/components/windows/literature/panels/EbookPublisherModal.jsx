// EbookPublisherModal.jsx — Typesetting, Standard Manuscript & E-Book Compiler
import React, { useState } from 'react';
import {
  Printer, X, Download, FileText, Check, BookOpen, Layers
} from 'lucide-react';
import { compileBook, countWords, roundedWordCount } from '../engines/BookCompiler.js';

export default function EbookPublisherModal({
  files,
  activeDoc,
  authorName = '',
  onClose
}) {
  const [format, setFormat] = useState('shunn'); // 'shunn' | 'epub' | 'print' | 'markdown'
  const [title, setTitle] = useState(activeDoc?.name?.replace(/\.[^/.]+$/, '') || 'Untitled Manuscript');
  const [author, setAuthor] = useState(authorName);
  const [penName, setPenName] = useState('');
  const [contact, setContact] = useState(''); // Shunn title page: address, email, phone (one per line)
  const [sceneBreakStyle, setSceneBreakStyle] = useState('#');
  const [scope, setScope] = useState('all'); // 'all' | 'active'
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState(null);

  const chaptersToCompile = scope === 'all'
    ? files.filter(f => f.type === 'chapter')
    : [activeDoc].filter(Boolean);

  const totalWords = countWords(chaptersToCompile);
  const displayWords = roundedWordCount(totalWords);

  const handleCompile = async () => {
    if (!chaptersToCompile.length) {
      setCompileResult({ error: 'There are no chapters to compile yet.' });
      return;
    }
    setIsCompiling(true);
    setCompileResult(null);
    try {
      const fileName = await compileBook(format, {
        title: title.trim() || 'Untitled Manuscript',
        author: author.trim() || penName.trim() || 'Anonymous',
        penName: penName.trim(),
        contact: contact.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5),
        chapters: chaptersToCompile,
        sceneBreak: sceneBreakStyle,
      });
      setCompileResult({ fileName });
    } catch (err) {
      setCompileResult({ error: err.message || 'Compile failed.' });
    } finally {
      setIsCompiling(false);
    }
  };

  return (
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
        maxWidth: '560px',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(2,132,199,0.4)',
        borderRadius: '12px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        color: '#f8fafc',
        fontSize: '0.76rem'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={18} color="#0284c7" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Manuscript Typesetting & Publisher</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Format Selector Grid */}
        <div>
          <label style={{ display: 'block', fontSize: '0.66rem', color: '#38bdf8', marginBottom: '0.35rem', textTransform: 'uppercase', fontWeight: 700 }}>
            Target Publication Format
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
            {[
              { id: 'shunn', label: 'Submission Manuscript (.docx)', desc: 'Shunn standard format for agents and editors: Courier 12 pt, double spaced, running header' },
              { id: 'epub', label: 'EPUB 3 E-Book (.epub)', desc: 'Table of contents and chapters; Apple Books, Kobo, Calibre, Send to Kindle' },
              { id: 'print', label: 'Print-Ready Book (.html)', desc: '6×9 in pages with page numbers; open it and print to PDF' },
              { id: 'markdown', label: 'Clean Markdown (.md)', desc: 'Portable text with headings, italics and scene breaks' },
            ].map(f => {
              const isSel = format === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  style={{
                    padding: '0.55rem',
                    backgroundColor: isSel ? 'rgba(2,132,199,0.18)' : 'rgba(2,6,23,0.6)',
                    border: isSel ? '1px solid #0284c7' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <span style={{ fontWeight: 700, color: isSel ? '#38bdf8' : '#f1f5f9', fontSize: '0.74rem' }}>{f.label}</span>
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{f.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metadata Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Book Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Legal Author Name</label>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Pen Name (Optional)</label>
            <input value={penName} onChange={e => setPenName(e.target.value)} placeholder="If different from legal name"
              style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Scene Break Marker</label>
            <select value={sceneBreakStyle} onChange={e => setSceneBreakStyle(e.target.value)}
              style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}>
              <option value="#"># (Standard Shunn)</option>
              <option value="* * *">* * * (Traditional Asterisks)</option>
              <option value="—">— (Em Dash Divider)</option>
            </select>
          </div>
        </div>

        {format === 'shunn' && (
          <div>
            <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Contact Details for the Title Page (one per line)</label>
            <textarea value={contact} onChange={e => setContact(e.target.value)} rows={3} placeholder={'Street address\nCity, State ZIP\nemail@example.com'}
              style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        )}

        {/* Scope and Word Count Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', backgroundColor: 'rgba(2,6,23,0.6)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color: '#94a3b8' }}>Compilation Scope:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span>All Chapters ({chaptersToCompile.length})</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" name="scope" checked={scope === 'active'} onChange={() => setScope('active')} />
              <span>Active Chapter Only</span>
            </label>
          </div>
          <span style={{ color: '#38bdf8', fontWeight: 700 }} title={`${totalWords.toLocaleString()} words exactly`}>about {displayWords.toLocaleString()} words</span>
        </div>

        {compileResult && (
          <div style={{ fontSize: '0.7rem', color: compileResult.error ? '#f87171' : '#34d399' }}>
            {compileResult.error || `Saved ${compileResult.fileName} to your Downloads folder.`}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.6rem' }}>
          <button onClick={onClose}
            style={{ padding: '0.4rem 0.8rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleCompile}
            disabled={isCompiling}
            style={{
              padding: '0.4rem 1.2rem',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontWeight: 700,
              cursor: isCompiling ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            {compileResult?.fileName ? <Check size={14} color="#34d399" /> : <Download size={14} />}
            <span>{isCompiling ? 'Compiling...' : 'Compile & Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
