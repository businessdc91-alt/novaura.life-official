// ComicMangaTab.jsx — Interactive Comic Book & Manga Page Designer with Multi-Output Per-Panel AI Picker.
// Supports 7 templates (US Comic, Japanese RTL Manga, Webtoon, Cover Splash), local upload or 2x/4x AI generation
// per panel, speech/thought/shout/narration/SFX bubbles, real B&W Manga Screentone filter, and 300 DPI PNG export.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Sparkles, Upload, Download, Plus, Trash2, Palette,
  Check, MessageSquare, Layers, Wand2, Eye
} from 'lucide-react';
import {
  COMIC_FORMATS,
  COMIC_TEMPLATES,
  BUBBLE_KINDS,
  createBubble,
  renderComicPageToCanvas,
} from '../../../services/print/comicEngine.js';
import { downloadCanvasPng } from '../../../services/print/printEngine.js';
import { IMAGE_PROVIDERS, generateMultiCandidates } from '../../../services/media/pixEngine.js';
import { sendImageToCreativeStudio } from '../../../services/media/creativeBridge.js';
import { saveArtworkToVault } from '../../../services/mediaFoundryService.js';

const PANEL_STYLES = [
  { id: 'comic_color', label: 'American Comic Ink & Color', suffix: 'dynamic American comic book panel art, bold black India-ink linework, rich halftone comic colorist grading, NO speech bubbles, NO text' },
  { id: 'manga_bw', label: 'B&W Japanese Manga Screentone', suffix: 'authentic black and white Japanese manga panel art, sharp G-pen ink lines, kinetic speedlines, fine dot screentones, monochrome ink only, NO speech bubbles, NO text' },
  { id: 'webtoon', label: 'Full-Color Webtoon / Manhwa', suffix: 'modern full-color Korean webtoon manhwa illustration, clean cel-shaded linework, glowing cinematic lighting, expressive characters, NO text, NO speech bubbles' },
  { id: 'noir', label: 'Graphic Novel Noir Ink', suffix: 'high-contrast neo-noir graphic novel panel illustration, dramatic spotted blacks, moody selective crimson and cyan accents, Sin City and Batman Year One style, NO text' },
];

