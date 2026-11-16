import { apiClient } from '@/services/apiClient';
import { kernelStorage } from '@/kernel/kernelStorage.js';

type RouteRepairConfidence = 'high' | 'medium';

interface RouteRepairRule {
  targetPath: string;
  reason: string;
  confidence: RouteRepairConfidence;
}

export interface RouteRepairResult {
  originalPath: string;
  normalizedPath: string;
  repairedPath: string;
  wasRepaired: boolean;
  rule?: RouteRepairRule;
}

export interface RouteRepairEvent {
  source: 'router-guard' | 'link-click' | 'manual';
  fromPath: string;
  toPath: string;
  reason?: string;
  confidence?: RouteRepairConfidence;
  search?: string;
  hash?: string;
  timestamp: string;
}

const LOCAL_ROUTE_REPAIR_LOG_KEY = 'novaura_route_repair_log';
const MAX_LOCAL_LOG_SIZE = 25;

const ROUTE_REPAIR_RULES: Record<string, RouteRepairRule> = {
  '/marketplace': {
    targetPath: '/browse',
    reason: 'Legacy marketplace path',
    confidence: 'high',
  },
  '/upload': {
    targetPath: '/creator/assets/new',
    reason: 'Legacy creator upload path',
    confidence: 'high',
  },
  '/creator/upload': {
    targetPath: '/creator/assets/new',
    reason: 'Legacy creator upload path',
    confidence: 'high',
  },
  '/creator/analytics': {
    targetPath: '/creator/earnings',
    reason: 'Analytics route merged into earnings',
    confidence: 'medium',
  },
  '/settings/notifications': {
    targetPath: '/notifications',
    reason: 'Notification settings consolidated',
    confidence: 'high',
  },
  '/admin': {
    targetPath: '/admin/dashboard',
    reason: 'Admin home path changed',
    confidence: 'high',
  },
  '/docs': {
    targetPath: '/help',
    reason: 'Docs path replaced by help center',
    confidence: 'high',
  },
  '/legal/faq': {
    targetPath: '/help',
    reason: 'FAQ moved under help center',
    confidence: 'high',
  },
  '/legal/indemnification': {
    targetPath: '/legal/terms',
    reason: 'Indemnification policy folded into legal terms',
    confidence: 'medium',
  },
  '/studio': {
    targetPath: '/music-studio',
    reason: 'Studio route now points to music studio',
    confidence: 'high',
  },
};

function normalizeRoutePath(path: string): string {
  if (!path) return '/';

  const withoutQuery = path.split('?')[0] || '/';
  const withoutHash = withoutQuery.split('#')[0] || '/';
  const withLeadingSlash = withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

export function getRouteRepair(path: string): RouteRepairResult {
  const normalizedPath = normalizeRoutePath(path);
  const rule = ROUTE_REPAIR_RULES[normalizedPath];

  if (!rule) {
    return {
      originalPath: path,
      normalizedPath,
      repairedPath: normalizedPath,
      wasRepaired: false,
    };
  }

  return {
    originalPath: path,
    normalizedPath,
    repairedPath: rule.targetPath,
    wasRepaired: true,
    rule,
  };
}

function appendLocalRepairLog(event: RouteRepairEvent): void {
  try {
    const raw = kernelStorage.getItem(LOCAL_ROUTE_REPAIR_LOG_KEY);
    const existing = raw ? (JSON.parse(raw) as RouteRepairEvent[]) : [];
    const updated = [event, ...existing].slice(0, MAX_LOCAL_LOG_SIZE);
    kernelStorage.setItem(LOCAL_ROUTE_REPAIR_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage failures to avoid disrupting navigation.
  }
}

export async function reportRouteRepairEvent(event: RouteRepairEvent): Promise<void> {
  appendLocalRepairLog(event);

  try {
    await apiClient.post('/diagnostics/route-repair', event);
  } catch {
    // Endpoint is optional; local logging still captures the repair.
  }
}

export function getRouteRepairRules(): Record<string, RouteRepairRule> {
  return ROUTE_REPAIR_RULES;
}
