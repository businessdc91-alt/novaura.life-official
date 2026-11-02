// EbookPublisherModal.jsx — Typesetting, Standard Manuscript & E-Book Compiler
import React, { useState } from 'react';
import {
  Printer, X, Download, FileText, Check, BookOpen, Layers
} from 'lucide-react';

export default function EbookPublisherModal({
  files,
  activeDoc,
  authorName = 'Dillan Copeland',
  onClose
}) {
  const [format, setFormat] = useState('shunn'); // 'shunn' | 'epub' | 'html' | 'markdown'
  const [title, setTitle] = useState(activeDoc?.name?.replace(/\.[^/.]+$/, '') || 'Untitled Manuscript');
  const [author, setAuthor] = useState(authorName);
  const [penName, setPenName] = useState('');
  const [email, setEmail] = useState('author@sovereign.local');
  const [sceneBreakStyle, setSceneBreakStyle] = useState('#'); // '#' | '* * *' | 'space'
  const [scope, setScope] = useState('all'); // 'all' | 'active'
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileSuccess, setCompileSuccess] = useState(false);

  const chaptersToCompile = scope === 'all'
    ? files.filter(f => f.type === 'chapter')
    : [activeDoc].filter(Boolean);

  const totalWords = chaptersToCompile.reduce((acc, c) => acc + (c.wordCount || 0), 0);
  const roundedWordCount = Math.round(totalWords / 100) * 100;

  const handleCompile = () => {
    setIsCompiling(true);
    setCompileSuccess(false);

    try {
      let outputContent = '';
      let mimeType = 'text/plain';
      let fileExt = 'txt';

      if (format === 'shunn') {
        // William Shunn Standard Manuscript Format
        const headerBlock = `${author.toUpperCase()}\n${email}\nApprox. ${roundedWordCount} words\n\n\n\n\n\n\n\n\n\n` +
          `${title.toUpperCase()}\n` +
          `by ${penName || author}\n\n\n\n\n\n\n`;

        let bodyProse = '';
        chaptersToCompile.forEach((ch, idx) => {
          bodyProse += `\n\n[PAGE BREAK]\n\n`;
          bodyProse += `${author.split(' ').pop().toUpperCase()} / ${title.toUpperCase()} / ${idx + 1}\n\n`;
          bodyProse += `${ch.name.toUpperCase()}\n\n`;
          
          let plain = (ch.content || '')
            .replace(/<div[^>]*>\s*\*\s*\*\s*\*\s*<\/div>/gi, `\n\n${sceneBreakStyle}\n\n`)
            .replace(/<hr[^>]*>/gi, `\n\n${sceneBreakStyle}\n\n`)
            .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '    $1\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ');
          
          bodyProse += plain;
        });

        outputContent = headerBlock + bodyProse;
        mimeType = 'text/plain';
        fileExt = 'txt';
      } else if (format === 'markdown') {
        outputContent = `# ${title}\n**By ${penName || author}**\n\n*Word Count: ~${totalWords}*\n\n---\n\n`;
        chaptersToCompile.forEach(ch => {
          outputContent += `\n\n## ${ch.name}\n\n`;
          outputContent += (ch.content || '')
            .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<[^>]+>/g, '');
        });
        mimeType = 'text/markdown';
        fileExt = 'md';
      } else {
        // Clean Formatted HTML / EPUB XHTML Structure
        outputContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>` +
          `<style>body{font-family:'Courier Prime',Courier,monospace;line-height:2;margin:1.5in;max-width:800px;font-size:12pt;}` +
          `h1,h2{text-align:center;text-transform:uppercase;margin:2em 0;}p{text-indent:0.5in;margin:0;}</style></head><body>` +
          `<div style="text-align:center;margin-top:2in;"><h1>${title}</h1><h3>by ${penName || author}</h3><p style="text-indent:0;color:#666;">Approx. ${roundedWordCount} words</p></div><hr style="page-break-after:always;"/>`;

        chaptersToCompile.forEach(ch => {
          outputContent += `<div class="chapter">${ch.content}</div><hr style="page-break-after:always;"/>`;
        });
        outputContent += `</body></html>`;
        mimeType = 'text/html';
        fileExt = 'html';
      }

      // Trigger direct download
      const blob = new Blob([outputContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${format}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCompileSuccess(true);
      setTimeout(() => setCompileSuccess(false), 3000);
    } catch (err) {
      alert('Compile error: ' + err.message);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
            {[
              { id: 'shunn', label: 'Shunn Manuscript', desc: 'Standard submission format (Courier 12pt, double spaced)' },
              { id: 'html', label: 'E-Book / EPUB HTML', desc: 'Semantic XHTML suitable for Kindle & e-readers' },
              { id: 'markdown', label: 'Clean Markdown', desc: 'Portable prose document (.md)' },
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
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>~{roundedWordCount} words</span>
        </div>

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
            {compileSuccess ? <Check size={14} color="#34d399" /> : <Download size={14} />}
            <span>{compileSuccess ? 'Downloaded!' : isCompiling ? 'Compiling...' : 'Compile & Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
