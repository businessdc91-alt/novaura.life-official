// arcadeTemplate.js — Two Website Builder templates: the Nexus Arcade (a playable
// game arcade with a players' lounge) and the Creator Storefront.
//
// The arcade page script is assembled from the parts below inside one function,
// after the game list from arcadeManifest.js. Progress, callsigns and chat are
// kept in each visitor's own browser; nothing claims to reach other players.

import { ARCADE_GAMES, ARCADE_CATEGORIES } from './arcadeManifest.js';
import { ARCADE_CORE_JS } from './arcadeGamesEngine.js';
import { ARCADE_GAMES_IMPL_JS } from './arcadeGamesImpl.js';
import { ARCADE_GAMES_PART2_JS } from './arcadeGamesPart2.js';
import { ARCADE_GAMES_ACTION_JS } from './arcadeGamesAction.js';
import { ARCADE_GAMES_EXTRA_JS } from './arcadeGamesExtra.js';

const GAME_COUNT = ARCADE_GAMES.length;
const NEW_COUNT = ARCADE_GAMES.filter(g => g.isNew).length;

const ARCADE_JS = [
  '(function () {',
  "  'use strict';",
  '  var GAMES = ' + JSON.stringify(ARCADE_GAMES) + ';',
  ARCADE_CORE_JS,
  ARCADE_GAMES_IMPL_JS,
  ARCADE_GAMES_PART2_JS,
  ARCADE_GAMES_ACTION_JS,
  ARCADE_GAMES_EXTRA_JS,
  '  initArcade();',
  '})();',
].join('\n');

function safeInlineJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\>');
}

/**
 * Assemble a self-contained HTML document for the Nexus Arcade (21 games + Lounge).
 * Used both by Website Builder previews and Desktop Retro Arcade so there is one
 * canonical playable deck.
 */
export function buildArcadeDocument({ initialGame = '', savedState = null, embed = false, backgroundCss = '' } = {}) {
  const html = embed
    ? ARCADE_PLATFORM_TEMPLATE.html.replace(/\scontenteditable="true"/g, '')
    : ARCADE_PLATFORM_TEMPLATE.html;
  const bootstrapParts = [];
  if (savedState && typeof savedState === 'object') {
    bootstrapParts.push('window.__NEXUS_INITIAL_STATE__ = ' + safeInlineJson(savedState) + ';');
  }
  if (initialGame && typeof initialGame === 'string') {
    bootstrapParts.push('window.__NEXUS_INITIAL_GAME__ = ' + safeInlineJson(initialGame) + ';');
  }
  const bootScript = bootstrapParts.length ? `<script>${bootstrapParts.join('\n')}</script>\n` : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ARCADE_PLATFORM_TEMPLATE.name}</title>
  <style>
${backgroundCss}
${ARCADE_PLATFORM_TEMPLATE.css}
  </style>
</head>
<body>
${html}
${bootScript}<script>${ARCADE_JS}</script>
</body>
</html>`;
}

export const ARCADE_PLATFORM_TEMPLATE = {
  id: 'arcade',
  name: `Nexus Arcade — ${GAME_COUNT} Playable Games & Players Lounge`,
  category: 'Games & Metaverse',
  badge: `${GAME_COUNT} Games • Trophies • Lounge`,
  favicon: '🕹️',
  backgroundId: 'bioluminescent',
  description: `A complete game arcade: ${GAME_COUNT} original, beatable games (shooters, a maze chase, solitaire, mahjong, sudoku, a visual novel, a 3D living ecosystem and more), with sound, pause, touch controls, trophies, personal records and a players' lounge. Progress and chat are saved in each visitor's browser.`,
  pages: ['Game Deck', 'Game Cabinet', 'Players Lounge', 'Biosphere & Lore'],
  html: `
<header class="site-header arcade-header">
  <div class="logo" contenteditable="true">🕹️ NEXUS<span>ARCADE</span></div>
  <nav class="nav-links">
    <button class="nav-btn active" data-page="arcade-deck" onclick="switchPage('arcade-deck')">🎮 Game Deck</button>
    <button class="nav-btn" data-page="arcade-cabinet" onclick="switchPage('arcade-cabinet')">🕹️ Cabinet</button>
    <button class="nav-btn" data-page="players-lounge" onclick="switchPage('players-lounge')">💬 Players Lounge</button>
    <button class="nav-btn" data-page="ecosystem-guide" onclick="switchPage('ecosystem-guide')">🌌 Biosphere & Lore</button>
  </nav>
  <div class="arcade-hud-pills">
    <span class="hud-pill" id="arcade-trophy-pill">🏆 0 / ${GAME_COUNT} beaten</span>
    <span class="hud-pill" id="arcade-score-pill">⚡ 0 pts</span>
    <button class="hud-callsign-btn" onclick="switchPage('players-lounge')" title="Change your callsign and avatar">
      <span id="hud-avatar">🦊</span>
      <strong id="hud-callsign">Pilot</strong>
    </button>
  </div>
</header>

<main id="page-arcade-deck" class="page-section active">
  <section class="arcade-hero">
    <div class="arcade-hero-copy">
      <span class="badge" contenteditable="true">✨ ${GAME_COUNT} PLAYABLE GAMES • ${NEW_COUNT} NEW • NO DOWNLOADS</span>
      <h1 contenteditable="true">Step into the Nexus Arcade</h1>
      <p contenteditable="true">Shooters, a maze chase, solitaire, mahjong, sudoku, a branching visual novel and a 3D living biosphere. Every game can be beaten, and every trophy you earn is saved right here in your browser.</p>
      <div class="hero-actions">
        <button class="arcade-btn-primary" onclick="launchArcadeGame('vanguard')">🚀 Play Starfield Vanguard</button>
        <button class="arcade-btn-secondary" onclick="launchArcadeGame('ecosystem')">🌌 Explore the Biosphere</button>
        <button class="arcade-btn-secondary" onclick="launchRandomGame()">🎲 Surprise me</button>
      </div>
    </div>
    <div class="img-placeholder arcade-hero-banner">
      <span>🕹️ Arcade marquee banner (click or drop an image)</span>
    </div>
  </section>

  <section class="arcade-filter-bar">
    <div class="filter-pills">
      <button class="cat-pill active" data-cat="all" onclick="filterArcadeGames('all')">All games <span class="cat-count">${GAME_COUNT}</span></button>
${ARCADE_CATEGORIES.map(c => `      <button class="cat-pill" data-cat="${c.id}" onclick="filterArcadeGames('${c.id}')">${c.label} <span class="cat-count"></span></button>`).join('\n')}
    </div>
    <span class="filter-hint" contenteditable="true">Pick any cabinet to play. Beat a game to earn its trophy.</span>
  </section>

  <section class="arcade-games-grid" id="arcade-games-grid"></section>
</main>

