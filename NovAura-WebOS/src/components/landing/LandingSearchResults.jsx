import React from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, Image as ImageIcon, Video, Youtube, Sparkles, 
  ExternalLink, Eye, Clock, Calendar, User
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export default function LandingSearchResults({ results, query, type }) {
  if (!results) return null;

  const renderWebResults = () => {
    const items = results.results || [];
    if (items.length === 0) return <EmptyState />;

    return (
      <div className="space-y-4">
        {items.map((item, i) => (
          <motion.a
            key={i}
            variants={itemVariants}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-cyan-500/30 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-cyan-400 font-mono tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {item.displayUrl || item.url}
              </span>
            </div>
            <h4 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
              {item.title}
              <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-sm text-white/60 mt-2 leading-relaxed">
              {item.snippet}
            </p>
          </motion.a>
        ))}
      </div>
    );
  };

  const renderImageResults = () => {
    const items = results.images || [];
    if (items.length === 0) return <EmptyState />;

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((img, i) => (
          <motion.a
            key={i}
            variants={itemVariants}
            href={img.source}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10"
          >
            <img
              src={img.thumbnail}
              alt={img.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              <p className="text-[10px] text-white/50 truncate mb-1">{img.displayUrl}</p>
              <p className="text-xs text-white font-medium line-clamp-2">{img.title}</p>
            </div>
          </motion.a>
        ))}
      </div>
    );
  };

  const renderVideoResults = () => {
    const items = results.results || [];
    if (items.length === 0) return <EmptyState />;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((vid, i) => (
          <motion.a
            key={i}
            variants={itemVariants}
            href={vid.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-blue-500/30 transition-all group"
          >
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40">
              <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-medium text-white shadow-lg backdrop-blur-md border border-white/10">
                {vid.duration || 'Video'}
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-blue-500/80 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Video className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <div className="px-1">
              <h4 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                {vid.title}
              </h4>
              <p className="text-xs text-white/50 mt-1 line-clamp-1">{vid.snippet}</p>
            </div>
          </motion.a>
        ))}
      </div>
    );
  };

  const renderYouTubeResults = () => {
    const items = results.results || [];
    if (items.length === 0) return <EmptyState />;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item, i) => (
          <motion.a
            key={i}
            variants={itemVariants}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-3 group"
          >
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-black/40 border border-white/5 group-hover:border-red-500/30 transition-all shadow-xl group-hover:shadow-red-500/10">
              <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/90 text-xs font-semibold text-white shadow-xl backdrop-blur-xl border border-white/20">
                {item.duration}
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center shadow-2xl shadow-red-600/40">
                  <Youtube className="w-8 h-8 text-white fill-current" />
                </div>
              </div>
            </div>
            <div className="flex gap-4 px-2">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-white/5 ring-2 ring-red-500/20 group-hover:ring-red-500/40 transition-all">
                  <img src={item.channelAvatar} alt={item.channelTitle} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-white line-clamp-2 mb-1 group-hover:text-red-400 transition-colors leading-tight">
                  {item.title}
                </h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                  <span className="font-semibold text-white/70 group-hover:text-white transition-colors">
                    {item.channelTitle}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {item.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.publishedAt}
                  </span>
                </div>
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    );
  };

  const renderAIResults = () => {
    return (
      <motion.div
        variants={itemVariants}
        className="relative p-8 rounded-3xl bg-gradient-to-br from-purple-500/[0.05] via-transparent to-blue-500/[0.05] border border-white/10 backdrop-blur-xl"
      >
        <div className="absolute top-0 right-0 p-4">
          <Sparkles className="w-8 h-8 text-purple-400 opacity-20" />
        </div>
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              AI Deep Insights
            </h3>
            <p className="text-sm text-white/40">Powered by NovAura Neural Engine</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-white/80 leading-relaxed text-lg whitespace-pre-wrap">
            {results.insights}
          </p>
        </div>

        {results.fallback && (
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-2 text-xs text-white/30 italic">
            <User className="w-3 h-3" />
            Provider: Dynamic Fallback Path Enabled
          </div>
        )}
      </motion.div>
    );
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
        <ImageIcon className="w-8 h-8 text-white/40" />
      </div>
      <h3 className="text-lg font-medium">No results found for "{query}"</h3>
      <p className="text-sm">Try broadening your search or using different keywords.</p>
    </div>
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-5xl mx-auto mt-12 pb-24"
    >
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors ${
            type === 'web' ? 'bg-cyan-500/20' :
            type === 'images' ? 'bg-green-500/20' :
            type === 'videos' ? 'bg-blue-500/20' :
            type === 'youtube' ? 'bg-red-500/20' : 'bg-purple-500/20'
          }`}>
            {type === 'web' && <Globe className="w-5 h-5 text-cyan-400" />}
            {type === 'images' && <ImageIcon className="w-5 h-5 text-green-400" />}
            {type === 'videos' && <Video className="w-5 h-5 text-blue-400" />}
            {type === 'youtube' && <Youtube className="w-5 h-5 text-red-500" />}
            {type === 'ai' && <Sparkles className="w-5 h-5 text-purple-400" />}
          </div>
          <h2 className="text-2xl font-bold text-white capitalize">{type} Results</h2>
        </div>
        <div className="text-sm text-white/40 font-medium">
          {type === 'ai' ? 'Neural Synthesis' : `Top matches for "${query}"`}
        </div>
      </div>

      {type === 'web' && renderWebResults()}
      {type === 'images' && renderImageResults()}
      {type === 'videos' && renderVideoResults()}
      {type === 'youtube' && renderYouTubeResults()}
      {type === 'ai' && renderAIResults()}

      {results.fallback && type !== 'ai' && (
        <div className="mt-12 p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
          <p className="text-white/60 font-medium mb-4">
            {results.message || 'We couldn\'t find exactly what you were looking for via primary engine.'}
          </p>
          <button
            onClick={() => {
              const url = type === 'youtube' 
                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
                : `https://duckduckgo.com/?q=${encodeURIComponent(query)}${type === 'images' ? '&iax=images&ia=images' : ''}`;
              window.open(url, '_blank');
            }}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10 text-sm font-semibold flex items-center gap-2"
          >
            Open External Engine
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
