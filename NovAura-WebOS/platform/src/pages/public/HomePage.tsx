import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Cpu, Zap, Wrench, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEOMeta } from '@/components/seo/SEOMeta';

import MultiEngineSearchBar from '@/components/home/MultiEngineSearchBar';
import AdSlot from '@/components/home/AdSlot';
import VideoShowcase from '@/components/home/VideoShowcase';
import type { VideoItem } from '@/components/home/VideoShowcase';
import EcosystemDirectory from '@/components/home/EcosystemDirectory';
import MarketplacePreview from '@/components/home/MarketplacePreview';

// Featured videos — add real URLs here when available
const FEATURED_VIDEOS: VideoItem[] = [
  // Example:
  // { id: '1', title: 'Welcome to NovAura', type: 'youtube', url: 'https://youtu.be/...', description: 'Discover the NovAura ecosystem' },
];

const ROADMAP_ITEMS = [
  { title: 'Agentic Command Station', desc: 'Downloadable hybrid hub with baremetal-level AI enhancements.', icon: Cpu, color: 'text-neon-cyan' },
  { title: 'Nova Navi Systems', desc: 'Revolutionary edge AI companions across all your devices.', icon: Sparkles, color: 'text-neon-magenta' },
  { title: 'Dev Tools & API', desc: 'Full-scale developer environment and API for integrations.', icon: Wrench, color: 'text-neon-lime' },
  { title: 'Neural IDE', desc: 'Agent-first site building and code synthesis.', icon: Layout, color: 'text-neon-violet' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SEOMeta
        title="NovAura — The Creator Ecosystem"
        description="Your portal to the NovAura universe. Search the web, explore the marketplace, discover digital services, and build your creative empire."
        keywords={['NovAura', 'creator ecosystem', 'digital marketplace', 'web search', 'game assets', 'AI tools', 'web hosting', 'domains']}
        url="https://novaura.life"
      />

      {/* ── Hero ── */}
      <section className="relative min-h-[70vh] flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0 opacity-40 overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(0, 240, 255, 0.2) 0%, transparent 70%)', filter: 'blur(80px)' }}
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)', filter: 'blur(100px)' }}
          />
        </div>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-8 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,249,0.15)]"
            >
              <div className="relative">
                <Sparkles className="w-5 h-5 text-neon-cyan animate-pulse" />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-neon-cyan/50 blur-lg rounded-full"
                />
              </div>
              <span className="text-sm text-neon-cyan font-bold tracking-wider uppercase">
                Midnight Launch Core: Phase Alpha Live
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-heading text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-6"
            >
              <span className="text-text-primary">Build</span>{' '}
              <span className="text-gradient-rgb animate-gradient hover:animate-glitch cursor-default">Future Worlds.</span>
              <br />
              <span className="text-text-primary">Master the</span>{' '}
              <span className="text-neon-cyan drop-shadow-[0_0_15px_rgba(0,255,249,0.5)]">Sovereign Web.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto mb-10"
            >
              The ethical ecosystem for creators. Marketplace, hosting, AI tools,
              domains, and a full desktop OS — all in one place.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link to="/browse">
                <Button size="lg" className="bg-gradient-rgb text-void font-bold px-8 py-6 text-lg hover:opacity-90">
                  Explore Marketplace <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="outline" size="lg" className="border-white/20 text-text-primary hover:bg-white/5 px-8 py-6 text-lg">
                  Become a Creator
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Search Bar ── */}
      <MultiEngineSearchBar />

      {/* ── Ad: Below Search ── */}
      <div className="py-4">
        <AdSlot size="leaderboard" position="below-search" promoIndex={0} />
      </div>

      {/* ── Ecosystem Directory ── */}
      <EcosystemDirectory />

      {/* ── Video Showcase ── */}
      <VideoShowcase videos={FEATURED_VIDEOS} />

      {/* ── Ad: Mid-Content ── */}
      <div className="py-4">
        <AdSlot size="billboard" position="mid-content" promoIndex={1} />
      </div>

      {/* ── Marketplace Preview ── */}
      <MarketplacePreview />

      {/* ── Roadmap / Coming Soon ── */}
      <section className="py-20 lg:py-32 bg-void relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/5 to-transparent" />
        <div className="w-full px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-4"
              >
                <Zap className="w-3 h-3 text-neon-cyan" />
                <span className="text-[10px] text-neon-cyan font-bold uppercase tracking-widest">The Next Evolution</span>
              </motion.div>
              <h2 className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-6">
                Coming Soon to <span className="text-gradient-rgb">NovAura</span>
              </h2>
              <p className="text-text-secondary max-w-2xl mx-auto italic">
                "Breaking the boundaries between browser and baremetal."
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ROADMAP_ITEMS.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-2xl bg-void-light border border-white/5 hover:border-neon-cyan/20 transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${item.color}`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-3">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ad: Bottom ── */}
      <div className="py-6">
        <AdSlot size="leaderboard" position="bottom" promoIndex={2} />
      </div>

      {/* ── CTA ── */}
      <section className="py-20 lg:py-32">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-br from-neon-cyan/10 via-neon-violet/10 to-neon-magenta/10 border border-white/10 rounded-2xl p-8 sm:p-12 lg:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-radial from-neon-cyan/10 to-transparent opacity-50" />
              <div className="relative z-10">
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
                  Ready to share your work?
                </h2>
                <p className="text-text-secondary text-lg max-w-xl mx-auto mb-8">
                  Join creators earning fair royalties on NovAura.
                  Keep your rights, get paid what you deserve.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link to="/signup">
                    <Button size="lg" className="bg-gradient-rgb text-void font-bold px-8 py-6 text-lg">
                      Start Creating <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link to="/about">
                    <Button variant="outline" size="lg" className="border-white/20 text-text-primary hover:bg-white/5 px-8 py-6 text-lg">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
