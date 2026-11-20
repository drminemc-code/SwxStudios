export type TierRank =
  | 'HT1'
  | 'LT1'
  | 'HT2'
  | 'LT2'
  | 'HT3'
  | 'LT3'
  | 'HT4'
  | 'LT4'
  | 'HT5'
  | 'LT5';

export type TierModeId =
  | 'vanilla'
  | 'uhc'
  | 'pot'
  | 'nethop'
  | 'smp'
  | 'sword'
  | 'axe'
  | 'mace';

export type TierRegion = 'NA' | 'EU' | 'AS' | 'OCE' | 'SA';

export type TierRanksMap = Partial<Record<TierModeId, TierRank>>;

export interface TierPlayerRecord {
  id: string;
  ign: string;
  region: TierRegion;
  ranks: TierRanksMap;
  peakRanks?: TierRanksMap;
  points: number;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
  isSeed?: boolean;
}

export interface TierAdminRecord {
  uid: string;
  displayName: string;
  grantedBy: string;
  grantedByName?: string;
  createdAt?: string;
}

export interface TierCommandLogEntry {
  id: string;
  commandText: string;
  action: string;
  executorUid: string;
  executorName: string;
  executorRole: 'owner' | 'admin';
  summary: string;
  createdAt?: string;
}

export const TIER_RANKS: readonly TierRank[] = [
  'HT1',
  'LT1',
  'HT2',
  'LT2',
  'HT3',
  'LT3',
  'HT4',
  'LT4',
  'HT5',
  'LT5',
] as const;

export const TIER_POINT_WEIGHTS: Record<TierRank, number> = {
  HT1: 60,
  LT1: 45,
  HT2: 30,
  LT2: 20,
  HT3: 10,
  LT3: 6,
  HT4: 4,
  LT4: 3,
  HT5: 2,
  LT5: 1,
};

export interface TierModeMeta {
  id: TierModeId;
  label: string;
  shortLabel: string;
  kitHint: string;
}

export const TIER_MODES: readonly TierModeMeta[] = [
  { id: 'vanilla', label: 'Crystal', shortLabel: 'VAN', kitHint: 'End Crystal & Anchor PvP' },
  { id: 'sword', label: 'Sword', shortLabel: 'SWD', kitHint: 'Diamond / Netherite Sword' },
  { id: 'axe', label: 'Axe', shortLabel: 'AXE', kitHint: 'Shield & Axe Stun Duels' },
  { id: 'uhc', label: 'UHC', shortLabel: 'UHC', kitHint: 'Rod, Bow & Golden Heads' },
  { id: 'pot', label: 'Pot', shortLabel: 'POT', kitHint: 'Splash Potion Attrition' },
  { id: 'nethop', label: 'NethOP', shortLabel: 'NOP', kitHint: 'Netherite Overpowered Kit' },
  { id: 'smp', label: 'SMP', shortLabel: 'SMP', kitHint: 'Survival Potions & Pearls' },
  { id: 'mace', label: 'Mace', shortLabel: 'MCE', kitHint: 'Wind Charge & Breach Burst' },
] as const;

export const TIER_REGIONS: readonly TierRegion[] = ['NA', 'EU', 'AS', 'OCE', 'SA'] as const;

export const TIER_BLUEPRINT_LIMITS = {
  IGN_MIN: 2,
  IGN_MAX: 24,
  COMMAND_MAX: 240,
  SUMMARY_MAX: 200,
  DISPLAY_NAME_MAX: 80,
} as const;

export function isValidTierRank(value: string): value is TierRank {
  return (TIER_RANKS as readonly string[]).includes(value.trim().toUpperCase());
}

export function normalizeTierRank(value: string): TierRank | null {
  const upper = value.trim().toUpperCase();
  return isValidTierRank(upper) ? (upper as TierRank) : null;
}

export function normalizeTierMode(value: string): TierModeId | null {
  const clean = value.trim().toLowerCase();
  if (clean === 'crystal' || clean === 'vanilla' || clean === 'van') return 'vanilla';
  if (clean === 'sword' || clean === 'swd') return 'sword';
  if (clean === 'axe') return 'axe';
  if (clean === 'uhc') return 'uhc';
  if (clean === 'pot' || clean === 'diapot' || clean === 'nodebuff') return 'pot';
  if (clean === 'nethop' || clean === 'neth' || clean === 'nop') return 'nethop';
  if (clean === 'smp') return 'smp';
  if (clean === 'mace' || clean === 'mce') return 'mace';
  return null;
}

