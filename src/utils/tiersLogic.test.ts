import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTierPoints,
  canExecuteTierCommand,
  compareTierRanks,
  INITIAL_TIER_PLAYERS,
  normalizeTierMode,
  normalizeTierPlayerId,
  normalizeTierRank,
  normalizeTierRegion,
  parseTierCommand,
  pickHigherTierRank,
  resolveCombatTitle,
  sortTierLeaderboard,
  type TierPlayerRecord,
} from './tiersLogic';

const SAMPLE_PLAYERS: TierPlayerRecord[] = [
  {
    id: 'player_a',
    ign: 'AlphaPvP',
    region: 'NA',
    ranks: { vanilla: 'HT1', sword: 'HT1', mace: 'HT2' },
    points: 150,
  },
  {
    id: 'player_b',
    ign: 'BetaAS',
    region: 'AS',
    ranks: { vanilla: 'HT2', mace: 'LT1' },
    points: 75,
  },
  {
    id: 'player_c',
    ign: 'GammaAS',
    region: 'AS',
    ranks: { mace: 'HT3' },
    points: 10,
  },
];

test('INITIAL_TIER_PLAYERS starts empty with zero pre-added players', () => {
  assert.equal(INITIAL_TIER_PLAYERS.length, 0);
});

test('calculateTierPoints matches MCTiers point weights across 8 modes', () => {
  assert.equal(calculateTierPoints({}), 0);
  assert.equal(calculateTierPoints({ vanilla: 'HT1' }), 60);
  assert.equal(calculateTierPoints({ vanilla: 'LT1', sword: 'HT2' }), 75);
  assert.equal(
    calculateTierPoints({
      vanilla: 'HT1',
      sword: 'HT1',
      axe: 'HT1',
      uhc: 'HT1',
      pot: 'HT2',
      nethop: 'HT1',
      smp: 'HT1',
      mace: 'HT1',
    }),
    450
  );
  assert.equal(calculateTierPoints({ mace: 'LT5', smp: 'HT5' }), 3);
});

test('resolveCombatTitle maps points to competitive titles', () => {
  assert.equal(resolveCombatTitle(260).title, 'Combat Grandmaster');
  assert.equal(resolveCombatTitle(120).title, 'Combat Master');
  assert.equal(resolveCombatTitle(55).title, 'Combat Ace');
  assert.equal(resolveCombatTitle(25).title, 'Combat Specialist');
  assert.equal(resolveCombatTitle(12).title, 'Combat Cadet');
  assert.equal(resolveCombatTitle(3).title, 'Combat Novice');
  assert.equal(resolveCombatTitle(0).title, 'Unranked');
});

test('compareTierRanks and pickHigherTierRank respect HT1 > LT1 > ... > LT5', () => {
  assert.ok(compareTierRanks('HT1', 'LT1') < 0);
  assert.ok(compareTierRanks('LT2', 'HT3') < 0);
  assert.ok(compareTierRanks('LT5', 'HT4') > 0);
  assert.equal(pickHigherTierRank('LT2', 'HT1'), 'HT1');
  assert.equal(pickHigherTierRank(undefined, 'HT3'), 'HT3');
});

test('normalizers validate modes, ranks, regions, and safe doc IDs', () => {
  assert.equal(normalizeTierMode('crystal'), 'vanilla');
  assert.equal(normalizeTierMode('MACE'), 'mace');
  assert.equal(normalizeTierMode('invalid'), null);

  assert.equal(normalizeTierRank('ht1'), 'HT1');
  assert.equal(normalizeTierRank('HT9'), null);

  assert.equal(normalizeTierRegion('asia'), 'AS');
  assert.equal(normalizeTierRegion('eu'), 'EU');
  assert.equal(normalizeTierRegion('mars'), null);

  assert.equal(normalizeTierPlayerId('  Marlowww '), 'marlowww');
  assert.match(normalizeTierPlayerId('Kaizen_PvP'), /^[a-z0-9_]+$/);
});

test('sortTierLeaderboard sorts by total points in overall and by sub-tier in mode view', () => {
  const overall = sortTierLeaderboard(SAMPLE_PLAYERS, { mode: 'overall' });
  assert.equal(overall[0].ign, 'AlphaPvP');
  assert.ok(overall[0].points >= overall[1].points);

  const mace = sortTierLeaderboard(SAMPLE_PLAYERS, { mode: 'mace', region: 'AS' });
  assert.ok(mace.every((p) => p.region === 'AS' && Boolean(p.ranks.mace)));
  assert.equal(mace[0].ign, 'BetaAS');
});

test('parseTierCommand parses slash commands and rejects malformed arguments', () => {
  const setRes = parseTierCommand('/tier set Steve crystal ht2 na');
  assert.equal(setRes.ok, true);
  if (setRes.ok && setRes.command.type === 'set') {
    assert.equal(setRes.command.ign, 'Steve');
    assert.equal(setRes.command.mode, 'vanilla');
    assert.equal(setRes.command.rank, 'HT2');
    assert.equal(setRes.command.region, 'NA');
  }

  const removeRes = parseTierCommand('/tier remove Steve mace');
  assert.equal(removeRes.ok, true);
  if (removeRes.ok) {
    assert.equal(removeRes.command.type, 'remove');
  }

  const adminRes = parseTierCommand('/tier admin add uid_abc123 TesterLead');
  assert.equal(adminRes.ok, true);
  if (adminRes.ok && adminRes.command.type === 'admin_add') {
    assert.equal(adminRes.command.targetUid, 'uid_abc123');
    assert.equal(adminRes.command.displayName, 'TesterLead');
  }

  const badIgn = parseTierCommand('/tier set !bad! sword HT1');
  assert.equal(badIgn.ok, false);

  const badTier = parseTierCommand('/tier set Steve sword HT9');
  assert.equal(badTier.ok, false);
});

test('canExecuteTierCommand enforces Owner vs Tier Admin vs Spectator RBAC', () => {
  const setCmd = parseTierCommand('/tier set Steve sword HT1');
  const adminCmd = parseTierCommand('/tier admin add uid_abc123 AdminUser');
  const seedCmd = parseTierCommand('/tier seed');
  assert.ok(setCmd.ok && adminCmd.ok && seedCmd.ok);

  assert.equal(
    canExecuteTierCommand(setCmd.command, { isOwner: false, isTierAdmin: false }).allowed,
    false
  );
  assert.equal(
    canExecuteTierCommand(setCmd.command, { isOwner: false, isTierAdmin: true }).allowed,
    true
  );
  assert.equal(
    canExecuteTierCommand(adminCmd.command, { isOwner: false, isTierAdmin: true }).allowed,
    false
  );
  assert.equal(
    canExecuteTierCommand(seedCmd.command, { isOwner: false, isTierAdmin: true }).allowed,
    false
  );
  assert.equal(
    canExecuteTierCommand(adminCmd.command, { isOwner: true, isTierAdmin: false }).allowed,
    true
  );
  assert.equal(
    canExecuteTierCommand(seedCmd.command, { isOwner: true, isTierAdmin: false }).allowed,
    true
  );
});
