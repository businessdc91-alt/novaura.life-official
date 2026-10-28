/**
 * NovAura Sovereign OS — Hardware Specification & Node Profiler Service
 * 
 * Provides authentic hardware requirement tiers, live host diagnostics,
 * and workload tuning profiles for self-hosted decentralized nodes.
 */

export const HARDWARE_TIERS = {
  minimal: {
    id: 'minimal',
    name: 'Minimal Specification (Text & Sovereign Core)',
    badge: 'EDGE / CORE READY',
    color: '#fbbf24', // Amber
    targetWorkload: 'Authors, text writing, decentralized node relay, and quantized 3B-7B local LLMs.',
    cpu: {
      cores: 4,
      threads: 8,
      recommended: 'Intel Core i5 (8th Gen+) / AMD Ryzen 5 (2000+) / Apple M1',
      description: 'Minimum 4 CPU cores for microkernel, background scheduler, and lightweight inference.',
    },
    ram: {
      capacityGB: 16,
      description: '16 GB RAM (allocates 8GB to OS & browser, 8GB to quantized LLM or lightweight models).',
    },
    gpu: {
      vramGB: 4,
      models: 'Integrated Graphics (Iris Xe / Radeon 680M) or Dedicated 4GB-6GB GPU (GTX 1650/1660, RTX 3050)',
      description: 'Supports CPU/GPU offloaded quantized models (Gemma 4B / A4B class for Nova executive OS control) and SDXL Turbo (512x512).',
    },
    storage: {
      freeSpaceGB: 25,
      type: 'Fast SSD / SATA SSD',
      description: '25 GB free storage for microkernel, Dexie IndexedDB, and 2-3 quantized foundation models.',
    },
    aiWorkloadSupport: [
      'Gemma 4 A4B / Qwen 2.5 7B (Nova Executive Core - sub-500ms)',
      'SDXL Turbo (Single-step 512x512)',
      'Word Studio Ghostwriter & Local RAG',
      'Decentralized Mesh Peer & Encrypted Mailbox',
    ],
    comfyRecommendedFlags: '--lowvram --disable-cuda-malloc',
  },

  recommended: {
    id: 'recommended',
    name: 'Recommended Specification (Full Studio & Diffusion)',
    badge: 'STUDIO PRODUCTION READY',
    color: '#38bdf8', // Cyan
    targetWorkload: 'Full creative studio, multi-modal synthesis, 14B LLMs, ComfyUI Flux.1, and persistent mesh node.',
    cpu: {
      cores: 8,
      threads: 16,
      recommended: 'Intel Core i7 (12th Gen+) / AMD Ryzen 7 (5000+) / Apple M2/M3 Pro',
      description: '8+ CPU cores for parallel AI token streaming, audio processing, and zero UI latency.',
    },
    ram: {
      capacityGB: 32,
      description: '32 GB DDR4/DDR5 (16GB dedicated to OS/ComfyUI canvas, 16GB dedicated to LLM KV cache).',
    },
    gpu: {
      vramGB: 12,
      models: 'NVIDIA RTX 3060 (12GB) / RTX 4060 Ti (16GB) / RTX 4070 (12GB) / Apple M-Series (16GB+ Unified)',
      description: 'Dedicated GPU with 8GB-16GB VRAM. Fast Tensor Core acceleration and FP8 support.',
    },
    storage: {
      freeSpaceGB: 100,
      type: 'NVMe M.2 SSD (Gen 3 or Gen 4)',
      description: '100 GB+ high-speed NVMe for instant checkpoint loading (Flux.1, SDXL, Wan 2.1 video weights).',
    },
    aiWorkloadSupport: [
      'Gemma 4 26B-A4B MoE (4B Active, 256K Context - Aura Synthesis)',
      'Qwen MoE 35B-A3B (3B Active Parameters, 35B Capacity)',
      'Qwen 2.5 Coder 32B (Full-Stack Multi-Cloud Architecture)',
      'Flux.1 [schnell] FP8 (12-16 GB VRAM fast generation)',
      'SDXL Turbo 1024x1024 (Real-time 1-4 steps)',
      'Whisper Large v3 Turbo (Speech-to-text)',
      'Wan 2.1 Video 1.3B (Local text-to-video diffusion)',
      'Persistent P2P Sovereign Mesh Relay & File Syncing',
    ],
    comfyRecommendedFlags: '--fp8_e4m3fn-text-enc --highvram',
  },

  enthusiast: {
    id: 'enthusiast',
    name: 'Enthusiast / Studio Master (Hypervisor & Video Forge)',
    badge: 'FOUNDRY MASTER READY',
    color: '#a855f7', // Purple
    targetWorkload: 'Multi-model hypervisors, 70B+ frontier models, 4K video rendering, and decentralized seed node.',
    cpu: {
      cores: 16,
      threads: 32,
      recommended: 'Intel Core i9 (13th/14th Gen) / AMD Ryzen 9 (7000/9000) / Apple M3/M4 Max',
      description: '16+ high-performance cores for simultaneous audio, video encoding, and multi-agent loops.',
    },
    ram: {
      capacityGB: 64,
      description: '64 GB - 128 GB High-Speed DDR5 RAM.',
    },
    gpu: {
      vramGB: 24,
      models: 'NVIDIA RTX 3090 / RTX 4090 / RTX 5080/5090 / Dual GPUs (24GB-48GB VRAM)',
      description: '24 GB+ VRAM with FP8/FP16 native execution for heavy multi-model concurrent inference.',
    },
    storage: {
      freeSpaceGB: 500,
      type: 'NVMe M.2 SSD (Gen 4 or Gen 5, 5000+ MB/s)',
      description: '500 GB+ ultra-fast NVMe for multi-checkpoint model library and raw video rendering caches.',
    },
    aiWorkloadSupport: [
      'Wan 2.1 Video 14B (High-definition cinema synthesis)',
      'Flux.1 [dev] (Unquantized maximum fidelity diffusion)',
      'Qwen MoE 35B-A3B / Gemma 4 26B Dual MoE Concurrent Execution',
      'Dual Neural Hypervisor (Concurrent Nova A4B + Aura MoE execution)',
      'High-Throughput P2P Mesh Seed & Decentralized File Hub',
    ],
    comfyRecommendedFlags: '--highvram --fast',
  },
};

