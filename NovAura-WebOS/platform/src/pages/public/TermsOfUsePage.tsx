import { motion } from 'framer-motion';
import { Gavel, AlertTriangle, UserCheck, ShieldAlert, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfUsePage() {
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
              <Gavel className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Terms of Use
            </h1>
            <p className="text-text-secondary">
              Guidelines for the NovAura Digital Ecosystem.
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 space-y-8"
          >
            <Section icon={ShieldAlert} title="Limitation of Liability">
              <p className="text-text-secondary mb-4">
                NovAura provides a marketplace for decentralized creation. While we review all public submissions, 
                we are not responsible for the actions of creators or the use of their content outside of the NovAura ecosystem.
              </p>
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Notice to All Users</p>
                <p className="text-text-secondary text-sm italic">
                  "NovAura is not responsible for creators or the use or submissions of their content outside of our ecosystem."
                </p>
              </div>
            </Section>

            <Section icon={UserCheck} title="Staff Review Policy">
              <p className="text-text-secondary">
                To maintain the highest ethical standards, every asset and piece of publicly posted media is reviewed by NovAura staff. 
                Our team ensures that no illegal or unconsenting content is published in any way on this platform. This is a manual-first 
                moderation process to ensure human-centric safety.
              </p>
            </Section>

            <Section icon={AlertTriangle} title="Prohibited Content">
              <p className="text-text-secondary mb-4">
                The following is strictly forbidden and will result in immediate permanent soul-ban (account termination):
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li>Unconsenting media or derivatives.</li>
                <li>Content that violates international copyright laws.</li>
                <li>Hate speech or promotion of illegal activity.</li>
                <li>Malicious code, scripts, or "web-shrapnel" within downloadable assets.</li>
              </ul>
            </Section>

            <Section icon={FileText} title="Account & Soul-Binding">
              <p className="text-text-secondary">
                Your account is your "Soul" within the digital realm. You are responsible for maintaining the security of your 
                access keys. Multiple accounts for a single entity (sybil attacks) are prohibited during community governance cycles.
              </p>
            </Section>

            <div className="border-t border-white/10 pt-8 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  Soul Ledger
                </h3>
                <p className="text-text-secondary text-sm">
                  Last updated by the Catalyst on March 13, 2026.
                </p>
              </div>
              <Link
                to="/"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-text-primary hover:bg-white/10 transition-all font-bold group"
              >
                Return Home
                <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
    <div className="border-b border-white/5 pb-8 last:border-0">
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
