import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicMemberProfile } from '../types';
import {
  buildStudioStatsOverview,
  PUBLIC_MEMBER_LIMITS,
  sanitizePublicMemberFields,
  STUDIO_OWNER_PUBLIC_SLOTS,
} from './siteStatsLogic';

test('buildStudioStatsOverview starts with 0 fake members and preserves real zero states', () => {
  const overview = buildStudioStatsOverview({
    visits: 12,
    publicMembers: [],
    resources: [],
    servers: [],
    tierPlayers: [],
    threads: [],
    toolsCount: 31,
  });

  assert.equal(overview.visits, 12);
  assert.equal(overview.membersCount, 0);
  assert.equal(overview.members.length, 0);
  assert.equal(overview.ownersCount, STUDIO_OWNER_PUBLIC_SLOTS.length);
  assert.equal(overview.adminsCount, 0);
  assert.equal(overview.staffCount, STUDIO_OWNER_PUBLIC_SLOTS.length);
  assert.equal(overview.resourcesCount, 0);
  assert.equal(overview.tierPlayersCount, 0);
  assert.equal(overview.toolsCount, 31);
  assert.equal(overview.rows.length, 8);
});

test('buildStudioStatsOverview merges synced owners, tier admins, and verified members without duplicates', () => {
  const publicMembers: PublicMemberProfile[] = [
    {
      uid: 'owner-uid-1',
      displayName: 'Randelle',
      role: 'owner',
      membershipTier: 'ultimate',
      xp: 900,
    },
    {
      uid: 'admin-uid-1',
      displayName: 'KaizenStaff',
      role: 'admin',
      membershipTier: 'premium',
      xp: 350,
    },
    {
      uid: 'member-uid-1',
      displayName: 'CraftBuilder',
      role: 'member',
      membershipTier: 'free',
      xp: 120,
    },
    {
      uid: 'member-uid-2',
      displayName: 'SkyKing',
      role: 'member',
      membershipTier: 'ultimate',
      xp: 450,
    },
  ];

  const overview = buildStudioStatsOverview({
    visits: 45,
    publicMembers,
    tierAdmins: [
      { uid: 'admin-uid-1', displayName: 'KaizenStaff', grantedBy: 'owner-uid-1' },
      { uid: 'admin-uid-2', displayName: 'NetherMod', grantedBy: 'owner-uid-1' },
    ],
    resources: [],
    servers: [
      {
        id: 'srv-1',
        name: 'DonutSMP',
        address: 'donutsmp.net',
        edition: 'Java',
        version: '1.21+',
        motd: 'Live',
        gameModes: ['SMP'],
        approved: true,
        featured: true,
        votes: 10,
        submittedBy: 'owner-uid-1',
        submittedByName: 'Randelle',
      },
    ],
    liveStatusMap: {
      'srv-1': { loading: false, online: true, playersOnline: 512, playersMax: 1000 },
    },
    tierPlayers: [],
    threads: [],
    toolsCount: 31,
  });

  // 1 synced owner + 1 remaining baseline owner slot = 2 owners, plus 2 unique admins = 4 staff
  assert.equal(overview.ownersCount, 2);
  assert.equal(overview.adminsCount, 2);
  assert.equal(overview.staffCount, 4);

  // Members sorted by XP desc
  assert.equal(overview.membersCount, 2);
  assert.deepEqual(
    overview.members.map((m) => m.displayName),
    ['SkyKing', 'CraftBuilder']
  );

  // Staff sorted Owners first, then Admins alphabetically
  assert.equal(overview.staffs[0].role, 'owner');
  assert.equal(overview.staffs[1].role, 'owner');
  assert.deepEqual(
    overview.staffs.filter((s) => s.role === 'admin').map((s) => s.displayName),
    ['KaizenStaff', 'NetherMod']
  );

  assert.equal(overview.onlineServersCount, 1);
  assert.equal(overview.livePlayersOnline, 512);
});

test('sanitizePublicMemberFields enforces schema lengths and clamps XP bounds', () => {
  const longName = 'A'.repeat(120);
  const sanitized = sanitizePublicMemberFields({
    uid: 'user-123',
    displayName: longName,
    avatarUrl: 'https://mc-heads.net/avatar/Steve/64',
    role: 'member',
    membershipTier: 'premium',
    xp: 9999999,
  });

  assert.equal(sanitized.displayName.length, PUBLIC_MEMBER_LIMITS.DISPLAY_NAME_MAX);
  assert.equal(sanitized.xp, PUBLIC_MEMBER_LIMITS.MAX_XP);
  assert.equal(sanitized.role, 'member');
  assert.equal(sanitized.membershipTier, 'premium');
});
