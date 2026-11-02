// DrawingCanvas.jsx — Author Worldbuilding & Map Sketchpad
// Allows novelists to sketch floorplans, tactical battle maps, fantasy continents, and character costume designs.

import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Paintbrush, Eraser, Trash2, Download, Eye, Sparkles } from 'lucide-react';

export default function DrawingCanvas({ width = 800, height = 600, onSaveSketch }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil'); // 'pencil' | 'brush' | 'eraser'
  const [color, setColor] = useState('#00f0ff');
  const [brushSize, setBrushSize] = useState(2);
  const [opacity, setOpacity] = useState(0.85);
  const [sketchTitle, setSketchTitle] = useState('Story World Map');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Fill dark canvas background
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, width, height);

    // Subtle grid
    context.strokeStyle = 'rgba(255,255,255,0.04)';
    context.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }, [width, height]);

  useEffect(() => {
    if (contextRef.current) {
      if (tool === 'eraser') {
        contextRef.current.globalCompositeOperation = 'destination-out';
        contextRef.current.lineWidth = brushSize * 4;
        contextRef.current.globalAlpha = 1;
      } else if (tool === 'brush') {
        contextRef.current.globalCompositeOperation = 'source-over';
        contextRef.current.strokeStyle = color;
        contextRef.current.lineWidth = brushSize * 3;
        contextRef.current.globalAlpha = opacity * 0.4;
        contextRef.current.shadowBlur = brushSize * 2;
        contextRef.current.shadowColor = color;
      } else {
        contextRef.current.globalCompositeOperation = 'source-over';
        contextRef.current.strokeStyle = color;
        contextRef.current.lineWidth = brushSize;
        contextRef.current.globalAlpha = opacity;
        contextRef.current.shadowBlur = 0;
      }
    }
  }, [color, tool, brushSize, opacity]);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const clearCanvas = () => {
    if (!canvasRef.current || !contextRef.current) return;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, width, height);

    // Redraw grid
    context.strokeStyle = 'rgba(255,255,255,0.04)';
    context.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  };

  const exportImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${sketchTitle.toLowerCase().replace(/\s+/g, '_')}_sketch.png`;
    a.click();
    if (onSaveSketch) onSaveSketch(dataUrl, sketchTitle);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#090d16', color: '#e2e8f0', overflow: 'hidden' }}>
      
      {/* Sketchpad Toolbar */}
      <div style={{ height: '42px', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', backgroundColor: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles size={16} color="#00f0ff" />
          <input
            type="text"
            value={sketchTitle}
            onChange={(e) => setSketchTitle(e.target.value)}
            style={{ background: 'none', border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.2)', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, outline: 'none' }}
          />
        </div>

        {/* Drawing Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <button
            onClick={() => setTool('pencil')}
            title="Pencil"
            style={{ padding: '4px 8px', borderRadius: '4px', border: tool === 'pencil' ? '1px solid #00f0ff' : '1px solid transparent', backgroundColor: tool === 'pencil' ? 'rgba(0,240,255,0.15)' : 'transparent', color: tool === 'pencil' ? '#00f0ff' : '#94a3b8', cursor: 'pointer' }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setTool('brush')}
            title="Artist Glow Brush"
            style={{ padding: '4px 8px', borderRadius: '4px', border: tool === 'brush' ? '1px solid #00f0ff' : '1px solid transparent', backgroundColor: tool === 'brush' ? 'rgba(0,240,255,0.15)' : 'transparent', color: tool === 'brush' ? '#00f0ff' : '#94a3b8', cursor: 'pointer' }}
          >
            <Paintbrush size={14} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="Eraser"
            style={{ padding: '4px 8px', borderRadius: '4px', border: tool === 'eraser' ? '1px solid #00f0ff' : '1px solid transparent', backgroundColor: tool === 'eraser' ? 'rgba(0,240,255,0.15)' : 'transparent', color: tool === 'eraser' ? '#00f0ff' : '#94a3b8', cursor: 'pointer' }}
          >
            <Eraser size={14} />
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Color Picker */}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px' }}
          />

          {/* Brush Size */}
          <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '4px' }}>Size</span>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            style={{ width: '60px', accentColor: '#00f0ff' }}
          />

          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          <button
            onClick={clearCanvas}
            title="Clear canvas"
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={exportImage}
            title="Export PNG Sketch"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(0,240,255,0.4)', backgroundColor: 'rgba(0,240,255,0.15)', color: '#00f0ff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '1rem', backgroundColor: '#05070e' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={finishDrawing}
          onMouseMove={draw}
          onMouseLeave={finishDrawing}
          style={{
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        />
      </div>

    </div>
  );
}
