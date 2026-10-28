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
 * - 8 Complete Themes:
 *   cosmic, blue-night, matrix, stormy, aurora, meshwater, blaze, light
 * - Micro dust luminescence, rain splash physics, heat convection embers, and matrix deflection
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useGraphics, GRAVITY_MODES } from '../contexts/GraphicsContext';
import MeshWaterBackground from './backgrounds/MeshWaterBackground';

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
    isMatrixRain: true,
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

// ============================================
// PARTICLE CANVAS WITH GRAVITY & PHYSICS ENGINE
// ============================================

function ParticleBackgroundCanvas({
  theme = 'cosmic',
  settings,
  gravityMode = GRAVITY_MODES.WELL,
  gravityStrength = 1.0,
  shockwavesEnabled = true,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const microRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0, down: false });
  const shockwavesRef = useRef([]);
  const attractorsRef = useRef([]);
  const rainRef = useRef([]);
  const starsRef = useRef([]);
  const sparksRef = useRef([]);
  const themeRef = useRef(theme);

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

    const particleCount = settings.particles.count;
    const microCount = settings.particles.microCount;
    const enableLinks = settings.particles.links;
    const enableColorCycling = settings.particles.colorCycling;

    const sizeMultiplier = themeConfig.particleSizeMultiplier || 1;
    const flowSpeedMult = themeConfig.flowSpeed || 1;

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
          fallBias: themeConfig.hasRain ? 2.5 : (theme === 'matrix' ? (Math.random() * 0.8 + 0.8) : 0),
        });
      }
    }

    // Initialize micro dust particles
    if (microRef.current.length !== microCount) {
      microRef.current = [];
      for (let i = 0; i < microCount; i++) {
        const colorGroup = i % microColors.length;
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
        });
      }
    }

    // Initialize stormy rain
    if (themeConfig.hasRain && rainRef.current.length === 0) {
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

      // 3. Wandering Celestial Massive Bodies
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

    // Update wandering attractors
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

    // Main animation loop
    const animate = () => {
      const currentTheme = getThemeConfig();
      const time = Date.now() * 0.001;
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

      // Render Stormy Rain with interactive cursor wind deflection
      if (currentTheme.hasRain) {
        const rain = rainRef.current;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        for (let i = 0; i < rain.length; i++) {
          const r = rain[i];
          r.y += r.speed;

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

          ctx.globalAlpha = r.opacity;
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + Math.sin(time + i) * 1.5, r.y + r.length);
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

      updateAttractors();

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

      // Update & render Micro Dust Particles
      const micros = microRef.current;
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

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Elastic screen boundaries bounce
        if (p.x < 0) { p.vx = Math.abs(p.vx) * 0.85; p.x = 1; }
        else if (p.x > canvas.width) { p.vx = -Math.abs(p.vx) * 0.85; p.x = canvas.width - 1; }
        if (p.y < 0) { p.vy = Math.abs(p.vy) * 0.85; p.y = 1; }
        else if (p.y > canvas.height) { p.vy = -Math.abs(p.vy) * 0.85; p.y = canvas.height - 1; }

        let pColor = p.color;
        if (enableColorCycling) {
          const cycleProgress = (Math.sin(time * p.colorSpeed + p.colorPhase) + 1) / 2;
          const cIndex = Math.floor(cycleProgress * currentTheme.colors.length);
          pColor = currentTheme.colors[cIndex];
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = pColor;
        ctx.globalAlpha = p.opacity;
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
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < linkDistance) {
              const alpha = (1 - dist / linkDistance) * 0.22;
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

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
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

export default function ParticleBackground({ theme = 'cosmic' }) {
  const {
    settings,
    graphicsLevel,
    gravityMode,
    gravityStrength,
    shockwavesEnabled,
  } = useGraphics();

  // If theme is 'meshwater' or physics mode is 'mesh', route to spring mesh physics
  if (theme === 'meshwater' || gravityMode === GRAVITY_MODES.MESH) {
    return (
      <MeshWaterBackground
        theme={theme}
        gravityStrength={gravityStrength}
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
    />
  );
}