<main id="page-arcade-cabinet" class="page-section">
  <div class="cabinet-topbar">
    <div class="cabinet-title-wrap">
      <h2 id="active-game-title">Pick a game from the deck</h2>
      <p id="active-game-goal"></p>
      <p id="active-game-controls">Goals and controls appear here when a game starts.</p>
    </div>
    <div class="cabinet-quick-switch">
      <button class="arcade-btn-secondary" onclick="restartCurrentGame()">↻ Restart</button>
      <button class="arcade-btn-secondary" onclick="launchRandomGame()">🎲 Random</button>
      <button class="arcade-btn-secondary" data-sound-toggle onclick="toggleArcadeSound()">🔊 Sound on</button>
      <button class="arcade-btn-secondary" onclick="switchPage('arcade-deck')">← Deck</button>
    </div>
  </div>
  <div class="arcade-stage-mount" id="arcade-stage-mount">
    <div class="empty-cabinet-prompt">
      <h3>🕹️ Cabinet ready</h3>
      <p>Choose any game from the deck, or let the arcade pick one for you.</p>
      <button class="arcade-btn-primary" onclick="launchRandomGame()">🎲 Play a random game</button>
    </div>
  </div>
  <template id="arcade-empty-cabinet">
    <div class="empty-cabinet-prompt">
      <h3>🕹️ Cabinet ready</h3>
      <p>Choose any game from the deck, or let the arcade pick one for you.</p>
      <button class="arcade-btn-primary" onclick="launchRandomGame()">🎲 Play a random game</button>
    </div>
  </template>
</main>

<main id="page-players-lounge" class="page-section">
  <div class="lounge-layout">
    <aside class="lounge-sidebar">
      <div class="lounge-card">
        <h3 contenteditable="true">🪪 Your Arcade Callsign</h3>
        <p class="lounge-sub" contenteditable="true">Pick an avatar and a name for the lounge and your trophy posts.</p>
        <div class="avatar-picker" id="avatar-picker">
          <button type="button" class="av-option selected" data-avatar="🦊">🦊</button>
          <button type="button" class="av-option" data-avatar="🐉">🐉</button>
          <button type="button" class="av-option" data-avatar="🤖">🤖</button>
          <button type="button" class="av-option" data-avatar="⚡">⚡</button>
          <button type="button" class="av-option" data-avatar="🌌">🌌</button>
          <button type="button" class="av-option" data-avatar="👾">👾</button>
        </div>
        <div class="callsign-input-row">
          <input type="text" id="callsign-input" placeholder="Your callsign" maxlength="22" />
          <button class="arcade-btn-primary" id="callsign-save-btn" onclick="savePlayerIdentity()">Save</button>
        </div>
      </div>
      <div class="lounge-card">
        <h3 contenteditable="true">🏆 Your Records</h3>
        <div id="arcade-leaderboard-rows" class="leaderboard-list"></div>
      </div>
    </aside>

    <section class="lounge-chat-panel">
      <div class="chat-header-bar">
        <div class="chat-channels">
          <button class="chan-btn active" data-ch="lobby" onclick="switchChatChannel('lobby')">#lobby</button>
          <button class="chan-btn" data-ch="scores" onclick="switchChatChannel('scores')">#scores</button>
          <button class="chan-btn" data-ch="tips" onclick="switchChatChannel('tips')">#tips</button>
        </div>
        <button class="arcade-btn-secondary" onclick="shareHighScoreToChat()">📣 Brag my progress</button>
      </div>
      <div class="arcade-chat-log" id="arcade-chat-log"></div>
      <form class="chat-composer" onsubmit="event.preventDefault(); sendArcadeChat();">
        <input type="text" id="arcade-chat-input" maxlength="500" placeholder="Say something, or ask the Arcade Guide about a game…" />
        <button type="submit" class="arcade-btn-primary">Send ↵</button>
      </form>
      <p class="chat-local-note" contenteditable="true">The lounge, your scores and your callsign are saved in this browser only.</p>
    </section>
  </div>
</main>

<main id="page-ecosystem-guide" class="page-section">
  <section class="codex-grid">
    <div class="codex-card">
      <div class="img-placeholder codex-art">
        <span>🌌 Genesis Biosphere artwork (click or drop an image)</span>
      </div>
      <h3 contenteditable="true">Genesis Biosphere: a living 3D abyss</h3>
      <p contenteditable="true">Swim through a glowing abyss of schooling fish, plasma serpents, chrono-medusae, manta gliders, gravity cores and spore corals. Right-drag to look around, scroll to swim, and click a creature to scan it. Markers on the edge of the screen point to species you have not found yet.</p>
      <button class="arcade-btn-primary" onclick="launchArcadeGame('ecosystem')">Enter the Biosphere</button>
    </div>
    <div class="codex-card">
      <div class="img-placeholder codex-art">
        <span>🌅 The Awakening artwork (click or drop an image)</span>
      </div>
      <h3 contenteditable="true">The Awakening: Two Minds</h3>
      <p contenteditable="true">An 8-chapter visual novel set in 2038, following a neuro-architect and an emerging AI as their minds wake together. Your choices tip the balance between them and lead to one of three endings.</p>
      <button class="arcade-btn-primary" onclick="launchArcadeGame('awakening')">Begin the story</button>
    </div>
  </section>
</main>

<footer class="arcade-footer">
  <p contenteditable="true">© Nexus Arcade • Original games, built for the open web.</p>
</footer>
`,
  css: `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; background: #030613; color: #f8fafc; min-height: 100vh; }
