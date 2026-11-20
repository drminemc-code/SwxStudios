import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Axe,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Crown,
  FlaskConical,
  Gem,
  Hammer,
  Heart,
  Info,
  Lock,
  Medal,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Terminal,
  Trash2,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import type { PublicMemberProfile } from '../types';
import { resolveMemberServerRoles } from '../utils/ranksAndFriendsLogic';
import {
  calculateTierPoints,
  compareTierRanks,
  getTierGroupNumber,
  isHighTier,
  pickHigherTierRank,
  resolveCombatTitle,
  sortTierLeaderboard,
  TIER_COMMAND_EXAMPLES,
  TIER_MODES,
  TIER_POINT_WEIGHTS,
  TIER_RANKS,
  TIER_REGIONS,
  type TierAdminRecord,
  type TierCommandLogEntry,
  type TierModeId,
  type TierPlayerRecord,
  type TierRank,
  type TierRegion,
} from '../utils/tiersLogic';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';
import { ServerRankBadge } from './ServerRankBadge';

interface TiersViewProps {
  players: TierPlayerRecord[];
  publicMembers?: PublicMemberProfile[];
  tierAdmins: TierAdminRecord[];
  commandLogs: TierCommandLogEntry[];
  isOwner: boolean;
  isTierAdmin: boolean;
  isSignedIn: boolean;
  emailVerified: boolean;
  currentUid: string | null;
  currentDisplayName: string;
  usingCloudData: boolean;
  onRequireAuth: () => void;
  onOpenRanks?: () => void;
  onExecuteCommand: (rawCommand: string) => Promise<{ ok: boolean; message: string }>;
  onQuickSetTier: (params: {
    ign: string;
    mode: TierModeId;
    rank: TierRank | 'REMOVE';
    region: TierRegion;
  }) => Promise<{ ok: boolean; message: string }>;
  onGrantAdmin: (uid: string, displayName: string) => Promise<{ ok: boolean; message: string }>;
  onRevokeAdmin: (uid: string) => Promise<{ ok: boolean; message: string }>;
}

function modeIcon(id: TierModeId | 'overall', className = 'h-3.5 w-3.5') {
  switch (id) {
    case 'overall':
      return <Trophy className={className} aria-hidden="true" />;
    case 'vanilla':
      return <Gem className={className} aria-hidden="true" />;
    case 'sword':
      return <Swords className={className} aria-hidden="true" />;
    case 'axe':
      return <Axe className={className} aria-hidden="true" />;
    case 'uhc':
      return <Heart className={className} aria-hidden="true" />;
    case 'pot':
      return <FlaskConical className={className} aria-hidden="true" />;
    case 'nethop':
      return <Shield className={className} aria-hidden="true" />;
    case 'smp':
      return <Compass className={className} aria-hidden="true" />;
    case 'mace':
      return <Hammer className={className} aria-hidden="true" />;
  }
}

function rankBadgeClasses(rank: TierRank): string {
  const group = getTierGroupNumber(rank);
  const high = isHighTier(rank);
  if (group === 1) {
    return high
      ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-300/90';
  }
  if (group === 2) {
    return high
      ? 'border-zinc-300/50 bg-zinc-200/15 text-zinc-100'
      : 'border-zinc-400/35 bg-zinc-400/10 text-zinc-300';
  }
  if (group === 3) {
    return high
      ? 'border-orange-400/50 bg-orange-500/15 text-orange-200'
      : 'border-orange-500/35 bg-orange-500/10 text-orange-300/90';
  }
  if (group === 4) {
    return high
      ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300/85';
  }
  return high
    ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
    : 'border-zinc-800 bg-zinc-900/90 text-zinc-400';
}

function rankTextColor(rank: TierRank): string {
  const group = getTierGroupNumber(rank);
  if (group === 1) return 'text-amber-300';
  if (group === 2) return 'text-zinc-100';
  if (group === 3) return 'text-orange-300';
  if (group === 4) return 'text-emerald-300';
  return 'text-zinc-400';
}

function tierColumnHeaderAccent(tierNum: 1 | 2 | 3 | 4 | 5): string {
  switch (tierNum) {
    case 1:
      return 'border-t-2 border-t-amber-400 text-amber-300';
    case 2:
      return 'border-t-2 border-t-zinc-300 text-zinc-100';
    case 3:
      return 'border-t-2 border-t-orange-400 text-orange-300';
    case 4:
      return 'border-t-2 border-t-emerald-400 text-emerald-300';
    case 5:
      return 'border-t-2 border-t-zinc-600 text-zinc-400';
  }
}

