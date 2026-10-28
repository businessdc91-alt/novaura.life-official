// neuralHypervisorService.js — Local Sovereign Neural Hypervisor & Model Deck
// Manages local LLM inference engines (Ollama, LM Studio), models library,
// live streaming model puller, benchmarks (tokens/sec, TTFT), and ComfyUI discovery.

import { db } from '../database/sovereignDatabase.js';
import { probeLocalAi } from './nativeService.js';

const OLLAMA_DEFAULT = 'http://localhost:11434';
const LMSTUDIO_DEFAULT = 'http://localhost:1234';
const COMFYUI_DEFAULT = 'http://127.0.0.1:8188';

export async function getEndpointUrls() {
  try {
    const saved = localStorage.getItem('novaura_hypervisor_endpoints');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    ollama: OLLAMA_DEFAULT,
    lmstudio: LMSTUDIO_DEFAULT,
    comfyui: COMFYUI_DEFAULT,
  };
}

export function saveEndpointUrls(endpoints) {
  try {
    localStorage.setItem('novaura_hypervisor_endpoints', JSON.stringify(endpoints));
  } catch {}
}

/**
 * Detect host GPU and WebGL/WebGPU hardware acceleration capabilities
 */
export function detectHostComputeHardware() {
  const hardware = {
    gpuVendor: 'Unknown',
    gpuRenderer: 'CPU / Software Rasterizer',
    webgpuAvailable: false,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGb: navigator.deviceMemory || 'Unknown',
    platform: navigator.platform || 'PC',
  };

  if (typeof navigator !== 'undefined' && navigator.gpu) {
    hardware.webgpuAvailable = true;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        hardware.gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Generic';
        hardware.gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Generic GPU';
      }
    }
  } catch {}

  return hardware;
}

/**
 * Probe all local AI daemons
 */
export async function probeLocalDaemons() {
  const endpoints = await getEndpointUrls();
  const results = {
    ollama: { online: false, version: null, models: [], error: null },
    lmstudio: { online: false, models: [], error: null },
    comfyui: { online: false, system: null, error: null },
  };

  // 1. Probe Ollama
  try {
    const olProbe = await probeLocalAi(11434, '/api/tags');
    if (olProbe && olProbe.online) {
      results.ollama.online = true;
      results.ollama.version = olProbe.version || 'Active';
      results.ollama.models = (olProbe.models || []).map(name => ({
        id: name,
        name: name,
        sizeBytes: 0,
        sizeGb: 'Dynamic',
        modifiedAt: new Date().toISOString(),
        digest: null,
        details: {},
        family: 'llm',
        parameterSize: 'Dynamic',
        quantizationLevel: 'Native',
      }));
    } else {
      results.ollama.error = olProbe?.error || 'Offline';
    }
  } catch (err) {
    results.ollama.error = err.message || 'Offline';
  }

  // 2. Probe LM Studio
  try {
    const lmProbe = await probeLocalAi(1234, '/v1/models');
    if (lmProbe && lmProbe.online) {
      results.lmstudio.online = true;
      results.lmstudio.models = (lmProbe.models || []).map(id => ({
        id,
        name: id,
        ownedBy: 'local',
      }));
    } else {
      results.lmstudio.error = lmProbe?.error || 'Offline';
    }
  } catch (err) {
    results.lmstudio.error = err.message || 'Offline';
  }

  // 3. Probe ComfyUI
  try {
    const comfyRes = await fetch(`${endpoints.comfyui}/system_stats`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (comfyRes.ok) {
      const data = await comfyRes.json();
      results.comfyui.online = true;
      results.comfyui.system = data.system || null;
      results.comfyui.devices = data.devices || [];
    }
  } catch (err) {
    results.comfyui.error = err.message || 'Offline';
  }

  return results;
}

/**
 * Stream pull an Ollama model with real download progress
 */
export async function pullOllamaModel(modelName, onProgress) {
  const endpoints = await getEndpointUrls();
  const res = await fetch(`${endpoints.ollama}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName.trim(), stream: true }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pull failed (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep last incomplete chunk

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const payload = JSON.parse(line);
        if (onProgress) onProgress(payload);
      } catch {}
    }
  }
}

/**
 * Delete an Ollama model from local drive
 */
export async function deleteOllamaModel(modelName) {
  const endpoints = await getEndpointUrls();
  const res = await fetch(`${endpoints.ollama}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Delete failed (${res.status}): ${errText}`);
  }
  return true;
}

/**
 * Inspect model metadata from Ollama (/api/show)
 */
export async function inspectOllamaModel(modelName) {
  const endpoints = await getEndpointUrls();
  const res = await fetch(`${endpoints.ollama}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
  });

  if (!res.ok) {
    throw new Error(`Failed to inspect model ${modelName}`);
  }
  return await res.json();
}

/**
 * Run a live benchmark test on a model to measure real tokens/sec and TTFT
 */
export async function benchmarkModelInference({
  backend = 'ollama',
  modelId,
  testPrompt = 'Explain the mathematical foundation of entropy in two sentences.',
  maxTokens = 80,
  onToken,
}) {
  const endpoints = await getEndpointUrls();
  const startTime = performance.now();
  let firstTokenTime = null;
  let tokenCount = 0;
  let responseText = '';

  if (backend === 'ollama') {
    const res = await fetch(`${endpoints.ollama}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: testPrompt,
        stream: true,
        options: { num_predict: maxTokens, temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama benchmark failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.response) {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
            }
            tokenCount += 1;
            responseText += chunk.response;
            if (onToken) onToken(chunk.response);
          }
        } catch {}
      }
    }
  } else if (backend === 'lmstudio') {
    const res = await fetch(`${endpoints.lmstudio}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`LM Studio benchmark failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const clean = line.replace(/^data:\s*/, '').trim();
        if (!clean || clean === '[DONE]') continue;
        try {
          const chunk = JSON.parse(clean);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
            }
            tokenCount += 1;
            responseText += delta;
            if (onToken) onToken(delta);
          }
        } catch {}
      }
    }
  }

  const endTime = performance.now();
  const totalDurationMs = endTime - startTime;
  const generationDurationMs = firstTokenTime ? (endTime - firstTokenTime) : totalDurationMs;
  const ttftMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : Math.round(totalDurationMs);
  const tokensPerSec = generationDurationMs > 0 ? ((tokenCount / (generationDurationMs / 1000))).toFixed(1) : '0';

  return {
    modelId,
    backend,
    tokenCount,
    totalDurationMs: Math.round(totalDurationMs),
    ttftMs,
    tokensPerSec: parseFloat(tokensPerSec),
    responseText,
  };
}
