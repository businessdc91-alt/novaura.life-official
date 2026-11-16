import { NovAuraLogo, NovAuraLoader } from './NovAuraLogo';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Sparkles, Zap, Shield, Globe } from 'lucide-react';

export function RGBShowcase() {
  return (
    <div className="space-y-12 p-8">
      {/* Logo Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">NovAura Logo System</h2>
        <div className="flex flex-wrap gap-8 items-center">
          <NovAuraLogo size="sm" />
          <NovAuraLogo size="md" />
          <NovAuraLogo size="lg" />
          <NovAuraLogo size="xl" />
        </div>
        <div className="flex gap-8 items-center">
          <NovAuraLoader size={64} />
          <NovAuraLoader size={96} />
        </div>
      </section>

      {/* RGB Button Effects */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">RGB Living Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button className="btn-rgb-living px-8 py-6 text-lg">
            <Sparkles className="w-5 h-5 mr-2" />
            Get Started
          </Button>
          
          <Button className="rgb-border-flow bg-void px-8 py-6 text-lg text-white hover:bg-void/80">
            <Zap className="w-5 h-5 mr-2" />
            Explore
          </Button>
          
          <Button className="rgb-shadow-pulse bg-void px-8 py-6 text-lg text-white border border-white/10">
            <Shield className="w-5 h-5 mr-2" />
            Secure
          </Button>
        </div>
      </section>

      {/* RGB Text Effects */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">RGB Text Effects</h2>
        <div className="space-y-4">
          <h1 className="text-6xl font-black rgb-text-flow">
            NOVA AURA
          </h1>
          
          <p className="text-2xl neon-flicker" style={{ color: '#00F0FF' }}>
            The Future of Creation
          </p>
          
          <p className="text-xl matrix-rgb font-mono">
            &lt;code&gt;create&lt;/code&gt;.ship&lt;/code&gt;.earn&lt;/code&gt;
          </p>
        </div>
      </section>

      {/* RGB Card Effects */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">RGB Card Effects</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rgb-gradient-border p-6">
            <CardContent className="p-0 space-y-4">
              <Globe className="w-12 h-12 text-neon-cyan" />
              <h3 className="text-xl font-bold text-white">Domains</h3>
              <p className="text-text-secondary">500+ TLDs at the lowest prices</p>
            </CardContent>
          </Card>
          
          <Card className="rgb-border-flow bg-void p-6">
            <CardContent className="p-0 space-y-4">
              <Sparkles className="w-12 h-12 text-electric-violet" />
              <h3 className="text-xl font-bold text-white">Marketplace</h3>
              <p className="text-text-secondary">Buy and sell creative assets</p>
            </CardContent>
          </Card>
          
          <Card className="rgb-shadow-pulse bg-void p-6 border border-white/10">
            <CardContent className="p-0 space-y-4">
              <Zap className="w-12 h-12 text-hot-magenta" />
              <h3 className="text-xl font-bold text-white">Aura IDE</h3>
              <p className="text-text-secondary">Code in the cloud</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* RGB Background Effects */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">RGB Background Flow</h2>
        <div className="h-32 rgb-bg-flow rounded-2xl flex items-center justify-center">
          <span className="text-3xl font-black text-black drop-shadow-lg">
            Flowing RGB
          </span>
        </div>
      </section>

      {/* Underline Effect */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">RGB Underline Flow</h2>
        <div className="space-y-4">
          <a href="/" className="text-xl text-white rgb-underline-flow inline-block">
            Hover over this link
          </a>
          <br />
          <span className="text-2xl font-bold text-white rgb-underline-flow inline-block">
            Important Heading
          </span>
        </div>
      </section>

      {/* Shimmer Effect */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">RGB Shimmer</h2>
        <div className="relative h-20 bg-void-light rounded-xl overflow-hidden">
          <div className="absolute inset-0 shimmer-rgb" />
          <div className="relative z-10 h-full flex items-center justify-center">
            <span className="text-xl font-bold text-white">Loading...</span>
          </div>
        </div>
      </section>
    </div>
  );
}
