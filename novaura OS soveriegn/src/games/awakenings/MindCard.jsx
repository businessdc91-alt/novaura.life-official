// MindCard.jsx — How a Cognitive Awakenings card looks: Signal in the centre,
// mode and level on top, Echo underneath, and glowing notches on each side it
// links toward.
import React from 'react';
import { MODES, ECHOES, CARD_ERAS } from './cards.js';
import { MAX_LEVEL } from './engine.js';

const SIZES = {
  sm: { w: 'w-full', h: 'h-full', sig: 'text-2xl', name: 'text-[9px]', pad: 'p-1' },
  xs: { w: 'w-[64px]', h: 'h-[84px]', sig: 'text-xl', name: 'text-[8px]', pad: 'p-1' },
  md: { w: 'w-[92px]', h: 'h-[124px]', sig: 'text-3xl', name: 'text-[10px]', pad: 'p-1.5' },
  lg: { w: 'w-[190px]', h: 'h-[260px]', sig: 'text-6xl', name: 'text-sm', pad: 'p-3' },
};
const OWNER_RING = { blue: '#38bdf8', red: '#fb7185' };
const ERA_COLOR = Object.fromEntries(CARD_ERAS.map(e => [e.id, e.color]));

function Notch({ side, color }) {
  const pos = {
    0: 'top-0 left-1/2 -translate-x-1/2 w-1/3 h-1 rounded-b',
    1: 'right-0 top-1/2 -translate-y-1/2 h-1/3 w-1 rounded-l',
    2: 'bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-1 rounded-t',
    3: 'left-0 top-1/2 -translate-y-1/2 h-1/3 w-1 rounded-r',
  }[side];
  return <span className={`absolute ${pos}`} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}

/**
 * `card` is a playable card (engine.cardFor) or a catalog entry. `owner` tints
 * it on the board; `boost` and `onWell` show bonuses; `flash` pulses a capture.
 */
export default function MindCard({ card, owner = null, size = 'md', selected = false, dim = false, boost = 0, onWell = false, flash = false, onClick, title }) {
  if (!card) return null;
  const spec = card.spec || card;
  const mode = MODES[card.mode] || MODES.language;
  const echo = ECHOES[card.echo] || ECHOES.chorus;
  const s = SIZES[size] || SIZES.md;
  const ring = owner ? OWNER_RING[owner] : (ERA_COLOR[spec.era] || '#64748b');
  const level = card.level || 0;
  const shown = (card.signal || 0) + boost;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title || `${spec.name} — ${spec.maker}, ${spec.year}\n${mode.label} • Signal ${card.signal}\n${echo.label}: ${echo.text}`}
      className={`relative ${s.w} ${s.h} ${s.pad} rounded-xl flex flex-col justify-between overflow-hidden text-left transition-all duration-200 ${
        selected ? '-translate-y-1.5 scale-[1.03]' : ''} ${dim ? 'opacity-40' : ''} ${flash ? 'animate-pulse' : ''} ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
      style={{
        background: `radial-gradient(circle at 50% 35%, ${mode.color}33, transparent 60%), linear-gradient(160deg, #0f172a, ${owner === 'red' ? '#2a0f1c' : owner === 'blue' ? '#0b1f33' : '#111827'})`,
        border: `1.5px solid ${ring}`,
        boxShadow: selected ? `0 0 0 2px ${ring}, 0 0 22px ${ring}88` : `0 4px 14px rgba(0,0,0,0.45), inset 0 0 18px ${ring}22`,
      }}
    >
      {card.links?.map((on, d) => (on ? <Notch key={d} side={d} color={mode.color} /> : null))}
      <div className="flex items-center justify-between relative z-10">
        <span className={size === 'lg' ? 'text-xl' : 'text-xs'} title={mode.label}>{mode.icon}</span>
        <span className="flex gap-0.5">
          {Array.from({ length: MAX_LEVEL }, (_, i) => (
            <span key={i} className={`${size === 'lg' ? 'w-2 h-2' : 'w-1 h-1'} rounded-full`} style={{ background: i < level ? '#fde047' : 'rgba(148,163,184,0.3)' }} />
          ))}
        </span>
      </div>
      <div className="flex flex-col items-center relative z-10">
        <span className={`${s.sig} font-black leading-none`} style={{ color: '#f8fafc', textShadow: `0 0 14px ${mode.color}` }}>
          {shown}
          {(boost > 0 || onWell) && <sup className="text-[0.4em] align-top ml-0.5" style={{ color: '#fde047' }}>{onWell ? '◈' : '+'}</sup>}
        </span>
        <span className={`${s.name} font-bold text-slate-100 text-center leading-tight mt-1 line-clamp-2`}>{spec.name}</span>
        {size === 'lg' && <span className="text-[11px] text-slate-400 mt-0.5">{spec.maker} • {spec.year}</span>}
      </div>
      <div className={`flex items-center justify-center gap-1 relative z-10 ${size === 'lg' ? 'text-xs' : 'text-[8px]'} text-slate-300`}>
        <span>{echo.icon}</span>
        {size !== 'sm' && size !== 'xs' && <span className="font-semibold uppercase tracking-wide">{echo.label}</span>}
      </div>
    </Tag>
  );
}
