import React from 'react';
import { Crown, Shield, ShieldCheck, Sparkles, Star, Users, Wrench } from 'lucide-react';
import type { ServerRankId } from '../types';
import { getServerRankMeta } from '../utils/ranksAndFriendsLogic';

interface ServerRankBadgeProps {
  rankId: ServerRankId;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function serverRankIcon(rankId: ServerRankId, className = 'h-3 w-3') {
  switch (rankId) {
    case 'owner':
      return <Crown className={className} aria-hidden="true" />;
    case 'admin':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'staff':
      return <Wrench className={className} aria-hidden="true" />;
    case 'support':
      return <Shield className={className} aria-hidden="true" />;
    case 'ultimate':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'paid':
      return <Star className={className} aria-hidden="true" />;
    case 'member':
    case 'free':
    default:
      return <Users className={className} aria-hidden="true" />;
  }
}

export const ServerRankBadge: React.FC<ServerRankBadgeProps> = ({
  rankId,
  size = 'sm',
  showIcon = false,
  className = '',
}) => {
  const meta = getServerRankMeta(rankId);
  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px] gap-1'
      : size === 'md'
      ? 'px-2.5 py-1 text-xs gap-1.5'
      : 'px-2 py-0.5 text-[11px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded border bg-[#12131a] font-semibold tracking-tight text-zinc-100 whitespace-nowrap ${sizeClasses} ${className}`}
      style={{
        borderColor: `${meta.hexColor}55`,
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: meta.hexColor }}
        aria-hidden="true"
      />
      {showIcon && (
        <span style={{ color: meta.hexColor }}>
          {serverRankIcon(rankId, size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3')}
        </span>
      )}
      <span>{meta.label}</span>
    </span>
  );
};
