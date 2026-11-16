/**
 * arcadeGamesAction.js — Canvas action games for the Nexus Arcade:
 * Starfield Vanguard (formation shooter with a boss), Vector Void (inertia rock
 * blaster), Data-Stream Crossing (traffic and river hopper), Prism Breaker
 * (brick breaker), Ouroboros Grid (snake), Circuit Runner (maze chase) and
 * Segment Storm (chain blaster).
 *
 * All original designs on classic genres. Plain JavaScript inside a template
 * string (see arcadeGamesEngine.js for the rules).
 */

export const ARCADE_GAMES_ACTION_JS = `
  const DIR4 = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
  function swipeInput(S, el, onDir) {
    let start = null;
    S.on(el, 'pointerdown', e => { if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY }; });
    S.on(el, 'pointerup', e => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
  }

  // ══════════ STARFIELD VANGUARD ══════════
  STARTERS.vanguard = function (S) {
    const cv = S.canvas(760, 460), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles(), stars = makeStars(90, W, H);
    const COLORS = ['#38bdf8', '#a855f7', '#f43f5e'];
    const P = { x: W / 2, y: H - 42, cd: 0, inv: 90, power: 0 };
    let lives = 3, score = 0, wave = 0, t = 0, shake = 0, banner = '', bannerSub = '', bannerT = 0, nextIn = 50, won = false;
    let pointerX = null, firing = false, shots = [], foes = [], bolts = [], drops = [], boss = null;
    S.pad(['left', 'right', 'fire']);
    S.on(cv.el, 'pointermove', e => { pointerX = cv.toLocal(e).x; });
    S.on(cv.el, 'pointerdown', e => { pointerX = cv.toLocal(e).x; firing = true; });
    S.on(window, 'pointerup', () => { firing = false; });
    S.on(cv.el, 'pointerleave', () => { if (!firing) pointerX = null; });

    function say(text, sub, frames) { banner = text; bannerSub = sub || ''; bannerT = frames || 110; }
    function spawnWave(n) {
      wave = n;
      const rows = n === 1 ? 3 : 4, cols = n === 3 ? 9 : 8;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const type = r === 0 ? 2 : r < 2 ? 1 : 0;
        foes.push({ hx: (c - (cols - 1) / 2) * 58, hy: 62 + r * 44, x: W / 2 + (c - (cols - 1) / 2) * 24, y: -40 - r * 46 - c * 10, type: type, hp: type === 2 ? 2 : 1, mode: 'enter', t: 0, delay: c * 5 + r * 12, phase: Math.random() * 6, flash: 0, tx: 0 });
      }
      say('WAVE ' + n + ' / 3', n === 1 ? 'Raiders inbound' : 'They dive faster now');
      S.sfx('level');
    }
    function aimShot(x, y, sp) {
      const dx = P.x - x, dy = P.y - y, d = Math.hypot(dx, dy) || 1;
      bolts.push({ x: x, y: y, vx: dx / d * sp * 0.55, vy: Math.max(1.8, dy / d * sp) });
    }
    function hurt() {
      if (P.inv > 0 || won || lives <= 0) return;
      lives--;
      shake = 14; P.inv = 140; P.power = 0;
      fx.burst(P.x, P.y, '#38bdf8', 46, 5, 55, 3);
      fx.burst(P.x, P.y, '#fde047', 20, 3, 40, 2);
      S.sfx('boom');
      if (lives <= 0) S.end(false, score, 'Ship lost', 'You fell in wave ' + Math.min(wave, 3) + (boss ? ' at the mothership' : '') + '. The armada holds the sector, for now.', 1300);
    }
    function kill(f, i) {
      const pts = [100, 150, 250][f.type] * (f.mode === 'dive' ? 2 : 1);
      score += pts;
      fx.burst(f.x, f.y, COLORS[f.type], 24, 4, 38);
      fx.text(f.x, f.y - 6, '+' + pts, f.mode === 'dive' ? '#fde047' : '#e2e8f0');
      S.sfx('hit');
      if (f.type === 2 && Math.random() < 0.22) drops.push({ x: f.x, y: f.y, kind: Math.random() < 0.3 ? 'life' : 'twin' });
      foes.splice(i, 1);
    }

    function update() {
      t++;
      shake *= 0.88;
      if (bannerT > 0) bannerT--;
      let mv = (S.act.right ? 1 : 0) - (S.act.left ? 1 : 0);
      if (mv) { P.x += mv * 5.8; pointerX = null; } else if (pointerX != null) P.x += (pointerX - P.x) * 0.22;
      P.x = clamp(P.x, 24, W - 24);
      if (P.inv > 0) P.inv--;
      if (P.power > 0) P.power--;
      if (P.cd > 0) P.cd--;
      if ((S.act.fire || firing) && P.cd === 0 && lives > 0 && !won) {
        if (P.power > 0) { shots.push({ x: P.x - 10, y: P.y - 12 }, { x: P.x + 10, y: P.y - 12 }); P.cd = 7; }
        else { shots.push({ x: P.x, y: P.y - 18 }); P.cd = 10; }
        S.sfx('shoot');
      }
      shots.forEach(s => { s.y -= 10.5; });
      shots = shots.filter(s => s.y > -20);

      if (!boss && !foes.length && !won) {
        if (nextIn > 0) nextIn--;
        else if (wave < 3) {
          if (wave > 0) { score += wave * 1000; fx.text(W / 2, H / 2 + 40, 'WAVE CLEAR +' + wave * 1000, '#34d399'); }
          spawnWave(wave + 1);
          nextIn = 90;
        } else if (wave === 3) {
          score += 3000;
          fx.text(W / 2, H / 2 + 40, 'WAVE CLEAR +3,000', '#34d399');
          boss = { x: W / 2, y: -90, hp: 80, max: 80, t: 0, flash: 0 };
          wave = 4;
          say('MOTHERSHIP', 'Hit the core. Watch for its spread shots', 140);
          S.sfx('power');
        }
      }

      const sway = Math.sin(t * 0.012) * 46;
      const diveEvery = Math.max(30, 112 - wave * 24);
      if (t % diveEvery === 0 && lives > 0) {
        const pool = foes.filter(f => f.mode === 'form');
        if (pool.length) { const f = pick(pool); f.mode = 'dive'; f.t = 0; f.tx = P.x; }
      }
      for (let i = foes.length - 1; i >= 0; i--) {
        const f = foes[i];
        f.t++;
        if (f.flash) f.flash--;
        const homeX = W / 2 + f.hx + sway, homeY = f.hy + Math.sin(t * 0.05 + f.phase) * 3;
        if (f.mode === 'enter') {
          if (f.t > f.delay) {
            f.x += (homeX - f.x) * 0.06; f.y += (homeY - f.y) * 0.06;
            if (Math.abs(homeX - f.x) < 1.5 && Math.abs(homeY - f.y) < 1.5) f.mode = 'form';
          }
        } else if (f.mode === 'form') {
          f.x = homeX; f.y = homeY;
          if (Math.random() < 0.0008 * wave && bolts.length < 4 + wave * 2 && lives > 0) aimShot(f.x, f.y + 10, 2.8);
        } else if (f.mode === 'dive') {
          f.tx += (P.x - f.tx) * 0.02;
          f.x += clamp((f.tx - f.x) * 0.035, -3.4, 3.4) + Math.sin(f.t * 0.09) * 2.2;
          f.y += 2.5 + wave * 0.5;
          if ((f.t === 26 || f.t === 58) && lives > 0) aimShot(f.x, f.y + 10, 3.6);
          if (f.y > H + 30) { f.y = -30; f.mode = 'return'; }
        } else {
          f.x += (homeX - f.x) * 0.05; f.y += (homeY - f.y) * 0.05;
          if (Math.abs(homeY - f.y) < 2) f.mode = 'form';
        }
        let dead = false;
        for (let j = shots.length - 1; j >= 0; j--) {
          const s = shots[j];
          if (Math.abs(s.x - f.x) < 17 && Math.abs(s.y - f.y) < 15) {
            shots.splice(j, 1);
            f.hp--; f.flash = 6;
            if (f.hp <= 0) { kill(f, i); dead = true; break; }
            S.sfx('bounce');
          }
        }
        if (!dead && P.inv === 0 && lives > 0 && Math.hypot(f.x - P.x, f.y - P.y) < 24) { kill(f, i); hurt(); }
      }

      if (boss) {
        const b = boss;
        b.t++;
        if (b.flash) b.flash--;
        if (b.y < 78) b.y += 1.1;
        else {
          b.x = W / 2 + Math.sin(b.t * 0.011) * (W / 2 - 120);
          if (lives > 0) {
            if (b.t % 70 === 0) for (let k = -2; k <= 2; k++) bolts.push({ x: b.x + k * 16, y: b.y + 26, vx: k * 0.95, vy: 3.3 });
            if (b.t % 46 === 23) aimShot(b.x, b.y + 26, 4.3);
            if (b.hp < b.max / 2 && b.t % 130 === 65) for (let k = 0; k < 11; k++) { const a = Math.PI * (0.12 + k * 0.076); bolts.push({ x: b.x, y: b.y + 20, vx: Math.cos(a) * 2.7, vy: Math.sin(a) * 2.7 }); }
          }
        }
        for (let j = shots.length - 1; j >= 0; j--) {
          const s = shots[j];
          if (Math.abs(s.x - b.x) < 74 && Math.abs(s.y - b.y) < 24) {
            shots.splice(j, 1);
            b.hp--; b.flash = 4; score += 40;
            fx.burst(s.x, s.y, '#fbbf24', 6, 2.5, 18);
            if (b.hp <= 0) {
              won = true;
              fx.burst(b.x, b.y, '#fbbf24', 140, 7, 90, 4);
              fx.burst(b.x, b.y, '#f43f5e', 90, 5, 70, 3);
              shake = 24; bolts = []; boss = null;
              S.sfx('boom');
              const bonus = 5000 + lives * 1000;
              score += bonus;
              say('SECTOR SECURED', '+' + fmt(bonus) + ' with ' + lives + ' ship' + (lives === 1 ? '' : 's') + ' left', 200);
              S.end(true, score, 'Sector secured!', 'All three waves and the mothership are down. Mothership +5,000, ships left +' + fmt(lives * 1000) + '.', 1700);
              break;
            }
            S.sfx('bounce');
          }
        }
        if (boss && P.inv === 0 && Math.abs(P.x - boss.x) < 70 && Math.abs(P.y - boss.y) < 28) hurt();
      }

      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.x += b.vx; b.y += b.vy;
        if (b.y > H + 10 || b.x < -10 || b.x > W + 10) { bolts.splice(i, 1); continue; }
        if (Math.abs(b.x - P.x) < 10 && Math.abs(b.y - P.y) < 13 && lives > 0) { bolts.splice(i, 1); hurt(); }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += 1.8;
        if (d.y > H + 12) { drops.splice(i, 1); continue; }
        if (lives > 0 && Math.abs(d.x - P.x) < 22 && Math.abs(d.y - P.y) < 20) {
          drops.splice(i, 1);
          S.sfx('pickup');
          if (d.kind === 'life' && lives < 5) { lives++; fx.text(P.x, P.y - 26, '+1 SHIP', '#34d399'); }
          else { P.power = 720; fx.text(P.x, P.y - 26, 'TWIN CANNONS', '#fde047'); }
        }
      }
      fx.update();
      S.hud((wave >= 4 ? 'Mothership' : 'Wave ' + Math.max(1, wave) + ' / 3') + (P.power ? ' • Twin cannons' : ''), fmt(score) + ' pts', 'Ships ' + hearts(lives));
    }

    function drawShip(x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(6, -5); ctx.lineTo(19, 8); ctx.lineTo(6, 6); ctx.lineTo(0, 12); ctx.lineTo(-6, 6); ctx.lineTo(-19, 8); ctx.lineTo(-6, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-2, -11, 4, 9);
      if (P.power) { ctx.fillStyle = '#fde047'; ctx.fillRect(-12, 0, 3, 6); ctx.fillRect(9, 0, 3, 6); }
      ctx.shadowBlur = 0;
      ctx.fillStyle = Math.random() < 0.5 ? '#f97316' : '#fde047';
      ctx.beginPath(); ctx.moveTo(-4, 11); ctx.lineTo(4, 11); ctx.lineTo(0, 18 + Math.random() * 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawFoe(f) {
      const c = f.flash ? '#ffffff' : COLORS[f.type], flap = Math.sin(t * 0.2 + f.phase) * 4;
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.mode === 'dive') ctx.rotate(clamp((f.tx - f.x) * 0.012, -0.6, 0.6));
      ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 2;
      if (f.type === 0) {
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(13, -6 - flap); ctx.lineTo(4, -3); ctx.lineTo(0, -10); ctx.lineTo(-4, -3); ctx.lineTo(-13, -6 - flap); ctx.closePath(); ctx.fill();
      } else if (f.type === 1) {
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 0); ctx.lineTo(0, 12); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-18, -8 + flap); ctx.moveTo(8, 0); ctx.lineTo(18, -8 + flap); ctx.stroke();
      } else {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); }
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = f.hp > 1 ? c : '#fecdd3';
        ctx.beginPath(); ctx.arc(0, 0, 5 + Math.sin(t * 0.15) * 1.2, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    function drawBoss(b) {
      ctx.save();
      ctx.translate(b.x, b.y);
      const c = b.flash ? '#ffffff' : '#fbbf24';
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 24;
      ctx.fillStyle = '#1e1b4b'; ctx.strokeStyle = c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 78, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = b.flash ? '#ffffff' : '#f43f5e';
      ctx.beginPath(); ctx.arc(0, -8, 20, Math.PI, 0); ctx.fill();
      for (let k = -3; k <= 3; k++) {
        ctx.fillStyle = (Math.floor(b.t / 8) + k) % 2 ? '#38bdf8' : '#a855f7';
        ctx.beginPath(); ctx.arc(k * 20, 6, 3.5, 0, TAU); ctx.fill();
      }
      ctx.restore();
      const w = 320, x = (W - w) / 2;
      ctx.fillStyle = 'rgba(15,23,42,0.85)'; ctx.fillRect(x, 12, w, 9);
      ctx.fillStyle = b.hp < b.max / 2 ? '#f43f5e' : '#fbbf24'; ctx.fillRect(x, 12, w * b.hp / b.max, 9);
      ctx.strokeStyle = 'rgba(248,250,252,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, 12, w, 9);
    }
    function draw() {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#020617'); g.addColorStop(1, '#0b1033');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      drawStars(ctx, stars, W, H, S.paused || S.waiting ? 0 : 0.9);
      drops.forEach(d => {
        glowCircle(ctx, d.x, d.y, 9, d.kind === 'life' ? '#34d399' : '#fde047');
        ctx.fillStyle = '#020617'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(d.kind === 'life' ? '+1' : '2x', d.x, d.y + 3.5);
      });
      foes.forEach(drawFoe);
      if (boss) drawBoss(boss);
      ctx.fillStyle = '#fde047';
      shots.forEach(s => ctx.fillRect(s.x - 1.5, s.y - 8, 3, 14));
      ctx.fillStyle = '#fb7185';
      bolts.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 3.6, 0, TAU); ctx.fill(); });
      if (lives > 0 && (P.inv === 0 || Math.floor(P.inv / 5) % 2 === 0)) drawShip(P.x, P.y);
      fx.draw(ctx);
      ctx.restore();
      if (bannerT > 0) bannerText(ctx, banner, W, H, bannerT, bannerSub);
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ VECTOR VOID ══════════
  STARTERS.voidrocks = function (S) {
    const cv = S.canvas(760, 460), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles(), stars = makeStars(80, W, H);
    const ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 120, cd: 0, warp: 0, alive: true };
    let lasers = [], rocks = [], lives = 3, score = 0, sector = 0, t = 0, shake = 0, banner = '', bannerSub = '', bannerT = 0, nextIn = 30, respawn = 0, won = false;
    S.pad(['left', 'right', 'up', 'fire', 'alt']);
    const wrapX = v => (v % W + W) % W, wrapY = v => (v % H + H) % H;
    function makeRock(x, y, size, speed) {
      const r = [0, 13, 23, 40][size], a = Math.random() * TAU, v = (0.6 + Math.random() * 0.9) * speed * (4 - size) * 0.55;
      const verts = [], n = 9 + size * 2;
      for (let i = 0; i < n; i++) verts.push(0.72 + Math.random() * 0.42);
      return { x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: r, size: size, verts: verts, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 0.04 };
    }
    function startSector(n) {
      sector = n;
      for (let i = 0; i < 2 + n * 2; i++) {
        let x, y;
        do { x = Math.random() * W; y = Math.random() * H; } while (Math.hypot(x - ship.x, y - ship.y) < 180);
        rocks.push(makeRock(x, y, 3, 0.9 + n * 0.25));
      }
      banner = 'SECTOR ' + n + ' / 3'; bannerSub = n === 3 ? 'The dense core field' : 'Rocks split when you hit them'; bannerT = 110;
      ship.inv = Math.max(ship.inv, 90);
      S.sfx('level');
    }
    function crash() {
      ship.alive = false;
      lives--;
      shake = 16;
      fx.burst(ship.x, ship.y, '#38bdf8', 50, 5, 60, 3);
      fx.burst(ship.x, ship.y, '#f8fafc', 20, 3, 40, 2);
      S.sfx('boom');
      if (lives <= 0) S.end(false, score, 'Hull breached', 'You were lost in sector ' + sector + ' of 3.', 1300);
      else respawn = 90;
    }
    function splitRock(i) {
      const rk = rocks[i];
      const pts = [0, 200, 100, 50][rk.size];
      score += pts;
      fx.burst(rk.x, rk.y, '#c084fc', 10 + rk.size * 8, 2 + rk.size, 40);
      fx.text(rk.x, rk.y, '+' + pts, '#e9d5ff');
      shake = Math.max(shake, rk.size * 2);
      S.sfx(rk.size > 1 ? 'boom' : 'hit');
      rocks.splice(i, 1);
      if (rk.size > 1) for (let k = 0; k < 2; k++) { const n = makeRock(rk.x, rk.y, rk.size - 1, 1 + sector * 0.25); n.vx += rk.vx * 0.5; n.vy += rk.vy * 0.5; rocks.push(n); }
    }
    function update() {
      t++;
      shake *= 0.88;
      if (bannerT > 0) bannerT--;
      if (!rocks.length && !won) {
        if (nextIn > 0) nextIn--;
        else if (sector < 3) { if (sector) { score += sector * 1000; fx.text(W / 2, H / 2 + 44, 'SECTOR CLEAR +' + sector * 1000, '#34d399'); } startSector(sector + 1); nextIn = 80; }
        else {
          won = true;
          const bonus = 3000 + lives * 1000;
          score += bonus;
          banner = 'VOID CLEARED'; bannerSub = '+' + fmt(bonus); bannerT = 200;
          S.end(true, score, 'Void cleared!', 'All three sectors are clear. Final sector +3,000, ships left +' + fmt(lives * 1000) + '.', 1500);
        }
      }
      if (respawn > 0 && --respawn === 0) { ship.x = W / 2; ship.y = H / 2; ship.vx = ship.vy = 0; ship.a = -Math.PI / 2; ship.alive = true; ship.inv = 150; }
      if (ship.alive) {
        if (S.act.left) ship.a -= 0.072;
        if (S.act.right) ship.a += 0.072;
        if (S.act.up) {
          ship.vx += Math.cos(ship.a) * 0.16; ship.vy += Math.sin(ship.a) * 0.16;
          if (t % 2 === 0) fx.spark(ship.x - Math.cos(ship.a) * 12, ship.y - Math.sin(ship.a) * 12, -Math.cos(ship.a) * 2 + rand(-0.5, 0.5), -Math.sin(ship.a) * 2 + rand(-0.5, 0.5), Math.random() < 0.5 ? '#f97316' : '#fde047', 18, 3);
        }
        const sp = Math.hypot(ship.vx, ship.vy);
        if (sp > 6.5) { ship.vx *= 6.5 / sp; ship.vy *= 6.5 / sp; }
        ship.vx *= 0.992; ship.vy *= 0.992;
        ship.x = wrapX(ship.x + ship.vx); ship.y = wrapY(ship.y + ship.vy);
        if (ship.inv > 0) ship.inv--;
        if (ship.cd > 0) ship.cd--;
        if (ship.warp > 0) ship.warp--;
        if (S.act.fire && ship.cd === 0 && lasers.length < 7) {
          lasers.push({ x: ship.x + Math.cos(ship.a) * 16, y: ship.y + Math.sin(ship.a) * 16, vx: Math.cos(ship.a) * 8.5 + ship.vx, vy: Math.sin(ship.a) * 8.5 + ship.vy, life: 52 });
          ship.cd = 9;
          S.sfx('shoot');
        }
        if (S.act.alt && ship.warp === 0) {
          fx.burst(ship.x, ship.y, '#a855f7', 26, 3, 30);
          ship.x = Math.random() * W; ship.y = Math.random() * H; ship.vx = ship.vy = 0;
          ship.warp = 100; ship.inv = Math.max(ship.inv, 45);
          fx.burst(ship.x, ship.y, '#a855f7', 26, 3, 30);
          S.sfx('power');
        }
      }
      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.x = wrapX(l.x + l.vx); l.y = wrapY(l.y + l.vy);
        if (--l.life <= 0) { lasers.splice(i, 1); continue; }
        for (let k = rocks.length - 1; k >= 0; k--) {
          const rk = rocks[k];
          if (Math.hypot(l.x - rk.x, l.y - rk.y) < rk.r * 0.95 + 3) { lasers.splice(i, 1); splitRock(k); break; }
        }
      }
      rocks.forEach(rk => { rk.x = wrapX(rk.x + rk.vx); rk.y = wrapY(rk.y + rk.vy); rk.rot += rk.spin; });
      if (ship.alive && ship.inv === 0 && !won) {
        for (const rk of rocks) { if (Math.hypot(ship.x - rk.x, ship.y - rk.y) < rk.r * 0.85 + 9) { crash(); break; } }
      }
      fx.update();
      S.hud('Sector ' + clamp(sector, 1, 3) + ' / 3 • Rocks ' + rocks.length, fmt(score) + ' pts', 'Ships ' + hearts(lives) + (ship.warp ? '' : ' • Warp ready'));
    }
    function onWrap(x, y, r, fn) {
      fn(x, y);
      if (x < r) fn(x + W, y); else if (x > W - r) fn(x - W, y);
      if (y < r) fn(x, y + H); else if (y > H - r) fn(x, y - H);
    }
    function draw() {
      ctx.save();
      ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, W, H);
      if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      drawStars(ctx, stars, W, H, 0);
      ctx.lineWidth = 2;
      rocks.forEach(rk => onWrap(rk.x, rk.y, rk.r, (x, y) => {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rk.rot);
        ctx.beginPath();
        rk.verts.forEach((v, i) => { const a = i / rk.verts.length * TAU; ctx.lineTo(Math.cos(a) * rk.r * v, Math.sin(a) * rk.r * v); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(88, 28, 135, 0.28)'; ctx.fill();
        ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10;
        ctx.strokeStyle = '#c084fc'; ctx.stroke();
        ctx.restore();
      }));
      ctx.fillStyle = '#fde047';
      lasers.forEach(l => { ctx.beginPath(); ctx.arc(l.x, l.y, 2.4, 0, TAU); ctx.fill(); });
      if (ship.alive && (ship.inv === 0 || Math.floor(ship.inv / 5) % 2 === 0)) onWrap(ship.x, ship.y, 18, (x, y) => {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(ship.a);
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 14;
        ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-12, 10); ctx.lineTo(-7, 0); ctx.lineTo(-12, -10); ctx.closePath(); ctx.stroke();
        if (S.act.up && !S.paused) { ctx.strokeStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(-9, 4); ctx.lineTo(-17 - Math.random() * 8, 0); ctx.lineTo(-9, -4); ctx.stroke(); }
        ctx.restore();
      });
      fx.draw(ctx);
      ctx.restore();
      if (bannerT > 0) bannerText(ctx, banner, W, H, bannerT, bannerSub);
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ DATA-STREAM CROSSING ══════════
  STARTERS.crossing = function (S) {
    const CELL = 36, COLS = 21, ROWS = 13;
    const cv = S.canvas(COLS * CELL, ROWS * CELL), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const DOCKS = [2, 6, 10, 14, 18], filled = [false, false, false, false, false];
    const LANES = [
      { row: 1, river: true, speed: 1.1, len: 4, gap: 7, color: '#22d3ee' },
      { row: 2, river: true, speed: -1.5, len: 3, gap: 6, color: '#a78bfa' },
      { row: 3, river: true, speed: 0.8, len: 5, gap: 9, color: '#34d399' },
      { row: 4, river: true, speed: -1.8, len: 2, gap: 4.5, color: '#f472b6' },
      { row: 5, river: true, speed: 1.3, len: 3, gap: 6, color: '#38bdf8' },
      { row: 7, speed: -1.4, len: 2, gap: 7, color: '#f97316' },
      { row: 8, speed: 2, len: 1, gap: 5.5, color: '#facc15' },
      { row: 9, speed: -1.2, len: 1, gap: 4.5, color: '#f43f5e' },
      { row: 10, speed: 2.6, len: 1, gap: 8, color: '#a855f7' },
      { row: 11, speed: -0.9, len: 1, gap: 4, color: '#22d3ee' },
    ];
    LANES.forEach(l => {
      const step = l.gap * CELL, count = Math.ceil((W + l.len * CELL) / step) + 1, off = Math.random() * step;
      l.span = count * step;
      l.items = [];
      for (let k = 0; k < count; k++) l.items.push(off + k * step - l.len * CELL);
    });
    const laneAt = row => LANES.find(l => l.row === row);
    const TIME = 45 * 60, HOP = 8;
    const P = { x: 0, row: 12, fromX: 0, fromRow: 12, toX: 0, toRow: 12, hop: 0, face: 'up', alive: true };
    let lives = 4, score = 0, timer = TIME, furthest = 12, t = 0, respawn = 0, done = false;
    const mult = () => 1 + filled.filter(Boolean).length * 0.12;
    function reset() {
      P.x = P.fromX = P.toX = 10 * CELL + CELL / 2;
      P.row = P.fromRow = P.toRow = 12;
      P.hop = 0; P.alive = true; P.face = 'up';
      timer = TIME; furthest = 12;
    }
    reset();
    function die(kind) {
      if (!P.alive || done) return;
      P.alive = false;
      lives--;
      const y = P.row * CELL + CELL / 2;
      if (kind === 'splash') { fx.burst(P.x, y, '#38bdf8', 34, 3.5, 40); S.sfx('splash'); }
      else { fx.burst(P.x, y, '#f97316', 34, 4, 45); fx.burst(P.x, y, '#fde047', 14, 3, 30); S.sfx('boom'); }
      fx.text(P.x, y - 14, { splash: 'SPLASH', hit: 'CRASH', drift: 'SWEPT AWAY', time: 'OUT OF TIME', wall: 'NO DOCK THERE' }[kind] || 'OUCH', '#fecaca');
      if (lives <= 0) { done = true; S.end(false, score, 'Out of hoppers', filled.filter(Boolean).length + ' of 5 docks filled.', 1200); }
      else respawn = 70;
    }
    function hop(dir) {
      if (!P.alive || P.hop || done) return;
      const d = DIR4[dir];
      P.face = dir;
      const tx = clamp(P.x + d.x * CELL, CELL / 2, W - CELL / 2), tr = clamp(P.row + d.y, 0, ROWS - 1);
      if (tx === P.x && tr === P.row) return;
      P.fromX = P.x; P.fromRow = P.row; P.toX = tx; P.toRow = tr; P.hop = 1;
      S.sfx('move');
    }
    function land() {
      P.x = P.toX; P.row = P.toRow; P.hop = 0;
      if (P.row < furthest) { score += 10; furthest = P.row; }
      if (P.row !== 0) return;
      const k = DOCKS.findIndex(c => Math.abs(P.x - (c * CELL + CELL / 2)) < CELL * 0.62);
      if (k < 0 || filled[k]) { die('wall'); return; }
      filled[k] = true;
      const bonus = 500 + Math.floor(timer / 60) * 10;
      score += bonus;
      fx.burst(DOCKS[k] * CELL + CELL / 2, CELL / 2, '#34d399', 40, 4, 50);
      fx.text(DOCKS[k] * CELL + CELL / 2, CELL + 10, '+' + bonus, '#bbf7d0');
      S.sfx('match');
      if (filled.every(Boolean)) {
        done = true;
        score += lives * 1000;
        S.end(true, score, 'All five docks filled!', 'Every hopper made it home. Hoppers left +' + fmt(lives * 1000) + '.', 900);
        return;
      }
      reset();
    }
    S.onKey(a => { if (DIR4[a]) hop(a); });
    S.on(cv.el, 'pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = cv.toLocal(e), dx = p.x - P.x, dy = p.y - (P.row * CELL + CELL / 2);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
      hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    S.pad(['left', 'up', 'down', 'right']);

    function update() {
      t++;
      const m = mult();
      LANES.forEach(l => {
        for (let i = 0; i < l.items.length; i++) {
          let x = l.items[i] + l.speed * m;
          if (l.speed > 0 && x > W) x -= l.span;
          if (l.speed < 0 && x + l.len * CELL < 0) x += l.span;
          l.items[i] = x;
        }
      });
      if (respawn > 0 && --respawn === 0 && !done) reset();
      if (P.alive && !done) {
        if (P.hop) { P.hop++; if (P.hop > HOP) land(); }
        else {
          const lane = laneAt(P.row);
          if (lane && lane.river) {
            const on = lane.items.some(x => P.x > x + 3 && P.x < x + lane.len * CELL - 3);
            if (!on) die('splash');
            else { P.x += lane.speed * m; if (P.x < 6 || P.x > W - 6) die('drift'); }
          } else if (lane) {
            if (lane.items.some(x => P.x + 11 > x + 4 && P.x - 11 < x + lane.len * CELL - 4)) die('hit');
          }
        }
        if (P.alive && --timer <= 0) die('time');
      }
      fx.update();
      S.hud('Docks ' + filled.filter(Boolean).length + ' / 5 • Time ' + Math.ceil(timer / 60), fmt(score) + ' pts', 'Hoppers ' + hearts(lives));
    }
    function draw() {
      for (let r = 0; r < ROWS; r++) {
        const y = r * CELL;
        if (r === 0) ctx.fillStyle = '#052e2b';
        else if (r <= 5) ctx.fillStyle = r % 2 ? '#0a1b3d' : '#0c2149';
        else if (r === 6 || r === 12) ctx.fillStyle = '#1e1b4b';
        else ctx.fillStyle = '#0f1220';
        ctx.fillRect(0, y, W, CELL);
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)'; ctx.lineWidth = 1;
      for (let r = 1; r <= 5; r++) for (let k = 0; k < 6; k++) {
        const x = ((k * 160 + t * (r % 2 ? 0.6 : -0.6)) % (W + 80) + W + 80) % (W + 80) - 40;
        ctx.beginPath(); ctx.moveTo(x, r * CELL + 12 + (k % 3) * 6); ctx.lineTo(x + 30, r * CELL + 12 + (k % 3) * 6); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'; ctx.setLineDash([14, 12]);
      for (let r = 8; r <= 11; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.18)';
      [6, 12].forEach(r => { for (let c = 0; c < COLS; c++) ctx.strokeRect(c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6); });
      DOCKS.forEach((c, k) => {
        const x = c * CELL;
        ctx.fillStyle = filled[k] ? 'rgba(52, 211, 153, 0.35)' : '#020617';
        roundRect(ctx, x - 4, 3, CELL + 8, CELL - 6, 8); ctx.fill();
        ctx.save(); ctx.shadowColor = '#34d399'; ctx.shadowBlur = 10; ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        if (filled[k]) drawHopper(x + CELL / 2, CELL / 2, 'up', 0, 0.8);
      });
      LANES.forEach(l => {
        const y = l.row * CELL;
        l.items.forEach(x => {
          const w = l.len * CELL;
          if (x > W || x + w < 0) return;
          ctx.save();
          if (l.river) {
            const g = ctx.createLinearGradient(x, y, x, y + CELL);
            g.addColorStop(0, l.color); g.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
            ctx.fillStyle = g; ctx.globalAlpha = 0.85;
            roundRect(ctx, x + 2, y + 5, w - 4, CELL - 10, 9); ctx.fill();
            ctx.globalAlpha = 1; ctx.strokeStyle = l.color; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
            for (let b = 0; b < l.len * 2; b++) ctx.fillRect(x + 10 + b * 17, y + CELL / 2 - 2, 9, 4);
          } else {
            const fwd = l.speed > 0;
            ctx.shadowColor = l.color; ctx.shadowBlur = 12;
            ctx.fillStyle = l.color;
            roundRect(ctx, x + 3, y + 7, w - 6, CELL - 14, 7); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
            ctx.fillRect(fwd ? x + w - 18 : x + 8, y + 11, 10, CELL - 22);
            ctx.fillStyle = '#fef9c3';
            ctx.fillRect(fwd ? x + w - 5 : x + 2, y + 10, 3, 4);
            ctx.fillRect(fwd ? x + w - 5 : x + 2, y + CELL - 14, 3, 4);
          }
          ctx.restore();
        });
      });
      if (P.alive) {
        const k = P.hop ? P.hop / HOP : 0;
        const x = P.hop ? P.fromX + (P.toX - P.fromX) * k : P.x;
        const row = P.hop ? P.fromRow + (P.toRow - P.fromRow) * k : P.row;
        drawHopper(x, row * CELL + CELL / 2, P.face, P.hop ? Math.sin(k * Math.PI) : 0, 1);
      }
      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)'; ctx.fillRect(0, H - 5, W, 5);
      ctx.fillStyle = timer < 600 ? '#f43f5e' : '#34d399'; ctx.fillRect(0, H - 5, W * timer / TIME, 5);
      fx.draw(ctx);
    }
    function drawHopper(x, y, face, lift, scale) {
      ctx.save();
      ctx.translate(x, y - lift * 9);
      ctx.scale(scale * (1 - lift * 0.12), scale * (1 + lift * 0.18));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath(); ctx.ellipse(0, 12 + lift * 9, 11, 4, 0, 0, TAU); ctx.fill();
      ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#5eead4';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      const d = DIR4[face] || DIR4.up;
      ctx.fillStyle = '#042f2e';
      roundRect(ctx, -8 + d.x * 3, -5 + d.y * 3, 16, 7, 3); ctx.fill();
      ctx.fillStyle = '#f0fdfa';
      ctx.fillRect(-5 + d.x * 4, -3 + d.y * 3, 3, 3); ctx.fillRect(2 + d.x * 4, -3 + d.y * 3, 3, 3);
      ctx.strokeStyle = '#99f6e4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -17); ctx.stroke();
      ctx.restore();
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ PRISM BREAKER ══════════
  STARTERS.breaker = function (S) {
    const cv = S.canvas(760, 500), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const LEVELS = [
      ['111111111111', '122222222221', '111111111111', '1..111111..1'],
      ['.....33.....', '....2222....', '...111111...', '..22222222..', '...111111...', '....2222....', '.....11.....'],
      ['333333333333', '2S........S2', '21.222222.12', '21.2S33S2.12', '21.222222.12', '2S........S2', '111111111111'],
    ];
    const COLS = 12, BW = 56, BH = 22, GAP = 4, LEFT = (W - (COLS * (BW + GAP) - GAP)) / 2, TOP = 64;
    const HUES = { 1: ['#22d3ee', '#0e7490'], 2: ['#a855f7', '#6b21a8'], 3: ['#f43f5e', '#9f1239'] };
    const pad = { x: W / 2 - 55, w: 110, y: H - 32, h: 12 };
    let level = 0, bricks = [], balls = [], caps = [], lives = 3, score = 0, wide = 0, slow = 0, speed = 5.2, t = 0, banner = '', bannerT = 0, pointerX = null, done = false, shake = 0;
    function load(n) {
      level = n;
      bricks = [];
      LEVELS[n - 1].forEach((row, r) => row.split('').forEach((ch, c) => {
        if (ch === '.') return;
        const steel = ch === 'S', hp = steel ? 0 : Number(ch);
        bricks.push({ x: LEFT + c * (BW + GAP), y: TOP + r * (BH + GAP), hp: hp, max: hp, steel: steel, flash: 0 });
      }));
      speed = 5.2 + (n - 1) * 0.4;
      balls = [{ x: pad.x + pad.w / 2, y: pad.y - 8, vx: 0, vy: 0, stuck: true, trail: [] }];
      caps = [];
      banner = 'FORTRESS ' + n + ' / 3'; bannerT = 110;
      S.sfx('level');
    }
    load(1);
    S.on(cv.el, 'pointermove', e => { pointerX = cv.toLocal(e).x; });
    S.on(cv.el, 'pointerdown', e => { pointerX = cv.toLocal(e).x; launch(); });
    S.onKey(a => { if (a === 'fire') launch(); });
    S.pad(['left', 'right', 'fire']);
    function launch() {
      balls.forEach(b => {
        if (!b.stuck) return;
        const a = rand(-0.35, 0.35);
        b.stuck = false; b.vx = speed * Math.sin(a); b.vy = -speed * Math.cos(a);
        S.sfx('bounce');
      });
    }
    const destructible = () => bricks.some(b => !b.steel);
    function hitBrick(b) {
      if (b.steel) { b.flash = 6; S.sfx('bounce'); return; }
      b.hp--; b.flash = 6;
      score += 50;
      if (b.hp > 0) { S.sfx('bounce'); return; }
      score += 50 * b.max;
      fx.burst(b.x + BW / 2, b.y + BH / 2, HUES[b.max][0], 18, 3.5, 34);
      bricks.splice(bricks.indexOf(b), 1);
      S.sfx('hit');
      speed = Math.min(8.6, speed + 0.035);
      if (Math.random() < 0.13) caps.push({ x: b.x + BW / 2, y: b.y + BH / 2, kind: pick(['W', 'W', 'M', 'S', Math.random() < 0.35 ? 'L' : 'M']) });
    }
    function update() {
      t++;
      shake *= 0.86;
      if (bannerT > 0) bannerT--;
      if (wide > 0) wide--;
      if (slow > 0) slow--;
      const targetW = wide ? 170 : 110;
      const cx = pad.x + pad.w / 2;
      pad.w += (targetW - pad.w) * 0.2;
      let x = cx;
      if (S.act.left) { x -= 9; pointerX = null; }
      if (S.act.right) { x += 9; pointerX = null; }
      if (pointerX != null) x += (pointerX - x) * 0.35;
      pad.x = clamp(x - pad.w / 2, 6, W - pad.w - 6);
      if (S.act.fire) launch();
      const sp = speed * (slow ? 0.68 : 1);
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (b.stuck) { b.x = pad.x + pad.w / 2; b.y = pad.y - 8; continue; }
        const v = Math.hypot(b.vx, b.vy) || 1;
        b.vx *= sp / v; b.vy *= sp / v;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 7) b.trail.shift();
        for (let step = 0; step < 3; step++) {
          b.x += b.vx / 3; b.y += b.vy / 3;
          if (b.x < 7) { b.x = 7; b.vx = Math.abs(b.vx); S.sfx('bounce'); }
          if (b.x > W - 7) { b.x = W - 7; b.vx = -Math.abs(b.vx); S.sfx('bounce'); }
          if (b.y < 7) { b.y = 7; b.vy = Math.abs(b.vy); S.sfx('bounce'); }
          if (b.vy > 0 && b.y + 7 >= pad.y && b.y - 7 <= pad.y + pad.h && b.x >= pad.x - 7 && b.x <= pad.x + pad.w + 7) {
            const off = clamp((b.x - (pad.x + pad.w / 2)) / (pad.w / 2), -1, 1), ang = off * 1.05;
            b.vx = sp * Math.sin(ang); b.vy = -sp * Math.cos(ang); b.y = pad.y - 7;
            fx.burst(b.x, pad.y, '#7dd3fc', 6, 2, 16);
            S.sfx('bounce');
          }
          for (const br of bricks) {
            const nx = clamp(b.x, br.x, br.x + BW), ny = clamp(b.y, br.y, br.y + BH);
            const dx = b.x - nx, dy = b.y - ny;
            if (dx * dx + dy * dy > 49) continue;
            if (Math.abs(dx) > Math.abs(dy)) { b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx); b.x = dx > 0 ? br.x + BW + 7 : br.x - 7; }
            else { b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy); b.y = dy > 0 ? br.y + BH + 7 : br.y - 7; }
            hitBrick(br);
            break;
          }
        }
        if (b.y > H + 20) balls.splice(i, 1);
      }
      if (!balls.length && !done) {
        lives--;
        shake = 10;
        S.sfx('lose');
        if (lives <= 0) { done = true; S.end(false, score, 'Out of balls', 'You reached fortress ' + level + ' of 3.', 900); }
        else { balls = [{ x: pad.x + pad.w / 2, y: pad.y - 8, vx: 0, vy: 0, stuck: true, trail: [] }]; wide = 0; slow = 0; banner = hearts(lives) + ' left'; bannerT = 80; }
      }
      for (let i = caps.length - 1; i >= 0; i--) {
        const c = caps[i];
        c.y += 2.2;
        if (c.y > H + 12) { caps.splice(i, 1); continue; }
        if (c.y + 8 >= pad.y && c.y - 8 <= pad.y + pad.h && c.x >= pad.x - 12 && c.x <= pad.x + pad.w + 12) {
          caps.splice(i, 1);
          S.sfx('pickup');
          if (c.kind === 'W') { wide = 900; fx.text(c.x, pad.y - 16, 'WIDE', '#7dd3fc'); }
          else if (c.kind === 'S') { slow = 700; fx.text(c.x, pad.y - 16, 'SLOW', '#bbf7d0'); }
          else if (c.kind === 'L') { lives = Math.min(5, lives + 1); fx.text(c.x, pad.y - 16, '+1 BALL', '#fecdd3'); }
          else {
            const extra = [];
            balls.forEach(b => { if (b.stuck) return; [-0.4, 0.4].forEach(da => { const a = Math.atan2(b.vy, b.vx) + da; extra.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, stuck: false, trail: [] }); }); });
            balls = balls.concat(extra).slice(0, 12);
            fx.text(c.x, pad.y - 16, 'MULTI', '#e9d5ff');
          }
        }
      }
      bricks.forEach(b => { if (b.flash) b.flash--; });
      if (!destructible() && !done) {
        score += 1000 * level;
        if (level >= 3) { done = true; score += lives * 1000; S.end(true, score, 'All fortresses shattered!', 'Three fortresses down. Balls left +' + fmt(lives * 1000) + '.', 700); }
        else { fx.text(W / 2, H / 2 + 40, 'FORTRESS CLEAR +' + 1000 * level, '#34d399'); load(level + 1); }
      }
      fx.update();
      S.hud('Fortress ' + level + ' / 3' + (wide ? ' • Wide' : '') + (slow ? ' • Slow' : ''), fmt(score) + ' pts', 'Balls ' + hearts(lives));
    }
    function draw() {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1033'); g.addColorStop(1, '#020617');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      bricks.forEach(b => {
        if (b.steel) {
          const sg = ctx.createLinearGradient(b.x, b.y, b.x + BW, b.y + BH);
          sg.addColorStop(0, '#94a3b8'); sg.addColorStop(0.5, b.flash ? '#ffffff' : '#e2e8f0'); sg.addColorStop(1, '#475569');
          ctx.fillStyle = sg;
          roundRect(ctx, b.x, b.y, BW, BH, 4); ctx.fill();
          return;
        }
        const hue = HUES[b.max];
        const bg = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BH);
        bg.addColorStop(0, b.flash ? '#ffffff' : hue[0]); bg.addColorStop(1, hue[1]);
        ctx.fillStyle = bg;
        roundRect(ctx, b.x, b.y, BW, BH, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(b.x + 4, b.y + 3, BW - 8, 3);
        if (b.hp < b.max) {
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.7)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(b.x + BW * 0.3, b.y + 2); ctx.lineTo(b.x + BW * 0.45, b.y + BH * 0.6); ctx.lineTo(b.x + BW * 0.62, b.y + BH - 2); ctx.stroke();
        }
      });
      caps.forEach(c => {
        const col = { W: '#38bdf8', M: '#a855f7', S: '#34d399', L: '#f43f5e' }[c.kind];
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col;
        roundRect(ctx, c.x - 15, c.y - 8, 30, 16, 8); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#020617'; ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(c.kind, c.x, c.y + 4);
      });
      ctx.save();
      ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18;
      const pg = ctx.createLinearGradient(0, pad.y, 0, pad.y + pad.h);
      pg.addColorStop(0, '#e0f2fe'); pg.addColorStop(1, '#0284c7');
      ctx.fillStyle = pg;
      roundRect(ctx, pad.x, pad.y, pad.w, pad.h, 6); ctx.fill();
      ctx.restore();
      balls.forEach(b => {
        b.trail.forEach((p, i) => { ctx.globalAlpha = (i + 1) / b.trail.length * 0.35; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill(); });
        ctx.globalAlpha = 1;
        glowCircle(ctx, b.x, b.y, 7, '#fde047', 16);
      });
      fx.draw(ctx);
      ctx.restore();
      if (balls.some(b => b.stuck) && !S.waiting && !done) { ctx.fillStyle = 'rgba(226, 232, 240, 0.7)'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Click or press Space to launch', W / 2, H - 60); }
      if (bannerT > 0) bannerText(ctx, banner, W, H, bannerT);
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ OUROBOROS GRID ══════════
  STARTERS.snake = function (S) {
    const CELL = 24, COLS = 30, ROWS = 20, GOAL = 25;
    const cv = S.canvas(COLS * CELL, ROWS * CELL), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    let snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }];
    let dir = DIR4.right, queue = [], grow = 0, eaten = 0, score = 0, acc = 0, t = 0, dead = false, flash = 0, gold = null;
    const occupied = (x, y) => snake.some(s => s.x === x && s.y === y);
    function freeCell() {
      for (let k = 0; k < 500; k++) {
        const c = { x: randInt(1, COLS - 2), y: randInt(1, ROWS - 2) };
        if (!occupied(c.x, c.y) && !(food && food.x === c.x && food.y === c.y) && !(gold && gold.x === c.x && gold.y === c.y)) return c;
      }
      return { x: 1, y: 1 };
    }
    let food = null;
    food = freeCell();
    const stepEvery = () => Math.max(4, 8 - Math.floor(eaten / 5));
    function turn(a) {
      const d = DIR4[a];
      if (!d || dead) return;
      const lastD = queue.length ? queue[queue.length - 1] : dir;
      if ((d.x === -lastD.x && d.y === -lastD.y) || (d.x === lastD.x && d.y === lastD.y)) return;
      if (queue.length < 2) queue.push(d);
    }
    S.onKey(a => turn(a));
    swipeInput(S, cv.el, turn);
    S.pad(['left', 'up', 'down', 'right']);
    function die() {
      dead = true; flash = 30;
      snake.forEach((s, i) => { if (i % 2 === 0) fx.burst(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, '#34d399', 6, 3, 40); });
      S.sfx('boom');
      S.end(false, score, eaten >= 15 ? 'So close!' : 'Crashed', 'You harvested ' + eaten + ' of ' + GOAL + ' cores.', 1100);
    }
    function step() {
      if (queue.length) dir = queue.shift();
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const body = grow > 0 ? snake : snake.slice(0, -1);
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || body.some(s => s.x === head.x && s.y === head.y)) { die(); return; }
      snake.unshift(head);
      const px = head.x * CELL + CELL / 2, py = head.y * CELL + CELL / 2;
      if (head.x === food.x && head.y === food.y) {
        eaten++; grow += 1;
        const pts = 100 + Math.floor(eaten / 5) * 20;
        score += pts;
        fx.burst(px, py, '#fde047', 18, 3, 30);
        fx.text(px, py - 12, '+' + pts, '#fef08a');
        S.sfx('pickup');
        food = freeCell();
        if (eaten % 5 === 0 && !gold) gold = Object.assign(freeCell(), { life: 360 });
        if (eaten >= GOAL) {
          dead = true;
          score += 1500;
          S.end(true, score, 'Grid harvested!', 'All ' + GOAL + ' cores collected (+1,500).', 700);
        }
      } else if (gold && head.x === gold.x && head.y === gold.y) {
        score += 500; grow += 2;
        fx.burst(px, py, '#fbbf24', 30, 4, 40);
        fx.text(px, py - 12, '+500', '#fbbf24');
        S.sfx('match');
        gold = null;
      }
      if (grow > 0) grow--; else snake.pop();
    }
    function update() {
      t++;
      if (flash > 0) flash--;
      if (gold && --gold.life <= 0) gold = null;
      if (!dead) { acc++; if (acc >= stepEvery()) { acc = 0; step(); } }
      fx.update();
      S.hud('Cores ' + eaten + ' / ' + GOAL + ' • Speed ' + (9 - stepEvery()), fmt(score) + ' pts', 'Best ' + fmt(progressOf('snake').best));
    }
    function draw() {
      ctx.fillStyle = flash ? 'rgba(127, 29, 29, ' + (0.4 + flash / 60) + ')' : '#030a12';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.12)';
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
      ctx.save(); ctx.strokeStyle = '#34d399'; ctx.shadowColor = '#34d399'; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2); ctx.restore();
      const pulse = 1 + Math.sin(t * 0.15) * 0.15;
      glowCircle(ctx, food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, 6 * pulse, '#fde047', 16);
      if (gold) {
        const gx = gold.x * CELL + CELL / 2, gy = gold.y * CELL + CELL / 2;
        if (gold.life > 90 || Math.floor(t / 6) % 2) glowCircle(ctx, gx, gy, 8 * pulse, '#fbbf24', 20);
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gx, gy, 12, -Math.PI / 2, -Math.PI / 2 + TAU * gold.life / 360); ctx.stroke();
      }
      snake.forEach((s, i) => {
        const k = i / Math.max(1, snake.length - 1);
        ctx.fillStyle = 'hsl(' + (160 - k * 70) + ', 85%, ' + (62 - k * 22) + '%)';
        roundRect(ctx, s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, i === 0 ? 8 : 6);
        ctx.fill();
      });
      const h = snake[0], hx = h.x * CELL + CELL / 2, hy = h.y * CELL + CELL / 2;
      ctx.fillStyle = '#022c22';
      const ex = dir.y !== 0 ? 5 : 0, ey = dir.x !== 0 ? 5 : 0;
      ctx.beginPath(); ctx.arc(hx + dir.x * 4 - ex, hy + dir.y * 4 - ey, 2.6, 0, TAU); ctx.arc(hx + dir.x * 4 + ex, hy + dir.y * 4 + ey, 2.6, 0, TAU); ctx.fill();
      fx.draw(ctx);
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ CIRCUIT RUNNER ══════════
  STARTERS.maze = function (S) {
    const MAP = [
      '#####################',
      '#o........#........o#',
      '#.##.####.#.####.##.#',
      '#...................#',
      '#.##.#.#######.#.##.#',
      '#....#.........#....#',
      '####.#.###-###.#.####',
      'T....#.#GGGGG#.#....T',
      '####.#.#######.#.####',
      '#.........#.........#',
      '#.##.###.###.###.##.#',
      '#o..#.....P.....#..o#',
      '##.##.#.#####.#.##.##',
      '#...................#',
      '#####################',
    ];
    const CELL = 30, COLS = 21, ROWS = 15;
    const cv = S.canvas(COLS * CELL, ROWS * CELL), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const grid = MAP.map(r => r.split(''));
    const ch = (c, r) => r < 0 || r >= ROWS ? '#' : grid[r][(c + COLS) % COLS];
    let dotsLeft = 0;
    grid.forEach(row => row.forEach(v => { if (v === '.' || v === 'o') dotsLeft++; }));
    const totalDots = dotsLeft;
    const playerBlocked = (c, r) => { const v = ch(c, r); return v === '#' || v === '-' || v === 'G'; };
    const droneBlocked = (c, r) => { const v = ch(c, r); return v === '#' || v === '-' || v === 'G'; };
    const HOME = { c: 10, r: 5 };
    // Distance to the pen door, for drones heading home after being caught.
    const homeDist = grid.map(row => row.map(() => Infinity));
    (function () {
      const q = [[HOME.c, HOME.r]];
      homeDist[HOME.r][HOME.c] = 0;
      while (q.length) {
        const p = q.shift();
        Object.keys(DIR4).forEach(k => {
          const d = DIR4[k], nc = (p[0] + d.x + COLS) % COLS, nr = p[1] + d.y;
          if (droneBlocked(nc, nr) || homeDist[nr][nc] !== Infinity) return;
          homeDist[nr][nc] = homeDist[p[1]][p[0]] + 1;
          q.push([nc, nr]);
        });
      }
    })();
    const center = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
    const STILL = { x: 0, y: 0 };
    const isStill = d => d.x === 0 && d.y === 0;
    const posOf = m => ({ x: (m.c + m.dir.x * m.prog) * CELL + CELL / 2, y: (m.r + m.dir.y * m.prog) * CELL + CELL / 2 });
    function advance(m, speed, choose, arrive) {
      if (isStill(m.dir)) { choose(m); if (isStill(m.dir)) return; }
      m.prog += speed / CELL;
      while (m.prog >= 1) {
        m.prog -= 1;
        m.c = (m.c + m.dir.x + COLS) % COLS;
        m.r += m.dir.y;
        if (arrive) arrive(m);
        choose(m);
        if (isStill(m.dir)) { m.prog = 0; break; }
      }
    }

    // Turn around mid-corridor without jumping: step the base cell forward first.
    function reverse(m) {
      if (isStill(m.dir)) return;
      if (m.prog > 0) { m.c = (m.c + m.dir.x + COLS) % COLS; m.r += m.dir.y; m.prog = 1 - m.prog; }
      m.dir = { x: -m.dir.x, y: -m.dir.y };
    }
    const P = { c: 10, r: 11, dir: STILL, want: DIR4.left, prog: 0, alive: true, dying: 0 };
    const DRONES = [
      { name: 'Seeker', color: '#f43f5e', corner: { c: 19, r: 1 } },
      { name: 'Interceptor', color: '#f97316', corner: { c: 1, r: 1 } },
      { name: 'Wanderer', color: '#a3e635', corner: { c: 19, r: 13 } },
      { name: 'Sentinel', color: '#a855f7', corner: { c: 1, r: 13 } },
    ];
    let drones = [], lives = 3, score = 0, t = 0, modeT = 0, fright = 0, chain = 0, readyT = 100, shard = null, shardsMade = 0, done = false, wander = { c: 10, r: 9 };
    function resetActors() {
      P.c = 10; P.r = 11; P.dir = STILL; P.want = DIR4.left; P.prog = 0; P.alive = true; P.dying = 0;
      drones = DRONES.map((d, i) => ({
        def: d, i: i, c: 10, r: 5, dir: DIR4.left, prog: 0,
        mode: i === 0 ? 'free' : 'pen', free: i === 0, wait: [0, 150, 360, 600][i],
        px: center(9 + i - 1, 7).x, py: center(9, 7).y, path: null,
      }));
      fright = 0; readyT = 100;
    }
    resetActors();

    function targetFor(d) {
      const regroup = modeT % 1500 < 300;
      if (regroup) return d.def.corner;
      if (d.i === 0) return { c: P.c, r: P.r };
      if (d.i === 1) { const pd = isStill(P.dir) ? P.want : P.dir; return { c: P.c + pd.x * 3, r: P.r + pd.y * 3 }; }
      if (d.i === 2) { if (t % 240 === 0) wander = { c: randInt(1, 19), r: randInt(1, 13) }; return t % 480 < 240 ? { c: P.c, r: P.r } : wander; }
      let best = null, bestD = Infinity;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === 'o') { const dd = Math.hypot(c - P.c, r - P.r); if (dd < bestD) { bestD = dd; best = { c: c, r: r }; } }
      return best || { c: P.c, r: P.r };
    }
    function chooseDrone(d) {
      const opts = ['up', 'left', 'down', 'right'].map(k => DIR4[k]).filter(o => !droneBlocked(d.c + o.x, d.r + o.y));
      let choices = opts.filter(o => !(o.x === -d.dir.x && o.y === -d.dir.y));
      if (!choices.length) choices = opts;
      if (!choices.length) { d.dir = STILL; return; }
      if (d.mode === 'eyes') {
        choices.sort((a, b) => homeDist[d.r + a.y][(d.c + a.x + COLS) % COLS] - homeDist[d.r + b.y][(d.c + b.x + COLS) % COLS]);
        d.dir = choices[0];
        return;
      }
      if (d.mode === 'fright') { d.dir = pick(choices); return; }
      const tg = targetFor(d);
      let best = choices[0], bestD = Infinity;
      choices.forEach(o => { const dd = Math.pow(d.c + o.x - tg.c, 2) + Math.pow(d.r + o.y - tg.r, 2); if (dd < bestD) { bestD = dd; best = o; } });
      d.dir = best;
    }
    function eat(m) {
      const v = grid[m.r][m.c];
      if (v === '.') { grid[m.r][m.c] = ' '; dotsLeft--; score += 10; if (t % 2 === 0) S.tone(880, 0.03, 'triangle'); }
      else if (v === 'o') {
        grid[m.r][m.c] = ' '; dotsLeft--; score += 50;
        fright = 420; chain = 0;
        drones.forEach(d => { if (d.mode === 'free' || d.mode === 'fright') { d.mode = 'fright'; reverse(d); } });
        S.sfx('power');
      }
      if (shard && m.c === shard.c && m.r === shard.r) { score += 500; fx.text(posOf(m).x, posOf(m).y - 12, '+500', '#67e8f9'); S.sfx('match'); shard = null; }
      const eatenDots = totalDots - dotsLeft;
      if (!shard && ((eatenDots >= 70 && shardsMade === 0) || (eatenDots >= 140 && shardsMade === 1))) { shard = { c: 10, r: 13, life: 540 }; shardsMade++; }
      if (dotsLeft === 0 && !done) {
        done = true;
        score += 2000 + lives * 1000;
        S.end(true, score, 'Circuit cleared!', 'Every data bit collected (+2,000). Lives left +' + fmt(lives * 1000) + '.', 900);
      }
    }
    function choosePlayer(m) {
      if (!playerBlocked(m.c + m.want.x, m.r + m.want.y)) m.dir = m.want;
      else if (playerBlocked(m.c + m.dir.x, m.r + m.dir.y)) m.dir = STILL;
    }
    S.onKey(a => { if (DIR4[a]) P.want = DIR4[a]; });
    swipeInput(S, cv.el, a => { P.want = DIR4[a]; });
    S.pad(['left', 'up', 'down', 'right']);

    function updateDrone(d) {
      if (d.mode === 'pen') {
        d.py = center(9, 7).y + Math.sin(t * 0.12 + d.i) * 4;
        if (--d.wait <= 0) { d.mode = 'leaving'; d.path = [center(10, 7), center(10, 5)]; }
        return;
      }
      if (d.mode === 'leaving' || d.mode === 'entering') {
        const goal = d.path[0], dx = goal.x - d.px, dy = goal.y - d.py, dist = Math.hypot(dx, dy), sp = d.mode === 'entering' ? 3 : 1.6;
        if (dist <= sp) {
          d.px = goal.x; d.py = goal.y; d.path.shift();
          if (!d.path.length) {
            if (d.mode === 'leaving') { d.mode = fright ? 'fright' : 'free'; d.free = true; d.c = 10; d.r = 5; d.prog = 0; d.dir = pick([DIR4.left, DIR4.right]); }
            else { d.mode = 'pen'; d.wait = 70; d.px = center(10, 7).x; }
          }
        } else { d.px += dx / dist * sp; d.py += dy / dist * sp; }
        return;
      }
      const inTunnel = d.r === 7 && (d.c < 5 || d.c > 15);
      const sp = d.mode === 'eyes' ? 5 : d.mode === 'fright' ? 1.25 : inTunnel ? 1.2 : 2.05 + (totalDots - dotsLeft) / totalDots * 0.35;
      advance(d, sp, chooseDrone, m => {
        if (m.mode === 'eyes' && m.c === HOME.c && m.r === HOME.r) { m.free = false; m.mode = 'entering'; const p = center(10, 5); m.px = p.x; m.py = p.y; m.path = [center(10, 7)]; }
      });
    }
    function update() {
      t++;
      if (readyT > 0) { readyT--; fx.update(); return; }
      modeT++;
      if (fright > 0 && --fright === 0) drones.forEach(d => { if (d.mode === 'fright') d.mode = 'free'; });
      if (modeT % 1500 === 300 || modeT % 1500 === 0) drones.forEach(d => { if (d.mode === 'free') reverse(d); });
      if (shard && --shard.life <= 0) shard = null;
      if (P.dying) {
        if (--P.dying === 0) {
          if (lives <= 0) { done = true; S.end(false, score, 'Caught by the drones', (totalDots - dotsLeft) + ' of ' + totalDots + ' data bits collected.', 300); }
          else resetActors();
        }
        fx.update();
        return;
      }
      if (!isStill(P.dir) && P.want.x === -P.dir.x && P.want.y === -P.dir.y && P.prog > 0) {
        P.c = (P.c + P.dir.x + COLS) % COLS; P.r += P.dir.y; P.prog = 1 - P.prog; P.dir = P.want;
      }
      advance(P, 2.4, choosePlayer, eat);
      drones.forEach(updateDrone);
      const pp = posOf(P);
      drones.forEach(d => {
        if (d.mode === 'pen' || d.mode === 'entering' || d.mode === 'eyes' || done) return;
        const dp = d.free ? posOf(d) : { x: d.px, y: d.py };
        if (Math.hypot(dp.x - pp.x, dp.y - pp.y) > CELL * 0.62) return;
        if (d.mode === 'fright') {
          const pts = 200 * Math.pow(2, chain);
          chain = Math.min(chain + 1, 3);
          score += pts;
          fx.burst(dp.x, dp.y, '#93c5fd', 24, 3.5, 36);
          fx.text(dp.x, dp.y - 10, '+' + pts, '#bfdbfe');
          S.sfx('match');
          d.mode = 'eyes';
          if (!d.free) { d.free = true; d.c = Math.round((d.px - CELL / 2) / CELL); d.r = Math.round((d.py - CELL / 2) / CELL); d.prog = 0; }
          return;
        }
        if (!P.dying) {
          lives--;
          P.dying = 80;
          fx.burst(pp.x, pp.y, '#67e8f9', 50, 4, 60, 3);
          S.sfx('boom');
        }
      });
      fx.update();
      S.hud('Data ' + (totalDots - dotsLeft) + ' / ' + totalDots + (fright ? ' • Overload ' + Math.ceil(fright / 60) + 's' : ''), fmt(score) + ' pts', 'Lives ' + hearts(lives));
    }

    // Walls are drawn once into their own layer.
    const layer = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    layer.width = W * dpr; layer.height = H * dpr;
    const lc = layer.getContext('2d');
    lc.scale(dpr, dpr);
    lc.fillStyle = '#020617'; lc.fillRect(0, 0, W, H);
    lc.fillStyle = '#0b1a3a';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAP[r][c] === '#') lc.fillRect(c * CELL, r * CELL, CELL, CELL);
    lc.shadowColor = '#3b82f6'; lc.shadowBlur = 8;
    lc.strokeStyle = '#3b82f6'; lc.lineWidth = 2;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] !== '#') continue;
      const x = c * CELL, y = r * CELL;
      const open = (cc, rr) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && MAP[rr][cc] !== '#';
      lc.beginPath();
      if (open(c, r - 1)) { lc.moveTo(x, y + 3); lc.lineTo(x + CELL, y + 3); }
      if (open(c, r + 1)) { lc.moveTo(x, y + CELL - 3); lc.lineTo(x + CELL, y + CELL - 3); }
      if (open(c - 1, r)) { lc.moveTo(x + 3, y); lc.lineTo(x + 3, y + CELL); }
      if (open(c + 1, r)) { lc.moveTo(x + CELL - 3, y); lc.lineTo(x + CELL - 3, y + CELL); }
      lc.stroke();
    }
    lc.shadowBlur = 0;
    lc.strokeStyle = '#f472b6'; lc.lineWidth = 3;
    lc.beginPath(); lc.moveTo(10 * CELL + 3, 6 * CELL + CELL / 2); lc.lineTo(11 * CELL - 3, 6 * CELL + CELL / 2); lc.stroke();

    function drawDrone(d) {
      const p = d.free ? posOf(d) : { x: d.px, y: d.py };
      const flashing = d.mode === 'fright' && fright < 120 && Math.floor(t / 8) % 2 === 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (d.mode !== 'eyes') {
        const col = d.mode === 'fright' ? (flashing ? '#e2e8f0' : '#1d4ed8') : d.def.color;
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + t * 0.03; ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }
      const look = d.free ? d.dir : DIR4.up;
      ctx.fillStyle = d.mode === 'fright' ? '#fca5a5' : '#f8fafc';
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.beginPath(); ctx.arc(look.x * 2.5, look.y * 2.5, 2.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function draw() {
      ctx.drawImage(layer, 0, 0, W, H);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v === '.') { ctx.fillStyle = '#7dd3fc'; ctx.fillRect(c * CELL + CELL / 2 - 2, r * CELL + CELL / 2 - 2, 4, 4); }
        else if (v === 'o') {
          const s = 7 + Math.sin(t * 0.15) * 2, x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
          ctx.save(); ctx.shadowColor = '#fde047'; ctx.shadowBlur = 14; ctx.fillStyle = '#fde047';
          ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      if (shard && (shard.life > 120 || Math.floor(t / 6) % 2)) {
        const p = center(shard.c, shard.r);
        ctx.save(); ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 16; ctx.fillStyle = '#a5f3fc';
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 10); ctx.lineTo(p.x + 7, p.y); ctx.lineTo(p.x, p.y + 10); ctx.lineTo(p.x - 7, p.y); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      drones.forEach(drawDrone);
      const pp = posOf(P);
      if (!P.dying || P.dying % 10 < 5) {
        const k = P.dying ? P.dying / 80 : 1, face = isStill(P.dir) ? P.want : P.dir;
        ctx.save();
        ctx.translate(pp.x, pp.y);
        ctx.rotate(Math.atan2(face.y, face.x));
        ctx.scale(k, k);
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 18;
        ctx.fillStyle = '#a5f3fc';
        const pulse = 1 + Math.sin(t * 0.3) * 0.08;
        ctx.beginPath(); ctx.moveTo(12 * pulse, 0); ctx.lineTo(0, 9); ctx.lineTo(-8, 0); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0e7490';
        ctx.beginPath(); ctx.arc(1, 0, 3, 0, TAU); ctx.fill();
        ctx.restore();
      }
      fx.draw(ctx);
      if (readyT > 0 && !S.waiting) { ctx.save(); ctx.fillStyle = '#fde047'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12; ctx.fillText('READY', W / 2, 9 * CELL + 21); ctx.restore(); }
    }
    S.loop(update, draw);
    S.ready();
  };

  // ══════════ SEGMENT STORM ══════════
  STARTERS.centipede = function (S) {
    const CELL = 20, COLS = 38, ROWS = 24, ZONE = 19;
    const cv = S.canvas(COLS * CELL, ROWS * CELL), ctx = cv.ctx, W = cv.W, H = cv.H;
    const fx = new Particles();
    const nodes = new Map();
    const key = (c, r) => c + ',' + r;
    function sprinkle(n, minRow, maxRow) {
      for (let k = 0; k < n; k++) { const c = randInt(0, COLS - 1), r = randInt(minRow, maxRow); if (!nodes.has(key(c, r))) nodes.set(key(c, r), 3); }
    }
    sprinkle(42, 2, ZONE - 2);
    sprinkle(5, ZONE, ROWS - 3);
    const P = { x: W / 2, y: H - 22 };
    let segs = [], shot = null, spark = null, lives = 3, score = 0, wave = 0, t = 0, dying = 0, shake = 0, pointer = null, firing = false, banner = '', bannerT = 0, done = false;
    const speedFor = () => [0, 2, 2.5, 3.34][wave];
    function spawnChain(len) {
      segs = [];
      for (let k = 0; k < len; k++) segs.push({ c: -1 - k, r: 0, dir: 1, vdir: 1, mode: 'h', prog: 0 });
    }
    function nextWave() {
      wave++;
      spawnChain(8 + wave * 3);
      sprinkle(8, 3, ZONE - 2);
      banner = 'CHAIN ' + wave + ' / 3'; bannerT = 100;
      S.sfx('level');
    }
    nextWave();
    S.pad(['left', 'right', 'up', 'down', 'fire']);
    S.on(cv.el, 'pointermove', e => { pointer = cv.toLocal(e); });
    S.on(cv.el, 'pointerdown', e => { pointer = cv.toLocal(e); firing = true; });
    S.on(window, 'pointerup', () => { firing = false; });
    S.on(cv.el, 'pointerleave', () => { pointer = null; });
    const segPos = s => s.mode === 'h' ? { x: (s.c + s.dir * s.prog) * CELL + CELL / 2, y: s.r * CELL + CELL / 2 } : { x: s.c * CELL + CELL / 2, y: (s.r + s.vdir * s.prog) * CELL + CELL / 2 };
    function decide(s) {
      if (s.mode === 'v') s.mode = 'h';
      const nc = s.c + s.dir;
      const blocked = nc >= COLS || (nc < 0 && s.dir < 0) || nodes.has(key(nc, s.r));
      if (!blocked) return;
      if (s.r >= ROWS - 1) s.vdir = -1;
      else if (s.r <= ZONE && s.vdir < 0) s.vdir = 1;
      s.mode = 'v';
      s.dir = -s.dir;
    }
    function hurt() {
      if (dying || done) return;
      lives--;
      dying = 70;
      shake = 14;
      fx.burst(P.x, P.y, '#34d399', 46, 4.5, 55, 3);
      S.sfx('boom');
    }
    function update() {
      t++;
      shake *= 0.86;
      if (bannerT > 0) bannerT--;
      if (dying) {
        if (--dying === 0) {
          if (lives <= 0) { done = true; S.end(false, score, 'Overrun', 'The storm broke through on chain ' + wave + ' of 3.', 300); fx.update(); return; }
          const left = segs.length;
          spawnChain(left);
          for (const k of Array.from(nodes.keys())) { const r = Number(k.split(',')[1]); if (r >= ZONE) nodes.delete(k); }
          P.x = W / 2; P.y = H - 22; spark = null; shot = null;
        }
        fx.update();
        return;
      }
      let mx = (S.act.right ? 1 : 0) - (S.act.left ? 1 : 0), my = (S.act.down ? 1 : 0) - (S.act.up ? 1 : 0);
      let nx = P.x, ny = P.y;
      if (mx || my) { nx += mx * 4.2; ny += my * 4.2; pointer = null; }
      else if (pointer) { nx += clamp(pointer.x - P.x, -6, 6); ny += clamp(pointer.y - P.y, -6, 6); }
      nx = clamp(nx, 10, W - 10); ny = clamp(ny, ZONE * CELL + 10, H - 10);
      if (!nodes.has(key(Math.floor(nx / CELL), Math.floor(P.y / CELL)))) P.x = nx;
      if (!nodes.has(key(Math.floor(P.x / CELL), Math.floor(ny / CELL)))) P.y = ny;
      if ((S.act.fire || firing) && !shot && !done) { shot = { x: P.x, y: P.y - 10 }; S.sfx('shoot'); }
      if (shot) {
        shot.y -= 15;
        const c = Math.floor(shot.x / CELL), r = Math.floor(shot.y / CELL);
        if (shot.y < 0) shot = null;
        else if (nodes.has(key(c, r))) {
          const hp = nodes.get(key(c, r)) - 1;
          if (hp <= 0) { nodes.delete(key(c, r)); score += 5; fx.burst(c * CELL + CELL / 2, r * CELL + CELL / 2, '#38bdf8', 10, 2.5, 24); }
          else nodes.set(key(c, r), hp);
          S.sfx('bounce');
          shot = null;
        }
      }
      const sp = speedFor() / CELL;
      segs.forEach(s => {
        s.prog += sp;
        if (s.prog >= 1) {
          s.prog -= 1;
          if (s.mode === 'h') s.c += s.dir; else s.r += s.vdir;
          decide(s);
        }
      });
      if (shot) {
        for (let i = 0; i < segs.length; i++) {
          const p = segPos(segs[i]);
          if (Math.abs(p.x - shot.x) < 10 && Math.abs(p.y - shot.y) < 11) {
            const s = segs[i];
            const c = Math.round((p.x - CELL / 2) / CELL), r = Math.round((p.y - CELL / 2) / CELL);
            if (c >= 0 && c < COLS && r > 0 && r < ROWS) nodes.set(key(c, r), 3);
            const ahead = segs.some(o => o !== s && o.r === s.r && o.c === s.c + s.dir);
            const pts = ahead ? 100 : 150;
            score += pts;
            fx.burst(p.x, p.y, '#f472b6', 22, 3.5, 34);
            fx.text(p.x, p.y - 8, '+' + pts, '#fbcfe8');
            S.sfx('hit');
            segs.splice(i, 1);
            shot = null;
            break;
          }
        }
      }
      if (wave >= 2 && !spark && t % 420 === 0) spark = { x: Math.random() < 0.5 ? -10 : W + 10, y: ZONE * CELL + 20, vx: 0, vy: 2.6, life: 380 };
      if (spark) {
        if (spark.vx === 0) spark.vx = spark.x < 0 ? 2.4 : -2.4;
        spark.x += spark.vx; spark.y += spark.vy;
        if (spark.y > H - 10 || spark.y < ZONE * CELL) spark.vy *= -1;
        if (--spark.life <= 0 || spark.x < -30 || spark.x > W + 30) spark = null;
        else if (shot && Math.hypot(shot.x - spark.x, shot.y - spark.y) < 14) { score += 300; fx.burst(spark.x, spark.y, '#fde047', 30, 4, 40); fx.text(spark.x, spark.y - 10, '+300', '#fef08a'); S.sfx('match'); spark = null; shot = null; }
        else if (Math.hypot(P.x - spark.x, P.y - spark.y) < 16) hurt();
      }
      for (const s of segs) { const p = segPos(s); if (Math.hypot(p.x - P.x, p.y - P.y) < 15) { hurt(); break; } }
      if (!segs.length && !dying && !done) {
        score += wave * 1000;
        if (wave >= 3) { done = true; score += lives * 1000; S.end(true, score, 'Storm broken!', 'All three chains destroyed. Lives left +' + fmt(lives * 1000) + '.', 800); }
        else { fx.text(W / 2, H / 2, 'CHAIN CLEAR +' + wave * 1000, '#34d399'); nextWave(); }
      }
      fx.update();
      S.hud('Chain ' + wave + ' / 3 • Segments ' + segs.length, fmt(score) + ' pts', 'Lives ' + hearts(lives));
    }
    function draw() {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a0420'); g.addColorStop(1, '#020617');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      ctx.fillStyle = 'rgba(52, 211, 153, 0.05)'; ctx.fillRect(0, ZONE * CELL, W, H - ZONE * CELL);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)'; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(0, ZONE * CELL); ctx.lineTo(W, ZONE * CELL); ctx.stroke(); ctx.setLineDash([]);
      nodes.forEach((hp, k) => {
        const parts = k.split(','), x = Number(parts[0]) * CELL + CELL / 2, y = Number(parts[1]) * CELL + CELL / 2, s = 4 + hp * 2;
        ctx.fillStyle = ['', '#c084fc', '#818cf8', '#38bdf8'][hp];
        ctx.beginPath(); for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 1.5, y - s + 2, 3, 3);
      });
      segs.forEach(s => {
        const p = segPos(s), head = !segs.some(o => o !== s && o.r === s.r && o.c === s.c + s.dir && o.mode === s.mode);
        ctx.save();
        ctx.shadowColor = head ? '#fde047' : '#f472b6'; ctx.shadowBlur = 10;
        ctx.fillStyle = head ? '#fde047' : '#f472b6';
        ctx.beginPath(); ctx.arc(p.x, p.y, 8.5 + Math.sin(t * 0.3 + s.c) * 0.8, 0, TAU); ctx.fill();
        ctx.restore();
        if (head) { ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.arc(p.x + s.dir * 3, p.y - 2, 2.2, 0, TAU); ctx.fill(); }
      });
      if (spark) {
        ctx.save(); ctx.translate(spark.x, spark.y); ctx.rotate(t * 0.2);
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.5; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12;
        ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } ctx.stroke();
        ctx.restore();
      }
      if (shot) { ctx.fillStyle = '#ecfeff'; ctx.fillRect(shot.x - 1.5, shot.y - 10, 3, 12); }
      if (!dying) {
        ctx.save(); ctx.translate(P.x, P.y);
        ctx.shadowColor = '#34d399'; ctx.shadowBlur = 14; ctx.fillStyle = '#6ee7b7';
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, 8); ctx.lineTo(0, 4); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      fx.draw(ctx);
      ctx.restore();
      if (bannerT > 0) bannerText(ctx, banner, W, H, bannerT);
    }
    S.loop(update, draw);
    S.ready();
  };
`;