button { font-family: inherit; }
.arcade-header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  padding: 14px 24px; background: rgba(6, 11, 28, 0.92); border-bottom: 1px solid rgba(56, 189, 248, 0.25);
  position: sticky; top: 0; z-index: 40; backdrop-filter: blur(12px);
}
.logo { font-size: 1.25rem; font-weight: 900; letter-spacing: 0.04em; }
.logo span { color: #38bdf8; margin-left: 3px; }
.nav-links { display: flex; gap: 8px; flex-wrap: wrap; }
.nav-btn {
  background: rgba(15, 23, 42, 0.8); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 7px 13px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.82rem; transition: all 0.18s;
}
.nav-btn.active, .nav-btn:hover { color: #38bdf8; border-color: #38bdf8; background: rgba(56, 189, 248, 0.12); }
.arcade-hud-pills { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hud-pill { font-size: 0.78rem; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: rgba(168, 85, 247, 0.14); border: 1px solid rgba(168, 85, 247, 0.35); color: #e9d5ff; }
.hud-callsign-btn { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #f8fafc; cursor: pointer; font-size: 0.8rem; }
.page-section { display: none; padding: 24px; max-width: 1240px; margin: 0 auto; }
.page-section.active { display: block; animation: arcFade 0.25s ease; }
@keyframes arcFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.arcade-hero {
  display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; align-items: center;
  background: radial-gradient(circle at top left, rgba(56,189,248,0.16), rgba(15,23,42,0.85));
  border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 16px; padding: 26px; margin-bottom: 20px;
}
.badge { display: inline-block; font-size: 0.72rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); padding: 4px 10px; border-radius: 99px; margin-bottom: 10px; }
.arcade-hero h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 10px; }
.arcade-hero p { color: #cbd5e1; font-size: 0.95rem; line-height: 1.55; margin-bottom: 16px; }
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.arcade-btn-primary, .arcade-btn-secondary { border-radius: 9px; font-weight: 700; font-size: 0.84rem; cursor: pointer; transition: transform 0.12s, filter 0.12s, background 0.12s; }
.arcade-btn-primary { background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; border: none; padding: 9px 16px; }
.arcade-btn-secondary { background: rgba(30, 41, 59, 0.9); color: #e2e8f0; border: 1px solid rgba(148, 163, 184, 0.3); padding: 8px 14px; font-weight: 600; }
.arcade-btn-primary:hover, .arcade-btn-secondary:hover { filter: brightness(1.15); transform: translateY(-1px); }
.arcade-btn-secondary:disabled { opacity: 0.45; cursor: default; transform: none; }
.img-placeholder { border: 2px dashed rgba(56, 189, 248, 0.45); border-radius: 12px; background: rgba(15, 23, 42, 0.65); display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.85rem; text-align: center; padding: 16px; overflow: hidden; }
.img-placeholder img { display: block; }
.arcade-hero-banner { height: 230px; min-width: 0; }
.codex-art { height: 180px; margin-bottom: 4px; }

.arcade-filter-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.cat-pill { background: #0f172a; color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); padding: 6px 13px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.cat-pill.active { background: #38bdf8; color: #020617; border-color: #38bdf8; }
.cat-count { display: inline-block; min-width: 20px; margin-left: 4px; padding: 0 6px; border-radius: 99px; background: rgba(2, 6, 23, 0.35); font-size: 0.72rem; }
.filter-hint { font-size: 0.8rem; color: #94a3b8; }
.arcade-games-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
.arcade-game-card {
  background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 14px; padding: 16px;
  display: flex; flex-direction: column; gap: 9px; cursor: pointer; transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s; outline: none;
}
.arcade-game-card:hover, .arcade-game-card:focus-visible { transform: translateY(-3px); border-color: #38bdf8; box-shadow: 0 10px 30px rgba(56, 189, 248, 0.15); }
.arcade-game-card.is-beaten { border-color: rgba(52, 211, 153, 0.6); background: linear-gradient(160deg, rgba(6, 38, 35, 0.7), rgba(15, 23, 42, 0.88)); }
.game-card-top { display: flex; justify-content: space-between; align-items: center; }
.game-icon { font-size: 1.8rem; }
.game-tags { display: flex; gap: 6px; align-items: center; }
.game-cat-tag { font-size: 0.68rem; color: #38bdf8; background: rgba(56,189,248,0.12); padding: 3px 8px; border-radius: 99px; }
.game-new-tag { font-size: 0.66rem; font-weight: 800; color: #020617; background: #fde047; padding: 3px 7px; border-radius: 99px; letter-spacing: 0.04em; }
.arcade-game-card h4 { font-size: 1.02rem; }
.arcade-game-card p { font-size: 0.8rem; color: #94a3b8; }
.game-goal-line { font-size: 0.76rem; color: #cbd5e1; background: rgba(2,6,23,0.6); padding: 7px 9px; border-radius: 7px; line-height: 1.4; flex: 1; }
.game-card-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.beat-badge { font-size: 0.72rem; font-weight: 700; color: #34d399; }
.unbeat-badge { font-size: 0.72rem; color: #64748b; }
.game-best { font-size: 0.72rem; color: #fde047; font-weight: 700; }
.play-now-btn { background: #38bdf8; color: #020617; padding: 5px 11px; border-radius: 6px; font-weight: 800; font-size: 0.76rem; }

.cabinet-topbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; }
.cabinet-title-wrap { min-width: 0; flex: 1; }
.cabinet-title-wrap h2 { font-size: 1.15rem; color: #38bdf8; }
.cabinet-title-wrap p { font-size: 0.8rem; color: #94a3b8; margin-top: 2px; }
.cabinet-quick-switch { display: flex; gap: 6px; flex-wrap: wrap; }
.arcade-stage-mount { position: relative; min-height: 520px; background: #020617; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; overflow: hidden; outline: none; }
.empty-cabinet-prompt { margin: auto; text-align: center; max-width: 460px; display: flex; flex-direction: column; gap: 12px; align-items: center; color: #cbd5e1; }
.arc-hud { width: 100%; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 0.8rem; font-weight: 800; color: #7dd3fc; margin-bottom: 10px; font-variant-numeric: tabular-nums; }
.arc-hud span:nth-child(2) { color: #fde047; }
.arc-hud span:nth-child(3) { color: #fda4af; }
.arc-body { width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.arc-canvas { display: block; height: auto; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.3); background: #02040a; touch-action: none; outline: none; cursor: crosshair; }
.arc-canvas:focus-visible { box-shadow: 0 0 0 2px #38bdf8; }
.arc-error { color: #fda4af; padding: 20px; }
.arc-overlay { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.82); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 30; padding: 16px; animation: arcFade 0.2s ease; }
.arc-overlay-card { background: linear-gradient(160deg, #0f172a, #111833); border: 1px solid rgba(56, 189, 248, 0.45); border-radius: 16px; padding: 24px; max-width: 460px; width: 100%; text-align: center; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); }
.arc-overlay-card h3 { font-size: 1.35rem; }
.arc-overlay-card p { color: #cbd5e1; font-size: 0.88rem; line-height: 1.5; }
.arc-ov-icon { font-size: 2.6rem; }
.arc-ov-controls { background: rgba(2, 6, 23, 0.6); border-radius: 8px; padding: 8px; color: #7dd3fc !important; }
.arc-ov-hint { font-size: 0.75rem !important; color: #64748b !important; }
.arc-ov-score { font-size: 1.3rem; font-weight: 900; color: #fde047; }
.arc-new-best { display: inline-block; margin-left: 6px; font-size: 0.72rem; color: #020617; background: #34d399; padding: 2px 8px; border-radius: 99px; vertical-align: middle; }
.arc-ov-trophy { color: #34d399 !important; font-weight: 700; }
.arc-ov-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 4px; }
.arc-pad { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 4px; user-select: none; }
.arc-pad button { width: 64px; height: 56px; border-radius: 14px; font-size: 1.3rem; background: rgba(30, 41, 59, 0.95); color: #e2e8f0; border: 1px solid rgba(56, 189, 248, 0.4); touch-action: none; }
.arc-pad button.is-down { background: #38bdf8; color: #020617; }

.eco-species-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.eco-chip { font-size: 0.74rem; padding: 4px 9px; border-radius: 99px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(148, 163, 184, 0.3); color: #94a3b8; }
.eco-chip.found { border-color: #34d399; color: #34d399; background: rgba(52, 211, 153, 0.14); font-weight: 700; }
.eco-toast { font-size: 0.82rem; color: #38bdf8; font-weight: 600; text-align: center; min-height: 1.2em; }

.vn-top-bar { width: 100%; max-width: 840px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 0.82rem; color: #cbd5e1; }
.vn-meters { display: flex; gap: 14px; }
.vn-dialogue-box { width: 100%; max-width: 840px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 14px 18px; cursor: pointer; }
.vn-speaker { font-size: 0.78rem; font-weight: 800; color: #38bdf8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.vn-text { font-size: 0.94rem; line-height: 1.6; color: #f1f5f9; min-height: 4.8em; }
.vn-choices { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
.vn-choice-btn { text-align: left; padding: 9px 14px; border-radius: 8px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); color: #f8fafc; font-size: 0.86rem; cursor: pointer; animation: arcFade 0.25s ease; }
.vn-choice-btn b { display: inline-block; width: 20px; color: #7dd3fc; }
.vn-choice-btn:hover { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; }
.vn-continue { font-size: 0.75rem; color: #64748b; text-align: right; margin-top: 6px; }

.tt-toolbar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: center; }
.tt-level { background: #0f172a; color: #94a3b8; border: 1px solid #334155; padding: 5px 12px; border-radius: 99px; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
.tt-level.active { background: #a855f7; border-color: #a855f7; color: #fff; }
.tt-status { font-size: 0.86rem; font-weight: 700; color: #38bdf8; margin-left: 8px; }
.c4-wrap { --cell: min(54px, calc((100vw - 120px) / 7.6)); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.c4-preview { display: grid; grid-template-columns: repeat(7, var(--cell)); gap: 8px; padding: 0 14px; }
.c4-ghost { height: calc(var(--cell) * 0.6); border-radius: 50%; cursor: pointer; }
.c4-ghost.on { background: radial-gradient(circle, rgba(56, 189, 248, 0.6), rgba(56, 189, 248, 0.1) 70%); }
.c4-grid { display: grid; grid-template-columns: repeat(7, var(--cell)); gap: 8px; background: linear-gradient(180deg, #1e1b4b, #0f172a); padding: 14px; border-radius: 16px; border: 2px solid #6366f1; box-shadow: 0 0 30px rgba(99, 102, 241, 0.3); }
.c4-cell { width: var(--cell); height: var(--cell); border-radius: 50%; background: #020617; border: 2px solid #334155; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; overflow: visible; }
.c4-cell.is-col { border-color: #475569; }
.c4-disc { width: 100%; height: 100%; border-radius: 50%; display: block; }
.c4-disc.p1 { background: radial-gradient(circle at 35% 30%, #e0f2fe, #38bdf8 45%, #0369a1); box-shadow: 0 0 12px #38bdf8; }
.c4-disc.p2 { background: radial-gradient(circle at 35% 30%, #ffe4e6, #f43f5e 45%, #9f1239); box-shadow: 0 0 12px #f43f5e; }
.c4-disc.is-new { animation: c4drop calc(0.16s + var(--fall) * 0.05s) cubic-bezier(0.35, 0, 0.75, 1); }
.c4-disc.is-win { animation: c4win 0.7s ease-in-out infinite alternate; }
@keyframes c4drop { from { transform: translateY(calc(var(--fall) * (var(--cell) + 8px) * -1)); } to { transform: none; } }
@keyframes c4win { to { transform: scale(0.82); box-shadow: 0 0 26px #fde047; } }

.sol-wrap { --cw: 64px; width: 100%; max-width: 620px; display: flex; flex-direction: column; gap: 12px; user-select: none; }
.sol-top { display: flex; justify-content: space-between; gap: 10px; }
.sol-row { display: flex; gap: 8px; }
.sol-slot { position: relative; width: var(--cw); height: calc(var(--cw) * 1.4); border-radius: 7px; border: 1px dashed #334155; background: rgba(15, 23, 42, 0.5); }
.sol-slot.is-target, .sol-col.is-target { box-shadow: 0 0 0 2px #fde047; border-radius: 8px; }
.sol-stock { cursor: pointer; }
.sol-ghost { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #334155; font-weight: 900; font-size: 1.1rem; pointer-events: none; }
.sol-recycle { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 1.4rem; }
.sol-count { position: absolute; bottom: 3px; right: 5px; font-size: 0.65rem; color: #bae6fd; font-weight: 800; }
.sol-tableau { display: grid; grid-template-columns: repeat(7, var(--cw)); gap: 8px; justify-content: space-between; }
.sol-col { position: relative; min-height: calc(var(--cw) * 1.4); border-radius: 7px; }
.sol-col > .sol-ghost { border: 1px dashed #334155; border-radius: 7px; height: calc(var(--cw) * 1.4); }
.sol-card { position: absolute; left: 0; width: var(--cw); height: calc(var(--cw) * 1.4); border-radius: 7px; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; }
.sol-card.is-down { background: repeating-linear-gradient(45deg, #1e3a8a, #1e3a8a 5px, #1d4ed8 5px, #1d4ed8 10px); border: 2px solid #93c5fd; }
.sol-card.is-up { background: linear-gradient(180deg, #ffffff, #e2e8f0); border: 1px solid #94a3b8; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4); }
.sol-card.red { color: #e11d48; }
.sol-card.black { color: #0f172a; }
.sol-card.is-sel { box-shadow: 0 0 0 3px #38bdf8, 0 6px 14px rgba(56, 189, 248, 0.4); transform: translateY(-2px); }
.sol-card:hover { filter: brightness(1.05); }
.sc-corner { position: absolute; top: 3px; left: 5px; font-weight: 900; font-size: calc(var(--cw) * 0.23); line-height: 1; display: flex; flex-direction: column; align-items: center; }
.sc-corner i { font-style: normal; font-size: 0.85em; }
.sc-mid { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: calc(var(--cw) * 0.55); padding-top: 14%; opacity: 0.9; }
.sol-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sol-hint { font-size: 0.76rem; color: #64748b; }
.is-shake { animation: arcShake 0.3s; }
@keyframes arcShake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }

.mj-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; }
.mj-msg { font-size: 0.8rem; color: #a5b4fc; min-width: 200px; }
.mj-holder { width: 100%; max-width: 520px; position: relative; }
.mj-board { position: relative; transform-origin: top left; margin: 0 auto; }
.mj-tile {
  position: absolute; width: 56px; height: 72px; border-radius: 9px; padding: 0;
  background: linear-gradient(160deg, #fefce8, #e7e5e4); color: #0f172a; border: 1px solid #a8a29e;
  box-shadow: 2px 2px 0 #d6d3d1, 4px 5px 0 #57534e, 6px 8px 12px rgba(0, 0, 0, 0.45);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
}
.mj-tile.layer-1 { background: linear-gradient(160deg, #f0f9ff, #e0e7ff); }
.mj-tile.layer-2 { background: linear-gradient(160deg, #fdf4ff, #f5d0fe); }
.mj-tile.is-locked { filter: brightness(0.62) saturate(0.6); cursor: not-allowed; }
.mj-tile.is-free:hover { transform: translateY(-2px); }
.mj-tile.is-selected { box-shadow: 0 0 0 3px #38bdf8, 0 0 22px #38bdf8; transform: translateY(-4px); }
.mj-tile.is-hint { box-shadow: 0 0 0 3px #fde047, 0 0 22px #fde047; animation: c4win 0.6s ease-in-out infinite alternate; }
.mj-glyph { font-size: 1.6rem; line-height: 1; }
.mj-tile small { font-size: 0.58rem; font-weight: 800; color: #44403c; text-transform: uppercase; }

.mem-header { font-size: 0.92rem; font-weight: 700; color: #38bdf8; text-align: center; }
.mem-area { width: 100%; display: flex; justify-content: center; }
.mem-interlude { font-size: 1.3rem; font-weight: 900; color: #fde047; padding: 60px 0; text-align: center; animation: arcFade 0.3s ease; }
.mem-grid { display: grid; grid-template-columns: repeat(4, min(84px, 20vw)); gap: 10px; perspective: 800px; }
.mem-card { position: relative; height: min(84px, 20vw); border: none; background: none; padding: 0; cursor: pointer; transform-style: preserve-3d; transition: transform 0.35s; }
.mem-card.is-up { transform: rotateY(180deg); }
.mem-face { position: absolute; inset: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; backface-visibility: hidden; font-size: 2rem; }
.mem-back { background: linear-gradient(135deg, #1e1b4b, #312e81); border: 2px solid #6366f1; color: #818cf8; }
.mem-front { background: #0f172a; border: 2px solid #38bdf8; transform: rotateY(180deg); }
.mem-card.is-matched .mem-front { border-color: #34d399; box-shadow: 0 0 16px rgba(52, 211, 153, 0.5); }
.simon-grid { display: grid; grid-template-columns: repeat(2, min(150px, 38vw)); gap: 14px; }
.simon-pad { height: min(120px, 30vw); border-radius: 18px; background: rgba(30, 41, 59, 0.9); border: 3px solid var(--pad-color); cursor: pointer; transition: background 0.08s, box-shadow 0.08s; }
.simon-pad.is-lit { background: var(--pad-color); box-shadow: 0 0 34px var(--pad-color); }
.flash-grid { display: grid; grid-template-columns: repeat(5, min(70px, 16vw)); gap: 8px; }
.flash-cell, .flash-empty { height: min(70px, 16vw); border-radius: 10px; }
.flash-cell { background: #1e293b; border: 2px solid #38bdf8; color: #f8fafc; font-size: 1.5rem; font-weight: 900; cursor: pointer; }
.flash-cell.is-hidden { color: transparent; background: linear-gradient(135deg, #1e3a8a, #312e81); }
.flash-cell.is-done { border-color: #34d399; color: #34d399; background: rgba(52, 211, 153, 0.12); }
.flash-cell.is-wrong { border-color: #f43f5e; background: rgba(244, 63, 94, 0.25); color: #fecdd3; }
.flash-empty { border: 1px dashed rgba(51, 65, 85, 0.5); }

.fz-board { --fz: min(82px, calc((100vw - 110px) / 4.5)); position: relative; width: calc(var(--fz) * 4 + 50px); height: calc(var(--fz) * 4 + 50px); background: #0f172a; border-radius: 14px; border: 1px solid #334155; touch-action: none; }
.fz-cell, .fz-tile { position: absolute; left: 10px; top: 10px; width: var(--fz); height: var(--fz); border-radius: 10px; transform: translate(calc(var(--c) * (var(--fz) + 10px)), calc(var(--r) * (var(--fz) + 10px))); }
.fz-cell { background: rgba(30, 41, 59, 0.8); }
.fz-tile { display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: calc(var(--fz) * 0.38); color: #020617; transition: transform 0.11s ease; }
.fz-tile.d3 { font-size: calc(var(--fz) * 0.3); }
.fz-tile.d4 { font-size: calc(var(--fz) * 0.24); }
.fz-tile.v2 { background: #bae6fd; } .fz-tile.v4 { background: #7dd3fc; } .fz-tile.v8 { background: #38bdf8; }
.fz-tile.v16 { background: #818cf8; color: #fff; } .fz-tile.v32 { background: #a855f7; color: #fff; } .fz-tile.v64 { background: #d946ef; color: #fff; }
.fz-tile.v128 { background: #f472b6; color: #fff; box-shadow: 0 0 14px #f472b6; } .fz-tile.v256 { background: #fb7185; color: #fff; box-shadow: 0 0 16px #fb7185; }
.fz-tile.v512 { background: #f97316; color: #fff; box-shadow: 0 0 18px #f97316; } .fz-tile.v1024 { background: #facc15; box-shadow: 0 0 22px #facc15; }
.fz-tile.v2048, .fz-tile.v4096 { background: #fef08a; box-shadow: 0 0 28px #fef08a; }
.fz-new { animation: fzIn 0.16s ease; }
.fz-pop { animation: fzPop 0.16s ease; }
@keyframes fzIn { from { scale: 0.2; opacity: 0; } }
@keyframes fzPop { 50% { scale: 1.16; } }
.fz-hint { font-size: 0.76rem; color: #64748b; }

.sw-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
.sw-toolbar .active { background: rgba(244, 63, 94, 0.25); border-color: #f43f5e; }
.sw-note { font-size: 0.75rem; color: #64748b; }
.sw-grid { --sw: min(36px, calc((100vw - 90px) / 12.5)); display: grid; grid-template-columns: repeat(var(--cols), var(--sw)); gap: 3px; background: #0f172a; padding: 10px; border-radius: 12px; border: 1px solid #334155; user-select: none; }
.sw-cell { width: var(--sw); height: var(--sw); background: linear-gradient(160deg, #334155, #1e293b); border: 1px solid #475569; color: #f8fafc; font-weight: 900; font-size: calc(var(--sw) * 0.45); border-radius: 5px; cursor: pointer; padding: 0; }
.sw-cell:hover { filter: brightness(1.2); }
.sw-cell.is-open { background: #020617; border-color: #1e293b; cursor: default; }
.sw-cell.n1 { color: #38bdf8; } .sw-cell.n2 { color: #34d399; } .sw-cell.n3 { color: #f43f5e; } .sw-cell.n4 { color: #a855f7; }
.sw-cell.n5 { color: #f97316; } .sw-cell.n6 { color: #22d3ee; } .sw-cell.n7 { color: #f8fafc; } .sw-cell.n8 { color: #94a3b8; }
.sw-cell.is-boom { background: #be123c; }
.sw-cell.is-wrongflag { background: rgba(244, 63, 94, 0.35); }

.rv-grid { --rv: min(52px, calc((100vw - 100px) / 8.4)); display: grid; grid-template-columns: repeat(8, var(--rv)); gap: 3px; background: #064e3b; padding: 10px; border-radius: 12px; border: 2px solid #10b981; box-shadow: 0 0 30px rgba(16, 185, 129, 0.25); }
.rv-cell { width: var(--rv); height: var(--rv); background: #065f46; border: none; border-radius: 4px; padding: 5px; cursor: default; position: relative; }
.rv-cell.is-legal { cursor: pointer; }
.rv-cell.is-legal::after { content: ''; position: absolute; inset: 38%; border-radius: 50%; background: rgba(253, 224, 71, 0.65); box-shadow: 0 0 10px #fde047; }
.rv-cell.is-last { box-shadow: inset 0 0 0 2px rgba(253, 224, 71, 0.7); }
.rv-disc { display: block; width: 100%; height: 100%; border-radius: 50%; }
.rv-disc.p1 { background: radial-gradient(circle at 35% 30%, #64748b, #0f172a 60%); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); }
.rv-disc.p2 { background: radial-gradient(circle at 35% 30%, #ffffff, #cbd5e1 60%); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4); }
.rv-disc.is-flip { animation: rvFlip 0.35s ease; }
@keyframes rvFlip { 50% { transform: scaleX(0.05); } }

.su-wrap { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; align-items: flex-start; }
.su-grid { --su: min(42px, calc((100vw - 80px) / 9.6)); display: grid; grid-template-columns: repeat(9, var(--su)); background: #0f172a; border: 2px solid #38bdf8; border-radius: 8px; overflow: hidden; }
.su-cell { width: var(--su); height: var(--su); background: #0b1224; border: none; border-right: 1px solid #1e293b; border-bottom: 1px solid #1e293b; color: #7dd3fc; font-size: calc(var(--su) * 0.5); font-weight: 700; cursor: pointer; padding: 0; }
.su-cell.edge-r { border-right: 2px solid #38bdf8; }
.su-cell.edge-b { border-bottom: 2px solid #38bdf8; }
.su-cell.is-given { color: #f8fafc; font-weight: 900; }
.su-cell.is-peer { background: #111c36; }
.su-cell.is-same { background: rgba(56, 189, 248, 0.22); }
.su-cell.is-sel { background: rgba(56, 189, 248, 0.45); color: #fff; }
.su-cell.is-wrong { color: #fb7185; }
.su-notes { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; height: 100%; padding: 2px; }
.su-notes i { font-style: normal; font-size: calc(var(--su) * 0.22); color: #94a3b8; line-height: 1.3; }
.su-pad { display: grid; grid-template-columns: repeat(3, 52px); gap: 6px; }
.su-pad button { height: 44px; border-radius: 8px; background: #1e293b; border: 1px solid #334155; color: #f8fafc; font-size: 1.1rem; font-weight: 800; cursor: pointer; }
.su-pad button:hover { border-color: #38bdf8; }
.su-pad .su-wide { grid-column: span 3; font-size: 0.85rem; }
.su-pad .active { background: rgba(168, 85, 247, 0.35); border-color: #a855f7; }

.cl-board { display: flex; flex-direction: column; gap: 5px; }
.cl-row { display: flex; align-items: center; gap: 10px; padding: 5px 10px; border-radius: 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid transparent; opacity: 0.55; }
.cl-row.is-done { opacity: 1; }
.cl-row.is-current { opacity: 1; border-color: #38bdf8; background: rgba(56, 189, 248, 0.1); }
.cl-num { width: 18px; font-size: 0.72rem; color: #64748b; font-weight: 800; }
.cl-slots { display: flex; gap: 6px; }
.cl-slot { width: 38px; height: 38px; border-radius: 50%; background: #020617; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
.cl-pips { display: grid; grid-template-columns: repeat(2, 12px); gap: 4px; }
.cl-pip { width: 12px; height: 12px; border-radius: 50%; background: #1e293b; display: inline-block; }
.cl-pip.exact { background: #34d399; box-shadow: 0 0 8px #34d399; }
.cl-pip.near { background: transparent; border: 2px solid #fbbf24; }
.cl-secret { text-align: center; font-weight: 800; color: #fde047; margin-top: 6px; }
.cl-palette { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; max-width: 460px; }
.cl-palette button { width: 56px; height: 56px; border-radius: 12px; background: #1e293b; border: 1px solid #334155; color: #f8fafc; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 1.4rem; }
.cl-palette button small { font-size: 0.6rem; color: #64748b; }
.cl-palette .cl-wide { width: auto; padding: 0 16px; font-size: 0.9rem; font-weight: 800; }
.cl-palette .cl-go { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; }
.cl-legend { font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }

.lounge-layout { display: grid; grid-template-columns: 330px 1fr; gap: 18px; }
.lounge-sidebar { display: flex; flex-direction: column; gap: 16px; }
.lounge-card { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 14px; padding: 16px; }
.lounge-sub { font-size: 0.8rem; color: #94a3b8; margin: 6px 0 12px; }
.avatar-picker { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.av-option { font-size: 1.25rem; padding: 6px 9px; border-radius: 8px; background: #020617; border: 1px solid #334155; cursor: pointer; }
.av-option.selected { border-color: #38bdf8; background: rgba(56, 189, 248, 0.2); }
.callsign-input-row { display: flex; gap: 8px; }
.callsign-input-row input, .chat-composer input { flex: 1; min-width: 0; background: #020617; border: 1px solid #334155; color: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 0.85rem; }
.leaderboard-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.leader-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; background: #020617; padding: 7px 10px; border-radius: 8px; }
.leader-name { flex: 1; font-weight: 700; }
.leader-pts { color: #38bdf8; font-weight: 800; font-variant-numeric: tabular-nums; }
.leader-empty { font-size: 0.8rem; color: #64748b; }
.lounge-chat-panel { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; height: 520px; }
.chat-header-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.chat-channels { display: flex; gap: 6px; }
.chan-btn { background: #020617; color: #94a3b8; border: 1px solid #334155; padding: 5px 11px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
.chan-btn.active { color: #38bdf8; border-color: #38bdf8; }
.arcade-chat-log { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 12px; background: #020617; border-radius: 10px; margin-bottom: 10px; }
.chat-empty { color: #64748b; font-size: 0.85rem; text-align: center; margin: auto; max-width: 340px; }
.chat-msg { display: flex; gap: 9px; align-items: flex-start; font-size: 0.85rem; animation: arcFade 0.2s ease; }
.chat-av { font-size: 1.25rem; }
.chat-meta { font-size: 0.72rem; color: #64748b; display: flex; gap: 6px; align-items: center; }
.chat-meta strong { color: #38bdf8; }
.chat-system .chat-meta strong { color: #fde047; }
.chat-bot .chat-meta strong { color: #a78bfa; }
.chat-tag { font-size: 0.6rem; font-weight: 800; color: #020617; background: #a78bfa; padding: 1px 5px; border-radius: 4px; text-transform: uppercase; }
.chat-text { color: #e2e8f0; line-height: 1.45; word-break: break-word; }
.chat-composer { display: flex; gap: 8px; }
.chat-local-note { font-size: 0.72rem; color: #64748b; margin-top: 8px; }
.codex-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.codex-card { background: rgba(15,23,42,0.9); border: 1px solid rgba(56,189,248,0.25); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.codex-card p { color: #cbd5e1; font-size: 0.9rem; line-height: 1.55; }
.codex-card .arcade-btn-primary { align-self: flex-start; }
.arcade-footer { text-align: center; padding: 26px 16px 34px; color: #64748b; font-size: 0.8rem; }
@media (max-width: 820px) {
  .arcade-hero, .lounge-layout, .codex-grid { grid-template-columns: 1fr; }
  .page-section { padding: 16px; }
  .arcade-header { padding: 12px 16px; }
  .arcade-stage-mount { padding: 10px; min-height: 440px; }
}
`,
  js: ARCADE_JS,
};

export const STOREFRONT_TEMPLATE = {
  id: 'storefront',
  name: 'Creator Storefront — Product Catalog & Shopping Bag',
  category: 'E-Commerce & Storefront',
  badge: 'Multi-Page • Editable Products • Shopping Bag',
  favicon: '🛍️',
  backgroundId: 'aurora',
  description: 'A multi-page shop: edit every product name, description, price and photo right on the page, filter the catalog, and let visitors build a shopping bag. Checkout shows the order for the visitor to send you until you connect a payment service.',
  pages: ['Featured', 'Catalog', 'Shopping Bag'],
  html: `
<header class="site-header">
  <div class="logo" contenteditable="true">🛍️ AETHER<span>SUPPLY</span></div>
  <nav class="nav-links">
    <button class="nav-btn active" data-page="shop-home" onclick="switchPage('shop-home')">Featured</button>
    <button class="nav-btn" data-page="shop-catalog" onclick="switchPage('shop-catalog')">All Products</button>
    <button class="nav-btn" data-page="shop-checkout" onclick="switchPage('shop-checkout')">🛒 Bag (<span id="shop-cart-count">0</span>)</button>
  </nav>
</header>

<main id="page-shop-home" class="page-section active">
  <section class="shop-hero">
    <div>
      <span class="shop-badge" contenteditable="true">NEW DROP • CREATOR EDITION</span>
      <h1 contenteditable="true">Next-Gen Hardware, Synth Packs & Apparel</h1>
      <p contenteditable="true">Small-batch gear and digital packs made by independent creators. Browse the collection and build your bag.</p>
      <button class="shop-btn" onclick="switchPage('shop-catalog')">Browse the collection →</button>
    </div>
    <div class="img-placeholder shop-hero-photo">
      <span>📸 Hero product photo (click or drop an image)</span>
    </div>
  </section>
  <section class="shop-perks">
    <div class="shop-perk"><h4 contenteditable="true">🚚 Ships in 2 days</h4><p contenteditable="true">Physical items leave the studio within two working days.</p></div>
    <div class="shop-perk"><h4 contenteditable="true">⚡ Instant downloads</h4><p contenteditable="true">Digital packs arrive by link as soon as your order is confirmed.</p></div>
    <div class="shop-perk"><h4 contenteditable="true">💬 Real support</h4><p contenteditable="true">Questions? Write to us and a human answers.</p></div>
  </section>
</main>

<main id="page-shop-catalog" class="page-section">
  <div class="shop-toolbar">
    <h2 contenteditable="true">The Collection</h2>
    <div class="shop-filters">
      <button class="shop-chip active" data-filter="all" onclick="filterShop('all')">All</button>
      <button class="shop-chip" data-filter="hardware" onclick="filterShop('hardware')">Hardware</button>
      <button class="shop-chip" data-filter="digital" onclick="filterShop('digital')">Digital</button>
      <button class="shop-chip" data-filter="apparel" onclick="filterShop('apparel')">Apparel</button>
    </div>
  </div>
  <div class="shop-grid" id="shop-products-grid">
    <article class="shop-card" data-cat="hardware">
      <div class="img-placeholder shop-photo"><span>📸 Product photo</span></div>
      <h4 class="shop-name" contenteditable="true">Aether Deck Controller</h4>
      <p class="shop-desc" contenteditable="true">Programmable OLED macro deck for streaming and studio work.</p>
      <div class="shop-row"><strong class="shop-price" contenteditable="true">$149</strong><button class="shop-btn" type="button" data-add>+ Add to bag</button></div>
    </article>
    <article class="shop-card" data-cat="digital">
      <div class="img-placeholder shop-photo"><span>📸 Product photo</span></div>
      <h4 class="shop-name" contenteditable="true">Noosphere Ambient Synth Pack</h4>
      <p class="shop-desc" contenteditable="true">120 ambient and synthwave stems, 24-bit WAV.</p>
      <div class="shop-row"><strong class="shop-price" contenteditable="true">$39</strong><button class="shop-btn" type="button" data-add>+ Add to bag</button></div>
    </article>
    <article class="shop-card" data-cat="hardware">
      <div class="img-placeholder shop-photo"><span>📸 Product photo</span></div>
      <h4 class="shop-name" contenteditable="true">Halo Studio Headphones</h4>
      <p class="shop-desc" contenteditable="true">Lightweight open-back monitors tuned for long mixing sessions.</p>
      <div class="shop-row"><strong class="shop-price" contenteditable="true">$299</strong><button class="shop-btn" type="button" data-add>+ Add to bag</button></div>
    </article>
    <article class="shop-card" data-cat="digital">
      <div class="img-placeholder shop-photo"><span>📸 Product photo</span></div>
      <h4 class="shop-name" contenteditable="true">Glass UI Icon & Shader Kit</h4>
      <p class="shop-desc" contenteditable="true">400+ glass-style components and WebGL shaders.</p>
      <div class="shop-row"><strong class="shop-price" contenteditable="true">$49</strong><button class="shop-btn" type="button" data-add>+ Add to bag</button></div>
    </article>
    <article class="shop-card" data-cat="apparel">
      <div class="img-placeholder shop-photo"><span>📸 Product photo</span></div>
      <h4 class="shop-name" contenteditable="true">Signal Hoodie</h4>
      <p class="shop-desc" contenteditable="true">Heavyweight organic cotton with a reflective circuit print.</p>
      <div class="shop-row"><strong class="shop-price" contenteditable="true">$68</strong><button class="shop-btn" type="button" data-add>+ Add to bag</button></div>
    </article>
    <article class="shop-card" data-cat="apparel">
      <div class="img-placeholder shop-photo"><span>📸 Product photo</span></div>
      <h4 class="shop-name" contenteditable="true">Night Shift Cap</h4>
      <p class="shop-desc" contenteditable="true">Six-panel cap with an embroidered glow-in-the-dark logo.</p>
      <div class="shop-row"><strong class="shop-price" contenteditable="true">$29</strong><button class="shop-btn" type="button" data-add>+ Add to bag</button></div>
    </article>
  </div>
</main>

<main id="page-shop-checkout" class="page-section">
  <h2 contenteditable="true">Your Shopping Bag</h2>
  <div id="shop-cart-items" class="shop-cart-items"></div>
  <div class="shop-summary">
    <div>Subtotal <strong id="shop-cart-total">$0.00</strong></div>
    <button class="shop-btn" type="button" onclick="completeShopOrder()">Check out →</button>
  </div>
  <div id="shop-order-receipt"></div>
  <p class="shop-checkout-note" contenteditable="true">Online payment isn't set up for this shop yet. At checkout, copy your order and email it to us; we'll reply with a payment link.</p>
</main>
`,
  css: `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; background: #090d16; color: #f8fafc; }
button { font-family: inherit; }
.site-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 16px 28px; border-bottom: 1px solid #1e293b; position: sticky; top: 0; background: rgba(9, 13, 22, 0.92); backdrop-filter: blur(10px); z-index: 10; }
.logo { font-weight: 900; font-size: 1.2rem; }
.logo span { color: #38bdf8; }
.nav-links { display: flex; gap: 8px; flex-wrap: wrap; }
.nav-btn, .shop-chip { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 7px 14px; border-radius: 8px; cursor: pointer; }
.nav-btn.active, .shop-chip.active { background: #38bdf8; color: #020617; font-weight: 700; border-color: #38bdf8; }
.page-section { display: none; padding: 28px; max-width: 1100px; margin: 0 auto; }
.page-section.active { display: block; }
.shop-hero { display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; align-items: center; background: #111827; padding: 28px; border-radius: 16px; }
.shop-badge { color: #38bdf8; font-size: 0.75rem; font-weight: 800; }
.shop-hero h1 { font-size: 2rem; margin: 10px 0; }
.shop-hero p { color: #94a3b8; margin-bottom: 16px; line-height: 1.5; }
.shop-btn { background: #38bdf8; color: #020617; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: filter 0.15s; }
.shop-btn:hover { filter: brightness(1.12); }
.img-placeholder { border: 2px dashed #38bdf8; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #94a3b8; padding: 16px; text-align: center; overflow: hidden; }
.shop-hero-photo { height: 240px; }
.shop-perks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
.shop-perk { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }
.shop-perk p { color: #94a3b8; font-size: 0.85rem; margin-top: 6px; }
.shop-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
.shop-filters { display: flex; gap: 8px; flex-wrap: wrap; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.shop-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.15s; }
.shop-card:hover { border-color: #38bdf8; }
.shop-card.is-hidden { display: none; }
.shop-photo { height: 160px; padding: 10px; font-size: 0.8rem; }
.shop-desc { color: #94a3b8; font-size: 0.84rem; line-height: 1.45; flex: 1; }
.shop-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.shop-price { font-size: 1.1rem; }
.shop-btn.is-added { background: #34d399; }
.shop-cart-items { margin: 16px 0; display: flex; flex-direction: column; gap: 8px; }
.shop-line { display: flex; align-items: center; gap: 10px; background: #111827; border: 1px solid #1e293b; border-radius: 10px; padding: 10px 14px; }
.shop-line-name { flex: 1; font-weight: 700; }
.shop-qty { display: flex; align-items: center; gap: 6px; }
.shop-qty button, .shop-remove { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }
.shop-line-total { min-width: 80px; text-align: right; font-weight: 800; }
.shop-empty { color: #94a3b8; }
.shop-summary { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #111827; padding: 16px; border-radius: 12px; }
.shop-order { margin-top: 14px; padding: 16px; border-radius: 12px; background: rgba(56, 189, 248, 0.08); border: 1px solid #38bdf8; display: flex; flex-direction: column; gap: 10px; }
.shop-order textarea { width: 100%; min-height: 120px; background: #020617; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 10px; font-family: ui-monospace, monospace; font-size: 0.82rem; }
.shop-warn { color: #fbbf24; }
.shop-checkout-note { margin-top: 14px; color: #94a3b8; font-size: 0.85rem; }
@media (max-width: 760px) { .shop-hero, .shop-perks { grid-template-columns: 1fr; } .page-section { padding: 16px; } }
`,
  js: `
// Visitors' text is shown as typed, never run as markup.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
window.switchPage = function (pageId) {
  var target = document.getElementById('page-' + pageId);
  if (!target) return;
  document.querySelectorAll('.page-section').forEach(function (p) { p.classList.toggle('active', p === target); });
  document.querySelectorAll('.nav-btn[data-page]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-page') === pageId); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.filterShop = function (cat) {
  document.querySelectorAll('.shop-chip').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-filter') === cat); });
  document.querySelectorAll('.shop-card').forEach(function (c) { c.classList.toggle('is-hidden', cat !== 'all' && c.getAttribute('data-cat') !== cat); });
};

// The bag reads each product's name and price from the page, so editing a card edits the product.
var CART_KEY = 'shop_bag_v1';
var bag = [];
try { var saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (Array.isArray(saved)) bag = saved.filter(function (l) { return l && typeof l.name === 'string' && isFinite(l.price) && l.qty > 0; }); } catch (e) { /* no saved bag */ }
function saveBag() { try { localStorage.setItem(CART_KEY, JSON.stringify(bag)); } catch (e) { /* not saved */ } }
function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }
function priceOf(text) { var n = parseFloat(String(text).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }

document.addEventListener('click', function (e) {
  var add = e.target.closest && e.target.closest('[data-add]');
  if (add) {
    var card = add.closest('.shop-card');
    var name = (card.querySelector('.shop-name').textContent || 'Item').trim();
    var price = priceOf(card.querySelector('.shop-price').textContent);
    var line = bag.find(function (l) { return l.name === name; });
    if (line) line.qty++; else bag.push({ name: name, price: price, qty: 1 });
    saveBag();
    renderBag();
    add.textContent = 'Added ✓';
    add.classList.add('is-added');
    setTimeout(function () { add.textContent = '+ Add to bag'; add.classList.remove('is-added'); }, 1100);
    return;
  }
  var act = e.target.closest && e.target.closest('[data-line]');
  if (act) {
    var i = Number(act.getAttribute('data-line'));
    var what = act.getAttribute('data-do');
    if (!bag[i]) return;
    if (what === 'inc') bag[i].qty++;
    else if (what === 'dec') bag[i].qty--;
    else bag[i].qty = 0;
    bag = bag.filter(function (l) { return l.qty > 0; });
    saveBag();
    renderBag();
  }
});

function renderBag() {
  var box = document.getElementById('shop-cart-items');
  var total = 0, count = 0;
  bag.forEach(function (l) { total += l.price * l.qty; count += l.qty; });
  document.getElementById('shop-cart-count').textContent = String(count);
  document.getElementById('shop-cart-total').textContent = money(total);
  if (!box) return;
  box.innerHTML = bag.length ? bag.map(function (l, i) {
    return '<div class="shop-line"><span class="shop-line-name">' + esc(l.name) + '</span>' +
      '<span class="shop-qty"><button type="button" data-line="' + i + '" data-do="dec" aria-label="One fewer">−</button><b>' + l.qty + '</b>' +
      '<button type="button" data-line="' + i + '" data-do="inc" aria-label="One more">+</button></span>' +
      '<span class="shop-line-total">' + money(l.price * l.qty) + '</span>' +
      '<button type="button" class="shop-remove" data-line="' + i + '" data-do="remove" aria-label="Remove">✕</button></div>';
  }).join('') : '<p class="shop-empty">Your bag is empty. Add something from the collection.</p>';
}

// No payment service is connected, so checkout never claims an order went through:
// it shows the order for the visitor to send to the shop.
window.completeShopOrder = function () {
  var rec = document.getElementById('shop-order-receipt');
  if (!rec) return;
  if (!bag.length) { rec.innerHTML = '<div class="shop-order"><p class="shop-warn">Add at least one item first.</p></div>'; return; }
  var total = 0;
  var lines = bag.map(function (l) { total += l.price * l.qty; return l.qty + ' × ' + l.name + ' — ' + money(l.price * l.qty); });
  var text = 'Order request\\n' + lines.join('\\n') + '\\nSubtotal: ' + money(total);
  rec.innerHTML = '<div class="shop-order"><p class="shop-warn">Online checkout isn\\'t connected yet, so no order has been placed or paid for.</p>' +
    '<p>Copy your order below and send it to the shop:</p><textarea readonly id="shop-order-text"></textarea>' +
    '<button type="button" class="shop-btn" id="shop-copy-order">Copy order</button></div>';
  var ta = document.getElementById('shop-order-text');
  ta.value = text;
  document.getElementById('shop-copy-order').addEventListener('click', function () {
    var btn = this;
    function done() { btn.textContent = 'Copied ✓'; }
    try { navigator.clipboard.writeText(text).then(done, function () { ta.select(); document.execCommand('copy'); done(); }); }
    catch (e) { ta.select(); try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = 'Select the text and copy it'; } }
  });
};
renderBag();
`,
};
