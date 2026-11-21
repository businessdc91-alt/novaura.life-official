// PixStudioTab.jsx — PixAI-Class Visual Reference Gallery, Photo Transformer & Multi-Output Studio
// Supports Action Figure Designer, Anime Converter, Pencil/Charcoal/Caricature, Holo Cards, Badges,
// Avatars, Comic/Manga Styles, 1-4 Multi-Output Candidate Picking, and 1-Click Cross-App Handoffs.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, Upload, X, Star, Download, Layers, Film, Palette, CreditCard,
  Gift, Store, RefreshCw, Key, Sliders, Check, BookOpen, Wand2, Eye
} from 'lucide-react';
import {
  PRESET_CATEGORIES,
  ASPECT_PRESETS,
  VISUAL_PRESETS,
  compilePresetPrompt,
  getPresetPreviewSvg,
} from '../../../services/media/presetCatalog.js';
import {
  IMAGE_PROVIDERS,
  generateMultiCandidates,
  resolveProviderKey,
} from '../../../services/media/pixEngine.js';
import {
  sendImageToCreativeStudio,
  sendImageToCardForge,
  sendImageToGreetingCard,
  sendImageToCommerceStudio,
} from '../../../services/media/creativeBridge.js';
import { saveArtworkToVault } from '../../../services/mediaFoundryService.js';

