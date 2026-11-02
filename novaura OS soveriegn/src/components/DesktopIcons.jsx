import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { APP_REGISTRY, getAppById, useAppRegistryVersion } from '../config/appRegistry.js';
import {
  ExternalLink, RotateCcw, Grid, Folder, FolderOpen, FolderPlus, FileText, FileCode, FileArchive,
  Image as ImageIcon, Film, Music, Code2, Archive, PackageOpen, Download, Pencil, Trash2,
  Inbox, Undo2, Boxes, Plus, Palette, Minimize2, Maximize2, CornerDownRight,
} from 'lucide-react';
import DesktopTile, { TILE } from './desktop/DesktopTile.jsx';
import DesktopBubble, { bubbleSize } from './desktop/DesktopBubble.jsx';
import CornerTray from './desktop/CornerTray.jsx';
import { DesktopMenu, NameDialog } from './desktop/DesktopMenu.jsx';
import WelcomeCorner, { WELCOME_AREA } from './desktop/WelcomeCorner.jsx';
import { CATEGORIES } from './AppLauncherModal.jsx';
import * as L from '../services/desktopLayout.js';
import {
  DESKTOP_PATH, listFiles, ensureDesktopFolder, repairFolderTree, createFolder, renameItem, deleteItem,
  moveItem, zipItem, extractZip, downloadFile, createShortcut, readShortcut, isShortcut, uploadFiles,
} from '../services/fileStorageService.js';
import { openVaultItem, openShortcutTarget, openInFiles, shortcutTargetFor, parentOf } from '../services/desktopActions.js';

const GRID_GAP_X = 20;
const GRID_GAP_Y = 16;
const START_X = 64; // clear of the left app sidebar
const START_Y = WELCOME_AREA.height + 8; // below the welcome card in the top-left corner
const DOC_MIME = 'application/x-novaura-doc';
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));
const CORNER_LABELS = { 'bottom-right': 'Bottom right', 'bottom-left': 'Bottom left', 'top-right': 'Top right', 'top-left': 'Top left' };

function fileIcon(name) {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go', 'json', 'html', 'css', 'sql'].includes(ext)) return FileCode;
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return ImageIcon;
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return Film;
  if (['mp3', 'wav', 'flac', 'ogg'].includes(ext)) return Music;
  if (ext === 'zip') return FileArchive;
  return FileText;
}

function docItem(doc) {
  const ref = `doc:${doc.id}`;
  if (doc.type === 'folder') return { ref, doc, kind: 'folder', label: doc.name, icon: Folder, color: '#fbbf24' };
  if (isShortcut(doc)) {
    const target = readShortcut(doc) || {};
    const app = target.kind === 'app' ? getAppById(target.appId) : null;
    const icon = app?.icon || (target.kind === 'project' ? Code2 : target.kind === 'folder' ? Folder : fileIcon(target.path));
    const color = app?.color || (target.kind === 'project' ? '#22d3ee' : target.kind === 'folder' ? '#fbbf24' : '#94a3b8');
    return { ref, doc, kind: 'shortcut', target, label: doc.name, icon, color, shortcut: true };
  }
  if (/\.zip$/i.test(doc.name)) return { ref, doc, kind: 'zip', label: doc.name, icon: FileArchive, color: '#a78bfa' };
  return { ref, doc, kind: 'file', label: doc.name, icon: fileIcon(doc.name), color: '#7dd3fc' };
}

