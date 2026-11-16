import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Shield, Zap, Globe, Server, Send,
  ArrowRight, ChevronDown, ChevronUp, Inbox,
  UserCircle, Clock, CheckCircle2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOMeta } from '@/components/seo/SEOMeta';
import { mailService } from '@/services/mailService';
import type { MailAccount, EmailMessage } from '@/services/mailService';
import { useAuthStore } from '@/stores/authStore';
import { auth } from '../../config/firebase';

const FEATURES = [
  { icon: Mail, title: 'Custom @novaura.life Address', desc: 'Your own professional email on the NovAura domain', color: 'neon-cyan' },
  { icon: Shield, title: 'Spam Filtering', desc: 'Enterprise-grade spam and phishing protection', color: 'neon-violet' },
  { icon: Zap, title: 'SMTP & IMAP', desc: 'Full protocol support — use any email client', color: 'neon-lime' },
  { icon: Globe, title: 'Titan Webmail', desc: 'Powered by Titan Mail — check email from any browser', color: 'neon-magenta' },
  { icon: Server, title: 'Forwarding Rules', desc: 'Auto-forward to Gmail, Outlook, or any address', color: 'neon-cyan' },
  { icon: Send, title: 'Agentic Email', desc: 'Let Aura send emails on your behalf with approval', color: 'neon-violet' },
];

const FAQ = [
  {
    q: 'How do I get a @novaura.life email?',
    a: 'Sign up for any NovAura plan and visit your account settings to claim your email address. Creator tier and above get a custom alias.',
  },
  {
    q: 'Can I use it with Gmail or Outlook?',
    a: 'Yes — powered by Titan Mail with full SMTP/IMAP support. Add your @novaura.life account to Gmail, Outlook, Thunderbird, Apple Mail, or use Titan\'s webmail interface directly.',
  },
  {
    q: 'What is Agentic Email?',
    a: "Aura can draft and send emails on your behalf (with your approval). Great for automated responses, scheduled outreach, and AI-assisted communication.",
  },
  {
    q: 'Is my email data private?',
    a: 'Absolutely. Email data is stored securely and never used for training, advertising, or any purpose beyond delivering your messages.',
  },
];

