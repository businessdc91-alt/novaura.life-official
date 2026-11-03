import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { playChessSound } from '../../../services/holoChessService.js';

// Grid constants
const TILE_SIZE = 1.0;
const TILE_GAP = 1.08;
const BOARD_OFFSET = 3.5 * TILE_GAP;

// Faction Colors
const NOVA_COLORS = {
  core: 0x00f0ff,
  emissive: 0x0066aa,
  wire: 0x38bdf8,
  glow: 0x00ffff,
};

const AURA_COLORS = {
  core: 0xc084fc,
  emissive: 0x6b21a8,
  wire: 0xf43f5e,
  glow: 0xd946ef,
};

/**
 * Procedural 3D Holographic Geometry generator for Chess Pieces
 */
function createPieceGeometry(type) {
  const group = new THREE.Group();
  const lowerType = type.toLowerCase();

  // Common futuristic base
  const baseGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.1, 16);
  const baseMesh = new THREE.Mesh(baseGeo);
  baseMesh.position.y = 0.05;
  group.add(baseMesh);

  const stepGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.06, 16);
  const stepMesh = new THREE.Mesh(stepGeo);
  stepMesh.position.y = 0.13;
  group.add(stepMesh);

  if (lowerType === 'p') {
    // Holographic Pawn
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.45, 14);
    const bodyMesh = new THREE.Mesh(bodyGeo);
    bodyMesh.position.y = 0.38;
    group.add(bodyMesh);

    const ringGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 16);
    const ringMesh = new THREE.Mesh(ringGeo);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.6;
    group.add(ringMesh);

    const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const headMesh = new THREE.Mesh(headGeo);
    headMesh.position.y = 0.72;
    group.add(headMesh);
  } else if (lowerType === 'r') {
    // Holographic Rook (Cyber Bastion Turret)
    const bodyGeo = new THREE.CylinderGeometry(0.26, 0.3, 0.6, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo);
    bodyMesh.position.y = 0.45;
    group.add(bodyMesh);

    const turretGeo = new THREE.CylinderGeometry(0.34, 0.28, 0.22, 4);
    const turretMesh = new THREE.Mesh(turretGeo);
    turretMesh.position.y = 0.85;
    turretMesh.rotation.y = Math.PI / 4;
    group.add(turretMesh);

    const coreGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const coreMesh = new THREE.Mesh(coreGeo);
    coreMesh.position.y = 0.85;
    group.add(coreMesh);
  } else if (lowerType === 'n') {
    // Holographic Knight (Mecha Steed)
    const neckGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.35, 12);
    const neckMesh = new THREE.Mesh(neckGeo);
    neckMesh.position.y = 0.32;
    group.add(neckMesh);

    const headGroup = new THREE.Group();
    const chestGeo = new THREE.BoxGeometry(0.24, 0.34, 0.34);
    const chestMesh = new THREE.Mesh(chestGeo);
    chestMesh.position.set(0, 0.55, 0.05);
    chestMesh.rotation.x = -0.25;
    headGroup.add(chestMesh);

    const snoutGeo = new THREE.ConeGeometry(0.18, 0.35, 4);
    const snoutMesh = new THREE.Mesh(snoutGeo);
    snoutMesh.position.set(0, 0.68, 0.2);
    snoutMesh.rotation.x = 1.35;
    headGroup.add(snoutMesh);

    const crestGeo = new THREE.BoxGeometry(0.06, 0.35, 0.2);
    const crestMesh = new THREE.Mesh(crestGeo);
    crestMesh.position.set(0, 0.65, -0.12);
    crestMesh.rotation.x = 0.3;
    headGroup.add(crestMesh);

    group.add(headGroup);
  } else if (lowerType === 'b') {
    // Holographic Bishop (Obelisk Inquisitor)
    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.26, 0.7, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo);
    bodyMesh.position.y = 0.5;
    group.add(bodyMesh);

    const mitreGeo = new THREE.SphereGeometry(0.2, 16, 16);
    mitreGeo.scale(1, 1.3, 0.9);
    const mitreMesh = new THREE.Mesh(mitreGeo);
    mitreMesh.position.y = 0.95;
    group.add(mitreMesh);

    const crownGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 16);
    const crownMesh = new THREE.Mesh(crownGeo);
    crownMesh.rotation.x = Math.PI / 2;
    crownMesh.position.y = 0.95;
    group.add(crownMesh);

    const tipGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const tipMesh = new THREE.Mesh(tipGeo);
    tipMesh.position.y = 1.25;
    group.add(tipMesh);
  } else if (lowerType === 'q') {
    // Holographic Queen (Sovereign Radiant Empress)
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.3, 0.9, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo);
    bodyMesh.position.y = 0.6;
    group.add(bodyMesh);

    const midRingGeo = new THREE.TorusGeometry(0.24, 0.035, 8, 16);
    const midRingMesh = new THREE.Mesh(midRingGeo);
    midRingMesh.rotation.x = Math.PI / 2;
    midRingMesh.position.y = 0.7;
    group.add(midRingMesh);

    const crownGeo = new THREE.CylinderGeometry(0.32, 0.2, 0.28, 8);
    const crownMesh = new THREE.Mesh(crownGeo);
    crownMesh.position.y = 1.15;
    group.add(crownMesh);

    const orbGeo = new THREE.OctahedronGeometry(0.14, 0);
    const orbMesh = new THREE.Mesh(orbGeo);
    orbMesh.position.y = 1.38;
    group.add(orbMesh);
  } else if (lowerType === 'k') {
    // Holographic King (Imperial Monolith Core)
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.32, 1.0, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo);
    bodyMesh.position.y = 0.65;
    group.add(bodyMesh);

    const mantleGeo = new THREE.BoxGeometry(0.48, 0.1, 0.48);
    const mantleMesh = new THREE.Mesh(mantleGeo);
    mantleMesh.position.y = 1.15;
    group.add(mantleMesh);

    const headGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.25, 8);
    const headMesh = new THREE.Mesh(headGeo);
    headMesh.position.y = 1.32;
    group.add(headMesh);

    // Cross finial
    const crossVGeo = new THREE.BoxGeometry(0.07, 0.26, 0.07);
    const crossVMesh = new THREE.Mesh(crossVGeo);
    crossVMesh.position.y = 1.55;
    group.add(crossVMesh);

    const crossHGeo = new THREE.BoxGeometry(0.22, 0.07, 0.07);
    const crossHMesh = new THREE.Mesh(crossHGeo);
    crossHMesh.position.y = 1.58;
    group.add(crossHMesh);
  }

  return group;
}

