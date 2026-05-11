import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Key, Zap, Shield, Users, Code2, Check } from 'lucide-react';
import AuraSprite from '../sprites/AuraSprite';
import NovaSprite from '../sprites/NovaSprite';
import { useAppStore } from '../../stores/appStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { saveUserKeys, type UserAPIKeys } from '../../services/keyService';

interface Props {
  onComplete: () => void;
}

const ROLE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  owner:   { label: 'Owner',   color: '#ff0080', desc: 'Full system access. All panels. All commands.' },
  partner: { label: 'Partner', color: '#fbbf24', desc: 'Collaborator access. Build, ship, voice, and chat.' },
  dev:     { label: 'Dev',     color: '#00f0ff', desc: 'Engineering access. Editor, AI, tasks, and terminal.' },
  staff:   { label: 'Staff',   color: '#8b5cf6', desc: 'Team access. Chat, tasks, and collaboration tools.' },
};

const PANEL_TOUR = [
  { icon: '⚡', label: 'Dashboard', desc: 'Live system health, task stats, and team presence at a glance.' },
  { icon: '💬', label: 'Chat',      desc: 'Encrypted team messenger. Channels, code snippets, reactions.' },
  { icon: '🎙️', label: 'Voice',     desc: 'Real-time voice rooms. WebRTC peer-to-peer, no third party.' },
  { icon: '📋', label: 'Tasks',     desc: 'Kanban board synced across the team. Link tasks to code files.' },
  { icon: '🤖', label: 'AI Ops',    desc: 'Claude, Gemini, and Kimi — all three, one interface, with file context.' },
  { icon: '💻', label: 'Editor',    desc: 'Monaco editor with live terminal. Read, write, and run from anywhere.' },
  { icon: '🛡️', label: 'Admin',     desc: 'User management, deploy controls, and Firebase oversight.' },
];

