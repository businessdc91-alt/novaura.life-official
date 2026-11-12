// MediaFoundryWindow.jsx — Sovereign Media Foundry & ComfyUI Forge Lab
// Features:
// 1. Local ComfyUI Forge Dashboard: 1-click installer, daemon health, queue status, GPU hardware detection
// 2. 1-Click Cutting-Edge Model Download Center (Flux.1 Schnell FP8, SDXL Turbo, Wan 2.1 Video, Whisper Turbo)
// 3. Pro Hack-Level Tips: VRAM flag mastery, symlink multi-GB savings, TF32 speedup, WebSocket hooks
// 4. Interactive Prompt Studio: Local ComfyUI dispatch + Universal BYOK cloud generation
// 5. Sovereign Media Vault: Dexie-backed artwork gallery with prompt metadata and file export

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles, Flame, Server, Download, Copy, Check, Terminal, ExternalLink,
  Layers, Image as ImageIcon, Sliders, RefreshCw, AlertTriangle, CheckCircle2,
  Cpu, HardDrive, Zap, Play, Eye, Trash2, FolderOpen, ArrowDownToLine, Code,
  Settings, Key, ShieldCheck, Box, HelpCircle, Film, Mic, Music, Volume2, Radio
} from 'lucide-react';
import {
  getComfyUIEndpoint, saveComfyUIEndpoint, probeComfyUIStatus, getComfyUIObjectInfo,
  buildComfyUIWorkflow, queueComfyUIPrompt, pollComfyUIHistory,
  SOTA_MODELS_CATALOG, generateComfyUISetupScript, generateModelDownloadScript,
  COMFYUI_HACK_TIPS, generateBYOKImage, saveArtworkToVault, loadArtworksFromVault,
  synthesizeProceduralAudioTrack, synthesizeSpeechLocal, saveAudioToVault, loadAudioFromVault
} from '../../services/mediaFoundryService.js';
import { detectHostComputeHardware } from '../../services/neuralHypervisorService.js';
import { getEngineConfig } from '../../services/engines/comfyEngine.js';
import { chooseImageCheckpoint } from '../../services/engines/checkpoints.js';

