/**
 * arcadeGamesPart2.js — Tabletop and puzzle games for the Nexus Arcade:
 * Quantum Four (four in a row vs. a minimax AI), Klondike Solitaire,
 * Neon Mahjong (every deal solvable), Synapse Gauntlet (3-stage memory),
 * Singularity Fusion (sliding tile merger) and Zero-Day Sweeper.
 *
 * Plain JavaScript inside a template string (see arcadeGamesEngine.js for the rules).
 */

export const ARCADE_GAMES_PART2_JS = `
  // Small timer shared by the board games: starts on the first move.
  function makeClock(S, onTick) {
    let start = 0, stopped = false;
    const tick = () => { if (stopped) return; onTick(); S.later(tick, 1000); };
    return {
      start() { if (!start) { start = Date.now(); tick(); } },
      seconds() { return start ? Math.floor((Date.now() - start) / 1000) : 0; },
      stop() { stopped = true; },
      label() { const s = this.seconds(); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
    };
  }

  // ══════════ QUANTUM FOUR ══════════
  let fourLevel = 'standard';
  STARTERS.four = function (S) {
    const ROWS = 6, COLS = 7;
    const LEVELS = {
      casual: { label: 'Casual', depth: 2, noise: 140, pts: 1500 },
      standard: { label: 'Standard', depth: 4, noise: 0, pts: 2500 },
      expert: { label: 'Expert', depth: 6, noise: 0, pts: 4000 },
    };
    const board = [];
    for (let r = 0; r < ROWS; r++) board.push([0, 0, 0, 0, 0, 0, 0]);
    let moves = 0, busy = false, done = false, cursor = 3, last = null, winLine = null;

    const bar = S.el('div', 'tt-toolbar', Object.keys(LEVELS).map(k => '<button type="button" class="tt-level' + (k === fourLevel ? ' active' : '') + '" data-level="' + k + '">' + LEVELS[k].label + '</button>').join('') + '<span class="tt-status"></span>');
    const status = bar.querySelector('.tt-status');
    const wrap = S.el('div', 'c4-wrap');
    const preview = S.el('div', 'c4-preview', null, wrap);
    const grid = S.el('div', 'c4-grid', null, wrap);

    const dropRow = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; };
    const validCols = b => [3, 2, 4, 1, 5, 0, 6].filter(c => !b[0][c]);
    function findWin(b, p) {
      const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (b[r][c] !== p) continue;
        for (const d of dirs) {
          const line = [[r, c]];
          for (let k = 1; k < 4; k++) {
            const rr = r + d[0] * k, cc = c + d[1] * k;
            if (rr < 0 || rr >= ROWS || cc >= COLS || b[rr][cc] !== p) break;
            line.push([rr, cc]);
          }
          if (line.length === 4) return line;
        }
      }
      return null;
    }
    function windowScore(cells) {
      let ai = 0, me = 0, empty = 0;
      for (const v of cells) { if (v === 2) ai++; else if (v === 1) me++; else empty++; }
      if (ai && me) return 0;
      if (ai === 3 && empty === 1) return 6;
      if (ai === 2 && empty === 2) return 2;
      if (me === 3 && empty === 1) return -8;
      if (me === 2 && empty === 2) return -2;
      return 0;
    }
    function evaluate(b) {
      let s = 0;
      for (let r = 0; r < ROWS; r++) { if (b[r][3] === 2) s += 4; else if (b[r][3] === 1) s -= 4; }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (c + 3 < COLS) s += windowScore([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]]);
        if (r + 3 < ROWS) s += windowScore([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]]);
        if (r + 3 < ROWS && c + 3 < COLS) s += windowScore([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]]);
        if (r - 3 >= 0 && c + 3 < COLS) s += windowScore([b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]]);
      }
      return s;
    }
    function minimax(b, depth, alpha, beta, aiTurn) {
      if (findWin(b, 2)) return 100000 + depth;
      if (findWin(b, 1)) return -100000 - depth;
      const cols = validCols(b);
      if (!cols.length) return 0;
      if (depth === 0) return evaluate(b);
      let best = aiTurn ? -Infinity : Infinity;
      for (const c of cols) {
        const r = dropRow(b, c);
        b[r][c] = aiTurn ? 2 : 1;
        const v = minimax(b, depth - 1, alpha, beta, !aiTurn);
        b[r][c] = 0;
        if (aiTurn) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
        else { best = Math.min(best, v); beta = Math.min(beta, v); }
        if (alpha >= beta) break;
      }
      return best;
    }
    function aiChoose() {
      const lv = LEVELS[fourLevel];
      let best = null, bestV = -Infinity;
      for (const c of validCols(board)) {
        const r = dropRow(board, c);
        board[r][c] = 2;
        let v = minimax(board, lv.depth - 1, -Infinity, Infinity, false);
        board[r][c] = 0;
        if (lv.noise && Math.abs(v) < 50000) v += (Math.random() - 0.5) * lv.noise;
        if (v > bestV) { bestV = v; best = c; }
      }
      return best;
    }

    function render() {
      preview.innerHTML = '';
      for (let c = 0; c < COLS; c++) {
        const ghost = !busy && !done && c === cursor && board[0][c] === 0;
        preview.innerHTML += '<span class="c4-ghost' + (ghost ? ' on' : '') + '" data-col="' + c + '"></span>';
      }
      let html = '';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const v = board[r][c];
        const isWin = winLine && winLine.some(p => p[0] === r && p[1] === c);
        const isNew = last && last[0] === r && last[1] === c;
        html += '<button type="button" class="c4-cell' + (c === cursor && !done ? ' is-col' : '') + '" data-col="' + c + '" aria-label="Column ' + (c + 1) + '">' +
          (v ? '<span class="c4-disc p' + v + (isNew ? ' is-new' : '') + (isWin ? ' is-win' : '') + '" style="--fall:' + (r + 1) + '"></span>' : '') + '</button>';
      }
      grid.innerHTML = html;
      S.hud('Quantum Four • ' + LEVELS[fourLevel].label, 'Moves ' + moves, 'Best ' + fmt(progressOf('four').best));
    }
    function say(t) { status.textContent = t; }

    function play(c) {
      if (busy || done || c < 0 || c >= COLS) return;
      const r = dropRow(board, c);
      if (r < 0) { S.sfx('error'); return; }
      board[r][c] = 1; moves++; last = [r, c]; cursor = c;
      S.sfx('move');
      winLine = findWin(board, 1);
      if (winLine) {
        done = true; render(); say('Four in a row! You win.');
        S.end(true, LEVELS[fourLevel].pts + (42 - moves) * 25, 'Quantum Four: you win!', 'You beat the ' + LEVELS[fourLevel].label + ' AI in ' + moves + ' moves.', 1100);
        return;
      }
      if (!validCols(board).length) { done = true; render(); say('Board full: a draw.'); S.end(false, 500, 'A draw', 'Nobody connected four. Rematch?', 900); return; }
      busy = true; render(); say('The Nexus AI is thinking…');
      S.later(() => {
        const ac = aiChoose();
        const ar = dropRow(board, ac);
        board[ar][ac] = 2; last = [ar, ac];
        S.sfx('flip');
        winLine = findWin(board, 2);
        busy = false;
        if (winLine) {
          done = true; render(); say('The AI connected four.');
          S.end(false, moves * 20, 'The AI wins this round', 'It found four in a row. Try Casual, or look for its threats sooner.', 1300);
          return;
        }
        if (!validCols(board).length) { done = true; render(); say('Board full: a draw.'); S.end(false, 500, 'A draw', 'Nobody connected four. Rematch?', 900); return; }
        render(); say('Your move (cyan).');
      }, 420);
    }

    S.on(grid, 'click', e => { const b = e.target.closest('[data-col]'); if (b) play(Number(b.getAttribute('data-col'))); });
    S.on(preview, 'click', e => { const b = e.target.closest('[data-col]'); if (b) play(Number(b.getAttribute('data-col'))); });
    S.on(grid, 'mouseover', e => {
      const b = e.target.closest('[data-col]');
      if (b && !done) { const c = Number(b.getAttribute('data-col')); if (c !== cursor) { cursor = c; last = null; render(); } }
    });
    S.on(bar, 'click', e => {
      const b = e.target.closest('[data-level]');
      if (!b) return;
      fourLevel = b.getAttribute('data-level');
      launchArcadeGame('four');
    });
    S.onKey((a, e) => {
      if (a === 'left') { cursor = (cursor + COLS - 1) % COLS; last = null; render(); }
      else if (a === 'right') { cursor = (cursor + 1) % COLS; last = null; render(); }
      else if (a === 'fire' || a === 'down') play(cursor);
      else { const n = Number(e.key); if (n >= 1 && n <= 7) play(n - 1); }
    });
    render();
    say('Your move (cyan). Drop a disc in any column.');
  };

  // ══════════ KLONDIKE SOLITAIRE ══════════
  STARTERS.solitaire = function (S) {
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const red = c => c.s === 1 || c.s === 2;
    let st = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], score: 0, moves: 0 };
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s: s, r: r, up: false });
    shuffle(deck);
    for (let c = 0; c < 7; c++) for (let k = 0; k <= c; k++) { const card = deck.pop(); card.up = k === c; st.tab[c].push(card); }
    st.stock = deck;
    let sel = null, targets = [], undo = [], finishing = false, won = false;
    const clock = makeClock(S, () => hud());

    const root = S.el('div', 'sol-wrap');
    const snapshot = () => JSON.stringify(st);
    const pushUndo = () => { undo.push(snapshot()); if (undo.length > 300) undo.shift(); };
    function hud() { S.hud('Moves ' + st.moves + ' • ' + clock.label(), fmt(st.score) + ' pts', 'Best ' + fmt(progressOf('solitaire').best)); }

    const canFound = (card, pile) => pile.length ? (pile[pile.length - 1].s === card.s && pile[pile.length - 1].r === card.r - 1) : card.r === 1;
    const canStack = (card, pile) => {
      if (!pile.length) return card.r === 13;
      const top = pile[pile.length - 1];
      return top.up && red(top) !== red(card) && top.r === card.r + 1;
    };
    function sourceCards(from, i, idx) {
      if (from === 'tab') { const p = st.tab[i]; return idx >= 0 && p[idx] && p[idx].up ? p.slice(idx) : null; }
      if (from === 'waste') return st.waste.length && idx === st.waste.length - 1 ? [st.waste[idx]] : null;
      if (from === 'found') { const p = st.found[i]; return p.length && idx === p.length - 1 ? [p[idx]] : null; }
      return null;
    }
    function findTargets(from, i, cards) {
      const out = [];
      if (cards.length === 1 && from !== 'found') st.found.forEach((p, k) => { if (canFound(cards[0], p)) out.push({ to: 'found', i: k }); });
      let emptySeen = false;
      st.tab.forEach((p, k) => {
        if (from === 'tab' && k === i) return;
        if (!canStack(cards[0], p)) return;
        if (!p.length) { if (emptySeen) return; emptySeen = true; }
        out.push({ to: 'tab', i: k });
      });
      return out;
    }
    function flipTops() {
      st.tab.forEach(p => { if (p.length && !p[p.length - 1].up) { p[p.length - 1].up = true; st.score += 5; } });
    }
    function doMove(from, i, idx, t) {
      pushUndo();
      let cards;
      if (from === 'tab') cards = st.tab[i].splice(idx);
      else if (from === 'waste') cards = [st.waste.pop()];
      else cards = [st.found[i].pop()];
      if (t.to === 'found') st.found[t.i].push(cards[0]); else st.tab[t.i].push.apply(st.tab[t.i], cards);
      if (from === 'waste') st.score += t.to === 'found' ? 10 : 5;
      else if (from === 'tab' && t.to === 'found') st.score += 10;
      else if (from === 'found') st.score = Math.max(0, st.score - 15);
      st.moves++;
      flipTops();
      clock.start();
      S.sfx(t.to === 'found' ? 'match' : 'flip');
      sel = null; targets = [];
      checkWin();
      render();
    }
    function draw() {
      pushUndo();
      clock.start();
      if (st.stock.length) { const c = st.stock.pop(); c.up = true; st.waste.push(c); S.sfx('flip'); }
      else if (st.waste.length) { while (st.waste.length) { const c = st.waste.pop(); c.up = false; st.stock.push(c); } st.score = Math.max(0, st.score - 50); S.sfx('move'); }
      else { undo.pop(); return; }
      st.moves++; sel = null; targets = [];
      render();
    }
    function checkWin() {
      if (won || st.found.reduce((n, p) => n + p.length, 0) < 52) return;
      won = true;
      clock.stop();
      const bonus = Math.max(0, 2000 - clock.seconds() * 2);
      S.end(true, st.score + 1000 + bonus, 'Solitaire solved!', 'All four suits built in ' + st.moves + ' moves and ' + clock.label() + ' (time bonus +' + fmt(bonus) + ').', 700);
    }
    const canAutoFinish = () => !st.stock.length && !st.waste.length && st.tab.every(p => p.every(c => c.up)) && !won;
    function autoFinish() {
      if (finishing) return;
      finishing = true;
      const step = () => {
        if (!S.alive || won) return;
        let bestPile = -1, bestRank = 99;
        st.tab.forEach((p, k) => { if (p.length) { const c = p[p.length - 1]; if (c.r < bestRank && st.found.some(f => canFound(c, f))) { bestRank = c.r; bestPile = k; } } });
        if (bestPile < 0) { finishing = false; render(); return; }
        const c = st.tab[bestPile][st.tab[bestPile].length - 1];
        const fi = st.found.findIndex(f => canFound(c, f));
        doMove('tab', bestPile, st.tab[bestPile].length - 1, { to: 'found', i: fi });
        S.later(step, 85);
      };
      step();
    }

    function cardHtml(c, pile, idx, top, extra) {
      if (!c.up) return '<div class="sol-card is-down" data-pile="' + pile + '" data-idx="' + idx + '" style="top:' + top + 'px"></div>';
      const isSel = sel && sel.pile === pile && idx >= sel.idx;
      return '<div class="sol-card is-up ' + (red(c) ? 'red' : 'black') + (isSel ? ' is-sel' : '') + (extra || '') + '" data-pile="' + pile + '" data-idx="' + idx + '" style="top:' + top + 'px">' +
        '<span class="sc-corner">' + RANKS[c.r] + '<i>' + SUITS[c.s] + '</i></span><span class="sc-mid">' + SUITS[c.s] + '</span></div>';
    }
    function render() {
      const cw = Math.max(36, Math.min(66, ((root.clientWidth || 560) - 60) / 7));
      const ch = Math.round(cw * 1.4), fd = Math.round(cw * 0.16), fu = Math.round(cw * 0.36);
      root.style.setProperty('--cw', cw + 'px');
      const isT = (to, i) => targets.some(t => t.to === to && t.i === i);
      let html = '<div class="sol-top"><div class="sol-row">';
      html += '<div class="sol-slot sol-stock" data-pile="stock" data-idx="0">' + (st.stock.length ? '<div class="sol-card is-down" data-pile="stock" data-idx="0" style="top:0"><span class="sol-count">' + st.stock.length + '</span></div>' : '<span class="sol-recycle">↻</span>') + '</div>';
      html += '<div class="sol-slot" data-pile="waste" data-idx="-1">' + (st.waste.length ? cardHtml(st.waste[st.waste.length - 1], 'waste', st.waste.length - 1, 0) : '') + '</div>';
      html += '</div><div class="sol-row">';
      st.found.forEach((p, k) => {
        html += '<div class="sol-slot sol-found' + (isT('found', k) ? ' is-target' : '') + '" data-pile="found-' + k + '" data-idx="-1"><span class="sol-ghost">A</span>' +
          (p.length ? cardHtml(p[p.length - 1], 'found-' + k, p.length - 1, 0) : '') + '</div>';
      });
      html += '</div></div><div class="sol-tableau">';
      st.tab.forEach((p, k) => {
        let top = 0, cards = '';
        p.forEach((c, idx) => { cards += cardHtml(c, 'tab-' + k, idx, top); top += c.up ? fu : fd; });
        const height = (p.length ? top - (p[p.length - 1].up ? fu : fd) : 0) + ch;
        html += '<div class="sol-col' + (isT('tab', k) ? ' is-target' : '') + '" data-pile="tab-' + k + '" data-idx="-1" style="height:' + height + 'px">' + (p.length ? '' : '<span class="sol-ghost">K</span>') + cards + '</div>';
      });
      html += '</div><div class="sol-bar"><button type="button" class="arcade-btn-secondary" data-act="undo"' + (undo.length ? '' : ' disabled') + '>↶ Undo</button>' +
        '<button type="button" class="arcade-btn-secondary" data-act="new">New deal</button>' +
        (canAutoFinish() ? '<button type="button" class="arcade-btn-primary" data-act="finish">⚡ Auto-finish</button>' : '') +
        '<span class="sol-hint">' + (sel ? 'Pick a highlighted pile for the selected cards, or click elsewhere to cancel.' : 'Click a card to move it. Click the deck to draw.') + '</span></div>';
      root.innerHTML = html;
      hud();
    }

    S.on(root, 'click', e => {
      if (won || finishing) return;
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.getAttribute('data-act');
        if (a === 'undo' && undo.length) { st = JSON.parse(undo.pop()); sel = null; targets = []; S.sfx('move'); render(); }
        else if (a === 'new') launchArcadeGame('solitaire');
        else if (a === 'finish') autoFinish();
        return;
      }
      const el = e.target.closest('[data-pile]');
      if (!el) { if (sel) { sel = null; targets = []; render(); } return; }
      const key = el.getAttribute('data-pile');
      const idx = Number(el.getAttribute('data-idx'));
      if (key === 'stock') { draw(); return; }
      const parts = key.split('-');
      const from = parts[0], i = Number(parts[1] || 0);
      if (sel) {
        const t = targets.find(x => x.to === from && x.i === i);
        if (t) { doMove(sel.from, sel.i, sel.idx, t); return; }
        sel = null; targets = [];
      }
      const cards = sourceCards(from, i, idx === -1 && from !== 'tab' ? (from === 'waste' ? st.waste.length - 1 : st.found[i].length - 1) : idx);
      if (!cards) { render(); return; }
      const realIdx = from === 'tab' ? idx : (from === 'waste' ? st.waste.length - 1 : st.found[i].length - 1);
      const ts = findTargets(from, i, cards);
      if (!ts.length) {
        S.sfx('error');
        el.classList.add('is-shake');
        setTimeout(() => el.classList.remove('is-shake'), 300);
        return;
      }
      const toFound = ts.find(t => t.to === 'found');
      if (toFound) { doMove(from, i, realIdx, toFound); return; }
      if (ts.length === 1) { doMove(from, i, realIdx, ts[0]); return; }
      sel = { from: from, i: i, idx: realIdx, pile: key };
      targets = ts;
      S.sfx('click');
      render();
    });
    S.on(window, 'resize', () => render());
    render();
  };

  // ══════════ NEON MAHJONG ══════════
  STARTERS.mahjong = function (S) {
    const SYMBOLS = [
      { id: 'dr', glyph: '🐉', name: 'Dragon' }, { id: 'jd', glyph: '🟢', name: 'Jade' }, { id: 'pe', glyph: '💎', name: 'Pearl' },
      { id: 'wi', glyph: '🌪️', name: 'Wind' }, { id: 'wa', glyph: '🌊', name: 'Wave' }, { id: 'fl', glyph: '🔥', name: 'Flame' },
      { id: 'bo', glyph: '⚡', name: 'Bolt' }, { id: 'ba', glyph: '🎋', name: 'Bamboo' }, { id: 'co', glyph: '🪙', name: 'Coin' },
      { id: 'or', glyph: '🔮', name: 'Orb' }, { id: 'lo', glyph: '🌸', name: 'Lotus' }, { id: 'mo', glyph: '🌙', name: 'Moon' },
    ];
    const SPOTS = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) SPOTS.push({ layer: 0, r: r, c: c });
    for (let r = 1; r <= 2; r++) for (let c = 1; c <= 6; c++) SPOTS.push({ layer: 1, r: r, c: c });
    for (let r = 1; r <= 2; r++) for (let c = 3; c <= 4; c++) SPOTS.push({ layer: 2, r: r, c: c });

    function freeIn(t, list) {
      if (list.some(o => !o.gone && o !== t && o.layer > t.layer && o.r === t.r && o.c === t.c)) return false;
      const left = list.some(o => !o.gone && o.layer === t.layer && o.r === t.r && o.c === t.c - 1);
      const right = list.some(o => !o.gone && o.layer === t.layer && o.r === t.r && o.c === t.c + 1);
      return !(left && right);
    }
    // Deal by removing random free pairs from the full layout; matching them in
    // reverse is always possible, so every deal can be solved.
    function deal(spots, symbolPairs) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const live = spots.map(p => ({ layer: p.layer, r: p.r, c: p.c, gone: false, sym: null }));
        const order = [];
        let ok = true;
        while (live.some(t => !t.gone)) {
          const free = shuffle(live.filter(t => !t.gone && freeIn(t, live)));
          if (free.length < 2) { ok = false; break; }
          free[0].gone = free[1].gone = true;
          order.push([free[0], free[1]]);
        }
        if (!ok) continue;
        const syms = shuffle(symbolPairs.slice());
        order.forEach((pair, k) => { pair[0].sym = syms[k]; pair[1].sym = syms[k]; });
        live.forEach(t => { t.gone = false; });
        return live;
      }
      return null;
    }
    const pairs = [];
    SYMBOLS.forEach(s => { pairs.push(s, s); });
    let tiles = deal(SPOTS, pairs);
    tiles.forEach((t, i) => { t.uid = i; });
    let selected = null, hint = null, score = 0, history = [], lastMatch = 0, done = false;
    const clock = makeClock(S, () => hud());

    const bar = S.el('div', 'mj-toolbar', '<button type="button" class="arcade-btn-secondary" data-act="hint">💡 Hint</button>' +
      '<button type="button" class="arcade-btn-secondary" data-act="undo">↶ Undo</button>' +
      '<button type="button" class="arcade-btn-secondary" data-act="shuffle">🔀 Shuffle (−200)</button><span class="mj-msg"></span>');
    const msg = bar.querySelector('.mj-msg');
    const holder = S.el('div', 'mj-holder');
    const boardEl = S.el('div', 'mj-board', null, holder);
    const TW = 56, TH = 72, SX = 60, SY = 76;
    const boardW = 7 * SX + TW + 20, boardH = 3 * SY + TH + 24;
    boardEl.style.width = boardW + 'px';
    boardEl.style.height = boardH + 'px';

    const live = () => tiles.filter(t => !t.gone);
    function pairsNow() {
      const free = live().filter(t => freeIn(t, tiles)), out = [];
      for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (free[i].sym.id === free[j].sym.id) out.push([free[i], free[j]]);
      return out;
    }
    const freePairs = () => pairsNow()[0] || null;
    // A hint only suggests a pair that still leaves the board winnable (a bounded search).
    function smartHint() {
      const options = pairsNow();
      if (!options.length) return { pair: null, dead: true };
      let budget = 3000;
      const seen = new Set();
      function winnable() {
        if (!tiles.some(t => !t.gone)) return true;
        if (--budget < 0) return null;
        const key = tiles.map(t => (t.gone ? 1 : 0)).join('');
        if (seen.has(key)) return false;
        seen.add(key);
        let unknown = false;
        for (const p of pairsNow()) {
          p[0].gone = p[1].gone = true;
          const r = winnable();
          p[0].gone = p[1].gone = false;
          if (r) return true;
          if (r === null) unknown = true;
        }
        return unknown ? null : false;
      }
      let fallback = null;
      for (const p of options) {
        p[0].gone = p[1].gone = true;
        const r = winnable();
        p[0].gone = p[1].gone = false;
        if (r === true) return { pair: p, sure: true };
        if (r === null && !fallback) fallback = p;
      }
      return { pair: fallback, sure: false, dead: !fallback };
    }
    function hud() { S.hud('Tiles ' + live().length + ' / 48 • ' + clock.label(), fmt(score) + ' pts', 'Best ' + fmt(progressOf('mahjong').best)); }
    function fit() {
      const avail = (holder.clientWidth || boardW) - 4;
      const k = Math.min(1, avail / boardW);
      boardEl.style.transform = 'scale(' + k.toFixed(3) + ')';
      holder.style.height = Math.ceil(boardH * k) + 'px';
    }
    function render() {
      boardEl.innerHTML = tiles.filter(t => !t.gone).map(t => {
        const free = freeIn(t, tiles);
        const left = 10 + t.c * SX - t.layer * 5, top = 14 + t.r * SY - t.layer * 7;
        return '<button type="button" class="mj-tile layer-' + t.layer + (free ? ' is-free' : ' is-locked') + (selected === t ? ' is-selected' : '') +
          (hint && hint.indexOf(t) !== -1 ? ' is-hint' : '') + '" data-uid="' + t.uid + '" style="left:' + left + 'px;top:' + top + 'px;z-index:' + (t.layer * 100 + t.r * 10 + t.c) + '">' +
          '<span class="mj-glyph">' + t.sym.glyph + '</span><small>' + t.sym.name + '</small></button>';
      }).join('');
      hud();
      fit();
      if (!done && live().length && !freePairs()) msg.textContent = 'No free pairs left: shuffle the remaining tiles.';
    }

    S.on(boardEl, 'click', e => {
      if (done) return;
      const b = e.target.closest('[data-uid]');
      if (!b) return;
      const t = tiles[Number(b.getAttribute('data-uid'))];
      if (!freeIn(t, tiles)) { S.sfx('error'); b.classList.add('is-shake'); setTimeout(() => b.classList.remove('is-shake'), 300); msg.textContent = 'That tile is blocked: something sits on it, or both sides are covered.'; return; }
      clock.start();
      hint = null;
      if (!selected || selected === t) { selected = selected === t ? null : t; S.sfx('click'); render(); return; }
      if (selected.sym.id !== t.sym.id) { selected = t; S.sfx('click'); render(); return; }
      const now = Date.now();
      const combo = now - lastMatch < 4000;
      lastMatch = now;
      selected.gone = t.gone = true;
      history.push([selected, t]);
      score += 100 + (combo ? 50 : 0);
      msg.textContent = combo ? 'Combo! +150' : 'Matched +100';
      selected = null;
      S.sfx('match');
      if (!live().length) {
        done = true; clock.stop(); render();
        const bonus = Math.max(0, 1500 - clock.seconds() * 3);
        S.end(true, score + 1000 + bonus, 'Pyramid cleared!', 'All 48 tiles matched in ' + clock.label() + ' (time bonus +' + fmt(bonus) + ').', 500);
        return;
      }
      render();
    });
    S.on(bar, 'click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || done) return;
      const a = b.getAttribute('data-act');
      if (a === 'hint') {
        const h = smartHint();
        hint = h.pair;
        msg.textContent = h.sure ? 'Try these two: the board stays winnable.' : hint ? 'Try these two.' : h.dead && pairsNow().length ? 'No pair here leads to a win: shuffle the tiles.' : 'No free pairs: shuffle.';
        S.sfx(hint ? 'pickup' : 'error');
        render();
      } else if (a === 'undo') {
        const last = history.pop();
        if (!last) return;
        last[0].gone = last[1].gone = false;
        score = Math.max(0, score - 100);
        selected = null; hint = null;
        msg.textContent = 'Pair restored.';
        S.sfx('move');
        render();
      } else if (a === 'shuffle') {
        const rest = live();
        const restPairs = [];
        const bySym = {};
        rest.forEach(t => { (bySym[t.sym.id] = bySym[t.sym.id] || []).push(t.sym); });
        Object.keys(bySym).forEach(k => { for (let i = 0; i < bySym[k].length; i += 2) restPairs.push(bySym[k][i]); });
        const redealt = deal(rest, restPairs);
        if (!redealt) { msg.textContent = 'Could not reshuffle.'; return; }
        rest.forEach((t, i) => { t.sym = redealt[i].sym; });
        history = [];
        score = Math.max(0, score - 200);
        selected = null; hint = null;
        msg.textContent = 'Shuffled. Every arrangement can still be cleared.';
        S.sfx('power');
        render();
      }
    });
    S.on(window, 'resize', fit);
    render();
  };

  // ══════════ SYNAPSE GAUNTLET ══════════
  STARTERS.memory = function (S) {
    let score = 0, sparks = 3, stage = 0, done = false;
    const head = S.el('div', 'mem-header');
    const area = S.el('div', 'mem-area');
    function hud() { S.hud('Stage ' + stage + ' / 3', fmt(score) + ' pts', 'Sparks ' + hearts(sparks)); }
    function title(t) { head.textContent = t; hud(); }
    function loseSpark(why, retry) {
      sparks--;
      S.sfx('error');
      hud();
      if (sparks <= 0) { done = true; S.end(false, score, 'Out of sparks', why + ' You reached stage ' + stage + '.', 600); return; }
      title(why + ' ' + sparks + ' spark' + (sparks === 1 ? '' : 's') + ' left.');
      S.later(retry, 1100);
    }
    function interlude(text, next) {
      area.innerHTML = '<div class="mem-interlude">' + esc(text) + '</div>';
      S.sfx('level');
      S.later(next, 1300);
    }

    // Stage 1: pairs
    function stage1() {
      stage = 1;
      title('Stage 1 / 3 • Glyph pairs: find all 8 pairs.');
      const glyphs = shuffle(['⚛️', '🧬', '🔮', '⚡', '🪐', '💠', '🌙', '🔥', '⚛️', '🧬', '🔮', '⚡', '🪐', '💠', '🌙', '🔥']);
      area.innerHTML = '<div class="mem-grid">' + glyphs.map((g, i) => '<button type="button" class="mem-card" data-i="' + i + '"><span class="mem-face mem-back">✦</span><span class="mem-face mem-front">' + g + '</span></button>').join('') + '</div>';
      const cards = area.querySelectorAll('.mem-card');
      let open = [], matched = 0, moves = 0, lock = false;
      area.onclick = e => {
        const b = e.target.closest('.mem-card');
        if (!b || lock || b.classList.contains('is-up')) return;
        b.classList.add('is-up');
        S.sfx('flip');
        open.push(Number(b.getAttribute('data-i')));
        if (open.length < 2) return;
        moves++;
        lock = true;
        const a = open[0], c = open[1];
        open = [];
        if (glyphs[a] === glyphs[c]) {
          cards[a].classList.add('is-matched'); cards[c].classList.add('is-matched');
          matched++;
          S.sfx('match');
          lock = false;
          if (matched === 8) {
            const pts = Math.max(300, 1600 - moves * 40);
            score += pts;
            area.onclick = null;
            S.later(() => interlude('Stage 1 clear in ' + moves + ' moves: +' + pts, stage2), 500);
          }
        } else {
          S.later(() => { cards[a].classList.remove('is-up'); cards[c].classList.remove('is-up'); lock = false; }, 700);
        }
        hud();
      };
    }

    // Stage 2: echo a growing sequence
    function stage2() {
      stage = 2;
      const NOTES = [329.6, 392, 493.9, 587.3];
      const COLORS = ['#38bdf8', '#a855f7', '#34d399', '#f97316'];
      area.innerHTML = '<div class="simon-grid">' + [0, 1, 2, 3].map(p => '<button type="button" class="simon-pad" style="--pad-color:' + COLORS[p] + '" data-pad="' + p + '"></button>').join('') + '</div>';
      const pads = area.querySelectorAll('.simon-pad');
      const seq = [randInt(0, 3), randInt(0, 3), randInt(0, 3)];
      let step = 0, listening = false;
      const light = (p, ms) => { pads[p].classList.add('is-lit'); S.tone(NOTES[p], ms / 1000); S.later(() => pads[p].classList.remove('is-lit'), ms); };
      function playback() {
        listening = false; step = 0;
        title('Stage 2 / 3 • Echo: watch and listen to ' + seq.length + ' notes.');
        seq.forEach((p, i) => S.later(() => light(p, 340), 600 + i * 560));
        S.later(() => { listening = true; title('Stage 2 / 3 • Your turn: repeat all ' + seq.length + ' notes.'); }, 600 + seq.length * 560);
      }
      area.onclick = e => {
        const b = e.target.closest('.simon-pad');
        if (!b || !listening) return;
        const p = Number(b.getAttribute('data-pad'));
        light(p, 200);
        if (p !== seq[step]) { listening = false; loseSpark('Wrong note.', playback); return; }
        step++;
        if (step < seq.length) return;
        listening = false;
        score += 150 * seq.length;
        hud();
        if (seq.length >= 7) { area.onclick = null; S.later(() => interlude('Stage 2 clear: the full 7-note echo!', stage3), 500); return; }
        seq.push(randInt(0, 3));
        S.sfx('pickup');
        S.later(playback, 700);
      };
      playback();
    }

    // Stage 3: remember where the numbers were
    function stage3() {
      stage = 3;
      let round = 0;
      const COUNTS = [5, 6, 7];
      function playRound() {
        const n = COUNTS[round];
        const cells = shuffle(Array.from({ length: 20 }, (_, i) => i)).slice(0, n);
        const at = {};
        cells.forEach((cell, k) => { at[cell] = k + 1; });
        let next = 1, hidden = false;
        title('Stage 3 / 3 • Flash ' + (round + 1) + ' of 3: memorize 1 to ' + n + ', then click them in order.');
        area.innerHTML = '<div class="flash-grid">' + Array.from({ length: 20 }, (_, i) => at[i] ? '<button type="button" class="flash-cell" data-cell="' + i + '">' + at[i] + '</button>' : '<span class="flash-empty"></span>').join('') + '</div>';
        const hide = () => { if (hidden) return; hidden = true; area.querySelectorAll('.flash-cell').forEach(b => { if (!b.classList.contains('is-done')) b.classList.add('is-hidden'); }); };
        S.later(hide, 1400 + n * 300);
        area.onclick = e => {
          const b = e.target.closest('.flash-cell');
          if (!b || b.classList.contains('is-done')) return;
          const v = at[Number(b.getAttribute('data-cell'))];
          if (v !== next) { area.onclick = null; b.classList.add('is-wrong'); loseSpark('Wrong order.', playRound); return; }
          hide();
          b.classList.remove('is-hidden');
          b.classList.add('is-done');
          S.tone(400 + next * 60, 0.12);
          score += 100;
          next++;
          hud();
          if (next <= n) return;
          area.onclick = null;
          round++;
          if (round >= COUNTS.length) {
            done = true;
            score += sparks * 500;
            S.end(true, score, 'Synapse Gauntlet mastered!', 'Pairs, echo and flash: all three stages cleared with ' + sparks + ' spark' + (sparks === 1 ? '' : 's') + ' left (+' + sparks * 500 + ').', 500);
          } else {
            S.sfx('pickup');
            S.later(playRound, 800);
          }
        };
      }
      playRound();
    }
    stage1();
  };

  // ══════════ SINGULARITY FUSION ══════════
  STARTERS.fusion = function (S) {
    const N = 4, GOAL = 1024;
    let tiles = [], nextId = 1, score = 0, busy = false, done = false;
    const board = S.el('div', 'fz-board');
    board.innerHTML = Array.from({ length: N * N }, (_, i) => '<span class="fz-cell" style="--r:' + Math.floor(i / N) + ';--c:' + (i % N) + '"></span>').join('');
    S.el('p', 'fz-hint', 'Arrow keys or WASD • swipe on touch screens • reach ' + GOAL + ' to beat it');
    const best = () => tiles.reduce((m, t) => Math.max(m, t.v), 0);
    function hud() { S.hud('Biggest core ' + best() + ' / ' + GOAL, fmt(score) + ' pts', 'Best ' + fmt(progressOf('fusion').best)); }
    function paint(t) {
      t.el.textContent = String(t.v);
      t.el.className = 'fz-tile v' + Math.min(t.v, 4096) + (t.v >= 1000 ? ' d4' : t.v >= 100 ? ' d3' : '');
      t.el.style.setProperty('--r', t.r);
      t.el.style.setProperty('--c', t.c);
    }
    function spawn() {
      const used = {};
      tiles.forEach(t => { used[t.r * N + t.c] = true; });
      const empty = [];
      for (let i = 0; i < N * N; i++) if (!used[i]) empty.push(i);
      if (!empty.length) return;
      const at = pick(empty);
      const t = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r: Math.floor(at / N), c: at % N, el: document.createElement('div') };
      paint(t);
      t.el.classList.add('fz-new');
      board.appendChild(t.el);
      tiles.push(t);
    }
    function canMove() {
      if (tiles.length < N * N) return true;
      const g = {};
      tiles.forEach(t => { g[t.r + ',' + t.c] = t.v; });
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = g[r + ',' + c];
        if (g[r + ',' + (c + 1)] === v || g[(r + 1) + ',' + c] === v) return true;
      }
      return false;
    }
    function move(dir) {
      if (busy || done) return;
      const d = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
      if (!d) return;
      const at = {};
      tiles.forEach(t => { at[t.r + ',' + t.c] = t; t.merged = false; t.dead = false; });
      const rows = [0, 1, 2, 3], cols = [0, 1, 2, 3];
      if (d[0] === 1) rows.reverse();
      if (d[1] === 1) cols.reverse();
      let moved = false;
      for (const r of rows) for (const c of cols) {
        const t = at[r + ',' + c];
        if (!t) continue;
        delete at[r + ',' + c];
        let nr = r, nc = c;
        while (true) {
          const tr = nr + d[0], tc = nc + d[1];
          if (tr < 0 || tr >= N || tc < 0 || tc >= N || at[tr + ',' + tc]) break;
          nr = tr; nc = tc;
        }
        const o = at[(nr + d[0]) + ',' + (nc + d[1])];
        if (o && o.v === t.v && !o.merged) {
          t.r = o.r; t.c = o.c; t.dead = true;
          o.v *= 2; o.merged = true;
          score += o.v;
          moved = true;
        } else {
          if (nr !== r || nc !== c) moved = true;
          t.r = nr; t.c = nc;
          at[nr + ',' + nc] = t;
        }
      }
      if (!moved) return;
      busy = true;
      S.sfx('move');
      tiles.forEach(t => { t.el.style.setProperty('--r', t.r); t.el.style.setProperty('--c', t.c); t.el.classList.remove('fz-new'); });
      S.later(() => {
        tiles.filter(t => t.dead).forEach(t => t.el.remove());
        tiles = tiles.filter(t => !t.dead);
        let merges = 0;
        tiles.forEach(t => { if (t.merged) { merges++; paint(t); void t.el.offsetWidth; t.el.classList.add('fz-pop'); } });
        if (merges) S.sfx(merges > 1 ? 'match' : 'pickup');
        spawn();
        busy = false;
        hud();
        if (best() >= GOAL) { done = true; S.end(true, score + 2000, 'Singularity reached!', 'You fused a ' + best() + ' core (+2,000).', 600); return; }
        if (!canMove()) { done = true; S.end(false, score, 'Grid locked', 'No merges left. Your biggest core was ' + best() + '.', 600); }
      }, 120);
    }
    S.onKey(a => { if (a === 'left' || a === 'right' || a === 'up' || a === 'down') move(a); });
    let swipe = null;
    S.on(board, 'pointerdown', e => { swipe = { x: e.clientX, y: e.clientY }; });
    S.on(window, 'pointerup', e => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    spawn(); spawn();
    hud();
  };

  // ══════════ ZERO-DAY SWEEPER ══════════
  STARTERS.sweeper = function (S) {
    const COLS = 12, ROWS = 10, MINES = 18;
    const cells = Array.from({ length: COLS * ROWS }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    let started = false, done = false, flagMode = false, boomAt = -1, pressTimer = 0, suppressClick = false;
    const clock = makeClock(S, () => hud());
    const bar = S.el('div', 'sw-toolbar', '<button type="button" class="arcade-btn-secondary" data-act="flag">🔍 Opening (tap to switch to flags)</button><span class="sw-note">Right-click or long-press to flag</span>');
    const grid = S.el('div', 'sw-grid');
    grid.style.setProperty('--cols', COLS);
    const neighbours = i => {
      const r = Math.floor(i / COLS), c = i % COLS, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(rr * COLS + cc);
      }
      return out;
    };
    const flags = () => cells.filter(c => c.flag).length;
    const safeOpen = () => cells.filter(c => c.open && !c.mine).length;
    function hud() { S.hud('Exploits ' + (MINES - flags()) + ' • ' + clock.label(), 'Safe ' + safeOpen() + ' / ' + (COLS * ROWS - MINES), 'Best ' + fmt(progressOf('sweeper').best)); }
    function plant(first) {
      const safe = neighbours(first).concat([first]);
      let placed = 0;
      while (placed < MINES) {
        const i = randInt(0, COLS * ROWS - 1);
        if (cells[i].mine || safe.indexOf(i) !== -1) continue;
        cells[i].mine = true;
        placed++;
      }
      cells.forEach((c, i) => { c.n = neighbours(i).filter(j => cells[j].mine).length; });
    }
    function open(i) {
      const stack = [i];
      while (stack.length) {
        const k = stack.pop();
        const c = cells[k];
        if (c.open || c.flag) continue;
        c.open = true;
        if (c.mine) { boomAt = k; return false; }
        if (c.n === 0) neighbours(k).forEach(j => { if (!cells[j].open) stack.push(j); });
      }
      return true;
    }
    function lose() {
      done = true;
      clock.stop();
      cells.forEach(c => { if (c.mine) c.open = true; });
      render();
      S.sfx('boom');
      S.end(false, safeOpen() * 10, 'Exploit triggered', 'You cleared ' + safeOpen() + ' of ' + (COLS * ROWS - MINES) + ' safe cells.', 900);
    }
    function checkWin() {
      if (safeOpen() !== COLS * ROWS - MINES) return;
      done = true;
      clock.stop();
      cells.forEach(c => { if (c.mine) c.flag = true; });
      render();
      S.end(true, Math.max(1000, 6000 - clock.seconds() * 15), 'Grid secured!', 'All 18 exploits isolated in ' + clock.label() + '.', 600);
    }
    function reveal(i) {
      if (done) return;
      const c = cells[i];
      if (!started) { started = true; plant(i); clock.start(); }
      if (c.open && c.n > 0) {
        const around = neighbours(i);
        if (around.filter(j => cells[j].flag).length !== c.n) return;
        let ok = true;
        around.forEach(j => { if (ok && !cells[j].flag && !cells[j].open) ok = open(j); });
        if (!ok) { lose(); return; }
        S.sfx('flip');
        render(); checkWin();
        return;
      }
      if (c.open || c.flag) return;
      if (!open(i)) { lose(); return; }
      S.sfx(c.n === 0 ? 'pickup' : 'click');
      render(); checkWin();
    }
    function toggleFlag(i) {
      if (done || cells[i].open) return;
      cells[i].flag = !cells[i].flag;
      S.sfx('move');
      render();
    }
    function render() {
      grid.innerHTML = cells.map((c, i) => {
        let cls = 'sw-cell', label = '';
        if (c.open) {
          cls += ' is-open';
          if (c.mine) { cls += i === boomAt ? ' is-boom' : ' is-mine'; label = '💣'; }
          else if (c.n) { cls += ' n' + c.n; label = String(c.n); }
        } else if (c.flag) {
          cls += ' is-flag' + (done && !c.mine ? ' is-wrongflag' : '');
          label = '🚩';
        }
        return '<button type="button" class="' + cls + '" data-i="' + i + '">' + label + '</button>';
      }).join('');
      hud();
    }
    S.on(grid, 'click', e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      if (suppressClick) { suppressClick = false; return; }
      const i = Number(b.getAttribute('data-i'));
      if (flagMode && !cells[i].open) toggleFlag(i); else reveal(i);
    });
    S.on(grid, 'contextmenu', e => { const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault(); toggleFlag(Number(b.getAttribute('data-i'))); });
    S.on(grid, 'pointerdown', e => {
      suppressClick = false;
      const b = e.target.closest('[data-i]');
      if (!b || e.pointerType === 'mouse') return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { suppressClick = true; toggleFlag(Number(b.getAttribute('data-i'))); }, 430);
    });
    const cancelPress = () => clearTimeout(pressTimer);
    S.on(grid, 'pointerup', cancelPress);
    S.on(grid, 'pointercancel', cancelPress);
    S.on(grid, 'pointerleave', cancelPress);
    S.cleanups.push(cancelPress);
    S.on(bar, 'click', e => {
      const b = e.target.closest('[data-act="flag"]');
      if (!b) return;
      flagMode = !flagMode;
      b.textContent = flagMode ? '🚩 Flagging (tap to switch to opening)' : '🔍 Opening (tap to switch to flags)';
      b.classList.toggle('active', flagMode);
    });
    render();
  };
`;
