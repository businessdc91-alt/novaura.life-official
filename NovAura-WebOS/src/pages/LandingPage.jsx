import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Image, Sparkles, LayoutGrid, Monitor, Video,
  ShoppingBag, Globe, Shield, Loader2, X, Zap, Database,
  Key, BookOpen, Bot, ExternalLink, Mail, History, Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../platform/src/stores/authStore';
import { checkAndSpendExhaustiveResearch } from '../../platform/src/services/creditService';
import { researchService } from '../../platform/src/services/researchService';
import { auth } from '../../platform/src/config/firebase';
import FoundersSection from '../components/landing/FoundersSection';
import MembershipSection from '../components/landing/MembershipSection';
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-systems.cloudfunctions.net/api').replace(/\/$/, '');

const STAFF_GATE_CODE = '<catalyst>';

// ─── Particle Constellation Background ─────────────────────────────────
// Canvas-based particle network that drifts, connects, and breathes behind the logo
function ParticleConstellation() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const PARTICLE_COUNT = 120;
    const CONNECTION_DIST = 140;
    const COLORS = [
      { r: 0, g: 200, b: 255 },   // cyan
      { r: 160, g: 100, b: 255 },  // purple
      { r: 255, g: 100, b: 200 },  // pink
      { r: 80, g: 220, b: 200 },   // teal
      { r: 120, g: 130, b: 255 },  // indigo
    ];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function createParticle() {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const maxLife = 400 + Math.random() * 600; // frames
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 1 + Math.random() * 2.5,
        color,
        life: 0,
        maxLife,
        phase: Math.random() * Math.PI * 2, // for gentle pulsing
      };
    }

    function init() {
      resize();
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = createParticle();
        p.life = Math.random() * p.maxLife; // stagger initial lifetimes
        particles.push(p);
      }
    }

    function getAlpha(p) {
      // Fade in during first 15%, fade out during last 15%
      const fadeIn = Math.min(1, p.life / (p.maxLife * 0.15));
      const fadeOut = Math.min(1, (p.maxLife - p.life) / (p.maxLife * 0.15));
      return fadeIn * fadeOut;
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update & draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Respawn if lifetime exceeded
        if (p.life >= p.maxLife) {
          particles[i] = createParticle();
          continue;
        }

        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        const alpha = getAlpha(p);
        // Gentle pulsing
        const pulse = 0.7 + 0.3 * Math.sin(p.life * 0.02 + p.phase);
        const finalAlpha = alpha * pulse;

        // Draw particle glow
        const { r, g, b } = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${finalAlpha * 0.15})`;
        ctx.fill();

        // Draw particle core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${finalAlpha * 0.7})`;
        ctx.fill();
      }

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const alphaA = getAlpha(a);
        if (alphaA < 0.1) continue;

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const alphaB = getAlpha(b);
          if (alphaB < 0.1) continue;

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            const strength = (1 - dist / CONNECTION_DIST);
            const lineAlpha = strength * Math.min(alphaA, alphaB) * 0.25;

            // Blend colors between the two particles
            const r = Math.round((a.color.r + b.color.r) / 2);
            const g = Math.round((a.color.g + b.color.g) / 2);
            const bl = Math.round((a.color.b + b.color.b) / 2);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${r},${g},${bl},${lineAlpha})`;
            ctx.lineWidth = 0.5 + strength * 0.8;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

export default function LandingPage({ onLaunchOS }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('web');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [deepResearch, setDeepResearch] = useState(false);
  const [researchEffort, setResearchEffort] = useState('standard');
  const [showHistory, setShowHistory] = useState(false);
  const [researchHistory, setResearchHistory] = useState([]);
  const [liveCrawl, setLiveCrawl] = useState(false);
  const [resultCount, setResultCount] = useState(20);
  const [showOperators, setShowOperators] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const searchInputRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();
    // Track landing page view
    if (typeof window.gtag === 'function') {
      window.gtag('config', 'G-JXSHZN0FT0', {
        page_title: 'Landing Page',
        page_path: window.location.pathname
      });
    }
  }, []);

  // Fetch history when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      researchService.getUserReports(user.id, 5).then(setResearchHistory);
    }
  }, [isAuthenticated, user]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setResults(null);

    try {
      if (searchType === 'web') {
        const params = new URLSearchParams({ q: query, count: resultCount.toString() });
        if (liveCrawl) params.append('livecrawl', 'all');
        const response = await fetch(`${BACKEND_URL}/search?${params.toString()}`);
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = await response.json();
        setResults({ type: 'web', ...data });
      } else if (searchType === 'images') {
        const response = await fetch(`${BACKEND_URL}/search/images?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`Image search failed (${response.status})`);
        const data = await response.json();
        setResults({ type: 'images', ...data });
      } else if (searchType === 'video') {
        // Open Google video search directly — no backend proxy needed
        window.open(`https://www.google.com/search?tbm=vid&q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
        setIsSearching(false);
        return;
      } else if (searchType === 'ai') {
        if (deepResearch) {
          // Gating for Exhaustive Research
          if (researchEffort === 'exhaustive') {
            if (!isAuthenticated || !user) {
              toast.error('Exhaustive Research requires a Catalyst or Nova membership.');
              setIsSearching(false);
              return;
            }
            
            // Check quota without deducting yet
            const quotaCheck = await checkAndSpendExhaustiveResearch(user.id, user.membershipTier, false);
            if (!quotaCheck.allowed) {
              toast.error(quotaCheck.reason || 'You have reached your monthly Exhaustive Research limit.');
              setIsSearching(false);
              return;
            }
          }

          const response = await fetch(`${BACKEND_URL}/search/deep-research`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
            },
            body: JSON.stringify({ query, effort: researchEffort })
          });
          if (!response.ok) throw new Error(`Deep research failed (${response.status})`);
          const data = await response.json();
          
          // Success! Deduct the quota now if it was exhaustive
          if (researchEffort === 'exhaustive') {
            await checkAndSpendExhaustiveResearch(user.id, user.membershipTier, true);
          }
          
          setResults({ 
            type: 'deep_research', 
            analysis: data.analysis, 
            query: data.query,
            sourceCount: data.sourceCount,
            timestamp: data.timestamp
          });

          // Save to Firestore if user is logged in
          if (isAuthenticated && user) {
            try {
              await researchService.saveReport(user.id, {
                query: data.query,
                effort: researchEffort,
                content: data.analysis
              });
              // Refresh history
              const history = await researchService.getUserReports(user.id, 5);
              setResearchHistory(history);
              toast.success('Research report saved to your profile.');
            } catch (saveErr) {
              console.warn('Failed to save research report', saveErr);
            }
          }
        } else {
          const response = await fetch(`${BACKEND_URL}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: query, provider: 'gemini' })
          });
          if (!response.ok) throw new Error(`AI search failed (${response.status})`);
          const data = await response.json();
          setResults({ type: 'ai', insights: data.response });
        }
      }
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStaffVerify = async (e) => {
    e.preventDefault();
    if (staffCode.trim() === STAFF_GATE_CODE) {
      window.location.href = 'https://www.novaura.life';
    } else {
      toast.error('Invalid access code');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        setShowStaffModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col relative overflow-hidden">
      {/* Particle Constellation Background */}
      <ParticleConstellation />

      {/* Static Logo — clean, crisp, centered */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ opacity: 0.18 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt=""
          draggable={false}
          className="w-[70vh] h-[70vh] object-contain drop-shadow-[0_0_60px_rgba(0,200,255,0.15)]"
        />
      </div>
      
      {/* Top Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-md overflow-hidden bg-white/5 border border-white/10 p-1">
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`} 
              alt="NovAura Logo" 
              className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]"
            />
          </div>
          <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">NovAura</span>
        </div>
        
        <div className="flex items-center gap-1">
          <a
            href="/platform"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="Platform"
          >
            <LayoutGrid className="w-4 h-4" style={{ color: '#4285f4' }} />
            <span className="hidden sm:inline">Platform</span>
          </a>

          <a
            href="/platform/webmail"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="Webmail"
          >
            <Mail className="w-4 h-4" style={{ color: '#ea4335' }} />
            <span className="hidden sm:inline">Webmail</span>
          </a>

          <a
            href="/platform/browse"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="Asset Marketplace"
          >
            <ShoppingBag className="w-4 h-4" style={{ color: '#fbbc05' }} />
            <span className="hidden sm:inline">Market</span>
          </a>

          <a
            href="/platform/domains"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="NovaLow Domains & Hosting"
          >
            <Globe className="w-4 h-4" style={{ color: '#34a853' }} />
            <span className="hidden sm:inline">NovaLow</span>
          </a>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${showHistory ? 'bg-purple-500/20 text-purple-400' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                title="Research History"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </button>
              <a
                href="/platform/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white hover:bg-white/5 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">
                  {user.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">{user.username}</span>
                {user.membershipTier !== 'free' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                    user.membershipTier === 'nova' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10' : 
                    user.membershipTier === 'catalyst' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' :
                    'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                  }`}>
                    {user.membershipTier}
                  </span>
                )}
              </a>
            </div>
          ) : (
            <a
              href="/platform/login"
              className="flex items-center gap-2 px-4 py-2 ml-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </a>
          )}

          <a
            href="#founders"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-amber-400/70 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
            title="Founders & Investment"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('founders')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline">Investors</span>
          </a>

          <a
            href="/os/"
            onClick={(e) => {
              if (onLaunchOS) {
                e.preventDefault();
                onLaunchOS();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 ml-2 rounded-lg text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors border border-cyan-500/30 cursor-pointer"
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">NovAura OS</span>
          </a>
        </div>
      </nav>

      {/* Research History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-0 top-16 bottom-0 w-80 bg-[#0a0a0f]/95 backdrop-blur-xl border-l border-white/5 z-40 p-6 flex flex-col gap-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-purple-400">
                <History className="w-4 h-4" />
                Recent Research
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/5 rounded-md text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {researchHistory.length > 0 ? (
                researchHistory.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setResults({
                        type: 'deep_research',
                        analysis: report.content,
                        query: report.query,
                        timestamp: report.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
                        sourceCount: 0 // Not saved in history yet
                      });
                      setShowHistory(false);
                      setQuery(report.query);
                      setSearchType('ai');
                      setDeepResearch(true);
                      setResearchEffort(report.effort);
                    }}
                    className="w-full text-left p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">{report.effort} effort</span>
                      <span className="text-[10px] text-white/20">
                        {report.timestamp?.toDate?.()?.toLocaleDateString() || 'Recently'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white/80 line-clamp-2 group-hover:text-purple-400 transition-colors">
                      {report.query}
                    </p>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="w-8 h-8 text-white/10 mb-3" />
                  <p className="text-sm text-white/30">No saved research found.</p>
                  <p className="text-[10px] text-white/20 mt-1">Your premium reports will appear here.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Search and Features */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-4 lg:px-8 gap-6 max-w-[90rem] mx-auto w-full">
        
        {/* Left Side Features */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="hidden xl:flex flex-col gap-6 w-72 opacity-60 hover:opacity-100 transition-opacity"
        >
          {/* Cybeni Website Builder */}
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-cyan-500/30 transition-all group backdrop-blur-sm cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-lg text-white group-hover:text-cyan-400 transition-colors">Cybeni</h3>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Design, build, and deploy stunning web architectures instantly using our unified Website Builder.
            </p>
          </div>

          {/* API Key Hub */}
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-purple-500/30 transition-all group backdrop-blur-sm cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Key className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-semibold text-lg text-white group-hover:text-purple-400 transition-colors">Key Hub</h3>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Securely manage your platform keys, authentication paths, and API integrations from a single vault.
            </p>
          </div>
        </motion.div>

        {/* Center Search Widget */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-6xl sm:text-7xl font-bold text-center bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              NovAura
            </h1>
            <p className="text-center text-white/40 mt-2 text-sm tracking-widest uppercase">
              Search • Create • Explore
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full"
          >
          {/* Search Type Tabs */}
          <div className="flex items-center gap-1 mb-3 px-1">
            {[
              { id: 'web', label: 'Web', icon: Search },
              { id: 'images', label: 'Images', icon: Image },
              { id: 'video', label: 'Video', icon: Video },
              { id: 'ai', label: 'AI Insights', icon: Sparkles },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setSearchType(type.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                  searchType === type.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <type.icon className="w-4 h-4" />
                {type.label}
              </button>
            ))}
            
            {searchType === 'web' && (
              <div className="flex items-center gap-3 ml-auto">
                <select
                  value={resultCount}
                  onChange={(e) => setResultCount(Number(e.target.value))}
                  className="bg-white/5 text-white/50 text-[10px] px-2 py-1 rounded-md border border-white/10 outline-none cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <option value={20}>20 Results</option>
                  <option value={50}>50 Results</option>
                  {user?.membershipTier && user.membershipTier !== 'free' && <option value={100}>100 Results</option>}
                </select>
                <label className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${liveCrawl ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={liveCrawl}
                    onChange={(e) => setLiveCrawl(e.target.checked)}
                  />
                  <Zap className={`w-3 h-3 ${liveCrawl ? 'fill-cyan-400' : ''}`} />
                  <span>Live Crawl</span>
                </label>
              </div>
            )}
            
            {searchType === 'ai' && (
              <div className="flex items-center gap-4 ml-auto">
                {deepResearch && (
                  <select
                    value={researchEffort}
                    onChange={(e) => setResearchEffort(e.target.value)}
                    className="bg-purple-500/10 text-purple-400 text-[10px] px-2 py-1 rounded-md border border-purple-500/20 outline-none cursor-pointer hover:bg-purple-500/20 transition-colors"
                  >
                    <option value="lite">Lite Effort</option>
                    <option value="standard">Standard Effort</option>
                    <option value="deep">Deep Effort</option>
                    <option value="exhaustive">Exhaustive Effort</option>
                  </select>
                )}
                <label className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs cursor-pointer hover:bg-purple-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={deepResearch}
                    onChange={(e) => setDeepResearch(e.target.checked)}
                    className="w-3 h-3 rounded accent-purple-500"
                  />
                  <Database className="w-3 h-3" />
                  Deep Research
                </label>
              </div>
            )}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-cyan-500/50 focus-within:bg-white/[0.07] transition-all">
              <Search className="w-5 h-5 text-white/40 ml-4" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the web..."
                className="flex-1 bg-transparent px-4 py-4 text-white placeholder-white/30 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-6 py-2 m-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/30 text-black font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">Search</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Search Operators Hint */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={() => setShowOperators(!showOperators)}
              className="text-[10px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1.5 uppercase tracking-wider font-bold"
            >
              <Database className="w-3 h-3" />
              Advanced Operators
            </button>
            <div className="flex gap-3 text-[10px] text-white/20 font-medium">
              <span className="hover:text-cyan-400/60 cursor-help" title="site:example.com">site:</span>
              <span className="hover:text-purple-400/60 cursor-help" title="filetype:pdf">filetype:</span>
              <span className="hover:text-pink-400/60 cursor-help" title="Exclude words">-word</span>
              <span className="hover:text-blue-400/60 cursor-help" title="Exact match">+word</span>
            </div>
          </div>

          <AnimatePresence>
            {showOperators && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md max-w-lg text-center"
              >
                <p className="text-xs text-white/60 leading-relaxed">
                  Craft precise queries using <span className="text-cyan-400">site:domain.com</span>, <span className="text-purple-400">filetype:pdf</span>, 
                  logical <span className="text-pink-400">AND / OR</span>, and <span className="text-blue-400">-exclude</span> operators. 
                  NovAura leverages the full power of targeted search indexing.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-4xl mt-8 bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-6"
              >
                {results.type === 'ai' || results.type === 'deep_research' ? (
                  <div className="max-w-none prose prose-invert prose-cyan">
                    <h3 className="flex items-center justify-between text-sm text-white/50 mb-6 border-b border-white/5 pb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        {results.type === 'deep_research' ? 'NovAura AI Research Report' : 'AI Insights'}
                      </div>
                      {results.sourceCount > 0 && (
                        <div className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                          Analyzed {results.sourceCount} sources
                        </div>
                      )}
                    </h3>
                    <div className="text-white/80 leading-relaxed font-light text-base markdown-content">
                      {results.analysis || results.insights}
                    </div>
                    {results.timestamp && (
                      <div className="mt-8 pt-4 border-t border-white/5 text-[10px] text-white/30 italic">
                        Generated on {new Date(results.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                ) : results.type === 'images' ? (
                  <div>
                    <h3 className="text-sm text-white/50 mb-4">Image Results</h3>
                    {results.images?.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {results.images.map((img, i) => (
                          <a
                            key={i}
                            href={img.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block aspect-square bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-colors"
                          >
                            <img
                              src={img.thumbnail}
                              alt={img.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-white/50 mb-3">No inline images available.</p>
                        {results.externalSearchUrl && (
                          <a
                            href={results.externalSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View image results
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm text-white/50">
                        {results.provider === 'youcom' ? 'Unified Search Results' : 'Web Results'}
                      </h3>
                      {results.provider && (
                        <span className="text-[10px] text-white/20 uppercase tracking-widest font-medium">
                          Powered by {results.provider}
                        </span>
                      )}
                    </div>
                    {results.results?.length > 0 ? (
                      results.results.map((result, i) => (
                        <a
                          key={i}
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/10 group"
                        >
                          {result.thumbnail && (
                            <div className="hidden sm:block w-24 h-24 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                              <img src={result.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {result.type === 'news' && (
                                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[9px] font-bold rounded uppercase tracking-wider border border-red-500/20">
                                  News
                                </span>
                              )}
                              <h4 className="text-cyan-400 font-medium truncate group-hover:text-cyan-300 transition-colors">
                                {result.title}
                              </h4>
                            </div>
                            <p className="text-[11px] text-green-400/60 mb-1.5 truncate">
                              {result.displayUrl || result.url}
                              {result.age && <span className="ml-2 text-white/20">• {new Date(result.age).toLocaleDateString()}</span>}
                            </p>
                            <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                              {result.snippet}
                            </p>
                          </div>
                        </a>
                      ))
                    ) : (
                      <p className="text-white/50 text-center py-6">No results found for "{results.query}"</p>
                    )}
                    {results.fallback && results.message && (
                      <p className="text-xs text-white/40 mt-4 text-center">{results.message}</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </div>

        {/* Right Side Features */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="hidden xl:flex flex-col gap-6 w-72 opacity-60 hover:opacity-100 transition-opacity"
        >
          {/* Literature Suite */}
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-pink-500/30 transition-all group backdrop-blur-sm cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-semibold text-lg text-white group-hover:text-pink-400 transition-colors">Literature Suite</h3>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Craft worlds, architect narratives, and write code seamlessly alongside powerful context-aware AI tools.
            </p>
          </div>

          {/* Nova AI Companion */}
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all group backdrop-blur-sm cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-lg text-white group-hover:text-blue-400 transition-colors">Nova AI</h3>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Engage with a persistent, intelligent companion that deeply integrates into your entire OS and workflow.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Pre-launch & Founders Section */}
      <div id="founders">
        <FoundersSection />
      </div>
      <MembershipSection />

      {/* Footer with hidden staff button */}
      <footer className="px-6 py-4 border-t border-white/5 flex justify-between items-center text-xs text-white/40">
        <div className="flex items-center gap-4">
          <span>© 2026 NovAura Systems</span>
          <a href="/privacy-policy.html" className="hover:text-white/70 transition-colors">Privacy Policy</a>
          <a href="/terms-of-service.html" className="hover:text-white/70 transition-colors">Terms of Service</a>
        </div>
        <button
          onClick={() => setShowStaffModal(true)}
          className="opacity-0 hover:opacity-30 transition-opacity"
          title="Staff Portal (Ctrl+Shift+S)"
        >
          <Shield className="w-4 h-4" />
        </button>
      </footer>

      {/* Staff Modal */}
      <AnimatePresence>
        {showStaffModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0f0f14] border border-white/10 rounded-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Staff Portal</h2>
                  <p className="text-sm text-white/50">Authorized personnel only</p>
                </div>
              </div>

              <form onSubmit={handleStaffVerify}>
                <div className="space-y-4">
                  <input
                    type="password"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    placeholder="Enter staff code..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-purple-500/50"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowStaffModal(false)}
                      className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-400 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      Verify
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
