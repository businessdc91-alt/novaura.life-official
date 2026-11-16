import { Link } from 'react-router-dom';
import { Globe, Server, ShoppingBag, ArrowRight } from 'lucide-react';

type AdSize = 'leaderboard' | 'medium-rectangle' | 'billboard' | 'mobile-banner';

const SIZE_MAP: Record<AdSize, { width: number; height: number }> = {
  leaderboard: { width: 728, height: 90 },
  'medium-rectangle': { width: 300, height: 250 },
  billboard: { width: 970, height: 250 },
  'mobile-banner': { width: 320, height: 50 },
};

// Self-promo fallbacks — real NovAura service promotions
const FALLBACK_PROMOS = [
  {
    title: 'Claim Your .life Domain',
    desc: 'Get your @novaura.life email and custom domain',
    href: '/domains',
    icon: Globe,
    color: 'neon-cyan',
  },
  {
    title: 'NovAura Hosting',
    desc: 'Deploy your projects with 99.99% uptime',
    href: '/hosting',
    icon: Server,
    color: 'neon-violet',
  },
  {
    title: 'Creator Marketplace',
    desc: 'Sell your assets — earn fair royalties',
    href: '/browse',
    icon: ShoppingBag,
    color: 'neon-magenta',
  },
];

interface AdSlotProps {
  size: AdSize;
  position: string;
  promoIndex?: number;
  className?: string;
}

export default function AdSlot({ size, position, promoIndex = 0, className = '' }: AdSlotProps) {
  const dims = SIZE_MAP[size];
  const promo = FALLBACK_PROMOS[promoIndex % FALLBACK_PROMOS.length];
  const Icon = promo.icon;

  const isLeaderboard = size === 'leaderboard' || size === 'billboard' || size === 'mobile-banner';

  return (
    <div
      data-ad-slot={position}
      data-ad-size={`${dims.width}x${dims.height}`}
      className={`mx-auto overflow-hidden rounded-xl border border-white/5 bg-void-light/30 ${
        isLeaderboard ? 'hidden sm:block' : ''
      } ${className}`}
      style={{ maxWidth: dims.width }}
    >
      <Link
        to={promo.href}
        className={`flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${
          isLeaderboard ? 'flex-row justify-center' : 'flex-col text-center py-8'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg bg-${promo.color}/10 flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 text-${promo.color}`} />
        </div>
        <div className={isLeaderboard ? '' : 'mt-2'}>
          <p className="text-sm font-semibold text-text-primary">{promo.title}</p>
          <p className="text-xs text-text-muted">{promo.desc}</p>
        </div>
        <ArrowRight className={`w-4 h-4 text-text-muted shrink-0 ${isLeaderboard ? '' : 'mx-auto mt-2'}`} />
      </Link>
    </div>
  );
}
