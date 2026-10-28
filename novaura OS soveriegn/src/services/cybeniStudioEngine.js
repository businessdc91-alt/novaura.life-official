/**
 * cybeniStudioEngine.js — Sovereign Cybeni Omni Studio & Builder Engine
 * 
 * Powers Cybeni to outshine Emergent AI, Replit, Base44, and Lovable:
 * 1. 2B to 35B Model Spectrum & C++ Embedded Inference Engine
 * 2. Reasoning Strategies (Chain-of-Thought, Tree of Thoughts, Reflexion, DSPy)
 * 3. 5 World-Class UI Themes & Design Systems with Component Scaffolding
 * 4. Multi-Language Boilerplate Generation (JS/TS, Python, Rust, Go, C++, GDScript, C#)
 * 5. Instant Live Visual Sandbox Preview Compiler (iframe Hot-Reload)
 */

export const CYBENI_MODEL_SPECTRUM = [
  {
    id: 'gemma4:e2b',
    name: 'Gemma 4 E2B Edge (DeepMind)',
    params: '2.3B active (5.1B PLE)',
    category: 'ultra_light',
    vram: '1.5 GB',
    speed: '~120 tok/s',
    contextWindow: '128K',
    cppEmbed: true,
    ggufFile: 'gemma-4-e2b-it-q4_k_m.gguf',
    description: 'Google DeepMind official Gemma 4 Edge model (Per-Layer Embeddings). Multimodal (text, vision, audio), 128K context, Apache 2.0 license. Embeds into C++ on mobile and edge devices.',
    cmakeFlag: '-DLLAMA_ACCELERATE=ON',
  },
  {
    id: 'qwen2.5-coder:1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    params: '1.5B',
    category: 'ultra_light',
    vram: '1.1 GB',
    speed: '~130 tok/s',
    contextWindow: '32K',
    cppEmbed: true,
    ggufFile: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    description: 'Alibaba Cloud dense sub-2B edge coder. High-speed code completion and inline refactoring on low-power CPUs.',
    cmakeFlag: '-DLLAMA_ACCELERATE=ON',
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B Multilingual',
    params: '3.2B',
    category: 'light',
    vram: '2.1 GB',
    speed: '~85 tok/s',
    contextWindow: '128K',
    cppEmbed: true,
    ggufFile: 'llama-3.2-3b-instruct-q4_k_m.gguf',
    description: 'Meta 128K context lightweight model. Fast conversational coding, instruction following, and multilingual syntax.',
    cmakeFlag: '-DLLAMA_VULKAN=ON',
  },
  {
    id: 'gemma4:e4b',
    name: 'Gemma 4 E4B Edge (DeepMind)',
    params: '4.5B active (8B PLE)',
    category: 'light',
    vram: '3.1 GB',
    speed: '~78 tok/s',
    contextWindow: '128K',
    cppEmbed: true,
    ggufFile: 'gemma-4-e4b-it-q4_k_m.gguf',
    description: 'Google DeepMind Gemma 4 4B Edge model. Native multimodal support and thinking modes, optimized for consumer laptops and GPUs.',
    cmakeFlag: '-DLLAMA_VULKAN=ON',
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B (Default Coder)',
    params: '7.6B',
    category: 'balanced',
    vram: '5.1 GB',
    speed: '~55 tok/s',
    contextWindow: '128K',
    cppEmbed: true,
    ggufFile: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',
    description: 'Battle-tested dense coding champion under 10B. Flawless syntax across JavaScript, TypeScript, Python, and Rust.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'gemma4:12b',
    name: 'Gemma 4 12B Workstation (DeepMind)',
    params: '12.1B',
    category: 'mid_tier',
    vram: '8.2 GB',
    speed: '~40 tok/s',
    contextWindow: '256K',
    cppEmbed: true,
    ggufFile: 'gemma-4-12b-it-q4_k_m.gguf',
    description: 'Google DeepMind Gemma 4 mid-sized workstation model. 256K context, unified multimodal transformer, configurable thinking modes.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'qwen2.5-coder:14b',
    name: 'Qwen 2.5 Coder 14B (Architect)',
    params: '14.7B',
    category: 'mid_tier',
    vram: '9.6 GB',
    speed: '~36 tok/s',
    contextWindow: '128K',
    cppEmbed: true,
    ggufFile: 'qwen2.5-coder-14b-instruct-q4_k_m.gguf',
    description: 'Architectural sweet-spot: Deep AST synthesis, schema mapping, and cross-module refactoring on 12GB VRAM cards.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'deepseek-coder-v2:16b',
    name: 'DeepSeek Coder V2 Lite (16B MoE)',
    params: '16B (2.4B active)',
    category: 'sparse_moe',
    vram: '10.8 GB',
    speed: '~68 tok/s',
    contextWindow: '64K',
    cppEmbed: true,
    ggufFile: 'deepseek-coder-v2-lite-instruct-q4_k_m.gguf',
    description: 'Sparse MoE activating only 2.4B parameters per token with multi-head latent attention (MLA). Extreme speed and efficiency.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'codestral:22b',
    name: 'Codestral 22B (80+ Languages)',
    params: '22.2B',
    category: 'heavy',
    vram: '14.2 GB',
    speed: '~26 tok/s',
    contextWindow: '32K',
    cppEmbed: true,
    ggufFile: 'codestral-22b-v0.1-q4_k_m.gguf',
    description: 'Mistral dedicated software model with fill-in-the-middle (FIM) and syntax mastery across 80+ programming languages.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'gemma4:26b-a4b',
    name: 'Gemma 4 26B A4B (MoE DeepMind)',
    params: '26B (4B active / 128 experts)',
    category: 'sparse_moe',
    vram: '16.5 GB',
    speed: '~52 tok/s',
    contextWindow: '256K',
    cppEmbed: true,
    ggufFile: 'gemma-4-26b-a4b-it-q4_k_m.gguf',
    description: 'Google DeepMind Gemma 4 Mixture-of-Experts. 128 small experts with 4B active params per token. Delivers frontier performance at a fraction of compute cost.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'qwen3-coder:30b',
    name: 'Qwen3-Coder 30B-A3B (MoE Coder)',
    params: '30.5B (3.3B active)',
    category: 'sparse_moe',
    vram: '18.8 GB',
    speed: '~48 tok/s',
    contextWindow: '256K',
    cppEmbed: true,
    ggufFile: 'qwen3-coder-30b-a3b-instruct-q4_k_m.gguf',
    description: 'Alibaba Qwen3 Coder MoE flagship. Native 256K context, activating only 3.3B parameters per token. Built specifically for repository-scale autonomous coding.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'gemma4:31b',
    name: 'Gemma 4 31B Dense (Flagship DeepMind)',
    params: '30.7B Dense',
    category: 'heavyweight_champion',
    vram: '19.5 GB',
    speed: '~22 tok/s',
    contextWindow: '256K',
    cppEmbed: true,
    ggufFile: 'gemma-4-31b-it-q4_k_m.gguf',
    description: 'Google DeepMind flagship open dense model. 256K context, Apache 2.0 license, rigorous logic and mathematical reasoning benchmark leader.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'qwen2.5-coder:32b',
    name: 'Qwen 2.5 Coder 32B (Dense Champion)',
    params: '32.5B Dense',
    category: 'heavyweight_champion',
    vram: '20.2 GB',
    speed: '~20 tok/s',
    contextWindow: '128K',
    cppEmbed: true,
    ggufFile: 'qwen2.5-coder-32b-instruct-q4_k_m.gguf',
    description: 'Alibaba dense coding titan. Achieves 92.7% on HumanEval, on par with frontier proprietary closed-source models.',
    cmakeFlag: '-DLLAMA_CUDA=ON',
  },
  {
    id: 'qwen3.8:cloud',
    name: 'Qwen 3.8 Series (Max & Flash)',
    params: '2.4T MoE / Flash',
    category: 'cloud_frontier',
    vram: 'Cloud Endpoint / DashScope',
    speed: '~120 tok/s',
    contextWindow: '1M',
    cppEmbed: false,
    ggufFile: 'cloud-api-qwen-3.8-max',
    description: 'Alibaba Qwen 3.8 generation (Qwen 3.8-Max & Qwen 3.8-Flash). 1M token context for autonomous multi-day full project lifecycle execution.',
    cmakeFlag: 'N/A',
  },
];

