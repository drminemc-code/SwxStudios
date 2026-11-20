import type {
  FriendAvailabilityStatus,
  FriendshipRecord,
  MembershipTier,
  PlayerSuggestionRecord,
  PublicMemberProfile,
  ServerRankId,
} from '../types';
import { clampString, isValidFirestoreId } from './authLogic';
import type { TierModeId, TierPlayerRecord } from './tiersLogic';

export const RANKS_FRIENDS_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  URL_MAX: 500,
  IGN_MIN: 2,
  IGN_MAX: 24,
  IGN_PATTERN: /^[a-zA-Z0-9_]+$/,
  MODE_MAX: 24,
  NOTE_MAX: 240,
  MAX_ROLES: 8,
} as const;

export interface ServerRankMeta {
  id: ServerRankId;
  label: string;
  shortLabel: string;
  priority: number;
  category: 'leadership' | 'staff' | 'community';
  hoisted: boolean;
  hexColor: string;
  description: string;
  perks: string[];
}

export const SERVER_RANKS: readonly ServerRankMeta[] = [
  {
    id: 'owner',
    label: 'Owner Rank',
    shortLabel: 'Owner',
    priority: 1,
    category: 'leadership',
    hoisted: true,
    hexColor: '#f43f5e',
    description: 'Studio Founder & Root Server Administrator with full platform, rank, and catalog authority.',
    perks: ['Assign Server Ranks & Roles', 'Manage Tier Admins & Commands', 'Approve Orders & Resources'],
  },
  {
    id: 'admin',
    label: 'Admin Rank',
    shortLabel: 'Admin',
    priority: 2,
    category: 'leadership',
    hoisted: true,
    hexColor: '#f59e0b',
    description: 'Senior admin managing PvP tier standings, player suggestions, and moderation.',
    perks: ['Execute /tier Admin Commands', 'Review Player Suggestions', 'Moderate Listings'],
  },
  {
    id: 'staff',
    label: 'Staff Team',
    shortLabel: 'Staff',
    priority: 3,
    category: 'staff',
    hoisted: true,
    hexColor: '#38bdf8',
    description: 'Studio & Server Staff coordinating build QA, server testing, and community events.',
    perks: ['Hoisted Staff Badge', 'Priority Testing Coordination', 'Event & Community Moderation'],
  },
  {
    id: 'support',
    label: 'Support Team',
    shortLabel: 'Support',
    priority: 4,
    category: 'staff',
    hoisted: true,
    hexColor: '#10b981',
    description: 'Dedicated Member Support specialists helping players with setups, configs, and onboarding.',
    perks: ['Hoisted Support Badge', 'Setup & Config Troubleshooting', 'Member Onboarding Help'],
  },
  {
    id: 'ultimate',
    label: 'Ultimate Member',
    shortLabel: 'Ultimate',
    priority: 5,
    category: 'community',
    hoisted: true,
    hexColor: '#a855f7',
    description: 'Highest supporter membership unlocking Ultimate builds, Exclusive vault drops, and custom perks.',
    perks: ['Full Ultimate Vault Access', 'Exclusive Setup Releases', '2x Community XP Boost'],
  },
  {
    id: 'paid',
    label: 'Paid Member',
    shortLabel: 'Paid',
    priority: 6,
    category: 'community',
    hoisted: true,
    hexColor: '#eab308',
    description: 'Verified supporter holding Premium membership or paid release unlocks via GCash / PayPal.',
    perks: ['Premium Packages Unlocked', 'Supporter Role Color', 'Priority Downloads'],
  },
  {
    id: 'member',
    label: 'Member',
    shortLabel: 'Member',
    priority: 7,
    category: 'community',
    hoisted: false,
    hexColor: '#6366f1',
    description: 'Verified SwxStudios community member with active profile, friend list, and player suggestions.',
    perks: ['Friend Requests & Friends List', 'Suggest Players to Add', 'Forum Threads & Replies'],
  },
  {
    id: 'free',
    label: 'Free Member',
    shortLabel: 'Free',
    priority: 8,
    category: 'community',
    hoisted: false,
    hexColor: '#71717a',
    description: 'Standard free-tier community account with access to free plugins, tools, and server stats.',
    perks: ['Free Plugins & Tools Access', 'Live Server Pings & Rankings', 'Community Participation'],
  },
] as const;

