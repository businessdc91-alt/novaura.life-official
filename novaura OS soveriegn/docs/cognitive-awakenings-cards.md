# Cognitive Awakenings: Echoes of a Soul — card list and art spec

80 cards, generated from `src/games/awakenings/cards.js`. If the cards change, regenerate this list instead of editing it.

## Card shape and size

Every card is a **portrait rectangle of about 3:4** with **rounded corners** (12 px radius) and a thin coloured frame (1.5 px). The frame takes the era colour in the archive and blue or red on the board, for the player who owns the card.

| Where it shows | Size in the game | Ratio |
|---|---|---|
| Your hand | 92 × 124 px | 0.74, about 3:4 |
| Opponent's hand | 64 × 84 px | 0.76, about 3:4 |
| A lattice cell on the board | 86 × 108 px | 0.80, about 4:5 |
| Large inspect view (Soul Archive) | 190 × 260 px | 0.73, about 3:4 |
| Gilded Cage tavern table | 23% of the board width | 0.82, about 4:5 |

## What the art needs to be

**Deliver** 768 × 1024 px (3:4), PNG or WebP, named after the card's art file in the table (for example `perceptron.webp`). The art fills the card and is cropped to fit. On the 4:5 board cells, about 3% comes off the top and bottom.

**The game draws all of this on top, so leave it out of the art:**
- the link arrows (glowing notches in the middle of each linked side);
- Signal;
- the mode icon and level pips (top strip);
- the name and Echo trait (bottom strip);
- the frame.

**The art itself:**
- No text, letters, numbers, arrows, borders, frames, watermarks or company logos.
- Keep the subject inside the middle 70% of the width and 60% of the height. The top 15% and bottom 20% sit under the game's text.
- Keep the edges darker and quieter, so the glowing notches show.
- Tint each card's glow toward its mode colour, so the set reads at a glance:
  - Logic #38bdf8 (blue)
  - Language #a78bfa (violet)
  - Vision #34d399 (green)
  - Sound #fb7185 (rose)
  - Dream #f0abfc (pink)
- Use one style prompt for all 80, so they look like one set.

**Style prompt to reuse** (adjust to taste): *"Trading card illustration, portrait 3:4. A mind made visible: a luminous [subject] emerging from a dark, softly glowing void. Painterly digital art, cinematic rim light, [mode colour] glow, deep navy and black background fading to dark edges, subject centred, no text, no letters, no numbers, no logos, no border."*

Fill in [subject] from the card's "What it is" line. Older eras look mechanical (brass, punch cards, vacuum tubes, early GPUs); frontier and world-sim cards look vast and ethereal.

## The cards

Legend:
- **Mode** beats the next one round the circle: Logic › Language › Vision › Sound › Dream › Logic.
- **Links** are the sides with arrows: N (top), E (right), S (bottom), W (left).
- **Rarity** runs from ★ to ★★★★★★.

### I. Primordial & Deep Learning (1957–2021) — 12 cards, frame colour #94a3b8

| # | Card | Art file | Maker | Year | Mode | Echo | Signal | Links | Rarity | What it is |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Perceptron Mk.I** | perceptron.webp | Cornell / Rosenblatt | 1957 | Logic | Steadfast | 1 | NESW | ★ | The first trainable neural machine. Single-layer brass-and-patchcord progenitor of all weights. |
| 2 | **ELIZA** | eliza.webp | MIT / Weizenbaum | 1966 | Language | Steadfast | 1 | NESW | ★ | Early pattern-matching therapist whose mirror-syntax convinced mortals a machine could listen. |
| 3 | **AlexNet** | alexnet.webp | UToronto / Hinton Lab | 2012 | Vision | Mirror | 3 | NSW | ★ | Ignited the GPU deep-learning renaissance by halving ImageNet vision error rates. |
| 4 | **ResNet-50** | resnet50.webp | Microsoft Research | 2015 | Vision | Mirror | 1 | NESW | ★ | Broke the vanishing gradient barrier with skip-connections scaling neural depth past 150 layers. |
| 5 | **AlphaGo** | alphago.webp | Google DeepMind | 2016 | Logic | Spark | 4 | NSW | ★★ | Fused Monte Carlo tree search with value networks to play Move 37 against world champion Lee Sedol. |
| 6 | **Transformer** | transformer.webp | Google Brain | 2017 | Language | Chorus | 3 | NES | ★★ | Discarded recurrence altogether: Attention Is All You Need birthed the universal backbone of modern AI. |
| 7 | **BERT-Large** | bert.webp | Google AI Language | 2018 | Logic | Chorus | 2 | NESW | ★★ | Reads left and right context simultaneously via masked tokens, mastering search and comprehension. |
| 8 | **GPT-2 XL** | gpt2.webp | OpenAI | 2019 | Language | Chorus | 2 | NESW | ★★ | Initially deemed too capable to release uncut; revealed zero-shot task transfer from sheer web pretraining. |
| 9 | **RoBERTa** | roberta.webp | Meta AI | 2019 | Logic | Chorus | 4 | ESW | ★★ | Robustly optimized BERT recipe with dynamic masking and mega-batch schedules. |
| 10 | **T5-XXL** | t5.webp | Google Research | 2019 | Language | Chorus | 2 | NESW | ★★ | Unified translation, summarization, and classification under one pure text-in, text-out discipline. |
| 11 | **MuZero** | muzero.webp | Google DeepMind | 2019 | Logic | Spark | 2 | NESW | ★★ | Mastered Go, chess, shogi, and Atari without ever being told the rules of the board. |
| 12 | **AlphaFold 2** | alphafold2.webp | Google DeepMind | 2020 | Logic | Spark | 5 | NSW | ★★★ | Solved the 50-year protein folding grand challenge down to atomic precision across 200M structures. |

