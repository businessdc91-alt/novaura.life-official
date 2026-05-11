import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Eraser, Trash2, Palette, Paintbrush } from 'lucide-react';

export default function DrawingCanvas({ width, height, isActive, onCircleDetection }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil'); // 'pencil', 'brush', 'eraser'
  const [color, setColor] = useState('#7c3aed');
  const [brushSize, setBrushSize] = useState(2);
  const [opacity, setOpacity] = useState(0.8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width * 2; // for retina
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;
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
        contextRef.current.globalAlpha = opacity * 0.4; // Soft brush
        contextRef.current.shadowBlur = brushSize;
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
    
    // Emit the current canvas state for AI/Visual context
    if (onCircleDetection) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onCircleDetection(dataUrl);
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (onCircleDetection) onCircleDetection(null);
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      <div className="absolute top-4 right-4 flex flex-col gap-3 p-3 glass-panel rounded-2xl border border-white/10 pointer-events-auto shadow-2xl animate-in fade-in slide-in-from-right-4">
        <div className="flex flex-col gap-1">
          <ToolBtn 
            icon={Pencil} 
            active={tool === 'pencil'} 
            onClick={() => setTool('pencil')} 
            title="Fine Pencil" 
          />
          <ToolBtn 
            icon={Paintbrush} 
            active={tool === 'brush'} 
            onClick={() => setTool('brush')} 
            title="Artist Brush" 
          />
          <ToolBtn 
            icon={Eraser} 
            active={tool === 'eraser'} 
            onClick={() => setTool('eraser')} 
            title="Eraser" 
          />
        </div>

        <div className="w-full h-px bg-white/5" />

        <div className="flex flex-col gap-2 px-1">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-gray-500 uppercase font-medium">Size</span>
            <input 
              type="range" min="1" max="20" 
              value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full accent-primary" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-gray-500 uppercase font-medium">Opacity</span>
            <input 
              type="range" min="0" max="1" step="0.1"
              value={opacity} 
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-primary" 
            />
          </div>
        </div>

        <div className="w-full h-px bg-white/5" />

        <div className="grid grid-cols-2 gap-2">
          <input 
            type="color" 
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-8 rounded-lg cursor-pointer border-none bg-transparent hover:scale-105 transition-transform"
          />
          <button 
            onClick={clearCanvas}
            className="flex items-center justify-center w-full h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <canvas
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseMove={draw}
        ref={canvasRef}
        className="cursor-crosshair pointer-events-auto"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}

function ToolBtn({ icon: Icon, active, onClick, title }) {
  return (
    <button 
      onClick={onClick}
      className={`p-2.5 rounded-xl transition-all duration-300 ${
        active 
          ? 'bg-primary text-white shadow-lg shadow-primary/25' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
      title={title}
    >
      <Icon className="w-4.5 h-4.5" />
    </button>
  );
}