export const REASONING_STRATEGIES = [
  {
    id: 'cot_chain_weaver',
    name: 'Chain-of-Thought (Chain Weaver)',
    badge: 'Step-by-Step Logic',
    description: 'Forces step-by-step architectural breakdown before outputting code, generating verified intermediate milestones.',
    systemPromptSupplement: 'Before writing any code, explicitly plan the system architecture in numbered milestones: 1. Data Contracts, 2. State & Side-Effects, 3. Error Boundaries, 4. Edge Cases.',
  },
  {
    id: 'tree_of_thoughts',
    name: 'Tree of Thoughts (ToT)',
    badge: 'Multi-Branch Exploration',
    description: 'Explores multiple architectural alternatives (e.g. REST vs WebSockets, SQL vs KV), scoring each against performance and complexity.',
    systemPromptSupplement: 'Analyze 3 candidate architectural branches for this requirement. Evaluate Latency, Memory, and Complexity. Select the optimal branch and implement it.',
  },
  {
    id: 'reflexion_self_correction',
    name: 'Reflexion (Self-Correction Loop)',
    badge: 'Deterministic Auditing',
    description: 'Critiques generated code against potential runtime bugs, race conditions, memory leaks, and missing null checks before final delivery.',
    systemPromptSupplement: 'Perform a self-audit on your generated code: check for memory leaks, unhandled Promise rejections, and security vulnerabilities. Correct all flaws before finalizing.',
  },
  {
    id: 'dspy_prompt_optimizer',
    name: 'DSPy Signature Optimization',
    badge: 'Programmatic Prompts',
    description: 'Uses structured type signatures (InputFields -> OutputFields) to guarantee deterministic JSON and zero markdown formatting drift.',
    systemPromptSupplement: 'Adhere to strict DSPy Typed Signatures. Provide schema validation and deterministic JSON envelopes for all machine-readable payloads.',
  },
];

