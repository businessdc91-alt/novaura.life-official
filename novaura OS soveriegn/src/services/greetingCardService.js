/**
 * greetingCardService.js — Animated Greetings & Birthday Card Engine for Sovereign Mesh
 * Features:
 * - Web Audio API procedural synthesis for celebratory fanfare and melodies (zero audio files needed)
 * - Canvas particle physics engines (Confetti, Fireworks, Floating Balloons, Cosmic Sparkles)
 * - P2P Mesh transmission via MESH_GREETING_CARD packets
 * - Standalone single-file HTML card generator with interactive 3D folding cover
 */

export const CARD_OCCASIONS = [
  { id: 'birthday', label: 'Birthday Celebration', defaultEmoji: '🎂', defaultTitle: 'Happy Birthday!' },
  { id: 'friendship', label: 'Peer & Mesh Friendship', defaultEmoji: '🪐', defaultTitle: 'To an Unstoppable Peer' },
  { id: 'gratitude', label: 'Gratitude & Appreciation', defaultEmoji: '✨', defaultTitle: 'With Sincere Gratitude' },
  { id: 'milestone', label: 'Sovereign Node Milestone', defaultEmoji: '👑', defaultTitle: 'Milestone Achieved!' },
  { id: 'holiday', label: 'Festive Season & Solstice', defaultEmoji: '❄️', defaultTitle: 'Warm Solstice Greetings' },
  { id: 'cyber', label: 'Cyberpunk Victory', defaultEmoji: '⚡', defaultTitle: 'System Uplink Celebrated' },
];

export const CARD_THEMES = {
  gold_luxury: {
    id: 'gold_luxury',
    name: 'Obsidian & Radiant Gold',
    badge: 'Luxury Emboss',
    primary: '#f59e0b',
    secondary: '#d97706',
    accent: '#fbbf24',
    bg: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)',
    border: 'rgba(245, 158, 11, 0.45)',
    innerBg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    textColor: '#fef3c7',
    coverPattern: 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 60%)'
  },
  cyber_neon: {
    id: 'cyber_neon',
    name: 'Cyberpunk Neon Pulse',
    badge: 'Holographic',
    primary: '#00f0ff',
    secondary: '#a855f7',
    accent: '#ec4899',
    bg: 'linear-gradient(135deg, #030712 0%, #0c0a24 50%, #170728 100%)',
    border: 'rgba(0, 240, 255, 0.5)',
    innerBg: 'linear-gradient(135deg, #0a0e27 0%, #030712 100%)',
    textColor: '#e0f2fe',
    coverPattern: 'radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.18) 0%, rgba(168, 85, 247, 0.12) 50%, transparent 80%)'
  },
  emerald_spring: {
    id: 'emerald_spring',
    name: 'Emerald Botanical Bloom',
    badge: 'Organic',
    primary: '#10b981',
    secondary: '#059669',
    accent: '#f43f5e',
    bg: 'linear-gradient(135deg, #02170f 0%, #062b1e 50%, #041d15 100%)',
    border: 'rgba(16, 185, 129, 0.45)',
    innerBg: 'linear-gradient(135deg, #041d15 0%, #02170f 100%)',
    textColor: '#d1fae5',
    coverPattern: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.18) 0%, transparent 70%)'
  },
  sunset_dream: {
    id: 'sunset_dream',
    name: 'Sunset Coral & Twilight',
    badge: 'Warm Dream',
    primary: '#f43f5e',
    secondary: '#fb923c',
    accent: '#8b5cf6',
    bg: 'linear-gradient(135deg, #180918 0%, #2a081c 50%, #15061b 100%)',
    border: 'rgba(244, 63, 94, 0.45)',
    innerBg: 'linear-gradient(135deg, #220819 0%, #130515 100%)',
    textColor: '#ffe4e6',
    coverPattern: 'radial-gradient(circle at 50% 50%, rgba(251, 146, 60, 0.18) 0%, transparent 70%)'
  },
  celestial_silver: {
    id: 'celestial_silver',
    name: 'Midnight Celestial Platinum',
    badge: 'Cosmic Starlight',
    primary: '#38bdf8',
    secondary: '#94a3b8',
    accent: '#e2e8f0',
    bg: 'linear-gradient(135deg, #071328 0%, #0f172a 50%, #020617 100%)',
    border: 'rgba(56, 189, 248, 0.45)',
    innerBg: 'linear-gradient(135deg, #0b192e 0%, #030712 100%)',
    textColor: '#f1f5f9',
    coverPattern: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.18) 0%, transparent 70%)'
  }
};

