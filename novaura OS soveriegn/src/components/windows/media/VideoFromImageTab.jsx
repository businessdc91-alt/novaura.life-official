// VideoFromImageTab.jsx — Image-to-Video (I2V) Studio supporting Local ComfyUI Wan 2.1 I2V,
// BYOK Gemini Veo, Vertex AI Veo, and Custom Video API endpoints.

import React, { useEffect, useRef, useState } from 'react';
import { Film, Upload, Play, Download, Check, Key, Sparkles, X } from 'lucide-react';
import { VIDEO_MOTION_PRESETS } from '../../../services/media/presetCatalog.js';
import {
  VIDEO_PROVIDERS,
  generateVideoFromImage,
  resolveProviderKey,
} from '../../../services/media/pixEngine.js';
import { saveArtworkToVault } from '../../../services/mediaFoundryService.js';

export default function VideoFromImageTab({
  sourceImageUrl = '',
  sourcePrompt = '',
  daemonOnline,
  comfyEndpoint,
  onVaultUpdated,
  onNotice,
  onError,
}) {
  const [imageUrl, setImageUrl] = useState(sourceImageUrl);
  const [motionPresetId, setMotionPresetId] = useState(VIDEO_MOTION_PRESETS[0].id);
  const [prompt, setPrompt] = useState(() =>
    sourcePrompt
      ? `${sourcePrompt.slice(0, 140)}, ${VIDEO_MOTION_PRESETS[0].promptSuffix}`
      : VIDEO_MOTION_PRESETS[0].promptSuffix
  );
  const [provider, setProvider] = useState(() => (daemonOnline ? 'comfy_wan' : 'gemini_veo'));
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [motionStrength, setMotionStrength] = useState(0.5);
  const [wanModelName, setWanModelName] = useState('wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors');
  const [cloudModel, setCloudModel] = useState('veo-2.0-generate-001');
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('novaura_byok_video_key') || localStorage.getItem('novaura_byok_image_key') || ''; } catch { return ''; }
  });
  const [customEndpointUrl, setCustomEndpointUrl] = useState('');
  const [vertexProject, setVertexProject] = useState(() => {
    try { return localStorage.getItem('novaura_vertex_project') || ''; } catch { return ''; }
  });
  const [vertexRegion, setVertexRegion] = useState('us-central1');
  const [vaultKeyReady, setVaultKeyReady] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [videoResult, setVideoResult] = useState(null);
  const fileRef = useRef(null);

  // Sync incoming handoff image when user clicks "Animate to Video" from Pix Studio
  useEffect(() => {
    let cancelled = false;
    if (!sourceImageUrl) return () => { cancelled = true; };
    Promise.resolve().then(() => {
      if (cancelled) return;
      setImageUrl(sourceImageUrl);
      if (sourcePrompt) {
        const preset = VIDEO_MOTION_PRESETS.find(p => p.id === motionPresetId) || VIDEO_MOTION_PRESETS[0];
        setPrompt(`${sourcePrompt.slice(0, 140)}, ${preset.promptSuffix}`);
      }
    });
    return () => { cancelled = true; };
  }, [sourceImageUrl, sourcePrompt, motionPresetId]);

  useEffect(() => {
    let cancelled = false;
    if (provider === 'comfy_wan') return () => { cancelled = true; };
    resolveProviderKey(provider, '').then((k) => {
      if (!cancelled) setVaultKeyReady(Boolean(k));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [provider]);

  const handleUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      onError?.('Please choose an image file (PNG, JPG, or WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const applyMotionPreset = (preset) => {
    setMotionPresetId(preset.id);
    setMotionStrength(preset.motionStrength);
    setPrompt(sourcePrompt ? `${sourcePrompt.slice(0, 120)}, ${preset.promptSuffix}` : preset.promptSuffix);
  };

  const handleGenerateVideo = async () => {
    if (!imageUrl) {
      onError?.('Upload a source image or send one from Pix Studio first.');
      return;
    }
    if (provider === 'comfy_wan' && !daemonOnline) {
      onError?.(`ComfyUI is offline at ${comfyEndpoint}. Start ComfyUI with Wan 2.1 weights or switch to Gemini Veo BYOK.`);
      return;
    }
    setIsGenerating(true);
    setVideoResult(null);
    onError?.(null);
    try {
      const dims = aspectRatio === '9:16' ? { width: 480, height: 832 } : aspectRatio === '1:1' ? { width: 640, height: 640 } : { width: 832, height: 480 };
      const res = await generateVideoFromImage({
        provider,
        imageUrl,
        prompt,
        durationSeconds,
        aspectRatio,
        width: dims.width,
        height: dims.height,
        motionStrength,
        comfyEndpoint,
        wanModelName,
        apiKey,
        model: cloudModel,
        customEndpointUrl,
        vertexProject,
        vertexRegion,
        onProgress: (msg) => setStatusText(String(msg || '')),
      });
      setVideoResult(res);
      onNotice?.('Image-to-Video clip generated successfully!');
    } catch (err) {
      onError?.(err.message || 'Image-to-Video generation failed.');
    } finally {
      setIsGenerating(false);
      setStatusText('');
    }
  };

  const handleSaveToVault = async () => {
    if (!videoResult) return;
    try {
      await saveArtworkToVault({
        title: `I2V Motion Clip (${durationSeconds}s)`,
        prompt,
        imageUrl: videoResult.url,
        provider: videoResult.provider,
        metadata: { kind: videoResult.kind, model: videoResult.model, durationSeconds, tags: ['video', 'i2v'] },
      });
      onVaultUpdated?.();
      onNotice?.('Saved I2V clip to Sovereign Media Vault.');
    } catch (err) {
      onError?.(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Source Frame & Motion Controls */}
      <div className="lg:col-span-5 space-y-3">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span>Source Keyframe Image</span>
            </span>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-purple-500/40 bg-slate-950">
              <img src={imageUrl} alt="I2V keyframe" className="w-full h-44 object-contain" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 text-[11px] text-white border border-white/15 cursor-pointer"
              >
                Replace Image
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-10 rounded-xl border border-dashed border-slate-700 hover:border-purple-500 bg-slate-950 text-center cursor-pointer"
            >
              <Film className="w-6 h-6 text-purple-400 mx-auto mb-1.5" />
              <div className="text-xs font-semibold text-slate-200">Drop a Holo Card, Action Figure, Anime Portrait, or Artwork</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Animates static imagery into smooth video motion</div>
            </button>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1.5">Camera &amp; Motion Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {VIDEO_MOTION_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyMotionPreset(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                    motionPresetId === p.id
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Motion Direction Prompt</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Video Engine</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                {VIDEO_PROVIDERS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Aspect Ratio</label>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                <option value="16:9">16:9 Widescreen</option>
                <option value="9:16">9:16 Vertical / Card Reel</option>
                <option value="1:1">1:1 Square Loop</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Duration: {durationSeconds}s</label>
              <input type="range" min="4" max="8" value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="w-full accent-purple-500" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Motion Strength: {motionStrength.toFixed(2)}</label>
              <input type="range" min="0.2" max="0.9" step="0.05" value={motionStrength} onChange={(e) => setMotionStrength(Number(e.target.value))} className="w-full accent-purple-500" />
            </div>
          </div>

          {provider === 'comfy_wan' ? (
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Wan 2.1 UNET Filename (in ComfyUI/models/diffusion_models)</label>
              <input
                type="text"
                value={wanModelName}
                onChange={(e) => setWanModelName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          ) : (
            <div className="space-y-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-300 flex items-center gap-1"><Key className="w-3 h-3 text-purple-400" /> Video Cloud BYOK</span>
                {vaultKeyReady && <span className="text-emerald-400">Vault Key Ready</span>}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  try { localStorage.setItem('novaura_byok_video_key', e.target.value); } catch {}
                }}
                placeholder={vaultKeyReady ? 'Using Sovereign Vault key (optional override)' : 'API Key / Bearer Token'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={cloudModel}
                  onChange={(e) => setCloudModel(e.target.value)}
                  placeholder="veo-2.0-generate-001"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
                {provider === 'vertex_veo' ? (
                  <input
                    type="text"
                    value={vertexProject}
                    onChange={(e) => setVertexProject(e.target.value)}
                    placeholder="GCP Project ID"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                ) : provider === 'custom_video' ? (
                  <input
                    type="text"
                    value={customEndpointUrl}
                    onChange={(e) => setCustomEndpointUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/i2v"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                ) : (
                  <input
                    type="text"
                    value={vertexRegion}
                    onChange={(e) => setVertexRegion(e.target.value)}
                    placeholder="us-central1"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateVideo}
            disabled={isGenerating}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? statusText || 'Rendering Video…' : `Animate Image (${durationSeconds}s)`}</span>
          </button>
        </div>
      </div>

      {/* Right: Video Preview & Export */}
      <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col gap-3 min-h-[460px]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Play className="w-4 h-4 text-purple-400" />
            <span>Image-to-Video Output Monitor</span>
          </span>
          {videoResult && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToVault}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save to Vault
              </button>
              <a
                href={videoResult.url}
                download={`novaura_i2v_${(videoResult.createdAt || 'clip').replace(/[^0-9]/g, '').slice(0, 14)}.${videoResult.kind === 'animated' ? 'webp' : 'mp4'}`}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          )}
        </div>

        <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden p-4">
          {videoResult ? (
            videoResult.kind === 'animated' ? (
              <img src={videoResult.url} alt="Animated I2V output" className="max-h-[420px] max-w-full rounded-xl shadow-2xl" />
            ) : (
              <video src={videoResult.url} controls autoPlay loop className="max-h-[420px] max-w-full rounded-xl shadow-2xl" />
            )
          ) : (
            <div className="text-center space-y-2 max-w-sm">
              <Film className="w-10 h-10 text-purple-500/50 mx-auto" />
              <div className="text-sm font-bold text-slate-200">No Video Rendered Yet</div>
              <p className="text-xs text-slate-400">
                Animate Holo Trading Cards, Action Figures, or Anime portraits locally using <strong>ComfyUI Wan 2.1 I2V</strong> or in the cloud via <strong>BYOK Gemini / Vertex Veo</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