export default function ComicMangaTab({
  incomingImage = null,
  daemonOnline,
  comfyEndpoint,
  availableCheckpoints,
  selectedCheckpoint,
  onVaultUpdated,
  onNotice,
  onError,
}) {
  const [formatId, setFormatId] = useState('us_comic');
  const [templateId, setTemplateId] = useState('action_5');
  const [pageTitle, setPageTitle] = useState('');
  const [issueLabel, setIssueLabel] = useState('ISSUE #01');
  const [mangaFilter, setMangaFilter] = useState(false);
  const [gutterColor, setGutterColor] = useState('#ffffff');

  const [selectedPanelId, setSelectedPanelId] = useState('p1');
  const [panelImages, setPanelImages] = useState({});
  const [panelPrompts, setPanelPrompts] = useState({
    p1: 'A lone cyber-architect standing atop a rain-soaked neon tower overlooking a glowing quantum city',
    p2: 'Close-up of determined eyes reflecting cascading holographic code',
    p3: 'Twin mechanical gauntlets charging with electric sapphire lightning',
    p4: 'Leaping through shattered glass into a beam of starlight',
    p5: 'A mysterious silhouette watching from the shadows below',
  });
  const [panelCandidates, setPanelCandidates] = useState({});
  const [panelStyleId, setPanelStyleId] = useState('comic_color');
  const [provider, setProvider] = useState(() => (daemonOnline ? 'comfy' : 'gemini'));
  const [outputCount, setOutputCount] = useState(2);
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('novaura_byok_image_key') || ''; } catch { return ''; }
  });
  const [isGeneratingPanel, setIsGeneratingPanel] = useState(false);
  const [genStatus, setGenStatus] = useState('');

  // Speech / Narration / SFX Bubbles
  const [bubbles, setBubbles] = useState(() => [
    createBubble({ kind: 'narration', text: 'THE CITY NEVER SLEEPS WHEN THE SOVEREIGN GRID AWAKENS...', x: 0.06, y: 0.06, w: 0.44, h: 0.08, fontSize: 24 }),
    createBubble({ kind: 'speech', text: 'IT BEGINS TONIGHT.', x: 0.62, y: 0.14, w: 0.28, h: 0.09, tail: 'bottom-left', fontSize: 28 }),
  ]);
  const [selectedBubbleId, setSelectedBubbleId] = useState(null);

  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeTemplate = useMemo(
    () => COMIC_TEMPLATES.find(t => t.id === templateId) || COMIC_TEMPLATES[0],
    [templateId]
  );
  const activeFormat = useMemo(
    () => COMIC_FORMATS.find(f => f.id === formatId) || COMIC_FORMATS[0],
    [formatId]
  );
  const activePanel = useMemo(
    () => activeTemplate.panels.find(p => p.id === selectedPanelId) || activeTemplate.panels[0],
    [activeTemplate, selectedPanelId]
  );
  const selectedBubble = useMemo(
    () => bubbles.find(b => b.id === selectedBubbleId) || null,
    [bubbles, selectedBubbleId]
  );

  // Accept image sent directly from Pix Studio
  useEffect(() => {
    let cancelled = false;
    if (!incomingImage?.url) return () => { cancelled = true; };
    Promise.resolve().then(() => {
      if (cancelled) return;
      const targetPanel = activePanel?.id || 'p1';
      setPanelImages(prev => ({ ...prev, [targetPanel]: incomingImage.url }));
      onNotice?.(`Placed artwork into ${activePanel?.label || 'Panel 1'}.`);
    });
    return () => { cancelled = true; };
  }, [incomingImage, activePanel, onNotice]);

  // Live render page canvas whenever layout, art, filter, or bubbles change
  useEffect(() => {
    let cancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas) return () => { cancelled = true; };
    renderComicPageToCanvas(canvas, {
      formatId,
      templateId,
      pageTitle,
      issueLabel,
      panelImages,
      bubbles,
      mangaFilter,
      gutterColor,
    }).catch(() => {
      if (!cancelled) {
        // Ignore transient image decode cancellations
      }
    });
    return () => { cancelled = true; };
  }, [formatId, templateId, pageTitle, issueLabel, panelImages, bubbles, mangaFilter, gutterColor]);

  const handleUploadPanelImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pid = activePanel.id;
      setPanelImages(prev => ({ ...prev, [pid]: String(reader.result || '') }));
      onNotice?.(`Loaded local artwork into ${activePanel.label}.`);
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePanelOutputs = async () => {
    const pid = activePanel.id;
    const scene = String(panelPrompts[pid] || '').trim();
    if (!scene) {
      onError?.('Describe the scene for this panel first.');
      return;
    }
    if (provider === 'comfy' && !daemonOnline) {
      onError?.(`ComfyUI is offline at ${comfyEndpoint}. Start ComfyUI or switch to Gemini / OpenAI BYOK.`);
      return;
    }
    setIsGeneratingPanel(true);
    onError?.(null);
    setGenStatus(`Generating ${outputCount} candidate takes for ${activePanel.label}…`);

    try {
      const style = PANEL_STYLES.find(s => s.id === panelStyleId) || PANEL_STYLES[0];
      const panelRatio = (activePanel.w * activeFormat.width) / (activePanel.h * activeFormat.height);
      const genW = panelRatio > 1.25 ? 1152 : panelRatio < 0.78 ? 768 : 1024;
      const genH = panelRatio > 1.25 ? 768 : panelRatio < 0.78 ? 1152 : 1024;

      const results = await generateMultiCandidates({
        provider,
        prompt: `${scene}, ${style.suffix}`,
        negativePrompt: 'speech bubbles, text, captions, panel borders, watermark, blurry, deformed anatomy',
        width: genW,
        height: genH,
        count: outputCount,
        comfyEndpoint,
        checkpointName: selectedCheckpoint || availableCheckpoints[0] || '',
        apiKey,
        model: provider === 'gemini' ? 'gemini-2.5-flash-image' : provider === 'openai' ? 'gpt-image-1' : '',
        onProgress: (m) => setGenStatus(String(m || '')),
      });

      setPanelCandidates(prev => ({ ...prev, [pid]: results }));
      if (results[0]) {
        setPanelImages(prev => ({ ...prev, [pid]: results[0].url }));
      }
      onNotice?.(`Generated ${results.length} takes for ${activePanel.label}! Pick your favorite below.`);
    } catch (err) {
      onError?.(err.message || 'Panel generation failed.');
    } finally {
      setIsGeneratingPanel(false);
      setGenStatus('');
    }
  };

  const addBubble = (kind) => {
    const defaultText = kind === 'sfx' ? 'BOOM!' : kind === 'narration' ? 'MEANWHILE...' : kind === 'shout' ? 'WATCH OUT!' : 'Wait... what is that?!';
    const b = createBubble({
      kind,
      text: defaultText,
      x: Math.min(0.66, activePanel.x + 0.03),
      y: Math.min(0.84, activePanel.y + 0.03),
      w: kind === 'sfx' ? 0.24 : 0.28,
      h: kind === 'sfx' ? 0.1 : 0.1,
    });
    setBubbles(prev => [...prev, b]);
    setSelectedBubbleId(b.id);
  };

  const updateBubble = (id, patch) => {
    setBubbles(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  };

  const deleteBubble = (id) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
    if (selectedBubbleId === id) setSelectedBubbleId(null);
  };

  const handleExportPng = async () => {
    const canvas = document.createElement('canvas');
    await renderComicPageToCanvas(canvas, {
      formatId,
      templateId,
      pageTitle,
      issueLabel,
      panelImages,
      bubbles,
      mangaFilter,
      gutterColor,
    });
    downloadCanvasPng(canvas, `${(pageTitle || templateId).replace(/\s+/g, '_')}_300dpi.png`);
    onNotice?.(`Exported ${activeFormat.width}×${activeFormat.height} print-ready comic page PNG!`);
  };

  const handleSaveToVault = async () => {
    const canvas = document.createElement('canvas');
    await renderComicPageToCanvas(canvas, {
      formatId,
      templateId,
      pageTitle,
      issueLabel,
      panelImages,
      bubbles,
      mangaFilter,
      gutterColor,
    });
    const url = canvas.toDataURL('image/png');
    await saveArtworkToVault({
      title: `Comic Page: ${pageTitle || activeTemplate.name}`,
      prompt: Object.values(panelPrompts).join(' | '),
      imageUrl: url,
      provider: 'comic_studio',
      metadata: { width: activeFormat.width, height: activeFormat.height, templateId, formatId, tags: ['comic', 'manga', 'print'] },
    });
    onVaultUpdated?.();
    onNotice?.('Saved Comic/Manga page to Sovereign Media Vault!');
  };

  const handleOpenInCreativeStudio = async () => {
    const canvas = document.createElement('canvas');
    await renderComicPageToCanvas(canvas, {
      formatId,
      templateId,
      pageTitle,
      issueLabel,
      panelImages,
      bubbles,
      mangaFilter,
      gutterColor,
    });
    sendImageToCreativeStudio({
      imageUrl: canvas.toDataURL('image/png'),
      title: pageTitle || `Comic_${templateId}`,
    });
    onNotice?.('Opened full comic page inside Creative Studio for layered finishing!');
  };

  const currentCandidates = panelCandidates[activePanel.id] || [];

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* LEFT CONTROLS (5 cols) */}
      <div className="lg:col-span-5 space-y-3">
        {/* Page Format & Template Selector */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Comic &amp; Manga Page Architecture</span>
            </h3>
            <span className="text-[10px] font-mono text-sky-300 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-500/30">
              {activeFormat.width}×{activeFormat.height}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Print Page Format</label>
              <select
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                {COMIC_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Panel Layout Template</label>
              <select
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); setSelectedPanelId('p1'); }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                {COMIC_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Optional Page / Issue Title Banner</label>
              <input
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="Leave blank for interior page..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Issue Tag</label>
              <input
                type="text"
                value={issueLabel}
                onChange={(e) => setIssueLabel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={mangaFilter}
                onChange={(e) => setMangaFilter(e.target.checked)}
                className="accent-sky-500"
              />
              <span>Apply B&amp;W Manga Halftone Screentone Filter</span>
            </label>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>Gutter</span>
              <input
                type="color"
                value={gutterColor}
                onChange={(e) => setGutterColor(e.target.value)}
                className="w-6 h-5 bg-transparent border border-slate-700 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Active Panel Multi-Output Generator */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Active Panel: {activePanel.label}</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {activeTemplate.panels.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPanelId(p.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${activePanel.id === p.id
                      ? 'bg-sky-600 text-white'
                      : panelImages[p.id]
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                >
                  P{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={2}
            value={panelPrompts[activePanel.id] || ''}
            onChange={(e) => setPanelPrompts(prev => ({ ...prev, [activePanel.id]: e.target.value }))}
            placeholder="Describe action, camera angle, and character expression in this panel..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Art Style</label>
              <select
                value={panelStyleId}
                onChange={(e) => setPanelStyleId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              >
                {PANEL_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Outputs</label>
              <select
                value={outputCount}
                onChange={(e) => setOutputCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
              >
                <option value={2}>2× Picks</option>
                <option value={4}>4× Picks</option>
                <option value={1}>1× Single</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              {IMAGE_PROVIDERS.slice(0, 4).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {provider !== 'comfy' ? (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  try { localStorage.setItem('novaura_byok_image_key', e.target.value); } catch { }
                }}
                placeholder="Vault key auto-used or paste..."
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
              />
            ) : (
              <div className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 truncate flex items-center">
                {selectedCheckpoint || 'Local SDXL / Flux'}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGeneratePanelOutputs}
              disabled={isGeneratingPanel}
              className="flex-1 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingPanel ? 'animate-spin' : ''}`} />
              <span>{isGeneratingPanel ? genStatus || 'Drawing Panel…' : `Generate ${outputCount}× Panel Takes`}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadPanelImage(e.target.files[0])} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer border border-slate-700"
              title="Upload local image into this panel"
            >
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
          </div>

          {/* Multi-Output Panel Candidate Picker */}
          {currentCandidates.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-mono text-sky-300 uppercase">Pick Favorite Take for {activePanel.label}:</div>
              <div className="grid grid-cols-4 gap-1.5">
                {currentCandidates.map((c, idx) => {
                  const chosen = panelImages[activePanel.id] === c.url;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPanelImages(prev => ({ ...prev, [activePanel.id]: c.url }))}
                      className={`relative rounded-lg overflow-hidden border-2 cursor-pointer ${chosen ? 'border-amber-400 ring-2 ring-amber-500/30' : 'border-slate-700 hover:border-slate-500'
                        }`}
                    >
                      <img src={c.url} alt={`Take ${idx + 1}`} className="w-full h-16 object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/80 text-white px-1 rounded">#{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Speech Bubbles, Narration & SFX Controls */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Speech Bubbles, Captions &amp; SFX ({bubbles.length})</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {BUBBLE_KINDS.map(k => (
              <button
                key={k.id}
                type="button"
                onClick={() => addBubble(k.id)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1 border border-slate-700 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-amber-400" /> {k.label}
              </button>
            ))}
          </div>

          {bubbles.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {bubbles.map((b, i) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBubbleId(b.id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer ${selectedBubbleId === b.id ? 'border-amber-400 bg-amber-950/30 text-white' : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                >
                  <span className="truncate">
                    <b className="uppercase text-[10px] text-amber-300 mr-1.5">[{b.kind}]</b>
                    {b.text || `Bubble ${i + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteBubble(b.id); }}
                    className="text-rose-400 hover:text-rose-300 ml-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedBubble && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2 text-[11px]">
              <input
                type="text"
                value={selectedBubble.text}
                onChange={(e) => updateBubble(selectedBubble.id, { text: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-slate-400">
                  X Position ({Math.round(selectedBubble.x * 100)}%)
                  <input type="range" min="0.02" max="0.78" step="0.01" value={selectedBubble.x} onChange={(e) => updateBubble(selectedBubble.id, { x: Number(e.target.value) })} className="w-full accent-amber-500" />
                </label>
                <label className="text-slate-400">
                  Y Position ({Math.round(selectedBubble.y * 100)}%)
                  <input type="range" min="0.02" max="0.88" step="0.01" value={selectedBubble.y} onChange={(e) => updateBubble(selectedBubble.id, { y: Number(e.target.value) })} className="w-full accent-amber-500" />
                </label>
                <label className="text-slate-400">
                  Width ({Math.round(selectedBubble.w * 100)}%)
                  <input type="range" min="0.14" max="0.86" step="0.02" value={selectedBubble.w} onChange={(e) => updateBubble(selectedBubble.id, { w: Number(e.target.value) })} className="w-full accent-amber-500" />
                </label>
                <label className="text-slate-400">
                  Font ({selectedBubble.fontSize}px)
                  <input type="range" min="18" max="54" value={selectedBubble.fontSize || 30} onChange={(e) => updateBubble(selectedBubble.id, { fontSize: Number(e.target.value) })} className="w-full accent-amber-500" />
                </label>
              </div>
              {(selectedBubble.kind === 'speech' || selectedBubble.kind === 'thought') && (
                <select
                  value={selectedBubble.tail || 'bottom-left'}
                  onChange={(e) => updateBubble(selectedBubble.id, { tail: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="bottom-left">Tail: Bottom Left</option>
                  <option value="bottom-right">Tail: Bottom Right</option>
                  <option value="top-left">Tail: Top Left</option>
                  <option value="top-right">Tail: Top Right</option>
                  <option value="none">No Tail</option>
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: LIVE 300 DPI COMIC PAGE PREVIEW & EXPORT BAR (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col gap-3 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-sky-400" />
              <span>Live Print Page Preview ({activeTemplate.direction === 'rtl' ? 'Manga RTL' : 'Standard LTR'})</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportPng}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export 300 DPI PNG
              </button>
              <button
                type="button"
                onClick={handleSaveToVault}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save to Vault
              </button>
              <button
                type="button"
                onClick={handleOpenInCreativeStudio}
                className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" /> Edit in Creative Studio
              </button>
            </div>
          </div>

          <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-center overflow-auto min-h-[540px]">
            <canvas
              ref={previewCanvasRef}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const nx = (e.clientX - rect.left) / rect.width;
                const ny = (e.clientY - rect.top) / rect.height;
                const hit = activeTemplate.panels.find(
                  p => nx >= p.x && nx <= p.x + p.w && ny >= p.y && ny <= p.y + p.h
                );
                if (hit) setSelectedPanelId(hit.id);
              }}
              className="max-h-[620px] max-w-full shadow-2xl rounded border border-slate-700 cursor-crosshair"
              title="Click any panel on the page to select it"
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Click any panel directly on the canvas to select it, then generate 2×–4× variations or import local artwork.
            </span>
            <span className="font-mono text-[10px] text-slate-500">{activeFormat.dpiNote}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

