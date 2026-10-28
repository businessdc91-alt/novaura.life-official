import React, { useState, useEffect } from 'react';
import {
  Globe, Search, ArrowLeft, ArrowRight, RotateCw, Home, Sparkles,
  ExternalLink, Bookmark, Plus, X, ShieldCheck, Loader2, Radio, Server,
  Shield, Lock, Eye, Edit3, Share2, Code, Download, Check, Copy, Layers, Send, Play, Terminal
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { getLocalIdentity, publishHostedSite, queryRemoteSite } from '../../services/sovereignMesh.js';
import { torOnion, VERIFIED_ONION_SERVICES } from '../../services/torOnionService.js';

const BOOKMARKS = [
  { title: 'Genesis Hub (.nova)', url: 'nova://genesis.nova', isNova: true, isOnion: false },
  { title: 'Deca Mesh (.nova)', url: 'nova://deca.nova', isNova: true, isOnion: false },
  { title: 'Sovereign Docs (.nova)', url: 'nova://docs.nova', isNova: true, isOnion: false },
  { title: 'Ahmia (.onion)', url: 'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion', isNova: false, isOnion: true },
  { title: 'DuckDuckGo (.onion)', url: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion', isNova: false, isOnion: true },
  { title: 'Tor Project (.onion)', url: 'http://2gzyxa5ihm7nsggfxnu52r2n5264tzriikrq5sm7a5slro6ip66ddlid.onion', isNova: false, isOnion: true },
  { title: 'ProPublica (.onion)', url: 'https://p53lf5mtqqqgahqdumjraw7potonkgq7gahaxqkgfhb01931.onion', isNova: false, isOnion: true },
  { title: 'DuckDuckGo', url: 'https://duckduckgo.com', isNova: false, isOnion: false },
  { title: 'Wikipedia', url: 'https://en.wikipedia.org', isNova: false, isOnion: false },
];

const SEED_NOVA_SITES = {
  'genesis.nova': {
    id: 'genesis.nova',
    domain: 'genesis.nova',
    ownerHandle: 'genesis-council',
    ownerPhone: '+1-700-NOVA-0001',
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
    ownerPhone: '+1-700-NOVA-0002',
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
    ownerPhone: '+1-700-DECA-0010',
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
        <span><b>Sovereign Host:</b> @deca-founder (+1-700-DECA-0010)</span>
      </div>
      <div class="status-item">
        <span><b>Consensus:</b> Ed25519 Local Node Verification</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-icon">⚡</div>
        <h3>Neural Host Compute</h3>
        <p>Interrogates native hardware to power local LLM inference engines (Gemma 4 & Qwen MoE).</p>
        <div class="metric-value">Intel i9-9940X (14C / 28T) • 64GB RAM</div>
      </div>

      <div class="card">
        <div class="card-icon">🎮</div>
        <h3>Dual GPU Accelerator</h3>
        <p>Workstation neural rendering and game loop acceleration across high-bandwidth VRAM.</p>
        <div class="metric-value">Quadro M6000 24GB + RX 580 (32GB Total)</div>
      </div>

      <div class="card">
        <div class="card-icon">🌐</div>
        <h3>Decentralized DNS (.nova)</h3>
        <p>Cryptographically signed namespace bound to peer node identities and replicated via P2P gossip.</p>
        <div class="metric-value">Zero-Trust Peer Propagation</div>
      </div>

      <div class="card">
        <div class="card-icon">🧅</div>
        <h3>Tor Onion Gateway</h3>
        <p>Dual-routing over local SOCKS5 proxy to access hidden darknet intelligence without DNS leaks.</p>
        <div class="metric-value">127.0.0.1:9050 SOCKS5 Active</div>
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

export default function BrowserWindow() {
  const { kernel } = useKernel();
  const [tabs, setTabs] = useState([
    { id: 'tab-1', title: 'Genesis Hub (.nova)', url: 'nova://genesis.nova', isNova: true },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [urlInput, setUrlInput] = useState('nova://genesis.nova');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [novaPageData, setNovaPageData] = useState(null);

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

  // Resolve current active tab content if it is a .nova domain
  useEffect(() => {
    const resolveTab = async () => {
      if (activeTab.url.startsWith('nova://') || activeTab.url.endsWith('.nova')) {
        const cleanDomain = activeTab.url.replace(/^nova:\/\//, '').replace(/\/$/, '');
        try {
          // Robust query: check domain index first, then primary key, then fallback to seed
          let site = await db.hosted_sites.where('domain').equals(cleanDomain).first();
          if (!site) site = await db.hosted_sites.get(cleanDomain);
          if (!site && SEED_NOVA_SITES[cleanDomain]) {
            site = { ...SEED_NOVA_SITES[cleanDomain], id: cleanDomain };
            await db.hosted_sites.put(site).catch(() => {});
          }

          if (site) {
            setNovaPageData(site);
          } else {
            // Unregistered domain
            setNovaPageData({
              domain: cleanDomain,
              title: `${cleanDomain} — Unregistered Domain`,
              isNotFound: true,
            });
          }
        } catch (err) {
          console.warn('[BrowserWindow] Error resolving site:', err);
          setNovaPageData({
            domain: cleanDomain,
            title: `${cleanDomain} — Unregistered Domain`,
            isNotFound: true,
          });
        }
      } else {
        setNovaPageData(null);
      }
    };
    resolveTab();
  }, [activeTab.url]);

  const navigateTo = (targetUrl) => {
    let finalUrl = targetUrl.trim();
    let isNova = false;
    let isOnion = false;

    if (finalUrl.startsWith('nova://') || finalUrl.endsWith('.nova')) {
      isNova = true;
      if (!finalUrl.startsWith('nova://')) {
        finalUrl = 'nova://' + finalUrl;
      }
    } else if (finalUrl.includes('.onion') || finalUrl.startsWith('tor://')) {
      isOnion = true;
      if (finalUrl.startsWith('tor://')) {
        finalUrl = 'http://' + finalUrl.replace(/^tor:\/\//, '');
      } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'http://' + finalUrl;
      }
    } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
        finalUrl = 'https://' + finalUrl;
      } else {
        finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(finalUrl)}`;
      }
    }

    const renderUrl = isOnion ? torOnion.resolveOnionGatewayUrl(finalUrl) : finalUrl;

    setUrlInput(finalUrl);
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      url: finalUrl,
      renderUrl,
      title: isNova ? finalUrl.replace('nova://', '') : (isOnion ? (finalUrl.split('/')[2]?.substring(0, 16) + '...onion') : finalUrl),
      isNova,
      isOnion,
    } : t));
    setSummary(null);
  };

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
    const newTab = { id: newId, title: 'Genesis Hub (.nova)', url: 'nova://genesis.nova', isNova: true };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setUrlInput('nova://genesis.nova');
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

  const isCurrentTabNova = activeTab.url.startsWith('nova://') || activeTab.url.endsWith('.nova');
  const activeCleanDomain = isCurrentTabNova ? activeTab.url.replace(/^nova:\/\//, '').replace(/\/$/, '') : '';

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
            {tab.isNova ? (
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
          {isCurrentTabNova ? (
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
            placeholder="Enter .nova domain (e.g. deca.nova), .onion address, or web URL..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-36 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {isCurrentTabNova ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-medium">
                <ShieldCheck className="w-3 h-3" /> P2P Mesh
              </span>
            ) : activeTab.isOnion ? (
              <span className="flex items-center gap-1 text-[10px] text-purple-300 bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 rounded font-mono font-bold">
                <Shield className="w-3 h-3 text-purple-400" /> Tor Onion (3-Hop)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                <ShieldCheck className="w-3 h-3" /> HTTPS
              </span>
            )}
          </div>
        </div>

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
          novaPageData.isNotFound ? (
            /* Interactive Decentralized Domain Claim Hub */
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-radial from-slate-900 via-slate-950 to-slate-950">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 mb-3">
                <span>●</span> UNCLAIMED SOVEREIGN DOMAIN
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                <span className="text-cyan-400 font-mono">nova://{novaPageData.domain}</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
                This decentralized site has not been registered in your local mesh cache. As a sovereign node, you can claim ownership and publish this site directly to the peer-to-peer web right now with zero corporate cloud fees.
              </p>

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
              <div className="px-4 py-1.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-300">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Decentralized Site: <b className="font-mono">{novaPageData.domain}</b></span>
                  <span className="text-slate-400">• Hosted by: @{novaPageData.ownerHandle} ({novaPageData.ownerPhone})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-mono">
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
                srcDoc={novaPageData.htmlContent}
                title={novaPageData.title}
                className="w-full flex-1 border-none bg-slate-950"
                sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
              />
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col">
            {activeTab.isOnion && (
              <div className="px-4 py-1.5 bg-purple-950/40 border-b border-purple-500/30 flex items-center justify-between text-[11px] text-purple-300">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Tor Hidden Service: <b className="font-mono">{activeTab.url}</b></span>
                  <span className="text-slate-400">• Circuit: Entry Guard → Middle Relay → Rendezvous Point</span>
                </div>
                <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded text-purple-300 font-mono">
                  Anonymous 3-Hop Circuit
                </span>
              </div>
            )}
            <iframe
              src={activeTab.renderUrl || activeTab.url}
              title={activeTab.title}
              className="w-full flex-1 border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
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
    </div>
  );
}
