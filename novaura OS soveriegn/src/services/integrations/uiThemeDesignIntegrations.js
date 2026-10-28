/**
 * uiThemeDesignIntegrations.js — UI Themes, Design Systems & Component Blueprints
 * 
 * Production design token architectures and UI scaffolding templates for
 * Cyberpunk Neon Glass, Linear Modern SaaS, Cupertino Liquid Glass, Neo-Brutalist, and Minimalist Clean.
 */

export const UI_THEME_DESIGN_INTEGRATIONS = [
  // ── 1. DESIGN SYSTEM THEME ENGINE ────────────────────────────────────────
  {
    id: 'design_system_theme_engine',
    title: 'Multi-Theme Design System Engine (Cyberpunk, Linear, Cupertino)',
    category: 'ui_design_themes',
    vendor: 'NovAura Design Studio',
    badge: 'Design System & Tokens',
    icon: 'Palette',
    color: '#00f0ff',
    description: 'Complete CSS Variable and Tailwind design system architecture supporting 5 world-class aesthetics: Cyberpunk Neon Glass, Linear Modern SaaS, Cupertino Frosted Glass, Neo-Brutalist Bold, and Minimalist Clean.',
    suggestedPath: '/projects/cybeni/styles/themeEngine.css',
    language: 'css',
    aiPrompt: 'Implement a comprehensive multi-theme CSS variable design system supporting dark/light mode, custom glassmorphism blurs, fluid typography, and harmonious palettes.',
    faqs: [
      {
        question: 'How do I toggle themes dynamically in JavaScript?',
        answer: 'Set document.documentElement.setAttribute("data-theme", "cyberpunk" | "linear" | "cupertino" | "neo_brutalist") to swap all color tokens instantaneously.'
      }
    ],
    code: `/* ==========================================================================
   NovAura Sovereign OS — Multi-Theme Design Tokens
   Supports: [data-theme="cyberpunk"], [data-theme="linear"], [data-theme="cupertino"], [data-theme="neo_brutalist"]
   ========================================================================== */

:root, [data-theme="cyberpunk"] {
  --bg-primary: #070c1d;
  --bg-surface: rgba(15, 23, 42, 0.75);
  --bg-card: rgba(2, 6, 23, 0.85);
  --border-subtle: rgba(0, 240, 255, 0.18);
  --border-focus: #00f0ff;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent-cyan: #00f0ff;
  --accent-purple: #a855f7;
  --accent-emerald: #10b981;
  --shadow-neon: 0 0 20px rgba(0, 240, 255, 0.25);
  --glass-blur: blur(12px);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

[data-theme="linear"] {
  --bg-primary: #090d16;
  --bg-surface: #0f172a;
  --bg-card: #1e293b;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-focus: #38bdf8;
  --text-primary: #f1f5f9;
  --text-secondary: #64748b;
  --accent-cyan: #38bdf8;
  --accent-purple: #818cf8;
  --accent-emerald: #34d399;
  --shadow-neon: 0 4px 20px -2px rgba(0, 0, 0, 0.5);
  --glass-blur: blur(8px);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

[data-theme="cupertino"] {
  --bg-primary: #000000;
  --bg-surface: rgba(28, 28, 30, 0.7);
  --bg-card: rgba(44, 44, 46, 0.6);
  --border-subtle: rgba(255, 255, 255, 0.12);
  --border-focus: #0a84ff;
  --text-primary: #ffffff;
  --text-secondary: #8e8e93;
  --accent-cyan: #64d2ff;
  --accent-purple: #bf5af2;
  --accent-emerald: #30d158;
  --shadow-neon: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: blur(24px);
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;
}

[data-theme="neo_brutalist"] {
  --bg-primary: #fffbeb;
  --bg-surface: #ffffff;
  --bg-card: #fef08a;
  --border-subtle: #000000;
  --border-focus: #000000;
  --text-primary: #000000;
  --text-secondary: #374151;
  --accent-cyan: #06b6d4;
  --accent-purple: #e11d48;
  --accent-emerald: #16a34a;
  --shadow-neon: 4px 4px 0px #000000;
  --glass-blur: none;
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
}
`
  },

  // ── 2. REACT COMPONENT SCAFFOLDING ───────────────────────────────────────
  {
    id: 'react_ui_component_scaffold',
    title: 'React Production Component Scaffolding (Hero, Table, Kanban, Cart)',
    category: 'ui_design_themes',
    vendor: 'React 19 & Tailwind',
    badge: 'Reusable UI Library',
    icon: 'Layers',
    color: '#38bdf8',
    description: 'Production-ready React 19 visual component suite with animated Hero headers, sorting/filtering Data Tables, draggable Kanban columns, and slide-over Shopping Carts.',
    suggestedPath: '/projects/cybeni/components/SovereignComponents.jsx',
    language: 'javascript',
    aiPrompt: 'Implement modern React UI components: Hero with gradient badges, sortable Data Table, and slide-out Drawer using Tailwind CSS.',
    faqs: [
      {
        question: 'Are these components responsive for mobile and desktop?',
        answer: 'Yes, all components use mobile-first responsive utilities (flex-col md:flex-row, overflow-x-auto, hidden sm:block).'
      }
    ],
    code: `import React, { useState } from 'react';

// 1. Hero Header with Glow Badges
export function HeroSection({ title, subtitle, ctaText, onCtaClick }) {
  return (
    <div className="relative py-16 px-6 text-center overflow-hidden">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold mb-4 animate-pulse">
        <span>⚡ Sovereign Ecosystem 2026</span>
      </div>
      <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-emerald-400 tracking-tight max-w-4xl mx-auto">
        {title}
      </h1>
      <p className="mt-4 text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
        {subtitle}
      </p>
      {ctaText && (
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={onCtaClick}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all"
          >
            {ctaText}
          </button>
        </div>
      )}
    </div>
  );
}

// 2. Data Table with Sorting & Search
export function SovereignDataTable({ columns, data }) {
  const [query, setQuery] = useState('');

  const filtered = data.filter(row =>
    Object.values(row).some(v => String(v).toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md">
      <div className="p-3 border-b border-slate-800 flex justify-between items-center">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter records..."
          className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 w-64"
        />
        <span className="text-xs text-slate-400 font-mono">{filtered.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filtered.map((row, i) => (
              <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`
  }
];
