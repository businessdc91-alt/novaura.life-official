import React, { useState, useRef } from 'react';
import { ShoppingBag, RotateCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';

export default function PlatformWindow() {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);

  const handleRefresh = () => {
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleExternal = () => {
    window.open('/', '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header / Address Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono text-white/40 select-none">novaura.life</span>
        </div>
        
        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleRefresh}
            title="Refresh Platform"
            className="h-8 w-8 hover:bg-white/10 transition-all duration-300 active:scale-90"
          >
            <RotateCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleExternal}
            title="Open in New Tab"
            className="h-8 w-8 hover:bg-white/10 transition-all duration-300 active:scale-90"
          >
            <ExternalLink className="w-4 h-4 text-white/60" />
          </Button>
        </div>
      </div>

      {/* Iframe Content */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0f] gap-4">
            {/* Pulsing Logo or Loader */}
            <div className="relative">
              <div className="w-16 h-16 border-2 border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin" />
              <ShoppingBag className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-cyan-500/50" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] font-mono text-cyan-500/50 uppercase tracking-[0.2em] animate-pulse">Bridging Ecosystem</p>
              <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Authentication Synchronizing...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/"
          className="w-full h-full border-none"
          onLoad={() => setLoading(false)}
          title="NovAura Platform"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        />
      </div>
    </div>
  );
}
