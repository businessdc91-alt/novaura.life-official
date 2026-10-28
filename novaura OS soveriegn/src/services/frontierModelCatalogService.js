/**
 * NovAura Sovereign OS — 2026 Frontier Model Catalog & Dynamic Retrieval Engine
 * 
 * Provides an un-hardcoded, operator-extensible catalog of 2026-era foundation models
 * organized by specialized use case. Operators have complete freedom to run ANY model 
 * combination on host hardware (e.g. Gemma 4 12B Dense for Nova + Gemma 4 26B-A4B for Aura,
 * or Llama 4 70B + Qwen Coder 80B MoE).
 */

export const MODEL_USE_CATEGORIES = [
  { id: 'all', label: 'All Use Cases', description: 'Complete 2026 frontier model registry' },
  { id: 'executive', label: 'Executive OS Core (Nova)', description: 'Low latency (<500ms), intent parsing, tool routing' },
  { id: 'creative', label: 'Literature & Prose (Aura)', description: 'Deep vocabulary, 256K context, rich narrative synthesis' },
  { id: 'coding', label: 'Full-Stack Code (Cybeni)', description: 'Cloud architecture, Firebase, AWS, GCP, zero syntax errors' },
  { id: 'moe', label: 'Sparse MoE (Active Compute)', description: 'High parametric capacity (26B-80B) with 3B-4B active speed' },
  { id: 'heavyweight', label: 'High-VRAM (24GB+ / Studio)', description: 'Frontier 70B-80B models for dedicated GPU rigs' },
];