export default function MediaFoundryWindow({ windowId, props, onClose }) {
  const [activeTab, setActiveTab] = useState('comfy'); // 'comfy' | 'studio' | 'models' | 'hacks' | 'vault'
  const [endpoint, setEndpoint] = useState(getComfyUIEndpoint());
  const [daemonState, setDaemonState] = useState({ online: false, stats: null, queue: { running: 0, pending: 0 }, error: null });
  const [isProbing, setIsProbing] = useState(false);
  const [availableCheckpoints, setAvailableCheckpoints] = useState([]);
  const [hardware, setHardware] = useState(null);

  // Setup Script Configuration
  const [installPath, setInstallPath] = useState('C:\\Novaura\\ComfyUI');
  const [copiedScript, setCopiedScript] = useState(false);
  const [selectedModelScript, setSelectedModelScript] = useState(null);
  const [copiedModelScript, setCopiedModelScript] = useState(false);

  // Studio State
  const [engineMode, setEngineMode] = useState('comfy'); // 'comfy' | 'byok'
  const [prompt, setPrompt] = useState('A sovereign cyberpunk computing sanctuary overlooking a bioluminescent quantum skyline, volumetric neon lighting, cinematic 8k masterpiece');
  const [negativePrompt, setNegativePrompt] = useState('blurry, deformed, oversaturated, low quality, artifact, watermark');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(7.0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000000));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);

  // BYOK State
  const [byokApiKey, setByokApiKey] = useState(() => {
    try { return localStorage.getItem('novaura_byok_image_key') || ''; } catch { return ''; }
  });
  const [byokModel, setByokModel] = useState('dall-e-3');
  const [byokEndpoint, setByokEndpoint] = useState('https://api.openai.com/v1/images/generations');

  // Vault State
  const [vaultArtworks, setVaultArtworks] = useState([]);
  const [vaultAudios, setVaultAudios] = useState([]);
  const [selectedArtwork, setSelectedArtwork] = useState(null);

  // Music & Audio State
  const [audioGenre, setAudioGenre] = useState('synthwave');
  const [audioTempo, setAudioTempo] = useState(124);
  const [audioDuration, setAudioDuration] = useState(12);
  const [audioKey, setAudioKey] = useState('A_minor');
  const [audioPrompt, setAudioPrompt] = useState('Deep cyberpunk synth bassline with rhythmic arpeggios and ambient stereo delay');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState(null);

  // TTS State
  const [ttsText, setTtsText] = useState('NovAura Sovereign OS runs on your own hardware. All neural weights, embeddings, and cryptographic identities are hosted on-device.');
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);

  // Notices
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  // Hardware detection & initial load
  useEffect(() => {
    const hw = detectHostComputeHardware();
    setHardware(hw);
    refreshDaemon();
    loadVault();
    loadAudioVault();

    // Populate voices
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        setAvailableVoices(v);
        if (v.length > 0 && !selectedVoice) setSelectedVoice(v[0].name);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const loadAudioVault = async () => {
    try {
      const items = await loadAudioFromVault();
      setVaultAudios(items);
    } catch {}
  };

  const handleGenerateMusic = async () => {
    setIsGeneratingAudio(true);
    try {
      setNotice(`Synthesizing ${audioGenre} musical track (${audioDuration}s @ ${audioTempo} BPM)...`);
      const blob = await synthesizeProceduralAudioTrack({
        genre: audioGenre,
        tempo: audioTempo,
        durationSeconds: audioDuration,
        key: audioKey,
      });

      const url = URL.createObjectURL(blob);
      setGeneratedAudioBlob(blob);
      setGeneratedAudioUrl(url);

      await saveAudioToVault({
        title: `${audioGenre.toUpperCase()} Track in ${audioKey.replace('_', ' ')}`,
        prompt: audioPrompt,
        genre: audioGenre,
        audioBlob: blob,
        model: 'AudioCraft / Sovereign Procedural Audio',
      });

      loadAudioVault();
      setNotice('Music track synthesized and saved to Sovereign Audio Vault!');
    } catch (err) {
      setErrorNotice(err.message || 'Music synthesis failed.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleSpeakSpeech = async () => {
    if (!ttsText.trim()) return;
    setIsSpeakingTts(true);
    try {
      await synthesizeSpeechLocal({
        text: ttsText,
        voiceName: selectedVoice,
        rate: ttsRate,
        pitch: ttsPitch,
      });
      setNotice('Speech playback finished.');
    } catch (err) {
      setErrorNotice(err.message || 'TTS playback failed.');
    } finally {
      setIsSpeakingTts(false);
    }
  };

  const refreshDaemon = useCallback(async () => {
    setIsProbing(true);
    try {
      const status = await probeComfyUIStatus(endpoint);
      setDaemonState(status);

      if (status.online) {
        const ckpts = await getComfyUIObjectInfo(endpoint);
        setAvailableCheckpoints(ckpts);
        if (ckpts.length > 0 && !selectedCheckpoint) {
          // The AI Engines default model (already loaded at startup), else an image model: names sort the music checkpoints first.
          const { defaultModel } = await getEngineConfig();
          setSelectedCheckpoint(chooseImageCheckpoint(ckpts, defaultModel) || ckpts[0]);
        }
      }
    } catch (err) {
      setErrorNotice(`Probe error: ${err.message}`);
    } finally {
      setIsProbing(false);
    }
  }, [endpoint, selectedCheckpoint]);

  const loadVault = async () => {
    try {
      const items = await loadArtworksFromVault();
      setVaultArtworks(items);
    } catch {}
  };

  const handleCopySetupScript = () => {
    const script = generateComfyUISetupScript(installPath);
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setNotice('1-Click PowerShell setup script copied to clipboard! Paste into PowerShell to install.');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleCopyModelScript = (model) => {
    const script = generateModelDownloadScript(model);
    navigator.clipboard.writeText(script);
    setSelectedModelScript(model.id);
    setCopiedModelScript(true);
    setNotice(`Download script for ${model.name} copied to clipboard!`);
    setTimeout(() => {
      setCopiedModelScript(false);
      setSelectedModelScript(null);
    }, 3000);
  };

  const handleSaveEndpoint = () => {
    saveComfyUIEndpoint(endpoint);
    setNotice(`ComfyUI endpoint updated to ${endpoint}`);
    refreshDaemon();
  };

  const handleSaveByokKey = (key) => {
    setByokApiKey(key);
    try { localStorage.setItem('novaura_byok_image_key', key); } catch {}
  };

  // Generation Handler
  const handleExecuteGeneration = async () => {
    if (!prompt.trim()) {
      setErrorNotice('Prompt cannot be empty.');
      return;
    }

    setIsGenerating(true);
    setErrorNotice(null);
    setNotice(null);
    setGeneratedImage(null);

    try {
      if (engineMode === 'comfy') {
        if (!daemonState.online) {
          throw new Error('ComfyUI daemon is offline at ' + endpoint + '. Launch ComfyUI or switch to BYOK Cloud mode.');
        }

        const ckpt = selectedCheckpoint || (availableCheckpoints.length > 0 ? availableCheckpoints[0] : null);
        if (!ckpt) {
          throw new Error('No checkpoint loaded in ComfyUI. Download a checkpoint from the Models tab first.');
        }

        setGenerationStatus('Compiling workflow graph & dispatching to ComfyUI queue...');
        const workflow = buildComfyUIWorkflow({
          prompt,
          negativePrompt,
          width,
          height,
          steps,
          cfg,
          seed,
          checkpointName: ckpt,
        });

        const queueRes = await queueComfyUIPrompt(workflow, endpoint);
        setGenerationStatus(`Queued as job #${queueRes.number}. Executing KSampler & VAE Decode...`);

        const images = await pollComfyUIHistory(queueRes.promptId, endpoint);
        if (images.length > 0) {
          const finalUrl = images[0].url;
          setGeneratedImage(finalUrl);
          setNotice('Image generated successfully via local ComfyUI!');
          // Save to Vault
          await saveArtworkToVault({
            title: prompt.slice(0, 36) + '...',
            prompt,
            imageUrl: finalUrl,
            provider: 'comfyui',
            metadata: { checkpoint: ckpt, steps, cfg, seed, width, height },
          });
          loadVault();
        }
      } else {
        // Universal BYOK
        if (!byokApiKey.trim()) {
          throw new Error('Please enter your BYOK API key in the BYOK settings below.');
        }
        setGenerationStatus('Dispatching prompt to Universal BYOK Cloud endpoint...');
        const imgUrl = await generateBYOKImage({
          prompt,
          apiKey: byokApiKey,
          endpointUrl: byokEndpoint,
          model: byokModel,
          size: `${width}x${height}`,
        });

        setGeneratedImage(imgUrl);
        setNotice('Image successfully synthesized via Universal BYOK Cloud!');
        await saveArtworkToVault({
          title: prompt.slice(0, 36) + '...',
          prompt,
          imageUrl: imgUrl,
          provider: 'byok',
          metadata: { model: byokModel, endpoint: byokEndpoint, width, height },
        });
        loadVault();
      }
    } catch (err) {
      setErrorNotice(err.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const handleDownloadImage = (url, name = 'novaura_generation.png') => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">Sovereign Media Foundry</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-semibold">
                ComfyUI Forge Lab
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>Host GPU: {hardware?.gpuRenderer || 'Generic GPU'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">{daemonState.online ? 'ComfyUI Connected (:8188)' : 'ComfyUI Offline'}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Status */}
        <div className="flex items-center gap-2">
          {/* Daemon Status Indicator */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${daemonState.online ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'}`} />
            <span className="text-slate-300">
              {daemonState.online ? `Jobs Running: ${daemonState.queue.running} | Queue: ${daemonState.queue.pending}` : 'Offline'}
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'comfy', label: 'ComfyUI Automation', icon: Terminal },
              { id: 'models', label: 'Model Downloads', icon: Download },
              { id: 'studio', label: 'Image Studio', icon: Sparkles },
              { id: 'audio', label: 'Music & Voice', icon: Music },
              { id: 'hacks', label: 'Hack-Level Tips', icon: Zap },
              { id: 'vault', label: `Vault (${vaultArtworks.length + vaultAudios.length})`, icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={refreshDaemon}
            disabled={isProbing}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 cursor-pointer"
            title="Refresh Daemon Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Notice Banners */}
      {errorNotice && (
        <div className="px-4 py-2 bg-rose-950/70 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="text-rose-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}
      {notice && (
        <div className="px-4 py-2 bg-emerald-950/70 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* 2. Main Tab Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* TAB 1: COMFYUI 1-CLICK AUTOMATION & CONTROL */}
        {activeTab === 'comfy' && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Top Setup Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>1-Click ComfyUI Standalone Setup & Automation</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono">
                        Windows Automated
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Zero manual dependency hell. Generates a self-executing PowerShell script that unpacks the standalone portable build, installs ComfyUI-Manager, creates model directories, and creates a high-performance launch batch file with VRAM optimization flags.
                    </p>
                  </div>
                  <button
                    onClick={handleCopySetupScript}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer shrink-0"
                  >
                    {copiedScript ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedScript ? 'Script Copied!' : 'Copy 1-Click Setup Script'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 font-mono block mb-1">Target Installation Directory</label>
                    <input
                      type="text"
                      value={installPath}
                      onChange={(e) => setInstallPath(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="shrink-0 pt-4">
                    <a
                      href="https://github.com/comfyanonymous/ComfyUI/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      <span>Official Releases</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ComfyUI Daemon Connection Manager */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Endpoint Settings Card */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-400" />
                    <span>REST & WebSocket URL</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${daemonState.online ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleSaveEndpoint}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Default: http://127.0.0.1:8188
                </div>
              </div>

              {/* Hardware & VRAM Stats */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>Hardware & Acceleration</span>
                </span>
                <div className="text-[11px] text-slate-300 font-mono space-y-1">
                  <div>GPU: <span className="text-slate-100">{hardware?.gpuRenderer || 'Host GPU'}</span></div>
                  <div>PyTorch: <span className="text-amber-400">{daemonState.stats?.system?.pytorch_version || 'Local Engine'}</span></div>
                  <div>WebGPU: <span className={hardware?.webgpuAvailable ? 'text-emerald-400' : 'text-slate-500'}>{hardware?.webgpuAvailable ? 'Enabled' : 'Disabled'}</span></div>
                </div>
              </div>

              {/* Checkpoint Detection Card */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Loaded Weights</span>
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950 px-1.5 py-0.5 rounded">
                    {availableCheckpoints.length} Models
                  </span>
                </div>
                {availableCheckpoints.length > 0 ? (
                  <select
                    value={selectedCheckpoint}
                    onChange={(e) => setSelectedCheckpoint(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono outline-none focus:border-cyan-500"
                  >
                    {availableCheckpoints.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    No checkpoint active. Switch to Models tab to download Flux.1 or SDXL.
                  </div>
                )}
              </div>
            </div>

            {/* Launch Instructions & Walkthrough */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>3-Step Quick Launch Guide</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400">1. Run Setup Script</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Click 'Copy 1-Click Setup Script' above, open Windows PowerShell, paste, and press Enter. It automatically sets up ComfyUI and ComfyUI-Manager.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400">2. Download Weights</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Go to the 'Model Downloads' tab. Copy the 1-click download command for Flux.1 Schnell FP8 or SDXL Turbo into PowerShell.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400">3. Launch & Connect</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Double-click <code className="text-emerald-300 font-mono">Launch_Novaura_ComfyUI.bat</code>. Once port 8188 is live, you can generate directly from this studio!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MODEL DOWNLOADS CENTER */}
        {activeTab === 'models' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">SOTA Open Media Foundation Models</h3>
                <p className="text-xs text-slate-400">
                  Direct verified download links and 1-click PowerShell fetch commands for state-of-the-art checkpoints
                </p>
              </div>
              <div className="text-[10px] text-amber-300 font-mono bg-amber-950/80 border border-amber-500/40 px-2 py-1 rounded-xl">
                Destination: {installPath}\ComfyUI\models
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SOTA_MODELS_CATALOG.map((m) => {
                const isSelected = selectedModelScript === m.id && copiedModelScript;
                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          {m.type === 'video' ? <Film className="w-4 h-4 text-purple-400" /> :
                           m.type === 'audio' ? <Mic className="w-4 h-4 text-cyan-400" /> :
                           <ImageIcon className="w-4 h-4 text-amber-400" />}
                          <span>{m.name}</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {m.sizeGb}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {m.description}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                        <div>VRAM: <span className="text-amber-300">{m.vramRequired}</span></div>
                        <div>Speed: <span className="text-emerald-300">{m.speedRating}</span></div>
                        <div>Architecture: <span className="text-slate-200">{m.architecture}</span></div>
                        <div>Target: <span className="text-slate-200 truncate">{m.targetDir}</span></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => handleCopyModelScript(m)}
                        className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/20 transition-all"
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isSelected ? 'Script Copied!' : 'Copy 1-Click PowerShell Script'}</span>
                      </button>
                      <a
                        href={m.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                        title="Direct Hugging Face Download"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PROMPT STUDIO */}
        {activeTab === 'studio' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Controls Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Engine Selector */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Inference Engine</label>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setEngineMode('comfy')}
                      className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-all ${
                        engineMode === 'comfy' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Local ComfyUI
                    </button>
                    <button
                      onClick={() => setEngineMode('byok')}
                      className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-all ${
                        engineMode === 'byok' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Universal BYOK
                    </button>
                  </div>
                </div>

                {engineMode === 'comfy' ? (
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-400 block">ComfyUI Active Checkpoint</label>
                    {availableCheckpoints.length > 0 ? (
                      <select
                        value={selectedCheckpoint}
                        onChange={(e) => setSelectedCheckpoint(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white font-mono outline-none focus:border-amber-500"
                      >
                        {availableCheckpoints.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-[11px] text-amber-300">
                        {daemonState.online
                          ? 'No checkpoints placed in models/checkpoints yet.'
                          : 'ComfyUI is offline. Start the batch file or switch to BYOK.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-400 block">Your Private API Key (BYOK)</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={byokApiKey}
                      onChange={(e) => handleSaveByokKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white font-mono outline-none focus:border-purple-500"
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Model</label>
                        <input
                          type="text"
                          value={byokModel}
                          onChange={(e) => setByokModel(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Custom Endpoint</label>
                        <input
                          type="text"
                          value={byokEndpoint}
                          onChange={(e) => setByokEndpoint(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Prompt Controls */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div>
                  <label className="text-xs font-bold text-white block mb-1">Positive Prompt</label>
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 resize-none font-sans"
                    placeholder="Enter visual prompt..."
                  />
                </div>

                {engineMode === 'comfy' && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Negative Prompt</label>
                    <textarea
                      rows={2}
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-300 outline-none focus:border-amber-500 resize-none font-sans"
                      placeholder="Undesired traits..."
                    />
                  </div>
                )}

                {/* Dimensions & Parameters */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Resolution</label>
                    <select
                      value={`${width}x${height}`}
                      onChange={(e) => {
                        const [w, h] = e.target.value.split('x').map(Number);
                        setWidth(w);
                        setHeight(h);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                    >
                      <option value="1024x1024">1024 x 1024 (1:1 Square)</option>
                      <option value="1280x720">1280 x 720 (16:9 Landscape)</option>
                      <option value="720x1280">720 x 1280 (9:16 Portrait)</option>
                      <option value="832x1216">832 x 1216 (SDXL Standard)</option>
                    </select>
                  </div>

                  {engineMode === 'comfy' && (
                    <div>
                      <label className="text-slate-400 block mb-1">Steps ({steps})</label>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={steps}
                        onChange={(e) => setSteps(Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleExecuteGeneration}
                  disabled={isGenerating}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{isGenerating ? (generationStatus || 'Synthesizing...') : 'Generate Artwork'}</span>
                </button>
              </div>
            </div>

            {/* Right Output Canvas Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 min-h-[460px] relative overflow-hidden">
              {isGenerating ? (
                <div className="text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
                    <div className="w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Synthesizing High-Fidelity Pixels</div>
                    <p className="text-xs text-amber-300 font-mono mt-1">{generationStatus}</p>
                  </div>
                </div>
              ) : generatedImage ? (
                <div className="w-full h-full flex flex-col items-center justify-between gap-3">
                  <div className="relative group max-h-[500px] overflow-hidden rounded-xl border border-slate-800">
                    <img
                      src={generatedImage}
                      alt="Generated Artwork"
                      className="max-h-[460px] object-contain rounded-xl shadow-2xl"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full max-w-md">
                    <button
                      onClick={() => handleDownloadImage(generatedImage)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400" />
                      <span>Download PNG</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('vault');
                      }}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-600/20"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View in Vault</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 p-8 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto stroke-1 text-slate-600" />
                  <div className="text-sm font-semibold text-slate-400">Media Canvas Standby</div>
                  <p className="text-xs max-w-sm mx-auto text-slate-500">
                    Configure your prompt on the left and click Generate Artwork to execute local KSampler or BYOK cloud generation.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: HACK-LEVEL TIPS & SECRETS */}
        {activeTab === 'hacks' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Hack-Level Tips & Pro Architecture Secrets</span>
              </h3>
              <p className="text-xs text-slate-400">
                Deep hardware scaling, multi-GB storage symlinking, and speed multipliers for local AI production
              </p>
            </div>

            <div className="space-y-3">
              {COMFYUI_HACK_TIPS.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all space-y-2 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{tip.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 font-semibold">
                      {tip.badge}
                    </span>
                  </div>
                  <div className="text-xs text-amber-200/90 font-medium">
                    {tip.summary}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    {tip.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: SOVEREIGN MEDIA VAULT */}
        {activeTab === 'vault' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Sovereign Media Vault</h3>
                <p className="text-xs text-slate-400">
                  Private generation archive stored safely in local Dexie database
                </p>
              </div>
              <button
                onClick={loadVault}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Vault</span>
              </button>
            </div>

            {vaultArtworks.length === 0 ? (
              <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                <Box className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-semibold text-slate-300">Vault Is Empty</div>
                <p className="text-xs text-slate-400">
                  Generated images from Prompt Studio will be automatically fingerprinted and archived here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {vaultArtworks.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArtwork(art)}
                    className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer hover:border-amber-500/60 transition-all shadow-md"
                  >
                    <img
                      src={art.metadata?.imageUrl || ''}
                      alt={art.title}
                      className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="p-2.5 bg-slate-950/90 border-t border-slate-800/80">
                      <div className="text-xs font-bold text-white truncate">{art.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                        <span>{art.metadata?.provider || 'local'}</span>
                        <span>{new Date(art.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Artwork Detail Modal */}
            {selectedArtwork && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="text-sm font-bold text-white truncate max-w-lg">{selectedArtwork.title}</h4>
                    <button
                      onClick={() => setSelectedArtwork(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
                      <img
                        src={selectedArtwork.metadata?.imageUrl}
                        alt="Vault Art"
                        className="max-h-[380px] object-contain rounded-lg"
                      />
                    </div>
                    <div className="w-full md:w-72 space-y-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Prompt</span>
                        <p className="text-slate-200 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] leading-relaxed max-h-36 overflow-y-auto">
                          {selectedArtwork.content}
                        </p>
                      </div>
                      <div className="space-y-1 font-mono text-[11px] text-slate-400">
                        <div>Provider: <span className="text-amber-400">{selectedArtwork.metadata?.provider}</span></div>
                        <div>Dimensions: <span className="text-slate-200">{selectedArtwork.metadata?.width}x{selectedArtwork.metadata?.height}</span></div>
                        {selectedArtwork.metadata?.seed && <div>Seed: <span className="text-slate-200">{selectedArtwork.metadata.seed}</span></div>}
                      </div>

                      <div className="pt-2 flex flex-col gap-2">
                        <button
                          onClick={() => handleDownloadImage(selectedArtwork.metadata?.imageUrl, `novaura_${selectedArtwork.id}.png`)}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          <span>Export Image</span>
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedArtwork.content);
                            setNotice('Prompt copied to clipboard!');
                          }}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Prompt</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: MUSIC & AUDIO STUDIO (LOCAL MUSICGEN, STABLE AUDIO & NEURAL TTS) */}
        {activeTab === 'audio' && (
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Top Audio Suite Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/30 border border-purple-500/30 relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                      <Music className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white">Sovereign Music & Neural Voice Foundry</h3>
                  </div>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Run cutting-edge music generation models locally (AudioCraft MusicGen, Stable Audio Open, YuE 7B) 
                    and ultra-low latency neural speech synthesis (Kokoro-82M, Piper C++ ONNX, Coqui XTTS-v2).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300">
                    44.1kHz Stereo Offline Engine
                  </span>
                </div>
              </div>
            </div>

            {/* Main Two-Column Studio Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* SECTION A: MUSIC GENERATION */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">Music Generation Foundry</h4>
                  </div>
                  <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/20">
                    AudioCraft / MusicGen / Latent DiT
                  </span>
                </div>

                {/* Genre Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Musical Genre & Style</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'synthwave', label: 'Synthwave', bpm: 124 },
                      { id: 'ambient', label: 'Ambient Drone', bpm: 84 },
                      { id: 'cyberpunk', label: 'Cyberpunk', bpm: 130 },
                      { id: 'orchestral', label: 'Sci-Fi Score', bpm: 96 },
                    ].map(g => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setAudioGenre(g.id);
                          setAudioTempo(g.bpm);
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          audioGenre === g.id
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Musical Controls: Tempo, Key, Duration */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Tempo ({audioTempo} BPM)</label>
                    <input
                      type="range"
                      min="70"
                      max="160"
                      value={audioTempo}
                      onChange={e => setAudioTempo(Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Harmonic Key</label>
                    <select
                      value={audioKey}
                      onChange={e => setAudioKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value="A_minor">A Minor (Moody)</option>
                      <option value="C_major">C Major (Heroic)</option>
                      <option value="D_dorian">D Dorian (Cyber)</option>
                      <option value="F_lydian">F Lydian (Cosmic)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Length</label>
                    <select
                      value={audioDuration}
                      onChange={e => setAudioDuration(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value="8">8 Seconds</option>
                      <option value="12">12 Seconds</option>
                      <option value="16">16 Seconds</option>
                      <option value="24">24 Seconds</option>
                    </select>
                  </div>
                </div>

                {/* Prompt textarea */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">Prompt Description</label>
                  <textarea
                    rows={2}
                    value={audioPrompt}
                    onChange={e => setAudioPrompt(e.target.value)}
                    placeholder="Describe instruments, feeling, chords, or rhythm..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 resize-none font-sans"
                  />
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateMusic}
                  disabled={isGeneratingAudio}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAudio ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                      <span>Synthesizing Harmonics & Chords...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Synthesize Sovereign Track</span>
                    </>
                  )}
                </button>

                {/* Audio Output Player */}
                {generatedAudioUrl && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-purple-500/40 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Synthesized Track ({audioDuration}s WAV)</span>
                      </span>
                      <a
                        href={generatedAudioUrl}
                        download={`sovereign_${audioGenre}_${Date.now()}.wav`}
                        className="text-[11px] text-purple-400 hover:text-purple-300 underline flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        <span>Download WAV</span>
                      </a>
                    </div>
                    <audio controls src={generatedAudioUrl} className="w-full h-9 rounded-lg" autoPlay />
                  </div>
                )}
              </div>

              {/* SECTION B: NEURAL TTS VOICE STUDIO */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">Neural Voice & TTS Studio</h4>
                  </div>
                  <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Kokoro-82M / Piper C++ / XTTS-v2
                  </span>
                </div>

                {/* Text Input */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">Text to Synthesize</label>
                  <textarea
                    rows={3}
                    value={ttsText}
                    onChange={e => setTtsText(e.target.value)}
                    placeholder="Enter sentences for neural speech synthesis..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                  />
                </div>

                {/* Voice Selection */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">Voice Model / Persona</label>
                  <select
                    value={selectedVoice}
                    onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    <option value="">Default Neural Voice</option>
                    {availableVoices.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rate & Pitch Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Speech Speed ({ttsRate}x)</label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.1"
                      value={ttsRate}
                      onChange={e => setTtsRate(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Vocal Pitch ({ttsPitch}x)</label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={ttsPitch}
                      onChange={e => setTtsPitch(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Speak Button */}
                <button
                  onClick={handleSpeakSpeech}
                  disabled={isSpeakingTts || !ttsText.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
                >
                  {isSpeakingTts ? (
                    <>
                      <Volume2 className="w-4 h-4 animate-bounce text-emerald-200" />
                      <span>Speaking Voice Stream...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                      <span>Speak Neural Voice</span>
                    </>
                  )}
                </button>

                {/* Kokoro & Piper Info Pill */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Local Speech Synthesis</span>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Zero voice data ever leaves this workstation. Compatible with local Kokoro-82M ONNX server 
                    and Piper C++ daemon running on localhost ports 8880 or 5000.
                  </p>
                </div>
              </div>

            </div>

            {/* SECTION C: RECENT AUDIO VAULT */}
            {vaultAudios.length > 0 && (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Saved Audio Vault ({vaultAudios.length} Tracks)</span>
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {vaultAudios.slice(0, 6).map(a => (
                    <div key={a.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200 truncate">{a.title}</span>
                        <span className="text-[10px] font-mono text-purple-400">{a.metadata?.genre}</span>
                      </div>
                      {a.metadata?.audioUrl && (
                        <audio controls src={a.metadata.audioUrl} className="w-full h-7 rounded" />
                      )}
                      <p className="text-[10px] text-slate-400 truncate">{a.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}


      </div>
    </div>
  );
}
