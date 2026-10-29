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
