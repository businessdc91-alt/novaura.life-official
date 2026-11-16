import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, Key, Zap, Brain, Cpu, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Step {
  text: string;
  url?: string;
  urlLabel?: string;
}

interface Provider {
  id: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  accentColor: string;
  glowColor: string;
  consoleUrl: string;
  consoleName: string;
  pricingUrl: string;
  freeCredits?: string;
  costNote: string;
  novauraMultiplier: string;
  steps: Step[];
  whyBother: string[];
  outsideNovAura: string[];
}

const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'The platform default — already works out of the box.',
    icon: <Sparkles className="w-5 h-5" />,
    accentColor: '#00F0FF',
    glowColor: 'rgba(0,240,255,0.25)',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    consoleName: 'Google AI Studio',
    pricingUrl: 'https://ai.google.dev/pricing',
    freeCredits: '1,500 requests/day free on Flash',
    costNote: 'Flash: ~$0.075/M tokens · Pro: ~$1.25/M tokens',
    novauraMultiplier: '×1 (base cost — cheapest on platform)',
    steps: [
      { text: 'Go to Google AI Studio', url: 'https://aistudio.google.com/app/apikey', urlLabel: 'aistudio.google.com' },
      { text: 'Sign in with any Google account.' },
      { text: 'Click "Create API key" → "Create API key in new project".' },
      { text: 'Copy the key that starts with AIza...' },
      { text: 'Paste it into the Gemini Key field in NovaIDE → Swarm Settings.' },
    ],
    whyBother: [
      'Studio+ with your own Gemini key means ZERO credit cost — unlimited BuilderBot runs.',
      'Studio tier removes the credit gate; add your own key to go fully unlimited.',
      'Free tier on Google AI Studio gives 1,500 requests/day at no charge.',
    ],
    outsideNovAura: [
      'Google Workspace automation, Sheets AI, Docs summarization.',
      'Build your own chatbots, Discord bots, or content pipelines.',
      'Image understanding with Gemini Vision (free on Flash).',
      'Code generation assistants in your own apps.',
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    tagline: 'The most thoughtful model for complex reasoning and creative writing.',
    icon: <Brain className="w-5 h-5" />,
    accentColor: '#FF6B35',
    glowColor: 'rgba(255,107,53,0.25)',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    consoleName: 'Anthropic Console',
    pricingUrl: 'https://www.anthropic.com/pricing',
    freeCredits: '$5 free credits on new accounts',
    costNote: 'Haiku: ~$0.25/M input · Sonnet: ~$3/M · Opus: ~$15/M',
    novauraMultiplier: '×3 (premium model, highest quality output)',
    steps: [
      { text: 'Visit console.anthropic.com and sign up.', url: 'https://console.anthropic.com', urlLabel: 'console.anthropic.com' },
      { text: 'Go to Settings → API Keys.' },
      { text: 'Click "Create Key", give it a name like "NovAura".' },
      { text: 'Copy the key starting with sk-ant-...' },
      { text: 'Paste into the Claude Key field in NovaIDE → Swarm Settings.' },
    ],
    whyBother: [
      'Own key = free inference on Studio+ — Studio tier ($17) with your own Claude key beats Catalyst tier ($50) in cost.',
      'Access Claude Haiku (Creator), Sonnet (Studio), or Opus (Catalyst) with platform credits OR unlimited with own key on Studio+.',
      'Claude is consistently rated best for long-form code quality and nuanced instruction following.',
    ],
    outsideNovAura: [
      'Complex document analysis, contract review, legal summarization.',
      'Long-context coding tasks (200K token window on Sonnet/Opus).',
      'Creative writing, game narrative generation, dialogue systems.',
      'Claude API in your own products — very competitive Haiku pricing.',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    tagline: 'The industry standard — massive ecosystem and plugin support.',
    icon: <Cpu className="w-5 h-5" />,
    accentColor: '#10B981',
    glowColor: 'rgba(16,185,129,0.25)',
    consoleUrl: 'https://platform.openai.com/api-keys',
    consoleName: 'OpenAI Platform',
    pricingUrl: 'https://openai.com/api/pricing',
    freeCredits: 'No free tier — pay-as-you-go from $5 minimum',
    costNote: 'GPT-4o: ~$2.50/M input · $10/M output',
    novauraMultiplier: '×2 (mid-range cost)',
    steps: [
      { text: 'Go to platform.openai.com and create an account.', url: 'https://platform.openai.com', urlLabel: 'platform.openai.com' },
      { text: 'Navigate to API Keys in the left sidebar.' },
      { text: 'Click "+ Create new secret key" and name it.' },
      { text: 'Copy the key starting with sk-proj-... (shown only once).' },
      { text: 'Paste into the OpenAI Key field in NovaIDE → Swarm Settings.' },
    ],
    whyBother: [
      'Own key = free inference on Studio+ — ×2 multiplier credits not charged for Studio and above.',
      'Access GPT-4o which excels at structured JSON output, function calling, tool use.',
      'Largest third-party plugin ecosystem if you build your own integrations.',
    ],
    outsideNovAura: [
      'DALL·E image generation for concept art, assets, thumbnails.',
      'Whisper transcription for audio-to-text workflows.',
      'Fine-tuning GPT-3.5 on your own dataset for brand voice.',
      'Assistants API with persistent threads and file attachments.',
    ],
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    tagline: 'Exceptional long-context performance at a fraction of Western prices.',
    icon: <Zap className="w-5 h-5" />,
    accentColor: '#8B5CF6',
    glowColor: 'rgba(139,92,246,0.25)',
    consoleUrl: 'https://platform.moonshot.cn/console/api-keys',
    consoleName: 'Moonshot Console',
    pricingUrl: 'https://platform.moonshot.cn/docs/pricing',
    freeCredits: '15 yuan (~$2 USD) free on signup',
    costNote: 'moonshot-v1-8k: ~¥0.012/K tokens (very cheap)',
    novauraMultiplier: '×3 (matched with Claude — long-context premium)',
    steps: [
      { text: 'Visit platform.moonshot.cn and register.', url: 'https://platform.moonshot.cn', urlLabel: 'platform.moonshot.cn' },
      { text: 'Complete phone/email verification.' },
      { text: 'Go to Console → API Keys.' },
      { text: 'Click "New Key", copy the sk-... token.' },
      { text: 'Paste into the Kimi Key field in NovaIDE → Swarm Settings.' },
    ],
    whyBother: [
      'Own key = free inference on Studio+ — Studio tier ($17) with Kimi key = unlimited runs at zero NovAura credits.',
      'Kimi supports 128K–200K context windows — ideal for huge codebases or full game scripts.',
      'Extremely low token cost if you decide to run your own pipelines outside NovAura.',
    ],
    outsideNovAura: [
      'Processing entire codebases in a single prompt (200K context).',
      'Translating or localizing massive documents at near-zero cost.',
      'Competitive Chinese-language AI for localized game content.',
      'Long-form story and lore generation with consistent world memory.',
    ],
  },
];

