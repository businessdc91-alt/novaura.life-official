import { useState } from 'react';
import {
  Layout, Eye, Check, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const templates = [
  { id: 1, name: 'Portfolio', category: 'Personal', description: 'Showcase your work with style', url: '/templates/portfolio.html' },
  { id: 2, name: 'Startup', category: 'Business', description: 'Launch your product', url: '/templates/startup.html' },
  { id: 3, name: 'Blog', category: 'Content', description: 'Share your thoughts', url: '/templates/blog.html' },
  { id: 4, name: 'E-commerce', category: 'Store', description: 'Sell your products', url: '#' },
  { id: 5, name: 'SaaS', category: 'Business', description: 'Showcase your app', url: '#' },
  { id: 6, name: 'Resume', category: 'Personal', description: 'Professional CV online', url: '#' },
];

const builderFeatures = [
  '20+ starter templates',
  'Unlimited image uploads',
  'Custom domains included',
  'SEO optimization built-in',
  'Contact forms & integrations',
];

export default function SiteBuilderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="text-center py-12">
        <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan mb-4 uppercase tracking-widest text-[10px]">
          Site Builder
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">
          Build beautiful sites. <span className="text-gradient">No code needed.</span>
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Drag, drop, publish. Simple templates, image uploads, and instant deployment.
        </p>
      </section>

      {/* Templates Gallery */}
      <section className="py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <a 
              key={template.id}
              href={template.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              onClick={(e) => {
                if (template.url === '#') {
                  e.preventDefault();
                  setSelectedTemplate(template);
                }
              }}
            >
              <Card 
                className="group cursor-pointer overflow-hidden border-0 bg-void-light border-white/10 hover:border-neon-cyan/30 transition-all h-full"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-void-lighter to-void-light">
                  <Layout className="w-16 h-16 opacity-20 group-hover:opacity-40 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute inset-0 bg-gradient-to-t from-neon-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <div className="bg-neon-cyan text-void font-bold px-5 py-2.5 rounded-full flex items-center gap-2 shadow-glow-cyan">
                      <Eye className="w-4 h-4" />
                      {template.url !== '#' ? 'Live Preview' : 'Coming Soon'}
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-heading font-semibold text-lg mb-1 group-hover:text-neon-cyan transition-colors">{template.name}</h4>
                      <p className="text-sm text-text-secondary">{template.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs group-hover:border-neon-cyan/50 group-hover:text-neon-cyan transition-colors">
                      {template.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12">
        <Card className="bg-void-light border-neon-cyan/20">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-neon-cyan" />
              <h3 className="font-heading font-bold text-2xl">Simple & Sweet</h3>
            </div>
            
            <p className="mb-6 text-text-secondary">
              Our site builder is perfect for portfolios, landing pages, and small business sites. 
              Choose a template, customize with drag-and-drop, and go live in minutes.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {builderFeatures.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="text-sm italic mb-2 text-text-secondary">
                "Want something truly custom and deeply fabricated? Try{' '}
                <a 
                  href="https://kimi.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-neon-cyan hover:underline"
                >
                  Kimi
                </a>{' '}
                with her agent swarm website creator mode."
              </p>
              <p className="text-xs text-text-secondary">
                We aren't quite as amazing as Kimi... but one day maybe we'll catch up to the big sister ^.^'
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="text-center py-8">
        <Card className="inline-block border-neon-cyan/30 bg-neon-cyan/5">
          <CardContent className="p-8">
            <Sparkles className="w-10 h-10 text-neon-cyan mx-auto mb-4" />
            <h3 className="font-heading font-bold text-2xl mb-2">Ready to build?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Choose a template and launch your site in minutes.
            </p>
            <Button className="bg-neon-cyan text-void font-bold hover:shadow-glow-cyan px-8">
              Start Building
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Template Preview Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl bg-void-light border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedTemplate?.name}
              <Badge variant="outline">{selectedTemplate?.category}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video rounded-lg flex items-center justify-center bg-void-lighter">
            <div className="text-center">
              <Layout className="w-24 h-24 opacity-20 mx-auto mb-4" />
              <p className="text-text-secondary">
                {selectedTemplate?.description}
              </p>
              <p className="text-sm text-text-muted mt-2">Coming Soon</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
            <Button className="bg-neon-cyan text-void font-bold">
              Notify Me
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
