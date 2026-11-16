import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Server, Cloud, Brain, Shield, Globe, Activity } from 'lucide-react';

interface SystemItem {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  icon: any;
  uptime: string;
}

const systems: SystemItem[] = [
  { id: 'aura-core', name: 'Aura Neural Bridge', status: 'operational', icon: Brain, uptime: '99.99%' },
  { id: 'marketplace', name: 'Marketplace Engine', status: 'operational', icon: Globe, uptime: '99.98%' },
  { id: 'catalyst-ledger', name: 'Catalyst Royalty Ledger', status: 'operational', icon: Activity, uptime: '100%' },
  { id: 'studio-nodes', name: 'Creator Studio Nodes', status: 'operational', icon: Server, uptime: '99.95%' },
  { id: 'high-compute', name: 'High-Compute Clusters', status: 'operational', icon: Cloud, uptime: '99.99%' },
  { id: 'security-mesh', name: 'Vault Security Mesh', status: 'operational', icon: Shield, uptime: '100%' },
];

const incidents = [
  { date: 'March 12, 2026', title: 'Scheduled Maintenance: Royalty Engine Optimization', type: 'maintenance', message: 'The royalty distribution engine underwent scheduled maintenance to integrate the new 10% platform fee logic.' },
  { date: 'March 1, 2026', title: 'Brief Latency in Asset Metadata Processing', type: 'resolved', message: 'A routing issue in the metadata cache caused 45 seconds of increased latency. Corrected automatically by failover systems.' },
];

export default function StatusPage() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Status Hero */}
          <div className="mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 rounded-3xl bg-void-light border border-neon-lime/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_50px_rgba(34,197,94,0.05)]"
            >
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 rounded-full bg-neon-lime/10 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                  <CheckCircle2 className="w-10 h-10 text-neon-lime" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-1">Systems Operational</h1>
                  <p className="text-text-muted text-sm uppercase tracking-tighter">All NovAura foundation nodes are healthy</p>
                </div>
              </div>
              <div className="px-6 py-2 bg-neon-lime/10 border border-neon-lime/30 rounded-full">
                <span className="text-neon-lime font-black text-xs uppercase tracking-widest">Live: March 13, 2026</span>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            {systems.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </div>

          {/* Incident History */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-8">
              <Clock className="w-5 h-5 text-text-muted" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Past Incidents & Maintenance</h2>
            </div>
            
            {incidents.map((incident, idx) => (
              <div key={idx} className="relative pl-8 border-l border-white/5 pb-8 last:pb-0">
                <div className={`absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-void ${incident.type === 'maintenance' ? 'bg-neon-cyan shadow-[0_0_10px_rgba(0,255,249,0.5)]' : 'bg-neon-lime shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`} />
                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1 font-bold">{incident.date}</p>
                <h3 className="text-text-primary font-bold mb-2">{incident.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">{incident.message}</p>
              </div>
            ))}
          </div>

          {/* Support CTA */}
          <div className="mt-20 text-center">
            <p className="text-text-muted text-xs uppercase tracking-[0.2em] mb-4">Experiencing an issue not listed here?</p>
            <a 
              href="/contact" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold hover:bg-white/10 transition-all uppercase text-xs tracking-widest"
            >
              Report a System Constraint
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemCard({ system }: { system: SystemItem }) {
  const Icon = system.icon;
  return (
    <div className="p-5 rounded-2xl bg-void-light border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon className="w-5 h-5 text-text-muted" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">{system.name}</h3>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-lime animate-pulse" />
            <span className="text-[10px] text-neon-lime uppercase font-black tracking-widest">Operational</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-text-muted uppercase tracking-tighter">Uptime</p>
        <p className="text-xs font-mono text-white/50">{system.uptime}</p>
      </div>
    </div>
  );
}
