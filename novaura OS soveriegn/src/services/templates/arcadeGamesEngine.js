/**
 * arcadeGamesEngine.js — Core of the Nexus Arcade page script: saved progress,
 * sound, the game session (listeners, timers and the frame loop are all torn
 * down when you leave a game), pause / start / end screens, touch controls,
 * the game deck, and the Players Lounge.
 *
 * The arcade script is plain JavaScript inside template strings. arcadeTemplate.js
 * joins the parts inside one function, after `var GAMES = [...]` from
 * arcadeManifest.js. Inside these strings: no backslashes, no backticks and no
 * dollar-brace (the outer template string would eat them).
 */

export const ARCADE_CORE_JS = `
  // Visitors' text is shown as typed, never run as markup.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const TAU = Math.PI * 2;
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }
  const fmt = n => Math.round(Number(n) || 0).toLocaleString();

  const GAME_MAP = {};
  GAMES.forEach(g => { GAME_MAP[g.id] = g; });
  const STARTERS = {};
  const CAT_LABEL = { action: 'Arcade Action', tabletop: 'Tabletop & Cards', puzzle: 'Brain & Logic', story: 'Story & World' };

  // ── Saved progress: kept in this visitor's browser (or parent OS vault when embedded) ──
  const STORE_KEY = 'nexus_arcade_v2';
  const AVATARS = ['🦊', '🐉', '🤖', '⚡', '🌌', '👾'];
  const state = { profile: { name: 'Pilot', avatar: '🦊' }, progress: {}, muted: false, chat: null };
  function applySavedState(saved) {
    if (!saved || typeof saved !== 'object') return;
    if (saved.profile && typeof saved.profile.name === 'string' && saved.profile.name.trim()) state.profile.name = saved.profile.name.trim().slice(0, 22);
    if (saved.profile && AVATARS.indexOf(saved.profile.avatar) !== -1) state.profile.avatar = saved.profile.avatar;
    if (saved.progress && typeof saved.progress === 'object') state.progress = saved.progress;
    if (typeof saved.muted === 'boolean') state.muted = saved.muted;
    if (saved.chat && typeof saved.chat === 'object') state.chat = saved.chat;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    applySavedState(saved);
  } catch (e) { /* private window or blocked storage: play without saving */ }
  if (window.__NEXUS_INITIAL_STATE__) {
    applySavedState(window.__NEXUS_INITIAL_STATE__);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not saved */ }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ novauraArcadeSync: true, state: { profile: state.profile, progress: state.progress, muted: state.muted, chat: state.chat } }, '*');
      }
    } catch (e) { /* parent bridge unavailable */ }
  }

  function progressOf(id) {
    const p = Object.prototype.hasOwnProperty.call(state.progress, id) ? state.progress[id] : null;
    return {
      best: p && Number.isFinite(p.best) ? p.best : 0,
      beaten: !!(p && p.beaten === true),
      plays: p && Number.isFinite(p.plays) ? p.plays : 0,
    };
  }
  function record(id, score, beaten) {
    const p = progressOf(id);
    const s = Math.max(0, Math.round(Number(score) || 0));
    const result = { newBest: s > p.best && s > 0, firstBeat: !!beaten && !p.beaten };
    if (s > p.best) p.best = s;
    if (beaten) p.beaten = true;
    p.plays += 1;
    state.progress[id] = p;
    save();
    refreshHud();
    renderGrid();
    renderRecords();
    return result;
  }
  const beatenCount = () => GAMES.filter(g => progressOf(g.id).beaten).length;
  const totalPoints = () => GAMES.reduce((sum, g) => sum + progressOf(g.id).best, 0);

  // ── Sound: tiny synthesized effects, no files ──
  const audio = { ctx: null, noise: null };
  const SFX = {
    click: [['triangle', 660, 520, 0.05, 0.05]],
    move: [['triangle', 340, 300, 0.04, 0.035]],
    shoot: [['square', 920, 260, 0.08, 0.03]],
    hit: [['square', 420, 110, 0.12, 0.045]],
    pickup: [['sine', 700, 1400, 0.12, 0.07]],
    power: [['sawtooth', 200, 900, 0.32, 0.045]],
    bounce: [['sine', 520, 380, 0.06, 0.06]],
    flip: [['triangle', 880, 720, 0.05, 0.05]],
    match: [['sine', 660, 990, 0.12, 0.07], ['sine', 990, 1320, 0.14, 0.05, 0.08]],
    error: [['square', 170, 110, 0.18, 0.045]],
    boom: [['noise', 0, 0, 0.5, 0.28]],
    splash: [['noise', 0, 0, 0.3, 0.16], ['sine', 500, 120, 0.25, 0.05]],
    lose: [['sawtooth', 440, 100, 0.75, 0.055]],
    level: [['sine', 440, 880, 0.18, 0.06], ['sine', 660, 1320, 0.22, 0.05, 0.12]],
    win: [['sine', 523, 523, 0.12, 0.07], ['sine', 659, 659, 0.12, 0.07, 0.12], ['sine', 784, 784, 0.12, 0.07, 0.24], ['sine', 1047, 1047, 0.4, 0.07, 0.36]],
  };
  function playNotes(notes) {
    if (state.muted || !notes) return;
    try {
      if (!audio.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();
      }
      const ac = audio.ctx;
      if (ac.state === 'suspended') ac.resume();
      notes.forEach(n => {
        const type = n[0], f0 = n[1], f1 = n[2], dur = n[3], vol = n[4], delay = n[5] || 0;
        const t = ac.currentTime + delay;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        gain.connect(ac.destination);
        let src;
        if (type === 'noise') {
          if (!audio.noise) {
            audio.noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
            const d = audio.noise.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          }
          src = ac.createBufferSource();
          src.buffer = audio.noise;
          const filter = ac.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2000, t);
          filter.frequency.exponentialRampToValueAtTime(120, t + dur);
          src.connect(filter);
          filter.connect(gain);
        } else {
          src = ac.createOscillator();
          src.type = type;
          src.frequency.setValueAtTime(f0, t);
          src.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
          src.connect(gain);
        }
        src.start(t);
        src.stop(t + dur + 0.05);
      });
    } catch (e) { /* no audio on this device */ }
  }
  const sfx = name => playNotes(SFX[name]);
  const tone = (freq, dur, type) => playNotes([[type || 'sine', freq, freq, dur || 0.25, 0.07]]);

  // ── Canvas helpers shared by the action games ──
  function Particles() { this.list = []; }
  Particles.prototype.burst = function (x, y, color, n, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = (0.25 + Math.random()) * (speed || 3), l = (life || 40) * (0.6 + Math.random() * 0.6);
      this.list.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, color: color, size: size || 2.5 });
    }
    if (this.list.length > 1200) this.list.splice(0, this.list.length - 1200);
  };
  Particles.prototype.spark = function (x, y, vx, vy, color, life, size) {
    this.list.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, color: color, size: size || 2 });
  };
  Particles.prototype.text = function (x, y, str, color) {
    this.list.push({ x: x, y: y, vx: 0, vy: -0.7, life: 55, max: 55, color: color || '#fde047', txt: String(str) });
  };
  Particles.prototype.update = function (gravity) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx; p.y += p.vy;
      if (!p.txt) { p.vx *= 0.97; p.vy = p.vy * 0.97 + (gravity || 0); }
      p.life -= 1;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  };
  Particles.prototype.draw = function (ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.4));
      ctx.fillStyle = p.color;
      if (p.txt) ctx.fillText(p.txt, p.x, p.y);
      else { ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
  };
  function makeStars(n, W, H) {
    const s = [];
    for (let i = 0; i < n; i++) s.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 1.7 });
    return s;
  }
  function drawStars(ctx, stars, W, H, speed) {
    for (const st of stars) {
      st.y += st.z * (speed == null ? 0.6 : speed);
      if (st.y > H) { st.y -= H; st.x = Math.random() * W; }
      ctx.globalAlpha = 0.25 + st.z * 0.35;
      ctx.fillStyle = st.z > 1.4 ? '#e0f2fe' : '#7dd3fc';
      ctx.fillRect(st.x, st.y, st.z * 1.2, st.z * 1.2);
    }
    ctx.globalAlpha = 1;
  }
  function glowCircle(ctx, x, y, r, color, blur) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = blur == null ? 14 : blur;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function bannerText(ctx, text, W, H, t, sub) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t / 25);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillText(text, W / 2, H / 2 - 6);
    if (sub) { ctx.shadowBlur = 0; ctx.font = '600 15px system-ui, sans-serif'; ctx.fillStyle = '#bae6fd'; ctx.fillText(sub, W / 2, H / 2 + 22); }
    ctx.restore();
  }
  const hearts = n => n > 0 ? '♥ '.repeat(n).trim() : '—';

  // ── Overlays: start, pause and end screens ──
  function overlay(html) {
    clearOverlay();
    const mount = $('arcade-stage-mount');
    if (!mount) return null;
    const el = document.createElement('div');
    el.className = 'arc-overlay';
    el.innerHTML = '<div class="arc-overlay-card">' + html + '</div>';
    mount.appendChild(el);
    const first = el.querySelector('button');
    if (first) first.focus({ preventScroll: true });
    return el;
  }
  function clearOverlay() { document.querySelectorAll('.arc-overlay').forEach(o => o.remove()); }

  // ── The game session: one at a time, fully torn down on exit ──
  const ACTIONS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', Enter: 'fire', ShiftLeft: 'alt', ShiftRight: 'alt', KeyX: 'alt',
    KeyP: 'pause', Escape: 'pause',
  };
  let session = null;
  const typingIn = t => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const cabinetOpen = () => { const c = $('page-arcade-cabinet'); return !!(c && c.classList.contains('active')); };
  function releaseKeys() { if (session) Object.keys(session.act).forEach(k => { session.act[k] = false; }); }

  window.addEventListener('keydown', e => {
    const S = session;
    if (!S || !cabinetOpen() || typingIn(e.target)) return;
    const a = ACTIONS[e.code] || null;
    if (a === 'pause') { if (S.looping) { e.preventDefault(); togglePause(); } return; }
    // With a pause or end screen up, Space and Enter press its buttons as usual.
    if (S.paused || S.over) return;
    if (a && a !== 'alt') e.preventDefault();
    if (S.waiting) { if (a === 'fire') S.begin(); return; }
    if (a) S.act[a] = true;
    S.keyHandlers.forEach(fn => fn(a, e));
  });
  window.addEventListener('keyup', e => {
    const a = ACTIONS[e.code];
    if (session && a) session.act[a] = false;
  });
  window.addEventListener('blur', () => { releaseKeys(); setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

  function newSession(id) {
    const S = {
      id: id, game: GAME_MAP[id], alive: true, paused: false, over: false, ending: false, waiting: false, looping: false,
      act: {}, keyHandlers: [], cleanups: [], timers: [], raf: 0, body: null, hudEls: null, hudCache: ['', '', ''],
    };
    S.on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      S.cleanups.push(() => target.removeEventListener(type, fn, opts));
    };
    S.later = (fn, ms) => { const t = setTimeout(() => { if (S.alive) fn(); }, ms); S.timers.push(t); return t; };
    S.onKey = fn => { S.keyHandlers.push(fn); };
    S.sfx = sfx;
    S.tone = tone;
    S.hud = (a, b, c) => {
      if (!S.hudEls) return;
      [a, b, c].forEach((v, i) => {
        if (v == null) return;
        const s = String(v);
        if (S.hudCache[i] !== s) { S.hudCache[i] = s; S.hudEls[i].textContent = s; }
      });
    };
    S.el = (tag, cls, html, parent) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      (parent || S.body).appendChild(e);
      return e;
    };
    // A crisp canvas that scales down to fit narrow screens and short windows.
    S.canvas = (w, h, parent) => {
      const c = document.createElement('canvas');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.className = 'arc-canvas';
      c.tabIndex = 0;
      c.style.width = 'min(100%, ' + w + 'px, calc(70vh * ' + (w / h).toFixed(4) + '))';
      c.style.aspectRatio = w + ' / ' + h;
      (parent || S.body).appendChild(c);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      S.on(c, 'pointerdown', () => c.focus({ preventScroll: true }));
      S.on(c, 'contextmenu', e => e.preventDefault());
      return {
        el: c, ctx: ctx, W: w, H: h,
        toLocal: e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * w / r.width, y: (e.clientY - r.top) * h / r.height }; },
      };
    };
    // Fixed 60 updates a second, whatever the screen's refresh rate.
    S.loop = (update, draw) => {
      S.looping = true;
      const STEP = 1000 / 60;
      let last = performance.now(), acc = 0;
      const frame = now => {
        if (!S.alive) return;
        let dt = now - last;
        last = now;
        if (dt > 250) dt = STEP;
        if (!S.paused && !S.over && !S.waiting) {
          acc += dt;
          let n = 0;
          while (acc >= STEP && n < 4) { update(); acc -= STEP; n++; if (S.over || !S.alive) break; }
          if (n >= 4) acc = 0;
        }
        draw();
        if (S.over) return;
        S.raf = requestAnimationFrame(frame);
      };
      S.raf = requestAnimationFrame(frame);
    };
    // Title card before an action game; Space, Enter or the button starts it.
    S.ready = (onStart, hint) => {
      S.waiting = true;
      const g = S.game;
      S.begin = () => {
        if (!S.waiting || !S.alive) return;
        S.waiting = false;
        clearOverlay();
        sfx('click');
        if (onStart) onStart();
      };
      overlay('<div class="arc-ov-icon">' + g.icon + '</div><h3>' + esc(g.title) + '</h3><p>' + esc(g.goal) + '</p>' +
        '<p class="arc-ov-controls">' + esc(hint || g.controls) + '</p>' +
        '<div class="arc-ov-actions"><button type="button" class="arcade-btn-primary" data-ov="start">▶ Start</button></div>' +
        '<p class="arc-ov-hint">Space or Enter also starts' + (S.looping ? ' • P pauses' : '') + '</p>');
    };
    S.end = (won, score, title, detail, delay) => {
      if (S.over || !S.alive || S.ending) return;
      if (delay) {
        S.ending = true;
        S.later(() => { S.ending = false; S.end(won, score, title, detail); }, delay);
        return;
      }
      S.over = true;
      releaseKeys();
      const r = record(S.id, score, won);
      sfx(won ? 'win' : 'lose');
      const g = S.game;
      S.later(() => {
        overlay('<div class="arc-ov-icon">' + (won ? '🏆' : '💥') + '</div>' +
          '<h3>' + esc(title || (won ? 'Game beaten!' : 'Game over')) + '</h3>' +
          (detail ? '<p>' + esc(detail) + '</p>' : '') +
          '<div class="arc-ov-score">' + fmt(score) + ' pts' + (r.newBest ? ' <span class="arc-new-best">New best!</span>' : '') + '</div>' +
          (r.firstBeat ? '<p class="arc-ov-trophy">🏆 Trophy unlocked: ' + beatenCount() + ' / ' + GAMES.length + ' games beaten</p>' : '') +
          '<div class="arc-ov-actions"><button type="button" class="arcade-btn-primary" data-ov="restart">↻ Play again</button>' +
          '<button type="button" class="arcade-btn-secondary" data-ov="next">Next game →</button>' +
          '<button type="button" class="arcade-btn-secondary" data-ov="deck">Game deck</button></div>');
      }, 350);
      if (r.firstBeat) postChat('scores', SYSTEM, '🏆 ' + state.profile.avatar + ' ' + state.profile.name + ' beat ' + g.title + ' with ' + fmt(score) + ' points!');
    };
    // On-screen buttons for phones and tablets.
    S.pad = actions => {
      if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
      const LABEL = { left: '◀', right: '▶', up: '▲', down: '▼', fire: '●', alt: '✦' };
      const pad = S.el('div', 'arc-pad', actions.map(a => '<button type="button" data-act="' + a + '" aria-label="' + a + '">' + LABEL[a] + '</button>').join(''));
      const press = (e, down) => {
        const b = e.target.closest && e.target.closest('[data-act]');
        if (!b) return;
        e.preventDefault();
        const a = b.getAttribute('data-act');
        if (down && S.waiting) { S.begin(); return; }
        if (S.paused || S.over) return;
        S.act[a] = down;
        b.classList.toggle('is-down', down);
        if (down) S.keyHandlers.forEach(fn => fn(a, e));
      };
      S.on(pad, 'pointerdown', e => press(e, true));
      S.on(pad, 'pointerup', e => press(e, false));
      S.on(pad, 'pointercancel', e => press(e, false));
      S.on(pad, 'pointerleave', () => { releaseKeys(); pad.querySelectorAll('.is-down').forEach(b => b.classList.remove('is-down')); });
    };
    return S;
  }

  function stopSession() {
    const S = session;
    if (!S) return;
    session = null;
    S.alive = false;
    cancelAnimationFrame(S.raf);
    S.timers.forEach(t => clearTimeout(t));
    S.cleanups.forEach(f => { try { f(); } catch (e) { /* already gone */ } });
    clearOverlay();
  }

  function setPaused(p) {
    const S = session;
    if (!S || !S.looping || S.over || S.waiting || S.paused === p) return;
    S.paused = p;
    releaseKeys();
    if (p) {
      overlay('<div class="arc-ov-icon">⏸</div><h3>Paused</h3><p>Press P or Esc to carry on.</p>' +
        '<div class="arc-ov-actions"><button type="button" class="arcade-btn-primary" data-ov="resume">▶ Resume</button>' +
        '<button type="button" class="arcade-btn-secondary" data-ov="restart">↻ Restart</button>' +
        '<button type="button" class="arcade-btn-secondary" data-ov="deck">Game deck</button></div>');
    } else {
      clearOverlay();
    }
  }
  function togglePause() { if (session) setPaused(!session.paused); }

  window.launchArcadeGame = launchArcadeGame;
  function launchArcadeGame(id) {
    const g = GAME_MAP[id];
    if (!g || !STARTERS[id]) return;
    stopSession();
    switchPage('arcade-cabinet');
    const title = $('active-game-title'), goal = $('active-game-goal'), controls = $('active-game-controls');
    if (title) title.textContent = g.icon + ' ' + g.title;
    if (goal) goal.textContent = '🎯 ' + g.goal;
    if (controls) controls.textContent = '🎮 ' + g.controls;
    const mount = $('arcade-stage-mount');
    if (!mount) return;
    mount.innerHTML = '';
    const S = newSession(id);
    session = S;
    const hud = S.el('div', 'arc-hud', '<span></span><span></span><span></span>', mount);
    S.hudEls = hud.querySelectorAll('span');
    S.body = S.el('div', 'arc-body', null, mount);
    S.hud(g.title, 'Best ' + fmt(progressOf(id).best), '');
    mount.focus({ preventScroll: true });
    try {
      STARTERS[id](S);
    } catch (err) {
      S.body.innerHTML = '<p class="arc-error">This game hit an error and stopped: ' + esc(err && err.message) + '</p>';
    }
  };
  window.restartCurrentGame = function () { if (session) launchArcadeGame(session.id); };
  function nextGameAfter(id) {
    const i = GAMES.findIndex(g => g.id === id);
    for (let k = 1; k <= GAMES.length; k++) {
      const g = GAMES[(i + k) % GAMES.length];
      if (!progressOf(g.id).beaten) return g.id;
    }
    return GAMES[(i + 1) % GAMES.length].id;
  }
  window.launchRandomGame = function () { launchArcadeGame(pick(GAMES).id); };
  window.toggleArcadeSound = function () {
    state.muted = !state.muted;
    save();
    refreshSoundButton();
    if (!state.muted) sfx('click');
  };
  function refreshSoundButton() {
    document.querySelectorAll('[data-sound-toggle]').forEach(b => { b.textContent = state.muted ? '🔇 Sound off' : '🔊 Sound on'; });
  }

  // ── Pages ──
  window.switchPage = switchPage;
  function switchPage(pageId) {
    const target = $('page-' + pageId);
    if (!target) return;
    document.querySelectorAll('.page-section').forEach(p => p.classList.toggle('active', p === target));
    document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.toggle('active', b.getAttribute('data-page') === pageId));
    if (pageId !== 'arcade-cabinet') setPaused(true);
    if (pageId === 'players-lounge') { renderChat(); renderRecords(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Game deck ──
  let currentCat = 'all';
  function renderGrid() {
    const grid = $('arcade-games-grid');
    if (!grid) return;
    const list = GAMES.filter(g => currentCat === 'all' || g.category === currentCat);
    grid.innerHTML = list.map(g => {
      const p = progressOf(g.id);
      return '<article class="arcade-game-card' + (p.beaten ? ' is-beaten' : '') + '" data-game="' + esc(g.id) + '" tabindex="0" role="button" aria-label="Play ' + esc(g.title) + '">' +
        '<div class="game-card-top"><span class="game-icon">' + g.icon + '</span><span class="game-tags">' +
          (g.isNew ? '<span class="game-new-tag">New</span>' : '') +
          '<span class="game-cat-tag">' + esc(CAT_LABEL[g.category] || g.category) + '</span></span></div>' +
        '<h4>' + esc(g.title) + '</h4><p>' + esc(g.subtitle) + '</p>' +
        '<div class="game-goal-line">🎯 ' + esc(g.goal) + '</div>' +
        '<div class="game-card-footer">' +
          (p.beaten ? '<span class="beat-badge">🏆 Beaten</span>' : '<span class="unbeat-badge">' + (p.plays ? 'Not beaten yet' : 'Unplayed') + '</span>') +
          (p.best ? '<span class="game-best">Best ' + fmt(p.best) + '</span>' : '') +
          '<span class="play-now-btn">Play ▶</span>' +
        '</div></article>';
    }).join('');
  }
  window.filterArcadeGames = function (cat) {
    currentCat = GAMES.some(g => g.category === cat) ? cat : 'all';
    document.querySelectorAll('.cat-pill[data-cat]').forEach(p => p.classList.toggle('active', p.getAttribute('data-cat') === currentCat));
    renderGrid();
  };

  function refreshHud() {
    const t = $('arcade-trophy-pill'); if (t) t.textContent = '🏆 ' + beatenCount() + ' / ' + GAMES.length + ' beaten';
    const s = $('arcade-score-pill'); if (s) s.textContent = '⚡ ' + fmt(totalPoints()) + ' pts';
    const a = $('hud-avatar'); if (a) a.textContent = state.profile.avatar;
    const n = $('hud-callsign'); if (n) n.textContent = state.profile.name;
  }

  // ── Players Lounge: callsign, records and chat (all kept in this browser) ──
  const SYSTEM = { name: 'Arcade', avatar: '🏛️', kind: 'system' };
  const GUIDE = { name: 'Arcade Guide', avatar: '🧭', kind: 'bot' };
  const CHANNEL_INTRO = {
    lobby: 'Say hello! Ask the Arcade Guide about any game by name for a tip.',
    scores: 'Trophies and bragging rights land here. Press "Brag my progress" to post yours.',
    tips: 'Ask about a game, like "how do I beat the mothership?", and the guide answers.',
  };
  const chat = { lobby: [], scores: [], tips: [] };
  if (state.chat) {
    Object.keys(chat).forEach(c => {
      const list = state.chat[c];
      if (Array.isArray(list)) chat[c] = list.filter(m => m && typeof m.text === 'string' && typeof m.name === 'string').slice(-80);
    });
  }
  state.chat = chat;
  let activeChannel = 'lobby';
  const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const you = () => ({ name: state.profile.name, avatar: state.profile.avatar, kind: 'you' });

  function postChat(channel, who, text) {
    const list = chat[channel];
    if (!list) return;
    list.push({ name: String(who.name).slice(0, 22), avatar: String(who.avatar).slice(0, 4), kind: who.kind || 'you', text: String(text).slice(0, 500), time: nowLabel() });
    if (list.length > 80) list.splice(0, list.length - 80);
    save();
    if (channel === activeChannel) renderChat();
  }
  function renderChat() {
    const box = $('arcade-chat-log');
    if (!box) return;
    const msgs = chat[activeChannel];
    box.innerHTML = (msgs.length ? '' : '<div class="chat-empty">' + esc(CHANNEL_INTRO[activeChannel]) + '</div>') +
      msgs.map(m => '<div class="chat-msg chat-' + esc(m.kind) + '"><span class="chat-av">' + esc(m.avatar) + '</span><div class="chat-body">' +
        '<div class="chat-meta"><strong>' + esc(m.name) + '</strong>' + (m.kind === 'bot' ? '<span class="chat-tag">bot</span>' : '') + '<span>' + esc(m.time) + '</span></div>' +
        '<div class="chat-text">' + esc(m.text) + '</div></div></div>').join('');
    box.scrollTop = box.scrollHeight;
  }
  window.switchChatChannel = function (ch) {
    if (!chat[ch]) return;
    activeChannel = ch;
    document.querySelectorAll('.chan-btn[data-ch]').forEach(b => b.classList.toggle('active', b.getAttribute('data-ch') === ch));
    renderChat();
  };
  function guideReply(text) {
    const t = text.toLowerCase();
    const hit = GAMES.find(g => t.indexOf(g.id) !== -1 || t.indexOf(g.title.toLowerCase()) !== -1 || g.keywords.some(k => t.indexOf(k) !== -1));
    if (hit) return hit.icon + ' ' + hit.title + ': ' + hit.tip;
    if (t.indexOf('?') !== -1 || /^(help|hi|hello|hey|yo)/.test(t)) {
      return 'Ask me about any game by name, like "snake" or "solitaire", and I will share a tip. There are ' + GAMES.length + ' games; you have beaten ' + beatenCount() + '.';
    }
    return '';
  }
  window.sendArcadeChat = function () {
    const inp = $('arcade-chat-input');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const channel = activeChannel;
    postChat(channel, you(), text);
    const reply = guideReply(text);
    if (reply) setTimeout(() => postChat(channel, GUIDE, reply), 550);
  };
  window.shareHighScoreToChat = function () {
    const top = GAMES.map(g => [g, progressOf(g.id).best]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
    const text = '📣 ' + beatenCount() + ' / ' + GAMES.length + ' games beaten • ' + fmt(totalPoints()) + ' total points' +
      (top ? ' • best run: ' + top[0].title + ' (' + fmt(top[1]) + ')' : '');
    window.switchChatChannel('scores');
    postChat('scores', you(), text);
  };
  function renderRecords() {
    const el = $('arcade-leaderboard-rows');
    if (!el) return;
    const rows = GAMES.map(g => [g, progressOf(g.id)]).filter(x => x[1].plays > 0).sort((a, b) => b[1].best - a[1].best).slice(0, 10);
    el.innerHTML = rows.length ? rows.map(x => '<div class="leader-row"><span class="leader-icon">' + x[0].icon + '</span><span class="leader-name">' + esc(x[0].title) + '</span>' +
      (x[1].beaten ? '<span class="leader-beat" title="Beaten">🏆</span>' : '') + '<span class="leader-pts">' + fmt(x[1].best) + '</span></div>').join('')
      : '<p class="leader-empty">Play any game to set your first record.</p>';
  }
  window.savePlayerIdentity = function () {
    const inp = $('callsign-input');
    const name = inp ? inp.value.trim().slice(0, 22) : '';
    const sel = document.querySelector('.av-option.selected');
    const av = sel ? sel.getAttribute('data-avatar') : state.profile.avatar;
    const changedName = !!name && name !== state.profile.name;
    if (name) state.profile.name = name;
    if (AVATARS.indexOf(av) !== -1) state.profile.avatar = av;
    save();
    refreshHud();
    postChat('lobby', SYSTEM, state.profile.avatar + ' ' + state.profile.name + (changedName ? ' joined the lounge.' : ' updated their look.'));
    const btn = $('callsign-save-btn');
    if (btn) { btn.textContent = 'Saved ✓'; setTimeout(() => { btn.textContent = 'Save'; }, 1400); }
  };

  function initArcade() {
    const picker = $('avatar-picker');
    if (picker) {
      picker.querySelectorAll('.av-option').forEach(b => b.classList.toggle('selected', b.getAttribute('data-avatar') === state.profile.avatar));
      picker.addEventListener('click', e => {
        const b = e.target.closest('.av-option');
        if (!b) return;
        picker.querySelectorAll('.av-option').forEach(o => o.classList.toggle('selected', o === b));
      });
    }
    const inp = $('callsign-input');
    if (inp) {
      inp.value = state.profile.name;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); window.savePlayerIdentity(); } });
    }
    const grid = $('arcade-games-grid');
    if (grid) {
      grid.addEventListener('click', e => { const c = e.target.closest('[data-game]'); if (c) launchArcadeGame(c.getAttribute('data-game')); });
      grid.addEventListener('keydown', e => {
        const c = e.target.closest('[data-game]');
        if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); launchArcadeGame(c.getAttribute('data-game')); }
      });
    }
    document.querySelectorAll('.cat-pill[data-cat]').forEach(p => {
      const cat = p.getAttribute('data-cat');
      const n = cat === 'all' ? GAMES.length : GAMES.filter(g => g.category === cat).length;
      const badge = p.querySelector('.cat-count');
      if (badge) badge.textContent = String(n);
    });
    document.querySelectorAll('[data-game-count]').forEach(el => { el.textContent = String(GAMES.length); });
    const mount = $('arcade-stage-mount');
    if (mount) {
      mount.tabIndex = -1;
      mount.addEventListener('click', e => {
        const b = e.target.closest('[data-ov]');
        if (!b) return;
        const what = b.getAttribute('data-ov');
        const id = session ? session.id : null;
        if (what === 'start' && session) session.begin();
        else if (what === 'resume') setPaused(false);
        else if (what === 'restart' && id) launchArcadeGame(id);
        else if (what === 'next' && id) launchArcadeGame(nextGameAfter(id));
        else if (what === 'deck') { stopSession(); showEmptyCabinet(); switchPage('arcade-deck'); }
      });
    }
    refreshSoundButton();
    refreshHud();
    renderGrid();
    renderChat();
    renderRecords();
    window.addEventListener('message', function (e) {
      if (!e || !e.data || typeof e.data.novauraArcadeLaunch !== 'string') return;
      if (GAME_MAP[e.data.novauraArcadeLaunch]) launchArcadeGame(e.data.novauraArcadeLaunch);
    });
    if (window.__NEXUS_INITIAL_GAME__ && GAME_MAP[window.__NEXUS_INITIAL_GAME__]) {
      launchArcadeGame(window.__NEXUS_INITIAL_GAME__);
    }
  }
  function showEmptyCabinet() {
    const mount = $('arcade-stage-mount');
    const tpl = $('arcade-empty-cabinet');
    if (mount && tpl) mount.innerHTML = tpl.innerHTML;
    const title = $('active-game-title'), goal = $('active-game-goal'), controls = $('active-game-controls');
    if (title) title.textContent = 'Pick a game from the deck';
    if (goal) goal.textContent = '';
    if (controls) controls.textContent = 'Goals and controls appear here when a game starts.';
  }
`;
