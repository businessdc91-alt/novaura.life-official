import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Maximize2, Minimize2, Minus, X, GripHorizontal, ExternalLink } from 'lucide-react';

const MIN_WIDTH = 340;
const MIN_HEIGHT = 240;
// How far past the edge of the app a dragged window goes before it pops out.
const POP_OUT_MARGIN = 24;
// Snapping: drag the pointer to within EDGE px of the desktop's top (maximise),
// side (half) or a side's top/bottom CORNER px (quarter). The pop-out zone is
// further out, past the app's own edge, so the two never overlap.
const SNAP_EDGE = 8;
const SNAP_CORNER = 96;
const UNSNAP_SLOP = 4;
const ZONES = {
  max: { left: 0, top: 0, width: '100%', height: '100%' },
  left: { left: 0, top: 0, width: '50%', height: '100%' },
  right: { left: '50%', top: 0, width: '50%', height: '100%' },
  tl: { left: 0, top: 0, width: '50%', height: '50%' },
  tr: { left: '50%', top: 0, width: '50%', height: '50%' },
  bl: { left: 0, top: '50%', width: '50%', height: '50%' },
  br: { left: '50%', top: '50%', width: '50%', height: '50%' },
};

function snapZoneAt(x, y, r) {
  const nearLeft = x <= r.left + SNAP_EDGE;
  const nearRight = x >= r.right - SNAP_EDGE;
  if (nearLeft || nearRight) {
    if (y <= r.top + SNAP_CORNER) return nearLeft ? 'tl' : 'tr';
    if (y >= r.bottom - SNAP_CORNER) return nearLeft ? 'bl' : 'br';
    return nearLeft ? 'left' : 'right';
  }
  return y <= r.top + SNAP_EDGE ? 'max' : null;
}

const RGB_BORDER_STYLES = [
  { border: 'rgb-border-rainbow', glow: 'rgb-glow-rainbow' },
  { border: 'rgb-border-neon', glow: 'rgb-glow-cool' },
  { border: 'rgb-border-cool', glow: 'rgb-glow-cool' },
  { border: 'rgb-border-hot', glow: 'rgb-glow-hot' },
  { border: 'rgb-border-ocean', glow: 'rgb-glow-cool' },
  { border: 'rgb-border-gold', glow: 'rgb-glow-gold' },
  { border: 'rgb-border-sunset', glow: 'rgb-glow-hot' },
];