export const SERVER_RANK_IDS: readonly ServerRankId[] = SERVER_RANKS.map((r) => r.id);

export function isValidServerRankId(value: unknown): value is ServerRankId {
  return typeof value === 'string' && SERVER_RANK_IDS.includes(value as ServerRankId);
}

export function getServerRankMeta(rankId: ServerRankId): ServerRankMeta {
  return SERVER_RANKS.find((r) => r.id === rankId) ?? SERVER_RANKS[SERVER_RANKS.length - 1];
}

export function sanitizeServerRolesList(input: unknown): ServerRankId[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<ServerRankId>();
  for (const item of input) {
    if (isValidServerRankId(item) && !seen.has(item)) {
      seen.add(item);
      if (seen.size >= RANKS_FRIENDS_LIMITS.MAX_ROLES) break;
    }
  }
  return Array.from(seen).sort(
    (a, b) => getServerRankMeta(a).priority - getServerRankMeta(b).priority
  );
}

export function resolveMemberServerRoles(member: {
  role: 'member' | 'admin' | 'owner';
  membershipTier: MembershipTier;
  serverRank?: ServerRankId;
  serverRoles?: ServerRankId[];
}): {
  primaryRank: ServerRankId;
  roles: ServerRankId[];
} {
  const roleSet = new Set<ServerRankId>();

  if (member.role === 'owner') roleSet.add('owner');
  if (member.role === 'admin') roleSet.add('admin');

  if (member.membershipTier === 'ultimate') {
    roleSet.add('ultimate');
  } else if (member.membershipTier === 'premium') {
    roleSet.add('paid');
  } else {
    roleSet.add('free');
  }

  // Every verified public member holds base Member role
  roleSet.add('member');

  for (const explicitRole of sanitizeServerRolesList(member.serverRoles)) {
    roleSet.add(explicitRole);
  }

  if (isValidServerRankId(member.serverRank)) {
    roleSet.add(member.serverRank);
  }

  const sortedRoles = Array.from(roleSet).sort(
    (a, b) => getServerRankMeta(a).priority - getServerRankMeta(b).priority
  );

  let primaryRank: ServerRankId;
  if (isValidServerRankId(member.serverRank)) {
    primaryRank = member.serverRank;
  } else if (member.role === 'owner') {
    primaryRank = 'owner';
  } else if (member.role === 'admin') {
    primaryRank = 'admin';
  } else if (member.membershipTier === 'ultimate') {
    primaryRank = 'ultimate';
  } else if (member.membershipTier === 'premium') {
    primaryRank = 'paid';
  } else {
    primaryRank = 'free';
  }

  return {
    primaryRank,
    roles: sortedRoles,
  };
}

export function buildDeterministicFriendshipId(
  uidA: string,
  uidB: string
): { id: string; users: [string, string] } | null {
  const cleanA = uidA.trim();
  const cleanB = uidB.trim();
  if (!isValidFirestoreId(cleanA) || !isValidFirestoreId(cleanB) || cleanA === cleanB) {
    return null;
  }
  const sorted = cleanA < cleanB ? ([cleanA, cleanB] as [string, string]) : ([cleanB, cleanA] as [string, string]);
  const id = `${sorted[0]}_${sorted[1]}`;
  if (id.length > 128 || !isValidFirestoreId(id)) {
    return null;
  }
  return { id, users: sorted };
}

export interface CategorizedFriendships {
  friends: FriendshipRecord[];
  incomingRequests: FriendshipRecord[];
  outgoingRequests: FriendshipRecord[];
  blockedUsers: FriendshipRecord[];
  relationshipByOtherUid: Record<string, FriendshipRecord>;
}