export function normalizeTierRegion(value: string): TierRegion | null {
  const upper = value.trim().toUpperCase();
  if (upper === 'ASIA') return 'AS';
  if ((TIER_REGIONS as readonly string[]).includes(upper)) {
    return upper as TierRegion;
  }
  return null;
}

export function isValidMinecraftIgn(ign: string): boolean {
  const trimmed = ign.trim();
  return /^[a-zA-Z0-9_]{2,16}$/.test(trimmed);
}

export function normalizeTierPlayerId(ign: string): string {
  const slug = ign
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || `player_${Date.now()}`;
}

export function compareTierRanks(a: TierRank, b: TierRank): number {
  return TIER_RANKS.indexOf(a) - TIER_RANKS.indexOf(b);
}

export function pickHigherTierRank(
  a: TierRank | undefined,
  b: TierRank | undefined
): TierRank | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareTierRanks(a, b) <= 0 ? a : b;
}

export function calculateTierPoints(ranks: TierRanksMap): number {
  let total = 0;
  for (const mode of TIER_MODES) {
    const r = ranks[mode.id];
    if (r && TIER_POINT_WEIGHTS[r]) {
      total += TIER_POINT_WEIGHTS[r];
    }
  }
  return total;
}

export interface CombatTitleInfo {
  title: string;
  tierKey: 'grandmaster' | 'master' | 'ace' | 'specialist' | 'cadet' | 'novice' | 'unranked';
  minPoints: number;
}

export function resolveCombatTitle(points: number): CombatTitleInfo {
  if (points >= 250) {
    return { title: 'Combat Grandmaster', tierKey: 'grandmaster', minPoints: 250 };
  }
  if (points >= 100) {
    return { title: 'Combat Master', tierKey: 'master', minPoints: 100 };
  }
  if (points >= 50) {
    return { title: 'Combat Ace', tierKey: 'ace', minPoints: 50 };
  }
  if (points >= 20) {
    return { title: 'Combat Specialist', tierKey: 'specialist', minPoints: 20 };
  }
  if (points >= 10) {
    return { title: 'Combat Cadet', tierKey: 'cadet', minPoints: 10 };
  }
  if (points >= 1) {
    return { title: 'Combat Novice', tierKey: 'novice', minPoints: 1 };
  }
  return { title: 'Unranked', tierKey: 'unranked', minPoints: 0 };
}

export function getTierGroupNumber(rank: TierRank): 1 | 2 | 3 | 4 | 5 {
  const n = Number(rank.slice(2));
  if (n >= 1 && n <= 5) return n as 1 | 2 | 3 | 4 | 5;
  return 5;
}

export function isHighTier(rank: TierRank): boolean {
  return rank.startsWith('HT');
}

export function sortTierLeaderboard(
  players: TierPlayerRecord[],
  options?: {
    mode?: TierModeId | 'overall';
    region?: TierRegion | 'ALL';
    query?: string;
  }
): TierPlayerRecord[] {
  const mode = options?.mode ?? 'overall';
  const region = options?.region ?? 'ALL';
  const q = (options?.query ?? '').trim().toLowerCase();

  return players
    .filter((p) => {
      if (region !== 'ALL' && p.region !== region) return false;
      if (q && !p.ign.toLowerCase().includes(q)) return false;
      if (mode !== 'overall' && !p.ranks[mode]) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (mode !== 'overall') {
        const ra = a.ranks[mode]!;
        const rb = b.ranks[mode]!;
        const rankCmp = compareTierRanks(ra, rb);
        if (rankCmp !== 0) return rankCmp;
      }
      if (b.points !== a.points) return b.points - a.points;
      return a.ign.localeCompare(b.ign);
    });
}

export function sanitizeRanksMap(raw: unknown): TierRanksMap {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const out: TierRanksMap = {};
  for (const mode of TIER_MODES) {
    const val = obj[mode.id];
    if (typeof val === 'string') {
      const rank = normalizeTierRank(val);
      if (rank) out[mode.id] = rank;
    }
  }
  return out;
}