const ProviderCardInner: React.FC<{ provider: Provider }> = ({ provider }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-xl border bg-black/40 backdrop-blur overflow-hidden"
      style={{ borderColor: `${provider.accentColor}22` }}
    >
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `${provider.accentColor}15`, color: provider.accentColor, boxShadow: `0 0 12px ${provider.glowColor}` }}
          >
            {provider.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base">{provider.name}</h3>
              <span
                className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border"
                style={{ color: provider.accentColor, borderColor: `${provider.accentColor}40` }}
              >
                {provider.novauraMultiplier}
              </span>
            </div>
            <p className="text-sm text-white/50 mt-0.5">{provider.tagline}</p>
            {provider.freeCredits && (
              <p className="text-xs mt-1.5" style={{ color: provider.accentColor }}>
                ✦ {provider.freeCredits}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-1.5 rounded-lg transition-colors text-white/40 hover:text-white hover:bg-white/5"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5 border-t border-white/5 pt-5">
              {/* Cost info */}
              <div className="rounded-lg p-3 text-xs font-mono text-white/50" style={{ backgroundColor: `${provider.accentColor}08` }}>
                <span style={{ color: provider.accentColor }}>Cost: </span>{provider.costNote}
              </div>

              {/* Setup steps */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">How to get your key</p>
                <ol className="space-y-2">
                  {provider.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-white/70">
                      <span
                        className="shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: `${provider.accentColor}20`, color: provider.accentColor }}
                      >
                        {i + 1}
                      </span>
                      <span>
                        {step.text}
                        {step.url && (
                          <a
                            href={step.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 inline-flex items-center gap-0.5 text-xs underline underline-offset-2"
                            style={{ color: provider.accentColor }}
                          >
                            {step.urlLabel} <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Why bring your own */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Why bring your own key</p>
                  <ul className="space-y-2">
                    {provider.whyBother.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-white/60">
                        <span style={{ color: provider.accentColor }} className="shrink-0 mt-0.5">◆</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Outside NovAura */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">What else you can build</p>
                  <ul className="space-y-2">
                    {provider.outsideNovAura.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-white/60">
                        <span className="text-white/20 shrink-0 mt-0.5">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all hover:opacity-90"
                  style={{
                    backgroundColor: `${provider.accentColor}15`,
                    borderColor: `${provider.accentColor}40`,
                    color: provider.accentColor,
                  }}
                >
                  <Key className="w-3.5 h-3.5" />
                  Get API Key — {provider.consoleName}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
                <a
                  href={provider.pricingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-white/10 text-white/40 hover:text-white/70 transition-all"
                >
                  View Pricing
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const APIKeyLibraryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,240,255,0.3), transparent)',
          }}
        />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)' }}
        />
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00F0FF]/20 bg-[#00F0FF]/5 text-[#00F0FF] text-xs font-mono uppercase tracking-widest mb-6"
          >
            <Key className="w-3 h-3" />
            API Key Library
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-black mb-4 leading-tight"
          >
            Your Keys,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6]">
              Your Freedom
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/50 text-lg max-w-2xl mx-auto"
          >
            Bring your own API key to any provider and{' '}
            <span className="text-white/80 font-semibold">inference becomes completely free</span> on NovAura —
            zero credits charged, unlimited BuilderBot runs.
          </motion.p>
        </div>
      </div>

      {/* How it works banner */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-[#00F0FF]/15 bg-[#00F0FF]/5 p-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-center">
          {[
            { step: '01', title: 'Get a key', desc: 'Sign up with any AI provider below and grab a free or paid API key.' },
            { step: '02', title: 'Add it in the IDE', desc: 'Open NovaIDE → Swarm Settings and paste your key into the matching field.' },
            { step: '03', title: 'Run for free', desc: 'NovAura detects your key and removes the credit cost for that provider — forever.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-1">
              <div className="text-[10px] font-mono text-[#00F0FF]/50 tracking-widest">STEP {step}</div>
              <div className="font-bold text-white">{title}</div>
              <div className="text-sm text-white/40">{desc}</div>
            </div>
          ))}
        </div>

        {/* Selling point callout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 p-5"
        >
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-[#8B5CF6] font-bold">💡 Pro tip:</span>{' '}
            Studio tier ($17/mo) + your own Claude or OpenAI key gives you the same unlimited inference
            as Catalyst tier ($50/mo) — at a fraction of the price. Own-key free inference unlocks at
            Studio and above, so your API keys eliminate credit costs entirely.
          </p>
        </motion.div>
      </div>

      {/* Provider cards */}
      <div className="max-w-4xl mx-auto px-6 pb-8 space-y-4">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-6">
          Supported Providers
        </h2>
        {PROVIDERS.map((p) => (
          <ProviderCardInner key={p.id} provider={p} />
        ))}
      </div>

      {/* Local AI section */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="rounded-xl border border-white/8 bg-white/3 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">Ollama & LM Studio — Always Free</h3>
              <p className="text-sm text-white/50 mb-3">
                Running a local model on your own hardware? No key needed. Both Ollama and LM Studio are
                always free on NovAura — zero credits, zero configuration beyond pointing to your local endpoint.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/60">
                <div>
                  <p className="text-white/30 text-[10px] uppercase font-mono tracking-widest mb-1.5">Ollama</p>
                  <p>Default endpoint: <code className="text-white/80 text-xs bg-white/5 px-1 rounded">http://localhost:11434/api/generate</code></p>
                  <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-white/40 hover:text-white/70 underline">
                    ollama.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <p className="text-white/30 text-[10px] uppercase font-mono tracking-widest mb-1.5">LM Studio</p>
                  <p>Default endpoint: <code className="text-white/80 text-xs bg-white/5 px-1 rounded">http://localhost:1234/v1/chat/completions</code></p>
                  <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-white/40 hover:text-white/70 underline">
                    lmstudio.ai <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/5 py-12 text-center">
        <p className="text-white/40 text-sm mb-4">Ready to unlock free inference?</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate('/ide')}
            className="px-6 py-3 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-sm font-bold uppercase tracking-wider hover:bg-[#00F0FF]/20 transition-all"
          >
            Open NovaIDE
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="px-6 py-3 rounded-xl border border-white/10 text-white/50 text-sm font-bold uppercase tracking-wider hover:border-white/20 hover:text-white/70 transition-all"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default APIKeyLibraryPage;
