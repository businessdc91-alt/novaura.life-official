import React, { useState, useRef, useEffect } from 'react';
import { Globe, Search, ArrowLeft, ArrowRight, RotateCw, Home, Sparkles, ExternalLink, X, ShieldOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

const HOME_URL = 'https://novaura.life';

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return HOME_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost|^127\.|^192\.168\.|^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return `http://${trimmed}`;
  if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export default function BrowserWindow() {
  const [inputUrl, setInputUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isAIMode, setIsAIMode] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const iframeRef = useRef(null);
  const inputRef = useRef(null);

  const navigate = (raw) => {
    const url = normalizeUrl(raw);
    setInputUrl(url);
    setLoadedUrl(url);
    setBlocked(false);
    setIsLoading(true);
    setShowHome(false);

    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, url];
      setHistoryIndex(next.length - 1);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputUrl.trim()) navigate(inputUrl);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setInputUrl(prev);
      setLoadedUrl(prev);
      setBlocked(false);
      setIsLoading(true);
      setShowHome(false);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setInputUrl(next);
      setLoadedUrl(next);
      setBlocked(false);
      setIsLoading(true);
      setShowHome(false);
    }
  };

  const handleReload = () => {
    if (loadedUrl) {
      setBlocked(false);
      setIsLoading(true);
      if (iframeRef.current) {
        iframeRef.current.src = loadedUrl;
      }
    }
  };

  const handleHome = () => {
    setShowHome(true);
    setInputUrl('');
    setLoadedUrl('');
    setBlocked(false);
    setIsLoading(false);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    try {
      // If we can access contentDocument it wasn't blocked
      const _ = iframeRef.current?.contentDocument;
    } catch {
      // Cross-origin is expected — not a block
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setBlocked(true);
  };

  // Detect X-Frame-Options blocks via CSP/header rejection
  useEffect(() => {
    if (!loadedUrl) return;
    const timer = setTimeout(() => {
      if (isLoading) {
        // If still loading after 10s, may be blocked
        setIsLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loadedUrl]);

  const quickSites = [
    { name: 'NovAura', url: 'https://novaura.life', icon: '🌟' },
    { name: 'GitHub', url: 'https://github.com', icon: '🐱' },
    { name: 'MDN Docs', url: 'https://developer.mozilla.org', icon: '📚' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '💬' },
    { name: 'Vite Docs', url: 'https://vitejs.dev', icon: '⚡' },
    { name: 'Tailwind', url: 'https://tailwindcss.com', icon: '🎨' },
    { name: 'React Docs', url: 'https://react.dev', icon: '⚛️' },
    { name: 'Firebase', url: 'https://firebase.google.com', icon: '🔥' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/20 bg-[#0d1117]">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="h-7 w-7 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            className="h-7 w-7 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleReload}
            disabled={!loadedUrl}
            className="h-7 w-7 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleHome}
            className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
          >
            <Home className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* URL Bar */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative">
            {isLoading
              ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />
              : <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            }
            <Input
              ref={inputRef}
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="pl-9 h-8 text-sm bg-[#161b22] border-primary/20 focus-visible:ring-primary/50"
              placeholder="Search or enter URL..."
            />
          </div>
          <Button type="submit" size="sm" className="h-8 px-3 bg-primary hover:bg-primary/90">
            <Search className="w-3.5 h-3.5" />
          </Button>
        </form>

        {loadedUrl && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(loadedUrl, '_blank')}
            className="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </Button>
        )}

        <Button
          size="sm"
          variant={isAIMode ? 'default' : 'ghost'}
          onClick={() => {
            setIsAIMode(v => !v);
            toast.info(isAIMode ? 'AI Mode off' : 'AI Mode on — AI can help navigate and extract data');
          }}
          className={`h-8 px-2 gap-1.5 text-xs ${isAIMode ? 'bg-secondary/80 hover:bg-secondary text-white' : 'text-muted-foreground hover:text-primary'}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Home screen */}
        {showHome && (
          <div className="absolute inset-0 overflow-y-auto p-6 space-y-6">
            <div className="text-center space-y-2">
              <Globe className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Aura Browser</h2>
              <p className="text-sm text-muted-foreground">Enter a URL above or pick a quick site</p>
            </div>
            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
              {quickSites.map((site) => (
                <button
                  key={site.url}
                  onClick={() => navigate(site.url)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-primary/20 bg-window-bg hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <span className="text-2xl">{site.icon}</span>
                  <span className="text-xs text-muted-foreground font-medium">{site.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Blocked message */}
        {!showHome && blocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
            <ShieldOff className="w-12 h-12 text-warning/60" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Site blocked embedding</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This site uses <code className="text-xs bg-muted px-1 rounded">X-Frame-Options</code> or CSP to prevent embedding.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={() => window.open(loadedUrl, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleHome}
                className="gap-2 border-primary/30 hover:bg-primary/10"
              >
                <Home className="w-4 h-4" />
                Home
              </Button>
            </div>
          </div>
        )}

        {/* Iframe */}
        {!showHome && !blocked && loadedUrl && (
          <iframe
            ref={iframeRef}
            src={loadedUrl}
            title="browser"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
}
