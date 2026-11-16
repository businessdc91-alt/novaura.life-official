import { 
  Shield, Lock, Server, Cloud, Zap, Key, 
  Check, Globe
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const securityFeatures = [
  { icon: Shield, title: 'DDoS Protection', desc: 'Mitigate attacks automatically' },
  { icon: Lock, title: 'Malware Scanning', desc: 'Continuous threat detection' },
  { icon: Server, title: 'Auto Backups', desc: 'Daily snapshots included' },
];

const detailedFeatures = [
  { icon: Lock, title: 'Free SSL Certificates', desc: 'Auto-provisioned Let\'s Encrypt certificates for all domains. Zero config required.' },
  { icon: Shield, title: 'DDoS Protection', desc: 'Cloudflare-powered protection against attacks of all sizes. 99% of attacks blocked free.' },
  { icon: Server, title: 'Daily Backups', desc: 'Automatic daily snapshots with 30-day retention. One-click restore anytime.' },
  { icon: Cloud, title: 'Global CDN', desc: 'Content cached at 300+ edge locations worldwide. Sub-50ms response times.' },
  { icon: Zap, title: 'WAF Protection', desc: 'Web Application Firewall blocks common attacks like SQL injection and XSS.' },
  { icon: Key, title: 'DNSSEC', desc: 'Domain Name System Security Extensions protect against DNS spoofing.' },
];

const howItWorksSteps = [
  { 
    icon: Key, 
    title: 'Free SSL Certificates', 
    desc: 'We use Let\'s Encrypt to automatically provision and renew SSL certificates for every domain. Zero config, zero cost, bank-grade encryption.',
    provider: 'Powered by Let\'s Encrypt'
  },
  { 
    icon: Cloud, 
    title: 'DDoS Protection', 
    desc: 'Cloudflare\'s free tier sits in front of your site, absorbing and distributing attack traffic before it reaches your server. Handles 99% of attacks.',
    provider: 'Powered by Cloudflare'
  },
  { 
    icon: Server, 
    title: 'Global Edge Network', 
    desc: 'Your content is cached at 300+ locations worldwide. Visitors connect to the nearest edge server for sub-50ms response times.',
    provider: 'Powered by Cloudflare CDN'
  },
];

const securityBadges = [
  { icon: Lock, label: 'SSL Secure', color: 'border-green-500/30 text-green-400' },
  { icon: Shield, label: 'Privacy Shield', color: 'border-neon-cyan/30 text-neon-cyan' },
  { icon: Server, label: '99.9% Uptime', color: 'border-blue-500/30 text-blue-400' },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="grid lg:grid-cols-2 gap-12 items-center py-12">
        <div className="order-1">
          <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan mb-4 uppercase tracking-widest text-[10px]">
            Security
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">
            Built-in protection.<br />
            <span className="text-text-secondary">Zero configuration.</span>
          </h1>
          <p className="text-lg text-text-secondary mb-8">
            Keep your site and visitors safe with automated security that just works.
            No complex setup required.
          </p>
          
          <div className="space-y-4 mb-8">
            {securityFeatures.map((feature) => (
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

          <div className="flex flex-wrap gap-3">
            {securityBadges.map((badge) => (
              <Badge key={badge.label} variant="outline" className={badge.color}>
                <badge.icon className="w-3 h-3 mr-1" /> {badge.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="relative order-2">
          <div className="rounded-3xl w-full h-[400px] bg-gradient-to-br from-green-500/10 to-neon-cyan/10 border border-white/10 flex items-center justify-center">
            <Shield className="w-32 h-32 text-green-500/30" />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-void/60 to-transparent" />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold font-heading mb-2">How It Works</h2>
          <p className="text-text-secondary">Free SSL & DDoS? Here&apos;s how we do it.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {howItWorksSteps.map((step) => (
            <Card key={step.title} className="bg-void-light border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-neon-cyan" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm mb-4 text-text-secondary">{step.desc}</p>
                <Badge variant="outline" className="text-xs">{step.provider}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Security Features Detail */}
      <section className="py-12">
        <h2 className="text-3xl font-bold font-heading mb-6 text-center">Security Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {detailedFeatures.map((feature) => (
            <Card key={feature.title} className="bg-void-light border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-neon-cyan" />
                </div>
                <h4 className="font-semibold mb-2">{feature.title}</h4>
                <p className="text-sm text-text-secondary">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Compliance & Standards */}
      <section className="py-8">
        <Card className="bg-void-light border-white/10">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Check className="w-6 h-6 text-green-400" />
              <h3 className="font-heading font-bold text-xl">Compliance & Standards</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-neon-cyan mt-0.5" />
                  <div>
                    <h4 className="font-semibold">GDPR Ready</h4>
                    <p className="text-sm text-text-secondary">Data protection and privacy compliance for EU visitors</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-neon-cyan mt-0.5" />
                  <div>
                    <h4 className="font-semibold">SOC 2 Type II</h4>
                    <p className="text-sm text-text-secondary">Enterprise-grade security controls and monitoring</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-neon-cyan mt-0.5" />
                  <div>
                    <h4 className="font-semibold">ISO 27001</h4>
                    <p className="text-sm text-text-secondary">Information security management certification</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Server className="w-5 h-5 text-neon-cyan mt-0.5" />
                  <div>
                    <h4 className="font-semibold">PCI DSS</h4>
                    <p className="text-sm text-text-secondary">Secure payment processing standards</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
