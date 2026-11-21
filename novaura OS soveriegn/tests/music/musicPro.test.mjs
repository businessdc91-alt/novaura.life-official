import test from 'node:test';
import assert from 'node:assert/strict';

import {
  durationOf,
  resampleAudio,
  concatWithCrossfade,
  splitIntoChunks,
  applyDspMastering,
  encodeWav,
} from '../../src/services/music/audioTools.js';
import {
  analyzeSongAudio,
  planExtendedSections,
  critiqueAndPlanRevision,
} from '../../src/services/music/songAnalyzer.js';

function makeSineAudio({ sampleRate = 22050, seconds = 6, freq = 440, amp = 0.5, channels = 2 }) {
  const n = Math.floor(sampleRate * seconds);
  const chs = [];
  for (let c = 0; c < channels; c++) {
    const arr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      arr[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * amp;
    }
    chs.push(arr);
  }
  return { sampleRate, channels: chs };
}

test('concatWithCrossfade chains multi-section audio cleanly across sample rates and splitIntoChunks chunks 7-min tracks', () => {
  const segA = makeSineAudio({ sampleRate: 22050, seconds: 6, freq: 220, amp: 0.5, channels: 2 });
  const segB = makeSineAudio({ sampleRate: 11025, seconds: 6, freq: 330, amp: 0.5, channels: 1 });

  const resampled = resampleAudio(segB, 22050);
  assert.equal(resampled.sampleRate, 22050);
  assert.ok(Math.abs(durationOf(resampled) - 6) < 0.05);

  const stitched = concatWithCrossfade([segA, segB], { bpm: 120, beatsPerBar: 4, crossfadeSec: 2.0, trimEdges: false });
  assert.equal(stitched.sampleRate, 22050);
  assert.equal(stitched.channels.length, 2);
  // 6s + 6s - 2s crossfade = 10s
  assert.ok(Math.abs(durationOf(stitched) - 10.0) < 0.1, `Expected ~10s, got ${durationOf(stitched)}`);

  for (const ch of stitched.channels) {
    for (let i = 0; i < ch.length; i++) {
      assert.ok(Number.isFinite(ch[i]), 'Sample must be finite');
      assert.ok(Math.abs(ch[i]) <= 1.01, 'Equal-power crossfade must not clip');
    }
  }

  // Split 7-minute (420s) track cleanly into overlapping 180s chunks
  const longDummy = { sampleRate: 1000, channels: [new Float32Array(420000).fill(0.1)] };
  const chunks = splitIntoChunks(longDummy, 180, 3);
  assert.equal(chunks.length, 3);
  assert.equal(Math.round(durationOf(chunks[0])), 180);
  assert.equal(Math.round(durationOf(chunks[1])), 180);
  assert.ok(durationOf(chunks[2]) >= 60);
});

test('applyDspMastering trims dead air, applies 3-band EQ, compresses, and normalizes cleanly without NaN', () => {
  const sr = 22050;
  const totalSamples = sr * 8; // 2s silence + 4s signal + 2s silence
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);
  for (let i = sr * 2; i < sr * 6; i++) {
    const t = i / sr;
    // Heavy low bass (90 Hz) + weak high tone (5000 Hz)
    const low = Math.sin(2 * Math.PI * 90 * t) * 0.25;
    const high = Math.sin(2 * Math.PI * 5000 * t) * 0.04;
    left[i] = low + high;
    right[i] = low * 0.9 + high * 1.1;
  }
  const raw = { sampleRate: sr, channels: [left, right] };
  const before = analyzeSongAudio(raw);
  assert.ok(before.leadingSilenceSec >= 1.5, `Expected >=1.5s leading silence, got ${before.leadingSilenceSec}`);

  const mastered = applyDspMastering(raw, {
    lowGainDb: -4.0,
    midGainDb: 0,
    highGainDb: 5.0,
    compressionRatio: 3.0,
    stereoWidth: 1.2,
    targetPeak: 0.94,
    trimDeadAir: true,
    fadeInSec: 0.1,
    fadeOutSec: 0.2,
  });

  const after = analyzeSongAudio(mastered);
  assert.ok(after.durationSec < before.durationSec - 2.0, 'Dead air should be trimmed cleanly');
  assert.ok(after.loudnessDb > before.loudnessDb, 'Mastering should lift quiet track loudness');
  assert.ok(after.spectralBalance.highPct > before.spectralBalance.highPct, 'High shelf boost should brighten spectral balance');
  assert.ok(after.clippedSamples === 0, 'Brickwall limiter must keep zero clipped samples');

  const wavBytes = encodeWav(mastered);
  assert.equal(String.fromCharCode(...wavBytes.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wavBytes.slice(8, 12)), 'WAVE');
});

