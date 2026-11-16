import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyUserRating,
  buildResourceManifest,
  canAccessResource,
  countByCategory,
  countByTier,
  filterResources,
  getEffectiveResourceTier,
  getLevelInfo,
  pickRandomResource,
  sortResources,
} from './catalogLogic';
import { INITIAL_RESOURCES, LEVEL_TIERS } from '../data/catalog';
import { ResourceItem } from '../types';

const SAMPLE_RESOURCES: ResourceItem[] = [
  {
    id: 'sample-plugin',
    title: 'Sample Crates Plugin',
    subtitle: 'Crate animations',
    description: 'High performance crate plugin',
    category: 'plugins',
    downloads: 120,
    rating: 9.0,
    ratingCount: 10,
    version: 'v1.0.0',
    mcVersions: '1.21.4',
    fileSize: '2 MB',
    author: 'SwxDev',
    updatedAt: '2026-11-14',
    popular: true,
    tier: 'free',
    tags: ['crates', 'lifesteal'],
    artwork: 'crates',
    accentColor: '#f59e0b',
    features: ['Async particles'],
    fileName: 'SampleCrates.jar',
  },
  {
    id: 'sample-paid-plugin',
    title: 'Sample Paid Core',
    subtitle: 'Standalone license',
    description: 'Paid economy core',
    category: 'plugins',
    downloads: 80,
    rating: 8.8,
    ratingCount: 6,
    version: 'v1.1.0',
    mcVersions: '1.21.4',
    fileSize: '4 MB',
    author: 'SwxDev',
    updatedAt: '2026-11-13',
    tier: 'paid',
    priceLabel: '$6.99',
    tags: ['economy'],
    artwork: 'shop',
    accentColor: '#f59e0b',
    features: ['Async database'],
    fileName: 'SamplePaid.jar',
  },
  {
    id: 'sample-exclusive-setup',
    title: 'Sample Lifesteal Setup',
    subtitle: 'Full lifesteal core',
    description: 'Complete server setup',
    category: 'setups',
    downloads: 240,
    rating: 9.4,
    ratingCount: 20,
    version: 'v2.0.0',
    mcVersions: '1.21.4',
    fileSize: '120 MB',
    author: 'SwxCore',
    updatedAt: '2026-11-12',
    exclusive: true,
    tier: 'premium',
    tags: ['lifesteal', 'smp'],
    artwork: 'lifesteal',
    accentColor: '#10b981',
    features: ['Custom hearts'],
    fileName: 'LifestealSetup.zip',
  },
  {
    id: 'sample-ultimate-setup',
    title: 'Sample Ultimate Network',
    subtitle: 'Full proxy + 5 servers',
    description: 'Ultimate studio network package',
    category: 'setups',
    downloads: 310,
    rating: 9.9,
    ratingCount: 35,
    version: 'v3.0.0',
    mcVersions: '1.21.4',
    fileSize: '260 MB',
    author: 'SwxCore',
    updatedAt: '2026-11-15',
    popular: true,
    exclusive: true,
    tier: 'ultimate',
    tags: ['network', 'velocity'],
    artwork: 'galactic',
    accentColor: '#6366f1',
    features: ['Full source + proxy'],
    fileName: 'UltimateNetwork.zip',
  },
];

test('initial catalog starts empty at 0 resources and 0 per category', () => {
  assert.equal(INITIAL_RESOURCES.length, 0);
  const counts = countByCategory(INITIAL_RESOURCES);
  assert.equal(counts.plugins, 0);
  assert.equal(counts.configs, 0);
  assert.equal(counts.setups, 0);
  assert.equal(counts.models, 0);
  assert.equal(pickRandomResource(INITIAL_RESOURCES), null);
});

test('countByCategory tallies resources accurately', () => {
  const counts = countByCategory(SAMPLE_RESOURCES);
  assert.equal(counts.plugins, 2);
  assert.equal(counts.setups, 2);
  assert.equal(counts.models, 0);
});

test('countByTier tallies free, paid, popular, premium, and ultimate accurately', () => {
  const counts = countByTier(SAMPLE_RESOURCES);
  assert.equal(counts.all, 4);
  assert.equal(counts.free, 1);
  assert.equal(counts.paid, 1);
  assert.equal(counts.popular, 2);
  assert.equal(counts.premium, 1);
  assert.equal(counts.ultimate, 1);
});

