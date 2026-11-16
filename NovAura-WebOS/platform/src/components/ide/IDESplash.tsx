import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, FolderOpen, ArrowRight } from 'lucide-react';
import { useIDEStore } from '../../stores/ideStore';
import { useAIStore } from '../../stores/aiStore';

// ── Animated digital tree drawn in SVG ──────────────────────────────────────
const NovaBranch: React.FC<{ d: string; delay?: number; color?: string }> = ({
  d,
  delay = 0,
  color = '#00F0FF',
}) => (
  <motion.path
    d={d}
    stroke={color}
    strokeWidth="1.5"
    fill="none"
    strokeLinecap="round"
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{ pathLength: 1, opacity: 1 }}
    transition={{ duration: 1.2, delay, ease: 'easeInOut' }}
  />
);

const NodeDot: React.FC<{ cx: number; cy: number; delay?: number; r?: number }> = ({
  cx, cy, delay = 0, r = 2.5,
}) => (
  <motion.circle
    cx={cx} cy={cy} r={r}
    fill="#00F0FF"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: [0, 1, 0.6, 1] }}
    transition={{ duration: 0.5, delay, ease: 'backOut' }}
  />
);

const AuraxNovaTree: React.FC = () => (
  <svg
    viewBox="0 0 160 180"
    className="w-36 h-36"
    style={{ filter: 'drop-shadow(0 0 12px rgba(0,240,255,0.4))' }}
  >
    {/* Root / trunk */}
    <NovaBranch d="M80 160 L80 110" delay={0} color="#00F0FF" />

    {/* Root spreaders */}
    <NovaBranch d="M80 155 L55 170" delay={0.1} color="#00d4e8" />
    <NovaBranch d="M80 155 L105 170" delay={0.1} color="#00d4e8" />
    <NovaBranch d="M80 162 L40 175" delay={0.15} color="#0099b8" />
    <NovaBranch d="M80 162 L120 175" delay={0.15} color="#0099b8" />

    {/* Main trunk split */}
    <NovaBranch d="M80 110 L55 75" delay={0.3} color="#00F0FF" />
    <NovaBranch d="M80 110 L105 75" delay={0.3} color="#00F0FF" />

    {/* Left mid-branches */}
    <NovaBranch d="M55 75 L35 50" delay={0.55} color="#4DF4FF" />
    <NovaBranch d="M55 75 L65 45" delay={0.6} color="#4DF4FF" />
    <NovaBranch d="M55 75 L45 65" delay={0.65} color="#4DF4FF" />

    {/* Right mid-branches */}
    <NovaBranch d="M105 75 L125 50" delay={0.55} color="#4DF4FF" />
    <NovaBranch d="M105 75 L95 45" delay={0.6} color="#4DF4FF" />
    <NovaBranch d="M105 75 L115 65" delay={0.65} color="#4DF4FF" />

    {/* Upper left tips */}
    <NovaBranch d="M35 50 L22 35" delay={0.85} color="#a78bfa" />
    <NovaBranch d="M35 50 L40 30" delay={0.9} color="#a78bfa" />
    <NovaBranch d="M65 45 L58 28" delay={0.85} color="#a78bfa" />
    <NovaBranch d="M65 45 L72 25" delay={0.9} color="#a78bfa" />

    {/* Upper right tips */}
    <NovaBranch d="M125 50 L138 35" delay={0.85} color="#a78bfa" />
    <NovaBranch d="M125 50 L120 30" delay={0.9} color="#a78bfa" />
    <NovaBranch d="M95 45 L102 28" delay={0.85} color="#a78bfa" />
    <NovaBranch d="M95 45 L88 25" delay={0.9} color="#a78bfa" />

    {/* Center canopy top */}
    <NovaBranch d="M80 110 L80 55" delay={0.4} color="#00F0FF" />
    <NovaBranch d="M80 55 L68 30" delay={0.75} color="#7dd3fc" />
    <NovaBranch d="M80 55 L92 30" delay={0.75} color="#7dd3fc" />
    <NovaBranch d="M80 55 L80 18" delay={0.8} color="#4DF4FF" />

    {/* Circuit node dots */}
    <NodeDot cx={80} cy={110} delay={0.3} r={3} />
    <NodeDot cx={55} cy={75} delay={0.55} r={2.5} />
    <NodeDot cx={105} cy={75} delay={0.55} r={2.5} />
    <NodeDot cx={80} cy={55} delay={0.7} r={2.5} />
    <NodeDot cx={35} cy={50} delay={0.85} r={2} />
    <NodeDot cx={125} cy={50} delay={0.85} r={2} />
    <NodeDot cx={65} cy={45} delay={0.87} r={2} />
    <NodeDot cx={95} cy={45} delay={0.87} r={2} />
    <NodeDot cx={22} cy={35} delay={1.0} r={1.5} />
    <NodeDot cx={40} cy={30} delay={1.0} r={1.5} />
    <NodeDot cx={138} cy={35} delay={1.0} r={1.5} />
    <NodeDot cx={120} cy={30} delay={1.0} r={1.5} />
    <NodeDot cx={58} cy={28} delay={1.0} r={1.5} />
    <NodeDot cx={72} cy={25} delay={1.02} r={1.5} />
    <NodeDot cx={102} cy={28} delay={1.0} r={1.5} />
    <NodeDot cx={88} cy={25} delay={1.02} r={1.5} />
    <NodeDot cx={80} cy={18} delay={1.05} r={2} />

    {/* AN emblem circle */}
    <motion.circle
      cx={80} cy={110}
      r={14}
      stroke="#00F0FF"
      strokeWidth="1"
      fill="rgba(0,240,255,0.05)"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.25 }}
    />
    <motion.text
      x={80} y={114}
      textAnchor="middle"
      fill="#00F0FF"
      fontSize="8"
      fontWeight="bold"
      fontFamily="monospace"
      letterSpacing="1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      AN
    </motion.text>
  </svg>
);

