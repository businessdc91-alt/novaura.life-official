// awakeningsCards.ts — Card data for the tavern edition of Cognitive Awakenings:
// Echoes of a Soul. Generated from Novaura Sovereign OS (src/games/awakenings/cards.js);
// change the cards there and regenerate, so both editions agree.

export type Mode = "logic" | "language" | "vision" | "sound" | "dream";
export type Echo = "steadfast" | "mirror" | "chorus" | "spark" | "ripple" | "surge";
export interface MindSpec { id: string; name: string; maker: string; year: number; era: string; rarity: number; signal: number; mode: Mode; echo: Echo; links: boolean[] }

export const MODE_CYCLE: Mode[] = ["logic","language","vision","sound","dream"];
export const MODES: Record<Mode, { label: string; icon: string; color: string }> = {
  "logic": {
    "label": "Logic",
    "icon": "🧮",
    "color": "#38bdf8"
  },
  "language": {
    "label": "Language",
    "icon": "🗣️",
    "color": "#a78bfa"
  },
  "vision": {
    "label": "Vision",
    "icon": "👁️",
    "color": "#34d399"
  },
  "sound": {
    "label": "Sound",
    "icon": "🎵",
    "color": "#fb7185"
  },
  "dream": {
    "label": "Dream",
    "icon": "🌙",
    "color": "#f0abfc"
  }
};
export const ECHOES: Record<Echo, { label: string; icon: string; text: string }> = {
  "steadfast": {
    "label": "Steadfast",
    "icon": "🛡️",
    "text": "+2 Signal when an enemy tries to capture it."
  },
  "mirror": {
    "label": "Mirror",
    "icon": "🪞",
    "text": "Attackers never get a mode advantage against it."
  },
  "chorus": {
    "label": "Chorus",
    "icon": "🎶",
    "text": "When placed, every allied neighbour gains +1 Signal."
  },
  "spark": {
    "label": "Spark",
    "icon": "✨",
    "text": "+1 Signal on attack for each allied neighbour."
  },
  "ripple": {
    "label": "Ripple",
    "icon": "🌊",
    "text": "Cards it captures resonate in turn and can capture too."
  },
  "surge": {
    "label": "Surge",
    "icon": "🌀",
    "text": "An Echo Well gives it +3 Signal instead of +1."
  }
};
export const MINDS: MindSpec[] = [
  {"id":"perceptron","name":"Perceptron Mk.I","maker":"Cornell / Rosenblatt","year":1957,"era":"primordial","rarity":1,"signal":1,"mode":"logic","echo":"steadfast","links":[true,true,true,true]},
  {"id":"eliza","name":"ELIZA","maker":"MIT / Weizenbaum","year":1966,"era":"primordial","rarity":1,"signal":1,"mode":"language","echo":"steadfast","links":[true,true,true,true]},
  {"id":"alexnet","name":"AlexNet","maker":"UToronto / Hinton Lab","year":2012,"era":"primordial","rarity":1,"signal":3,"mode":"vision","echo":"mirror","links":[true,false,true,true]},
  {"id":"resnet50","name":"ResNet-50","maker":"Microsoft Research","year":2015,"era":"primordial","rarity":1,"signal":1,"mode":"vision","echo":"mirror","links":[true,true,true,true]},
  {"id":"alphago","name":"AlphaGo","maker":"Google DeepMind","year":2016,"era":"primordial","rarity":2,"signal":4,"mode":"logic","echo":"spark","links":[true,false,true,true]},
  {"id":"transformer","name":"Transformer","maker":"Google Brain","year":2017,"era":"primordial","rarity":2,"signal":3,"mode":"language","echo":"chorus","links":[true,true,true,false]},
  {"id":"bert","name":"BERT-Large","maker":"Google AI Language","year":2018,"era":"primordial","rarity":2,"signal":2,"mode":"logic","echo":"chorus","links":[true,true,true,true]},
  {"id":"gpt2","name":"GPT-2 XL","maker":"OpenAI","year":2019,"era":"primordial","rarity":2,"signal":2,"mode":"language","echo":"chorus","links":[true,true,true,true]},
  {"id":"roberta","name":"RoBERTa","maker":"Meta AI","year":2019,"era":"primordial","rarity":2,"signal":4,"mode":"logic","echo":"chorus","links":[false,true,true,true]},
  {"id":"t5","name":"T5-XXL","maker":"Google Research","year":2019,"era":"primordial","rarity":2,"signal":2,"mode":"language","echo":"chorus","links":[true,true,true,true]},
  {"id":"muzero","name":"MuZero","maker":"Google DeepMind","year":2019,"era":"primordial","rarity":2,"signal":2,"mode":"logic","echo":"spark","links":[true,true,true,true]},
  {"id":"alphafold2","name":"AlphaFold 2","maker":"Google DeepMind","year":2020,"era":"primordial","rarity":3,"signal":5,"mode":"logic","echo":"spark","links":[true,false,true,true]},
  {"id":"gpt3","name":"GPT-3 DaVinci","maker":"OpenAI","year":2020,"era":"open_early","rarity":2,"signal":4,"mode":"logic","echo":"chorus","links":[true,true,false,true]},
  {"id":"clip","name":"CLIP ViT-L","maker":"OpenAI","year":2021,"era":"open_early","rarity":2,"signal":3,"mode":"vision","echo":"mirror","links":[true,true,true,false]},
  {"id":"codex","name":"OpenAI Codex","maker":"OpenAI","year":2021,"era":"open_early","rarity":2,"signal":2,"mode":"logic","echo":"steadfast","links":[true,true,true,true]},
  {"id":"chinchilla","name":"Chinchilla 70B","maker":"Google DeepMind","year":2022,"era":"open_early","rarity":2,"signal":3,"mode":"language","echo":"chorus","links":[true,true,true,false]},
  {"id":"bloom","name":"BLOOM 176B","maker":"BigScience / Hugging Face","year":2022,"era":"open_early","rarity":2,"signal":3,"mode":"language","echo":"steadfast","links":[true,false,true,true]},
  {"id":"opt175","name":"OPT-175B","maker":"Meta AI","year":2022,"era":"open_early","rarity":2,"signal":4,"mode":"logic","echo":"chorus","links":[true,true,false,true]},
  {"id":"pythia","name":"Pythia 12B","maker":"EleutherAI","year":2023,"era":"open_early","rarity":2,"signal":4,"mode":"language","echo":"steadfast","links":[true,true,true,false]},
  {"id":"llama1","name":"LLaMA-1 65B","maker":"Meta AI","year":2023,"era":"open_early","rarity":3,"signal":4,"mode":"language","echo":"chorus","links":[true,true,false,true]},
  {"id":"starcoder","name":"StarCoder","maker":"BigCode / ServiceNow","year":2023,"era":"open_early","rarity":2,"signal":3,"mode":"logic","echo":"steadfast","links":[true,true,true,false]},
  {"id":"falcon180","name":"Falcon 180B","maker":"TII UAE","year":2023,"era":"open_early","rarity":3,"signal":3,"mode":"language","echo":"chorus","links":[false,true,true,true]},
  {"id":"llama2","name":"Llama 2 70B","maker":"Meta AI","year":2023,"era":"open_early","rarity":3,"signal":4,"mode":"language","echo":"steadfast","links":[true,true,false,true]},
  {"id":"codellama","name":"CodeLlama 34B","maker":"Meta AI","year":2023,"era":"open_early","rarity":3,"signal":3,"mode":"logic","echo":"chorus","links":[true,false,true,true]},
  {"id":"mistral7b","name":"Mistral 7B","maker":"Mistral AI","year":2023,"era":"open_early","rarity":3,"signal":3,"mode":"language","echo":"steadfast","links":[true,true,false,true]},
  {"id":"mixtral","name":"Mixtral 8x7B","maker":"Mistral AI","year":2023,"era":"open_early","rarity":3,"signal":5,"mode":"language","echo":"spark","links":[true,false,true,true]},
  {"id":"mamba","name":"Mamba 2.8B","maker":"CMU / Princeton","year":2023,"era":"open_early","rarity":3,"signal":4,"mode":"logic","echo":"steadfast","links":[true,false,true,true]},
  {"id":"grok1","name":"Grok-1 314B","maker":"xAI","year":2023,"era":"open_early","rarity":3,"signal":4,"mode":"language","echo":"spark","links":[true,false,true,true]},
  {"id":"baichuan2","name":"Baichuan 2","maker":"Baichuan Intelligence","year":2023,"era":"open_vanguard","rarity":3,"signal":5,"mode":"language","echo":"steadfast","links":[false,true,true,true]},
  {"id":"palm2","name":"PaLM 2","maker":"Google","year":2023,"era":"open_vanguard","rarity":3,"signal":4,"mode":"language","echo":"chorus","links":[false,true,true,true]},
  {"id":"dbrx","name":"DBRX","maker":"Databricks","year":2024,"era":"open_vanguard","rarity":3,"signal":4,"mode":"language","echo":"spark","links":[false,true,true,true]},
  {"id":"arctic","name":"Snowflake Arctic","maker":"Snowflake AI","year":2024,"era":"open_vanguard","rarity":3,"signal":3,"mode":"language","echo":"spark","links":[false,true,true,true]},
  {"id":"internlm25","name":"InternLM 2.5","maker":"Shanghai AI Lab","year":2024,"era":"open_vanguard","rarity":3,"signal":3,"mode":"language","echo":"chorus","links":[false,true,true,true]},
  {"id":"yi_large","name":"Yi-Large","maker":"01.AI","year":2024,"era":"open_vanguard","rarity":3,"signal":4,"mode":"language","echo":"chorus","links":[true,false,true,true]},
  {"id":"command_r_plus","name":"Command R+","maker":"Cohere","year":2024,"era":"open_vanguard","rarity":4,"signal":6,"mode":"language","echo":"steadfast","links":[false,true,true,true]},
  {"id":"jamba15","name":"Jamba 1.5 Large","maker":"AI21 Labs","year":2024,"era":"open_vanguard","rarity":4,"signal":4,"mode":"language","echo":"spark","links":[false,true,true,true]},
  {"id":"gemma2","name":"Gemma 2 27B","maker":"Google DeepMind","year":2024,"era":"open_vanguard","rarity":3,"signal":5,"mode":"language","echo":"steadfast","links":[true,true,true,false]},
  {"id":"granite3","name":"IBM Granite 3","maker":"IBM Research","year":2024,"era":"open_vanguard","rarity":3,"signal":4,"mode":"language","echo":"steadfast","links":[true,true,false,true]},
  {"id":"llama31","name":"Llama 3.1 405B","maker":"Meta AI","year":2024,"era":"open_vanguard","rarity":4,"signal":6,"mode":"language","echo":"steadfast","links":[false,true,true,true]},
  {"id":"qwen25","name":"Qwen 2.5 72B","maker":"Alibaba Cloud","year":2024,"era":"open_vanguard","rarity":4,"signal":6,"mode":"language","echo":"chorus","links":[true,false,false,true]},
  {"id":"phi4","name":"Phi-4 14B","maker":"Microsoft Research","year":2024,"era":"open_vanguard","rarity":4,"signal":6,"mode":"language","echo":"steadfast","links":[false,true,false,true]},
  {"id":"olmo2","name":"OLMo 2 32B","maker":"Allen Institute (AI2)","year":2025,"era":"open_vanguard","rarity":4,"signal":6,"mode":"language","echo":"steadfast","links":[false,true,true,true]},
  {"id":"deepseek_v3","name":"DeepSeek-V3","maker":"DeepSeek","year":2024,"era":"open_vanguard","rarity":4,"signal":4,"mode":"language","echo":"spark","links":[false,true,true,true]},
  {"id":"deepseek_r1","name":"DeepSeek-R1","maker":"DeepSeek","year":2025,"era":"open_vanguard","rarity":5,"signal":5,"mode":"logic","echo":"ripple","links":[true,true,true,false]},
  {"id":"llama4_maverick","name":"Llama 4 Maverick","maker":"Meta AI","year":2025,"era":"open_titan","rarity":4,"signal":6,"mode":"vision","echo":"spark","links":[true,false,true,true]},
  {"id":"gpt_oss_120b","name":"gpt-oss-120b","maker":"OpenAI","year":2025,"era":"open_titan","rarity":5,"signal":6,"mode":"logic","echo":"ripple","links":[true,true,true,false]},
  {"id":"gemma4","name":"Gemma 4 31B","maker":"Google DeepMind","year":2026,"era":"open_titan","rarity":4,"signal":5,"mode":"vision","echo":"steadfast","links":[true,false,true,true]},
  {"id":"qwen38","name":"Qwen 3.8 27B","maker":"Alibaba Cloud","year":2026,"era":"open_titan","rarity":5,"signal":5,"mode":"language","echo":"spark","links":[false,true,true,true]},
  {"id":"glm53","name":"GLM-5.3","maker":"Zhipu AI","year":2026,"era":"open_titan","rarity":5,"signal":6,"mode":"language","echo":"spark","links":[false,true,true,true]},
  {"id":"deepseek_v41","name":"DeepSeek-V4.1","maker":"DeepSeek","year":2026,"era":"open_titan","rarity":5,"signal":5,"mode":"logic","echo":"ripple","links":[true,true,false,true]},
  {"id":"nemotron35","name":"Nemotron 3.5 Super","maker":"NVIDIA","year":2026,"era":"open_titan","rarity":5,"signal":6,"mode":"language","echo":"spark","links":[true,false,true,false]},
  {"id":"minimax_m31","name":"MiniMax-M3.1","maker":"MiniMax","year":2026,"era":"open_titan","rarity":4,"signal":5,"mode":"vision","echo":"spark","links":[true,true,true,false]},
  {"id":"mimo_v26","name":"MiMo-V2.6","maker":"Xiaomi AI","year":2026,"era":"open_titan","rarity":4,"signal":4,"mode":"logic","echo":"ripple","links":[true,false,true,true]},
  {"id":"mistral_large4","name":"Mistral Large 4","maker":"Mistral AI","year":2026,"era":"open_titan","rarity":5,"signal":7,"mode":"language","echo":"spark","links":[false,false,true,true]},
  {"id":"gpt4","name":"GPT-4","maker":"OpenAI","year":2023,"era":"frontier","rarity":4,"signal":4,"mode":"vision","echo":"ripple","links":[false,true,true,true]},
  {"id":"gpt4o","name":"GPT-4o","maker":"OpenAI","year":2024,"era":"frontier","rarity":4,"signal":6,"mode":"vision","echo":"ripple","links":[false,true,true,false]},
  {"id":"openai_o1","name":"OpenAI o1","maker":"OpenAI","year":2024,"era":"frontier","rarity":5,"signal":6,"mode":"logic","echo":"ripple","links":[false,true,true,false]},
  {"id":"openai_o3","name":"OpenAI o3","maker":"OpenAI","year":2025,"era":"frontier","rarity":5,"signal":7,"mode":"logic","echo":"ripple","links":[false,true,false,true]},
  {"id":"claude35","name":"Claude 3.5 Sonnet","maker":"Anthropic","year":2024,"era":"frontier","rarity":4,"signal":6,"mode":"language","echo":"ripple","links":[true,false,true,true]},
  {"id":"gemini15","name":"Gemini 1.5 Pro","maker":"Google DeepMind","year":2024,"era":"frontier","rarity":4,"signal":6,"mode":"vision","echo":"ripple","links":[true,true,false,false]},
  {"id":"nova_premier","name":"Amazon Nova Premier","maker":"AWS","year":2024,"era":"frontier","rarity":4,"signal":6,"mode":"language","echo":"ripple","links":[true,false,true,false]},
  {"id":"ernie45","name":"Ernie 4.5","maker":"Baidu","year":2025,"era":"frontier","rarity":4,"signal":4,"mode":"vision","echo":"spark","links":[true,false,true,true]},
  {"id":"hunyuan","name":"Hunyuan-Large","maker":"Tencent","year":2024,"era":"frontier","rarity":4,"signal":5,"mode":"language","echo":"spark","links":[true,true,false,true]},
  {"id":"grok4","name":"Grok 4","maker":"xAI","year":2025,"era":"frontier","rarity":5,"signal":5,"mode":"language","echo":"ripple","links":[true,true,true,false]},
  {"id":"gemini4_carbon","name":"Gemini 4 Carbon","maker":"Google DeepMind","year":2026,"era":"frontier","rarity":5,"signal":7,"mode":"language","echo":"ripple","links":[true,false,false,true]},
  {"id":"claude_opus55","name":"Claude Opus 5.5","maker":"Anthropic","year":2026,"era":"frontier","rarity":6,"signal":6,"mode":"logic","echo":"ripple","links":[true,true,false,false]},
  {"id":"gpt6_astra","name":"GPT-6 Astra","maker":"OpenAI","year":2026,"era":"frontier","rarity":6,"signal":8,"mode":"vision","echo":"ripple","links":[true,false,false,true]},
  {"id":"sd15","name":"Stable Diffusion 1.5","maker":"CompVis / Stability AI","year":2022,"era":"multimodal","rarity":2,"signal":4,"mode":"dream","echo":"surge","links":[false,true,true,true]},
  {"id":"whisper","name":"Whisper Large","maker":"OpenAI","year":2022,"era":"multimodal","rarity":2,"signal":3,"mode":"sound","echo":"mirror","links":[true,true,false,true]},
  {"id":"dalle3","name":"DALL-E 3","maker":"OpenAI","year":2023,"era":"multimodal","rarity":3,"signal":5,"mode":"dream","echo":"surge","links":[true,false,true,true]},
  {"id":"musicgen","name":"MusicGen","maker":"Meta AI (AudioCraft)","year":2023,"era":"multimodal","rarity":3,"signal":4,"mode":"sound","echo":"mirror","links":[true,false,true,true]},
  {"id":"ideogram","name":"Ideogram","maker":"Ideogram AI","year":2024,"era":"multimodal","rarity":4,"signal":4,"mode":"dream","echo":"surge","links":[true,true,true,false]},
  {"id":"flux2","name":"FLUX.2","maker":"Black Forest Labs","year":2025,"era":"multimodal","rarity":4,"signal":5,"mode":"dream","echo":"surge","links":[true,true,true,false]},
  {"id":"midjourney7","name":"Midjourney v7","maker":"Midjourney","year":2025,"era":"multimodal","rarity":5,"signal":5,"mode":"dream","echo":"surge","links":[false,true,true,true]},
  {"id":"sora","name":"OpenAI Sora","maker":"OpenAI","year":2024,"era":"multimodal","rarity":5,"signal":7,"mode":"dream","echo":"surge","links":[true,true,true,false]},
  {"id":"veo31","name":"Google Veo 3.1","maker":"Google DeepMind","year":2025,"era":"multimodal","rarity":5,"signal":5,"mode":"dream","echo":"surge","links":[true,true,true,false]},
  {"id":"runway_gen4","name":"Runway Gen-4","maker":"Runway","year":2025,"era":"multimodal","rarity":4,"signal":5,"mode":"dream","echo":"surge","links":[true,false,true,true]},
  {"id":"kling3","name":"Kling 3.0","maker":"Kuaishou","year":2025,"era":"multimodal","rarity":4,"signal":5,"mode":"dream","echo":"surge","links":[true,true,false,true]},
  {"id":"suno","name":"Suno v4","maker":"Suno","year":2025,"era":"multimodal","rarity":4,"signal":5,"mode":"sound","echo":"mirror","links":[false,true,true,true]},
  {"id":"elevenlabs","name":"ElevenLabs Voice","maker":"ElevenLabs","year":2024,"era":"multimodal","rarity":4,"signal":6,"mode":"sound","echo":"mirror","links":[true,true,true,false]},
];
