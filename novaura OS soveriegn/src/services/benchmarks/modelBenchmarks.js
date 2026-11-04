// modelBenchmarks.js — Published benchmark results for open-weight models that
// run on a PC, and an independent index for frontier models. Every number comes
// from the source linked on its row, read on RETRIEVED; nothing here is estimated.
//
// Vendors report different benchmarks and versions, so a cell can carry a note
// (LiveCodeBench v5 vs v6, AIME 2025 vs 2026, SWE-bench Pro instead of Verified).
// Compare like with like: a note means the number is not the same test as the
// column's default.

export const RETRIEVED = '2026-11-03';

export const BENCHMARKS = [
  { key: 'gpqa', label: 'GPQA Diamond', about: 'Graduate-level science questions written to be hard to look up.' },
  { key: 'mmluPro', label: 'MMLU-Pro', about: 'Broad knowledge and reasoning across 14 subjects, 10 answer choices.' },
  { key: 'lcb', label: 'LiveCodeBench', about: 'Recent programming contest problems (v6 unless noted).' },
  { key: 'aime', label: 'AIME', about: 'American Invitational Mathematics Examination problems (year noted).' },
  { key: 'hle', label: "Humanity's Last Exam", about: 'Expert-written questions across fields, no tools.' },
  { key: 'swe', label: 'SWE-bench', about: 'Fixing real GitHub issues (Verified unless noted).' },
];

const GEMMA4 = { url: 'https://ai.google.dev/gemma/docs/core/model_card_4', label: 'Google, Gemma 4 model card' };
const GEMMA3 = { url: 'https://ai.google.dev/gemma/docs/core/model_card_3', label: 'Google, Gemma 3 model card' };

/**
 * Open-weight models a PC can run with the built-in AI. Scores are the makers'
 * own instruction-tuned results. download: a built-in catalog id or a Hugging
 * Face GGUF repo; gb: the 4-bit download (Gemma 4 rows include the image file the built-in AI fetches).
 */