export default function DraggableWindow({
  title,
  children,
  zIndex = 1,
  defaultSize = { width: 860, height: 600 },
  initialOffset = 0,
  minimized = false,
  onMinimize,
  onClose,
  onFocus,
  onPopOut = null,
  focused = false,
  titleColor = '#22d3ee',
  borderStyle = null,
  windowId = null,
  onMaximizeChange = null,
}) {
  const windowRef = useRef(null);
  const pointerAction = useRef(null);
  const buttonHeld = useRef(false);
  const [position, setPosition] = useState({ x: 80 + initialOffset, y: 46 + initialOffset });
  const [size, setSize] = useState(defaultSize);
  const [maximized, setMaximized] = useState(false);
  const [snap, setSnap] = useState(null); // a ZONES key other than max while snapped
  const [snapPreview, setSnapPreview] = useState(null);
  // The floating size and place to go back to after a snap or maximise.
  const restoreGeometry = useRef(null);
  const geometry = useRef({ position, size }); // read by the pointer-up handler, registered once
  useEffect(() => { geometry.current = { position, size }; }, [position, size]);

  // Pick stable RGB border styling for this window
  const activeStyle = useMemo(() => {
    if (borderStyle) return borderStyle;
    const charCodeSum = (title || 'window').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return RGB_BORDER_STYLES[charCodeSum % RGB_BORDER_STYLES.length];
  }, [title, borderStyle]);

  // Read inside the pointer handlers, which are registered once.
  const onPopOutRef = useRef(onPopOut);
  onPopOutRef.current = onPopOut;

  // Tell the desktop when this window starts/stops covering the screen, so the
  // sidebars can drop beneath a maximized window and return when it is restored,
  // closed, or popped out. Via a ref so the callback's identity never churns deps.
  const onMaximizeChangeRef = useRef(onMaximizeChange);
  onMaximizeChangeRef.current = onMaximizeChange;
  useEffect(() => {
    onMaximizeChangeRef.current?.(windowId, maximized);
  }, [maximized, windowId]);
  useEffect(() => () => onMaximizeChangeRef.current?.(windowId, false), [windowId]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const action = pointerAction.current;
      if (!action) return;
      if (action.type === 'drag') {
        // A snapped or maximised window comes loose at its floating size once it really moves
        // (not on the first click of a double-click), still under the same point of the title bar.
        if (action.unsnap) {
          if (Math.hypot(event.clientX - action.startX, event.clientY - action.startY) < UNSNAP_SLOP) return;
          setMaximized(false);
          setSnap(null);
          setSize(action.unsnap.size);
          action.unsnap = null;
        }
        // Dragged past the edge of the app: becomes a native window under the
        // cursor, which keeps following the mouse onto any monitor.
        const outside = event.clientX < -POP_OUT_MARGIN || event.clientY < -POP_OUT_MARGIN
          || event.clientX > window.innerWidth + POP_OUT_MARGIN || event.clientY > window.innerHeight + POP_OUT_MARGIN;
        if (outside && onPopOutRef.current) {
          pointerAction.current = null;
          buttonHeld.current = true;
          setSnapPreview(null);
          onPopOutRef.current(windowRef.current?.getBoundingClientRect() || null, {
            screenX: event.screenX,
            screenY: event.screenY,
            grabX: action.grabX,
            stillHeld: () => buttonHeld.current,
          });
          return;
        }
        // Windows may hang off the left/right/bottom edges; enough of the title
        // bar always stays on the desktop to grab it again.
        const workspace = windowRef.current?.parentElement;
        const zone = workspace ? snapZoneAt(event.clientX, event.clientY, workspace.getBoundingClientRect()) : null;
        if (zone !== action.zone) { action.zone = zone; setSnapPreview(zone); }
        const ownWidth = windowRef.current?.offsetWidth || 0;
        const minX = Math.min(0, 120 - ownWidth);
        const maxX = Math.max(0, (workspace?.clientWidth || window.innerWidth) - 120);
        const maxY = Math.max(0, (workspace?.clientHeight || window.innerHeight) - 48);
        setPosition({
          x: Math.max(minX, Math.min(maxX, event.clientX - action.offsetX)),
          y: Math.max(0, Math.min(maxY, event.clientY - action.offsetY)),
        });
      } else {
        setSize({
          width: Math.max(MIN_WIDTH, action.width + event.clientX - action.startX),
          height: Math.max(MIN_HEIGHT, action.height + event.clientY - action.startY),
        });
      }
    };
    const handlePointerUp = () => {
      const action = pointerAction.current;
      pointerAction.current = null;
      buttonHeld.current = false;
      if (action?.type === 'drag' && action.zone) {
        // Restore goes back to where the window floated before this drag, not where it was dropped.
        restoreGeometry.current = action.floating || { ...geometry.current };
        if (action.zone === 'max') { setSnap(null); setMaximized(true); } else setSnap(action.zone);
      }
      setSnapPreview(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const startDrag = (event) => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    // Keeps pointer events coming when the cursor leaves the app window.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not supported */ }
    onFocus?.();
    const rect = windowRef.current?.getBoundingClientRect();
    const action = {
      type: 'drag',
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      // Where in the window it was grabbed (position is relative to the desktop
      // canvas, which starts after the sidebar), for a dragged-out pop-out.
      grabX: event.clientX - (rect?.left ?? position.x),
      startX: event.clientX,
      startY: event.clientY,
      zone: null,
      unsnap: null,
      floating: maximized || snap ? restoreGeometry.current : { position, size },
    };
    if ((maximized || snap) && rect) {
      // Keep the grab point at the same fraction of the title bar once the window is its floating size again.
      const floating = restoreGeometry.current?.size || size;
      const ws = windowRef.current.parentElement.getBoundingClientRect();
      const grab = Math.min(floating.width - 60, Math.max(60, ((event.clientX - rect.left) / rect.width) * floating.width));
      action.offsetX = ws.left + grab;
      action.offsetY = ws.top + (event.clientY - rect.top);
      action.grabX = grab;
      action.unsnap = { size: floating };
    }
    pointerAction.current = action;
  };

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onFocus?.();
    pointerAction.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      width: size.width,
      height: size.height,
    };
  };

  const toggleMaximize = () => {
    if (maximized || snap) {
      if (restoreGeometry.current) {
        setPosition(restoreGeometry.current.position);
        setSize(restoreGeometry.current.size);
      }
      setMaximized(false);
      setSnap(null);
      return;
    }
    restoreGeometry.current = { position, size };
    setMaximized(true);
    onFocus?.();
  };

  const handlePointerDown = (event) => {
    if (!focused) {
      onFocus?.();
    }
  };

  const placed = maximized ? ZONES.max : snap ? ZONES[snap] : null;
  return (
    <>
    {snapPreview && (
      <div
        aria-hidden="true"
        className="absolute rounded-2xl border-2 border-cyan-300/70 bg-cyan-400/10 backdrop-blur-[2px] pointer-events-none transition-all duration-150"
        style={{ ...ZONES[snapPreview], zIndex: Math.max(0, zIndex - 1) }}
      />
    )}
    <div
      ref={windowRef}
      className={`absolute ${activeStyle.border} rounded-2xl transition-shadow duration-300`}
      style={{
        // Inline so the .rgb-border-* classes (position: relative) can't put
        // windows back into normal flow, stacked under each other.
        position: 'absolute',
        display: minimized ? 'none' : 'block',
        left: placed ? placed.left : position.x,
        top: placed ? placed.top : position.y,
        width: placed ? placed.width : `min(${size.width}px, 100%)`,
        height: placed ? placed.height : `min(${size.height}px, 100%)`,
        zIndex,
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Liquid Flow Layer */}
      <div className="rgb-flow-layer" />

      {/* Main Window Frame with Backdrop Blur and Inner Chrome */}
      <section
        className={`flex flex-col h-full w-full bg-slate-950/92 backdrop-blur-2xl rounded-2xl overflow-hidden relative z-10 border border-white/[0.08] shadow-2xl ${
          focused ? activeStyle.glow : 'shadow-black/70'
        }`}
        data-focused={focused}
        aria-label={title}
      >
        {/* Title Bar */}
        <header
          className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-white/[0.08] cursor-move select-none active:cursor-grabbing shrink-0"
          onPointerDown={startDrag}
          onDoubleClick={toggleMaximize}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <GripHorizontal className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{
                background: titleColor,
                boxShadow: `0 0 8px ${titleColor}`
              }}
            />
            <span className="text-xs font-semibold text-slate-100 truncate tracking-wide">
              {title}
            </span>
          </div>

          {/* Window Action Controls */}
          <div className="flex items-center gap-1 shrink-0 no-drag">
            {onPopOut && (
              <button
                type="button"
                title="Pop out into its own window (any monitor)"
                aria-label={`Pop out ${title}`}
                onClick={() => onPopOut(windowRef.current?.getBoundingClientRect() || null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-300 hover:bg-violet-400/10 transition-colors cursor-pointer"
              >
                <ExternalLink size={13} />
              </button>
            )}
            <button
              type="button"
              title="Minimize"
              aria-label={`Minimize ${title}`}
              onClick={onMinimize}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              title={maximized || snap ? 'Restore' : 'Maximize'}
              aria-label={maximized || snap ? `Restore ${title}` : `Maximize ${title}`}
              onClick={toggleMaximize}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors cursor-pointer"
            >
              {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              type="button"
              title="Close"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        {/* Window Content */}
        <div className="flex-1 overflow-auto bg-transparent relative z-0 select-text">
          {children}
        </div>

        {/* Corner Resize Grip */}
        {!placed && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 group"
            onPointerDown={startResize}
          >
            <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-sm border-b-2 border-r-2 border-cyan-400/40 group-hover:border-cyan-400 transition-colors shadow-sm" />
          </div>
        )}
      </section>
    </div>
    </>
  );
}
