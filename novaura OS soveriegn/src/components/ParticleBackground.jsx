/**
 * Particle Background & Universal Gravity Engine
 * 
 * Features:
 * - 5 Gravity Laws & Physics Modes:
 *   1. Newtonian Gravity Well: G * M * m / (r^2 + e^2) with orbital tangential mechanics
 *   2. Anti-Gravity / Kinetic Forcefield: Radial repulsion bubble
 *   3. Cosmic Vortex: Kerr Singularity with relativistic accretion disk swirl
 *   4. Multi-Body Celestial: Slingshot mechanics with drifting gravitational bodies
 *   5. Spring Mesh Water: Hooke's law 2D lattice wave propagation
 * - Live Interactivity:
 *   - Continuous hover tracking (never requires mouse click to activate)
 *   - Mouse down intensifies gravitational focus
 *   - Click triggers radial gravitational shockwave pulses that blast particles outward
 *   - Constellation links with distance attenuation and mouse link glow
 * - 9 Complete Themes:
 *   cosmic, blue-night, matrix, stormy, cyberstorm, aurora, meshwater, blaze, light
 * - Micro dust luminescence, rain splash physics, heat convection embers
 * - Matrix: glowing gravity bodies plunge through (and off) the screen, pulling particles along,
 *   while the micro particles swim in schools like fish. Bodies that meet merge, absorb
 *   particles and grow into ringed planets, which in time collapse and burst back into bodies.
 *   Orange serpents shove the green particles aside, and a neon pink hunter preys on the fish
 *   until a gravity body pulls it in.
 * - Cyber Storm: layered storm clouds drift past on the wind, lit from inside by RGB-split
 *   lightning that forks down through them or crawls between them, while flocks of birds
 *   wheel through and scatter from the strikes and the cursor.
 * - Pacing (backgroundPacing.js): at most 60 steps a second on any screen, half pace under a
 *   dimming veil behind open windows, and paused while the app is minimized or unfocused.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useGraphics, GRAVITY_MODES } from '../contexts/GraphicsContext';
import MeshWaterBackground from './backgrounds/MeshWaterBackground';
import { runPacedLoop } from './backgrounds/backgroundPacing';

// ============================================
// THEME CONFIGURATIONS
// ============================================

export const THEME_CONFIGS = {
  cosmic: {
    background: '#0a0a0f',
    colors: [
      '#00b8d9', '#0891b2', '#0e7490',
      '#8b5cf6', '#7c3aed', '#6d28d9',
      '#d946ef', '#c026d3', '#a21caf',
      '#10b981', '#059669', '#047857',
      '#d97706', '#b45309', '#92400e',
      '#3b82f6', '#2563eb', '#1d4ed8',
      '#db2777', '#be185d'
    ],
    microColors: [
      '#22d3ee', '#67e8f9', '#a5f3fc',
      '#c084fc', '#d8b4fe', '#e9d5ff',
      '#e879f9', '#f0abfc', '#f5d0fe',
      '#34d399', '#6ee7b7', '#a7f3d0',
      '#fcd34d', '#fde68a', '#fef3c7',
      '#60a5fa', '#93c5fd', '#bfdbfe',
      '#f472b6', '#f9a8d4'
    ],
    linkColor: '0, 217, 255',
    mouseLinkColor: '168, 85, 247',
    particleSizeMultiplier: 1,
    flowSpeed: 1,
    glowIntensity: 1,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  
  'blue-night': {
    background: '#0f1729',
    colors: ['#60a5fa', '#ffffff', '#fbbf24', '#f59e0b', '#ef4444', '#60a5fa'],
    microColors: ['#60a5fa', '#93c5fd', '#ffffff', '#fcd34d', '#fbbf24', '#f97316', '#ef4444'],
    linkColor: '96, 165, 250',
    mouseLinkColor: '251, 191, 36',
    particleSizeMultiplier: 1,
    flowSpeed: 1,
    glowIntensity: 1,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  
  light: {
    background: '#f5f2ed',
    colors: [
      '#5a8a6e', '#6b9b7f', '#7cac90',
      '#b86b7e', '#c97c8f', '#da8da0',
      '#c9a35f', '#dab470', '#ebc581',
      '#7a9a8a', '#8bab9b', '#9cbcac',
      '#a67c6b', '#b78d7c', '#c89e8d'
    ],
    microColors: [
      '#8cbfa3', '#9dd0b4', '#aee1c5',
      '#d49aaa', '#e5abbb', '#f6bccc',
      '#e4c882', '#f5d993', '#ffea84',
      '#aaccbb', '#bbddcc', '#cceedd',
      '#c9a99a', '#dabfab', '#ebd5cc'
    ],
    linkColor: '90, 138, 110',
    mouseLinkColor: '184, 107, 126',
    particleSizeMultiplier: 1,
    flowSpeed: 1,
    glowIntensity: 1,
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  
  matrix: {
    background: '#000a00',
    colors: [
      '#00ff00', '#00f500', '#00eb00',
      '#00e000', '#00d600', '#00cc00',
      '#00c200', '#00b800', '#00ad00',
      '#00a300', '#009900', '#008f00',
      '#008500', '#007a00', '#007000',
      '#006600', '#005c00', '#005200',
      '#004700', '#003d00', '#003300',
      '#002900', '#001f00', '#001400',
    ],
    microColors: [
      '#39ff14', '#32ff12', '#2bff10',
      '#1aff0d', '#0dff0b', '#05ff09',
      '#00fa08', '#00f007', '#00e607',
      '#00db06', '#00d106', '#00c705',
      '#00bc05', '#00b204', '#00a804',
      '#009d04', '#009303', '#008903',
      '#1aff66', '#33ff7a', '#4dff8f',
    ],
    linkColor: '0, 255, 65',
    mouseLinkColor: '57, 255, 20',
    particleSizeMultiplier: 0.65,
    flowSpeed: 0.75,
    glowIntensity: 1.6,
    // Visible gravity bodies wander across and off the screen; fish feel 35% of their pull
    gravityBodies: { count: 4, fishPull: 0.35 },
    // Micro particles swim in schools: 2.5x the preset's micro count, about 45 to a school
    schools: { density: 2.5, perSchool: 45 },
    // Particles carried off screen fade back in somewhere else, so swept areas fill again
    reappear: true,
    // Strength of a slow, shifting current that keeps particles drifting across the screen
    current: 0.008,
    // Orange serpents slither (and now and then coil) through, shoving green particles out
    // of their way, even ones held by a gravity body, and knocking aside bodies they hit
    serpents: { count: 3 },
    // Neon pink hunters roam after the fish and carry off the ones they catch. A gravity
    // body that pulls one in kills it, and the fish it carried swim free.
    hunters: { count: 1 },
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  
  stormy: {
    background: '#0d1117',
    colors: [
      '#64748b', '#475569', '#334155',
      '#94a3b8', '#cbd5e1', '#e2e8f0',
      '#60a5fa', '#3b82f6', '#2563eb',
      '#a855f7', '#8b5cf6', '#7c3aed',
    ],
    microColors: [
      '#94a3b8', '#a8b5c4', '#bcc8d4',
      '#60a5fa', '#7bb3fb', '#96c1fc',
      '#a78bfa', '#b69dfb', '#c5b0fc',
    ],
    linkColor: '148, 163, 184',
    mouseLinkColor: '96, 165, 250',
    particleSizeMultiplier: 0.8,
    flowSpeed: 1.5,
    glowIntensity: 0.9,
    hasRain: true,
    rainCount: 160,
    fontFamily: "'Cinzel', 'Playfair Display', serif",
  },

  cyberstorm: {
    background: '#05060f',
    colors: [
      '#00f0ff', '#22d3ee', '#38bdf8',
      '#6366f1', '#818cf8', '#8b5cf6',
      '#a855f7', '#d946ef', '#ff2bd6',
      '#f472b6', '#60a5fa', '#c084fc',
    ],
    microColors: [
      '#67e8f9', '#a5f3fc', '#93c5fd',
      '#c7d2fe', '#ddd6fe', '#f0abfc',
      '#f9a8d4', '#e9d5ff', '#bae6fd',
    ],
    linkColor: '120, 130, 255',
    mouseLinkColor: '255, 43, 214',
    particleSizeMultiplier: 0.7,
    flowSpeed: 0.9,
    glowIntensity: 1.4,
    // Layers of storm clouds drift past on the wind, lit from inside by RGB lightning that
    // forks down through them or crawls between them. Frames between strikes, at random:
    storm: { clouds: 18, strikeEvery: [100, 320] },
    // The clouds and birds are the scenery, so fewer particles drift in front of them
    particleShare: 0.45,
    // Flocks of birds wheel through the storm and scatter from strikes and the cursor
    flocks: { count: 3, perFlock: 26 },
    // A light slanted drizzle (the particles don't fall with it, as they do in Stormy)
    drizzle: true,
    rainCount: 110,
    rainColor: '150, 170, 255',
    rainSlant: -0.22,
    fontFamily: "'Orbitron', 'Inter', sans-serif",
  },

  aurora: {
    background: '#0a0f1a',
    colors: [
      '#22d3ee', '#06b6d4', '#0891b2',
      '#a855f7', '#c084fc', '#d8b4fe',
      '#4ade80', '#22c55e', '#16a34a',
      '#f472b6', '#fb7185', '#fda4af',
    ],
    microColors: [
      '#67e8f9', '#7ee7fa', '#95e6fb',
      '#c4b5fd', '#d4c8fe', '#e4dbff',
      '#86efac', '#9df2b8', '#b4f5c4',
    ],
    linkColor: '34, 211, 238',
    mouseLinkColor: '168, 85, 247',
    particleSizeMultiplier: 1.25,
    flowSpeed: 0.45,
    glowIntensity: 2.1,
    hasStars: true,
    starCount: 220,
    auroraWaves: 5,
    fontFamily: "'Quicksand', 'Comfortaa', sans-serif",
  },
  
  meshwater: {
    background: '#0c1a2d',
    colors: [
      '#0ea5e9', '#0284c7', '#0369a1',
      '#06b6d4', '#0891b2', '#0e7490',
      '#22d3ee', '#67e8f9', '#a5f3fc',
    ],
    microColors: [
      '#7dd3fc', '#a3dffd', '#c9ebfe',
      '#5eead4', '#8df0e3', '#bcf5f1',
      '#bae6fd', '#d0effe', '#e6f7ff',
    ],
    linkColor: '14, 165, 233',
    mouseLinkColor: '34, 211, 238',
    particleSizeMultiplier: 0.7,
    flowSpeed: 0.55,
    glowIntensity: 1.3,
    meshMode: true,
    fontFamily: "'Montserrat', 'Raleway', sans-serif",
  },
  
  blaze: {
    background: '#1a0f05',
    colors: [
      '#fbbf24', '#f59e0b', '#d97706',
      '#f97316', '#ea580c', '#c2410c',
      '#ef4444', '#dc2626', '#b91c1c',
      '#fcd34d', '#fde68a', '#fef3c7',
    ],
    microColors: [
      '#fcd34d', '#fde47a', '#fef1b8',
      '#fdba74', '#fdc595', '#fed0b6',
      '#fca5a5', '#fdb8b8', '#fecbcb',
    ],
    linkColor: '251, 191, 36',
    mouseLinkColor: '239, 68, 68',
    particleSizeMultiplier: 0.95,
    flowSpeed: 1.4,
    glowIntensity: 1.9,
    heatDistortion: true,
    sparkCount: 65,
    fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
  },
};

// Patterns a school of fish switches between
const SCHOOL_SHAPES = ['shoal', 'ribbon', 'ball'];
// How far off screen a gravity body may travel before it leaves
const BODY_MARGIN = 220;
// A body heavier than any newly spawned one (so one that has merged) absorbs particles.
// Between PLANET_START and PLANET_FULL it turns from a glowing orb into a ringed planet,
// and it stops growing at MAX_BODY_MASS.
const ABSORB_MASS = 1.7;
const PLANET_START = 2.2;
const PLANET_FULL = 4.5;
const MAX_BODY_MASS = 8;
// Absorbed particles it takes to fill out a planet's rings
const RING_FULL = 120;
// Frames a planet's collapse takes before it bursts
const COLLAPSE_FRAMES = 150;
const SERPENT_COLORS = ['#ff8c1a', '#ff6a00', '#ffa640'];
// How far an orange serpent shoves green particles, and how hard (per segment)
const SERPENT_REACH = 48;
const SERPENT_SHOVE = 0.45;
// Fish a hunter can carry, how far it sees them, and the frames its death takes
const HUNTER_CAP = 40;
const HUNTER_SIGHT = 260;
const HUNTER_DEATH_FRAMES = 50;
// Cyber Storm cloud layers, far to near: size, opacity, wind speed (px a frame) and the
// band of the screen's height they drift in
const CLOUD_LAYERS = [
  { scale: 0.55, alpha: 0.6, wind: 0.12, top: 0, bottom: 0.42 },
  { scale: 0.8, alpha: 0.8, wind: 0.24, top: 0.04, bottom: 0.52 },
  { scale: 1.1, alpha: 0.92, wind: 0.4, top: 0.08, bottom: 0.62 },
];
// Hues a strike starts at (red, green, blue, magenta, cyan, violet); it then shifts as it flickers
const STRIKE_HUES = [355, 125, 222, 312, 185, 268];
// Fewest frames between two strikes lighting up the clouds, which keeps big flashes under
// three a second
const FLASH_GAP = 20;
// How far a strike scares birds off
const STRIKE_SCARE = 260;

// 'r, g, b' (the way shockwave colours are written) for a fully saturated hue at 60% lightness
const hueRgb = (h) => {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)}, ${f(8)}, ${f(4)}`;
};

// ============================================
// PARTICLE CANVAS WITH GRAVITY & PHYSICS ENGINE
// ============================================

function ParticleBackgroundCanvas({
  theme = 'cosmic',
  settings,
  gravityMode = GRAVITY_MODES.WELL,
  gravityStrength = 1.0,
  shockwavesEnabled = true,
  calm = false,
}) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const microRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0, down: false });
  const shockwavesRef = useRef([]);
  const attractorsRef = useRef([]);
  const rainRef = useRef([]);
  const starsRef = useRef([]);
  const sparksRef = useRef([]);
  const bodiesRef = useRef([]);
  const schoolsRef = useRef([]);
  const serpentsRef = useRef([]);
  const huntersRef = useRef([]);
  const stormRef = useRef(null);
  const flocksRef = useRef([]);
  const spritesRef = useRef(new Map());
  const themeRef = useRef(theme);
  const calmRef = useRef(calm);

  useEffect(() => {
    calmRef.current = calm;
  }, [calm]);

  useEffect(() => {
    themeRef.current = theme;
    const tc = THEME_CONFIGS[theme] || THEME_CONFIGS.cosmic;
    for (const p of particlesRef.current) {
      p.color = tc.colors[Math.floor(Math.random() * tc.colors.length)];
    }
    for (const p of microRef.current) {
      p.color = tc.microColors[Math.floor(Math.random() * tc.microColors.length)];
    }
  }, [theme]);

  const getThemeConfig = useCallback(() => {
    return THEME_CONFIGS[themeRef.current] || THEME_CONFIGS.cosmic;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const themeConfig = getThemeConfig();
    const colors = themeConfig.colors;
    const microColors = themeConfig.microColors;

    // A theme with its own scenery can ask for a share of the preset's particles
    const particleShare = themeConfig.particleShare || 1;
    const particleCount = Math.round(settings.particles.count * particleShare);
    const microCount = Math.round(settings.particles.microCount * particleShare);
    const enableLinks = settings.particles.links;
    const enableColorCycling = settings.particles.colorCycling;

    const sizeMultiplier = themeConfig.particleSizeMultiplier || 1;
    const flowSpeedMult = themeConfig.flowSpeed || 1;
    const bodyCfg = themeConfig.gravityBodies;
    const schoolCfg = themeConfig.schools;
    const serpentCfg = themeConfig.serpents;
    // Hunters need fish to hunt
    const hunterCfg = schoolCfg && themeConfig.hunters;
    const stormCfg = themeConfig.storm;
    const flockCfg = themeConfig.flocks;
    // How busy the graphics preset is next to Medium, for sizing the storm and the flocks
    const busy = Math.max(0.6, Math.min(1.4, settings.particles.count / 220));
    // With reduced motion asked for, lightning lights the clouds less and nothing flashes or glitches
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const microTotal = schoolCfg ? Math.round(microCount * schoolCfg.density) : microCount;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize main particles with mass and inertia
    if (particlesRef.current.length !== particleCount) {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        const colorGroup = i % colors.length;
        const baseSize = (Math.random() * 3.2 + 1.2) * sizeMultiplier;
        const mass = baseSize * 1.2;

        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.6 * flowSpeedMult,
          vy: (Math.random() - 0.5) * 1.6 * flowSpeedMult,
          size: Math.max(baseSize, 0.9),
          mass: mass,
          color: colors[colorGroup],
          baseColorIndex: colorGroup,
          colorSpeed: (0.4 + Math.random() * 2.0) * flowSpeedMult,
          colorPhase: Math.random() * Math.PI * 2,
          opacity: Math.random() * 0.55 + 0.35,
          opacityDir: Math.random() > 0.5 ? 1 : -1,
          driftAngle: Math.random() * Math.PI * 2,
          driftSpeed: (0.15 + Math.random() * 0.45) * flowSpeedMult,
          swirlOffset: Math.random() * 1000,
          fallBias: themeConfig.hasRain ? 2.5 : 0,
        });
      }
    }

    // Initialize micro dust particles (as schools of fish, of uneven size, when the theme has them)
    if (microRef.current.length !== microTotal) {
      const schoolCount = schoolCfg ? Math.max(3, Math.min(12, Math.round(microTotal / schoolCfg.perSchool))) : 0;
      const schoolOf = Array.from({ length: schoolCount ? microTotal : 0 },
        () => Math.floor(Math.pow(Math.random(), 1.6) * schoolCount));
      const counts = new Array(schoolCount).fill(0);
      for (const idx of schoolOf) counts[idx]++;
      schoolsRef.current = counts.map((count) => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        heading: Math.random() * Math.PI * 2,
        turn: 0,
        speed: 1,
        cruise: 0.8 + Math.random(),
        dart: 0,
        vx: 0, // drift from passing gravity bodies
        vy: 0,
        mx: 0, // the school's overall velocity, which every fish aligns with
        my: 0,
        shape: SCHOOL_SHAPES[Math.floor(Math.random() * SCHOOL_SHAPES.length)],
        shapeTimer: 300 + Math.random() * 600,
        spin: Math.random() < 0.5 ? -1 : 1,
        length: 22 + Math.sqrt(count) * 8,
      }));

      microRef.current = [];
      for (let i = 0; i < microTotal; i++) {
        const colorGroup = i % microColors.length;
        const school = schoolCount ? schoolsRef.current[schoolOf[i]] : null;
        microRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.9 * flowSpeedMult,
          vy: (Math.random() - 0.5) * 0.9 * flowSpeedMult,
          size: 0.4 + Math.random() * 1.3,
          mass: 0.5,
          color: microColors[colorGroup],
          colorSpeed: 0.3 + Math.random() * 1.2,
          colorPhase: Math.random() * Math.PI * 2,
          opacity: 0.15 + Math.random() * 0.4,
          opacityDir: Math.random() > 0.5 ? 1 : -1,
          pulseSpeed: 0.003 + Math.random() * 0.005,
          driftAngle: Math.random() * Math.PI * 2,
          driftSpeed: 0.1 + Math.random() * 0.3,
          swirlOffset: Math.random() * 1000,
          // A fish starts at its school, at rest, with its own place in the school's shape
          ...(school && {
            school: schoolOf[i],
            x: school.x + (Math.random() - 0.5) * school.length,
            y: school.y + (Math.random() - 0.5) * school.length,
            vx: 0,
            vy: 0,
            size: 0.7 + Math.random() * 0.9,
            opacity: 0.4 + Math.random() * 0.4,
            u: Math.random(),
            v: Math.random(),
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 4 + Math.random() * 4,
          }),
        });
      }
    }

    // Initialize stormy rain (or Cyber Storm's drizzle)
    if ((themeConfig.hasRain || themeConfig.drizzle) && rainRef.current.length === 0) {
      const count = themeConfig.rainCount || 150;
      rainRef.current = [];
      for (let i = 0; i < count; i++) {
        rainRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          length: Math.random() * 22 + 12,
          speed: Math.random() * 14 + 11,
          opacity: Math.random() * 0.45 + 0.15,
          width: Math.random() * 1.2 + 0.6,
        });
      }
    }

    // Initialize aurora stars
    if (themeConfig.hasStars && starsRef.current.length === 0) {
      const count = themeConfig.starCount || 180;
      starsRef.current = [];
      for (let i = 0; i < count; i++) {
        starsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.7,
          size: Math.random() * 1.6 + 0.6,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Initialize blaze embers
    if (themeConfig.heatDistortion && sparksRef.current.length === 0) {
      const count = themeConfig.sparkCount || 60;
      sparksRef.current = [];
      for (let i = 0; i < count; i++) {
        sparksRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * 80,
          vx: (Math.random() - 0.5) * 2.2,
          vy: -(Math.random() * 3.5 + 2.0),
          size: Math.random() * 2.4 + 0.6,
          life: Math.random(),
          decay: Math.random() * 0.012 + 0.006,
        });
      }
    }

    // Initialize 4 wandering celestial massive bodies
    if (attractorsRef.current.length === 0) {
      attractorsRef.current = [];
      for (let i = 0; i < 4; i++) {
        attractorsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2.5,
          vy: (Math.random() - 0.5) * 2.5,
          strength: 0.02 + Math.random() * 0.03,
          radius: 190 + Math.random() * 110,
          lifetime: 0,
          maxLife: 250 + Math.random() * 350,
          hue: [190, 270, 320, 140][i % 4],
        });
      }
    }

    // Size, reach and pull follow a body's mass. Reach and pull stop growing early, so a
    // big planet can't drain the whole screen.
    const sizeBody = (b) => {
      b.core = 5 + b.mass * 5;
      b.radius = 230 + Math.min(b.mass, 4) * 120;
      b.pull = Math.min(b.mass, 5);
    };

    // A gravity body either starts somewhere on screen, or just past a random edge
    // aimed at the middle of the screen, so it plunges across
    const spawnBody = (b, onScreen) => {
      const W = canvas.width;
      const H = canvas.height;
      b.active = true;
      b.mass = 0.7 + Math.random() * 0.9;
      sizeBody(b);
      b.spin = Math.random() < 0.5 ? -1 : 1;
      b.phase = Math.random() * Math.PI * 2;
      b.pulseSpeed = 1.2 + Math.random() * 1.6;
      b.cruise = 0.5 + Math.random() * 1.6;
      b.speed = b.cruise;
      b.turn = 0;
      b.vx = 0;
      b.vy = 0;
      b.gx = 0; // drift from the other bodies' pull
      b.gy = 0;
      b.growth = 0; // 0 for an orb, 1 for a full planet
      b.flat = 1; // how round its disk looks: 1 face-on, smaller as it flattens into rings
      b.sphere = 0;
      b.ring = 0; // particles absorbed into its rings
      b.flash = 0;
      b.calm = 0; // frames it ignores the other bodies' pull, after a burst
      b.life = 0; // frames a full planet has left before it collapses
      b.collapse = 0;
      // Its ring plane's tilt, and a fixed pattern of bright and faint bands with a gap
      b.tilt = (Math.random() - 0.5) * 0.9;
      b.tiltCos = Math.cos(b.tilt);
      b.tiltSin = Math.sin(b.tilt);
      b.bands = Array.from({ length: 9 }, (_, i) => (i === 6 ? 0.12 : 0.35 + Math.random() * 0.65));
      if (onScreen) {
        b.x = Math.random() * W;
        b.y = Math.random() * H;
        b.heading = Math.random() * Math.PI * 2;
        return;
      }
      const m = BODY_MARGIN * 0.8;
      const edge = Math.floor(Math.random() * 4);
      b.x = edge === 0 ? -m : edge === 1 ? W + m : Math.random() * W;
      b.y = edge === 2 ? -m : edge === 3 ? H + m : Math.random() * H;
      b.heading = Math.atan2(H * (0.2 + Math.random() * 0.6) - b.y, W * (0.2 + Math.random() * 0.6) - b.x);
    };

    // Initialize the gravity bodies: two already on screen, the rest arriving soon
    if (bodyCfg && bodiesRef.current.length === 0) {
      for (let i = 0; i < bodyCfg.count; i++) {
        const b = {};
        if (i < 2) spawnBody(b, true);
        else { b.active = false; b.wait = 60 + Math.random() * 240; }
        bodiesRef.current.push(b);
      }
    }
    // The bodies far enough along to be drawn as planets, refreshed every frame
    const planets = [];

    // Orange serpents: a head on a wandering, slithering path and a chain of segments
    // that follow it at a fixed spacing
    if (serpentCfg && serpentsRef.current.length === 0) {
      serpentsRef.current = Array.from({ length: serpentCfg.count }, (_, i) => {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const heading = Math.random() * Math.PI * 2;
        const spacing = 7 + Math.random() * 2;
        return {
          heading,
          turn: 0,
          speed: 1.8,
          cruise: 1.4 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
          freq: 3 + Math.random() * 2, // slither rate, radians a second
          wiggle: 0.035 + Math.random() * 0.025,
          coil: 0, // frames left curling up
          coilDir: 1,
          spacing,
          color: SERPENT_COLORS[i % SERPENT_COLORS.length],
          segs: Array.from({ length: 16 + Math.floor(Math.random() * 9) }, (_, k) => ({
            x: x - Math.cos(heading) * k * spacing,
            y: y - Math.sin(heading) * k * spacing,
          })),
          minX: x, maxX: x, minY: y, maxY: y, // bounding box, for a quick reach check
        };
      });
    }

    // A hunter comes in from just past a random edge, aimed at the middle of the screen
    const spawnHunter = (h) => {
      const W = canvas.width;
      const H = canvas.height;
      const m = 40;
      const edge = Math.floor(Math.random() * 4);
      h.x = edge === 0 ? -m : edge === 1 ? W + m : Math.random() * W;
      h.y = edge === 2 ? -m : edge === 3 ? H + m : Math.random() * H;
      h.heading = Math.atan2(H * (0.3 + Math.random() * 0.4) - h.y, W * (0.3 + Math.random() * 0.4) - h.x);
      h.vx = Math.cos(h.heading) * 2;
      h.vy = Math.sin(h.heading) * 2;
      h.alive = true;
      h.dying = 0;
      h.wait = 0;
      h.caught = 0;
      h.killer = null;
      h.trail = [];
    };

    if (hunterCfg && huntersRef.current.length === 0) {
      huntersRef.current = Array.from({ length: hunterCfg.count }, () => {
        const h = {};
        spawnHunter(h);
        return h;
      });
    }

    // A storm cloud, drawn once at half size (it's soft, so scaling up costs nothing): many
    // overlapping soft puffs, big and small, piled on a flat base, then lit from above, with
    // billows along the crown, a neon glow along the base and faint scanlines. The mask is a
    // white copy at quarter size, which lightning tints to light the cloud from inside.
    const makeCloud = (w, h) => {
      const sprite = document.createElement('canvas');
      sprite.width = Math.ceil(w / 2);
      sprite.height = Math.ceil(h / 2);
      const g = sprite.getContext('2d');
      g.scale(0.5, 0.5);
      const mask = document.createElement('canvas');
      mask.width = Math.ceil(w / 4);
      mask.height = Math.ceil(h / 4);
      const m = mask.getContext('2d');
      m.scale(0.25, 0.25);

      const base = h * 0.76;
      const puffs = [];
      const n = 50 + Math.floor(Math.random() * 30);
      for (let i = 0; i < n; i++) {
        const u = (Math.random() + Math.random()) / 2; // bunched toward the middle
        const centre = 1 - Math.abs(u - 0.5) * 2; // 1 in the middle, 0 at the ends
        const big = Math.random() < 0.5;
        const r = h * (big ? 0.13 + Math.random() * 0.13 : 0.05 + Math.random() * 0.06) * (0.55 + centre * 0.6);
        const y = base - r * 0.5 - Math.random() * Math.pow(centre, 0.8) * Math.max(0, base - r * 1.5 - 4);
        puffs.push({ x: w * (0.08 + u * 0.84), y, r });
      }
      for (const p of puffs) {
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, 'rgba(20, 22, 48, 0.6)');
        grad.addColorStop(0.5, 'rgba(20, 22, 48, 0.42)');
        grad.addColorStop(1, 'rgba(20, 22, 48, 0)');
        g.fillStyle = grad;
        g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        const mg = m.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        mg.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        mg.addColorStop(1, 'rgba(255, 255, 255, 0)');
        m.fillStyle = mg;
        m.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      // Shear off everything under the base
      for (const c of [g, m]) {
        c.globalCompositeOperation = 'destination-out';
        const cut = c.createLinearGradient(0, base - h * 0.04, 0, base + h * 0.08);
        cut.addColorStop(0, 'rgba(0, 0, 0, 0)');
        cut.addColorStop(1, 'rgba(0, 0, 0, 1)');
        c.fillStyle = cut;
        c.fillRect(0, 0, w, h);
      }
      // Everything from here is painted only onto the cloud itself: light from above, darker
      // underneath, billows along the crown, the neon underglow, and the scanlines
      g.globalCompositeOperation = 'source-atop';
      const shade = g.createLinearGradient(0, 0, 0, base);
      shade.addColorStop(0, 'rgba(120, 130, 200, 0.5)');
      shade.addColorStop(0.45, 'rgba(50, 54, 105, 0.25)');
      shade.addColorStop(1, 'rgba(0, 0, 8, 0.35)');
      g.fillStyle = shade;
      g.fillRect(0, 0, w, h);
      for (const p of puffs) {
        if (p.y > base * 0.6) continue;
        const hl = g.createRadialGradient(p.x, p.y - p.r * 0.45, 0, p.x, p.y - p.r * 0.45, p.r * 0.7);
        hl.addColorStop(0, 'rgba(170, 175, 235, 0.13)');
        hl.addColorStop(1, 'rgba(170, 175, 235, 0)');
        g.fillStyle = hl;
        g.fillRect(p.x - p.r, p.y - p.r * 1.2, p.r * 2, p.r * 1.5);
      }
      const neon = ['255, 43, 214', '0, 200, 255', '140, 90, 255'][Math.floor(Math.random() * 3)];
      const under = g.createLinearGradient(0, base - h * 0.3, 0, base);
      under.addColorStop(0, `rgba(${neon}, 0)`);
      under.addColorStop(1, `rgba(${neon}, 0.3)`);
      g.fillStyle = under;
      g.fillRect(0, 0, w, h);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(0, 0, 0, 0.2)';
      for (let y = 0; y < sprite.height; y += 2) g.fillRect(0, y, sprite.width, 1);
      g.globalCompositeOperation = 'source-over';
      return { sprite, mask };
    };

    // A cloud's height on screen, somewhere in its layer's band
    const placeCloud = (c) => {
      const L = CLOUD_LAYERS[c.layer];
      c.y = canvas.height * (L.top + Math.random() * (L.bottom - L.top)) - c.h * 0.5;
    };

    if (stormCfg && !stormRef.current) {
      const W = canvas.width;
      const sizeScale = Math.max(0.7, Math.min(1.5, W / 1600));
      const total = Math.round(stormCfg.clouds * busy);
      const clouds = [];
      let maskW = 1;
      let maskH = 1;
      for (let i = 0; i < total; i++) {
        // About 40% far, 35% middle, 25% near
        const f = i / total;
        const layer = f < 0.4 ? 0 : f < 0.75 ? 1 : 2;
        const w = Math.round((480 + Math.random() * 620) * CLOUD_LAYERS[layer].scale * sizeScale);
        const h = Math.round(w * (0.36 + Math.random() * 0.12));
        const { sprite, mask } = makeCloud(w, h);
        maskW = Math.max(maskW, mask.width);
        maskH = Math.max(maskH, mask.height);
        const c = {
          layer, sprite, mask, w, h,
          x: Math.random() * (W + w) - w * 0.5,
          y: 0,
          bob: Math.random() * Math.PI * 2,
          light: 0, // how brightly lightning lights it, fading
          lx: 0, // where the light comes from, in the cloud's own pixels
          ly: 0,
          hue: 0,
          glitch: 0, // frames left sliced up and knocked sideways
          cuts: [],
        };
        placeCloud(c);
        clouds.push(c);
      }
      const scratch = document.createElement('canvas');
      scratch.width = maskW;
      scratch.height = maskH;
      stormRef.current = {
        clouds,
        strikes: [],
        next: 50 + Math.random() * 100, // frames to the next strike
        frame: 0,
        lastFlash: -FLASH_GAP,
        sky: 0, // the faint wash over the whole sky from the latest strike
        skyHue: 0,
        scratch,
        scratchCtx: scratch.getContext('2d'),
        skyGrad: null,
        skyGradH: 0,
      };
    }

    // A flock picks somewhere new to head for: usually in the sky, now and then off one side,
    // to leave for a while
    const retargetFlock = (fl) => {
      const W = canvas.width;
      const H = canvas.height;
      if (Math.random() < 0.25) {
        fl.tx = Math.random() < 0.5 ? -180 : W + 180;
        fl.ty = H * (0.1 + Math.random() * 0.5);
      } else {
        fl.tx = W * (0.1 + Math.random() * 0.8);
        fl.ty = H * (0.08 + Math.random() * 0.55);
      }
      fl.retarget = 360 + Math.random() * 600;
    };

    if (flockCfg && flocksRef.current.length === 0) {
      const W = canvas.width;
      const H = canvas.height;
      const depths = [0.6, 0.85, 1.05];
      flocksRef.current = Array.from({ length: flockCfg.count }, (_, i) => {
        const depth = depths[i % depths.length] * (0.9 + Math.random() * 0.2);
        const cx = Math.random() * W;
        const cy = H * (0.12 + Math.random() * 0.45);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const fl = {
          depth,
          // Drawn just after this cloud layer, so nearer clouds pass in front of farther flocks
          layer: depth < 0.75 ? 0 : depth < 0.95 ? 1 : 2,
          phase: Math.random() * Math.PI * 2,
          rim: ['0, 240, 255', '255, 43, 214', '160, 120, 255'][i % 3],
          tx: 0,
          ty: 0,
          retarget: 0,
          birds: Array.from({ length: Math.round(flockCfg.perFlock * busy * (0.7 + Math.random() * 0.6)) }, () => ({
            x: cx + (Math.random() - 0.5) * 90,
            y: cy + (Math.random() - 0.5) * 45,
            vx: dir * (1.6 + Math.random() * 0.6) * depth,
            vy: (Math.random() - 0.5) * 0.4,
            phase: Math.random() * Math.PI * 2,
            flapSpeed: 0.26 + Math.random() * 0.12,
            size: 0.8 + Math.random() * 0.5,
            glide: 0, // frames left gliding instead of flapping
            scared: 0, // frames left fleeing
          })),
        };
        retargetFlock(fl);
        return fl;
      });
    }

    // Window Mouse Listeners — Continuous hover tracking + shockwave pulses
    const handleMouseMove = (e) => {
      const prevX = mouseRef.current.x;
      const prevY = mouseRef.current.y;
      mouseRef.current.vx = e.clientX - prevX;
      mouseRef.current.vy = e.clientY - prevY;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseDown = (e) => {
      mouseRef.current.down = true;

      // Trigger high-velocity gravitational shockwave on click
      if (shockwavesEnabled) {
        shockwavesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          radius: 12,
          speed: 15,
          maxRadius: Math.max(window.innerWidth, window.innerHeight) * 0.5,
          intensity: 1.0,
          color: themeConfig.mouseLinkColor,
        });
      }
    };

    const handleMouseUp = () => {
      mouseRef.current.down = false;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
      mouseRef.current.vx = 0;
      mouseRef.current.vy = 0;
      mouseRef.current.down = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseLeave);

    // ============================================
    // PHYSICS CORE: GRAVITATIONAL LAWS EVALUATION
    // ============================================
    const applyGravityLaws = (p, mouse, time, isMicro = false) => {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      const softening = 28; // Softening radius to prevent singularity explosion
      const interactionRadius = mouse.down ? 340 : 250;
      const massFactor = isMicro ? 1.6 : 1.0;
      const G = 140 * gravityStrength * massFactor;

      // 1. Interactive Mouse Gravity Engine
      if (dist < interactionRadius && dist > 1) {
        const force = (G / (distSq + softening * softening)) * (mouse.down ? 2.4 : 1.0);
        const nx = dx / dist;
        const ny = dy / dist;

        switch (gravityMode) {
          case GRAVITY_MODES.REPULSION: {
            // Anti-gravity / Kinetic forcefield: pushes particles away
            const repelStrength = (1 - dist / interactionRadius) * 4.2 * gravityStrength;
            p.vx -= nx * repelStrength;
            p.vy -= ny * repelStrength;
            break;
          }

          case GRAVITY_MODES.VORTEX: {
            // Kerr Singularity: Radial gravity + tangential accretion swirl
            p.vx += nx * force * 1.5;
            p.vy += ny * force * 1.5;
            // Cross product tangential velocity v_theta = (-dy, dx)
            const swirl = (1 - dist / interactionRadius) * 2.8 * gravityStrength;
            p.vx += -ny * swirl;
            p.vy += nx * swirl;
            break;
          }

          case GRAVITY_MODES.CELESTIAL: {
            // Orbital mechanics: stable gravitational slingshot
            p.vx += nx * force;
            p.vy += ny * force;
            const orbitalSpeed = Math.sqrt(Math.abs(force)) * 0.9;
            p.vx += -ny * orbitalSpeed;
            p.vy += nx * orbitalSpeed;
            break;
          }

          case GRAVITY_MODES.WELL:
          default: {
            // Standard Newtonian Gravity Well: Pull with orbital deflection
            p.vx += nx * force * 1.8;
            p.vy += ny * force * 1.8;
            // Slight tangential spin gives graceful orbital arcs
            const tangential = 0.22 * (1 - dist / interactionRadius);
            p.vx += -ny * tangential;
            p.vy += nx * tangential;
            break;
          }
        }
      }

      // 2. Gravitational Shockwave Waves
      const shockwaves = shockwavesRef.current;
      for (let s = 0; s < shockwaves.length; s++) {
        const sw = shockwaves[s];
        const sdx = p.x - sw.x;
        const sdy = p.y - sw.y;
        const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
        const waveDist = Math.abs(sdist - sw.radius);

        if (waveDist < 55) {
          const impulse = (1 - waveDist / 55) * sw.intensity * (isMicro ? 6.5 : 4.5);
          const snx = sdist > 0 ? sdx / sdist : 1;
          const sny = sdist > 0 ? sdy / sdist : 0;
          p.vx += snx * impulse;
          p.vy += sny * impulse;
        }
      }

      if (serpentCfg) shoveFromSerpents(p);

      // 3. Wandering Celestial Massive Bodies (the visible gravity bodies, when the theme has them)
      if (bodyCfg) {
        pullTowardBodies(p, isMicro ? bodyCfg.fishPull : 1, true, !isMicro);
        return;
      }
      const attractors = attractorsRef.current;
      for (let a = 0; a < attractors.length; a++) {
        const att = attractors[a];
        const adx = att.x - p.x;
        const ady = att.y - p.y;
        const adistSq = adx * adx + ady * ady;
        const adist = Math.sqrt(adistSq);

        if (adist < att.radius && adist > 0) {
          const aForce = (att.strength * 40) / (adistSq + 900);
          p.vx += (adx / adist) * aForce;
          p.vy += (ady / adist) * aForce;
        }
      }
    };

    // Inverse-square pull toward each active gravity body. With `orbit`, a particle in its
    // reach is also eased toward a circular orbit around it (bounce toward and away from
    // the body damped, sideways speed nudged to orbital speed), so captured particles
    // gather into a swirling disk that travels with the body and trails behind it when it
    // plunges, instead of being slung off. The orbit is worked out in the body's ring plane,
    // which tilts away as the body becomes a planet, so its disk flattens into rings.
    // With `absorb`, a body that has merged takes particles in from its disk and grows.
    const pullTowardBodies = (p, scale, orbit = true, absorb = false) => {
      const bodies = bodiesRef.current;
      for (let b = 0; b < bodies.length; b++) {
        const body = bodies[b];
        if (!body.active) continue;
        const dx = body.x - p.x;
        const dy = body.y - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > body.radius * body.radius || distSq < 0.01) continue;
        const dist = Math.sqrt(distSq);
        const soft = body.core * (4 - body.growth * 2);
        const force = (520 * body.pull * gravityStrength * scale) / (distSq + soft * soft);
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
        if (!orbit) continue;

        // Into ring space (turned by the tilt and stretched across the ring plane),
        // where a ring orbit is a circle
        const c = body.tiltCos;
        const s = body.tiltSin;
        const k = body.flat;
        const rx = dx * c + dy * s;
        const ry = (dy * c - dx * s) / k;
        const ld = Math.hypot(rx, ry);
        if (ld < 0.01) continue;
        const nx = rx / ld;
        const ny = ry / ld;
        const wvx = p.vx - body.vx;
        const wvy = p.vy - body.vy;
        const rvx = wvx * c + wvy * s;
        const rvy = (wvy * c - wvx * s) / k;
        const radial = rvx * nx + rvy * ny;
        const tx = -ny * body.spin;
        const ty = nx * body.spin;
        const tangential = rvx * tx + rvy * ty;
        // The pull still points at the body in ring space, scaled by ld / dist
        const orbitSpeed = ld * Math.sqrt(force / dist);
        const ease = 0.03 * scale * (1 - dist / body.radius);
        let ax = (tx * (orbitSpeed - tangential) - nx * radial) * ease;
        let ay = (ty * (orbitSpeed - tangential) - ny * radial) * ease;
        // Each particle keeps its own orbit distance, so the captured particles spread
        // out instead of piling up on the core: 3 to 12 core widths round an orb,
        // narrowing to a band 1.4 to 3 core widths out round a planet. A collapsing
        // planet draws its rings in.
        const squeeze = body.collapse > 0 ? 0.3 + 0.7 * (body.collapse / COLLAPSE_FRAMES) : 1;
        const hold = body.core * squeeze *
          (3 - 1.6 * body.growth + (p.swirlOffset % 1) * (9 - 7.4 * body.growth));
        if (ld < hold) {
          const push = (hold - ld) * 0.02 * scale;
          ax -= nx * push;
          ay -= ny * push;
        } else if (body.growth > 0 && ld > hold * 1.6) {
          // A planet draws its stragglers in to the ring
          const tug = (ld - hold * 1.6) * 0.003 * body.growth * scale;
          ax += nx * tug;
          ay += ny * tug;
        }
        // Back to screen space
        ay *= k;
        p.vx += ax * c - ay * s;
        p.vy += ax * s + ay * c;

        if (!absorb) continue;
        // Near a planet, and for a moment after (as when a burst scatters its rings), it
        // is drawn without links, which would mat the crowd solid
        if (body.growth > 0.4 && dist < body.radius * 0.45) p.ringed = 90;
        if (ld < hold * 1.8 && body.mass >= ABSORB_MASS && body.collapse <= 0 && Math.random() < 0.0006) {
          // Taken in: the body grows and its rings thicken, and the particle fades back
          // in somewhere else
          body.mass = Math.min(MAX_BODY_MASS, body.mass + 0.025);
          body.ring++;
          sizeBody(body);
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
          p.vx = 0;
          p.vy = 0;
          p.fade = 0;
          return;
        }
      }
    };

    // Orange serpents push green particles out of their way, hard enough to tear them out
    // of a gravity body's orbit
    const shoveFromSerpents = (p) => {
      const serpents = serpentsRef.current;
      const R = SERPENT_REACH;
      for (let s = 0; s < serpents.length; s++) {
        const sp = serpents[s];
        if (p.x < sp.minX - R || p.x > sp.maxX + R || p.y < sp.minY - R || p.y > sp.maxY + R) continue;
        const segs = sp.segs;
        for (let i = 0; i < segs.length; i++) {
          const dx = p.x - segs[i].x;
          const dy = p.y - segs[i].y;
          const distSq = dx * dx + dy * dy;
          if (distSq > R * R || distSq < 0.01) continue;
          const dist = Math.sqrt(distSq);
          const t = 1 - dist / R;
          p.vx += (dx / dist) * t * t * SERPENT_SHOVE;
          p.vy += (dy / dist) * t * t * SERPENT_SHOVE;
        }
      }
    };

    // Serpents slither: the head's heading swings back and forth on a slow random path,
    // and every so often it curls into a coil. Gravity doesn't hold them; one that runs
    // into a gravity body knocks it aside and glances off.
    const updateSerpents = (time) => {
      const W = canvas.width;
      const H = canvas.height;
      const margin = 100;
      const bodies = bodiesRef.current;
      const serpents = serpentsRef.current;
      for (let s = 0; s < serpents.length; s++) {
        const sp = serpents[s];
        const segs = sp.segs;
        const head = segs[0];
        if (sp.coil > 0) {
          sp.coil--;
          sp.heading += sp.coilDir * 0.055;
        } else {
          sp.turn += (Math.random() - 0.5) * 0.003;
          sp.turn *= 0.97;
          sp.heading += sp.turn + Math.sin(time * sp.freq + sp.phase) * sp.wiggle;
          if (Math.random() < 0.0012) {
            sp.coil = 80 + Math.random() * 100;
            sp.coilDir = Math.random() < 0.5 ? -1 : 1;
          }
        }
        if (head.x < -margin || head.x > W + margin || head.y < -margin || head.y > H + margin) {
          const home = Math.atan2(H / 2 - head.y, W / 2 - head.x) - sp.heading;
          sp.heading += Math.atan2(Math.sin(home), Math.cos(home)) * 0.02;
        }
        if (Math.random() < 0.005) sp.cruise = 1.2 + Math.random() * 1.6;
        sp.speed += (sp.cruise - sp.speed) * 0.03;
        head.x += Math.cos(sp.heading) * sp.speed;
        head.y += Math.sin(sp.heading) * sp.speed;

        // Each segment keeps its spacing behind the one ahead
        let minX = head.x;
        let maxX = head.x;
        let minY = head.y;
        let maxY = head.y;
        for (let i = 1; i < segs.length; i++) {
          const a = segs[i - 1];
          const b = segs[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > sp.spacing) {
            b.x = a.x + (dx / dist) * sp.spacing;
            b.y = a.y + (dy / dist) * sp.spacing;
          }
          if (b.x < minX) minX = b.x; else if (b.x > maxX) maxX = b.x;
          if (b.y < minY) minY = b.y; else if (b.y > maxY) maxY = b.y;
        }
        sp.minX = minX;
        sp.maxX = maxX;
        sp.minY = minY;
        sp.maxY = maxY;

        for (let b = 0; b < bodies.length; b++) {
          const body = bodies[b];
          if (!body.active) continue;
          const reach = Math.max(body.core * 1.2, body.sphere) + 6;
          if (body.x < minX - reach || body.x > maxX + reach || body.y < minY - reach || body.y > maxY + reach) continue;
          for (let i = 0; i < segs.length; i += 2) {
            const dx = body.x - segs[i].x;
            const dy = body.y - segs[i].y;
            const dist = Math.hypot(dx, dy);
            if (dist > reach || dist < 0.01) continue;
            body.gx += (dx / dist) * 0.4 / body.mass;
            body.gy += (dy / dist) * 0.4 / body.mass;
            if (i === 0) {
              sp.heading = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.8;
              sp.turn = 0;
              sp.coil = 0;
            }
          }
        }
      }
    };

    // A glowing worm: a faint body line through the segments, then a glow per segment,
    // largest at the head
    const drawSerpents = () => {
      const serpents = serpentsRef.current;
      ctx.globalCompositeOperation = 'lighter';
      for (let s = 0; s < serpents.length; s++) {
        const sp = serpents[s];
        const segs = sp.segs;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255, 120, 20, 0.35)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();
        const sprite = getSprite(sp.color, '#fff3e0');
        for (let i = segs.length - 1; i >= 0; i--) {
          const t = i / (segs.length - 1);
          const r = i === 0 ? 14 : 10 * (1 - t * 0.6);
          ctx.globalAlpha = 0.95 - t * 0.5;
          ctx.drawImage(sprite, segs[i].x - r, segs[i].y - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    // A hunter chases the nearest free fish it can see and carries off the ones it
    // catches. It steers clear of gravity bodies, but less well and with a stronger pull
    // on it the more it carries, so a greedy hunter gets drawn in. Caught by one, it dies:
    // it's pulled into the core and the fish it carried swim free.
    const updateHunters = () => {
      const W = canvas.width;
      const H = canvas.height;
      const bodies = bodiesRef.current;
      const fish = microRef.current;
      const hunters = huntersRef.current;
      for (let n = 0; n < hunters.length; n++) {
        const h = hunters[n];
        if (!h.alive) {
          if (h.dying > 0) {
            h.dying--;
            h.x += (h.killer.x - h.x) * 0.12;
            h.y += (h.killer.y - h.y) * 0.12;
            if (h.dying === 0) h.wait = 300 + Math.random() * 600;
          } else if (--h.wait <= 0) {
            spawnHunter(h);
          }
          continue;
        }

        const agility = 1 / (1 + h.caught / 20);
        const maxSpeed = 3.8 * (0.55 + 0.45 * agility);
        let ax = 0;
        let ay = 0;
        let prey = null;
        let preyDistSq = HUNTER_SIGHT * HUNTER_SIGHT;
        if (h.caught < HUNTER_CAP) {
          for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            if (f.caughtBy) continue;
            const dx = f.x - h.x;
            const dy = f.y - h.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < preyDistSq) { prey = f; preyDistSq = distSq; }
          }
        }
        if (prey) {
          const dist = Math.sqrt(preyDistSq) || 1;
          ax += ((prey.x - h.x) / dist * maxSpeed - h.vx) * 0.07;
          ay += ((prey.y - h.y) / dist * maxSpeed - h.vy) * 0.07;
          if (dist < 8 + h.caught * 0.12) {
            prey.caughtBy = h;
            prey.orbitA = Math.random() * Math.PI * 2;
            prey.orbitR = 9 + h.caught * 0.12 + Math.random() * 10;
            prey.orbitS = (0.04 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1);
            h.caught++;
          }
        } else {
          // Nothing in sight (or full): prowl on a wandering heading
          h.heading += (Math.random() - 0.5) * 0.12;
          ax += (Math.cos(h.heading) * maxSpeed * 0.5 - h.vx) * 0.03;
          ay += (Math.sin(h.heading) * maxSpeed * 0.5 - h.vy) * 0.03;
        }
        if (h.x < 0 || h.x > W || h.y < 0 || h.y > H) {
          h.heading = Math.atan2(H / 2 - h.y, W / 2 - h.x);
          ax += Math.cos(h.heading) * 0.08;
          ay += Math.sin(h.heading) * 0.08;
        }

        for (let b = 0; b < bodies.length; b++) {
          const body = bodies[b];
          if (!body.active) continue;
          const dx = body.x - h.x;
          const dy = body.y - h.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < Math.max(body.core * 1.1, body.sphere)) {
            // Pulled in: it dies, and the fish it carried scatter
            h.alive = false;
            h.dying = HUNTER_DEATH_FRAMES;
            h.killer = body;
            body.flash = Math.max(body.flash, 0.6);
            for (let i = 0; i < fish.length; i++) {
              const f = fish[i];
              if (f.caughtBy !== h) continue;
              f.caughtBy = null;
              const speed = 2 + Math.random() * 2;
              f.vx = Math.cos(f.orbitA) * speed;
              f.vy = Math.sin(f.orbitA) * speed;
            }
            break;
          }
          const danger = body.core * 3 + body.sphere * 1.5 + 50;
          if (dist < danger) {
            const k = (1 - dist / danger) * 0.35 * agility;
            ax -= (dx / dist) * k;
            ay -= (dy / dist) * k;
          }
        }
        if (!h.alive) continue;

        h.vx += ax;
        h.vy += ay;
        if (bodyCfg) pullTowardBodies(h, 0.5 + h.caught * 0.02, false);
        const speed = Math.hypot(h.vx, h.vy);
        const cap = maxSpeed * 1.6;
        if (speed > cap) { h.vx *= cap / speed; h.vy *= cap / speed; }
        h.x += h.vx;
        h.y += h.vy;
        h.trail.push(h.x, h.y);
        if (h.trail.length > 32) h.trail.splice(0, 2);
      }
    };

    // A neon pink glow with a pulsing ring and a short trail, larger the more it carries;
    // a dying one shrinks into the body that caught it with a flash
    const drawHunters = (time) => {
      const hunters = huntersRef.current;
      ctx.globalCompositeOperation = 'lighter';
      for (let n = 0; n < hunters.length; n++) {
        const h = hunters[n];
        if (!h.alive && h.dying <= 0) continue;
        const scale = h.alive ? 1 : h.dying / HUNTER_DEATH_FRAMES;
        const r = (8 + h.caught * 0.12) * scale;
        if (h.alive && h.trail.length > 3) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255, 60, 220, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(h.trail[0], h.trail[1]);
          for (let i = 2; i < h.trail.length; i += 2) ctx.lineTo(h.trail[i], h.trail[i + 1]);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.drawImage(getSprite('#ff2bd6', '#fff0fb'), h.x - r * 2, h.y - r * 2, r * 4, r * 4);
        ctx.strokeStyle = `rgba(255, 90, 230, ${0.5 * scale})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, r * 1.4 * (1 + Math.sin(time * 6) * 0.1), 0, Math.PI * 2);
        ctx.stroke();
        if (!h.alive) {
          ctx.strokeStyle = `rgba(255, 120, 235, ${scale})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(h.x, h.y, (1 - scale) * 70, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    // Whether a point is hidden behind a planet: over its disc, on the far side of its
    // ring plane
    const behindPlanet = (x, y) => {
      for (let i = 0; i < planets.length; i++) {
        const b = planets[i];
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy < b.sphere * b.sphere && dy * b.tiltCos - dx * b.tiltSin < 0) return true;
      }
      return false;
    };

    // The lighter body joins the heavier one, keeping their momentum. The merge flashes
    // and sends a small ripple through the particles nearby.
    const mergeBodies = (a, b) => {
      const big = a.mass >= b.mass ? a : b;
      const small = big === a ? b : a;
      const total = a.mass + b.mass;
      const vx = (a.vx * a.mass + b.vx * b.mass) / total;
      const vy = (a.vy * a.mass + b.vy * b.mass) / total;
      big.x = (a.x * a.mass + b.x * b.mass) / total;
      big.y = (a.y * a.mass + b.y * b.mass) / total;
      big.mass = Math.min(MAX_BODY_MASS, total);
      big.ring += small.ring;
      big.heading = Math.atan2(vy, vx);
      big.speed = Math.hypot(vx, vy);
      big.gx = 0;
      big.gy = 0;
      big.flash = 1;
      sizeBody(big);
      small.active = false;
      small.wait = 240 + Math.random() * 360;
      if (shockwavesEnabled) {
        shockwavesRef.current.push({
          x: big.x, y: big.y, radius: big.core, speed: 6, maxRadius: 260, intensity: 0.4,
          color: themeConfig.mouseLinkColor,
        });
      }
    };

    // A planet's end: a shockwave, and two or three new bodies flung out from where it was
    const burstPlanet = (b) => {
      const bodies = bodiesRef.current;
      const { x, y } = b;
      if (shockwavesEnabled) {
        shockwavesRef.current.push({
          x, y, radius: b.core, speed: 10, maxRadius: Math.max(canvas.width, canvas.height) * 0.7,
          intensity: 1.3, color: themeConfig.mouseLinkColor,
        });
      }
      const shards = [b, ...bodies.filter((o) => !o.active).slice(0, 2)];
      while (shards.length < 3 && bodies.length < bodyCfg.count + 2) {
        const extra = {};
        bodies.push(extra);
        shards.push(extra);
      }
      const start = Math.random() * Math.PI * 2;
      shards.forEach((s, i) => {
        spawnBody(s, true);
        s.x = x;
        s.y = y;
        s.heading = start + (i / shards.length) * Math.PI * 2;
        s.speed = 2.5 + Math.random();
        s.cruise = s.speed;
        s.flash = 1;
        s.calm = 600; // the shards fly apart before they feel each other's pull again
      });
    };

    // Gravity bodies wander with smooth random turns and changes of speed (a slow drift
    // one moment, a plunge the next), and pull on each other. Two that meet merge, and a
    // merged body absorbs particles and grows into a ringed planet, which slows, keeps
    // to the screen, and in time collapses and bursts back into bodies. A body well off
    // screen rests a while, then plunges in again from another edge.
    const updateBodies = (time) => {
      const W = canvas.width;
      const H = canvas.height;
      const bodies = bodiesRef.current;

      // Mutual pull, weak enough that only close passes end in a merge, and capped for a
      // planet so it doesn't sweep up every body that comes on screen. Two bodies close
      // together nearly stop wandering, so they fall together instead of slinging apart.
      for (let i = 0; i < bodies.length; i++) bodies[i].near = false;
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (!a.active || a.calm > 0) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (!b.active || b.calm > 0) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 450 * 450) continue;
          const dist = Math.sqrt(distSq) || 1;
          if (dist < (a.core + b.core) * 0.9 && a.collapse <= 0 && b.collapse <= 0) {
            mergeBodies(a, b);
            if (!a.active) break;
            continue;
          }
          const f = (90 * gravityStrength) / (distSq + 3600);
          a.gx += (dx / dist) * f * Math.min(b.pull, 2.5);
          a.gy += (dy / dist) * f * Math.min(b.pull, 2.5);
          b.gx -= (dx / dist) * f * Math.min(a.pull, 2.5);
          b.gy -= (dy / dist) * f * Math.min(a.pull, 2.5);
          if (dist < 40 + (a.core + b.core) * 1.2) {
            a.near = true;
            b.near = true;
          }
        }
      }

      let activeCount = 0;
      for (let i = 0; i < bodies.length; i++) if (bodies[i].active) activeCount++;
      planets.length = 0;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b.active) {
          // Bodies left over from a burst wait until the count drops back
          if (--b.wait <= 0) {
            if (activeCount < bodyCfg.count) { spawnBody(b, false); activeCount++; }
            else b.wait = 120;
          }
          continue;
        }
        if (b.calm > 0) b.calm--;
        b.flash *= 0.96;

        // Growth eases toward what its mass makes it, so a merge doesn't snap it into a planet
        const target = Math.min(1, Math.max(0, (b.mass - PLANET_START) / (PLANET_FULL - PLANET_START)));
        b.growth += (target - b.growth) * 0.01;
        b.flat = 1 - 0.72 * b.growth;
        b.sphere = b.core * 0.9 * Math.sqrt(b.growth);
        // A full planet lives 40 to 80 seconds, then collapses and bursts
        if (b.growth > 0.97 && b.life === 0) b.life = 2400 + Math.random() * 2400;
        if (b.life > 0 && --b.life <= 0) { b.life = -1; b.collapse = COLLAPSE_FRAMES; }
        if (b.collapse > 0 && --b.collapse <= 0) { burstPlanet(b); continue; }

        b.turn += (Math.random() - 0.5) * 0.0016;
        b.turn *= 0.98;
        if (b.growth > 0.5) {
          // A planet turns back before it reaches the edge
          if (b.x < W * 0.15 || b.x > W * 0.85 || b.y < H * 0.15 || b.y > H * 0.85) {
            const home = Math.atan2(H / 2 - b.y, W / 2 - b.x) - b.heading;
            b.turn += Math.atan2(Math.sin(home), Math.cos(home)) * 0.002;
          }
        }
        b.heading += b.turn + Math.sin(time * 0.7 + b.phase) * 0.0025;
        if (Math.random() < 0.004) b.cruise = 0.35 + Math.random() * 2.6;
        // Heavier bodies drift slower
        const cruise = b.near ? 0.1 : b.cruise * (1 - 0.75 * b.growth);
        b.speed += (cruise - b.speed) * (b.near ? 0.05 : 0.02);
        const drag = b.near ? 0.97 : 0.99;
        b.gx *= drag;
        b.gy *= drag;
        b.vx = Math.cos(b.heading) * b.speed + b.gx;
        b.vy = Math.sin(b.heading) * b.speed + b.gy;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -BODY_MARGIN || b.x > W + BODY_MARGIN || b.y < -BODY_MARGIN || b.y > H + BODY_MARGIN) {
          b.active = false;
          b.wait = 90 + Math.random() * 420;
          continue;
        }
        if (b.growth > 0.4) planets.push(b);
      }
    };

    // A planet's rings: fine bands round it in its tilted ring plane, wider and brighter
    // the more particles it has absorbed. Drawn in two halves, the far one behind the
    // planet and the near one in front.
    const drawRings = (b, from, to) => {
      const fill = Math.min(1, b.ring / RING_FULL);
      const inner = b.core * 1.45;
      const outer = b.core * (1.7 + 1.3 * fill);
      ctx.lineWidth = 1.3;
      for (let i = 0; i < b.bands.length; i++) {
        const r = inner + (outer - inner) * (i / (b.bands.length - 1));
        ctx.strokeStyle = `rgba(150, 255, 170, ${b.growth * (0.05 + 0.25 * fill) * b.bands[i]})`;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, r, r * b.flat, b.tilt, from, to);
        ctx.stroke();
      }
    };

    // The planet: a sphere lit from the upper left, with cloud bands along its ring plane
    // and a thin glowing atmosphere
    const drawPlanet = (b) => {
      const R = b.sphere;
      const a = Math.min(1, b.growth * 1.5);
      ctx.globalCompositeOperation = 'source-over';
      const shade = ctx.createRadialGradient(b.x - R * 0.4, b.y - R * 0.45, R * 0.05, b.x, b.y, R);
      shade.addColorStop(0, `rgba(190, 255, 200, ${a})`);
      shade.addColorStop(0.3, `rgba(40, 170, 80, ${a})`);
      shade.addColorStop(0.75, `rgba(6, 60, 24, ${a})`);
      shade.addColorStop(1, `rgba(2, 20, 8, ${a})`);
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.fill();

      // Bands of latitude, seen from just above the ring plane: the near half of each
      // circle, raised toward the pole that tilts our way
      ctx.save();
      ctx.clip();
      const lift = Math.sqrt(1 - b.flat * b.flat);
      ctx.lineWidth = R * 0.1;
      const lats = [-0.55, -0.2, 0.2, 0.55];
      for (let i = 0; i < lats.length; i++) {
        const up = R * lats[i] * lift;
        const r = R * Math.sqrt(1 - lats[i] * lats[i]);
        ctx.strokeStyle = i % 2 ? `rgba(120, 255, 150, ${0.12 * a})` : `rgba(0, 25, 10, ${0.4 * a})`;
        ctx.beginPath();
        ctx.ellipse(b.x + b.tiltSin * up, b.y - b.tiltCos * up, r, r * b.flat, b.tilt, 0, Math.PI);
        ctx.stroke();
      }
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      const rim = ctx.createRadialGradient(b.x, b.y, R * 0.85, b.x, b.y, R * 1.3);
      rim.addColorStop(0, 'rgba(57, 255, 20, 0)');
      rim.addColorStop(0.3, `rgba(57, 255, 20, ${0.25 * a})`);
      rim.addColorStop(1, 'rgba(57, 255, 20, 0)');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R * 1.3, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBodies = (time) => {
      const bodies = bodiesRef.current;
      ctx.globalAlpha = 1;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b.active) continue;
        const pulse = 0.85 + Math.sin(time * b.pulseSpeed + b.phase) * 0.15;
        ctx.globalCompositeOperation = 'lighter';

        // Faint haze over its reach
        const haze = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 0.6);
        haze.addColorStop(0, `rgba(0, 255, 65, ${0.09 * pulse})`);
        haze.addColorStop(1, 'rgba(0, 255, 65, 0)');
        ctx.fillStyle = haze;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // The glowing orb, fading as a planet forms in its place, and brighter in a merge
        const glow = Math.min(1, 1 - b.growth * 0.85 + b.flash * 0.5);
        ctx.strokeStyle = `rgba(140, 255, 150, ${0.22 * pulse * glow})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.core * 3 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = glow;
        const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.core * 2.4);
        core.addColorStop(0, 'rgba(240, 255, 240, 0.95)');
        core.addColorStop(0.3, 'rgba(90, 255, 100, 0.8)');
        core.addColorStop(1, 'rgba(0, 255, 65, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.core * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (b.growth > 0.02) {
          drawRings(b, Math.PI, Math.PI * 2);
          drawPlanet(b);
          drawRings(b, 0, Math.PI);
        }

        // A merge or burst sends a ring out
        if (b.flash > 0.02) {
          ctx.strokeStyle = `rgba(200, 255, 210, ${b.flash * 0.6})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.core * (1.5 + (1 - b.flash) * 8), 0, Math.PI * 2);
          ctx.stroke();
        }

        // A collapsing planet swells with light until it bursts
        if (b.collapse > 0) {
          const doom = 1 - b.collapse / COLLAPSE_FRAMES;
          const r = Math.max(b.sphere, b.core) * (1.2 + doom * 1.5);
          const blaze = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          blaze.addColorStop(0, `rgba(230, 255, 230, ${doom * 0.9})`);
          blaze.addColorStop(0.4, `rgba(57, 255, 20, ${doom * 0.5})`);
          blaze.addColorStop(1, 'rgba(57, 255, 20, 0)');
          ctx.fillStyle = blaze;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    // Lead each school on a wandering path: random turns and speed changes, the odd
    // startled dart, a new pattern every so often, and a turn for home once it strays
    // past the edge
    const updateSchools = () => {
      const W = canvas.width;
      const H = canvas.height;
      const margin = 120;
      const schools = schoolsRef.current;
      for (let i = 0; i < schools.length; i++) {
        const s = schools[i];
        if (--s.shapeTimer <= 0) {
          s.shape = SCHOOL_SHAPES[Math.floor(Math.random() * SCHOOL_SHAPES.length)];
          s.shapeTimer = 360 + Math.random() * 720;
          s.spin = Math.random() < 0.5 ? -1 : 1;
        }
        s.turn += (Math.random() - 0.5) * 0.004;
        s.turn *= 0.96;
        if (s.dart <= 0 && Math.random() < 0.0025) {
          s.dart = 40 + Math.random() * 40;
          s.turn += (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.04);
        }
        if (s.x < -margin || s.x > W + margin || s.y < -margin || s.y > H + margin) {
          const home = Math.atan2(H / 2 - s.y, W / 2 - s.x) - s.heading;
          s.turn += Math.atan2(Math.sin(home), Math.cos(home)) * 0.002;
        }
        s.heading += s.turn;
        if (Math.random() < 0.006) s.cruise = 0.6 + Math.random() * 1.4;
        const cruise = s.shape === 'ball' ? s.cruise * 0.35 : s.cruise;
        s.speed += ((s.dart > 0 ? cruise * 2.4 : cruise) - s.speed) * 0.05;
        if (s.dart > 0) s.dart--;

        // Passing gravity bodies bend the whole school's path
        if (bodyCfg) pullTowardBodies(s, 0.12, false);
        s.vx *= 0.97;
        s.vy *= 0.97;
        s.mx = Math.cos(s.heading) * s.speed * flowSpeedMult + s.vx;
        s.my = Math.sin(s.heading) * s.speed * flowSpeedMult + s.vy;
        s.x += s.mx;
        s.y += s.my;
      }
    };

    // One soft glow per colour (with a white-hot centre, `core`), drawn once and stamped
    // for every fish
    const getSprite = (color, core = '#f0fff0') => {
      const key = color + core;
      let sprite = spritesRef.current.get(key);
      if (!sprite) {
        sprite = document.createElement('canvas');
        sprite.width = 32;
        sprite.height = 32;
        const g = sprite.getContext('2d');
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, core);
        grad.addColorStop(0.2, color);
        grad.addColorStop(0.5, `${color}40`);
        grad.addColorStop(1, `${color}00`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
        spritesRef.current.set(key, sprite);
      }
      return sprite;
    };

    // Each fish steers toward its place in its school's shape and matches the school's
    // velocity, so a turn ripples back through the school, and a shockwave scatters it
    // until it regroups
    const swimSchools = (fish, mouse, time) => {
      const schools = schoolsRef.current;
      const hunters = huntersRef.current;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let i = 0; i < fish.length; i++) {
        const p = fish[i];
        if (p.caughtBy) {
          // Carried by a hunter: it circles the hunter, tinted pink
          const h = p.caughtBy;
          p.orbitA += p.orbitS;
          p.x = h.x + Math.cos(p.orbitA) * p.orbitR;
          p.y = h.y + Math.sin(p.orbitA) * p.orbitR;
          const r = p.size * 3;
          ctx.globalAlpha = 0.85;
          ctx.drawImage(getSprite('#ff4fd8', '#fff0fb'), p.x - r, p.y - r, r * 2, r * 2);
          continue;
        }
        const s = schools[p.school];
        const c = Math.cos(s.heading);
        const sn = Math.sin(s.heading);
        let tx;
        let ty;
        if (s.shape === 'ball') {
          // A bait ball circling the school's centre
          const a = p.u * Math.PI * 2 + time * (0.5 + p.v * 0.7) * s.spin;
          const r = s.length * 0.55 * (0.3 + 0.7 * Math.sqrt(p.v));
          tx = s.x + Math.cos(a) * r;
          ty = s.y + Math.sin(a) * r;
        } else {
          let along;
          let across;
          if (s.shape === 'ribbon') {
            // A long stream with a wave running down it
            along = -p.u * s.length * 2.6;
            across = Math.sin(p.u * 7 - time * 2.2) * s.length * 0.22 + (p.v - 0.5) * 8;
          } else {
            // A shoal: a teardrop trailing behind the lead fish
            along = -Math.pow(p.u, 0.8) * s.length;
            across = (p.v - 0.5) * s.length * 0.9 * (1 - p.u * 0.55);
          }
          tx = s.x + c * along - sn * across;
          ty = s.y + sn * along + c * across;
        }

        let ax = (tx - p.x) * 0.008 + (s.mx - p.vx) * 0.1;
        let ay = (ty - p.y) * 0.008 + (s.my - p.vy) * 0.1;
        const beat = Math.sin(time * p.wobbleSpeed + p.wobblePhase) * 0.04;
        ax -= sn * beat;
        ay += c * beat;
        const accel = Math.hypot(ax, ay);
        if (accel > 0.35) { ax *= 0.35 / accel; ay *= 0.35 / accel; }
        p.vx += ax;
        p.vy += ay;

        // A fish that sees a hunter close by darts away from it
        for (let n = 0; n < hunters.length; n++) {
          const h = hunters[n];
          if (!h.alive) continue;
          const dx = p.x - h.x;
          const dy = p.y - h.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 90 * 90 || distSq < 0.01) continue;
          const dist = Math.sqrt(distSq);
          p.vx += (dx / dist) * (1 - dist / 90) * 0.3;
          p.vy += (dy / dist) * (1 - dist / 90) * 0.3;
        }

        applyGravityLaws(p, mouse, time, true);

        const vMax = 2.2 + s.speed * 2.2;
        const v = Math.hypot(p.vx, p.vy);
        if (v > vMax) { p.vx *= vMax / v; p.vy *= vMax / v; }
        p.x += p.vx;
        p.y += p.vy;

        // Now and then a fish changes places, so the school churns
        if (Math.random() < 0.002) p.u = Math.random();

        p.opacity += p.opacityDir * p.pulseSpeed;
        if (p.opacity > 0.9) { p.opacity = 0.9; p.opacityDir = -1; }
        if (p.opacity < 0.35) { p.opacity = 0.35; p.opacityDir = 1; }
        if (planets.length && behindPlanet(p.x, p.y)) continue;

        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);

        const r = p.size * 4;
        ctx.globalAlpha = p.opacity;
        ctx.drawImage(getSprite(p.color), p.x - r, p.y - r, r * 2, r * 2);
      }
      // Every tail in one stroke
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    };

    // Update wandering attractors
    // ============================================
    // CYBER STORM: CLOUDS, LIGHTNING AND FLOCKS
    // ============================================

    // One channel of a lightning bolt, jagged by midpoint displacement, with forks that are
    // thinner and dimmer channels of their own
    const bolt = (out, x0, y0, x1, y1, rough, depth, width, bright) => {
      let pts = [x0, y0, x1, y1];
      let disp = Math.hypot(x1 - x0, y1 - y0) * rough;
      for (let k = 0; k < 6; k++) {
        const next = [pts[0], pts[1]];
        for (let i = 2; i < pts.length; i += 2) {
          const ax = pts[i - 2];
          const ay = pts[i - 1];
          const bx = pts[i];
          const by = pts[i + 1];
          const l = Math.hypot(bx - ax, by - ay) || 1;
          const off = (Math.random() - 0.5) * disp;
          next.push((ax + bx) / 2 - ((by - ay) / l) * off, (ay + by) / 2 + ((bx - ax) / l) * off, bx, by);
        }
        pts = next;
        disp *= 0.5;
      }
      const path = new Path2D();
      path.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
      out.push({ pts, path, width, bright });
      if (depth <= 0) return;
      const n = pts.length / 2;
      const forks = 1 + Math.floor(Math.random() * 3);
      for (let f = 0; f < forks; f++) {
        const i = Math.floor(n * (0.15 + Math.random() * 0.6));
        const ax = pts[i * 2];
        const ay = pts[i * 2 + 1];
        const dir = Math.atan2(y1 - ay, x1 - ax) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6);
        const len = Math.hypot(x1 - ax, y1 - ay) * (0.25 + Math.random() * 0.35);
        bolt(out, ax, ay, ax + Math.cos(dir) * len, ay + Math.sin(dir) * len, rough * 1.1, depth - 1, width * 0.55, bright * 0.6);
      }
    };

    const startGlitch = (c, frames) => {
      c.glitch = Math.round(frames);
      c.cuts = Array.from({ length: 6 }, () => (Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 26));
    };

    // A strike lights the clouds around where it starts (and, for one crawling between
    // clouds, where it ends), and washes the sky faintly in its colour
    const lightUp = (s, amount) => {
      const st = stormRef.current;
      st.lastFlash = st.frame;
      st.sky = Math.max(st.sky, amount);
      st.skyHue = s.hue;
      const ends = s.kind === 'crawl' ? [[s.x0, s.y0], [s.x1, s.y1]] : [[s.x0, s.y0]];
      for (const c of st.clouds) {
        for (const [ex, ey] of ends) {
          const d = Math.hypot(c.x + c.w / 2 - ex, c.y + c.h / 2 - ey);
          const near = Math.max(0, 1 - d / (c.w * 0.5 + 360));
          const a = amount * near * (c.layer === s.layer ? 1 : 0.7);
          if (a > c.light) {
            c.light = a;
            c.lx = ex - c.x;
            c.ly = ey - c.y;
            c.hue = s.hue;
          }
        }
      }
    };

    // A strike leaves a cloud on screen, nearer layers likelier: down through the sky below,
    // crawling across to a neighbouring cloud, or arcing inside its own cloud
    const fireStrike = () => {
      const st = stormRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const onScreen = st.clouds.filter((c) => c.x + c.w * 0.5 > 0 && c.x + c.w * 0.5 < W);
      if (!onScreen.length) return;
      const weighted = onScreen.flatMap((c) => Array(c.layer + 1).fill(c));
      const src = weighted[Math.floor(Math.random() * weighted.length)];
      const x0 = src.x + src.w * (0.25 + Math.random() * 0.5);
      const y0 = src.y + src.h * (0.45 + Math.random() * 0.25);
      const roll = Math.random();
      const neighbours = onScreen.filter((c) => c !== src && Math.abs(c.layer - src.layer) <= 1
        && Math.abs(c.x + c.w / 2 - x0) < 750);
      let kind = 'arc';
      let x1 = x0 + (Math.random() < 0.5 ? -1 : 1) * src.w * (0.2 + Math.random() * 0.25);
      let y1 = y0 + (Math.random() - 0.5) * src.h * 0.3;
      if (roll < 0.45) {
        kind = 'down';
        x1 = x0 + (Math.random() - 0.5) * W * 0.25;
        y1 = y0 + H * (0.3 + Math.random() * 0.45);
      } else if (roll < 0.85 && neighbours.length) {
        kind = 'crawl';
        const t = neighbours[Math.floor(Math.random() * neighbours.length)];
        x1 = t.x + t.w * (0.2 + Math.random() * 0.6);
        y1 = t.y + t.h * (0.4 + Math.random() * 0.3);
      }
      const segs = [];
      bolt(segs, x0, y0, x1, y1, kind === 'down' ? 0.28 : 0.2, kind === 'arc' ? 1 : 2, kind === 'down' ? 2.7 : 1.9, 1);
      const restroke = 21 + Math.floor(Math.random() * 8);
      const s = {
        kind, layer: src.layer, segs, x0, y0, x1, y1,
        hue: STRIKE_HUES[Math.floor(Math.random() * STRIKE_HUES.length)],
        age: 0,
        lead: 4, // frames the bolt takes to reach its full length
        restroke, // when it strikes again down the same channel
        life: restroke + 14,
      };
      st.strikes.push(s);
      if (st.frame - st.lastFlash >= FLASH_GAP) lightUp(s, 1);
      if (!reduceMotion) startGlitch(src, 8);
      if (kind === 'down' && shockwavesEnabled) {
        shockwavesRef.current.push({
          x: x1,
          y: y1,
          radius: 6,
          speed: 7,
          maxRadius: 220,
          intensity: 0.6,
          color: hueRgb(s.hue),
        });
      }
    };

    // Brightness of a strike's bolt this frame: full while it reaches out, then fading with a
    // fast flicker, then the second stroke. Bolts are thin, so the flicker is no big flash.
    const strikeIntensity = (s) => {
      if (s.age < s.lead) return 1;
      let i = Math.exp(-(s.age - s.lead) / 7);
      if (s.age >= s.restroke) i = Math.max(i, Math.exp(-(s.age - s.restroke) / 5) * 0.9);
      return i * (s.age % 4 < 2 ? 1 : 0.55);
    };

    const updateStorm = () => {
      const st = stormRef.current;
      const W = canvas.width;
      st.frame++;
      for (const c of st.clouds) {
        c.x -= CLOUD_LAYERS[c.layer].wind;
        if (c.x + c.w < -40) {
          c.x = W + 40 + Math.random() * 240;
          placeCloud(c);
        }
        c.light *= 0.92;
        c.hue = (c.hue + 6) % 360; // the light shifts colour as it fades
        if (c.glitch > 0) {
          c.glitch--;
          if (c.glitch % 3 === 0) startGlitch(c, c.glitch);
        } else if (!reduceMotion && Math.random() < 0.0004) {
          startGlitch(c, 6 + Math.random() * 6);
        }
      }
      st.sky *= 0.9;
      st.skyHue = (st.skyHue + 6) % 360;
      for (let i = st.strikes.length - 1; i >= 0; i--) {
        const s = st.strikes[i];
        s.age++;
        if (s.age === s.restroke && st.frame - st.lastFlash >= FLASH_GAP) lightUp(s, 0.75);
        if (s.age > s.life) st.strikes.splice(i, 1);
      }
      if (--st.next <= 0) {
        fireStrike();
        const [lo, hi] = stormCfg.strikeEvery;
        // Now and then a second strike follows close behind
        st.next = Math.random() < 0.2 ? FLASH_GAP + 4 + Math.random() * 16 : lo + Math.random() * (hi - lo);
      }
    };

    // A dark sky with a magenta haze rising from below, like a city's glow
    const drawSky = () => {
      const st = stormRef.current;
      const H = canvas.height;
      if (!st.skyGrad || st.skyGradH !== H) {
        st.skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        st.skyGrad.addColorStop(0, 'rgba(8, 10, 30, 0.9)');
        st.skyGrad.addColorStop(0.55, 'rgba(14, 10, 40, 0.5)');
        st.skyGrad.addColorStop(1, 'rgba(80, 16, 85, 0.24)');
        st.skyGradH = H;
      }
      ctx.fillStyle = st.skyGrad;
      ctx.fillRect(0, 0, canvas.width, H);
    };

    // Tints a cloud's mask with the light's colour, brightest where the strike is, and adds
    // it over the cloud
    const lightCloud = (c, y, L) => {
      const st = stormRef.current;
      const g = st.scratchCtx;
      const mw = c.mask.width;
      const mh = c.mask.height;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, mw, mh);
      g.drawImage(c.mask, 0, 0);
      g.globalCompositeOperation = 'source-in';
      const gx = c.lx / 4;
      const gy = c.ly / 4;
      const grad = g.createRadialGradient(gx, gy, 0, gx, gy, mw * 0.75);
      grad.addColorStop(0, `hsla(${c.hue}, 100%, 88%, 1)`);
      grad.addColorStop(0.3, `hsla(${c.hue}, 100%, 62%, 0.75)`);
      grad.addColorStop(1, `hsla(${c.hue}, 100%, 50%, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, mw, mh);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = c.light * (reduceMotion ? 0.35 : 0.9) * L.alpha;
      ctx.drawImage(st.scratch, 0, 0, mw, mh, c.x, y, c.w, c.h);
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawCloudLayer = (li, time) => {
      const st = stormRef.current;
      const L = CLOUD_LAYERS[li];
      const W = canvas.width;
      for (const c of st.clouds) {
        if (c.layer !== li || c.x > W || c.x + c.w < 0) continue;
        const y = c.y + Math.sin(time * 0.3 + c.bob) * 4 * L.scale;
        ctx.globalAlpha = L.alpha;
        if (c.glitch > 0) {
          // Sliced into strips, some knocked sideways
          const sh = c.h / c.cuts.length;
          const ss = c.sprite.height / c.cuts.length;
          for (let k = 0; k < c.cuts.length; k++) {
            ctx.drawImage(c.sprite, 0, k * ss, c.sprite.width, ss, c.x + c.cuts[k], y + k * sh, c.w, sh);
          }
        } else {
          ctx.drawImage(c.sprite, c.x, y, c.w, c.h);
        }
        if (c.light > 0.02) lightCloud(c, y, L);
      }
      ctx.globalAlpha = 1;
    };

    // The bolt glows in the strike's (shifting) colour around a core split into red, green
    // and blue copies a pixel or two apart, which add up to white where they overlap
    const drawBolt = (s) => {
      const I = strikeIntensity(s);
      if (I < 0.02) return;
      const hue = s.hue + s.age * 6;
      const reveal = s.age < s.lead ? (s.age + 1) / s.lead : 1;
      const split = 1.2 + Math.random() * 1.6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const seg of s.segs) {
        let path = seg.path;
        if (reveal < 1) {
          path = new Path2D();
          const n = Math.max(2, Math.ceil((seg.pts.length / 2) * reveal));
          path.moveTo(seg.pts[0], seg.pts[1]);
          for (let i = 1; i < n; i++) path.lineTo(seg.pts[i * 2], seg.pts[i * 2 + 1]);
        }
        const a = I * seg.bright;
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${a * 0.12})`;
        ctx.lineWidth = seg.width * 9;
        ctx.stroke(path);
        ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${a * 0.3})`;
        ctx.lineWidth = seg.width * 3.5;
        ctx.stroke(path);
        ctx.lineWidth = seg.width;
        ctx.translate(split, 0);
        ctx.strokeStyle = `rgba(255, 30, 60, ${a * 0.9})`;
        ctx.stroke(path);
        ctx.translate(-split, 0);
        ctx.strokeStyle = `rgba(30, 255, 110, ${a * 0.9})`;
        ctx.stroke(path);
        ctx.translate(-split, 0);
        ctx.strokeStyle = `rgba(40, 90, 255, ${a * 0.9})`;
        ctx.stroke(path);
        ctx.translate(split, 0);
        ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.8})`;
        ctx.lineWidth = seg.width * 0.45;
        ctx.stroke(path);
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    // Boids: each bird keeps clear of its closest neighbours, matches their heading and
    // drifts toward their middle, while the flock heads for its target. Strikes and the
    // cursor scatter them, and they flap faster while they flee.
    const updateFlocks = (time) => {
      const H = canvas.height;
      const mouse = mouseRef.current;
      const strikes = stormRef.current ? stormRef.current.strikes : [];
      for (const fl of flocksRef.current) {
        const birds = fl.birds;
        let cx = 0;
        let cy = 0;
        for (const b of birds) { cx += b.x; cy += b.y; }
        cx /= birds.length;
        cy /= birds.length;
        if (--fl.retarget <= 0 || Math.hypot(fl.tx - cx, fl.ty - cy) < 90) retargetFlock(fl);
        // The flock slowly tightens and loosens, so its shape keeps changing
        const tight = 0.6 + 0.6 * Math.sin(time * 0.25 + fl.phase);
        for (const b of birds) {
          let n = 0;
          let avx = 0;
          let avy = 0;
          let px = 0;
          let py = 0;
          let sx = 0;
          let sy = 0;
          for (const o of birds) {
            if (o === b) continue;
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 4900) continue;
            n++;
            avx += o.vx;
            avy += o.vy;
            px += o.x;
            py += o.y;
            if (d2 < 625) {
              sx -= dx / (d2 + 1);
              sy -= dy / (d2 + 1);
            }
          }
          let ax = sx * 2.2;
          let ay = sy * 2.2;
          if (n) {
            ax += (avx / n - b.vx) * 0.04 + (px / n - b.x) * 0.0015 * tight;
            ay += (avy / n - b.vy) * 0.04 + (py / n - b.y) * 0.0015 * tight;
          }
          const tdx = fl.tx - b.x;
          const tdy = fl.ty - b.y;
          const td = Math.hypot(tdx, tdy) || 1;
          ax += (tdx / td) * 0.025;
          ay += (tdy / td) * 0.025;
          if (b.y < H * 0.05) ay += 0.05;
          else if (b.y > H * 0.8) ay -= 0.05;
          for (const s of strikes) {
            if (s.age > 30) continue;
            for (const [ex, ey] of [[s.x0, s.y0], [s.x1, s.y1], [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2]]) {
              const dx = b.x - ex;
              const dy = b.y - ey;
              const d = Math.hypot(dx, dy) || 1;
              if (d < STRIKE_SCARE) {
                const k = (1 - d / STRIKE_SCARE) * 0.5;
                ax += (dx / d) * k;
                ay += (dy / d) * k;
                b.scared = 50;
              }
            }
          }
          const mdx = b.x - mouse.x;
          const mdy = b.y - mouse.y;
          const md = Math.hypot(mdx, mdy) || 1;
          if (md < 120) {
            const k = (1 - md / 120) * 0.4;
            ax += (mdx / md) * k;
            ay += (mdy / md) * k;
            b.scared = Math.max(b.scared, 20);
          }
          b.vx += ax;
          b.vy += ay;
          const speed = Math.hypot(b.vx, b.vy) || 1;
          const max = (b.scared > 0 ? 4.4 : 2.7) * fl.depth;
          const min = 1.3 * fl.depth;
          if (speed > max) { b.vx *= max / speed; b.vy *= max / speed; }
          else if (speed < min) { b.vx *= min / speed; b.vy *= min / speed; }
          b.x += b.vx;
          b.y += b.vy;
          if (b.scared > 0) b.scared--;
          // Wings flap, or now and then hold still in a glide
          if (b.glide > 0) {
            b.glide--;
          } else {
            b.phase += b.flapSpeed * (b.scared > 0 ? 1.7 : 1);
            if (b.scared === 0 && Math.random() < 0.004) b.glide = 40 + Math.random() * 60;
          }
        }
      }
    };

    // Birds as flapping gull-wing strokes, tilted with their climb or dive: a dark silhouette
    // under a thin neon rim, so they show against both the dark sky and lit clouds
    const drawFlock = (fl) => {
      ctx.beginPath();
      for (const b of fl.birds) {
        const span = (5 + b.size * 3) * fl.depth;
        const f = b.glide > 0 ? 0.3 : Math.sin(b.phase);
        const tipY = -f * span * 0.6;
        const midY = span * 0.2 - f * span * 0.1;
        const tilt = Math.atan2(b.vy, Math.abs(b.vx)) * 0.5 * (b.vx >= 0 ? 1 : -1);
        const c = Math.cos(tilt);
        const s = Math.sin(tilt);
        const X = (px, py) => b.x + px * c - py * s;
        const Y = (px, py) => b.y + px * s + py * c;
        ctx.moveTo(X(-span, tipY), Y(-span, tipY));
        ctx.quadraticCurveTo(X(-span * 0.45, midY), Y(-span * 0.45, midY), b.x, b.y);
        ctx.quadraticCurveTo(X(span * 0.45, midY), Y(span * 0.45, midY), X(span, tipY), Y(span, tipY));
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#04050c';
      ctx.lineWidth = 2.8 * fl.depth;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(${fl.rim}, 0.55)`;
      ctx.lineWidth = 1.1 * fl.depth;
      ctx.stroke();
    };

    const drawStorm = (time) => {
      const st = stormRef.current;
      drawSky();
      for (let li = 0; li < CLOUD_LAYERS.length; li++) {
        drawCloudLayer(li, time);
        for (const s of st.strikes) if (s.layer === li) drawBolt(s);
        if (flockCfg) for (const fl of flocksRef.current) if (fl.layer === li) drawFlock(fl);
      }
      if (st.sky > 0.01 && !reduceMotion) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `hsla(${st.skyHue}, 100%, 55%, ${st.sky * 0.06})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
    };

    const updateAttractors = () => {
      const arr = attractorsRef.current;
      for (let a = 0; a < arr.length; a++) {
        const att = arr[a];
        att.lifetime++;
        if (att.lifetime > att.maxLife) {
          att.lifetime = 0;
          att.maxLife = 200 + Math.random() * 400;
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.8 + Math.random() * 2.2;
          att.vx = Math.cos(angle) * spd;
          att.vy = Math.sin(angle) * spd;
        }

        att.vx += (Math.random() - 0.5) * 0.06;
        att.vy += (Math.random() - 0.5) * 0.06;
        att.x += att.vx;
        att.y += att.vy;

        if (att.x < -60) att.x = canvas.width + 60;
        if (att.x > canvas.width + 60) att.x = -60;
        if (att.y < -60) att.y = canvas.height + 60;
        if (att.y > canvas.height + 60) att.y = -60;
      }
    };

    // One frame of the simulation, drawn. `time` is the simulation clock in seconds, and
    // `veil` dims the frame while windows are open over it (see backgroundPacing).
    const step = (time, veil) => {
      const currentTheme = getThemeConfig();
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = currentTheme.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render Aurora ribbons if theme active
      if (currentTheme.auroraWaves) {
        const colors = ['#22d3ee', '#a855f7', '#4ade80', '#f472b6'];
        for (let w = 0; w < 4; w++) {
          const yOffset = 110 + w * 85;
          ctx.globalAlpha = 0.28;
          const grad = ctx.createLinearGradient(0, yOffset - 50, 0, yOffset + 50);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.5, `${colors[w % colors.length]}45`);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          for (let x = 0; x <= canvas.width; x += 12) {
            const y = yOffset +
              Math.sin(x * 0.003 + time * 0.5 + w) * 32 +
              Math.sin(x * 0.007 + time * 0.35 + w * 2) * 18;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.lineTo(canvas.width, canvas.height);
          ctx.lineTo(0, canvas.height);
          ctx.fill();
        }
      }

      // Render Aurora Stars
      if (currentTheme.hasStars) {
        const stars = starsRef.current;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const twinkle = Math.sin(time * s.twinkleSpeed * 90 + s.twinklePhase);
          ctx.globalAlpha = Math.max(0.1, s.opacity * (0.65 + twinkle * 0.35));
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (stormCfg) {
        updateStorm();
        if (flockCfg) updateFlocks(time);
        drawStorm(time);
      }

      // Render Stormy Rain (or a slanted drizzle, lit by lightning) with interactive cursor wind deflection
      if (currentTheme.hasRain || currentTheme.drizzle) {
        const rain = rainRef.current;
        const slant = currentTheme.rainSlant || 0;
        const rainLight = currentTheme.drizzle ? 0.6 * (1 + (stormRef.current?.sky || 0) * 1.5) : 1;
        ctx.strokeStyle = `rgba(${currentTheme.rainColor || '148, 163, 184'}, 0.45)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < rain.length; i++) {
          const r = rain[i];
          r.y += r.speed;
          r.x += r.speed * slant;
          if (r.x < -40) r.x += canvas.width + 80;
          else if (r.x > canvas.width + 40) r.x -= canvas.width + 80;

          // Wind deflection near mouse
          const rdx = r.x - mouse.x;
          const rdy = r.y - mouse.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
          if (rdist < 140) {
            r.x += (rdx / rdist) * 2.5;
          }

          if (r.y > canvas.height) {
            r.y = -r.length;
            r.x = Math.random() * canvas.width;
          }

          ctx.globalAlpha = Math.min(1, r.opacity * rainLight);
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + r.length * slant + Math.sin(time + i) * 1.5, r.y + r.length);
          ctx.stroke();
        }
      }

      // Render Blaze Embers with interactive vortex
      if (currentTheme.heatDistortion) {
        const sparks = sparksRef.current;
        for (let i = 0; i < sparks.length; i++) {
          const s = sparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life -= s.decay;

          // Pull sparks toward cursor vortex
          const sdx = mouse.x - s.x;
          const sdy = mouse.y - s.y;
          const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sdist < 180 && sdist > 1) {
            s.vx += (sdx / sdist) * 0.18;
            s.vy += (sdy / sdist) * 0.18;
          }

          if (s.life <= 0) {
            s.x = Math.random() * canvas.width;
            s.y = canvas.height + Math.random() * 50;
            s.vx = (Math.random() - 0.5) * 2;
            s.vy = -(Math.random() * 3.5 + 2);
            s.life = 1;
          }

          ctx.globalAlpha = s.life * 0.85;
          ctx.fillStyle = '#fbbf24';
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#f97316';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      if (bodyCfg) {
        updateBodies(time);
        drawBodies(time);
      } else {
        updateAttractors();
      }
      if (schoolCfg) updateSchools();
      if (serpentCfg) updateSerpents(time);
      if (hunterCfg) updateHunters();

      // Render shockwave pulses
      const shockwaves = shockwavesRef.current;
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += sw.speed;
        sw.intensity *= 0.955;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${sw.color}, ${sw.intensity * 0.75})`;
        ctx.lineWidth = Math.max(1, sw.intensity * 4);
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(${sw.color}, 0.8)`;
        ctx.stroke();
        ctx.restore();

        if (sw.radius > sw.maxRadius || sw.intensity < 0.02) {
          shockwaves.splice(s, 1);
        }
      }

      // Update & render Micro Dust Particles (or the schools of fish)
      const micros = microRef.current;
      if (schoolCfg) {
        swimSchools(micros, mouse, time);
      } else {
        for (let i = 0; i < micros.length; i++) {
          const p = micros[i];

          applyGravityLaws(p, mouse, time, true);

          p.opacity += p.opacityDir * p.pulseSpeed;
          if (p.opacity > 0.55) { p.opacity = 0.55; p.opacityDir = -1; }
          if (p.opacity < 0.12) { p.opacity = 0.12; p.opacityDir = 1; }

          p.driftAngle += 0.004;
          p.vx += Math.cos(p.driftAngle) * p.driftSpeed * 0.008;
          p.vy += Math.sin(p.driftAngle) * p.driftSpeed * 0.008;

          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.988;
          p.vy *= 0.988;

          // Wrap
          if (p.x < 0) p.x = canvas.width;
          else if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          else if (p.y > canvas.height) p.y = 0;

          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Update & render Main Particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        applyGravityLaws(p, mouse, time, false);

        p.opacity += p.opacityDir * 0.004;
        if (p.opacity > 0.85) { p.opacity = 0.85; p.opacityDir = -1; }
        if (p.opacity < 0.25) { p.opacity = 0.25; p.opacityDir = 1; }

        p.driftAngle += 0.006;
        p.vx += Math.cos(p.driftAngle) * p.driftSpeed * 0.01;
        p.vy += Math.sin(p.driftAngle) * p.driftSpeed * 0.01 + (p.fallBias || 0);

        if (currentTheme.current) {
          // Large eddies that slide across the screen. The field has no sources or sinks,
          // so particles keep circulating instead of pooling in one spot.
          const A = p.x * 0.004 + time * 0.13;
          const B = p.y * 0.004 - time * 0.09;
          p.vx -= Math.sin(A) * Math.sin(B) * currentTheme.current;
          p.vy -= Math.cos(A) * Math.cos(B) * currentTheme.current;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.vy *= 0.99;

        if (bodyCfg) {
          // A slingshot past a gravity body can't fling a particle across the screen in a frame
          const speed = Math.hypot(p.vx, p.vy);
          if (speed > 9) { p.vx *= 9 / speed; p.vy *= 9 / speed; }
        }

        if (currentTheme.reappear) {
          // Free to be carried off screen; it then fades back in at a random spot
          const m = 60;
          if (p.x < -m || p.x > canvas.width + m || p.y < -m || p.y > canvas.height + m) {
            p.x = Math.random() * canvas.width;
            p.y = Math.random() * canvas.height;
            p.vx = 0;
            p.vy = 0;
            p.fade = 0;
          }
          if (p.fade < 1) p.fade = Math.min(1, p.fade + 0.01);
          if (p.ringed > 0) p.ringed--;
          p.hidden = planets.length > 0 && behindPlanet(p.x, p.y);
          if (p.hidden) continue;
        } else {
          // Elastic screen boundaries bounce
          if (p.x < 0) { p.vx = Math.abs(p.vx) * 0.85; p.x = 1; }
          else if (p.x > canvas.width) { p.vx = -Math.abs(p.vx) * 0.85; p.x = canvas.width - 1; }
          if (p.y < 0) { p.vy = Math.abs(p.vy) * 0.85; p.y = 1; }
          else if (p.y > canvas.height) { p.vy = -Math.abs(p.vy) * 0.85; p.y = canvas.height - 1; }
        }

        let pColor = p.color;
        if (enableColorCycling) {
          const cycleProgress = (Math.sin(time * p.colorSpeed + p.colorPhase) + 1) / 2;
          const cIndex = Math.floor(cycleProgress * currentTheme.colors.length);
          pColor = currentTheme.colors[cIndex];
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = pColor;
        ctx.globalAlpha = p.opacity * (p.fade ?? 1);
        ctx.fill();

        const glowMult = currentTheme.glowIntensity || 1;
        ctx.shadowBlur = 14 * glowMult;
        ctx.shadowColor = pColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Constellation Links between particles
      const linkDistance = 140;
      if (enableLinks) {
        ctx.globalAlpha = 1;
        for (let i = 0; i < particles.length; i++) {
          if (particles[i].hidden || particles[i].ringed > 0) continue;
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            if (b.hidden || b.ringed > 0) continue;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < linkDistance) {
              const alpha = (1 - dist / linkDistance) * 0.22 * Math.min(a.fade ?? 1, b.fade ?? 1);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(${currentTheme.linkColor}, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      if (serpentCfg) drawSerpents();
      if (hunterCfg) drawHunters(time);

      // Mouse Gravitational Links & Aura on HOVER
      if (mouse.x > 0 && mouse.y > 0) {
        const mouseRange = mouse.down ? 280 : 220;

        // Draw radial gravity aura
        const aura = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, mouseRange * 0.7
        );
        aura.addColorStop(0, `rgba(${currentTheme.mouseLinkColor}, 0.18)`);
        aura.addColorStop(0.5, `rgba(${currentTheme.mouseLinkColor}, 0.05)`);
        aura.addColorStop(1, `rgba(${currentTheme.mouseLinkColor}, 0)`);

        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouseRange * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Connect lines from nearby particles to mouse cursor on HOVER
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < mouseRange) {
            const mAlpha = (1 - mdist / mouseRange) * (mouse.down ? 0.75 : 0.45);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(${currentTheme.mouseLinkColor}, ${mAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // Behind open windows, a veil of the background colour dims the frame
      if (veil > 0.005) {
        ctx.globalAlpha = veil;
        ctx.fillStyle = currentTheme.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    };

    const stopLoop = runPacedLoop(step, () => calmRef.current);

    return () => {
      stopLoop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [getThemeConfig, settings, gravityMode, gravityStrength, shockwavesEnabled]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
}

// ============================================
// MAIN COMPONENT EXPORT
// ============================================

export default function ParticleBackground({ theme = 'cosmic', windowsOpen = false }) {
  const {
    settings,
    graphicsLevel,
    gravityMode,
    gravityStrength,
    shockwavesEnabled,
    calmBehindWindows,
  } = useGraphics();
  const calm = calmBehindWindows && windowsOpen;

  // If theme is 'meshwater' or physics mode is 'mesh', route to spring mesh physics
  if (theme === 'meshwater' || gravityMode === GRAVITY_MODES.MESH) {
    return (
      <MeshWaterBackground
        theme={theme}
        gravityStrength={gravityStrength}
        calm={calm}
      />
    );
  }

  // If particles disabled, render static background
  if (!settings.particles.enabled) {
    return (
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: THEME_CONFIGS[theme]?.background || '#0a0a0f',
        }}
      />
    );
  }

  return (
    <ParticleBackgroundCanvas
      key={`${graphicsLevel}-${theme}-${gravityMode}`}
      theme={theme}
      settings={settings}
      gravityMode={gravityMode}
      gravityStrength={gravityStrength}
      shockwavesEnabled={shockwavesEnabled}
      calm={calm}
    />
  );
}