export const PARTICLE_EFFECTS = [
  { id: 'confetti', label: 'Celebration Confetti Shower', icon: '🎉' },
  { id: 'fireworks', label: 'Cosmic Sky Fireworks', icon: '🎆' },
  { id: 'balloons', label: 'Floating 3D Balloons', icon: '🎈' },
  { id: 'sparkles', label: 'Twinkling Fairy Dust', icon: '✨' },
];

export const AUDIO_MELODIES = [
  { id: 'birthday', label: 'Joyful Birthday Melody (Synthesized)', duration: '8s' },
  { id: 'fanfare', label: 'Triumphant Brass Fanfare', duration: '6s' },
  { id: 'chimes', label: 'Cosmic Pentatonic Chimes', duration: '7s' },
  { id: 'harp', label: 'Gentle Celestial Harp', duration: '6s' },
  { id: 'mute', label: 'Silent (Visuals Only)', duration: '-' },
];

// ── Web Audio API Procedural Synthesis ──────────────────────────────────────

let _activeAudioCtx = null;
let _activeOscillators = [];

export function stopMelody() {
  try {
    for (const osc of _activeOscillators) {
      try { osc.stop(); } catch (_) {}
    }
    _activeOscillators = [];
    if (_activeAudioCtx && _activeAudioCtx.state !== 'closed') {
      _activeAudioCtx.close().catch(() => {});
    }
  } catch (_) {}
  _activeAudioCtx = null;
}

export function playProceduralMelody(melodyId) {
  stopMelody();
  if (melodyId === 'mute') return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    _activeAudioCtx = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.22, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Frequencies (Hz)
    const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, B4 = 493.88;
    const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.00;

    const playTone = (freq, startTime, duration, type = 'sine', decay = true) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Warm overtone oscillator
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(freq * 0.5, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.04);
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      }

      subGain.gain.setValueAtTime(0.001, startTime);
      subGain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      subOsc.connect(subGain);
      gain.connect(masterGain);
      subGain.connect(masterGain);

      osc.start(startTime);
      subOsc.start(startTime);
      osc.stop(startTime + duration + 0.1);
      subOsc.stop(startTime + duration + 0.1);

      _activeOscillators.push(osc, subOsc);
    };

    const now = ctx.currentTime + 0.05;

    if (melodyId === 'birthday') {
      // Classic "Happy Birthday" opening motif: C4, C4, D4, C4, F4, E4
      const notes = [
        { f: C4, d: 0.35, g: 0.4 },
        { f: C4, d: 0.25, g: 0.3 },
        { f: D4, d: 0.55, g: 0.6 },
        { f: C4, d: 0.55, g: 0.6 },
        { f: F4, d: 0.55, g: 0.6 },
        { f: E4, d: 0.95, g: 1.0 },

        // Second phrase: C4, C4, D4, C4, G4, F4
        { f: C4, d: 0.35, g: 0.4 },
        { f: C4, d: 0.25, g: 0.3 },
        { f: D4, d: 0.55, g: 0.6 },
        { f: C4, d: 0.55, g: 0.6 },
        { f: G4, d: 0.55, g: 0.6 },
        { f: F4, d: 1.1, g: 1.2 },
      ];

      let t = now;
      for (const n of notes) {
        playTone(n.f, t, n.d, 'sine');
        t += n.g;
      }
    } else if (melodyId === 'fanfare') {
      // Royal fanfare triad blasts
      const chords = [
        { freqs: [C4, G4, C5], t: now, d: 0.4 },
        { freqs: [C4, G4, C5], t: now + 0.45, d: 0.3 },
        { freqs: [C4, G4, C5], t: now + 0.8, d: 0.4 },
        { freqs: [F4, A4, C5], t: now + 1.25, d: 0.5 },
        { freqs: [G4, B4, D5], t: now + 1.8, d: 0.6 },
        { freqs: [C4, G4, C5, E5], t: now + 2.5, d: 1.6 },
      ];
      for (const chord of chords) {
        for (const freq of chord.freqs) {
          playTone(freq, chord.t, chord.d, 'triangle');
        }
      }
    } else if (melodyId === 'chimes') {
      // Pentatonic shimmering chimes
      const penta = [E4, G4, A4, C5, D5, E5, G5, A5, C5];
      penta.forEach((freq, idx) => {
        playTone(freq, now + idx * 0.22, 1.2, 'sine');
      });
    } else if (melodyId === 'harp') {
      // Arpeggiated celestial glissando
      const arpeggio = [C4, E4, G4, B4, C5, E5, G5, B5, C5 * 2];
      arpeggio.forEach((freq, idx) => {
        playTone(freq, now + idx * 0.16, 1.4, 'sine');
      });
    }
  } catch (err) {
    console.warn('[greetingCardService] Audio synthesis error:', err);
  }
}