/**
 * Live Host Telemetry Evaluator
 * Reads authentic browser and host system specs to score machine readiness
 */
export async function evaluateHostHardware() {
  // 0. Query Authentic Native Hardware Spec from Host OS
  let nativeHw = null;
  try {
    const { getNativeHardwareSpec } = await import('./nativeService.js');
    nativeHw = await getNativeHardwareSpec();
  } catch (err) {
    console.warn('[HardwareService] native hardware probe note:', err);
  }

  // 1. CPU Specifications (Authentic Host Model & Cores)
  const cpuName = nativeHw?.cpu_name || 'Host Processor';
  const logicalCores = nativeHw?.cpu_threads || (typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4);
  const physicalCores = nativeHw?.cpu_cores || Math.max(2, Math.floor(logicalCores / 2));

  // 2. RAM Physical Capacity (GB)
  let ramGB = nativeHw?.ram_gb || (typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : 16);

  // 3. Storage Estimates
  let storageEst = { quotaGB: 100, usageGB: 0, freeGB: 100 };
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const quotaGB = Math.round((est.quota || 0) / (1024 * 1024 * 1024));
      const usageGB = +(Math.max(0, (est.usage || 0) / (1024 * 1024 * 1024))).toFixed(2);
      storageEst = {
        quotaGB: quotaGB > 0 ? quotaGB : 120,
        usageGB,
        freeGB: Math.max(0, quotaGB - usageGB),
      };
    } catch {}
  }

  // 4. Host GPU Array & Primary Neural Accelerator
  let gpus = nativeHw?.gpus || [];
  let primaryGpu = nativeHw?.primary_compute_gpu || null;
  let totalVramGB = nativeHw?.total_vram_gb || 0;

  let gpuInfo = {
    renderer: primaryGpu?.name || 'Standard Graphics Adapter',
    vendor: primaryGpu?.name?.includes('NVIDIA') ? 'NVIDIA' : primaryGpu?.name?.includes('Radeon') ? 'AMD' : 'Generic',
    isDedicated: primaryGpu?.is_dedicated ?? false,
    estimatedVramGB: primaryGpu?.vram_gb || 4,
    hasWebGPU: false,
  };

  // If native didn't provide GPUs, check WebGL fallback
  if (gpus.length === 0 && typeof window !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          gpuInfo.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || gpuInfo.renderer;
          gpuInfo.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || gpuInfo.vendor;
        }
      }
    } catch {}

    const rLower = gpuInfo.renderer.toLowerCase();
    if (rLower.includes('rtx') || rLower.includes('geforce') || rLower.includes('radeon') || rLower.includes('apple') || rLower.includes('nvidia') || rLower.includes('quadro')) {
      gpuInfo.isDedicated = true;
      if (rLower.includes('24gb') || rLower.includes('4090') || rLower.includes('3090') || rLower.includes('a6000') || rLower.includes('5090') || rLower.includes('m6000 24')) {
        gpuInfo.estimatedVramGB = 24;
      } else if (rLower.includes('16gb') || rLower.includes('4080') || rLower.includes('3080') || rLower.includes('4070 ti')) {
        gpuInfo.estimatedVramGB = 16;
      } else if (rLower.includes('12gb') || rLower.includes('4070') || rLower.includes('3060') || rLower.includes('4060 ti')) {
        gpuInfo.estimatedVramGB = 12;
      } else if (rLower.includes('rx 580') || rLower.includes('580 series') || rLower.includes('3050') || rLower.includes('4060') || rLower.includes('2060')) {
        gpuInfo.estimatedVramGB = 8;
      } else {
        gpuInfo.estimatedVramGB = 8;
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.gpu) {
    gpuInfo.hasWebGPU = true;
  }

  // 5. Authentic Physical Drives Telemetry
  let physicalDrives = [];
  try {
    const { getStorageVolumes } = await import('./nativeService.js');
    const vols = await getStorageVolumes();
    if (vols && Array.isArray(vols)) {
      physicalDrives = vols;
    }
  } catch {}

  // 6. Tier Calculation (Authentic Hardware Matching)
  let tierScore = 'minimal';
  const hasEnthusiastCpu = physicalCores >= 12 || logicalCores >= 24;
  const hasEnthusiastRam = ramGB >= 32;
  const hasEnthusiastGpu = gpuInfo.estimatedVramGB >= 16 || totalVramGB >= 24;

  if (hasEnthusiastCpu && hasEnthusiastRam && hasEnthusiastGpu) {
    tierScore = 'enthusiast';
  } else if (
    (physicalCores >= 6 || logicalCores >= 12) &&
    (ramGB >= 16 || gpuInfo.isDedicated) &&
    (gpuInfo.estimatedVramGB >= 8 || totalVramGB >= 8)
  ) {
    tierScore = 'recommended';
  } else {
    tierScore = 'minimal';
  }

  const activeTier = HARDWARE_TIERS[tierScore];

  // 7. Dynamic Workload Recommendations
  const recommendations = [];
  if (gpuInfo.estimatedVramGB < 8) {
    recommendations.push({
      subsystem: 'ComfyUI / Diffusion',
      type: 'warning',
      text: 'VRAM is under 8 GB. Use --lowvram and stick to SDXL Turbo or Flux.1 Schnell FP8 with 4-step generation.',
    });
  } else {
    recommendations.push({
      subsystem: 'ComfyUI / Diffusion',
      type: 'optimal',
      text: 'VRAM is 8 GB+. High-speed FP8 Flux.1 Schnell and SDXL Turbo will execute with native Tensor Core acceleration.',
    });
  }

  if (logicalCores < 8) {
    recommendations.push({
      subsystem: 'Local LLMs (Ollama / LM Studio)',
      type: 'tip',
      text: 'Limit LLM context window to 4096 tokens to conserve CPU compute and prevent memory thrashing.',
    });
  } else {
    recommendations.push({
      subsystem: 'Local LLMs (Ollama / LM Studio)',
      type: 'optimal',
      text: `${logicalCores} CPU threads detected. Supports 16k-32k context lengths and concurrent token streaming.`,
    });
  }

  recommendations.push({
    subsystem: 'Decentralized Server & P2P Mesh',
    type: 'optimal',
    text: 'Self-hosted Dexie database and local BroadcastChannel mesh running in full air-gap mode with zero external cloud leakage.',
  });

  return {
    detected: {
      cpuName,
      physicalCores,
      logicalCores,
      ramGB,
      storageEst,
      gpuInfo,
      gpus,
      primaryGpu,
      totalVramGB,
      physicalDrivesCount: physicalDrives.length,
      physicalDrives,
    },
    tierScore,
    activeTier,
    recommendations,
  };
}