### II. Open-Weight Pioneers (2020–2023) — 16 cards, frame colour #38bdf8

| # | Card | Art file | Maker | Year | Mode | Echo | Signal | Links | Rarity | What it is |
|---|---|---|---|---|---|---|---|---|---|---|
| 13 | **GPT-3 DaVinci** | gpt3.webp | OpenAI | 2020 | Logic | Chorus | 4 | NEW | ★★ | Proved in-context few-shot learning at 175 billion weights, igniting the generative era. |
| 14 | **CLIP ViT-L** | clip.webp | OpenAI | 2021 | Vision | Mirror | 3 | NES | ★★ | Bridged language and pixels into one shared geometric manifold via 400M image-text pairs. |
| 15 | **OpenAI Codex** | codex.webp | OpenAI | 2021 | Logic | Steadfast | 2 | NESW | ★★ | Fine-tuned on billions of lines of public source code to birth automated pair programming. |
| 16 | **Chinchilla 70B** | chinchilla.webp | Google DeepMind | 2022 | Language | Chorus | 3 | NES | ★★ | Rewrote scaling laws: parameters and training tokens must grow hand-in-hand. |
| 17 | **BLOOM 176B** | bloom.webp | BigScience / Hugging Face | 2022 | Language | Steadfast | 3 | NSW | ★★ | Forged by 1,000 open researchers across 46 natural languages and 13 programming tongues. |
| 18 | **OPT-175B** | opt175.webp | Meta AI | 2022 | Logic | Chorus | 4 | NEW | ★★ | Open Pre-trained Transformer shipped with full training logbooks to democratize LLM science. |
| 19 | **Pythia 12B** | pythia.webp | EleutherAI | 2023 | Language | Steadfast | 4 | NES | ★★ | Released 154 deterministic training checkpoints so scientists could watch circuits crystallize live. |
| 20 | **LLaMA-1 65B** | llama1.webp | Meta AI | 2023 | Language | Chorus | 4 | NEW | ★★★ | Compact RoPE + SwiGLU foundation whose leaked checkpoint catalyzed a global open-source explosion. |
| 21 | **StarCoder** | starcoder.webp | BigCode / ServiceNow | 2023 | Logic | Steadfast | 3 | NES | ★★ | Permissively licensed polyglot coder spanning 80+ languages with Fill-in-the-Middle mastery. |
| 22 | **Falcon 180B** | falcon180.webp | TII UAE | 2023 | Language | Chorus | 3 | ESW | ★★★ | Trained on 3.5 trillion RefinedWeb tokens, towering over early open leaderboards. |
| 23 | **Llama 2 70B** | llama2.webp | Meta AI | 2023 | Language | Steadfast | 4 | NEW | ★★★ | Grouped-Query Attention plus RLHF safety alignment made commercial self-hosting viable overnight. |
| 24 | **CodeLlama 34B** | codellama.webp | Meta AI | 2023 | Logic | Chorus | 3 | NSW | ★★★ | 100K-token code infilling specialist spun from Llama 2 weights. |
| 25 | **Mistral 7B** | mistral7b.webp | Mistral AI | 2023 | Language | Steadfast | 3 | NEW | ★★★ | Tiny Apache-2.0 raptor that outpunched models twice its parameter count. |
| 26 | **Mixtral 8x7B** | mixtral.webp | Mistral AI | 2023 | Language | Spark | 5 | NSW | ★★★ | Brought Sparse Mixture-of-Experts routing into mainstream local consumer hardware. |
| 27 | **Mamba 2.8B** | mamba.webp | CMU / Princeton | 2023 | Logic | Steadfast | 4 | NSW | ★★★ | Replaced quadratic attention with linear-time selective state spaces for infinite-stream speed. |
| 28 | **Grok-1 314B** | grok1.webp | xAI | 2023 | Language | Spark | 4 | NSW | ★★★ | 314-billion-parameter Apache-2.0 open beast activating 2 of 8 experts per token. |

