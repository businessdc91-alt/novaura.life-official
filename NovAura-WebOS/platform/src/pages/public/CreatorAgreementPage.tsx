import { motion } from 'framer-motion';
import { Star, ShieldCheck, PenTool, Search, Rocket, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CreatorAgreementPage() {
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
              <Star className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Creator Master Agreement
            </h1>
            <p className="text-text-secondary">
              The binding contract for all NovAura Creative Contributors.
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 space-y-8"
          >
            <Section icon={PenTool} title="Professional Candidacy">
              <p className="text-text-secondary">
                Applying to become a NovAura Creator is a professional commitment. By submitting an application, you 
                warrant that your portfolio is original and that you possess the legal right to all works showcased. 
                Fake portfolios or AI-slop masquerading as manual craft will result in immediate rejection and permanent 
                soul-blacklist.
              </p>
            </Section>

            <Section icon={Search} title="Staff Review Protocol">
              <p className="text-text-secondary mb-4">
                All submissions—both initial applications and individual asset uploads—undergo a rigorous manual review by 
                NovAura staff. We review for:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li>Technical fidelity and performance impact.</li>
                <li>Artistic consistency with the NovAura/Aetherium visual identity.</li>
                <li>Legal compliance and provenance verification.</li>
                <li>Consenting content status (strict prohibition of illegal/unconsenting media).</li>
              </ul>
            </Section>

            <Section icon={ShieldCheck} title="Liability & Representation">
              <p className="text-text-secondary">
                Creators are solely responsible for the content they publish. You agree to indemnify NovAura against any 
                legal claims arising from your submissions. We provide the ecosystem; you provide the soul. We are not 
                liable for your content's use outside our boundaries.
              </p>
            </Section>

            <Section icon={Rocket} title="The 'Creator Pro' Status">
              <p className="text-text-secondary">
                Achieving "Creator Pro" status grants you the right to participate in the Smart Royalty secondary market. 
                This status is a privilege, maintained through consistent adherence to our professional and ethical 
                guidelines.
              </p>
            </Section>

            <div className="border-t border-white/10 pt-8 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  Ready to Apply?
                </h3>
                <p className="text-text-secondary text-sm">
                  Review our <Link to="/legal/royalties" className="text-neon-cyan hover:underline">Royalties Policy</Link> first.
                </p>
              </div>
              <Link
                to="/signup"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neon-cyan text-void hover:scale-[1.02] transition-all font-bold group"
              >
                Join the Creator Ranks
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
