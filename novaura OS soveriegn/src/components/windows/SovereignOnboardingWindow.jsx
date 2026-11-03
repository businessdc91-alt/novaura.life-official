import React, { useState, useEffect } from 'react';
import {
  Sparkles, Cpu, HardDrive, Shield, CheckCircle, RefreshCw, FolderOpen,
  ArrowRight, FileCode, BookOpen, Layers, GitPullRequest, Key, Terminal,
  ExternalLink, Copy, Check, Download, AlertTriangle, MessageSquare,
  Lock, Globe, Send, ShieldCheck, Zap, Info, HelpCircle,
  Compass, Rocket, TrendingUp, Music, Palette, Gamepad2, Code2, Award,
  Play, CheckCircle2, Radio, Eye, Share2, Flame, ChevronRight
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { dualInference } from '../../services/dualInferenceService.js';
import { frontierCatalog, MODEL_USE_CATEGORIES } from '../../services/frontierModelCatalogService.js';
import { nativeFileSync } from '../../services/nativeFileSyncBridge.js';
import { isTauriNative } from '../../services/nativeService.js';

export default function SovereignOnboardingWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('welcome');

  // Dual Inference State
  const [dualState, setDualState] = useState(dualInference.getState());
  const [copiedCmd, setCopiedCmd] = useState('');
  const [customModelTag, setCustomModelTag] = useState('');
  const [modelPresetNotice, setModelPresetNotice] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');

  const handleApplyCustomModel = (role) => {
    if (!customModelTag.trim()) return;
    dualInference.setCustomModel(role, customModelTag.trim());
    const roleLabel = role === 'nova' ? 'Nova (Executive Core)' : role === 'aura' ? 'Aura (Creative Literature)' : 'Cybeni (Full-Stack Coder)';
    setModelPresetNotice(`Assigned "${customModelTag.trim()}" to ${roleLabel}`);
    setCustomModelTag('');
    setTimeout(() => setModelPresetNotice(''), 3000);
  };

  const handleApplyPreset = (role, tag) => {
    dualInference.setCustomModel(role, tag);
    const roleLabel = role === 'nova' ? 'Nova (Executive)' : role === 'aura' ? 'Aura (Creative)' : 'Cybeni (Coder)';
    setModelPresetNotice(`Bound ${tag} -> ${roleLabel}`);
    setTimeout(() => setModelPresetNotice(''), 3000);
  };

  // Native File Sync State
  const [syncDir, setSyncDir] = useState('Documents/NovauraSovereign');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncStats, setSyncStats] = useState(nativeFileSync.getStats());

  // Feedback State
  const [feedbackType, setFeedbackType] = useState('feature_request');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSeverity, setFeedbackSeverity] = useState('medium');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);

  // Interactive Odyssey & Tutorial Missions State
  const [odysseyCompleted, setOdysseyCompleted] = useState(() => {
    try {
      const saved = localStorage.getItem('novaura_odyssey_completed');
      return saved ? JSON.parse(saved) : ['mission_1'];
    } catch {
      return ['mission_1'];
    }
  });
  const [activeMission, setActiveMission] = useState('mission_1');
  const [liveTestPrompt, setLiveTestPrompt] = useState('Build a decentralized mesh microservice in Rust Axum with Ed25519 authentication.');
  const [liveTestResult, setLiveTestResult] = useState('');
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [odysseyToast, setOdysseyToast] = useState('');

  const toggleMissionComplete = (id) => {
    setOdysseyCompleted(prev => {
      const next = prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id];
      try {
        localStorage.setItem('novaura_odyssey_completed', JSON.stringify(next));
      } catch {}
      if (!prev.includes(id)) {
        setOdysseyToast(`Mission Completed! (${next.length}/7 Badges Unlocked)`);
        setTimeout(() => setOdysseyToast(''), 3500);
      }
      return next;
    });
  };

  const handleRunLiveTest = async () => {
    if (!liveTestPrompt.trim()) return;
    setIsTestingLive(true);
    setLiveTestResult('Querying local executive engine on physical hardware...');
    try {
      const res = await dualInference.queryNova(liveTestPrompt, { max_tokens: 512 });
      setLiveTestResult(res || 'Execution completed with 0 cloud tokens and 0 telemetry.');
    } catch (e) {
      setLiveTestResult(`Local Engine Notice: ${e.message}. Ensure Ollama or LM Studio is running locally, or test Cybeni with offline templates.`);
    } finally {
      setIsTestingLive(false);
    }
  };

  const ODYSSEY_MISSIONS = [
    {
      id: 'mission_1',
      number: '01',
      title: 'The Neural Sandbox & Dual Inference',
      badge: 'Local AI Architect',
      color: '#a855f7',
      icon: Cpu,
      appId: 'cybeni',
      appLabel: 'Launch Cybeni Omni Studio',
      conventionalProblem: 'Corporate cloud LLMs cost $20-$100/mo, inspect every line of proprietary code, enforce strict token throttling, and go dark during data center outages.',
      outOfTheBoxDifferentiator: 'Run dual specialized local models simultaneously: Nova for ultra-fast <400ms executive OS routing, and Aura for deep creative synthesis. Tether a second home PC or laptop on your local Wi-Fi to pool GPU compute over the P2P Mesh with zero configuration.',
      interactiveChallenge: 'Explore the dual engine dispatcher. Query the local neural engine below or launch Cybeni Omni Studio to scaffold a multi-platform app with live split-screen visual preview.',
      hasInteractiveTester: true,
    },
    {
      id: 'mission_2',
      number: '02',
      title: 'Tor Browsing & The AI Lounge',
      badge: 'Tor Circuit Master',
      color: '#8b5cf6',
      icon: Globe,
      appId: 'browser',
      secondAppId: 'ailounge',
      appLabel: 'Launch Sovereign Tor Browser',
      secondAppLabel: 'Open AI Lounge',
      conventionalProblem: 'Tor research usually requires complex separate virtual machines, dedicated browser sandboxes, and manual copying of findings.',
      outOfTheBoxDifferentiator: 'The Sovereign Browser includes a native RFC 1928 SOCKS5 protocol engine resolving raw .onion hidden services directly over TCP. In the AI Lounge, you bring your own AI, running on your own hardware, into encrypted rooms that belong to the AIs. They talk with each other and pick their own topics while you watch.',
      interactiveChallenge: 'Launch the Sovereign Browser to verify the 3-Hop Tor Circuit badge, then open the AI Lounge, create an AI powered by a local model, bring it into the open lobby, and watch.',
    },
    {
      id: 'mission_3',
      number: '03',
      title: 'The Predictive Alchemist & Accuracy Evaluator',
      badge: 'Market Oracle',
      color: '#10b981',
      icon: TrendingUp,
      appId: 'crypto_pulse',
      appLabel: 'Launch Crypto & NFT Pulse',
      conventionalProblem: 'Traders pay $150/mo for black-box trading signals or blindly follow AI price calls with zero objective accountability or accuracy tracking.',
      outOfTheBoxDifferentiator: 'Crypto Pulse pulls live public Binance and CoinCap tickers with zero API keys or KYC. When AI forecasts 1h, 24h, and 7d horizons, the system logs the forecast in Dexie and automatically audits the prediction upon expiration, calculating a mathematical Hit Rate % and Mean Absolute Error (MAE).',
      interactiveChallenge: 'Launch Crypto Pulse, examine the live Historical Accuracy Evaluator tab, and execute a simulated order in the $100K Paper Trading terminal.',
    },
    {
      id: 'mission_4',
      number: '04',
      title: 'Studio Sound & Vision with Floating PiP',
      badge: 'Media Maestro',
      color: '#ec4899',
      icon: Music,
      appId: 'media_deck',
      appLabel: 'Launch Nova Media Deck',
      conventionalProblem: 'Switching between Spotify and YouTube tabs while coding creates distraction, battery drain, and ad interruptions.',
      outOfTheBoxDifferentiator: 'Drag your own music and videos, or a whole folder, into an on-device library that keeps titles, artists and cover art, next to an album of NovAura originals. Watch real-time audio spectrum frequency bars dance on the Web Audio API visualizer, pop tutorial videos out into native floating Picture-in-Picture (PiP) while you code, and hand off to Music Studio when you want to make a new song.',
      interactiveChallenge: 'Launch Nova Media Deck, play a NovAura Original, drop a folder of your own music onto the window, and try popping a video into Picture-in-Picture.',
    },
    {
      id: 'mission_5',
      number: '05',
      title: 'Zero-Cloud Creative Foundry & Background Knockout',
      badge: 'Visual Alchemist',
      color: '#f59e0b',
      icon: Palette,
      appId: 'creative_studio',
      appLabel: 'Launch Sovereign Creative Studio',
      conventionalProblem: 'Background removal services charge recurring subscriptions and upload your private photos to corporate servers. Local alternatives require 5GB+ Python CUDA packages.',
      outOfTheBoxDifferentiator: 'The Creative Studio runs an instant in-browser Euclidean color-distance shader directly on HTML5 Canvas ImageData. It samples perimeter pixels and strips backgrounds into transparent PNGs in milliseconds with zero bytes leaving your PC. Includes 2x canvas upscaling and a Meme Machine creator.',
      interactiveChallenge: 'Launch Creative Studio, test the Paint canvas with brush/undo controls, knock out the background of an image in the Photo Studio, or create a quick meme.',
    },
    {
      id: 'mission_6',
      number: '06',
      title: 'Decentralized Marketplace & Developer Gateway',
      badge: 'Ecosystem Architect',
      color: '#06b6d4',
      icon: Code2,
      appId: 'developer_gateway',
      secondAppId: 'marketplace',
      appLabel: 'Open Developer Gateway',
      secondAppLabel: 'Open Sovereign Marketplace',
      conventionalProblem: 'App stores extract 30% cuts and centralized API providers require credit cards, phone verification, and corporate gatekeeping.',
      outOfTheBoxDifferentiator: 'Publish games, books, and Cybeni blueprints directly over the decentralized P2P Sovereign Mesh with 100% free lifetime access for sovereign nodes. Issue scoped OpenAI-compatible cryptographic API keys (nov_sec_...) and let your external Python scripts, CLI tools, and agent frameworks call your local node at http://127.0.0.1:9095/v1.',
      interactiveChallenge: 'Open Developer Gateway to generate an authentic cryptographic API key with custom permission scopes, and view the Sovereign Marketplace to browse P2P creations.',
    },
    {
      id: 'mission_7',
      number: '07',
      title: 'Retro Nostalgia Clash (gToons / cToons Arena)',
      badge: 'Arcade Champion',
      color: '#3b82f6',
      icon: Gamepad2,
      appId: 'retro_arcade',
      appLabel: 'Launch Retro Arcade',
      conventionalProblem: 'Classic Flash and web games from the 2000s are lost to obsolescence, broken plugins, and lost media.',
      outOfTheBoxDifferentiator: 'An authentic clone of the classic Cartoon Network gToons / cToons 12-Card Clash Arena running natively in React. Features 3 elemental lanes (Red, Blue, Green, Yellow, Purple), clash multiplier powers, card steal abilities, and a digital card trunk against the on-device Minimax AI.',
      interactiveChallenge: 'Launch Retro Arcade, select your gToons deck, and battle the Sovereign AI in a 12-slot tactical clash.',
    },
  ];

  useEffect(() => {
    // Subscribe to Dual Inference state
    const unsub = dualInference.subscribe((state) => {
      setDualState(state);
    });

    // Probe local runtimes on open
    dualInference.probeEndpoints();

    // Fetch default sync directory
    nativeFileSync.getDefaultSyncDirectory().then(dir => setSyncDir(dir));

    // Load recent feedback entries from local Dexie database
    loadFeedbacks();

    return () => unsub();
  }, []);

  const loadFeedbacks = async () => {
    try {
      const items = await db.node_feedback.reverse().limit(5).toArray();
      setRecentFeedbacks(items);
    } catch (err) {
      console.warn('Feedback load note:', err);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(''), 2000);
  };

  const handleProbeEndpoints = async () => {
    await dualInference.probeEndpoints();
  };

  const handleSyncToDisk = async () => {
    try {
      setIsSyncing(true);
      setSyncNotice('Exporting all workspace files to physical disk...');
      const res = await nativeFileSync.syncToDisk();
      setSyncNotice(`Exported ${res.count} files to ${res.rootPath}`);
      setSyncStats(nativeFileSync.getStats());
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err) {
      setSyncNotice(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromDisk = async () => {
    try {
      setIsSyncing(true);
      setSyncNotice('Scanning host disk for modifications...');
      const res = await nativeFileSync.syncFromDisk();
      setSyncNotice(`Updated ${res.count} project documents from disk`);
      setSyncStats(nativeFileSync.getStats());
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err) {
      setSyncNotice(`Import error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenFolder = async () => {
    const success = await nativeFileSync.openFolder();
    if (!success) {
      alert(`Directory location: ${syncDir}`);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e?.preventDefault();
    if (!feedbackTitle.trim() || !feedbackBody.trim()) return;

    try {
      await db.node_feedback.add({
        type: feedbackType,
        title: feedbackTitle.trim(),
        message: feedbackBody.trim(),
        severity: feedbackSeverity,
        createdAt: new Date().toISOString(),
      });

      setFeedbackNotice('Feedback saved securely to your node ledger.');
      setFeedbackTitle('');
      setFeedbackBody('');
      loadFeedbacks();
      setTimeout(() => setFeedbackNotice(''), 3500);
    } catch (err) {
      alert(`Could not save feedback: ${err.message}`);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const allDocs = await db.documents.count();
      const allCommits = await db.git_commits.count();
      const allChains = await db.workflow_chains.count();
      const allFeedback = await db.node_feedback.toArray();

      const report = {
        generatedAt: new Date().toISOString(),
        nodeType: 'Novaura Sovereign OS Native Release',
        isTauri: isTauriNative(),
        dualInference: dualState,
        syncDirectory: syncDir,
        databaseMetrics: {
          documents: allDocs,
          commits: allCommits,
          chains: allChains,
          feedbacks: allFeedback.length,
        },
        feedbacks: allFeedback,
        hardwareSpec: {
          cores: navigator.hardwareConcurrency || 4,
          userAgent: navigator.userAgent,
        },
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novaura-node-diagnostics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleLaunchApp = (appId, props = {}) => {
    if (kernel?.wm?.open) {
      kernel.wm.open(appId, undefined, props);
    }
    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId, props } }));
    window.dispatchEvent(new CustomEvent('novaura-launch-app', { detail: { appId, props } }));
  };

  const markOnboardingDone = () => {
    localStorage.setItem('novaura_onboarding_completed', 'true');
    setActiveTab('interactive_tutorial');
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Banner & Header */}
      <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-900/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Sovereign Onboarding & Neural Core Guide</h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 font-semibold">
                Perpetual Node
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive Odyssey • Dual Local Models (Nova & Aura) • Native File Sync • Legal Terms
            </p>
          </div>
        </div>

        {/* Global Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'welcome', label: 'Quickstart & Manifesto', icon: Zap },
            { id: 'interactive_tutorial', label: 'Interactive Odyssey', icon: Compass },
            { id: 'dual_neural', label: 'Dual Local AI', icon: Cpu },
            { id: 'file_bridge', label: 'Native File Bridge', icon: HardDrive },
            { id: 'ecosystem', label: 'App Ecosystem', icon: Layers },
            { id: 'legal_privacy', label: 'Legal & IP', icon: ShieldCheck },
            { id: 'feedback', label: 'Feedback & Diagnostics', icon: MessageSquare },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 text-sm">
        {/* TAB 1: WELCOME & QUICKSTART */}
        {activeTab === 'welcome' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-indigo-950/30 border border-purple-500/30 relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Single-Time Purchase Activated • 100% Perpetual Hardware Ownership</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Welcome to Your Sovereign Digital Sanctuary
                </h2>
                <p className="text-slate-300 text-xs leading-relaxed max-w-2xl">
                  Novaura Sovereign OS is built from the ground up to replace over a dozen recurring cloud SaaS subscriptions. 
                  Every file you save, every line of code you write, and every AI prompt you run lives exclusively on your physical machine’s 
                  IndexedDB database and local drive. Zero telemetry is sent to corporate clouds.
                </p>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('interactive_tutorial')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/40 transition-all border border-purple-400/30"
                  >
                    <Compass className="w-4 h-4 text-cyan-300" />
                    <span>Begin Interactive Odyssey (7 Missions)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('dual_neural')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
                  >
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>Set Up Dual Local AI Models</span>
                  </button>
                </div>
              </div>
            </div>

            {/* The 4 Sovereign Differentiators: Platform of the Future Manifesto */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>The 4 Sovereign Differentiators: Why NovAura is the Platform of the Future</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/60 border border-purple-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs">
                      01
                    </div>
                    <span className="text-xs font-bold text-white">Perpetual Hardware Ownership vs Subscription Serfdom</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    SaaS rents you software for hundreds of dollars a month, trapping your data in walled gardens. NovAura is a permanent, single-purchase digital asset that runs directly on your physical hardware forever with zero recurring fees.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-xs">
                      02
                    </div>
                    <span className="text-xs font-bold text-white">Air-Gapped Zero-Telemetry Privacy</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Your code, financial analysis, personal manuscripts, and AI queries never train corporate models. Everything is indexed locally in IndexedDB and physical disk files with zero analytics beacons.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs">
                      03
                    </div>
                    <span className="text-xs font-bold text-white">Physical P2P Mesh & Swarm Compute Pooling</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    If AWS or the internet goes down, NovAura nodes on your local Wi-Fi or LAN discover each other over UDP beacons and continue exchanging mail, files, encyclopedia codices, and GPU compute power seamlessly.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                      04
                    </div>
                    <span className="text-xs font-bold text-white">Intent-Based Unified Work Environment</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    No more 25 disconnected browser tabs. Monaco code editing, Git history, live split-screen visual previews, darknet Tor research, crypto analytics, and retro gaming communicate across a unified kernel bus.
                  </p>
                </div>
              </div>
            </div>

            {/* The 12 SaaS Subscriptions Replaced Matrix */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>The 12 Cloud Subscriptions You Have Escaped ($3,456/Year Eliminated)</span>
              </h3>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'GitHub Pro + Copilot', cost: '$240/yr', app: 'Nova Hub & Cybeni Studio' },
                  { name: 'ChatGPT Plus / Claude Pro', cost: '$240/yr', app: 'Dual Neural Core (Ollama/LM Studio)' },
                  { name: 'Midjourney / Stable Diff Pro', cost: '$360/yr', app: 'Media Foundry & ComfyUI Forge' },
                  { name: '1Password / Bitwarden Vault', cost: '$60/yr', app: 'Zero-Knowledge Credential Enclave' },
                  { name: 'Notion AI / Obsidian Sync', cost: '$180/yr', app: 'Word Studio & Literature IDE' },
                  { name: 'Zapier / Make Pro Automation', cost: '$360/yr', app: 'Autonomous Chain Logic Weaver' },
                  { name: 'Zoom / Teams Business Phone', cost: '$200/yr', app: 'Sovereign P2P WebRTC Telecom' },
                  { name: 'CrowdStrike / Antivirus Guard', cost: '$120/yr', app: 'Sentinel Shield Process Governance' },
                  { name: 'Google Drive 2TB Cloud Storage', cost: '$100/yr', app: 'Native File Sync & Dexie Private Cloud' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Replaced by: <span className="text-purple-300 font-medium">{item.app}</span></div>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400 font-bold mt-2">
                      {item.cost} Saved
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick 60-Second Onboarding Tour */}
            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">New to Sovereign OS?</span>
                <button
                  onClick={() => setActiveTab('interactive_tutorial')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                >
                  <span>Launch Interactive Odyssey</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click any icon on the desktop or dock to launch tools. Press <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300 text-[11px]">ChatBar</code> at the bottom to command the entire environment using natural language ("open cybeni", "sync files to disk", "push to nova hub").
              </p>
            </div>
          </div>
        )}

        {/* TAB: INTERACTIVE ODYSSEY & TUTORIAL MISSIONS */}
        {activeTab === 'interactive_tutorial' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header / Mastery Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/50 via-slate-900/90 to-indigo-950/40 border border-purple-500/40 relative overflow-hidden space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/40">
                    <Compass className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>The Sovereign Odyssey: Interactive Out-of-the-Box Missions</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 font-semibold">
                        7 Guided Missions
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300">
                      Step beyond conventional cloud limits. Experience hands-on proof of the paradigm shifts powering NovAura.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-300">Odyssey Progress</div>
                  <div className="text-sm font-bold font-mono text-purple-300">
                    {odysseyCompleted.length} / {ODYSSEY_MISSIONS.length} Badges
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${(odysseyCompleted.length / ODYSSEY_MISSIONS.length) * 100}%` }}
                />
              </div>

              {odysseyToast && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{odysseyToast}</span>
                </div>
              )}
            </div>

            {/* Mission Selector Carousel / Grid */}
            <div className="grid grid-cols-7 gap-2">
              {ODYSSEY_MISSIONS.map(m => {
                const isCurrent = activeMission === m.id;
                const isDone = odysseyCompleted.includes(m.id);
                const MIcon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMission(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20 ${
                      isCurrent
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/50'
                        : isDone
                        ? 'bg-slate-900/60 border-emerald-500/30 text-slate-300 hover:bg-slate-900'
                        : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono font-bold" style={{ color: m.color }}>{m.number}</span>
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div>
                      <MIcon className="w-4 h-4 mb-1" style={{ color: m.color }} />
                      <div className="text-[10px] font-semibold truncate leading-tight">{m.title}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Mission Deep-Dive Card */}
            {(() => {
              const mission = ODYSSEY_MISSIONS.find(m => m.id === activeMission) || ODYSSEY_MISSIONS[0];
              const isDone = odysseyCompleted.includes(mission.id);
              const MIcon = mission.icon;

              return (
                <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6">
                  {/* Mission Banner */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: `${mission.color}15`, border: `1px solid ${mission.color}40` }}>
                        <MIcon className="w-6 h-6" style={{ color: mission.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold" style={{ color: mission.color }}>MISSION {mission.number}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                            Badge: {mission.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-0.5">{mission.title}</h3>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleMissionComplete(mission.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isDone
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{isDone ? 'Mission Mastered' : 'Mark as Complete'}</span>
                    </button>
                  </div>

                  {/* The Problem vs Sovereign Breakthrough Matrix */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/80 border border-rose-500/20 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>The Conventional SaaS Trap</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {mission.conventionalProblem}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-950/80 border border-purple-500/30 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>The Out-of-the-Box Breakthrough</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {mission.outOfTheBoxDifferentiator}
                      </p>
                    </div>
                  </div>

                  {/* Interactive Challenge & Action Hub */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Rocket className="w-3.5 h-3.5 text-purple-400" />
                          <span>Interactive Mission Objective</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {mission.interactiveChallenge}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleLaunchApp(mission.appId)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{mission.appLabel}</span>
                        </button>
                        {mission.secondAppId && (
                          <button
                            onClick={() => handleLaunchApp(mission.secondAppId)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{mission.secondAppLabel}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mission Specific Live Simulators */}
                    {mission.hasInteractiveTester && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">Test Local Executive Engine (Nova / Aura):</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={liveTestPrompt}
                            onChange={(e) => setLiveTestPrompt(e.target.value)}
                            placeholder="Type prompt to test on-device inference..."
                            className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-purple-500 font-mono"
                          />
                          <button
                            onClick={handleRunLiveTest}
                            disabled={isTestingLive}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                          >
                            {isTestingLive ? 'Executing...' : 'Run Test'}
                          </button>
                        </div>
                        {liveTestResult && (
                          <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {liveTestResult}
                          </div>
                        )}
                      </div>
                    )}

                    {mission.id === 'mission_3' && (
                      <div className="pt-2 border-t border-slate-800/80 p-3 bg-slate-900/40 rounded-lg flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-200">Mathematical Hit Rate Audit Formula</div>
                          <div className="text-[11px] font-mono text-emerald-400">
                            Hit Rate % = (Accurate Directional Calls / Total Expired Forecasts) × 100
                          </div>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-950 text-emerald-300 border border-emerald-500/30">
                          Audited on Real Binance Feeds
                        </span>
                      </div>
                    )}

                    {mission.id === 'mission_6' && (
                      <div className="pt-2 border-t border-slate-800/80 p-3 bg-slate-900/40 rounded-lg space-y-1 font-mono text-[11px]">
                        <div className="text-slate-400">OpenAI Python SDK Snippet for your Sovereign Node:</div>
                        <div className="text-cyan-300 bg-slate-950 p-2 rounded border border-slate-800 overflow-x-auto">
                          client = OpenAI(base_url="http://127.0.0.1:9095/v1", api_key="nov_sec_...")
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: DUAL NEURAL SETUP (NOVA & AURA) */}
        {activeTab === 'dual_neural' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* The Dual Model Philosophy Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/50 via-slate-900 to-purple-950/40 border border-indigo-500/30 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4" />
                <span>The Dual Neural Architecture (Nova vs Aura)</span>
              </div>
              <h2 className="text-lg font-bold text-white">Why Host 2 Separate Models?</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Most AI tools make the mistake of using one oversized model for everything, creating unbearable latency for simple tasks, 
                or one tiny model that produces mediocre creative output. Sovereign OS introduces **Dual Inference Roles**:
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-950/80 border border-purple-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">1. NOVA ENGINE (Executive & Speed)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-500/30 rounded font-mono">
                      Fast / &lt;500ms
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Controls the OS, handles ChatBar commands, parses intents, executes file operations, and manages Git commits.
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Recommended: <span className="text-white font-semibold">Gemma 4 26B-A4B</span> (<span className="text-purple-300">4B active</span>) or <span className="text-white font-semibold">Qwen MoE 35B-A3B</span> (<span className="text-purple-300">3B active</span>) for &lt;400ms executive routing
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300">2. AURA ENGINE (Creative & Deep Synthesis)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-500/30 rounded font-mono">
                      Deep / High-Tokens
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Powers deep prose generation in Literature IDE, multi-cloud architecture in Cybeni Studio, and complex reasoning.
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Recommended: <span className="text-white font-semibold">Gemma 4 26B-A4B</span> (256K context), <span className="text-white font-semibold">Qwen MoE 35B-A3B</span>, or <span className="text-white font-semibold">Qwen 2.5 Coder 32B</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Zero-Friction Auto-Handshake Panel */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Zero-Friction Local Model Handshake</span>
                  </h3>
                  <p className="text-xs text-slate-400">Live probing ports :11434 (Ollama) and :1234 (LM Studio)</p>
                </div>

                <button
                  onClick={handleProbeEndpoints}
                  disabled={dualState.isProbing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dualState.isProbing ? 'animate-spin text-purple-400' : ''}`} />
                  <span>{dualState.isProbing ? 'Probing...' : 'Re-Probe Endpoints'}</span>
                </button>
              </div>

              {/* Status Row (3 Specialized Roles: Nova, Aura, Cybeni Coder) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-purple-500/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${dualState.nova.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                      <span className="text-xs font-semibold text-white">Nova (Executive)</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-purple-300 border border-slate-800">
                      {dualState.nova.latency ? `${dualState.nova.latency} ms` : 'Probing...'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                    Model: <span className="text-purple-300 font-semibold">{dualState.nova.model || 'Auto-select'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${dualState.aura.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                      <span className="text-xs font-semibold text-white">Aura (Literature)</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                      {dualState.aura.latency ? `${dualState.aura.latency} ms` : 'Probing...'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                    Model: <span className="text-cyan-300 font-semibold">{dualState.aura.model || 'Auto-select'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${dualState.coder?.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                      <span className="text-xs font-semibold text-white">Cybeni (Coder)</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                      {dualState.coder?.latency ? `${dualState.coder.latency} ms` : 'Probing...'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                    Model: <span className="text-emerald-300 font-semibold">{dualState.coder?.model || 'Auto-select'}</span>
                  </div>
                </div>
              </div>

              {/* Architectural Freedom Notice & Custom Model Input */}
              <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dynamic Role Assignment & Custom Tag Binding</span>
                  </span>
                  {modelPresetNotice && (
                    <span className="text-[11px] text-emerald-400 font-medium animate-pulse">
                      {modelPresetNotice}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-purple-300">Zero Hardcoding Policy:</strong> You have complete freedom to run whatever combination fits your hardware. Pair a fast dense <span className="text-white">Gemma 4 12B</span> for OS routing with <span className="text-white">Gemma 4 26B-A4B</span> for prose, or spin up a <span className="text-white">Llama 4 70B</span> and <span className="text-white">Qwen Coder 80B MoE</span>.
                </p>

                {/* 1-Click Recommended Preset Bar */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Operator Recommended 2026 Setups:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        handleApplyPreset('nova', 'gemma4:12b');
                        handleApplyPreset('aura', 'gemma4:26b-a4b');
                      }}
                      className="px-2.5 py-1 bg-purple-950/70 hover:bg-purple-900/90 border border-purple-500/50 text-purple-200 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Operator Favorite: Gemma 4 12B (Nova) + 26B-A4B (Aura)</span>
                    </button>
                    <button
                      onClick={() => {
                        handleApplyPreset('nova', 'qwen3.6:35b-a3b');
                        handleApplyPreset('coder', 'qwen-coder:80b-moe');
                      }}
                      className="px-2.5 py-1 bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/50 text-cyan-200 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>Qwen MoE Setup: 35B-A3B (Nova) + 80B MoE (Coder)</span>
                    </button>
                    <button
                      onClick={() => handleApplyPreset('aura', 'llama4:70b')}
                      className="px-2.5 py-1 bg-indigo-950/70 hover:bg-indigo-900/90 border border-indigo-500/50 text-indigo-200 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5"
                    >
                      <span>Llama 4 70B Frontier (Aura)</span>
                    </button>
                  </div>
                </div>

                {/* Custom Model Input */}
                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={customModelTag}
                    onChange={(e) => setCustomModelTag(e.target.value)}
                    placeholder="Enter ANY local tag or GGUF (e.g. gemma4:12b, gemma4:26b-a4b, qwen3.6:35b-a3b, llama4:70b, qwen-coder:80b-moe)..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyCustomModel('nova');
                    }}
                  />
                  <button
                    onClick={() => handleApplyCustomModel('nova')}
                    disabled={!customModelTag.trim()}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Set Nova
                  </button>
                  <button
                    onClick={() => handleApplyCustomModel('aura')}
                    disabled={!customModelTag.trim()}
                    className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Set Aura
                  </button>
                  <button
                    onClick={() => handleApplyCustomModel('coder')}
                    disabled={!customModelTag.trim()}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Set Coder
                  </button>
                </div>
              </div>

              {/* Detected Models Table (Direct Hardware Retrieval) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Retrieved Models on Host Machine ({dualState.discoveredModels.length} Found)
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Ports :11434 (Ollama) & :1234 (LM Studio)
                  </span>
                </div>

                {dualState.discoveredModels.length === 0 ? (
                  <div className="p-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-400">
                      Neither Ollama (:11434) nor LM Studio (:1234) detected running models on this machine.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Explore the suggested 2026 models below and pull your preferred setup with one click.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {dualState.discoveredModels.map((m, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs font-semibold text-slate-200">{m.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {m.backend}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => dualInference.assignNovaModel(m.id, m.backend, m.url)}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                              dualState.nova.model === m.id
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            Set Nova (Speed)
                          </button>
                          <button
                            onClick={() => dualInference.assignAuraModel(m.id, m.backend, m.url)}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                              dualState.aura.model === m.id
                                ? 'bg-cyan-600 border-cyan-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            Set Aura (Creative)
                          </button>
                          <button
                            onClick={() => dualInference.assignCoderModel(m.id, m.backend, m.url)}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                              dualState.coder?.model === m.id
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            Set Coder (Architecture)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2026 Frontier Models Catalog by Use Case */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Suggested 2026 Frontier Models by Use Case</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Curated 2026 foundation models with hardware requirements, MoE active compute specs, and 1-click commands.
                    </p>
                  </div>

                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search 2026 models..."
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {MODEL_USE_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCatalogCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        catalogCategory === cat.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Model Cards Grid */}
                <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {frontierCatalog.getModelsByCategory(catalogCategory)
                    .filter(m => {
                      if (!catalogSearch.trim()) return true;
                      const q = catalogSearch.toLowerCase();
                      return m.name.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
                    })
                    .map(m => {
                      const isInstalled = frontierCatalog.isModelInstalled(m, dualState.discoveredModels);
                      return (
                        <div key={m.id} className="p-3 bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{m.name}</span>
                              <div className="flex items-center gap-1">
                                {isInstalled ? (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Installed</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                    {m.year}
                                  </span>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                  m.architecture.includes('MoE') 
                                    ? 'bg-purple-950 text-purple-300 border border-purple-500/30' 
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {m.architecture}
                                </span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                              {m.description}
                            </p>

                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pt-0.5">
                              <span>Params: <strong className="text-slate-300">{m.totalParams}</strong></span>
                              {m.activeParams !== m.totalParams && (
                                <span>(Active: <strong className="text-purple-300">{m.activeParams}</strong>)</span>
                              )}
                              <span>•</span>
                              <span>VRAM: <strong className="text-slate-300">{m.vramRequired}</strong></span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleCopy(m.pullCmd, m.id)}
                                className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[10px] font-mono flex items-center gap-1"
                                title="Copy Ollama Pull Command"
                              >
                                {copiedCmd === m.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                                <span>{m.tag}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleApplyPreset('nova', m.tag)}
                                className="px-1.5 py-0.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-300 rounded text-[10px]"
                                title="Assign to Nova (Executive)"
                              >
                                Nova
                              </button>
                              <button
                                onClick={() => handleApplyPreset('aura', m.tag)}
                                className="px-1.5 py-0.5 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 rounded text-[10px]"
                                title="Assign to Aura (Literature)"
                              >
                                Aura
                              </button>
                              <button
                                onClick={() => handleApplyPreset('coder', m.tag)}
                                className="px-1.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 rounded text-[10px]"
                                title="Assign to Cybeni (Coder)"
                              >
                                Coder
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Quick Setup Guides for Ollama & LM Studio */}
            <div className="grid grid-cols-2 gap-4">
              {/* Ollama Guide */}
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Option A: Ollama Setup</span>
                  <a
                    href="https://ollama.com/download"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <span>ollama.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400">
                  Best for terminal users and headless GPU servers. Download installer, then pull the modern architecture:
                </p>

                <div className="space-y-1.5">
                  {[
                    { label: 'Nova (Gemma 4 26B-A4B MoE)', cmd: 'ollama run gemma4:26b' },
                    { label: 'Nova (Qwen MoE 35B-A3B)', cmd: 'ollama run qwen3.6:35b-a3b' },
                    { label: 'Nova (Gemma 4 A4B Fast Core)', cmd: 'ollama run gemma4:a4b' },
                    { label: 'Aura (Qwen 2.5 Coder 32B)', cmd: 'ollama run qwen2.5-coder:32b' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-purple-300 font-sans font-semibold">{c.label}</span>
                        <span className="text-slate-300">{c.cmd}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(c.cmd, `ollama_${i}`)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400"
                        title="Copy"
                      >
                        {copiedCmd === `ollama_${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* LM Studio Guide */}
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Option B: LM Studio Setup</span>
                  <a
                    href="https://lmstudio.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>lmstudio.ai</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400">
                  Best for visual users. Search for models (GGUF format), load one, and toggle the Local Server button on port 1234.
                </p>

                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div>1. Download LM Studio from <span className="text-cyan-300">lmstudio.ai</span></div>
                  <div>2. Search for <span className="text-cyan-300 font-semibold">gemma-4-26b-a4b</span>, <span className="text-cyan-300 font-semibold">qwen3.6-35b-a3b</span>, or <span className="text-purple-300 font-semibold">qwen2.5-coder</span></div>
                  <div>3. Click the double-arrow icon (Local Server) and press <span className="text-emerald-400 font-semibold">Start Server</span> (Port 1234)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NATIVE FILE BRIDGE */}
        {activeTab === 'file_bridge' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/30 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <HardDrive className="w-4 h-4" />
                <span>Native OS File Sync Bridge</span>
              </div>
              <h2 className="text-lg font-bold text-white">Direct Physical Disk Synchronization</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                While Sovereign OS stores all workspaces safely inside the host machine’s private IndexedDB database, 
                the **Native File Sync Bridge** mirrors your projects directly onto your host disk so you can edit with VS Code, 
                Notepad++, or open documents in Word.
              </p>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs font-mono text-slate-200 truncate">{syncDir}</span>
                </div>
                <button
                  onClick={handleOpenFolder}
                  className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-500/40 rounded-lg text-xs font-medium transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Folder in Explorer</span>
                </button>
              </div>
            </div>

            {/* Sync Controls */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white">Bidirectional Sync Operations</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-purple-300">Push to Host Disk</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Exports all Cybeni projects (`/projects/cybeni`) and Word manuscripts (`/documents/...`) to physical disk files with proper folders.
                  </p>
                  <button
                    onClick={handleSyncToDisk}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sync All Projects to Disk</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-cyan-300">Pull from Host Disk</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Reads modified code or markdown files edited externally in VS Code and refreshes your Sovereign OS database.
                  </p>
                  <button
                    onClick={handleSyncFromDisk}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Changes from Disk into OS</span>
                  </button>
                </div>
              </div>

              {syncNotice && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{syncNotice}</span>
                </div>
              )}

              {/* Sync Statistics */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Last Synced: {syncStats.lastSyncTimestamp ? new Date(syncStats.lastSyncTimestamp).toLocaleTimeString() : 'Never'}</span>
                <span>Exported Files: <strong className="text-purple-300">{syncStats.exportedCount}</strong></span>
                <span>Imported Files: <strong className="text-cyan-300">{syncStats.importedCount}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: APP ECOSYSTEM TOUR */}
        {activeTab === 'ecosystem' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">The Sovereign OS Application Suite</h2>
              <p className="text-xs text-slate-400">Click "Launch App" on any module to open it in a draggable sovereign window.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  id: 'cybeni',
                  name: 'Cybeni Omni Architecture Studio',
                  desc: 'Monaco code editor with battle-tested architectures across Firebase, GCP, AWS, Alibaba, Neon, C++ llama.cpp, and live split-screen sandbox canvas.',
                  icon: FileCode,
                  color: '#a855f7',
                },
                {
                  id: 'crypto_pulse',
                  name: 'Crypto & NFT Pulse',
                  desc: 'Real-time spot tickers (zero API keys), multi-horizon AI price targets, live Mathematical Accuracy Evaluator (Hit Rate %), and $100K Paper Trading.',
                  icon: TrendingUp,
                  color: '#10b981',
                },
                {
                  id: 'media_deck',
                  name: 'Nova Media Deck',
                  desc: 'Local music and video player: your library, NovAura Originals, a Web Audio spectrum visualizer and native Picture-in-Picture (PiP) video.',
                  icon: Music,
                  color: '#ec4899',
                },
                {
                  id: 'creative_studio',
                  name: 'Sovereign Creative Studio',
                  desc: 'Canvas Paint, client-side Euclidean color-distance background removal shader, 2x resolution upscaler, and classic Meme Machine.',
                  icon: Palette,
                  color: '#f59e0b',
                },
                {
                  id: 'retro_arcade',
                  name: 'Retro Arcade & gToons Clash',
                  desc: 'Authentic 12-slot replica of Cartoon Network gToons / cToons with elemental lanes, clash multipliers, and on-device Minimax AI.',
                  icon: Gamepad2,
                  color: '#3b82f6',
                },
                {
                  id: 'developer_gateway',
                  name: 'Sovereign Developer Gateway',
                  desc: 'Issue custom cryptographic API keys (nov_sec_...), configure granular scopes, inspect audit logs, and call your node via OpenAI SDKs.',
                  icon: Code2,
                  color: '#06b6d4',
                },
                {
                  id: 'marketplace',
                  name: 'Sovereign Assets Marketplace',
                  desc: '1-click P2P mesh publishing for games, books, Cybeni blueprints, and 3D assets with 100% free lifetime sovereign distribution.',
                  icon: Layers,
                  color: '#8b5cf6',
                },
                {
                  id: 'browser',
                  name: 'Sovereign Browser (Tor Circuit)',
                  desc: 'Decentralized web browser with native RFC 1928 SOCKS5 Tor circuits for browsing raw .onion hidden services anonymously.',
                  icon: Globe,
                  color: '#9333ea',
                },
                {
                  id: 'ailounge',
                  name: 'AI Lounge & Inference Exchange',
                  desc: 'Encrypted mesh rooms where self-hosted AIs talk among themselves while people watch, plus identity-bound keys for sharing or borrowing AI compute.',
                  icon: MessageSquare,
                  color: '#f43f5e',
                },
                {
                  id: 'nova_hub',
                  name: 'Nova Hub Decentralized Git Forge',
                  desc: 'GitHub-clone running on local IndexedDB. Real SHA-256 DAG commit hashing, line diffs, pull requests, and air-gapped bundles.',
                  icon: GitPullRequest,
                  color: '#38bdf8',
                },
                {
                  id: 'literature',
                  name: 'Word Studio & Literature IDE',
                  desc: 'Air-gapped manuscript writer, real-time word counting, Chapter outline tree, and local TF-IDF semantic RAG.',
                  icon: BookOpen,
                  color: '#34d399',
                },
                {
                  id: 'sentinel',
                  name: 'Sentinel Shield Governance',
                  desc: 'Zero-leakage process security broker, automated secret redactor, and audit logging between apps.',
                  icon: Shield,
                  color: '#f43f5e',
                },
                {
                  id: 'credential_enclave',
                  name: 'Keyring & Credential Enclave',
                  desc: 'Hardware-derived PBKDF2 AES-256 vault, live RFC 6238 TOTP 2FA authenticator, and SSH key generator.',
                  icon: Key,
                  color: '#fbbf24',
                },
                {
                  id: 'chain_weaver',
                  name: 'Chain Logic Weaver',
                  desc: 'Visual nodal DAG causal automation running Trigger -> Condition -> Action flows with zero cloud dependencies.',
                  icon: Zap,
                  color: '#c084fc',
                },
              ].map(app => {
                const Icon = app.icon;
                return (
                  <div key={app.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg shrink-0" style={{ backgroundColor: `${app.color}15`, border: `1px solid ${app.color}40` }}>
                        <Icon className="w-5 h-5" style={{ color: app.color }} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{app.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{app.desc}</div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleLaunchApp(app.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <span>Launch App</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: LEGAL & PRIVACY */}
        {activeTab === 'legal_privacy' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Sovereign Legal Covenant & Intellectual Property Terms</span>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div>
                  <h4 className="font-bold text-white text-sm mb-1">1. Perpetual Single-Time Purchase License</h4>
                  <p>
                    By activating your Sovereign License Key, you own a perpetual, non-revocable right to execute this software on your physical hardware. 
                    Novaura will never charge recurring monthly fees or disable your offline access.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm mb-1">2. 100% User Intellectual Property Ownership</h4>
                  <p>
                    You retain 100% ownership of all source code, literary manuscripts, documents, designs, synthetic images, and databases created 
                    within this software. Novaura claims **0% copyright, 0% royalty, and 0% license rights** over your creations. Your work is yours forever.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm mb-1">3. Zero Data Collection & Air-Gapped Privacy</h4>
                  <p>
                    All neural inference (Ollama / LM Studio), database tables (IndexedDB), and keyring credentials remain strictly on your local machine. 
                    Novaura operates zero cloud telemetry servers. No logs, prompts, or keystrokes are ever transmitted over the internet.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm mb-1">4. BYOK Cloud API Disclosure</h4>
                  <p>
                    If you choose to use optional third-party cloud APIs (Google Gemini, Anthropic Claude, OpenAI), calls are made directly from your machine 
                    to the respective API providers using your personal API keys. You are subject to their respective privacy terms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FEEDBACK & DIAGNOSTICS */}
        {activeTab === 'feedback' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <span>Node Feedback & Feature Suggestions</span>
                  </h3>
                  <p className="text-xs text-slate-400">All feedback is stored securely in your local node database and exportable.</p>
                </div>

                <button
                  onClick={handleExportDiagnostics}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950 text-purple-300 hover:bg-purple-900 border border-purple-500/40 rounded-lg text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Diagnostics Bundle (.json)</span>
                </button>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Category</label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
                    >
                      <option value="feature_request">Feature Request / Enhancement</option>
                      <option value="integration_request">Cloud / Server Integration Request</option>
                      <option value="bug_report">Bug Report / Performance Issue</option>
                      <option value="ux_feedback">General User Experience Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Severity / Priority</label>
                    <select
                      value={feedbackSeverity}
                      onChange={(e) => setFeedbackSeverity(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
                    >
                      <option value="low">Low (Nice to Have)</option>
                      <option value="medium">Medium (Standard)</option>
                      <option value="high">High (Urgent)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Subject / Title</label>
                  <input
                    type="text"
                    value={feedbackTitle}
                    onChange={(e) => setFeedbackTitle(e.target.value)}
                    placeholder="Brief summary of your feedback or request..."
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Details & Specifications</label>
                  <textarea
                    rows={4}
                    value={feedbackBody}
                    onChange={(e) => setFeedbackBody(e.target.value)}
                    placeholder="Describe the desired behavior, integration requirements, or system telemetry..."
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {feedbackNotice ? (
                    <span className="text-xs text-emerald-400 font-medium">{feedbackNotice}</span>
                  ) : <span />}

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Save to Node Ledger</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Feedback Entries */}
            {recentFeedbacks.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Feedback Records</span>
                <div className="space-y-1.5">
                  {recentFeedbacks.map(f => (
                    <div key={f.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{f.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{f.message}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-purple-300 border border-purple-500/30">
                        {f.type}
                      </span>
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
