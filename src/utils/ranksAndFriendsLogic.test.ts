import assert from 'node:assert/strict';
import test from 'node:test';
import type { FriendshipRecord, PublicMemberProfile } from '../types';
import {
  buildDeterministicFriendshipId,
  categorizeFriendships,
  filterMembersByDisplayName,
  getAvailabilityMeta,
  getFriendOtherParticipant,
  getSuggestedMembersToAdd,
  isValidPresenceStatus,
  PRESENCE_AWAY_WINDOW_MS,
  PRESENCE_ONLINE_WINDOW_MS,
  resolveMemberAvailability,
  resolveMemberServerRoles,
  sanitizeServerRolesList,
  searchPlayersAndMembers,
  SERVER_RANKS,
  validatePlayerSuggestionInput,
} from './ranksAndFriendsLogic';

test('SERVER_RANKS exposes all 8 requested Discord-style ranks in priority order', () => {
  const labels = SERVER_RANKS.map((r) => r.label);
  assert.deepEqual(labels, [
    'Owner Rank',
    'Admin Rank',
    'Staff Team',
    'Support Team',
    'Ultimate Member',
    'Paid Member',
    'Member',
    'Free Member',
  ]);
});

test('resolveMemberServerRoles combines auto-derived tier/staff roles and explicit serverRoles', () => {
  const freeMember: PublicMemberProfile = {
    uid: 'u1',
    displayName: 'AlexPvP',
    role: 'member',
    membershipTier: 'free',
    xp: 50,
  };
  assert.deepEqual(resolveMemberServerRoles(freeMember), {
    primaryRank: 'free',
    roles: ['member', 'free'],
  });

  const staffWithExplicit: PublicMemberProfile = {
    uid: 'u2',
    displayName: 'ModHelper',
    role: 'member',
    serverRank: 'staff',
    serverRoles: ['support', 'paid'],
    membershipTier: 'premium',
    xp: 300,
  };
  assert.deepEqual(resolveMemberServerRoles(staffWithExplicit), {
    primaryRank: 'staff',
    roles: ['staff', 'support', 'paid', 'member'],
  });

  const ownerProfile: PublicMemberProfile = {
    uid: 'u3',
    displayName: 'StudioLead',
    role: 'owner',
    membershipTier: 'ultimate',
    xp: 900,
  };
  assert.deepEqual(resolveMemberServerRoles(ownerProfile), {
    primaryRank: 'owner',
    roles: ['owner', 'ultimate', 'member'],
  });
});

test('sanitizeServerRolesList rejects unknown roles, deduplicates, and sorts by priority', () => {
  const cleaned = sanitizeServerRolesList(['free', 'hacker', 'staff', 'owner', 'staff', 'support']);
  assert.deepEqual(cleaned, ['owner', 'staff', 'support', 'free']);
});

test('buildDeterministicFriendshipId creates canonical sorted IDs and rejects self or invalid UIDs', () => {
  assert.equal(buildDeterministicFriendshipId('abc', 'abc'), null);
  assert.equal(buildDeterministicFriendshipId('', 'abc'), null);
  assert.equal(buildDeterministicFriendshipId('bad/uid', 'abc'), null);

  const pair1 = buildDeterministicFriendshipId('uid_z', 'uid_a');
  const pair2 = buildDeterministicFriendshipId('uid_a', 'uid_z');
  assert.ok(pair1);
  assert.ok(pair2);
  assert.equal(pair1.id, 'uid_a_uid_z');
  assert.equal(pair2.id, 'uid_a_uid_z');
  assert.deepEqual(pair1.users, ['uid_a', 'uid_z']);
});