export default function OnboardingFlow({ onComplete }: Props) {
  const { user, profile } = useAppStore();
  const [step, setStep] = useState(0);
  const [auraMood, setAuraMood] = useState<'idle' | 'speaking' | 'thinking' | 'welcoming'>('welcoming');
  const [novaMood, setNovaMood] = useState<'idle' | 'speaking' | 'thinking' | 'welcoming'>('idle');
  const [keys, setKeys] = useState<UserAPIKeys>({ openrouter: '', anthropic: '', gemini: '', kimi: '', useOwn: false });
  const [saving, setSaving] = useState(false);

  const roleCfg = ROLE_LABELS[profile?.role || 'staff'];
  const firstName = profile?.displayName?.split(' ')[0] || 'there';

  useEffect(() => {
    // Alternate who's speaking based on step
    if (step === 0 || step === 2 || step === 4) {
      setAuraMood('welcoming'); setNovaMood('idle');
    } else if (step === 1 || step === 3) {
      setNovaMood('welcoming'); setAuraMood('idle');
    } else if (step === 5) {
      setNovaMood('thinking'); setAuraMood('thinking');
    } else {
      setAuraMood('idle'); setNovaMood('idle');
    }
  }, [step]);

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (keys.useOwn || keys.openrouter) {
        await saveUserKeys(user!.uid, keys);
      }
      await updateDoc(doc(db, 'ops_staff', user!.uid), { onboarded: true });
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  const steps = [
    // Step 0 — Aura welcomes
    <Step key={0}>
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <AuraSprite size={160} mood={auraMood} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="text-neon-cyan/60 text-xs font-bold uppercase tracking-[0.3em] mb-3">Access Granted</p>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Welcome to the inside,<br />
            <span className="text-neon-cyan">{firstName}.</span>
          </h1>
          <p className="text-white/50 text-lg leading-relaxed">
            I'm Aura. You're standing in the operational core of NovAura —
            the space where what gets built gets decided.
            Not many people see this room.
          </p>
        </motion.div>
      </div>
    </Step>,

    // Step 1 — Nova introduces herself
    <Step key={1}>
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <NovaSprite size={160} mood={novaMood} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="text-amber-400/60 text-xs font-bold uppercase tracking-[0.3em] mb-3">System Online</p>
          <h2 className="text-3xl font-black text-white mb-4">
            And I'm <span className="text-amber-400">Nova</span>.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Where Aura flows, I structure. Together we handle every AI interaction
            in this system — analysis, code, strategy, and execution.
            Two perspectives, one mission.
          </p>
          <p className="text-white/30 text-sm mt-4 italic">
            "We are the twin engines of everything NovAura builds."
          </p>
        </motion.div>
      </div>
    </Step>,

    // Step 2 — Role reveal
    <Step key={2}>
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <div className="flex gap-6">
          <AuraSprite size={100} mood={auraMood} />
          <NovaSprite size={100} mood={novaMood} />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="text-white/40 text-sm mb-4">You've been assigned</p>
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border mb-6"
            style={{ borderColor: `${roleCfg.color}40`, background: `${roleCfg.color}10` }}>
            <Shield className="w-5 h-5" style={{ color: roleCfg.color }} />
            <span className="text-2xl font-black" style={{ color: roleCfg.color }}>{roleCfg.label}</span>
          </div>
          <p className="text-white/60 text-base leading-relaxed">{roleCfg.desc}</p>
          <p className="text-white/30 text-sm mt-4">
            Your access level is tied to this account. Dillan controls elevation.
          </p>
        </motion.div>
      </div>
    </Step>,

    // Step 3 — Tour
    <Step key={3}>
      <div className="flex flex-col items-center gap-6 max-w-xl w-full">
        <NovaSprite size={90} mood={novaMood} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="w-full">
          <h2 className="text-2xl font-black text-white text-center mb-6">Your arsenal.</h2>
          <div className="grid grid-cols-2 gap-2">
            {PANEL_TOUR.map((p, i) => (
              <motion.div key={p.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className="glass rounded-xl p-3 border border-white/5 flex gap-3 items-start"
              >
                <span className="text-xl flex-shrink-0">{p.icon}</span>
                <div>
                  <p className="text-white text-sm font-bold">{p.label}</p>
                  <p className="text-white/40 text-xs leading-snug">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </Step>,

    // Step 4 — AI keys (BYOK)
    <Step key={4}>
      <div className="flex flex-col items-center gap-6 max-w-lg w-full">
        <div className="flex gap-6 items-end">
          <AuraSprite size={100} mood={auraMood} />
          <NovaSprite size={100} mood={novaMood} />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="w-full">
          <h2 className="text-2xl font-black text-white text-center mb-2">Power source.</h2>
          <p className="text-white/40 text-sm text-center mb-6">
            We run on OpenRouter by default (free models, platform-funded).
            You can optionally bring your own keys if you want premium models or more throughput.
          </p>

          <div className="space-y-3">
            <KeyInput label="OpenRouter Key" placeholder="sk-or-... (optional — platform has one)"
              value={keys.openrouter} onChange={v => setKeys(p => ({ ...p, openrouter: v }))}
              hint="Routes to 50+ free models. Your key = your quota, no rate limits." />
            <KeyInput label="Anthropic Key (Claude)" placeholder="sk-ant-... (optional)"
              value={keys.anthropic} onChange={v => setKeys(p => ({ ...p, anthropic: v }))}
              hint="Direct Claude access. Faster + higher limits than OpenRouter." />
            <KeyInput label="Gemini Key" placeholder="AIza... (optional)"
              value={keys.gemini} onChange={v => setKeys(p => ({ ...p, gemini: v }))}
              hint="Google Gemini 2.0 Flash. Already fast, your key removes caps." />
          </div>

          <label className="flex items-center gap-3 mt-4 cursor-pointer group">
            <div onClick={() => setKeys(p => ({ ...p, useOwn: !p.useOwn }))}
              className={`w-10 h-5 rounded-full transition-all relative ${keys.useOwn ? 'bg-neon-cyan' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${keys.useOwn ? 'left-5' : 'left-0.5'}`} />
            </div>
            <span className="text-white/60 text-sm group-hover:text-white/80 transition-colors">
              Prefer my own keys when available
            </span>
          </label>

          <p className="text-white/20 text-xs mt-4 text-center">
            Keys are stored encrypted in your personal Firestore profile. Never shared with other users.
            Skip this — you can set keys later in Admin → Settings.
          </p>
        </motion.div>
      </div>
    </Step>,

    // Step 5 — Final
    <Step key={5}>
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <div className="flex gap-4 items-end">
          <AuraSprite size={120} mood="welcoming" />
          <NovaSprite size={120} mood="welcoming" />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan text-xs font-bold uppercase tracking-widest mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
            System Initialized
          </motion.div>
          <h2 className="text-3xl font-black text-white mb-4">
            You're in, {firstName}.
          </h2>
          <p className="text-white/50 text-base leading-relaxed">
            NovAura is being built in real time — and now you're part of how it happens.
            The platform, the OS, the AI infrastructure — it's all here.
            Let's build something that lasts.
          </p>
        </motion.div>
      </div>
    </Step>,
  ];

  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-void flex flex-col items-center justify-center overflow-hidden">
      {/* Background rings */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-10"
          style={{ background: 'conic-gradient(from 0deg, #00f0ff, #8b5cf6, #ff0080, #00f0ff)', top: '10%', left: '10%', animation: 'spin 40s linear infinite' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-8"
          style={{ background: 'conic-gradient(from 180deg, #fbbf24, #cc785c, #f97316, #fbbf24)', bottom: '10%', right: '10%', animation: 'spin 50s linear infinite reverse' }} />
      </div>

      {/* Step content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center w-full"
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-6 mt-10">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="text-white/30 hover:text-white/60 text-sm transition-colors">
              ← Back
            </button>
          )}

          {/* Step dots */}
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-neon-cyan' : i < step ? 'w-1.5 bg-white/30' : 'w-1.5 bg-white/10'}`} />
            ))}
          </div>

          <button
            onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
            style={{
              background: isLast ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.05)',
              border: isLast ? '1px solid rgba(0,240,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: isLast ? '#00f0ff' : 'rgba(255,255,255,0.7)',
            }}
          >
            {saving ? 'Saving...' : isLast ? <><Check className="w-4 h-4" /> Enter Ops</> : <>Next <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center w-full">{children}</div>;
}

function KeyInput({ label, placeholder, value, onChange, hint }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; hint: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-white/50 text-xs font-semibold flex items-center gap-1.5">
        <Key className="w-3 h-3" />{label}
      </label>
      <input
        type="password"
        className="w-full bg-void-lighter border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-neon-cyan/40 transition-colors selectable"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-white/25 text-[10px]">{hint}</p>
    </div>
  );
}
