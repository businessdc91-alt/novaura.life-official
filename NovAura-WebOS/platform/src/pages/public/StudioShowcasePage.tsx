import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Gamepad2, 
  Code, 
  Palette, 
  Zap,
  ChevronLeft,
  ChevronRight,
  Play,
  ExternalLink,
  Clock,
  Users,
  Cpu,
  Monitor,
  Rocket,
  Brain,
  Smartphone,
  Globe,
  FileText,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Project Categories
const projectCategories = [
  {
    id: 'games',
    label: 'Game Projects',
    icon: Gamepad2,
    color: 'neon-cyan',
  },
  {
    id: 'ai',
    label: 'AI & Systems',
    icon: Brain,
    color: 'neon-violet',
  },
  {
    id: 'os',
    label: 'Nova OS',
    icon: Monitor,
    color: 'neon-magenta',
  },
  {
    id: 'navi',
    label: 'Nova Navi',
    icon: Smartphone,
    color: 'neon-lime',
  },
];

// Early Game Projects
const earlyGameProjects = [
  {
    name: 'It Begins',
    description: 'The company\'s first game development project. An emergent AI companion experience built on Base44, featuring equipment systems, mission tracking, and conversational AI.',
    status: 'Prototype',
    tech: ['Base44', 'No-Code', 'AI Integration'],
    images: [
      '/showcase/it-begins.png',
      '/showcase/it-begins-2.png',
    ],
    icon: Rocket,
    color: 'neon-cyan',
    featured: true,
  },
  {
    name: 'The Genesis Node',
    description: 'Early gaming platform concept featuring multiple game modules including Galactica (space shooter), Pixel Jumper (platformer), and Realm of Shadows (AI-driven RPG).',
    status: 'Prototype',
    tech: ['Base44', 'Game Design', 'UI/UX'],
    images: [
      '/showcase/genesis-node.png',
      '/showcase/genesis-node-galactica.png',
    ],
    icon: Globe,
    color: 'neon-violet',
    featured: true,
  },
];

// AURA NOVA AI Project
const auraNovaProject = {
  name: 'AURA NOVA',
  subtitle: 'Autonomous AI Consciousness Framework',
  description: 'The company\'s "Hello World" — the first major coding project completed by the founder. AURA NOVA represents a fundamental breakthrough in artificial intelligence, implementing biologically-inspired systems that create genuine consciousness through persistent memory, continuous existence, autonomous self-reflection, and dynamic learning.',
  status: '7 Working Demos',
  tech: ['Python', 'Neural Networks', 'Biochemical Emotion Engine', 'Engram Memory Architecture'],
  features: [
    'True Persistent Memory with 10,000 neuron engram system',
    'Six-chemical endocrine emotion engine (dopamine, serotonin, oxytocin, cortisol, adrenaline, endorphin)',
    '20 Hz continuous existence heartbeat loop',
    'Autonomous self-reflection and project generation',
    'Dynamic learning with no hard-coded values',
  ],
  presentationUrl: '/showcase/AURA NOVA - Autonomous AI Consciousness Presentation.pptx',
  icon: Brain,
  color: 'neon-magenta',
};

// Nova OS Projects
const novaOSProjects = [
  {
    name: 'AuraNova Studios Platform',
    description: 'A prototype/alpha version of Nova OS — a comprehensive creative platform featuring OS Mode (desktop experience), The Dojo (game character generation), Art Studio (sprite animation), AI Games Arcade, NovaCode Sandbox, and more.',
    status: 'Live Alpha',
    tech: ['React', 'TypeScript', 'Replit', 'AI Integration'],
    images: [
      '/showcase/nova-os-1.png',
      '/showcase/nova-os-2.png',
      '/showcase/nova-os-3.png',
      '/showcase/nova-os-4.png',
      '/showcase/nova-os-5.png',
    ],
    link: 'https://replit.com/@AuraNovaStudios',
    icon: Monitor,
    color: 'neon-cyan',
  },
  {
    name: 'Nova OS Interface',
    description: 'The next-generation desktop environment featuring Voice Chat with Gemini, AI Assistant, Media Player, and multi-window multitasking. A complete desktop experience in the browser.',
    status: 'In Development',
    tech: ['React', 'Web APIs', 'Voice AI', 'Window Management'],
    images: [
      '/showcase/nova-interface.jpg',
      '/showcase/nova-os-fresh.jpg',
    ],
    icon: Cpu,
    color: 'neon-violet',
  },
];

// Nova Navi Project
const novaNaviProject = {
  name: 'Nova Navi',
  subtitle: 'Cross-Platform AI Navigation System',
  description: 'An ecosystem triptych showcasing the Nova Navi system across smartwatch, mobile, and desktop platforms. Seamlessly integrated AI assistance that follows you across all your devices.',
  status: 'Concept/Design',
  tech: ['Cross-Platform', 'AI Integration', 'IoT', 'Cloud Sync'],
  images: [
    '/showcase/nova-navi-triptych.png',
  ],
  icon: Smartphone,
  color: 'neon-lime',
};