/**
 * Assembles a holographic dual-material piece mesh (Translucent Core + Wireframe Edge Glow)
 */
function createHoloPieceObject(pieceType, isWhite) {
  const faction = isWhite ? NOVA_COLORS : AURA_COLORS;
  const geomGroup = createPieceGeometry(pieceType);

  const pieceRoot = new THREE.Group();
  pieceRoot.userData = { pieceType, isWhite };

  // Core material
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: faction.core,
    emissive: faction.emissive,
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.8,
    transparent: true,
    opacity: 0.78,
  });

  // Wireframe edge material
  const wireMaterial = new THREE.LineBasicMaterial({
    color: faction.wire,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });

  geomGroup.traverse((child) => {
    if (child.isMesh) {
      child.material = coreMaterial;
      const edges = new THREE.EdgesGeometry(child.geometry);
      const wire = new THREE.LineSegments(edges, wireMaterial);
      child.add(wire);
    }
  });

  // Point glow at the piece center
  const glowLight = new THREE.PointLight(faction.glow, 0.8, 1.8);
  glowLight.position.y = 0.5;
  pieceRoot.add(glowLight);

  pieceRoot.add(geomGroup);
  return pieceRoot;
}

/** Free the GPU buffers of an object and everything under it. */
function disposeObject(root) {
  root.traverse((child) => {
    child.geometry?.dispose();
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    mats.forEach((m) => m.dispose());
  });
}

// A press that moves less than this (in pixels) is a click; more is an orbit drag.
const CLICK_SLOP_PX = 5;

