import React, { useState } from 'react';
import { Check, Crown, Sparkles, X } from 'lucide-react';
import { MembershipTier } from '../types';

interface PremiumModalProps {
  open: boolean;
  isPremium: boolean;
  membershipTier?: MembershipTier;
  onClose: () => void;
  onSelectMembershipTier?: (tier: MembershipTier) => void;
  onTogglePremium: (active: boolean) => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  open,
  isPremium,
  membershipTier = isPremium ? 'premium' : 'free',
  onClose,
  onSelectMembershipTier,
  onTogglePremium,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'ultimate'>(
    membershipTier === 'ultimate' ? 'ultimate' : 'premium'
  );

  if (!open) return null;

  const activateTier = (tier: MembershipTier) => {
    if (onSelectMembershipTier) {
      onSelectMembershipTier(tier);
    } else {
      onTogglePremium(tier !== 'free');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-zinc-800 bg-[#111114] p-6 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              {selectedPlan === 'ultimate' ? (
                <Sparkles className="h-5 w-5 text-violet-300" aria-hidden="true" />
              ) : (
                <Crown className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 id="premium-modal-title" className="text-lg font-bold text-white">
                SwxStudios Membership Tiers
              </h2>
              <p className="text-xs text-zinc-400">
                Compare Free, Premium, and Ultimate access across all packages.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close membership modal"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Plan Switcher */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div
            className={`rounded-lg border p-3.5 text-left ${
              membershipTier === 'free'
                ? 'border-emerald-500/40 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-950'
            }`}
          >
            <p className="text-xs font-semibold text-emerald-300">Free</p>
            <p className="mt-1 text-xl font-extrabold text-white tabular-nums">
              $0<span className="text-xs font-normal text-zinc-400"> forever</span>
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Standard Free builds &amp; community threads.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPlan('premium')}
            className={`rounded-lg border p-3.5 text-left transition-colors ${
              selectedPlan === 'premium'
                ? 'border-amber-400 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
            }`}
          >
            <p className="text-xs font-semibold text-amber-300">Premium</p>
            <p className="mt-1 text-xl font-extrabold text-white tabular-nums">
              $4.99<span className="text-xs font-normal text-zinc-400"> / mo</span>
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Unlocks all Premium builds + 2x XP.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('ultimate')}
            className={`rounded-lg border p-3.5 text-left transition-colors ${
              selectedPlan === 'ultimate'
                ? 'border-violet-400 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
            }`}
          >
            <p className="text-xs font-semibold text-violet-300">Ultimate</p>
            <p className="mt-1 text-xl font-extrabold text-white tabular-nums">
              $9.99<span className="text-xs font-normal text-zinc-400"> / mo</span>
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Unlocks Premium, Paid &amp; Ultimate Vault.
            </p>
          </button>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span>Free tier: open plugins, configs, and popular community releases</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>Premium tier: QA-verified Premium setups &amp; 2x Community XP</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-violet-400" aria-hidden="true" />
            <span>Ultimate tier: full source code, Paid releases &amp; Ultimate Vault builds</span>
          </li>
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {membershipTier !== 'free' && (
            <button
              type="button"
              onClick={() => activateTier('free')}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Switch to Free
            </button>
          )}
          <button
            type="button"
            onClick={() => activateTier(selectedPlan)}
            className={`h-10 rounded-md px-5 text-xs font-bold text-zinc-950 ${
              selectedPlan === 'ultimate'
                ? 'bg-violet-400 hover:bg-violet-300'
                : 'bg-white hover:bg-zinc-200'
            }`}
          >
            {membershipTier === selectedPlan
              ? `${selectedPlan === 'ultimate' ? 'Ultimate' : 'Premium'} Active`
              : `Activate ${selectedPlan === 'ultimate' ? 'Ultimate ($9.99)' : 'Premium ($4.99)'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