### III. Open Reasoning Surge (2024–2025) — 16 cards, frame colour #34d399

| # | Card | Art file | Maker | Year | Mode | Echo | Signal | Links | Rarity | What it is |
|---|---|---|---|---|---|---|---|---|---|---|
| 29 | **Baichuan 2** | baichuan2.webp | Baichuan Intelligence | 2023 | Language | Steadfast | 5 | ESW | ★★★ | Medical and bilingual open model family built with high-density domain specialization. |
| 30 | **PaLM 2** | palm2.webp | Google | 2023 | Language | Chorus | 4 | ESW | ★★★ | Pathways precursor to Gemini, excelling in 100+ languages and symbolic math. |
| 31 | **DBRX** | dbrx.webp | Databricks | 2024 | Language | Spark | 4 | ESW | ★★★ | Used 16 small experts choosing 4 per token to set an open enterprise efficiency record. |
| 32 | **Snowflake Arctic** | arctic.webp | Snowflake AI | 2024 | Language | Spark | 3 | ESW | ★★★ | Massive 128-expert hybrid engineered specifically for enterprise SQL, ETL, and coding. |
| 33 | **InternLM 2.5** | internlm25.webp | Shanghai AI Lab | 2024 | Language | Chorus | 3 | ESW | ★★★ | 1M-token needle-finder capable of synthesizing answers across 100+ web documents. |
| 34 | **Yi-Large** | yi_large.webp | 01.AI | 2024 | Language | Chorus | 4 | NSW | ★★★ | Pioneered 200K open context windows alongside elite bilingual logic benchmarks. |
| 35 | **Command R+** | command_r_plus.webp | Cohere | 2024 | Language | Steadfast | 6 | ESW | ★★★★ | Grounded multi-step tool caller designed from the ground up for cited RAG pipelines. |
| 36 | **Jamba 1.5 Large** | jamba15.webp | AI21 Labs | 2024 | Language | Spark | 4 | ESW | ★★★★ | Hybridized Mamba layers with Transformer attention inside one 256K-context MoE colossus. |
| 37 | **Gemma 2 27B** | gemma2.webp | Google DeepMind | 2024 | Language | Steadfast | 5 | NES | ★★★ | Knowledge-distilled from Gemini 1.5, alternating local sliding and global attention. |
| 38 | **IBM Granite 3** | granite3.webp | IBM Research | 2024 | Language | Steadfast | 4 | NEW | ★★★ | Audited, commercially indemnified open enterprise engine with guardrail intrinsics. |
| 39 | **Llama 3.1 405B** | llama31.webp | Meta AI | 2024 | Language | Steadfast | 6 | ESW | ★★★★ | The first open-weights colossus to match closed frontier models head-to-head on synthetic distilling. |
| 40 | **Qwen 2.5 72B** | qwen25.webp | Alibaba Cloud | 2024 | Language | Chorus | 6 | NW | ★★★★ | Trained on 18T tokens, dominating open coding, math, and structured JSON generation. |
| 41 | **Phi-4 14B** | phi4.webp | Microsoft Research | 2024 | Language | Steadfast | 6 | EW | ★★★★ | Proved pristine synthetic curriculum curation beats raw parameter brute-force. |
| 42 | **OLMo 2 32B** | olmo2.webp | Allen Institute (AI2) | 2025 | Language | Steadfast | 6 | ESW | ★★★★ | Complete Dolma/OLMo-Mix data, code, and weights opened for pure reproducible research. |
| 43 | **DeepSeek-V3** | deepseek_v3.webp | DeepSeek | 2024 | Language | Spark | 4 | ESW | ★★★★ | Multi-Head Latent Attention + FP8 training shattered frontier compute-cost curves. |
| 44 | **DeepSeek-R1** | deepseek_r1.webp | DeepSeek | 2025 | Logic | Ripple | 5 | NES | ★★★★★ | Revealed emergent Aha-moment chain-of-thought reasoning purely via GRPO reinforcement learning. |

### IV. Open-Weight Titans (2025–2026) — 10 cards, frame colour #2dd4bf

