/**
 * Mesh Water Background with Spring Physics & Gravity Ripple Engine
 * 
 * Interactive grid-based mesh simulation with:
 * - 2D lattice spring tension & Hooke's law physics
 * - Laplacian wave propagation to 4 neighbor nodes
 * - Fluid velocity damping & kinetic impulse
 * - Mouse cursor light trace & interactive ripple distortion
 * - Radial shockwave propagation on click / tap
 * - Floating luminescence particles with orbital drift
 * - 8-Theme color synchronization
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { runPacedLoop } from './backgroundPacing';

export const MESH_THEME_PALETTES = {
  cosmic: {
    baseColor: '#0a0a0f',
    lineColor: '#00d9ff',
    glowColor: '#a855f7',
    particleColor: '#00e5ff',
    accentColor: '#d946ef',
  },
  'blue-night': {
    baseColor: '#0f1729',
    lineColor: '#60a5fa',
    glowColor: '#fbbf24',
    particleColor: '#93c5fd',
    accentColor: '#f59e0b',
  },
  matrix: {
    baseColor: '#000a00',
    lineColor: '#00ff66',
    glowColor: '#39ff14',
    particleColor: '#00ff44',
    accentColor: '#00cc33',
  },
  stormy: {
    baseColor: '#0d1117',
    lineColor: '#60a5fa',
    glowColor: '#94a3b8',
    particleColor: '#cbd5e1',
    accentColor: '#8b5cf6',
  },
  cyberstorm: {
    baseColor: '#05060f',
    lineColor: '#6366f1',
    glowColor: '#ff2bd6',
    particleColor: '#00f0ff',
    accentColor: '#d946ef',
  },
  aurora: {
    baseColor: '#0a0f1a',
    lineColor: '#22d3ee',
    glowColor: '#a855f7',
    particleColor: '#4ade80',
    accentColor: '#f472b6',
  },
  meshwater: {
    baseColor: '#0c1a2d',
    lineColor: '#0ea5e9',
    glowColor: '#22d3ee',
    particleColor: '#67e8f9',
    accentColor: '#38bdf8',
  },
  blaze: {
    baseColor: '#1a0f05',
    lineColor: '#f97316',
    glowColor: '#fbbf24',
    particleColor: '#fcd34d',
    accentColor: '#ef4444',
  },
  light: {
    baseColor: '#f5f2ed',
    lineColor: '#5a8a6e',
    glowColor: '#b86b7e',
    particleColor: '#c9a35f',
    accentColor: '#7cac90',
  },
};

export default function MeshWaterBackground({
  theme = 'meshwater',
  gridSize = 42,
  damping = 0.96,
  tension = 0.055,
  lightRadius = 180,
  lightIntensity = 0.85,
  lineOpacity = 0.18,
  waveSpeed = 0.55,
  showParticles = true,
  gravityStrength = 1.0,
  calm = false,
  pauseUnfocused = false,
}) {
  const canvasRef = useRef(null);
  const calmRef = useRef(calm);
  const pauseUnfocusedRef = useRef(pauseUnfocused);
  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0, down: false });
  const pointsRef = useRef({ points: [], cols: 0, rows: 0 });
  const particlesRef = useRef([]);
  const shockwavesRef = useRef([]);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  const palette = MESH_THEME_PALETTES[theme] || MESH_THEME_PALETTES.meshwater;

  useEffect(() => {
    calmRef.current = calm;
  }, [calm]);

  useEffect(() => {
    pauseUnfocusedRef.current = pauseUnfocused;
  }, [pauseUnfocused]);

  // Initialize 2D grid matrix
  const initGrid = useCallback((width, height) => {
    const cols = Math.ceil(width / gridSize) + 1;
    const rows = Math.ceil(height / gridSize) + 1;
    const points = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        points.push({
          x: x * gridSize,
          y: y * gridSize,
          originX: x * gridSize,
          originY: y * gridSize,
          vx: 0,
          vy: 0,
          force: 0,
          phase: (x + y) * 0.25,
        });
      }
    }

    return { points, cols, rows };
  }, [gridSize]);

  // Initialize floating light particles
  const initParticles = useCallback((width, height) => {
    const count = Math.max(25, Math.floor((width * height) / 45000));
    const particles = [];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2.2 + 0.8,
        alpha: Math.random() * 0.5 + 0.25,
        phase: Math.random() * Math.PI * 2,
        currentAlpha: 0.3,
      });
    }

    return particles;
  }, []);

  // Update physics simulation
  const updatePhysics = useCallback((points, cols, rows, width, height) => {
    const mouse = mouseRef.current;
    const effectiveRadius = lightRadius * (mouse.down ? 1.4 : 1.0);
    const effectiveIntensity = lightIntensity * (mouse.down ? 1.8 : 1.0) * gravityStrength;

    // 1. Update points against mouse gravity & spring restitution
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Mouse interactive ripple & suction/repulsion force
      if (dist < effectiveRadius && dist > 1) {
        const force = (1 - dist / effectiveRadius) * effectiveIntensity;
        const angle = Math.atan2(dy, dx);

        // Dynamic fluid displacement: moving pushes, clicking pulls
        if (mouse.down) {
          p.vx += Math.cos(angle) * force * 3.5;
          p.vy += Math.sin(angle) * force * 3.5;
        } else {
          p.vx -= (Math.cos(angle) * force * 2.2) + (mouse.vx * 0.12);
          p.vy -= (Math.sin(angle) * force * 2.2) + (mouse.vy * 0.12);
        }
        p.force = Math.min(1.0, p.force + force * 0.3);
      } else {
        p.force *= damping;
      }

      // Shockwave pulses interaction
      const shockwaves = shockwavesRef.current;
      for (let s = 0; s < shockwaves.length; s++) {
        const sw = shockwaves[s];
        const sdx = p.x - sw.x;
        const sdy = p.y - sw.y;
        const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
        const ringDist = Math.abs(sdist - sw.radius);

        if (ringDist < 60) {
          const impulse = (1 - ringDist / 60) * sw.intensity * 4.0;
          const sAngle = Math.atan2(sdy, sdx);
          p.vx += Math.cos(sAngle) * impulse;
          p.vy += Math.sin(sAngle) * impulse;
          p.force = Math.min(1.0, p.force + impulse * 0.5);
        }
      }

      // Spring force returning to origin (Hooke's Law: F = -k * dx)
      const springX = (p.originX - p.x) * tension;
      const springY = (p.originY - p.y) * tension;

      p.vx += springX;
      p.vy += springY;

      // Viscous damping
      p.vx *= damping;
      p.vy *= damping;

      // Integrate position
      p.x += p.vx * waveSpeed;
      p.y += p.vy * waveSpeed;
    }

    // 2. Wave propagation across adjacent neighbor nodes (Laplacian diffusion)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const p = points[i];

        let avgVx = 0;
        let avgVy = 0;
        let count = 0;

        if (x > 0) { avgVx += points[i - 1].vx; avgVy += points[i - 1].vy; count++; }
        if (x < cols - 1) { avgVx += points[i + 1].vx; avgVy += points[i + 1].vy; count++; }
        if (y > 0) { avgVx += points[i - cols].vx; avgVy += points[i - cols].vy; count++; }
        if (y < rows - 1) { avgVx += points[i + cols].vx; avgVy += points[i + cols].vy; count++; }

        if (count > 0) {
          avgVx /= count;
          avgVy /= count;
          p.vx += (avgVx - p.vx) * 0.12;
          p.vy += (avgVy - p.vy) * 0.12;
        }
      }
    }

    // 3. Update & age shockwaves
    const shockwaves = shockwavesRef.current;
    for (let s = shockwaves.length - 1; s >= 0; s--) {
      const sw = shockwaves[s];
      sw.radius += sw.speed;
      sw.intensity *= 0.96;
      if (sw.radius > sw.maxRadius || sw.intensity < 0.02) {
        shockwaves.splice(s, 1);
      }
    }
  }, [damping, tension, lightRadius, lightIntensity, waveSpeed, gravityStrength]);

  // Update floating particles
  const updateParticles = useCallback((particles, width, height, time) => {
    const mouse = mouseRef.current;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx + Math.sin(time * 0.001 + p.phase) * 0.25;
      p.y += p.vy + Math.cos(time * 0.001 + p.phase) * 0.25;

      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Light attraction / repulsion
      if (dist < lightRadius * 1.6 && dist > 1) {
        const force = (1 - dist / (lightRadius * 1.6)) * 0.035 * (mouse.down ? 2.5 : 1.0);
        if (mouse.down) {
          p.vx += (dx / dist) * force * 1.8;
          p.vy += (dy / dist) * force * 1.8;
        } else {
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      p.vx *= 0.985;
      p.vy *= 0.985;

      // Wrap boundaries
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      p.currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(time * 0.002 + p.phase));
    }
  }, [lightRadius]);

  // Render canvas frame
  const draw = useCallback((ctx, points, cols, rows, particles) => {
    const width = dimensionsRef.current.width;
    const height = dimensionsRef.current.height;
    const mouse = mouseRef.current;

    // Base background fill
    ctx.fillStyle = palette.baseColor;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1;

    // Draw horizontal mesh lines
    for (let y = 0; y < rows; y++) {
      ctx.beginPath();
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const p = points[i];

        if (x === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximityAlpha = Math.max(0, 1 - dist / lightRadius);
        const waveAlpha = Math.min(1, p.force * 2.2);
        const alpha = Math.min(0.95, lineOpacity + (proximityAlpha * lightIntensity * 0.6) + (waveAlpha * 0.35));

        if (x > 0) {
          const hexAlpha = Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.strokeStyle = `${palette.lineColor}${hexAlpha}`;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    // Draw vertical mesh lines
    for (let x = 0; x < cols; x++) {
      ctx.beginPath();
      for (let y = 0; y < rows; y++) {
        const i = y * cols + x;
        const p = points[i];

        if (y === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximityAlpha = Math.max(0, 1 - dist / lightRadius);
        const waveAlpha = Math.min(1, p.force * 2.2);
        const alpha = Math.min(0.95, lineOpacity + (proximityAlpha * lightIntensity * 0.6) + (waveAlpha * 0.35));

        if (y > 0) {
          const hexAlpha = Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.strokeStyle = `${palette.lineColor}${hexAlpha}`;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    // Draw shockwave ripples
    const shockwaves = shockwavesRef.current;
    for (let s = 0; s < shockwaves.length; s++) {
      const sw = shockwaves[s];
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = palette.glowColor;
      ctx.lineWidth = Math.max(1, sw.intensity * 4);
      ctx.globalAlpha = sw.intensity * 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // Draw cursor light trace aura
    if (mouse.x > 0 && mouse.y > 0) {
      const grad = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, lightRadius * (mouse.down ? 1.5 : 1.0)
      );
      grad.addColorStop(0, `${palette.glowColor}50`);
      grad.addColorStop(0.35, `${palette.glowColor}25`);
      grad.addColorStop(1, `${palette.glowColor}00`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, lightRadius * (mouse.down ? 1.5 : 1.0), 0, Math.PI * 2);
      ctx.fill();

      // High-intensity core glow
      const core = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, lightRadius * 0.35
      );
      core.addColorStop(0, '#ffffffb0');
      core.addColorStop(0.5, `${palette.accentColor}80`);
      core.addColorStop(1, `${palette.accentColor}00`);

      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, lightRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw floating particles
    if (showParticles) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const distFromMouse = Math.sqrt(Math.pow(mouse.x - p.x, 2) + Math.pow(mouse.y - p.y, 2));
        const glow = Math.max(0, 1 - distFromMouse / lightRadius);
        const alpha = Math.min(1.0, p.currentAlpha + glow * 0.6);

        ctx.fillStyle = glow > 0.1 ? palette.glowColor : palette.particleColor;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + glow * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Draw bright intersection nodes near cursor
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < lightRadius * 0.75) {
        const alpha = (1 - dist / (lightRadius * 0.75)) * lightIntensity;
        const size = 1.8 + alpha * 2.8;
        const hexAlpha = Math.floor(alpha * 255).toString(16).padStart(2, '0');

        ctx.fillStyle = `${palette.glowColor}${hexAlpha}`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [palette, lightRadius, lightIntensity, lineOpacity, showParticles]);

  // Main lifecycle loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      dimensionsRef.current = { width: canvas.width, height: canvas.height };

      const { points, cols, rows } = initGrid(canvas.width, canvas.height);
      pointsRef.current = { points, cols, rows };
      particlesRef.current = initParticles(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

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
      // Trigger shockwave pulse on click
      shockwavesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        radius: 10,
        speed: 12,
        maxRadius: Math.max(window.innerWidth, window.innerHeight) * 0.45,
        intensity: 1.0,
      });
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

    const step = (time, veil) => {
      const { points, cols, rows } = pointsRef.current;

      if (points && points.length > 0) {
        updatePhysics(points, cols, rows, canvas.width, canvas.height);
        updateParticles(particlesRef.current, canvas.width, canvas.height, time * 1000);
        draw(ctx, points, cols, rows, particlesRef.current);
        if (veil > 0.005) {
          ctx.globalAlpha = veil;
          ctx.fillStyle = palette.baseColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        }
      }
    };

    const stopLoop = runPacedLoop(step, () => calmRef.current, () => pauseUnfocusedRef.current);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseLeave);
      stopLoop();
    };
  }, [initGrid, initParticles, updatePhysics, updateParticles, draw, palette]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{
        background: palette.baseColor,
      }}
    />
  );
}
