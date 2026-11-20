import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Eye,
  FolderArchive,
  Medal,
  MessageSquare,
  Package,
  Server,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { CategoryId, NavTab } from '../types';
import { resolveMemberServerRoles } from '../utils/ranksAndFriendsLogic';
import { StudioStatsOverview, type StatsListCategory } from '../utils/siteStatsLogic';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';
import { ServerRankBadge } from './ServerRankBadge';

interface SiteStatsHomeStripProps {
  overview: StudioStatsOverview;
  cloudConnected: boolean;
  onOpenFullStats: () => void;
}

export const SiteStatsHomeStrip: React.FC<SiteStatsHomeStripProps> = ({
  overview,
  cloudConnected,
  onOpenFullStats,
}) => {
  const quickCounters = [
    { id: 'visits', label: 'Visits', value: overview.visits, accent: 'text-sky-300' },
    { id: 'members', label: 'Members', value: overview.membersCount, accent: 'text-emerald-300' },
    { id: 'staffs', label: 'Staffs', value: overview.staffCount, accent: 'text-rose-300' },
    { id: 'resources', label: 'Packages', value: overview.resourcesCount, accent: 'text-zinc-100' },
    { id: 'servers', label: 'Servers', value: overview.serversCount, accent: 'text-amber-300' },
    { id: 'tiers', label: 'Tier Players', value: overview.tierPlayersCount, accent: 'text-zinc-100' },
    { id: 'tools', label: 'Tools', value: overview.toolsCount, accent: 'text-zinc-100' },
  ];

  return (
    <section aria-label="Studio visits, members, staff and catalog counts" className="mx-auto mt-6 max-w-[1200px] px-4 sm:px-6">
      <div className="rounded-lg border border-zinc-800/90 bg-[#0d0d12] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-rose-400" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Studio Live Stats &amp; Directory
            </h2>
            <span
              className={`font-display-mono rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                cloudConnected
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400'
              }`}
            >
              {cloudConnected ? 'Live' : 'Syncing'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenFullStats}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 whitespace-nowrap"
          >
            <span>View full list</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {quickCounters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={onOpenFullStats}
              aria-label={`${item.label}: ${item.value.toLocaleString()}`}
              className="rounded-md border border-zinc-800/80 bg-zinc-950/75 px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              <p className="text-[11px] font-medium text-zinc-400">{item.label}</p>
              <p className={`mt-0.5 font-display-mono text-base font-extrabold tabular-nums ${item.accent}`}>
                {item.value.toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

interface SiteStatsViewProps {
  overview: StudioStatsOverview;
  cloudConnected: boolean;
  isSignedIn: boolean;
  onSelectTab: (tab: NavTab) => void;
  onOpenCategory: (category: CategoryId) => void;
  onRequireAuth: () => void;
}

function rowIcon(rowId: string) {
  switch (rowId) {
    case 'visits':
      return <Eye className="h-4 w-4 text-sky-400" aria-hidden="true" />;
    case 'members':
      return <Users className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
    case 'staffs':
      return <ShieldCheck className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'resources':
      return <Package className="h-4 w-4 text-amber-300" aria-hidden="true" />;
    case 'servers':
      return <Server className="h-4 w-4 text-emerald-300" aria-hidden="true" />;
    case 'tiers':
      return <Medal className="h-4 w-4 text-amber-400" aria-hidden="true" />;
    case 'tools':
      return <Wrench className="h-4 w-4 text-rose-300" aria-hidden="true" />;
    case 'threads':
      return <MessageSquare className="h-4 w-4 text-sky-300" aria-hidden="true" />;
    default:
      return <Activity className="h-4 w-4 text-zinc-400" aria-hidden="true" />;
  }
}

export const SiteStatsView: React.FC<SiteStatsViewProps> = ({
  overview,
  cloudConnected,
  isSignedIn,
  onSelectTab,
  onOpenCategory,
  onRequireAuth,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | StatsListCategory>('all');

  const filteredRows = useMemo(() => {
    if (categoryFilter === 'all') return overview.rows;
    return overview.rows.filter((r) => r.category === categoryFilter);
  }, [overview.rows, categoryFilter]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 space-y-6">
      {/* Studio Stats Header */}
      <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/40 bg-rose-600/15 text-rose-300">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Studio Stats &amp; Roster
              </h1>
              <span
                className={`rounded border px-2 py-0.5 font-display-mono text-[10px] font-semibold uppercase tracking-wider ${
                  cloudConnected
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}
              >
                {cloudConnected ? 'Firestore Live' : 'Syncing'}
              </span>
            </div>
            <p className="max-w-2xl text-xs sm:text-sm text-zinc-400">
              Live overview of SwxStudios visits, verified members, studio staff, and every resource, server, tool, and PvP tier listing across the platform.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Visits</p>
              <p className="font-display-mono text-lg font-extrabold text-sky-300 tabular-nums">
                {overview.visits.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Members</p>
              <p className="font-display-mono text-lg font-extrabold text-emerald-300 tabular-nums">
                {overview.membersCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Staffs</p>
              <p className="font-display-mono text-lg font-extrabold text-rose-300 tabular-nums">
                {overview.staffCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Total Stuffs</p>
              <p className="font-display-mono text-lg font-extrabold text-amber-300 tabular-nums">
                {overview.totalStuffsCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Complete Studio Breakdown List */}
      <section
        aria-label="Complete platform breakdown list"
        className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0d0d12]"
      >
        <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-white">
              Visits, Members, Staffs &amp; Stuffs List
            </h2>
            <p className="text-xs text-zinc-400">
              Live counts across traffic, community accounts, staff, and studio inventory.
            </p>
          </div>

          <div role="group" aria-label="Filter breakdown list" className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'traffic', label: 'Traffic' },
                { id: 'people', label: 'People' },
                { id: 'stuffs', label: 'Stuffs' },
              ] as const
            ).map((tab) => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
                    active
                      ? 'border border-rose-500/60 bg-rose-600 text-white'
                      : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-[#08080a] text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-5 py-3">Item / Metric</th>
                <th className="px-3 py-3">Group</th>
                <th className="px-3 py-3">Details</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="w-28 px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {filteredRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-900/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
                        {rowIcon(row.id)}
                      </span>
                      <span className="font-semibold text-white">{row.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-display-mono text-[10px] font-semibold uppercase text-zinc-300">
                      {row.categoryLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-zinc-400">{row.detail}</td>
                  <td className="px-4 py-3.5 text-right font-display-mono text-sm font-extrabold text-white tabular-nums">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {row.targetTab ? (
                      <button
                        type="button"
                        onClick={() => onSelectTab(row.targetTab!)}
                        className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/50 hover:text-white"
                      >
                        <span>{row.actionLabel || 'Open'}</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="font-display-mono text-[11px] text-zinc-500">Live</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked List */}
        <div className="divide-y divide-zinc-800/70 md:hidden">
          {filteredRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
                  {rowIcon(row.id)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-bold text-white">{row.label}</p>
                    <span className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-display-mono text-[9px] font-semibold uppercase text-zinc-400">
                      {row.categoryLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{row.detail}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display-mono text-base font-extrabold text-white tabular-nums">
                  {row.count.toLocaleString()}
                </p>
                {row.targetTab && (
                  <button
                    type="button"
                    onClick={() => onSelectTab(row.targetTab!)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400"
                  >
                    <span>{row.actionLabel || 'Open'}</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog "Stuffs" 9-Category Breakdown */}
      <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <h2 className="text-sm font-bold text-white">Catalog Stuffs by Category</h2>
          </div>
          <span className="font-display-mono text-xs text-zinc-400 tabular-nums">
            {overview.resourcesCount} packages · {overview.totalDownloads.toLocaleString()} downloads
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {overview.categoryBreakdown.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onOpenCategory(cat.id)}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-900/70"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-100">{cat.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">{cat.description}</p>
              </div>
              <div className="shrink-0 text-right font-display-mono tabular-nums">
                <p className="text-sm font-extrabold text-white">{cat.count}</p>
                <p className="text-[10px] text-zinc-500">{cat.downloads} dl</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Staff Roster & Verified Members Roster */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Staff Roster */}
        <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-400" aria-hidden="true" />
              <h2 className="text-sm font-bold text-white">Studio Staff Roster</h2>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('ranks')}
              className="font-display-mono text-xs text-indigo-300 hover:text-indigo-200 tabular-nums"
            >
              {overview.staffCount} total · View Ranks
            </button>
          </div>

          <ul className="space-y-2.5">
            {overview.staffs.map((staff) => (
              <li
                key={staff.uid}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/75 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MinecraftHeadAvatar
                    avatarUrl={staff.avatarUrl}
                    username={staff.displayName}
                    alt={`${staff.displayName} avatar`}
                    initials={staff.displayName.slice(0, 2).toUpperCase()}
                    className="h-9 w-9 shrink-0 rounded-md border border-zinc-700 bg-zinc-900"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{staff.displayName}</p>
                    <p className="text-[11px] text-zinc-500">
                      {staff.role === 'owner'
                        ? 'Full Studio & Catalog Controls'
                        : 'Combat PvP Tier Administrator'}
                    </p>
                  </div>
                </div>
                <ServerRankBadge
                  rankId={staff.role === 'owner' ? 'owner' : 'admin'}
                  size="xs"
                  showIcon
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Registered Members List */}
        <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-bold text-white">Verified Members</h2>
            </div>
            <span className="font-display-mono text-xs text-zinc-400 tabular-nums">
              {overview.membersCount} registered
            </span>
          </div>

          {overview.members.length === 0 ? (
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-6 text-center space-y-2.5">
              <p className="text-xs font-bold text-zinc-200">0 verified members registered yet</p>
              <p className="mx-auto max-w-sm text-[11px] text-zinc-400">
                Real members appear here automatically after signing up and verifying their account.
              </p>
              {!isSignedIn && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="inline-flex h-8 items-center rounded-md bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-500"
                >
                  Sign In / Join Studio
                </button>
              )}
            </div>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {overview.members.map((member) => {
                const resolved = resolveMemberServerRoles(member);
                return (
                  <li
                    key={member.uid}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/75 px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MinecraftHeadAvatar
                        avatarUrl={member.avatarUrl}
                        username={member.displayName}
                        alt={`${member.displayName} avatar`}
                        initials={member.displayName.slice(0, 2).toUpperCase()}
                        className="h-9 w-9 shrink-0 rounded-md border border-zinc-700 bg-zinc-900"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">{member.displayName}</p>
                        <p className="font-display-mono text-[11px] text-zinc-500 tabular-nums">
                          {member.xp.toLocaleString()} XP
                        </p>
                      </div>
                    </div>
                    <ServerRankBadge rankId={resolved.primaryRank} size="xs" showIcon />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
