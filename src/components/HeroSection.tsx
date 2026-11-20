import React from 'react';
import { ArrowRight, Dices, Search } from 'lucide-react';
import { CATEGORIES, POPULAR_SEARCHES } from '../data/catalog';
import {
  CategoryId,
  LiveServerStatus,
  MinecraftServerListing,
  ProbeRegionId,
  ResourceTierFilter,
} from '../types';
import { InteractiveHeroServerCard } from './MinecraftTextPreview';
import { CategoryVoxelIcon, HeroVoxelBackdrop } from './ResourceArtwork';

const TIER_FILTER_OPTIONS: { id: ResourceTierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
  { id: 'popular', label: 'Popular' },
  { id: 'premium', label: 'Premium' },
  { id: 'ultimate', label: 'Ultimate' },
];

interface HeroSectionProps {
  query: string;
  selectedCategory: CategoryId | 'all';
  selectedTier: ResourceTierFilter;
  totalResourcesCount: number;
  threadsCount: number;
  listedServersCount: number;
  featuredServers: MinecraftServerListing[];
  liveStatusMap: Record<string, LiveServerStatus>;
  probeRegion?: ProbeRegionId;
  categoryCounts: Record<CategoryId, number>;
  tierCounts: Record<ResourceTierFilter, number>;
  onQueryChange: (value: string) => void;
  onCategoryChange: (category: CategoryId | 'all') => void;
  onTierChange: (tier: ResourceTierFilter) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onSelectPopularTerm: (term: string) => void;
  onSurpriseMe: () => void;
  onBrowseEverything: () => void;
  onRefreshServer: (srv: MinecraftServerListing) => void;
  onOpenServers: () => void;
  onOpenMotdTool: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  query,
  selectedCategory,
  selectedTier,
  totalResourcesCount,
  threadsCount,
  listedServersCount,
  featuredServers,
  liveStatusMap,
  probeRegion = 'asia',
  categoryCounts,
  tierCounts,
  onQueryChange,
  onCategoryChange,
  onTierChange,
  onSearchSubmit,
  onSelectPopularTerm,
  onSurpriseMe,
  onBrowseEverything,
  onRefreshServer,
  onOpenServers,
  onOpenMotdTool,
}) => {
  const onlineServersCount = featuredServers.filter(
    (s) => liveStatusMap[s.id]?.online === true
  ).length;

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
      <div className="relative overflow-hidden rounded-lg border border-zinc-800/80 bg-[#0d0d12] p-5 sm:p-8">
        <HeroVoxelBackdrop />

        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <h1 className="font-display text-[clamp(1.75rem,3.4vw,2.6rem)] font-extrabold leading-[1.1] tracking-tight text-white [text-wrap:balance]">
              Plugins, maps and live tools for your{' '}
              <span className="font-display-mono font-semibold text-rose-400">
                Minecraft
              </span>{' '}
              server
            </h1>

            {/* Live Studio Counts */}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display-mono text-[11px] sm:text-xs text-zinc-400 tabular-nums">
              <span className="whitespace-nowrap">
                <strong className="font-semibold text-zinc-100">{totalResourcesCount}</strong>{' '}
                {totalResourcesCount === 1 ? 'resource' : 'resources'}
              </span>
              <span aria-hidden="true" className="text-zinc-700">·</span>
              <span className="whitespace-nowrap">
                <strong className="font-semibold text-emerald-300">
                  {onlineServersCount > 0 ? onlineServersCount : listedServersCount}
                </strong>{' '}
                {onlineServersCount > 0
                  ? `/${listedServersCount} servers live`
                  : listedServersCount === 1
                  ? 'live server'
                  : 'live servers'}
              </span>
              <span aria-hidden="true" className="text-zinc-700">·</span>
              <span className="whitespace-nowrap">
                <strong className="font-semibold text-zinc-100">{threadsCount}</strong>{' '}
                {threadsCount === 1 ? 'thread' : 'threads'}
              </span>
            </div>

            {/* Search Form */}
            <form onSubmit={onSearchSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <label htmlFor="hero-search-input" className="sr-only">
                  Search plugins, configs, maps
                </label>
                <input
                  id="hero-search-input"
                  type="search"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search plugins, configs, maps..."
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <label htmlFor="hero-category-select" className="sr-only">
                  Filter by category
                </label>
                <select
                  id="hero-category-select"
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value as CategoryId | 'all')}
                  className="h-10 flex-1 sm:w-44 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 focus:border-rose-500 focus:outline-none"
                >
                  <option value="all">All categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="h-10 rounded-md bg-rose-600 px-5 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Popular Searches */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-zinc-500">Popular:</span>
              {POPULAR_SEARCHES.map((term, idx) => (
                <React.Fragment key={term}>
                  <button
                    type="button"
                    onClick={() => onSelectPopularTerm(term)}
                    className={`transition-colors hover:text-white focus-visible:outline-none focus-visible:underline ${
                      query.toLowerCase() === term ? 'font-semibold text-white underline' : 'text-zinc-400'
                    }`}
                  >
                    {term}
                  </button>
                  {idx < POPULAR_SEARCHES.length - 1 && (
                    <span aria-hidden="true" className="text-zinc-700">·</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <InteractiveHeroServerCard
              featuredServers={featuredServers}
              liveStatusMap={liveStatusMap}
              probeRegion={probeRegion}
              onRefreshServer={onRefreshServer}
              onOpenServers={onOpenServers}
              onOpenMotdTool={onOpenMotdTool}
            />
          </div>
        </div>

        {/* Balanced 3x3 Category Index */}
        <div className="relative z-10 mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-800/60 sm:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(isSelected ? 'all' : cat.id)}
                className={`group flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500/60 ${
                  isSelected
                    ? 'bg-rose-950/35 text-white'
                    : 'bg-[#0b0b0e] text-zinc-300 hover:bg-zinc-900/90 hover:text-white'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryVoxelIcon category={cat.id} />
                  <span className="truncate text-xs font-semibold">{cat.label}</span>
                </span>
                <span className="font-display-mono shrink-0 text-[11px] text-zinc-500 tabular-nums group-hover:text-zinc-300">
                  {categoryCounts[cat.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tier Filter Strip: Free, Paid, Popular, Premium, Ultimate */}
        <div
          role="group"
          aria-label="Filter by package tier"
          className="relative z-10 mt-4 flex flex-wrap items-center gap-1.5"
        >
          {TIER_FILTER_OPTIONS.map((opt) => {
            const active = selectedTier === opt.id;
            const count = tierCounts[opt.id] ?? 0;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onTierChange(active && opt.id !== 'all' ? 'all' : opt.id)}
                aria-pressed={active}
                className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 ${
                  active
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-zinc-800 bg-[#0b0b0e] text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`font-display-mono text-[11px] tabular-nums ${
                    active ? 'text-rose-100' : 'text-zinc-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Discovery Strip */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500">Not sure where to start?</span>
          <button
            type="button"
            onClick={onSurpriseMe}
            className="inline-flex items-center gap-1.5 font-semibold text-zinc-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <Dices className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
            <span>Surprise Me</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onBrowseEverything}
          className="inline-flex items-center gap-1.5 font-semibold text-zinc-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
        >
          <span>Browse all resources</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
