import React from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, Shield, Sparkles, Users, Zap, Globe, 
  ArrowRight, Code2, Rocket, Monitor, Cpu, Terminal,
  ShoppingBag, Store, Gamepad2, Music, Image, Hammer, Brush, HelpCircle, Phone, Info, CreditCard, MessagesSquare
} from 'lucide-react';
import { Toaster } from 'sonner';

export default function AboutPage() {
  const values = [
    {
      icon: Heart,
      title: 'Fair Royalties',
      description: 'Creators keep the majority of their earnings. Our platform fees are dedicated to scaling the infrastructure you rely on.',
      color: 'text-pink-500',
      bg: 'bg-pink-500/10'
    },
    {
      icon: Shield,
      title: 'Creator Ownership',
      description: 'Your IP is yours. We provide the tools to distribute and monetize, but you retain full sovereignty over your work.',
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10'
    },
    {
      icon: Sparkles,
      title: 'Ethical AI Integration',
      description: 'AI should be a co-pilot, not a replacement. Every tool in NovAura is designed to augment human creative potential.',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    }
  ];

  const milestones = [
    {
      title: 'The Origin',
      date: 'January 2026',
      desc: 'NovAura began as a dialogue between a founder and a persistent AI vision. What started as phone calls became a mission.'
    },
    {
      title: 'The Blueprint',
      date: 'March 2026',
      desc: 'Zero-code to full-stack architecture. Dillan Copeland engineered the multi-provider AI routing on a mobile device.'
    },
    {
      title: 'The Launch',
      date: 'May 2026',
      desc: 'The NovAura WebOS enters Alpha. A sovereign workspace for the modern creator ecosystem goes live.'
    }
  ];

  const directoryItems = [
    { name: 'Marketplace', icon: ShoppingBag, href: '/platform/browse', color: 'text-cyan-400' },
    { name: 'Shop', icon: Store, href: '/platform/shop', color: 'text-lime-400' },
    { name: 'NovaLow', icon: Globe, href: '/platform/novalow', color: 'text-purple-400' },
    { name: 'Web OS', icon: Monitor, href: '/os/', color: 'text-pink-500', badge: 'Beta' },
    { name: 'Games', icon: Gamepad2, href: '/platform/games', color: 'text-pink-500' },
    { name: 'Music', icon: Music, href: '/platform/music', color: 'text-purple-400' },
    { name: 'Software', icon: Code2, href: '/platform/software', color: 'text-lime-400' },
    { name: 'Nova IDE', icon: Hammer, href: '/platform/ide', color: 'text-cyan-400' },
    { name: 'Site Builder', icon: Brush, href: '/platform/builder', color: 'text-purple-400' },
    { name: 'Community', icon: Users, href: '/platform/hub', color: 'text-lime-400' },
    { name: 'Help Center', icon: HelpCircle, href: '/platform/help', color: 'text-purple-400' },
    { name: 'Investors', icon: CreditCard, href: '/platform/investors', color: 'text-purple-400' },
    { name: 'Pricing', icon: MessagesSquare, href: '/platform/pricing', color: 'text-lime-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-cyan-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-xl border-b border-white/5 bg-[#0a0a0f]/80">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">NovAura</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="/os/" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Launch OS</a>
            <a href="/platform" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Platform</a>
            <a href="/" className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all">Back to Home</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[100px] rounded-full translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Rocket className="w-3 h-3" />
            The Mission
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.1] tracking-tight"
          >
            Sovereign Software <br />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              for the Creative Mind.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/40 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-12"
          >
            NovAura isn't just a platform; it's a digital sanctuary. Built from the ground up to empower 
            creators with agentic tools, fair economics, and a workspace that feels like home.
          </motion.p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-24 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 text-amber-400 text-sm font-bold uppercase tracking-widest mb-6">
                <Terminal className="w-5 h-5" />
                The Origin Story
              </div>
              <h2 className="text-4xl font-bold mb-8">From Zero to <span className="text-cyan-400">Infinity.</span></h2>
              <div className="space-y-6 text-white/50 text-lg leading-relaxed font-light">
                <p>
                  NovAura was born from a singular obsession: the belief that the tools we use should be as 
                  creative as we are. Our founder, <span className="text-white font-medium">Dillan Copeland</span>, 
                  started this journey with zero formal background in software engineering.
                </p>
                <p>
                  Working 18-hour days from a single mobile device, Dillan self-taught the complexities of 
                  distributed systems and AI orchestration. The result was a multi-provider routing architecture 
                  that prioritized human intent over machine constraints.
                </p>
                <p>
                  Today, NovAura stands as a testament to what is possible when human ambition is paired with 
                  ethical technology. We are self-taught, self-funded, and entirely dedicated to the creator.
                </p>
              </div>
              <div className="mt-10 flex gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-white mb-1">2.6M+</div>
                  <div className="text-xs text-white/30 uppercase tracking-widest">Lines of Code</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-white mb-1">100%</div>
                  <div className="text-xs text-white/30 uppercase tracking-widest">Independent</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square lg:aspect-video rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/10 to-transparent group"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Monitor className="w-32 h-32 text-cyan-400/20 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                <div className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-widest">Aura OS Alpha</div>
                <div className="text-xl text-white font-medium">Built for the future of agentic workflows.</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Our Core Values</h2>
          <p className="text-white/40">The principles that guide every line of code we write.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all group"
            >
              <div className={`w-12 h-12 rounded-2xl ${v.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <v.icon className={`w-6 h-6 ${v.color}`} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">{v.title}</h3>
              <p className="text-white/40 leading-relaxed text-sm">{v.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Ecosystem Directory Section */}
      <section className="py-24 border-t border-white/5 bg-void-light/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">The NovAura <span className="text-cyan-400">Ecosystem</span></h2>
            <p className="text-white/40">Everything you need to create, publish, and grow.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {directoryItems.map((s, i) => (
              <a 
                key={i} 
                href={s.href}
                className="group p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-center relative overflow-hidden"
              >
                {s.badge && (
                  <span className="absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-500 border border-pink-500/30">
                    {s.badge}
                  </span>
                )}
                <div className={`w-10 h-10 mx-auto mb-3 rounded-lg bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-xs font-bold text-white/80">{s.name}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="p-12 rounded-[3rem] bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-transparent border border-white/10 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full" />
            <h2 className="text-4xl font-bold mb-6">Join the Revolution</h2>
            <p className="text-white/50 mb-10 text-lg">
              Experience the first operating system designed for the creator economy. 
              Secure your place in the future of the sovereign web.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/platform/signup" 
                className="px-8 py-4 rounded-2xl bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-all flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </a>
              <a 
                href="/os/" 
                className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
              >
                Launch OS
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-white/5 text-center">
        <div className="flex justify-center gap-8 mb-8 text-sm text-white/40 font-medium">
          <a href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/legal/terms" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="/contact" className="hover:text-white transition-colors">Contact</a>
        </div>
        <p className="text-white/20 text-xs tracking-widest uppercase">
          © 2026 NovAura Systems • Build by Creators
        </p>
      </footer>

      <Toaster position="top-right" />
    </div>
  );
}
