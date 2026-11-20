import {
  MembershipOrderPlan,
  MembershipTier,
  PaymentMethod,
  ResourceItem,
  SiteSettings,
} from '../types';
import { clampString } from './authLogic';

export const MEMBERSHIP_PRICING: Record<
  'premium' | 'ultimate',
  {
    title: string;
    usdLabel: string;
    phpLabel: string;
    summary: string;
  }
> = {
  premium: {
    title: 'Premium',
    usdLabel: '$4.99 / mo',
    phpLabel: '₱280 / mo',
    summary: 'Unlocks all Premium builds + 2x Community XP.',
  },
  ultimate: {
    title: 'Ultimate',
    usdLabel: '$9.99 / mo',
    phpLabel: '₱560 / mo',
    summary: 'Unlocks Premium, Paid & Ultimate Vault releases.',
  },
};

export const PAYMENT_BLUEPRINT_LIMITS = {
  BUYER_NAME_MAX: 80,
  REFERENCE_MIN: 4,
  REFERENCE_MAX: 64,
  SENDER_MIN: 2,
  SENDER_MAX: 100,
  AMOUNT_MAX: 32,
  RESOURCE_ID_MAX: 128,
  RESOURCE_TITLE_MAX: 100,
  ADMIN_NOTE_MAX: 200,
  GCASH_NUMBER_MAX: 32,
  GCASH_NAME_MAX: 80,
  PAYPAL_EMAIL_MAX: 120,
  PAYPAL_LINK_MAX: 240,
} as const;

export function canSelfSwitchTier(isOwner: boolean): boolean {
  return Boolean(isOwner);
}

export function resolvePaymentSettings(settings?: Partial<SiteSettings> | null): {
  gcashNumber: string;
  gcashName: string;
  paypalEmail: string;
  paypalLink: string;
} {
  const gcashNumber = clampString(settings?.gcashNumber || '', PAYMENT_BLUEPRINT_LIMITS.GCASH_NUMBER_MAX);
  const gcashName =
    clampString(settings?.gcashName || '', PAYMENT_BLUEPRINT_LIMITS.GCASH_NAME_MAX) ||
    'SwxStudios Owner';
  const paypalEmail =
    clampString(settings?.paypalEmail || '', PAYMENT_BLUEPRINT_LIMITS.PAYPAL_EMAIL_MAX) ||
    'randellemupas@gmail.com';
  const rawLink = clampString(settings?.paypalLink || '', PAYMENT_BLUEPRINT_LIMITS.PAYPAL_LINK_MAX);
  const paypalLink = /^https?:\/\//i.test(rawLink) ? rawLink : '';

  return {
    gcashNumber,
    gcashName,
    paypalEmail,
    paypalLink,
  };
}

export function getPlanAmountLabel(
  plan: MembershipOrderPlan,
  method: PaymentMethod,
  resource?: ResourceItem | null
): string {
  if (plan === 'package') {
    const label = resource?.priceLabel?.trim();
    if (label) {
      return clampString(label, PAYMENT_BLUEPRINT_LIMITS.AMOUNT_MAX);
    }
    return method === 'gcash' ? '₱280 PHP (Package)' : '$4.99 USD (Package)';
  }
  const pricing = MEMBERSHIP_PRICING[plan];
  return method === 'gcash' ? pricing.phpLabel : pricing.usdLabel;
}

export interface MembershipOrderDraftInput {
  plan: MembershipOrderPlan;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  senderAccount: string;
  resource?: ResourceItem | null;
}

