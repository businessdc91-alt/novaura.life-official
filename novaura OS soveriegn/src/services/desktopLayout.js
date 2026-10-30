// desktopLayout.js — where each desktop item lives: loose on the desktop (with an
// optional saved position), inside a bubble (a named group of icons that can be
// collapsed into the corner tray), or tucked away in the tray drawer.
//
// Items are referenced as `app:<appId>` or `doc:<documentId>` (a file, folder or
// shortcut in the vault's /Desktop folder). Every function returns a new layout.

const LAYOUT_KEY = 'novaura-desktop-layout';
const LEGACY_POSITIONS_KEY = 'novaura-desktop-icon-positions';

export const CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
export const BUBBLE_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185'];

export function emptyLayout() {
  return { v: 1, positions: {}, groups: [], drawer: [], corner: 'bottom-right' };
}

function normalize(raw) {
  const base = emptyLayout();
  if (!raw || typeof raw !== 'object') return base;
  return {
    v: 1,
    positions: raw.positions && typeof raw.positions === 'object' ? { ...raw.positions } : {},
    groups: Array.isArray(raw.groups)
      ? raw.groups.filter(g => g && g.id).map(g => ({
          id: String(g.id),
          name: String(g.name || 'Bubble'),
          color: g.color || BUBBLE_COLORS[0],
          items: Array.isArray(g.items) ? [...new Set(g.items.map(String))] : [],
          collapsed: !!g.collapsed,
          x: Number.isFinite(g.x) ? g.x : null,
          y: Number.isFinite(g.y) ? g.y : null,
        }))
      : [],
    drawer: Array.isArray(raw.drawer) ? [...new Set(raw.drawer.map(String))] : [],
    corner: CORNERS.includes(raw.corner) ? raw.corner : base.corner,
  };
}

/** Saved layout, or one seeded from the old per-app icon positions. */
export function loadLayout(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(LAYOUT_KEY);
    if (saved) return normalize(JSON.parse(saved));
    const legacy = JSON.parse(storage?.getItem(LEGACY_POSITIONS_KEY) || '{}');
    const layout = emptyLayout();
    for (const [id, pos] of Object.entries(legacy || {})) {
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) layout.positions[`app:${id}`] = { x: pos.x, y: pos.y };
    }
    return layout;
  } catch {
    return emptyLayout();
  }
}

export function saveLayout(layout, storage = globalThis.localStorage) {
  try { storage?.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* storage full or unavailable */ }
}

/** { where: 'desktop' | 'group' | 'drawer', groupId? } */
export function placementOf(layout, ref) {
  const group = layout.groups.find(g => g.items.includes(ref));
  if (group) return { where: 'group', groupId: group.id };
  if (layout.drawer.includes(ref)) return { where: 'drawer' };
  return { where: 'desktop' };
}

/** Refs from `allRefs` that sit loose on the desktop, in their given order. */
export function looseRefs(layout, allRefs) {
  const tucked = new Set([...layout.drawer, ...layout.groups.flatMap(g => g.items)]);
  return allRefs.filter(r => !tucked.has(r));
}

function without(layout, refs) {
  const drop = new Set(refs);
  return {
    ...layout,
    groups: layout.groups.map(g => ({ ...g, items: g.items.filter(r => !drop.has(r)) })),
    drawer: layout.drawer.filter(r => !drop.has(r)),
  };
}

/**
 * Move refs to a target:
 *   { to: 'desktop', x?, y? }   loose (position kept for a single ref when given)
 *   { to: 'group', id, index? } into a bubble
 *   { to: 'drawer' }            into the tray drawer
 */
export function moveRefs(layout, refs, target) {
  const list = [].concat(refs).map(String);
  let next = without(layout, list);
  if (target.to === 'group') {
    if (!next.groups.some(g => g.id === target.id)) return layout;
    next.groups = next.groups.map(g => {
      if (g.id !== target.id) return g;
      const items = [...g.items];
      const at = Number.isInteger(target.index) ? Math.max(0, Math.min(items.length, target.index)) : items.length;
      items.splice(at, 0, ...list);
      return { ...g, items };
    });
  } else if (target.to === 'drawer') {
    next.drawer = [...next.drawer, ...list];
  } else {
    const positions = { ...next.positions };
    if (list.length === 1 && Number.isFinite(target.x) && Number.isFinite(target.y)) positions[list[0]] = { x: target.x, y: target.y };
    else for (const r of list) delete positions[r];
    next.positions = positions;
  }
  return next;
}

export function setPosition(layout, ref, x, y) {
  return { ...layout, positions: { ...layout.positions, [ref]: { x, y } } };
}

let _seq = 0;
function newGroupId() {
  _seq += 1;
  return `bubble_${Date.now().toString(36)}_${_seq}`;
}

/** Create a bubble (optionally seeded with refs). Returns { layout, id }. */
export function createGroup(layout, { name = 'New bubble', items = [], x = null, y = null, color, collapsed = false } = {}) {
  const id = newGroupId();
  const group = {
    id, name, items: [], collapsed, x, y,
    color: color || BUBBLE_COLORS[layout.groups.length % BUBBLE_COLORS.length],
  };
  const next = moveRefs({ ...layout, groups: [...layout.groups, group] }, items, { to: 'group', id });
  return { layout: next, id };
}

export function updateGroup(layout, id, patch) {
  return { ...layout, groups: layout.groups.map(g => (g.id === id ? { ...g, ...patch, id } : g)) };
}

/** Remove a bubble; its items go back onto the desktop (auto-placed). */
export function dissolveGroup(layout, id) {
  const group = layout.groups.find(g => g.id === id);
  if (!group) return layout;
  const positions = { ...layout.positions };
  for (const r of group.items) delete positions[r];
  return { ...layout, positions, groups: layout.groups.filter(g => g.id !== id) };
}

/** One collapsed bubble per category for the loose apps (categories with 2+ apps). */
export function groupAppsByCategory(layout, apps, labels = {}) {
  const loose = new Set(looseRefs(layout, apps.map(a => `app:${a.id}`)));
  const byCategory = new Map();
  for (const app of apps) {
    const ref = `app:${app.id}`;
    if (!loose.has(ref)) continue;
    const cat = app.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(ref);
  }
  let next = layout;
  for (const [cat, refs] of byCategory) {
    if (refs.length < 2) continue;
    const name = labels[cat] || cat.replace(/\b\w/g, c => c.toUpperCase());
    const existing = next.groups.find(g => g.name === name);
    if (existing) next = moveRefs(next, refs, { to: 'group', id: existing.id });
    else next = createGroup(next, { name, items: refs, collapsed: true }).layout;
  }
  return next;
}

/** Drop refs (e.g. deleted documents) that no longer exist. `keep(ref)` decides. */
export function pruneRefs(layout, keep) {
  const positions = {};
  for (const [r, p] of Object.entries(layout.positions)) if (keep(r)) positions[r] = p;
  return {
    ...layout,
    positions,
    groups: layout.groups.map(g => ({ ...g, items: g.items.filter(keep) })),
    drawer: layout.drawer.filter(keep),
  };
}
