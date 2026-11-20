import React, { useState } from 'react';
import { Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { MembershipTier, ResourceItem } from '../types';
import { filterResources, getEffectiveResourceTier } from '../utils/catalogLogic';
import { ResourceCard } from './ResourceCard';

interface ExclusiveViewProps {
  resources: ResourceItem[];
  isPremium: boolean;
  membershipTier?: MembershipTier;
  purchasedIds?: string[];
  onSelectResource: (resource: ResourceItem) => void;
  onDownloadResource: (resource: ResourceItem) => void;
  onOpenPremium: () => void;
}

export const ExclusiveView: React.FC<ExclusiveViewProps> = ({
  resources,
  isPremium,
  membershipTier = isPremium ? 'premium' : 'free',
  purchasedIds = [],
  onSelectResource,
  onDownloadResource,
  onOpenPremium,
}) => {
  const [vaultTab, setVaultTab] = useState<'all' | 'premium' | 'ultimate'>('all');
  const exclusiveItems = filterResources(resources, { exclusiveOnly: true }).filter((item) => {
    if (vaultTab === 'all') return true;
    return getEffectiveResourceTier(item) === vaultTab;
  });

  const isUltimate = membershipTier === 'ultimate';

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            {isUltimate ? (
              <Sparkles className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
            ) : (
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Premium &amp; Ultimate Vault</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
            Premium &amp; Ultimate Setups, Plugins &amp; Source
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Builds, setups, and source packs for Premium and Ultimate members.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenPremium}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-5 text-xs font-bold whitespace-nowrap transition-colors ${
            isUltimate
              ? 'border border-violet-400/50 bg-violet-500/15 text-violet-200'
              : isPremium
              ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'bg-white text-zinc-950 hover:bg-zinc-200'
          }`}
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>
            {isUltimate
              ? 'Ultimate Unlocked'
              : isPremium
              ? 'Premium Unlocked'
              : 'Buy with GCash / PayPal'}
          </span>
        </button>
      </div>

      {/* Vault Tier Filter */}
      <div className="mt-4 flex items-center gap-1.5">
        {(['all', 'premium', 'ultimate'] as const).map((tab) => {
          const active = vaultTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setVaultTab(tab)}
              className={`h-8 rounded-md border px-3 text-xs font-semibold capitalize transition-colors ${
                active
                  ? 'border-white bg-white text-zinc-950'
                  : 'border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              {tab === 'all' ? 'All Vault' : tab}
            </button>
          );
        })}
      </div>

      {exclusiveItems.length === 0 ? (
        <div className="py-10 text-xs text-zinc-500">
          No {vaultTab === 'all' ? 'Premium or Ultimate' : vaultTab} packages published yet.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {exclusiveItems.map((item, idx) => (
            <ResourceCard
              key={item.id}
              resource={item}
              variant="catalog"
              rankIndex={idx + 1}
              isPremium={isPremium}
              membershipTier={membershipTier}
              purchasedIds={purchasedIds}
              onSelect={onSelectResource}
              onDownload={onDownloadResource}
            />
          ))}
        </div>
      )}
    </section>
  );
};
