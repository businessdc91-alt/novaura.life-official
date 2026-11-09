import React, { useState, useRef, useEffect } from 'react';
import {
  Palette, Image as ImageIcon, Sparkles, Download, Undo, Redo,
  Trash2, Crop, Scissors, Type, Sliders, Maximize2, Share2,
  Smile, RefreshCw, Layers
} from 'lucide-react';

const SVG_SHIBA = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#0f172a">
  <circle cx="300" cy="200" r="120" fill="#06b6d4" opacity="0.25"/>
  <polygon points="210,140 240,60 270,120" fill="#f59e0b"/>
  <polygon points="390,140 360,60 330,120" fill="#f59e0b"/>
  <polygon points="225,120 240,80 255,115" fill="#fef3c7"/>
  <polygon points="375,120 360,80 345,115" fill="#fef3c7"/>
  <circle cx="300" cy="180" r="85" fill="#fbbf24"/>
  <ellipse cx="300" cy="210" rx="55" ry="40" fill="#fef3c7"/>
  <circle cx="300" cy="195" r="12" fill="#0f172a"/>
  <rect x="235" y="145" width="130" height="28" rx="6" fill="#06b6d4" opacity="0.9"/>
  <line x1="240" y1="159" x2="360" y2="159" stroke="#ffffff" stroke-width="2"/>
  <text x="300" y="320" font-family="monospace" font-size="22" font-weight="black" fill="#06b6d4" text-anchor="middle" letter-spacing="4">MUCH SOVEREIGN</text>
  <text x="300" y="350" font-family="monospace" font-size="14" fill="#a855f7" text-anchor="middle" letter-spacing="2">VERY DECENTRALIZED · WOW</text>
</svg>`)}`;

const SVG_CYBERPUNK = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a051b"/>
      <stop offset="60%" stop-color="#1f0d3d"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect width="600" height="260" fill="url(#sky)"/>
  <circle cx="300" cy="200" r="85" fill="#f43f5e" opacity="0.9"/>
  <polygon points="40,260 40,140 70,140 70,260" fill="#0f172a"/>
  <polygon points="75,260 75,100 115,100 115,260" fill="#1e1b4b"/>
  <polygon points="120,260 120,160 150,160 150,260" fill="#0f172a"/>
  <polygon points="160,260 160,80 200,80 200,260" fill="#1e1b4b"/>
  <polygon points="210,260 210,120 250,120 250,260" fill="#0f172a"/>
  <polygon points="350,260 350,90 390,90 390,260" fill="#1e1b4b"/>
  <polygon points="400,260 400,150 435,150 435,260" fill="#0f172a"/>
  <polygon points="445,260 445,110 490,110 490,260" fill="#1e1b4b"/>
  <polygon points="500,260 500,140 550,140 550,260" fill="#0f172a"/>
  <rect y="260" width="600" height="140" fill="#020617"/>
  <g stroke="#06b6d4" stroke-width="1.2" opacity="0.65">
    <line x1="300" y1="260" x2="0" y2="400"/>
    <line x1="300" y1="260" x2="100" y2="400"/>
    <line x1="300" y1="260" x2="200" y2="400"/>
    <line x1="300" y1="260" x2="300" y2="400"/>
    <line x1="300" y1="260" x2="400" y2="400"/>
    <line x1="300" y1="260" x2="500" y2="400"/>
    <line x1="300" y1="260" x2="600" y2="400"/>
    <line x1="0" y1="270" x2="600" y2="270"/>
    <line x1="0" y1="285" x2="600" y2="285"/>
    <line x1="0" y1="310" x2="600" y2="310"/>
    <line x1="0" y1="345" x2="600" y2="345"/>
    <line x1="0" y1="390" x2="600" y2="390"/>
  </g>
</svg>`)}`;

