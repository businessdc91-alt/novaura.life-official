import React, { useState, useRef, useEffect } from 'react';
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import {
  Globe, Sparkles, Code2, Eye, Download, Layers, Palette, Layout,
  Smartphone, Tablet, Monitor, Save, RefreshCw, Check, Loader2,
  Radio, Rocket, ShieldCheck, ExternalLink, X
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useKernel } from '../../kernel/useKernel.js';
import { saveFile } from '../../services/fileStorageService.js';
import { publishHostedSite, getLocalIdentity } from '../../services/sovereignMesh.js';
import { generateAuthEmbedSnippet } from '../../services/novaAuthClient.js';

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

  // 1-Click Decentralized Mesh Deployment State
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployDomain, setDeployDomain] = useState('mysite.nova');
  const [deployTitle, setDeployTitle] = useState('My Sovereign Website');
  const [deployOwner, setDeployOwner] = useState('operator');
  const [deployFaction, setDeployFaction] = useState('nova'); // 'nova' | 'aura'
  const [deployFavicon, setDeployFavicon] = useState('🌐');
  const [deployCategory, setDeployCategory] = useState('Infrastructure & Tools');
  const [injectAuthSdk, setInjectAuthSdk] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState('');

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

  const handleOpenDeployModal = () => {
    const id = getLocalIdentity();
    setDeployOwner(id?.handle || 'operator');
    setDeployError('');
    setDeployResult(null);
    setShowDeployModal(true);
  };

  const handlePublishToMesh = async () => {
    setDeploying(true);
    setDeployError('');
    try {
      let rawHtml = getCombinedDoc();

      // Automatically inject NovAura Auth SDK if user enabled it
      if (injectAuthSdk && !rawHtml.includes('window.NovaAuth')) {
        const snippet = generateAuthEmbedSnippet(deployDomain);
        if (rawHtml.includes('</head>')) {
          rawHtml = rawHtml.replace('</head>', `${snippet}\n</head>`);
        } else {
          rawHtml = `${snippet}\n${rawHtml}`;
        }
      }

      const published = await publishHostedSite({
        domain: deployDomain,
        title: deployTitle,
        ownerHandle: deployOwner,
        htmlContent: rawHtml,
        faction: deployFaction,
        favicon: deployFavicon || (deployFaction === 'aura' ? '✨' : '🌐'),
        category: deployCategory,
      });

      setDeployResult(published);
    } catch (err) {
      setDeployError(err.message || 'Failed to publish to mesh.');
    } finally {
      setDeploying(false);
    }
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export HTML</span>
          </button>

          {/* 1-Click Free Decentralized Hosting */}
          <button
            onClick={handleOpenDeployModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-200" />
            <span>Deploy to .nova Mesh</span>
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

      {/* ── 1-Click Decentralized Mesh Deploy Modal ── */}
      {showDeployModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Deploy to Decentralized Sovereign Mesh</h3>
                  <p className="text-xs text-slate-400">100% Free P2P Hosting • Zero Cloud Dependency</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {deployResult ? (
                /* Success State */
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Successfully Published to Sovereign Mesh!</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Your website has been signed with your node key and broadcast to peer machines across the network.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Domain:</span>
                      <span className={`font-bold flex items-center gap-1.5 ${deployResult.faction === 'aura' ? 'text-violet-400' : 'text-cyan-400'}`}>
                        <span>{deployResult.favicon || '🌐'}</span>
                        <span>{deployResult.faction === 'aura' ? 'aura://' : 'nova://'}{deployResult.domain}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Mesh Faction:</span>
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                        deployResult.faction === 'aura' ? 'bg-violet-950 text-violet-300 border border-violet-500/40' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                      }`}>
                        {deployResult.faction === 'aura' ? '✨ Aura Mesh (Neural)' : '⚡ Nova Mesh (Logic)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Content ID (CID):</span>
                      <span className="text-slate-300 truncate max-w-[200px]" title={deployResult.cid}>{deployResult.cid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Node Signature:</span>
                      <span className="text-emerald-400">Ed25519 Verified</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowDeployModal(false);
                        kernel?.openApp?.('browser');
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Sovereign Browser</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Form State */
                <>
                  {/* Faction Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Mesh Network Faction</span>
                      <span className="text-[10px] text-slate-500 font-normal">Dual-Mesh Ecosystem</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeployFaction('nova');
                          setDeployDomain(prev => prev.replace(/\.aura$/, '.nova').replace(/(?<!\.nova)$/, '.nova'));
                          if (deployFavicon === '✨') setDeployFavicon('🌐');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          deployFaction === 'nova'
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          <Radio className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Nova Mesh (.nova)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          Logic, compute density, and cryptographic privacy network.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeployFaction('aura');
                          setDeployDomain(prev => prev.replace(/\.nova$/, '.aura').replace(/(?<!\.aura)$/, '.aura'));
                          if (deployFavicon === '🌐') setDeployFavicon('✨');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          deployFaction === 'aura'
                            ? 'bg-violet-950/60 border-violet-500 text-violet-200 shadow-md shadow-violet-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                          <span>Aura Mesh (.aura)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          Neural synthesis, creative agents, and aesthetic consciousness.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Target Domain Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Target {deployFaction === 'aura' ? '.aura' : '.nova'} Domain
                    </label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono">
                      <span className="text-slate-500 select-none mr-1">
                        {deployFaction === 'aura' ? 'aura://' : 'nova://'}
                      </span>
                      <input
                        type="text"
                        value={deployDomain}
                        onChange={(e) => setDeployDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                        placeholder={deployFaction === 'aura' ? 'mysite.aura' : 'mysite.nova'}
                        className={`flex-1 bg-transparent border-none outline-none font-bold ${
                          deployFaction === 'aura' ? 'text-violet-300' : 'text-cyan-300'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Favicon & Category Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Site Favicon (Emoji / Icon)</label>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-lg select-none shrink-0">
                          {deployFavicon}
                        </div>
                        <input
                          type="text"
                          value={deployFavicon}
                          onChange={(e) => setDeployFavicon(e.target.value)}
                          maxLength={4}
                          placeholder="🌐"
                          className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-center text-xs text-slate-100 outline-none focus:border-cyan-500"
                        />
                        <div className="flex items-center gap-1 overflow-x-auto py-1">
                          {['🌐', '⚡', '✨', '🔮', '🚀', '🛡️', '🪐', '👑', '🎨', '🔥', '🧬'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setDeployFavicon(emoji)}
                              className="w-6 h-6 rounded hover:bg-slate-800 flex items-center justify-center text-xs cursor-pointer transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Mesh Category</label>
                      <select
                        value={deployCategory}
                        onChange={(e) => setDeployCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                      >
                        <option value="Infrastructure & Tools">Infrastructure & Tools</option>
                        <option value="Creative & Neural">Creative & Neural</option>
                        <option value="DeFi & Treasury">DeFi & Treasury</option>
                        <option value="Social & Community">Social & Community</option>
                        <option value="Games & Metaverse">Games & Metaverse</option>
                        <option value="AI & Autonomous Agents">AI & Autonomous Agents</option>
                        <option value="General & Personal">General & Personal</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Site Title</label>
                      <input
                        type="text"
                        value={deployTitle}
                        onChange={(e) => setDeployTitle(e.target.value)}
                        placeholder="My Project Title"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Publisher Handle</label>
                      <input
                        type="text"
                        value={deployOwner}
                        onChange={(e) => setDeployOwner(e.target.value)}
                        placeholder="operator"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Auth SDK Injection Toggle */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={injectAuthSdk}
                        onChange={(e) => setInjectAuthSdk(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span>Enable "Sign in with NovAura" (SIWN)</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 font-mono">
                            Decentralized Auth
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                          Automatically injects the zero-dependency client SDK so visitors can sign in with their cryptographic node key.
                        </p>
                      </div>
                    </label>
                  </div>

                  {deployError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
                      <X className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{deployError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      onClick={() => setShowDeployModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePublishToMesh}
                      disabled={deploying || !deployDomain.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {deploying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Signing & Broadcasting...</span>
                        </>
                      ) : (
                        <>
                          <Rocket className="w-3.5 h-3.5" />
                          <span>Publish to Sovereign Mesh</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