export function categorizeFriendships(
  records: FriendshipRecord[],
  currentUid: string | null | undefined
): CategorizedFriendships {
  const friends: FriendshipRecord[] = [];
  const incomingRequests: FriendshipRecord[] = [];
  const outgoingRequests: FriendshipRecord[] = [];
  const blockedUsers: FriendshipRecord[] = [];
  const relationshipByOtherUid: Record<string, FriendshipRecord> = {};

  if (!currentUid) {
    return {
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUsers,
      relationshipByOtherUid,
    };
  }

  for (const rec of records) {
    if (!rec || !Array.isArray(rec.users) || !rec.users.includes(currentUid)) continue;
    const otherUid: string = rec.requesterUid === currentUid ? rec.recipientUid : rec.requesterUid;
    if (!otherUid || otherUid === currentUid) continue;

    relationshipByOtherUid[otherUid] = rec;

    if (rec.status === 'accepted') {
      friends.push(rec);
    } else if (rec.status === 'pending') {
      if (rec.recipientUid === currentUid) {
        incomingRequests.push(rec);
      } else if (rec.requesterUid === currentUid) {
        outgoingRequests.push(rec);
      }
    } else if (rec.status === 'blocked' && rec.blockedBy === currentUid) {
      blockedUsers.push(rec);
    }
  }

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    blockedUsers,
    relationshipByOtherUid,
  };
}

export function getFriendOtherParticipant(
  record: FriendshipRecord,
  currentUid: string
): { uid: string; displayName: string; avatarUrl?: string } {
  if (record.requesterUid === currentUid) {
    return {
      uid: record.recipientUid,
      displayName: record.recipientName,
      avatarUrl: record.recipientAvatar,
    };
  }
  return {
    uid: record.requesterUid,
    displayName: record.requesterName,
    avatarUrl: record.requesterAvatar,
  };
}

export function getSuggestedMembersToAdd(
  members: PublicMemberProfile[],
  currentUid: string | null | undefined,
  relationshipByOtherUid: Record<string, FriendshipRecord>
): PublicMemberProfile[] {
  return members
    .filter((m) => {
      if (!m.uid) return false;
      if (currentUid && m.uid === currentUid) return false;
      const existing = relationshipByOtherUid[m.uid];
      if (!existing) return true;
      return existing.status === 'declined';
    })
    .sort((a, b) => {
      const rankA = getServerRankMeta(resolveMemberServerRoles(a).primaryRank).priority;
      const rankB = getServerRankMeta(resolveMemberServerRoles(b).primaryRank).priority;
      if (rankA !== rankB) return rankA - rankB;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.displayName.localeCompare(b.displayName);
    });
}

export function isValidSuggestedIgn(ign: string): boolean {
  const clean = ign.trim();
  return (
    clean.length >= RANKS_FRIENDS_LIMITS.IGN_MIN &&
    clean.length <= RANKS_FRIENDS_LIMITS.IGN_MAX &&
    RANKS_FRIENDS_LIMITS.IGN_PATTERN.test(clean)
  );
}

export function validatePlayerSuggestionInput(input: {
  ign: string;
  suggestedRank?: ServerRankId;
  suggestedMode?: TierModeId | '';
  note?: string;
}):
  | {
      ok: true;
      ign: string;
      suggestedRank?: ServerRankId;
      suggestedMode?: string;
      note?: string;
    }
  | { ok: false; error: string } {
  const cleanIgn = input.ign.trim();
  if (!isValidSuggestedIgn(cleanIgn)) {
    return {
      ok: false,
      error: 'Enter a valid Minecraft IGN (2–24 letters, numbers, or underscores).',
    };
  }

  const cleanRank = isValidServerRankId(input.suggestedRank) ? input.suggestedRank : undefined;
  const cleanMode = input.suggestedMode
    ? clampString(input.suggestedMode, RANKS_FRIENDS_LIMITS.MODE_MAX)
    : undefined;
  const cleanNote = input.note?.trim()
    ? clampString(input.note.trim(), RANKS_FRIENDS_LIMITS.NOTE_MAX)
    : undefined;

  return {
    ok: true,
    ign: cleanIgn,
    ...(cleanRank ? { suggestedRank: cleanRank } : {}),
    ...(cleanMode ? { suggestedMode: cleanMode } : {}),
    ...(cleanNote ? { note: cleanNote } : {}),
  };
}

