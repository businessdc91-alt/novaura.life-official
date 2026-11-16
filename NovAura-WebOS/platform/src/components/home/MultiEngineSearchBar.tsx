import { useState } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SEARCH_ENGINES, executeWebSearch, type SearchEngine } from '@/services/webSearchService';

export default function MultiEngineSearchBar() {
  const [query, setQuery] = useState('');
  const [activeEngine, setActiveEngine] = useState<SearchEngine>('google');
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    executeWebSearch(query, activeEngine);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <section className="py-8 lg:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Engine Tabs */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {SEARCH_ENGINES.map((engine) => (
            <button
              key={engine.id}
              onClick={() => setActiveEngine(engine.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeEngine === engine.id
                  ? `bg-${engine.color}/20 text-${engine.color} border border-${engine.color}/40`
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {engine.name}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 0 30px rgba(0, 240, 255, 0.25), 0 0 60px rgba(0, 240, 255, 0.1)'
              : '0 0 0px transparent',
          }}
          className={`relative flex items-center rounded-xl border transition-colors ${
            isFocused ? 'border-neon-cyan/50 bg-void-light' : 'border-white/10 bg-void-light/50'
          }`}
        >
          <Search className="absolute left-4 w-5 h-5 text-text-muted pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={`Search with ${SEARCH_ENGINES.find(e => e.id === activeEngine)?.name}...`}
            className="h-14 pl-12 pr-28 text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-text-primary placeholder:text-text-muted"
          />
          <Button
            onClick={handleSearch}
            disabled={!query.trim()}
            className="absolute right-2 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/30 font-semibold px-6"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </motion.div>

        <p className="text-center text-text-muted text-xs mt-3">
          Search the web — powered by {SEARCH_ENGINES.find(e => e.id === activeEngine)?.name}
        </p>
      </div>
    </section>
  );
}
