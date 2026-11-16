// CurvesEditor.jsx — Edit a Curves adjustment: drag points, click to add one (up to 16),
// double-click a point to remove it, per channel (RGB, Red, Green, Blue).

import React, { useRef, useState } from 'react';
import { curveTable } from '../../../creative/adjustments.js';

const SIZE = 168;
const MAX_POINTS = 16;
const CHANNELS = [['rgb', 'RGB', '#e2e8f0'], ['r', 'Red', '#f87171'], ['g', 'Green', '#4ade80'], ['b', 'Blue', '#60a5fa']];
const toX = v => (v / 255) * SIZE;
const toY = v => SIZE - (v / 255) * SIZE;
const fromEvent = (e, svg) => {
  const r = svg.getBoundingClientRect();
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return [clamp(((e.clientX - r.left) / r.width) * 255), clamp(255 - ((e.clientY - r.top) / r.height) * 255)];
};

export default function CurvesEditor({ points, onChange, onDragStart }) {
  const [channel, setChannel] = useState('rgb');
  const svgRef = useRef(null);
  const dragging = useRef(null);
  const current = points[channel] || [[0, 0], [255, 255]];
  const table = curveTable(current);
  const colour = CHANNELS.find(c => c[0] === channel)[2];
  const path = Array.from(table, (v, i) => `${i ? 'L' : 'M'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');

  const commit = (next) => onChange({ ...points, [channel]: next.slice().sort((a, b) => a[0] - b[0]) });

  const onPointerDown = (e) => {
    const svg = svgRef.current;
    svg.setPointerCapture(e.pointerId);
    onDragStart?.();
    const [x, y] = fromEvent(e, svg);
    let index = current.findIndex(p => Math.abs(toX(p[0]) - toX(x)) < 7 && Math.abs(toY(p[1]) - toY(y)) < 7);
    if (index < 0) {
      if (current.length >= MAX_POINTS) return;
      const next = [...current, [x, y]].sort((a, b) => a[0] - b[0]);
      index = next.findIndex(p => p[0] === x && p[1] === y);
      commit(next);
      dragging.current = { index, list: next };
      return;
    }
    dragging.current = { index, list: current };
  };
  const onPointerMove = (e) => {
    const drag = dragging.current;
    if (!drag) return;
    const [x, y] = fromEvent(e, svgRef.current);
    const list = drag.list.map((p, i) => (i === drag.index ? [x, y] : p));
    drag.list = list;
    commit(list);
  };
  const onPointerUp = () => { dragging.current = null; };
  const onDoubleClick = (e) => {
    const [x, y] = fromEvent(e, svgRef.current);
    const index = current.findIndex(p => Math.abs(toX(p[0]) - toX(x)) < 7 && Math.abs(toY(p[1]) - toY(y)) < 7);
    if (index >= 0 && current.length > 2) commit(current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {CHANNELS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={channel === id} onClick={() => setChannel(id)}
            className={`flex-1 py-0.5 rounded text-[10px] ${channel === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} data-curves-editor=""
        className="block rounded-md bg-slate-950 border border-slate-700 touch-none cursor-crosshair"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick} role="img" aria-label="Curve"
      >
        {[1, 2, 3].map(i => (
          <g key={i} stroke="#1e293b">
            <line x1={(SIZE * i) / 4} y1={0} x2={(SIZE * i) / 4} y2={SIZE} />
            <line x1={0} y1={(SIZE * i) / 4} x2={SIZE} y2={(SIZE * i) / 4} />
          </g>
        ))}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="#334155" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke={colour} strokeWidth="1.5" />
        {current.map(([x, y], i) => <circle key={i} cx={toX(x)} cy={toY(y)} r="4" fill="#0f172a" stroke={colour} strokeWidth="1.5" />)}
      </svg>
      <p className="text-[10px] text-slate-500">Click to add a point, drag to move it, double-click to remove it.</p>
    </div>
  );
}