export const OPEN_MODELS = [
  {
    name: 'Gemma 4 E2B', maker: 'Google', released: '2026-03-31', license: 'Apache 2.0',
    params: '5.1B (2.3B effective)', modalities: 'Text, image, audio', context: '128K', gb: 3.4,
    scores: { gpqa: 43.4, mmluPro: 60.0, lcb: 44.0, aime: { v: 37.5, note: '2026' } },
    download: { builtin: 'gemma-4-e2b' }, source: GEMMA4,
  },
  {
    name: 'Gemma 4 E4B', maker: 'Google', released: '2026-03-31', license: 'Apache 2.0',
    params: '8B (4.5B effective)', modalities: 'Text, image, audio', context: '128K', gb: 5.2,
    scores: { gpqa: 58.6, mmluPro: 69.4, lcb: 52.0, aime: { v: 42.5, note: '2026' } },
    download: { builtin: 'gemma-4-e4b' }, source: GEMMA4, pick: true,
  },
  {
    name: 'Gemma 4 12B', maker: 'Google', released: '2026-06-03', license: 'Apache 2.0',
    params: '12B', modalities: 'Text, image, audio', context: '256K', gb: 7.4,
    scores: { gpqa: 78.8, mmluPro: 77.2, lcb: 72.0, aime: { v: 77.5, note: '2026' }, hle: 5.2 },
    download: { builtin: 'gemma-4-12b' }, source: GEMMA4,
  },
  {
    name: 'Gemma 4 26B A4B', maker: 'Google', released: '2026-03-31', license: 'Apache 2.0',
    params: '25.2B MoE, 3.8B active', modalities: 'Text, image', context: '256K', gb: 15.4,
    scores: { gpqa: 82.3, mmluPro: 82.6, lcb: 77.1, aime: { v: 88.3, note: '2026' }, hle: 8.7 },
    download: { builtin: 'gemma-4-26b-a4b' }, source: GEMMA4,
  },
  {
    name: 'Gemma 4 31B', maker: 'Google', released: '2026-03-31', license: 'Apache 2.0',
    params: '30.7B', modalities: 'Text, image', context: '256K', gb: 18.8,
    scores: { gpqa: 84.3, mmluPro: 85.2, lcb: 80.0, aime: { v: 89.2, note: '2026' }, hle: 19.5 },
    download: { repo: 'ggml-org/gemma-4-31B-it-GGUF' }, source: GEMMA4,
  },
  {
    name: 'Gemma 3 27B', maker: 'Google', released: '2025-03-10', license: 'Gemma Terms of Use',
    params: '27B', modalities: 'Text, image', context: '128K', gb: 16.5,
    // Google's own re-run in the Gemma 4 card, on the same benchmark versions as the Gemma 4 rows.
    scores: { gpqa: 42.4, mmluPro: 67.6, lcb: 29.1, aime: { v: 20.8, note: '2026' } },
    download: { repo: 'ggml-org/gemma-3-27b-it-GGUF' }, source: { url: GEMMA4.url, label: 'Google, Gemma 4 model card (Gemma 3 27B column)' },
  },
  {
    name: 'Gemma 3 12B', maker: 'Google', released: '2025-03-10', license: 'Gemma Terms of Use',
    params: '12B', modalities: 'Text, image', context: '128K', gb: 7.3,
    scores: { gpqa: 40.9, mmluPro: 60.6, lcb: { v: 24.6, note: 'earlier version' } },
    download: { repo: 'ggml-org/gemma-3-12b-it-GGUF' }, source: GEMMA3,
  },
  {
    name: 'Gemma 3 4B', maker: 'Google', released: '2025-03-10', license: 'Gemma Terms of Use',
    params: '4B', modalities: 'Text, image', context: '128K', gb: 2.5,
    scores: { gpqa: 30.8, mmluPro: 43.6, lcb: { v: 12.6, note: 'earlier version' } },
    download: { repo: 'ggml-org/gemma-3-4b-it-GGUF' }, source: GEMMA3,
  },
  {
    name: 'Gemma 3 1B', maker: 'Google', released: '2025-03-10', license: 'Gemma Terms of Use',
    params: '1B', modalities: 'Text', context: '32K', gb: 0.8,
    scores: { gpqa: 19.2, mmluPro: 14.7, lcb: { v: 1.9, note: 'earlier version' } },
    download: { repo: 'ggml-org/gemma-3-1b-it-GGUF' }, source: GEMMA3,
  },
  {
    name: 'Qwen3.8 27B', maker: 'Alibaba (Qwen)', released: '2026-08', license: 'Apache 2.0',
    params: '27B', modalities: 'Text, image, video', context: '262K', gb: 16.8,
    scores: { gpqa: 89.2, lcb: 90.3, hle: 30.8, swe: { v: 61.7, note: 'Pro' } },
    download: { repo: 'lmstudio-community/Qwen3.8-27B-GGUF' }, source: { url: 'https://huggingface.co/Qwen/Qwen3.8-27B', label: 'Qwen, Qwen3.8-27B model card' },
  },
  {
    name: 'Muse Glimmer 30B', maker: 'Meta', released: '2026-08', license: 'Apache 2.0',
    params: '29.6B', modalities: 'Text, image', context: '131K', gb: 16.8,
    // GPQA and HLE are Artificial Analysis runs, as the card labels them.
    scores: { gpqa: { v: 83.5, note: 'AA run' }, hle: { v: 22.0, note: 'text, AA run' }, aime: { v: 94.7, note: '2026' }, swe: 76.0 },
    download: { repo: 'meta-models/Muse-Glimmer-30B-GGUF' }, source: { url: 'https://huggingface.co/meta-models/Muse-Glimmer-30B', label: 'Meta, Muse Glimmer 30B model card' },
  },
  {
    name: 'gpt-oss-20b', maker: 'OpenAI', released: '2025-08-05', license: 'Apache 2.0',
    params: '21B MoE, 3.6B active', modalities: 'Text', context: '128K', gb: 12.1,
    scores: { gpqa: 71.5, aime: { v: 91.7, note: '2025' }, hle: 10.9, swe: 60.7 },
    download: { repo: 'ggml-org/gpt-oss-20b-GGUF' }, source: { url: 'https://arxiv.org/abs/2508.10925', label: 'OpenAI, gpt-oss model card (high reasoning)' },
  },
  {
    name: 'gpt-oss-120b', maker: 'OpenAI', released: '2025-08-05', license: 'Apache 2.0',
    params: '117B MoE, 5.1B active', modalities: 'Text', context: '128K', gb: 63.4,
    scores: { gpqa: 80.1, aime: { v: 92.5, note: '2025' }, hle: 14.9, swe: 62.4 },
    download: { repo: 'ggml-org/gpt-oss-120b-GGUF' }, source: { url: 'https://arxiv.org/abs/2508.10925', label: 'OpenAI, gpt-oss model card (high reasoning)' },
  },
  {
    name: 'Magistral Small 1.2', maker: 'Mistral AI', released: '2025-09', license: 'Apache 2.0',
    params: '24B', modalities: 'Text, image', context: '128K', gb: 14.3,
    scores: { gpqa: 70.1, lcb: { v: 70.9, note: 'v5' }, aime: { v: 77.3, note: '2025' } },
    download: { repo: 'mistralai/Magistral-Small-2509-GGUF' }, source: { url: 'https://huggingface.co/mistralai/Magistral-Small-2509', label: 'Mistral AI, Magistral Small 1.2 model card' },
  },
];

