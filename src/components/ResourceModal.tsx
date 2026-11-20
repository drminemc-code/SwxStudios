import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Film,
  Flame,
  History,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  Package,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { MembershipTier, ResourceItem } from '../types';
import { defaultResourceTypeForCategory } from '../utils/adminLogic';
import { canAccessResource, getEffectiveResourceTier } from '../utils/catalogLogic';
import { ResourceArtwork } from './ResourceArtwork';

type DetailTab = 'overview' | 'dependencies' | 'updates' | 'reviews' | 'history';
type MediaMode = 'carousel' | 'video';

interface ResourceModalProps {
  resource: ResourceItem | null;
  isPremium: boolean;
  membershipTier?: MembershipTier;
  purchasedIds?: string[];
  isBookmarked: boolean;
  hasDownloaded: boolean;
  onClose: () => void;
  onDownload: (resource: ResourceItem) => void;
  onToggleBookmark: (resourceId: string) => void;
  onRate: (resourceId: string, score: number) => void;
  onOpenPremium: () => void;
}

function formatDisplayDate(raw?: string): string {
  if (!raw) return 'Recently';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
  }
  return trimmed;
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
      if (parsed.pathname.startsWith('/embed/')) return url;
    }
  } catch {
    return null;
  }
  return null;
}

