import React, { useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, RotateCcw, Sparkles } from 'lucide-react';
import {
  REASONING_EFFORTS,
  REASONING_EFFORT_INFO,
  clearReasoningOverride,
  getReasoningConfig,
  hasReasoningOverride,
  setReasoningConfig,
} from '../../services/reasoningConfig.js';

/**
 * Compact sub-menu attached directly to model selection controls across Sovereign OS.
 * Lets the operator toggle internal model thinking (`think`, default ON) and dial
 * `reasoning_effort` (`none` | `low` | `medium` | `high` | `max`) per-menu or globally.
 */
export default function ModelReasoningSubmenu({
  scope = 'global',
  label = '',
  compact = false,
  align = 'right',
  direction = 'down',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(() => getReasoningConfig(scope));
  const [isCustom, setIsCustom] = useState(() => hasReasoningOverride(scope));
  const rootRef = useRef(null);

  useEffect(() => {
    const sync = () => {
      setCfg(getReasoningConfig(scope));
      setIsCustom(hasReasoningOverride(scope));
    };
    sync();
    window.addEventListener('novaura:reasoning_changed', sync);
    return () => window.removeEventListener('novaura:reasoning_changed', sync);
  }, [scope]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activeInfo = REASONING_EFFORT_INFO[cfg.reasoningEffort] || REASONING_EFFORT_INFO.medium;

  const handleToggleThink = () => {
    setReasoningConfig({ think: !cfg.think }, scope);
  };

  const handleSelectEffort = (effortId) => {
    setReasoningConfig({
      think: effortId !== 'none',
      reasoningEffort: effortId,
    }, scope);
  };

  const handleApplyGlobal = () => {
    setReasoningConfig(cfg, 'global');
    if (scope && scope !== 'global') clearReasoningOverride(scope);
  };

  const popPos = direction === 'up'
    ? `bottom-full mb-1.5 ${align === 'left' ? 'left-0' : 'right-0'}`
    : `top-full mt-1.5 ${align === 'left' ? 'left-0' : 'right-0'}`;

  return (
    <div ref={rootRef} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={`Thinking: ${cfg.think ? 'ON' : 'OFF'} · Reasoning Effort: ${activeInfo.label}`}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-md border font-medium transition-colors cursor-pointer ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
        } ${
          cfg.think
            ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-200 hover:bg-cyan-900/50'
            : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-slate-200'
        }`}
      >
        <Brain className={compact ? 'w-3 h-3 text-cyan-300' : 'w-3.5 h-3.5 text-cyan-300'} />
        <span>Think {cfg.think ? 'ON' : 'OFF'}</span>
        <span className="opacity-50">·</span>
        <span className="font-mono">{activeInfo.short}</span>
        {isCustom && scope !== 'global' && (
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Custom override for this model menu" />
        )}
        <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${popPos} z-[100] w-64 rounded-xl bg-slate-950/95 border border-slate-700/90 shadow-2xl backdrop-blur-xl p-3 space-y-2.5 text-left`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-100 truncate">
                {label || (scope === 'global' ? 'Global Reasoning' : 'Model Reasoning')}
              </span>
            </div>
            {isCustom && scope !== 'global' ? (
              <button
                type="button"
                onClick={() => clearReasoningOverride(scope)}
                className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-purple-200 cursor-pointer shrink-0"
                title="Reset to Global Reasoning setting"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Global</span>
              </button>
            ) : (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                {scope === 'global' ? 'Global' : 'Linked'}
              </span>
            )}
          </div>

          {/* Think Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800">
            <div>
              <div className="text-[11px] font-semibold text-slate-200">Internal Thinking</div>
              <div className="text-[10px] text-slate-400">
                {cfg.think ? 'Enabled (`think: true`)' : 'Disabled (direct answer)'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleThink}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                cfg.think
                  ? 'bg-emerald-600/30 border-emerald-500/60 text-emerald-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cfg.think ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Reasoning Effort Sub-selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>Reasoning Effort</span>
              <span className="text-cyan-300 font-mono">{activeInfo.label}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {REASONING_EFFORTS.map((id) => {
                const info = REASONING_EFFORT_INFO[id];
                const selected = cfg.reasoningEffort === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectEffort(id)}
                    title={info.hint}
                    className={`py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                      selected
                        ? (id === 'none'
                          ? 'bg-slate-700 border-slate-500 text-white'
                          : 'bg-cyan-600/40 border-cyan-400 text-cyan-100')
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {info.short}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-400 leading-snug">
              {activeInfo.hint}
            </div>
          </div>

          {scope !== 'global' && (
            <button
              type="button"
              onClick={handleApplyGlobal}
              className="w-full py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition-colors cursor-pointer"
            >
              Use as Global OS Default
            </button>
          )}
        </div>
      )}
    </div>
  );
}