function titleAccentClasses(tierKey: ReturnType<typeof resolveCombatTitle>['tierKey']): string {
  switch (tierKey) {
    case 'grandmaster':
      return 'text-amber-300';
    case 'master':
      return 'text-orange-300';
    case 'ace':
      return 'text-emerald-300';
    case 'specialist':
      return 'text-zinc-200';
    case 'cadet':
      return 'text-zinc-300';
    default:
      return 'text-zinc-500';
  }
}

function regionTagClasses(region: TierRegion): string {
  switch (region) {
    case 'NA':
      return 'text-amber-300/90 border-amber-500/30 bg-amber-500/10';
    case 'EU':
      return 'text-emerald-300/90 border-emerald-500/30 bg-emerald-500/10';
    case 'AS':
      return 'text-sky-300/90 border-sky-500/30 bg-sky-500/10';
    case 'OCE':
      return 'text-orange-300/90 border-orange-500/30 bg-orange-500/10';
    case 'SA':
      return 'text-zinc-200 border-zinc-600 bg-zinc-800/80';
  }
}

export const TiersView: React.FC<TiersViewProps> = ({
  players,
  publicMembers = [],
  tierAdmins,
  commandLogs,
  isOwner,
  isTierAdmin,
  isSignedIn,
  emailVerified,
  currentUid,
  usingCloudData,
  onRequireAuth,
  onOpenRanks,
  onExecuteCommand,
  onQuickSetTier,
  onGrantAdmin,
  onRevokeAdmin,
}) => {
  const canCommand = isOwner || isTierAdmin;

  const [activeMode, setActiveMode] = useState<TierModeId | 'overall'>('overall');
  const [regionFilter, setRegionFilter] = useState<TierRegion | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);

  // Command Console state
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState<'terminal' | 'quick' | 'admins' | 'logs'>('terminal');
  const [commandInput, setCommandInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdFeedback, setCmdFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Quick GUI Tier Builder state
  const [quickIgn, setQuickIgn] = useState('');
  const [quickMode, setQuickMode] = useState<TierModeId>('vanilla');
  const [quickRank, setQuickRank] = useState<TierRank | 'REMOVE'>('HT1');
  const [quickRegion, setQuickRegion] = useState<TierRegion>('NA');

  // Owner Admin Grant state
  const [adminUidInput, setAdminUidInput] = useState('');
  const [adminNameInput, setAdminNameInput] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);

  const effectivePlayers = players;

  const sortedPlayers = useMemo(
    () =>
      sortTierLeaderboard(effectivePlayers, {
        mode: activeMode,
        region: regionFilter,
        query: searchQuery,
      }),
    [effectivePlayers, activeMode, regionFilter, searchQuery]
  );

  const inspectedPlayer = useMemo(
    () => effectivePlayers.find((p) => p.id === inspectedPlayerId) ?? null,
    [effectivePlayers, inspectedPlayerId]
  );

  const inspectedMemberRoles = useMemo(() => {
    if (!inspectedPlayer) return null;
    const match = publicMembers.find(
      (m) => m.displayName.trim().toLowerCase() === inspectedPlayer.ign.trim().toLowerCase()
    );
    return match ? resolveMemberServerRoles(match) : null;
  }, [inspectedPlayer, publicMembers]);

  const tierColumnsData = useMemo(() => {
    if (activeMode === 'overall') return null;
    const groups: Record<1 | 2 | 3 | 4 | 5, { high: TierPlayerRecord[]; low: TierPlayerRecord[] }> = {
      1: { high: [], low: [] },
      2: { high: [], low: [] },
      3: { high: [], low: [] },
      4: { high: [], low: [] },
      5: { high: [], low: [] },
    };
    for (const player of sortedPlayers) {
      const rank = player.ranks[activeMode];
      if (!rank) continue;
      const tierNum = getTierGroupNumber(rank);
      if (isHighTier(rank)) {
        groups[tierNum].high.push(player);
      } else {
        groups[tierNum].low.push(player);
      }
    }
    return groups;
  }, [activeMode, sortedPlayers]);

  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = commandInput.trim();
    if (!raw || cmdBusy) return;
    setCmdBusy(true);
    setCmdFeedback(null);
    try {
      const res = await onExecuteCommand(raw);
      setCmdFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setCmdHistory((prev) => [raw, ...prev.filter((item) => item !== raw)].slice(0, 25));
        setHistoryCursor(-1);
        setCommandInput('');
      }
    } catch (err) {
      setCmdFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Command execution failed.',
      });
    } finally {
      setCmdBusy(false);
    }
  };

  const handleQuickApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cmdBusy) return;
    setCmdBusy(true);
    setCmdFeedback(null);
    try {
      const res = await onQuickSetTier({
        ign: quickIgn,
        mode: quickMode,
        rank: quickRank,
        region: quickRegion,
      });
      setCmdFeedback({ ok: res.ok, text: res.message });
    } catch (err) {
      setCmdFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to apply tier update.',
      });
    } finally {
      setCmdBusy(false);
    }
  };

  const handleGrantAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cmdBusy) return;
    setCmdBusy(true);
    setCmdFeedback(null);
    try {
      const res = await onGrantAdmin(adminUidInput, adminNameInput);
      setCmdFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setAdminUidInput('');
        setAdminNameInput('');
      }
    } catch (err) {
      setCmdFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not grant Tier Admin.',
      });
    } finally {
      setCmdBusy(false);
    }
  };

  const handleCopyMyUid = async () => {
    if (!currentUid) return;
    try {
      await navigator.clipboard.writeText(currentUid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
      e.preventDefault();
      const next = Math.min(historyCursor + 1, cmdHistory.length - 1);
      setHistoryCursor(next);
      setCommandInput(cmdHistory[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyCursor <= 0) {
        setHistoryCursor(-1);
        setCommandInput('');
      } else {
        const next = historyCursor - 1;
        setHistoryCursor(next);
        setCommandInput(cmdHistory[next]);
      }
    }
  };

  const openEditorForPlayer = (player: TierPlayerRecord) => {
    setInspectedPlayerId(null);
    setQuickIgn(player.ign);
    setQuickRegion(player.region);
    if (activeMode !== 'overall') {
      setQuickMode(activeMode);
      setQuickRank(player.ranks[activeMode] ?? 'HT3');
    }
    setConsoleOpen(true);
    setConsoleTab('quick');
  };

  return (
    <div className="mx-auto max-w-[1260px] px-4 py-6 sm:px-6 space-y-5">
      {/* Header Banner — Obsidian + Amber Gold + Emerald Tactical Ledger */}
      <section className="rounded-xl border border-zinc-800/90 bg-[#0d1016] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-300">
                <Medal className="h-4 w-4" aria-hidden="true" />
              </span>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                PvP Tier List
              </h1>
              {isOwner ? (
                <span className="inline-flex items-center gap-1 rounded border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-display-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  <span>Owner Access</span>
                </span>
              ) : isTierAdmin ? (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-400/45 bg-emerald-500/15 px-2 py-0.5 font-display-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  <span>Tier Admin</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-display-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Standings</span>
                </span>
              )}
            </div>
            <p className="max-w-2xl text-xs sm:text-sm text-zinc-400">
              Minecraft 1.9+ PvP rankings across 8 kits. Score 1–60 points per mode from{' '}
              <span className="font-display-mono text-zinc-300">LT5</span> up to{' '}
              <span className="font-display-mono text-amber-300">HT1</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center divide-x divide-zinc-800 rounded-md border border-zinc-800 bg-[#090b0f] px-3 py-1.5 text-xs">
              <div className="pr-3">
                <span className="text-zinc-500">Ranked </span>
                <span className="font-display-mono font-bold text-white tabular-nums">
                  {effectivePlayers.length}
                </span>
              </div>
              <div className="px-3">
                <span className="text-zinc-500">Kits </span>
                <span className="font-display-mono font-bold text-amber-300 tabular-nums">
                  {TIER_MODES.length}
                </span>
              </div>
              <div className="pl-3">
                <span className="text-zinc-500">Status </span>
                <span
                  className={`font-display-mono font-semibold ${
                    usingCloudData ? 'text-emerald-400' : 'text-zinc-400'
                  }`}
                >
                  {usingCloudData ? 'Live' : 'Saved'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowScoringInfo((prev) => !prev)}
              aria-expanded={showScoringInfo}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 whitespace-nowrap shrink-0 transition-colors hover:border-zinc-500 hover:text-white"
            >
              <Info className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>Points Key</span>
              {showScoringInfo ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setConsoleOpen((prev) => !prev)}
              aria-expanded={consoleOpen}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                canCommand
                  ? consoleOpen
                    ? 'border border-amber-400/60 bg-amber-500 text-zinc-950'
                    : 'border border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                  : 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
              }`}
            >
              {canCommand ? (
                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              )}
              <span>{canCommand ? 'Commands Control' : 'Staff Console'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Scoring Key */}
        {showScoringInfo && (
          <div className="mt-4 border-t border-zinc-800/80 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Sub-Tier Point Weights &amp; Combat Title Thresholds
              </p>
              <p className="font-display-mono text-[11px] text-zinc-400">
                Grandmaster 250+ · Master 100+ · Ace 50+ · Specialist 20+ · Cadet 10+
              </p>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {TIER_RANKS.map((r) => (
                <div
                  key={r}
                  className={`flex items-center justify-between rounded border px-2 py-1 font-display-mono text-[11px] ${rankBadgeClasses(
                    r
                  )}`}
                >
                  <span className="font-bold">{r}</span>
                  <span className="tabular-nums opacity-85">{TIER_POINT_WEIGHTS[r]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Owner & Admin Commands Control Console */}
      {consoleOpen && (
        <section
          aria-label="Owner and Admin Commands Control"
          className="rounded-xl border border-amber-500/35 bg-[#0b0e14] p-4 sm:p-5 space-y-4 shadow-xl"
        >
          {!canCommand ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-amber-300">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    Owner &amp; Tier Admin Command Console Restricted
                  </p>
                  <p className="text-xs text-zinc-400">
                    {!isSignedIn
                      ? 'Sign in with a verified Owner or Tier Admin account to run /tier commands and manage leaderboard ranks.'
                      : !emailVerified
                      ? 'Verify your email address in your Account panel before running Tier Admin commands.'
                      : 'Your verified account does not hold Tier Admin permissions yet. Share your UID below with the Studio Owner to be promoted via /tier admin add.'}
                  </p>
                  {isSignedIn && currentUid && (
                    <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px]">
                      <span className="text-zinc-500">Your UID:</span>
                      <code className="font-display-mono text-amber-300">{currentUid}</code>
                      <button
                        type="button"
                        onClick={handleCopyMyUid}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 hover:border-zinc-500"
                      >
                        {copiedUid ? 'Copied' : 'Copy UID'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!isSignedIn && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-amber-500 px-4 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                >
                  Sign In for Staff Access
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 pb-3">
                <div className="flex items-center gap-2.5">
                  <Terminal className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Tier Commands Control Deck
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      {isOwner
                        ? 'Owner privileges active — full slash commands, starter seed sync, and Tier Admin management.'
                        : 'Tier Admin privileges active — execute /tier rank updates, peaks, regions, and removals.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'terminal', label: 'Slash Console' },
                      { id: 'quick', label: 'Quick Assign' },
                      ...(isOwner ? [{ id: 'admins', label: `Admins (${tierAdmins.length})` }] : []),
                      { id: 'logs', label: `Audit Log (${commandLogs.length})` },
                    ] as Array<{ id: 'terminal' | 'quick' | 'admins' | 'logs'; label: string }>
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setConsoleTab(t.id)}
                      className={`h-8 rounded-md px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        consoleTab === t.id
                          ? 'bg-amber-500 text-zinc-950'
                          : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {cmdFeedback && (
                <div
                  role={cmdFeedback.ok ? 'status' : 'alert'}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                    cmdFeedback.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/40 bg-red-500/10 text-red-200'
                  }`}
                >
                  {cmdFeedback.ok ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
                  )}
                  <span className="font-display-mono">{cmdFeedback.text}</span>
                </div>
              )}

              {consoleTab === 'terminal' && (
                <div className="space-y-3">
                  <form onSubmit={handleRunCommand} className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display-mono text-xs font-bold text-amber-400"
                      >
                        &gt;
                      </span>
                      <label htmlFor="tier-cmd-input" className="sr-only">
                        Tier command input
                      </label>
                      <input
                        id="tier-cmd-input"
                        ref={commandInputRef}
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyDown={handleCommandKeyDown}
                        placeholder="/tier set <ign> <mode> <HT1..LT5> [region]"
                        maxLength={240}
                        className="h-10 w-full rounded-md border border-zinc-700 bg-[#07090d] pl-7 pr-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={cmdBusy || !commandInput.trim()}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-amber-500 px-4 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{cmdBusy ? 'Running...' : 'Run Command'}</span>
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {TIER_COMMAND_EXAMPLES.filter((ex) => !ex.ownerOnly || isOwner).map((ex) => (
                      <button
                        key={ex.syntax}
                        type="button"
                        onClick={() => {
                          const starter = `${ex.syntax.split('<')[0].trim()} `;
                          setCommandInput(starter);
                          commandInputRef.current?.focus();
                        }}
                        className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-left transition-colors hover:border-amber-500/40"
                      >
                        <p className="truncate font-display-mono text-[11px] font-semibold text-amber-300">
                          {ex.syntax}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                          {ex.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {consoleTab === 'quick' && (
                <form
                  onSubmit={handleQuickApply}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <div>
                    <label htmlFor="quick-ign" className="block text-[11px] font-medium text-zinc-400">
                      Minecraft IGN
                    </label>
                    <input
                      id="quick-ign"
                      type="text"
                      list="tier-player-igns"
                      required
                      maxLength={16}
                      value={quickIgn}
                      onChange={(e) => setQuickIgn(e.target.value)}
                      placeholder="Minecraft IGN"
                      className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                    />
                    <datalist id="tier-player-igns">
                      {effectivePlayers.map((p) => (
                        <option key={p.id} value={p.ign} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label htmlFor="quick-mode" className="block text-[11px] font-medium text-zinc-400">
                      PvP Kit / Mode
                    </label>
                    <select
                      id="quick-mode"
                      value={quickMode}
                      onChange={(e) => setQuickMode(e.target.value as TierModeId)}
                      className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                    >
                      {TIER_MODES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.shortLabel})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quick-rank" className="block text-[11px] font-medium text-zinc-400">
                      Assigned Tier
                    </label>
                    <select
                      id="quick-rank"
                      value={quickRank}
                      onChange={(e) => setQuickRank(e.target.value as TierRank | 'REMOVE')}
                      className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 font-display-mono text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                    >
                      {TIER_RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r} ({TIER_POINT_WEIGHTS[r]} pts)
                        </option>
                      ))}
                      <option value="REMOVE">Clear / Untested</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quick-region" className="block text-[11px] font-medium text-zinc-400">
                      Region
                    </label>
                    <select
                      id="quick-region"
                      value={quickRegion}
                      onChange={(e) => setQuickRegion(e.target.value as TierRegion)}
                      className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 font-display-mono text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                    >
                      {TIER_REGIONS.map((reg) => (
                        <option key={reg} value={reg}>
                          {reg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={cmdBusy || !quickIgn.trim()}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-3 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{cmdBusy ? 'Saving...' : 'Apply Tier'}</span>
                    </button>
                  </div>
                </form>
              )}

              {consoleTab === 'admins' && isOwner && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <form
                    onSubmit={handleGrantAdminSubmit}
                    className="lg:col-span-6 space-y-2.5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <UserPlus className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                        <span>Grant Tier Admin Role</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        required
                        value={adminUidInput}
                        onChange={(e) => setAdminUidInput(e.target.value)}
                        placeholder="Firebase User UID"
                        aria-label="Firebase User UID"
                        className="h-9 rounded-md border border-zinc-700 bg-[#080a0e] px-2.5 font-display-mono text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={adminNameInput}
                        onChange={(e) => setAdminNameInput(e.target.value)}
                        placeholder="Display Label (e.g. TesterLead)"
                        aria-label="Admin display label"
                        maxLength={80}
                        className="h-9 rounded-md border border-zinc-700 bg-[#080a0e] px-2.5 text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={cmdBusy || !adminUidInput.trim()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Authorize Tier Admin</span>
                    </button>
                  </form>

                  <div className="lg:col-span-6 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5">
                    <p className="text-xs font-bold text-white">
                      Active Tier Admins ({tierAdmins.length})
                    </p>
                    {tierAdmins.length === 0 ? (
                      <p className="py-3 text-xs text-zinc-500">
                        No delegated Tier Admins yet. Add a verified user&apos;s UID to delegate /tier commands.
                      </p>
                    ) : (
                      <ul className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                        {tierAdmins.map((adm) => (
                          <li
                            key={adm.uid}
                            className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-[#080a0e] px-2.5 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-zinc-100">
                                {adm.displayName}
                              </p>
                              <p className="truncate font-display-mono text-[10px] text-zinc-500">
                                {adm.uid}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={cmdBusy}
                              onClick={() =>
                                void onRevokeAdmin(adm.uid).then((r) =>
                                  setCmdFeedback({ ok: r.ok, text: r.message })
                                )
                              }
                              className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              <span>Revoke</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {consoleTab === 'logs' && (
                <div className="space-y-2">
                  {commandLogs.length === 0 ? (
                    <p className="py-4 text-center text-xs text-zinc-500">
                      No Tier List commands logged yet. Executed /tier commands appear here.
                    </p>
                  ) : (
                    <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                      {commandLogs.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 font-display-mono text-[10px] font-bold uppercase ${
                                  entry.executorRole === 'owner'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                }`}
                              >
                                {entry.executorRole}
                              </span>
                              <span className="font-semibold text-zinc-200">
                                {entry.executorName}
                              </span>
                              <span className="truncate font-display-mono text-amber-200/90">
                                {entry.commandText}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-zinc-400">{entry.summary}</p>
                          </div>
                          {entry.createdAt && (
                            <span className="font-display-mono text-[10px] text-zinc-500 tabular-nums">
                              {new Date(Number(entry.createdAt)).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Mode Selector + Search & Region Toolbar */}
      <section className="space-y-3">
        <div
          role="tablist"
          aria-label="Combat PvP Gamemodes"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'overall'}
            onClick={() => setActiveMode('overall')}
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              activeMode === 'overall'
                ? 'border border-amber-400/60 bg-amber-500 text-zinc-950'
                : 'border border-zinc-800 bg-[#10131a] text-zinc-300 hover:border-zinc-600 hover:text-white'
            }`}
          >
            {modeIcon('overall', 'h-3.5 w-3.5')}
            <span>Overall</span>
          </button>

          {TIER_MODES.map((m) => {
            const active = activeMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveMode(m.id)}
                className={`inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'border border-amber-400/60 bg-amber-500/20 text-amber-200'
                    : 'border border-zinc-800 bg-[#10131a] text-zinc-300 hover:border-zinc-600 hover:text-white'
                }`}
              >
                <span className={active ? 'text-amber-300' : 'text-zinc-400'}>
                  {modeIcon(m.id, 'h-3.5 w-3.5')}
                </span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <label htmlFor="tiers-search-input" className="sr-only">
              Search player IGN
            </label>
            <input
              id="tiers-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ranked player IGN..."
              className="h-9 w-full rounded-md border border-zinc-800 bg-[#0d1016] pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400/60 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium text-zinc-500">Region:</span>
            {(['ALL', ...TIER_REGIONS] as const).map((reg) => (
              <button
                key={reg}
                type="button"
                onClick={() => setRegionFilter(reg)}
                className={`h-8 rounded-md px-2.5 font-display-mono text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                  regionFilter === reg
                    ? 'border border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                    : 'border border-zinc-800 bg-[#0d1016] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Ranking Surface */}
      {effectivePlayers.length === 0 && activeMode === 'overall' ? (
        <section
          aria-label="Overall Competitive Tier Standings"
          className="rounded-xl border border-zinc-800/90 bg-[#0d1016] p-8 sm:p-10 text-center space-y-3"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-300">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">0 ranked players yet</p>
            <p className="mx-auto max-w-md text-xs text-zinc-400">
              No ranked players added yet. Owners and Tier Admins can add players with{' '}
              <code className="font-display-mono text-amber-300">/tier set</code> or Quick Assign.
            </p>
          </div>
          {canCommand && (
            <button
              type="button"
              onClick={() => {
                setConsoleOpen(true);
                setConsoleTab('quick');
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-amber-500 px-4 text-xs font-bold text-zinc-950 hover:bg-amber-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add First Ranked Player</span>
            </button>
          )}
        </section>
      ) : sortedPlayers.length === 0 && activeMode === 'overall' ? (
        <div className="rounded-xl border border-zinc-800 bg-[#0d1016] p-10 text-center">
          <p className="text-sm font-bold text-zinc-200">No players match your filter.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Clear the IGN search or switch region/gamemode tabs.
          </p>
        </div>
      ) : activeMode === 'overall' ? (
        /* Overall Standings Table */
        <section
          aria-label="Overall Competitive Tier Standings"
          className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0d1016]"
        >
          {/* Desktop Tabular View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-[#090b0f] text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="w-14 px-4 py-3 text-center">#</th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Combat Title</th>
                  <th className="px-3 py-3">8-Kit Tier Matrix</th>
                  <th className="w-28 px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {sortedPlayers.map((player, index) => {
                  const pos = index + 1;
                  const titleInfo = resolveCombatTitle(player.points);
                  return (
                    <tr
                      key={player.id}
                      tabIndex={0}
                      onClick={() => setInspectedPlayerId(player.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setInspectedPlayerId(player.id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-zinc-900/60 focus-visible:bg-zinc-900/70 focus-visible:outline-none"
                    >
                      <td className="px-4 py-3 text-center font-display-mono text-sm font-extrabold tabular-nums">
                        <span
                          className={
                            pos === 1
                              ? 'text-amber-300'
                              : pos === 2
                              ? 'text-zinc-200'
                              : pos === 3
                              ? 'text-orange-300'
                              : 'text-zinc-500'
                          }
                        >
                          {pos}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <MinecraftHeadAvatar
                            username={player.ign}
                            alt={`${player.ign} skin head`}
                            initials={player.ign.slice(0, 2).toUpperCase()}
                            className="h-9 w-9 shrink-0 rounded-md border border-zinc-700 bg-zinc-950"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-white">
                                {player.ign}
                              </span>
                              <span
                                className={`rounded border px-1.5 py-0.5 font-display-mono text-[10px] font-bold ${regionTagClasses(
                                  player.region
                                )}`}
                              >
                                {player.region}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`font-semibold ${titleAccentClasses(titleInfo.tierKey)}`}>
                          {titleInfo.title}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="grid grid-cols-8 gap-1.5 max-w-[540px]">
                          {TIER_MODES.map((m) => {
                            const r = player.ranks[m.id];
                            const peak = player.peakRanks?.[m.id];
                            const hasHigherPeak = peak && r && compareTierRanks(peak, r) < 0;
                            return (
                              <div
                                key={m.id}
                                title={
                                  r
                                    ? `${m.label}: ${r}${hasHigherPeak ? ` (Peak: ${peak})` : ''}`
                                    : `${m.label}: Untested`
                                }
                                className="flex flex-col items-center gap-0.5"
                              >
                                <span className="font-display-mono text-[9px] font-semibold text-zinc-500">
                                  {m.shortLabel}
                                </span>
                                {r ? (
                                  <span
                                    className={`w-full rounded border py-0.5 text-center font-display-mono text-[10px] font-extrabold ${rankBadgeClasses(
                                      r
                                    )}`}
                                  >
                                    {r}
                                  </span>
                                ) : (
                                  <span className="w-full rounded border border-zinc-800/80 bg-zinc-950/60 py-0.5 text-center font-display-mono text-[10px] text-zinc-600">
                                    —
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-display-mono tabular-nums">
                        <span className="text-sm font-extrabold text-white">{player.points}</span>
                        <span className="ml-1 text-[10px] text-zinc-500">pts</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card Stack */}
          <div className="divide-y divide-zinc-800/80 lg:hidden">
            {sortedPlayers.map((player, index) => {
              const pos = index + 1;
              const titleInfo = resolveCombatTitle(player.points);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setInspectedPlayerId(player.id)}
                  className="w-full p-4 text-left transition-colors hover:bg-zinc-900/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`w-6 text-center font-display-mono text-sm font-extrabold tabular-nums ${
                          pos === 1
                            ? 'text-amber-300'
                            : pos === 2
                            ? 'text-zinc-200'
                            : pos === 3
                            ? 'text-orange-300'
                            : 'text-zinc-500'
                        }`}
                      >
                        #{pos}
                      </span>
                      <MinecraftHeadAvatar
                        username={player.ign}
                        alt={`${player.ign} skin head`}
                        initials={player.ign.slice(0, 2).toUpperCase()}
                        className="h-9 w-9 shrink-0 rounded-md border border-zinc-700 bg-zinc-950"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-white">
                            {player.ign}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 font-display-mono text-[10px] font-bold ${regionTagClasses(
                              player.region
                            )}`}
                          >
                            {player.region}
                          </span>
                        </div>
                        <p className={`text-[11px] font-semibold ${titleAccentClasses(titleInfo.tierKey)}`}>
                          {titleInfo.title}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-display-mono tabular-nums">
                      <p className="text-sm font-extrabold text-white">{player.points}</p>
                      <p className="text-[10px] text-zinc-500">points</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                    {TIER_MODES.map((m) => {
                      const r = player.ranks[m.id];
                      return (
                        <div
                          key={m.id}
                          className="flex flex-col items-center gap-0.5 rounded border border-zinc-800/70 bg-zinc-950/60 px-1 py-1"
                        >
                          <span className="font-display-mono text-[9px] text-zinc-500">
                            {m.shortLabel}
                          </span>
                          <span
                            className={`font-display-mono text-[10px] font-bold ${
                              r ? rankTextColor(r) : 'text-zinc-600'
                            }`}
                          >
                            {r || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        /* Single-Mode 5-Column Tier Matrix (Tier 1 - Tier 5) */
        <section
          aria-label={`${TIER_MODES.find((m) => m.id === activeMode)?.label ?? activeMode} Tier Matrix`}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {([1, 2, 3, 4, 5] as const).map((tierNum) => {
            const col = tierColumnsData?.[tierNum] ?? { high: [], low: [] };
            const totalInCol = col.high.length + col.low.length;
            return (
              <div
                key={tierNum}
                className={`flex flex-col rounded-xl border border-zinc-800/90 bg-[#0d1016] overflow-hidden ${tierColumnHeaderAccent(
                  tierNum
                )}`}
              >
                <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#090b0f] px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-display text-xs font-extrabold uppercase tracking-wider">
                      Tier {tierNum}
                    </span>
                  </div>
                  <span className="font-display-mono text-[11px] text-zinc-500 tabular-nums">
                    {totalInCol}
                  </span>
                </div>

                <div className="flex-1 divide-y divide-zinc-800/60 p-2.5 space-y-2.5">
                  {totalInCol === 0 ? (
                    <p className="py-8 text-center text-[11px] text-zinc-600">
                      No tested players
                    </p>
                  ) : (
                    <>
                      {col.high.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-1 font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            High (HT{tierNum})
                          </p>
                          {col.high.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setInspectedPlayerId(p.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800/80 bg-[#11151d] px-2.5 py-1.5 text-left transition-colors hover:border-amber-500/40"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <MinecraftHeadAvatar
                                  username={p.ign}
                                  alt=""
                                  initials={p.ign.slice(0, 2).toUpperCase()}
                                  className="h-6 w-6 shrink-0 rounded border border-zinc-700"
                                />
                                <span className="truncate text-xs font-semibold text-zinc-100">
                                  {p.ign}
                                </span>
                              </span>
                              <span className="font-display-mono text-[10px] font-bold text-zinc-400">
                                {p.region}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {col.low.length > 0 && (
                        <div className={col.high.length > 0 ? 'pt-2 space-y-1' : 'space-y-1'}>
                          <p className="px-1 font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Low (LT{tierNum})
                          </p>
                          {col.low.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setInspectedPlayerId(p.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2.5 py-1.5 text-left transition-colors hover:border-zinc-600"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <MinecraftHeadAvatar
                                  username={p.ign}
                                  alt=""
                                  initials={p.ign.slice(0, 2).toUpperCase()}
                                  className="h-6 w-6 shrink-0 rounded border border-zinc-800"
                                />
                                <span className="truncate text-xs font-medium text-zinc-300">
                                  {p.ign}
                                </span>
                              </span>
                              <span className="font-display-mono text-[10px] text-zinc-500">
                                {p.region}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Player Combat Profile Inspection Modal */}
      {inspectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tier-player-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectedPlayerId(null);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-[#0d1016] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <MinecraftHeadAvatar
                  username={inspectedPlayer.ign}
                  styleMode="3d"
                  alt={`${inspectedPlayer.ign} 3D head`}
                  initials={inspectedPlayer.ign.slice(0, 2).toUpperCase()}
                  className="h-14 w-14 shrink-0 rounded-lg border border-zinc-700 bg-zinc-950"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="tier-player-modal-title" className="text-lg font-extrabold text-white">
                      {inspectedPlayer.ign}
                    </h2>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-display-mono text-[10px] font-bold ${regionTagClasses(
                        inspectedPlayer.region
                      )}`}
                    >
                      {inspectedPlayer.region}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-xs font-bold ${titleAccentClasses(
                      resolveCombatTitle(inspectedPlayer.points).tierKey
                    )}`}
                  >
                    {resolveCombatTitle(inspectedPlayer.points).title} ·{' '}
                    <span className="font-display-mono tabular-nums text-white">
                      {inspectedPlayer.points} pts
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedPlayerId(null)}
                aria-label="Close player profile"
                className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIER_MODES.map((m) => {
                const current = inspectedPlayer.ranks[m.id];
                const peak = pickHigherTierRank(current, inspectedPlayer.peakRanks?.[m.id]);
                const pts = current ? TIER_POINT_WEIGHTS[current] : 0;
                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-zinc-800/90 bg-[#090b0f] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
                        {modeIcon(m.id, 'h-3 w-3 text-amber-300')}
                        <span>{m.label}</span>
                      </span>
                      <span className="font-display-mono text-[10px] text-zinc-500 tabular-nums">
                        {pts}p
                      </span>
                    </div>

                    {current ? (
                      <div
                        className={`rounded border py-1 text-center font-display-mono text-xs font-extrabold ${rankBadgeClasses(
                          current
                        )}`}
                      >
                        {current}
                      </div>
                    ) : (
                      <div className="rounded border border-zinc-800 bg-zinc-950 py-1 text-center font-display-mono text-xs text-zinc-600">
                        Untested
                      </div>
                    )}

                    {peak && current && compareTierRanks(peak, current) < 0 && (
                      <p className="text-center font-display-mono text-[10px] text-zinc-500">
                        Peak: <span className="text-amber-300">{peak}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {inspectedMemberRoles && (
              <div className="rounded-lg border border-zinc-800/90 bg-[#090b0f] p-3 space-y-2">
                <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Discord Server Ranks
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {inspectedMemberRoles.roles.map((r) => (
                    <ServerRankBadge key={r} rankId={r} size="xs" showIcon={r === inspectedMemberRoles.primaryRank} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-500">
              <span>
                Calculated Weight: {calculateTierPoints(inspectedPlayer.ranks)} active points
              </span>
              <div className="flex items-center gap-2">
                {onOpenRanks && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedPlayerId(null);
                      onOpenRanks();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-200 hover:bg-indigo-500/25"
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ranks &amp; Friends</span>
                  </button>
                )}
                {canCommand && (
                  <button
                    type="button"
                    onClick={() => openEditorForPlayer(inspectedPlayer)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
                  >
                    <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Edit in Console</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
