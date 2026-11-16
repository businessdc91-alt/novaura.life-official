import { motion } from 'framer-motion';
import { Package, ShieldCheck, Globe, Zap, FileCode, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AssetAgreementPage() {
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
              <Package className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Asset License Agreement
            </h1>
            <p className="text-text-secondary">
              Terms for the use of digital assets acquired on NovAura.
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 space-y-8"
          >
            <Section icon={ShieldCheck} title="Standard License Grant">
              <p className="text-text-secondary mb-4">
                Unless otherwise specified, all assets purchased on NovAura grant a perpetual, worldwide, non-exclusive 
                right to use the asset in your own creative projects.
              </p>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <h4 className="text-neon-cyan font-bold text-sm uppercase">Permitted Use</h4>
                  <ul className="mt-2 space-y-1 text-sm text-text-secondary list-disc pl-5">
                    <li>Integration into video games, films, and digital media.</li>
                    <li>Modification to fit the artistic style of your project.</li>
                    <li>Distribution as part of a compiled software product.</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                  <h4 className="text-red-400 font-bold text-sm uppercase">Prohibited Use</h4>
                  <ul className="mt-2 space-y-1 text-sm text-text-secondary list-disc pl-5">
                    <li>Re-selling the asset as a standalone file or in a library.</li>
                    <li>Sub-licensing the asset to other parties.</li>
                    <li>Using the asset in AI training datasets without explicit Creator Pro permission.</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section icon={FileCode} title="The 'Foundation' Requirement">
              <p className="text-text-secondary">
                Certain high-fidelity assets are "Foundation Bound." This means their license is non-transferable and 
                requires a registered NovAura Soul (account) to validate its provenance within a digital environment. 
                Tampering with foundation metadata is a breach of this agreement.
              </p>
            </Section>

            <Section icon={Globe} title="Intellectual Property">
              <p className="text-text-secondary">
                Purchasing an asset license does NOT transfer the copyright. The original creator retains ownership of 
                the underlying IP, while the buyer receives the rights to implement and deploy the asset.
              </p>
            </Section>

            <Section icon={Zap} title="Fair Use in Social Space">
              <p className="text-text-secondary">
                Assets acquired on NovAura can be shared and showcased within the NovAura World Feed without 
                violating distribution terms, provided the original creator's badge is visible or the asset is linked.
              </p>
            </Section>

            <div className="border-t border-white/10 pt-8 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  License ID
                </h3>
                <p className="text-text-secondary text-sm">
                  View your specific license tokens in your <Link to="/downloads" className="text-neon-cyan hover:underline">Vault</Link>.
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
