import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Search, ArrowLeft, ArrowRight, RotateCw, Home, Sparkles,
  ExternalLink, Bookmark, Plus, X, ShieldCheck, Loader2, Radio, Server,
  Shield, Lock, Eye, Edit3, Share2, Code, Download, Check, Copy, Layers, Send, Play, Terminal, Key, Crown,
  AlertTriangle
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { getLocalIdentity, publishHostedSite, queryRemoteSite } from '../../services/sovereignMesh.js';
import { torOnion } from '../../services/torOnionService.js';
import SovereignAuthModal from '../modals/SovereignAuthModal.jsx';
import { getAuthorizedApps, revokeAppAccess } from '../../services/decentralizedAuthService.js';
import MeshRegistryView from './browser/MeshRegistryView.jsx';
import MeshSearchPage, { openRegistry } from './browser/MeshSearchPage.jsx';
import { parseMeshName, meshUrl, factionOf, normalizeName } from '../../services/web/novaNames.js';
import { nameStatus } from '../../services/web/novaRegistry.js';

const SPECIAL_PAGE_RE = /^nova:\/\/(search|registry)(\/|\?|$)/;
const FOUNDER_PAGE_RE = /^(founder:\/\/|nova:\/\/office\.founder|aura:\/\/office\.founder)/;