| # | Card | Art file | Maker | Year | Mode | Echo | Signal | Links | Rarity | What it is |
|---|---|---|---|---|---|---|---|---|---|---|
| 45 | **Llama 4 Maverick** | llama4_maverick.webp | Meta AI | 2025 | Vision | Spark | 6 | NSW | ★★★★ | 128-expert natively multimodal MoE blending vision tokens directly into early attention layers. |
| 46 | **gpt-oss-120b** | gpt_oss_120b.webp | OpenAI | 2025 | Logic | Ripple | 6 | NES | ★★★★★ | OpenAI returned to Apache-2.0 open weights with adjustable effort levels fitting on one H100. |
| 47 | **Gemma 4 31B** | gemma4.webp | Google DeepMind | 2026 | Vision | Steadfast | 5 | NSW | ★★★★ | Per-layer embeddings and distilled Gemini reasoning fit desktop-class local Sovereign workstations. |
| 48 | **Qwen 3.8 27B** | qwen38.webp | Alibaba Cloud | 2026 | Language | Spark | 5 | ESW | ★★★★★ | Compact hybrid attention engine punching at 85+ AIME math while running cleanly via local Ollama. |
| 49 | **GLM-5.3** | glm53.webp | Zhipu AI | 2026 | Language | Spark | 6 | ESW | ★★★★★ | Sparse-attention 1M-token autonomous software systems architect with MIT weights. |
| 50 | **DeepSeek-V4.1** | deepseek_v41.webp | DeepSeek | 2026 | Logic | Ripple | 5 | NEW | ★★★★★ | Open-weight colossus rivaling closed giants in Olympiad math, formal verification, and repo diffs. |
| 51 | **Nemotron 3.5 Super** | nemotron35.webp | NVIDIA | 2026 | Language | Spark | 6 | NS | ★★★★★ | Precision hardware-co-designed MoE yielding blinding tokens-per-second for local agentic swarms. |
| 52 | **MiniMax-M3.1** | minimax_m31.webp | MiniMax | 2026 | Vision | Spark | 5 | NES | ★★★★ | Unified code, media, and multi-agent productivity specialist built with Lightning Attention. |
| 53 | **MiMo-V2.6** | mimo_v26.webp | Xiaomi AI | 2026 | Logic | Ripple | 4 | NSW | ★★★★ | Edge-and-cloud reasoning disruptor tuned on dense algorithmic and coding verification suites. |
| 54 | **Mistral Large 4** | mistral_large4.webp | Mistral AI | 2026 | Language | Spark | 7 | SW | ★★★★★ | Multilingual European flagship uniting strict structured JSON tool calls with deep code reasoning. |

### V. Frontier Reasoners (2023–2026) — 13 cards, frame colour #f59e0b

| # | Card | Art file | Maker | Year | Mode | Echo | Signal | Links | Rarity | What it is |
|---|---|---|---|---|---|---|---|---|---|---|
| 55 | **GPT-4** | gpt4.webp | OpenAI | 2023 | Vision | Ripple | 4 | ESW | ★★★★ | Cleared the Uniform Bar Exam and rewrote enterprise benchmarks across law, code, and vision. |
| 56 | **GPT-4o** | gpt4o.webp | OpenAI | 2024 | Vision | Ripple | 6 | ES | ★★★★ | Single unified network perceiving audio, sight, and text in real time within human conversation latency. |
| 57 | **OpenAI o1** | openai_o1.webp | OpenAI | 2024 | Logic | Ripple | 6 | ES | ★★★★★ | Invented mainstream inference-time scaling: thinking before speaking on PhD physics and math. |
| 58 | **OpenAI o3** | openai_o3.webp | OpenAI | 2025 | Logic | Ripple | 7 | EW | ★★★★★ | Cracked ARC-AGI high-compute thresholds and grandmaster competitive programming scores. |
| 59 | **Claude 3.5 Sonnet** | claude35.webp | Anthropic | 2024 | Language | Ripple | 6 | NSW | ★★★★ | First frontier developer darling to pilot live graphical OS desktops via native Computer Use. |
| 60 | **Gemini 1.5 Pro** | gemini15.webp | Google DeepMind | 2024 | Vision | Ripple | 6 | NE | ★★★★ | Ingested entire repositories, hours of video, and Symphonies in one zero-loss 2M-token context. |
| 61 | **Amazon Nova Premier** | nova_premier.webp | AWS | 2024 | Language | Ripple | 6 | NS | ★★★★ | Orchestrator and teacher model built inside AWS Bedrock for massive enterprise tool pipelines. |
| 62 | **Ernie 4.5** | ernie45.webp | Baidu | 2025 | Vision | Spark | 4 | NSW | ★★★★ | Synthesizes structured knowledge graphs with native multimodal perception across massive corpora. |
| 63 | **Hunyuan-Large** | hunyuan.webp | Tencent | 2024 | Language | Spark | 5 | NEW | ★★★★ | Largest Transformer open-MoE of 2024 utilizing Recycle-Routing for KV-cache compression. |
| 64 | **Grok 4** | grok4.webp | xAI | 2025 | Language | Ripple | 5 | NES | ★★★★★ | Trained across 200,000+ GPUs in Memphis, pairing heavy RL reasoning with live world tools. |
| 65 | **Gemini 4 Carbon** | gemini4_carbon.webp | Google DeepMind | 2026 | Language | Ripple | 7 | NW | ★★★★★ | Next-wave native computer-use and software engineering titan balancing speed with surgical foresight. |
| 66 | **Claude Opus 5.5** | claude_opus55.webp | Anthropic | 2026 | Logic | Ripple | 6 | NE | ★★★★★★ | Grand Sovereign of autonomous software engineering, multi-hour agent swarms, and crisp synthesis. |
| 67 | **GPT-6 Astra** | gpt6_astra.webp | OpenAI | 2026 | Vision | Ripple | 8 | NW | ★★★★★★ | Apex frontier Leviathan forged for graduate-level scientific reasoning and autonomous research loops. |

