import {
  CategoryId,
  LevelTier,
  MembershipTier,
  ResourceItem,
  ResourceTier,
  ResourceTierFilter,
  SortOption,
} from '../types';

export function getEffectiveResourceTier(resource: ResourceItem): ResourceTier {
  if (
    resource.tier === 'free' ||
    resource.tier === 'paid' ||
    resource.tier === 'premium' ||
    resource.tier === 'ultimate'
  ) {
    return resource.tier;
  }
  return resource.exclusive ? 'premium' : 'free';
}

export function canAccessResource(
  resource: ResourceItem,
  membershipTier: MembershipTier,
  options?: { isPremium?: boolean; purchasedIds?: string[] }
): boolean {
  const tier = getEffectiveResourceTier(resource);
  const hasPremium =
    membershipTier === 'premium' ||
    membershipTier === 'ultimate' ||
    Boolean(options?.isPremium);

  if (tier === 'free') return true;
  if (tier === 'premium') return hasPremium;
  if (tier === 'ultimate') return membershipTier === 'ultimate';
  if (tier === 'paid') {
    return (
      membershipTier === 'ultimate' ||
      Boolean(options?.purchasedIds?.includes(resource.id))
    );
  }
  return true;
}

export function countByCategory(resources: ResourceItem[]): Record<CategoryId, number> {
  const counts: Record<CategoryId, number> = {
    plugins: 0,
    configs: 0,
    setups: 0,
    models: 0,
    maps: 0,
    skripts: 0,
    clients: 0,
    bots: 0,
    source: 0,
  };
  for (const item of resources) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

export function countByTier(resources: ResourceItem[]): Record<ResourceTierFilter, number> {
  const counts: Record<ResourceTierFilter, number> = {
    all: resources.length,
    free: 0,
    paid: 0,
    popular: 0,
    premium: 0,
    ultimate: 0,
  };
  for (const item of resources) {
    const tier = getEffectiveResourceTier(item);
    counts[tier] += 1;
    if (item.popular) {
      counts.popular += 1;
    }
  }
  return counts;
}

export function matchesQuery(resource: ResourceItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (resource.title.toLowerCase().includes(q)) return true;
  if (resource.subtitle.toLowerCase().includes(q)) return true;
  if (resource.description.toLowerCase().includes(q)) return true;
  if (resource.author.toLowerCase().includes(q)) return true;
  if (resource.category.toLowerCase().includes(q)) return true;
  return resource.tags.some((t) => t.toLowerCase().includes(q));
}

export function filterResources(
  resources: ResourceItem[],
  options: {
    query?: string;
    category?: CategoryId | 'all';
    exclusiveOnly?: boolean;
    tierFilter?: ResourceTierFilter;
  }
): ResourceItem[] {
  const {
    query = '',
    category = 'all',
    exclusiveOnly = false,
    tierFilter = 'all',
  } = options;
  return resources.filter((item) => {
    const effectiveTier = getEffectiveResourceTier(item);
    if (category !== 'all' && item.category !== category) return false;
    if (
      exclusiveOnly &&
      !item.exclusive &&
      effectiveTier !== 'premium' &&
      effectiveTier !== 'ultimate'
    ) {
      return false;
    }
    if (tierFilter === 'popular' && !item.popular) return false;
    if (
      tierFilter !== 'all' &&
      tierFilter !== 'popular' &&
      effectiveTier !== tierFilter
    ) {
      return false;
    }
    return matchesQuery(item, query);
  });
}

export function sortResources(resources: ResourceItem[], sortBy: SortOption): ResourceItem[] {
  const copy = [...resources];
  if (sortBy === 'downloads') {
    return copy.sort((a, b) => b.downloads - a.downloads);
  }
  if (sortBy === 'rating') {
    return copy.sort((a, b) => b.rating - a.rating || b.downloads - a.downloads);
  }
  return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function pickRandomResource(
  resources: ResourceItem[],
  excludeId?: string,
  rng: () => number = Math.random
): ResourceItem | null {
  if (resources.length === 0) return null;
  const pool = resources.length > 1 && excludeId
    ? resources.filter((r) => r.id !== excludeId)
    : resources;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx] ?? null;
}

export function applyUserRating(
  resource: ResourceItem,
  newScore: number
): ResourceItem {
  const clamped = Math.max(1, Math.min(10, Math.round(newScore * 10) / 10));
  const total = resource.rating * resource.ratingCount + clamped;
  const nextCount = resource.ratingCount + 1;
  const nextRating = Math.round((total / nextCount) * 10) / 10;
  return {
    ...resource,
    rating: nextRating,
    ratingCount: nextCount,
  };
}

export function getLevelInfo(xp: number, tiers: LevelTier[]): {
  current: LevelTier;
  next: LevelTier | null;
  progressPercent: number;
  xpToNext: number;
} {
  const sorted = [...tiers].sort((a, b) => a.minXp - b.minXp);
  let current = sorted[0];
  let next: LevelTier | null = null;

  for (let i = 0; i < sorted.length; i++) {
    if (xp >= sorted[i].minXp) {
      current = sorted[i];
      next = sorted[i + 1] ?? null;
    }
  }

  if (!next) {
    return {
      current,
      next: null,
      progressPercent: 100,
      xpToNext: 0,
    };
  }

  const span = next.minXp - current.minXp;
  const earnedInTier = xp - current.minXp;
  const progressPercent = span > 0 ? Math.min(100, Math.round((earnedInTier / span) * 100)) : 100;

  return {
    current,
    next,
    progressPercent,
    xpToNext: Math.max(0, next.minXp - xp),
  };
}

export function buildResourceManifest(resource: ResourceItem): string {
  return [
    `# SwxStudios Package Manifest`,
    `# Resource: ${resource.title} (${resource.version})`,
    `# Author: ${resource.author}`,
    `# Category: ${resource.category}`,
    `# Minecraft Versions: ${resource.mcVersions}`,
    `# File: ${resource.fileName}`,
    ``,
    `package:`,
    `  id: "${resource.id}"`,
    `  version: "${resource.version}"`,
    `  verified_by: "SwxStudios QA"`,
    `features:`,
    ...resource.features.map((f) => `  - "${f}"`),
    ``,
    `# Installation:`,
    `# 1. Stop your Paper/Purpur server.`,
    `# 2. Extract ${resource.fileName} into your server root or /plugins directory.`,
    `# 3. Start the server and review config.yml.`,
  ].join('\n');
}
