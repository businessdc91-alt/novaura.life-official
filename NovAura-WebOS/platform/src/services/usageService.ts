import { kernelStorage } from '@/kernel/kernelStorage.js';
/**
 * usageService.ts
 * Manages daily usage limits for AI interactions to prevent abuse while allowing free standard chat.
 */

const STORAGE_KEY = 'novaura_daily_usage';
const DAILY_INTERACTION_LIMIT = 1000; // Simulating ~1m tokens equivalent for standard use cases

interface UsageRecord {
  count: number;
  lastReset: string;
}

const getUsage = (): UsageRecord => {
  const data = kernelStorage.getItem(STORAGE_KEY);
  if (!data) return { count: 0, lastReset: new Date().toISOString() };
  
  const record: UsageRecord = JSON.parse(data);
  const lastResetDate = new Date(record.lastReset);
  const now = new Date();
  
  // Reset if more than 24 hours have passed or if it's a new calendar day
  if (
    now.getTime() - lastResetDate.getTime() > 24 * 60 * 60 * 1000 ||
    now.getDate() !== lastResetDate.getDate()
  ) {
    return { count: 0, lastReset: now.toISOString() };
  }
  
  return record;
};

const saveUsage = (record: UsageRecord) => {
  kernelStorage.setItem(STORAGE_KEY, JSON.stringify(record));
};

export const usageService = {
  /**
   * Checks if the user is within their daily free AI usage limits.
   */
  canUseAI: (): boolean => {
    const usage = getUsage();
    return usage.count < DAILY_INTERACTION_LIMIT;
  },

  /**
   * Increments the AI usage counter.
   */
  incrementUsage: () => {
    const usage = getUsage();
    usage.count += 1;
    saveUsage(usage);
  },

  /**
   * Gets the remaining free interactions for the day.
   */
  getRemainingUsage: (): number => {
    const usage = getUsage();
    return Math.max(0, DAILY_INTERACTION_LIMIT - usage.count);
  },

  /**
   * Gets the percentage of usage used.
   */
  getUsagePercentage: (): number => {
    const usage = getUsage();
    return (usage.count / DAILY_INTERACTION_LIMIT) * 100;
  }
};
