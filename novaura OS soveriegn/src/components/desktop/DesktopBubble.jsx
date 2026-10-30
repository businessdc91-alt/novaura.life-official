import React from 'react';
import { Minus, MoreHorizontal, GripHorizontal } from 'lucide-react';
import DesktopTile, { COMPACT_TILE } from './DesktopTile.jsx';

const GAP = 4;
const PAD = 12;
const HEADER = 36;

/** Rendered size of an expanded bubble holding `count` icons. */
export function bubbleSize(count) {
  const cols = Math.max(2, Math.min(4, count));
  const rows = Math.max(1, Math.ceil(count / cols));
  return {
    width: cols * COMPACT_TILE.width + (cols - 1) * GAP + PAD * 2,
    height: HEADER + rows * COMPACT_TILE.height + (rows - 1) * GAP + PAD * 2,
  };
}

/** An expanded bubble: a glass panel of icons that can be dragged, renamed and collapsed into the corner tray. */
export default function DesktopBubble({
  group, items, x, y, over, selectedRef, draggingRef,
  onHeaderMouseDown, onRename, onCollapse, onMenu, onTileMouseDown, onTileContextMenu, tileDropProps,
}) {
  const size = bubbleSize(items.length);
  const isOver = over === `group:${group.id}`;

  return (
    <div
      data-drop={`group:${group.id}`}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(e, group); }}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width: size.width,
        minHeight: size.height,
        borderColor: isOver ? group.color : `${group.color}55`,
        boxShadow: isOver
          ? `0 0 0 2px ${group.color}aa, 0 18px 50px rgba(0,0,0,0.55)`
          : `0 18px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
      className="absolute top-0 left-0 z-20 pointer-events-auto rounded-[22px] border bg-slate-900/55 backdrop-blur-xl transition-[box-shadow,border-color] duration-150 animate-in fade-in zoom-in-95 duration-150"
    >
      <div
        onMouseDown={(e) => onHeaderMouseDown(e, group)}
        onDoubleClick={() => onRename(group)}
        className="h-9 px-3 flex items-center gap-2 cursor-grab active:cursor-grabbing border-b border-white/5"
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color, boxShadow: `0 0 8px ${group.color}` }} />
        <span className="flex-1 text-[11px] font-semibold text-slate-100 truncate" title="Double-click to rename">{group.name}</span>
        <GripHorizontal className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[10px] text-slate-500 font-mono">{items.length}</span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMenu(e, group); }}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/60"
          title="Bubble options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onCollapse(group); }}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/60"
          title="Minimize to the corner"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-5 text-center text-[11px] text-slate-500">Drag icons here</div>
      ) : (
        <div className="p-3 flex flex-wrap" style={{ gap: GAP }}>
          {items.map(item => (
            <DesktopTile
              key={item.ref}
              item={item}
              compact
              selected={selectedRef === item.ref}
              dimmed={draggingRef === item.ref}
              {...tileDropProps(item)}
              onMouseDown={(e) => onTileMouseDown(e, item.ref)}
              onContextMenu={(e) => onTileContextMenu(e, item.ref)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