export interface UnifiedPlayerSearchResult {
  matchedMembers: PublicMemberProfile[];
  matchedTierPlayers: TierPlayerRecord[];
  matchedSuggestions: PlayerSuggestionRecord[];
  suggestableIgn: string | null;
}

export function filterMembersByDisplayName<T extends { displayName: string }>(
  members: T[],
  rawQuery: string
): T[] {
  const qLower = rawQuery.trim().toLowerCase();
  if (!qLower) return members;
  return members.filter((m) => m.displayName.toLowerCase().includes(qLower));
}

export function searchPlayersAndMembers(
  rawQuery: string,
  members: PublicMemberProfile[],
  tierPlayers: TierPlayerRecord[],
  suggestions: PlayerSuggestionRecord[] = []
): UnifiedPlayerSearchResult {
  const trimmed = rawQuery.trim();
  const qLower = trimmed.toLowerCase();

  if (!qLower) {
    return {
      matchedMembers: members,
      matchedTierPlayers: tierPlayers,
      matchedSuggestions: suggestions,
      suggestableIgn: null,
    };
  }

  const matchedMembers = filterMembersByDisplayName(members, trimmed);

  const matchedTierPlayers = tierPlayers.filter(
    (p) =>
      p.ign.toLowerCase().includes(qLower) ||
      p.region.toLowerCase().includes(qLower)
  );

  const matchedSuggestions = suggestions.filter((s) =>
    s.ign.toLowerCase().includes(qLower)
  );

  const exactMember = members.some((m) => m.displayName.trim().toLowerCase() === qLower);
  const exactTier = tierPlayers.some((p) => p.ign.trim().toLowerCase() === qLower);
  const exactPendingSuggestion = suggestions.some(
    (s) => s.status === 'pending' && s.ign.trim().toLowerCase() === qLower
  );

  const suggestableIgn =
    isValidSuggestedIgn(trimmed) && !exactMember && !exactTier && !exactPendingSuggestion
      ? trimmed
      : null;

  return {
    matchedMembers,
    matchedTierPlayers,
    matchedSuggestions,
    suggestableIgn,
  };
}

export const PRESENCE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const PRESENCE_AWAY_WINDOW_MS = 20 * 60 * 1000;

export function isValidPresenceStatus(value: unknown): value is FriendAvailabilityStatus {
  return value === 'online' || value === 'away' || value === 'offline';
}

export function resolveMemberAvailability(
  member: Pick<PublicMemberProfile, 'presenceStatus' | 'updatedAt'> | null | undefined,
  nowMs = Date.now()
): FriendAvailabilityStatus {
  if (!member) return 'offline';
  if (member.presenceStatus === 'offline') return 'offline';

  const parsedTs =
    typeof member.updatedAt === 'string' && member.updatedAt.trim()
      ? Date.parse(member.updatedAt)
      : Number.NaN;

  if (Number.isFinite(parsedTs)) {
    const ageMs = Math.max(0, nowMs - parsedTs);
    if (ageMs > PRESENCE_AWAY_WINDOW_MS) return 'offline';
    if (member.presenceStatus === 'away' || ageMs > PRESENCE_ONLINE_WINDOW_MS) return 'away';
    return 'online';
  }

  if (member.presenceStatus === 'online' || member.presenceStatus === 'away') {
    return member.presenceStatus;
  }

  return 'offline';
}

export interface AvailabilityMeta {
  status: FriendAvailabilityStatus;
  label: string;
  dotClassName: string;
  textClassName: string;
}

export function getAvailabilityMeta(status: FriendAvailabilityStatus): AvailabilityMeta {
  switch (status) {
    case 'online':
      return {
        status: 'online',
        label: 'Online',
        dotClassName: 'bg-emerald-500',
        textClassName: 'text-emerald-400',
      };
    case 'away':
      return {
        status: 'away',
        label: 'Away',
        dotClassName: 'bg-amber-400',
        textClassName: 'text-amber-300',
      };
    case 'offline':
    default:
      return {
        status: 'offline',
        label: 'Offline',
        dotClassName: 'bg-zinc-500',
        textClassName: 'text-zinc-500',
      };
  }
}