export type ParsedTierCommand =
  | {
      type: 'set';
      ign: string;
      mode: TierModeId;
      rank: TierRank;
      region?: TierRegion;
    }
  | {
      type: 'remove';
      ign: string;
      mode: TierModeId;
    }
  | {
      type: 'peak';
      ign: string;
      mode: TierModeId;
      rank: TierRank;
    }
  | {
      type: 'region';
      ign: string;
      region: TierRegion;
    }
  | {
      type: 'delete';
      ign: string;
    }
  | {
      type: 'admin_add';
      targetUid: string;
      displayName: string;
    }
  | {
      type: 'admin_remove';
      targetUid: string;
    }
  | {
      type: 'seed';
    }
  | {
      type: 'help';
    };

export type ParseTierCommandResult =
  | { ok: true; command: ParsedTierCommand }
  | { ok: false; error: string };

export function parseTierCommand(rawInput: string): ParseTierCommandResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a command such as /tier set Marlowww vanilla HT1 NA.' };
  }

  const parts = trimmed.split(/\s+/);
  let idx = 0;
  if (parts[0].toLowerCase() === '/tier' || parts[0].toLowerCase() === 'tier') {
    idx = 1;
  } else if (parts[0].startsWith('/')) {
    const stripped = parts[0].slice(1).toLowerCase();
    parts[0] = stripped;
  }

  const sub = (parts[idx] || '').toLowerCase();
  if (!sub || sub === 'help' || sub === '?') {
    return { ok: true, command: { type: 'help' } };
  }

  if (sub === 'seed') {
    return { ok: true, command: { type: 'seed' } };
  }

  if (sub === 'set') {
    const ign = parts[idx + 1] || '';
    const modeRaw = parts[idx + 2] || '';
    const rankRaw = parts[idx + 3] || '';
    const regionRaw = parts[idx + 4];
    if (!isValidMinecraftIgn(ign)) {
      return { ok: false, error: 'Invalid IGN. Use 2–16 Minecraft characters (A-Z, 0-9, _).' };
    }
    const mode = normalizeTierMode(modeRaw);
    if (!mode) {
      return {
        ok: false,
        error: `Unknown gamemode "${modeRaw}". Valid: vanilla, sword, axe, uhc, pot, nethop, smp, mace.`,
      };
    }
    const rank = normalizeTierRank(rankRaw);
    if (!rank) {
      return {
        ok: false,
        error: `Invalid tier "${rankRaw}". Valid tiers: HT1, LT1, HT2, LT2, HT3, LT3, HT4, LT4, HT5, LT5.`,
      };
    }
    let region: TierRegion | undefined;
    if (regionRaw) {
      const normalized = normalizeTierRegion(regionRaw);
      if (!normalized) {
        return { ok: false, error: `Invalid region "${regionRaw}". Valid: NA, EU, AS, OCE, SA.` };
      }
      region = normalized;
    }
    return { ok: true, command: { type: 'set', ign, mode, rank, region } };
  }

  if (sub === 'remove' || sub === 'clear') {
    const ign = parts[idx + 1] || '';
    const modeRaw = parts[idx + 2] || '';
    if (!isValidMinecraftIgn(ign)) {
      return { ok: false, error: 'Invalid IGN. Usage: /tier remove <ign> <mode>' };
    }
    const mode = normalizeTierMode(modeRaw);
    if (!mode) {
      return { ok: false, error: `Unknown gamemode "${modeRaw}".` };
    }
    return { ok: true, command: { type: 'remove', ign, mode } };
  }

  if (sub === 'peak') {
    const ign = parts[idx + 1] || '';
    const modeRaw = parts[idx + 2] || '';
    const rankRaw = parts[idx + 3] || '';
    if (!isValidMinecraftIgn(ign)) {
      return { ok: false, error: 'Invalid IGN. Usage: /tier peak <ign> <mode> <HT1..LT5>' };
    }
    const mode = normalizeTierMode(modeRaw);
    if (!mode) {
      return { ok: false, error: `Unknown gamemode "${modeRaw}".` };
    }
    const rank = normalizeTierRank(rankRaw);
    if (!rank) {
      return { ok: false, error: `Invalid tier "${rankRaw}". Valid: HT1..LT5.` };
    }
    return { ok: true, command: { type: 'peak', ign, mode, rank } };
  }

  if (sub === 'region') {
    const ign = parts[idx + 1] || '';
    const regionRaw = parts[idx + 2] || '';
    if (!isValidMinecraftIgn(ign)) {
      return { ok: false, error: 'Invalid IGN. Usage: /tier region <ign> <NA|EU|AS|OCE|SA>' };
    }
    const region = normalizeTierRegion(regionRaw);
    if (!region) {
      return { ok: false, error: `Invalid region "${regionRaw}". Valid: NA, EU, AS, OCE, SA.` };
    }
    return { ok: true, command: { type: 'region', ign, region } };
  }

  if (sub === 'delete' || sub === 'del' || sub === 'ban') {
    const ign = parts[idx + 1] || '';
    if (!isValidMinecraftIgn(ign)) {
      return { ok: false, error: 'Invalid IGN. Usage: /tier delete <ign>' };
    }
    return { ok: true, command: { type: 'delete', ign } };
  }

  if (sub === 'admin') {
    const action = (parts[idx + 1] || '').toLowerCase();
    const targetUid = parts[idx + 2] || '';
    if (action === 'add' || action === 'grant') {
      if (!/^[a-zA-Z0-9_-]{3,128}$/.test(targetUid)) {
        return {
          ok: false,
          error: 'Provide a valid Firebase User UID. Usage: /tier admin add <uid> [name]',
        };
      }
      const displayName = parts.slice(idx + 3).join(' ').trim().slice(0, 80) || 'Tier Admin';
      return { ok: true, command: { type: 'admin_add', targetUid, displayName } };
    }
    if (action === 'remove' || action === 'revoke') {
      if (!/^[a-zA-Z0-9_-]{3,128}$/.test(targetUid)) {
        return {
          ok: false,
          error: 'Provide a valid Firebase User UID. Usage: /tier admin remove <uid>',
        };
      }
      return { ok: true, command: { type: 'admin_remove', targetUid } };
    }
    return {
      ok: false,
      error: 'Usage: /tier admin add <uid> [name] OR /tier admin remove <uid>',
    };
  }

  return {
    ok: false,
    error: `Unknown command "${sub}". Type /tier help for available commands.`,
  };
}

