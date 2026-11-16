import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp, DollarSign, Users, Package, Rocket,
  BarChart3, Globe, Cpu, Sparkles, Wrench, Layout,
  ArrowRight, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOMeta } from '@/components/seo/SEOMeta';
import { getAssets } from '@/services/marketService';
import type { Asset } from '@/types';
import { kernelStorage } from '@/kernel/kernelStorage.js';

const REVENUE_STREAMS = [
  { name: 'Platform Fee', desc: '10% on all marketplace transactions', icon: DollarSign, color: 'neon-cyan' },
  { name: 'Subscriptions', desc: 'Creator, Studio & Catalyst tiers', icon: BarChart3, color: 'neon-violet' },
  { name: 'Domain Sales', desc: 'Domain marketplace commissions', icon: Globe, color: 'neon-lime' },
  { name: 'Hosting Plans', desc: 'Managed web hosting revenue', icon: Wrench, color: 'neon-magenta' },
  { name: 'Advertising', desc: 'Promotion slots & featured placements', icon: Layout, color: 'neon-cyan' },
  { name: 'AI Credits', desc: 'Pay-per-use AI generation credits', icon: Cpu, color: 'neon-violet' },
];

const ROADMAP = [
  { title: 'Agentic Command Station', desc: 'Downloadable hybrid desktop app with baremetal AI', icon: Cpu, color: 'neon-cyan' },
  { title: 'Nova Navi Systems', desc: 'Edge AI companions across watch, phone, desktop', icon: Sparkles, color: 'neon-magenta' },
  { title: 'Developer API', desc: 'Full API access for third-party integrations', icon: Wrench, color: 'neon-lime' },
  { title: 'AI Emporium Marketplace', desc: 'Royalty-based asset sharing with Git-backed library', icon: Layout, color: 'neon-violet' },
];

export default function InvestorPortalPage() {
  const [stats, setStats] = useState({ assets: 0, creators: 0 });
  const [form, setForm] = useState({ name: '', email: '', range: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getAssets().then((assets: Asset[]) => {
      const approved = assets.filter(a => a.status === 'approved');
      const creators = new Set(approved.map(a => a.creatorId));
      setStats({ assets: approved.length, creators: creators.size });
    }).catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = JSON.parse(kernelStorage.getItem('investor_inquiries') || '[]');
    existing.push({ ...form, timestamp: new Date().toISOString() });
    kernelStorage.setItem('investor_inquiries', JSON.stringify(existing));
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen">
      <SEOMeta
        title="Invest in NovAura — Creator Economy Opportunity"
        description="Explore investment opportunities in NovAura, the ethical creator ecosystem building the future of digital creation."
        keywords={['invest NovAura', 'creator economy', 'startup investment', 'digital marketplace']}
        url="https://novaura.life/investors"
      />

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pb-28">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-violet/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-violet/10 border border-neon-violet/30 mb-6"
          >
            <TrendingUp className="w-3 h-3 text-neon-violet" />
            <span className="text-[10px] text-neon-violet font-bold uppercase tracking-widest">Investor Relations</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
          >
            <span className="text-text-primary">Invest in the </span>
            <span className="text-neon-violet">Creator Economy</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary text-lg max-w-2xl mx-auto"
          >
            NovAura is building the ethical infrastructure for digital creators — marketplace,
            hosting, AI tools, and a full desktop OS, all under one ecosystem.
          </motion.p>
        </div>
      </section>

      {/* Live Traction */}
      <section className="py-12 bg-void-light/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: 'Digital Assets', value: stats.assets || '0', icon: Package },
              { label: 'Creators', value: stats.creators || '0', icon: Users },
              { label: 'Services', value: '20+', icon: Globe },
              { label: 'Revenue Streams', value: '6', icon: DollarSign },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="p-4"
                >
                  <Icon className="w-6 h-6 text-neon-violet mx-auto mb-2" />
                  <p className="font-heading text-2xl font-bold text-neon-cyan">{stat.value}</p>
                  <p className="text-text-secondary text-sm">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Revenue Model */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Revenue <span className="text-neon-cyan">Model</span>
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Multiple diversified revenue streams across the ecosystem
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {REVENUE_STREAMS.map((stream, i) => {
              const Icon = stream.icon;
              return (
                <motion.div
                  key={stream.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="p-5 rounded-xl bg-void-light border border-white/5"
                >
                  <div className={`w-10 h-10 rounded-lg bg-${stream.color}/10 flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 text-${stream.color}`} />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">{stream.name}</h3>
                  <p className="text-sm text-text-secondary">{stream.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-16 lg:py-24 bg-void-light/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              <span className="text-neon-lime">Roadmap</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROADMAP.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-xl bg-void-light border border-white/5 hover:border-neon-cyan/20 transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg bg-${item.color}/10 flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 text-${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                  <p className="text-sm text-text-secondary">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interest Form */}
      <section className="py-16 lg:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="font-heading text-3xl font-bold text-text-primary mb-4">
              Express <span className="text-neon-violet">Interest</span>
            </h2>
            <p className="text-text-secondary">
              Interested in the NovAura opportunity? Let's start a conversation.
            </p>
          </motion.div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-8 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl"
            >
              <Rocket className="w-12 h-12 text-neon-cyan mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-primary mb-2">Thank you for your interest!</h3>
              <p className="text-text-secondary">We'll review your inquiry and get back to you shortly.</p>
              <Link to="/" className="inline-block mt-4">
                <Button variant="outline" className="border-neon-cyan/30 text-neon-cyan">
                  Back to Home <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Name</label>
                  <Input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="bg-void-light border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Email</label>
                  <Input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@email.com"
                    className="bg-void-light border-white/10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Investment Range</label>
                <Input
                  value={form.range}
                  onChange={e => setForm(f => ({ ...f, range: e.target.value }))}
                  placeholder="e.g. $10K - $50K"
                  className="bg-void-light border-white/10"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Message</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us about your interest in NovAura..."
                  rows={4}
                  className="w-full rounded-md bg-void-light border border-white/10 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/50"
                />
              </div>
              <Button type="submit" className="w-full bg-neon-violet hover:bg-neon-violet/90 text-white font-semibold py-6">
                <Send className="w-4 h-4 mr-2" /> Submit Inquiry
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