// ── Floating particle dots ────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  duration: Math.random() * 6 + 4,
  delay: Math.random() * 3,
}));

// ── Quick-start action cards ──────────────────────────────────────────────
interface ActionCard {
  icon: React.ReactNode;
  label: string;
  sub: string;
  color: string;
  onClick: () => void;
}

// ── Main splash component ──────────────────────────────────────────────────
const IDESplash: React.FC = () => {
  const { showSplash, dismissSplash, setBuilderBotActive } = useIDEStore();
  const { setActiveIDETab } = useAIStore();

  const handleNewProject = () => {
    dismissSplash();
    setActiveIDETab('editor');
  };

  const handleBuildWithBot = () => {
    setBuilderBotActive(true);
    dismissSplash();
  };

  const handlePreview = () => {
    dismissSplash();
    setActiveIDETab('preview');
  };

  const actions: ActionCard[] = [
    {
      icon: <Sparkles className="w-4 h-4" />,
      label: 'New Project',
      sub: 'Start from the default canvas',
      color: 'border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/5',
      onClick: handleNewProject,
    },
    {
      icon: <Zap className="w-4 h-4" />,
      label: 'Build with BuilderBot',
      sub: 'Let AI generate your first project',
      color: 'border-neon-violet/30 text-neon-violet hover:bg-neon-violet/5',
      onClick: handleBuildWithBot,
    },
    {
      icon: <FolderOpen className="w-4 h-4" />,
      label: 'Open Preview',
      sub: 'See the live canvas render',
      color: 'border-blue-400/30 text-blue-400 hover:bg-blue-400/5',
      onClick: handlePreview,
    },
  ];

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          key="ide-splash"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-void"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.4 }}
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(rgba(0,240,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.15) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Radial glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-neon-cyan/5 blur-3xl" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-neon-violet/5 blur-3xl" />
          </div>

          {/* Floating particles */}
          {PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-neon-cyan/40 pointer-events-none"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
              animate={{ y: [0, -20, 0], opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {/* Content */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6 px-8 text-center max-w-lg"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Tree logo */}
            <AuraxNovaTree />

            {/* Brand name */}
            <div className="space-y-1">
              <motion.h1
                className="text-3xl font-heading font-black tracking-[0.2em] uppercase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <span className="text-neon-cyan">AURA</span>
                <span className="text-white/30 mx-3">×</span>
                <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">NOVA</span>
              </motion.h1>

              <motion.p
                className="text-[11px] font-mono tracking-[0.35em] uppercase text-text-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                Operating System · Studio Edition
              </motion.p>

              <motion.div
                className="flex items-center justify-center gap-2 pt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.25 }}
              >
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />
                <span className="text-[9px] font-mono text-neon-cyan/50 tracking-widest uppercase">v 2.4.102</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />
              </motion.div>
            </div>

            {/* Tagline */}
            <motion.p
              className="text-[12px] text-text-muted leading-relaxed max-w-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              Where intelligence meets creation. Build, iterate, and deploy from a single neural workspace.
            </motion.p>

            {/* Action cards */}
            <motion.div
              className="w-full space-y-2 pt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.45 }}
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-transparent transition-all group ${action.color}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                      {action.icon}
                    </div>
                    <div className="text-left">
                      <div className="text-[11px] font-bold uppercase tracking-wide">{action.label}</div>
                      <div className="text-[9px] text-text-muted mt-0.5">{action.sub}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </motion.div>

            {/* Footer note */}
            <motion.p
              className="text-[9px] text-text-muted/50 font-mono tracking-wider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6 }}
            >
              AURA × NOVA STUDIOS · NOVAURA VERSE ECOSYSTEM · 2026
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IDESplash;
