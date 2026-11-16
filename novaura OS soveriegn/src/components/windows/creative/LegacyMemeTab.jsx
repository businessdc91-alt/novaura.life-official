// LegacyMemeTab.jsx — The Creative Studio's original Meme tab, moved here unchanged while the
// layered version is built. It is removed once the new Meme tab replaces it.
import React, { useState, useRef, useEffect } from 'react';
import { Download, Smile } from 'lucide-react';
import { MEME_TEMPLATES } from './memeTemplates.js';

export default function LegacyMemeTab() {
  const memeCanvasRef = useRef(null);
  const [selectedMemeTemplate, setSelectedMemeTemplate] = useState(MEME_TEMPLATES[0]);
  const [memeTopText, setMemeTopText] = useState('WHEN YOU RUN YOUR AI');
  const [memeBottomText, setMemeBottomText] = useState('100% LOCAL & PRIVATE');

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
  );
}
