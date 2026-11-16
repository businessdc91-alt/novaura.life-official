import { 
  Server, Globe, Shield, Zap, ArrowRight, Check, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const features = [
  { icon: Shield, title: 'Free SSL & HTTPS', desc: 'Automatic security certificates' },
  { icon: Globe, title: 'Global Edge CDN', desc: 'Lightning-fast worldwide delivery' },
  { icon: Zap, title: 'One-Click Deploy', desc: 'Launch in seconds, not hours' },
];

const hostingTiers = [
  { 
    name: 'Starter', 
    price: '$14.99', 
    desc: 'Perfect for personal sites and portfolios', 
    features: [
      '10GB SSD Storage', 
      '250GB/mo Bandwidth', 
      'Free SSL Certificate', 
      'Standard Support'
    ] 
  },
  { 
    name: 'Pro', 
    price: '$29.99', 
    desc: 'For professional creators and growing businesses', 
    features: [
      '50GB SSD Storage', 
      '1TB/mo Bandwidth', 
      'Free SSL Certificates', 
      'Priority 24/7 Support',
      'DDoS Protection & Firewall'
    ] 
  },
  { 
    name: 'Business', 
    price: '$69.99', 
    desc: 'Enterprise-grade performance for high-traffic apps', 
    features: [
      '200GB NVMe Storage', 
      'Unlimited Bandwidth', 
      'Free Wildcard SSL', 
      'Dedicated Account Manager',
      'Hourly Backups & Redundancy'
    ] 
  },
];

const hostingProviders = [
  { 
    name: 'Cloudflare', 
    role: 'CDN & DNS',
    desc: 'Global edge network, free SSL',
    cost: 'Free tier',
    signup: 'https://dash.cloudflare.com/sign-up',
    api: 'https://dash.cloudflare.com/profile/api-tokens'
  },
  { 
    name: 'Vercel', 
    role: 'Static Hosting',
    desc: 'Next.js, React, JAMstack',
    cost: 'Free tier (100GB)',
    signup: 'https://vercel.com/signup',
    api: 'https://vercel.com/account/tokens'
  },
  { 
    name: 'DigitalOcean', 
    role: 'Full Servers',
    desc: 'VPS, WordPress, databases',
    cost: '$4/mo starting',
    signup: 'https://cloud.digitalocean.com/registrations/new',
    api: 'https://cloud.digitalocean.com/account/api/tokens'
  },
  { 
    name: 'Supabase', 
    role: 'Database & Auth',
    desc: 'PostgreSQL, auth, storage',
    cost: 'Free tier (500MB)',
    signup: 'https://supabase.com/dashboard/sign-up',
    api: 'https://supabase.com/dashboard/account/tokens'
  },
];

const domainRegistrars = [
  { 
    name: 'Cloudflare Registrar', 
    cost: 'At-cost pricing',
    deposit: 'No minimum',
    signup: 'https://www.cloudflare.com/partners/',
    best: 'Lowest prices'
  },
  { 
    name: 'ResellerClub', 
    cost: 'Wholesale rates',
    deposit: '$100 minimum',
    signup: 'https://manage.resellerclub.com',
    best: '700+ TLDs'
  },
  { 
    name: 'Namecheap', 
    cost: 'Competitive rates',
    deposit: 'No deposit',
    signup: 'https://www.namecheap.com/partners/',
    best: 'Easy approval'
  },
];

export default function HostingPlansPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="grid lg:grid-cols-2 gap-12 items-center py-12">
        <div>
          <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan mb-4 uppercase tracking-widest text-[10px]">
            Hosting Infrastructure
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">
            Launch in seconds.<br />
            <span className="text-text-secondary">Scale without limits.</span>
          </h1>
          <p className="text-lg text-text-secondary mb-8">
            From static sites to full-stack apps—deploy with SSL, CDN, and caching included. 
            Our hosting scales with your paid tier.
          </p>
          
          <div className="space-y-4 mb-8">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-neon-cyan" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">{feature.title}</h4>
                  <p className="text-sm text-text-secondary">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button className="bg-neon-cyan text-void font-bold hover:shadow-glow-cyan">
            Explore Hosting <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="relative">
          <div className="rounded-3xl w-full h-[400px] bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 border border-white/10 flex items-center justify-center">
            <Server className="w-32 h-32 text-neon-cyan/30" />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-void/80 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <Card className="backdrop-blur-md border-white/10 bg-void-light/90">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm">All systems operational</span>
                </div>
                <span className="font-mono text-sm text-neon-cyan">99.99% uptime</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Hosting Tiers */}
      <section className="py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold font-heading mb-2">Hosting Plans</h2>
          <p className="text-text-secondary">Choose the plan that fits your needs</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {hostingTiers.map((tier) => (
            <Card key={tier.name} className="bg-void-light border-white/10">
              <CardContent className="p-6">
                <h4 className="font-heading font-semibold text-lg mb-1">{tier.name}</h4>
                <p className="text-sm text-text-secondary mb-4">{tier.desc}</p>
                <p className="font-heading font-bold text-3xl text-neon-cyan mb-2">{tier.price}<span className="text-sm font-normal opacity-60">/mo</span></p>
                <div className="space-y-2 mb-6">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full bg-neon-cyan text-void font-bold hover:shadow-glow-cyan">
                  Select Plan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Domain Registration Note */}
      <div className="text-center text-sm text-text-secondary py-4">
        <p>Additional domains and premium TLDs (.com, .io, .dev, etc.) billed separately at standard retail rates.</p>
      </div>

      {/* Hosting Providers */}
      <section className="py-12">
        <h3 className="font-heading font-bold text-2xl mb-6 text-center">Our Hosting Infrastructure</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {hostingProviders.map((provider) => (
            <Card key={provider.name} className="bg-void-light border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-5 h-5 text-neon-cyan" />
                  <span className="font-semibold">{provider.name}</span>
                </div>
                <Badge variant="outline" className="text-xs mb-3">{provider.role}</Badge>
                <p className="text-sm text-text-secondary mb-2">{provider.desc}</p>
                <p className="text-xs text-green-400 mb-4">{provider.cost}</p>
                <div className="space-y-2">
                  <a 
                    href={provider.signup} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Sign Up <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </a>
                  <a 
                    href={provider.api} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      Get API Key <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Domain Registrar APIs */}
      <section className="py-8">
        <h3 className="font-heading font-bold text-xl mb-4 text-center">Domain Registrar APIs</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {domainRegistrars.map((registrar) => (
            <Card key={registrar.name} className="bg-void-light border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-neon-cyan" />
                  <span className="font-semibold text-sm">{registrar.name}</span>
                </div>
                <p className="text-xs text-green-400 mb-1">{registrar.cost}</p>
                <p className="text-xs text-text-secondary mb-3">{registrar.deposit}</p>
                <Badge variant="outline" className="text-xs mb-3">{registrar.best}</Badge>
                <a 
                  href={registrar.signup} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Apply Now <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
