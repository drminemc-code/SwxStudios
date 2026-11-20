import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMembershipOrderId,
  buildMembershipOrderRecord,
  canSelfSwitchTier,
  getPlanAmountLabel,
  resolveApprovedTierUpdate,
  resolvePaymentSettings,
  validateMembershipOrderInput,
} from './paymentLogic';
import { ResourceItem } from '../types';

const samplePaidResource: ResourceItem = {
  id: 'paid-lifesteal',
  title: 'SwxLifesteal Pro',
  subtitle: 'Paid setup',
  description: 'Paid setup package',
  category: 'setups',
  downloads: 12,
  rating: 9.4,
  ratingCount: 5,
  version: 'v1.0.0',
  mcVersions: '1.21.4',
  fileSize: '4 MB',
  author: 'SwxStudios',
  updatedAt: 'Today',
  tier: 'paid',
  priceLabel: '$7.50',
  tags: ['lifesteal'],
  artwork: 'lifesteal',
  accentColor: '#e11d48',
  features: ['Lifesteal core'],
  fileName: 'SwxLifesteal.zip',
};

test('canSelfSwitchTier restricts free tier switching to verified owner only', () => {
  assert.equal(canSelfSwitchTier(false), false);
  assert.equal(canSelfSwitchTier(true), true);
});

test('getPlanAmountLabel returns PHP pricing for GCash and USD pricing for PayPal', () => {
  assert.equal(getPlanAmountLabel('premium', 'gcash'), '₱280 / mo');
  assert.equal(getPlanAmountLabel('premium', 'paypal'), '$4.99 / mo');
  assert.equal(getPlanAmountLabel('ultimate', 'gcash'), '₱560 / mo');
  assert.equal(getPlanAmountLabel('ultimate', 'paypal'), '$9.99 / mo');
  assert.equal(getPlanAmountLabel('package', 'paypal', samplePaidResource), '$7.50');
});

test('resolvePaymentSettings falls back safely and filters non-HTTP PayPal links', () => {
  const defaults = resolvePaymentSettings(null);
  assert.equal(defaults.gcashName, 'SwxStudios Owner');
  assert.equal(defaults.paypalEmail, 'randellemupas@gmail.com');
  assert.equal(defaults.paypalLink, '');

  const custom = resolvePaymentSettings({
    gcashNumber: '09171234567',
    gcashName: 'Randelle M.',
    paypalEmail: 'pay@swxstudios.net',
    paypalLink: 'javascript:alert(1)',
  });
  assert.equal(custom.gcashNumber, '09171234567');
  assert.equal(custom.gcashName, 'Randelle M.');
  assert.equal(custom.paypalEmail, 'pay@swxstudios.net');
  assert.equal(custom.paypalLink, '');

  const validLink = resolvePaymentSettings({
    paypalLink: 'https://paypal.me/swxstudios',
  });
  assert.equal(validLink.paypalLink, 'https://paypal.me/swxstudios');
});

test('validateMembershipOrderInput rejects empty/short reference codes and accepts valid GCash & PayPal proofs', () => {
  const shortRef = validateMembershipOrderInput({
    plan: 'premium',
    paymentMethod: 'gcash',
    referenceCode: '12',
    senderAccount: '09171234567',
  });
  assert.equal(shortRef.ok, false);

  const missingSender = validateMembershipOrderInput({
    plan: 'ultimate',
    paymentMethod: 'paypal',
    referenceCode: 'PP-99887766',
    senderAccount: 'x',
  });
  assert.equal(missingSender.ok, false);

  const validGcash = validateMembershipOrderInput({
    plan: 'premium',
    paymentMethod: 'gcash',
    referenceCode: '0012345678901',
    senderAccount: 'Juan D. / 09171234567',
  });
  assert.equal(validGcash.ok, true);

  const validPaypal = validateMembershipOrderInput({
    plan: 'package',
    paymentMethod: 'paypal',
    referenceCode: '7XY9283746109',
    senderAccount: 'buyer@example.com',
    resource: samplePaidResource,
  });
  assert.equal(validPaypal.ok, true);
});

test('buildMembershipOrderRecord always creates pending status and sanitized IDs', () => {
  const orderId = buildMembershipOrderId('user@123');
  assert.match(orderId, /^[a-zA-Z0-9_-]+$/);

  const record = buildMembershipOrderRecord({
    orderId,
    userId: 'uid_abc_123',
    buyerName: 'SteveBuilder',
    input: {
      plan: 'ultimate',
      paymentMethod: 'gcash',
      referenceCode: '900123456789',
      senderAccount: '09170001111',
    },
  });
  assert.equal(record.status, 'pending');
  assert.equal(record.paymentMethod, 'gcash');
  assert.equal(record.amountLabel, '₱560 / mo');
  assert.equal(record.resourceId, undefined);
});

test('resolveApprovedTierUpdate upgrades without downgrading Ultimate members', () => {
  assert.deepEqual(resolveApprovedTierUpdate('free', 'premium'), {
    isPremium: true,
    membershipTier: 'premium',
  });
  assert.deepEqual(resolveApprovedTierUpdate('premium', 'ultimate'), {
    isPremium: true,
    membershipTier: 'ultimate',
  });
  assert.deepEqual(resolveApprovedTierUpdate('ultimate', 'premium'), {
    isPremium: true,
    membershipTier: 'ultimate',
  });
  assert.deepEqual(resolveApprovedTierUpdate('free', 'package'), {
    isPremium: false,
    membershipTier: 'free',
  });
});
