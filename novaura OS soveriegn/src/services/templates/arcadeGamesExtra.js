/**
 * arcadeGamesExtra.js — Newer Nexus Arcade games: Paddle Duel, Cave Glider,
 * Tower Stacker, Reversi Nexus, Sudoku Grid (every puzzle has exactly one
 * solution) and Cipher Lock (code breaker).
 *
 * Plain JavaScript inside a template string (see arcadeGamesEngine.js for the rules).
 */

export const ARCADE_GAMES_EXTRA_JS = `
  // ══════════ PADDLE DUEL ══════════
  STARTERS.paddle = function (S) {
    const cv = S.canvas(760, 460), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const PH = 84, PW = 12, R = 7, GOAL = 7, LX = 26, RX = W - 26 - PW;
    const me = { y: H / 2 - PH / 2, vy: 0 }, bot = { y: H / 2 - PH / 2, err: 0 };
    let ball = null, mine = 0, theirs = 0, serveT = 0, serveDir = -1, rally = 0, score = 0, t = 0, pointerY = null, done = false, trail = [], shake = 0;
    function serve(dir) { ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, sp: 5.4 }; serveDir = dir; serveT = 70; trail = []; rally = 0; }
    serve(-1);
    S.on(cv.el, 'pointermove', e => { pointerY = cv.toLocal(e).y; });
    S.on(cv.el, 'pointerdown', e => { pointerY = cv.toLocal(e).y; });
    S.pad(['up', 'down']);
    const skill = () => Math.min(1, 0.5 + (mine + theirs) * 0.03 + mine * 0.03);
    function predictY() {
      const tt = (RX - ball.x) / ball.vx;
      const span = H - 2 * R;
      let yy = (ball.y + ball.vy * tt - R) % (2 * span);
      if (yy < 0) yy += 2 * span;
      if (yy > span) yy = 2 * span - yy;
      return yy + R;
    }
    function hitPaddle(py, left, pvy) {
      const off = clamp((ball.y - (py + PH / 2)) / (PH / 2), -1, 1);
      ball.sp = Math.min(13, ball.sp * 1.045 + 0.15);
      const a = off * 0.95;
      ball.vx = Math.cos(a) * ball.sp * (left ? 1 : -1);
      ball.vy = Math.sin(a) * ball.sp + pvy * 0.35;
      ball.x = left ? LX + PW + R : RX - R;
      rally++;
      fx.burst(ball.x, ball.y, left ? '#38bdf8' : '#f472b6', 12, 3, 24);
      S.sfx('bounce');
      if (left) bot.err = rand(-1, 1) * (1 - skill()) * 120;
    }
    function point(mineWon) {
      if (mineWon) { mine++; score += 300 + rally * 20; fx.text(W * 0.75, H / 2, 'POINT', '#7dd3fc'); }
      else { theirs++; shake = 10; fx.text(W * 0.25, H / 2, 'MISS', '#fda4af'); }
      S.sfx(mineWon ? 'pickup' : 'error');
      if (mine >= GOAL) { done = true; score += 2000 + (GOAL - theirs) * 300; S.end(true, score, 'Duel won!', 'You beat the duel bot ' + mine + ' to ' + theirs + '.', 800); return; }
      if (theirs >= GOAL) { done = true; S.end(false, score, 'The bot takes it', 'Final score ' + mine + ' to ' + theirs + '. Rematch?', 800); return; }
      serve(mineWon ? 1 : -1);
    }
    function update() {
      t++;
      shake *= 0.86;
      const prev = me.y;
      if (S.act.up) { me.y -= 8; pointerY = null; }
      if (S.act.down) { me.y += 8; pointerY = null; }
      if (pointerY != null) me.y += (pointerY - PH / 2 - me.y) * 0.35;
      me.y = clamp(me.y, 0, H - PH);
      me.vy = me.y - prev;
      const sk = skill();
      let target = H / 2;
      if (ball && ball.vx > 0) target = predictY() + bot.err;
      const want = target - PH / 2, maxV = 3.6 + sk * 3.6;
      bot.y += clamp(want - bot.y, -maxV, maxV);
      bot.y = clamp(bot.y, 0, H - PH);
      if (!ball || done) { fx.update(); return; }
      if (serveT > 0) {
        if (--serveT === 0) { const a = rand(-0.45, 0.45); ball.vx = Math.cos(a) * ball.sp * serveDir; ball.vy = Math.sin(a) * ball.sp; }
      } else {
        for (let k = 0; k < 2; k++) {
          ball.x += ball.vx / 2; ball.y += ball.vy / 2;
          if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); S.sfx('move'); }
          if (ball.y > H - R) { ball.y = H - R; ball.vy = -Math.abs(ball.vy); S.sfx('move'); }
          if (ball.vx < 0 && ball.x - R <= LX + PW && ball.x - R >= LX - 12 && ball.y >= me.y - R && ball.y <= me.y + PH + R) hitPaddle(me.y, true, me.vy);
          if (ball.vx > 0 && ball.x + R >= RX && ball.x + R <= RX + PW + 12 && ball.y >= bot.y - R && ball.y <= bot.y + PH + R) hitPaddle(bot.y, false, 0);
        }
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 10) trail.shift();
        if (ball.x < -20) point(false);
        else if (ball.x > W + 20) point(true);
      }
      fx.update();
      S.hud('You ' + mine + ' : ' + theirs + ' Bot • first to ' + GOAL, fmt(score) + ' pts', 'Rally ' + rally);
    }
    function draw() {
      ctx.save();
      ctx.fillStyle = '#040816'; ctx.fillRect(0, 0, W, H);
      if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'; ctx.lineWidth = 3; ctx.setLineDash([12, 14]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '900 64px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'; ctx.fillText(String(mine), W / 2 - 80, 80);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.25)'; ctx.fillText(String(theirs), W / 2 + 80, 80);
      ctx.save(); ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18; ctx.fillStyle = '#7dd3fc'; roundRect(ctx, LX, me.y, PW, PH, 6); ctx.fill(); ctx.restore();
      ctx.save(); ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 18; ctx.fillStyle = '#f9a8d4'; roundRect(ctx, RX, bot.y, PW, PH, 6); ctx.fill(); ctx.restore();
      trail.forEach((p, i) => { ctx.globalAlpha = (i + 1) / trail.length * 0.3; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(p.x, p.y, R - 1, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
      if (ball) glowCircle(ctx, ball.x, ball.y, R, '#fde047', 18);
      fx.draw(ctx);
      if (ball && serveT > 0 && !S.waiting && !done) { ctx.fillStyle = 'rgba(226, 232, 240, 0.8)'; ctx.font = '700 15px system-ui'; ctx.fillText(serveDir < 0 ? 'Serve coming your way…' : 'Bot to receive…', W / 2, H - 40); }
      ctx.restore();
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ CAVE GLIDER ══════════
  STARTERS.glider = function (S) {
    const cv = S.canvas(760, 420), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const COL = 8, N = Math.ceil(W / COL) + 3, GX = 150, GOAL = 1500;
    const cols = [];
    let center = H / 2, gap = 270, drift = 0, scroll = 0, dist = 0, y = H / 2, vy = 0, t = 0, orbs = 0, score = 0, dead = false, holding = false, sinceBlock = 0;
    let gems = [], blocks = [], far = [];
    for (let i = 0; i < N; i++) cols.push({ top: H / 2 - 135, bot: H / 2 + 135 });
    for (let i = 0; i < 14; i++) far.push({ x: Math.random() * W, h: rand(40, 140), top: Math.random() < 0.5 });
    function newCol() {
      drift = clamp(drift + rand(-0.9, 0.9), -3.2, 3.2);
      center += drift;
      const lo = gap / 2 + 18, hi = H - gap / 2 - 18;
      if (center < lo) { center = lo; drift = Math.abs(drift); }
      if (center > hi) { center = hi; drift = -Math.abs(drift); }
      return { top: center - gap / 2 + rand(-5, 5), bot: center + gap / 2 + rand(-5, 5) };
    }
    S.on(cv.el, 'pointerdown', () => { holding = true; });
    S.on(window, 'pointerup', () => { holding = false; });
    S.on(window, 'pointercancel', () => { holding = false; });
    S.pad(['fire']);
    function crash() {
      dead = true;
      fx.burst(GX, y, '#22d3ee', 50, 4.5, 60, 3);
      fx.burst(GX, y, '#fde047', 20, 3, 40);
      S.sfx('boom');
      S.end(false, score, 'Crashed', 'You flew ' + fmt(dist) + ' m of ' + fmt(GOAL) + ' m.', 1100);
    }
    function update() {
      t++;
      if (dead) { fx.update(0.05); return; }
      const up = holding || S.act.fire || S.act.up;
      vy = clamp(vy + (up ? -0.36 : 0.32), -5.5, 6.5);
      y += vy;
      const speed = Math.min(6.4, 3.2 + dist / 520);
      gap = Math.max(142, 270 - dist / 9);
      scroll += speed;
      while (scroll >= COL) {
        scroll -= COL;
        cols.shift();
        const c = newCol();
        cols.push(c);
        sinceBlock++;
        if (Math.random() < 0.025) gems.push({ x: W + 20, y: rand(c.top + 30, c.bot - 30) });
        if (dist > 150 && sinceBlock > Math.max(28, 70 - dist / 40)) {
          sinceBlock = 0;
          const h = rand(40, gap * 0.42), mid = (c.top + c.bot) / 2 + rand(-gap * 0.18, gap * 0.18);
          blocks.push({ x: W + 20, y: mid - h / 2, w: 18, h: h });
        }
      }
      gems.forEach(g => { g.x -= speed; });
      blocks.forEach(b => { b.x -= speed; });
      far.forEach(f => { f.x -= speed * 0.3; if (f.x < -40) { f.x = W + 40; f.h = rand(40, 140); } });
      gems = gems.filter(g => g.x > -20);
      blocks = blocks.filter(b => b.x > -30);
      dist += speed / 8;
      score = Math.floor(dist) * 2 + orbs * 100;
      if (t % 2 === 0) fx.spark(GX - 10, y + rand(-2, 2), -speed * 0.6, rand(-0.3, 0.3), up ? '#fde047' : '#22d3ee', 26, 2.5);
      const col = cols[Math.floor((GX + scroll) / COL)];
      if (col && (y - 7 < col.top || y + 7 > col.bot)) { crash(); return; }
      for (const b of blocks) if (GX + 9 > b.x && GX - 9 < b.x + b.w && y + 7 > b.y && y - 7 < b.y + b.h) { crash(); return; }
      for (let i = gems.length - 1; i >= 0; i--) {
        if (Math.hypot(gems[i].x - GX, gems[i].y - y) < 17) {
          orbs++;
          fx.burst(gems[i].x, gems[i].y, '#f0abfc', 16, 3, 30);
          fx.text(gems[i].x, gems[i].y - 12, '+100', '#f5d0fe');
          S.sfx('pickup');
          gems.splice(i, 1);
        }
      }
      if (dist >= GOAL) {
        dead = true;
        score += 1500;
        S.end(true, score, 'Through the caves!', fmt(GOAL) + ' m flown with ' + orbs + ' orb' + (orbs === 1 ? '' : 's') + ' collected (+1,500).', 600);
      }
      fx.update();
      S.hud(fmt(dist) + ' / ' + fmt(GOAL) + ' m', fmt(score) + ' pts', 'Orbs ' + orbs);
    }
    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b0726'); g.addColorStop(1, '#03111c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
      far.forEach(f => { ctx.beginPath(); if (f.top) { ctx.moveTo(f.x - 22, 0); ctx.lineTo(f.x, f.h); ctx.lineTo(f.x + 22, 0); } else { ctx.moveTo(f.x - 22, H); ctx.lineTo(f.x, H - f.h); ctx.lineTo(f.x + 22, H); } ctx.fill(); });
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#312e81'); wall.addColorStop(0.5, '#0f172a'); wall.addColorStop(1, '#134e4a');
      ctx.fillStyle = wall;
      ctx.beginPath(); ctx.moveTo(0, 0);
      cols.forEach((c, i) => ctx.lineTo(i * COL - scroll, c.top));
      ctx.lineTo(W + COL, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, H);
      cols.forEach((c, i) => ctx.lineTo(i * COL - scroll, c.bot));
      ctx.lineTo(W + COL, H); ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2;
      ctx.beginPath(); cols.forEach((c, i) => ctx.lineTo(i * COL - scroll, c.top)); ctx.stroke();
      ctx.beginPath(); cols.forEach((c, i) => ctx.lineTo(i * COL - scroll, c.bot)); ctx.stroke();
      ctx.restore();
      blocks.forEach(b => {
        ctx.save(); ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 12;
        const bg = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
        bg.addColorStop(0, '#7c3aed'); bg.addColorStop(1, '#c084fc');
        ctx.fillStyle = bg; roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.restore();
      });
      gems.forEach(gm => {
        const s = 7 + Math.sin(t * 0.2 + gm.x * 0.05) * 1.5;
        ctx.save(); ctx.shadowColor = '#f0abfc'; ctx.shadowBlur = 16; ctx.fillStyle = '#f5d0fe';
        ctx.beginPath(); ctx.moveTo(gm.x, gm.y - s); ctx.lineTo(gm.x + s * 0.8, gm.y); ctx.lineTo(gm.x, gm.y + s); ctx.lineTo(gm.x - s * 0.8, gm.y); ctx.closePath(); ctx.fill(); ctx.restore();
      });
      fx.draw(ctx);
      if (!dead) {
        ctx.save();
        ctx.translate(GX, y);
        ctx.rotate(clamp(vy * 0.08, -0.6, 0.7));
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-5, 0); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0891b2'; ctx.beginPath(); ctx.arc(3, 0, 3, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)'; ctx.fillRect(16, 12, W - 32, 6);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(16, 12, (W - 32) * Math.min(1, dist / GOAL), 6);
    }
    S.loop(update, draw);
    S.ready(null, 'Hold Space, click or touch to climb • let go to dive');
  };

  // ══════════ TOWER STACKER ══════════
  STARTERS.stacker = function (S) {
    const cv = S.canvas(480, 600), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const BH = 26, GOAL = 25, BASE_W = 220, DEPTH = 14;
    const stack = [{ x: (W - BASE_W) / 2, w: BASE_W, hue: 190 }];
    let moving = null, dir = 1, speed = 2.6, cam = 0, falling = [], perfect = 0, score = 0, t = 0, done = false, flash = 0, stars = makeStars(60, W, H);
    const floorY = i => H - 60 - i * BH;
    function spawn() {
      const top = stack[stack.length - 1], fromLeft = stack.length % 2 === 0;
      moving = { x: fromLeft ? -top.w * 0.25 : W - top.w * 0.75, w: top.w, hue: (190 + stack.length * 11) % 360 };
      dir = fromLeft ? 1 : -1;
      speed = Math.min(7.2, 2.6 + stack.length * 0.17);
    }
    spawn();
    function drop() {
      if (!moving || done || S.waiting) return;
      const top = stack[stack.length - 1];
      const left = Math.max(moving.x, top.x), right = Math.min(moving.x + moving.w, top.x + top.w), overlap = right - left;
      const y = floorY(stack.length);
      if (overlap <= 0) {
        falling.push({ x: moving.x, w: moving.w, y: y, vy: 0, rot: 0, hue: moving.hue });
        moving = null; done = true;
        S.sfx('lose');
        S.end(false, score, 'The tower toppled', 'You stacked ' + (stack.length - 1) + ' of ' + GOAL + ' floors.', 1000);
        return;
      }
      if (Math.abs(moving.x - top.x) < 5) {
        perfect++;
        moving.x = top.x;
        let w = moving.w;
        if (perfect >= 3 && w < BASE_W) { const grow = Math.min(16, BASE_W - w); w += grow; moving.x -= grow / 2; }
        stack.push({ x: clamp(moving.x, 0, W - w), w: w, hue: moving.hue });
        score += 150 + perfect * 25;
        flash = 18;
        fx.burst(moving.x + w / 2, y + cam + BH / 2, 'hsl(' + moving.hue + ', 90%, 70%)', 26, 3.5, 34);
        fx.text(moving.x + w / 2, y + cam - 6, perfect >= 3 ? 'PERFECT x' + perfect + ' • WIDER' : 'PERFECT', '#fef08a');
        S.sfx('match');
      } else {
        perfect = 0;
        const cutX = moving.x < top.x ? moving.x : right, cutW = moving.w - overlap;
        falling.push({ x: cutX, w: cutW, y: y, vy: 0, rot: 0, hue: moving.hue, dir: moving.x < top.x ? -1 : 1 });
        stack.push({ x: left, w: overlap, hue: moving.hue });
        score += 100;
        S.sfx('hit');
      }
      const floors = stack.length - 1;
      if (floors >= GOAL) {
        moving = null; done = true;
        score += 1500;
        S.end(true, score, 'Tower complete!', GOAL + ' floors stacked (+1,500).', 700);
        return;
      }
      spawn();
    }
    S.onKey(a => { if (a === 'fire' || a === 'down') drop(); });
    S.on(cv.el, 'pointerdown', drop);
    S.pad(['fire']);
    function update() {
      t++;
      if (flash) flash--;
      if (moving) {
        moving.x += dir * speed;
        if (dir > 0 && moving.x + moving.w * 0.75 > W) dir = -1;
        if (dir < 0 && moving.x + moving.w * 0.25 < 0) dir = 1;
      }
      const want = Math.max(0, (stack.length - 13) * BH);
      cam += (want - cam) * 0.08;
      falling.forEach(f => { f.vy += 0.45; f.y += f.vy; f.rot += 0.03 * (f.dir || 1); });
      falling = falling.filter(f => f.y + cam < H + 120);
      fx.update(0.08);
      S.hud('Floor ' + (stack.length - 1) + ' / ' + GOAL + (perfect ? ' • Perfect x' + perfect : ''), fmt(score) + ' pts', 'Best ' + fmt(progressOf('stacker').best));
    }
    function block(x, y, w, hue, alpha) {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = 'hsl(' + hue + ', 70%, 32%)';
      ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + DEPTH, y - DEPTH * 0.6); ctx.lineTo(x + w + DEPTH, y + BH - DEPTH * 0.6); ctx.lineTo(x + w, y + BH); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'hsl(' + hue + ', 85%, 68%)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + DEPTH, y - DEPTH * 0.6); ctx.lineTo(x + w + DEPTH, y - DEPTH * 0.6); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + BH);
      g.addColorStop(0, 'hsl(' + hue + ', 80%, 55%)'); g.addColorStop(1, 'hsl(' + hue + ', 75%, 40%)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, BH);
      ctx.globalAlpha = 1;
    }
    function draw() {
      const height = stack.length / GOAL;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'hsl(' + (230 + height * 40) + ', 60%, ' + (14 - height * 8) + '%)');
      g.addColorStop(1, 'hsl(' + (200 + height * 60) + ', 55%, ' + (22 - height * 10) + '%)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = Math.min(1, height * 1.5);
      drawStars(ctx, stars, W, H, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, floorY(0) + BH + cam, W, H);
      stack.forEach((b, i) => { const y = floorY(i) + cam; if (y < H + 40 && y > -60) block(b.x, y, b.w, b.hue); });
      if (flash) { const top = stack[stack.length - 1]; ctx.strokeStyle = 'rgba(254, 240, 138, ' + flash / 18 + ')'; ctx.lineWidth = 3; ctx.strokeRect(top.x - 3, floorY(stack.length - 1) + cam - 3, top.w + 6, BH + 6); }
      falling.forEach(f => {
        ctx.save();
        ctx.translate(f.x + f.w / 2, f.y + cam + BH / 2);
        ctx.rotate(f.rot);
        block(-f.w / 2, -BH / 2, f.w, f.hue, 0.85);
        ctx.restore();
      });
      if (moving) {
        const y = floorY(stack.length) + cam;
        block(moving.x, y, moving.w, moving.hue);
        const top = stack[stack.length - 1];
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.setLineDash([4, 6]);
        ctx.strokeRect(top.x, y, top.w, BH); ctx.setLineDash([]);
      }
      fx.draw(ctx);
      ctx.fillStyle = 'rgba(248, 250, 252, 0.9)'; ctx.font = '900 40px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(String(stack.length - 1), W / 2, 62);
      ctx.font = '600 12px system-ui'; ctx.fillStyle = 'rgba(203, 213, 225, 0.7)'; ctx.fillText('FLOORS • GOAL ' + GOAL, W / 2, 82);
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ REVERSI NEXUS ══════════
  let reversiLevel = 'standard';
  STARTERS.reversi = function (S) {
    const LEVELS = { casual: { label: 'Casual', depth: 1, noise: 30, pts: 1200 }, standard: { label: 'Standard', depth: 3, noise: 0, pts: 2200 }, expert: { label: 'Expert', depth: 4, noise: 0, pts: 3500 } };
    const WEIGHTS = [
      100, -20, 10, 5, 5, 10, -20, 100,
      -20, -50, -2, -2, -2, -2, -50, -20,
      10, -2, -1, -1, -1, -1, -2, 10,
      5, -2, -1, -1, -1, -1, -2, 5,
      5, -2, -1, -1, -1, -1, -2, 5,
      10, -2, -1, -1, -1, -1, -2, 10,
      -20, -50, -2, -2, -2, -2, -50, -20,
      100, -20, 10, 5, 5, 10, -20, 100,
    ];
    const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    const board = new Array(64).fill(0);
    board[27] = 2; board[28] = 1; board[35] = 1; board[36] = 2;
    let turn = 1, busy = false, done = false, last = -1, flipped = [];
    const bar = S.el('div', 'tt-toolbar', Object.keys(LEVELS).map(k => '<button type="button" class="tt-level' + (k === reversiLevel ? ' active' : '') + '" data-level="' + k + '">' + LEVELS[k].label + '</button>').join('') + '<span class="tt-status"></span>');
    const status = bar.querySelector('.tt-status');
    const grid = S.el('div', 'rv-grid');
    function flipsFor(b, idx, p) {
      if (b[idx]) return [];
      const r = Math.floor(idx / 8), c = idx % 8, opp = 3 - p, out = [];
      for (const d of DIRS) {
        const line = [];
        let rr = r + d[0], cc = c + d[1];
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === opp) { line.push(rr * 8 + cc); rr += d[0]; cc += d[1]; }
        if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === p) out.push.apply(out, line);
      }
      return out;
    }
    function movesFor(b, p) {
      const out = [];
      for (let i = 0; i < 64; i++) { const f = flipsFor(b, i, p); if (f.length) out.push({ idx: i, flips: f }); }
      return out;
    }
    const count = (b, p) => b.reduce((n, v) => n + (v === p ? 1 : 0), 0);
    function evaluate(b) {
      let s = 0;
      for (let i = 0; i < 64; i++) if (b[i] === 2) s += WEIGHTS[i]; else if (b[i] === 1) s -= WEIGHTS[i];
      return s + (movesFor(b, 2).length - movesFor(b, 1).length) * 4;
    }
    function apply(b, m, p) { b[m.idx] = p; m.flips.forEach(i => { b[i] = p; }); }
    function search(b, depth, alpha, beta, p) {
      const moves = movesFor(b, p);
      if (depth === 0) return evaluate(b);
      if (!moves.length) {
        if (!movesFor(b, 3 - p).length) { const d = count(b, 2) - count(b, 1); return d * 1000; }
        return search(b, depth - 1, alpha, beta, 3 - p);
      }
      let best = p === 2 ? -Infinity : Infinity;
      for (const m of moves) {
        const nb = b.slice();
        apply(nb, m, p);
        const v = search(nb, depth - 1, alpha, beta, 3 - p);
        if (p === 2) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
        if (alpha >= beta) break;
      }
      return best;
    }
    function aiPick() {
      const lv = LEVELS[reversiLevel];
      let best = null, bestV = -Infinity;
      movesFor(board, 2).forEach(m => {
        const nb = board.slice();
        apply(nb, m, 2);
        let v = search(nb, lv.depth - 1, -Infinity, Infinity, 1);
        if (lv.noise) v += rand(-lv.noise, lv.noise);
        if (v > bestV) { bestV = v; best = m; }
      });
      return best;
    }
    function render() {
      const legal = turn === 1 && !busy && !done ? movesFor(board, 1).map(m => m.idx) : [];
      grid.innerHTML = board.map((v, i) => '<button type="button" class="rv-cell' + (legal.indexOf(i) !== -1 ? ' is-legal' : '') + (i === last ? ' is-last' : '') + '" data-i="' + i + '">' +
        (v ? '<span class="rv-disc p' + v + (flipped.indexOf(i) !== -1 ? ' is-flip' : '') + '"></span>' : '') + '</button>').join('');
      S.hud('Reversi • ' + LEVELS[reversiLevel].label, 'You ' + count(board, 1) + ' • AI ' + count(board, 2), 'Best ' + fmt(progressOf('reversi').best));
    }
    function finish() {
      done = true;
      const mineN = count(board, 1), theirN = count(board, 2);
      render();
      if (mineN > theirN) { status.textContent = 'You win ' + mineN + ' to ' + theirN + '!'; S.end(true, LEVELS[reversiLevel].pts + (mineN - theirN) * 40, 'Reversi won!', 'You beat the ' + LEVELS[reversiLevel].label + ' AI ' + mineN + ' to ' + theirN + '.', 1000); }
      else if (mineN === theirN) { status.textContent = 'A draw.'; S.end(false, 600, 'A draw', 'Both sides finished with ' + mineN + ' discs.', 1000); }
      else { status.textContent = 'The AI wins ' + theirN + ' to ' + mineN + '.'; S.end(false, mineN * 10, 'The AI wins this one', 'Final count ' + mineN + ' to ' + theirN + '. Corners are worth fighting for.', 1000); }
    }
    function nextTurn() {
      const mine = movesFor(board, 1), theirs = movesFor(board, 2);
      if (!mine.length && !theirs.length) { finish(); return; }
      if (turn === 1 && !mine.length) { turn = 2; status.textContent = 'You have no moves: you pass.'; }
      else if (turn === 2 && !theirs.length) { turn = 1; status.textContent = 'The AI has no moves and passes. Your turn.'; render(); return; }
      if (turn === 2) {
        busy = true; render();
        if (!status.textContent || status.textContent.indexOf('pass') === -1) status.textContent = 'The AI is thinking…';
        S.later(() => {
          const m = aiPick();
          busy = false;
          if (m) { apply(board, m, 2); last = m.idx; flipped = m.flips; S.sfx('flip'); }
          turn = 1;
          status.textContent = 'Your turn (dark discs).';
          render();
          nextTurn();
        }, 520);
      } else { render(); }
    }
    S.on(grid, 'click', e => {
      const b = e.target.closest('[data-i]');
      if (!b || busy || done || turn !== 1) return;
      const i = Number(b.getAttribute('data-i'));
      const f = flipsFor(board, i, 1);
      if (!f.length) { S.sfx('error'); return; }
      apply(board, { idx: i, flips: f }, 1);
      last = i; flipped = f;
      S.sfx('match');
      turn = 2;
      status.textContent = '';
      nextTurn();
    });
    S.on(bar, 'click', e => { const b = e.target.closest('[data-level]'); if (b) { reversiLevel = b.getAttribute('data-level'); launchArcadeGame('reversi'); } });
    status.textContent = 'You play dark and move first. Glowing squares are legal moves.';
    render();
  };

  // ══════════ SUDOKU GRID ══════════
  let sudokuLevel = 'easy';
  STARTERS.sudoku = function (S) {
    const LEVELS = { easy: { label: 'Easy', clues: 40, pts: 2000 }, medium: { label: 'Medium', clues: 32, pts: 3000 }, hard: { label: 'Hard', clues: 27, pts: 4500 } };
    const ALL = 1022;
    const bits = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
    const boxOf = i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
    function solver(grid, limit, randomize) {
      const g = grid.slice(), rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
      for (let i = 0; i < 81; i++) if (g[i]) { const m = 1 << g[i]; rows[Math.floor(i / 9)] |= m; cols[i % 9] |= m; boxes[boxOf(i)] |= m; }
      let found = 0, firstSolution = null;
      function rec() {
        let best = -1, bestMask = 0, bestN = 10;
        for (let i = 0; i < 81; i++) {
          if (g[i]) continue;
          const mask = ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]);
          const n = bits(mask);
          if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n <= 1) break; }
        }
        if (best < 0) { found++; if (!firstSolution) firstSolution = g.slice(); return found >= limit; }
        if (!bestN) return false;
        const digits = [];
        for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
        if (randomize) shuffle(digits);
        const r = Math.floor(best / 9), c = best % 9, b = boxOf(best);
        for (const d of digits) {
          const m = 1 << d;
          g[best] = d; rows[r] |= m; cols[c] |= m; boxes[b] |= m;
          if (rec()) return true;
          g[best] = 0; rows[r] &= ~m; cols[c] &= ~m; boxes[b] &= ~m;
        }
        return false;
      }
      rec();
      return { count: found, solution: firstSolution };
    }
    const solution = solver(new Array(81).fill(0), 1, true).solution;
    const puzzle = solution.slice();
    let filled = 81;
    for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
      if (filled <= LEVELS[sudokuLevel].clues) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (solver(puzzle, 2, false).count !== 1) puzzle[i] = keep; else filled--;
    }
    const given = puzzle.map(v => v > 0);
    const cells = puzzle.slice();
    const notes = Array.from({ length: 81 }, () => 0);
    let sel = given.indexOf(false), notesMode = false, mistakes = 0, hints = 0, done = false;
    const clock = makeClock(S, () => hud());
    const bar = S.el('div', 'tt-toolbar', Object.keys(LEVELS).map(k => '<button type="button" class="tt-level' + (k === sudokuLevel ? ' active' : '') + '" data-level="' + k + '">' + LEVELS[k].label + '</button>').join('') + '<span class="tt-status">Every puzzle has exactly one solution.</span>');
    const wrap = S.el('div', 'su-wrap');
    const gridEl = S.el('div', 'su-grid', null, wrap);
    const padEl = S.el('div', 'su-pad', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button type="button" data-num="' + n + '">' + n + '</button>').join('') +
      '<button type="button" data-num="0" class="su-wide">⌫ Erase</button><button type="button" data-act="notes" class="su-wide">✎ Notes: off</button><button type="button" data-act="hint" class="su-wide">💡 Hint</button>', wrap);
    function hud() { S.hud('Sudoku • ' + LEVELS[sudokuLevel].label + ' • ' + clock.label(), 'Mistakes ' + mistakes + ' • Hints ' + hints, 'Best ' + fmt(progressOf('sudoku').best)); }
    function conflicts(i) {
      const v = cells[i];
      if (!v) return false;
      const r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
      for (let j = 0; j < 81; j++) if (j !== i && cells[j] === v && (Math.floor(j / 9) === r || j % 9 === c || boxOf(j) === b)) return true;
      return false;
    }
    function render() {
      const sv = sel >= 0 ? cells[sel] : 0;
      gridEl.innerHTML = cells.map((v, i) => {
        const r = Math.floor(i / 9), c = i % 9;
        let cls = 'su-cell';
        if (given[i]) cls += ' is-given';
        if (i === sel) cls += ' is-sel';
        else if (sel >= 0 && (Math.floor(sel / 9) === r || sel % 9 === c || boxOf(sel) === boxOf(i))) cls += ' is-peer';
        if (v && sv && v === sv && i !== sel) cls += ' is-same';
        if (v && !given[i] && (v !== solution[i] || conflicts(i))) cls += ' is-wrong';
        if (c % 3 === 2 && c < 8) cls += ' edge-r';
        if (r % 3 === 2 && r < 8) cls += ' edge-b';
        let inner = v ? String(v) : '';
        if (!v && notes[i]) { inner = '<span class="su-notes">'; for (let d = 1; d <= 9; d++) inner += '<i>' + (notes[i] & (1 << d) ? d : '') + '</i>'; inner += '</span>'; }
        return '<button type="button" class="' + cls + '" data-i="' + i + '">' + inner + '</button>';
      }).join('');
      padEl.querySelector('[data-act="notes"]').textContent = '✎ Notes: ' + (notesMode ? 'on' : 'off');
      padEl.querySelector('[data-act="notes"]').classList.toggle('active', notesMode);
      hud();
    }
    function enter(n) {
      if (done || sel < 0 || given[sel]) return;
      clock.start();
      if (n === 0) { cells[sel] = 0; notes[sel] = 0; S.sfx('move'); render(); return; }
      if (notesMode) { if (!cells[sel]) { notes[sel] ^= 1 << n; S.sfx('click'); render(); } return; }
      if (cells[sel] === n) return;
      cells[sel] = n;
      notes[sel] = 0;
      if (n !== solution[sel]) { mistakes++; S.sfx('error'); }
      else {
        S.sfx('flip');
        const r = Math.floor(sel / 9), c = sel % 9, b = boxOf(sel);
        for (let j = 0; j < 81; j++) if (Math.floor(j / 9) === r || j % 9 === c || boxOf(j) === b) notes[j] &= ~(1 << n);
      }
      render();
      if (cells.every((v, i) => v === solution[i])) {
        done = true; clock.stop();
        const sc = Math.max(500, LEVELS[sudokuLevel].pts - clock.seconds() * 2 - mistakes * 150 - hints * 200);
        S.end(true, sc, 'Sudoku solved!', LEVELS[sudokuLevel].label + ' puzzle in ' + clock.label() + ' with ' + mistakes + ' mistake' + (mistakes === 1 ? '' : 's') + ' and ' + hints + ' hint' + (hints === 1 ? '' : 's') + '.', 600);
      }
    }
    S.on(gridEl, 'click', e => { const b = e.target.closest('[data-i]'); if (!b) return; sel = Number(b.getAttribute('data-i')); S.sfx('click'); render(); });
    S.on(padEl, 'click', e => {
      const n = e.target.closest('[data-num]');
      if (n) { enter(Number(n.getAttribute('data-num'))); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.getAttribute('data-act') === 'notes') { notesMode = !notesMode; render(); }
      else if (!done) {
        const empty = cells.map((v, i) => i).filter(i => cells[i] !== solution[i]);
        if (!empty.length) return;
        const i = sel >= 0 && cells[sel] !== solution[sel] ? sel : pick(empty);
        hints++; sel = i;
        const wasNotes = notesMode;
        notesMode = false;
        enter(solution[i]);
        notesMode = wasNotes;
        render();
      }
    });
    S.on(bar, 'click', e => { const b = e.target.closest('[data-level]'); if (b) { sudokuLevel = b.getAttribute('data-level'); launchArcadeGame('sudoku'); } });
    S.onKey((a, e) => {
      if (a === 'left' || a === 'right' || a === 'up' || a === 'down') {
        if (sel < 0) sel = 0;
        const r = Math.floor(sel / 9), c = sel % 9;
        if (a === 'left') sel = r * 9 + (c + 8) % 9;
        if (a === 'right') sel = r * 9 + (c + 1) % 9;
        if (a === 'up') sel = ((r + 8) % 9) * 9 + c;
        if (a === 'down') sel = ((r + 1) % 9) * 9 + c;
        render();
        return;
      }
      if (!e) return;
      if (e.key >= '1' && e.key <= '9') enter(Number(e.key));
      else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); enter(0); }
      else if (e.key === 'n' || e.key === 'N') { notesMode = !notesMode; render(); }
    });
    render();
  };

  // ══════════ CIPHER LOCK ══════════
  STARTERS.cipher = function (S) {
    const GLYPHS = ['⚡', '🔥', '💧', '🌿', '⭐', '🌙'];
    const LEN = 4, TRIES = 10;
    const secret = Array.from({ length: LEN }, () => randInt(0, GLYPHS.length - 1));
    const rows = [];
    let current = [], done = false;
    const board = S.el('div', 'cl-board');
    const palette = S.el('div', 'cl-palette', GLYPHS.map((g, i) => '<button type="button" data-g="' + i + '"><span>' + g + '</span><small>' + (i + 1) + '</small></button>').join('') +
      '<button type="button" data-act="back" class="cl-wide">⌫</button><button type="button" data-act="go" class="cl-wide cl-go">Unlock ↵</button>');
    S.el('p', 'cl-legend', '<span class="cl-pip exact"></span> right glyph, right slot <span class="cl-pip near"></span> right glyph, wrong slot');
    function score(guess) {
      let exact = 0;
      const a = {}, b = {};
      guess.forEach((g, i) => { if (g === secret[i]) exact++; else { a[g] = (a[g] || 0) + 1; b[secret[i]] = (b[secret[i]] || 0) + 1; } });
      let near = 0;
      Object.keys(a).forEach(k => { near += Math.min(a[k], b[k] || 0); });
      return { exact: exact, near: near };
    }
    function render() {
      let html = '';
      for (let r = 0; r < TRIES; r++) {
        const row = rows[r];
        const isCur = r === rows.length && !done;
        const glyphs = row ? row.guess : isCur ? current : [];
        html += '<div class="cl-row' + (isCur ? ' is-current' : '') + (row ? ' is-done' : '') + '"><span class="cl-num">' + (r + 1) + '</span><span class="cl-slots">';
        for (let k = 0; k < LEN; k++) html += '<span class="cl-slot">' + (glyphs[k] != null ? GLYPHS[glyphs[k]] : '') + '</span>';
        html += '</span><span class="cl-pips">';
        for (let k = 0; k < LEN; k++) html += '<span class="cl-pip' + (row ? (k < row.exact ? ' exact' : k < row.exact + row.near ? ' near' : '') : '') + '"></span>';
        html += '</span></div>';
      }
      if (done) html += '<div class="cl-secret">Code: ' + secret.map(g => GLYPHS[g]).join(' ') + '</div>';
      board.innerHTML = html;
      S.hud('Try ' + Math.min(rows.length + 1, TRIES) + ' / ' + TRIES, current.length + ' / ' + LEN + ' glyphs', 'Best ' + fmt(progressOf('cipher').best));
    }
    function add(g) { if (done || current.length >= LEN) return; current.push(g); S.tone(330 + g * 70, 0.08); render(); }
    function back() { if (done || !current.length) return; current.pop(); S.sfx('move'); render(); }
    function submit() {
      if (done) return;
      if (current.length < LEN) { S.sfx('error'); return; }
      const res = score(current);
      rows.push({ guess: current.slice(), exact: res.exact, near: res.near });
      current = [];
      if (res.exact === LEN) {
        done = true; render();
        const sc = (TRIES - rows.length + 1) * 400 + 400;
        S.end(true, sc, 'Lock cracked!', 'You broke the code in ' + rows.length + ' tr' + (rows.length === 1 ? 'y' : 'ies') + '.', 700);
        return;
      }
      if (rows.length >= TRIES) { done = true; render(); S.end(false, 100, 'Locked out', 'The code was ' + secret.map(g => GLYPHS[g]).join(' ') + '.', 900); return; }
      S.sfx(res.exact ? 'pickup' : 'flip');
      render();
    }
    S.on(palette, 'click', e => {
      const g = e.target.closest('[data-g]');
      if (g) { add(Number(g.getAttribute('data-g'))); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.getAttribute('data-act') === 'back') back(); else submit();
    });
    S.onKey((a, e) => {
      if (a === 'fire') { submit(); return; }
      if (!e) return;
      const n = Number(e.key);
      if (n >= 1 && n <= GLYPHS.length) add(n - 1);
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); }
    });
    render();
  };
`;