export default function DesktopIcons({ openApp, openWindows = [], unreadMail = 0 }) {
  const registryVersion = useAppRegistryVersion(); // re-render when user apps are added or removed
  const [layout, setLayout] = useState(() => L.loadLayout());
  const [docs, setDocs] = useState(null); // /Desktop contents; null until first load
  const [projects, setProjects] = useState([]);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [selectedRef, setSelectedRef] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drag, setDrag] = useState(null); // { ref, x, y, offX, offY } while an icon is being dragged
  const [over, setOver] = useState(null); // drop target under the pointer
  const [status, setStatus] = useState(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const freshRefs = useRef(new Set()); // refs just placed, kept until the desktop listing catches up
  const statusTimer = useRef(null);

  const update = useCallback((fn) => setLayout(l => fn(l)), []);

  const flash = useCallback((text, tone = 'ok') => {
    clearTimeout(statusTimer.current);
    setStatus({ text, tone });
    statusTimer.current = setTimeout(() => setStatus(null), 3200);
  }, []);

  const run = useCallback(async (fn, okText) => {
    try {
      const result = await fn();
      if (okText) flash(okText);
      return result;
    } catch (err) {
      flash(err?.message || String(err), 'error');
      return null;
    }
  }, [flash]);

  // ── Persistence & data ────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => L.saveLayout(layout), 200);
    return () => clearTimeout(t);
  }, [layout]);

  const reloadDocs = useCallback(async () => {
    setDocs(await listFiles(DESKTOP_PATH));
  }, []);

  useEffect(() => {
    let timer = null;
    (async () => {
      await ensureDesktopFolder().catch(() => {});
      await repairFolderTree().catch(() => {});
      await reloadDocs();
    })();
    const onChange = () => { clearTimeout(timer); timer = setTimeout(reloadDocs, 250); };
    window.addEventListener('novaura:fs_changed', onChange);
    return () => { clearTimeout(timer); window.removeEventListener('novaura:fs_changed', onChange); };
  }, [reloadDocs]);

  // Forget documents that left the desktop (deleted, or moved into a folder).
  useEffect(() => {
    if (!docs) return;
    const ids = new Set(docs.map(d => `doc:${d.id}`));
    for (const r of freshRefs.current) if (ids.has(r)) freshRefs.current.delete(r);
    setLayout(l => {
      const keep = r => !r.startsWith('doc:') || ids.has(r) || freshRefs.current.has(r);
      const all = [...Object.keys(l.positions), ...l.drawer, ...l.groups.flatMap(g => g.items)];
      return all.every(keep) ? l : L.pruneRefs(l, keep);
    });
  }, [docs]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Items ─────────────────────────────────────────────────────────────────

  const items = useMemo(() => {
    const apps = APP_REGISTRY.filter(app => !app.desktopHidden && !app.hidden).map(app => ({
      ref: `app:${app.id}`,
      kind: 'app',
      app,
      label: app.label,
      icon: app.icon,
      color: app.color,
      running: openWindows.some(w => (w.type || w.appType) === app.id),
      badge: app.id === 'novamail' ? unreadMail : 0,
      verified: app.id === 'sentinel',
    }));
    return [...apps, ...(docs || []).map(docItem)];
  }, [docs, openWindows, unreadMail, registryVersion]);

  const byRef = useMemo(() => new Map(items.map(i => [i.ref, i])), [items]);
  const resolve = useCallback(refs => refs.map(r => byRef.get(r)).filter(Boolean), [byRef]);
  const loose = useMemo(() => L.looseRefs(layout, items.map(i => i.ref)), [layout, items]);

  // Loose icons: saved positions first, the rest flow into the free grid cells (column by column).
  const looseSlots = useMemo(() => {
    const rows = Math.max(3, Math.floor((size.h - START_Y) / (TILE.height + GRID_GAP_Y)));
    const cellOf = p => `${Math.round((p.x - START_X) / (TILE.width + GRID_GAP_X))},${Math.round((p.y - START_Y) / (TILE.height + GRID_GAP_Y))}`;
    const taken = new Set(loose.filter(r => layout.positions[r]).map(r => cellOf(layout.positions[r])));
    const slots = {};
    let cell = 0;
    for (const r of loose) {
      if (layout.positions[r]) { slots[r] = layout.positions[r]; continue; }
      let col, row;
      do { col = Math.floor(cell / rows); row = cell % rows; cell++; } while (taken.has(`${col},${row}`));
      slots[r] = { x: START_X + col * (TILE.width + GRID_GAP_X), y: START_Y + row * (TILE.height + GRID_GAP_Y) };
    }
    return slots;
  }, [loose, layout.positions, size.h]);

  const clampTile = useCallback(p => {
    const x = Math.max(8, Math.min(size.w - TILE.width - 8, p.x));
    let y = Math.max(8, Math.min(size.h - TILE.height - 8, p.y));
    if (x < WELCOME_AREA.width && y < WELCOME_AREA.height) y = WELCOME_AREA.height; // keep the welcome card clear
    return { x, y };
  }, [size]);

  const expandedGroups = layout.groups.filter(g => !g.collapsed);
  const collapsedGroups = layout.groups.filter(g => g.collapsed);

  const bubblePos = useCallback((g, k) => {
    const s = bubbleSize(resolve(g.items).length);
    const right = layout.corner.endsWith('right');
    const bottom = layout.corner.startsWith('bottom');
    const base = g.x != null && g.y != null
      ? { x: g.x, y: g.y }
      : {
          x: right ? size.w - s.width - 32 - k * 28 : 72 + k * 28,
          y: bottom ? size.h - s.height - 84 - k * 28 : WELCOME_AREA.height + 64 + k * 28,
        };
    return {
      x: Math.max(8, Math.min(size.w - s.width - 8, base.x)),
      y: Math.max(8, Math.min(size.h - 44, base.y)),
    };
  }, [resolve, layout.corner, size]);

  // ── Opening ───────────────────────────────────────────────────────────────

  const openItem = useCallback((item) => {
    if (item.kind === 'app') openApp(item.app.id);
    else if (item.kind === 'shortcut') openShortcutTarget(item.target);
    else openVaultItem(item.doc);
  }, [openApp]);

  // ── Placement ─────────────────────────────────────────────────────────────

  const toLocal = useCallback((clientX, clientY, offX = TILE.width / 2, offY = TILE.height / 2) => {
    const r = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    return clampTile({ x: clientX - r.left - offX, y: clientY - r.top - offY });
  }, [clampTile]);

  /** Put ref at a drop target: 'desktop' (at a point), 'drawer' or 'group:<id>'. */
  const place = useCallback((ref, target, point) => {
    if (target === 'drawer') update(l => L.moveRefs(l, [ref], { to: 'drawer' }));
    else if (target?.startsWith('group:')) update(l => L.moveRefs(l, [ref], { to: 'group', id: target.slice(6) }));
    else if (point) update(l => L.moveRefs(l, [ref], { to: 'desktop', ...point }));
    else update(l => L.moveRefs(l, [ref], { to: 'desktop' }));
  }, [update]);

  const placeNewDoc = useCallback((doc, target, point) => {
    const ref = `doc:${doc.id}`;
    freshRefs.current.add(ref);
    place(ref, target, point);
    reloadDocs();
  }, [place, reloadDocs]);

  const folderById = useCallback(id => (docs || []).find(d => d.id === id && d.type === 'folder'), [docs]);

  // ── Dragging icons (desktop, bubbles and the tray) ────────────────────────

  const dropTargetAt = useCallback((x, y, ref) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const target = el.closest('[data-drop]')?.dataset.drop || null;
    if (target === 'welcome') return null; // the welcome card is not a drop zone
    if (target && target !== `folder:${ref?.slice(4)}`) return target;
    return containerRef.current?.contains(el) ? 'desktop' : null; // over a window: nothing
  }, []);

  const dropOnFolder = useCallback(async (item, folder) => {
    if (item.kind === 'app') {
      await run(() => createShortcut(folder.path, item.label, { kind: 'app', appId: item.app.id }), `Shortcut to ${item.label} added to ${folder.name}`);
    } else if (item.doc && item.doc.id !== folder.id) {
      await run(() => moveItem(item.doc.id, folder.path), `Moved into ${folder.name}`);
    }
  }, [run]);

  const handleTileMouseDown = useCallback((e, ref) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { ref, startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, moved: false };
    setSelectedRef(ref);
    setMenu(null);

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 5) return;
      d.moved = true;
      d.target = dropTargetAt(ev.clientX, ev.clientY, ref);
      setDrag({ ref, x: ev.clientX, y: ev.clientY, offX: d.offX, offY: d.offY });
      setOver(d.target);
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setOver(null);
      const item = byRef.get(ref);
      if (!d || !item) return;
      if (!d.moved) { openItem(item); return; }
      const target = dropTargetAt(ev.clientX, ev.clientY, ref);
      if (!target) return;
      if (target.startsWith('folder:')) {
        const folder = folderById(target.slice(7));
        if (folder) dropOnFolder(item, folder);
      } else {
        place(ref, target, target === 'desktop' ? toLocal(ev.clientX, ev.clientY, d.offX, d.offY) : null);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [byRef, dropTargetAt, folderById, dropOnFolder, openItem, place, toLocal]);

  // Bubbles move by their header.
  const handleBubbleMouseDown = useCallback((e, group, k) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const origin = bubblePos(group, k);
    const start = { x: e.clientX, y: e.clientY };
    const onMove = (ev) => {
      update(l => L.updateGroup(l, group.id, { x: origin.x + ev.clientX - start.x, y: origin.y + ev.clientY - start.y }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [bubblePos, update]);

  // ── Drops from the Files window or from outside the app ──────────────────

  const handleDragOver = useCallback((e) => {
    const types = Array.from(e.dataTransfer?.types || []);
    if (!types.includes(DOC_MIME) && !types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(dropTargetAt(e.clientX, e.clientY, null));
  }, [dropTargetAt]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setOver(null);
    const target = dropTargetAt(e.clientX, e.clientY, null) || 'desktop';
    const folder = target.startsWith('folder:') ? folderById(target.slice(7)) : null;
    const point = target === 'desktop' ? toLocal(e.clientX, e.clientY) : null;
    const raw = e.dataTransfer.getData(DOC_MIME);

    if (raw) {
      let src;
      try { src = JSON.parse(raw); } catch { return; }
      if (folder) {
        if (src.parentPath !== folder.path) await run(() => createShortcut(folder.path, src.name, shortcutTargetFor(src)), `Shortcut added to ${folder.name}`);
        return;
      }
      const doc = src.parentPath === DESKTOP_PATH
        ? src
        : await run(() => createShortcut(DESKTOP_PATH, src.name, shortcutTargetFor(src)), `${src.name} added to the desktop`);
      if (doc) placeNewDoc(doc, target, point);
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const saved = await run(() => uploadFiles(files, folder ? folder.path : DESKTOP_PATH),
      `${files.length} file${files.length === 1 ? '' : 's'} copied ${folder ? `into ${folder.name}` : 'to the desktop'}`);
    if (saved && !folder) saved.forEach((doc, i) => placeNewDoc(doc, target, point && { x: point.x + i * 24, y: point.y + i * 24 }));
  }, [dropTargetAt, folderById, toLocal, run, placeNewDoc]);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const askName = useCallback((title, initial, onSubmit, confirmLabel) => {
    setDialog({ title, initial, confirmLabel, onSubmit: (v) => { setDialog(null); onSubmit(v); } });
  }, []);

  const confirmDelete = useCallback((item) => {
    const what = item.kind === 'shortcut' ? `Remove the shortcut "${item.label}"? The original stays where it is.`
      : item.kind === 'folder' ? `Delete the folder "${item.label}" and everything in it? This is permanent.`
      : `Delete "${item.label}"? This is permanent.`;
    if (window.confirm(what)) run(() => deleteItem(item.doc.id));
  }, [run]);

  const itemEntries = (item) => {
    const where = L.placementOf(layout, item.ref);
    const entries = [{ label: item.kind === 'app' ? 'Launch' : 'Open', icon: ExternalLink, onClick: () => openItem(item) }];
    if (item.kind === 'folder' || item.kind === 'file') {
      entries.push({ label: 'Compress to .zip', icon: Archive, onClick: () => run(() => zipItem(item.doc.id), 'Compressed to .zip') });
    }
    if (item.kind === 'zip') {
      entries.push({ label: 'Extract here', icon: PackageOpen, onClick: () => run(() => extractZip(item.doc.id), 'Extracted into a new folder') });
    }
    if (item.doc && item.kind !== 'shortcut') {
      entries.push({ label: item.kind === 'folder' ? 'Download as .zip' : 'Download', icon: Download, onClick: () => run(() => downloadFile(item.doc)) });
    }
    if (item.kind === 'shortcut' && item.target?.path) {
      entries.push({ label: 'Show original in Files', icon: FolderOpen, onClick: () => openInFiles(parentOf(item.target.path), item.target.path) });
    }
    if (item.doc) {
      entries.push({ label: 'Rename…', icon: Pencil, onClick: () => askName('Rename', item.doc.name, v => run(() => renameItem(item.doc.id, v))) });
    }
    entries.push({ section: 'Move to' });
    if (where.where !== 'desktop') entries.push({ label: 'Desktop', icon: Undo2, onClick: () => place(item.ref, 'desktop') });
    if (where.where !== 'drawer') entries.push({ label: 'Icon tray', icon: Inbox, onClick: () => place(item.ref, 'drawer') });
    for (const g of layout.groups) {
      if (g.id !== where.groupId) entries.push({ label: g.name, icon: Boxes, color: g.color, onClick: () => place(item.ref, `group:${g.id}`) });
    }
    entries.push({
      label: 'New bubble…', icon: Plus,
      onClick: () => askName('New bubble', 'New bubble', v => update(l => L.createGroup(l, { name: v, items: [item.ref] }).layout), 'Create'),
    });
    if (where.where === 'desktop' && layout.positions[item.ref]) {
      entries.push({ divider: true }, { label: 'Reset position', icon: RotateCcw, onClick: () => update(l => L.moveRefs(l, [item.ref], { to: 'desktop' })) });
    }
    if (item.doc) {
      entries.push({ divider: true }, { label: item.kind === 'shortcut' ? 'Remove shortcut' : 'Delete', icon: Trash2, danger: true, onClick: () => confirmDelete(item) });
    }
    return entries;
  };

  const groupEntries = (g) => [
    g.collapsed
      ? { label: 'Open bubble', icon: Maximize2, onClick: () => update(l => L.updateGroup(l, g.id, { collapsed: false })) }
      : { label: 'Minimize to corner', icon: Minimize2, onClick: () => update(l => L.updateGroup(l, g.id, { collapsed: true })) },
    { label: 'Rename…', icon: Pencil, onClick: () => askName('Rename bubble', g.name, v => update(l => L.updateGroup(l, g.id, { name: v }))) },
    {
      label: 'Change color', icon: Palette, color: g.color,
      onClick: () => update(l => L.updateGroup(l, g.id, { color: L.BUBBLE_COLORS[(L.BUBBLE_COLORS.indexOf(g.color) + 1) % L.BUBBLE_COLORS.length] })),
    },
    { label: 'Send icons to the tray', icon: Inbox, onClick: () => update(l => L.moveRefs(l, g.items, { to: 'drawer' })) },
    { divider: true },
    { label: 'Dissolve bubble', icon: Trash2, danger: true, onClick: () => update(l => L.dissolveGroup(l, g.id)) },
  ];

  const desktopEntries = (point) => [
    {
      label: 'New folder…', icon: FolderPlus,
      onClick: () => askName('New folder', 'New folder', v => run(async () => {
        const f = await createFolder(DESKTOP_PATH, v);
        placeNewDoc(f, 'desktop', point);
      }), 'Create'),
    },
    {
      label: 'New bubble…', icon: Boxes,
      onClick: () => askName('New bubble', 'New bubble', v => update(l => L.createGroup(l, { name: v, ...point }).layout), 'Create'),
    },
    { section: 'Add a project to the desktop' },
    ...(projects.length
      ? projects.slice(0, 8).map(p => ({
          label: p.name, icon: Code2, color: '#22d3ee',
          onClick: () => run(async () => {
            const doc = await createShortcut(DESKTOP_PATH, p.name, { kind: 'project', slug: p.slug, path: `/projects/cybeni/${p.slug}` });
            placeNewDoc(doc, 'desktop', point);
          }),
        }))
      : [{ label: 'No Cybeni projects yet', icon: Code2, disabled: true, onClick: () => {} }]),
    { section: 'Arrange' },
    { label: 'Group apps into bubbles', icon: Boxes, onClick: () => update(l => L.groupAppsByCategory(l, APP_REGISTRY, CATEGORY_LABELS)) },
    { label: 'Tidy everything into the tray', icon: Inbox, onClick: () => update(l => L.moveRefs(l, loose, { to: 'drawer' })) },
    { label: 'Put tray icons back', icon: Undo2, disabled: !layout.drawer.length, onClick: () => update(l => L.moveRefs(l, l.drawer, { to: 'desktop' })) },
    { label: 'Dissolve all bubbles', icon: CornerDownRight, disabled: !layout.groups.length, onClick: () => update(l => l.groups.reduce((acc, g) => L.dissolveGroup(acc, g.id), l)) },
    {
      label: 'Auto-arrange icons', icon: Grid,
      onClick: () => update(l => {
        const positions = { ...l.positions };
        for (const r of loose) delete positions[r];
        return { ...l, positions };
      }),
    },
    { section: 'Tray corner' },
    ...L.CORNERS.map(c => ({ label: CORNER_LABELS[c], checked: layout.corner === c, onClick: () => update(l => ({ ...l, corner: c })) })),
  ];

  const openMenu = (e, spec) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, ...spec });
  };

  const handleDesktopContextMenu = (e) => {
    if (e.target.closest('[data-tile],[data-drop]')) return;
    openMenu(e, { kind: 'desktop', point: toLocal(e.clientX, e.clientY, 0, 0) });
    import('../services/cybeni/projectStore.js').then(m => m.listProjects()).then(setProjects).catch(() => {});
  };

  // Click on empty canvas deselects and closes menus; Enter opens the selection.
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.closest?.('[data-tile]')) return;
      setSelectedRef(null);
      setMenu(null);
    };
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Enter' && selectedRef && byRef.get(selectedRef)) {
        openItem(byRef.get(selectedRef));
        setSelectedRef(null);
      } else if (e.key === 'Escape') {
        setSelectedRef(null);
        setMenu(null);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedRef, byRef, openItem]);

  const tileDropProps = useCallback((item) => (item.kind === 'folder'
    ? { dropId: `folder:${item.doc.id}`, highlighted: over === `folder:${item.doc.id}` }
    : {}), [over]);

  const onTileContextMenu = useCallback((e, ref) => {
    const item = byRef.get(ref);
    if (!item) return;
    setSelectedRef(ref);
    openMenu(e, { kind: 'item', ref });
  }, [byRef]);

  const draggedItem = drag && byRef.get(drag.ref);
  const menuItem = menu?.kind === 'item' ? byRef.get(menu.ref) : null;
  const menuGroup = menu?.kind === 'group' ? layout.groups.find(g => g.id === menu.groupId) : null;

  return (
    <div
      ref={containerRef}
      onContextMenu={handleDesktopContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={(e) => { if (!containerRef.current?.contains(e.relatedTarget)) setOver(null); }}
      onDrop={handleDrop}
      className="absolute inset-0 select-none z-0 overflow-hidden"
    >
      <WelcomeCorner />

      {/* Loose desktop icons */}
      {loose.map(ref => {
        const item = byRef.get(ref);
        if (!item) return null;
        const pos = clampTile(looseSlots[ref]);
        return (
          <DesktopTile
            key={ref}
            item={item}
            selected={selectedRef === ref}
            dimmed={drag?.ref === ref}
            {...tileDropProps(item)}
            className="absolute top-0 left-0 z-10"
            style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
            onMouseDown={(e) => handleTileMouseDown(e, ref)}
            onContextMenu={(e) => onTileContextMenu(e, ref)}
          />
        );
      })}

      {/* Expanded bubbles */}
      {expandedGroups.map((g, k) => {
        const pos = bubblePos(g, k);
        return (
          <DesktopBubble
            key={g.id}
            group={g}
            items={resolve(g.items)}
            x={pos.x}
            y={pos.y}
            over={over}
            selectedRef={selectedRef}
            draggingRef={drag?.ref}
            onHeaderMouseDown={(e) => handleBubbleMouseDown(e, g, k)}
            onRename={(grp) => askName('Rename bubble', grp.name, v => update(l => L.updateGroup(l, grp.id, { name: v })))}
            onCollapse={(grp) => update(l => L.updateGroup(l, grp.id, { collapsed: true }))}
            onMenu={(e, grp) => openMenu(e, { kind: 'group', groupId: grp.id })}
            onTileMouseDown={handleTileMouseDown}
            onTileContextMenu={onTileContextMenu}
            tileDropProps={tileDropProps}
          />
        );
      })}

      {/* Corner tray: drawer + minimized bubbles */}
      <CornerTray
        corner={layout.corner}
        collapsedGroups={collapsedGroups}
        resolveItems={resolve}
        drawerItems={resolve(layout.drawer)}
        drawerOpen={drawerOpen}
        over={over}
        selectedRef={selectedRef}
        draggingRef={drag?.ref}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        onOpenGroup={(g) => update(l => L.updateGroup(l, g.id, { collapsed: false }))}
        onGroupMenu={(e, g) => openMenu(e, { kind: 'group', groupId: g.id })}
        onTileMouseDown={handleTileMouseDown}
        onTileContextMenu={onTileContextMenu}
        tileDropProps={tileDropProps}
        onTidy={() => update(l => L.moveRefs(l, loose, { to: 'drawer' }))}
        onRestoreAll={() => update(l => L.moveRefs(l, l.drawer, { to: 'desktop' }))}
      />

      {status && (
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full text-[11px] font-medium border backdrop-blur-xl shadow-lg pointer-events-none ${
          status.tone === 'error' ? 'bg-rose-950/80 border-rose-500/50 text-rose-200' : 'bg-slate-900/85 border-cyan-500/40 text-cyan-100'
        }`}>
          {status.text}
        </div>
      )}

      {createPortal(
        <>
          {draggedItem && (
            <div className="fixed top-0 left-0 z-[9990] pointer-events-none" style={{ transform: `translate3d(${drag.x - drag.offX}px, ${drag.y - drag.offY}px, 0)` }}>
              <DesktopTile item={draggedItem} selected className="scale-105 opacity-90" style={{ pointerEvents: 'none' }} />
            </div>
          )}
          {menu && (menu.kind === 'desktop' || menuItem || menuGroup) && (
            <DesktopMenu
              x={menu.x}
              y={menu.y}
              title={menu.kind === 'desktop' ? 'Desktop' : menuItem ? menuItem.label : menuGroup.name}
              color={menuItem?.color || menuGroup?.color}
              entries={menu.kind === 'desktop' ? desktopEntries(menu.point) : menuItem ? itemEntries(menuItem) : groupEntries(menuGroup)}
              onClose={() => setMenu(null)}
            />
          )}
          {dialog && (
            <NameDialog
              title={dialog.title}
              initial={dialog.initial}
              confirmLabel={dialog.confirmLabel}
              onSubmit={dialog.onSubmit}
              onCancel={() => setDialog(null)}
            />
          )}
        </>,
        document.body,
      )}
    </div>
  );
}
