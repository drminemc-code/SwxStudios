import React, { useState } from 'react';
import { Bookmark, Download, Search, X } from 'lucide-react';
import { CATEGORIES } from '../data/catalog';
import { CategoryId, MembershipTier, ResourceItem, ResourceTierFilter, SortOption } from '../types';
import { countByTier, filterResources, sortResources } from '../utils/catalogLogic';
import { ResourceCard } from './ResourceCard';

const TIER_TABS: { id: ResourceTierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
  { id: 'popular', label: 'Popular' },
  { id: 'premium', label: 'Premium' },
  { id: 'ultimate', label: 'Ultimate' },
];

interface DownloadsViewProps {
  resources: ResourceItem[];
  downloadedIds: string[];
  bookmarkedIds: string[];
  isPremium: boolean;
  membershipTier?: MembershipTier;
  purchasedIds?: string[];
  initialCategory?: CategoryId | 'all';
  initialTier?: ResourceTierFilter;
  initialQuery?: string;
  onSelectResource: (resource: ResourceItem) => void;
  onDownloadResource: (resource: ResourceItem) => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  resources,
  downloadedIds,
  bookmarkedIds,
  isPremium,
  membershipTier = isPremium ? 'premium' : 'free',
  purchasedIds = [],
  initialCategory = 'all',
  initialTier = 'all',
  initialQuery = '',
  onSelectResource,
  onDownloadResource,
}) => {
  const [subTab, setSubTab] = useState<'all' | 'history' | 'saved'>('all');
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CategoryId | 'all'>(initialCategory);
  const [tierFilter, setTierFilter] = useState<ResourceTierFilter>(initialTier);
  const [sortBy, setSortBy] = useState<SortOption>('downloads');

  const baseList =
    subTab === 'history'
      ? resources.filter((r) => downloadedIds.includes(r.id))
      : subTab === 'saved'
      ? resources.filter((r) => bookmarkedIds.includes(r.id))
      : resources;

  const tierCounts = countByTier(baseList);

  const filtered = sortResources(
    filterResources(baseList, { query, category, tierFilter }),
    sortBy
  );

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Resource Directory &amp; Downloads
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Browse Free, Paid, Popular, Premium, and Ultimate plugins, server setups, and configurations.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setSubTab('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'all' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            All Resources ({resources.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'history' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>My Downloads ({downloadedIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('saved')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'saved' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Saved ({bookmarkedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <label htmlFor="catalog-search" className="sr-only">
            Filter catalog
          </label>
          <input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, author, or tag..."
            className="h-10 w-full rounded-md border border-zinc-800 bg-[#111114] pl-9 pr-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2.5">
          <label htmlFor="catalog-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="catalog-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId | 'all')}
            className="h-10 rounded-md border border-zinc-800 bg-[#111114] px-3 text-xs font-medium text-zinc-200 focus:border-zinc-500 focus:outline-none"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <label htmlFor="catalog-sort" className="sr-only">
            Sort resources
          </label>
          <select
            id="catalog-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-10 rounded-md border border-zinc-800 bg-[#111114] px-3 text-xs font-medium text-zinc-200 focus:border-zinc-500 focus:outline-none"
          >
            <option value="downloads">Most downloaded</option>
            <option value="rating">Highest rated</option>
            <option value="newest">Recently updated</option>
          </select>
        </div>
      </div>

      {/* Tier Filter Strip */}
      <div
        role="group"
        aria-label="Filter directory by tier"
        className="mt-3 flex flex-wrap items-center gap-1.5"
      >
        {TIER_TABS.map((t) => {
          const active = tierFilter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierFilter(t.id)}
              aria-pressed={active}
              className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${
                active
                  ? 'border-white bg-white text-zinc-950'
                  : 'border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`font-display-mono text-[11px] tabular-nums ${
                  active ? 'text-zinc-700' : 'text-zinc-500'
                }`}
              >
                {tierCounts[t.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="mt-6 border-t border-zinc-800/80 py-8">
          <p className="text-sm font-semibold text-zinc-200">
            {subTab === 'history'
              ? 'You have not downloaded any packages yet.'
              : subTab === 'saved'
              ? 'No saved resources yet.'
              : resources.length === 0
              ? 'No resources published yet.'
              : 'No resources matched your active filters.'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {subTab === 'all' && resources.length === 0
              ? 'Plugins, setups, and configs uploaded by the studio will show up here.'
              : subTab === 'all'
              ? 'Try clearing your search, tier filter, or switching categories.'
              : 'Browse the catalog and click Download or Save on any resource.'}
          </p>
          {(query || category !== 'all' || tierFilter !== 'all' || subTab !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSubTab('all');
                setQuery('');
                setCategory('all');
                setTierFilter('all');
              }}
              className="mt-4 h-9 rounded-md bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-zinc-200"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((item, idx) => (
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
