// audioTools.js — Editing for generated and uploaded audio, without a server.
// The processing works on plain { sampleRate, channels: Float32Array[] } objects,
// so it is independent of the Web Audio API (decode/encode are thin wrappers).

/** Decode an audio Blob/File into { sampleRate, channels }. Browser only. */
export async function decodeAudio(blob) {
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, 44100);
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const channels = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c).slice());
  return { sampleRate: buffer.sampleRate, channels };
}

export function durationOf(audio) {
  return audio.channels[0].length / audio.sampleRate;
}

export function trim(audio, startSec, endSec) {
  const a = Math.max(0, Math.floor(startSec * audio.sampleRate));
  const b = Math.min(audio.channels[0].length, Math.floor(endSec * audio.sampleRate));
  return { sampleRate: audio.sampleRate, channels: audio.channels.map(ch => ch.slice(a, Math.max(a, b))) };
}

export function fade(audio, inSec = 0, outSec = 0) {
  const sr = audio.sampleRate;
  return {
    sampleRate: sr,
    channels: audio.channels.map(src => {
      const ch = src.slice();
      const n = ch.length;
      const fi = Math.min(n, Math.floor(inSec * sr));
      const fo = Math.min(n, Math.floor(outSec * sr));
      for (let i = 0; i < fi; i++) ch[i] *= i / fi;
      for (let i = 0; i < fo; i++) ch[n - 1 - i] *= i / fo;
      return ch;
    }),
  };
}

/** Scale so the loudest sample hits `peak` (0..1). */
export function normalize(audio, peak = 0.95) {
  let max = 0;
  for (const ch of audio.channels) for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]));
  if (max === 0) return audio;
  const g = peak / max;
  return { sampleRate: audio.sampleRate, channels: audio.channels.map(ch => ch.map(v => v * g)) };
}

/**
 * Make a seamless loop. The tail is crossfaded into the head with equal-power
 * curves, so playing the result end-to-start has no click or gap. With a BPM the
 * loop length snaps to whole bars, which keeps the beat steady across the seam.
 */
/**
 * Where the music actually plays: skips leading silence and a trailing fade-out
 * or silence (models often end a piece early). Returns sample indices [start, end).
 */
export function activeRange(audio, { windowSec = 0.25, ratio = 0.3 } = {}) {
  const sr = audio.sampleRate;
  const n = audio.channels[0].length;
  const win = Math.max(1, Math.floor(windowSec * sr));
  const levels = [];
  for (let start = 0; start < n; start += win) {
    let sum = 0;
    const end = Math.min(n, start + win);
    for (let i = start; i < end; i++) {
      let v = 0;
      for (const ch of audio.channels) v += ch[i];
      v /= audio.channels.length;
      sum += v * v;
    }
    levels.push(Math.sqrt(sum / (end - start)));
  }
  const loud = levels.filter(l => l > 0.01).sort((a, b) => a - b);
  if (!loud.length) return { start: 0, end: n };
  const threshold = loud[Math.floor(loud.length / 2)] * ratio;
  const first = levels.findIndex(l => l >= threshold);
  let last = levels.length - 1;
  while (last > first && levels[last] < threshold) last--;
  return { start: first * win, end: Math.min(n, (last + 1) * win) };
}

export function makeSeamlessLoop(audio, { bpm = 0, beatsPerBar = 4, crossfadeSec = 1.5 } = {}) {
  const sr = audio.sampleRate;
  // Loop only the part where music plays, so no silence or fade-out lands at the seam.
  const range = activeRange(audio);
  if (range.start > 0 || range.end < audio.channels[0].length) {
    audio = { sampleRate: sr, channels: audio.channels.map(ch => ch.slice(range.start, range.end)) };
  }
  const n = audio.channels[0].length;
  let xf = Math.floor(crossfadeSec * sr);
  let loopLen = n - xf;
  if (bpm > 0) {
    const bar = (60 / bpm) * beatsPerBar * sr;
    const bars = Math.floor(loopLen / bar);
    if (bars >= 1) loopLen = Math.round(bars * bar);
  }
  xf = Math.min(xf, n - loopLen, loopLen);
  if (loopLen <= 0 || xf <= 0) return { audio, loopSec: n / sr, crossfadeSec: 0 };
  const channels = audio.channels.map(src => {
    const out = src.slice(0, loopLen);
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      const fadeIn = Math.sin(t * Math.PI / 2);
      const fadeOut = Math.cos(t * Math.PI / 2);
      out[i] = src[i] * fadeIn + src[loopLen + i] * fadeOut;
    }
    return out;
  });
  return { audio: { sampleRate: sr, channels }, loopSec: loopLen / sr, crossfadeSec: xf / sr };
}

