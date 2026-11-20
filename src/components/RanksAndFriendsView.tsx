import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Check,
  Clock,
  Crown,
  Eye,
  Medal,
  MessageSquare,
  MoreVertical,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  FriendshipRecord,
  PlayerSuggestionRecord,
  PublicMemberProfile,
  ServerRankId,
} from '../types';
import {
  categorizeFriendships,
  getFriendOtherParticipant,
  getServerRankMeta,
  getSuggestedMembersToAdd,
  resolveMemberServerRoles,
  searchPlayersAndMembers,
  SERVER_RANKS,
  validatePlayerSuggestionInput,
} from '../utils/ranksAndFriendsLogic';
import {
  resolveCombatTitle,
  TIER_MODES,
  type TierAdminRecord,
  type TierModeId,
  type TierPlayerRecord,
} from '../utils/tiersLogic';
import { LEVEL_TIERS } from '../data/catalog';
import { getLevelInfo } from '../utils/catalogLogic';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';
import { ServerRankBadge, serverRankIcon } from './ServerRankBadge';

interface RanksAndFriendsViewProps {
  members: PublicMemberProfile[];
  tierAdmins: TierAdminRecord[];
  tierPlayers: TierPlayerRecord[];
  friendships: FriendshipRecord[];
  suggestions: PlayerSuggestionRecord[];
  isSignedIn: boolean;
  emailVerified: boolean;
  isOwner: boolean;
  isTierAdmin: boolean;
  currentUid: string | null;
  currentDisplayName: string;
  onRequireAuth: () => void;
  onSendFriendRequest: (target: PublicMemberProfile) => Promise<void>;
  onRespondFriendRequest: (
    friendship: FriendshipRecord,
    decision: 'accepted' | 'declined'
  ) => Promise<void>;
  onRemoveFriendship: (friendship: FriendshipRecord) => Promise<void>;
  onBlockFriend?: (friendship: FriendshipRecord) => Promise<void>;
  directMessagesEnabled?: boolean;
  onDirectMessageFriend?: (friend: { uid: string; displayName: string; avatarUrl?: string }) => void;
  onSuggestPlayer: (input: {
    ign: string;
    suggestedRank?: ServerRankId;
    suggestedMode?: TierModeId | '';
    note?: string;
  }) => Promise<void>;
  onResolveSuggestion: (
    suggestion: PlayerSuggestionRecord,
    decision: 'approved' | 'declined',
    alsoAddToTierList?: boolean
  ) => Promise<void>;
  onDeleteSuggestion: (suggestionId: string) => Promise<void>;
  onAssignMemberServerRoles: (
    targetUid: string,
    serverRank: ServerRankId,
    serverRoles: ServerRankId[]
  ) => Promise<void>;
  onOpenTiers?: () => void;
}

