import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Server, Globe, Shield, Zap, Calculator,
  CheckCircle, XCircle, Loader2, Package, Check, ArrowRight,
  Database, Cpu, Terminal, Activity, Layers, Receipt
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { apiClient } from '@/services/apiClient';

interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
}

const hostingTiers = [
  { 
    id: 'starter',
    name: 'Starter Node', 
    price: 14.99, 
    desc: 'Perfect for personal sites and portfolios', 
    features: ['10GB NVMe', '250GB/mo Bandwidth', 'Free SSL', 'DDoS Protection'] 
  },
  { 
    id: 'pro',
    name: 'Pro Cluster', 
    price: 29.99, 
    desc: 'For professional creators and scaling apps', 
    popular: true,
    features: ['50GB NVMe', '1TB/mo Bandwidth', 'Wildcard SSL', 'Anycast DNS'] 
  },
  { 
    id: 'business',
    name: 'Enterprise Grid', 
    price: 69.99, 
    desc: 'Enterprise-grade performance for high-traffic', 
    features: ['200GB NVMe', 'Unmetered Bandwidth', 'Dedicated IP', 'Hourly Backups'] 
  },
];

const DomainMarketplace: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DomainResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null);
  const [selectedHosting, setSelectedHosting] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleDomainSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchError('');
    setSelectedDomain(null);

    try {
      const { results } = await apiClient.get<{ results: DomainResult[] }>(
        `/domains/check?query=${encodeURIComponent(searchQuery.trim())}`
      );
      setSearchResults(results);
    } catch (err: any) {
      setSearchError(err.message ?? 'Domain lookup failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateTotal = () => {
    let total = 0;
    if (selectedDomain) total += selectedDomain.price;
    if (selectedHosting) {
      const plan = hostingTiers.find(h => h.id === selectedHosting);
      if (plan) {
        total += billingCycle === 'yearly' ? plan.price * 10 : plan.price;
      }
    }
    return total;
  };

  const total = calculateTotal();

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden bg-void">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-neon-cyan/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-neon-violet/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        
        {/* Header */}
        <div className="text-center space-y-6 mb-16">
          <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan px-4 py-1 uppercase tracking-widest text-[10px] bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            NovaLow Digital Infrastructure
          </Badge>
          <h1 className="text-5xl md:text-7xl font-black font-heading tracking-tight text-white drop-shadow-2xl">
            Build your <span className="text-gradient-rgb animate-gradient">Empire.</span>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg md:text-xl font-medium">
            The ultimate reseller portal. Register domains, attach enterprise hosting, and deploy instantly through the NovAura ecosystem.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Main Configuration Area */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Step 1: Domain Search */}
            <Card className="bg-void-light/60 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan opacity-50 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-neon-cyan/20 flex items-center justify-center text-neon-cyan font-bold font-heading">1</div>
                  <h2 className="text-2xl font-bold text-white">Secure your Domain</h2>
                </div>
                
                <form onSubmit={handleDomainSearch} className="flex items-center gap-2 p-2 rounded-2xl bg-void border border-white/10 focus-within:border-neon-cyan/50 focus-within:shadow-[0_0_30px_rgba(0,240,255,0.15)] transition-all duration-300">
                  <Globe className="w-6 h-6 ml-4 text-neon-cyan/70" />
                  <Input 
                    type="text"
                    placeholder="Search for a domain (e.g., myempire.com)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white text-lg placeholder:text-text-muted h-12"
                  />
                  <Button 
                    type="submit"
                    disabled={isSearching}
                    className="bg-neon-cyan hover:bg-neon-cyan/90 text-void font-black rounded-xl px-8 h-12 transition-all hover:scale-[1.02]"
                  >
                    {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                  </Button>
                </form>

                {/* Results Area */}
                <AnimatePresence>
                  {hasSearched && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 space-y-2"
                    >
                      {searchError ? (
                        <div className="p-6 text-center rounded-xl bg-red-500/10 border border-red-500/20">
                          <p className="text-red-400">{searchError}</p>
                        </div>
                      ) : searchResults.length === 0 && !isSearching ? (
                        <div className="p-6 text-center rounded-xl bg-white/5 text-text-muted border border-white/10">
                          No results found. Try another extension.
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {searchResults.map((result) => (
                            <button
                              key={result.domain}
                              onClick={() => result.available && setSelectedDomain(result)}
                              disabled={!result.available}
                              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                                !result.available 
                                  ? 'bg-void border-white/5 opacity-50 cursor-not-allowed'
                                  : selectedDomain?.domain === result.domain
                                    ? 'bg-neon-cyan/10 border-neon-cyan shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                                    : 'bg-void-light border-white/10 hover:border-neon-cyan/50 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                {result.available ? (
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    selectedDomain?.domain === result.domain ? 'border-neon-cyan bg-neon-cyan' : 'border-text-muted'
                                  }`}>
                                    {selectedDomain?.domain === result.domain && <Check className="w-3 h-3 text-void" />}
                                  </div>
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-400" />
                                )}
                                <span className={`text-lg font-mono font-bold ${!result.available && 'line-through text-text-muted'}`}>
                                  {result.domain}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className={`font-bold ${result.available ? 'text-neon-cyan' : 'text-text-muted'}`}>
                                  ${result.price.toFixed(2)}<span className="text-sm font-normal opacity-70">/yr</span>
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Step 2: Hosting Selection */}
            <Card className="bg-void-light/60 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-neon-violet opacity-50 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neon-violet/20 flex items-center justify-center text-neon-violet font-bold font-heading">2</div>
                    <h2 className="text-2xl font-bold text-white">Attach Baremetal Hosting</h2>
                  </div>
                  <div className="flex items-center gap-3 bg-void px-4 py-2 rounded-full border border-white/10">
                    <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-neon-violet' : 'text-text-muted'}`}>Monthly</span>
                    <Switch 
                      checked={billingCycle === 'yearly'}
                      onCheckedChange={(c) => setBillingCycle(c ? 'yearly' : 'monthly')}
                    />
                    <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-neon-violet' : 'text-text-muted'}`}>Yearly (Save 16%)</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {hostingTiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedHosting(selectedHosting === tier.id ? null : tier.id)}
                      className={`relative text-left p-6 rounded-2xl border transition-all duration-300 ${
                        selectedHosting === tier.id
                          ? 'bg-neon-violet/10 border-neon-violet shadow-[0_0_30px_rgba(180,0,255,0.15)] scale-[1.02]'
                          : 'bg-void border-white/10 hover:border-white/30 hover:bg-white/5'
                      }`}
                    >
                      {tier.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon-violet text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-glow-violet">
                          Most Popular
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <Server className={`w-8 h-8 mb-3 ${selectedHosting === tier.id ? 'text-neon-violet' : 'text-text-muted'}`} />
                        <h3 className="text-lg font-bold text-white mb-1">{tier.name}</h3>
                        <p className="text-xs text-text-secondary min-h-[32px]">{tier.desc}</p>
                      </div>
                      
                      <div className="mb-6">
                        <span className={`text-3xl font-black font-mono ${selectedHosting === tier.id ? 'text-neon-violet' : 'text-white'}`}>
                          ${billingCycle === 'yearly' ? (tier.price * 10).toFixed(2) : tier.price.toFixed(2)}
                        </span>
                        <span className="text-xs text-text-muted">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                      </div>

                      <div className="space-y-2">
                        {tier.features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                            <Check className={`w-4 h-4 ${selectedHosting === tier.id ? 'text-neon-violet' : 'text-emerald-400'}`} />
                            {f}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Digital Paper / Smart Contract Receipt */}
          <div className="lg:col-span-4">
            <div className="sticky top-28">
              <motion.div 
                className="bg-white text-slate-900 rounded-sm shadow-2xl relative overflow-hidden"
                style={{
                  boxShadow: '0 25px 50px -12px rgba(0,240,255,0.15), 0 0 0 1px rgba(255,255,255,0.8)'
                }}
              >
                {/* Receipt Header styling */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDEwLDAgMjAsMTAiIGZpbGw9IiNmOGZhZmMiLz48L3N2Zz4=')] -mt-1 opacity-0" />
                
                <div className="p-8 border-b-2 border-dashed border-slate-200 bg-slate-50 relative">
                  <div className="absolute top-4 right-4">
                    <Receipt className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-slate-900 rounded-sm flex items-center justify-center">
                      <span className="text-white font-bold font-mono text-xs">N</span>
                    </div>
                    <span className="font-mono font-black tracking-widest uppercase text-sm">NovaLow Order</span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Contract Estimate</p>
                  <p className="text-xs font-mono text-slate-400">{new Date().toLocaleDateString()}</p>
                </div>

                <div className="p-8 space-y-6 bg-white min-h-[250px]">
                  
                  {/* Domain Item */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm uppercase text-slate-800">1. Domain Registration</p>
                      {selectedDomain ? (
                        <p className="font-mono text-xs text-slate-500 mt-1">{selectedDomain.domain} (1 yr)</p>
                      ) : (
                        <p className="font-mono text-xs text-slate-400 mt-1 italic">Pending Selection...</p>
                      )}
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {selectedDomain ? `$${selectedDomain.price.toFixed(2)}` : '--'}
                    </div>
                  </div>

                  {/* Hosting Item */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm uppercase text-slate-800">2. Cloud Infrastructure</p>
                      {selectedHosting ? (
                        <p className="font-mono text-xs text-slate-500 mt-1">
                          {hostingTiers.find(h => h.id === selectedHosting)?.name} ({billingCycle})
                        </p>
                      ) : (
                        <p className="font-mono text-xs text-slate-400 mt-1 italic">Pending Selection...</p>
                      )}
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {selectedHosting ? `$${(billingCycle === 'yearly' ? hostingTiers.find(h => h.id === selectedHosting)!.price * 10 : hostingTiers.find(h => h.id === selectedHosting)!.price).toFixed(2)}` : '--'}
                    </div>
                  </div>

                  {/* Included Perks */}
                  <div className="pt-4 pb-2 border-t border-slate-100">
                    <p className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Included Protocols</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-mono text-slate-500">Anycast DNS</span></div>
                      <div className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-mono text-slate-500">Wildcard SSL</span></div>
                      <div className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-mono text-slate-500">DDoS Mitigation</span></div>
                      <div className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-mono text-slate-500">Whois Privacy</span></div>
                    </div>
                  </div>

                </div>

                <div className="bg-slate-900 p-8 text-white">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">Total Due Today</p>
                      <p className="text-4xl font-mono font-black">${total.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <Button 
                    disabled={!selectedDomain && !selectedHosting}
                    className="w-full h-14 bg-white text-slate-900 font-black font-heading text-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    Deploy Infrastructure
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  
                  <p className="text-center text-[10px] font-mono text-slate-500 mt-4 uppercase tracking-widest">
                    Secured by NovAura Protocol
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DomainMarketplace;
