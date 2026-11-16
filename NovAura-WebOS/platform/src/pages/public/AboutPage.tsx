import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Heart, Shield, Sparkles, Users, Zap, Globe, 
  ArrowRight, Code2, Rocket, Monitor, Cpu, Terminal,
  ShoppingBag, Store, Gamepad2, Music, Image, Hammer, Brush, HelpCircle, Phone, Info, CreditCard, MessagesSquare
} from 'lucide-react';
import { SEOMeta } from '@/components/seo/SEOMeta';

export default function AboutPage() {
  const values = [
    {
      icon: Heart,
      title: 'Fair Royalties',
      description: 'Creators keep the majority of their earnings. Our platform fees are dedicated to scaling the infrastructure you rely on.',
      color: 'text-neon-cyan',
      bg: 'bg-neon-cyan/10'
    },
    {
      icon: Shield,
      title: 'Creator Ownership',
      description: 'Your IP is yours. We provide the tools to distribute and monetize, but you retain full sovereignty over your work.',
      color: 'text-neon-magenta',
      bg: 'bg-neon-magenta/10'
    },
    {
      icon: Sparkles,
      title: 'Ethical AI Integration',
      description: 'AI should be a co-pilot, not a replacement. Every tool in NovAura is designed to augment human creative potential.',
      color: 'text-neon-lime',
      bg: 'bg-neon-lime/10'
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
    { name: 'Marketplace', icon: ShoppingBag, href: '/browse', color: 'text-neon-cyan' },
    { name: 'Shop', icon: Store, href: '/shop', color: 'text-neon-lime' },
    { name: 'NovaLow', icon: Globe, href: '/novalow', color: 'text-neon-violet' },
    { name: 'Web OS', icon: '/', color: 'text-neon-magenta', badge: 'Beta' },
    { name: 'Games', icon: Gamepad2, href: '/games', color: 'text-neon-magenta' },
    { name: 'Music', icon: Music, href: '/music', color: 'text-neon-violet' },
    { name: 'Software', icon: Code2, href: '/software', color: 'text-neon-lime' },
    { name: 'Nova IDE', icon: Hammer, href: '/ide', color: 'text-neon-cyan' },
    { name: 'Site Builder', icon: Brush, href: '/builder', color: 'text-neon-violet' },
    { name: 'Community', icon: Users, href: '/hub', color: 'text-neon-lime' },
    { name: 'Help Center', icon: HelpCircle, href: '/help', color: 'text-neon-violet' },
    { name: 'Investors', icon: CreditCard, href: '/investors', color: 'text-neon-violet' },
    { name: 'Pricing', icon: MessagesSquare, href: '/pricing', color: 'text-neon-lime' },
  ];

  return (
    <div className="min-h-screen bg-void text-text-primary selection:bg-neon-cyan/30">
      <SEOMeta 
        title="About NovAura — The Origin Story"
        description="Discover the mission, the journey, and the sovereign philosophy behind the NovAura ecosystem."
        url="https://novaura.life/about"
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-neon-cyan/5 blur-[120px] rounded-full -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-neon-magenta/5 blur-[100px] rounded-full translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-xs font-black uppercase tracking-widest mb-8"
          >
            <Rocket className="w-3 h-3" />
            The Mission
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black mb-8 leading-[1.1] tracking-tight"
          >
            Sovereign Software <br />
            <span className="text-gradient-rgb animate-gradient">
              for the Creative Mind.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-12"
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
              <div className="flex items-center gap-3 text-neon-lime text-sm font-bold uppercase tracking-widest mb-6">
                <Terminal className="w-5 h-5" />
                The Origin Story
              </div>
              <h2 className="text-4xl font-bold mb-8">From Zero to <span className="text-neon-cyan">Infinity.</span></h2>
              <div className="space-y-6 text-text-secondary text-lg leading-relaxed font-light">
                <p>
                  NovAura was born from a singular obsession: the belief that the tools we use should be as 
                  creative as we are. Our founder, <span className="text-text-primary font-medium">Dillan Copeland</span>, 
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
                  <div className="text-2xl font-bold text-text-primary mb-1">2.6M+</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Lines of Code</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-text-primary mb-1">100%</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Independent</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square lg:aspect-video rounded-3xl overflow-hidden border border-white/10 bg-void-light group"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Monitor className="w-32 h-32 text-neon-cyan/10 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-void to-transparent">
                <div className="text-xs font-black text-neon-cyan mb-2 uppercase tracking-widest">Aura OS Alpha</div>
                <div className="text-xl text-text-primary font-medium">Built for the future of agentic workflows.</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Our Core Values</h2>
          <p className="text-text-muted">The principles that guide every line of code we write.</p>
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
              <h3 className="text-xl font-bold mb-4 text-text-primary">{v.title}</h3>
              <p className="text-text-secondary leading-relaxed text-sm">{v.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Ecosystem Directory Section */}
      <section className="py-24 border-t border-white/5 bg-void-light/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">The NovAura <span className="text-gradient-rgb">Ecosystem</span></h2>
            <p className="text-text-muted">Everything you need to create, publish, and grow.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {directoryItems.map((s, i) => (
              <Link 
                key={i} 
                to={s.href}
                className="group p-6 rounded-2xl bg-void-light border border-white/5 hover:border-neon-cyan/30 transition-all text-center relative overflow-hidden"
              >
                {s.badge && (
                  <span className={`absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30`}>
                    {s.badge}
                  </span>
                )}
                <div className={`w-11 h-11 mx-auto mb-3 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-neon-cyan/10 transition-all`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-xs font-bold text-text-primary">{s.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="p-12 rounded-[3rem] bg-gradient-to-br from-neon-cyan/5 via-neon-magenta/5 to-transparent border border-white/10 relative overflow-hidden">
            <h2 className="text-4xl font-bold mb-6">Join the Revolution</h2>
            <p className="text-text-secondary mb-10 text-lg">
              Experience the first operating system designed for the creator economy. 
              Secure your place in the future of the sovereign web.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/signup" 
                className="px-8 py-4 rounded-2xl bg-neon-cyan text-void font-black hover:bg-white transition-all flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a 
                href="/os/" 
                className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-text-primary font-bold hover:bg-white/10 transition-all"
              >
                Launch OS
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