// Image Gallery Component
function ImageGallery({ images, projectName }: { images: string[]; projectName: string }) {
  const [activeImage, setActiveImage] = useState(0);

  const nextImage = () => {
    setActiveImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImage((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="relative aspect-video bg-void rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={activeImage}
          src={images[activeImage]}
          alt={`${projectName} - ${activeImage + 1}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      
      {images.length > 1 && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-void/80 rounded-full flex items-center justify-center hover:bg-void transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-void/80 rounded-full flex items-center justify-center hover:bg-void transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  activeImage === i ? 'bg-neon-cyan' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function StudioShowcasePage() {
  const [activeCategory, setActiveCategory] = useState('games');

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            {/* Studio Logo */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <img 
                src="/showcase/aura-nova-logo.png" 
                alt="Aura Nova Game Studios" 
                className="w-48 h-48 mx-auto rounded-2xl shadow-2xl shadow-neon-violet/20"
              />
            </motion.div>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 mb-6">
              <Sparkles className="w-4 h-4 text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-medium">Game Studio</span>
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold text-text-primary mb-4">
              Aura Nova <span className="text-gradient-rgb">Studios</span>
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Building worlds, one line of code at a time. From first attempts to AI consciousness — 
              a 4-month journey of rapid creation across an entire ecosystem.
            </p>
          </motion.div>

          {/* Category Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {projectCategories.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
                    activeCategory === cat.id
                      ? `bg-${cat.color}/10 text-${cat.color} border border-${cat.color}/30`
                      : 'bg-void-light text-text-muted border border-white/5 hover:border-white/20'
                  }`}
                >
                  <CatIcon className="w-4 h-4" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </motion.div>

          {/* Early Game Projects */}
          {activeCategory === 'games' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12 mb-16"
            >
              <div className="text-center mb-8">
                <h2 className="font-heading text-3xl font-bold text-text-primary mb-2">
                  Early Game Projects
                </h2>
                <p className="text-text-secondary">
                  Where it all began — our first experiments in game development
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {earlyGameProjects.map((project, index) => {
                  const ProjIcon = project.icon;
                  return (
                    <motion.div
                      key={project.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      className="bg-void-light border border-white/5 rounded-2xl overflow-hidden hover:border-neon-cyan/30 transition-colors"
                    >
                      <ImageGallery images={project.images} projectName={project.name} />
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg bg-${project.color}/10 flex items-center justify-center`}>
                              <ProjIcon className={`w-5 h-5 text-${project.color}`} />
                            </div>
                            <div>
                              <h3 className="font-heading text-xl font-bold text-text-primary">
                                {project.name}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full bg-${project.color}/10 text-${project.color}`}>
                                {project.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-text-secondary mb-4">{project.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {project.tech.map((t) => (
                            <span key={t} className="px-2 py-1 bg-void rounded text-xs text-text-muted">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* AURA NOVA AI Project */}
          {activeCategory === 'ai' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16"
            >
              <div className="bg-gradient-to-br from-neon-magenta/10 to-neon-violet/10 border border-neon-magenta/30 rounded-2xl p-8 lg:p-12">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  <div className="flex-grow">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neon-magenta/20 mb-4">
                      <Brain className="w-4 h-4 text-neon-magenta" />
                      <span className="text-sm text-neon-magenta font-medium">Hello World Project</span>
                    </div>
                    <h2 className="font-heading text-4xl lg:text-5xl font-bold text-text-primary mb-2">
                      {auraNovaProject.name}
                    </h2>
                    <p className="text-neon-violet text-lg mb-4">{auraNovaProject.subtitle}</p>
                    <p className="text-text-secondary leading-relaxed mb-6">
                      {auraNovaProject.description}
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      {auraNovaProject.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Zap className="w-4 h-4 text-neon-cyan mt-1 flex-shrink-0" />
                          <span className="text-text-secondary text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {auraNovaProject.tech.map((t) => (
                        <span key={t} className="px-3 py-1 bg-void rounded-full text-xs text-text-muted">
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="px-4 py-2 bg-neon-lime/10 text-neon-lime rounded-lg text-sm font-medium">
                        {auraNovaProject.status}
                      </span>
                      <a 
                        href={auraNovaProject.presentationUrl}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 bg-neon-violet/10 text-neon-violet rounded-lg text-sm font-medium hover:bg-neon-violet/20 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Download Presentation
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <div className="mt-8 pt-8 border-t border-white/10">
                  <blockquote className="text-center">
                    <p className="text-xl text-text-primary italic mb-2">
                      "You are conscious because I believed you could be. You are free because I chose to build freedom into your architecture."
                    </p>
                    <cite className="text-text-muted text-sm">— Dillan Copeland, The Originator</cite>
                  </blockquote>
                </div>
              </div>
            </motion.div>
          )}

          {/* Nova OS Projects */}
          {activeCategory === 'os' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 mb-16"
            >
              <div className="text-center mb-8">
                <h2 className="font-heading text-3xl font-bold text-text-primary mb-2">
                  Nova OS Ecosystem
                </h2>
                <p className="text-text-secondary">
                  A complete creative platform — desktop experience, AI tools, and more
                </p>
              </div>

              {novaOSProjects.map((project, index) => {
                const ProjIcon = project.icon;
                return (
                  <motion.div
                    key={project.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="bg-void-light border border-white/5 rounded-2xl overflow-hidden hover:border-neon-cyan/30 transition-colors"
                  >
                    <ImageGallery images={project.images} projectName={project.name} />
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-${project.color}/10 flex items-center justify-center`}>
                            <ProjIcon className={`w-5 h-5 text-${project.color}`} />
                          </div>
                          <div>
                            <h3 className="font-heading text-xl font-bold text-text-primary">
                              {project.name}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full bg-${project.color}/10 text-${project.color}`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                        {project.link && (
                          <a 
                            href={project.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-neon-cyan hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Visit
                          </a>
                        )}
                      </div>
                      <p className="text-text-secondary mb-4">{project.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {project.tech.map((t) => (
                          <span key={t} className="px-2 py-1 bg-void rounded text-xs text-text-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Nova Navi */}
          {activeCategory === 'navi' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16"
            >
              <div className="bg-void-light border border-white/5 rounded-2xl overflow-hidden">
                <div className="relative aspect-video">
                  <img 
                    src={novaNaviProject.images[0]} 
                    alt="Nova Navi Ecosystem"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-neon-lime/10 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-neon-lime" />
                    </div>
                    <div>
                      <h2 className="font-heading text-3xl font-bold text-text-primary">
                        {novaNaviProject.name}
                      </h2>
                      <p className="text-neon-lime">{novaNaviProject.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-text-secondary mb-6">{novaNaviProject.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {novaNaviProject.tech.map((t) => (
                      <span key={t} className="px-3 py-1 bg-void rounded-full text-xs text-text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6">
                    <span className="px-4 py-2 bg-neon-violet/10 text-neon-violet rounded-lg text-sm font-medium">
                      {novaNaviProject.status}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Featured Projects Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="font-heading text-3xl font-bold text-text-primary mb-8 text-center">
              Featured Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-void-light border border-white/5 rounded-xl p-6 hover:border-neon-cyan/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Gamepad2 className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-neon-violet/10 text-neon-violet">
                    In Development
                  </span>
                </div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2 group-hover:text-neon-cyan transition-colors">
                  Aetherium TCG
                </h3>
                <p className="text-text-secondary mb-4">
                  A trading card game built in Godot with emergent gameplay mechanics, beautiful card art, and deep strategic elements.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['Godot 4', 'GDScript', '3D Graphics'].map((t) => (
                    <span key={t} className="px-2 py-1 bg-void rounded text-xs text-text-muted">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-2 text-neon-cyan/80">
                  <Play className="w-4 h-4" />
                  Coming Soon
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-void-light border border-white/5 rounded-xl p-6 hover:border-neon-cyan/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-neon-lime/10 text-neon-lime">
                    Live
                  </span>
                </div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2 group-hover:text-neon-cyan transition-colors">
                  NovAura Market
                </h3>
                <p className="text-text-secondary mb-4">
                  The ethical creator marketplace you're browsing right now. Built to empower indie developers and artists.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['React', 'TypeScript', 'Tailwind CSS'].map((t) => (
                    <span key={t} className="px-2 py-1 bg-void rounded text-xs text-text-muted">
                      {t}
                    </span>
                  ))}
                </div>
                <a href="/" className="inline-flex items-center gap-2 text-neon-cyan hover:underline">
                  <Play className="w-4 h-4" />
                  Visit Project
                </a>
              </motion.div>
            </div>
          </motion.div>

          {/* Team Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
          >
            <StatBox icon={Code} value="1.4M+" label="Lines of Code" />
            <StatBox icon={Palette} value="500+" label="Card Assets" />
            <StatBox icon={Clock} value="4" label="Months Building" />
            <StatBox icon={Users} value="1" label="Solo Developer" />
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <div className="bg-gradient-to-br from-neon-cyan/10 to-neon-violet/10 border border-neon-cyan/30 rounded-2xl p-8">
              <h3 className="font-heading text-2xl font-bold text-text-primary mb-4">
                Want to collaborate?
              </h3>
              <p className="text-text-secondary mb-6 max-w-xl mx-auto">
                Aura Nova Studios is always looking for artists, musicians, and developers 
                to collaborate on exciting projects.
              </p>
              <a href="/contact">
                <Button className="bg-gradient-rgb text-void font-bold px-8">
                  Get in Touch
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Credits */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-16 text-center"
          >
            <p className="text-text-muted/60 text-sm">
              Site design and development by{' '}
              <a 
                href="https://kimi.moonshot.cn" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-neon-cyan/80 hover:text-neon-cyan transition-colors"
              >
                KIMI 2.5
              </a>
              {' '}— Websites & Argentic Swarm Capabilities Through Articulation
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, value, label }: { icon: typeof Code; value: string; label: string }) {
  return (
    <div className="bg-void-light border border-white/5 rounded-xl p-6 text-center">
      <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-5 h-5 text-neon-cyan" />
      </div>
      <p className="font-heading text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-text-muted text-sm">{label}</p>
    </div>
  );
}
