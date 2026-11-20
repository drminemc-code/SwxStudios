import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import {
  MembershipOrder,
  MembershipOrderPlan,
  MembershipTier,
  PaymentMethod,
  ResourceItem,
  SiteSettings,
} from '../types';
import {
  canSelfSwitchTier,
  getPlanAmountLabel,
  MEMBERSHIP_PRICING,
  resolvePaymentSettings,
  validateMembershipOrderInput,
} from '../utils/paymentLogic';
import { getEffectiveResourceTier } from '../utils/catalogLogic';

interface PremiumModalProps {
  open: boolean;
  isPremium: boolean;
  membershipTier?: MembershipTier;
  isOwner?: boolean;
  isSignedIn?: boolean;
  emailVerified?: boolean;
  siteSettings?: SiteSettings;
  pendingResource?: ResourceItem | null;
  orders?: MembershipOrder[];
  onClose: () => void;
  onSelectMembershipTier?: (tier: MembershipTier) => void;
  onTogglePremium?: (active: boolean) => void;
  onSubmitOrder?: (input: {
    plan: MembershipOrderPlan;
    paymentMethod: PaymentMethod;
    referenceCode: string;
    senderAccount: string;
    resource?: ResourceItem | null;
  }) => Promise<void>;
  onRequireSignIn?: () => void;
  onOpenAccount?: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  open,
  isPremium,
  membershipTier = isPremium ? 'premium' : 'free',
  isOwner = false,
  isSignedIn = false,
  emailVerified = false,
  siteSettings,
  pendingResource = null,
  orders = [],
  onClose,
  onSelectMembershipTier,
  onTogglePremium,
  onSubmitOrder,
  onRequireSignIn,
  onOpenAccount,
}) => {
  const pendingEffectiveTier = pendingResource
    ? getEffectiveResourceTier(pendingResource)
    : null;

  const [selectedPlan, setSelectedPlan] = useState<MembershipOrderPlan>(() => {
    if (pendingEffectiveTier === 'ultimate') return 'ultimate';
    if (pendingEffectiveTier === 'paid') return 'package';
    return membershipTier === 'ultimate' ? 'ultimate' : 'premium';
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash');
  const [senderAccount, setSenderAccount] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    if (pendingEffectiveTier === 'ultimate') {
      setSelectedPlan('ultimate');
    } else if (pendingEffectiveTier === 'paid') {
      setSelectedPlan('package');
    } else if (pendingEffectiveTier === 'premium') {
      setSelectedPlan('premium');
    } else {
      setSelectedPlan(membershipTier === 'ultimate' ? 'ultimate' : 'premium');
    }
  }, [open, pendingEffectiveTier, membershipTier]);

  const paymentInfo = useMemo(() => resolvePaymentSettings(siteSettings), [siteSettings]);

  if (!open) return null;

  const ownerCanSwitch = canSelfSwitchTier(isOwner);
  const amountLabel = getPlanAmountLabel(selectedPlan, paymentMethod, pendingResource);

  const handleCopy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleOwnerPreviewTier = (tier: MembershipTier) => {
    if (!ownerCanSwitch) return;
    if (onSelectMembershipTier) {
      onSelectMembershipTier(tier);
    } else if (onTogglePremium) {
      onTogglePremium(tier !== 'free');
    }
    onClose();
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!isSignedIn) {
      if (onRequireSignIn) {
        onClose();
        onRequireSignIn();
      } else {
        setSubmitError('Please sign in first before submitting a GCash or PayPal payment.');
      }
      return;
    }

    if (!emailVerified) {
      if (onOpenAccount) {
        onClose();
        onOpenAccount();
      } else {
        setSubmitError('Please verify your email in Account settings before submitting payment.');
      }
      return;
    }

    const validation = validateMembershipOrderInput({
      plan: selectedPlan,
      paymentMethod,
      referenceCode,
      senderAccount,
      resource: pendingResource,
    });
    if (!validation.ok) {
      setSubmitError(validation.error);
      return;
    }

    if (!onSubmitOrder) {
      setSubmitError('Order submission handler is unavailable.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitOrder({
        plan: selectedPlan,
        paymentMethod,
        referenceCode,
        senderAccount,
        resource: pendingResource,
      });
      setReferenceCode('');
      setSubmitSuccess(
        'Payment reference submitted! Your order is pending owner approval and will unlock automatically once verified.'
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit payment verification.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const planAlreadyUnlocked =
    (selectedPlan === 'premium' &&
      (membershipTier === 'premium' || membershipTier === 'ultimate')) ||
    (selectedPlan === 'ultimate' && membershipTier === 'ultimate');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-800 bg-[#111114] p-5 text-zinc-100 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              {selectedPlan === 'ultimate' ? (
                <Sparkles className="h-5 w-5 text-violet-300" aria-hidden="true" />
              ) : (
                <Crown className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 id="premium-modal-title" className="text-lg font-bold text-white">
                SwxStudios Membership &amp; Purchase
              </h2>
              <p className="text-xs text-zinc-400">
                Buy Premium, Ultimate, or Paid packages using GCash or PayPal.
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

        {/* Mandatory Purchase Notice for Members */}
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-100"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold text-amber-200">
              Purchase Required — Pay via GCash or PayPal
            </p>
            <p className="leading-relaxed text-amber-100/90">
              Members cannot unlock Premium, Ultimate, or Paid resources for free. You need to buy
              a plan using <strong className="text-white">GCash</strong> or{' '}
              <strong className="text-white">PayPal</strong> and submit your payment reference
              below for owner verification.
            </p>
            {pendingResource && (
              <p className="pt-0.5 font-semibold text-white">
                Selected package: {pendingResource.title}
                {pendingResource.priceLabel ? ` (${pendingResource.priceLabel})` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Plan Selector */}
        <div
          className={`mt-4 grid grid-cols-1 gap-2.5 ${
            pendingEffectiveTier === 'paid' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
          }`}
        >
          <div
            className={`rounded-lg border p-3 text-left ${
              membershipTier === 'free'
                ? 'border-emerald-500/40 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-950'
            }`}
          >
            <p className="text-xs font-semibold text-emerald-300">Free</p>
            <p className="mt-1 text-lg font-extrabold text-white tabular-nums">
              $0<span className="text-[11px] font-normal text-zinc-400"> / forever</span>
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Open Free builds &amp; community tools only.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPlan('premium')}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selectedPlan === 'premium'
                ? 'border-amber-400 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold text-amber-300">Premium</p>
              {membershipTier === 'premium' && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-extrabold text-white tabular-nums">
              {paymentMethod === 'gcash'
                ? MEMBERSHIP_PRICING.premium.phpLabel
                : MEMBERSHIP_PRICING.premium.usdLabel}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              {MEMBERSHIP_PRICING.premium.summary}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('ultimate')}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selectedPlan === 'ultimate'
                ? 'border-violet-400 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold text-violet-300">Ultimate</p>
              {membershipTier === 'ultimate' && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-extrabold text-white tabular-nums">
              {paymentMethod === 'gcash'
                ? MEMBERSHIP_PRICING.ultimate.phpLabel
                : MEMBERSHIP_PRICING.ultimate.usdLabel}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              {MEMBERSHIP_PRICING.ultimate.summary}
            </p>
          </button>

          {pendingEffectiveTier === 'paid' && pendingResource && (
            <button
              type="button"
              onClick={() => setSelectedPlan('package')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selectedPlan === 'package'
                  ? 'border-sky-400 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
              }`}
            >
              <p className="text-xs font-semibold text-sky-300">Single Build</p>
              <p className="mt-1 truncate text-lg font-extrabold text-white tabular-nums">
                {pendingResource.priceLabel || '$4.99'}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                Unlock {pendingResource.title} only.
              </p>
            </button>
          )}
        </div>

        {/* GCash & PayPal Checkout Box */}
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-white">
                Step 1 · Choose GCash or PayPal
              </h3>
            </div>
            <span className="font-display-mono text-xs font-bold text-amber-300 tabular-nums">
              Total: {amountLabel}
            </span>
          </div>

          {/* Payment Method Toggle */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('gcash')}
              className={`flex h-10 items-center justify-center gap-2 rounded-md border text-xs font-bold transition-colors ${
                paymentMethod === 'gcash'
                  ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-sky-500/20 font-display-mono text-[11px] text-sky-300">
                G
              </span>
              <span>GCash (PHP)</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('paypal')}
              className={`flex h-10 items-center justify-center gap-2 rounded-md border text-xs font-bold transition-colors ${
                paymentMethod === 'paypal'
                  ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20 font-display-mono text-[11px] text-indigo-300">
                P
              </span>
              <span>PayPal (USD)</span>
            </button>
          </div>

          {/* Selected Payment Instructions */}
          {paymentMethod === 'gcash' ? (
            <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                    Send GCash Payment To
                  </p>
                  <p className="mt-0.5 font-semibold text-white">{paymentInfo.gcashName}</p>
                  <p className="mt-0.5 font-display-mono text-sm font-bold text-sky-200 tabular-nums">
                    {paymentInfo.gcashNumber
                      ? paymentInfo.gcashNumber
                      : isOwner
                      ? 'Set your GCash # in Admin -> Controls'
                      : 'Ask SwxStudios Owner for GCash # (or use PayPal)'}
                  </p>
                </div>
                {paymentInfo.gcashNumber && (
                  <button
                    type="button"
                    onClick={() => void handleCopy('gcash', paymentInfo.gcashNumber)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/15 px-3 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25"
                  >
                    {copiedKey === 'gcash' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Number</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Send <strong className="text-zinc-200">{amountLabel}</strong> via GCash Express
                Send, then enter your 13-digit GCash Reference No. below.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                    Send PayPal Payment To
                  </p>
                  <p className="mt-0.5 truncate font-display-mono text-sm font-bold text-indigo-200">
                    {paymentInfo.paypalEmail}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopy('paypal', paymentInfo.paypalEmail)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-400/40 bg-indigo-500/15 px-3 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/25"
                  >
                    {copiedKey === 'paypal' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Email</span>
                      </>
                    )}
                  </button>
                  {paymentInfo.paypalLink && (
                    <a
                      href={paymentInfo.paypalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-indigo-500 px-3 text-[11px] font-bold text-white hover:bg-indigo-400"
                    >
                      <span>Open PayPal</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Send <strong className="text-zinc-200">{amountLabel}</strong> via PayPal, then
                submit your PayPal Transaction ID below.
              </p>
            </div>
          )}

          {/* Step 2: Payment Proof Form */}
          <form onSubmit={handleSubmitProof} className="mt-4 space-y-3 border-t border-zinc-800/80 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-white">
              Step 2 · Submit Payment Proof for Verification
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="order-sender" className="block text-[11px] font-medium text-zinc-300">
                  {paymentMethod === 'gcash'
                    ? 'Your GCash Name / Mobile No.'
                    : 'Your PayPal Email / Name'}
                </label>
                <input
                  id="order-sender"
                  type="text"
                  maxLength={100}
                  value={senderAccount}
                  onChange={(e) => setSenderAccount(e.target.value)}
                  placeholder={
                    paymentMethod === 'gcash' ? 'e.g. Juan D. / 0917...' : 'e.g. player@email.com'
                  }
                  className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="order-ref" className="block text-[11px] font-medium text-zinc-300">
                  {paymentMethod === 'gcash' ? 'GCash Reference No.' : 'PayPal Transaction ID'}
                </label>
                <input
                  id="order-ref"
                  type="text"
                  maxLength={64}
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder={
                    paymentMethod === 'gcash' ? 'e.g. 0012345678901' : 'e.g. 7XY9283746109'
                  }
                  className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 font-display-mono text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-500/35 bg-red-500/10 p-2.5 text-xs text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-emerald-500/35 bg-emerald-500/10 p-2.5 text-xs text-emerald-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-zinc-500">
                {planAlreadyUnlocked
                  ? 'You already have this membership tier active.'
                  : 'Owner reviews & unlocks verified GCash/PayPal orders promptly.'}
              </p>

              <button
                type="submit"
                disabled={submitting || planAlreadyUnlocked}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md px-4 text-xs font-bold transition-colors disabled:opacity-60 ${
                  selectedPlan === 'ultimate'
                    ? 'bg-violet-400 text-zinc-950 hover:bg-violet-300'
                    : selectedPlan === 'package'
                    ? 'bg-sky-400 text-zinc-950 hover:bg-sky-300'
                    : 'bg-white text-zinc-950 hover:bg-zinc-200'
                }`}
              >
                {!isSignedIn
                  ? 'Sign In to Pay via GCash / PayPal'
                  : !emailVerified
                  ? 'Verify Email to Submit Order'
                  : submitting
                  ? 'Submitting Payment...'
                  : planAlreadyUnlocked
                  ? `${selectedPlan === 'ultimate' ? 'Ultimate' : 'Premium'} Active`
                  : `Submit ${paymentMethod === 'gcash' ? 'GCash' : 'PayPal'} Payment`}
              </button>
            </div>
          </form>
        </div>

        {/* User's Recent Payment Orders */}
        {orders.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                Your Payment Verification History
              </span>
              <span className="font-display-mono text-[11px] text-zinc-500">
                {orders.length} order{orders.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-2.5 space-y-2">
              {orders.slice(0, 4).map((ord) => (
                <div
                  key={ord.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-100">
                      {ord.plan === 'package'
                        ? ord.resourceTitle || 'Paid Package'
                        : ord.plan === 'ultimate'
                        ? 'Ultimate Membership'
                        : 'Premium Membership'}{' '}
                      · {ord.paymentMethod === 'gcash' ? 'GCash' : 'PayPal'} ({ord.amountLabel})
                    </p>
                    <p className="truncate font-display-mono text-[11px] text-zinc-500">
                      Ref: {ord.referenceCode} · {ord.senderAccount}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ord.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : ord.status === 'declined'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {ord.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owner-Only QA Tier Preview Bar (Never rendered for normal members) */}
        {ownerCanSwitch && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Owner QA Preview Switch
            </span>
            <div className="flex items-center gap-1.5">
              {(['free', 'premium', 'ultimate'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => handleOwnerPreviewTier(tier)}
                  className={`rounded border px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                    membershipTier === tier
                      ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