test('filterResources filters by category, search query, and tierFilter', () => {
  const setups = filterResources(SAMPLE_RESOURCES, { category: 'setups' });
  assert.equal(setups.length, 2);

  const lifesteal = filterResources(SAMPLE_RESOURCES, { query: 'lifesteal' });
  assert.equal(lifesteal.length, 2);

  assert.equal(filterResources(SAMPLE_RESOURCES, { tierFilter: 'free' }).length, 1);
  assert.equal(filterResources(SAMPLE_RESOURCES, { tierFilter: 'paid' }).length, 1);
  assert.equal(filterResources(SAMPLE_RESOURCES, { tierFilter: 'popular' }).length, 2);
  assert.equal(filterResources(SAMPLE_RESOURCES, { tierFilter: 'premium' }).length, 1);
  assert.equal(filterResources(SAMPLE_RESOURCES, { tierFilter: 'ultimate' }).length, 1);
});

test('filterResources filters exclusive-only items accurately', () => {
  const exclusives = filterResources(SAMPLE_RESOURCES, { exclusiveOnly: true });
  assert.equal(exclusives.length, 2);
});

test('canAccessResource enforces free, paid, premium, and ultimate tiers', () => {
  const [freeItem, paidItem, premiumItem, ultimateItem] = SAMPLE_RESOURCES;
  assert.equal(getEffectiveResourceTier(freeItem), 'free');
  assert.equal(canAccessResource(freeItem, 'free'), true);
  assert.equal(canAccessResource(paidItem, 'free'), false);
  assert.equal(canAccessResource(paidItem, 'free', { purchasedIds: [paidItem.id] }), true);
  assert.equal(canAccessResource(premiumItem, 'free'), false);
  assert.equal(canAccessResource(premiumItem, 'premium'), true);
  assert.equal(canAccessResource(ultimateItem, 'premium'), false);
  assert.equal(canAccessResource(ultimateItem, 'ultimate'), true);
  assert.equal(canAccessResource(paidItem, 'ultimate'), true);
});

test('sortResources orders by downloads, rating, and newest date', () => {
  const byDownloads = sortResources(SAMPLE_RESOURCES, 'downloads');
  assert.equal(byDownloads[0].id, 'sample-ultimate-setup');

  const byRating = sortResources(SAMPLE_RESOURCES, 'rating');
  assert.equal(byRating[0].id, 'sample-ultimate-setup');

  const byNewest = sortResources(SAMPLE_RESOURCES, 'newest');
  assert.equal(byNewest[0].id, 'sample-ultimate-setup');
});

test('pickRandomResource avoids repeating excluded resource when multiple exist', () => {
  const picked = pickRandomResource(SAMPLE_RESOURCES, 'sample-plugin', () => 0);
  assert.ok(picked !== null);
  assert.equal(picked.id, 'sample-paid-plugin');
});

test('applyUserRating recalculates weighted rating and increments ratingCount', () => {
  const base = SAMPLE_RESOURCES[0];
  const updated = applyUserRating(base, 10);
  assert.equal(updated.ratingCount, base.ratingCount + 1);
  assert.ok(updated.rating > base.rating);
});

test('getLevelInfo computes current tier, next tier, and XP progress', () => {
  const lvl1 = getLevelInfo(75, LEVEL_TIERS);
  assert.equal(lvl1.current.level, 1);
  assert.equal(lvl1.next?.level, 2);
  assert.equal(lvl1.progressPercent, 50);
  assert.equal(lvl1.xpToNext, 75);

  const maxLvl = getLevelInfo(1200, LEVEL_TIERS);
  assert.equal(maxLvl.current.level, 4);
  assert.equal(maxLvl.next, null);
  assert.equal(maxLvl.progressPercent, 100);
});

test('buildResourceManifest outputs valid YAML-style package metadata', () => {
  const manifest = buildResourceManifest(SAMPLE_RESOURCES[0]);
  assert.ok(manifest.includes('SwxStudios Package Manifest'));
  assert.ok(manifest.includes(SAMPLE_RESOURCES[0].fileName));
});
