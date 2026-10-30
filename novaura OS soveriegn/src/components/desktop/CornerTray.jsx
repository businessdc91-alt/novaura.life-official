import React, { useState } from 'react';
import { LayoutGrid, Search, X, Undo2, Inbox } from 'lucide-react';
import DesktopTile from './DesktopTile.jsx';
import { WELCOME_AREA } from './WelcomeCorner.jsx';

const ANCHOR = {
  'bottom-right': { bottom: 12, right: 16 },
  'bottom-left': { bottom: 12, left: 56 },
  'top-right': { top: 12, right: 44 },
  'top-left': { top: WELCOME_AREA.height, left: 16 }, // below the welcome card
};

/** Collapsed bubble: a small orb previewing its first four icons. */
function BubbleOrb({ group, items, over, onOpen, onMenu }) {
  const isOver = over === `group:${group.id}`;
  return (
    <button
      data-drop={`group:${group.id}`}
      onClick={(e) => { e.stopPropagation(); onOpen(group); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(e, group); }}
      title={`${group.name} (${items.length})`}
      className="relative w-12 h-12 rounded-full border bg-slate-900/70 backdrop-blur-xl grid grid-cols-2 place-items-center p-2 gap-0.5 transition-all hover:scale-110 pointer-events-auto group"
      style={{
        borderColor: isOver ? group.color : `${group.color}66`,
        boxShadow: isOver ? `0 0 0 2px ${group.color}, 0 0 18px ${group.color}` : `0 6px 18px rgba(0,0,0,0.5), 0 0 10px ${group.color}33`,
      }}
    >
      {items.slice(0, 4).map(item => {
        const Icon = item.icon;
        return <Icon key={item.ref} className="w-3 h-3" style={{ color: item.color }} />;
      })}
      <span
        className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold text-slate-950 flex items-center justify-center"
        style={{ background: group.color }}
      >
        {items.length}
      </span>
      <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-200 bg-slate-950/90 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {group.name}
      </span>
    </button>
  );
}

/**
 * The corner tray: the drawer button, plus one orb per collapsed bubble. The drawer
 * pops up from the same corner and holds icons tucked away off the desktop.
 */
export default function CornerTray({
  corner, collapsedGroups, resolveItems, drawerItems, drawerOpen, over,
  selectedRef, draggingRef, onToggleDrawer, onOpenGroup, onGroupMenu,
  onTileMouseDown, onTileContextMenu, tileDropProps, onTidy, onRestoreAll,
}) {
  const [query, setQuery] = useState('');
  const right = corner.endsWith('right');
  const bottom = corner.startsWith('bottom');
  const drawerOver = over === 'drawer';
  const shown = query
    ? drawerItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : drawerItems;

  return (
    <div className="absolute z-30 pointer-events-none" style={ANCHOR[corner]}>
      <div
        className={`flex items-center gap-2.5 max-w-[46vw] flex-wrap ${right ? 'flex-row-reverse' : ''} ${bottom ? 'flex-wrap-reverse' : ''}`}
      >
        <button
          data-drop="drawer"
          onClick={(e) => { e.stopPropagation(); onToggleDrawer(); }}
          title="Icon tray"
          className={`relative w-12 h-12 rounded-2xl border backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 pointer-events-auto ${
            drawerOver || drawerOpen
              ? 'bg-cyan-500/25 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.6)]'
              : 'bg-slate-900/70 border-cyan-500/40 shadow-[0_6px_18px_rgba(0,0,0,0.5)]'
          }`}
        >
          <LayoutGrid className="w-5 h-5 text-cyan-300" />
          {drawerItems.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-cyan-400 text-[9px] font-bold text-slate-950 flex items-center justify-center">
              {drawerItems.length}
            </span>
          )}
        </button>
        {collapsedGroups.map(g => (
          <BubbleOrb key={g.id} group={g} items={resolveItems(g.items)} over={over} onOpen={onOpenGroup} onMenu={onGroupMenu} />
        ))}
      </div>

      {drawerOpen && (
        <div
          data-drop="drawer"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          className={`absolute w-[392px] max-h-[min(460px,60vh)] flex flex-col rounded-2xl border bg-slate-900/90 backdrop-blur-2xl shadow-2xl shadow-black/70 pointer-events-auto animate-in fade-in zoom-in-95 duration-150 ${
            drawerOver ? 'border-cyan-300' : 'border-slate-700/80'
          }`}
          style={{
            [right ? 'right' : 'left']: 0,
            [bottom ? 'bottom' : 'top']: 60,
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
            <Inbox className="w-4 h-4 text-cyan-300" />
            <span className="text-xs font-semibold text-white">Icon tray</span>
            <div className="relative flex-1 ml-2">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-6 pr-2 py-1 text-[11px] bg-slate-950/80 border border-slate-700 rounded-md text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
            <button onClick={onToggleDrawer} className="p-1 text-slate-400 hover:text-white rounded" title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            {shown.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-6 px-4 leading-relaxed">
                {drawerItems.length === 0
                  ? 'Drag icons here to keep the desktop clear. They stay one click away.'
                  : 'Nothing matches.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {shown.map(item => (
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

          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-800 text-[11px]">
            <button onClick={onTidy} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30">
              <Inbox className="w-3.5 h-3.5" /> Tidy desktop into tray
            </button>
            <button onClick={onRestoreAll} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
              <Undo2 className="w-3.5 h-3.5" /> Put all back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
