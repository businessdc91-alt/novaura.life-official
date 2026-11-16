import { Crown, Shield, Sparkles, Award, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export type BadgeType = 'crown' | 'green_phat' | 'creator_pro' | 'dev_core' | 'elder' | 'legend';

interface UserBadgeProps {
  type: BadgeType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const UserBadge = ({ type, size = 'md', showLabel = false, className = '' }: UserBadgeProps) => {
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 24;
  
  const getBadgeConfig = () => {
    switch (type) {
      case 'crown':
        return {
          icon: Crown,
          color: 'text-yellow-400',
          glow: 'shadow-[0_0_10px_rgba(250,204,21,0.5)]',
          label: 'Founder'
        };
      case 'green_phat':
        return {
          icon: Crown, // Will style this as the "Legendary Green P-hat"
          color: 'text-[#00FF00]',
          glow: 'shadow-[0_0_15px_rgba(0,255,0,0.8)] filter drop-shadow(0 0 5px #00FF00)',
          label: 'Legend'
        };
      case 'dev_core':
        return {
          icon: Shield,
          color: 'text-neon-cyan',
          glow: 'shadow-[0_0_10px_rgba(0,240,255,0.5)]',
          label: 'Core Dev'
        };
      case 'creator_pro':
        return {
          icon: Sparkles,
          color: 'text-neon-magenta',
          glow: 'shadow-[0_0_10px_rgba(255,0,255,0.5)]',
          label: 'Creator Pro'
        };
      case 'legend':
        return {
          icon: Star,
          color: 'text-white',
          glow: 'shadow-[0_0_10px_rgba(255,255,255,0.5)]',
          label: 'W48 Legend'
        };
      default:
        return {
          icon: Award,
          color: 'text-text-muted',
          glow: '',
          label: 'Contributor'
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={config.label}
    >
      <div className={`${config.color} ${config.glow} transition-all duration-300 relative`}>
        <Icon size={iconSize} fill={type === 'green_phat' || type === 'crown' ? 'currentColor' : 'none'} />
        {type === 'green_phat' && (
          <div className="absolute inset-0 bg-green-500/20 blur-md rounded-full -z-10 animate-pulse" />
        )}
      </div>
      {showLabel && (
        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
          {config.label}
        </span>
      )}
    </motion.div>
  );
};
