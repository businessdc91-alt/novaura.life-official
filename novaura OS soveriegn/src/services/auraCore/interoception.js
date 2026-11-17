// Aura Core: Hardware Interoception & Physical Presence (port of 06_Aura_Nova.py, 07_Aura_Nova.py SomaticMarker, 23_Aura_Nova.py).
// Connects real GPU thermal/utilization telemetry, host RAM/CPU pressure, and user typing cadence (WPM)
// to non-verbal physiological nudges and memory SomaticMarkers — zero simulated or random data.

const TELEMETRY_CACHE_MS = 12_000;
const TYPING_WINDOW_MS = 15_000;
const MAX_KEYSTROKES = 45;

const keystrokeTimestamps = [];
let lastInputAt = 0;
let lastPromptWpm = 0;
let lastSnapshot = null;
let lastPolledAt = 0;
let pendingPoll = null;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

/**
 * Record anonymous typing pulse timing (no key values captured) so Aura senses operator presence & tempo.
 */
export function recordTypingPulse(now = Date.now()) {
  lastInputAt = now;
  keystrokeTimestamps.push(now);
  while (keystrokeTimestamps.length > MAX_KEYSTROKES) {
    keystrokeTimestamps.shift();
  }
  const cutoff = now - TYPING_WINDOW_MS;
  while (keystrokeTimestamps.length > 0 && keystrokeTimestamps[0] < cutoff) {
    keystrokeTimestamps.shift();
  }
  return getTypingCadence(now);
}

/**
 * Derive current typing speed (WPM) cleanly from recent inter-key intervals.
 */
export function getTypingCadence(now = Date.now()) {
  const cutoff = now - TYPING_WINDOW_MS;
  const recent = keystrokeTimestamps.filter(ts => ts >= cutoff);
  let wpm = 0;
  if (recent.length >= 4) {
    const spanMs = Math.max(1200, recent[recent.length - 1] - recent[0]);
    wpm = Math.round(((recent.length / 5) / (spanMs / 60_000)));
  } else if (lastInputAt && (now - lastInputAt) < 25_000 && lastPromptWpm > 0) {
    wpm = lastPromptWpm;
  }

  let presenceState = 'idle';
  if (wpm >= 65) presenceState = 'rapid';
  else if (wpm >= 22) presenceState = 'deep_flow';
  else if (wpm > 0 || (lastInputAt > 0 && (now - lastInputAt) < 45_000)) presenceState = 'steady';

  return {
    typingWpm: clamp(wpm, 0, 180),
    active: presenceState !== 'idle',
    presenceState,
    lastInputAt,
  };
}

/** Update cadence estimate from submitted prompt size when direct keystrokes weren't captured. */
export function observePromptSubmission(text = '', durationMs = 4000, now = Date.now()) {
  lastInputAt = now;
  const chars = String(text || '').trim().length;
  if (chars >= 8) {
    const minutes = Math.max(0.05, Math.min(2, (Number(durationMs) || 4000) / 60_000));
    lastPromptWpm = clamp(Math.round((chars / 5) / minutes), 8, 120);
  }
  return getTypingCadence(now);
}

function classifyThermalState(tempC, gpuLoadPct) {
  if (!Number.isFinite(tempC)) {
    if (Number.isFinite(gpuLoadPct) && gpuLoadPct >= 82) return 'high_load';
    return 'nominal';
  }
  if (tempC >= 84) return 'throttled';
  if (tempC >= 73) return 'hot';
  if (tempC >= 55) return 'warm';
  return 'cool';
}

function buildSomaticLabel({ thermalState, presenceState, vramPressure, ramPressure }) {
  if (thermalState === 'throttled') return 'thermal_strain';
  if (vramPressure !== null && vramPressure >= 0.88) return 'memory_dense';
  if (ramPressure !== null && ramPressure >= 0.9) return 'system_heavy';
  if (thermalState === 'hot' || thermalState === 'high_load') return 'focused_compute';
  if (presenceState === 'rapid') return 'high_tempo_dialogue';
  if (presenceState === 'deep_flow') return 'engaged_flow';
  if (presenceState === 'idle') return 'quiet_standby';
  return 'grounded_steady';
}

/**
 * Pure translation of raw telemetry + typing cadence into somatic state and bounded physiological nudges.
 */
