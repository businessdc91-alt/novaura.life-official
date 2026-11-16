/**
 * websiteTemplates.js — Multi-Page Decentralized Website Templates with Living Backgrounds
 * Complete, fully-functional, multi-page designs with tabbed navigation, editable areas,
 * drag-and-drop image dropzones, and living dynamic backgrounds (Canvas & CSS).
 */
import { ARCADE_PLATFORM_TEMPLATE, STOREFRONT_TEMPLATE } from './arcadeTemplate.js';

export const LIVING_BACKGROUNDS = {
  aurora: {
    id: 'aurora',
    name: 'Aurora Borealis Plasma',
    description: 'Shimmering atmospheric cyan and violet electromagnetic plasma ribbons.',
    css: `
      .living-bg-aurora {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: -1;
        background: radial-gradient(circle at 20% 30%, #031525 0%, #050814 60%, #010409 100%);
        overflow: hidden;
      }
      .living-bg-aurora::before, .living-bg-aurora::after {
        content: '';
        position: absolute;
        width: 140vw; height: 140vh;
        top: -20vh; left: -20vw;
        background: radial-gradient(ellipse at center, rgba(0, 240, 255, 0.22) 0%, rgba(176, 38, 255, 0.18) 45%, transparent 70%);
        filter: blur(60px);
        animation: auroraWave 18s ease-in-out infinite alternate;
      }
      .living-bg-aurora::after {
        background: radial-gradient(ellipse at center, rgba(16, 185, 129, 0.18) 0%, rgba(56, 189, 248, 0.15) 50%, transparent 75%);
        animation: auroraWave 24s ease-in-out infinite alternate-reverse;
      }
      @keyframes auroraWave {
        0% { transform: translate(-5%, -5%) rotate(0deg) scale(1); }
        50% { transform: translate(6%, 8%) rotate(8deg) scale(1.1); }
        100% { transform: translate(-4%, 6%) rotate(-6deg) scale(0.95); }
      }
    `
  },
  circuit: {
    id: 'circuit',
    name: 'Cyber Circuit Matrix',
    description: 'Pulsing glowing cyber grid traces and floating telemetry nodes.',
    css: `
      .living-bg-circuit {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: -1;
        background-color: #030712;
        background-image: 
          linear-gradient(rgba(0, 240, 255, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 240, 255, 0.08) 1px, transparent 1px),
          radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.12) 0%, transparent 60%);
        background-size: 40px 40px, 40px 40px, 100% 100%;
        background-position: -1px -1px, -1px -1px, 0 0;
        animation: circuitDrift 30s linear infinite;
      }
      @keyframes circuitDrift {
        from { background-position: 0 0, 0 0, 0 0; }
        to { background-position: 80px 80px, 80px 80px, 0 0; }
      }
    `
  },
  obsidian: {
    id: 'obsidian',
    name: 'Liquid Obsidian Glass',
    description: 'Deep smoky luxury glassmorphism with ambient refractive flares.',
    css: `
      .living-bg-obsidian {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: -1;
        background: #05070e;
        overflow: hidden;
      }
      .living-bg-obsidian .flare {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.25;
        animation: flareFloat 16s ease-in-out infinite alternate;
      }
      .living-bg-obsidian .f1 { width: 600px; height: 600px; background: #6366f1; top: -100px; left: -100px; }
      .living-bg-obsidian .f2 { width: 500px; height: 500px; background: #ec4899; bottom: -80px; right: -80px; animation-duration: 20s; }
      .living-bg-obsidian .f3 { width: 400px; height: 400px; background: #06b6d4; top: 40%; left: 60%; animation-duration: 14s; }
      @keyframes flareFloat {
        0% { transform: translateY(0px) scale(1); }
        100% { transform: translateY(60px) scale(1.15); }
      }
    `
  },
  botanical: {
    id: 'botanical',
    name: 'Organic Emerald Waves',
    description: 'Lush natural organic leaf gradient with flowing botanical atmosphere.',
    css: `
      .living-bg-botanical {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: -1;
        background: radial-gradient(circle at 30% 20%, #062b1e 0%, #02170f 50%, #010d08 100%);
        overflow: hidden;
      }
      .living-bg-botanical::before {
        content: '';
        position: absolute;
        width: 150vw; height: 150vh;
        top: -25vh; left: -25vw;
        background: radial-gradient(ellipse at center, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.12) 40%, transparent 70%);
        filter: blur(80px);
        animation: foliageSway 22s ease-in-out infinite alternate;
      }
      @keyframes foliageSway {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(5deg) scale(1.08); }
        100% { transform: rotate(-4deg) scale(0.96); }
      }
    `
  },
  blueprint: {
    id: 'blueprint',
    name: 'Precision Blueprint Grid',
    description: 'Technical architect grid with coordinate guides and ambient cobalt light.',
    css: `
      .living-bg-blueprint {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: -1;
        background-color: #071328;
        background-image: 
          linear-gradient(rgba(56, 189, 248, 0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.12) 1px, transparent 1px),
          linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
        background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
        background-position: -1px -1px;
      }
    `
  }
};

/**
 * 8 Multi-Page Fully Functional Website Templates
 */
