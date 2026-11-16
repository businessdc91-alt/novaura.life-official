import React from 'react';
import { Layout, Eye, Check, Sparkles, Wand2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { templates } from '@/constants/novalowData';

const TemplateGallery: React.FC = () => {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <Badge variant="outline" className="border-neon-violet/50 text-neon-violet bg-neon-violet/5 uppercase tracking-widest text-[10px]">
          NovAura Genesis Blueprints
        </Badge>
        <h2 className="text-4xl md:text-5xl font-bold font-heading">
          Build beautiful sites. <br />
          <span className="bg-gradient-to-r from-neon-cyan to-neon-violet bg-clip-text text-transparent">No code needed.</span>
        </h2>
        <p className="text-text-secondary max-w-2xl mx-auto text-lg leading-relaxed">
          Select a high-performance blueprint and let Aura customize it to your world. 
          Deployment is instant, static, and globally scaled.
        </p>
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {templates.map((template) => (
          <div key={template.id} className="group relative">
            <Card className="bg-void-light border-white/5 overflow-hidden card-hover h-full">
              {/* Preview Area */}
              <div className="relative aspect-[16/10] overflow-hidden bg-void-lighter">
                <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 group-hover:scale-110">
                  <Layout className="w-16 h-16 text-neon-cyan/10" />
                </div>
                
                {/* Glow Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-neon-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Hover Action */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                  <Button className="bg-neon-cyan text-void font-bold shadow-glow-cyan flex items-center gap-2 px-6 rounded-full">
                    <Eye className="w-4 h-4" />
                    {template.url !== '#' ? 'Genesis Preview' : 'Optimizing...'}
                  </Button>
                </div>
              </div>

              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-bold font-heading group-hover:text-neon-cyan transition-colors">{template.name}</h4>
                    <p className="text-sm text-text-muted mt-1">{template.category}</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-text-muted">v1.0</Badge>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {template.description}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Feature Highlight */}
      <Card className="bg-gradient-to-br from-void-light to-void border-neon-cyan/20 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
          <Wand2 className="w-32 h-32 text-neon-cyan" />
        </div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-8 h-8 text-neon-cyan" />
            <h3 className="text-3xl font-bold font-heading">The Genesis Engine</h3>
          </div>
          
          <p className="text-text-secondary text-lg mb-8 leading-relaxed">
            Our blueprints aren't just templates—they are live-modifiable environments. 
            Once selected, Aura can refactor individual components, update logic, and sync 
            directly with your codebase.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {[
              'Direct IDE Injection',
              'Sub-100ms Hydration',
              'Auto-scaling edge hosting',
              'Neural CSS re-styling',
              'Baremetal performance'
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/80">
                <div className="w-5 h-5 rounded-full bg-neon-cyan/10 flex items-center justify-center">
                  <Check className="w-3 h-3 text-neon-cyan" />
                </div>
                <span className="text-sm font-mono">{feature}</span>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
            <p className="text-sm italic text-text-muted">
              Inspired by the <span className="text-neon-violet">Kimi Agent Swarm</span> architecture. 
              Bridging the gap between manual creation and autonomous generation.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TemplateGallery;