export const RanksAndFriendsView: React.FC<RanksAndFriendsViewProps> = ({
  members,
  tierAdmins,
  tierPlayers,
  friendships,
  suggestions,
  isSignedIn,
  emailVerified,
  isOwner,
  isTierAdmin,
  currentUid,
  onRequireAuth,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRemoveFriendship,
  onBlockFriend,
  directMessagesEnabled = false,
  onDirectMessageFriend,
  onSuggestPlayer,
  onResolveSuggestion,
  onDeleteSuggestion,
  onAssignMemberServerRoles,
  onOpenTiers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [rankFilter, setRankFilter] = useState<ServerRankId | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [openFriendMenuId, setOpenFriendMenuId] = useState<string | null>(null);
  const openMenuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openFriendMenuId) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        openMenuContainerRef.current &&
        !openMenuContainerRef.current.contains(e.target as Node)
      ) {
        setOpenFriendMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenFriendMenuId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openFriendMenuId]);

  // Player Inspection (Discord-style Role Modal)
  const [inspectedUid, setInspectedUid] = useState<string | null>(null);
  const [inspectedIgnOnly, setInspectedIgnOnly] = useState<string | null>(null);
  const [editPrimaryRank, setEditPrimaryRank] = useState<ServerRankId>('member');
  const [editRoles, setEditRoles] = useState<ServerRankId[]>([]);

  // Community "Suggest Add This Player" state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIgn, setSuggestIgn] = useState('');
  const [suggestRank, setSuggestRank] = useState<ServerRankId>('member');
  const [suggestMode, setSuggestMode] = useState<TierModeId | ''>('sword');
  const [suggestNote, setSuggestNote] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);

  // Merge publicMembers with any tierAdmin record that hasn't synced yet
  const mergedMembers = useMemo(() => {
    const map = new Map<string, PublicMemberProfile>();
    for (const m of members) {
      map.set(m.uid, m);
    }
    for (const adm of tierAdmins) {
      if (!map.has(adm.uid)) {
        map.set(adm.uid, {
          uid: adm.uid,
          displayName: adm.displayName || 'Tier Admin',
          role: 'admin',
          serverRank: 'admin',
          serverRoles: ['admin', 'member'],
          membershipTier: 'free',
          xp: 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const pA = getServerRankMeta(resolveMemberServerRoles(a).primaryRank).priority;
      const pB = getServerRankMeta(resolveMemberServerRoles(b).primaryRank).priority;
      if (pA !== pB) return pA - pB;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [members, tierAdmins]);

  const syncedUidSet = useMemo(() => new Set(members.map((m) => m.uid)), [members]);

  const memberByUid = useMemo(() => {
    const map = new Map<string, PublicMemberProfile>();
    for (const m of mergedMembers) map.set(m.uid, m);
    return map;
  }, [mergedMembers]);

  const tierPlayerByIgnLower = useMemo(() => {
    const map = new Map<string, TierPlayerRecord>();
    for (const p of tierPlayers) map.set(p.ign.trim().toLowerCase(), p);
    return map;
  }, [tierPlayers]);

  const friendshipSummary = useMemo(
    () => categorizeFriendships(friendships, currentUid),
    [friendships, currentUid]
  );

  const suggestedMembers = useMemo(
    () =>
      getSuggestedMembersToAdd(
        members,
        currentUid,
        friendshipSummary.relationshipByOtherUid
      ),
    [members, currentUid, friendshipSummary.relationshipByOtherUid]
  );

  const rankCounts = useMemo(() => {
    const counts: Record<ServerRankId, number> = {
      owner: 0,
      admin: 0,
      staff: 0,
      support: 0,
      ultimate: 0,
      paid: 0,
      member: 0,
      free: 0,
    };
    for (const m of mergedMembers) {
      const resolved = resolveMemberServerRoles(m);
      for (const r of resolved.roles) {
        counts[r] += 1;
      }
    }
    return counts;
  }, [mergedMembers]);

  const searchResult = useMemo(
    () => searchPlayersAndMembers(searchQuery, mergedMembers, tierPlayers, suggestions),
    [searchQuery, mergedMembers, tierPlayers, suggestions]
  );

  const filteredMembers = useMemo(() => {
    const base = searchQuery.trim() ? searchResult.matchedMembers : mergedMembers;
    if (rankFilter === 'all') return base;
    return base.filter((m) => resolveMemberServerRoles(m).roles.includes(rankFilter));
  }, [mergedMembers, rankFilter, searchQuery, searchResult.matchedMembers]);

  const inspectedMember = inspectedUid ? memberByUid.get(inspectedUid) ?? null : null;
  const inspectedTierPlayer = useMemo(() => {
    const lookupName = inspectedMember?.displayName || inspectedIgnOnly || '';
    if (!lookupName) return null;
    return tierPlayerByIgnLower.get(lookupName.trim().toLowerCase()) ?? null;
  }, [inspectedIgnOnly, inspectedMember, tierPlayerByIgnLower]);

  const openMemberInspection = (member: PublicMemberProfile) => {
    const resolved = resolveMemberServerRoles(member);
    setInspectedIgnOnly(null);
    setInspectedUid(member.uid);
    setEditPrimaryRank(resolved.primaryRank);
    setEditRoles(resolved.roles);
  };

  const openTierPlayerInspection = (player: TierPlayerRecord) => {
    const linked = mergedMembers.find(
      (m) => m.displayName.trim().toLowerCase() === player.ign.trim().toLowerCase()
    );
    if (linked) {
      openMemberInspection(linked);
    } else {
      setInspectedUid(null);
      setInspectedIgnOnly(player.ign);
    }
  };

  const runAction = async (id: string, fn: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    setFeedback(null);
    try {
      await fn();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Action failed.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitSuggestion = async (e: React.FormEvent, overrideIgn?: string) => {
    e.preventDefault();
    if (!isSignedIn || !emailVerified) {
      onRequireAuth();
      return;
    }
    const targetIgn = overrideIgn ?? suggestIgn;
    const validation = validatePlayerSuggestionInput({
      ign: targetIgn,
      suggestedRank: suggestRank,
      suggestedMode: suggestMode,
      note: suggestNote,
    });
    if (!validation.ok) {
      setFeedback({ ok: false, text: validation.error });
      return;
    }
    setSuggestBusy(true);
    setFeedback(null);
    try {
      await onSuggestPlayer({
        ign: validation.ign,
        suggestedRank: validation.suggestedRank,
        suggestedMode: validation.suggestedMode as TierModeId | '' | undefined,
        note: validation.note,
      });
      setFeedback({
        ok: true,
        text: `Suggested player "${validation.ign}" for review.`,
      });
      setSuggestIgn('');
      setSuggestNote('');
      setSuggestOpen(false);
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not submit suggestion.',
      });
    } finally {
      setSuggestBusy(false);
    }
  };

  const toggleEditRole = (roleId: ServerRankId) => {
    setEditRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const selectedRankMeta = rankFilter === 'all' ? null : getServerRankMeta(rankFilter);
  const canReviewSuggestions = isOwner || isTierAdmin;

  const renderFriendButton = (target: PublicMemberProfile) => {
    if (!syncedUidSet.has(target.uid)) {
      return null;
    }
    if (currentUid && target.uid === currentUid) {
      return (
        <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-display-mono text-[10px] font-semibold text-zinc-400">
          You
        </span>
      );
    }
    const rel = friendshipSummary.relationshipByOtherUid[target.uid];
    if (rel?.status === 'accepted') {
      return (
        <button
          type="button"
          disabled={busyId === rel.id}
          onClick={() => void runAction(rel.id, () => onRemoveFriendship(rel))}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[11px] font-semibold text-emerald-200 hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-200"
          title="Friends (click to remove)"
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Friends</span>
        </button>
      );
    }
    if (rel?.status === 'pending' && rel.recipientUid === currentUid) {
      return (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busyId === rel.id}
            onClick={() => void runAction(rel.id, () => onRespondFriendRequest(rel, 'accepted'))}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-2.5 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Accept</span>
          </button>
          <button
            type="button"
            disabled={busyId === rel.id}
            onClick={() => void runAction(rel.id, () => onRespondFriendRequest(rel, 'declined'))}
            aria-label={`Decline friend request from ${target.displayName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-red-500/50 hover:text-red-300"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      );
    }
    if (rel?.status === 'blocked') {
      if (rel.blockedBy === currentUid) {
        return (
          <button
            type="button"
            disabled={busyId === rel.id}
            onClick={() => void runAction(rel.id, () => onRemoveFriendship(rel))}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-200"
            title="Click to unblock this user"
          >
            <Ban className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            <span>Unblock</span>
          </button>
        );
      }
      return (
        <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-display-mono text-[10px] text-zinc-500">
          Unavailable
        </span>
      );
    }
    if (rel?.status === 'pending' && rel.requesterUid === currentUid) {
      return (
        <button
          type="button"
          disabled={busyId === rel.id}
          onClick={() => void runAction(rel.id, () => onRemoveFriendship(rel))}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 text-[11px] font-semibold text-amber-200 hover:border-red-500/40 hover:text-red-200"
          title="Click to cancel pending friend request"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Pending</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={busyId === `add-${target.uid}`}
        onClick={() => {
          if (!isSignedIn || !emailVerified) {
            onRequireAuth();
            return;
          }
          void runAction(`add-${target.uid}`, () => onSendFriendRequest(target));
        }}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-500/40 bg-rose-600/15 px-2.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-600 hover:text-white"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Add Friend</span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-[1260px] px-4 py-6 sm:px-6 space-y-6">
      {/* Header Banner */}
      <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-500/40 bg-indigo-500/15 text-indigo-300">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </span>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Server Ranks &amp; Friends
              </h1>
              <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-display-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                Discord-Style Roles
              </span>
            </div>
            <p className="max-w-2xl text-xs sm:text-sm text-zinc-400">
              Inspect player ranks across the 8-role hierarchy, search players by name or IGN, send &amp; accept friend requests, and suggest players to add.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Server Ranks</p>
              <p className="font-display-mono text-lg font-extrabold text-indigo-300 tabular-nums">
                {SERVER_RANKS.length}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Roster</p>
              <p className="font-display-mono text-lg font-extrabold text-white tabular-nums">
                {mergedMembers.length}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Friends</p>
              <p className="font-display-mono text-lg font-extrabold text-emerald-300 tabular-nums">
                {friendshipSummary.friends.length}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-[#08080a] px-3.5 py-2">
              <p className="text-[11px] text-zinc-400">Requests</p>
              <p
                className={`font-display-mono text-lg font-extrabold tabular-nums ${
                  friendshipSummary.incomingRequests.length > 0 ? 'text-rose-400' : 'text-zinc-300'
                }`}
              >
                {friendshipSummary.incomingRequests.length}
              </p>
            </div>
          </div>
        </div>

        {/* Search Player Name + Suggest Player Bar */}
        <div className="mt-5 flex flex-col gap-2.5 border-t border-zinc-800/80 pt-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <label htmlFor="ranks-player-search" className="sr-only">
              Search members by display name or Minecraft IGN
            </label>
            <input
              id="ranks-player-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter members by display name or search Minecraft IGN..."
              className="h-10 w-full rounded-md border border-zinc-700 bg-[#08080a] pl-9 pr-8 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear player search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!suggestOpen && searchResult.suggestableIgn) {
                setSuggestIgn(searchResult.suggestableIgn);
              }
              setSuggestOpen((prev) => !prev);
            }}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-indigo-500/45 bg-indigo-600/20 px-3.5 text-xs font-bold text-indigo-200 hover:bg-indigo-600 hover:text-white"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Suggest Add This Player</span>
          </button>
        </div>

        {/* Inline Live Search Suggestion Prompt when searching an unlisted IGN */}
        {searchResult.suggestableIgn && !suggestOpen && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-indigo-500/35 bg-indigo-500/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <MinecraftHeadAvatar
                username={searchResult.suggestableIgn}
                styleMode="3d"
                alt={`${searchResult.suggestableIgn} skin head`}
                initials={searchResult.suggestableIgn.slice(0, 2).toUpperCase()}
                className="h-10 w-10 shrink-0 rounded-md border border-indigo-400/40 bg-zinc-950"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">
                  Player &ldquo;{searchResult.suggestableIgn}&rdquo; is not in the roster yet
                </p>
                <p className="text-[11px] text-indigo-200/80">
                  Previewed live Minecraft skin head — want staff to add this player?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSuggestIgn(searchResult.suggestableIgn!);
                setSuggestOpen(true);
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-indigo-500 px-3.5 text-xs font-bold text-white hover:bg-indigo-400"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Suggest Add {searchResult.suggestableIgn}</span>
            </button>
          </div>
        )}

        {/* Collapsible Suggest Add This Player Form */}
        {suggestOpen && (
          <form
            onSubmit={(e) => void handleSubmitSuggestion(e)}
            className="mt-4 rounded-lg border border-zinc-800 bg-[#08080a] p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {suggestIgn.trim().length >= 2 && (
                  <MinecraftHeadAvatar
                    username={suggestIgn.trim()}
                    styleMode="3d"
                    alt={`${suggestIgn.trim()} head preview`}
                    initials={suggestIgn.trim().slice(0, 2).toUpperCase()}
                    className="h-9 w-9 shrink-0 rounded border border-zinc-700 bg-zinc-950"
                  />
                )}
                <div>
                  <h2 className="text-xs font-bold text-white">Suggest Add This Player</h2>
                  <p className="text-[11px] text-zinc-400">
                    Nominate a Minecraft IGN for Owner / Tier Admin review.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close suggest player form"
                onClick={() => setSuggestOpen(false)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="suggest-ign-input" className="block text-[11px] font-medium text-zinc-400">
                  Minecraft IGN
                </label>
                <input
                  id="suggest-ign-input"
                  type="text"
                  required
                  maxLength={24}
                  value={suggestIgn}
                  onChange={(e) => setSuggestIgn(e.target.value)}
                  placeholder="PlayerIGN"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 font-display-mono text-xs text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="suggest-rank-select" className="block text-[11px] font-medium text-zinc-400">
                  Suggested Discord Rank
                </label>
                <select
                  id="suggest-rank-select"
                  value={suggestRank}
                  onChange={(e) => setSuggestRank(e.target.value as ServerRankId)}
                  className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-white focus:border-indigo-400 focus:outline-none"
                >
                  {SERVER_RANKS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="suggest-mode-select" className="block text-[11px] font-medium text-zinc-400">
                  PvP Mode (optional)
                </label>
                <select
                  id="suggest-mode-select"
                  value={suggestMode}
                  onChange={(e) => setSuggestMode(e.target.value as TierModeId | '')}
                  className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-white focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">None / General Member</option>
                  {TIER_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="suggest-note-input" className="block text-[11px] font-medium text-zinc-400">
                  Note (optional)
                </label>
                <input
                  id="suggest-note-input"
                  type="text"
                  maxLength={240}
                  value={suggestNote}
                  onChange={(e) => setSuggestNote(e.target.value)}
                  placeholder="Why add this player?"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={suggestBusy || !suggestIgn.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-500 px-4 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{suggestBusy ? 'Submitting...' : 'Submit Player Suggestion'}</span>
              </button>
            </div>
          </form>
        )}

        {feedback && (
          <div
            role={feedback.ok ? 'status' : 'alert'}
            className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
              feedback.ok
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {feedback.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </section>

      {/* Discord-Style 8-Rank Hierarchy Strip */}
      <section aria-label="Discord server rank hierarchy" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Server Rank Hierarchy
          </h2>
          {rankFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setRankFilter('all')}
              className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
            >
              Show all ranks
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {SERVER_RANKS.map((rank) => {
            const active = rankFilter === rank.id;
            const count = rankCounts[rank.id];
            return (
              <button
                key={rank.id}
                type="button"
                aria-pressed={active}
                onClick={() => setRankFilter((prev) => (prev === rank.id ? 'all' : rank.id))}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? 'bg-[#141622]'
                    : 'border-zinc-800/90 bg-[#0d0d12] hover:border-zinc-700 hover:bg-zinc-900/70'
                }`}
                style={
                  active
                    ? { borderColor: rank.hexColor }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: rank.hexColor }}
                    aria-hidden="true"
                  />
                  <span className="font-display-mono text-[11px] font-bold text-zinc-400 tabular-nums">
                    {count}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-bold text-white">{rank.label}</p>
                <p className="mt-0.5 truncate font-display-mono text-[10px] text-zinc-500">
                  {rank.hoisted ? 'Hoisted' : 'Standard'}
                </p>
              </button>
            );
          })}
        </div>

        {selectedRankMeta && (
          <div
            className="rounded-lg border bg-[#0d0d12] p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: `${selectedRankMeta.hexColor}55` }}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ServerRankBadge rankId={selectedRankMeta.id} size="md" showIcon />
                <span className="font-display-mono text-[11px] text-zinc-500">
                  Tier #{selectedRankMeta.priority}
                </span>
              </div>
              <p className="text-xs text-zinc-300">{selectedRankMeta.description}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {selectedRankMeta.perks.map((perk) => (
                <span
                  key={perk}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
                >
                  {perk}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Main 2-Column Workspace: Roster + Suggestions (left) & Friends Hub (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Player & Member Ranks Directory */}
          <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                <h2 className="text-sm font-bold text-white">
                  {selectedRankMeta ? `${selectedRankMeta.label} Holders` : 'Members & Rank Directory'}
                </h2>
              </div>
              <span className="font-display-mono text-xs text-zinc-400 tabular-nums">
                {searchQuery.trim() || rankFilter !== 'all'
                  ? `${filteredMembers.length} of ${mergedMembers.length} ${
                      mergedMembers.length === 1 ? 'account' : 'accounts'
                    }`
                  : `${filteredMembers.length} ${filteredMembers.length === 1 ? 'account' : 'accounts'}`}
              </span>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-7 text-center space-y-2">
                <p className="text-xs font-bold text-zinc-200">
                  {searchQuery.trim()
                    ? `0 members matched "${searchQuery.trim()}"`
                    : selectedRankMeta
                    ? `0 members currently hold ${selectedRankMeta.label}`
                    : '0 verified members registered yet'}
                </p>
                <p className="mx-auto max-w-md text-[11px] text-zinc-400">
                  Real accounts appear automatically when members sign in and verify their email. You can also search any Minecraft IGN above to suggest adding a player.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="inline-flex h-8 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-semibold text-zinc-200 hover:border-indigo-400/60 hover:text-white"
                    >
                      Clear search
                    </button>
                  )}
                  {!isSignedIn && (
                    <button
                      type="button"
                      onClick={onRequireAuth}
                      className="inline-flex h-8 items-center rounded-md bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-500"
                    >
                      Sign In / Create Account
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {filteredMembers.map((member) => {
                  const resolved = resolveMemberServerRoles(member);
                  const primaryMeta = getServerRankMeta(resolved.primaryRank);
                  const linkedTier = tierPlayerByIgnLower.get(
                    member.displayName.trim().toLowerCase()
                  );
                  const levelInfo = getLevelInfo(member.xp, LEVEL_TIERS);
                  return (
                    <li
                      key={member.uid}
                      className="flex flex-col gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/75 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: primaryMeta.hexColor,
                      }}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <MinecraftHeadAvatar
                          avatarUrl={member.avatarUrl}
                          username={member.displayName}
                          alt={`${member.displayName} skin head`}
                          initials={member.displayName.slice(0, 2).toUpperCase()}
                          className="h-11 w-11 shrink-0 rounded-md border border-zinc-700 bg-zinc-900"
                        />
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openMemberInspection(member)}
                              className="truncate text-sm font-bold text-white hover:text-indigo-300 text-left"
                            >
                              {member.displayName}
                            </button>
                            <ServerRankBadge rankId={resolved.primaryRank} size="xs" showIcon />
                            {linkedTier && (
                              <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-display-mono text-[10px] font-bold text-amber-300 tabular-nums">
                                {linkedTier.points} PvP pts
                              </span>
                            )}
                          </div>

                          {/* Discord-style held roles strip */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {resolved.roles.map((r) => (
                              <ServerRankBadge key={r} rankId={r} size="xs" />
                            ))}
                            <span className="font-display-mono text-[10px] text-zinc-500 tabular-nums">
                              · Lv.{levelInfo.current.level} ({member.xp.toLocaleString()} XP)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openMemberInspection(member)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-indigo-400/60 hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                          <span>View Ranks</span>
                        </button>
                        {renderFriendButton(member)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Matched PvP Tier Players when Searching */}
          {searchQuery.trim() && searchResult.matchedTierPlayers.length > 0 && (
            <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-white">Matching PvP Tier Players</h2>
                </div>
                {onOpenTiers && (
                  <button
                    type="button"
                    onClick={onOpenTiers}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200"
                  >
                    Open Tier Ledger
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {searchResult.matchedTierPlayers.map((tp) => {
                  const title = resolveCombatTitle(tp.points);
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => openTierPlayerInspection(tp)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/75 p-3 text-left hover:border-amber-500/45"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MinecraftHeadAvatar
                          username={tp.ign}
                          alt={`${tp.ign} head`}
                          initials={tp.ign.slice(0, 2).toUpperCase()}
                          className="h-9 w-9 shrink-0 rounded border border-zinc-700"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white">{tp.ign}</p>
                          <p className="truncate text-[11px] text-amber-300">
                            {title.title} · {tp.region}
                          </p>
                        </div>
                      </div>
                      <span className="font-display-mono text-xs font-extrabold text-white tabular-nums">
                        {tp.points} pts
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Community Player Suggestions Queue */}
          <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                <h2 className="text-sm font-bold text-white">Player Suggestions Queue</h2>
              </div>
              <span className="font-display-mono text-xs text-zinc-400 tabular-nums">
                {suggestions.filter((s) => s.status === 'pending').length} pending · {suggestions.length} total
              </span>
            </div>

            {suggestions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-6 text-center space-y-1.5">
                <p className="text-xs font-bold text-zinc-200">0 player suggestions submitted yet</p>
                <p className="text-[11px] text-zinc-400">
                  Search any Minecraft IGN above and click &ldquo;Suggest Add This Player&rdquo; to nominate them.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {suggestions.map((sug) => (
                  <li
                    key={sug.id}
                    className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/75 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <MinecraftHeadAvatar
                        username={sug.ign}
                        alt={`${sug.ign} skin head`}
                        initials={sug.ign.slice(0, 2).toUpperCase()}
                        className="h-10 w-10 shrink-0 rounded-md border border-zinc-700 bg-zinc-900"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">{sug.ign}</span>
                          {sug.suggestedRank && <ServerRankBadge rankId={sug.suggestedRank} size="xs" />}
                          {sug.suggestedMode && (
                            <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-display-mono text-[10px] font-bold uppercase text-amber-200">
                              {sug.suggestedMode}
                            </span>
                          )}
                          <span
                            className={`rounded border px-1.5 py-0.5 font-display-mono text-[10px] font-bold uppercase ${
                              sug.status === 'approved'
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                : sug.status === 'declined'
                                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                                : 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                            }`}
                          >
                            {sug.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Suggested by <span className="text-zinc-200">{sug.suggestedByName}</span>
                          {sug.note ? ` · "${sug.note}"` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {canReviewSuggestions && sug.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === sug.id}
                            onClick={() =>
                              void runAction(sug.id, () =>
                                onResolveSuggestion(sug, 'approved', Boolean(sug.suggestedMode))
                              )
                            }
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-2.5 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{sug.suggestedMode ? 'Approve & Add' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === sug.id}
                            onClick={() =>
                              void runAction(sug.id, () => onResolveSuggestion(sug, 'declined', false))
                            }
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-300 hover:border-red-500/50 hover:text-red-300"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Decline</span>
                          </button>
                        </>
                      )}
                      {(canReviewSuggestions || (currentUid && sug.suggestedBy === currentUid)) && (
                        <button
                          type="button"
                          disabled={busyId === `del-${sug.id}`}
                          aria-label={`Remove suggestion ${sug.ign}`}
                          onClick={() =>
                            void runAction(`del-${sug.id}`, () => onDeleteSuggestion(sug.id))
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-500/50 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column: Friend Requests, Friends List, Suggested Players */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Incoming Friend Requests */}
          <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                <UserPlus className="h-4 w-4 text-rose-400" aria-hidden="true" />
                <span>Friend Requests</span>
              </h2>
              <span className="font-display-mono text-xs text-rose-300 tabular-nums">
                {friendshipSummary.incomingRequests.length}
              </span>
            </div>

            {!isSignedIn || !emailVerified ? (
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4 text-center space-y-2">
                <p className="text-xs text-zinc-400">
                  Sign in and verify your email to send and accept friend requests.
                </p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="inline-flex h-8 items-center rounded-md bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500"
                >
                  Sign In
                </button>
              </div>
            ) : friendshipSummary.incomingRequests.length === 0 ? (
              <p className="py-3 text-center text-xs text-zinc-500">
                No incoming friend requests right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {friendshipSummary.incomingRequests.map((req) => {
                  const sender = getFriendOtherParticipant(req, currentUid!);
                  const senderMember = memberByUid.get(sender.uid);
                  const senderRank = senderMember
                    ? resolveMemberServerRoles(senderMember).primaryRank
                    : 'member';
                  return (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/75 p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MinecraftHeadAvatar
                          avatarUrl={sender.avatarUrl}
                          username={sender.displayName}
                          alt={`${sender.displayName} head`}
                          initials={sender.displayName.slice(0, 2).toUpperCase()}
                          className="h-8 w-8 shrink-0 rounded border border-zinc-700"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white">
                            {sender.displayName}
                          </p>
                          <ServerRankBadge rankId={senderRank} size="xs" className="mt-0.5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() =>
                            void runAction(req.id, () => onRespondFriendRequest(req, 'accepted'))
                          }
                          aria-label={`Accept friend request from ${sender.displayName}`}
                          className="inline-flex h-7 items-center gap-1 rounded bg-emerald-500 px-2 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() =>
                            void runAction(req.id, () => onRespondFriendRequest(req, 'declined'))
                          }
                          aria-label={`Decline friend request from ${sender.displayName}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-red-500/50 hover:text-red-300"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Friends List */}
          <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                <UserCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span>Friends</span>
              </h2>
              <span className="font-display-mono text-xs text-emerald-300 tabular-nums">
                {friendshipSummary.friends.length}
              </span>
            </div>

            {friendshipSummary.friends.length === 0 ? (
              <p className="py-3 text-center text-xs text-zinc-500">
                0 friends added yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {friendshipSummary.friends.map((rec) => {
                  const friend = getFriendOtherParticipant(rec, currentUid!);
                  const friendMember = memberByUid.get(friend.uid);
                  const friendRank = friendMember
                    ? resolveMemberServerRoles(friendMember).primaryRank
                    : 'member';
                  const isMenuOpen = openFriendMenuId === rec.id;
                  const canDirectMessage = Boolean(
                    directMessagesEnabled && onDirectMessageFriend
                  );
                  return (
                    <li
                      key={rec.id}
                      className="flex items-center justify-between gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/75 p-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (friendMember) {
                            openMemberInspection(friendMember);
                          } else {
                            setInspectedUid(null);
                            setInspectedIgnOnly(friend.displayName);
                          }
                        }}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                      >
                        <MinecraftHeadAvatar
                          avatarUrl={friendMember?.avatarUrl || friend.avatarUrl}
                          username={friend.displayName}
                          alt={`${friend.displayName} head`}
                          initials={friend.displayName.slice(0, 2).toUpperCase()}
                          className="h-8 w-8 shrink-0 rounded border border-zinc-700"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white hover:text-indigo-300">
                            {friend.displayName}
                          </p>
                          <ServerRankBadge rankId={friendRank} size="xs" className="mt-0.5" />
                        </div>
                      </button>

                      <div
                        className="relative shrink-0"
                        ref={isMenuOpen ? openMenuContainerRef : undefined}
                      >
                        <button
                          type="button"
                          disabled={busyId === rec.id}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          aria-label={`Quick actions for ${friend.displayName}`}
                          onClick={() =>
                            setOpenFriendMenuId((prev) => (prev === rec.id ? null : rec.id))
                          }
                          className={`inline-flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                            isMenuOpen
                              ? 'border-indigo-500/60 bg-zinc-800 text-white'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                          }`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            aria-label={`Friend options for ${friend.displayName}`}
                            className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-lg border border-zinc-700/90 bg-[#12131a] p-1 shadow-xl"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenFriendMenuId(null);
                                if (friendMember) {
                                  openMemberInspection(friendMember);
                                } else {
                                  setInspectedUid(null);
                                  setInspectedIgnOnly(friend.displayName);
                                }
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white"
                            >
                              <Eye className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                              <span>View Profile</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              disabled={!canDirectMessage}
                              aria-disabled={!canDirectMessage}
                              title={
                                canDirectMessage
                                  ? `Send a direct message to ${friend.displayName}`
                                  : 'Direct messaging is planned for a future update'
                              }
                              onClick={() => {
                                if (!canDirectMessage || !onDirectMessageFriend) return;
                                setOpenFriendMenuId(null);
                                onDirectMessageFriend(friend);
                              }}
                              className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium ${
                                canDirectMessage
                                  ? 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                                  : 'cursor-not-allowed text-zinc-500'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Direct Message</span>
                              </span>
                              {!canDirectMessage && (
                                <span className="font-display-mono text-[9px] uppercase tracking-wider text-zinc-500">
                                  Soon
                                </span>
                              )}
                            </button>

                            <div className="my-1 border-t border-zinc-800" />

                            <button
                              type="button"
                              role="menuitem"
                              disabled={busyId === rec.id}
                              onClick={() => {
                                setOpenFriendMenuId(null);
                                void runAction(rec.id, () => onRemoveFriendship(rec));
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            >
                              <UserMinus className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                              <span>Remove Friend</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              disabled={busyId === rec.id || !onBlockFriend}
                              onClick={() => {
                                if (!onBlockFriend) return;
                                setOpenFriendMenuId(null);
                                void runAction(rec.id, () => onBlockFriend(rec));
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Block</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Sent Outgoing Requests */}
            {friendshipSummary.outgoingRequests.length > 0 && (
              <div className="border-t border-zinc-800/80 pt-3 space-y-2">
                <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Sent Requests ({friendshipSummary.outgoingRequests.length})
                </p>
                <ul className="space-y-1.5">
                  {friendshipSummary.outgoingRequests.map((req) => {
                    const target = getFriendOtherParticipant(req, currentUid!);
                    return (
                      <li
                        key={req.id}
                        className="flex items-center justify-between gap-2 rounded border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate text-zinc-300">{target.displayName}</span>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => void runAction(req.id, () => onRemoveFriendship(req))}
                          className="font-display-mono text-[10px] font-semibold text-zinc-400 hover:text-red-300"
                        >
                          Cancel
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Blocked Players */}
            {friendshipSummary.blockedUsers.length > 0 && (
              <div className="border-t border-zinc-800/80 pt-3 space-y-2">
                <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Blocked ({friendshipSummary.blockedUsers.length})
                </p>
                <ul className="space-y-1.5">
                  {friendshipSummary.blockedUsers.map((rec) => {
                    const blocked = getFriendOtherParticipant(rec, currentUid!);
                    return (
                      <li
                        key={rec.id}
                        className="flex items-center justify-between gap-2 rounded border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate text-zinc-400">{blocked.displayName}</span>
                        <button
                          type="button"
                          disabled={busyId === rec.id}
                          onClick={() => void runAction(rec.id, () => onRemoveFriendship(rec))}
                          className="font-display-mono text-[10px] font-semibold text-zinc-400 hover:text-emerald-300"
                        >
                          Unblock
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Suggested Players to Add */}
          <section className="rounded-xl border border-zinc-800/90 bg-[#0d0d12] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                <Users className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                <span>Suggested Players</span>
              </h2>
              <span className="font-display-mono text-xs text-zinc-400 tabular-nums">
                {suggestedMembers.length}
              </span>
            </div>

            {suggestedMembers.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-zinc-500">
                No other verified members to suggest right now. Search any Minecraft IGN above to suggest adding a player.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestedMembers.slice(0, 6).map((m) => {
                  const resolved = resolveMemberServerRoles(m);
                  return (
                    <li
                      key={m.uid}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/75 p-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => openMemberInspection(m)}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                      >
                        <MinecraftHeadAvatar
                          avatarUrl={m.avatarUrl}
                          username={m.displayName}
                          alt={`${m.displayName} head`}
                          initials={m.displayName.slice(0, 2).toUpperCase()}
                          className="h-8 w-8 shrink-0 rounded border border-zinc-700"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white hover:text-indigo-300">
                            {m.displayName}
                          </p>
                          <ServerRankBadge rankId={resolved.primaryRank} size="xs" className="mt-0.5" />
                        </div>
                      </button>
                      {renderFriendButton(m)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* Discord-Style Player Rank & Role Profile Modal */}
      {(inspectedMember || inspectedIgnOnly) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discord-rank-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectedUid(null);
              setInspectedIgnOnly(null);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-[#111218] shadow-2xl">
            {(() => {
              const displayName = inspectedMember?.displayName || inspectedIgnOnly || 'Player';
              const resolved = inspectedMember
                ? resolveMemberServerRoles(inspectedMember)
                : { primaryRank: 'free' as ServerRankId, roles: ['free' as ServerRankId] };
              const primaryMeta = getServerRankMeta(resolved.primaryRank);
              const levelInfo = getLevelInfo(inspectedMember?.xp ?? 0, LEVEL_TIERS);

              return (
                <>
                  {/* Discord Profile Top Accent Banner */}
                  <div
                    className="relative h-20 border-b border-zinc-800/80"
                    style={{
                      background: `linear-gradient(135deg, ${primaryMeta.hexColor}40 0%, #111218 85%)`,
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Close player rank profile"
                      onClick={() => {
                        setInspectedUid(null);
                        setInspectedIgnOnly(null);
                      }}
                      className="absolute right-3 top-3 rounded-md border border-zinc-700/80 bg-zinc-950/80 p-1.5 text-zinc-300 hover:text-white"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="px-5 pb-5 space-y-4">
                    {/* Avatar + Identity */}
                    <div className="-mt-9 flex items-end justify-between gap-3">
                      <MinecraftHeadAvatar
                        avatarUrl={inspectedMember?.avatarUrl}
                        username={displayName}
                        styleMode="3d"
                        alt={`${displayName} 3D skin head`}
                        initials={displayName.slice(0, 2).toUpperCase()}
                        className="h-16 w-16 shrink-0 rounded-xl border-4 border-[#111218] bg-zinc-950"
                      />
                      {inspectedMember && renderFriendButton(inspectedMember)}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id="discord-rank-modal-title" className="text-lg font-extrabold text-white">
                          {displayName}
                        </h2>
                        <ServerRankBadge rankId={resolved.primaryRank} size="sm" showIcon />
                      </div>
                      <p className="mt-1 font-display-mono text-[11px] text-zinc-400 tabular-nums">
                        {inspectedMember
                          ? `Level ${levelInfo.current.level} (${levelInfo.current.name}) · ${inspectedMember.xp.toLocaleString()} XP`
                          : 'Minecraft Player Profile'}
                      </p>
                    </div>

                    {/* Hoisted Rank Card */}
                    <div
                      className="rounded-lg border bg-[#0b0c10] p-3 space-y-1"
                      style={{ borderColor: `${primaryMeta.hexColor}44` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Hoisted Server Rank
                        </p>
                        <span
                          className="inline-flex items-center gap-1 font-display-mono text-[10px] font-bold uppercase"
                          style={{ color: primaryMeta.hexColor }}
                        >
                          {serverRankIcon(resolved.primaryRank, 'h-3 w-3')}
                          <span>{primaryMeta.label}</span>
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300">{primaryMeta.description}</p>
                    </div>

                    {/* Discord Server Roles List */}
                    <div className="rounded-lg border border-zinc-800/90 bg-[#0b0c10] p-3 space-y-2">
                      <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Server Roles — {resolved.roles.length}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {resolved.roles.map((r) => (
                          <ServerRankBadge key={r} rankId={r} size="sm" />
                        ))}
                      </div>
                    </div>

                    {/* Linked PvP Tier Ranks if tested */}
                    {inspectedTierPlayer && (
                      <div className="rounded-lg border border-amber-500/30 bg-[#0b0c10] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
                            PvP Combat Standings
                          </p>
                          <span className="font-display-mono text-[11px] font-bold text-white tabular-nums">
                            {inspectedTierPlayer.points} pts · {inspectedTierPlayer.region}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {TIER_MODES.map((m) => {
                            const rk = inspectedTierPlayer.ranks[m.id];
                            if (!rk) return null;
                            return (
                              <span
                                key={m.id}
                                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-display-mono text-[10px] font-bold text-amber-200"
                              >
                                {m.shortLabel}: {rk}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Owner Discord Rank & Role Assignment Controls */}
                    {isOwner && inspectedMember && syncedUidSet.has(inspectedMember.uid) && (
                      <div className="rounded-lg border border-rose-500/35 bg-[#0b0c10] p-3.5 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                          <p className="font-display-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
                            Owner Rank Control
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="owner-primary-rank-select"
                            className="block text-[11px] font-medium text-zinc-400"
                          >
                            Primary Server Rank
                          </label>
                          <select
                            id="owner-primary-rank-select"
                            value={editPrimaryRank}
                            onChange={(e) => {
                              const nextPrimary = e.target.value as ServerRankId;
                              setEditPrimaryRank(nextPrimary);
                              setEditRoles((prev) =>
                                prev.includes(nextPrimary) ? prev : [...prev, nextPrimary]
                              );
                            }}
                            className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-white focus:border-rose-400 focus:outline-none"
                          >
                            {SERVER_RANKS.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-400">
                            Additional Discord Roles
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {SERVER_RANKS.map((r) => {
                              const checked = editRoles.includes(r.id);
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  aria-pressed={checked}
                                  onClick={() => toggleEditRole(r.id)}
                                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                    checked
                                      ? 'bg-zinc-900 text-white'
                                      : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                                  }`}
                                  style={
                                    checked ? { borderColor: r.hexColor } : undefined
                                  }
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: r.hexColor }}
                                    aria-hidden="true"
                                  />
                                  <span>{r.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={busyId === `roles-${inspectedMember.uid}`}
                          onClick={() =>
                            void runAction(`roles-${inspectedMember.uid}`, async () => {
                              await onAssignMemberServerRoles(
                                inspectedMember.uid,
                                editPrimaryRank,
                                editRoles
                              );
                              setFeedback({
                                ok: true,
                                text: `Updated Discord server ranks for ${inspectedMember.displayName}.`,
                              });
                            })
                          }
                          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Save Discord Roles</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
