import { CATEGORIES } from '../data/catalog';
import {
  CategoryId,
  CommunityThread,
  LiveServerStatus,
  MembershipTier,
  MinecraftServerListing,
  NavTab,
  PublicMemberProfile,
  ResourceItem,
} from '../types';
import { clampString } from './authLogic';
import type { TierAdminRecord, TierPlayerRecord } from './tiersLogic';

export const PUBLIC_MEMBER_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  URL_MAX: 500,
  MAX_XP: 1000000,
  MAX_VISITS: 1000000000,
} as const;

export const STUDIO_OWNER_PUBLIC_SLOTS: ReadonlyArray<{
  uid: string;
  displayName: string;
  title: string;
}> = [
  { uid: 'studio-owner-lead', displayName: 'SwxStudios Lead', title: 'Studio Owner' },
  { uid: 'studio-owner-co', displayName: 'DrMineMC', title: 'Co-Owner' },
];

export type StatsListCategory = 'traffic' | 'people' | 'stuffs';

export interface StaffRosterEntry {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  role: 'owner' | 'admin';
  roleLabel: string;
  verifiedCloud: boolean;
}

export interface CategoryBreakdownEntry {
  id: CategoryId;
  label: string;
  description: string;
  count: number;
  downloads: number;
}

export interface StudioStatsListRow {
  id: string;
  label: string;
  category: StatsListCategory;
  categoryLabel: string;
  count: number;
  detail: string;
  targetTab?: NavTab;
  actionLabel?: string;
}

export interface StudioStatsOverview {
  visits: number;
  membersCount: number;
  staffCount: number;
  ownersCount: number;
  adminsCount: number;
  resourcesCount: number;
  totalDownloads: number;
  serversCount: number;
  onlineServersCount: number;
  livePlayersOnline: number;
  tierPlayersCount: number;
  threadsCount: number;
  toolsCount: number;
  totalStuffsCount: number;
  members: PublicMemberProfile[];
  staffs: StaffRosterEntry[];
  categoryBreakdown: CategoryBreakdownEntry[];
  rows: StudioStatsListRow[];
}