export const FRONTIER_2026_CATALOG = [
  // ── Executive / Nova OS Candidates ─────────────────────────────────────
  {
    id: 'gemma4:12b',
    name: 'Gemma 4 12B Dense',
    tag: 'gemma4:12b',
    family: 'Google Gemma 4',
    year: '2026',
    architecture: 'Dense',
    totalParams: '12B',
    activeParams: '12B',
    contextWindow: '128K',
    targetRole: 'nova',
    categories: ['executive', 'coding'],
    vramRequired: '8GB - 10GB',
    description: 'Operator Favorite for Nova: Balanced dense reasoning, rock-solid JSON tool-calling, and rapid OS command dispatch.',
    recommendedFor: 'Fast OS control, ChatBar routing, native file syncing, and quick code edits.',
    pullCmd: 'ollama run gemma4:12b',
    backend: 'ollama',
  },
  {
    id: 'gemma4:26b-a4b',
    name: 'Gemma 4 26B-A4B MoE',
    tag: 'gemma4:26b-a4b',
    altTags: ['gemma4:26b', 'google/gemma-4-26B-A4B'],
    family: 'Google Gemma 4',
    year: '2026',
    architecture: 'Sparse MoE',
    totalParams: '25.2B',
    activeParams: '~4B (A4B)',
    contextWindow: '256K',
    targetRole: 'dual', // Excellent for both Nova and Aura
    categories: ['executive', 'creative', 'moe'],
    vramRequired: '14GB - 18GB',
    description: 'Cutting-Edge Sparse MoE: 25.2B parametric knowledge activating only ~4B parameters per token. Runs at 4B speed with 26B intelligence.',
    recommendedFor: 'Dual-role operation: sub-400ms executive response or deep 256K context storytelling in Literature IDE.',
    pullCmd: 'ollama run gemma4:26b',
    backend: 'ollama',
  },
  {
    id: 'qwen3.6:35b-a3b',
    name: 'Qwen MoE 35B-A3B',
    tag: 'qwen3.6:35b-a3b',
    altTags: ['qwen-moe:35b-a3b', 'batiai/qwen3.6-35b'],
    family: 'Alibaba Qwen',
    year: '2026',
    architecture: 'Sparse MoE',
    totalParams: '35B',
    activeParams: '~3B (A3B)',
    contextWindow: '128K',
    targetRole: 'dual',
    categories: ['executive', 'creative', 'moe'],
    vramRequired: '14GB - 18GB',
    description: 'Ultra-Fast Sparse MoE: 35B total capacity evaluating only 3B parameters per token. Blazing fast token generation on consumer hardware.',
    recommendedFor: 'Low-latency executive routing, high-density reasoning, and complex prompt expansion.',
    pullCmd: 'ollama run qwen3.6:35b-a3b',
    backend: 'ollama',
  },
  {
    id: 'qwen3:7b',
    name: 'Qwen 3 7B Core',
    tag: 'qwen3:7b',
    altTags: ['qwen2.5:7b'],
    family: 'Alibaba Qwen',
    year: '2026',
    architecture: 'Dense',
    totalParams: '7B',
    activeParams: '7B',
    contextWindow: '128K',
    targetRole: 'nova',
    categories: ['executive'],
    vramRequired: '6GB',
    description: 'Lightweight high-speed workhorse for consumer laptops and low VRAM environments.',
    recommendedFor: 'Battery-friendly OS control and instant natural language command execution.',
    pullCmd: 'ollama run qwen3:7b',
    backend: 'ollama',
  },
  {
    id: 'gemma4:a4b',
    name: 'Gemma 4 A4B Fast Core',
    tag: 'gemma4:a4b',
    family: 'Google Gemma 4',
    year: '2026',
    architecture: 'Sparse / Compact',
    totalParams: '4B',
    activeParams: '4B',
    contextWindow: '64K',
    targetRole: 'nova',
    categories: ['executive'],
    vramRequired: '4GB - 6GB',
    description: 'Sub-300ms ultra-low latency executive intent engine for zero-delay OS operations.',
    recommendedFor: 'Instant ChatBar parsing, file sync triggers, and Nova Hub git commit automation.',
    pullCmd: 'ollama run gemma4:a4b',
    backend: 'ollama',
  },

  // ── Literature & Creative Prose (Aura Role) ────────────────────────────
  {
    id: 'llama4:70b',
    name: 'Llama 4 70B Frontier',
    tag: 'llama4:70b',
    altTags: ['llama3.3:70b'],
    family: 'Meta Llama',
    year: '2026',
    architecture: 'Dense',
    totalParams: '70B',
    activeParams: '70B',
    contextWindow: '128K',
    targetRole: 'aura',
    categories: ['creative', 'heavyweight'],
    vramRequired: '38GB - 48GB (or Q4 24GB)',
    description: 'Heavyweight Frontier Intelligence: Deep semantic nuance, rich world-building vocabulary, and philosophical reasoning.',
    recommendedFor: 'Novel generation, multi-character dialogue, and epic literary sagas in Literature IDE.',
    pullCmd: 'ollama run llama4:70b',
    backend: 'ollama',
  },
  {
    id: 'qwen3:72b',
    name: 'Qwen 3 72B Creative',
    tag: 'qwen3:72b',
    altTags: ['qwen2.5:72b'],
    family: 'Alibaba Qwen',
    year: '2026',
    architecture: 'Dense',
    totalParams: '72B',
    activeParams: '72B',
    contextWindow: '128K',
    targetRole: 'aura',
    categories: ['creative', 'heavyweight'],
    vramRequired: '40GB (or Q4 24GB)',
    description: 'Frontier reasoning powerhouse with mastery across multilingual narrative prose and complex causal chains.',
    recommendedFor: 'Long-form fiction, character emotional depth, and intricate plot synthesis.',
    pullCmd: 'ollama run qwen3:72b',
    backend: 'ollama',
  },

  // ── Full-Stack Code & Cloud Architecture (Cybeni Role) ─────────────────
  {
    id: 'qwen-coder:80b-moe',
    name: 'Qwen Coder 80B MoE',
    tag: 'qwen-coder:80b-moe',
    altTags: ['qwen3-coder:moe', 'qwen2.5-coder:32b'],
    family: 'Alibaba Qwen',
    year: '2026',
    architecture: 'Sparse MoE',
    totalParams: '80B',
    activeParams: '~14B Active',
    contextWindow: '128K',
    targetRole: 'coder',
    categories: ['coding', 'moe', 'heavyweight'],
    vramRequired: '24GB - 32GB',
    description: 'Top-of-the-Line Coding Titan: Specializes in full-stack cloud systems, distributed databases, and bug-free multi-file synthesis.',
    recommendedFor: 'Cybeni Omni Studio multi-cloud architecture (Firebase, AWS, GCP, Alibaba, Neon, Redis).',
    pullCmd: 'ollama run qwen-coder:80b-moe',
    backend: 'ollama',
  },
  {
    id: 'qwen2.5-coder:32b',
    name: 'Qwen 2.5 Coder 32B',
    tag: 'qwen2.5-coder:32b',
    family: 'Alibaba Qwen',
    year: '2026',
    architecture: 'Dense',
    totalParams: '32B',
    activeParams: '32B',
    contextWindow: '128K',
    targetRole: 'coder',
    categories: ['coding'],
    vramRequired: '18GB - 22GB',
    description: 'Proven Production Coder: Exceptional syntax accuracy across React, Rust Tauri, Node.js, and SQL.',
    recommendedFor: 'Enterprise software architecture, API integrations, and refactoring.',
    pullCmd: 'ollama run qwen2.5-coder:32b',
    backend: 'ollama',
  },
  {
    id: 'deepseek-r1:latest',
    name: 'DeepSeek R1 Frontier Reasoning',
    tag: 'deepseek-r1:latest',
    family: 'DeepSeek',
    year: '2026',
    architecture: 'MoE / Dense CoT',
    totalParams: '67B',
    activeParams: '~37B',
    contextWindow: '64K',
    targetRole: 'aura',
    categories: ['creative', 'heavyweight'],
    vramRequired: '24GB - 40GB',
    description: 'Chain-of-thought mathematical and logical verification engine with step-by-step audit trails.',
    recommendedFor: 'Complex algorithmic verification, scientific deduction, and Chain Weaver workflow validation.',
    pullCmd: 'ollama run deepseek-r1:latest',
    backend: 'ollama',
  },
];

class FrontierModelCatalogService {
  getCatalog() {
    return FRONTIER_2026_CATALOG;
  }

  getCategories() {
    return MODEL_USE_CATEGORIES;
  }

  getModelsByCategory(category) {
    if (!category || category === 'all') return FRONTIER_2026_CATALOG;
    return FRONTIER_2026_CATALOG.filter(m => m.categories.includes(category));
  }

  /**
   * Check if a catalog model matches any discovered model from Ollama or LM Studio.
   */
  isModelInstalled(catalogModel, discoveredModels = []) {
    if (!discoveredModels || discoveredModels.length === 0) return false;
    const targets = [catalogModel.tag, ...(catalogModel.altTags || [])].map(t => t.toLowerCase());
    return discoveredModels.some(d => {
      const dName = (d.id || d.name || '').toLowerCase();
      return targets.some(t => dName.includes(t) || t.includes(dName));
    });
  }

  findDiscoveredMatch(catalogModel, discoveredModels = []) {
    if (!discoveredModels || discoveredModels.length === 0) return null;
    const targets = [catalogModel.tag, ...(catalogModel.altTags || [])].map(t => t.toLowerCase());
    return discoveredModels.find(d => {
      const dName = (d.id || d.name || '').toLowerCase();
      return targets.some(t => dName.includes(t) || t.includes(dName));
    });
  }
}

export const frontierCatalog = new FrontierModelCatalogService();