const SVG_MATRIX = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#020b05">
  <g font-family="monospace" font-size="14" fill="#22c55e" opacity="0.75">
    <text x="30" y="50">0 1 0 1 1 0 1</text>
    <text x="30" y="80">1 0 1 1 0 0 1</text>
    <text x="30" y="110">0 1 1 0 1 0 1</text>
    <text x="30" y="140" fill="#86efac" font-weight="bold">1 0 1 0 1 1 1</text>
    <text x="120" y="70">N O V A U R A</text>
    <text x="120" y="100">S O V E R E I G N</text>
    <text x="120" y="130">0 x 8 F 4 2 D A</text>
    <text x="120" y="160" fill="#fff" font-weight="bold">E N C R Y P T</text>
    <text x="260" y="40">λ f . ( λ x . f ( x x ) )</text>
    <text x="260" y="70">P 2 P _ M E S H _ N E T</text>
    <text x="260" y="100">D E C E N T R A L I Z E D</text>
    <text x="260" y="130">K E R N E L _ V 2 . 4</text>
    <text x="260" y="160" fill="#4ade80">S E C U R E _ B O O T</text>
    <text x="420" y="60">1 0 0 1 0 1 0</text>
    <text x="420" y="90">0 1 1 0 1 1 0</text>
    <text x="420" y="120">1 1 0 0 1 0 1</text>
    <text x="420" y="150" fill="#fff">A U R A _ C O R E</text>
    <text x="50" y="220">d x . e v a l ( p a c k e t )</text>
    <text x="50" y="250">e d 2 5 5 1 9 _ s i g n</text>
    <text x="50" y="280">x 2 5 5 1 9 _ s h a r e</text>
    <text x="50" y="310" fill="#86efac">V A U L T _ S E A L E D</text>
    <text x="220" y="240">Z E R O _ C L O U D</text>
    <text x="220" y="270">P R I V A T E _ D A T A</text>
    <text x="220" y="300">D E X I E _ C A C H E D</text>
    <text x="220" y="330" fill="#fff">1 0 0 % _ L O C A L</text>
  </g>
</svg>`)}`;

const SVG_COSMOS = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#030712">
  <defs>
    <radialGradient id="nebula1" cx="30%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="#3b82f6" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nebula2" cx="70%" cy="60%" r="45%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="#06b6d4" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="400" fill="url(#nebula1)"/>
  <rect width="600" height="400" fill="url(#nebula2)"/>
  <g fill="#ffffff">
    <circle cx="45" cy="60" r="1.5" opacity="0.9"/>
    <circle cx="120" cy="30" r="1.0" opacity="0.8"/>
    <circle cx="180" cy="90" r="2.0" opacity="1.0"/>
    <circle cx="230" cy="40" r="1.2" opacity="0.7"/>
    <circle cx="310" cy="80" r="2.5" opacity="1.0"/>
    <circle cx="390" cy="45" r="1.2" opacity="0.8"/>
    <circle cx="470" cy="70" r="1.8" opacity="0.9"/>
    <circle cx="530" cy="35" r="1.0" opacity="0.6"/>
    <circle cx="70" cy="180" r="1.5" opacity="0.8"/>
    <circle cx="140" cy="220" r="2.2" opacity="1.0"/>
    <circle cx="280" cy="190" r="1.0" opacity="0.7"/>
    <circle cx="350" cy="230" r="1.8" opacity="0.9"/>
    <circle cx="440" cy="170" r="2.4" opacity="1.0"/>
    <circle cx="510" cy="210" r="1.2" opacity="0.8"/>
    <circle cx="90" cy="320" r="1.7" opacity="0.9"/>
    <circle cx="190" cy="360" r="1.2" opacity="0.7"/>
    <circle cx="260" cy="310" r="2.0" opacity="1.0"/>
    <circle cx="380" cy="350" r="1.5" opacity="0.8"/>
    <circle cx="480" cy="320" r="2.2" opacity="1.0"/>
  </g>
  <circle cx="460" cy="140" r="45" fill="#38bdf8"/>
  <ellipse cx="460" cy="140" rx="75" ry="16" fill="none" stroke="#f472b6" stroke-width="4" transform="rotate(-15 460 140)"/>
</svg>`)}`;

export const MEME_TEMPLATES = [
  { id: 'doge', name: 'Cyber Shiba / Much Wow', url: SVG_SHIBA },
  { id: 'city', name: 'Cyberpunk Metropolis', url: SVG_CYBERPUNK },
  { id: 'matrix', name: 'Digital Rain / Code', url: SVG_MATRIX },
  { id: 'spaceman', name: 'Cosmic Voyager', url: SVG_COSMOS },
];