/** Peak values for drawing a waveform with `buckets` bars. */
export function waveformPeaks(audio, buckets = 600) {
  const ch = audio.channels[0];
  const size = Math.max(1, Math.floor(ch.length / buckets));
  const peaks = new Float32Array(buckets);
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    const start = b * size;
    for (let i = start; i < start + size && i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]));
    peaks[b] = m;
  }
  return peaks;
}

/** Encode as 16-bit PCM WAV. Returns a Uint8Array. */
export function encodeWav(audio) {
  const { sampleRate, channels } = audio;
  const numCh = channels.length;
  const len = channels[0].length;
  const dataBytes = len * numCh * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * numCh * 2, true); v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

export function wavBlob(audio) {
  return new Blob([encodeWav(audio)], { type: 'audio/wav' });
}

// ── Multi-Section Chaining, Chunking & Pure-PCM Mastering DSP ────────────────

/** Resample audio channels linearly to a target sample rate when joining heterogeneous segments. */
export function resampleAudio(audio, targetSampleRate) {
  if (!audio || audio.sampleRate === targetSampleRate) return audio;
  const ratio = audio.sampleRate / targetSampleRate;
  const outLen = Math.max(1, Math.round(audio.channels[0].length / ratio));
  const channels = audio.channels.map(src => {
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = src[idx] ?? 0;
      const b = src[Math.min(src.length - 1, idx + 1)] ?? a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  });
  return { sampleRate: targetSampleRate, channels };
}

/**
 * Stitch multiple song sections into one seamless extended track (up to 10+ minutes)
 * using beat-aligned equal-power crossfades and automatic dead-air seam trimming.
 */
export function concatWithCrossfade(segments, { bpm = 0, beatsPerBar = 4, crossfadeSec = 2.0, trimEdges = true } = {}) {
  const valid = (segments || []).filter(s => s?.channels?.[0]?.length > 0);
  if (!valid.length) throw new Error('No audio segments provided to concatenate.');
  if (valid.length === 1) return valid[0];

  const sr = valid[0].sampleRate;
  const numCh = Math.max(...valid.map(s => s.channels.length));

  // Normalize sample rate, channel count, and trim trailing dead-air between sections
  const prepared = valid.map((seg, idx) => {
    let cur = seg.sampleRate === sr ? seg : resampleAudio(seg, sr);
    if (cur.channels.length < numCh) {
      const chs = [...cur.channels];
      while (chs.length < numCh) chs.push(chs[0].slice());
      cur = { sampleRate: sr, channels: chs };
    }
    if (trimEdges) {
      const range = activeRange(cur, { windowSec: 0.2, ratio: 0.18 });
      const padSamples = Math.floor(0.15 * sr);
      const start = idx === 0 ? 0 : Math.max(0, range.start - padSamples);
      const end = idx === valid.length - 1 ? cur.channels[0].length : Math.min(cur.channels[0].length, range.end + padSamples);
      if (end - start > sr) {
        cur = { sampleRate: sr, channels: cur.channels.map(c => c.slice(start, end)) };
      }
    }
    return cur;
  });

  // Snap crossfade duration to half-bar or full-bar when BPM is known so rhythm locks across seams
  let xfSec = Math.max(0.25, Math.min(6.0, Number(crossfadeSec) || 2.0));
  if (bpm > 0) {
    const barSec = (60 / bpm) * (Number(beatsPerBar) || 4);
    const halfBar = barSec / 2;
    xfSec = Math.max(halfBar, Math.round(xfSec / halfBar) * halfBar);
  }
  const xfSamples = Math.floor(xfSec * sr);

  // Merge sequentially with equal-power sine/cosine crossfade
  let acc = prepared[0];
  for (let s = 1; s < prepared.length; s++) {
    const next = prepared[s];
    const lenA = acc.channels[0].length;
    const lenB = next.channels[0].length;
    const xf = Math.min(xfSamples, Math.floor(lenA * 0.4), Math.floor(lenB * 0.4));
    const totalLen = lenA + lenB - xf;

    const mergedChannels = [];
    for (let c = 0; c < numCh; c++) {
      const a = acc.channels[c];
      const b = next.channels[c];
      const out = new Float32Array(totalLen);
      out.set(a.subarray(0, lenA - xf), 0);
      for (let i = 0; i < xf; i++) {
        const t = i / Math.max(1, xf);
        const fadeOut = Math.cos((t * Math.PI) / 2);
        const fadeIn = Math.sin((t * Math.PI) / 2);
        out[lenA - xf + i] = a[lenA - xf + i] * fadeOut + b[i] * fadeIn;
      }
      out.set(b.subarray(xf), lenA);
      mergedChannels.push(out);
    }
    acc = { sampleRate: sr, channels: mergedChannels };
  }

  return acc;
}

