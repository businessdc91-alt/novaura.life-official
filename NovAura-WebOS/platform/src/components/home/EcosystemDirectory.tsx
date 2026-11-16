import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag, Store, Globe, Server, Monitor, Mail,
  Gamepad2, Music, Image, Code2, Hammer, Brain,
  MessageSquare, MessagesSquare, HelpCircle, Phone,
  Info, Users, CreditCard, Brush,
} from 'lucide-react';

interface ServiceEntry {
  name: string;
  description: string;
  icon: typeof ShoppingBag;
  href: string;
  color: string;
  badge?: string;
}

const SERVICES: ServiceEntry[] = [
  { name: 'Marketplace', description: 'Browse & buy digital assets', icon: ShoppingBag, href: '/browse', color: 'neon-cyan' },
  { name: 'Shop', description: "Catalyst's Corner store", icon: Store, href: '/shop', color: 'neon-lime' },
  { name: 'NovaLow', description: 'Domains & Web Hosting', icon: Globe, href: '/novalow', color: 'neon-violet' },
  { name: 'Web OS', description: 'NovAura Desktop OS', icon: Monitor, href: '/', color: 'neon-magenta', badge: 'Beta' },
  { name: 'Email', description: '@novaura.life email', icon: Mail, href: '/email', color: 'neon-lime' },
  { name: 'Games', description: 'Play & publish games', icon: Gamepad2, href: '/games', color: 'neon-magenta' },
  { name: 'Music', description: 'Music marketplace', icon: Music, href: '/music', color: 'neon-violet' },
  { name: 'Gallery', description: 'Community artwork', icon: Image, href: '/gallery', color: 'neon-cyan' },
  { name: 'Software', description: 'Developer tools', icon: Code2, href: '/software', color: 'neon-lime' },
  { name: 'Nova IDE', description: 'Code editor & builder', icon: Hammer, href: '/ide', color: 'neon-cyan' },
  { name: 'Site Builder', description: 'Build & deploy sites', icon: Brush, href: '/builder', color: 'neon-violet' },
  { name: 'Strategist', description: 'AI business advisor', icon: Brain, href: '/strategist', color: 'neon-magenta' },
  { name: 'Community', description: 'Forums & discourse', icon: Users, href: '/hub', color: 'neon-lime' },
  { name: 'Nova Chat', description: 'AI-powered chat', icon: MessageSquare, href: '/chat', color: 'neon-cyan' },
  { name: 'Help Center', description: 'Support & FAQ', icon: HelpCircle, href: '/help', color: 'neon-violet' },
  { name: 'Contact', description: 'Reach the team', icon: Phone, href: '/contact', color: 'neon-magenta' },
  { name: 'About', description: 'Our mission & story', icon: Info, href: '/about', color: 'neon-cyan' },
  { name: 'Investors', description: 'Investment opportunities', icon: CreditCard, href: '/investors', color: 'neon-violet' },
  { name: 'Pricing', description: 'Subscription plans', icon: MessagesSquare, href: '/pricing', color: 'neon-lime' },
];

export default function EcosystemDirectory() {
  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            The NovAura <span className="text-gradient-rgb animate-gradient">Ecosystem</span>
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Everything you need to create, publish, and grow — all in one place
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {SERVICES.map((service, i) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.href}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
              >
                {service.href.startsWith('http') ? (
                  <a
                    href={service.href}
                    className="group block bg-void-light border border-white/5 rounded-xl p-5 text-center card-hover relative"
                  >
                     {service.badge && (
                      <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-${service.color}/20 text-${service.color} border border-${service.color}/30`}>
                        {service.badge}
                      </span>
                    )}
                    <div className={`w-11 h-11 mx-auto mb-3 rounded-lg bg-${service.color}/10 flex items-center justify-center group-hover:bg-${service.color}/20 transition-colors`}>
                      <Icon className={`w-5 h-5 text-${service.color}`} />
                    </div>
                    <h3 className="font-medium text-text-primary text-sm mb-0.5 group-hover:text-neon-cyan transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-text-muted text-[11px] leading-tight">
                      {service.description}
                    </p>
                  </a>
                ) : (
                  <Link
                    to={service.href}
                    className="group block bg-void-light border border-white/5 rounded-xl p-5 text-center card-hover relative"
                  >
                    {service.badge && (
                      <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-${service.color}/20 text-${service.color} border border-${service.color}/30`}>
                        {service.badge}
                      </span>
                    )}
                    <div className={`w-11 h-11 mx-auto mb-3 rounded-lg bg-${service.color}/10 flex items-center justify-center group-hover:bg-${service.color}/20 transition-colors`}>
                      <Icon className={`w-5 h-5 text-${service.color}`} />
                    </div>
                    <h3 className="font-medium text-text-primary text-sm mb-0.5 group-hover:text-neon-cyan transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-text-muted text-[11px] leading-tight">
                      {service.description}
                    </p>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
