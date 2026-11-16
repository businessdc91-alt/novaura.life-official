import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Github, 
  ShieldCheck, 
  ExternalLink, 
  Cpu, 
  Sparkles,
  Layers,
  Zap,
  Download,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { scanExternalPlatforms } from '@/services/devAuraService';
import type { ExternalAsset } from '@/services/devAuraService';

export default function DevAuraReaderPage() {
  const [query, setQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ExternalAsset[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsScanning(true);
    setHasScanned(true);
    try {
      const data = await scanExternalPlatforms(query);
      setResults(data);
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Futuristic Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 to-transparent pointer-none" />
        
        <div className="container relative z-10 px-4 mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-neon-violet/10 border border-neon-violet/20 text-neon-violet"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold tracking-wider uppercase">Open Ecosystem Search</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-heading text-5xl md:text-7xl font-black mb-4 tracking-tighter"
          >
            DEV <span className="text-transparent bg-clip-text bg-gradient-rgb">AURA READER</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary text-lg max-w-2xl mx-auto mb-10"
          >
            Our free assets finder. We scan the global dev ecosystem to ensure you always have the best resources at your fingertips.
          </motion.p>

          {/* Futuristic Search Bar */}
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleScan}
            className="max-w-3xl mx-auto relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-neon-cyan to-neon-violet rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500" />
            <div className="relative flex items-center bg-void-light border border-white/10 rounded-2xl p-2">
              <Search className="w-6 h-6 text-text-muted ml-4" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for free models, scripts, game assets..."
                className="flex-grow bg-transparent border-none py-6 text-xl text-text-primary placeholder:text-text-muted focus:ring-0"
              />
              <Button 
                type="submit"
                disabled={isScanning}
                className="bg-gradient-rgb text-void font-bold px-8 py-6 rounded-xl relative overflow-hidden group/btn"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isScanning ? 'SCANNING...' : 'SCAN ASSETS'}
                  <Zap className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
                </span>
                {isScanning && (
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="absolute inset-0 bg-white/20"
                  />
                )}
              </Button>
            </div>
          </motion.form>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-text-muted"
          >
            <span className="flex items-center gap-1"><Github className="w-3 h-3" /> GitHub OSS</span>
            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> HuggingFace Models</span>
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> itch.io Free Assets</span>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="container px-4 mx-auto">
        {!hasScanned ? (
          <div className="max-w-3xl mx-auto bg-void-light border border-white/5 rounded-3xl p-8 md:p-12 text-center">
            <div className="w-20 h-20 bg-neon-cyan/10 border border-neon-cyan/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Info className="w-10 h-10 text-neon-cyan" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Why use the Aura Reader?</h2>
            <p className="text-text-secondary leading-relaxed mb-8">
              "If we don't have it, don't worry. We designed this tool to find them for you on other platforms 
              to supply you with the best free assets we can and help streamline your creative process."
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="text-neon-cyan font-bold mb-1">Unfiltered</div>
                <div className="text-xs text-text-muted">Direct access to raw open-source repositories and model cards.</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="text-neon-violet font-bold mb-1">Time-Saving</div>
                <div className="text-xs text-text-muted">No more jumping between 5 different platform search engines.</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="text-neon-lime font-bold mb-1">Safe Links</div>
                <div className="text-xs text-text-muted">We route you directly to official release and download pages.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Scan Results: <span className="text-neon-cyan">"{query}"</span>
              </h2>
              <span className="text-sm text-text-muted">{results.length} resources identified</span>
            </div>

            {isScanning ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 bg-void-light border border-white/5 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {results.map((asset, index) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="group bg-void-light border border-white/5 hover:border-neon-cyan/30 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,249,0.1)]"
                    >
                      {/* Platform Badge */}
                      <div className="relative aspect-video bg-void overflow-hidden">
                        <img 
                          src={asset.thumbnail} 
                          alt={asset.title}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-2 py-1 rounded-md bg-void/80 border border-white/10 backdrop-blur-sm">
                          {asset.platform === 'github' && <Github className="w-3 h-3" />}
                          {asset.platform === 'huggingface' && <div className="text-xs">🤗</div>}
                          {asset.platform === 'itchio' && <div className="text-xs">🎮</div>}
                          <span className="text-[10px] font-bold uppercase tracking-widest">{asset.platform}</span>
                        </div>
                      </div>

                      <div className="p-6 flex flex-col flex-grow">
                        <h3 className="font-bold text-lg mb-2 group-hover:text-neon-cyan transition-colors">{asset.title}</h3>
                        <p className="text-text-muted text-sm line-clamp-2 mb-4 flex-grow">
                          {asset.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                          {asset.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-1 bg-white/5 rounded border border-white/10 text-text-secondary uppercase">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div className="text-xs text-text-muted">
                            by <span className="text-text-primary capitalize">{asset.author}</span>
                          </div>
                          <div className="flex gap-2">
                             <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-white/10 hover:bg-white/5"
                              asChild
                            >
                              <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3 mr-1" /> View
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 bg-neon-cyan text-void font-bold hover:bg-neon-cyan/90 border-none px-3"
                              asChild
                            >
                              <a href={asset.downloadUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="w-3 h-3 mr-1" /> Get
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-20 text-center">
                <p className="text-text-muted italic">"Deep scans complete. No external matches identified for this query."</p>
                <Button 
                  variant="link" 
                  onClick={() => setQuery('')}
                  className="text-neon-cyan mt-4"
                >
                  Try a different search term
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Philosophy Footer Overlay */}
      <section className="container px-4 mx-auto mt-20">
        <div className="p-6 border border-white/5 bg-void/50 backdrop-blur-sm rounded-2xl flex flex-col md:flex-row items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-neon-cyan/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-neon-cyan" />
          </div>
          <div className="flex-grow text-center md:text-left">
            <h4 className="font-bold text-sm mb-1 uppercase tracking-wider text-neon-cyan">Integrity & Streamlining</h4>
            <p className="text-xs text-text-muted">
              Discovering the best free assets from HuggingFace, GitHub, and itch.io.
              Results are curated for quality and relevance to game development and creative software. 
              Links provided are primary sources to ensure you get the latest, most secure versions.
            </p>
          </div>
          <div className="shrink-0 flex gap-4 grayscale opacity-40">
             <Github className="w-6 h-6" />
             <div className="text-lg font-black">🤗</div>
             <div className="text-lg font-black italic underline">itch</div>
          </div>
        </div>
      </section>
    </div>
  );
}
