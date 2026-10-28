import React, { useState, useRef, useEffect } from 'react';
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import {
  Globe, Sparkles, Code2, Eye, Download, Layers, Palette, Layout,
  Smartphone, Tablet, Monitor, Save, RefreshCw, Check, Loader2
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useKernel } from '../../kernel/useKernel.js';
import { saveFile } from '../../services/fileStorageService.js';

const TEMPLATES = [
  {
    id: 'landing',
    name: 'Sovereign SaaS Landing',
    description: 'High-conversion hero, features grid, pricing tier, and CTA.',
    html: `<div class="hero">
  <h1>Decentralized Computing for the Sovereign Era</h1>
  <p>Own your data, operate local AI, and command an unkillable workstation.</p>
  <button class="btn-primary">Launch Console</button>
</div>
<section class="features">
  <div class="card"><h3>Zero Cloud Host</h3><p>Your database stays on your hardware.</p></div>
  <div class="card"><h3>Dual Companions</h3><p>Aura & Nova orchestrate your OS.</p></div>
  <div class="card"><h3>Real Code Engine</h3><p>Cybeni IDE writes and validates production code.</p></div>
</section>`,
    css: `body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0a0f; color: #f1f5f9; margin: 0; padding: 40px 20px; text-align: center; }
.hero { max-width: 800px; margin: 0 auto 60px; }
h1 { font-size: 2.75rem; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
p { color: #94a3b8; font-size: 1.15rem; line-height: 1.6; }
.btn-primary { background: linear-gradient(135deg, #0284c7, #4f46e5); color: white; border: none; padding: 12px 28px; font-size: 1rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: transform 0.2s; }
.btn-primary:hover { transform: scale(1.05); }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; max-width: 900px; margin: 0 auto; }
.card { background: #13131e; border: 1px solid #1e293b; padding: 24px; border-radius: 12px; text-align: left; }
.card h3 { color: #38bdf8; margin-top: 0; }
.card p { color: #64748b; font-size: 0.95rem; margin-bottom: 0; }`,
    js: `document.querySelector('.btn-primary')?.addEventListener('click', () => { alert('Sovereign console engaged!'); });`,
  },
  {
    id: 'portfolio',
    name: 'Architect Portfolio',
    description: 'Clean minimalist dark showcase for engineers and creators.',
    html: `<header>
  <h2>Elena Vance</h2>
  <p>Autonomous Systems Architect & Creative Technologist</p>
</header>
<main class="gallery">
  <div class="project-card"><h4>Aether Mesh</h4><p>P2P distributed compute layer.</p></div>
  <div class="project-card"><h4>Ghostwriter IDE</h4><p>Semantic literary synthesis engine.</p></div>
</main>`,
    css: `body { background: #030712; color: #f9fafb; font-family: monospace; padding: 40px; margin: 0; }
header { border-bottom: 1px solid #1f2937; padding-bottom: 24px; margin-bottom: 32px; }
h2 { font-size: 2rem; color: #34d399; margin: 0 0 8px; }
.gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.project-card { border: 1px solid #374151; padding: 20px; border-radius: 6px; background: #111827; }
.project-card h4 { margin: 0 0 8px; color: #60a5fa; }`,
    js: ``,
  },
];

export default function WebsiteBuilderWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code' | 'templates'
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [html, setHtml] = useState(TEMPLATES[0].html);
  const [css, setCss] = useState(TEMPLATES[0].css);
  const [js, setJs] = useState(TEMPLATES[0].js);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  const iframeRef = useRef(null);

  const getCombinedDoc = () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>${js}<\/script>
</body>
</html>`;

  useEffect(() => {
    if (activeTab === 'preview' && iframeRef.current) {
      iframeRef.current.srcdoc = getCombinedDoc();
    }
  }, [html, css, js, activeTab]);

  const handleApplyTemplate = (tpl) => {
    setHtml(tpl.html);
    setCss(tpl.css);
    setJs(tpl.js);
    setActiveTab('preview');
  };

  const handleAIGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const reply = await kernel?.ai?.chat([
        {
          role: 'system',
          content: `You are a world-class frontend designer. Generate clean, responsive, modern HTML and CSS based on the user request.
Respond with JSON only:
{
  "html": "...body contents...",
  "css": "...all styles...",
  "js": "...interactive code..."
}`
        },
        { role: 'user', content: prompt }
      ], { persona: 'aura' });

      const parsed = JSON.parse(reply.replace(/```(?:json)?/g, '').trim());
      if (parsed.html) setHtml(parsed.html);
      if (parsed.css) setCss(parsed.css);
      if (parsed.js) setJs(parsed.js);
      setActiveTab('preview');
    } catch (err) {
      alert(`AI generation note: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToFiles = async () => {
    const fullHtml = getCombinedDoc();
    await saveFile('/projects/website/index.html', fullHtml, 'text/html');
    setSaveNotice('Saved to /projects/website/index.html');
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const handleDownload = () => {
    const fullHtml = getCombinedDoc();
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="h-12 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-xs">Website Studio</span>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'preview' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visual</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'code' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'templates' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Templates</span>
          </button>
        </div>

        {/* Responsive buttons & actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'preview' && (
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 mr-2">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-1.5 rounded ${device === 'desktop' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
                title="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('tablet')}
                className={`p-1.5 rounded ${device === 'tablet' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
                title="Tablet View"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-1.5 rounded ${device === 'mobile' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleSaveToFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save to Files</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export HTML</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/60 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'preview' && (
          <div className="flex-1 flex flex-col bg-slate-900/40 overflow-hidden">
            {/* AI Prompt Header */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center gap-2 shrink-0">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                placeholder="Ask Aura to redesign, add sections, or customize themes..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleAIGenerate}
                disabled={generating}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shrink-0"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate</span>
              </button>
            </div>

            {/* Viewport Frame */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              <div
                className={`h-full bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-slate-700 ${
                  device === 'desktop' ? 'w-full' : device === 'tablet' ? 'w-[768px]' : 'w-[375px]'
                }`}
              >
                <iframe
                  ref={iframeRef}
                  title="Website Preview"
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 grid grid-cols-2 divide-x divide-slate-800">
              <div className="flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-cyan-400">
                  HTML Structure
                </div>
                <div className="flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language="html"
                    value={html}
                    onChange={(val) => setHtml(val || '')}
                    options={{ minimap: { enabled: false }, fontSize: 12 }}
                  />
                </div>
              </div>

              <div className="flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-blue-400">
                  CSS Styling
                </div>
                <div className="flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language="css"
                    value={css}
                    onChange={(val) => setCss(val || '')}
                    options={{ minimap: { enabled: false }, fontSize: 12 }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-4">
              <h3 className="text-sm font-semibold text-slate-100">Starter Design Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATES.map(tpl => (
                  <div
                    key={tpl.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 hover:border-cyan-500/50 transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-300">{tpl.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                    </div>
                    <button
                      onClick={() => handleApplyTemplate(tpl)}
                      className="w-full py-2 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded-lg text-xs font-medium text-slate-200 transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