// ── Particle Canvas Renderer ───────────────────────────────────────────────

export function initializeParticleCanvas(canvas, effectType, primaryColor = '#00f0ff', accentColor = '#f59e0b') {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  let animationId = null;
  let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
  let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

  const resizeHandler = () => {
    if (canvas.parentElement) {
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    }
  };
  window.addEventListener('resize', resizeHandler);

  const particles = [];
  const count = effectType === 'fireworks' ? 70 : effectType === 'balloons' ? 18 : 65;

  const colors = [primaryColor, accentColor, '#ec4899', '#38bdf8', '#10b981', '#fcd34d', '#ffffff'];

  // Initialize particles based on type
  for (let i = 0; i < count; i++) {
    if (effectType === 'confetti') {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * -height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    } else if (effectType === 'balloons') {
      particles.push({
        x: Math.random() * (width - 40) + 20,
        y: height + Math.random() * height,
        r: Math.random() * 12 + 16,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: -(Math.random() * 1.5 + 1),
        swaySpeed: Math.random() * 0.04 + 0.02,
        swayOffset: Math.random() * Math.PI * 2,
        stringLen: Math.random() * 20 + 25
      });
    } else if (effectType === 'fireworks') {
      particles.push({
        x: width * 0.5 + (Math.random() - 0.5) * 120,
        y: height * 0.4 + (Math.random() - 0.5) * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        gravity: 0.08
      });
    } else {
      // Sparkles / fairy dust
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 3 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: -(Math.random() * 1.2 + 0.3),
        alpha: Math.random(),
        alphaSpeed: (Math.random() * 0.04 + 0.02) * (Math.random() > 0.5 ? 1 : -1)
      });
    }
  }

  let frame = 0;

  const render = () => {
    ctx.clearRect(0, 0, width, height);
    frame++;

    for (const p of particles) {
      if (effectType === 'confetti') {
        p.y += p.vy;
        p.x += p.vx + Math.sin(frame * 0.03) * 0.8;
        p.rot += p.rotSpeed;

        if (p.y > height + 20) {
          p.y = -10;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (effectType === 'balloons') {
        p.y += p.vy;
        const curX = p.x + Math.sin(frame * p.swaySpeed + p.swayOffset) * 14;

        if (p.y < -p.r * 2 - p.stringLen) {
          p.y = height + 40;
          p.x = Math.random() * (width - 40) + 20;
        }

        // Draw balloon string
        ctx.beginPath();
        ctx.moveTo(curX, p.y + p.r);
        ctx.quadraticCurveTo(
          curX + Math.sin(frame * 0.05) * 6,
          p.y + p.r + p.stringLen * 0.5,
          curX,
          p.y + p.r + p.stringLen
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw balloon oval
        ctx.save();
        ctx.translate(curX, p.y);
        ctx.scale(1, 1.25);
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();

        // Balloon highlight
        ctx.beginPath();
        ctx.arc(-p.r * 0.35, -p.r * 0.35, p.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
        ctx.restore();
      } else if (effectType === 'fireworks') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          p.x = width * 0.5 + (Math.random() - 0.5) * (width * 0.6);
          p.y = height * 0.35 + (Math.random() - 0.5) * 80;
          const speed = Math.random() * 6 + 2;
          const angle = Math.random() * Math.PI * 2;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.alpha = 1;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Sparkles
        p.y += p.vy;
        p.alpha += p.alphaSpeed;
        if (p.alpha > 1) {
          p.alpha = 1;
          p.alphaSpeed = -p.alphaSpeed;
        } else if (p.alpha < 0) {
          p.alpha = 0;
          p.alphaSpeed = -p.alphaSpeed;
          p.y = height + 5;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    animationId = requestAnimationFrame(render);
  };

  render();

  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resizeHandler);
  };
}

// ── P2P Mesh Dispatch & Card History ───────────────────────────────────────

export function getSentGreetingCards() {
  try {
    return JSON.parse(localStorage.getItem('sovereign_greeting_cards_sent') || '[]');
  } catch (_) {
    return [];
  }
}

export function getReceivedGreetingCards() {
  try {
    return JSON.parse(localStorage.getItem('sovereign_greeting_cards_inbox') || '[]');
  } catch (_) {
    return [];
  }
}

const INBOX_KEY = 'sovereign_greeting_cards_inbox';
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const clip = (v, n) => String(v ?? '').replace(CONTROL_CHARS, '').slice(0, n);

/**
 * A card as it may travel and be stored: only known fields, known theme,
 * effect and melody ids, and bounded text. Null when it is not a card.
 */
export function cleanGreetingCard(data) {
  if (!data || typeof data !== 'object') return null;
  if (!/^card_[A-Za-z0-9_-]{1,48}$/.test(String(data.id || ''))) return null;
  const occasion = CARD_OCCASIONS.find(o => o.id === data.occasion) || CARD_OCCASIONS[0];
  const when = Date.parse(data.timestamp);
  return {
    id: data.id,
    occasion: occasion.id,
    occasionLabel: occasion.label,
    themeId: Object.prototype.hasOwnProperty.call(CARD_THEMES, data.themeId) ? data.themeId : 'gold_luxury',
    particleEffect: PARTICLE_EFFECTS.some(p => p.id === data.particleEffect) ? data.particleEffect : 'confetti',
    audioMelody: AUDIO_MELODIES.some(m => m.id === data.audioMelody) ? data.audioMelody : 'mute',
    coverEmoji: clip(data.coverEmoji, 16) || occasion.defaultEmoji,
    title: clip(data.title, 120) || occasion.defaultTitle,
    message: clip(data.message, 2000),
    recipientName: clip(data.recipientName, 60),
    senderName: clip(data.senderName, 40) || 'peer',
    timestamp: Number.isFinite(when) ? new Date(when).toISOString() : new Date().toISOString(),
  };
}

/** Keep a card that arrived over the mesh. `did` is the verified signer; returns false for a repeat. */
export function storeReceivedGreetingCard(card, did) {
  const inbox = getReceivedGreetingCards();
  if (inbox.some(c => c.id === card.id && c.senderDid === did)) return false;
  inbox.unshift({ ...card, senderDid: did, receivedAt: new Date().toISOString() });
  try {
    localStorage.setItem(INBOX_KEY, JSON.stringify(inbox.slice(0, 50)));
  } catch { /* storage full: the card still shows this session */ }
  return true;
}

/**
 * Send a card to one mesh peer. Resolves with the card as sent; throws when
 * no peer was chosen or the mesh refused it.
 */
export async function sendGreetingCardOverMesh(card) {
  if (!card.recipientPeerId) throw new Error('Pick who the card is for from the mesh peers first.');
  // Loaded here so the rest of this module (themes, cleaning, export) stays free of the mesh.
  const { sendDirectMeshPacket, getLocalIdentity } = await import('./sovereignMesh.js');
  const localId = getLocalIdentity();
  const cardPacket = cleanGreetingCard({
    ...card,
    id: card.id || `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    senderName: localId?.handle || 'operator',
    timestamp: new Date().toISOString(),
  });
  const sent = await sendDirectMeshPacket(card.recipientPeerId, 'MESH_GREETING_CARD', cardPacket);
  if (!sent) {
    throw new Error("The mesh didn't send this card. The peer may have gone offline, or the message contains a word the mesh treats as a credential (secret, vault, API key, bearer).");
  }

  try {
    const history = getSentGreetingCards();
    history.unshift({ ...cardPacket, senderDid: localId?.nodeId || null, recipientPeerId: card.recipientPeerId });
    localStorage.setItem('sovereign_greeting_cards_sent', JSON.stringify(history.slice(0, 50)));
  } catch { /* history is a convenience */ }

  return cardPacket;
}

// ── Standalone HTML Export Generator ───────────────────────────────────────

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function generateStandaloneCardHtml(rawCard) {
  const theme = CARD_THEMES[rawCard.themeId] || CARD_THEMES.gold_luxury;
  // Everything a person typed is escaped; theme colours are our own constants.
  const card = Object.fromEntries(['occasionLabel', 'coverEmoji', 'title', 'recipientName', 'message', 'senderName'].map(k => [k, rawCard[k] ? escapeHtml(rawCard[k]) : '']));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${card.title || 'Special Greeting'} — Sovereign Mesh</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #05070e;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      perspective: 1200px;
    }
    #particle-canvas {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 10;
    }
    .card-scene {
      position: relative;
      z-index: 20;
      width: 380px;
      height: 520px;
      perspective: 1200px;
      cursor: pointer;
    }
    .card-wrap {
      width: 100%; height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card-scene.open .card-wrap {
      transform: rotateY(-180deg);
    }
    .card-face {
      position: absolute;
      width: 100%; height: 100%;
      border-radius: 24px;
      padding: 36px 28px;
      backface-visibility: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 2px solid ${theme.border};
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px ${theme.border};
    }
    .card-front {
      background: ${theme.bg};
      text-align: center;
      align-items: center;
      background-image: ${theme.coverPattern};
    }
    .card-back {
      background: ${theme.innerBg};
      transform: rotateY(180deg);
      color: ${theme.textColor};
    }
    .cover-glyph {
      font-size: 5rem;
      margin-top: 40px;
      filter: drop-shadow(0 0 16px ${theme.primary});
      animation: floatCover 3s ease-in-out infinite alternate;
    }
    @keyframes floatCover {
      from { transform: translateY(0px) scale(1); }
      to { transform: translateY(-10px) scale(1.05); }
    }
    .cover-badge {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${theme.primary};
      background: rgba(255, 255, 255, 0.06);
      padding: 4px 14px;
      border-radius: 999px;
      border: 1px solid ${theme.border};
    }
    .cover-title {
      font-size: 1.8rem;
      font-weight: 800;
      margin: 16px 0 8px;
      color: #fff;
      line-height: 1.25;
    }
    .cover-recipient {
      font-size: 0.9rem;
      color: ${theme.primary};
      font-weight: 600;
    }
    .tap-hint {
      font-size: 0.75rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      animation: pulseHint 2s infinite;
    }
    @keyframes pulseHint {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    .inside-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: ${theme.primary};
      margin: 0 0 16px;
    }
    .inside-msg {
      font-size: 1.05rem;
      line-height: 1.65;
      color: #f1f5f9;
      white-space: pre-wrap;
      font-style: italic;
      flex: 1;
    }
    .inside-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 0.8rem;
    }
    .sender-name {
      font-weight: 700;
      color: ${theme.primary};
    }
    .crypto-stamp {
      font-size: 0.68rem;
      color: #64748b;
      font-family: monospace;
    }
    .music-btn {
      position: fixed;
      bottom: 24px;
      z-index: 30;
      background: ${theme.primary};
      color: #030712;
      border: none;
      padding: 10px 20px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 0 20px ${theme.border};
      transition: transform 0.2s;
    }
    .music-btn:hover { transform: scale(1.05); }
  </style>
</head>
<body>
  <canvas id="particle-canvas"></canvas>

  <div class="card-scene" onclick="toggleCard(this)">
    <div class="card-wrap">
      <!-- FRONT COVER -->
      <div class="card-face card-front">
        <span class="cover-badge">${card.occasionLabel || 'Special Greeting'}</span>
        <div class="cover-glyph">${card.coverEmoji || '🎂'}</div>
        <div>
          <div class="cover-title">${card.title || 'Happy Birthday!'}</div>
          <div class="cover-recipient">For: ${card.recipientName || 'Valued Peer'}</div>
        </div>
        <div class="tap-hint">✦ Click to Open Card ✦</div>
      </div>

      <!-- INSIDE CARD -->
      <div class="card-face card-back">
        <div>
          <h3 class="inside-title">${card.title || 'Happy Birthday!'}</h3>
          <div class="inside-msg">${card.message || 'Wishing you limitless joy, peak hardware efficiency, and unstoppable sovereign growth.'}</div>
        </div>
        <div class="inside-footer">
          <div>
            <div style="font-size: 0.72rem; color: #94a3b8;">Sent with warmth by:</div>
            <div class="sender-name">@${card.senderName || 'operator'}</div>
          </div>
          <div class="crypto-stamp">NovAura Greeting Studio</div>
        </div>
      </div>
    </div>
  </div>

  <button class="music-btn" onclick="playMusic()">
    <span>🎵</span> <span id="music-text">Play Celebratory Melody</span>
  </button>

  <script>
    let isPlaying = false;
    function toggleCard(el) {
      el.classList.toggle('open');
      if (!isPlaying) playMusic();
    }

    function playMusic() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const notes = [261.63, 261.63, 293.66, 261.63, 349.23, 329.63, 261.63, 261.63, 293.66, 261.63, 392.00, 349.23];
        const times = [0.35, 0.25, 0.55, 0.55, 0.55, 0.95, 0.35, 0.25, 0.55, 0.55, 0.55, 1.2];
        let t = now + 0.1;
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + times[i]);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + times[i] + 0.1);
          t += times[i] + 0.05;
        });
        document.getElementById('music-text').textContent = 'Melody Playing...';
        isPlaying = true;
      } catch(e) {}
    }

    // Particle script
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    window.onresize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      size: Math.random() * 8 + 4,
      color: ['${theme.primary}', '${theme.accent}', '#ec4899', '#38bdf8', '#10b981', '#ffffff'][Math.floor(Math.random() * 6)],
      vy: Math.random() * 2.5 + 1.5, vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 6
    }));
    function loop() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rot += p.rotSpeed;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
        ctx.restore();
      });
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
}
