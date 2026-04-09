import React, { useState } from 'react';
import { Maximize2, Minimize2, ExternalLink, RefreshCw } from 'lucide-react';

const GILDED_CAGE_URL = 'https://the-gilded-cage--lostitonce420.replit.app';

export default function GildedCageGame() {
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className={`flex flex-col h-full bg-black ${fullscreen ? 'fixed inset-0 z-[9999]' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-amber-900/80 to-yellow-900/60 border-b border-amber-500/30">
        <span className="text-xs font-semibold text-amber-300 tracking-wide">The Gilded Cage</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => document.getElementById('gilded-cage-iframe')?.contentWindow?.location.reload()}
            className="p-1 rounded hover:bg-white/10 text-amber-400/70 hover:text-amber-300 transition-colors"
            title="Reload game"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1 rounded hover:bg-white/10 text-amber-400/70 hover:text-amber-300 transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <a
            href={GILDED_CAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-white/10 text-amber-400/70 hover:text-amber-300 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Game iframe */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mb-3" />
            <p className="text-amber-400/60 text-sm">Loading The Gilded Cage...</p>
          </div>
        )}
        <iframe
          id="gilded-cage-iframe"
          src={GILDED_CAGE_URL}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          allow="autoplay; fullscreen; gamepad"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="The Gilded Cage"
        />
      </div>
    </div>
  );
}
