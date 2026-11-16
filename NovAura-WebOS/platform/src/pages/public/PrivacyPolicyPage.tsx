import { motion } from 'framer-motion';
import { Shield, Lock, Eye, Database, Globe, Mail } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
              <Shield className="w-8 h-8 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Privacy Policy
            </h1>
            <p className="text-text-secondary">
              Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 space-y-8"
          >
            <Section icon={Eye} title="Information We Collect">
              <p className="text-text-secondary mb-4">
                NovAura Market collects the following types of information to provide and improve our services:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li><strong>Account Information:</strong> Email address, username, profile information</li>
                <li><strong>Transaction Data:</strong> Purchase history, license agreements, payment records</li>
                <li><strong>Asset Data:</strong> Uploaded files, descriptions, pricing, and metadata</li>
                <li><strong>Usage Data:</strong> Downloads, views, and platform interactions</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
              </ul>
            </Section>

            <Section icon={Lock} title="How We Use Your Information">
              <p className="text-text-secondary mb-4">
                We use your information for the following purposes:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li>Provide and maintain the NovAura Market platform</li>
                <li>Process transactions and maintain license records</li>
                <li>Facilitate royalty payments between creators and purchasers</li>
                <li>Send important notifications about your account and transactions</li>
                <li>Improve platform functionality and user experience</li>
                <li>Prevent fraud and ensure platform security</li>
                <li>Comply with legal obligations</li>
              </ul>
            </Section>

            <Section icon={Database} title="Data Storage & Security">
              <p className="text-text-secondary mb-4">
                We take data security seriously:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li>All data is encrypted in transit using TLS/SSL</li>
                <li>Sensitive data is encrypted at rest</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and authentication required for all data access</li>
                <li>Regular backups with secure storage</li>
              </ul>
              <p className="text-text-secondary mt-4">
                <strong>Note:</strong> While we implement strong security measures, no system is 100% secure. 
                Users are responsible for maintaining the security of their account credentials.
              </p>
            </Section>

            <Section icon={Globe} title="Data Sharing & Third Parties">
              <p className="text-text-secondary mb-4">
                We do not sell your personal information. We may share data with:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li><strong>Payment Processors:</strong> To facilitate transactions (Stripe, etc.)</li>
                <li><strong>Cloud Providers:</strong> For hosting and storage services</li>
                <li><strong>Legal Authorities:</strong> When required by law or court order</li>
                <li><strong>Creators:</strong> Purchase and license information for royalty purposes</li>
              </ul>
              <p className="text-text-secondary mt-4">
                All third-party providers are bound by confidentiality agreements and data protection requirements.
              </p>
            </Section>

            <Section icon={Mail} title="Your Rights">
              <p className="text-text-secondary mb-4">
                You have the following rights regarding your data:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data (subject to legal retention requirements)</li>
                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              </ul>
              <p className="text-text-secondary mt-4">
                To exercise these rights, contact us at{' '}
                <a href="mailto:Dillan.Copeland@Novauraverse.com" className="text-neon-cyan hover:underline">
                  Dillan.Copeland@Novauraverse.com
                </a>
              </p>
            </Section>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-heading text-xl font-bold text-text-primary mb-4">
                Cookies & Tracking
              </h3>
              <p className="text-text-secondary">
                We use cookies and similar technologies to maintain your session, remember preferences, 
                and analyze platform usage. You can control cookies through your browser settings. 
                Disabling cookies may affect platform functionality.
              </p>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-heading text-xl font-bold text-text-primary mb-4">
                Children's Privacy
              </h3>
              <p className="text-text-secondary">
                NovAura Market is not intended for children under 13. We do not knowingly collect 
                personal information from children under 13. If you believe we have collected such 
                information, please contact us immediately.
              </p>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-heading text-xl font-bold text-text-primary mb-4">
                Changes to This Policy
              </h3>
              <p className="text-text-secondary">
                We may update this Privacy Policy from time to time. We will notify users of significant 
                changes via email or platform notification. Continued use of the platform after changes 
                constitutes acceptance of the updated policy.
              </p>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-heading text-xl font-bold text-text-primary mb-4">
                Contact Us
              </h3>
              <p className="text-text-secondary">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="mt-4 space-y-2 text-text-secondary">
                <p>Email: <a href="mailto:Dillan.Copeland@Novauraverse.com" className="text-neon-cyan hover:underline">Dillan.Copeland@Novauraverse.com</a></p>
                <p>Personal: <a href="mailto:the.lost.catalyst@gmail.com" className="text-neon-cyan hover:underline">the.lost.catalyst@gmail.com</a></p>
                <p>Phone: (701) 715-8674</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Shield; title: string; children: React.ReactNode }) {
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
