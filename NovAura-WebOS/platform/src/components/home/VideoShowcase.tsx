import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, MonitorPlay } from 'lucide-react';
import { getEmbedUrl } from '@/utils/video';

export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  type: 'youtube' | 'vimeo' | 'direct';
  url: string;
  thumbnail?: string;
}

interface VideoShowcaseProps {
  videos: VideoItem[];
  className?: string;
}

export default function VideoShowcase({ videos, className = '' }: VideoShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (videos.length === 0) return null;

  const active = videos[activeIndex];
  const embedUrl = getEmbedUrl(active.url, active.type);

  return (
    <section className={`py-16 lg:py-24 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-magenta/10 border border-neon-magenta/30 mb-4">
            <MonitorPlay className="w-3 h-3 text-neon-magenta" />
            <span className="text-[10px] text-neon-magenta font-bold uppercase tracking-widest">
              Spotlight
            </span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary">
            Featured <span className="text-neon-magenta">Content</span>
          </h2>
        </motion.div>

        {/* Main Video Player */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative aspect-video max-w-4xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-void shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        >
          {active.type === 'direct' ? (
            <video
              src={active.url}
              controls
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <iframe
              src={embedUrl}
              title={active.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          )}
        </motion.div>

        {/* Video Info */}
        <div className="max-w-4xl mx-auto mt-4">
          <h3 className="text-lg font-semibold text-text-primary">{active.title}</h3>
          {active.description && (
            <p className="text-sm text-text-secondary mt-1">{active.description}</p>
          )}
        </div>

        {/* Thumbnail Strip */}
        {videos.length > 1 && (
          <div className="flex gap-3 mt-6 max-w-4xl mx-auto overflow-x-auto pb-2">
            {videos.map((video, i) => (
              <button
                key={video.id}
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 w-40 rounded-lg overflow-hidden border-2 transition-all ${
                  i === activeIndex
                    ? 'border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'border-white/10 hover:border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-void-light flex items-center justify-center">
                    <Play className="w-6 h-6 text-text-muted" />
                  </div>
                )}
                <p className="text-[10px] text-text-muted p-1.5 truncate">{video.title}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