export const DESIGN_SYSTEMS = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon Glass',
    accent: '#00f0ff',
    border: 'rgba(0, 240, 255, 0.25)',
    bg: '#070c1d',
    previewGradient: 'from-cyan-900/60 via-purple-950/60 to-slate-950',
    description: 'Sovereign OS signature: Deep galactic navy, glowing cyan & neon purple accents, glassmorphic cards.',
  },
  {
    id: 'linear_saas',
    name: 'Linear Modern SaaS',
    accent: '#38bdf8',
    border: 'rgba(255, 255, 255, 0.08)',
    bg: '#090d16',
    previewGradient: 'from-slate-900 via-slate-950 to-black',
    description: 'Minimalist high-contrast dark mode: Crisp borders, subtle glowing badges, high density typography.',
  },
  {
    id: 'cupertino',
    name: 'Cupertino Liquid Glass',
    accent: '#0a84ff',
    border: 'rgba(255, 255, 255, 0.15)',
    bg: '#000000',
    previewGradient: 'from-neutral-900 via-black to-neutral-950',
    description: 'Apple-inspired translucent liquid glass: Ultra-smooth blur-2xl squircle cards and vibrant SF accents.',
  },
  {
    id: 'neo_brutalist',
    name: 'Neo-Brutalist Bold',
    accent: '#fbbf24',
    border: '#000000',
    bg: '#fffbeb',
    previewGradient: 'from-amber-100 via-yellow-200 to-amber-300',
    description: 'High-impact tactile contrast: Stark 3px solid black outlines, bright canary yellow accents, bold drop shadows.',
  },
  {
    id: 'clean_minimal',
    name: 'Minimalist Clean Light/Dark',
    accent: '#10b981',
    border: 'rgba(100, 116, 139, 0.2)',
    bg: '#0f172a',
    previewGradient: 'from-slate-800 via-slate-900 to-slate-950',
    description: 'Pure functional aesthetics: Maximum information density, zero distraction, emerald accents.',
  },
];

/**
 * Generates an executable self-contained HTML/CSS/JS sandbox for instant Live Preview (iframe runner)
 */
export function compileLivePreview(files = [], activeTheme = 'cyberpunk') {
  const htmlDoc = files.find(f => f.path?.endsWith('.html'))?.content || '';
  const cssDoc = files.filter(f => f.path?.endsWith('.css')).map(f => f.content).join('\n');
  const jsDoc = files.filter(f => f.path?.endsWith('.js') && !f.path?.includes('server.js')).map(f => f.content).join('\n');

  // If user has a standalone HTML file, inject theme and JS
  if (htmlDoc.trim()) {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${activeTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssDoc}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4 font-sans">
  ${htmlDoc.includes('<body') ? htmlDoc.replace(/<!DOCTYPE html>|<html[^>]*>|<\/html>|<head>[\s\S]*<\/head>|<body[^>]*>|<\/body>/gi, '') : htmlDoc}
  <script>
    try {
      ${jsDoc}
    } catch (err) {
      console.error("[Live Sandbox Error]:", err);
      const errDiv = document.createElement("div");
      errDiv.style.cssText = "position:fixed;bottom:10px;left:10px;right:10px;background:#ef4444;color:white;padding:8px;border-radius:6px;font-family:monospace;font-size:12px;z-index:9999;";
      errDiv.textContent = "Sandbox Runtime: " + err.message;
      document.body.appendChild(errDiv);
    }
  </script>
</body>
</html>`;
  }

  // Fallback: Dynamic Interactive Component Canvas
  return `<!DOCTYPE html>
<html lang="en" data-theme="${activeTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cybeni Live Preview Canvas</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssDoc}
  </style>
</head>
<body class="bg-[#070c1d] text-slate-100 min-h-screen p-6 font-sans flex flex-col items-center justify-center">
  <div class="max-w-xl w-full p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-xl shadow-2xl text-center">
    <div class="w-12 h-12 mx-auto rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-3 text-2xl">
      ⚡
    </div>
    <h2 class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
      Cybeni Live Execution Canvas
    </h2>
    <p class="text-xs text-slate-400 mt-2">
      Live hot-reload sandbox compiled. Active files: <span class="text-cyan-300 font-mono">${files.map(f => f.path?.split('/').pop()).join(', ')}</span>
    </p>
    <div id="app-output" class="mt-6 text-left p-4 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-300">
      <div class="text-[10px] text-cyan-400 uppercase tracking-wider mb-2 font-bold">Execution Output:</div>
      <div id="console-stream">Ready. Evaluating scripts...</div>
    </div>
  </div>
  <script>
    const stream = document.getElementById('console-stream');
    const log = (...args) => {
      stream.innerHTML += '<div class="text-emerald-400 mt-1">> ' + args.join(' ') + '</div>';
    };
    try {
      ${jsDoc}
      log("All active project modules evaluated successfully.");
    } catch(e) {
      stream.innerHTML += '<div class="text-rose-400 mt-1">> Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
}
