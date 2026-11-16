import { 
  Globe, Shield, Zap, 
  Brain, Bot, Sparkles, 
  Cpu, Code, Workflow, Layout, Terminal, BookOpen, Monitor, Server, Megaphone, Home, Key, Cloud, Lock
} from 'lucide-react';

export const mockDomains = [
  { name: '.com', price: 19.99, available: true },
  { name: '.xyz', price: 12.99, available: true },
  { name: '.io', price: 59.99, available: true },
  { name: '.dev', price: 34.99, available: true },
  { name: '.app', price: 39.99, available: true },
  { name: '.net', price: 24.99, available: true },
  { name: '.org', price: 24.99, available: true },
  { name: '.co', price: 44.99, available: true },
  { name: '.online', price: 14.99, available: true },
  { name: '.site', price: 14.99, available: true },
  { name: '.store', price: 19.99, available: true },
  { name: '.tech', price: 24.99, available: true },
  { name: '.info', price: 14.99, available: true },
];

export const templates = [
  { id: 1, name: 'Portfolio', category: 'Personal', description: 'Showcase your work with style', url: '/templates/portfolio.html' },
  { id: 2, name: 'Startup', category: 'Business', description: 'Launch your product', url: '/templates/startup.html' },
  { id: 3, name: 'Blog', category: 'Content', description: 'Share your thoughts', url: '/templates/blog.html' },
  { id: 4, name: 'E-commerce', category: 'Store', description: 'Sell your products', url: '#' },
  { id: 5, name: 'SaaS', category: 'Business', description: 'Showcase your app', url: '#' },
  { id: 6, name: 'Resume', category: 'Personal', description: 'Professional CV online', url: '#' },
];

export const aiTools = [
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

export const tutorials = [
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

export const navTabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'builder', label: 'Site Builder', icon: Layout },
  { id: 'devtools', label: 'Dev Tools', icon: Terminal },
  { id: 'tutorials', label: 'Tutorials', icon: BookOpen },
  { id: 'ide', label: 'Aura IDE', icon: Monitor },
  { id: 'hosting', label: 'Hosting', icon: Server },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'promote', label: 'Promote', icon: Megaphone },
];

export const tlds = [
  { name: '.xyz', price: '$12.99', popular: true },
  { name: '.online', price: '$14.99', popular: true },
  { name: '.site', price: '$14.99', popular: false },
  { name: '.store', price: '$19.99', popular: false },
  { name: '.com', price: '$19.99', popular: false },
  { name: '.io', price: '$59.99', popular: false },
];

export const bannerFeatures = [
  { icon: Shield, title: 'Free SSL & HTTPS', desc: 'Automatic security certificates' },
  { icon: Globe, title: 'Global Edge CDN', desc: 'Lightning-fast worldwide delivery' },
  { icon: Zap, title: 'One-Click Deploy', desc: 'Launch in seconds, not hours' },
];

export const securityFeatures = [
  { icon: Shield, title: 'DDoS Protection', desc: 'Mitigate attacks automatically' },
  { icon: Lock, title: 'Malware Scanning', desc: 'Continuous threat detection' },
  { icon: Server, title: 'Auto Backups', desc: 'Daily snapshots included' },
];

export const faqs = [
  { q: "What makes NovaLow different from other registrars?", a: "NovaLow isn't just a reseller. We provide enterprise-grade domain management integrated directly with the NovAura ecosystem. You get bank-grade security, global redundancy, and absolute stability for your digital identity." },
  { q: "How do renewals work?", a: "We maintain consistent premium rates. Unlike other registrars that lure you in with a $0.99 first year and then quintuple the price on renewal, our pricing reflects the real, high-quality management we provide every year." },
  { q: "Can I transfer an existing domain?", a: "Absolutely. We offer white-glove migration assistance to ensure your transition to the Novaura ecosystem is seamless, including DNS optimization and security verification." },
  { q: "Is WHOIS privacy included?", a: "Yes. Privacy isn't an upsell at NovAura—it's a requirement. All eligible domains include enterprise-level privacy protection to keep your personal data off public registries." },
  { q: "What support do you offer?", a: "Every domain owner gets priority access to our 24/7 technical team. Whether it's complex DNS records or security concerns, we're here to protect your digital assets." },
];