export default function CreativeStudioWindow() {
  const [activeTab, setActiveTab] = useState('paint'); // 'paint' | 'photo' | 'meme'

  // ==========================================
  // TAB 1: SOVEREIGN PAINT CANVAS
  // ==========================================
  const paintCanvasRef = useRef(null);
  const [paintTool, setPaintTool] = useState('brush'); // 'brush' | 'pencil' | 'eraser' | 'rect' | 'circle'
  const [brushColor, setBrushColor] = useState('#06b6d4');
  const [brushSize, setBrushSize] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    if (paintCanvasRef.current) {
      const canvas = paintCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveState();
    }
  }, []);

  const saveState = () => {
    if (!paintCanvasRef.current) return;
    const canvas = paintCanvasRef.current;
    const dataUrl = canvas.toDataURL();
    const nextHistory = history.slice(0, historyIdx + 1);
    nextHistory.push(dataUrl);
    setHistory(nextHistory);
    setHistoryIdx(nextHistory.length - 1);
  };

  const startDrawing = (e) => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = paintTool === 'eraser' ? '#0f172a' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !paintCanvasRef.current) return;
    const canvas = paintCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      const prevIdx = historyIdx - 1;
      const canvas = paintCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = history[prevIdx];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHistoryIdx(prevIdx);
      };
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1;
      const canvas = paintCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = history[nextIdx];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHistoryIdx(nextIdx);
      };
    }
  };

  const clearPaint = () => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  // ==========================================
  // TAB 2: PHOTO STUDIO & FILTERS
  // ==========================================
  const photoCanvasRef = useRef(null);
  const [photoSrc, setPhotoSrc] = useState(MEME_TEMPLATES[0].url);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [photoText, setPhotoText] = useState('SOVEREIGN NODE');
  const [textColor, setTextColor] = useState('#ffffff');
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  useEffect(() => {
    if (photoSrc && photoCanvasRef.current) {
      applyPhotoFilters();
    }
  }, [photoSrc, brightness, contrast, saturation, blur, photoText, textColor]);

  const applyPhotoFilters = () => {
    const canvas = photoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = photoSrc;
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 400;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      // Draw Text Overlay if provided
      if (photoText) {
        ctx.font = 'bold 32px "JetBrains Mono", sans-serif';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(photoText, canvas.width / 2, canvas.height - 40);
        ctx.fillText(photoText, canvas.width / 2, canvas.height - 40);
      }
    };
  };

  // Background Removal Algorithm (Color & Alpha Keying)
  const handleRemoveBackground = () => {
    setIsRemovingBg(true);
    setTimeout(() => {
      const canvas = photoCanvasRef.current;
      if (!canvas) { setIsRemovingBg(false); return; }
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample corner pixel as background color reference
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Calculate Euclidean distance in RGB color space
        const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
        if (dist < 70) {
          data[i + 3] = 0; // Transparent
        }
      }

      ctx.putImageData(imgData, 0, 0);
      setIsRemovingBg(false);
    }, 400);
  };

  // 2x Upscale
  const handleUpscale = () => {
    const canvas = photoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imgData = canvas.toDataURL();
    const img = new Image();
    img.src = imgData;
    img.onload = () => {
      canvas.width = canvas.width * 1.5;
      canvas.height = canvas.height * 1.5;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  };

  // ==========================================
  // TAB 3: MEME MACHINE
  // ==========================================
  const memeCanvasRef = useRef(null);
  const [selectedMemeTemplate, setSelectedMemeTemplate] = useState(MEME_TEMPLATES[0]);
  const [memeTopText, setMemeTopText] = useState('WHEN YOU RUN YOUR AI');
  const [memeBottomText, setMemeBottomText] = useState('100% LOCAL & AIR-GAPPED');

  useEffect(() => {
    renderMeme();
  }, [selectedMemeTemplate, memeTopText, memeBottomText]);

  const renderMeme = () => {
    const canvas = memeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedMemeTemplate.url;
    img.onload = () => {
      canvas.width = 540;
      canvas.height = 420;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      ctx.font = '900 36px Impact, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;

      // Top Text
      if (memeTopText) {
        ctx.strokeText(memeTopText.toUpperCase(), canvas.width / 2, 55);
        ctx.fillText(memeTopText.toUpperCase(), canvas.width / 2, 55);
      }

      // Bottom Text
      if (memeBottomText) {
        ctx.strokeText(memeBottomText.toUpperCase(), canvas.width / 2, canvas.height - 30);
        ctx.fillText(memeBottomText.toUpperCase(), canvas.width / 2, canvas.height - 30);
      }
    };
  };

  const downloadCanvasImage = (canvas, filename = 'sovereign_creation.png') => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">Sovereign Canvas, Photo Studio & Meme Machine</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-500/40 font-mono">
                Graphics Foundry
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Full HTML5 paint canvas, background remover, upscale enhancer, and meme generator</p>
          </div>
        </div>

        {/* Studio Tabs */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => setActiveTab('paint')}
            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'paint' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Sovereign Paint</span>
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'photo' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo Editor</span>
          </button>
          <button
            onClick={() => setActiveTab('meme')}
            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'meme' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Meme Machine</span>
          </button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* ========================================== */}
        {/* TAB 1: SOVEREIGN PAINT */}
        {/* ========================================== */}
        {activeTab === 'paint' && (
          <div className="flex flex-col items-center space-y-4">
            {/* Toolbar Strip */}
            <div className="flex items-center justify-between w-full max-w-3xl bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
              <div className="flex items-center gap-2">
                {['brush', 'pencil', 'eraser'].map((tool) => (
                  <button
                    key={tool}
                    onClick={() => setPaintTool(tool)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-all ${
                      paintTool === tool ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tool}
                  </button>
                ))}

                {/* Color Chips */}
                <div className="flex items-center gap-1 ml-3 border-l border-slate-800 pl-3">
                  {['#06b6d4', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ffffff'].map(c => (
                    <button
                      key={c}
                      onClick={() => setBrushColor(c)}
                      className="w-5 h-5 rounded-full border border-slate-700 transition-transform hover:scale-125"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer ml-1"
                  />
                </div>

                {/* Brush Size */}
                <div className="flex items-center gap-1.5 ml-3 border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-slate-400 font-mono">Size</span>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                    className="w-16 accent-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleUndo} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleRedo} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                  <Redo className="w-3.5 h-3.5" />
                </button>
                <button onClick={clearPaint} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => downloadCanvasImage(paintCanvasRef.current, 'sovereign_drawing.png')}
                  className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Drawing Canvas */}
            <div className="rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl bg-slate-900">
              <canvas
                ref={paintCanvasRef}
                width={740}
                height={480}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="cursor-crosshair block"
              />
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: PHOTO STUDIO */}
        {/* ========================================== */}
        {activeTab === 'photo' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Controls Column */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                Adjustments & AI Tools
              </h3>

              {/* Action Buttons: Remove BG & Upscale */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleRemoveBackground}
                  disabled={isRemovingBg}
                  className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{isRemovingBg ? 'Knocking Out...' : 'Remove BG'}</span>
                </button>
                <button
                  onClick={handleUpscale}
                  className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>2x Upscale</span>
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Brightness</span>
                    <span>{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={brightness}
                    onChange={(e) => setBrightness(e.target.value)}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Contrast</span>
                    <span>{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={contrast}
                    onChange={(e) => setContrast(e.target.value)}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Saturation</span>
                    <span>{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(e.target.value)}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              {/* Text Overlay */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="text-[11px] text-slate-400 block font-bold">Add Typography Overlay</label>
                <input
                  type="text"
                  value={photoText}
                  onChange={(e) => setPhotoText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  placeholder="Watermark or title..."
                />
              </div>

              <button
                onClick={() => downloadCanvasImage(photoCanvasRef.current, 'sovereign_photo_edit.png')}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Edited Photo</span>
              </button>
            </div>

            {/* Canvas Viewport */}
            <div className="lg:col-span-2 flex items-center justify-center bg-slate-900/40 border border-slate-800 rounded-3xl p-4 shadow-2xl">
              <canvas ref={photoCanvasRef} className="rounded-2xl max-w-full shadow-lg" />
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: MEME MACHINE */}
        {/* ========================================== */}
        {activeTab === 'meme' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Controls */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Smile className="w-4 h-4 text-pink-400" />
                Meme Text & Templates
              </h3>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-bold">Top Headline</label>
                <input
                  type="text"
                  value={memeTopText}
                  onChange={(e) => setMemeTopText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
                  placeholder="TOP TEXT..."
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-bold">Bottom Punchline</label>
                <input
                  type="text"
                  value={memeBottomText}
                  onChange={(e) => setMemeBottomText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
                  placeholder="BOTTOM TEXT..."
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-2 font-bold">Meme Starter Templates</label>
                <div className="grid grid-cols-2 gap-2">
                  {MEME_TEMPLATES.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedMemeTemplate(t)}
                      className={`p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center gap-2 ${
                        selectedMemeTemplate.id === t.id ? 'bg-pink-950/60 border-pink-500/60 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <img src={t.url} alt={t.name} className="w-8 h-8 rounded-lg object-cover" />
                      <span className="truncate font-bold text-[11px]">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => downloadCanvasImage(memeCanvasRef.current, 'sovereign_meme.png')}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export & Share Sovereign Meme</span>
              </button>
            </div>

            {/* Meme Canvas Preview */}
            <div className="lg:col-span-2 flex items-center justify-center bg-slate-900/40 border border-slate-800 rounded-3xl p-4 shadow-2xl">
              <canvas ref={memeCanvasRef} className="rounded-2xl max-w-full shadow-2xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