export function validateMembershipOrderInput(
  input: MembershipOrderDraftInput
): { ok: true } | { ok: false; error: string } {
  if (input.plan !== 'premium' && input.plan !== 'ultimate' && input.plan !== 'package') {
    return { ok: false, error: 'Please select Premium, Ultimate, or a paid package.' };
  }
  if (input.paymentMethod !== 'gcash' && input.paymentMethod !== 'paypal') {
    return { ok: false, error: 'Choose GCash or PayPal as your payment method.' };
  }
  if (input.plan === 'package' && !input.resource?.id) {
    return { ok: false, error: 'Target paid package is missing.' };
  }

  const ref = input.referenceCode.trim();
  if (ref.length < PAYMENT_BLUEPRINT_LIMITS.REFERENCE_MIN) {
    return {
      ok: false,
      error:
        input.paymentMethod === 'gcash'
          ? 'Enter your GCash Reference No. (at least 4 characters).'
          : 'Enter your PayPal Transaction ID (at least 4 characters).',
    };
  }
  if (ref.length > PAYMENT_BLUEPRINT_LIMITS.REFERENCE_MAX) {
    return {
      ok: false,
      error: `Reference / Transaction ID must be ${PAYMENT_BLUEPRINT_LIMITS.REFERENCE_MAX} characters or fewer.`,
    };
  }

  const sender = input.senderAccount.trim();
  if (sender.length < PAYMENT_BLUEPRINT_LIMITS.SENDER_MIN) {
    return {
      ok: false,
      error:
        input.paymentMethod === 'gcash'
          ? 'Enter your GCash name or mobile number so the owner can verify your payment.'
          : 'Enter the PayPal email or name used to send payment.',
    };
  }
  if (sender.length > PAYMENT_BLUEPRINT_LIMITS.SENDER_MAX) {
    return {
      ok: false,
      error: `Sender details must be ${PAYMENT_BLUEPRINT_LIMITS.SENDER_MAX} characters or fewer.`,
    };
  }

  return { ok: true };
}

export function buildMembershipOrderId(userId: string): string {
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'member';
  const rand = Math.random().toString(36).slice(2, 8);
  return `ord-${safeUid}-${Date.now().toString(36)}-${rand}`;
}

export function buildMembershipOrderRecord(params: {
  orderId: string;
  userId: string;
  buyerName: string;
  input: MembershipOrderDraftInput;
}): {
  id: string;
  userId: string;
  buyerName: string;
  plan: MembershipOrderPlan;
  resourceId?: string;
  resourceTitle?: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  senderAccount: string;
  amountLabel: string;
  status: 'pending';
} {
  const { orderId, userId, buyerName, input } = params;
  const record: {
    id: string;
    userId: string;
    buyerName: string;
    plan: MembershipOrderPlan;
    resourceId?: string;
    resourceTitle?: string;
    paymentMethod: PaymentMethod;
    referenceCode: string;
    senderAccount: string;
    amountLabel: string;
    status: 'pending';
  } = {
    id: clampString(orderId.replace(/[^a-zA-Z0-9_-]/g, ''), 128),
    userId: clampString(userId.replace(/[^a-zA-Z0-9_-]/g, ''), 128),
    buyerName: clampString(buyerName.trim(), PAYMENT_BLUEPRINT_LIMITS.BUYER_NAME_MAX) || 'SwxMember',
    plan: input.plan,
    paymentMethod: input.paymentMethod,
    referenceCode: clampString(
      input.referenceCode.trim(),
      PAYMENT_BLUEPRINT_LIMITS.REFERENCE_MAX
    ),
    senderAccount: clampString(input.senderAccount.trim(), PAYMENT_BLUEPRINT_LIMITS.SENDER_MAX),
    amountLabel: clampString(
      getPlanAmountLabel(input.plan, input.paymentMethod, input.resource),
      PAYMENT_BLUEPRINT_LIMITS.AMOUNT_MAX
    ),
    status: 'pending',
  };

  if (input.plan === 'package' && input.resource) {
    record.resourceId = clampString(
      input.resource.id.replace(/[^a-zA-Z0-9_-]/g, ''),
      PAYMENT_BLUEPRINT_LIMITS.RESOURCE_ID_MAX
    );
    record.resourceTitle = clampString(
      input.resource.title.trim(),
      PAYMENT_BLUEPRINT_LIMITS.RESOURCE_TITLE_MAX
    );
  }

  return record;
}

export function resolveApprovedTierUpdate(
  currentTier: MembershipTier,
  orderPlan: MembershipOrderPlan
): { isPremium: boolean; membershipTier: MembershipTier } {
  if (orderPlan === 'ultimate') {
    return { isPremium: true, membershipTier: 'ultimate' };
  }
  if (orderPlan === 'premium') {
    return {
      isPremium: true,
      membershipTier: currentTier === 'ultimate' ? 'ultimate' : 'premium',
    };
  }
  return {
    isPremium: currentTier !== 'free',
    membershipTier: currentTier,
  };
}