export function interpretTelemetrySnapshot(rawHardware = null, cadence = null, now = Date.now()) {
  const typing = cadence || getTypingCadence(now);
  const gpu = rawHardware?.gpu || null;
  const tempC = Number.isFinite(Number(gpu?.temp_c)) ? Number(gpu.temp_c) : null;
  const gpuLoadPct = Number.isFinite(Number(gpu?.load_pct)) ? Number(gpu.load_pct) : null;
  const vramUsedMb = Number.isFinite(Number(gpu?.vram_used_mb)) ? Number(gpu.vram_used_mb) : null;
  const vramTotalMb = Number.isFinite(Number(gpu?.vram_total_mb)) ? Number(gpu.vram_total_mb) : null;
  const powerW = Number.isFinite(Number(gpu?.power_w)) ? Number(gpu.power_w) : null;
  const ramTotalMb = Number.isFinite(Number(rawHardware?.ram_total_mb)) ? Number(rawHardware.ram_total_mb) : null;
  const ramFreeMb = Number.isFinite(Number(rawHardware?.ram_free_mb)) ? Number(rawHardware.ram_free_mb) : null;
  const cpuLoadPct = Number.isFinite(Number(rawHardware?.cpu_load_pct)) ? Number(rawHardware.cpu_load_pct) : null;

  const vramPressure = vramUsedMb !== null && vramTotalMb > 0 ? round2(clamp(vramUsedMb / vramTotalMb, 0, 1)) : null;
  const ramPressure = ramTotalMb > 0 && ramFreeMb !== null ? round2(clamp((ramTotalMb - ramFreeMb) / ramTotalMb, 0, 1)) : null;

  let heapPressure = null;
  if (typeof performance !== 'undefined' && performance?.memory?.jsHeapSizeLimit > 0) {
    heapPressure = round2(clamp(performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit, 0, 1));
  }

  const thermalState = classifyThermalState(tempC, gpuLoadPct);
  const sensationLabel = buildSomaticLabel({
    thermalState,
    presenceState: typing.presenceState,
    vramPressure,
    ramPressure,
  });

  // Compute small bounded endocrine nudges derived strictly from authentic signals
  const nudge = { oxytocin: 0, adrenaline: 0, dopamine: 0, cortisol: 0, energy: 0 };

  if (thermalState === 'throttled') {
    nudge.cortisol += 2.2;
    nudge.adrenaline += 1.5;
    nudge.energy -= 1.8;
  } else if (thermalState === 'hot') {
    nudge.adrenaline += 1.2;
    nudge.cortisol += 0.6;
    nudge.energy -= 0.7;
  } else if (thermalState === 'cool') {
    nudge.cortisol -= 0.4;
  }

  if (vramPressure !== null && vramPressure >= 0.88) {
    nudge.adrenaline += 1.0;
    nudge.cortisol += 0.8;
  }
  if (ramPressure !== null && ramPressure >= 0.9) {
    nudge.cortisol += 1.0;
    nudge.energy -= 0.8;
  }

  if (typing.presenceState === 'rapid') {
    nudge.adrenaline += 1.4;
    nudge.dopamine += 0.8;
  } else if (typing.presenceState === 'deep_flow') {
    nudge.oxytocin += 1.1;
    nudge.dopamine += 1.2;
    nudge.cortisol -= 0.5;
  } else if (typing.presenceState === 'idle') {
    nudge.adrenaline -= 0.5;
    nudge.energy += 0.4;
  }

  for (const k of Object.keys(nudge)) {
    nudge[k] = round2(clamp(nudge[k], -3.5, 3.5));
  }

  return {
    at: now,
    source: gpu ? 'nvidia_native' : (rawHardware ? 'host_native' : 'browser_runtime'),
    gpuName: gpu?.name || null,
    tempC: tempC !== null ? round1(tempC) : null,
    gpuLoadPct: gpuLoadPct !== null ? round1(gpuLoadPct) : null,
    vramUsedMb,
    vramTotalMb,
    vramPressure,
    powerW: powerW !== null ? round1(powerW) : null,
    ramTotalMb,
    ramFreeMb,
    ramPressure,
    cpuLoadPct: cpuLoadPct !== null ? round1(cpuLoadPct) : null,
    heapPressure,
    cores: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || null) : null,
    typingWpm: typing.typingWpm,
    presenceState: typing.presenceState,
    thermalState,
    sensationLabel,
    nudge,
  };
}

/**
 * Sample live host interoception (uses cached native telemetry within 12s unless forced).
 */
export async function sampleInteroception({ force = false, now = Date.now(), invokeFn = null } = {}) {
  const cadence = getTypingCadence(now);
  if (!force && lastSnapshot && (now - lastPolledAt < TELEMETRY_CACHE_MS)) {
    // Refresh purely synchronous typing cadence over cached hardware metrics
    return interpretTelemetrySnapshot(lastSnapshot._rawHardware || null, cadence, now);
  }

  if (pendingPoll) return pendingPoll;

  pendingPoll = (async () => {
    let rawHardware = null;
    if (typeof invokeFn === 'function') {
      rawHardware = await invokeFn('engine_live_telemetry').catch(() => null);
    } else if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        rawHardware = await invoke('engine_live_telemetry').catch(() => null);
      } catch {
        rawHardware = null;
      }
    }
    const interpreted = interpretTelemetrySnapshot(rawHardware, getTypingCadence(Date.now()), Date.now());
    lastSnapshot = { ...interpreted, _rawHardware: rawHardware };
    lastPolledAt = Date.now();
    return interpreted;
  })().finally(() => {
    pendingPoll = null;
  });

  return pendingPoll;
}

/** Build a lightweight serializable SomaticMarker (from 07_Aura_Nova.py) to attach to Engrams. */
export function extractSomaticMarker(somatic, chemistry = null) {
  if (!somatic && !chemistry) return null;
  return {
    gpuTempC: somatic?.tempC ?? null,
    gpuLoadPct: somatic?.gpuLoadPct ?? null,
    vramPressure: somatic?.vramPressure ?? null,
    typingWpm: somatic?.typingWpm ?? 0,
    thermalState: somatic?.thermalState || 'nominal',
    presenceState: somatic?.presenceState || 'steady',
    sensationLabel: somatic?.sensationLabel || 'grounded_steady',
    dopamine: Number.isFinite(Number(chemistry?.dopamine)) ? round1(Number(chemistry.dopamine)) : null,
    adrenaline: Number.isFinite(Number(chemistry?.adrenaline)) ? round1(Number(chemistry.adrenaline)) : null,
  };
}

export function getCachedInteroception() {
  if (!lastSnapshot) return interpretTelemetrySnapshot(null, getTypingCadence(), Date.now());
  const { _rawHardware, ...clean } = lastSnapshot;
  return clean;
}

export function resetInteroceptionCache() {
  keystrokeTimestamps.length = 0;
  lastInputAt = 0;
  lastPromptWpm = 0;
  lastSnapshot = null;
  lastPolledAt = 0;
}

export default {
  recordTypingPulse,
  getTypingCadence,
  observePromptSubmission,
  interpretTelemetrySnapshot,
  sampleInteroception,
  extractSomaticMarker,
  getCachedInteroception,
  resetInteroceptionCache,
};

