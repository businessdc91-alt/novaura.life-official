import { Link } from 'react-router-dom';
import { Sparkles, Twitter, Github, MessageCircle, ExternalLink, ShoppingBag } from 'lucide-react';

const footerLinks = {
  Marketplace: [
    { label: 'Browse All', href: '/browse' },
    { label: 'Games', href: '/games' },
    { label: 'Music', href: '/music' },
    { label: 'Software', href: '/software' },
    { label: 'Gallery', href: '/gallery' },
    { label: 'NovaLow', href: '/novalow' },
  ],
  Creators: [
    { label: 'Become a Creator', href: '/signup' },
    { label: 'Creator Dashboard', href: '/creator/dashboard' },
    { label: 'Upload Asset', href: '/creator/assets/new' },
    { label: 'Earnings', href: '/creator/earnings' },
  ],
  Protocol: [
    { label: 'Domain Search', href: '/novalow' },
    { label: 'Security', href: '/novalow/security' },
    { label: 'Dev Tools', href: '/novalow/devtools' },
    { label: 'Tutorials', href: '/novalow/tutorials' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Investors', href: '/investors' },
    { label: 'Contact', href: '/contact' },
    { label: 'Community', href: '/hub' },
  ],
  Support: [
    { label: 'Help Center', href: '/help' },
    { label: 'Status', href: '/status' },
    { label: 'Changelog', href: '/changelog' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Service', href: '/legal/terms' },
    { label: 'License Terms', href: '/legal/agreement' },
    { label: 'Royalties & Economy', href: '/legal/royalties' },
    { label: 'Creator Terms', href: '/legal/creator-terms' },
    { label: 'Cookies Policy', href: '/legal/cookies' },
  ],
};

const socialLinks = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: MessageCircle, href: '#', label: 'Discord' },
  { icon: Github, href: '#', label: 'GitHub' },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-void-light">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img
                src="/logo.png"
                alt="NovAura"
                className="w-6 h-6 object-contain"
              />
              <span className="font-heading text-xl font-bold text-gradient-rgb">
                NovAura
              </span>
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed mb-6 max-w-sm">
              The ethical marketplace for creators. Build worlds, buy the pieces, 
              keep creators credited with fair royalties.
            </p>
            
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-heading text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-text-secondary text-sm hover:text-neon-cyan transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Partner Stores Banner */}
        <div className="mt-10 p-5 rounded-2xl bg-gradient-to-r from-neon-cyan/5 via-neon-magenta/5 to-neon-lime/5 border border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-neon-magenta" />
              <div>
                <p className="text-text-primary text-sm font-heading font-semibold">
                  Home wares & tech items galore? Look no further than right next door!
                </p>
                <p className="text-text-secondary text-xs mt-0.5">
                  Check out our other great products at Catalyst's Corner
                </p>
              </div>
            </div>
            <a
              href="https://catalysts-corner.myshopify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta text-sm font-semibold hover:bg-neon-magenta/20 transition-all whitespace-nowrap"
            >
              Visit Store <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            © 2026 NovAura Market. All rights reserved.
          </p>
          
          <div className="flex items-center gap-6">
            <Link to="/legal/privacy" className="text-text-muted text-sm hover:text-text-secondary transition-colors">
              Privacy
            </Link>
            <Link to="/legal/terms" className="text-text-muted text-sm hover:text-text-secondary transition-colors">
              Terms
            </Link>
            <Link to="/changelog" className="text-text-muted text-sm hover:text-text-secondary transition-colors">
              Changelog
            </Link>
            <Link to="/contact" className="text-text-muted text-sm hover:text-text-secondary transition-colors">
              Contact
            </Link>
            <Link to="/staff-login" className="text-text-muted/40 text-sm hover:text-text-muted transition-colors">
              Staff Login
            </Link>
          </div>
        </div>

        {/* Legal Disclaimer & Staff Policy */}
        <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
            <div className="p-4 rounded-xl bg-void border border-white/5">
              <div className="flex justify-center mb-4">
                <div className="px-6 py-2 bg-neon-lime/10 border border-neon-lime/30 rounded-full">
                  <span className="text-neon-lime font-black text-xs uppercase tracking-widest">Live: March 13, 2026</span>
                </div>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed text-center italic">
                <span className="text-text-secondary font-bold uppercase tracking-widest block mb-2">Legal Liability Disclaimer</span>
                NovAura acts as an ethical facilitator for digital expression. We are not responsible for the individual actions of creators or the use/submissions of their content outside of our ecosystem boundaries. 
                All assets and publicly posted media are subject to human-review. We strictly prohibit illegal or unconsenting content.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10">
              <div className="flex justify-center mb-4">
                <div className="px-6 py-2 bg-neon-cyan/10 border border-neon-cyan/30 rounded-full">
                  <span className="text-neon-cyan font-black text-xs uppercase tracking-widest">Expansion Protocol</span>
                </div>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed text-center font-medium italic">
                <span className="text-neon-cyan font-bold uppercase tracking-widest block mb-2">Notice of Continuous Evolution</span>
                The NovAura ecosystem is in a state of rapid expansion. Multiple new features and overhauls are being made every week. The features and capabilities will continue to expand, so please forgive any short comings and please let us know what needs to be improved upon for your next visit!
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-text-muted/60 text-xs">
              Aetherium & NovAura visual identity, site art and graphics by{' '}
              <span className="text-neon-cyan/80 font-medium">KIMI 2.5</span> — 
              Websites & Argentic Swarm Capabilities Through Articulation
            </p>
            <p className="text-text-muted/40 text-xs mt-1">
              "World class artist delivering character-consistent, theme-consistent style" — Founder
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