export function canExecuteTierCommand(
  command: ParsedTierCommand,
  role: { isOwner: boolean; isTierAdmin: boolean }
): { allowed: boolean; reason?: string } {
  if (command.type === 'help') {
    return { allowed: true };
  }
  if (command.type === 'admin_add' || command.type === 'admin_remove' || command.type === 'seed') {
    if (!role.isOwner) {
      return {
        allowed: false,
        reason: 'Owner permission required for admin roster and seed commands.',
      };
    }
    return { allowed: true };
  }
  if (!role.isOwner && !role.isTierAdmin) {
    return {
      allowed: false,
      reason: 'Verified Owner or Tier Admin permission required to modify rankings.',
    };
  }
  return { allowed: true };
}

export const TIER_COMMAND_EXAMPLES: ReadonlyArray<{
  syntax: string;
  description: string;
  ownerOnly?: boolean;
}> = [
  { syntax: '/tier set <ign> <mode> <HT1..LT5> [region]', description: 'Assign or update a player tier' },
  { syntax: '/tier remove <ign> <mode>', description: 'Remove a specific mode tier from player' },
  { syntax: '/tier peak <ign> <mode> <HT1..LT5>', description: 'Record historical peak tier badge' },
  { syntax: '/tier region <ign> <NA|EU|AS|OCE|SA>', description: 'Update player competitive region' },
  { syntax: '/tier delete <ign>', description: 'Remove player from tier leaderboard' },
  { syntax: '/tier admin add <uid> [name]', description: 'Grant Tier Admin console access', ownerOnly: true },
  { syntax: '/tier admin remove <uid>', description: 'Revoke Tier Admin console access', ownerOnly: true },
];

export const INITIAL_TIER_PLAYERS: TierPlayerRecord[] = [];