test('analyzeSongAudio measures real 120 BPM pulse, tonal spectrum, loudness, and acoustic flags', () => {
  const sr = 22050;
  const seconds = 12;
  const n = sr * seconds;
  const buf = new Float32Array(n);

  // Synthesize crisp 120 BPM beat bursts (every 0.500s) layered over A-minor chord (220/261.63/329.63 Hz)
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beatPhase = t % 0.5;
    const kickEnv = Math.exp(-beatPhase * 28);
    const kick = Math.sin(2 * Math.PI * 110 * t) * kickEnv * 0.65;
    const chord =
      (Math.sin(2 * Math.PI * 220 * t) +
        Math.sin(2 * Math.PI * 261.63 * t) +
        Math.sin(2 * Math.PI * 329.63 * t)) *
      0.12;
    buf[i] = kick + chord;
  }

  const analysis = analyzeSongAudio({ sampleRate: sr, channels: [buf] });
  assert.equal(analysis.durationSec, 12);
  assert.ok(
    Math.abs(analysis.estimatedBpm - 120) <= 6,
    `Expected BPM near 120, measured ${analysis.estimatedBpm}`
  );
  assert.equal(
    analysis.spectralBalance.bassPct + analysis.spectralBalance.midPct + analysis.spectralBalance.highPct,
    100
  );
  assert.ok(analysis.energyArc.length >= 8);
  assert.ok(analysis.issues.length >= 1);
  assert.ok(typeof analysis.estimatedKey === 'string' && analysis.estimatedKey.includes(' '));
});

test('planExtendedSections scales 30s-600s songs into 1-4 coherent sections and distributes lyrics', () => {
  const shortPlan = planExtendedSections({ mode: 'song', seconds: 180, lyrics: '[Verse]\nHello' });
  assert.equal(shortPlan.length, 1);

  const lyrics = [
    '[Intro]\nSoft piano',
    '[Verse 1]\nLine A',
    '[Chorus]\nHook A',
    '[Verse 2]\nLine B',
    '[Bridge]\nLift up',
    '[Outro]\nFade away',
  ].join('\n\n');

  const fiveMin = planExtendedSections({ mode: 'song', seconds: 300, lyrics });
  assert.equal(fiveMin.length, 2);
  assert.match(fiveMin[0].lyrics, /Verse 1/);
  assert.match(fiveMin[1].lyrics, /Outro/);

  const tenMin = planExtendedSections({ mode: 'song', seconds: 600, lyrics });
  assert.equal(tenMin.length, 4);
  for (const part of tenMin) {
    assert.ok(part.seconds >= 90 && part.seconds <= 200);
    assert.ok(part.arcCue.length > 10);
  }
});

test('critiqueAndPlanRevision works offline via DSP fallback and merges structured LLM Producer JSON', async () => {
  const sample = makeSineAudio({ sampleRate: 22050, seconds: 6, freq: 100, amp: 0.15, channels: 2 });
  const analysis = analyzeSongAudio(sample);

  // 1. Offline acoustic fallback
  const offlinePlan = await critiqueAndPlanRevision(analysis, {
    title: 'Demo Track',
    genre: 'Synthwave',
    goal: 'flow',
  });
  assert.equal(offlinePlan.source, 'acoustic-dsp');
  assert.ok(offlinePlan.overallScore >= 45 && offlinePlan.overallScore <= 96);
  assert.ok(offlinePlan.revisedTags.includes('Synthwave'));

  // 2. LLM Producer JSON merge with safety clamping
  const aiPlan = await critiqueAndPlanRevision(analysis, {
    title: 'Demo Track',
    genre: 'Synthwave',
    goal: 'energy',
    chatFn: async () =>
      JSON.stringify({
        overallScore: 87,
        summary: 'Great synth pulse; tighten low-end and lift chorus brightness.',
        strengths: ['Warm analog vibe'],
        improvements: ['Cut 120Hz boom', 'Boost 6.5kHz air'],
        revisedTags: 'synthwave, punchy chorus lift, tight analog bass, wide stereo pads',
        revisedLyrics: '[Chorus]\nNeon skyline shining bright',
        recommendedRemixStrength: 0.52,
        dspParams: { lowGainDb: -15, highGainDb: 3.0, compressionRatio: 2.5, stereoWidth: 1.2, trimDeadAir: true },
      }),
  });
  assert.equal(aiPlan.source, 'ai-producer');
  assert.equal(aiPlan.overallScore, 87);
  assert.equal(aiPlan.dspParams.lowGainDb, -6); // clamped safely from -15 to -6
  assert.equal(aiPlan.dspParams.highGainDb, 3.0);
  assert.match(aiPlan.revisedLyrics, /Neon skyline/);
});