const AA = { url: 'https://artificialanalysis.ai/leaderboards/models', label: 'Artificial Analysis Intelligence Index v5' };
const AA_OPEN = { url: 'https://artificialanalysis.ai/models/open-source', label: 'Artificial Analysis Intelligence Index v5' };

/**
 * Artificial Analysis Intelligence Index v5: one independent score from the same
 * set of evaluations (many of them private) for every model, so models from
 * different makers can be compared. Higher is better; the scale tops out near 60 today.
 */
export const FRONTIER = [
  { name: 'Gemini 4 Carbon', setting: 'high', maker: 'Google', released: '2026-10-28', weights: 'Closed', access: 'Limited rollout', index: 60, source: AA },
  { name: 'Claude Opus 5.5', setting: 'max', maker: 'Anthropic', released: '2026-09-22', weights: 'Closed', access: 'API and apps', index: 59, source: AA },
  { name: 'GPT-6 Astra', setting: 'max', maker: 'OpenAI', released: '2026-09-03', weights: 'Closed', access: 'Limited at launch', index: 57, source: AA },
  { name: 'GPT-6.1 Sol', setting: 'max', maker: 'OpenAI', weights: 'Closed', index: 55, source: AA },
  { name: 'Claude Sonnet 5.5', setting: 'max', maker: 'Anthropic', weights: 'Closed', access: 'API and apps', index: 55, source: AA },
  { name: 'DeepSeek V4.1 Flash 1017', setting: 'max', maker: 'DeepSeek', released: '2026-10-17', weights: 'Open (552B MoE, 16B active)', index: 33, source: AA_OPEN },
  { name: 'GLM-5.3', setting: 'max', maker: 'Z.ai', released: '2026-08-25', weights: 'Open (753B MoE, 40B active)', index: 32, source: AA_OPEN },
  { name: 'MiMo-V2.6-Pro', maker: 'Xiaomi', weights: 'Open (1.0T MoE, 42B active)', index: 30, source: AA_OPEN },
  { name: 'MiniMax-M3.1-Flash', maker: 'MiniMax', weights: 'Open (428B MoE, 23B active)', index: 29, source: AA_OPEN },
  { name: 'Mistral Large 4', setting: 'high', maker: 'Mistral AI', released: '2026-09-30', weights: 'Open (1.1T MoE, 52B active)', index: 26, source: AA_OPEN },
  { name: 'Muse Spark Open', setting: 'xhigh', maker: 'Meta', weights: 'Open (816B MoE, 42B active)', index: 25, source: AA_OPEN },
  { name: 'Qwen3.8 27B', setting: 'xhigh', maker: 'Alibaba (Qwen)', released: '2026-08', weights: 'Open (27B)', index: 20, source: AA_OPEN },
  { name: 'Nemotron 3.5 Super VL', maker: 'NVIDIA', released: '2026-10-12', weights: 'Open (120B MoE, 12B active)', index: 14, source: AA_OPEN },
];

/** A score cell as { value, note } (note may be ''), or null when the maker did not report it. */
export function scoreOf(model, key) {
  const s = model.scores?.[key];
  if (s === undefined || s === null) return null;
  return typeof s === 'number' ? { value: s, note: '' } : { value: s.v, note: s.note || '' };
}
