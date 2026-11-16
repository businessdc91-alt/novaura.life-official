// LegacyPhotoTab.jsx — The Creative Studio's original Photo tab, moved here unchanged while the
// layered version is built. It is removed once the new Photo tab replaces it.
import React, { useState, useRef, useEffect } from 'react';
import { Download, Scissors, Sliders, Maximize2 } from 'lucide-react';
import { MEME_TEMPLATES } from './memeTemplates.js';

export default function LegacyPhotoTab() {
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

  const downloadCanvasImage = (canvas, filename = 'sovereign_creation.png') => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
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
  );
}