export const ResourceModal: React.FC<ResourceModalProps> = ({
  resource,
  isPremium,
  membershipTier = isPremium ? 'premium' : 'free',
  purchasedIds = [],
  isBookmarked,
  hasDownloaded,
  onClose,
  onDownload,
  onToggleBookmark,
  onRate,
  onOpenPremium,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [mediaMode, setMediaMode] = useState<MediaMode>('carousel');
  const [selectedScore, setSelectedScore] = useState<number>(10);
  const [ratedId, setRatedId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab('overview');
    setMediaMode('carousel');
  }, [resource?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (resource) {
      window.addEventListener('keydown', onKey);
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [resource, onClose]);

  const resolvedSpecs = useMemo(() => {
    if (!resource) return null;
    const views = resource.views ?? Math.max(resource.downloads * 4, resource.downloads);
    const publishedLabel = formatDisplayDate(resource.publishedAt || resource.updatedAt);
    const updatedLabel = formatDisplayDate(resource.updatedAt || resource.publishedAt);
    const resourceType =
      resource.resourceType || defaultResourceTypeForCategory(resource.category);
    const gameModes =
      resource.gameModes && resource.gameModes.length > 0 ? resource.gameModes : ['Survival'];
    const supportedSoftware =
      resource.supportedSoftware && resource.supportedSoftware.length > 0
        ? resource.supportedSoftware
        : ['Bukkit', 'Spigot', 'Paper', 'Purpur'];
    const supportedVersions =
      resource.supportedVersions && resource.supportedVersions.length > 0
        ? resource.supportedVersions
        : resource.mcVersions
            .split(/[\s,-]+/)
            .map((v) => v.trim())
            .filter(Boolean)
            .slice(0, 6);
    const supportedLanguages =
      resource.supportedLanguages && resource.supportedLanguages.length > 0
        ? resource.supportedLanguages
        : ['English'];
    const dependencies = resource.dependencies ?? [];
    const changelog =
      resource.changelog && resource.changelog.length > 0
        ? resource.changelog
        : [
            {
              version: resource.version,
              date: updatedLabel,
              notes: 'Current verified studio release package.',
            },
          ];

    return {
      views,
      publishedLabel,
      updatedLabel,
      resourceType,
      gameModes,
      supportedSoftware,
      supportedVersions: supportedVersions.length > 0 ? supportedVersions : [resource.mcVersions],
      supportedLanguages,
      dependencies,
      changelog,
      openSource: Boolean(resource.openSource),
      drmFree: resource.drmFree !== false,
      unobfuscated: resource.unobfuscated !== false,
      aiMarketing: Boolean(resource.aiMarketing),
      aiProduct: Boolean(resource.aiProduct),
    };
  }, [resource]);

  if (!resource || !resolvedSpecs) return null;

  const effectiveTier = getEffectiveResourceTier(resource);
  const locked = !canAccessResource(resource, membershipTier, { isPremium, purchasedIds });
  const alreadyRated = ratedId === resource.id;
  const filledStars = Math.max(
    0,
    Math.min(5, Math.round((resource.rating > 0 ? resource.rating : 0) / 2))
  );
  const youtubeEmbed = resource.demoVideoUrl ? toYouTubeEmbedUrl(resource.demoVideoUrl) : null;

  const handleRatingSubmit = () => {
    onRate(resource.id, selectedScore);
    setRatedId(resource.id);
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'updates', label: `Updates (${resolvedSpecs.changelog.length})` },
    { id: 'reviews', label: `Reviews (${resource.ratingCount})` },
    { id: 'history', label: 'History' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0d0d11] text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Summary Header */}
        <div className="relative flex flex-col gap-3 border-b border-zinc-800/90 bg-[#111114] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 flex-1 pr-11 sm:pr-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wide text-zinc-300">
                {resource.category}
              </span>
              <span aria-hidden="true">·</span>
              <span>by {resource.author}</span>
              <span aria-hidden="true">·</span>
              <span className="font-display-mono text-zinc-200">{resource.version}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold uppercase ${
                  effectiveTier === 'ultimate'
                    ? 'text-violet-300'
                    : effectiveTier === 'premium'
                    ? 'text-amber-300'
                    : effectiveTier === 'paid'
                    ? 'text-sky-300'
                    : 'text-emerald-300'
                }`}
              >
                {effectiveTier}
                {resource.priceLabel ? ` (${resource.priceLabel})` : ''}
              </span>
              {resource.popular && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-white">
                    <Flame className="h-3 w-3 text-amber-400" aria-hidden="true" />
                    Popular
                  </span>
                </>
              )}
            </div>

            <h2
              id="resource-modal-title"
              className="mt-1 truncate text-lg font-bold text-white sm:text-xl"
            >
              {resource.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleBookmark(resource.id)}
              aria-label={
                isBookmarked
                  ? `Remove ${resource.title} from saved`
                  : `Save ${resource.title}`
              }
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${
                isBookmarked
                  ? 'border-white/50 bg-white/10 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            {locked && effectiveTier === 'paid' ? (
              <button
                type="button"
                onClick={() => onDownload(resource)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sky-400 px-3.5 text-xs font-bold text-zinc-950 transition-colors hover:bg-sky-300"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{resource.priceLabel ? `Get (${resource.priceLabel})` : 'Unlock'}</span>
              </button>
            ) : locked ? (
              <button
                type="button"
                onClick={onOpenPremium}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold text-zinc-950 transition-colors ${
                  effectiveTier === 'ultimate'
                    ? 'bg-violet-400 hover:bg-violet-300'
                    : 'bg-amber-400 hover:bg-amber-300'
                }`}
              >
                {effectiveTier === 'ultimate' ? (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{effectiveTier === 'ultimate' ? 'Ultimate' : 'Premium'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDownload(resource)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-4 text-xs font-bold text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{hasDownloaded ? 'Download Again' : 'Download'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close resource details"
              className="absolute right-4 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white sm:static"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Two-Column Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Primary Column: Tab Bar + Content */}
            <div className="min-w-0 lg:col-span-8">
              {/* Top 5-Tab Bar matching reference */}
              <div
                role="tablist"
                aria-label="Resource sections"
                className="flex items-stretch overflow-x-auto rounded-t-lg border border-zinc-800 bg-[#111114]"
              >
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative shrink-0 border-r border-zinc-800/80 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors last:border-r-0 sm:px-4 sm:py-3 sm:text-xs ${
                        active
                          ? 'bg-[#17171d] text-sky-400'
                          : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200'
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 top-0 h-0.5 bg-sky-400"
                        />
                      )}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Panel */}
              <div
                role="tabpanel"
                className="rounded-b-lg border border-t-0 border-zinc-800 bg-[#111114] p-4 sm:p-5"
              >
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    {/* Media Mode Toggle: Carousel | Demo video */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-zinc-400">{resource.subtitle}</p>
                      <div
                        className="inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5"
                        role="group"
                        aria-label="Preview media mode"
                      >
                        <button
                          type="button"
                          onClick={() => setMediaMode('carousel')}
                          aria-pressed={mediaMode === 'carousel'}
                          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                            mediaMode === 'carousel'
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Carousel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMediaMode('video')}
                          aria-pressed={mediaMode === 'video'}
                          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                            mediaMode === 'video'
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Film className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Demo video</span>
                        </button>
                      </div>
                    </div>

                    {/* Preview Viewport */}
                    {mediaMode === 'carousel' ? (
                      <div className="relative h-52 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 sm:h-64">
                        <ResourceArtwork theme={resource.artwork} title={resource.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-200">
                          <span className="font-display-mono rounded border border-zinc-700/80 bg-zinc-950/90 px-2.5 py-1">
                            {resource.fileName}
                          </span>
                          <span className="rounded border border-zinc-700/80 bg-zinc-950/90 px-2.5 py-1 font-medium">
                            {resolvedSpecs.resourceType}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                        {youtubeEmbed ? (
                          <div className="aspect-video w-full">
                            <iframe
                              src={youtubeEmbed}
                              title={`${resource.title} demo video`}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : resource.demoVideoUrl ? (
                          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                            <Film className="h-8 w-8 text-sky-400" aria-hidden="true" />
                            <div>
                              <p className="text-sm font-semibold text-white">
                                External Demo Video Showcase
                              </p>
                              <p className="mt-1 break-all text-xs text-zinc-400">
                                {resource.demoVideoUrl}
                              </p>
                            </div>
                            <a
                              href={resource.demoVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800"
                            >
                              <span>Watch Demo Video</span>
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          </div>
                        ) : (
                          <div className="flex h-52 flex-col items-center justify-center gap-2 px-4 text-center sm:h-64">
                            <Film className="h-7 w-7 text-zinc-600" aria-hidden="true" />
                            <p className="text-sm font-semibold text-zinc-300">
                              No demo video uploaded yet
                            </p>
                            <p className="text-xs text-zinc-500">
                              The studio owner can attach a YouTube or demo showcase URL in Owner Admin.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Overview Description */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Overview
                      </h3>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                        {resource.description}
                      </p>
                    </div>

                    {/* Included Features */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Included in package
                      </h3>
                      <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
                        {resource.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                              aria-hidden="true"
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'dependencies' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                      <Layers className="h-4 w-4 text-sky-400" aria-hidden="true" />
                      <h3 className="text-sm font-bold text-white">Required & Optional Dependencies</h3>
                    </div>

                    {resolvedSpecs.dependencies.length === 0 ? (
                      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-6 text-center">
                        <Package className="mx-auto h-6 w-6 text-emerald-400" aria-hidden="true" />
                        <p className="mt-2 text-sm font-semibold text-zinc-200">
                          No external dependencies required
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          This package runs standalone out of the box on supported server software.
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {resolvedSpecs.dependencies.map((dep) => (
                          <li
                            key={dep}
                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200"
                          >
                            <span className="font-medium">{dep}</span>
                            <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                              Dependency
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === 'updates' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                      <h3 className="text-sm font-bold text-white">Release Updates & Changelogs</h3>
                      <span className="font-display-mono text-xs text-zinc-400">
                        Latest: {resource.version}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {resolvedSpecs.changelog.map((entry, idx) => (
                        <div
                          key={`${entry.version}-${idx}`}
                          className="rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-display-mono text-xs font-bold text-sky-300">
                              {entry.version}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatDisplayDate(entry.date)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                            {entry.notes}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                      <div>
                        <p className="text-xs text-zinc-400">Community Score</p>
                        <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                          {resource.rating.toFixed(1)}{' '}
                          <span className="text-sm font-normal text-zinc-500">/ 10</span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
                          Based on {resource.ratingCount}{' '}
                          {resource.ratingCount === 1 ? 'review' : 'reviews'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((idx) => (
                          <Star
                            key={idx}
                            className={`h-5 w-5 ${
                              idx < filledStars
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-zinc-300">
                          <Star className="h-4 w-4 text-amber-400" aria-hidden="true" />
                          <span>
                            {alreadyRated
                              ? 'Thanks for submitting your review.'
                              : 'Submit your rating (1–10):'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="rating-select" className="sr-only">
                            Rating score out of 10
                          </label>
                          <select
                            id="rating-select"
                            value={selectedScore}
                            onChange={(e) => setSelectedScore(Number(e.target.value))}
                            disabled={alreadyRated}
                            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 tabular-nums disabled:opacity-50"
                          >
                            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>
                                {n}.0 / 10
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleRatingSubmit}
                            disabled={alreadyRated}
                            className="h-8 rounded border border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            {alreadyRated ? 'Rated' : 'Submit Review'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                      <History className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                      <h3 className="text-sm font-bold text-white">Package Version & File History</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs">
                        <p className="text-zinc-500">Current Build Version</p>
                        <p className="mt-1 font-display-mono text-sm font-bold text-white">
                          {resource.version}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs">
                        <p className="text-zinc-500">Archive Filename</p>
                        <p className="mt-1 truncate font-display-mono text-sm font-semibold text-zinc-200">
                          {resource.fileName}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs">
                        <p className="text-zinc-500">Published Date</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">
                          {resolvedSpecs.publishedLabel}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs">
                        <p className="text-zinc-500">Last Updated</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">
                          {resolvedSpecs.updatedLabel}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4">
                      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                        <span>Recorded Versions</span>
                      </p>
                      <div className="divide-y divide-zinc-800/70">
                        {resolvedSpecs.changelog.map((entry, idx) => (
                          <div
                            key={`${entry.version}-hist-${idx}`}
                            className="flex items-center justify-between py-2 text-xs"
                          >
                            <span className="font-display-mono font-semibold text-zinc-200">
                              {entry.version}
                            </span>
                            <span className="text-zinc-400">{formatDisplayDate(entry.date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Spec Sidebar matching Reference Screenshot 1 */}
            <aside className="space-y-3 lg:col-span-4" aria-label="Resource specifications">
              {/* 2x3 Metric Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border border-zinc-800 bg-[#111114] px-3 py-3 text-center">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {resolvedSpecs.views.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">Views</p>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-[#111114] px-3 py-3 text-center">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {resource.downloads.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">Downloads</p>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-[#111114] px-3 py-3 text-center">
                  <p className="text-xs font-bold text-zinc-100">
                    {resolvedSpecs.publishedLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">Published</p>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-[#111114] px-3 py-3 text-center">
                  <p className="text-xs font-bold text-zinc-100">
                    {resolvedSpecs.updatedLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">Updated</p>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-[#111114] px-3 py-3 text-center">
                  <div
                    className="flex items-center justify-center gap-0.5"
                    aria-label={`Average rating ${resource.rating.toFixed(1)} out of 10`}
                  >
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <Star
                        key={idx}
                        className={`h-3.5 w-3.5 ${
                          idx < filledStars
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-zinc-800 text-zinc-700'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">
                    Average rating ({resource.ratingCount})
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-[#111114] px-3 py-3 text-center">
                  <p className="text-sm font-bold text-white tabular-nums">{resource.fileSize}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">File size</p>
                </div>
              </div>

              {/* Tags Box */}
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {(resource.tags.length > 0 ? resource.tags : [resource.category]).map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Compliance Flags Box */}
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-300">Open source:</span>
                  <span className="inline-flex items-center gap-1.5 text-zinc-200">
                    <span>{resolvedSpecs.openSource ? 'Yes' : 'No'}</span>
                    <span title="Whether full source code is included" className="inline-flex">
                      <Info className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-300">DRM-free:</span>
                  <span className="inline-flex items-center gap-1.5 text-zinc-200">
                    <span>{resolvedSpecs.drmFree ? 'Yes' : 'No'}</span>
                    <span title="Runs without external license key DRM checks" className="inline-flex">
                      <Info className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-300">Unobfuscated:</span>
                  <span className="inline-flex items-center gap-1.5 text-zinc-200">
                    <span>{resolvedSpecs.unobfuscated ? 'Yes' : 'No'}</span>
                    <span title="Code or assets are readable without obfuscation" className="inline-flex">
                      <Info className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                    </span>
                  </span>
                </div>
              </div>

              {/* Technical Specs Box */}
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3.5 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 pt-0.5 font-semibold text-zinc-300">Type:</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200">
                      {resolvedSpecs.resourceType}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 pt-0.5 font-semibold text-zinc-300">Game mode:</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {resolvedSpecs.gameModes.map((mode) => (
                      <span
                        key={mode}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200"
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 pt-0.5 font-semibold text-zinc-300">
                    Supported software:
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {resolvedSpecs.supportedSoftware.map((sw) => (
                      <span
                        key={sw}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200"
                      >
                        {sw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 pt-0.5 font-semibold text-zinc-300">
                    Supported versions:
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {resolvedSpecs.supportedVersions.map((ver) => (
                      <span
                        key={ver}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-display-mono text-[11px] text-zinc-200"
                      >
                        {ver}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 pt-0.5 font-semibold text-zinc-300">
                    Supported languages:
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {resolvedSpecs.supportedLanguages.map((lang) => (
                      <span
                        key={lang}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-200"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {locked && (
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {effectiveTier === 'ultimate'
                      ? 'Ultimate Membership Required'
                      : effectiveTier === 'paid'
                      ? 'Paid Package Release'
                      : 'Premium Membership Required'}
                  </span>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};