/**
 * Split long uploaded/recorded audio (> maxChunkSec) into overlapping chunks so AI remix
 * engines can revise full 5-10 minute tracks section-by-section without truncation.
 */
export function splitIntoChunks(audio, maxChunkSec = 180, overlapSec = 3.0) {
  const sr = audio.sampleRate;
  const totalSamples = audio.channels[0].length;
  const chunkSamples = Math.max(sr * 10, Math.floor(maxChunkSec * sr));
  if (totalSamples <= chunkSamples) return [audio];

  const overlapSamples = Math.min(Math.floor(overlapSec * sr), Math.floor(chunkSamples * 0.25));
  const step = Math.max(sr * 5, chunkSamples - overlapSamples);
  const chunks = [];
  for (let start = 0; start < totalSamples; start += step) {
    const end = Math.min(totalSamples, start + chunkSamples);
    chunks.push({
      sampleRate: sr,
      channels: audio.channels.map(ch => ch.slice(start, end)),
    });
    if (end >= totalSamples) break;
  }
  return chunks;
}

// RBJ Audio EQ Cookbook Biquad coefficient builders
function biquadShelfCoeffs(type, freq, sampleRate, gainDb, Q = 0.707) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * Math.min(sampleRate * 0.45, Math.max(20, freq))) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Q);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;

  let b0; let b1; let b2; let a0; let a1; let a2;
  if (type === 'lowshelf') {
    b0 = A * ((A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha);
    b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
    b2 = A * ((A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha);
    a0 = (A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha;
    a1 = -2 * ((A - 1) + (A + 1) * cosW0);
    a2 = (A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha;
  } else if (type === 'highshelf') {
    b0 = A * ((A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha);
    b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
    b2 = A * ((A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha);
    a0 = (A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha;
    a1 = 2 * ((A - 1) - (A + 1) * cosW0);
    a2 = (A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha;
  } else {
    // peaking EQ
    b0 = 1 + alpha * A;
    b1 = -2 * cosW0;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosW0;
    a2 = 1 - alpha / A;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function runBiquad(samples, c) {
  const out = new Float32Array(samples.length);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

/**
 * Pure-PCM Studio Mastering Chain (offline, zero-GPU, Node & Browser compatible):
 * 1. Optional dead-air head/tail trim
 * 2. 3-Band Biquad EQ (Low Shelf 120Hz, Mid Peaking 1200Hz, High Shelf 6500Hz)
 * 3. Envelope-following soft-knee Dynamics Compressor + makeup gain
 * 4. Mid/Side Stereo Width polish (stereo tracks)
 * 5. Soft-clip Brickwall Limiter + Target Peak Normalization + Clean Fades
 */
export function applyDspMastering(
  audio,
  {
    lowGainDb = 0,
    midGainDb = 0,
    highGainDb = 0,
    compressionRatio = 2.0,
    thresholdDb = -16,
    stereoWidth = 1.0,
    targetPeak = 0.94,
    trimDeadAir = false,
    fadeInSec = 0.15,
    fadeOutSec = 0.4,
  } = {}
) {
  let work = { sampleRate: audio.sampleRate, channels: audio.channels.map(c => c.slice()) };
  const sr = work.sampleRate;

  // 1. Optional Dead-Air Trim
  if (trimDeadAir) {
    const r = activeRange(work, { windowSec: 0.2, ratio: 0.12 });
    const pad = Math.floor(0.25 * sr);
    const start = Math.max(0, r.start - pad);
    const end = Math.min(work.channels[0].length, r.end + pad);
    if (end - start > sr * 0.5) {
      work = { sampleRate: sr, channels: work.channels.map(c => c.slice(start, end)) };
    }
  }

  // 2. 3-Band Biquad EQ
  const lowDb = Math.max(-8, Math.min(8, Number(lowGainDb) || 0));
  const midDb = Math.max(-8, Math.min(8, Number(midGainDb) || 0));
  const highDb = Math.max(-8, Math.min(8, Number(highGainDb) || 0));
  const lowC = Math.abs(lowDb) > 0.05 ? biquadShelfCoeffs('lowshelf', 120, sr, lowDb) : null;
  const midC = Math.abs(midDb) > 0.05 ? biquadShelfCoeffs('peaking', 1200, sr, midDb, 1.0) : null;
  const highC = Math.abs(highDb) > 0.05 ? biquadShelfCoeffs('highshelf', 6500, sr, highDb) : null;

  work.channels = work.channels.map(ch => {
    let cur = ch;
    if (lowC) cur = runBiquad(cur, lowC);
    if (midC) cur = runBiquad(cur, midC);
    if (highC) cur = runBiquad(cur, highC);
    return cur;
  });

  // 3. Coupled-Channel Soft-Knee Dynamics Compressor
  const ratio = Math.max(1.0, Math.min(8.0, Number(compressionRatio) || 1.0));
  if (ratio > 1.05) {
    const n = work.channels[0].length;
    const attack = Math.exp(-1 / (0.015 * sr));
    const release = Math.exp(-1 / (0.16 * sr));
    const thresh = Number(thresholdDb) || -16;
    const knee = 6;
    let env = 0;
    const gainCurve = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      let peak = 0;
      for (let c = 0; c < work.channels.length; c++) {
        const a = Math.abs(work.channels[c][i]);
        if (a > peak) peak = a;
      }
      env = peak > env ? attack * env + (1 - attack) * peak : release * env + (1 - release) * peak;
      const envDb = 20 * Math.log10(Math.max(1e-6, env));
      let gainRedDb = 0;
      if (envDb > thresh + knee / 2) {
        gainRedDb = (thresh - envDb) * (1 - 1 / ratio);
      } else if (envDb > thresh - knee / 2) {
        const x = envDb - thresh + knee / 2;
        gainRedDb = -((1 - 1 / ratio) * x * x) / (2 * knee);
      }
      gainCurve[i] = Math.pow(10, gainRedDb / 20);
    }

    for (const ch of work.channels) {
      for (let i = 0; i < n; i++) ch[i] *= gainCurve[i];
    }
  }

  // 4. Mid/Side Stereo Width Polish (only when stereo)
  const width = Math.max(0.4, Math.min(1.6, Number(stereoWidth) || 1.0));
  if (work.channels.length >= 2 && Math.abs(width - 1.0) > 0.02) {
    const L = work.channels[0];
    const R = work.channels[1];
    for (let i = 0; i < L.length; i++) {
      const mid = (L[i] + R[i]) * 0.5;
      const side = (L[i] - R[i]) * 0.5 * width;
      L[i] = mid + side;
      R[i] = mid - side;
    }
  }

  // 5. Soft Brickwall Limiter + Peak Normalization + Clean Fades
  const peakTarget = Math.max(0.5, Math.min(0.99, Number(targetPeak) || 0.94));
  work = normalize(work, peakTarget);
  for (const ch of work.channels) {
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) > peakTarget) {
        ch[i] = Math.tanh(ch[i] / peakTarget) * peakTarget;
      }
    }
  }

  const fi = Math.max(0, Number(fadeInSec) || 0);
  const fo = Math.max(0, Number(fadeOutSec) || 0);
  if (fi > 0 || fo > 0) work = fade(work, fi, fo);
  return work;
}