export default function HoloChessCanvas({
  fen,
  boardState,
  selectedSquare,
  legalMoves = [],
  lastMove = null,
  isCheck = false,
  checkSquare = null,
  onSquareClick,
  viewMode = 'auto', // 'auto' | 'nova' | 'aura' | 'top'
  isAiThinking = false,
}) {
  const containerRef = useRef(null);
  const mountRef = useRef(null); // the WebGL canvas lives here, apart from React's overlay children
  const pressRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);

  // Mesh registries
  const tilesRef = useRef(new Map());
  const piecesRef = useRef(new Map());
  const targetMarkersRef = useRef([]);
  const laserRaysRef = useRef([]);
  const particlesRef = useRef([]);
  const daisRingsRef = useRef([]);

  // Raycaster & interaction
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredSquareRef = useRef(null);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    const mount = mountRef.current;
    if (!container || !mount) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050814, 0.035);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8.5, 9.5);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't clip beneath the board
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.target.set(0, 0.2, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x0a1428, 1.8);
    scene.add(ambientLight);

    // Nova Cyan key light
    const novaLight = new THREE.PointLight(0x00f0ff, 2.5, 20);
    novaLight.position.set(0, 6, 6);
    scene.add(novaLight);

    // Aura Violet key light
    const auraLight = new THREE.PointLight(0xb026ff, 2.5, 20);
    auraLight.position.set(0, 6, -6);
    scene.add(auraLight);

    // Central upward projector beam
    const projectorGeo = new THREE.CylinderGeometry(3.6, 5.2, 4.0, 32, 1, true);
    const projectorMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const projectorCone = new THREE.Mesh(projectorGeo, projectorMat);
    projectorCone.position.y = 1.8;
    scene.add(projectorCone);

    // 6. Holographic Platform / Dais
    const daisGroup = new THREE.Group();

    // Outer cyber ring
    const ring1Geo = new THREE.RingGeometry(5.2, 5.4, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = -0.15;
    daisGroup.add(ring1);

    // Inner violet cyber ring
    const ring2Geo = new THREE.RingGeometry(4.4, 4.55, 48);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xb026ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.12;
    daisGroup.add(ring2);

    // Obsidian base plate
    const basePlateGeo = new THREE.CylinderGeometry(5.8, 6.2, 0.3, 48);
    const basePlateMat = new THREE.MeshStandardMaterial({
      color: 0x060914,
      roughness: 0.2,
      metalness: 0.95,
      transparent: true,
      opacity: 0.92,
    });
    const basePlate = new THREE.Mesh(basePlateGeo, basePlateMat);
    basePlate.position.y = -0.3;
    daisGroup.add(basePlate);

    scene.add(daisGroup);
    daisRingsRef.current = [ring1, ring2];

    // 7. Floating Quantum Cyber Dust Particles
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.0 + Math.random() * 4.8;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 5.0;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      particleSpeeds[i] = 0.005 + Math.random() * 0.012;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);
    particlesRef.current = { system: particleSystem, speeds: particleSpeeds };

    // 8. Build 8x8 Holographic Glass Board
    const tileGroup = new THREE.Group();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = `${files[file]}${8 - rank}`;
        const isWhiteSquare = (rank + file) % 2 === 0;

        const posX = file * TILE_GAP - BOARD_OFFSET;
        const posZ = rank * TILE_GAP - BOARD_OFFSET;

        const tileGeo = new THREE.BoxGeometry(TILE_SIZE, 0.08, TILE_SIZE);

        const tileMat = new THREE.MeshStandardMaterial({
          color: isWhiteSquare ? 0x0f2b3e : 0x1e0b2e,
          emissive: isWhiteSquare ? 0x004466 : 0x330055,
          emissiveIntensity: 0.4,
          roughness: 0.2,
          metalness: 0.9,
          transparent: true,
          opacity: isWhiteSquare ? 0.72 : 0.65,
        });

        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
        tileMesh.position.set(posX, 0, posZ);
        tileMesh.userData = { square, rank, file, isWhiteSquare, basePosY: 0 };

        // Glowing border edges
        const edgeGeo = new THREE.EdgesGeometry(tileGeo);
        const edgeMat = new THREE.LineBasicMaterial({
          color: isWhiteSquare ? 0x00f0ff : 0xa855f7,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
        });
        const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
        tileMesh.add(edgeLine);

        tileGroup.add(tileMesh);
        tilesRef.current.set(square, tileMesh);
      }
    }
    scene.add(tileGroup);

    // 9. Follow the window's size (it is resized inside the desktop, not with the screen)
    const handleResize = () => {
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      if (!newW || !newH) return;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 10. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate dais rings
      if (daisRingsRef.current[0]) daisRingsRef.current[0].rotation.z += 0.002;
      if (daisRingsRef.current[1]) daisRingsRef.current[1].rotation.z -= 0.003;

      // Projector beam gentle breathing
      projectorCone.rotation.y += 0.001;
      projectorMat.opacity = 0.035 + Math.sin(elapsed * 2) * 0.015;

      // Animate quantum dust particles drifting upwards
      if (particlesRef.current.system) {
        const positions = particlesRef.current.system.geometry.attributes.position.array;
        const speeds = particlesRef.current.speeds;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] += speeds[i];
          if (positions[i * 3 + 1] > 4.8) {
            positions[i * 3 + 1] = 0.1;
          }
        }
        particlesRef.current.system.geometry.attributes.position.needsUpdate = true;
      }

      // Animate destination target markers
      targetMarkersRef.current.forEach((marker) => {
        marker.rotation.y += 0.04;
        marker.position.y = 0.15 + Math.sin(elapsed * 4) * 0.04;
      });

      // Update Controls
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      disposeObject(scene);
      tilesRef.current.clear();
      piecesRef.current.clear();
      targetMarkersRef.current = [];
      renderer.dispose();
      renderer.forceContextLoss(); // browsers cap live WebGL contexts; give this one back
      renderer.domElement.remove();
    };
  }, []);

  // Update Camera View according to viewMode
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (viewMode === 'nova') {
      camera.position.set(0, 7.5, 9.0);
    } else if (viewMode === 'aura') {
      camera.position.set(0, 7.5, -9.0);
    } else if (viewMode === 'top') {
      camera.position.set(0, 12.0, 0.1);
    } else {
      // Default angle
      camera.position.set(0, 8.5, 9.5);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  }, [viewMode]);

  // Sync 3D Pieces with boardState
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Map existing pieces
    const currentPieces = piecesRef.current;
    const visitedSquares = new Set();

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const square = `${files[f]}${8 - r}`;
        const pieceRaw = boardState?.[r]?.[f];

        const targetX = f * TILE_GAP - BOARD_OFFSET;
        const targetZ = r * TILE_GAP - BOARD_OFFSET;

        if (pieceRaw) {
          visitedSquares.add(square);
          const isWhite = typeof pieceRaw === 'string'
            ? pieceRaw === pieceRaw.toUpperCase()
            : pieceRaw.color === 'w';
          const typeChar = typeof pieceRaw === 'string'
            ? pieceRaw.toLowerCase()
            : (pieceRaw.type || 'p').toLowerCase();
          const pieceCode = isWhite ? typeChar.toUpperCase() : typeChar.toLowerCase();
          const existing = currentPieces.get(square);

          if (existing && existing.userData.pieceType === pieceCode) {
            // Keep existing piece, just ensure position
            existing.position.set(targetX, 0.04, targetZ);
          } else {
            // Remove old piece at this square if different
            if (existing) {
              scene.remove(existing);
              disposeObject(existing);
              currentPieces.delete(square);
            }
            // Create brand new procedural holographic piece
            const pieceObj = createHoloPieceObject(pieceCode, isWhite);
            pieceObj.position.set(targetX, 0.04, targetZ);
            // Face black pieces forward toward white
            if (!isWhite) {
              pieceObj.rotation.y = Math.PI;
            }
            scene.add(pieceObj);
            currentPieces.set(square, pieceObj);
          }
        } else {
          // Empty square, remove piece if exists
          const existing = currentPieces.get(square);
          if (existing) {
            scene.remove(existing);
            disposeObject(existing);
            currentPieces.delete(square);
          }
        }
      }
    }
  }, [boardState]);

  // Highlight selection, legal moves, check square & last move
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clean up old target markers
    targetMarkersRef.current.forEach((m) => {
      scene.remove(m);
      disposeObject(m);
    });
    targetMarkersRef.current = [];

    // Reset tile colors & positions
    tilesRef.current.forEach((tileMesh, sq) => {
      const isWhiteSquare = tileMesh.userData.isWhiteSquare;
      tileMesh.position.y = 0;
      tileMesh.material.color.setHex(isWhiteSquare ? 0x0f2b3e : 0x1e0b2e);
      tileMesh.material.emissive.setHex(isWhiteSquare ? 0x004466 : 0x330055);
      tileMesh.material.emissiveIntensity = 0.4;
    });

    // 1. Highlight Last Move
    if (lastMove) {
      const fromTile = tilesRef.current.get(lastMove.from);
      const toTile = tilesRef.current.get(lastMove.to);
      if (fromTile) {
        fromTile.material.emissive.setHex(0x0284c7);
        fromTile.material.emissiveIntensity = 0.7;
      }
      if (toTile) {
        toTile.material.emissive.setHex(0x0ea5e9);
        toTile.material.emissiveIntensity = 0.85;
      }
    }

    // 2. Highlight King in Check
    if (isCheck && checkSquare) {
      const checkTile = tilesRef.current.get(checkSquare);
      if (checkTile) {
        checkTile.material.emissive.setHex(0xef4444);
        checkTile.material.emissiveIntensity = 1.3;
        checkTile.position.y = 0.05;
      }
    }

    // 3. Highlight Selected Square
    if (selectedSquare) {
      const selTile = tilesRef.current.get(selectedSquare);
      if (selTile) {
        selTile.material.emissive.setHex(0x00f0ff);
        selTile.material.emissiveIntensity = 1.2;
        selTile.position.y = 0.06;
      }
    }

    // 4. Render 3D Target Glyphs for Legal Moves
    if (selectedSquare && legalMoves.length > 0) {
      legalMoves.forEach((move) => {
        const destSquare = move.to;
        const targetTile = tilesRef.current.get(destSquare);
        if (targetTile) {
          const isCapture = Boolean(move.captured);
          const posX = targetTile.position.x;
          const posZ = targetTile.position.z;

          // Target marker mesh
          const markerGroup = new THREE.Group();
          markerGroup.position.set(posX, 0.15, posZ);

          if (isCapture) {
            // Red/Gold pulsating combat capture bracket
            const ringGeo = new THREE.RingGeometry(0.3, 0.42, 6);
            const ringMat = new THREE.MeshBasicMaterial({
              color: 0xf43f5e,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.85,
              blending: THREE.AdditiveBlending,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            markerGroup.add(ringMesh);
          } else {
            // Cyan floating micro diamond
            const diamondGeo = new THREE.OctahedronGeometry(0.12, 0);
            const diamondMat = new THREE.MeshBasicMaterial({
              color: 0x00f0ff,
              transparent: true,
              opacity: 0.85,
              blending: THREE.AdditiveBlending,
            });
            const diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
            markerGroup.add(diamondMesh);

            const floorRing = new THREE.RingGeometry(0.2, 0.28, 16);
            const floorMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.6,
              blending: THREE.AdditiveBlending,
            });
            const floorMesh = new THREE.Mesh(floorRing, floorMat);
            floorMesh.rotation.x = Math.PI / 2;
            floorMesh.position.y = -0.1;
            markerGroup.add(floorMesh);
          }

          scene.add(markerGroup);
          targetMarkersRef.current.push(markerGroup);
        }
      });
    }
  }, [selectedSquare, legalMoves, lastMove, isCheck, checkSquare]);

  // Click Raycaster Handler (on release, and only if the press did not turn into an orbit drag)
  const handlePointerDown = useCallback((e) => {
    pressRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback((e) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP_PX) return;
    if (!rendererRef.current || !cameraRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    // Intersect board tiles
    const tileMeshes = Array.from(tilesRef.current.values());
    const intersects = raycasterRef.current.intersectObjects(tileMeshes, false);

    if (intersects.length > 0) {
      const hitTile = intersects[0].object;
      const clickedSquare = hitTile.userData.square;
      if (clickedSquare && onSquareClick) {
        onSquareClick(clickedSquare);
      }
    }
  }, [onSquareClick]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="relative w-full h-full cursor-crosshair select-none overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 50%, #0d1527 0%, #050814 80%, #02040a 100%)',
      }}
    >
      <div ref={mountRef} className="absolute inset-0" />

      {/* AI Processing Scanning Indicator */}
      {isAiThinking && (
        <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/50 backdrop-blur-md animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-mono font-semibold tracking-wider text-cyan-300">
            NEURAL ENGINE CALCULATING MOVE...
          </span>
        </div>
      )}

      {/* Grid Coordinates Watermark */}
      <div className="absolute bottom-3 right-4 pointer-events-none text-[11px] font-mono tracking-widest text-cyan-500/40 uppercase">
        Holographic Matrix [8x8] • Three.js WebGL
      </div>
    </div>
  );
}