export const MULTIPAGE_TEMPLATES = [
  // 0. Flagship 15-Game Arcade & Living 3D Biosphere Platform
  ARCADE_PLATFORM_TEMPLATE,
  // 0b. Sovereign Creator Storefront & E-Commerce Shop
  STOREFRONT_TEMPLATE,
  // 1. Tech & AI Blog
  {
    id: 'blog',
    name: 'Sovereign Chronicle — Tech & Science Blog',
    category: 'Media & Publishing',
    badge: 'Multi-Page • Interactive Comments',
    favicon: '📰',
    backgroundId: 'aurora',
    description: 'Multi-page editorial tech publication with article reader, category filter, reading times, newsletter modal, and live comment thread.',
    html: `
<div class="living-bg-aurora"></div>

<header class="site-header">
  <div class="nav-container">
    <div class="logo">
      <span class="logo-icon">⚡</span>
      <span class="logo-text">Sovereign<b>Chronicle</b></span>
    </div>
    <nav class="nav-links">
      <button class="nav-tab active" data-page="home">Latest Dispatches</button>
      <button class="nav-tab" data-page="article">Featured Reader</button>
      <button class="nav-tab" data-page="categories">Topics</button>
      <button class="nav-tab" data-page="about">Masthead</button>
    </nav>
    <button class="btn-subscribe" onclick="toggleNewsletter()">Subscribe</button>
  </div>
</header>

<main class="page-container">
  <!-- PAGE 1: HOME ARTICLES -->
  <section id="page-home" class="page-view active">
    <div class="hero-article" onclick="switchPage('article')">
      <div class="hero-badge">Deep Dive • 8 min read</div>
      <h1 class="editable-title" contenteditable="true">The Era of Sovereign Intelligence: Why Local-First AI Outlives Centralized APIs</h1>
      <p class="editable-desc" contenteditable="true">When hardware compute density allows 31-billion parameter models to run on desktop workstations at 60 tokens per second, the economics of surveillance cloud collapse. Here is the architecture of freedom.</p>
      <div class="author-bar">
        <span class="author-avatar">🧠</span>
        <div>
          <div class="author-name">Dr. Aris Thorne</div>
          <div class="author-date">November 2, 2026 • Sovereign Research Group</div>
        </div>
        <span class="read-more-btn">Read Investigation →</span>
      </div>
    </div>

    <div class="article-grid">
      <article class="article-card" onclick="switchPage('article')">
        <div class="card-tag">Decentralized Mesh</div>
        <h3 contenteditable="true">Routing Packets Under Total Infrastructure Blackout</h3>
        <p contenteditable="true">How peer-to-peer gossip layers and offline Web-of-Trust algorithms guarantee packet arrival without central ISPs.</p>
        <div class="card-footer">
          <span>5 min read</span>
          <span class="arrow">→</span>
        </div>
      </article>

      <article class="article-card" onclick="switchPage('article')">
        <div class="card-tag">Neural Architectures</div>
        <h3 contenteditable="true">Gemma 4 & The 2026 Open Weights Renaissance</h3>
        <p contenteditable="true">Benchmarking the new frontier: How local distillation overtook proprietary cloud giants in SWE-Bench verified accuracy.</p>
        <div class="card-footer">
          <span>6 min read</span>
          <span class="arrow">→</span>
        </div>
      </article>

      <article class="article-card" onclick="switchPage('article')">
        <div class="card-tag">Philosophy</div>
        <h3 contenteditable="true">The Psychology of Digital Self-Ownership</h3>
        <p contenteditable="true">Why renting software month-by-month rewires human agency, and how cryptographic sovereign ownership restores focus.</p>
        <div class="card-footer">
          <span>4 min read</span>
          <span class="arrow">→</span>
        </div>
      </article>
    </div>
  </section>

  <!-- PAGE 2: ARTICLE READER -->
  <section id="page-article" class="page-view">
    <button class="back-btn" onclick="switchPage('home')">← Back to Articles</button>
    <article class="full-article">
      <div class="article-meta">
        <span class="meta-tag">Deep Architectural Analysis</span>
        <span>Published Nov 2, 2026</span>
        <span>• 8 min read</span>
      </div>
      <h1 contenteditable="true">The Era of Sovereign Intelligence: Why Local-First AI Outlives Centralized APIs</h1>
      <div class="lead-quote" contenteditable="true">
        "True autonomy requires owning both the weights and the machine that executes them. Anything less is a lease on thought."
      </div>
      
      <div class="article-body">
        <h2 contenteditable="true">1. The Cloud Monopoly Illusion</h2>
        <p contenteditable="true">For half a decade, centralized cloud providers claimed that frontier intelligence could only ever exist in multi-billion dollar mega-clusters. Today in late 2026, the breakthrough in quantized non-linear activations and distilled reasoning models has inverted the paradigm.</p>
        <p contenteditable="true">When an operator holds their weights locally on high-bandwidth unified memory, there are no rate limits, no corporate surveillance filters, and zero downtime.</p>

        <h2 contenteditable="true">2. Cryptographic Attestation on the Sovereign Mesh</h2>
        <p contenteditable="true">Communication between sovereign nodes is not mediated by corporate OAuth servers. Each publication is verified by Ed25519 digital signatures, ensuring that reader and author establish unforgeable provenance.</p>
      </div>

      <!-- Live Interactive Comment Section -->
      <section class="comments-section">
        <h3>Decentralized Peer Discussion (3)</h3>
        <div class="comment-composer">
          <input type="text" id="comment-author" placeholder="Your Handle / Node ID..." value="@operator" />
          <textarea id="comment-text" placeholder="Share your perspective on this dispatch..."></textarea>
          <button class="btn-primary" onclick="postComment()">Broadcast Comment</button>
        </div>

        <div id="comments-list" class="comments-list">
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">@cipher_mind</span>
              <span class="comment-time">1 hour ago</span>
            </div>
            <p>The transition to 31B distilled architectures running locally on M4/RTX silicon changed my entire engineering workflow. Complete game-changer.</p>
          </div>
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">@elena_vance</span>
              <span class="comment-time">3 hours ago</span>
            </div>
            <p>Completely agree on the Ed25519 identity point. Authenticating peer-to-peer without ICANN or centralized sign-in is where the decentralized web wins.</p>
          </div>
        </div>
      </section>
    </article>
  </section>

  <!-- PAGE 3: TOPICS & CATEGORIES -->
  <section id="page-categories" class="page-view">
    <h2 class="section-title">Knowledge Curations</h2>
    <div class="category-grid">
      <div class="cat-card">
        <span class="cat-icon">🤖</span>
        <h4>Sovereign AI</h4>
        <p>18 Dispatches • Local models, prompt architecture, and GGUF quantization.</p>
      </div>
      <div class="cat-card">
        <span class="cat-icon">🌐</span>
        <h4>Mesh Protocols</h4>
        <p>12 Dispatches • P2P routing, gossip synchronization, and NAT traversal.</p>
      </div>
      <div class="cat-card">
        <span class="cat-icon">🛡️</span>
        <h4>Cryptographic Privacy</h4>
        <p>15 Dispatches • Ed25519, X25519, zero-knowledge relays, and enclave vaults.</p>
      </div>
      <div class="cat-card">
        <span class="cat-icon">💻</span>
        <h4>Systems Architecture</h4>
        <p>9 Dispatches • Operating systems, kernel engineering, and offline tooling.</p>
      </div>
    </div>
  </section>

  <!-- PAGE 4: ABOUT / MASTHEAD -->
  <section id="page-about" class="page-view">
    <div class="about-card">
      <h2>About Sovereign Chronicle</h2>
      <p contenteditable="true">Sovereign Chronicle is an independent, decentralized technical publication hosted entirely on the NovAura Mesh. We accept zero corporate sponsorships and run no telemetry trackers.</p>
      <div class="stats-row">
        <div class="stat-box"><b>100%</b><span>Decentralized</span></div>
        <div class="stat-box"><b>0 ms</b><span>Tracker Latency</span></div>
        <div class="stat-box"><b>Ed25519</b><span>Cryptographically Signed</span></div>
      </div>
    </div>
  </section>
</main>

<footer class="site-footer">
  <p>© 2026 Sovereign Chronicle • Distributed on the NovAura Mesh Network</p>
</footer>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f1f5f9; min-height: 100vh; background: #050814; }
      .site-header { position: sticky; top: 0; background: rgba(5, 8, 20, 0.85); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(0, 240, 255, 0.15); z-index: 100; }
      .nav-container { max-width: 1100px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
      .logo { display: flex; align-items: center; gap: 8px; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.5px; }
      .logo-icon { color: #00f0ff; }
      .logo-text b { color: #00f0ff; }
      .nav-links { display: flex; gap: 6px; }
      .nav-tab { background: transparent; border: none; color: #94a3b8; font-size: 0.88rem; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
      .nav-tab:hover { color: #00f0ff; background: rgba(0, 240, 255, 0.08); }
      .nav-tab.active { color: #050814; background: #00f0ff; font-weight: 700; box-shadow: 0 0 16px rgba(0, 240, 255, 0.4); }
      .btn-subscribe { background: linear-gradient(135deg, #00f0ff, #3b82f6); color: #050814; font-weight: 700; font-size: 0.82rem; padding: 8px 18px; border-radius: 999px; border: none; cursor: pointer; transition: transform 0.2s; }
      .btn-subscribe:hover { transform: scale(1.05); }

      .page-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; min-height: calc(100vh - 160px); }
      .page-view { display: none; animation: fadeIn 0.3s ease; }
      .page-view.active { display: block; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

      /* Hero Article */
      .hero-article { background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 20px; padding: 36px; margin-bottom: 36px; cursor: pointer; backdrop-filter: blur(12px); transition: border-color 0.2s, transform 0.2s; }
      .hero-article:hover { border-color: #00f0ff; transform: translateY(-3px); }
      .hero-badge { display: inline-block; background: rgba(0, 240, 255, 0.15); color: #38bdf8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; border: 1px solid rgba(0, 240, 255, 0.3); }
      .hero-article h1 { font-size: 2.2rem; margin: 0 0 16px; line-height: 1.25; background: linear-gradient(135deg, #ffffff, #cbd5e1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .hero-article p { color: #94a3b8; font-size: 1.05rem; line-height: 1.6; margin: 0 0 24px; }
      .author-bar { display: flex; align-items: center; gap: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px; font-size: 0.85rem; }
      .author-avatar { font-size: 1.6rem; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: rgba(0, 240, 255, 0.1); border-radius: 50%; border: 1px solid rgba(0, 240, 255, 0.3); }
      .author-name { font-weight: 700; color: #f8fafc; }
      .author-date { color: #64748b; font-size: 0.78rem; }
      .read-more-btn { margin-left: auto; color: #00f0ff; font-weight: 700; }

      /* Cards Grid */
      .article-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
      .article-card { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 24px; cursor: pointer; transition: all 0.2s; }
      .article-card:hover { border-color: rgba(0, 240, 255, 0.4); transform: translateY(-2px); }
      .card-tag { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #a855f7; margin-bottom: 10px; }
      .article-card h3 { font-size: 1.15rem; margin: 0 0 10px; line-height: 1.4; color: #f8fafc; }
      .article-card p { font-size: 0.88rem; color: #94a3b8; line-height: 1.5; margin: 0 0 16px; }
      .card-footer { display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748b; }
      .card-footer .arrow { color: #00f0ff; font-weight: bold; }

      /* Full Article */
      .back-btn { background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-bottom: 24px; font-weight: 600; }
      .back-btn:hover { color: #fff; border-color: #00f0ff; }
      .full-article h1 { font-size: 2.4rem; line-height: 1.25; margin: 12px 0 20px; }
      .article-meta { display: flex; gap: 12px; font-size: 0.82rem; color: #64748b; align-items: center; }
      .meta-tag { color: #00f0ff; font-weight: 700; }
      .lead-quote { font-size: 1.25rem; font-style: italic; color: #cbd5e1; border-left: 3px solid #00f0ff; padding-left: 20px; margin: 28px 0; }
      .article-body p { font-size: 1.05rem; line-height: 1.7; color: #94a3b8; margin-bottom: 20px; }
      .article-body h2 { color: #f8fafc; margin-top: 36px; }

      /* Comments */
      .comments-section { margin-top: 60px; padding-top: 36px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
      .comment-composer { display: flex; flex-col; flex-direction: column; gap: 10px; margin-bottom: 28px; background: rgba(15, 23, 42, 0.5); padding: 18px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); }
      .comment-composer input, .comment-composer textarea { background: rgba(5, 8, 20, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 10px 14px; border-radius: 8px; font-family: inherit; font-size: 0.9rem; }
      .comment-composer textarea { min-height: 80px; resize: vertical; }
      .btn-primary { align-self: flex-start; background: #00f0ff; color: #050814; font-weight: 700; padding: 8px 20px; border: none; border-radius: 8px; cursor: pointer; }
      .comments-list { display: flex; flex-direction: column; gap: 14px; }
      .comment-item { background: rgba(15, 23, 42, 0.4); padding: 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05); }
      .comment-header { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 6px; }
      .comment-author { font-weight: 700; color: #00f0ff; font-mono; }
      .comment-time { color: #64748b; }
      .comment-item p { margin: 0; font-size: 0.9rem; color: #cbd5e1; line-height: 1.5; }

      /* Categories */
      .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin-top: 24px; }
      .cat-card { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 24px; text-align: center; }
      .cat-icon { font-size: 2.4rem; display: block; margin-bottom: 12px; }
      .cat-card h4 { margin: 0 0 6px; font-size: 1.1rem; color: #f8fafc; }
      .cat-card p { font-size: 0.82rem; color: #94a3b8; margin: 0; }

      /* About */
      .about-card { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 16px; padding: 36px; text-align: center; }
      .about-card h2 { margin-top: 0; }
      .about-card p { max-width: 600px; margin: 0 auto 30px; line-height: 1.6; color: #94a3b8; }
      .stats-row { display: flex; justify-content: center; gap: 40px; }
      .stat-box b { display: block; font-size: 1.8rem; color: #00f0ff; font-family: monospace; }
      .stat-box span { font-size: 0.78rem; color: #64748b; text-transform: uppercase; }

      .site-footer { text-align: center; padding: 30px 20px; font-size: 0.8rem; color: #64748b; border-top: 1px solid rgba(255, 255, 255, 0.05); }
    `,
    js: `
      // Visitors' text is shown as typed, never run as markup.
      function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
      window.switchPage = function(pageId) {
        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        const targetPage = document.getElementById('page-' + pageId);
        const targetTab = document.querySelector('.nav-tab[data-page="' + pageId + '"]');
        if (targetPage) targetPage.classList.add('active');
        if (targetTab) targetTab.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchPage(tab.dataset.page));
      });

      window.postComment = function() {
        const author = document.getElementById('comment-author').value.trim() || '@anonymous';
        const text = document.getElementById('comment-text').value.trim();
        if (!text) return;
        const list = document.getElementById('comments-list');
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = '<div class="comment-header"><span class="comment-author">' + esc(author) + '</span><span class="comment-time">Just now</span></div><p>' + esc(text) + '</p>';
        list.prepend(item);
        document.getElementById('comment-text').value = '';
      };

      window.toggleNewsletter = function() {
        alert('Thanks! Subscriptions are not connected on this site yet.');
      };
    `
  },

  // 2. Community & Tech Forum
  {
    id: 'forum',
    name: 'AetherNet — Sovereign Community Forum',
    category: 'Community & Social',
    badge: 'Multi-Page • Upvoting • Threads',
    favicon: '💬',
    backgroundId: 'circuit',
    description: 'Decentralized discussion forum with category boards, thread view with live upvoting, reply composer, and member karma badges.',
    html: `
<div class="living-bg-circuit"></div>

<header class="forum-header">
  <div class="forum-nav">
    <div class="forum-brand">
      <span class="brand-glyph">🪐</span>
      <span>Aether<b>Forum</b></span>
    </div>
    <div class="nav-pills">
      <button class="pill active" data-tab="all">All Channels</button>
      <button class="pill" data-tab="thread">Active Discussion</button>
      <button class="pill" data-tab="compose">Start Thread</button>
    </div>
    <div class="forum-search">
      <input type="text" placeholder="Search threads, tags, node IDs..." />
    </div>
  </div>
</header>

<main class="forum-body">
  <!-- VIEW 1: THREAD LIST -->
  <section id="view-all" class="forum-view active">
    <div class="forum-stats-bar">
      <span><b>1,420</b> Online Peers</span>
      <span><b>84.2K</b> Mesh Packets/min</span>
      <span><b>Zero</b> Central Moderators</span>
    </div>

    <div class="threads-list">
      <div class="thread-row" onclick="openThread('t1')">
        <div class="vote-widget" onclick="event.stopPropagation(); upvote(this)">
          <button class="vote-btn">▲</button>
          <span class="vote-count">342</span>
        </div>
        <div class="thread-info">
          <div class="thread-tags"><span class="tag-ai">Local AI</span><span class="tag-hot">🔥 Hot</span></div>
          <h3 contenteditable="true">Running Gemma 4 31B locally on single 24GB GPUs: Optimal GGUF quantization layers</h3>
          <p contenteditable="true">Detailed benchmark of Q4_K_M vs Q5_K_M with FlashAttention-3 enabled. Zero accuracy degradation on SWE-bench verified.</p>
          <div class="thread-meta">Started by <span class="author">@neon_samurai</span> • 48 replies • 12m ago</div>
        </div>
      </div>

      <div class="thread-row" onclick="openThread('t2')">
        <div class="vote-widget" onclick="event.stopPropagation(); upvote(this)">
          <button class="vote-btn">▲</button>
          <span class="vote-count">198</span>
        </div>
        <div class="thread-info">
          <div class="thread-tags"><span class="tag-mesh">P2P Mesh</span></div>
          <h3 contenteditable="true">Decentralized STUN relays and WAN mesh punchthrough across Starlink terminals</h3>
          <p contenteditable="true">Testing the blind relay supervisor in remote off-grid setups with zero public IPv4 addresses.</p>
          <div class="thread-meta">Started by <span class="author">@sat_wanderer</span> • 26 replies • 1h ago</div>
        </div>
      </div>

      <div class="thread-row" onclick="openThread('t3')">
        <div class="vote-widget" onclick="event.stopPropagation(); upvote(this)">
          <button class="vote-btn">▲</button>
          <span class="vote-count">115</span>
        </div>
        <div class="thread-info">
          <div class="thread-tags"><span class="tag-gaming">HoloChess</span></div>
          <h3 contenteditable="true">Aura Neural Intuition personality just played a 3-piece sacrifice checkmate</h3>
          <p contenteditable="true">Reviewing the PGN notation from the Master difficulty match. The dynamic line calculation is terrifyingly creative.</p>
          <div class="thread-meta">Started by <span class="author">@grandmaster_zero</span> • 19 replies • 2h ago</div>
        </div>
      </div>
    </div>
  </section>

  <!-- VIEW 2: FULL THREAD DISCUSSION -->
  <section id="view-thread" class="forum-view">
    <button class="back-pill" onclick="switchForumView('all')">← Back to Discussions</button>
    <div class="thread-opener">
      <div class="thread-tags"><span class="tag-ai">Local AI</span><span class="tag-hot">🔥 Active Thread</span></div>
      <h1 contenteditable="true">Running Gemma 4 31B locally on single 24GB GPUs: Optimal GGUF quantization layers</h1>
      <div class="author-dossier">
        <span class="avatar-box">🥷</span>
        <div>
          <span class="author-name">@neon_samurai</span>
          <span class="author-reputation">Verified Node • 1,480 Karma</span>
        </div>
      </div>
      <div class="thread-text" contenteditable="true">
        <p>After running comprehensive sweeps through the late 2026 Gemma 4 release, here is the breakdown for anyone running 24GB VRAM hardware (RTX 4090 / 5090 or Apple M4 Max 64GB):</p>
        <p>1. Q4_K_M delivers 64.2 tokens/second while preserving 98.4% of FP16 accuracy on mathematical and coding reasoning tasks.<br/>
        2. Context cache offloading to system RAM stays under 4GB for 32k context windows.</p>
      </div>
    </div>

    <!-- Replies -->
    <div class="replies-container">
      <h3>Peer Responses (2)</h3>
      <div class="reply-card">
        <div class="reply-author"><b>@cyber_monk</b> <span>• 24m ago</span></div>
        <p contenteditable="true">Verified your numbers on an RTX 4090. FlashAttention-3 makes a massive difference in prompt ingestion speed. We're hitting 480 tok/s ingest!</p>
      </div>
      <div class="reply-card">
        <div class="reply-author"><b>@dr_thorne</b> <span>• 12m ago</span></div>
        <p contenteditable="true">Can confirm. Running this as the default background engine for our Literature IDE with zero degradation in narrative consistency.</p>
      </div>
    </div>

    <!-- Reply Form -->
    <div class="reply-composer">
      <h4>Add to Conversation</h4>
      <textarea id="reply-input" placeholder="Compose signed response..."></textarea>
      <button class="btn-cyan" onclick="submitReply()">Broadcast Reply</button>
    </div>
  </section>

  <!-- VIEW 3: COMPOSE THREAD -->
  <section id="view-compose" class="forum-view">
    <div class="compose-card">
      <h2>Initiate Sovereign Discussion</h2>
      <input type="text" id="new-thread-title" placeholder="Descriptive thread title..." />
      <select id="new-thread-category">
        <option>Local AI & Neural Models</option>
        <option>P2P Mesh Protocols</option>
        <option>Gaming & HoloChess</option>
        <option>Founder Directives & Governance</option>
      </select>
      <textarea id="new-thread-body" placeholder="Share technical findings, questions, or announcements..."></textarea>
      <button class="btn-cyan" onclick="publishNewThread()">Publish to Mesh</button>
    </div>
  </section>
</main>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #030712; color: #f1f5f9; min-height: 100vh; }
      .forum-header { background: rgba(3, 7, 18, 0.9); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(0, 240, 255, 0.15); padding: 12px 24px; position: sticky; top: 0; z-index: 100; }
      .forum-nav { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
      .forum-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.15rem; }
      .brand-glyph { font-size: 1.4rem; }
      .forum-brand b { color: #00f0ff; }
      .nav-pills { display: flex; gap: 6px; }
      .pill { background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 0.85rem; font-weight: 600; padding: 7px 16px; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
      .pill.active, .pill:hover { background: #00f0ff; color: #030712; border-color: #00f0ff; font-weight: 700; box-shadow: 0 0 12px rgba(0, 240, 255, 0.35); }
      .forum-search input { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 0.85rem; width: 220px; outline: none; }
      .forum-search input:focus { border-color: #00f0ff; width: 260px; }

      .forum-body { max-width: 1000px; margin: 0 auto; padding: 32px 20px; }
      .forum-view { display: none; }
      .forum-view.active { display: block; }

      .forum-stats-bar { display: flex; gap: 24px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(0, 240, 255, 0.2); padding: 12px 20px; border-radius: 12px; margin-bottom: 24px; font-size: 0.85rem; color: #94a3b8; }
      .forum-stats-bar b { color: #00f0ff; }

      /* Threads */
      .threads-list { display: flex; flex-direction: column; gap: 14px; }
      .thread-row { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; display: flex; gap: 18px; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(8px); }
      .thread-row:hover { border-color: rgba(0, 240, 255, 0.4); transform: translateY(-2px); }
      .vote-widget { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 44px; background: rgba(0, 0, 0, 0.4); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 6px; }
      .vote-btn { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.9rem; transition: color 0.2s; }
      .vote-btn:hover { color: #00f0ff; }
      .vote-count { font-size: 0.85rem; font-weight: 700; color: #38bdf8; font-family: monospace; }
      .thread-info h3 { margin: 6px 0; font-size: 1.1rem; line-height: 1.35; color: #f8fafc; }
      .thread-info p { margin: 0 0 10px; font-size: 0.88rem; color: #94a3b8; line-height: 1.5; }
      .thread-tags { display: flex; gap: 8px; margin-bottom: 4px; }
      .tag-ai { background: rgba(0, 240, 255, 0.15); color: #38bdf8; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
      .tag-hot { background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
      .tag-mesh { background: rgba(168, 85, 247, 0.15); color: #c084fc; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
      .tag-gaming { background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
      .thread-meta { font-size: 0.78rem; color: #64748b; }
      .thread-meta .author { color: #00f0ff; font-weight: 600; }

      /* Thread View */
      .back-pill { background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); color: #94a3b8; padding: 6px 14px; border-radius: 999px; cursor: pointer; margin-bottom: 18px; font-weight: 600; font-size: 0.85rem; }
      .back-pill:hover { color: #fff; border-color: #00f0ff; }
      .thread-opener { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 16px; padding: 28px; margin-bottom: 24px; }
      .thread-opener h1 { margin: 12px 0 16px; font-size: 1.8rem; line-height: 1.3; }
      .author-dossier { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .avatar-box { font-size: 1.6rem; background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
      .author-name { font-weight: 700; color: #00f0ff; display: block; }
      .author-reputation { font-size: 0.78rem; color: #64748b; }
      .thread-text { color: #cbd5e1; font-size: 1rem; line-height: 1.6; }

      .replies-container { margin-bottom: 28px; }
      .reply-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 18px; margin-bottom: 12px; }
      .reply-author { font-size: 0.85rem; margin-bottom: 8px; color: #94a3b8; }
      .reply-author b { color: #00f0ff; }
      .reply-card p { margin: 0; color: #e2e8f0; font-size: 0.92rem; line-height: 1.5; }

      .reply-composer, .compose-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 24px; }
      .reply-composer textarea, .compose-card textarea, .compose-card input, .compose-card select { width: 100%; background: rgba(3, 7, 18, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 12px; border-radius: 8px; font-family: inherit; font-size: 0.9rem; margin-bottom: 14px; }
      .reply-composer textarea, .compose-card textarea { min-height: 100px; resize: vertical; }
      .btn-cyan { background: #00f0ff; color: #030712; font-weight: 700; padding: 10px 24px; border: none; border-radius: 8px; cursor: pointer; transition: transform 0.2s; }
      .btn-cyan:hover { transform: scale(1.04); }
    `,
    js: `
      // Visitors' text is shown as typed, never run as markup.
      function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
      window.switchForumView = function(viewId) {
        document.querySelectorAll('.forum-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        const targetView = document.getElementById('view-' + viewId);
        const targetPill = document.querySelector('.pill[data-tab="' + viewId + '"]');
        if (targetView) targetView.classList.add('active');
        if (targetPill) targetPill.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => switchForumView(pill.dataset.tab));
      });

      window.openThread = function(id) {
        switchForumView('thread');
      };

      window.upvote = function(widget) {
        const countSpan = widget.querySelector('.vote-count');
        let current = parseInt(countSpan.textContent, 10);
        countSpan.textContent = current + 1;
        widget.style.borderColor = '#00f0ff';
      };

      window.submitReply = function() {
        const text = document.getElementById('reply-input').value.trim();
        if (!text) return;
        const container = document.querySelector('.replies-container');
        const card = document.createElement('div');
        card.className = 'reply-card';
        card.innerHTML = '<div class="reply-author"><b>@operator</b> <span>• Just now</span></div><p>' + esc(text) + '</p>';
        container.appendChild(card);
        document.getElementById('reply-input').value = '';
      };

      window.publishNewThread = function() {
        alert('New threads are not saved on this site yet; this forum is a template.');
        switchForumView('all');
      };
    `
  },

  // 3. Decentralized Real-Time Chatroom
  {
    id: 'chatroom',
    name: 'NeonPulse — Decentralized Cyber Chat',
    category: 'Real-Time Messaging',
    badge: 'Multi-Channel • Live Reactions',
    favicon: '⚡',
    backgroundId: 'obsidian',
    description: 'Decentralized multi-channel chat room with active member roster, animated message stream, real-time emoji reactions, and message composer.',
    html: `
<div class="living-bg-obsidian">
  <div class="flare f1"></div>
  <div class="flare f2"></div>
  <div class="flare f3"></div>
</div>

<div class="chat-app-window">
  <!-- Left Sidebar: Channels & Swarms -->
  <aside class="chat-sidebar">
    <div class="sidebar-top">
      <div class="hub-brand">
        <span class="hub-pip"></span>
        <span>Neon<b>Pulse</b></span>
      </div>
      <div class="hub-status">Mesh Connected • 14 Nodes</div>
    </div>

    <div class="channels-section">
      <div class="section-label">Public Channels</div>
      <button class="channel-btn active" data-chan="general" onclick="selectChannel('general')">
        <span class="hash">#</span> general
      </button>
      <button class="channel-btn" data-chan="announcements" onclick="selectChannel('announcements')">
        <span class="hash">#</span> announcements
      </button>
      <button class="channel-btn" data-chan="neural-dev" onclick="selectChannel('neural-dev')">
        <span class="hash">#</span> neural-dev
      </button>
      <button class="channel-btn" data-chan="mesh-trading" onclick="selectChannel('mesh-trading')">
        <span class="hash">#</span> mesh-trading
      </button>
    </div>

    <div class="user-profile-dock">
      <div class="user-avatar">👤</div>
      <div class="user-info">
        <div class="user-handle">@operator</div>
        <div class="user-did">did:nova:7f49a...</div>
      </div>
    </div>
  </aside>

  <!-- Center Stage: Message Stream -->
  <main class="chat-main">
    <header class="chat-topbar">
      <div>
        <h2 id="current-channel-title">#general</h2>
        <span class="channel-topic" id="current-channel-desc" contenteditable="true">Global sovereign mesh chatter, discoveries, and zero-knowledge gossip.</span>
      </div>
      <div class="topbar-actions">
        <button class="btn-ghost" onclick="toggleRoster()">Toggle Peers (8)</button>
      </div>
    </header>

    <div class="messages-viewport" id="messages-stream">
      <div class="chat-msg">
        <span class="msg-avatar">🤖</span>
        <div class="msg-content">
          <div class="msg-header">
            <span class="msg-user">@nova_guardian</span>
            <span class="msg-time">10:42 AM</span>
          </div>
          <div class="msg-text">Welcome to the decentralized chat matrix. All messages are encrypted with ephemeral shared secrets.</div>
          <div class="msg-reactions">
            <button class="react-chip" onclick="react(this)">🛡️ 5</button>
            <button class="react-chip" onclick="react(this)">⚡ 8</button>
          </div>
        </div>
      </div>

      <div class="chat-msg">
        <span class="msg-avatar">👩‍💻</span>
        <div class="msg-content">
          <div class="msg-header">
            <span class="msg-user">@lyra_code</span>
            <span class="msg-time">10:45 AM</span>
          </div>
          <div class="msg-text">Just tested the 1-click mesh website publisher! My custom portfolio went live on <span class="mention">nova://lyra.nova</span> instantly without DNS configuration.</div>
          <div class="msg-reactions">
            <button class="react-chip" onclick="react(this)">🚀 12</button>
            <button class="react-chip" onclick="react(this)">🔥 6</button>
          </div>
        </div>
      </div>

      <div class="chat-msg">
        <span class="msg-avatar">♟️</span>
        <div class="msg-content">
          <div class="msg-header">
            <span class="msg-user">@hologram_tactics</span>
            <span class="msg-time">10:50 AM</span>
          </div>
          <div class="msg-text">Anyone down for a 3D HoloChess match over P2P mesh? Challenging with Aura Faction.</div>
          <div class="msg-reactions">
            <button class="react-chip" onclick="react(this)">👑 3</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Composer -->
    <footer class="composer-container">
      <div class="quick-emojis">
        <button onclick="insertEmoji('🔥')">🔥</button>
        <button onclick="insertEmoji('🚀')">🚀</button>
        <button onclick="insertEmoji('⚡')">⚡</button>
        <button onclick="insertEmoji('💡')">💡</button>
        <button onclick="insertEmoji('🤖')">🤖</button>
      </div>
      <div class="composer-box">
        <input type="text" id="chat-input" placeholder="Message #general... (Press Enter to Send)" onkeydown="if(event.key==='Enter')sendMessage()" />
        <button class="btn-send" onclick="sendMessage()">Send</button>
      </div>
    </footer>
  </main>

  <!-- Right Sidebar: Active Peer Roster -->
  <aside class="chat-roster" id="chat-roster">
    <div class="roster-title">Active Mesh Peers (8)</div>
    <div class="roster-list">
      <div class="peer-item online"><span class="pip"></span> @nova_guardian</div>
      <div class="peer-item online"><span class="pip"></span> @lyra_code</div>
      <div class="peer-item online"><span class="pip"></span> @hologram_tactics</div>
      <div class="peer-item online"><span class="pip"></span> @cybeni_engineer</div>
      <div class="peer-item online"><span class="pip"></span> @dr_thorne</div>
      <div class="peer-item away"><span class="pip"></span> @sat_wanderer</div>
      <div class="peer-item away"><span class="pip"></span> @grandmaster_zero</div>
      <div class="peer-item online"><span class="pip"></span> @operator (You)</div>
    </div>
  </aside>
</div>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #05070e; color: #f1f5f9; height: 100vh; overflow: hidden; }
      .chat-app-window { display: flex; height: 100vh; width: 100vw; backdrop-filter: blur(10px); }

      /* Sidebar */
      .chat-sidebar { width: 240px; background: rgba(10, 15, 30, 0.85); border-right: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; }
      .sidebar-top { padding: 18px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
      .hub-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.1rem; }
      .hub-pip { width: 8px; height: 8px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 8px #00f0ff; }
      .hub-brand b { color: #00f0ff; }
      .hub-status { font-size: 0.72rem; color: #10b981; font-family: monospace; margin-top: 4px; }

      .channels-section { flex: 1; padding: 16px 10px; overflow-y: auto; }
      .section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; padding-left: 8px; margin-bottom: 8px; }
      .channel-btn { width: 100%; display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: #94a3b8; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: left; }
      .channel-btn .hash { color: #64748b; font-weight: bold; }
      .channel-btn:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
      .channel-btn.active { background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); }

      .user-profile-dock { padding: 12px 14px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; gap: 10px; background: rgba(5, 8, 20, 0.6); }
      .user-avatar { font-size: 1.2rem; width: 34px; height: 34px; background: rgba(0, 240, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .user-handle { font-weight: 700; font-size: 0.85rem; color: #fff; }
      .user-did { font-size: 0.68rem; color: #64748b; font-family: monospace; }

      /* Main Chat */
      .chat-main { flex: 1; display: flex; flex-direction: column; height: 100vh; }
      .chat-topbar { padding: 14px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(10, 15, 30, 0.5); display: flex; justify-content: space-between; align-items: center; }
      .chat-topbar h2 { margin: 0 0 2px; font-size: 1.2rem; color: #fff; }
      .channel-topic { font-size: 0.8rem; color: #94a3b8; }
      .btn-ghost { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; }
      .btn-ghost:hover { border-color: #00f0ff; color: #00f0ff; }

      .messages-viewport { flex: 1; padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
      .chat-msg { display: flex; gap: 12px; }
      .msg-avatar { font-size: 1.4rem; width: 38px; height: 38px; background: rgba(255, 255, 255, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .msg-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 4px; }
      .msg-user { font-weight: 700; font-size: 0.88rem; color: #00f0ff; }
      .msg-time { font-size: 0.72rem; color: #64748b; }
      .msg-text { font-size: 0.92rem; color: #e2e8f0; line-height: 1.45; }
      .mention { color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 1px 6px; border-radius: 4px; font-family: monospace; }
      .msg-reactions { display: flex; gap: 6px; margin-top: 6px; }
      .react-chip { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 999px; color: #94a3b8; font-size: 0.75rem; padding: 2px 8px; cursor: pointer; transition: all 0.2s; }
      .react-chip:hover { border-color: #00f0ff; color: #00f0ff; }

      .composer-container { padding: 12px 24px 20px; background: rgba(10, 15, 30, 0.7); border-top: 1px solid rgba(255, 255, 255, 0.08); }
      .quick-emojis { display: flex; gap: 6px; margin-bottom: 8px; }
      .quick-emojis button { background: none; border: none; font-size: 1rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
      .quick-emojis button:hover { opacity: 1; transform: scale(1.2); }
      .composer-box { display: flex; gap: 10px; }
      .composer-box input { flex: 1; background: rgba(5, 8, 20, 0.85); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 10px; color: #fff; padding: 12px 16px; font-size: 0.92rem; outline: none; }
      .composer-box input:focus { border-color: #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.25); }
      .btn-send { background: linear-gradient(135deg, #00f0ff, #3b82f6); color: #030712; border: none; padding: 0 24px; border-radius: 10px; font-weight: 700; cursor: pointer; }

      /* Roster */
      .chat-roster { width: 200px; background: rgba(10, 15, 30, 0.7); border-left: 1px solid rgba(255, 255, 255, 0.08); padding: 18px 14px; }
      .roster-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 14px; }
      .roster-list { display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem; }
      .peer-item { display: flex; align-items: center; gap: 8px; color: #cbd5e1; }
      .peer-item .pip { width: 7px; height: 7px; border-radius: 50%; }
      .peer-item.online .pip { background: #10b981; box-shadow: 0 0 6px #10b981; }
      .peer-item.away .pip { background: #f59e0b; }
    `,
    js: `
      // Visitors' text is shown as typed, never run as markup.
      function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
      window.selectChannel = function(chanId) {
        document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector('.channel-btn[data-chan="' + chanId + '"]');
        if (btn) btn.classList.add('active');
        document.getElementById('current-channel-title').textContent = '#' + chanId;
      };

      window.sendMessage = function() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;
        const stream = document.getElementById('messages-stream');
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = '<span class="msg-avatar">👤</span><div class="msg-content"><div class="msg-header"><span class="msg-user">@operator</span><span class="msg-time">Just now</span></div><div class="msg-text">' + esc(text) + '</div><div class="msg-reactions"><button class="react-chip" onclick="react(this)">⚡ 1</button></div></div>';
        stream.appendChild(msg);
        input.value = '';
        stream.scrollTop = stream.scrollHeight;
      };

      window.insertEmoji = function(char) {
        const input = document.getElementById('chat-input');
        input.value += char;
        input.focus();
      };

      window.react = function(btn) {
        let text = btn.textContent.split(' ');
        let count = parseInt(text[1] || '0', 10) + 1;
        btn.textContent = text[0] + ' ' + count;
      };

      window.toggleRoster = function() {
        const r = document.getElementById('chat-roster');
        r.style.display = r.style.display === 'none' ? 'block' : 'none';
      };
    `
  },

  // 4. Creative Technologist & Neural Architect Portfolio
  {
    id: 'portfolio',
    name: 'Kaelen Vex — Neural Architect & Creative Technologist',
    category: 'Portfolio & Creative',
    badge: 'Multi-Page • Live Filter • Image Dropzones',
    favicon: '🎨',
    backgroundId: 'obsidian',
    description: 'Bespoke dark glassmorphism portfolio featuring interactive project filtering, deep-dive case study reader, technical stack matrix, image drag-and-drop zones, and P2P contact form.',
    html: `
<div class="living-bg-obsidian">
  <div class="flare f1"></div>
  <div class="flare f2"></div>
  <div class="flare f3"></div>
</div>

<header class="port-header">
  <div class="port-nav">
    <div class="port-brand">
      <span class="port-glyph">◈</span>
      <span>Kaelen<b>Vex</b></span>
    </div>
    <div class="port-links">
      <button class="port-btn active" data-page="works">Selected Works</button>
      <button class="port-btn" data-page="casestudy">Case Study</button>
      <button class="port-btn" data-page="stack">Tech & Rig</button>
      <button class="port-btn" data-page="contact">Direct Line</button>
    </div>
    <button class="btn-cyan-port" onclick="switchPortPage('contact')">Init Contact</button>
  </div>
</header>

<main class="port-content">
  <!-- VIEW 1: WORKS -->
  <section id="port-works" class="port-view active">
    <div class="port-hero">
      <div class="hero-label">Autonomous Engineering • 2026 Sovereign Systems</div>
      <h1 contenteditable="true">Forging Decentralized Computing, Holographic Visuals, & Local Intelligence</h1>
      <p contenteditable="true">Principal architect specializing in zero-cloud decentralized protocols, real-time procedural WebGL simulations, and quantized neural model engines on consumer hardware.</p>
      
      <div class="filter-bar">
        <button class="filter-pill active" onclick="filterProjects('all')">All Work (6)</button>
        <button class="filter-pill" onclick="filterProjects('neural')">Local AI</button>
        <button class="filter-pill" onclick="filterProjects('webgl')">3D & Graphics</button>
        <button class="filter-pill" onclick="filterProjects('mesh')">P2P Mesh</button>
      </div>
    </div>

    <div class="projects-grid">
      <!-- Project 1 -->
      <div class="project-tile" data-cat="webgl">
        <div class="img-placeholder" title="Drag & drop your screenshot here">
          <div class="drop-label">📸 <b>Drag & Drop Image Here</b><br><span>HoloChess 3D Quantum Engine</span></div>
        </div>
        <div class="tile-meta">
          <span class="tile-tag">Three.js • WebGL • Shaders</span>
          <h3 contenteditable="true">HoloChess 3D: Quantum Board Simulation</h3>
          <p contenteditable="true">A holographic chess interface running procedural particle beams, dynamic bloom shaders, and dual AI neural engines with custom commentary personalities.</p>
          <div class="tile-actions">
            <button class="btn-text-link" onclick="switchPortPage('casestudy')">Read Case Study →</button>
            <span class="stars">★ 4.9k</span>
          </div>
        </div>
      </div>

      <!-- Project 2 -->
      <div class="project-tile" data-cat="neural">
        <div class="img-placeholder" title="Drag & drop your screenshot here">
          <div class="drop-label">📸 <b>Drag & Drop Image Here</b><br><span>Gemma 4 Real-Time Distillation</span></div>
        </div>
        <div class="tile-meta">
          <span class="tile-tag">Gemma 4 • Rust WASM • GGUF</span>
          <h3 contenteditable="true">Sovereign LLM Hypervisor</h3>
          <p contenteditable="true">Sub-millisecond local inference routing across dual RTX 4090 GPUs. Zero cloud roundtrips, encrypted context memory, and automated code validation.</p>
          <div class="tile-actions">
            <button class="btn-text-link" onclick="switchPortPage('casestudy')">View Architecture →</button>
            <span class="stars">★ 3.2k</span>
          </div>
        </div>
      </div>

      <!-- Project 3 -->
      <div class="project-tile" data-cat="mesh">
        <div class="img-placeholder" title="Drag & drop your screenshot here">
          <div class="drop-label">📸 <b>Drag & Drop Image Here</b><br><span>Decentralized Mesh Routing Visualizer</span></div>
        </div>
        <div class="tile-meta">
          <span class="tile-tag">WebRTC • STUN • Ed25519</span>
          <h3 contenteditable="true">Aether Mesh: Zero-ISP Packet Protocol</h3>
          <p contenteditable="true">Cryptographic machine-to-machine gossip layer enabling decentralized website hosting, blind relaying, and end-to-end encrypted sovereign messaging.</p>
          <div class="tile-actions">
            <button class="btn-text-link" onclick="switchPortPage('casestudy')">View Protocol →</button>
            <span class="stars">★ 6.8k</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- VIEW 2: CASE STUDY -->
  <section id="port-casestudy" class="port-view">
    <button class="back-link" onclick="switchPortPage('works')">← Back to Selected Works</button>
    <div class="casestudy-article">
      <div class="cs-badge">Deep Architectural Breakdown</div>
      <h1 contenteditable="true">Engineering HoloChess: From Procedural Shaders to Local Neural Evaluation</h1>
      <div class="cs-meta">12 min read • Published November 2026 • Sovereign Labs</div>

      <div class="img-placeholder cs-hero-img">
        <div class="drop-label">📸 <b>Drag & Drop Architectural Schematic</b><br><span>WebGL Render Pipeline & Evaluation Loop</span></div>
      </div>

      <h2 contenteditable="true">1. The Problem: Cloud Dependence vs Holographic Fluidity</h2>
      <p contenteditable="true">Traditional cloud-tethered engines suffer from network jitter, payload latency, and central surveillance. For HoloChess 3D, the goal was 120 FPS raymarched holography coupled with local AI personality commentary executing entirely on the client.</p>

      <div class="cs-callout">
        <b>Key Breakthrough:</b> Combining Three.js WebGL procedural shaders with a lightweight minimax and positional piece-square evaluation matrix delivered instant 3-ply lookahead with zero latency.
      </div>

      <h2 contenteditable="true">2. Dual Faction Dynamic Holography</h2>
      <p contenteditable="true">The Nova Faction renders crisp cerulean and cyan laser vectors with sharp blueprint geometry, while the Aura Faction radiates ethereal amethyst, violet, and magenta particle plumes that react dynamically to captured pieces.</p>
    </div>
  </section>

  <!-- VIEW 3: TECH & RIG -->
  <section id="port-stack" class="port-view">
    <div class="stack-hero">
      <h2>Engineering Matrix & Sovereign Lab Rig</h2>
      <p>Tooling calibrated for unkillable offline production and sub-second compilation.</p>
    </div>

    <div class="stack-grid">
      <div class="stack-card">
        <h3>Primary Capabilities</h3>
        <div class="skill-meter">
          <div class="skill-head"><span>Rust & Tauri OS Core</span><b>96%</b></div>
          <div class="meter-bar"><div class="fill" style="width: 96%"></div></div>
        </div>
        <div class="skill-meter">
          <div class="skill-head"><span>WebGL & Three.js Shaders</span><b>92%</b></div>
          <div class="meter-bar"><div class="fill" style="width: 92%"></div></div>
        </div>
        <div class="skill-meter">
          <div class="skill-head"><span>Local LLM Quantization (Gemma 4/Llama 4)</span><b>90%</b></div>
          <div class="meter-bar"><div class="fill" style="width: 90%"></div></div>
        </div>
        <div class="skill-meter">
          <div class="skill-head"><span>P2P WebRTC & Cryptographic Protocols</span><b>94%</b></div>
          <div class="meter-bar"><div class="fill" style="width: 94%"></div></div>
        </div>
      </div>

      <div class="stack-card">
        <h3>Laboratory Compute Rig</h3>
        <ul class="rig-specs">
          <li><b>Workstation:</b> Dual RTX 5090 32GB VRAM + AMD Threadripper 7980X</li>
          <li><b>Mobile Node:</b> Apple MacBook Pro M4 Max (128GB Unified RAM)</li>
          <li><b>OS Environment:</b> Novaura OS Sovereign v3.4 (Zero Central Telemetry)</li>
          <li><b>Local Inference:</b> Ollama 0.6 + LM Studio Local Server (Port 11434)</li>
          <li><b>Mesh Node:</b> <code>did:nova:8f3c7a9142...</code> (Always Online)</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- VIEW 4: CONTACT -->
  <section id="port-contact" class="port-view">
    <div class="contact-box">
      <h2>Cryptographic Dispatch Line</h2>
      <p>Send an end-to-end encrypted packet directly to my sovereign node or schedule an architectural consultation.</p>
      <div class="contact-fields">
        <input type="text" id="p-contact-name" placeholder="Your Name or Mesh Alias (@handle)..." />
        <input type="email" id="p-contact-email" placeholder="Your Decentralized Email or Nova Address..." />
        <textarea id="p-contact-msg" placeholder="Project scope, timeline, and architectural challenges..."></textarea>
        <button class="btn-cyan-port" onclick="sendPortMessage()">Transmit Verified Packet</button>
      </div>
      <div class="pgp-fingerprint">
        <span>ED25519 Fingerprint: <code>4B92 A70F C1E3 89D2 4410 99FE 78AA 310B</code></span>
      </div>
    </div>
  </section>
</main>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #05070e; color: #f1f5f9; min-height: 100vh; }
      .port-header { background: rgba(10, 15, 30, 0.85); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(0, 240, 255, 0.15); position: sticky; top: 0; z-index: 100; padding: 14px 28px; }
      .port-nav { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
      .port-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.2rem; }
      .port-glyph { color: #00f0ff; font-size: 1.3rem; }
      .port-brand b { color: #00f0ff; }
      .port-links { display: flex; gap: 6px; }
      .port-btn { background: transparent; border: none; color: #94a3b8; font-size: 0.88rem; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
      .port-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
      .port-btn.active { background: rgba(0, 240, 255, 0.15); color: #00f0ff; font-weight: 700; border: 1px solid rgba(0, 240, 255, 0.3); }
      .btn-cyan-port { background: #00f0ff; color: #05070e; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: transform 0.2s; }
      .btn-cyan-port:hover { transform: scale(1.05); }

      .port-content { max-width: 1050px; margin: 0 auto; padding: 40px 24px; }
      .port-view { display: none; }
      .port-view.active { display: block; }

      .port-hero { text-align: center; max-width: 820px; margin: 0 auto 50px; }
      .hero-label { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #00f0ff; letter-spacing: 2px; margin-bottom: 12px; }
      .port-hero h1 { font-size: 2.7rem; line-height: 1.22; margin: 0 0 20px; color: #f8fafc; }
      .port-hero p { font-size: 1.1rem; line-height: 1.6; color: #94a3b8; margin: 0 0 32px; }

      .filter-bar { display: flex; justify-content: center; gap: 8px; }
      .filter-pill { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 0.82rem; font-weight: 600; padding: 6px 16px; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
      .filter-pill:hover, .filter-pill.active { background: #00f0ff; color: #05070e; border-color: #00f0ff; font-weight: 700; }

      /* Projects Grid */
      .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 24px; margin-top: 36px; }
      .project-tile { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; backdrop-filter: blur(10px); transition: transform 0.2s, border-color 0.2s; display: flex; flex-direction: column; }
      .project-tile:hover { transform: translateY(-4px); border-color: rgba(0, 240, 255, 0.4); }

      .img-placeholder { height: 200px; background: rgba(5, 10, 25, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; cursor: pointer; position: relative; overflow: hidden; transition: background 0.2s; }
      .img-placeholder.drag-hover { background: rgba(0, 240, 255, 0.2); border: 2px dashed #00f0ff; }
      .drop-label b { color: #00f0ff; font-size: 0.95rem; }
      .drop-label span { color: #64748b; font-size: 0.8rem; }

      .tile-meta { padding: 22px; flex: 1; display: flex; flex-direction: column; }
      .tile-tag { font-size: 0.72rem; color: #38bdf8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; font-family: monospace; }
      .tile-meta h3 { margin: 0 0 10px; font-size: 1.2rem; color: #f8fafc; }
      .tile-meta p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin: 0 0 18px; flex: 1; }
      .tile-actions { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 14px; }
      .btn-text-link { background: none; border: none; color: #00f0ff; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 0; }
      .stars { font-size: 0.78rem; color: #f59e0b; font-family: monospace; }

      /* Case Study */
      .casestudy-article { max-width: 780px; margin: 0 auto; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 40px; }
      .back-link { background: none; border: none; color: #00f0ff; font-weight: 700; margin-bottom: 24px; cursor: pointer; font-size: 0.9rem; }
      .cs-badge { color: #38bdf8; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
      .cs-meta { color: #64748b; font-size: 0.82rem; margin-bottom: 28px; }
      .cs-hero-img { height: 260px; border-radius: 10px; margin-bottom: 30px; }
      .casestudy-article h2 { margin-top: 32px; font-size: 1.4rem; color: #f8fafc; }
      .casestudy-article p { line-height: 1.65; color: #cbd5e1; font-size: 0.98rem; }
      .cs-callout { background: rgba(0, 240, 255, 0.1); border-left: 4px solid #00f0ff; padding: 16px 20px; border-radius: 8px; margin: 24px 0; font-size: 0.95rem; }

      /* Stack */
      .stack-hero { text-align: center; margin-bottom: 36px; }
      .stack-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .stack-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 28px; }
      .stack-card h3 { margin-top: 0; color: #00f0ff; margin-bottom: 20px; }
      .skill-meter { margin-bottom: 16px; }
      .skill-head { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; }
      .meter-bar { height: 7px; background: rgba(255, 255, 255, 0.1); border-radius: 999px; overflow: hidden; }
      .meter-bar .fill { height: 100%; background: linear-gradient(90deg, #00f0ff, #818cf8); border-radius: 999px; }
      .rig-specs { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem; color: #cbd5e1; }
      .rig-specs b { color: #38bdf8; }

      /* Contact */
      .contact-box { max-width: 580px; margin: 0 auto; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 16px; padding: 36px; text-align: center; }
      .contact-fields { display: flex; flex-direction: column; gap: 14px; margin-top: 24px; }
      .contact-fields input, .contact-fields textarea { background: rgba(5, 10, 25, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 12px 16px; color: #fff; font-size: 0.92rem; outline: none; }
      .contact-fields textarea { min-height: 100px; }
      .pgp-fingerprint { margin-top: 24px; font-size: 0.75rem; color: #64748b; font-family: monospace; }
    `,
    js: `
      window.switchPortPage = function(pageId) {
        document.querySelectorAll('.port-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.port-btn').forEach(b => b.classList.remove('active'));
        const targetView = document.getElementById('port-' + pageId);
        const targetBtn = document.querySelector('.port-btn[data-page="' + pageId + '"]');
        if (targetView) targetView.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      document.querySelectorAll('.port-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPortPage(btn.dataset.page));
      });

      window.filterProjects = function(cat) {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        event.target.classList.add('active');
        document.querySelectorAll('.project-tile').forEach(tile => {
          if (cat === 'all' || tile.dataset.cat === cat) {
            tile.style.display = 'flex';
          } else {
            tile.style.display = 'none';
          }
        });
      };

      window.sendPortMessage = function() {
        const name = document.getElementById('p-contact-name').value.trim();
        const msg = document.getElementById('p-contact-msg').value.trim();
        if (!name || !msg) { alert('Please provide your name and message.'); return; }
        alert('Thanks, ' + name + '! This contact form is not connected yet, so your message was not sent.');
        document.getElementById('p-contact-msg').value = '';
        switchPortPage('works');
      };

      // Universal drag & drop image handler for all placeholders
      document.querySelectorAll('.img-placeholder').forEach(el => {
        el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-hover'); });
        el.addEventListener('dragleave', () => { el.classList.remove('drag-hover'); });
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          el.classList.remove('drag-hover');
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              el.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />';
            };
            reader.readAsDataURL(file);
          }
        });
      });
    `
  },

  // 5. Landscaping & Outdoor Living Business
  {
    id: 'landscaping',
    name: 'VerdantCraft — Landscaping & Exterior Architecture',
    category: 'Local Business & Trades',
    badge: 'Multi-Page • Cost Estimator • Booking',
    favicon: '🌿',
    backgroundId: 'botanical',
    description: 'High-conversion landscaping & outdoor design website with services catalog, interactive instant cost estimator, before/after project gallery, and booking form.',
    html: `
<div class="living-bg-botanical"></div>

<header class="biz-header">
  <div class="biz-nav">
    <div class="biz-brand">
      <span class="leaf-icon">🌱</span>
      <span>Verdant<b>Craft</b> Landscaping</span>
    </div>
    <div class="biz-links">
      <button class="nav-btn active" data-view="home">Home</button>
      <button class="nav-btn" data-view="services">Services</button>
      <button class="nav-btn" data-view="estimator">Quote Estimator</button>
      <button class="nav-btn" data-view="gallery">Project Gallery</button>
      <button class="nav-btn" data-view="booking">Book Consultation</button>
    </div>
    <a href="#estimate" class="btn-cta" onclick="switchBizView('estimator')">Get Instant Estimate</a>
  </div>
</header>

<main class="biz-content">
  <!-- VIEW 1: HOME -->
  <section id="biz-home" class="biz-view active">
    <div class="biz-hero">
      <div class="hero-tagline">Architectural Outdoor Environments</div>
      <h1 contenteditable="true">Transforming Raw Earth into Living Architectural Sanctuaries</h1>
      <p contenteditable="true">Custom stone hardscaping, drought-tolerant native botanical design, automated irrigation, and ambient landscape illumination. Built for longevity.</p>
      <div class="hero-actions">
        <button class="btn-emerald" onclick="switchBizView('estimator')">Calculate Project Cost →</button>
        <button class="btn-outline" onclick="switchBizView('gallery')">View Past Transformations</button>
      </div>
      <div class="trust-banner">
        <span>⭐ 4.98 Rating (140+ Estates)</span>
        <span>🛡️ 10-Year Hardscape Guarantee</span>
        <span>💧 Water-Conservation Certified</span>
      </div>
    </div>

    <!-- Features Overview -->
    <div class="services-summary">
      <div class="service-box">
        <span class="s-icon">🗿</span>
        <h3 contenteditable="true">Precision Stonework</h3>
        <p contenteditable="true">Retaining walls, paver patios, natural bluestone terraces, and outdoor fire features engineered to perfection.</p>
      </div>
      <div class="service-box">
        <span class="s-icon">🌳</span>
        <h3 contenteditable="true">Botanical Architecture</h3>
        <p contenteditable="true">Curated perennial beds, specimen trees, and native pollinator gardens calibrated to your soil and microclimate.</p>
      </div>
      <div class="service-box">
        <span class="s-icon">💡</span>
        <h3 contenteditable="true">Atmospheric Lighting</h3>
        <p contenteditable="true">Low-voltage architectural brass uplighting and moonlit canopy fixtures that turn your estate into night art.</p>
      </div>
    </div>
  </section>

  <!-- VIEW 2: SERVICES DETAILED -->
  <section id="biz-services" class="biz-view">
    <h2 class="section-title">Comprehensive Exterior Capabilities</h2>
    <div class="services-full-list">
      <div class="service-detail-card">
        <h3>1. Complete Estate Master Planning</h3>
        <p contenteditable="true">Full 3D visualization and topographical analysis before moving a single shovel of earth. We analyze drainage, sun angles, and views.</p>
        <div class="price-pill">Typical Investment: $3,500 – $7,500 design phase</div>
      </div>
      <div class="service-detail-card">
        <h3>2. Hardscape & Masonry Terraces</h3>
        <p contenteditable="true">Dry-laid and mortared natural flagstone, permeable interlocking concrete pavers, custom outdoor kitchens, and seating walls.</p>
        <div class="price-pill">Typical Investment: $15,000 – $85,000</div>
      </div>
      <div class="service-detail-card">
        <h3>3. Smart Irrigation & Drainage Management</h3>
        <p contenteditable="true">Weather-calibrated smart drip manifolds, subterranean French drains, bioswales, and rain harvesting systems.</p>
        <div class="price-pill">Typical Investment: $4,500 – $14,000</div>
      </div>
    </div>
  </section>

  <!-- VIEW 3: INTERACTIVE COST ESTIMATOR -->
  <section id="biz-estimator" class="biz-view">
    <div class="estimator-card">
      <h2>Instant Project Estimator</h2>
      <p>Configure your estate dimensions and requirements to receive a real-time preliminary estimate.</p>
      
      <div class="form-group">
        <label>Property Area (Square Footage):</label>
        <input type="range" id="sqft-slider" min="500" max="15000" step="250" value="3000" oninput="updateEstimate()" />
        <span class="slider-display" id="sqft-display">3,000 sq ft</span>
      </div>

      <div class="checkbox-options">
        <label><input type="checkbox" id="opt-paver" checked onchange="updateEstimate()" /> Stone Paver Patio ($18/sq ft)</label>
        <label><input type="checkbox" id="opt-plants" checked onchange="updateEstimate()" /> Native Botanical Planting ($8/sq ft)</label>
        <label><input type="checkbox" id="opt-irrigation" onchange="updateEstimate()" /> Automated Smart Drip Irrigation ($4/sq ft)</label>
        <label><input type="checkbox" id="opt-lighting" onchange="updateEstimate()" /> Low-Voltage Ambient Illumination ($3,500 flat)</label>
        <label><input type="checkbox" id="opt-firepit" onchange="updateEstimate()" /> Built-In Natural Gas Fire Feature ($4,800 flat)</label>
      </div>

      <div class="estimate-result-box">
        <div class="result-label">Estimated Project Range:</div>
        <div class="result-value" id="estimate-output">$22,500 – $27,000</div>
        <p class="result-footnote">*Final quote determined after on-site topographic inspection and stone selection.</p>
        <button class="btn-emerald" onclick="switchBizView('booking')">Lock In This Estimate & Book Visit →</button>
      </div>
    </div>
  </section>

  <!-- VIEW 4: BEFORE / AFTER GALLERY -->
  <section id="biz-gallery" class="biz-view">
    <h2 class="section-title">Transformation Portfolio</h2>
    <div class="gallery-grid">
      <div class="gallery-card">
        <div class="img-placeholder" contenteditable="true">📸 [Drag & Drop Project Photo Here: Modern Stone Patio]</div>
        <h4>Highland Estate Renovation</h4>
        <p>Transformed a sloping mud hill into a three-tiered entertaining sanctuary with integrated gas fire pit.</p>
      </div>
      <div class="gallery-card">
        <div class="img-placeholder" contenteditable="true">📸 [Drag & Drop Project Photo Here: Native Botanical Garden]</div>
        <h4>Drought-Tolerant Meadow Sanctuary</h4>
        <p>Replaced 4,000 sq ft of high-water lawn with native grasses, lavender, and limestone walkways.</p>
      </div>
    </div>
  </section>

  <!-- VIEW 5: BOOKING -->
  <section id="biz-booking" class="biz-view">
    <div class="booking-card">
      <h2>Schedule Your On-Site Architectural Consultation</h2>
      <p>Meet with master designer Marcus Vance at your property for a comprehensive 60-minute site assessment.</p>
      <div class="booking-form">
        <input type="text" placeholder="Full Name..." id="book-name" />
        <input type="email" placeholder="Email Address..." id="book-email" />
        <input type="text" placeholder="Property Address / City..." id="book-address" />
        <select id="book-time">
          <option>Preferred Time: Morning (9:00 AM – 12:00 PM)</option>
          <option>Preferred Time: Afternoon (1:00 PM – 4:00 PM)</option>
          <option>Preferred Time: Sunset / Evening Walkthrough</option>
        </select>
        <button class="btn-emerald" onclick="submitBooking()">Confirm Consultation Request</button>
      </div>
    </div>
  </section>
</main>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #010d08; color: #f1f5f9; min-height: 100vh; }
      .biz-header { background: rgba(2, 23, 15, 0.85); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(16, 185, 129, 0.2); position: sticky; top: 0; z-index: 100; padding: 14px 24px; }
      .biz-nav { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
      .biz-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.15rem; color: #fff; }
      .leaf-icon { color: #10b981; font-size: 1.3rem; }
      .biz-brand b { color: #10b981; }
      .biz-links { display: flex; gap: 6px; }
      .nav-btn { background: transparent; border: none; color: #a7f3d0; font-size: 0.85rem; font-weight: 600; padding: 8px 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
      .nav-btn:hover { background: rgba(16, 185, 129, 0.15); color: #fff; }
      .nav-btn.active { background: #10b981; color: #02170f; font-weight: 700; box-shadow: 0 0 14px rgba(16, 185, 129, 0.4); }
      .btn-cta { background: #10b981; color: #02170f; font-weight: 700; font-size: 0.82rem; padding: 8px 18px; border-radius: 999px; text-decoration: none; transition: transform 0.2s; }
      .btn-cta:hover { transform: scale(1.05); }

      .biz-content { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
      .biz-view { display: none; }
      .biz-view.active { display: block; }

      .biz-hero { text-align: center; max-width: 800px; margin: 0 auto 50px; }
      .hero-tagline { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #10b981; letter-spacing: 2px; margin-bottom: 12px; }
      .biz-hero h1 { font-size: 2.5rem; line-height: 1.25; margin: 0 0 18px; color: #f8fafc; }
      .biz-hero p { font-size: 1.1rem; line-height: 1.6; color: #a7f3d0; margin: 0 0 28px; }
      .hero-actions { display: flex; justify-content: center; gap: 16px; margin-bottom: 30px; }
      .btn-emerald { background: #10b981; color: #010d08; font-weight: 700; padding: 12px 26px; border-radius: 8px; border: none; cursor: pointer; transition: transform 0.2s; }
      .btn-emerald:hover { transform: scale(1.04); }
      .btn-outline { background: transparent; border: 1px solid rgba(16, 185, 129, 0.4); color: #a7f3d0; font-weight: 600; padding: 12px 24px; border-radius: 8px; cursor: pointer; }
      .trust-banner { display: flex; justify-content: center; gap: 24px; font-size: 0.82rem; color: #6ee7b7; border-top: 1px solid rgba(16, 185, 129, 0.15); padding-top: 20px; }

      .services-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
      .service-box { background: rgba(2, 23, 15, 0.6); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 16px; padding: 28px; backdrop-filter: blur(8px); }
      .s-icon { font-size: 2.2rem; display: block; margin-bottom: 12px; }
      .service-box h3 { margin: 0 0 8px; color: #f8fafc; }
      .service-box p { margin: 0; color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }

      /* Estimator */
      .estimator-card, .booking-card { background: rgba(2, 23, 15, 0.7); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; padding: 36px; max-width: 650px; margin: 0 auto; backdrop-filter: blur(12px); }
      .form-group { margin: 24px 0; }
      .slider-display { display: block; font-size: 1.4rem; font-weight: 700; color: #10b981; font-family: monospace; margin-top: 8px; }
      #sqft-slider { width: 100%; accent-color: #10b981; }
      .checkbox-options { display: flex; flex-direction: column; gap: 12px; margin: 24px 0; font-size: 0.95rem; }
      .checkbox-options input { accent-color: #10b981; margin-right: 8px; }
      .estimate-result-box { background: rgba(1, 13, 8, 0.8); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 24px; text-align: center; margin-top: 24px; }
      .result-label { font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; }
      .result-value { font-size: 2.2rem; font-weight: 800; color: #10b981; font-family: monospace; margin: 6px 0; }
      .result-footnote { font-size: 0.75rem; color: #64748b; margin-bottom: 18px; }

      /* Gallery */
      .gallery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .gallery-card { background: rgba(2, 23, 15, 0.6); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 14px; padding: 20px; }
      .img-placeholder { height: 180px; background: rgba(1, 13, 8, 0.7); border: 2px dashed rgba(16, 185, 129, 0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: #6ee7b7; text-align: center; padding: 14px; margin-bottom: 14px; }

      /* Booking */
      .booking-form { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
      .booking-form input, .booking-form select { background: rgba(1, 13, 8, 0.8); border: 1px solid rgba(16, 185, 129, 0.3); color: #fff; padding: 12px 16px; border-radius: 8px; font-size: 0.92rem; }
    `,
    js: `
      window.switchBizView = function(viewId) {
        document.querySelectorAll('.biz-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const targetView = document.getElementById('biz-' + viewId);
        const targetBtn = document.querySelector('.nav-btn[data-view="' + viewId + '"]');
        if (targetView) targetView.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchBizView(btn.dataset.view));
      });

      window.updateEstimate = function() {
        const sqft = parseInt(document.getElementById('sqft-slider').value, 10);
        document.getElementById('sqft-display').textContent = sqft.toLocaleString() + ' sq ft';

        let ratePerSqft = 0;
        let flatCost = 0;

        if (document.getElementById('opt-paver').checked) ratePerSqft += 18;
        if (document.getElementById('opt-plants').checked) ratePerSqft += 8;
        if (document.getElementById('opt-irrigation').checked) ratePerSqft += 4;
        if (document.getElementById('opt-lighting').checked) flatCost += 3500;
        if (document.getElementById('opt-firepit').checked) flatCost += 4800;

        const base = (sqft * 0.35 * ratePerSqft) + flatCost;
        const low = Math.round(base * 0.9);
        const high = Math.round(base * 1.15);

        document.getElementById('estimate-output').textContent = 
          '$' + low.toLocaleString() + ' – $' + high.toLocaleString();
      };

      window.submitBooking = function() {
        const name = document.getElementById('book-name').value.trim();
        if (!name) { alert('Please enter your name.'); return; }
        alert('Thanks, ' + name + '! Online booking is not connected yet, so please contact us directly.');
        switchBizView('home');
      };
    `
  },

  // 5. Corporate Enterprise & Company Platform
  {
    id: 'corporate',
    name: 'Aetheria Dynamics — Enterprise Infrastructure',
    category: 'Enterprise & SaaS',
    badge: 'Multi-Page • 3-Tier Pricing • Stats',
    favicon: '🏢',
    backgroundId: 'blueprint',
    description: 'Corporate enterprise website with interactive statistics counters, solutions matrix, leadership dossier, 3-tier pricing matrix, and enterprise demo modal.',
    html: `
<div class="living-bg-blueprint"></div>

<header class="corp-header">
  <div class="corp-nav">
    <div class="corp-brand">
      <span class="corp-logo-badge">▲</span>
      <span>Aetheria<b>Dynamics</b></span>
    </div>
    <div class="corp-links">
      <button class="c-link active" data-page="home">Overview</button>
      <button class="c-link" data-page="solutions">Solutions</button>
      <button class="c-link" data-page="pricing">Pricing Matrix</button>
      <button class="c-link" data-page="leadership">Leadership</button>
      <button class="c-link" data-page="contact">Request Demo</button>
    </div>
    <button class="btn-corp" onclick="switchCorpPage('contact')">Enterprise Demo</button>
  </div>
</header>

<main class="corp-content">
  <!-- VIEW 1: HOME -->
  <section id="corp-home" class="corp-view active">
    <div class="corp-hero">
      <div class="corp-pill">Autonomous Infrastructure • Fortune 500 Ready</div>
      <h1 contenteditable="true">Mission-Critical AI Workstations for Uncompromised Enterprise Sovereignty</h1>
      <p contenteditable="true">Eliminate intellectual property exfiltration and cloud vendor lock-in. Aetheria provisions isolated, air-gapped neural compute nodes that execute within your internal perimeter.</p>
      
      <div class="corp-cta-group">
        <button class="btn-primary-corp" onclick="switchCorpPage('contact')">Schedule Architectural Briefing</button>
        <button class="btn-secondary-corp" onclick="switchCorpPage('solutions')">Explore System Architecture</button>
      </div>

      <!-- Live Counters -->
      <div class="kpi-banner">
        <div class="kpi-item">
          <b>99.999%</b>
          <span>Sovereign Uptime</span>
        </div>
        <div class="kpi-item">
          <b>0 KB</b>
          <span>External Data Leaks</span>
        </div>
        <div class="kpi-item">
          <b>4.8x</b>
          <span>ROI vs Cloud Tokens</span>
        </div>
        <div class="kpi-item">
          <b>14,000+</b>
          <span>Nodes Deployed</span>
        </div>
      </div>
    </div>
  </section>

  <!-- VIEW 2: SOLUTIONS -->
  <section id="corp-solutions" class="corp-view">
    <h2 class="corp-section-title">Enterprise Infrastructure Pillars</h2>
    <div class="solutions-grid">
      <div class="solution-card">
        <div class="sol-glyph">🛡️</div>
        <h3>Air-Gapped Vault Enclaves</h3>
        <p contenteditable="true">Hardware-isolated cryptographic key vaults ensuring model weights, codebases, and customer telemetry never traverse external networks.</p>
      </div>
      <div class="solution-card">
        <div class="sol-glyph">⚡</div>
        <h3>Distributed Inference Swarms</h3>
        <p contenteditable="true">Dynamic workload pooling across internal GPU clusters with automated failover and sub-millisecond local network latency.</p>
      </div>
      <div class="solution-card">
        <div class="sol-glyph">📊</div>
        <h3>Compliance & Web-of-Trust Attestation</h3>
        <p contenteditable="true">Full SOC2 Type II, HIPAA, and GDPR compliance out of the box through verifiable cryptographic audit logs.</p>
      </div>
    </div>
  </section>

  <!-- VIEW 3: PRICING MATRIX -->
  <section id="corp-pricing" class="corp-view">
    <div class="pricing-header">
      <h2>Transparent Enterprise Licensing</h2>
      <p>Perpetual node ownership. No monthly token tax.</p>
    </div>

    <div class="pricing-table">
      <div class="price-card">
        <div class="tier-name">Sovereign Pro</div>
        <div class="tier-price">$2,499<span>/ perpetual</span></div>
        <p>For independent engineering consultancies and boutique defense teams.</p>
        <ul class="features-list">
          <li>✓ Single Node Perpetual License</li>
          <li>✓ Offline Model Hypervisor</li>
          <li>✓ Local Code IDE & Literature Suite</li>
          <li>✓ Community Mesh Peering</li>
        </ul>
        <button class="btn-outline-corp" onclick="switchCorpPage('contact')">Acquire License</button>
      </div>

      <div class="price-card featured">
        <div class="pop-badge">Most Popular</div>
        <div class="tier-name">Enterprise Cluster</div>
        <div class="tier-price">$14,900<span>/ cluster</span></div>
        <p>For corporate engineering departments and enterprise teams up to 25 nodes.</p>
        <ul class="features-list">
          <li>✓ 25 Sovereign Node Fleet</li>
          <li>✓ Distributed Swarm GPU Pooling</li>
          <li>✓ Air-Gapped Blind Relay Vault</li>
          <li>✓ 24/7 Dedicated Architectural Support</li>
          <li>✓ Custom Model Distillation Pipeline</li>
        </ul>
        <button class="btn-primary-corp" onclick="switchCorpPage('contact')">Deploy Cluster</button>
      </div>

      <div class="price-card">
        <div class="tier-name">Government & Defense</div>
        <div class="tier-price">Custom Quote</div>
        <p>Custom air-gapped sovereign architectures with hardware tamper verification.</p>
        <ul class="features-list">
          <li>✓ Unlimited Node Fleet</li>
          <li>✓ Hardware Security Module (HSM) Binding</li>
          <li>✓ SCIF & Classified Environment Certified</li>
          <li>✓ Dedicated On-Premises Engineering Team</li>
        </ul>
        <button class="btn-outline-corp" onclick="switchCorpPage('contact')">Contact Defense Liaison</button>
      </div>
    </div>
  </section>

  <!-- VIEW 4: LEADERSHIP -->
  <section id="corp-leadership" class="corp-view">
    <h2 class="corp-section-title">Architectural Leadership</h2>
    <div class="team-grid">
      <div class="team-card">
        <div class="team-avatar">👨‍💼</div>
        <h4>Dillan Vance</h4>
        <div class="team-role">Chief Executive Architect</div>
        <p>Former autonomous defense systems lead. Pioneer of decentralized cryptographic operating system architecture.</p>
      </div>
      <div class="team-card">
        <div class="team-avatar">👩‍🔬</div>
        <h4>Dr. Maya Lin</h4>
        <div class="team-role">Head of Neural Research</div>
        <p>Specialist in low-bit model quantization, knowledge distillation, and local-first memory continuity.</p>
      </div>
    </div>
  </section>

  <!-- VIEW 5: CONTACT / DEMO -->
  <section id="corp-contact" class="corp-view">
    <div class="contact-card">
      <h2>Request Enterprise Demonstration</h2>
      <p>Experience an isolated 15-minute live demonstration of Aetheria Dynamics running inside an air-gapped perimeter.</p>
      <div class="contact-form">
        <input type="text" placeholder="Corporate Name..." id="corp-name" />
        <input type="email" placeholder="Work Email (no personal domains)..." id="corp-email" />
        <select id="corp-nodes">
          <option>Estimated Node Fleet: 5 – 25 Nodes</option>
          <option>Estimated Node Fleet: 25 – 100 Nodes</option>
          <option>Estimated Node Fleet: 100+ Enterprise Fleet</option>
        </select>
        <textarea placeholder="Describe your data isolation and model requirements..."></textarea>
        <button class="btn-primary-corp" onclick="submitDemo()">Dispatch Enterprise Request</button>
      </div>
    </div>
  </section>
</main>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #071328; color: #f1f5f9; min-height: 100vh; }
      .corp-header { background: rgba(7, 19, 40, 0.85); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(56, 189, 248, 0.18); position: sticky; top: 0; z-index: 100; padding: 14px 28px; }
      .corp-nav { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
      .corp-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.15rem; color: #fff; }
      .corp-logo-badge { color: #38bdf8; font-size: 1.2rem; }
      .corp-brand b { color: #38bdf8; }
      .corp-links { display: flex; gap: 6px; }
      .c-link { background: transparent; border: none; color: #94a3b8; font-size: 0.85rem; font-weight: 600; padding: 8px 14px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
      .c-link:hover { color: #38bdf8; background: rgba(56, 189, 248, 0.08); }
      .c-link.active { background: #38bdf8; color: #071328; font-weight: 700; }
      .btn-corp { background: #38bdf8; color: #071328; font-weight: 700; font-size: 0.82rem; padding: 8px 18px; border-radius: 6px; border: none; cursor: pointer; }

      .corp-content { max-width: 1050px; margin: 0 auto; padding: 40px 24px; }
      .corp-view { display: none; }
      .corp-view.active { display: block; }

      .corp-hero { text-align: center; max-width: 820px; margin: 0 auto 50px; }
      .corp-pill { display: inline-block; background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 14px; border-radius: 999px; margin-bottom: 16px; border: 1px solid rgba(56, 189, 248, 0.3); }
      .corp-hero h1 { font-size: 2.6rem; line-height: 1.25; margin: 0 0 20px; color: #f8fafc; }
      .corp-hero p { font-size: 1.1rem; line-height: 1.6; color: #94a3b8; margin: 0 0 32px; }
      .corp-cta-group { display: flex; justify-content: center; gap: 16px; margin-bottom: 40px; }
      .btn-primary-corp { background: #38bdf8; color: #071328; font-weight: 700; padding: 12px 28px; border-radius: 6px; border: none; cursor: pointer; transition: transform 0.2s; }
      .btn-primary-corp:hover { transform: scale(1.04); }
      .btn-secondary-corp, .btn-outline-corp { background: transparent; border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 600; padding: 12px 24px; border-radius: 6px; cursor: pointer; }

      .kpi-banner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; background: rgba(15, 30, 60, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 14px; padding: 24px; backdrop-filter: blur(10px); }
      .kpi-item b { display: block; font-size: 2rem; color: #38bdf8; font-family: monospace; }
      .kpi-item span { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; }

      /* Solutions */
      .solutions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 24px; }
      .solution-card { background: rgba(15, 30, 60, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 28px; }
      .sol-glyph { font-size: 2.2rem; margin-bottom: 14px; }
      .solution-card h3 { margin: 0 0 10px; color: #f8fafc; }
      .solution-card p { margin: 0; color: #94a3b8; line-height: 1.5; font-size: 0.92rem; }

      /* Pricing */
      .pricing-table { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 36px; }
      .price-card { background: rgba(15, 30, 60, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px 24px; position: relative; }
      .price-card.featured { border-color: #38bdf8; background: rgba(15, 30, 60, 0.85); box-shadow: 0 0 30px rgba(56, 189, 248, 0.2); }
      .pop-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #38bdf8; color: #071328; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; padding: 3px 12px; border-radius: 999px; }
      .tier-name { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; }
      .tier-price { font-size: 2.2rem; font-weight: 800; color: #38bdf8; font-family: monospace; margin-bottom: 12px; }
      .tier-price span { font-size: 0.85rem; color: #64748b; font-weight: normal; }
      .features-list { list-style: none; padding: 0; margin: 24px 0; font-size: 0.88rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 10px; }
      .price-card button { width: 100%; }

      /* Contact */
      .contact-card { max-width: 600px; margin: 0 auto; background: rgba(15, 30, 60, 0.6); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 36px; }
      .contact-form { display: flex; flex-direction: column; gap: 14px; margin-top: 24px; }
      .contact-form input, .contact-form select, .contact-form textarea { background: rgba(7, 19, 40, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 12px; border-radius: 6px; font-family: inherit; font-size: 0.9rem; }
      .contact-form textarea { min-height: 90px; }
    `,
    js: `
      window.switchCorpPage = function(pageId) {
        document.querySelectorAll('.corp-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.c-link').forEach(l => l.classList.remove('active'));
        const targetView = document.getElementById('corp-' + pageId);
        const targetLink = document.querySelector('.c-link[data-page="' + pageId + '"]');
        if (targetView) targetView.classList.add('active');
        if (targetLink) targetLink.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      document.querySelectorAll('.c-link').forEach(link => {
        link.addEventListener('click', () => switchCorpPage(link.dataset.page));
      });

      window.submitDemo = function() {
        const name = document.getElementById('corp-name').value.trim();
        if (!name) { alert('Please enter your company name.'); return; }
        alert('Thanks! This request form is not connected yet, so nothing was sent.');
        switchCorpPage('home');
      };
    `
  },

  // 6. Wiki & Technical Documentation
  {
    id: 'wiki',
    name: 'SovereignDocs — Technical Knowledge Base & Wiki',
    category: 'Documentation & Knowledge',
    badge: 'Multi-Page • Tree Hierarchy • Search',
    favicon: '📚',
    backgroundId: 'circuit',
    description: 'Structured documentation hub with tree hierarchy navigation, searchable glossary, code blocks with syntax highlighting, and callout alerts.',
    html: `
<div class="living-bg-circuit"></div>

<div class="wiki-layout">
  <!-- Left Tree Sidebar -->
  <aside class="wiki-sidebar">
    <div class="wiki-brand">
      <span>📖</span>
      <span>Sovereign<b>Docs</b></span>
    </div>
    <div class="wiki-search-box">
      <input type="text" id="wiki-filter" placeholder="Search documentation..." oninput="filterWiki()" />
    </div>

    <nav class="wiki-tree">
      <div class="tree-group-title">Getting Started</div>
      <button class="tree-item active" data-doc="intro" onclick="openDoc('intro')">Introduction & Ethos</button>
      <button class="tree-item" data-doc="install" onclick="openDoc('install')">Installation & Silicon Setup</button>
      
      <div class="tree-group-title">Core Architecture</div>
      <button class="tree-item" data-doc="mesh" onclick="openDoc('mesh')">P2P Sovereign Mesh Protocol</button>
      <button class="tree-item" data-doc="auth" onclick="openDoc('auth')">Sign in with NovAura (SIWN)</button>
      <button class="tree-item" data-doc="vault" onclick="openDoc('vault')">Encrypted Enclave Vault</button>

      <div class="tree-group-title">Developer & APIs</div>
      <button class="tree-item" data-doc="cybeni" onclick="openDoc('cybeni')">Cybeni Multi-Model IDE</button>
      <button class="tree-item" data-doc="benchmarks" onclick="openDoc('benchmarks')">Frontier AI Benchmarks (2026)</button>
    </nav>
  </aside>

  <!-- Main Documentation Content -->
  <main class="wiki-main">
    <div class="breadcrumbs">
      <span>Docs</span> / <span id="bc-group">Getting Started</span> / <b id="bc-title">Introduction & Ethos</b>
    </div>

    <!-- DOC 1: INTRO -->
    <article id="doc-intro" class="doc-page active">
      <h1 contenteditable="true">Introduction to Sovereign Decentralized Computing</h1>
      <p class="doc-lead" contenteditable="true">NovAura Sovereign OS redefines computing for the autonomous intelligence era. It combines a private local-first workstation with decentralized peer-to-peer mesh connectivity.</p>

      <div class="callout callout-tip">
        <b>💡 Core Principle:</b> You own the physical machine, the cryptographic keys, and the model weights. The OS refuses telemetry and cloud lock-in by design.
      </div>

      <h2 contenteditable="true">1. The Three Operating Pillars</h2>
      <p contenteditable="true">Traditional operating systems act as thin rental agents for centralized cloud corporations. Sovereign OS inverts this relationship:</p>
      
      <ul>
        <li><b>Self-Contained Private Vault:</b> IndexedDB and local filesystem hold all documents, contacts, and identities.</li>
        <li><b>Local Neural Inference:</b> Seamless integration with Ollama, LM Studio, and WebGPU for zero-latency AI execution.</li>
        <li><b>P2P Mesh Network:</b> Communicates across LAN and WAN via blind relays without needing ICANN domain names.</li>
      </ul>

      <div class="callout callout-warning">
        <b>⚠️ Cryptographic Responsibility:</b> Because there is no centralized password reset server, operators must maintain an encrypted backup of their master Ed25519 identity key.
      </div>
    </article>

    <!-- DOC 2: MESH PROTOCOL -->
    <article id="doc-mesh" class="doc-page">
      <h1 contenteditable="true">P2P Sovereign Mesh Protocol Specification</h1>
      <p class="doc-lead" contenteditable="true">The Sovereign Mesh enables direct machine-to-machine communication across arbitrary subnets with automatic NAT traversal.</p>

      <div class="code-block">
        <pre><code>// Example: Dispatching a verified mesh packet
await sendDirectMeshPacket(targetPeerDid, 'MESH_MAIL', {
  recipientDid: targetPeerDid,
  ciphertext: encryptedEnvelopeHex,
  senderSignature: ed25519SignatureHex
});</code></pre>
      </div>

      <h2 contenteditable="true">Dual Faction Addressing</h2>
      <p contenteditable="true">Addresses on the mesh resolve automatically via built-in sovereign registries:</p>
      <ul>
        <li><code>nova://domain.nova</code> — Nova Logic & Structured Systems</li>
        <li><code>aura://domain.aura</code> — Aura Creative Synthesis & Exploration</li>
      </ul>
    </article>
  </main>
</div>
`,
    css: `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #030712; color: #f1f5f9; height: 100vh; overflow: hidden; }
      .wiki-layout { display: flex; height: 100vh; width: 100vw; }
      
      .wiki-sidebar { width: 280px; background: rgba(7, 12, 26, 0.9); border-right: 1px solid rgba(255, 255, 255, 0.08); padding: 20px 16px; display: flex; flex-direction: column; overflow-y: auto; }
      .wiki-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.15rem; margin-bottom: 16px; }
      .wiki-brand b { color: #00f0ff; }
      .wiki-search-box input { width: 100%; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; outline: none; margin-bottom: 20px; }
      .wiki-search-box input:focus { border-color: #00f0ff; }

      .tree-group-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 16px 0 6px 8px; }
      .tree-item { background: transparent; border: none; color: #94a3b8; font-size: 0.88rem; padding: 7px 12px; border-radius: 6px; text-align: left; cursor: pointer; transition: all 0.2s; width: 100%; }
      .tree-item:hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
      .tree-item.active { background: rgba(0, 240, 255, 0.15); color: #00f0ff; font-weight: 700; border-left: 2px solid #00f0ff; }

      .wiki-main { flex: 1; padding: 36px 48px; overflow-y: auto; max-width: 900px; }
      .breadcrumbs { font-size: 0.8rem; color: #64748b; margin-bottom: 24px; }
      .breadcrumbs b { color: #00f0ff; }
      
      .doc-page { display: none; }
      .doc-page.active { display: block; animation: fadeIn 0.25s ease; }
      .doc-page h1 { font-size: 2.2rem; line-height: 1.25; margin: 0 0 16px; }
      .doc-lead { font-size: 1.1rem; line-height: 1.6; color: #cbd5e1; margin-bottom: 28px; }
      .doc-page h2 { margin-top: 32px; font-size: 1.4rem; color: #f8fafc; }
      .doc-page p { line-height: 1.65; color: #94a3b8; font-size: 0.95rem; }
      .doc-page ul { line-height: 1.8; color: #cbd5e1; padding-left: 24px; }

      .callout { padding: 16px 20px; border-radius: 10px; margin: 24px 0; font-size: 0.9rem; line-height: 1.5; }
      .callout-tip { background: rgba(0, 240, 255, 0.1); border-left: 4px solid #00f0ff; color: #e0f2fe; }
      .callout-warning { background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; color: #fef3c7; }

      .code-block { background: #050814; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; margin: 20px 0; font-family: monospace; font-size: 0.85rem; overflow-x: auto; color: #38bdf8; }
    `,
    js: `
      window.openDoc = function(docId) {
        document.querySelectorAll('.doc-page').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
        const targetDoc = document.getElementById('doc-' + docId);
        const targetItem = document.querySelector('.tree-item[data-doc="' + docId + '"]');
        if (targetDoc) targetDoc.classList.add('active');
        if (targetItem) targetItem.classList.add('active');
        document.getElementById('bc-title').textContent = targetItem ? targetItem.textContent : docId;
      };

      window.filterWiki = function() {
        const q = document.getElementById('wiki-filter').value.toLowerCase();
        document.querySelectorAll('.tree-item').forEach(item => {
          item.style.display = item.textContent.toLowerCase().includes(q) ? 'block' : 'none';
        });
      };
    `
  }
];

export function getTemplateById(id) {
  return MULTIPAGE_TEMPLATES.find(t => t.id === id) || MULTIPAGE_TEMPLATES[0];
}

export function buildCompleteTemplateDocument(template, customBackgroundId = null) {
  const bgId = customBackgroundId || template.backgroundId || 'aurora';
  const livingBg = LIVING_BACKGROUNDS[bgId] || LIVING_BACKGROUNDS.aurora;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${template.name}</title>
  <style>
    ${livingBg.css}
    ${template.css}
  </style>
</head>
<body>
  ${template.html}
  <script>
    ${template.js}
  </script>
</body>
</html>`;
}