test('categorizeFriendships & getSuggestedMembersToAdd separate accepted, incoming, outgoing, and non-friends', () => {
  const records: FriendshipRecord[] = [
    {
      id: 'me_u1',
      users: ['me', 'u1'],
      requesterUid: 'me',
      requesterName: 'Me',
      recipientUid: 'u1',
      recipientName: 'FriendOne',
      status: 'accepted',
    },
    {
      id: 'me_u2',
      users: ['me', 'u2'],
      requesterUid: 'u2',
      requesterName: 'IncomingTwo',
      recipientUid: 'me',
      recipientName: 'Me',
      status: 'pending',
    },
    {
      id: 'me_u3',
      users: ['me', 'u3'],
      requesterUid: 'me',
      requesterName: 'Me',
      recipientUid: 'u3',
      recipientName: 'OutgoingThree',
      status: 'pending',
    },
    {
      id: 'me_u4',
      users: ['me', 'u4'],
      requesterUid: 'u4',
      requesterName: 'DeclinedFour',
      recipientUid: 'me',
      recipientName: 'Me',
      status: 'declined',
    },
  ];

  const cat = categorizeFriendships(records, 'me');
  assert.equal(cat.friends.length, 1);
  assert.equal(cat.incomingRequests.length, 1);
  assert.equal(cat.outgoingRequests.length, 1);
  assert.equal(getFriendOtherParticipant(cat.incomingRequests[0], 'me').displayName, 'IncomingTwo');

  const members: PublicMemberProfile[] = [
    { uid: 'me', displayName: 'Me', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'u1', displayName: 'FriendOne', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'u2', displayName: 'IncomingTwo', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'u4', displayName: 'DeclinedFour', role: 'member', membershipTier: 'free', xp: 15 },
    { uid: 'u5', displayName: 'SupportFive', role: 'member', serverRank: 'support', membershipTier: 'free', xp: 5 },
  ];

  const suggested = getSuggestedMembersToAdd(members, 'me', cat.relationshipByOtherUid);
  assert.deepEqual(
    suggested.map((m) => m.uid),
    ['u5', 'u4']
  );
});

test('validatePlayerSuggestionInput & searchPlayersAndMembers handle IGN validation and live suggest prompt', () => {
  assert.equal(validatePlayerSuggestionInput({ ign: 'a' }).ok, false);
  assert.equal(validatePlayerSuggestionInput({ ign: 'bad ign!' }).ok, false);

  const valid = validatePlayerSuggestionInput({
    ign: 'TechnoBlade',
    suggestedRank: 'staff',
    suggestedMode: 'sword',
    note: 'Great duels player',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.ign, 'TechnoBlade');
    assert.equal(valid.suggestedRank, 'staff');
    assert.equal(valid.suggestedMode, 'sword');
  }

  const searchRes = searchPlayersAndMembers(
    'Notch',
    [{ uid: 'u1', displayName: 'Steve', role: 'member', membershipTier: 'free', xp: 0 }],
    [],
    []
  );
  assert.equal(searchRes.matchedMembers.length, 0);
  assert.equal(searchRes.suggestableIgn, 'Notch');

  const exactMemberMatch = searchPlayersAndMembers(
    'Steve',
    [{ uid: 'u1', displayName: 'Steve', role: 'member', membershipTier: 'free', xp: 0 }],
    [],
    []
  );
  assert.equal(exactMemberMatch.matchedMembers.length, 1);
  assert.equal(exactMemberMatch.suggestableIgn, null);
});

test('filterMembersByDisplayName filters publicMembers strictly by displayName in real time', () => {
  const members: PublicMemberProfile[] = [
    { uid: 'uid_member_1', displayName: 'Steve', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'uid_member_2', displayName: 'DreamPvP', role: 'admin', serverRank: 'admin', membershipTier: 'ultimate', xp: 200 },
    { uid: 'uid_member_3', displayName: 'AlexBuilder', role: 'member', membershipTier: 'premium', xp: 50 },
  ];

  assert.equal(filterMembersByDisplayName(members, '').length, 3);
  assert.equal(filterMembersByDisplayName(members, '   ').length, 3);

  const partialMatch = filterMembersByDisplayName(members, '  dre ');
  assert.deepEqual(partialMatch.map((m) => m.displayName), ['DreamPvP']);

  // Must NOT false-match other members via "Member" role label or UID characters
  const bobSearch = filterMembersByDisplayName(members, 'Bob');
  assert.equal(bobSearch.length, 0);

  const eSearch = filterMembersByDisplayName(members, 'e');
  assert.deepEqual(eSearch.map((m) => m.displayName), ['Steve', 'DreamPvP', 'AlexBuilder']);

  const searchResultForBob = searchPlayersAndMembers('Bob', members, [], []);
  assert.equal(searchResultForBob.matchedMembers.length, 0);
  assert.equal(searchResultForBob.suggestableIgn, 'Bob');
});