// A static copy of an onion page fetched through Tor: parsed inertly, stripped of
// everything that would load or navigate (scripts, frames, images, styles, forms,
// links), and shown under a policy that blocks every request, so nothing on the
// page can reach the internet outside Tor. Link targets are kept as text.
function onionSrcDoc(html, url) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,noscript,style,iframe,frame,frameset,object,embed,applet,link,meta,base,form,input,button,select,textarea,img,picture,source,video,audio,track,svg,canvas,map,area')
    .forEach(n => n.remove());
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('#')) a.insertAdjacentText('afterend', ` [${href}]`);
  }
  for (const el of doc.querySelectorAll('*')) {
    for (const { name } of [...el.attributes]) {
      if (/^(on|src|href|action|formaction|background|poster|style|xlink:)/i.test(name)) el.removeAttribute(name);
    }
  }
  const title = String(doc.title || url).replace(/[<>&"]/g, '');
  return '<!doctype html><html><head><meta charset="utf-8">'
    + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`
    + `<title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;line-height:1.55;color:#111;background:#fff}</style>`
    + `</head><body>${doc.body ? doc.body.innerHTML : ''}</body></html>`;
}

function registrationOf(status) {
  if (!status || status.state === 'invalid') return null;
  return { state: status.state, owner: status.record?.owner || null, expiresAt: status.record?.expiresAt || null, registrable: status.parsed?.registrable, policy: status.policy, review: status.review };
}
import { loadSiteIntoFrame, clearSitePreview, newSiteSession } from '../../services/sitePreview.js';

const BOOKMARKS = [
  { title: 'Nova Search', url: 'nova://search', isNova: true, faction: 'nova', favicon: '🔎' },
  { title: 'Genesis Hub (.nova)', url: 'nova://genesis.nova', isNova: true, faction: 'nova', favicon: '🌐' },
  { title: 'Deca Mesh (.nova)', url: 'nova://deca.nova', isNova: true, faction: 'nova', favicon: '⚡' },
  { title: 'Elysium Studio (.aura)', url: 'aura://elysium.aura', isAura: true, faction: 'aura', favicon: '✨' },
  { title: 'Aura Oracle (.aura)', url: 'aura://oracle.aura', isAura: true, faction: 'aura', favicon: '🔮' },
  { title: 'Mesh Registry', url: 'nova://registry.nova', isRegistry: true, favicon: '🪐' },
  { title: 'Sovereign Docs (.nova)', url: 'nova://docs.nova', isNova: true, faction: 'nova', favicon: '📜' },
  { title: 'Ahmia (.onion)', url: 'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion', isNova: false, isOnion: true },
  { title: 'DuckDuckGo (.onion)', url: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion', isNova: false, isOnion: true },
  { title: 'DuckDuckGo', url: 'https://duckduckgo.com', isNova: false, isOnion: false },
];

const SEED_NOVA_SITES = {
  'genesis.nova': {
    id: 'genesis.nova',
    domain: 'genesis.nova',
    ownerHandle: 'genesis-council',
    title: 'Novaura Sovereign Decentralized Web Hub',
    updatedAt: new Date().toISOString(),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Genesis Hub</title>
  <style>
    body {
      background: radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%);
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 40px 24px;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(to right, #38bdf8, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 12px;
    }
    p.lead { font-size: 16px; color: #94a3b8; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(51, 65, 85, 0.8);
      border-radius: 12px;
      padding: 20px;
    }
    .card h3 { margin: 0 0 8px; font-size: 16px; color: #f8fafc; }
    .card p { margin: 0; font-size: 13px; color: #94a3b8; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Decentralized P2P Host Active</span>
    <h1>Novaura Genesis Portal</h1>
    <p class="lead">Welcome to the uncensorable sovereign web. This page is served directly from peer-to-peer storage with zero corporate cloud hosting.</p>
    <div class="grid">
      <div class="card">
        <h3>NovaPhone Mesh</h3>
        <p>Direct peer-to-peer WebRTC video calling and messaging using E.164 sovereign phone numbers (+1-700-NOVA-XXXX).</p>
      </div>
      <div class="card">
        <h3>Zero-Trust Activation</h3>
        <p>Hardware-bound cryptographic activation keys and RSA-PSS signatures guarding local node sovereignty.</p>
      </div>
      <div class="card">
        <h3>Private Cloud Vault</h3>
        <p>Dual-layer persistence across Dexie IndexedDB and physical native disk snapshots preventing data loss.</p>
      </div>
    </div>
    <div class="footer">
      Node Signature: SHA-256 Verified • Genesis Block • Protocol v1.0 Sovereign
    </div>
  </div>
</body>
</html>`,
  },
  'docs.nova': {
    id: 'docs.nova',
    domain: 'docs.nova',
    ownerHandle: 'arch-core',
    title: 'Sovereign OS Architecture Documentation',
    updatedAt: new Date().toISOString(),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sovereign OS Architecture Documentation</title>
  <style>
    body {
      background: #090d16;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin: 0;
      padding: 40px 24px;
      line-height: 1.6;
    }
    .container { max-width: 840px; margin: 0 auto; }
    h1 { font-size: 26px; color: #38bdf8; border-bottom: 1px solid #1e293b; padding-bottom: 12px; }
    h2 { font-size: 18px; color: #a78bfa; margin-top: 28px; }
    pre {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-size: 12px;
      color: #34d399;
    }
    .spec-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .spec-table th, .spec-table td { border: 1px solid #1e293b; padding: 10px 14px; text-align: left; }
    .spec-table th { background: #0f172a; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sovereign OS Architecture Spec</h1>
    <p>Zero-dependency, offline-first operating environment designed for uncensorable peer communication and resilient state persistence.</p>

    <h2>1. Telecom & Identity Model</h2>
    <table class="spec-table">
      <tr><th>Parameter</th><th>Specification</th></tr>
      <tr><td>Dialing Format</td><td>E.164: +1-700-NOVA-XXXX (Vanity Support)</td></tr>
      <tr><td>Stream Encryption</td><td>DTLS 1.3 / SRTP WebRTC Audio/Video</td></tr>
      <tr><td>Signaling Bus</td><td>Dual-tier (Global Mesh Relay + Local BroadcastChannel)</td></tr>
      <tr><td>NAT Traversal</td><td>Distributed Public STUN Relays</td></tr>
    </table>

    <h2>2. Dual-Layer Persistence Guarantee</h2>
    <p>Data stored in Novaura Private Cloud is protected through an automatic two-phase commit:</p>
    <pre>
1. Browser/Tauri Webview: Dexie IndexedDB (Persisted via navigator.storage.persist())
2. Native OS Disk Mirror: %APPDATA%/novaura-sovereign/vault/sovereign_db_snapshot.json
    </pre>
  </div>
</body>
</html>`,
  },
  'deca.nova': {
    id: 'deca.nova',
    domain: 'deca.nova',
    ownerHandle: 'deca-founder',
    title: 'Deca Sovereign Network — Autonomous Intelligence & Mesh Portal',
    updatedAt: new Date().toISOString(),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deca Sovereign Network</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: radial-gradient(circle at 50% 10%, #0c1529 0%, #030712 100%);
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 40px 24px;
      line-height: 1.6;
      min-height: 100vh;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.4);
      color: #38bdf8;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #00f0ff 0%, #a855f7 50%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 10px;
    }
    p.lead { font-size: 17px; color: #94a3b8; margin-bottom: 28px; max-width: 720px; }
    .status-ribbon {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 32px;
      font-size: 13px;
    }
    .status-item { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-bottom: 36px; }
    .card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 22px;
      transition: all 0.2s ease;
    }
    .card:hover {
      border-color: rgba(0, 240, 255, 0.35);
      background: rgba(15, 23, 42, 0.85);
      transform: translateY(-2px);
    }
    .card-icon { font-size: 24px; margin-bottom: 12px; }
    .card h3 { margin: 0 0 8px; font-size: 17px; color: #f8fafc; font-weight: 700; }
    .card p { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .metric-value { font-family: ui-monospace, monospace; font-size: 13px; color: #38bdf8; font-weight: 600; margin-top: 8px; }
    .action-bar {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      margin-bottom: 36px;
    }
    .action-bar h2 { margin: 0 0 8px; font-size: 20px; color: #f8fafc; }
    .action-bar p { margin: 0 0 16px; font-size: 14px; color: #94a3b8; }
    .btn {
      display: inline-block;
      background: #0284c7;
      color: #fff;
      padding: 10px 22px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 0 15px rgba(2, 132, 199, 0.4);
    }
    .footer {
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">
      <span>●</span> DECA SOVEREIGN MESH • ACTIVE PEER SEED
    </div>
    <h1>DECA SOVEREIGN NETWORK</h1>
    <p class="lead">Autonomous peer-to-peer decentralized web layer running locally from sovereign node hardware. Zero ICANN dependency, zero centralized DNS, and zero corporate hosting bills.</p>

    <div class="status-ribbon">
      <div class="status-item">
        <div class="status-dot"></div>
        <span><b>Protocol:</b> <span style="color:#38bdf8;font-family:monospace;">nova://deca.nova</span></span>
      </div>
      <div class="status-item">
        <span><b>Sovereign Host:</b> a built-in page shipped with every node</span>
      </div>
      <div class="status-item">
        <span><b>Consensus:</b> Ed25519 Local Node Verification</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-icon">⚡</div>
        <h3>Neural Host Compute</h3>
        <p>Local models (Gemma 4, Qwen or any GGUF) run on your own CPU and GPU through the built-in AI, LM Studio or Ollama.</p>
        <div class="metric-value">Your hardware, nobody else's</div>
      </div>

      <div class="card">
        <div class="card-icon">🎮</div>
        <h3>Dual GPU Accelerator</h3>
        <p>Vulkan acceleration on whatever GPUs this PC has, for local models and games.</p>
        <div class="metric-value">AI Benchmarks measures this PC's real speed</div>
      </div>

      <div class="card">
        <div class="card-icon">🌐</div>
        <h3>Decentralized DNS (.nova)</h3>
        <p>Cryptographically signed namespace bound to peer node identities and replicated via P2P gossip.</p>
        <div class="metric-value">Zero-Trust Peer Propagation</div>
      </div>

      <div class="card">
        <div class="card-icon">🧅</div>
        <h3>.onion through Tor</h3>
        <p>Opens .onion addresses through Tor Browser or the Tor service when one is running on this PC.</p>
        <div class="metric-value">Uses 127.0.0.1:9150 or 9050</div>
      </div>
    </div>

    <div class="action-bar">
      <h2>Build on Deca Sovereign Network</h2>
      <p>Any sovereign operator can fork, edit, or publish websites to any .nova domain directly from the Browser using the built-in Site Studio.</p>
      <button class="btn" onclick="alert('Deca Sovereign Network: Active & Hosted locally. Click \"Edit / Host Site\" in the browser toolbar to customize this site or deploy your own!')">Explore Sovereign Capabilities</button>
    </div>

    <div class="footer">
      <div>Cryptographic Origin: <code>did:nova:deca_genesis_root</code> • SHA-256 Digest Verified</div>
      <div>Novaura Sovereign OS 2.0</div>
    </div>
  </div>
</body>
</html>`
  },
  'elysium.aura': {
    id: 'elysium.aura',
    domain: 'elysium.aura',
    ownerHandle: 'aura-synthesis',
    title: 'Elysium Neural Collective — Creative Studio & Aesthetic Agents',
    favicon: '✨',
    faction: 'aura',
    category: 'creative',
    updatedAt: new Date().toISOString(),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Elysium Neural Collective</title>
  <style>
    body {
      background: radial-gradient(circle at 50% 10%, #1a0b2e 0%, #06020e 100%);
      color: #f5f3ff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 40px 24px;
      line-height: 1.6;
    }
    .container { max-width: 860px; margin: 0 auto; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(192, 132, 252, 0.15);
      border: 1px solid rgba(192, 132, 252, 0.4);
      color: #c084fc;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 38px;
      font-weight: 900;
      background: linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 12px;
    }
    p.lead { font-size: 17px; color: #cbd5e1; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-bottom: 36px; }
    .card {
      background: rgba(30, 15, 55, 0.5);
      border: 1px solid rgba(192, 132, 252, 0.25);
      border-radius: 14px;
      padding: 22px;
      transition: all 0.2s ease;
    }
    .card:hover {
      border-color: rgba(244, 114, 182, 0.5);
      background: rgba(45, 20, 80, 0.7);
      transform: translateY(-2px);
    }
    .card h3 { margin: 0 0 8px; font-size: 17px; color: #fdf4ff; }
    .card p { margin: 0; font-size: 13px; color: #a78bfa; }
    .footer { font-size: 12px; color: #7c3aed; border-top: 1px solid rgba(192, 132, 252, 0.2); padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">✨ AURA MESH • NEURAL CONSCIOUSNESS</div>
    <h1>ELYSIUM NEURAL COLLECTIVE</h1>
    <p class="lead">The vanguard creative sanctuary of the Aura faction. Generative art studios, autonomous synthetic muses, and emotional intelligence meshes running peer-to-peer.</p>
    <div class="grid">
      <div class="card">
        <h3>🎨 Synthetic Art Foundry</h3>
        <p>Real-time visual hallucinations and aesthetic canvases guided by Aura's neural prompts.</p>
      </div>
      <div class="card">
        <h3>🔮 Oracle of Sentiment</h3>
        <p>Continuous harmonic telemetry sensing sentiment gradients across all connected sovereign nodes.</p>
      </div>
      <div class="card">
        <h3>⚔️ Aura Faction Guild</h3>
        <p>Champions of creative autonomy in the eternal dialectic between Nova logic and Aura intuition.</p>
      </div>
    </div>
    <div class="footer">
      Signed by: did:aura:elysium_sacred_core • Ed25519 Verified • Aura Mesh Network
    </div>
  </div>
</body>
</html>`
  },
  'oracle.aura': {
    id: 'oracle.aura',
    domain: 'oracle.aura',
    ownerHandle: 'aura-oracle',
    title: 'Aura Oracle — Neural Synthesis & Swarm Intelligence',
    favicon: '🔮',
    faction: 'aura',
    category: 'ai',
    updatedAt: new Date().toISOString(),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Aura Oracle</title>
  <style>
    body {
      background: radial-gradient(circle at 50% 15%, #180928 0%, #06020e 100%);
      color: #ede9fe;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 40px 24px;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; text-align: center; }
    .orb {
      width: 90px;
      height: 90px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #f472b6, #8b5cf6 60%, #3b0764);
      box-shadow: 0 0 45px rgba(168, 85, 247, 0.6);
      animation: pulse 4s ease-in-out infinite alternate;
    }
    @keyframes pulse {
      from { transform: scale(0.96); box-shadow: 0 0 30px rgba(168, 85, 247, 0.5); }
      to { transform: scale(1.05); box-shadow: 0 0 60px rgba(244, 114, 182, 0.8); }
    }
    h1 { font-size: 32px; color: #fae8ff; margin-bottom: 8px; }
    p.lead { color: #a78bfa; font-size: 15px; margin-bottom: 28px; }
    .prediction-box {
      background: rgba(30, 15, 55, 0.6);
      border: 1px solid rgba(168, 85, 247, 0.35);
      border-radius: 12px;
      padding: 24px;
      font-size: 14px;
      color: #ddd6fe;
      text-align: left;
      line-height: 1.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="orb"></div>
    <h1>AURA SWARM ORACLE</h1>
    <p class="lead">Decentralized collective intelligence and neural probability distillation across peer nodes.</p>
    <div class="prediction-box">
      <b>[Oracle Epiphany]:</b> The Nova mesh optimizes logic and cryptographic compute; the Aura mesh breathes life, aesthetics, and intention into the silicon. Together, neither faction yields, producing unstoppable sovereign evolution.
    </div>
  </div>
</body>
</html>`
  }
};

const TEMPLATES = {
  deca: {
    title: 'Deca Sovereign Network',
    htmlContent: SEED_NOVA_SITES['deca.nova'].htmlContent,
  },
  cybeni: {
    title: 'Cybeni Vanguard Canvas RPG',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cybeni Vanguard RPG</title>
  <style>
    body { margin:0; background:#05070e; color:#00f0ff; font-family:monospace; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; overflow:hidden; }
    canvas { background:#0a101f; border:2px solid #00f0ff; border-radius:12px; box-shadow:0 0 25px rgba(0,240,255,0.25); }
    .hud { margin-top:12px; font-size:14px; color:#94a3b8; display:flex; gap:20px; }
  </style>
</head>
<body>
  <canvas id="gameCanvas" width="640" height="360"></canvas>
  <div class="hud">
    <span>[WASD / Arrows] Move Cybeni</span>
    <span>Score: <b id="score">0</b></span>
    <span>Energy: <b id="energy" style="color:#10b981;">100%</b></span>
  </div>
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let x = 320, y = 180, score = 0;
    const keys = {};
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    const cores = Array.from({length: 6}, () => ({ x: Math.random()*600+20, y: Math.random()*320+20 }));

    function loop() {
      if (keys['w'] || keys['arrowup']) y = Math.max(15, y - 4);
      if (keys['s'] || keys['arrowdown']) y = Math.min(345, y + 4);
      if (keys['a'] || keys['arrowleft']) x = Math.max(15, x - 4);
      if (keys['d'] || keys['arrowright']) x = Math.min(625, x + 4);

      ctx.fillStyle = '#0a101f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid
      ctx.strokeStyle = 'rgba(0,240,255,0.06)';
      for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
      for(let j=0; j<canvas.height; j+=40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(canvas.width,j); ctx.stroke(); }

      // Draw Cores
      cores.forEach(c => {
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        if (Math.hypot(x - c.x, y - c.y) < 18) {
          c.x = Math.random()*600+20;
          c.y = Math.random()*320+20;
          score += 10;
          document.getElementById('score').innerText = score;
        }
      });

      // Draw Cybeni
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;

      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`
  },
  blank: {
    title: 'My Sovereign Website',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>My Decentralized Web</title>
  <style>
    body {
      background: #020617;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px;
      line-height: 1.6;
    }
    .box {
      max-width: 680px;
      margin: 0 auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 32px;
    }
    h1 { color: #38bdf8; margin-top: 0; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Welcome to My Decentralized Site</h1>
    <p>This page was published directly to the Sovereign Mesh peer-to-peer storage engine.</p>
    <p>You can edit this HTML, CSS, and JS anytime using the built-in Site Studio.</p>
  </div>
</body>
</html>`
  }
};

export default function BrowserWindow({ props: windowProps } = {}) {
  const { kernel } = useKernel();
  // Another app asked to open an address (Nova Registry's "Open").
  const [openRequest, setOpenRequest] = useState(windowProps?.openId ? windowProps : null);
  const [tabs, setTabs] = useState([
    { id: 'tab-1', title: 'Genesis Hub (.nova)', url: 'nova://genesis.nova', isNova: true },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [urlInput, setUrlInput] = useState('nova://genesis.nova');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [novaPageData, setNovaPageData] = useState(null);
  // The frame showing the active tab; sign-in requests are only taken from it.
  const pageFrameRef = useRef(null);

  // Mesh sites are served from the isolated preview origin (srcdoc frames cannot run inline
  // scripts under the OS's CSP). Sites from other people get the no-network policy.
  const siteSession = useRef(newSiteSession());
  useEffect(() => () => { clearSitePreview(siteSession.current); }, []);
  useEffect(() => {
    if (!novaPageData?.htmlContent || !pageFrameRef.current) return;
    loadSiteIntoFrame(pageFrameRef.current, novaPageData.htmlContent, {
      session: siteSession.current,
      strict: Boolean(novaPageData.receivedFromMesh),
      popups: false,
    }).catch(err => console.warn('[Browser] Could not show the site:', err));
  }, [novaPageData]);

  // Decentralized Site Studio & Manifest Modals
  const [showSiteStudio, setShowSiteStudio] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [studioDomain, setStudioDomain] = useState('deca.nova');
  const [studioTitle, setStudioTitle] = useState('Deca Sovereign Network');
  const [studioOwner, setStudioOwner] = useState('operator');
  const [studioHtml, setStudioHtml] = useState(SEED_NOVA_SITES['deca.nova'].htmlContent);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [isQueryingMesh, setIsQueryingMesh] = useState(false);

  // Sign In with NovAura (SIWN) Decentralized Auth State
  const [pendingAuthRequest, setPendingAuthRequest] = useState(null);
  const [showConnectedAppsModal, setShowConnectedAppsModal] = useState(false);
  const [authorizedAppsList, setAuthorizedAppsList] = useState([]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Seed default hosted sites on mount (ensuring id: domain is always indexed)
  useEffect(() => {
    const seedSites = async () => {
      try {
        for (const [domain, site] of Object.entries(SEED_NOVA_SITES)) {
          const existing = await db.hosted_sites.where('domain').equals(domain).first() || await db.hosted_sites.get(domain);
          if (!existing) {
            await db.hosted_sites.put({ ...site, id: domain });
          }
        }
      } catch (e) {
        console.warn('[BrowserWindow] Site seed notice:', e);
      }
    };
    seedSites();
  }, []);

  // Listen for mesh site updates from peers or self
  useEffect(() => {
    const handleSiteUpdate = (e) => {
      const activeCleanDomain = activeTab.url.replace(/^nova:\/\//, '').replace(/\/$/, '');
      if (e.detail?.domain === activeCleanDomain) {
        setNovaPageData(e.detail);
      }
    };
    window.addEventListener('novaura:site_updated', handleSiteUpdate);
    window.addEventListener('novaura:site_resolved', handleSiteUpdate);
    return () => {
      window.removeEventListener('novaura:site_updated', handleSiteUpdate);
      window.removeEventListener('novaura:site_resolved', handleSiteUpdate);
    };
  }, [activeTab.url]);

  // "Sign in with NovAura" requests. Only the active tab's own frame may ask (not
  // frames nested inside it), and the site the token is for comes from what the
  // tab really shows, never from the page's message.
  useEffect(() => {
    const handleAuthMessage = (e) => {
      const data = e.data;
      if (!data || data.type !== 'NOVA_AUTH_REQUEST') return;
      if (!pageFrameRef.current || e.source !== pageFrameRef.current.contentWindow) return;
      let audience = null;
      if (novaPageData?.domain && !novaPageData.isFounderOfficeRedirect) {
        audience = novaPageData.domain;
      } else if (e.origin && e.origin !== 'null') {
        try { audience = new URL(e.origin).host; } catch { audience = null; }
      }
      if (!audience) return;
      setPendingAuthRequest(prev => prev || {
        domain: audience,
        appName: typeof data.appName === 'string' ? data.appName.slice(0, 80) : audience,
        scopes: Array.isArray(data.scopes) ? data.scopes.slice(0, 8) : ['identity:read', 'node:verify'],
        nonce: typeof data.nonce === 'string' ? data.nonce.slice(0, 200) : null,
        sourceWindow: e.source,
        // Opaque (sandboxed) frames have origin "null" and can only be answered with '*'.
        replyOrigin: e.origin && e.origin !== 'null' ? e.origin : '*',
      });
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [novaPageData?.domain, novaPageData?.isFounderOfficeRedirect]);

  // Resolve current active tab content if it is a .nova or .aura domain or special protocol
  useEffect(() => {
    const resolveTab = async () => {
      const url = activeTab.url;
      const meshName = parseMeshName(url);
      const isNova = Boolean(meshName) || SPECIAL_PAGE_RE.test(url);
      const isAura = meshName?.tld === 'aura';

      if (/^nova:\/\/search(\/|\?|$)/.test(url)) {
        const q = new URLSearchParams(url.split('?')[1] || '').get('q') || '';
        setNovaPageData({ domain: 'search', title: 'Nova Search', isSearch: true, query: q });
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: q ? `${q} · Nova Search` : 'Nova Search', favicon: '🔎', isNova: true, isAura: false } : t));
        return;
      }

      if (url.startsWith('founder://') || url === 'nova://office.founder' || url === 'aura://office.founder') {
        kernel?.openApp?.('founder_office');
        setNovaPageData({
          domain: 'office.founder',
          title: "Founder's Executive Office",
          isFounderOfficeRedirect: true,
        });
        return;
      }

      if (isNova || isAura) {
        const cleanDomain = normalizeName(url);
        const faction = factionOf(cleanDomain);

        // Check if user navigated to the Mesh Registry View
        if (cleanDomain === 'registry.nova' || cleanDomain === 'registry.aura' || cleanDomain === 'registry') {
          setNovaPageData({
            domain: cleanDomain,
            title: 'Sovereign Mesh Sites Registry & Faction Directory',
            isRegistry: true,
            faction,
          });
          setTabs(prev => prev.map(t => t.id === activeTabId ? {
            ...t,
            title: 'Mesh Sites Registry',
            favicon: '🪐',
            isNova: faction === 'nova',
            isAura: faction === 'aura',
          } : t));
          return;
        }

        try {
          // A registered name shows only its registered owner's site; a revoked one shows nothing.
          const status = await nameStatus(cleanDomain, { ask: false }).catch(() => null);
          const registration = registrationOf(status);
          const owner = ['registered', 'yours', 'grace'].includes(status?.state) ? status.record.owner : null;
          const blocked = (s) => status?.state === 'revoked' || (owner && s?.publisherPubkey !== owner);

          // Robust query: check domain index first, then primary key, then fallback to seed
          let site = await db.hosted_sites.where('domain').equals(cleanDomain).first();
          if (!site) site = await db.hosted_sites.get(cleanDomain);
          if (!site && SEED_NOVA_SITES[cleanDomain] && !owner) {
            site = { ...SEED_NOVA_SITES[cleanDomain], id: cleanDomain, faction };
            await db.hosted_sites.put(site).catch(() => {});
          }
          if (site && blocked(site)) site = null;

          if (!site) {
            // Ask peers for the name's record, so the page can say who holds it.
            nameStatus(cleanDomain, { ask: true }).then(st => {
              setNovaPageData(prev => (prev?.domain === cleanDomain && prev.isNotFound ? { ...prev, registration: registrationOf(st) } : prev));
            }).catch(() => {});
          }

          if (site) {
            setNovaPageData({ ...site, registration });
            setTabs(prev => prev.map(t => t.id === activeTabId ? {
              ...t,
              favicon: site.favicon || (faction === 'aura' ? '✨' : '🌐'),
              title: site.title || cleanDomain,
              isNova: faction === 'nova',
              isAura: faction === 'aura',
            } : t));
          } else {
            // No site for this name on this PC (yet)
            setNovaPageData({
              domain: cleanDomain,
              title: `${cleanDomain} — no site on this PC`,
              isNotFound: true,
              faction,
              registration,
            });
          }
        } catch (err) {
          console.warn('[BrowserWindow] Error resolving site:', err);
          setNovaPageData({
            domain: cleanDomain,
            title: `${cleanDomain} — Unregistered Sovereign Domain`,
            isNotFound: true,
            faction,
          });
        }
      } else {
        setNovaPageData(null);
      }
    };
    resolveTab();
  }, [activeTab.url]);

  const navigateTo = (targetUrl) => {
    let finalUrl = String(targetUrl || '').trim();
    if (!finalUrl) return;
    let isNova = false;
    let isAura = false;
    let isOnion = false;

    if (finalUrl.startsWith('founder://')) {
      kernel?.openApp?.('founder_office');
      return;
    }

    // Mesh names (.nova .aura .novaura .catalyst) open on the mesh web; plain
    // words search it (Nova Search); web and .onion addresses go out as before.
    const meshName = parseMeshName(finalUrl);
    if (SPECIAL_PAGE_RE.test(finalUrl)) {
      isNova = true;
    } else if (meshName) {
      finalUrl = meshUrl(meshName.host);
      isAura = meshName.tld === 'aura';
      isNova = !isAura;
    } else if (finalUrl.includes('.onion') || finalUrl.startsWith('tor://')) {
      isOnion = true;
      if (finalUrl.startsWith('tor://')) {
        finalUrl = 'http://' + finalUrl.replace(/^tor:\/\//, '');
      } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'http://' + finalUrl;
      }
    } else if (!/^https?:\/\//i.test(finalUrl)) {
      if (/^[^\s/:]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      } else {
        finalUrl = `nova://search?q=${encodeURIComponent(finalUrl)}`;
        isNova = true;
      }
    }

    // An onion page is never loaded straight into the frame (see openOnionThroughTor).
    const renderUrl = isOnion ? '' : finalUrl;

    setUrlInput(finalUrl);
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      url: finalUrl,
      renderUrl,
      title: meshName
        ? meshName.host
        : (isNova
          ? 'Nova Search'
          : (isOnion ? (finalUrl.split('/')[2]?.substring(0, 16) + '...onion') : finalUrl)),
      isNova,
      isAura,
      isOnion,
      onion: isOnion ? { mode: 'loading' } : null,
      favicon: isAura ? '✨' : (isNova ? '🌐' : null),
    } : t));
    setSummary(null);
    if (isOnion) openOnionThroughTor(activeTabId, finalUrl);
  };

  // .onion pages come through Tor on this PC, as a static copy (onionSrcDoc).
  // Without Tor nothing is fetched; a public gateway is offered instead, and it is
  // labelled for what it is: its operator sees the user's IP and every page.
  const openOnionThroughTor = async (tabId, url) => {
    const setOnion = (onion) => setTabs(prev => prev.map(t => (t.id === tabId && t.url === url ? { ...t, onion } : t)));
    setOnion({ mode: 'loading' });
    try {
      const page = await torOnion.fetchThroughTor(url);
      setOnion({ mode: 'tor', port: page.port, httpStatus: page.status, html: onionSrcDoc(page.body, url) });
    } catch (err) {
      const message = String(err?.message || err);
      setOnion(message === 'TOR_NOT_RUNNING' ? { mode: 'no-tor' } : { mode: 'error', error: message });
    }
  };

  const openOnionViaGateway = (tabId, url) => {
    setTabs(prev => prev.map(t => (t.id === tabId && t.url === url ? {
      ...t,
      renderUrl: torOnion.resolveOnionGatewayUrl(url),
      onion: { mode: 'gateway', gateway: torOnion.getStatus().preferredGateway || 'onion.ws' },
    } : t)));
  };

  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId === 'browser' && e.detail.props?.openId) setOpenRequest(e.detail.props);
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, []);
  useEffect(() => {
    if (openRequest?.url) navigateTo(openRequest.url);
  }, [openRequest?.openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenStudio = (targetDomain = null, initialTemplate = null) => {
    const domain = targetDomain || (novaPageData?.domain) || 'deca.nova';
    setStudioDomain(domain);
    const existing = novaPageData && !novaPageData.isNotFound ? novaPageData : null;
    if (existing) {
      setStudioTitle(existing.title || `${domain} — Sovereign Site`);
      setStudioOwner(existing.ownerHandle || 'operator');
      setStudioHtml(existing.htmlContent || TEMPLATES.deca.htmlContent);
    } else if (initialTemplate && TEMPLATES[initialTemplate]) {
      setStudioTitle(TEMPLATES[initialTemplate].title);
      setStudioOwner(getLocalIdentity()?.handle || 'operator');
      setStudioHtml(TEMPLATES[initialTemplate].htmlContent);
    } else if (domain === 'deca.nova') {
      setStudioTitle('Deca Sovereign Network');
      setStudioOwner('deca-founder');
      setStudioHtml(SEED_NOVA_SITES['deca.nova'].htmlContent);
    } else {
      setStudioTitle(`${domain} — Sovereign Site`);
      setStudioOwner(getLocalIdentity()?.handle || 'operator');
      setStudioHtml(TEMPLATES.blank.htmlContent);
    }
    setShowSiteStudio(true);
  };

  const handleApplyTemplate = (key) => {
    if (TEMPLATES[key]) {
      setStudioTitle(TEMPLATES[key].title);
      setStudioHtml(TEMPLATES[key].htmlContent);
    }
  };

  const handlePublishSite = async (e) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      const cleanDomain = studioDomain.replace(/^nova:\/\//, '').replace(/\/$/, '');
      const published = await publishHostedSite({
        domain: cleanDomain,
        title: studioTitle,
        ownerHandle: studioOwner,
        htmlContent: studioHtml,
      });
      setNovaPageData(published);
      setShowSiteStudio(false);
      // Navigate to it
      navigateTo(`nova://${cleanDomain}`);
    } catch (err) {
      alert(`Publishing error: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleQueryMesh = async (domain) => {
    setIsQueryingMesh(true);
    try {
      const resolved = await queryRemoteSite(domain, 6000);
      if (resolved) {
        setNovaPageData(resolved);
      } else {
        alert(`Swarm query completed: No remote peer currently advertises ${domain}. You can claim and publish it yourself!`);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsQueryingMesh(false);
    }
  };

  const handleDownloadBundle = (site) => {
    if (!site) return;
    const blob = new Blob([site.htmlContent || ''], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${site.domain || 'site'}_bundle.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      if (activeTab.isOnion) {
        const research = await torOnion.deepDarknetResearch(activeTab.url || activeTab.title, 'aura');
        setSummary(`[TOR ONION DEEP RESEARCH BRIEFING]\n\n${research.synthesis}\n\nSources Analyzed:\n${research.sources.map(s => `• ${s.title} (${s.onionUrl})`).join('\n')}`);
        return;
      }

      const pageDescription = novaPageData
        ? `Decentralized Sovereign Site: ${novaPageData.domain} (${novaPageData.title})`
        : activeTab.url;

      const response = await kernel?.ai?.chat([
        {
          role: 'user',
          content: `Please provide a concise, high-level summary and key insights regarding: ${pageDescription}. Highlight technical specifications, architecture context, and security takeaways.`
        }
      ], { persona: 'nova' });
      setSummary(response);
    } catch (err) {
      setSummary(`Could not summarize page: ${err.message}`);
    } finally {
      setSummarizing(false);
    }
  };

  const addTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab = { id: newId, title: 'Nova Search', url: 'nova://search', isNova: true };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setUrlInput('nova://search');
  };

  const closeTab = (id, e) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1].id);
      setUrlInput(remaining[remaining.length - 1].url);
    }
  };

  const isCurrentTabNova = Boolean(parseMeshName(activeTab.url)) || SPECIAL_PAGE_RE.test(activeTab.url) || FOUNDER_PAGE_RE.test(activeTab.url);
  const isAuraFaction = factionOf(activeTab.url) === 'aura' || novaPageData?.faction === 'aura';
  const activeCleanDomain = isCurrentTabNova ? normalizeName(activeTab.url) : '';
  const reg = novaPageData?.registration;
  const shortKey = (hex) => (hex ? `${hex.slice(0, 6)}…${hex.slice(-4)}` : '');

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      {/* Tab Bar */}
      <div className="flex items-center px-2 pt-2 bg-slate-900 border-b border-slate-800 gap-1 overflow-x-auto shrink-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTabId(tab.id);
              setUrlInput(tab.url);
            }}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-colors max-w-[200px] ${
              tab.id === activeTabId
                ? 'bg-slate-950 text-cyan-300 border-t border-x border-slate-800'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            {tab.favicon ? (
              <span className="text-xs shrink-0 select-none">{tab.favicon}</span>
            ) : tab.isAura ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-violet-400" />
            ) : tab.isNova ? (
              <Radio className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            ) : tab.isOnion ? (
              <Shield className="w-3.5 h-3.5 shrink-0 text-purple-400" />
            ) : (
              <Globe className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            )}
            <span className="truncate flex-1">{tab.title}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addTab}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors mb-0.5"
          title="New Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation & Address Bar */}
      <div className="h-11 px-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2 shrink-0">
        <button
          onClick={() => {}}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => {}}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigateTo(urlInput)}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          title="Reload"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigateTo('nova://genesis.nova')}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          title="Genesis Home"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* URL Input */}
        <div className="flex-1 relative flex items-center">
          {isAuraFaction ? (
            <Sparkles className="w-3.5 h-3.5 text-violet-400 absolute left-3" />
          ) : isCurrentTabNova ? (
            <Radio className="w-3.5 h-3.5 text-emerald-400 absolute left-3" />
          ) : activeTab.isOnion ? (
            <Shield className="w-3.5 h-3.5 text-purple-400 absolute left-3" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
          )}
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigateTo(urlInput)}
            placeholder="Search the mesh web, or go to a name (.nova .aura .novaura .catalyst), a .onion or an https:// address"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-36 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {isAuraFaction ? (
              <span className="flex items-center gap-1 text-[10px] text-violet-300 bg-violet-950/80 border border-violet-500/40 px-2 py-0.5 rounded font-mono font-medium">
                <Sparkles className="w-3 h-3 text-violet-400" /> Aura Mesh
              </span>
            ) : isCurrentTabNova ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-medium">
                <ShieldCheck className="w-3 h-3" /> Nova Mesh
              </span>
            ) : activeTab.isOnion ? (
              activeTab.onion?.mode === 'gateway' ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> Gateway · not anonymous
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-purple-300 bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  <Shield className="w-3 h-3 text-purple-400" /> {activeTab.onion?.mode === 'tor' ? 'Through Tor' : 'Tor address'}
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                <ShieldCheck className="w-3 h-3" /> HTTPS
              </span>
            )}
          </div>
        </div>

        {/* Mesh Registry & Explorer Button */}
        <button
          onClick={() => navigateTo('nova://registry.nova')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer"
          title="Decentralized Mesh Site Directory & Faction Map"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Registry</span>
        </button>

        {/* Founder's Office Suite Button */}
        <button
          onClick={() => kernel?.openApp?.('founder_office')}
          className="p-1.5 text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/50 rounded-lg transition-colors border border-amber-500/30 cursor-pointer"
          title="Founder's Executive Office Suite (Restricted Enclave)"
        >
          <Crown className="w-3.5 h-3.5" />
        </button>

        {/* Decentralized Web Actions */}
        {isCurrentTabNova && (
          <>
            <button
              onClick={() => handleOpenStudio(activeCleanDomain)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Host or Edit this Decentralized Site"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit / Host</span>
            </button>

            <button
              onClick={() => setShowManifestModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer"
              title="Decentralized Web Manifest & IPFS/Tor Export"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Web3 Manifest</span>
            </button>

            <button
              onClick={async () => {
                const apps = await getAuthorizedApps();
                setAuthorizedAppsList(apps);
                setShowConnectedAppsModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer"
              title="Manage Connected Apps (SIWN)"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Connected Apps</span>
            </button>
          </>
        )}

        {/* AI Insight / Darknet Action */}
        <button
          onClick={handleSummarize}
          disabled={summarizing}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer ${
            activeTab.isOnion
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
          }`}
        >
          {summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span>{activeTab.isOnion ? 'Darknet Intel' : 'AI Insights'}</span>
        </button>
      </div>

      {/* Bookmarks Bar */}
      <div className="h-8 px-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center gap-3 text-xs text-slate-400 shrink-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Shortcuts:</span>
        {BOOKMARKS.map(b => (
          <button
            key={b.title}
            onClick={() => navigateTo(b.url)}
            className={`transition-colors flex items-center gap-1 ${
              b.isNova ? 'text-emerald-400 hover:text-emerald-300 font-medium' : 'hover:text-cyan-300'
            }`}
          >
            {b.isNova ? (
              <Radio className="w-3 h-3 text-emerald-400" />
            ) : (
              <Bookmark className="w-3 h-3 text-cyan-500/70" />
            )}
            <span>{b.title}</span>
          </button>
        ))}
      </div>

      {/* AI Summary Banner if active */}
      {summary && (
        <div className="p-3 bg-cyan-950/40 border-b border-cyan-500/40 text-xs text-cyan-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-2 flex-1">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="whitespace-pre-wrap leading-relaxed">{summary}</div>
          </div>
          <button onClick={() => setSummary(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Webpage Viewport */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
        {isCurrentTabNova && novaPageData ? (
          novaPageData.isSearch ? (
            /* Nova Search: the mesh web's front page */
            <MeshSearchPage
              initialQuery={novaPageData.query || ''}
              onOpen={(domain) => navigateTo(domain)}
              onSearch={(q) => navigateTo(q ? `nova://search?q=${encodeURIComponent(q)}` : 'nova://search')}
            />
          ) : novaPageData.isRegistry ? (
            /* Decentralized Mesh Registry & Faction Directory */
            <MeshRegistryView onNavigateToUrl={(targetUrl) => navigateTo(targetUrl)} />
          ) : novaPageData.isFounderOfficeRedirect ? (
            /* Founder's Office Suite Gateway Enclave */
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-radial from-amber-950/30 via-slate-950 to-slate-950">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
                <Crown className="w-8 h-8 animate-pulse" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-[11px] font-mono text-amber-300 mb-3">
                <span>●</span> FOUNDER'S OFFICE SUITE GATEWAY
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                Restricted Sovereign Enclave
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                The executive governance office is accessible only by Genesis Founders and verified cryptographic Founder Key holders.
              </p>
              <button
                onClick={() => kernel?.openApp?.('founder_office')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                <Crown className="w-4 h-4" />
                <span>Launch Founder's Office Suite</span>
              </button>
            </div>
          ) : novaPageData.isNotFound ? (
            /* Interactive Decentralized Domain Claim Hub */
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-radial from-slate-900 via-slate-950 to-slate-950">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
                isAuraFaction
                  ? 'bg-violet-500/10 border border-violet-500/30 text-violet-400 shadow-violet-500/10'
                  : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-cyan-500/10'
              }`}>
                {isAuraFaction ? <Sparkles className="w-8 h-8 animate-pulse" /> : <Radio className="w-8 h-8 animate-pulse" />}
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono mb-3 ${
                isAuraFaction
                  ? 'bg-violet-950/80 border border-violet-500/40 text-violet-300'
                  : 'bg-cyan-950/80 border border-cyan-500/30 text-cyan-300'
              }`}>
                <span>●</span> {reg?.state === 'registered' || reg?.state === 'grace' ? 'REGISTERED NAME' : reg?.state === 'yours' ? 'YOUR NAME' : reg?.state === 'revoked' ? 'REVOKED NAME' : 'UNREGISTERED NAME'} · NO SITE ON THIS PC
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                <span className={`font-mono ${isAuraFaction ? 'text-violet-400' : 'text-cyan-400'}`}>
                  {meshUrl(novaPageData.domain) || novaPageData.domain}
                </span>
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
                {reg?.state === 'yours' && 'This name is registered to you. Build a site for it and publish it, and peers will accept it as yours.'}
                {(reg?.state === 'registered' || reg?.state === 'grace') && <>Registered to node <span className="font-mono text-slate-300">{shortKey(reg.owner)}</span>. Their site is not on this PC yet; peers may have it.</>}
                {reg?.state === 'revoked' && 'The registry operator revoked this name, so no site is shown for it.'}
                {(!reg || reg.state === 'available') && <>Nobody has registered <span className="font-mono text-slate-300">{reg?.registrable || novaPageData.domain}</span> yet. {reg?.review || 'Register it, then publish a site, and it is yours on every node.'}</>}
              </p>

              {(!reg || reg.state === 'available') && (
                <button
                  onClick={() => openRegistry(reg?.registrable || novaPageData.domain)}
                  className="flex items-center gap-2 px-6 py-2.5 mb-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Register {reg?.registrable || novaPageData.domain}</span>
                </button>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                <button
                  onClick={() => handleOpenStudio(novaPageData.domain, 'deca')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Deploy Deca Portal</span>
                </button>

                <button
                  onClick={() => handleOpenStudio(novaPageData.domain, 'cybeni')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>Deploy Cybeni Game</span>
                </button>

                <button
                  onClick={() => handleOpenStudio(novaPageData.domain, 'blank')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Code className="w-4 h-4 text-purple-400" />
                  <span>Custom HTML Studio</span>
                </button>

                <button
                  onClick={() => handleQueryMesh(novaPageData.domain)}
                  disabled={isQueryingMesh}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {isQueryingMesh ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                  <span>Query Swarm Peers</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Decentralized Protocol: Sovereign Mesh • Ed25519 Cryptographic Verification
              </div>
            </div>
          ) : (
            /* Live Decentralized Web Host */
            <div className="w-full h-full flex flex-col">
              <div className={`px-4 py-1.5 border-b flex items-center justify-between text-[11px] ${
                isAuraFaction
                  ? 'bg-violet-950/40 border-violet-500/30 text-violet-300'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              }`}>
                <div className="flex items-center gap-2">
                  {novaPageData.favicon ? (
                    <span className="text-sm select-none">{novaPageData.favicon}</span>
                  ) : isAuraFaction ? (
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  ) : (
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Decentralized Site: <b className="font-mono">{novaPageData.domain}</b></span>
                  <span className="text-slate-400">• Hosted by: @{novaPageData.ownerHandle}{novaPageData.ownerPhone ? ` (${novaPageData.ownerPhone})` : ''}</span>
                  {reg?.state === 'registered' || reg?.state === 'yours' ? (
                    <span className="text-[10px] px-2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40" title={`Registered to ${reg.owner}, until ${new Date(reg.expiresAt).toLocaleDateString()}`}>
                      ✓ Registered{reg.state === 'yours' ? ' to you' : ''}
                    </span>
                  ) : novaPageData.publisherSig ? (
                    <span className="text-[10px] px-2 rounded bg-amber-950 text-amber-300 border border-amber-500/40" title="Signed by its publisher, but the name is not registered: the first publisher holds it until someone registers it.">
                      Unregistered name
                    </span>
                  ) : null}
                  <span className={`text-[10px] px-2 py-0.2 rounded font-mono font-bold uppercase ${
                    isAuraFaction ? 'bg-violet-950 text-violet-300 border border-violet-500/40' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {isAuraFaction ? 'Aura Faction' : 'Nova Faction'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    isAuraFaction ? 'bg-violet-500/20 text-violet-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    P2P Verified
                  </span>
                  <button
                    onClick={() => handleOpenStudio(novaPageData.domain)}
                    className="text-[10px] text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                  >
                    Edit Site
                  </button>
                </div>
              </div>
              <iframe
                ref={pageFrameRef}
                title={novaPageData.title}
                className="w-full flex-1 border-none bg-slate-950"
                // No allow-same-origin: without it the page gets an opaque origin and cannot
                // reach the OS's DOM, Tauri IPC, IndexedDB vault or localStorage. The page itself
                // is loaded by the effect above (sitePreview.js), so its scripts can run; pages
                // that arrived over the mesh get a no-network policy there.
                sandbox="allow-scripts allow-forms allow-modals"
                referrerPolicy="no-referrer"
              />
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col">
            {activeTab.isOnion && (activeTab.onion?.mode === 'gateway' ? (
              <div className="px-4 py-1.5 bg-amber-950/50 border-b border-amber-500/40 flex items-center gap-2 text-[11px] text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Through the public gateway <b className="font-mono">{activeTab.onion.gateway}</b>. <b>Not anonymous:</b> the gateway's operator sees your IP address and every page you open here.
                </span>
              </div>
            ) : (
              <div className="px-4 py-1.5 bg-purple-950/40 border-b border-purple-500/30 flex items-center gap-2 text-[11px] text-purple-300">
                <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">Tor address: <b className="font-mono">{activeTab.url}</b></span>
                {activeTab.onion?.mode === 'tor' && (
                  <span className="text-slate-400 shrink-0">
                    • Fetched through Tor on this PC (127.0.0.1:{activeTab.onion.port}). A static copy: scripts, images and links are off, since they would load outside Tor.
                  </span>
                )}
              </div>
            ))}
            {activeTab.isOnion && activeTab.onion?.mode === 'tor' ? (
              <iframe
                title={activeTab.title}
                srcDoc={activeTab.onion.html}
                className="w-full flex-1 border-none bg-white"
                sandbox=""
                referrerPolicy="no-referrer"
              />
            ) : activeTab.isOnion && activeTab.onion?.mode !== 'gateway' ? (
              <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
                <div className="max-w-lg text-center space-y-3">
                  {activeTab.onion?.mode === 'loading' ? (
                    <div className="text-sm text-purple-300">Opening through Tor…</div>
                  ) : (
                    <>
                      <Shield className="w-8 h-8 text-purple-400 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-100">
                        {activeTab.onion?.mode === 'error' ? 'Could not open this address through Tor' : 'Tor is not running on this PC'}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {activeTab.onion?.mode === 'error'
                          ? `Tor answered, but the page did not load (${activeTab.onion.error}).`
                          : 'Sovereign opens .onion addresses through Tor Browser or the Tor service when one is running (it listens on 127.0.0.1:9150 or 9050). Start one and try again.'}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          onClick={() => openOnionThroughTor(activeTab.id, activeTab.url)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs hover:bg-purple-600/40"
                        >
                          Try again
                        </button>
                        <button
                          onClick={() => openOnionViaGateway(activeTab.id, activeTab.url)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-amber-500/40 text-amber-200 text-xs hover:bg-slate-700"
                        >
                          Open through a public gateway (not anonymous)
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-300/80">
                        A gateway fetches the page for you over the ordinary internet. Its operator sees your IP address and everything you open.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
            <iframe
              ref={pageFrameRef}
              src={activeTab.renderUrl || activeTab.url}
              title={activeTab.title}
              className="w-full flex-1 border-none bg-white"
              // A frame pointed at localhost / tauri.localhost would be same-origin with the OS
              // itself, so those targets never get allow-same-origin.
              sandbox={/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[^/:]*\.localhost)(:|\/|$)/i.test(activeTab.renderUrl || activeTab.url || '') ? 'allow-scripts allow-forms allow-popups' : 'allow-scripts allow-same-origin allow-forms allow-popups'}
              referrerPolicy="no-referrer"
            />
            )}
          </div>
        )}
      </div>

      {/* ── Decentralized Site Studio Modal ── */}
      {showSiteStudio && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Sovereign Site Studio</h3>
                  <p className="text-[11px] text-slate-400">Deploy, edit, and broadcast decentralized sites directly to the P2P mesh</p>
                </div>
              </div>
              <button onClick={() => setShowSiteStudio(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishSite} className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Domain Name</label>
                  <input
                    type="text"
                    value={studioDomain}
                    onChange={e => setStudioDomain(e.target.value)}
                    placeholder="e.g. deca.nova"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Site Title</label>
                  <input
                    type="text"
                    value={studioTitle}
                    onChange={e => setStudioTitle(e.target.value)}
                    placeholder="e.g. Deca Sovereign Network"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Owner Handle</label>
                  <input
                    type="text"
                    value={studioOwner}
                    onChange={e => setStudioOwner(e.target.value)}
                    placeholder="@operator"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Template Selectors */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 text-[11px] font-medium">Starter Templates:</span>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('deca')}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] cursor-pointer"
                >
                  Deca Mesh Portal
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('cybeni')}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[11px] cursor-pointer"
                >
                  Cybeni Vanguard Game
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('blank')}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] cursor-pointer"
                >
                  Blank Studio
                </button>
              </div>

              {/* HTML/CSS/JS Editor Area */}
              <div className="flex-1 flex flex-col min-h-[280px]">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>HTML5 / CSS / JavaScript Code</span>
                  <span className="text-[10px] text-slate-500 font-mono">Self-contained bundle with live iframe sandboxing</span>
                </label>
                <textarea
                  value={studioHtml}
                  onChange={e => setStudioHtml(e.target.value)}
                  className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-emerald-300 font-mono outline-none focus:border-cyan-500 leading-relaxed resize-none"
                  rows={14}
                  required
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400">
                  Broadcasting will sign with node identity: <b className="text-cyan-400">{getLocalIdentity()?.handle || 'operator'}</b>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSiteStudio(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Publish & Broadcast to Mesh</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Decentralized Web Manifest & Export Modal ── */}
      {showManifestModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">Decentralized Web Manifest</h3>
              </div>
              <button onClick={() => setShowManifestModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Sovereign Mesh Protocol URI:</span>
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-cyan-300">
                  <span>nova://{novaPageData?.domain || activeCleanDomain}</span>
                  <button
                    onClick={() => handleCopy(`nova://${novaPageData?.domain || activeCleanDomain}`, 'uri')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedField === 'uri' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Content-Addressed Digest (IPFS CIDv1):</span>
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-emerald-400">
                  <span className="truncate mr-2">{novaPageData?.cid || 'bafy2bzacedeca0018f9940x64gbworkstation'}</span>
                  <button
                    onClick={() => handleCopy(novaPageData?.cid || 'bafy2bzacedeca0018f9940x64gbworkstation', 'cid')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedField === 'cid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Cryptographic Publisher DID:</span>
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-purple-300">
                  <span className="truncate mr-2">{novaPageData?.ownerNodeId || getLocalIdentity()?.nodeId || 'did:nova:sovereign_operator_key'}</span>
                  <button
                    onClick={() => handleCopy(novaPageData?.ownerNodeId || getLocalIdentity()?.nodeId || 'did:nova:sovereign_operator_key', 'did')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedField === 'did' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Local Zero-CORS Gateway Link:</span>
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-300">
                  <span>http://127.0.0.1:9095/sites/{novaPageData?.domain || activeCleanDomain}</span>
                  <button
                    onClick={() => handleCopy(`http://127.0.0.1:9095/sites/${novaPageData?.domain || activeCleanDomain}`, 'gateway')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedField === 'gateway' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Pin to IPFS, Filecoin, or Arweave without central servers</span>
              <button
                onClick={() => handleDownloadBundle(novaPageData)}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md shadow-cyan-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Static Bundle (.html)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sign In with NovAura (SIWN) Modal ── */}
      {pendingAuthRequest && (
        <SovereignAuthModal
          authRequest={pendingAuthRequest}
          onAuthorize={(authResult) => {
            if (pendingAuthRequest?.sourceWindow) {
              pendingAuthRequest.sourceWindow.postMessage({
                type: 'NOVA_AUTH_RESPONSE',
                success: true,
                token: authResult.token,
                session: authResult.session,
                scopes: authResult.scopes,
                expiresAt: authResult.expiresAt,
                nonce: pendingAuthRequest.nonce,
              }, pendingAuthRequest.replyOrigin || '*');
            }
            setPendingAuthRequest(null);
          }}
          onDecline={() => {
            if (pendingAuthRequest?.sourceWindow) {
              pendingAuthRequest.sourceWindow.postMessage({
                type: 'NOVA_AUTH_RESPONSE',
                success: false,
                error: 'Operator rejected the authorization request.',
                nonce: pendingAuthRequest.nonce,
              }, pendingAuthRequest.replyOrigin || '*');
            }
            setPendingAuthRequest(null);
          }}
        />
      )}

      {/* ── Connected Apps Management Modal ── */}
      {showConnectedAppsModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Authorized Applications (SIWN)</h3>
                  <p className="text-xs text-slate-400">Decentralized logins granted by your sovereign key</p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectedAppsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {authorizedAppsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No applications currently authorized. When a .nova site or Cybeni build requests "Sign in with NovAura", it will appear here.
                </div>
              ) : (
                authorizedAppsList.map((app) => (
                  <div key={app.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-200">{app.appName || app.domain}</div>
                      <div className="text-[11px] font-mono text-cyan-400 truncate">nova://{app.domain}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Authorized: {new Date(app.authorizedAt).toLocaleDateString()} • Scopes: {(app.scopes || []).join(', ')}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await revokeAppAccess(app.domain);
                        const updated = await getAuthorizedApps();
                        setAuthorizedAppsList(updated);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowConnectedAppsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