export function sanitizePublicMemberFields(input: {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  role: 'member' | 'admin' | 'owner';
  membershipTier: MembershipTier;
  xp: number;
}): {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  role: 'member' | 'admin' | 'owner';
  membershipTier: MembershipTier;
  xp: number;
} {
  const safeName =
    clampString(input.displayName, PUBLIC_MEMBER_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember';
  const safeAvatar =
    typeof input.avatarUrl === 'string' && input.avatarUrl.trim()
      ? clampString(input.avatarUrl, PUBLIC_MEMBER_LIMITS.URL_MAX)
      : undefined;
  const safeXp = Number.isFinite(input.xp)
    ? Math.max(0, Math.min(PUBLIC_MEMBER_LIMITS.MAX_XP, Math.round(input.xp)))
    : 0;
  const safeRole: 'member' | 'admin' | 'owner' =
    input.role === 'owner' || input.role === 'admin' ? input.role : 'member';
  const safeTier: MembershipTier =
    input.membershipTier === 'ultimate' || input.membershipTier === 'premium'
      ? input.membershipTier
      : 'free';

  return {
    uid: clampString(input.uid, 128),
    displayName: safeName,
    ...(safeAvatar ? { avatarUrl: safeAvatar } : {}),
    role: safeRole,
    membershipTier: safeTier,
    xp: safeXp,
  };
}

export function buildStudioStatsOverview(input: {
  visits: number;
  publicMembers: PublicMemberProfile[];
  tierAdmins?: TierAdminRecord[];
  resources: ResourceItem[];
  servers: MinecraftServerListing[];
  liveStatusMap?: Record<string, LiveServerStatus>;
  tierPlayers: TierPlayerRecord[];
  threads: CommunityThread[];
  toolsCount: number;
}): StudioStatsOverview {
  const safeVisits =
    typeof input.visits === 'number' && Number.isFinite(input.visits) && input.visits >= 0
      ? Math.min(PUBLIC_MEMBER_LIMITS.MAX_VISITS, Math.floor(input.visits))
      : 0;

  const seenUids = new Set<string>();
  const members: PublicMemberProfile[] = [];
  const staffs: StaffRosterEntry[] = [];

  // Deduplicate publicMembers by uid
  for (const profile of input.publicMembers) {
    if (!profile.uid || seenUids.has(profile.uid)) continue;
    seenUids.add(profile.uid);
    if (profile.role === 'owner' || profile.role === 'admin') {
      staffs.push({
        uid: profile.uid,
        displayName: profile.displayName || (profile.role === 'owner' ? 'Studio Owner' : 'Tier Admin'),
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        roleLabel: profile.role === 'owner' ? 'Owner' : 'Tier Admin',
        verifiedCloud: true,
      });
    } else {
      members.push(profile);
    }
  }

  // Merge any owner-visible tierAdmins that have not synced a publicMembers doc yet
  for (const adm of input.tierAdmins || []) {
    if (!adm.uid || seenUids.has(adm.uid)) continue;
    seenUids.add(adm.uid);
    staffs.push({
      uid: adm.uid,
      displayName: adm.displayName || 'Tier Admin',
      role: 'admin',
      roleLabel: 'Tier Admin',
      verifiedCloud: true,
    });
  }

  // Ensure the configured Studio Owners are represented even before signing into publicMembers
  const syncedOwnersCount = staffs.filter((s) => s.role === 'owner').length;
  if (syncedOwnersCount < STUDIO_OWNER_PUBLIC_SLOTS.length) {
    const missingSlots = STUDIO_OWNER_PUBLIC_SLOTS.slice(syncedOwnersCount);
    for (const slot of missingSlots) {
      staffs.push({
        uid: slot.uid,
        displayName: slot.displayName,
        role: 'owner',
        roleLabel: slot.title,
        verifiedCloud: false,
      });
    }
  }

  // Sort staff: Owners first, then Tier Admins alphabetically
  staffs.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  // Sort members: highest XP first, then alphabetical
  members.sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    return a.displayName.localeCompare(b.displayName);
  });

  const ownersCount = staffs.filter((s) => s.role === 'owner').length;
  const adminsCount = staffs.filter((s) => s.role === 'admin').length;

  const categoryBreakdown: CategoryBreakdownEntry[] = CATEGORIES.map((cat) => {
    const matching = input.resources.filter((r) => r.category === cat.id);
    const downloads = matching.reduce((sum, r) => sum + (r.downloads || 0), 0);
    return {
      id: cat.id,
      label: cat.label,
      description: cat.description,
      count: matching.length,
      downloads,
    };
  });

  const totalDownloads = input.resources.reduce((sum, r) => sum + (r.downloads || 0), 0);
  const liveMap = input.liveStatusMap || {};
  let onlineServersCount = 0;
  let livePlayersOnline = 0;
  for (const srv of input.servers) {
    const st = liveMap[srv.id];
    if (st?.online) {
      onlineServersCount += 1;
      livePlayersOnline += typeof st.playersOnline === 'number' ? st.playersOnline : 0;
    }
  }

  const totalStuffsCount =
    input.resources.length +
    input.servers.length +
    input.tierPlayers.length +
    input.threads.length +
    input.toolsCount;

  const rows: StudioStatsListRow[] = [
    {
      id: 'visits',
      label: 'Total Site Visits',
      category: 'traffic',
      categoryLabel: 'Traffic',
      count: safeVisits,
      detail:
        safeVisits === 0
          ? 'Visitor counter active'
          : `${safeVisits.toLocaleString()} site ${safeVisits === 1 ? 'visit' : 'visits'}`,
    },
    {
      id: 'members',
      label: 'Registered Members',
      category: 'people',
      categoryLabel: 'People',
      count: members.length,
      detail:
        members.length === 0
          ? '0 verified members registered yet'
          : `${members.filter((m) => m.membershipTier === 'ultimate').length} Ultimate · ${
              members.filter((m) => m.membershipTier === 'premium').length
            } Premium · ${members.filter((m) => m.membershipTier === 'free').length} Free`,
      targetTab: 'levels',
      actionLabel: 'Levels',
    },
    {
      id: 'staffs',
      label: 'Staff Roster',
      category: 'people',
      categoryLabel: 'People',
      count: staffs.length,
      detail: `${ownersCount} ${ownersCount === 1 ? 'Owner' : 'Owners'} · ${adminsCount} Tier ${
        adminsCount === 1 ? 'Admin' : 'Admins'
      }`,
      targetTab: 'tiers',
      actionLabel: 'Staff Deck',
    },
    {
      id: 'resources',
      label: 'Plugins, Configs & Packages',
      category: 'stuffs',
      categoryLabel: 'Stuffs',
      count: input.resources.length,
      detail: `${totalDownloads.toLocaleString()} total downloads across ${CATEGORIES.length} categories`,
      targetTab: 'downloads',
      actionLabel: 'Directory',
    },
    {
      id: 'servers',
      label: 'Listed Minecraft Servers',
      category: 'stuffs',
      categoryLabel: 'Stuffs',
      count: input.servers.length,
      detail:
        onlineServersCount > 0
          ? `${onlineServersCount} online now · ${livePlayersOnline.toLocaleString()} active players`
          : `${input.servers.length} active Java & Crossplay listings`,
      targetTab: 'servers',
      actionLabel: 'Servers',
    },
    {
      id: 'tiers',
      label: 'PvP Tier List Players',
      category: 'stuffs',
      categoryLabel: 'Stuffs',
      count: input.tierPlayers.length,
      detail:
        input.tierPlayers.length === 0
          ? '0 ranked players added yet across 8 PvP kits'
          : `${input.tierPlayers.length} ranked players across 8 PvP kits`,
      targetTab: 'tiers',
      actionLabel: 'Tier List',
    },
    {
      id: 'tools',
      label: 'Minecraft Tools',
      category: 'stuffs',
      categoryLabel: 'Stuffs',
      count: input.toolsCount,
      detail: 'MOTD builder, Font designer, Spark analyzer, Skin viewer & calculators',
      targetTab: 'tools',
      actionLabel: 'Tools',
    },
    {
      id: 'threads',
      label: 'Community Threads',
      category: 'stuffs',
      categoryLabel: 'Stuffs',
      count: input.threads.length,
      detail:
        input.threads.length === 0
          ? '0 forum topics posted yet'
          : `${input.threads.reduce((sum, t) => sum + (t.upvotes || 0), 0)} total upvotes`,
      targetTab: 'community',
      actionLabel: 'Community',
    },
  ];

  return {
    visits: safeVisits,
    membersCount: members.length,
    staffCount: staffs.length,
    ownersCount,
    adminsCount,
    resourcesCount: input.resources.length,
    totalDownloads,
    serversCount: input.servers.length,
    onlineServersCount,
    livePlayersOnline,
    tierPlayersCount: input.tierPlayers.length,
    threadsCount: input.threads.length,
    toolsCount: input.toolsCount,
    totalStuffsCount,
    members,
    staffs,
    categoryBreakdown,
    rows,
  };
}
