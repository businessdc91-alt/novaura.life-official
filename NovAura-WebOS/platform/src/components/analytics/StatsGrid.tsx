/**
 * StatsGrid Component
 * Grid layout for multiple AnalyticsCards with pre-configured stat types
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ShoppingCart,
  Eye,
  Percent,
  Package,
  Trophy,
  TrendingUp,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { AnalyticsCard } from './AnalyticsCard';
import { RevenueChart } from './RevenueChart';
import {
  getCreatorAnalytics,
  formatPrice,
  formatNumber,
  type TimePeriod,
  type AnalyticsData,
} from '@/services/analyticsService';
import { cn } from '@/lib/utils';

export interface StatsGridProps {
  creatorId?: string;
  className?: string;
  showChart?: boolean;
  showTopAssets?: boolean;
}

interface StatConfig {
  key: keyof AnalyticsData['summary'];
  title: string;
  icon: LucideIcon;
  iconColor: 'cyan' | 'violet' | 'magenta' | 'lime' | 'red';
  format: 'currency' | 'number' | 'percent';
}

const statConfigs: StatConfig[] = [
  {
    key: 'totalRevenue',
    title: 'Total Revenue',
    icon: DollarSign,
    iconColor: 'cyan',
    format: 'currency',
  },
  {
    key: 'totalSales',
    title: 'Total Sales',
    icon: ShoppingCart,
    iconColor: 'violet',
    format: 'number',
  },
  {
    key: 'totalViews',
    title: 'Total Views',
    icon: Eye,
    iconColor: 'lime',
    format: 'number',
  },
  {
    key: 'conversionRate',
    title: 'Conversion Rate',
    icon: Percent,
    iconColor: 'magenta',
    format: 'percent',
  },
  {
    key: 'averageOrderValue',
    title: 'Avg Order Value',
    icon: Package,
    iconColor: 'cyan',
    format: 'currency',
  },
  {
    key: 'revenueGrowth',
    title: 'Revenue Growth',
    icon: TrendingUp,
    iconColor: 'lime',
    format: 'percent',
  },
];

export function StatsGrid({
  creatorId = 'current-user',
  className,
  showChart = true,
  showTopAssets = true,
}: StatsGridProps) {
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const data = await getCreatorAnalytics(creatorId, period);
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [creatorId, period]);
  
  // Format value based on config
  const formatValue = (value: number, format: StatConfig['format']) => {
    switch (format) {
      case 'currency':
        return formatPrice(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return formatNumber(value);
    }
  };
  
  // Get growth value for a stat
  const getGrowthValue = (config: StatConfig): number => {
    if (!analytics) return 0;
    
    switch (config.key) {
      case 'totalRevenue':
        return analytics.summary.revenueGrowth;
      case 'totalSales':
        return analytics.summary.salesGrowth;
      case 'totalViews':
        return analytics.summary.viewsGrowth;
      default:
        return 0;
    }
  };

  return (
    <div className={cn('space-y-8', className)}>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statConfigs.map((config, index) => {
          const value = analytics?.summary[config.key] || 0;
          const growth = getGrowthValue(config);
          
          return (
            <motion.div
              key={config.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <AnalyticsCard
                title={config.title}
                value={formatValue(value, config.format)}
                change={growth}
                icon={config.icon}
                iconColor={config.iconColor}
                selectedPeriod={period}
                onPeriodChange={(newPeriod) => {
                  setPeriod(newPeriod);
                  // Notify parent if needed
                }}
                loading={loading}
              />
            </motion.div>
          );
        })}
      </div>
      
      {/* Chart Section */}
      {showChart && analytics && (
        <RevenueChart
          data={analytics.revenue}
          salesData={analytics.sales}
          viewsData={analytics.views}
          selectedPeriod={period}
          onPeriodChange={setPeriod}
          loading={loading}
          showSalesToggle
          className="shadow-card"
        />
      )}
      
      {/* Top Assets Section */}
      {showTopAssets && analytics && analytics.topAssets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-white/5 bg-void-light overflow-hidden"
        >
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-magenta/20 to-neon-violet/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-neon-magenta" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary">
                  Top Performing Assets
                </h3>
                <p className="text-text-secondary text-sm">
                  Your best-selling assets this period
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {analytics.topAssets.slice(0, 5).map((asset, index) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl',
                    'bg-void hover:bg-void-lighter transition-colors',
                    'group cursor-pointer'
                  )}
                >
                  {/* Rank */}
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <span
                      className={cn(
                        'font-heading font-bold',
                        index === 0
                          ? 'text-neon-cyan'
                          : index === 1
                          ? 'text-neon-violet'
                          : index === 2
                          ? 'text-neon-magenta'
                          : 'text-text-muted'
                      )}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-void-light overflow-hidden flex-shrink-0">
                    {asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-text-muted" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <h4 className="font-medium text-text-primary truncate group-hover:text-neon-cyan transition-colors">
                      {asset.title}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        {asset.sales} sales
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatNumber(asset.views)} views
                      </span>
                    </div>
                  </div>
                  
                  {/* Revenue */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-heading text-lg font-bold text-neon-cyan">
                      {formatPrice(asset.revenue)}
                    </p>
                    <p className="text-text-muted text-xs">
                      {((asset.sales / analytics.summary.totalSales) * 100).toFixed(1)}% of sales
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Simple grid variant for basic usage
export interface SimpleStatsGridProps {
  stats: Array<{
    title: string;
    value: string | number;
    change?: number;
    icon: LucideIcon;
    iconColor?: 'cyan' | 'violet' | 'magenta' | 'lime' | 'red';
  }>;
  className?: string;
  columns?: 2 | 3 | 4 | 6;
}

export function SimpleStatsGrid({
  stats,
  className,
  columns = 4,
}: SimpleStatsGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <AnalyticsCard
            title={stat.title}
            value={stat.value}
            change={stat.change}
            icon={stat.icon}
            iconColor={stat.iconColor || 'cyan'}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default StatsGrid;
