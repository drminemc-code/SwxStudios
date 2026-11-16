import React from 'react';
import { Download, Flame, Lock } from 'lucide-react';
import { MembershipTier, ResourceItem } from '../types';
import { canAccessResource, getEffectiveResourceTier } from '../utils/catalogLogic';
import { ResourceArtwork } from './ResourceArtwork';

interface ResourceCardProps {
  resource: ResourceItem;
  variant: 'trending' | 'catalog';
  rankIndex?: number;
  isPremium: boolean;
  membershipTier?: MembershipTier;
  purchasedIds?: string[];
  onSelect: (resource: ResourceItem) => void;
  onDownload: (resource: ResourceItem) => void;
}

function getTierBadgeDisplay(resource: ResourceItem): {
  label: string;
  className: string;
} {
  const tier = getEffectiveResourceTier(resource);
  if (tier === 'ultimate') {
    return {
      label: resource.priceLabel ? `Ultimate · ${resource.priceLabel}` : 'Ultimate',
      className: 'text-violet-300',
    };
  }
  if (tier === 'premium') {
    return {
      label: 'Premium',
      className: 'text-amber-300',
    };
  }
  if (tier === 'paid') {
    return {
      label: resource.priceLabel ? `Paid · ${resource.priceLabel}` : 'Paid',
      className: 'text-sky-300',
    };
  }
  return {
    label: 'Free',
    className: 'text-emerald-300',
  };
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  variant,
  rankIndex,
  isPremium,
  membershipTier = isPremium ? 'premium' : 'free',
  purchasedIds = [],
  onSelect,
  onDownload,
}) => {
  const effectiveTier = getEffectiveResourceTier(resource);
  const unlocked = canAccessResource(resource, membershipTier, { isPremium, purchasedIds });
  const locked = !unlocked;
  const tierDisplay = getTierBadgeDisplay(resource);

  const lockedLabel =
    effectiveTier === 'ultimate'
      ? 'Unlock Ultimate'
      : effectiveTier === 'paid'
      ? resource.priceLabel
        ? `Buy · ${resource.priceLabel}`
        : 'Unlock Paid'
      : 'Unlock Premium';

  if (variant === 'trending') {
    return (
      <article className="group flex flex-col overflow-hidden rounded-lg border border-zinc-800/90 bg-[#111114] transition-transform duration-150 hover:-translate-y-0.5 hover:border-zinc-700">
        <button
          type="button"
          onClick={() => onSelect(resource)}
          aria-label={`Inspect ${resource.title}`}
          className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-950">
            <ResourceArtwork theme={resource.artwork} title={resource.title} />
            {resource.popular && (
              <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded bg-white/95 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-zinc-950 uppercase">
                <Flame className="h-3 w-3" aria-hidden="true" />
                POPULAR
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-between p-3.5">
            <div>
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                <span className={`font-display-mono uppercase ${tierDisplay.className}`}>
                  {tierDisplay.label}
                </span>
                <span className="text-[11px] font-normal text-zinc-500">
                  {resource.mcVersions}
                </span>
              </div>
              <h3 className="mt-1 truncate text-sm font-bold text-zinc-100 group-hover:text-white">
                {resource.title}
              </h3>
              <p className="mt-1 line-clamp-1 text-xs text-zinc-400">
                {resource.subtitle}
              </p>
            </div>

            <div className="mt-3.5 flex items-center justify-between text-xs text-zinc-400 tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-200">
                <Download className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                {resource.downloads}
              </span>
              <span className="text-[11px] text-zinc-500">{resource.category}</span>
            </div>
          </div>
        </button>
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-zinc-800/90 bg-[#111114] transition-transform duration-150 hover:-translate-y-0.5 hover:border-zinc-700">
      <button
        type="button"
        onClick={() => onSelect(resource)}
        aria-label={`Inspect ${resource.title}`}
        className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-950">
          <ResourceArtwork theme={resource.artwork} title={resource.title} />
          {typeof rankIndex === 'number' && (
            <span className="font-display-mono absolute right-2 top-2 rounded bg-zinc-950/90 px-1.5 py-0.5 text-[11px] font-bold text-zinc-200 border border-zinc-700/80 tabular-nums">
              #{rankIndex}
            </span>
          )}
          {resource.popular && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-zinc-950">
              <Flame className="h-3 w-3" aria-hidden="true" />
              Popular
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between p-3.5 pb-2.5">
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
              <span className={`font-display-mono uppercase ${tierDisplay.className}`}>
                {tierDisplay.label}
              </span>
              <span className="font-normal text-zinc-500">{resource.version}</span>
            </div>
            <h3 className="mt-1 truncate text-sm font-bold text-zinc-100 group-hover:text-white">
              {resource.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
              {resource.subtitle}
            </p>
          </div>

          <div className="mt-3.5 flex items-end justify-between gap-2 text-xs tabular-nums">
            <div>
              <p className="font-bold text-zinc-100">{resource.downloads}</p>
              <p className="text-[11px] text-zinc-500">downloads</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-zinc-100">{resource.rating.toFixed(1)}</p>
              <p className="text-[11px] text-zinc-500">Rating</p>
            </div>
          </div>
        </div>
      </button>

      <div className="px-3.5 pb-3.5 pt-1">
        <button
          type="button"
          onClick={() => onDownload(resource)}
          aria-label={locked ? `${lockedLabel} for ${resource.title}` : `Download ${resource.title}`}
          className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            locked
              ? effectiveTier === 'ultimate'
                ? 'border border-violet-400/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
                : effectiveTier === 'paid'
                ? 'border border-sky-400/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                : 'border border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
              : 'bg-white text-zinc-950 hover:bg-zinc-200'
          }`}
        >
          {locked ? (
            <>
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lockedLabel}</span>
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Download</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
