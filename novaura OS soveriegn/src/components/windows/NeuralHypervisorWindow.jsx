import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu, HardDrive, Zap, RefreshCw, Download, Trash2, CheckCircle2,
  AlertTriangle, Play, Sparkles, Terminal, Activity, Layers,
  ExternalLink, Settings2, ShieldCheck, Box, Server, Eye
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import {
  probeLocalDaemons, detectHostComputeHardware, pullOllamaModel,
  deleteOllamaModel, inspectOllamaModel, benchmarkModelInference,
  getEndpointUrls, saveEndpointUrls
} from '../../services/neuralHypervisorService.js';
import { dualInference } from '../../services/dualInferenceService.js';

export default function NeuralHypervisorWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('deck'); // 'deck' | 'pull' | 'benchmark' | 'hardware'
  const [hardware, setHardware] = useState(null);
  const [daemons, setDaemons] = useState(null);
  const [isProbing, setIsProbing] = useState(true);
  const [errorNotice, setErrorNotice] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Active OS Model
  const [activeModel, setActiveModel] = useState(null);

  // Model Pull State
  const [pullModelTag, setPullModelTag] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);

  // Inspect Modal State
  const [inspectData, setInspectData] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Benchmark State
  const [benchmarkModel, setBenchmarkModel] = useState('');
  const [benchmarkBackend, setBenchmarkBackend] = useState('ollama');
  const [benchmarkPrompt, setBenchmarkPrompt] = useState('Analyze the structural implications of decentralized machine intelligence in three clear bullet points.');
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkOutput, setBenchmarkOutput] = useState('');
  const [benchmarkStats, setBenchmarkStats] = useState(null);

  // Endpoint Settings
  const [endpoints, setEndpoints] = useState({ ollama: '', lmstudio: '', comfyui: '' });

  // Initial Probe
  useEffect(() => {
    setHardware(detectHostComputeHardware());
    getEndpointUrls().then(setEndpoints);
    refreshDaemons();
  }, []);

  const refreshDaemons = async () => {
    setIsProbing(true);
    setErrorNotice(null);
    try {
      const results = await probeLocalDaemons();
      setDaemons(results);

      // Match with kernel's active model
      const current = kernel?.localModel?.selectedModel;
      if (current) {
        setActiveModel(current);
      } else if (results.ollama.models.length > 0) {
        setActiveModel(results.ollama.models[0].id);
      } else if (results.lmstudio.models.length > 0) {
        setActiveModel(results.lmstudio.models[0].id);
      }
    } catch (err) {
      setErrorNotice('Probe failed: ' + (err?.message || 'Host unreachable'));
    } finally {
      setIsProbing(false);
    }
  };

  const handleSelectActiveModel = (modelId, backend) => {
    setActiveModel(modelId);
    if (kernel?.localModel) {
      kernel.localModel.setBackend(backend);
      kernel.localModel.setModel(modelId);
    }
    setSuccessNotice(`Active Sovereign OS model set to: ${modelId} (${backend})`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleAssignRole = (role, modelId, backend) => {
    const url = backend === 'lmstudio' ? 'http://localhost:1234/v1' : 'http://localhost:11434';
    if (role === 'nova') dualInference.assignNovaModel(modelId, backend, url);
    if (role === 'aura') dualInference.assignAuraModel(modelId, backend, url);
    if (role === 'coder') dualInference.assignCoderModel(modelId, backend, url);
    setSuccessNotice(`Assigned ${modelId} (${backend}) to ${role.toUpperCase()} Engine!`);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handlePullModel = async (tagToPull = null) => {
    const targetTag = (tagToPull || pullModelTag).trim();
    if (!targetTag) return;

    setIsPulling(true);
    setPullProgress({ status: 'Initiating download handshake...', pct: 0 });
    setErrorNotice(null);

    try {
      await pullOllamaModel(targetTag, (chunk) => {
        let pct = 0;
        if (chunk.total && chunk.completed) {
          pct = Math.round((chunk.completed / chunk.total) * 100);
        }
        setPullProgress({
          status: chunk.status || 'Downloading layers...',
          pct,
          completedMb: chunk.completed ? (chunk.completed / (1024 ** 2)).toFixed(1) : null,
          totalMb: chunk.total ? (chunk.total / (1024 ** 2)).toFixed(1) : null,
        });
      });

      setSuccessNotice(`Model ${targetTag} successfully downloaded and registered!`);
      setPullModelTag('');
      await refreshDaemons();
    } catch (err) {
      setErrorNotice(err.message || 'Failed to pull model.');
    } finally {
      setIsPulling(false);
      setPullProgress(null);
    }
  };

  const handleDeleteModel = async (modelName) => {
    if (window.confirm(`Permanently delete model ${modelName} from local disk storage?`)) {
      try {
        await deleteOllamaModel(modelName);
        setSuccessNotice(`Model ${modelName} removed.`);
        await refreshDaemons();
      } catch (err) {
        setErrorNotice(err.message || 'Failed to delete model.');
      }
    }
  };

  const handleInspectModel = async (modelName) => {
    setIsInspecting(true);
    try {
      const data = await inspectOllamaModel(modelName);
      setInspectData({ name: modelName, ...data });
    } catch (err) {
      setErrorNotice(err.message || 'Inspection failed.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleRunBenchmark = async () => {
    const target = benchmarkModel || activeModel;
    if (!target) {
      setErrorNotice('Select a model before running benchmark.');
      return;
    }

    setIsBenchmarking(true);
    setBenchmarkOutput('');
    setBenchmarkStats(null);
    setErrorNotice(null);

    try {
      const stats = await benchmarkModelInference({
        backend: benchmarkBackend,
        modelId: target,
        testPrompt: benchmarkPrompt,
        maxTokens: 100,
        onToken: (tok) => setBenchmarkOutput(prev => prev + tok),
      });
      setBenchmarkStats(stats);
    } catch (err) {
      setErrorNotice(err.message || 'Benchmark execution failed.');
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleSaveEndpoints = () => {
    saveEndpointUrls(endpoints);
    setSuccessNotice('Custom daemon endpoints saved.');
    refreshDaemons();
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const allModels = [
    ...(daemons?.ollama?.models || []).map(m => ({ ...m, source: 'ollama' })),
    ...(daemons?.lmstudio?.models || []).map(m => ({ ...m, source: 'lmstudio', sizeGb: 'Loaded in Memory' })),
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* 1. Header Bar */}
      <div className="h-12 px-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
              <span>NEURAL HYPERVISOR</span>
              <span className="text-[9px] font-mono uppercase bg-purple-950 border border-purple-500/40 text-purple-300 px-1.5 py-0.2 rounded font-semibold">
                Model Deck & Tensor Engine
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2">
              <span>GPU: {hardware?.gpuRenderer?.substring(0, 32) || 'Host GPU'}</span>
              <span>• Cores: {hardware?.hardwareConcurrency || 8}</span>
              {hardware?.webgpuAvailable && <span className="text-emerald-400">• WebGPU Active</span>}
            </div>
          </div>
        </div>

        {/* Daemon Status Pills & Navigation */}
        <div className="flex items-center gap-2">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-800 text-[10px] font-mono">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${daemons?.ollama?.online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500'}`} />
              <span className={daemons?.ollama?.online ? 'text-slate-300' : 'text-slate-500'}>Ollama (:11434)</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${daemons?.lmstudio?.online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500'}`} />
              <span className={daemons?.lmstudio?.online ? 'text-slate-300' : 'text-slate-500'}>LM Studio (:1234)</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${daemons?.comfyui?.online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'}`} />
              <span className={daemons?.comfyui?.online ? 'text-slate-300' : 'text-slate-500'}>ComfyUI (:8188)</span>
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'deck', label: `Installed Deck (${allModels.length})`, icon: Layers },
              { id: 'pull', label: 'Pull & Provision', icon: Download },
              { id: 'benchmark', label: 'Speedometer', icon: Zap },
              { id: 'hardware', label: 'Host Hardware', icon: Server },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
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
            onClick={refreshDaemons}
            disabled={isProbing}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 cursor-pointer"
            title="Refresh Daemon Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorNotice && (
        <div className="px-4 py-2 bg-rose-950/60 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}
      {successNotice && (
        <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. Main Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* TAB 1: INSTALLED MODELS DECK */}
        {activeTab === 'deck' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Discovered Local Weights & Active Runtimes</h3>
                <p className="text-xs text-slate-400">
                  Local GGUF, SafeTensors, and quantized weights available on physical host drives
                </p>
              </div>
              <button
                onClick={() => setActiveTab('pull')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pull New Model Tag</span>
              </button>
            </div>

            {allModels.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                <Box className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-semibold text-slate-300">No Local Models Detected</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Neither Ollama nor LM Studio reported any loaded weights. Start your local runner or pull a model directly using the Provision tab.
                </p>
                <button
                  onClick={() => setActiveTab('pull')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Pull DeepSeek / Qwen / Llama Tag
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allModels.map((m) => {
                  const isCurrent = m.id === activeModel;
                  return (
                    <div
                      key={`${m.source}_${m.id}`}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? 'bg-slate-900 border-purple-500/80 shadow-lg ring-1 ring-purple-500/40'
                          : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white font-mono truncate max-w-[280px]">
                            {m.name}
                          </span>
                          <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                            m.source === 'ollama'
                              ? 'bg-cyan-950 border-cyan-500/40 text-cyan-300'
                              : 'bg-amber-950 border-amber-500/40 text-amber-300'
                          }`}>
                            {m.source}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                          <div>Disk Size: <span className="text-slate-200">{m.sizeGb} GB</span></div>
                          <div>Quant: <span className="text-slate-200">{m.quantizationLevel || 'Native'}</span></div>
                          <div>Family: <span className="text-slate-200">{m.family || 'Decoder'}</span></div>
                          <div>Parameters: <span className="text-slate-200">{m.parameterSize || 'Auto'}</span></div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {isCurrent ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>ACTIVE SYSTEM MODEL</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSelectActiveModel(m.id, m.source)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-700"
                              >
                                Set as Active OS Model
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {m.source === 'ollama' && (
                              <>
                                <button
                                  onClick={() => handleInspectModel(m.id)}
                                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                                  title="Inspect Model Architecture"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteModel(m.id)}
                                  className="p-1.5 bg-slate-800/80 hover:bg-rose-900/60 hover:text-rose-300 text-slate-400 rounded-lg text-xs cursor-pointer transition-colors"
                                  title="Delete Weight from Disk"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setBenchmarkModel(m.id);
                                setBenchmarkBackend(m.source);
                                setActiveTab('benchmark');
                              }}
                              className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Speed</span>
                            </button>
                          </div>
                        </div>

                        {/* 1-Click Neural Role Assignment (Nova, Aura, Coder) */}
                        <div className="flex items-center justify-between bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/70 text-[11px]">
                          <span className="text-slate-400 font-mono text-[10px]">Bind Neural Role:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleAssignRole('nova', m.id, m.source)}
                              className="px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer"
                              title="Assign to Fast Executive Nova Engine (<500ms)"
                            >
                              + Nova
                            </button>
                            <button
                              onClick={() => handleAssignRole('aura', m.id, m.source)}
                              className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/30 hover:border-purple-400 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer"
                              title="Assign to Creative Reasoning Aura Engine (Deep Prose & High Context)"
                            >
                              + Aura
                            </button>
                            <button
                              onClick={() => handleAssignRole('coder', m.id, m.source)}
                              className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer"
                              title="Assign to Architectural Coder Engine"
                            >
                              + Coder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PULL & PROVISION */}
        {activeTab === 'pull' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div>
              <h3 className="text-sm font-bold text-white">Pull Local Weights via Streaming API</h3>
              <p className="text-xs text-slate-400">
                Downloads directly to your physical host storage using Ollama's native chunked stream
              </p>
            </div>

            {/* Pull Input Box */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">Model Tag or Full Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., deepseek-r1:14b, qwen2.5-coder:7b, mistral-nemo, phi4"
                  value={pullModelTag}
                  onChange={(e) => setPullModelTag(e.target.value)}
                  disabled={isPulling}
                  className="flex-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => handlePullModel()}
                  disabled={isPulling || !pullModelTag.trim() || !daemons?.ollama?.online}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-lg shadow-purple-600/30"
                >
                  {isPulling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{isPulling ? 'Streaming...' : 'Pull Model'}</span>
                </button>
              </div>

              {!daemons?.ollama?.online && (
                <p className="text-[11px] text-amber-400">
                  Note: Ollama daemon is currently offline at {endpoints.ollama}. Start Ollama service on host to enable native streaming pull.
                </p>
              )}

              {/* Real-Time Progress Stream */}
              {pullProgress && (
                <div className="p-3 bg-slate-950 rounded-xl border border-purple-500/40 space-y-2">
                  <div className="flex justify-between text-xs font-mono text-purple-300">
                    <span className="truncate max-w-[360px]">{pullProgress.status}</span>
                    <span>{pullProgress.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-300 shadow-[0_0_10px_#a855f7]"
                      style={{ width: `${pullProgress.pct}%` }}
                    />
                  </div>
                  {pullProgress.completedMb && (
                    <div className="text-[10px] text-slate-400 font-mono text-right">
                      {pullProgress.completedMb} MB of {pullProgress.totalMb} MB transferred
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Provisioning Deck */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Contemporary High-Performance Presets
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[
                  { tag: 'deepseek-r1:14b', name: 'DeepSeek R1 (14B Reasoning)', vram: '9.2 GB VRAM', desc: 'State-of-the-art open reasoning model for code, logic, and multi-step deduction.' },
                  { tag: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder (7B)', vram: '4.8 GB VRAM', desc: 'Ultra-fast, accurate coding and shell syntax co-author.' },
                  { tag: 'mistral-nemo:12b', name: 'Mistral NeMo (12B)', vram: '7.5 GB VRAM', desc: 'Trained with NVIDIA for 128k context multilingual dialogue.' },
                  { tag: 'phi4:14b', name: 'Microsoft Phi-4 (14B)', vram: '9.1 GB VRAM', desc: 'Exceptional mathematical and analytical density per parameter.' },
                ].map(preset => (
                  <div
                    key={preset.tag}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{preset.name}</span>
                        <span className="text-[9px] font-mono text-purple-300 bg-purple-950 px-1 rounded">{preset.vram}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{preset.desc}</div>
                    </div>
                    <button
                      onClick={() => handlePullModel(preset.tag)}
                      disabled={isPulling || !daemons?.ollama?.online}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                    >
                      Pull
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual LM Studio HuggingFace GGUF Provisioning Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/30 space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Visual GGUF Acquisition via LM Studio
                  </span>
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                    Hugging Face Direct
                  </span>
                </div>
                <span className={`text-[11px] font-mono font-bold ${daemons?.lmstudio?.online ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {daemons?.lmstudio?.online ? '● Server Active (:1234)' : '○ Port 1234 Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Prefer visual browsing over terminal CLI commands? LM Studio provides 1-click downloads for any Hugging Face GGUF quantization (Q4_K_M, Q5_K_M, IQ4_XS), live VRAM calculations, GPU offload layer sliders, and granular context window scaling.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] font-mono">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-amber-300 font-bold flex items-center gap-1.5">
                    <span>1. HuggingFace Search</span>
                  </div>
                  <div className="text-slate-400 text-[10px] leading-snug">
                    Search <span className="text-slate-200">bartowski</span>, <span className="text-slate-200">unsloth</span>, or <span className="text-slate-200">Qwen</span> directly inside LM Studio.
                  </div>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                    <span>2. Hardware Sliders</span>
                  </div>
                  <div className="text-slate-400 text-[10px] leading-snug">
                    Set exact GPU offload layers & context window (<span className="text-slate-200">n_ctx</span> 32k/128k/256k).
                  </div>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <span>3. Start Server (:1234)</span>
                  </div>
                  <div className="text-slate-400 text-[10px] leading-snug">
                    Toggle CORS ON. NovAura auto-discovers weights on port 1234 and binds them to your Deck.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BENCHMARK & SPEEDOMETER */}
        {activeTab === 'benchmark' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div>
              <h3 className="text-sm font-bold text-white">Live Hardware Inference Speedometer</h3>
              <p className="text-xs text-slate-400">
                Measure authentic Time-To-First-Token (TTFT) and real-time generation speed (Tokens/Sec)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Target Model</label>
                  <select
                    value={benchmarkModel || activeModel || ''}
                    onChange={(e) => setBenchmarkModel(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 outline-none"
                  >
                    {allModels.map(m => (
                      <option key={`${m.source}_${m.id}`} value={m.id}>
                        {m.name} ({m.source})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Runner Backend</label>
                  <select
                    value={benchmarkBackend}
                    onChange={(e) => setBenchmarkBackend(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 outline-none"
                  >
                    <option value="ollama">Ollama Native Engine (:11434)</option>
                    <option value="lmstudio">LM Studio Server (:1234)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Benchmark Prompt</label>
                <textarea
                  rows={2}
                  value={benchmarkPrompt}
                  onChange={(e) => setBenchmarkPrompt(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none"
                />
              </div>

              <button
                onClick={handleRunBenchmark}
                disabled={isBenchmarking}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/20"
              >
                {isBenchmarking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{isBenchmarking ? 'Running Real Hardware Benchmark...' : 'Execute Live Speed Test'}</span>
              </button>

              {/* Speedometer Telemetry Cards */}
              {benchmarkStats && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-slate-950 rounded-xl border border-purple-500/40 text-center">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">Inference Speed</div>
                    <div className="text-xl font-mono font-bold text-purple-300 mt-1">
                      {benchmarkStats.tokensPerSec} <span className="text-xs font-normal">T/s</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-purple-500/40 text-center">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">Time to 1st Token (TTFT)</div>
                    <div className="text-xl font-mono font-bold text-cyan-300 mt-1">
                      {benchmarkStats.ttftMs} <span className="text-xs font-normal">ms</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-purple-500/40 text-center">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">Total Tokens</div>
                    <div className="text-xl font-mono font-bold text-emerald-300 mt-1">
                      {benchmarkStats.tokenCount} <span className="text-xs font-normal">tokens</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Streaming Output Box */}
              {benchmarkOutput && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Real-Time Model Stream:</div>
                  <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {benchmarkOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: HOST HARDWARE & DAEMON PORTS */}
        {activeTab === 'hardware' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div>
              <h3 className="text-sm font-bold text-white">Compute Infrastructure & Daemon Topology</h3>
              <p className="text-xs text-slate-400">
                Local hardware acceleration detection and port routing configuration
              </p>
            </div>

            {/* Hardware Telemetry Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                GPU & Host Compute Pipeline
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">GRAPHICS PROCESSOR</div>
                  <div className="font-bold text-purple-300 mt-0.5 truncate">{hardware?.gpuRenderer || 'Discrete GPU'}</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">WEBGPU ENCLAVE</div>
                  <div className={`font-bold mt-0.5 ${hardware?.webgpuAvailable ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {hardware?.webgpuAvailable ? 'Available (Client Zero-Install)' : 'Unavailable (Fallback to Local Host Daemon)'}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">CPU CONCURRENCY</div>
                  <div className="font-bold text-slate-200 mt-0.5">{hardware?.hardwareConcurrency || 8} Logical Threads</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">HOST OPERATING SYSTEM</div>
                  <div className="font-bold text-slate-200 mt-0.5">{hardware?.platform || 'Windows x64'}</div>
                </div>
              </div>
            </div>

            {/* Endpoints Configuration */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Custom Daemon Endpoints & Ports
              </span>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">Ollama Service URL</label>
                  <input
                    type="text"
                    value={endpoints.ollama}
                    onChange={(e) => setEndpoints({ ...endpoints, ollama: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">LM Studio Server URL</label>
                  <input
                    type="text"
                    value={endpoints.lmstudio}
                    onChange={(e) => setEndpoints({ ...endpoints, lmstudio: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">ComfyUI Endpoint URL</label>
                  <input
                    type="text"
                    value={endpoints.comfyui}
                    onChange={(e) => setEndpoints({ ...endpoints, comfyui: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveEndpoints}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
              >
                Save & Re-Probe Endpoints
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-5 max-w-2xl w-full max-h-[80vh] flex flex-col space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white font-mono">
                ARCHITECTURE INSPECTOR // {inspectData.name}
              </span>
              <button onClick={() => setInspectData(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-2 text-slate-300">
              {inspectData.modelfile && (
                <div>
                  <div className="text-[10px] text-purple-400 font-bold mb-1">MODELFILE DEFINITION</div>
                  <pre className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px] whitespace-pre-wrap overflow-x-auto">
                    {inspectData.modelfile}
                  </pre>
                </div>
              )}
              {inspectData.parameters && (
                <div>
                  <div className="text-[10px] text-purple-400 font-bold mb-1">RUNNER PARAMETERS</div>
                  <pre className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px] whitespace-pre-wrap">
                    {inspectData.parameters}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
