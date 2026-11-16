import { 
  BookOpen, ArrowRight, Check, Brain, Bot, Sparkles, 
  Workflow, Rocket, Wand2, Database, Code, Globe, Cpu
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const tutorials = [
  {
    title: 'Set Up Your Home LLM',
    description: 'Run AI locally with Ollama, LM Studio, or LocalAI',
    icon: Cpu,
    level: 'Beginner'
  },
  {
    title: 'Modern Models 2026',
    description: 'Claude 4, GPT-5, Gemini Ultra, Llama 4 comparisons',
    icon: Brain,
    level: 'Intermediate'
  },
  {
    title: 'Coding Language Guide',
    description: 'Python, TypeScript, Rust, Go - which for what?',
    icon: Code,
    level: 'All Levels'
  },
  {
    title: 'AI Workflow Pipelines',
    description: 'From prototype to production with AI assistance',
    icon: Workflow,
    level: 'Advanced'
  },
];

const aiTools = [
  {
    name: 'Kimi',
    icon: Sparkles,
    strengths: ['Card & Asset Art', 'Website Building', 'Visual Design'],
    bestFor: 'UI/UX, Graphics, Web Design',
    color: 'from-purple-500 to-pink-500'
  },
  {
    name: 'Claude',
    icon: Brain,
    strengths: ['Robust Coding', 'Complex Logic', 'Architecture'],
    bestFor: 'Backend, APIs, System Design',
    color: 'from-orange-500 to-amber-500'
  },
  {
    name: 'Gemini',
    icon: Bot,
    strengths: ['General Advisor', 'Error Correction', 'Chat'],
    bestFor: 'Debugging, Research, Planning',
    color: 'from-blue-500 to-cyan-500'
  },
];

const workflowSteps = [
  { step: '1', tool: 'Google AI Studio', desc: 'Prototype & mock', icon: Wand2 },
  { step: '2', tool: 'Firebase', desc: 'Backend setup', icon: Database },
  { step: '3', tool: 'VS Code', desc: 'Heavy logic & polish', icon: Code },
  { step: '4', tool: 'Replit/Base44', desc: 'Production build', icon: Rocket },
  { step: '5', tool: 'Novalow', desc: 'Deploy & scale', icon: Globe },
];

const additionalGuides = [
  {
    title: 'Getting Started with Domains',
    description: 'Learn how to register and configure your first domain',
    icon: Globe,
    readTime: '5 min read'
  },
  {
    title: 'DNS Configuration 101',
    description: 'Understanding A, CNAME, MX, and TXT records',
    icon: Database,
    readTime: '8 min read'
  },
  {
    title: 'SSL Certificates Explained',
    description: 'How HTTPS works and why it matters',
    icon: Workflow,
    readTime: '6 min read'
  },
  {
    title: 'Custom Email Setup',
    description: 'Configure professional email with your domain',
    icon: BookOpen,
    readTime: '10 min read'
  },
];

export default function TutorialsPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="text-center py-12">
        <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan mb-4 uppercase tracking-widest text-[10px]">
          Tutorial Hub
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4">
          Learn. Build. <span className="text-gradient">Ship.</span>
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Guides for modern AI workflows, coding languages, and deployment pipelines.
        </p>
      </section>

      {/* Tutorials Grid */}
      <section className="py-8">
        <h2 className="text-2xl font-bold font-heading mb-6">Featured Tutorials</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {tutorials.map((tutorial) => (
            <Card key={tutorial.title} className="bg-void-light border-white/10 group cursor-pointer hover:border-neon-cyan/30 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                    <tutorial.icon className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-heading font-semibold text-lg">{tutorial.title}</h4>
                      <Badge variant="outline" className="text-xs">{tutorial.level}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary mb-3">{tutorial.description}</p>
                    <div className="flex items-center text-neon-cyan text-sm group-hover:underline">
                      Read Guide <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Additional Guides */}
      <section className="py-8">
        <h2 className="text-2xl font-bold font-heading mb-6">Domain & Hosting Guides</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {additionalGuides.map((guide) => (
            <Card key={guide.title} className="bg-void-light border-white/10 hover:border-neon-cyan/30 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                    <guide.icon className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold">{guide.title}</h4>
                      <span className="text-xs text-text-muted">{guide.readTime}</span>
                    </div>
                    <p className="text-sm text-text-secondary">{guide.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* AI Tools Comparison */}
      <section className="py-8">
        <h2 className="text-2xl font-bold font-heading mb-6 text-center">AI Assistant Comparison</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {aiTools.map((tool) => (
            <Card key={tool.name} className="bg-void-light border-white/10 overflow-hidden">
              <div className={`h-1 bg-gradient-to-r ${tool.color}`} />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <tool.icon className="w-8 h-8 text-neon-cyan" />
                  <h4 className="font-heading font-bold text-xl">{tool.name}</h4>
                </div>
                <div className="space-y-2 mb-4">
                  {tool.strengths.map((strength) => (
                    <div key={strength} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm">{strength}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-text-secondary">Best for: <span className="text-neon-cyan">{tool.bestFor}</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Workflow Example */}
      <section className="py-8">
        <Card className="bg-void-light border-neon-cyan/20">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Workflow className="w-6 h-6 text-neon-cyan" />
              <h3 className="font-heading font-bold text-xl">Recommended AI Workflow</h3>
            </div>
            
            <div className="grid md:grid-cols-5 gap-4">
              {workflowSteps.map((item, i) => (
                <div key={item.step} className="relative">
                  <div className="p-4 rounded-lg text-center bg-void-lighter border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-neon-cyan/20 flex items-center justify-center mx-auto mb-2">
                      <span className="text-neon-cyan font-bold text-sm">{item.step}</span>
                    </div>
                    <item.icon className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
                    <p className="font-semibold text-sm">{item.tool}</p>
                    <p className="text-xs text-text-secondary">{item.desc}</p>
                  </div>
                  {i < 4 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2">
                      <ArrowRight className="w-4 h-4 text-neon-cyan/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