export default function EmailServicesPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimedEmail, setClaimedEmail] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      setAccounts(mailService.getAccounts(user.id));
      setEmails(mailService.getEmails(user.id));

      auth?.currentUser?.getIdToken?.().then((token) => {
        if (token) {
          mailService.syncAccounts(user.id, token).then(setAccounts);
          mailService.syncEmails(user.id, token).then(setEmails);
        }
      }).catch(err => console.warn('[EmailServicesPage] Token sync error:', err));
    }
  }, [user]);

  const handleClaimEmail = async () => {
    setClaimError('');
    if (!claimedEmail.includes('@novaura.life')) {
      setClaimError('Email must end with @novaura.life');
      return;
    }
    const handle = claimedEmail.replace('@novaura.life', '').trim();
    if (!handle || !/^[a-zA-Z0-9._-]+$/.test(handle)) {
      setClaimError('Invalid handle format. Use only letters, numbers, dots, hyphens, and underscores.');
      return;
    }

    setClaimLoading(true);
    try {
      const token = await auth?.currentUser?.getIdToken?.();
      const res = await fetch('/api/email/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ handle })
      });
      const data = await res.json();
      if (data.success) {
        setClaimSuccess(true);
        if (token && user?.id) {
          mailService.syncAccounts(user.id, token).then(setAccounts);
        }
        setTimeout(() => {
          setShowClaimForm(false);
          setClaimSuccess(false);
          setClaimedEmail('');
        }, 2000);
      } else {
        setClaimError(data.error || 'Claim failed');
      }
    } catch (err) {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SEOMeta
        title="NovAura Email — @novaura.life Email Services"
        description="Get your own @novaura.life email address. Professional email with spam filtering, SMTP/IMAP support, and AI-powered features."
        keywords={['NovAura email', 'novaura.life', 'custom email', 'professional email', 'creator email']}
        url="https://novaura.life/email"
      />

      {/* Hero */}
      <section className="relative pt-32 pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-lime/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-6"
          >
            <Mail className="w-3 h-3 text-neon-cyan" />
            <span className="text-[10px] text-neon-cyan font-bold uppercase tracking-widest">Email Services</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold mb-4"
          >
            <span className="text-neon-cyan">@novaura.life</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary text-lg max-w-2xl mx-auto mb-8"
          >
            Your professional identity in the NovAura ecosystem. Custom email,
            full protocol support, and AI-powered features.
          </motion.p>

          {!isAuthenticated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-rgb text-void font-bold px-8 py-6 text-lg">
                  Get Your Email <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </motion.div>
          )}

          {/* Claim Email Form */}
          {isAuthenticated && accounts.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.3 }}
              className="max-w-md mx-auto bg-void-light border border-white/10 rounded-xl p-6"
            >
              {!showClaimForm ? (
                <>
                  <h3 className="text-xl font-bold text-white mb-2">Claim Your Email</h3>
                  <p className="text-text-secondary mb-4">
                    Get your own @novaura.life email address. Unlimited aliases included.
                  </p>
                  <Button 
                    onClick={() => setShowClaimForm(true)}
                    className="w-full bg-neon-cyan text-void font-bold"
                  >
                    Claim Email Address
                  </Button>
                </>
              ) : claimSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Email Claimed!</h3>
                  <p className="text-text-secondary">{claimedEmail} is now yours.</p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-4">Choose Your Address</h3>
                  <div className="space-y-4">
                    <div>
                      <Input
                        placeholder="username"
                        value={claimedEmail.replace('@novaura.life', '')}
                        onChange={(e) => setClaimedEmail(`${e.target.value}@novaura.life`)}
                        className="bg-void border-white/10"
                      />
                      <p className="text-sm text-text-muted mt-2">@novaura.life</p>
                    </div>
                    {claimError && (
                      <p className="text-xs text-red-400">{claimError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setShowClaimForm(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleClaimEmail} 
                        disabled={claimLoading}
                        className="flex-1 bg-neon-cyan text-void font-bold"
                      >
                        {claimLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Claiming...</>
                        ) : (
                          'Claim'
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </section>

      {/* Authenticated: Email Dashboard */}
      {user && accounts.length > 0 && (
        <section className="py-12 bg-void-light/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading text-2xl font-bold text-text-primary mb-6">
              <Inbox className="w-5 h-5 inline mr-2 text-neon-cyan" />
              Your Email Accounts
            </h2>

            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                <Inbox className="w-5 h-5 inline mr-2 text-neon-cyan" />
                Your Email Accounts
              </h2>
              <Link to="/webmail">
                <Button className="bg-neon-cyan text-void font-bold">
                  <Mail className="w-4 h-4 mr-2" /> Check Webmail
                </Button>
              </Link>
            </div>

            <div className="space-y-3 mb-8">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-4 p-4 bg-void-light border border-white/5 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium text-text-primary">{acc.email}</p>
                    <p className="text-xs text-text-muted">
                      {acc.provider.toUpperCase()} {acc.isCompanyAccount && '— Company Account'}
                    </p>
                  </div>
                  <div className="text-xs text-neon-cyan bg-neon-cyan/10 px-2 py-1 rounded">Active</div>
                </div>
              ))}
            </div>

            {emails.length > 0 && (
              <>
                <h3 className="font-heading text-lg font-bold text-text-primary mb-4">Recent Emails</h3>
                <div className="space-y-2">
                  {emails.slice(0, 5).map((email) => (
                    <div key={email.id} className="flex items-center gap-3 p-3 bg-void-light border border-white/5 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${email.status === 'received' ? 'bg-neon-cyan' : email.status === 'sent' ? 'bg-neon-lime' : 'bg-text-muted'}`} />
                      <div className="flex-grow min-w-0">
                        <p className="text-sm text-text-primary truncate">{email.subject}</p>
                        <p className="text-xs text-text-muted truncate">
                          {email.status === 'sent' ? `To: ${email.to}` : `From: ${email.from}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-text-muted shrink-0">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{new Date(email.createdAt).toLocaleDateString()}</span>
                      </div>
                      {email.isAgentic && (
                        <span className="text-[9px] bg-neon-violet/20 text-neon-violet px-1.5 py-0.5 rounded font-bold">AI</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Email <span className="text-neon-cyan">Features</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="p-5 rounded-xl bg-void-light border border-white/5 hover:border-neon-cyan/20 transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg bg-${feat.color}/10 flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 text-${feat.color}`} />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">{feat.title}</h3>
                  <p className="text-sm text-text-secondary">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24 bg-void-light/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="font-heading text-3xl font-bold text-text-primary mb-4">
              Frequently Asked <span className="text-neon-violet">Questions</span>
            </h2>
          </motion.div>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-white/5 rounded-xl overflow-hidden bg-void-light">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-medium text-text-primary text-sm">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-4 pb-4"
                  >
                    <p className="text-sm text-text-secondary leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
