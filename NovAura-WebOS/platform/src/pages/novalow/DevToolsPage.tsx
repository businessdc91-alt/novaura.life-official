import {
  Terminal, Database, Webhook, Github, ExternalLink,
  TerminalSquare, Globe, Code, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const devTools = [
  { icon: Terminal, title: 'Novalow CLI', desc: 'npm install -g novalow-cli', color: 'from-green-500 to-emerald-500' },
  { icon: Database, title: 'REST API', desc: 'Full API access', color: 'from-blue-500 to-cyan-500' },
  { icon: Webhook, title: 'Webhooks', desc: 'Event-driven automation', color: 'from-purple-500 to-pink-500' },
  { icon: Github, title: 'GitHub Integration', desc: 'One-click deploy from repo', color: 'from-gray-500 to-gray-700' },
];

const webhookEvents = [
  'domain.registered', 
  'dns.updated', 
  'ssl.renewed', 
  'deploy.success'
];

const apiEndpoints = [
  { method: 'GET', path: '/api/v1/domains' },
  { method: 'POST', path: '/api/v1/domains/register' },
  { method: 'GET', path: '/api/v1/dns/records' },
  { method: 'PUT', path: '/api/v1/dns/records/:id' },
  { method: 'DELETE', path: '/api/v1/domains/:id' },
];

const featureBadges = [
  'Serverless Functions',
  'Edge Workers',
  'Environment Variables',
  'Preview Deployments',
];

export default function DevToolsPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="text-center py-12">
        <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan mb-4 uppercase tracking-widest text-[10px]">
          Developer Tools
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">
          Built for <span className="text-gradient">developers.</span>
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          CLI, API, webhooks, and GitHub integration. Deploy with a single command.
        </p>
      </section>

      {/* Tools Grid */}
      <section className="py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {devTools.map((tool) => (
            <Card key={tool.title} className="border-0 overflow-hidden group bg-void-light border-white/10">
              <div className={`h-1 bg-gradient-to-r ${tool.color}`} />
              <CardContent className="p-6">
                <tool.icon className="w-8 h-8 text-neon-cyan mb-4" />
                <h4 className="font-heading font-semibold text-lg mb-2">{tool.title}</h4>
                <p className="text-sm text-text-secondary mb-4">{tool.desc}</p>
                <Button variant="outline" size="sm" className="w-full border-white/20">
                  Docs <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CLI Example */}
      <section className="py-8">
        <Card className="bg-void-light border-neon-cyan/20">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <TerminalSquare className="w-6 h-6 text-neon-cyan" />
              <h3 className="font-heading font-bold text-xl">Quick Start with CLI</h3>
            </div>
            
            <div className="rounded-lg p-6 font-mono text-sm overflow-x-auto bg-black/50 border border-white/10">
              <div className="text-green-400"># Install Novalow CLI</div>
              <div className="text-white">npm install -g novalow-cli</div>
              <div className="text-green-400 mt-4"># Login to your account</div>
              <div className="text-white">novalow login</div>
              <div className="text-green-400 mt-4"># Deploy from GitHub</div>
              <div className="text-white">novalow deploy --from-github username/repo</div>
              <div className="text-green-400 mt-4"># Or deploy local project</div>
              <div className="text-white">novalow deploy . --domain myapp.xyz</div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {featureBadges.map((badge) => (
                <Badge key={badge} variant="outline" className="text-xs">{badge}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* API & Webhooks */}
      <section className="py-8">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-void-light border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-neon-cyan" />
                <h4 className="font-heading font-semibold text-lg">REST API</h4>
              </div>
              <div className="rounded-lg p-4 font-mono text-xs bg-black/30 border border-white/10">
                {apiEndpoints.map((endpoint, index) => (
                  <div key={endpoint.path} className={index > 0 ? 'mt-2' : ''}>
                    <div className="text-purple-400">{endpoint.method}</div>
                    <div className="text-white">{endpoint.path}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-void-light border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Webhook className="w-6 h-6 text-neon-cyan" />
                <h4 className="font-heading font-semibold text-lg">Webhooks</h4>
              </div>
              <div className="space-y-2">
                {webhookEvents.map((event) => (
                  <div key={event} className="flex items-center gap-2 p-2 rounded bg-black/30 border border-white/10">
                    <Webhook className="w-4 h-4 text-neon-cyan" />
                    <span className="font-mono text-xs">{event}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-8">
        <h3 className="font-heading font-bold text-xl mb-6 text-center">Developer Features</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-void-light border-white/10">
            <CardContent className="p-5">
              <Cpu className="w-8 h-8 text-neon-cyan mb-3" />
              <h4 className="font-semibold mb-1">Serverless Functions</h4>
              <p className="text-sm text-text-secondary">Deploy API endpoints without managing servers</p>
            </CardContent>
          </Card>
          <Card className="bg-void-light border-white/10">
            <CardContent className="p-5">
              <Globe className="w-8 h-8 text-neon-cyan mb-3" />
              <h4 className="font-semibold mb-1">Edge Workers</h4>
              <p className="text-sm text-text-secondary">Run code at the edge for ultra-low latency</p>
            </CardContent>
          </Card>
          <Card className="bg-void-light border-white/10">
            <CardContent className="p-5">
              <Code className="w-8 h-8 text-neon-cyan mb-3" />
              <h4 className="font-semibold mb-1">Framework Support</h4>
              <p className="text-sm text-text-secondary">React, Vue, Svelte, Next.js, and more</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