test('categorizeFriendships & getSuggestedMembersToAdd isolate blocked friendships per blocker', () => {
  const records: FriendshipRecord[] = [
    {
      id: 'me_u1',
      users: ['me', 'u1'],
      requesterUid: 'me',
      requesterName: 'Me',
      recipientUid: 'u1',
      recipientName: 'BlockedByMe',
      status: 'blocked',
      blockedBy: 'me',
    },
    {
      id: 'me_u2',
      users: ['me', 'u2'],
      requesterUid: 'u2',
      requesterName: 'BlockedMe',
      recipientUid: 'me',
      recipientName: 'Me',
      status: 'blocked',
      blockedBy: 'u2',
    },
  ];

  const cat = categorizeFriendships(records, 'me');
  assert.equal(cat.friends.length, 0);
  assert.equal(cat.incomingRequests.length, 0);
  assert.equal(cat.outgoingRequests.length, 0);
  assert.deepEqual(
    cat.blockedUsers.map((r) => r.id),
    ['me_u1']
  );

  const members: PublicMemberProfile[] = [
    { uid: 'me', displayName: 'Me', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'u1', displayName: 'BlockedByMe', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'u2', displayName: 'BlockedMe', role: 'member', membershipTier: 'free', xp: 10 },
    { uid: 'u3', displayName: 'OpenMember', role: 'member', membershipTier: 'free', xp: 10 },
  ];

  const suggested = getSuggestedMembersToAdd(members, 'me', cat.relationshipByOtherUid);
  assert.deepEqual(
    suggested.map((m) => m.uid),
    ['u3']
  );
});

test('resolveMemberAvailability & getAvailabilityMeta classify online, away, and offline friends accurately', () => {
  const now = 1_750_000_000_000;

  assert.equal(isValidPresenceStatus('online'), true);
  assert.equal(isValidPresenceStatus('away'), true);
  assert.equal(isValidPresenceStatus('offline'), true);
  assert.equal(isValidPresenceStatus('busy'), false);

  // Missing member or explicit offline -> offline
  assert.equal(resolveMemberAvailability(null, now), 'offline');
  assert.equal(
    resolveMemberAvailability(
      { presenceStatus: 'offline', updatedAt: new Date(now).toISOString() },
      now
    ),
    'offline'
  );

  // Active within online window -> online
  assert.equal(
    resolveMemberAvailability(
      { presenceStatus: 'online', updatedAt: new Date(now - 60_000).toISOString() },
      now
    ),
    'online'
  );

  // Explicit away within window -> away
  assert.equal(
    resolveMemberAvailability(
      { presenceStatus: 'away', updatedAt: new Date(now - 60_000).toISOString() },
      now
    ),
    'away'
  );

  // Stale heartbeat beyond 5 minutes -> away
  assert.equal(
    resolveMemberAvailability(
      { presenceStatus: 'online', updatedAt: new Date(now - PRESENCE_ONLINE_WINDOW_MS - 1_000).toISOString() },
      now
    ),
    'away'
  );

  // Stale heartbeat beyond 20 minutes -> offline
  assert.equal(
    resolveMemberAvailability(
      { presenceStatus: 'online', updatedAt: new Date(now - PRESENCE_AWAY_WINDOW_MS - 1_000).toISOString() },
      now
    ),
    'offline'
  );

  // Missing updatedAt falls back to explicit non-offline presence or offline
  assert.equal(resolveMemberAvailability({ presenceStatus: 'online' }, now), 'online');
  assert.equal(resolveMemberAvailability({ presenceStatus: 'away' }, now), 'away');
  assert.equal(resolveMemberAvailability({}, now), 'offline');

  assert.equal(getAvailabilityMeta('online').dotClassName, 'bg-emerald-500');
  assert.equal(getAvailabilityMeta('away').dotClassName, 'bg-amber-400');
  assert.equal(getAvailabilityMeta('offline').dotClassName, 'bg-zinc-500');
});
