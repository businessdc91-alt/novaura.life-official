/**
 * RevenueChart Component
 * Line/area chart for revenue visualization using Recharts
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { TrendingUp, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice, type TimePeriod, type TimeSeriesData } from '@/services/analyticsService';

export interface RevenueChartProps {
  data: TimeSeriesData[];
  title?: string;
  subtitle?: string;
  selectedPeriod?: TimePeriod;
  onPeriodChange?: (period: TimePeriod) => void;
  loading?: boolean;
  className?: string;
  showSalesToggle?: boolean;
  salesData?: TimeSeriesData[];
  viewsData?: TimeSeriesData[];
}

type DataType = 'revenue' | 'sales' | 'views';

const periodOptions: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
];

const dataTypeConfig = {
  revenue: {
    label: 'Revenue',
    color: '#00F0FF',
    gradientFrom: '#00F0FF',
    gradientTo: '#8B5CF6',
    formatter: (value: number) => formatPrice(value),
  },
  sales: {
    label: 'Sales',
    color: '#8B5CF6',
    gradientFrom: '#8B5CF6',
    gradientTo: '#FF006E',
    formatter: (value: number) => value.toLocaleString(),
  },
  views: {
    label: 'Views',
    color: '#39FF14',
    gradientFrom: '#39FF14',
    gradientTo: '#00F0FF',
    formatter: (value: number) => value.toLocaleString(),
  },
};

// Custom Tooltip
function CustomTooltip({
  active,
  payload,
  label,
  dataType,
}: TooltipProps<number, string> & { dataType: DataType }) {
  if (active && payload && payload.length) {
    const value = payload[0].value as number;
    const config = dataTypeConfig[dataType];
    
    return (
      <div className="bg-void-light border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-text-muted text-xs mb-1">
          {new Date(label || '').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <p className="font-heading text-lg font-bold" style={{ color: config.color }}>
          {config.formatter(value)}
        </p>
        <p className="text-text-secondary text-xs">{config.label}</p>
      </div>
    );
  }
  return null;
}

export function RevenueChart({
  data,
  title = 'Revenue Overview',
  subtitle = 'Track your earnings over time',
  selectedPeriod = '30d',
  onPeriodChange,
  loading = false,
  className,
  showSalesToggle = false,
  salesData,
  viewsData,
}: RevenueChartProps) {
  const [dataType, setDataType] = useState<DataType>('revenue');
  
  // Get current data based on selected type
  const currentData = useMemo(() => {
    switch (dataType) {
      case 'sales':
        return salesData || data;
      case 'views':
        return viewsData || data;
      default:
        return data;
    }
  }, [data, salesData, viewsData, dataType]);
  
  // Calculate total
  const total = useMemo(() => {
    return currentData.reduce((sum, item) => sum + item.value, 0);
  }, [currentData]);
  
  // Calculate average
  const average = useMemo(() => {
    return currentData.length > 0 ? total / currentData.length : 0;
  }, [total, currentData.length]);
  
  // Format X-axis labels
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    if (selectedPeriod === '7d') {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    if (selectedPeriod === '1y') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const config = dataTypeConfig[dataType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-white/5 bg-void-light overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-neon-cyan" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-text-primary">
                {title}
              </h3>
              <p className="text-text-secondary text-sm">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Data Type Toggle */}
            {showSalesToggle && (
              <div className="flex items-center gap-1 bg-void rounded-lg p-1">
                {( ['revenue', 'sales', 'views'] as DataType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDataType(type)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize',
                      dataType === type
                        ? 'bg-neon-cyan/20 text-neon-cyan'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
            
            {/* Period Selector */}
            {onPeriodChange && (
              <div className="flex items-center gap-1 bg-void rounded-lg p-1">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onPeriodChange(option.value)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
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
            
            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 hover:border-neon-cyan/50 hover:bg-neon-cyan/5"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-void rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">Total {config.label}</p>
            <p className="font-heading text-xl font-bold text-text-primary">
              {loading ? '-' : config.formatter(total)}
            </p>
          </div>
          <div className="bg-void rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">Daily Average</p>
            <p className="font-heading text-xl font-bold text-text-primary">
              {loading ? '-' : config.formatter(average)}
            </p>
          </div>
          <div className="bg-void rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">Peak Day</p>
            <p className="font-heading text-xl font-bold text-neon-lime">
              {loading
                ? '-'
                : config.formatter(Math.max(...currentData.map((d) => d.value)))}
            </p>
          </div>
          <div className="bg-void rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">Data Points</p>
            <p className="font-heading text-xl font-bold text-neon-violet">
              {currentData.length}
            </p>
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="p-6">
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
              <p className="text-text-secondary text-sm">Loading chart data...</p>
            </div>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={currentData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={config.gradientFrom} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={config.gradientTo} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={config.gradientFrom} />
                    <stop offset="100%" stopColor={config.gradientTo} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXAxis}
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fill: '#6A6A7A', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fill: '#6A6A7A', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    dataType === 'revenue'
                      ? `$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`
                      : value >= 1000
                      ? (value / 1000).toFixed(1) + 'k'
                      : value
                  }
                />
                <Tooltip
                  content={<CustomTooltip dataType={dataType} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="url(#strokeGradient)"
                  strokeWidth={3}
                  fill="url(#colorGradient)"
                  animationDuration={1500}
                  animationBegin={0}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5 bg-void/50">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Calendar className="w-4 h-4" />
          <span>
            Showing data from{' '}
            {currentData.length > 0 &&
              new Date(currentData[0].date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}{' '}
            to{' '}
            {currentData.length > 0 &&
              new Date(currentData[currentData.length - 1].date).toLocaleDateString(
                'en-US',
                {
                  month: 'long',
                  day: 'numeric',
                }
              )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default RevenueChart;
