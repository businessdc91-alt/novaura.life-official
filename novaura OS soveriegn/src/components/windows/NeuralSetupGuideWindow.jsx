import React, { useState, useEffect } from 'react';
import {
  BookOpen, Terminal, CheckCircle2, XCircle, AlertCircle,
  Copy, Check, ExternalLink, RefreshCw, Cpu, Image, Video, Sparkles
} from 'lucide-react';
import { probeLocalAi } from '../../services/nativeService.js';

export default function NeuralSetupGuideWindow({ onClose }) {
  const [activeTab, setActiveTab] = useState('ollama');
  const [copiedCmd, setCopiedCmd] = useState('');
  const [probeStatus, setProbeStatus] = useState({
    ollama: 'checking',
    lmstudio: 'checking',
    comfyui: 'checking',
  });

  const checkEngines = async () => {
    // Probe Ollama
    try {
      const olProbe = await probeLocalAi(11434, '/api/tags');
      setProbeStatus(p => ({ ...p, ollama: olProbe?.online ? 'connected' : 'offline' }));
    } catch {
      setProbeStatus(p => ({ ...p, ollama: 'offline' }));
    }

    // Probe LM Studio
    try {
      const lmProbe = await probeLocalAi(1234, '/v1/models');
      setProbeStatus(p => ({ ...p, lmstudio: lmProbe?.online ? 'connected' : 'offline' }));
    } catch {
      setProbeStatus(p => ({ ...p, lmstudio: 'offline' }));
    }

    // Probe ComfyUI
    try {
      const res = await fetch('http://localhost:8188/system_stats', { method: 'GET' });
      setProbeStatus(p => ({ ...p, comfyui: res.ok ? 'connected' : 'offline' }));
    } catch {
      setProbeStatus(p => ({ ...p, comfyui: 'offline' }));
    }
  };

  useEffect(() => {
    checkEngines();
  }, []);

  const copyText = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(''), 2000);
  };

  const tabs = [
    { id: 'ollama', label: '1. Ollama (LLM Core)', icon: Cpu, status: probeStatus.ollama },
    { id: 'lmstudio', label: '2. LM Studio (Alternative)', icon: Terminal, status: probeStatus.lmstudio },
    { id: 'comfyui', label: '3. ComfyUI (Images)', icon: Image, status: probeStatus.comfyui },
    { id: 'video', label: '4. Video Generation', icon: Video },
    { id: 'cors', label: '5. CORS & Firewall Fixes', icon: AlertCircle },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem', borderBottom: '1px solid rgba(0,240,255,0.15)', backgroundColor: 'rgba(15,23,42,0.9)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BookOpen size={18} color="#00f0ff" />
          <span style={{ fontWeight: 700, color: '#00f0ff', fontSize: '0.95rem' }}>Neural Engine Setup Guide</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Offline AI Configuration</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={checkEngines} style={{ background: 'none', border: '1px solid rgba(0,240,255,0.25)', color: '#00f0ff', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={13} /> Test Local Ports
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Navigation Tabs */}
        <div style={{ width: '220px', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', backgroundColor: activeTab === t.id ? 'rgba(0,240,255,0.12)' : 'transparent', color: activeTab === t.id ? '#00f0ff' : '#94a3b8' }}>
              <t.icon size={15} />
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.status && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.status === 'connected' ? '#10b981' : '#ef4444' }} title={t.status} />
              )}
            </button>
          ))}
          <div style={{ marginTop: 'auto', padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.5)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#64748b' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.2rem' }}>Air-Gapped Guarantee</div>
            All models run on your GPU/CPU. Zero data leaves your machine.
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto', lineHeight: '1.6', fontSize: '0.85rem' }}>
          
          {/* TAB 1: OLLAMA */}
          {activeTab === 'ollama' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem' }}>Setting Up Ollama (Primary Text & Code Engine)</h3>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', backgroundColor: probeStatus.ollama === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: probeStatus.ollama === 'connected' ? '#10b981' : '#f87171' }}>
                  {probeStatus.ollama === 'connected' ? 'Port 11434 Connected' : 'Port 11434 Offline'}
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 1: Download & Install</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Download the official installer for Windows or Linux from <strong style={{ color: '#f8fafc' }}>https://ollama.com/download</strong>.</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 2: Pull Recommended MoE Models (Dual Neural Architecture)</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Open PowerShell or Terminal and pull sparse MoE models for sub-500ms executive routing and deep reasoning:</p>
                <div style={{ backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', padding: '0.75rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span>ollama run gemma4:26b</span>
                  <button onClick={() => copyText('ollama run gemma4:26b', 'c1')} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }} title="Copy Gemma 4 26B-A4B MoE">
                    {copiedCmd === 'c1' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div style={{ backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '6px', padding: '0.75rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span>ollama run qwen3.6:35b-a3b</span>
                  <button onClick={() => copyText('ollama run qwen3.6:35b-a3b', 'c2')} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }} title="Copy Qwen MoE 35B-A3B">
                    {copiedCmd === 'c2' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div style={{ backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '0.75rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ollama run qwen2.5-coder:32b</span>
                  <button onClick={() => copyText('ollama run qwen2.5-coder:32b', 'c3')} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }} title="Copy Qwen 2.5 Coder 32B">
                    {copiedCmd === 'c3' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 3: Enable CORS for Novaura (Critical)</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>By default, Ollama restricts requests from web apps. Set the environment variable:</p>
                <div style={{ backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '0.75rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')</span>
                  <button onClick={() => copyText("[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')", 'c4')} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}>
                    {copiedCmd === 'c4' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p style={{ margin: '0.3rem 0', fontSize: '0.75rem', color: '#cbd5e1' }}>Restart Ollama from the Windows taskbar tray after running this command.</p>
              </div>
            </div>
          )}

          {/* TAB 2: LM STUDIO */}
          {activeTab === 'lmstudio' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem' }}>Setting Up LM Studio (GUI Model Manager)</h3>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', backgroundColor: probeStatus.lmstudio === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: probeStatus.lmstudio === 'connected' ? '#10b981' : '#f87171' }}>
                  {probeStatus.lmstudio === 'connected' ? 'Port 1234 Connected' : 'Port 1234 Offline'}
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 1: Download & Install</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Download LM Studio from <strong style={{ color: '#f8fafc' }}>https://lmstudio.ai/</strong>.</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 2: Search & Download a GGUF Model</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>In the Search tab inside LM Studio, search for <strong style={{ color: '#f8fafc' }}>Gemma 4 26B-A4B</strong> (e.g., <span style={{ color: '#00f0ff' }}>gemma-4-26b-a4b</span> for 4B-active MoE execution), <strong style={{ color: '#f8fafc' }}>Qwen MoE 35B-A3B</strong> (<span style={{ color: '#00f0ff' }}>qwen3.6-35b-a3b</span> for 3B-active frontier reasoning), or <strong style={{ color: '#f8fafc' }}>Qwen 2.5 Coder 32B</strong>, and download the Q4_K_M quant.</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 3: Start Local Inference Server</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Click the <strong>Developer / Local Server</strong> icon (double-arrow tab on the left):</p>
                <ul style={{ paddingLeft: '1.2rem', color: '#94a3b8', margin: '0.4rem 0' }}>
                  <li>Select your downloaded model from the top dropdown.</li>
                  <li>Toggle <strong>CORS</strong> to <strong style={{ color: '#10b981' }}>ON</strong> (Required for Novaura connection).</li>
                  <li>Click <strong style={{ color: '#00f0ff' }}>Start Server</strong> (default port is 1234).</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: COMFYUI */}
          {activeTab === 'comfyui' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem' }}>Setting Up ComfyUI (Local Image Synthesis)</h3>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', backgroundColor: probeStatus.comfyui === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: probeStatus.comfyui === 'connected' ? '#10b981' : '#f87171' }}>
                  {probeStatus.comfyui === 'connected' ? 'Port 8188 Connected' : 'Port 8188 Offline'}
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 1: Portable Standalone Build</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Download the standalone 7z build from <strong style={{ color: '#f8fafc' }}>github.com/comfyanonymous/ComfyUI/releases</strong>.</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 2: Add Checkpoints / Models</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Place SDXL or Flux model checkpoints into:</p>
                <div style={{ backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', padding: '0.6rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                  ComfyUI_windows_portable\ComfyUI\models\checkpoints\
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ color: '#00f0ff' }}>Step 3: Launch with CORS Enabled (Essential)</strong>
                <p style={{ margin: '0.3rem 0', color: '#94a3b8' }}>Edit your `run_nvidia_gpu.bat` file to include CORS and address flags:</p>
                <div style={{ backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', padding: '0.75rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --listen 127.0.0.1 --enable-cors-header "*"</span>
                  <button onClick={() => copyText('.\\python_embeded\\python.exe -s ComfyUI\\main.py --windows-standalone-build --listen 127.0.0.1 --enable-cors-header "*"', 'c4')} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}>
                    {copiedCmd === 'c4' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VIDEO GENERATION */}
          {activeTab === 'video' && (
            <div>
              <h3 style={{ margin: '0 0 1rem', color: '#f1f5f9', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>Local Video Generation Models</h3>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Local video generation runs through ComfyUI nodes or standalone python runners:</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.85rem', backgroundColor: 'rgba(2,6,23,0.6)', borderRadius: '6px', border: '1px solid rgba(0,240,255,0.1)' }}>
                  <div style={{ fontWeight: 600, color: '#00f0ff' }}>Wan2.1 (Recommended for 12GB–16GB VRAM)</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0' }}>The premier open-source video generation model. Supports text-to-video and image-to-video via ComfyUI-WanVideoWrapper.</div>
                </div>

                <div style={{ padding: '0.85rem', backgroundColor: 'rgba(2,6,23,0.6)', borderRadius: '6px', border: '1px solid rgba(0,240,255,0.1)' }}>
                  <div style={{ fontWeight: 600, color: '#a855f7' }}>AnimateDiff (Fast / Lower VRAM)</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0' }}>Animate SD1.5 or SDXL checkpoints into 2–4 second looping animations using ComfyUI-AnimateDiff-Evolved.</div>
                </div>

                <div style={{ padding: '0.85rem', backgroundColor: 'rgba(2,6,23,0.6)', borderRadius: '6px', border: '1px solid rgba(0,240,255,0.1)' }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8' }}>CogVideoX / HunyuanVideo (High Quality)</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0' }}>State-of-the-art cinematic clips. Best used with 24GB VRAM (RTX 3090/4090) or with quantized GGUF weights.</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CORS & NETWORKING */}
          {activeTab === 'cors' && (
            <div>
              <h3 style={{ margin: '0 0 1rem', color: '#f1f5f9', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>Troubleshooting Local Connections</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fbbf24' }}>Why do connections fail even when the app is running?</strong>
                <p style={{ color: '#94a3b8', margin: '0.3rem 0' }}>Web browsers enforce Cross-Origin Resource Sharing (CORS). By default, Ollama and ComfyUI block web requests unless explicitly permitted.</p>
              </div>

              <div style={{ padding: '0.85rem', backgroundColor: 'rgba(2,6,23,0.7)', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '0.3rem' }}>Quick Fix Checklist:</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
                  <li>Ensure Ollama has environment variable <code style={{ color: '#00f0ff' }}>OLLAMA_ORIGINS="*"</code></li>
                  <li>In LM Studio, ensure the <code style={{ color: '#00f0ff' }}>CORS</code> switch is toggled ON</li>
                  <li>In ComfyUI, append <code style={{ color: '#00f0ff' }}>--enable-cors-header "*"</code> to the launch parameters</li>
                  <li>Click <strong>Test Local Ports</strong> at the top right to verify connection status live</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
