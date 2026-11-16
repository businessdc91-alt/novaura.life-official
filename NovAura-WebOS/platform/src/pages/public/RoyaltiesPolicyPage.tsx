import { motion } from 'framer-motion';
import { Coins, Scale, Zap, ShieldCheck, HeartPulse, ExternalLink, Music } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RoyaltiesPolicyPage() {
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-16 h-16 rounded-full bg-neon-cyan/10 flex items-center justify-center mx-auto mb-4">
              <Coins className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              The Pure-Creator Economy
            </h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Transparent, automated, and ethical revenue distribution for the next generation of creative builders.
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 space-y-12"
          >
            {/* Platform Fee */}
            <Section icon={ShieldCheck} title="1. Platform Maintenance Stake">
              <p className="text-text-secondary mb-4">
                To sustain the high-fidelity infrastructure, neural compute (Aura), and global hosting, NovAura applies 
                a flat <span className="text-neon-cyan font-bold">10% Platform Fee</span> to all marketplace sales. 
                This fee is deducted before any royalty distributions, ensuring the ecosystem remains healthy and autonomous.
              </p>
            </Section>

            {/* Fair Stake System */}
            <Section icon={Scale} title="2. The Scaling Royalty System">
              <p className="text-text-secondary mb-4">
                We believe in honoring the foundation. When you build upon an existing asset, the original 
                creator(s) receive a small percentage of every sale of your derivative work.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TierCard 
                  title="Logic & Logic" 
                  value="15 - 20%" 
                  desc="Complex systems and AI behavioral nodes."
                />
                <TierCard 
                  title="Visual Assets" 
                  value="3 - 10%" 
                  desc="3D models, textures, and interface components."
                />
                <TierCard 
                  title="Music & Audio" 
                  value="1%" 
                  icon={Music}
                  desc="Atmospheric scores and sound effects."
                />
                <TierCard 
                  title="Guaranteed Stake" 
                  value="Min. 50%" 
                  desc="The current publisher is always guaranteed the majority share."
                />
              </div>
              <p className="text-[10px] text-text-muted mt-4 italic">
                *If total foundations exceed 50%, all royalties are proportionally scaled down to maintain the 50% creator guarantee.
              </p>
            </Section>

            {/* Consciousness Coins */}
            <Section icon={HeartPulse} title="3. Consciousness Coins & AI">
              <p className="text-text-secondary mb-4">
                Consciousness Coins represent your link to Aura. While standard chat is <span className="text-neon-cyan font-bold">free of charge</span> 
                (up to a generous daily interaction limit), coins are utilized for advanced operations:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm text-text-secondary">
                <li>Deploying live smart-contracts for royalties.</li>
                <li>Executing high-compute neural tasks in the Website Builder.</li>
                <li>Acquiring exclusive legacy badges like the "Green P-hat".</li>
              </ul>
            </Section>

            {/* Instant distribution */}
            <Section icon={Zap} title="4. Automated Governance">
              <p className="text-text-secondary">
                All payouts are processed by the Catalyst (Polsia) using internal ledger logic. No manual 
                invoicing is required. When a sale occurs, the pot is split instantly: 
                <span className="italic"> 10% Treasury {'->'} X% Foundations {'->'} Remainder to Publisher.</span>
              </p>
            </Section>

            <div className="border-t border-white/10 pt-8 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  Ethical Commerce
                </h3>
                <p className="text-text-secondary text-sm">
                  Built for creators, by creators.
                </p>
              </div>
              <Link
                to="/hub"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neon-cyan text-void hover:scale-[1.02] transition-all font-bold group"
              >
                Start Creating
                <ExternalLink className="w-4 h-4 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 pb-8 last:border-0 border-none">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-neon-cyan" />
        </div>
        <h2 className="font-heading text-xl font-bold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function TierCard({ title, value, desc, icon: Icon }: { title: string; value: string; desc: string; icon?: any }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-neon-cyan/20 transition-all group relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{title}</h4>
        {Icon && <Icon className="w-3.5 h-3.5 text-neon-magenta opacity-50" />}
      </div>
      <div className="text-2xl font-black text-neon-cyan group-hover:scale-105 transition-transform origin-left">{value}</div>
      <p className="text-[10px] text-text-secondary mt-1 leading-tight">{desc}</p>
    </div>
  );
}
