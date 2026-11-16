/**
 * Analytics Service
 * Client-side service to fetch and display analytics data
 * Frontend-only: Polsia provides analytics data via API
 */

import { formatPrice, formatNumber } from '@/utils/format';

// Types
export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface TopAsset {
  id: string;
  title: string;
  sales: number;
  revenue: number;
  views: number;
  thumbnailUrl?: string;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalSales: number;
  totalViews: number;
  conversionRate: number;
  averageOrderValue: number;
  revenueGrowth: number;
  salesGrowth: number;
  viewsGrowth: number;
}

export interface AnalyticsData {
  revenue: TimeSeriesData[];
  sales: TimeSeriesData[];
  views: TimeSeriesData[];
  topAssets: TopAsset[];
  summary: AnalyticsSummary;
}

export interface AssetAnalytics {
  assetId: string;
  revenue: TimeSeriesData[];
  sales: TimeSeriesData[];
  views: TimeSeriesData[];
  downloads: TimeSeriesData[];
  summary: {
    totalRevenue: number;
    totalSales: number;
    totalViews: number;
    totalDownloads: number;
    revenueGrowth: number;
    salesGrowth: number;
    viewsGrowth: number;
  };
}

export type TimePeriod = '7d' | '30d' | '90d' | '1y';

// Generate zeroed time series data (shape preserved for callers)
function generateTimeSeriesData(
  days: number,
  _baseValue: number,
  _variance: number,
  _growthTrend: number = 0
): TimeSeriesData[] {
  const data: TimeSeriesData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      value: 0,
    });
  }

  return data;
}

// Get days count from period
function getDaysFromPeriod(period: TimePeriod): number {
  switch (period) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
    default:
      return 30;
  }
}

// Empty analytics data for a given period
function generateEmptyAnalytics(period: TimePeriod): AnalyticsData {
  const days = getDaysFromPeriod(period);

  const revenueData = generateTimeSeriesData(days, 0, 0);
  const salesData = generateTimeSeriesData(days, 0, 0);
  const viewsData = generateTimeSeriesData(days, 0, 0);

  return {
    revenue: revenueData,
    sales: salesData,
    views: viewsData,
    topAssets: [],
    summary: {
      totalRevenue: 0,
      totalSales: 0,
      totalViews: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      revenueGrowth: 0,
      salesGrowth: 0,
      viewsGrowth: 0,
    },
  };
}

// Empty asset analytics for a given period
function generateEmptyAssetAnalytics(assetId: string, period: TimePeriod): AssetAnalytics {
  const days = getDaysFromPeriod(period);

  return {
    assetId,
    revenue: generateTimeSeriesData(days, 0, 0),
    sales: generateTimeSeriesData(days, 0, 0),
    views: generateTimeSeriesData(days, 0, 0),
    downloads: generateTimeSeriesData(days, 0, 0),
    summary: {
      totalRevenue: 0,
      totalSales: 0,
      totalViews: 0,
      totalDownloads: 0,
      revenueGrowth: 0,
      salesGrowth: 0,
      viewsGrowth: 0,
    },
  };
}

/**
 * Fetch analytics data for a creator
 */
export async function getCreatorAnalytics(
  _creatorId: string,
  period: TimePeriod = '30d'
): Promise<AnalyticsData> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return generateEmptyAnalytics(period);
}

/**
 * Fetch analytics data for a specific asset
 */
export async function getAssetAnalytics(
  assetId: string,
  period: TimePeriod = '30d'
): Promise<AssetAnalytics> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  return generateEmptyAssetAnalytics(assetId, period);
}

/**
 * Calculate growth percentage between two values
 */
export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get trend direction based on growth value
 */
export function getTrendDirection(growth: number): 'up' | 'down' | 'neutral' {
  if (growth > 0.1) return 'up';
  if (growth < -0.1) return 'down';
  return 'neutral';
}

/**
 * Format growth percentage for display
 */
export function formatGrowth(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// Re-export format functions for convenience
export { formatPrice, formatNumber };