export default function PixStudioTab({
  daemonOnline,
  comfyEndpoint,
  availableCheckpoints,
  selectedCheckpoint,
  onSelectCheckpoint,
  onVaultUpdated,
  onSendToVideo,
  onSendToComic,
  onNotice,
  onError,
}) {
  const [category, setCategory] = useState('all');
  const [selectedPresetId, setSelectedPresetId] = useState('action_figure_blister');
  const [subject, setSubject] = useState(VISUAL_PRESETS[0].defaults.subject);
  const [extraDetails, setExtraDetails] = useState('');

  // Action Figure Designer fields
  const [figureName, setFigureName] = useState(VISUAL_PRESETS[0].defaults.figureName);
  const [figureTagline, setFigureTagline] = useState(VISUAL_PRESETS[0].defaults.figureTagline);
  const [figureAccessories, setFigureAccessories] = useState(VISUAL_PRESETS[0].defaults.figureAccessories);
  const [figureBoxColor, setFigureBoxColor] = useState(VISUAL_PRESETS[0].defaults.figureBoxColor);

  // Prompt & generation parameters
  const [customPromptOverride, setCustomPromptOverride] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState(VISUAL_PRESETS[0].negativePrompt);
  const [width, setWidth] = useState(VISUAL_PRESETS[0].width);
  const [height, setHeight] = useState(VISUAL_PRESETS[0].height);
  const [steps, setSteps] = useState(VISUAL_PRESETS[0].steps);
  const [cfg, setCfg] = useState(VISUAL_PRESETS[0].cfg);
  const [denoise, setDenoise] = useState(VISUAL_PRESETS[0].denoise);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000000));
  const [outputCount, setOutputCount] = useState(2);

  // Reference photo upload
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceName, setReferenceName] = useState('');
  const fileInputRef = useRef(null);

  // Provider & BYOK settings
  const [provider, setProvider] = useState(() => (daemonOnline ? 'comfy' : 'gemini'));
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('novaura_byok_image_key') || ''; } catch { return ''; }
  });
  const [cloudModel, setCloudModel] = useState('gemini-2.5-flash-image');
  const [customEndpoint, setCustomEndpoint] = useState('https://api.openai.com/v1/images/generations');
  const [vertexProject, setVertexProject] = useState(() => {
    try { return localStorage.getItem('novaura_vertex_project') || ''; } catch { return ''; }
  });
  const [vertexRegion, setVertexRegion] = useState('us-central1');
  const [vaultKeyDetected, setVaultKeyDetected] = useState(false);

  // Results & Candidate Picker
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [activeCandidateId, setActiveCandidateId] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const selectedPreset = useMemo(
    () => VISUAL_PRESETS.find(p => p.id === selectedPresetId) || VISUAL_PRESETS[0],
    [selectedPresetId]
  );

  const filteredPresets = useMemo(
    () => (category === 'all' ? VISUAL_PRESETS : VISUAL_PRESETS.filter(p => p.category === category)),
    [category]
  );

  const presetThumbnails = useMemo(() => {
    const map = {};
    for (const p of VISUAL_PRESETS) map[p.id] = getPresetPreviewSvg(p);
    return map;
  }, []);

  const compiled = useMemo(
    () =>
      compilePresetPrompt(selectedPreset, {
        subject,
        extraDetails,
        figureName,
        figureTagline,
        figureAccessories,
        figureBoxColor,
        negativePrompt,
        width,
        height,
        steps,
        cfg,
        denoise,
      }),
    [selectedPreset, subject, extraDetails, figureName, figureTagline, figureAccessories, figureBoxColor, negativePrompt, width, height, steps, cfg, denoise]
  );

  const effectivePrompt = useCustomPrompt ? customPromptOverride : compiled.prompt;

  // Check if Sovereign Vault already has a key for the active cloud provider
  useEffect(() => {
    let cancelled = false;
    if (provider === 'comfy') {
      return () => { cancelled = true; };
    }
    resolveProviderKey(provider, '').then((k) => {
      if (!cancelled) setVaultKeyDetected(Boolean(k));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [provider]);

  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setSubject(preset.defaults?.subject || '');
    setNegativePrompt(preset.negativePrompt);
    setWidth(preset.width);
    setHeight(preset.height);
    setSteps(preset.steps);
    setCfg(preset.cfg);
    setDenoise(preset.denoise);
    setUseCustomPrompt(false);
    if (preset.category === 'action_figure' && preset.defaults) {
      setFigureName(preset.defaults.figureName || 'SOVEREIGN EDITION');
      setFigureTagline(preset.defaults.figureTagline || 'LIMITED SERIES #01');
      setFigureAccessories(preset.defaults.figureAccessories || '');
      setFigureBoxColor(preset.defaults.figureBoxColor || 'obsidian black and electric gold');
    }
  };

  const handleProviderChange = (nextProvider) => {
    setProvider(nextProvider);
    if (nextProvider === 'gemini' || nextProvider === 'vertex') setCloudModel('gemini-2.5-flash-image');
    else if (nextProvider === 'openai') setCloudModel('gpt-image-1');
    else if (nextProvider === 'custom') setCloudModel('flux-pro');
  };

  const handlePhotoFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      onError?.('Please select a PNG, JPG, or WebP image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(String(reader.result || ''));
      setReferenceName(file.name);
      onNotice?.(`Reference photo "${file.name}" loaded for transformation.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveKey = (val) => {
    setApiKey(val);
    try { localStorage.setItem('novaura_byok_image_key', val); } catch {}
  };

  const handleSaveVertexProject = (val) => {
    setVertexProject(val);
    try { localStorage.setItem('novaura_vertex_project', val); } catch {}
  };

  const handleGenerate = async () => {
    if (!effectivePrompt.trim()) {
      onError?.('Enter a subject or prompt first.');
      return;
    }
    if (provider === 'comfy' && !daemonOnline) {
      onError?.(`Local ComfyUI is offline at ${comfyEndpoint}. Start ComfyUI or switch to Gemini / OpenAI BYOK.`);
      return;
    }

    setIsGenerating(true);
    onError?.(null);
    setStatusText(`Preparing ${outputCount} variation${outputCount > 1 ? 's' : ''}…`);

    try {
      const results = await generateMultiCandidates({
        provider,
        prompt: effectivePrompt,
        negativePrompt,
        referenceImageUrl: referenceImage,
        width,
        height,
        steps,
        cfg,
        denoise,
        seed,
        count: outputCount,
        presetId: selectedPreset.id,
        comfyEndpoint,
        checkpointName: selectedCheckpoint || availableCheckpoints[0] || '',
        apiKey,
        model: cloudModel,
        endpointUrl: customEndpoint,
        vertexProject,
        vertexRegion,
        onProgress: (msg) => setStatusText(String(msg || '')),
      });

      setCandidates(results);
      if (results[0]) setActiveCandidateId(results[0].id);
      onNotice?.(`Generated ${results.length} candidate${results.length > 1 ? 's' : ''}! Click any take to inspect, edit, or print.`);
    } catch (err) {
      onError?.(err.message || 'Visual generation failed.');
    } finally {
      setIsGenerating(false);
      setStatusText('');
    }
  };

  const activeCandidate = useMemo(
    () => candidates.find(c => c.id === activeCandidateId) || candidates[0] || null,
    [candidates, activeCandidateId]
  );

  const toggleFavorite = (id) => {
    setCandidates(prev => prev.map(c => (c.id === id ? { ...c, favorite: !c.favorite } : c)));
  };

  const handleSaveCandidateToVault = async (cand) => {
    if (!cand) return;
    try {
      await saveArtworkToVault({
        title: `${selectedPreset.name}: ${subject.slice(0, 32)}`,
        prompt: cand.prompt,
        imageUrl: cand.url,
        provider: cand.provider,
        metadata: {
          presetId: cand.presetId,
          model: cand.model,
          seed: cand.seed,
          width: cand.width,
          height: cand.height,
          tags: [selectedPreset.category, cand.presetId || 'pix_studio'],
        },
      });
      onVaultUpdated?.();
      onNotice?.('Saved winning variation to Sovereign Media Vault!');
    } catch (err) {
      onError?.(`Could not save to Vault: ${err.message}`);
    }
  };

  const handleDownload = (cand) => {
    if (!cand) return;
    const a = document.createElement('a');
    a.href = cand.url;
    a.download = `${selectedPreset.id}_${cand.seed}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* 1. VISUAL REFERENCE PRESET GALLERY */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span>PixAI Visual Reference & Engineered Prompt Gallery</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Select a curated visual style to load its reference composition, negative prompt, aspect ratio, and multi-output recipe.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {PRESET_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  category === cat.id
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
          {filteredPresets.map(preset => {
            const active = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`group text-left rounded-xl overflow-hidden border transition-all cursor-pointer flex flex-col ${
                  active
                    ? 'border-amber-400 ring-2 ring-amber-500/30 bg-amber-950/30'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'
                }`}
              >
                <div className="relative h-24 w-full bg-slate-950 overflow-hidden">
                  <img
                    src={presetThumbnails[preset.id]}
                    alt={preset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-amber-300 border border-amber-500/30">
                    {preset.badge}
                  </span>
                </div>
                <div className="p-2 flex-1 flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-white leading-tight line-clamp-2">
                    {preset.name}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">
                    {preset.width}×{preset.height}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. STUDIO WORKSPACE: CONTROLS LEFT + MULTI-OUTPUT PICKER RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT CONTROLS (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Reference Photo Upload Dropzone */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reference Photo / Portrait Upload</span>
              </span>
              {selectedPreset.requiresPhotoRecommended && !referenceImage && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  Photo Recommended
                </span>
              )}
              {referenceImage && (
                <button
                  type="button"
                  onClick={() => { setReferenceImage(null); setReferenceName(''); }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear Photo
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
            />

            {referenceImage ? (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950 border border-cyan-500/40">
                <img src={referenceImage} alt="Reference" className="w-16 h-16 rounded-lg object-cover border border-slate-700" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-xs font-semibold text-white truncate">{referenceName || 'Uploaded Reference'}</div>
                  <div className="text-[10px] text-slate-400">
                    {provider === 'comfy'
                      ? `ComfyUI Img2Img active (denoise ${denoise.toFixed(2)})`
                      : 'Multimodal identity-preserving photo transform active'}
                  </div>
                  {provider === 'comfy' && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">Denoise</span>
                      <input
                        type="range"
                        min="0.25"
                        max="0.90"
                        step="0.02"
                        value={denoise}
                        onChange={(e) => setDenoise(Number(e.target.value))}
                        className="flex-1 accent-cyan-500"
                      />
                      <span className="text-[10px] font-mono text-cyan-300 w-8">{denoise.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handlePhotoFile(e.dataTransfer.files[0]);
                }}
                className="w-full py-4 px-3 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/70 text-center transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-slate-200">Drop a selfie or reference image, or click to browse</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Powers Action Figure of Yourself, Anime Converter, Pencil Portrait &amp; Caricature transforms
                </div>
              </button>
            )}
          </div>

          {/* Structured Prompt & Action Figure Parameters */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">{selectedPreset.name}</span>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomPrompt}
                  onChange={(e) => {
                    if (e.target.checked && !customPromptOverride) setCustomPromptOverride(compiled.prompt);
                    setUseCustomPrompt(e.target.checked);
                  }}
                  className="accent-amber-500"
                />
                Edit raw prompt
              </label>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{selectedPreset.description}</p>

            {!useCustomPrompt ? (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Subject / Scene</label>
                  <textarea
                    rows={2}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Describe who or what to render..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {selectedPreset.category === 'action_figure' && (
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/25">
                    <div>
                      <label className="text-[10px] font-mono text-amber-300 block mb-0.5">Figure Name (Header)</label>
                      <input
                        type="text"
                        value={figureName}
                        onChange={(e) => setFigureName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-amber-300 block mb-0.5">Edition Subtitle</label>
                      <input
                        type="text"
                        value={figureTagline}
                        onChange={(e) => setFigureTagline(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-mono text-amber-300 block mb-0.5">Included Box Accessories (3-4 items)</label>
                      <input
                        type="text"
                        value={figureAccessories}
                        onChange={(e) => setFigureAccessories(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-mono text-amber-300 block mb-0.5">Packaging Colorway</label>
                      <input
                        type="text"
                        value={figureBoxColor}
                        onChange={(e) => setFigureBoxColor(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Extra Style / Lighting Modifiers (Optional)</label>
                  <input
                    type="text"
                    value={extraDetails}
                    onChange={(e) => setExtraDetails(e.target.value)}
                    placeholder="e.g., golden hour lighting, glowing neon aura, wearing sunglasses..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <textarea
                rows={4}
                value={customPromptOverride}
                onChange={(e) => setCustomPromptOverride(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              />
            )}

            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Negative Prompt</label>
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 font-mono"
              />
            </div>
          </div>

          {/* Engine, Aspect Ratio & Multi-Output Selector */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Inference Engine</label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {IMAGE_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Multi-Output Variations</label>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOutputCount(n)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        outputCount === n
                          ? 'bg-amber-600 border-amber-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Engine-Specific Configuration */}
            {provider === 'comfy' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Local Checkpoint</label>
                  <select
                    value={selectedCheckpoint}
                    onChange={(e) => onSelectCheckpoint?.(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  >
                    {availableCheckpoints.length ? (
                      availableCheckpoints.map(c => <option key={c} value={c}>{c}</option>)
                    ) : (
                      <option value="">No local checkpoints detected (install in Models tab)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Steps: {steps}</label>
                  <input type="range" min="4" max="45" value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full accent-amber-500" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">CFG: {cfg.toFixed(1)}</label>
                  <input type="range" min="1" max="12" step="0.5" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} className="w-full accent-amber-500" />
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-300 flex items-center gap-1"><Key className="w-3 h-3 text-amber-400" /> Cloud BYOK Credentials</span>
                  {vaultKeyDetected && (
                    <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Vault Key Ready</span>
                  )}
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleSaveKey(e.target.value)}
                  placeholder={vaultKeyDetected ? 'Using encrypted Sovereign Vault key (optional override)' : 'Enter provider API Key...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Model ID</label>
                    <input
                      type="text"
                      value={cloudModel}
                      onChange={(e) => setCloudModel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  {provider === 'vertex' ? (
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">GCP Project ID</label>
                      <input
                        type="text"
                        value={vertexProject}
                        onChange={(e) => handleSaveVertexProject(e.target.value)}
                        placeholder="my-gcp-project"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  ) : provider === 'custom' ? (
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Endpoint URL</label>
                      <input
                        type="text"
                        value={customEndpoint}
                        onChange={(e) => setCustomEndpoint(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Quick Models</label>
                      <select
                        value={cloudModel}
                        onChange={(e) => setCloudModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-mono"
                      >
                        {provider === 'gemini' ? (
                          <>
                            <option value="gemini-2.5-flash-image">gemini-2.5-flash-image (Photo+Edit)</option>
                            <option value="imagen-3.0-generate-002">imagen-3.0-generate-002</option>
                          </>
                        ) : (
                          <>
                            <option value="gpt-image-1">gpt-image-1 (Photo+Edit)</option>
                            <option value="dall-e-3">dall-e-3</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </div>
                {provider === 'vertex' && (
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Vertex Region</label>
                    <input
                      type="text"
                      value={vertexRegion}
                      onChange={(e) => setVertexRegion(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Aspect Ratio & Seed */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1 flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> Aspect Preset
                </label>
                <select
                  value={`${width}x${height}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    if (w && h) { setWidth(w); setHeight(h); }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {ASPECT_PRESETS.map(a => (
                    <option key={a.id} value={`${a.width}x${a.height}`}>{a.label} ({a.width}×{a.height})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">Base Seed</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 0)}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 1000000000))}
                    className="px-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 cursor-pointer"
                    title="Randomize Seed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 cursor-pointer transition-all"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>
                {isGenerating
                  ? statusText || 'Generating variations…'
                  : `Generate ${outputCount} Variation${outputCount > 1 ? 's' : ''} (${selectedPreset.badge})`}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT: MULTI-OUTPUT PICKER & CROSS-APP STUDIO HUB (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex-1 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col gap-3 min-h-[460px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Multi-Output Candidate Picker</span>
                {candidates.length > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30">
                    {candidates.length} Take{candidates.length > 1 ? 's' : ''} Ready
                  </span>
                )}
              </span>
              {activeCandidate && (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Full Preview
                </button>
              )}
            </div>

            {candidates.length > 0 ? (
              <>
                {/* Candidate Grid */}
                <div className={`grid gap-3 ${candidates.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {candidates.map((cand, idx) => {
                    const isSelected = activeCandidate?.id === cand.id;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => setActiveCandidateId(cand.id)}
                        className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all bg-slate-950 ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-500/30'
                            : 'border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={cand.url}
                          alt={`Variation ${idx + 1}`}
                          className={`w-full object-contain bg-black/50 ${candidates.length === 1 ? 'max-h-[380px]' : 'h-56'}`}
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/80 text-white border border-white/15">
                            Take #{idx + 1} · Seed {cand.seed}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-black">
                              SELECTED
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(cand.id); }}
                          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur cursor-pointer ${
                            cand.favorite ? 'bg-amber-500 text-black' : 'bg-black/60 text-slate-300 hover:text-amber-300'
                          }`}
                          title="Star favorite variation"
                        >
                          <Star className="w-3.5 h-3.5" fill={cand.favorite ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Candidate Action & Cross-App Pipeline Bar */}
                {activeCandidate && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="text-[11px] font-semibold text-slate-300">
                      Send Selected Winner (Take #{activeCandidate.index + 1}) Anywhere in Sovereign OS:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveCandidateToVault(activeCandidate)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Save to Vault
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(activeCandidate)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sendImageToCreativeStudio({ imageUrl: activeCandidate.url, title: `${selectedPreset.name}_${activeCandidate.seed}` });
                          onNotice?.('Opened winner in Creative Studio layered editor!');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-pink-600/90 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5" /> Edit in Creative Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sendImageToCardForge({ imageUrl: activeCandidate.url, title: subject.slice(0, 32), prompt: activeCandidate.prompt });
                          onNotice?.('Sent art to TCG Card Forge!');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-orange-600/90 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Bake into TCG Card
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sendImageToGreetingCard({ imageUrl: activeCandidate.url, title: subject.slice(0, 32) });
                          onNotice?.('Sent cover art to Greeting Card Studio!');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600/90 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Gift className="w-3.5 h-3.5" /> Greeting Card Cover
                      </button>
                      {onSendToComic && (
                        <button
                          type="button"
                          onClick={() => onSendToComic(activeCandidate)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Add to Comic / Manga Page
                        </button>
                      )}
                      {onSendToVideo && (
                        <button
                          type="button"
                          onClick={() => onSendToVideo(activeCandidate)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5" /> Animate to Video (I2V)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          sendImageToCommerceStudio({ imageUrl: activeCandidate.url, title: selectedPreset.name, prompt: activeCandidate.prompt });
                          onNotice?.('Opened Commerce Studio to turn this art into merch/prints!');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Store className="w-3.5 h-3.5" /> Sell Print in Commerce
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 space-y-3">
                <img
                  src={presetThumbnails[selectedPreset.id]}
                  alt={selectedPreset.name}
                  className="w-40 h-36 rounded-xl border border-slate-700 shadow-xl"
                />
                <div className="max-w-md space-y-1">
                  <div className="text-sm font-bold text-white">{selectedPreset.name} Ready</div>
                  <p className="text-xs text-slate-400">
                    Pick <strong>2×</strong> or <strong>4×</strong> variations, optionally drop a photo on the left, and click Generate. You can pick your favorite result and send it straight to Creative Studio, Card Forge, Comic Studio, or Image-to-Video.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && activeCandidate && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img src={activeCandidate.url} alt="Full preview" className="max-h-[82vh] max-w-full rounded-2xl border border-slate-700 shadow-2xl" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-300">Seed {activeCandidate.seed} · {activeCandidate.width}×{activeCandidate.height}</span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

