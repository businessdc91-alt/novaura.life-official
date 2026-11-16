import { Shield } from 'lucide-react';
import type { PioneerBadge, PioneerBadgeTier } from '@/types';
import { BADGE_LABELS, BADGE_COLORS } from '@/services/pioneerBadgeService';
import { cn } from '@/lib/utils';

interface Props {
  badge: PioneerBadge;
  size?: 'sm' | 'md' | 'lg';
  showTerm?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 14, text: 'text-[10px]', padding: 'px-1.5 py-0.5', gap: 'gap-1' },
  md: { icon: 16, text: 'text-xs', padding: 'px-2 py-1', gap: 'gap-1.5' },
  lg: { icon: 20, text: 'text-sm', padding: 'px-3 py-1.5', gap: 'gap-2' },
};

export function PioneerBadgeShield({ badge, size = 'md', showTerm = false, className }: Props) {
  const colors = BADGE_COLORS[badge.tier];
  const s = sizeMap[size];

  return (
    <span
      title={`${BADGE_LABELS[badge.tier]} — "${badge.searchTermDisplay}"`}
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        colors.bg,
        colors.border,
        colors.text,
        s.padding,
        s.gap,
        className
      )}
    >
      <Shield size={s.icon} className="shrink-0" />
      <span className={s.text}>
        {BADGE_LABELS[badge.tier]}
        {showTerm && <span className="opacity-70"> · {badge.searchTermDisplay}</span>}
      </span>
    </span>
  );
}

/** Render a row of badges for a user profile or card. */
export function PioneerBadgeRow({
  badges,
  max = 5,
  size = 'sm',
}: {
  badges: PioneerBadge[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const visible = badges.slice(0, max);
  const overflow = badges.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((b) => (
        <PioneerBadgeShield key={b.id} badge={b} size={size} showTerm />
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

/** Compact tier label without a full badge object — for display-only use. */
export function PioneerTierChip({ tier, className }: { tier: PioneerBadgeTier; className?: string }) {
  const colors = BADGE_COLORS[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        colors.bg,
        colors.border,
        colors.text,
        className
      )}
    >
      <Shield size={12} />
      {BADGE_LABELS[tier]}
    </span>
  );
}
