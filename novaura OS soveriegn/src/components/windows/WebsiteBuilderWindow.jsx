import React, { useState, useRef, useEffect, useMemo } from 'react';
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import {
  Globe, Sparkles, Code2, Eye, Download, Layers, Palette, Layout,
  Smartphone, Tablet, Monitor, Save, RefreshCw, Check, Loader2,
  Radio, Rocket, ShieldCheck, ExternalLink, X
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useKernel } from '../../kernel/useKernel.js';
import { saveFile, triggerDownload } from '../../services/fileStorageService.js';
import { publishHostedSite, getLocalIdentity } from '../../services/sovereignMesh.js';
import { generateAuthEmbedSnippet } from '../../services/novaAuthClient.js';

import { MULTIPAGE_TEMPLATES, LIVING_BACKGROUNDS } from '../../services/templates/websiteTemplates.js';
import { tagEditable, applyBuilderEdit, extractTemplateFields, EDIT_BRIDGE_SCRIPT } from '../../services/templates/builderEditBridge.js';
import { loadSiteIntoFrame, clearSitePreview, newSiteSession } from '../../services/sitePreview.js';

export default function WebsiteBuilderWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('templates'); // 'preview' | 'code' | 'templates'
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [activeTemplateId, setActiveTemplateId] = useState(MULTIPAGE_TEMPLATES[0].id);
  const [activeBgId, setActiveBgId] = useState(MULTIPAGE_TEMPLATES[0].backgroundId || 'aurora');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [html, setHtml] = useState(MULTIPAGE_TEMPLATES[0].html);
  const [css, setCss] = useState(MULTIPAGE_TEMPLATES[0].css);
  const [js, setJs] = useState(MULTIPAGE_TEMPLATES[0].js);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);

  // 1-Click Decentralized Mesh Deployment State
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployDomain, setDeployDomain] = useState('chronicle.nova');
  const [deployTitle, setDeployTitle] = useState('Sovereign Chronicle');
  const [deployOwner, setDeployOwner] = useState('operator');
  const [deployFaction, setDeployFaction] = useState('nova'); // 'nova' | 'aura'
  const [deployFavicon, setDeployFavicon] = useState('📰');
  const [deployCategory, setDeployCategory] = useState('Media & Publishing');
  const [injectAuthSdk, setInjectAuthSdk] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState('');

  const iframeRef = useRef(null);
  const htmlRef = useRef(html);
  const keepPreview = useRef(false);
  useEffect(() => { htmlRef.current = html; }, [html]);

  // The page as saved and published; the preview adds the edit bridge (see builderEditBridge.js).
  const getCombinedDoc = ({ preview = false } = {}) => {
    const bg = LIVING_BACKGROUNDS[activeBgId];
    const bgCss = bg ? bg.css : '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
${bgCss}
${css}
  </style>
</head>
<body>
${preview ? tagEditable(html) : html}
<script>${js}<\/script>
${preview ? EDIT_BRIDGE_SCRIPT : ''}
</body>
</html>`;
  };

  const previewSession = useRef(newSiteSession());
  useEffect(() => () => { clearSitePreview(previewSession.current); }, []);
  useEffect(() => {
    if (activeTab === 'preview' && iframeRef.current) {
      // An edit that came from the preview is already on screen; reloading would lose the caret.
      if (keepPreview.current) { keepPreview.current = false; return; }
      loadSiteIntoFrame(iframeRef.current, getCombinedDoc({ preview: true }), { session: previewSession.current })
        .catch(err => setSaveNotice(`Preview failed: ${err?.message || err}`));
    }
  }, [html, css, js, activeBgId, activeTab]);

  // Text typed and photos dropped in the preview are written back into the page source.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow || !e.data?.novauraBuilderEdit) return;
      const { key, html: inner } = e.data;
      if (typeof key !== 'string' || typeof inner !== 'string' || inner.length > 600_000) return;
      const next = applyBuilderEdit(htmlRef.current, key, inner);
      if (next === htmlRef.current) return;
      keepPreview.current = true;
      htmlRef.current = next;
      setHtml(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Parsing the page is not free (photos are inlined), so only redo it when the page changes.
  const editableFields = useMemo(() => extractTemplateFields(html), [html]);

  const handleQuickFillPatch = (key, newInnerHtml) => {
    const next = applyBuilderEdit(htmlRef.current, key, newInnerHtml);
    if (next === htmlRef.current) return;
    keepPreview.current = true;
    htmlRef.current = next;
    setHtml(next);
    iframeRef.current?.contentWindow?.postMessage(
      { novauraDrawerPatch: 1, key, html: newInnerHtml },
      '*'
    );
  };

  // Typed text goes in as text, never as markup.
  const handleQuickFillText = (key, text) => {
    const escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    handleQuickFillPatch(key, escaped);
  };

  // Same treatment as a photo dropped in the preview (builderEditBridge.js): scaled to
  // 2560 px and stored as WebP, so a page with several photos stays inside one mesh packet.
  const handleQuickImageUpload = (key, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      handleQuickFillPatch(key, `<img src="${c.toDataURL('image/webp', 0.9)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setSaveNotice('That image could not be read.'); };
    img.src = url;
  };

  const handleApplyTemplate = (tpl) => {
    setActiveTemplateId(tpl.id);
    setHtml(tpl.html);
    setCss(tpl.css);
    setJs(tpl.js);
    if (tpl.backgroundId) {
      setActiveBgId(tpl.backgroundId);
    }
    const cleanTitle = tpl.name.split('—')[0].trim();
    setDeployTitle(cleanTitle);
    if (tpl.favicon) setDeployFavicon(tpl.favicon);
    if (tpl.category) setDeployCategory(tpl.category);
    setDeployDomain(`${tpl.id}.nova`);
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
    triggerDownload('index.html', new Blob([getCombinedDoc()], { type: 'text/html' }));
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
            <>
              {/* Living Background Selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400 text-[11px] hidden sm:inline">Living BG:</span>
                <select
                  value={activeBgId}
                  onChange={(e) => setActiveBgId(e.target.value)}
                  className="bg-transparent border-none text-cyan-300 font-semibold outline-none text-xs cursor-pointer"
                >
                  {Object.values(LIVING_BACKGROUNDS).map(bg => (
                    <option key={bg.id} value={bg.id} className="bg-slate-900 text-slate-100">
                      {bg.name}
                    </option>
                  ))}
                  <option value="none" className="bg-slate-900 text-slate-100">Minimal (None)</option>
                </select>
              </div>

              {/* Viewport Resizing */}
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
            </>
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
            {/* Interactive hint ribbon */}
            <div className="px-4 py-1.5 bg-cyan-950/40 border-b border-cyan-500/20 text-[11px] text-cyan-300/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>
                  <b>1-Click Multi-Page Editor:</b> Single-click any text or photo slot on the page to edit, or open <b>Quick Fill & Images</b> to fill in the blanks!
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQuickFill(!showQuickFill)}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] uppercase font-bold border transition-all cursor-pointer ${
                    showQuickFill
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                  }`}
                >
                  ⚡ {showQuickFill ? 'Hide Quick-Fill Drawer' : `Quick Fill & Images (${editableFields.textFields.length + editableFields.imageSlots.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('templates')}
                  className="text-[10px] uppercase font-bold text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
                >
                  Browse All Templates →
                </button>
              </div>
            </div>

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
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate</span>
              </button>
            </div>

            {/* Viewport Frame + Optional Quick-Fill & Image Uploader Drawer */}
            <div className="flex-1 flex overflow-hidden bg-slate-950/60">
              {showQuickFill && (
                <aside className="w-80 border-r border-slate-800 bg-slate-900/95 flex flex-col overflow-hidden shrink-0">
                  <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-cyan-400">⚡ Quick Fill-in-the-Blanks</h4>
                      <p className="text-[10px] text-slate-400">Type below or upload images with 1 click</p>
                    </div>
                    <button
                      onClick={() => setShowQuickFill(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* 1-Click Image Upload Slots */}
                    {editableFields.imageSlots.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                          📷 Photo & Banner Slots ({editableFields.imageSlots.length})
                        </div>
                        {editableFields.imageSlots.map((slot) => (
                          <div key={slot.key} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-300 font-medium truncate">{slot.label}</span>
                              {slot.hasImage && <span className="text-[10px] text-emerald-400 font-bold">✓ Image Set</span>}
                            </div>
                            <label className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold cursor-pointer transition-colors">
                              <span>📤 Choose Image File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => { handleQuickImageUpload(slot.key, e.target.files?.[0]); e.target.value = ''; }}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fill-in-the-Blank Text Fields */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                        ✏️ Editable Text Blanks ({editableFields.textFields.length})
                      </div>
                      {editableFields.textFields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-mono">
                            {field.label} ({field.key})
                          </label>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleQuickFillText(field.key, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-md px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              )}

              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                <div
                  className={`h-full bg-black rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-slate-800 ${
                    device === 'desktop' ? 'w-full' : device === 'tablet' ? 'w-[768px]' : 'w-[375px]'
                  }`}
                >
                  <iframe
                    ref={iframeRef}
                    title="Website Preview"
                    // No allow-same-origin: the page's scripts must not reach the OS (keys, IndexedDB, native calls).
                    // loadSiteIntoFrame serves it from the isolated preview origin so its scripts can run.
                    sandbox="allow-scripts allow-forms allow-modals allow-popups"
                    className="w-full h-full border-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 grid grid-cols-2 divide-x divide-slate-800">
              <div className="flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-cyan-400 flex items-center justify-between">
                  <span>HTML Structure & Content</span>
                  <span className="text-[10px] text-slate-500">Edit elements directly</span>
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
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-blue-400 flex items-center justify-between">
                  <span>CSS Styles & Animations</span>
                  <span className="text-[10px] text-slate-500">Living BG included</span>
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
          <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Header Hero */}
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sovereign Website Architecture</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Full-Featured Prebuilt Multi-Page Templates</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every template is a complete, functioning decentralized website with tabbed navigation, live forms, calculators, drag & drop image dropzones, and living backgrounds. Click any template to customize and publish to the mesh.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { id: 'all', label: `All Templates (${MULTIPAGE_TEMPLATES.length})` },
                  { id: 'Games & Metaverse', label: '🕹️ Game Arcade' },
                  { id: 'E-Commerce & Storefront', label: '🛍️ Creator Storefront' },
                  { id: 'Media & Publishing', label: 'Tech Blog' },
                  { id: 'Community & Social', label: 'Forum' },
                  { id: 'Real-Time Messaging', label: 'Chatroom' },
                  { id: 'Portfolio & Creative', label: 'Portfolio' },
                  { id: 'Local Business & Trades', label: 'Landscaping' },
                  { id: 'Enterprise & SaaS', label: 'Corporate Company' },
                  { id: 'Documentation & Knowledge', label: 'Wiki Docs' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setTemplateFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      templateFilter === cat.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/25'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {MULTIPAGE_TEMPLATES.filter(tpl => templateFilter === 'all' || tpl.category === templateFilter).map(tpl => {
                  const isActive = activeTemplateId === tpl.id;
                  const bg = LIVING_BACKGROUNDS[tpl.backgroundId] || LIVING_BACKGROUNDS.aurora;
                  return (
                    <div
                      key={tpl.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isActive
                          ? 'bg-slate-900/90 border-cyan-500 shadow-xl shadow-cyan-500/10'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Header Badges */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{tpl.favicon}</span>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                                {tpl.category}
                              </span>
                              <h4 className="text-base font-bold text-white leading-tight">
                                {tpl.name.split('—')[0]}
                              </h4>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                            {tpl.badge}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                          {tpl.description}
                        </p>

                        {/* Feature Points */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                          <span className="flex items-center gap-1 text-slate-300">
                            <Layers className="w-3 h-3 text-cyan-400" /> Multi-Page Tabs
                          </span>
                          <span className="flex items-center gap-1 text-slate-300">
                            <Sparkles className="w-3 h-3 text-purple-400" /> {bg.name.split(' ')[0]} BG
                          </span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Check className="w-3 h-3" /> Drag & Drop Ready
                          </span>
                        </div>
                      </div>

                      <div className="pt-5 flex items-center gap-3">
                        <button
                          onClick={() => handleApplyTemplate(tpl)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isActive
                              ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                              : 'bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white'
                          }`}
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          <span>{isActive ? 'Current Active Design' : 'Use This Template'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Living Atmospheric Backgrounds Showcase */}
              <div className="pt-8 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Living Atmospheric Backgrounds</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      High-performance procedural CSS & Canvas living backgrounds that breathe life into any template.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.values(LIVING_BACKGROUNDS).map(bg => {
                    const isSelected = activeBgId === bg.id;
                    return (
                      <div
                        key={bg.id}
                        onClick={() => setActiveBgId(bg.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 border-cyan-400 shadow-md shadow-cyan-500/20'
                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{bg.name}</span>
                          {isSelected && <span className="text-[10px] text-cyan-400 font-mono font-bold">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {bg.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
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