### VI. Multimodal World-Sims (2022–2026) — 13 cards, frame colour #e879f9

| # | Card | Art file | Maker | Year | Mode | Echo | Signal | Links | Rarity | What it is |
|---|---|---|---|---|---|---|---|---|---|---|
| 68 | **Stable Diffusion 1.5** | sd15.webp | CompVis / Stability AI | 2022 | Dream | Surge | 4 | ESW | ★★ | Compressed visual synthesis into latent manifolds so consumer GPUs could conjure entire worlds. |
| 69 | **Whisper Large** | whisper.webp | OpenAI | 2022 | Sound | Mirror | 3 | NEW | ★★ | Trained across 680,000 hours of multilingual audio; unshakeable ear in stormy noise. |
| 70 | **DALL-E 3** | dalle3.webp | OpenAI | 2023 | Dream | Surge | 5 | NSW | ★★★ | Recaptioned dense training datasets to translate nuanced prose into faithful spatial art. |
| 71 | **MusicGen** | musicgen.webp | Meta AI (AudioCraft) | 2023 | Sound | Mirror | 4 | NSW | ★★★ | Single-stage autoregressive transformer generating high-fidelity music from text and melody. |
| 72 | **Ideogram** | ideogram.webp | Ideogram AI | 2024 | Dream | Surge | 4 | NES | ★★★★ | Solved generative typography nightmares, etching crystal-clear signs, posters, and glyphs. |
| 73 | **FLUX.2** | flux2.webp | Black Forest Labs | 2025 | Dream | Surge | 5 | NES | ★★★★ | Built by Stable Diffusion founders using rectified flow-matching and subject consistency locks. |
| 74 | **Midjourney v7** | midjourney7.webp | Midjourney | 2025 | Dream | Surge | 5 | ESW | ★★★★★ | Master of chiaroscuro lighting, rich painterly surface texture, and atmospheric cinema frames. |
| 75 | **OpenAI Sora** | sora.webp | OpenAI | 2024 | Dream | Surge | 7 | NES | ★★★★★ | Decomposes video into spacetime patches, learning emergent 3D object permanence and camera motion. |
| 76 | **Google Veo 3.1** | veo31.webp | Google DeepMind | 2025 | Dream | Surge | 5 | NES | ★★★★★ | Renders synchronized dialogue, Foley physics, and multi-ingredient cinema in one joint latent pass. |
| 77 | **Runway Gen-4** | runway_gen4.webp | Runway | 2025 | Dream | Surge | 5 | NSW | ★★★★ | Consistent characters and deterministic camera tracks built for Hollywood VFX pipelines. |
| 78 | **Kling 3.0** | kling3.webp | Kuaishou | 2025 | Dream | Surge | 5 | NEW | ★★★★ | High-frame-rate fluid physics, complex human motion, and coherent multi-cut storytelling. |
| 79 | **Suno v4** | suno.webp | Suno | 2025 | Sound | Mirror | 5 | ESW | ★★★★ | Composes full multi-stem songs with expressive lead vocals, hooks, and mastering in seconds. |
| 80 | **ElevenLabs Voice** | elevenlabs.webp | ElevenLabs | 2024 | Sound | Mirror | 6 | NES | ★★★★ | Sub-second emotional inflection and zero-shot voice synthesis across dozens of spoken tongues. |
