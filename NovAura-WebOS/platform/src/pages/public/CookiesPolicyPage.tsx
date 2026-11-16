import { motion } from 'framer-motion';
import { Eye, Shield, Database, Cookie, Lock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CookiesPolicyPage() {
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
              <Cookie className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Cookies & Tracking
            </h1>
            <p className="text-text-secondary">
              How we use digital signatures to maintain your experience.
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 space-y-8"
          >
            <Section icon={Database} title="What are Cookies?">
              <p className="text-text-secondary">
                Cookies are small text files stored in your "Digital Shell" (browser) that allow NovAura to recognize 
                you and keep your creative session alive. We prioritize privacy-first tracking.
              </p>
            </Section>

            <Section icon={Shield} title="Essential Cookies">
              <p className="text-text-secondary mb-4">
                These are mandatory for the platform to function. They cannot be disabled:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li><strong>Soul Binding:</strong> Maintains your authenticated session and cross-page navigation.</li>
                <li><strong>Economy Ledger:</strong> Tracks your current Consciousness Coin balance for real-time AI spending.</li>
                <li><strong>Security Tokens:</strong> Prevents unauthorized access to your Creator Dashboard.</li>
              </ul>
            </Section>

            <Section icon={Eye} title="Preference & Personalization">
              <p className="text-text-secondary">
                We use cookies to remember your AI brain configurations (Gemini vs. Local nodes), your preferred layout states 
                (Extended vs. Shrunk messenger), and your marketplace filtering settings.
              </p>
            </Section>

            <Section icon={Lock} title="Third-Party Cookies">
              <p className="text-text-secondary">
                NovAura minimizes third-party scripts. We currently only use necessary cookies from our financial partner, 
                Polsia, to facilitate secure payments and royalty distributions. We do NOT use invasive advertising trackers.
              </p>
            </Section>

            <div className="border-t border-white/10 pt-8 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  Managing Choice
                </h3>
                <p className="text-text-secondary text-sm">
                  You can clear your cookies anytime through your browser settings.
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
