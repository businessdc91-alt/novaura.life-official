import React from 'react';
import { CheckCircle2, CornerUpRight } from 'lucide-react';

export const TILE = { width: 84, height: 96 };
export const COMPACT_TILE = { width: 72, height: 82 };

/**
 * One desktop icon. `item`: { ref, label, icon, color, running?, badge?, verified?, shortcut? }.
 * Folder tiles pass `dropId` so things can be dropped onto them.
 */
export default function DesktopTile({
  item, selected = false, compact = false, dimmed = false, highlighted = false,
  dropId, style, className = '', onMouseDown, onContextMenu, onDragOver, onDrop,
}) {
  const Icon = item.icon;
  const size = compact ? COMPACT_TILE : TILE;
  const box = compact ? 'w-11 h-11 rounded-xl' : 'w-13 h-13 rounded-2xl';

  return (
    <div
      data-tile={item.ref}
      data-drop={dropId}
      style={{ width: size.width, height: size.height, ...style }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={item.label}
      className={`flex flex-col items-center justify-start p-1.5 rounded-2xl cursor-pointer pointer-events-auto transition-all duration-150 group ${
        dimmed ? 'opacity-30' : ''
      } ${
        highlighted
          ? 'bg-amber-400/15 ring-1 ring-amber-300/80'
          : selected
            ? 'bg-cyan-500/15 ring-1 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.35)] backdrop-blur-md'
            : 'hover:bg-slate-800/40 hover:backdrop-blur-sm'
      } ${className}`}
    >
      <div className="relative">
        <div
          className={`${box} flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:scale-108 group-hover:-translate-y-0.5 group-active:scale-95 shadow-lg border`}
          style={{
            background: selected
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))'
              : 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.75))',
            borderColor: selected ? `${item.color}cc` : `${item.color}45`,
            boxShadow: selected
              ? `0 0 18px ${item.color}80, inset 0 1px 1px rgba(255, 255, 255, 0.3)`
              : '0 4px 14px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Chromatic ambient glow on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 30%, ${item.color}, transparent 70%)` }}
          />
          {/* Specular glass reflection across the upper curve */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

          <Icon
            className={`${compact ? 'w-5.5 h-5.5' : 'w-6.5 h-6.5'} transition-all duration-300 relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]`}
            style={{ color: item.color, filter: selected ? `drop-shadow(0 0 6px ${item.color})` : undefined }}
          />

          {item.running && (
            <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          )}
        </div>

        {item.badge > 0 && (
          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-4.5 h-4.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/50 border border-white/30 animate-bounce">
            {item.badge > 9 ? '9+' : item.badge}
          </div>
        )}

        {item.verified && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_8px_#10b981] border border-white/40">
            <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />
          </div>
        )}

        {item.shortcut && (
          <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-md bg-slate-950/90 border border-slate-600 flex items-center justify-center">
            <CornerUpRight className="w-2.5 h-2.5 text-slate-200" />
          </div>
        )}
      </div>

      <span
        className={`${compact ? 'text-[10px] mt-1 max-w-[68px]' : 'text-[11px] mt-1.5 max-w-[80px]'} font-medium truncate text-center transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
          selected ? 'text-cyan-200 font-semibold' : 'text-slate-200 group-hover:text-white'
        }`}
      >
        {item.label}
      </span>
    </div>
  );
}
