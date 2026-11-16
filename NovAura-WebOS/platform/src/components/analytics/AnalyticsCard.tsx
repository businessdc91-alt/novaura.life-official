/**
 * AnalyticsCard Component
 * Reusable stat card with trend indicator, icon, and time period selector
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGrowth, type TimePeriod } from '@/services/analyticsService';

export interface AnalyticsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: 'cyan' | 'violet' | 'magenta' | 'lime' | 'red';
  selectedPeriod?: TimePeriod;
  onPeriodChange?: (period: TimePeriod) => void;
  loading?: boolean;
  className?: string;
}

const periodOptions: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

const iconColorClasses = {
  cyan: {
    bg: 'bg-neon-cyan/10',
    text: 'text-neon-cyan',
    glow: 'group-hover:shadow-glow-cyan',
  },
  violet: {
    bg: 'bg-neon-violet/10',
    text: 'text-neon-violet',
    glow: 'group-hover:shadow-glow-violet',
  },
  magenta: {
    bg: 'bg-neon-magenta/10',
    text: 'text-neon-magenta',
    glow: 'group-hover:shadow-glow-magenta',
  },
  lime: {
    bg: 'bg-neon-lime/10',
    text: 'text-neon-lime',
    glow: 'group-hover:shadow-glow-lime',
  },
  red: {
    bg: 'bg-neon-red/10',
    text: 'text-neon-red',
    glow: 'group-hover:shadow-glow-red',
  },
};

export function AnalyticsCard({
  title,
  value,
  change = 0,
  changeLabel = 'vs last period',
  icon: Icon,
  iconColor = 'cyan',
  selectedPeriod = '30d',
  onPeriodChange,
  loading = false,
  className,
}: AnalyticsCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const colors = iconColorClasses[iconColor];
  const isPositive = change > 0;
  const isNegative = change < 0;
  
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColorClass = isPositive
    ? 'text-neon-lime'
    : isNegative
    ? 'text-neon-red'
    : 'text-text-muted';
  const trendBgClass = isPositive
    ? 'bg-neon-lime/10'
    : isNegative
    ? 'bg-neon-red/10'
    : 'bg-white/5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/5 bg-void-light p-6',
        'transition-all duration-300 ease-out',
        'hover:border-neon-cyan/30 hover:shadow-glow-cyan',
        className
      )}
    >
      {/* RGB Glow Effect on Hover */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-500',
          'bg-gradient-to-br from-neon-cyan/5 via-neon-violet/5 to-neon-magenta/5',
          isHovered && 'opacity-100'
        )}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          {/* Icon */}
          <motion.div
            animate={{
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 5 : 0,
            }}
            transition={{ duration: 0.3 }}
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              'transition-all duration-300',
              colors.bg,
              colors.glow
            )}
          >
            <Icon className={cn('w-6 h-6', colors.text)} />
          </motion.div>
          
          {/* Period Selector */}
          {onPeriodChange && (
            <div className="flex items-center gap-1 bg-void rounded-lg p-1">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onPeriodChange(option.value)}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-md transition-all',
                    selectedPeriod === option.value
                      ? 'bg-neon-cyan/20 text-neon-cyan'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Value */}
        <div className="mb-3">
          {loading ? (
            <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
          ) : (
            <motion.p
              key={String(value)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="font-heading text-3xl font-bold text-text-primary tracking-tight"
            >
              {value}
            </motion.p>
          )}
        </div>
        
        {/* Title */}
        <p className="text-text-secondary text-sm mb-3">{title}</p>
        
        {/* Trend Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              trendBgClass,
              trendColorClass
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {formatGrowth(change)}
          </span>
          <span className="text-text-muted text-xs">{changeLabel}</span>
        </div>
      </div>
      
      {/* Animated Border Gradient */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl pointer-events-none',
          'bg-gradient-to-r from-neon-cyan/0 via-neon-violet/0 to-neon-magenta/0',
          'opacity-0 transition-opacity duration-500',
          isHovered && 'opacity-20'
        )}
        style={{
          backgroundSize: '200% 200%',
          animation: isHovered ? 'border-flow 3s ease infinite' : 'none',
        }}
      />
    </motion.div>
  );
}

export default AnalyticsCard;
