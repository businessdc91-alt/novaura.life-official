import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Search,
  ShieldCheck,
  Zap,
  Lock,
  Coins,
  Layout,
  ExternalLink,
  Server,
  Cloud,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const DOMAIN_EXTENSIONS = [
  { ext: '.aura', price: 0.50, description: 'AI Living Identity' },
  { ext: '.nova', price: 0.75, description: 'Creative Hub' },
  { ext: '.node', price: 1.00, description: 'Neural Endpoint' },
  { ext: '.void', price: 0.50, description: 'Pure Digital Space' },
];

export default function NovaRegistryPage() {
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { user: _user } = useAuthStore();
  const { addToast } = useUIStore();

  const getRegisteredDomains = () => {
    try {
      return JSON.parse(localStorage.getItem('novaura_registered_domains') || '[]');
    } catch {
      return [];
    }
  };

  const saveRegisteredDomain = (domain: string) => {
    const registered = getRegisteredDomains();
    if (!registered.includes(domain)) {
      registered.push(domain);
      localStorage.setItem('novaura_registered_domains', JSON.stringify(registered));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    setIsSearching(true);
    // Small delay for UX feedback
    await new Promise(resolve => setTimeout(resolve, 800));

    const domainName = search.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const registered = getRegisteredDomains();

    const searchResults = DOMAIN_EXTENSIONS.map(ext => ({
      name: `${domainName}${ext.ext}`,
      price: ext.price,
      description: ext.description,
      available: !registered.includes(`${domainName}${ext.ext}`),
    }));

    setResults(searchResults);
    setIsSearching(false);
  };

  const handleRegister = (domain: string, _price: number) => {
    saveRegisteredDomain(domain);
    // Update current results to show as taken
    setResults(prev => prev.map(r => r.name === domain ? { ...r, available: false } : r));
    addToast({
      type: 'success',
      title: 'Domain Registered',
      message: `${domain} has been registered to your wallet!`
    });
  };

  return (
    <div className="min-h-screen pt-24 pb-12 overflow-x-hidden bg-void relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-neon-cyan/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-neon-violet/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <Globe className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Nova Registry v1.0</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter"
          >
            Claim Your <span className="text-gradient-rgb">Neural Territory</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-text-secondary max-w-2xl mx-auto"
          >
            Autonomous domain registration for the next generation of AI-driven sites. 
            Automated SSL, DDoS protection, and deep Aura integration starting at just $0.50.
          </motion.p>
        </div>

        {/* Search Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto mb-20"
        >
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-0 bg-neon-cyan/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity rounded-2xl" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for your dream domain..."
              className="h-16 pl-14 pr-32 bg-slate-900/80 border-white/10 text-xl rounded-2xl focus:border-neon-cyan/50 backdrop-blur-md"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-text-muted" />
            <Button 
              type="submit"
              disabled={isSearching}
              className="absolute right-2 top-2 bottom-2 bg-gradient-rgb text-void font-black px-8 rounded-xl hover:scale-[1.02] transition-transform"
            >
              {isSearching ? <Zap className="w-5 h-5 animate-spin" /> : "DISCOVER"}
            </Button>
          </form>
          
          <div className="flex justify-center gap-6 mt-6">
            {DOMAIN_EXTENSIONS.map(d => (
              <span key={d.ext} className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 hover:border-white/20 transition-colors cursor-default">
                {d.ext} <span className="text-neon-cyan">${d.price}</span>
              </span>
            ))}
          </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-4 mb-20"
            >
              <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.2em] mb-6 px-4">Registry Search Results</h2>
              <div className="grid gap-3">
                {results.map((res, i) => (
                  <motion.div 
                    key={res.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:border-white/20 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${res.available ? 'bg-neon-cyan/10 text-neon-cyan' : 'bg-red-500/10 text-red-400'}`}>
                        {res.available ? <Globe className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">{res.name}</h3>
                        <p className="text-xs text-text-muted uppercase tracking-wider">{res.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-text-muted uppercase font-bold tracking-widest">Pricing</p>
                        <p className="text-xl font-black text-white">${res.price.toFixed(2)}</p>
                      </div>
                      <Button 
                        disabled={!res.available}
                        onClick={() => handleRegister(res.name, res.price)}
                        className={`px-8 h-12 font-black rounded-xl transition-all ${res.available ? 'bg-white text-void hover:bg-neon-cyan' : 'bg-white/5 text-text-muted'}`}
                      >
                        {res.available ? "REGISTER" : "TAKEN"}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          <FeatureCard 
            icon={ShieldCheck}
            title="Sovereign Protection"
            description="Built-in DDoS protection and automated SSL termination on the Nova Edge."
            color="neon-cyan"
          />
          <FeatureCard 
            icon={Zap}
            title="Neural Proxy"
            description="Low-latency routing directly from your domain to your Aura-controlled sites."
            color="neon-violet"
          />
          <FeatureCard 
            icon={Coins}
            title="Economic Logic"
            description="Use Consciousness Coins for renewals, transfers, and advanced hosting tiers."
            color="neon-lime"
          />
        </div>

        {/* Hosting Overview */}
        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          <div className="bg-gradient-to-br from-slate-900 to-void border border-white/5 rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
              <Server className="w-40 h-40" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-white mb-4 uppercase">Connected <span className="text-neon-cyan">Sections</span></h3>
              <p className="text-text-secondary leading-relaxed mb-8 max-w-md">
                Manage your cross-platform identity. Your Nova domain connects NovAura Market, Polsia Finance, and the Aura OS ecosystem into one cohesive digital existence.
              </p>
              <div className="flex gap-4">
                <Button className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 hover:bg-neon-cyan hover:text-void font-bold px-6">
                  Manage Ecosystem
                </Button>
                <Button variant="ghost" className="text-text-muted hover:text-white font-bold px-6">
                  Learn More <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatsTile icon={Cloud} value="99.99%" label="Aura Uptime" />
            <StatsTile icon={Cpu} value="20ms" label="Global Edge" />
            <StatsTile icon={Layout} value="Unlimited" label="Sites" />
            <StatsTile icon={Globe} value="Instant" label="Deployment" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: any) {
  return (
    <div className={`p-8 bg-slate-900/40 border border-white/5 rounded-2xl hover:border-${color}/30 transition-all group`}>
      <div className={`w-12 h-12 rounded-xl bg-void border border-white/10 flex items-center justify-center mb-6 text-${color} group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">{title}</h4>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function StatsTile({ icon: Icon, value, label }: any) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-white/[0.07] transition-colors cursor-default">
      <Icon className="w-6 h-6 text-neon-cyan mb-3 opacity-50" />
      <p className="text-2xl font-black text-white tracking-widest">{value}</p>
      <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-1">{label}</p>
    </div>
  );
}
