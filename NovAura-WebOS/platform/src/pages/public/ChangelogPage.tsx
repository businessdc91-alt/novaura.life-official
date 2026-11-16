import { motion } from 'framer-motion';
import { History, Zap, Sparkles, Code2, Globe, ShieldCheck, HeartPulse, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CHANGELOG_ENTRIES = [
  {
    phase: 10,
    title: "Legal & Support Foundation",
    date: "March 13, 2026",
    status: "Active Deployment",
    icon: ShieldCheck,
    color: "text-neon-cyan",
    items: [
      "Launched comprehensive Legal Portal (Terms, Royalties, Agreements).",
      "Implemented AI-Driven Support Flow via AuraGuide.",
      "Added global Navigation Ribbon and Back-button system.",
      "Integrated non-responsibility disclaimer for creator content."
    ]
  },
  {
    phase: 9,
    title: "User Roles & Professional Identity",
    date: "March 13, 2026",
    status: "Completed",
    icon: Sparkles,
    color: "text-neon-magenta",
    items: [
      "Introduced UserBadge system (Crown, Green P-hat, Dev, Creator).",
      "Deployed FloatingMessenger collapsible chat widget.",
      "Role-restricted chat channels (Creators Hub, Dev Sanctuary).",
      "Integrated legendary status for founder identities."
    ]
  },
  {
    phase: 7,
    title: "Social & Professional Ecosystem",
    date: "March 12, 2026",
    status: "Completed",
    icon: Globe,
    color: "text-blue-400",
    items: [
      "Launched World Feed with high-fidelity asset sharing.",
      "Created Ecosystem Hub for recruitment and professional discourse.",
      "Implemented robust social services with local persistence."
    ]
  },
  {
    phase: 6,
    title: "Economic Stabilization",
    date: "March 11, 2026",
    status: "Completed",
    icon: HeartPulse,
    color: "text-neon-lime",
    items: [
      "Transitioned from mock-seed data to production asset management.",
      "Implemented global scroll restoration and UX polish.",
      "Refactored marketplace services for scale."
    ]
  },
  {
    phase: 5,
    title: "AI Integration & Gating",
    date: "March 10, 2026",
    status: "Completed",
    icon: Code2,
    color: "text-purple-400",
    items: [
      "Developed AuraGuide AI orchestrator.",
      "Implemented Consciousness Coin economy (Daily Bonus + Usage costs).",
      "Created transaction ledger for transparent spending."
    ]
  }
];

export default function ChangelogPage() {
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
              <History className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Platform Changelog
            </h1>
            <p className="text-text-secondary">
              The evolution of the NovAura Digital Ecosystem.
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="space-y-12 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-px before:bg-white/5">
            {CHANGELOG_ENTRIES.map((entry, idx) => {
              const Icon = entry.icon;
              return (
                <motion.div
                  key={entry.phase}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative pl-16"
                >
                  {/* Phase Marker */}
                  <div className={`absolute left-0 top-0 w-16 h-16 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center z-10 shadow-xl`}>
                    <Icon className={`w-8 h-8 ${entry.color}`} />
                  </div>

                  <div className="bg-void-light border border-white/5 rounded-2xl p-6 shadow-2xl hover:border-neon-cyan/20 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${entry.color}`}>Phase {entry.phase}</span>
                        <h2 className="font-heading text-xl font-bold text-white group-hover:text-neon-cyan transition-colors">{entry.title}</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted font-bold uppercase">{entry.date}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan font-black uppercase">{entry.status}</span>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {entry.items.map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-text-secondary">
                          <Zap className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Nav */}
          <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-center">
            <Link
              to="/"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 text-text-primary hover:bg-white/10 transition-all font-bold group shadow-xl"
            >
              Back to Dashboard
              <ExternalLink className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
