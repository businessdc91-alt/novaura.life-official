import { 
  Megaphone, Sparkles, Globe, Check, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const featuredSites = [
  { name: 'devtools.xyz', desc: 'Developer tools directory', tag: 'Sponsored' },
  { name: 'designhub.site', desc: 'UI/UX resources', tag: 'Featured' },
  { name: 'codenova.online', desc: 'Code snippets library', tag: 'Sponsored' },
];

const promotionTiers = [
  { 
    name: 'Spotlight', 
    price: '$19', 
    period: '/month',
    desc: 'Get noticed by the community',
    features: [
      'Homepage featured listing',
      '7-day rotation cycle',
      'Average 2,500 impressions',
      'Click-through analytics',
      'Badge on your site profile'
    ],
    cta: 'Start Spotlight',
    popular: false
  },
  { 
    name: 'Boost', 
    price: '$49', 
    period: '/month',
    desc: 'Maximum visibility',
    features: [
      'Priority homepage placement',
      'Featured in search results',
      '30-day prominent display',
      'Average 10,000 impressions',
      'Social media shoutout',
      'Newsletter feature'
    ],
    cta: 'Get Boosted',
    popular: true
  },
  { 
    name: 'Premiere', 
    price: '$99', 
    period: '/campaign',
    desc: 'Launch with impact',
    features: [
      'Everything in Boost',
      'Dedicated launch announcement',
      'Email blast to 5K+ users',
      'Blog post feature',
      '7-day homepage takeover',
      'Average 25,000 impressions'
    ],
    cta: 'Go Premiere',
    popular: false
  },
];

const howItWorksSteps = [
  { step: '1', title: 'Choose Package', desc: 'Pick the promotion tier that fits your goals' },
  { step: '2', title: 'Submit Site', desc: 'Share your website and a brief description' },
  { step: '3', title: 'Get Approved', desc: 'We review to ensure quality for our community' },
  { step: '4', title: 'Go Live', desc: 'Your site appears in featured placements' },
];

const advertiserRequirements = [
  'Be hosted on Novalow',
  'Have active SSL certificate',
  'Contain no malicious content',
  'Be live and functional'
];

export default function PromotePage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="text-center py-12">
        <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan mb-4 uppercase tracking-widest text-[10px]">
          Advertising
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">
          Get <span className="text-gradient">discovered.</span>
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Promote your website to thousands of builders, developers, and creators on the Novalow platform.
        </p>
      </section>

      {/* Featured Sites Preview */}
      <section className="py-8">
        <Card className="bg-void-light border-neon-cyan/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-neon-cyan" />
                <span className="font-semibold">Featured Sites</span>
              </div>
              <Badge className="bg-neon-cyan/20 text-neon-cyan">Homepage Placement</Badge>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {featuredSites.map((site) => (
                <div key={site.name} className="p-4 rounded-lg bg-void-lighter border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <Globe className="w-4 h-4 text-neon-cyan" />
                    <Badge variant="outline" className="text-xs">{site.tag}</Badge>
                  </div>
                  <p className="font-semibold text-sm">{site.name}</p>
                  <p className="text-xs text-text-secondary">{site.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Ad Packages */}
      <section className="py-12">
        <h2 className="text-3xl font-bold font-heading mb-6 text-center">Promotion Packages</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {promotionTiers.map((tier) => (
            <Card 
              key={tier.name} 
              className={`relative bg-void-light border-white/10 ${tier.popular ? 'border-2 border-neon-cyan' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-neon-cyan text-void font-bold">Most Popular</Badge>
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tier.popular ? 'bg-neon-cyan/20' : 'bg-neon-cyan/10'}`}>
                    <Megaphone className={`w-5 h-5 ${tier.popular ? 'text-neon-cyan' : 'text-neon-cyan'}`} />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-lg">{tier.name}</h4>
                    <p className="text-xs text-text-secondary">{tier.desc}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <span className="font-heading font-bold text-3xl text-neon-cyan">{tier.price}</span>
                  <span className="text-sm text-text-secondary">{tier.period}</span>
                </div>

                <div className="space-y-3 mb-6">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className={`w-full ${tier.popular ? 'bg-neon-cyan text-void font-bold hover:shadow-glow-cyan' : 'bg-neon-cyan/80 text-void font-bold hover:bg-neon-cyan'}`}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-8">
        <h2 className="text-2xl font-bold font-heading mb-6 text-center">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {howItWorksSteps.map((item) => (
            <div key={item.step} className="p-4 rounded-lg text-center bg-void-light border border-white/10">
              <div className="w-8 h-8 rounded-full bg-neon-cyan/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-neon-cyan font-bold text-sm">{item.step}</span>
              </div>
              <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
              <p className="text-xs text-text-secondary">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Requirements */}
      <section className="py-8">
        <Card className="bg-void-light border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-neon-cyan" />
              <h3 className="font-heading font-semibold text-lg">Advertiser Requirements</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">To maintain quality for our community, promoted sites must:</p>
                <ul className="space-y-1">
                  {advertiserRequirements.map((req) => (
                    <li key={req} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-void-lighter border border-white/10">
                <p className="text-sm font-medium mb-2">Questions?</p>
                <p className="text-xs text-text-secondary mb-3">Contact our advertising team for custom campaigns.</p>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Sales
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
