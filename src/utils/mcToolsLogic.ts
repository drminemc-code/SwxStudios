import { ServerEdition } from '../types';
import { clampString } from './authLogic';

export interface McFormattedSegment {
  text: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

export const MC_COLOR_MAP: Record<string, { hex: string; name: string }> = {
  '0': { hex: '#000000', name: 'black' },
  '1': { hex: '#0000aa', name: 'dark_blue' },
  '2': { hex: '#00aa00', name: 'dark_green' },
  '3': { hex: '#00aaaa', name: 'dark_aqua' },
  '4': { hex: '#aa0000', name: 'dark_red' },
  '5': { hex: '#aa00aa', name: 'dark_purple' },
  '6': { hex: '#ffaa00', name: 'gold' },
  '7': { hex: '#aaaaaa', name: 'gray' },
  '8': { hex: '#555555', name: 'dark_gray' },
  '9': { hex: '#5555ff', name: 'blue' },
  a: { hex: '#55ff55', name: 'green' },
  b: { hex: '#55ffff', name: 'aqua' },
  c: { hex: '#ff5555', name: 'red' },
  d: { hex: '#ff55ff', name: 'light_purple' },
  e: { hex: '#ffff55', name: 'yellow' },
  f: { hex: '#ffffff', name: 'white' },
};

const NAME_TO_CODE: Record<string, string> = Object.entries(MC_COLOR_MAP).reduce(
  (acc, [code, info]) => {
    acc[info.name] = code;
    return acc;
  },
  {} as Record<string, string>
);

export function parseMinecraftFormattedSegments(input: string): McFormattedSegment[] {
  const segments: McFormattedSegment[] = [];
  let color = '#e4e4e7';
  let bold = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;
  let buf = '';

  const flush = () => {
    if (buf.length > 0) {
      segments.push({ text: buf, color, bold, italic, underline, strikethrough });
      buf = '';
    }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    // Handle &#rrggbb
    if ((ch === '&' || ch === '§') && input[i + 1] === '#' && /^[0-9a-fA-F]{6}$/.test(input.slice(i + 2, i + 8))) {
      flush();
      color = `#${input.slice(i + 2, i + 8).toLowerCase()}`;
      bold = false;
      italic = false;
      underline = false;
      strikethrough = false;
      i += 7;
      continue;
    }

    // Handle &x&r&r&g&g&b&b
    if (
      (ch === '&' || ch === '§') &&
      input[i + 1]?.toLowerCase() === 'x' &&
      /^([&§][0-9a-fA-F]){6}$/.test(input.slice(i + 2, i + 14))
    ) {
      flush();
      const hex = [3, 5, 7, 9, 11, 13].map((offset) => input[i + offset]).join('').toLowerCase();
      color = `#${hex}`;
      bold = false;
      italic = false;
      underline = false;
      strikethrough = false;
      i += 13;
      continue;
    }

    if ((ch === '&' || ch === '§') && i + 1 < input.length) {
      const code = input[i + 1].toLowerCase();
      if (MC_COLOR_MAP[code]) {
        flush();
        color = MC_COLOR_MAP[code].hex;
        bold = false;
        italic = false;
        underline = false;
        strikethrough = false;
        i++;
        continue;
      }
      if (code === 'l') {
        flush();
        bold = true;
        i++;
        continue;
      }
      if (code === 'o') {
        flush();
        italic = true;
        i++;
        continue;
      }
      if (code === 'n') {
        flush();
        underline = true;
        i++;
        continue;
      }
      if (code === 'm') {
        flush();
        strikethrough = true;
        i++;
        continue;
      }
      if (code === 'r') {
        flush();
        color = '#e4e4e7';
        bold = false;
        italic = false;
        underline = false;
        strikethrough = false;
        i++;
        continue;
      }
    }

    buf += ch;
  }

  flush();
  return segments;
}

export function normalizeMiniMessageToAmpersand(input: string): string {
  let out = input;
  for (const [name, code] of Object.entries(NAME_TO_CODE)) {
    const regex = new RegExp(`<${name}>`, 'gi');
    out = out.replace(regex, `&${code}`);
  }
  out = out
    .replace(/<#[0-9a-fA-F]{6}>/g, (m) => `&${m.slice(1, 8)}`)
    .replace(/<(bold|b)>/gi, '&l')
    .replace(/<(italic|em|i)>/gi, '&o')
    .replace(/<(underlined|u)>/gi, '&n')
    .replace(/<(strikethrough|st)>/gi, '&m')
    .replace(/<reset>/gi, '&r')
    .replace(/<\/[a-z_#0-9]+>/gi, '');
  return out;
}

export type TextConverterTarget = 'ampersand' | 'section' | 'minimessage' | 'json';

export function convertTextFormat(input: string, target: TextConverterTarget): string {
  const normalized = input.includes('<') && input.includes('>')
    ? normalizeMiniMessageToAmpersand(input)
    : input;

  if (target === 'ampersand') {
    return normalized.replace(/§([0-9a-fklmnorx#])/gi, '&$1');
  }
  if (target === 'section') {
    return normalized.replace(/&([0-9a-fklmnorx#])/gi, '§$1');
  }

  const segments = parseMinecraftFormattedSegments(normalized);
  if (target === 'minimessage') {
    return segments
      .map((seg) => {
        const matchedName = Object.values(MC_COLOR_MAP).find(
          (c) => c.hex.toLowerCase() === seg.color.toLowerCase()
        )?.name;
        const colorTag = matchedName
          ? `<${matchedName}>`
          : seg.color !== '#e4e4e7'
          ? `<${seg.color}>`
          : '';
        const styles = [
          seg.bold ? '<bold>' : '',
          seg.italic ? '<italic>' : '',
          seg.underline ? '<underlined>' : '',
          seg.strikethrough ? '<strikethrough>' : '',
        ].join('');
        return `${colorTag}${styles}${seg.text}`;
      })
      .join('');
  }

  // Raw Minecraft JSON text component
  const extra = segments.map((seg) => {
    const matchedName = Object.values(MC_COLOR_MAP).find(
      (c) => c.hex.toLowerCase() === seg.color.toLowerCase()
    )?.name;
    const node: Record<string, unknown> = { text: seg.text };
    if (matchedName) node.color = matchedName;
    else if (seg.color !== '#e4e4e7') node.color = seg.color;
    if (seg.bold) node.bold = true;
    if (seg.italic) node.italic = true;
    if (seg.underline) node.underlined = true;
    if (seg.strikethrough) node.strikethrough = true;
    return node;
  });

  if (extra.length === 0) return JSON.stringify({ text: '' }, null, 2);
  if (extra.length === 1) return JSON.stringify(extra[0], null, 2);
  return JSON.stringify({ text: '', extra }, null, 2);
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [255, 255, 255];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function generateHexGradient(
  text: string,
  startHex: string,
  endHex: string,
  format: 'ampersand' | 'legacy' | 'minimessage',
  bold = false
): { output: string; ampersandPreview: string } {
  const chars = Array.from(text);
  if (chars.length === 0) return { output: '', ampersandPreview: '' };

  if (format === 'minimessage') {
    const wrapped = `<gradient:${startHex}:${endHex}>${bold ? '<bold>' : ''}${text}${bold ? '</bold>' : ''}</gradient>`;
    // Also produce ampersand preview so live preview matches
    const [r1, g1, b1] = parseHexRgb(startHex);
    const [r2, g2, b2] = parseHexRgb(endHex);
    const preview = chars
      .map((ch, idx) => {
        if (ch === ' ') return ' ';
        const t = chars.length === 1 ? 0 : idx / (chars.length - 1);
        const hex = rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
        return `&${hex}${bold ? '&l' : ''}${ch}`;
      })
      .join('');
    return { output: wrapped, ampersandPreview: preview };
  }

  const [r1, g1, b1] = parseHexRgb(startHex);
  const [r2, g2, b2] = parseHexRgb(endHex);
  const previewParts: string[] = [];
  const outParts: string[] = [];

  chars.forEach((ch, idx) => {
    if (ch === ' ') {
      previewParts.push(' ');
      outParts.push(' ');
      return;
    }
    const t = chars.length === 1 ? 0 : idx / (chars.length - 1);
    const hex = rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
    previewParts.push(`&${hex}${bold ? '&l' : ''}${ch}`);

    if (format === 'ampersand') {
      outParts.push(`&${hex}${bold ? '&l' : ''}${ch}`);
    } else {
      const expanded = hex
        .slice(1)
        .split('')
        .map((d) => `&${d}`)
        .join('');
      outParts.push(`&x${expanded}${bold ? '&l' : ''}${ch}`);
    }
  });

  return {
    output: outParts.join(''),
    ampersandPreview: previewParts.join(''),
  };
}

export function toServerPropertiesMotd(line1: string, line2: string): string {
  const escapeLine = (raw: string) =>
    raw
      .replace(/&([0-9a-fklmnor])/gi, '\\u00A7$1')
      .replace(/§([0-9a-fklmnor])/gi, '\\u00A7$1')
      .replace(/&#([0-9a-fA-F]{6})/g, (_, h: string) =>
        `\\u00A7x${h
          .split('')
          .map((c) => `\\u00A7${c}`)
          .join('')}`
      );
  const combined = line2.trim()
    ? `${escapeLine(line1)}\\n${escapeLine(line2)}`
    : escapeLine(line1);
  return `motd=${combined}`;
}

export interface LuckPermsCommandInput {
  targetType: 'group' | 'user';
  targetName: string;
  node: string;
  value: 'true' | 'false';
  server?: string;
  world?: string;
  duration?: string;
}

export function buildLuckPermsCommand(input: LuckPermsCommandInput): string {
  const target = input.targetName.trim() || (input.targetType === 'group' ? 'default' : 'Steve');
  const node = input.node.trim() || 'essentials.spawn';
  const parts = ['lp', input.targetType, target, 'permission'];

  const dur = input.duration?.trim();
  if (dur) {
    parts.push('settemp', node, input.value, dur);
  } else {
    parts.push('set', node, input.value);
  }

  if (input.server?.trim()) parts.push(`server=${input.server.trim()}`);
  if (input.world?.trim()) parts.push(`world=${input.world.trim()}`);
  return `/${parts.join(' ')}`;
}

export function validateJsonText(raw: string): {
  valid: boolean;
  formatted: string;
  minified: string;
  error?: string;
} {
  if (!raw.trim()) {
    return { valid: false, formatted: '', minified: '', error: 'Paste JSON to format or validate.' };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      valid: true,
      formatted: JSON.stringify(parsed, null, 2),
      minified: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      valid: false,
      formatted: '',
      minified: '',
      error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}

export interface YamlValidationIssue {
  line: number;
  message: string;
}

export function validateYamlBasic(raw: string): {
  valid: boolean;
  issues: YamlValidationIssue[];
  lineCount: number;
} {
  const lines = raw.split(/\r?\n/);
  const issues: YamlValidationIssue[] = [];
  const keysByIndent = new Map<number, Set<string>>();

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (!line.trim() || line.trim().startsWith('#')) return;

    if (/^\t+/.test(line) || line.includes('\t')) {
      issues.push({
        line: lineNum,
        message: 'YAML forbids tab characters for indentation; use spaces instead.',
      });
    }

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Remove older deeper scopes when dedenting
    for (const keyIndent of Array.from(keysByIndent.keys())) {
      if (keyIndent > indent) keysByIndent.delete(keyIndent);
    }

    if (!trimmed.startsWith('-')) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1 && indent === 0) {
        issues.push({
          line: lineNum,
          message: 'Expected a "key: value" mapping or list item starting with "-".',
        });
      } else if (colonIdx > 0) {
        const keyName = trimmed.slice(0, colonIdx).trim();
        let scope = keysByIndent.get(indent);
        if (!scope) {
          scope = new Set<string>();
          keysByIndent.set(indent, scope);
        }
        if (scope.has(keyName)) {
          issues.push({
            line: lineNum,
            message: `Duplicate key "${keyName}" at indentation level ${indent}.`,
          });
        } else {
          scope.add(keyName);
        }
      }
    }

    // Simple unclosed quote check (outside comments)
    const doubleQuotes = (trimmed.match(/(?<!\\)"/g) || []).length;
    const singleQuotes = (trimmed.match(/'/g) || []).length;
    if (doubleQuotes % 2 !== 0 && !trimmed.includes('#')) {
      issues.push({ line: lineNum, message: 'Unclosed double quote (").' });
    } else if (singleQuotes % 2 !== 0 && !trimmed.includes('#') && !trimmed.includes("don't")) {
      // Allow apostrophes inside unquoted prose only if no leading single quote
      if (trimmed.includes(": '")) {
        issues.push({ line: lineNum, message: "Unclosed single quote (')." });
      }
    }
  });

  return {
    valid: issues.length === 0 && raw.trim().length > 0,
    issues,
    lineCount: lines.length,
  };
}

export function convertOverworldNether(
  x: number,
  z: number,
  from: 'overworld' | 'nether'
): { x: number; z: number } {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z) ? z : 0;
  if (from === 'overworld') {
    return { x: Math.round((safeX / 8) * 10) / 10, z: Math.round((safeZ / 8) * 10) / 10 };
  }
  return { x: Math.round(safeX * 8), z: Math.round(safeZ * 8) };
}

export function calculateShulkersAndStacks(totalItems: number, stackSize = 64): {
  total: number;
  doubleChests: number;
  shulkers: number;
  stacks: number;
  remainder: number;
} {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalItems) ? totalItems : 0));
  const safeStack = Math.max(1, Math.min(64, Math.floor(stackSize)));
  const itemsPerShulker = safeStack * 27;
  const itemsPerDoubleChest = safeStack * 54;

  const shulkers = Math.floor(safeTotal / itemsPerShulker);
  const afterShulkers = safeTotal % itemsPerShulker;
  const stacks = Math.floor(afterShulkers / safeStack);
  const remainder = afterShulkers % safeStack;
  const doubleChests = Math.round((safeTotal / itemsPerDoubleChest) * 100) / 100;

  return { total: safeTotal, doubleChests, shulkers, stacks, remainder };
}

export function xpPointsForLevel(level: number): number {
  const lvl = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
  if (lvl <= 16) return lvl * lvl + 6 * lvl;
  if (lvl <= 31) return Math.floor(2.5 * lvl * lvl - 40.5 * lvl + 360);
  return Math.floor(4.5 * lvl * lvl - 162.5 * lvl + 2220);
}

export function calculateEconomyMargin(
  buyPrice: number,
  sellPrice: number,
  taxPercent: number
): {
  netSell: number;
  profitPerItem: number;
  profitPerStack: number;
  marginPercent: number;
} {
  const buy = Math.max(0, Number.isFinite(buyPrice) ? buyPrice : 0);
  const sell = Math.max(0, Number.isFinite(sellPrice) ? sellPrice : 0);
  const tax = Math.max(0, Math.min(99, Number.isFinite(taxPercent) ? taxPercent : 0));
  const netSell = sell * (1 - tax / 100);
  const profitPerItem = netSell - buy;
  const profitPerStack = profitPerItem * 64;
  const marginPercent = buy > 0 ? (profitPerItem / buy) * 100 : sell > 0 ? 100 : 0;

  return {
    netSell: Math.round(netSell * 100) / 100,
    profitPerItem: Math.round(profitPerItem * 100) / 100,
    profitPerStack: Math.round(profitPerStack * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

export interface ServerDraftInput {
  name: string;
  address: string;
  edition: ServerEdition;
  version: string;
  motd: string;
  gameModesText: string;
  description?: string;
  bedrockAddress?: string;
  tpsText?: string;
  msptText?: string;
  pingMsText?: string;
  topPlayersText?: string;
}

export function parseTopPlayersText(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/[\n,]+/)
    .map((line) => clampString(line, 64))
    .filter(Boolean)
    .slice(0, 15);
}

export function parseTopPlayerEntry(entry: string): { name: string; stat: string } {
  const parts = entry.split(/\s*(?:\||::|—|-)\s*/);
  const name = clampString(parts[0] || entry, 24);
  const stat = clampString(parts.slice(1).join(' · '), 40);
  return { name, stat };
}

export function classifyPingHealth(pingMs: number | null | undefined): {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
} {
  if (typeof pingMs !== 'number' || !Number.isFinite(pingMs) || pingMs <= 0) {
    return { label: '—', tone: 'neutral' };
  }
  if (pingMs <= 75) return { label: `${Math.round(pingMs)} ms`, tone: 'good' };
  if (pingMs <= 160) return { label: `${Math.round(pingMs)} ms`, tone: 'warn' };
  return { label: `${Math.round(pingMs)} ms`, tone: 'bad' };
}

export function classifyTpsHealth(tps: number | null | undefined): {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
} {
  if (typeof tps !== 'number' || !Number.isFinite(tps) || tps <= 0) {
    return { label: '—', tone: 'neutral' };
  }
  if (tps >= 19) return { label: `${tps.toFixed(1)} TPS`, tone: 'good' };
  if (tps >= 16) return { label: `${tps.toFixed(1)} TPS`, tone: 'warn' };
  return { label: `${tps.toFixed(1)} TPS`, tone: 'bad' };
}

export function validateServerDraft(draft: ServerDraftInput): string | null {
  if (draft.name.trim().length < 2 || draft.name.trim().length > 80) {
    return 'Server name must be between 2 and 80 characters.';
  }
  const addr = draft.address.trim();
  if (addr.length < 3 || addr.length > 120 || /\s/.test(addr)) {
    return 'Enter a valid server address (no spaces, 3–120 characters).';
  }
  if (!draft.version.trim() || draft.version.trim().length > 40) {
    return 'Enter supported Minecraft version (e.g. 1.21.4).';
  }
  if (!draft.motd.trim() || draft.motd.trim().length > 240) {
    return 'MOTD must be between 1 and 240 characters.';
  }
  if (draft.bedrockAddress && draft.bedrockAddress.trim().length > 120) {
    return 'Bedrock address must be 120 characters or less.';
  }
  if (draft.description && draft.description.trim().length > 1500) {
    return 'Description must be 1,500 characters or less.';
  }
  if (draft.tpsText && draft.tpsText.trim()) {
    const val = Number(draft.tpsText.trim());
    if (!Number.isFinite(val) || val < 0 || val > 25) {
      return 'TPS must be between 0 and 25.';
    }
  }
  if (draft.msptText && draft.msptText.trim()) {
    const val = Number(draft.msptText.trim());
    if (!Number.isFinite(val) || val < 0 || val > 5000) {
      return 'MSPT must be between 0 and 5000 ms.';
    }
  }
  if (draft.pingMsText && draft.pingMsText.trim()) {
    const val = Number(draft.pingMsText.trim());
    if (!Number.isFinite(val) || val < 0 || val > 10000) {
      return 'Ping must be between 0 and 10000 ms.';
    }
  }
  return null;
}

export function buildServerRecord(params: {
  id: string;
  draft: ServerDraftInput;
  submittedBy: string;
  submittedByName: string;
  isOwner: boolean;
}) {
  const modes = params.draft.gameModesText
    .split(',')
    .map((m) => clampString(m, 32))
    .filter(Boolean)
    .slice(0, 8);

  const record: Record<string, unknown> = {
    id: clampString(params.id, 128),
    name: clampString(params.draft.name, 80),
    address: clampString(params.draft.address, 120),
    edition: params.draft.edition,
    version: clampString(params.draft.version, 40) || '1.21.4',
    motd: clampString(params.draft.motd, 240),
    gameModes: modes.length > 0 ? modes : ['Survival'],
    approved: params.isOwner,
    featured: false,
    votes: 0,
    submittedBy: clampString(params.submittedBy, 128),
    submittedByName: clampString(params.submittedByName, 80) || 'Member',
  };

  if (params.draft.description?.trim()) {
    record.description = clampString(params.draft.description, 1500);
  }
  if (params.draft.bedrockAddress?.trim()) {
    record.bedrockAddress = clampString(params.draft.bedrockAddress, 120);
  }
  if (params.draft.tpsText?.trim()) {
    const num = Number(params.draft.tpsText.trim());
    if (Number.isFinite(num) && num >= 0 && num <= 25) {
      record.tps = Math.round(num * 100) / 100;
    }
  }
  if (params.draft.msptText?.trim()) {
    const num = Number(params.draft.msptText.trim());
    if (Number.isFinite(num) && num >= 0 && num <= 5000) {
      record.mspt = Math.round(num * 100) / 100;
    }
  }
  if (params.draft.pingMsText?.trim()) {
    const num = Number(params.draft.pingMsText.trim());
    if (Number.isFinite(num) && num >= 0 && num <= 10000) {
      record.pingMs = Math.round(num);
    }
  }
  const topPlayers = parseTopPlayersText(params.draft.topPlayersText || '');
  if (topPlayers.length > 0) {
    record.topPlayers = topPlayers;
  }

  return record as {
    id: string;
    name: string;
    address: string;
    edition: ServerEdition;
    version: string;
    motd: string;
    description?: string;
    bedrockAddress?: string;
    tps?: number;
    mspt?: number;
    pingMs?: number;
    topPlayers?: string[];
    gameModes: string[];
    approved: boolean;
    featured: boolean;
    votes: number;
    submittedBy: string;
    submittedByName: string;
  };
}

// =========================================================================
// FULL MINEVEX-PARITY UTILITIES LOGIC
// =========================================================================

export type McCommandType = 'give' | 'summon' | 'effect' | 'title' | 'tp' | 'gamerule';

export interface McCommandBuilderInput {
  commandType: McCommandType;
  target: string;
  itemOrEntity: string;
  amountOrDuration: string;
  amplifierOrValue: string;
  coords: string;
  extraJson: string;
}

export function buildMinecraftCommand(input: McCommandBuilderInput): string {
  const target = input.target.trim() || '@p';
  switch (input.commandType) {
    case 'give': {
      const item = input.itemOrEntity.trim() || 'minecraft:diamond_sword';
      const count = Math.max(1, Math.min(64, Number(input.amountOrDuration) || 1));
      const nbt = input.extraJson.trim();
      return `/give ${target} ${item}${nbt ? nbt : ''} ${count}`;
    }
    case 'summon': {
      const entity = input.itemOrEntity.trim() || 'minecraft:zombie';
      const coords = input.coords.trim() || '~ ~ ~';
      const nbt = input.extraJson.trim();
      return nbt ? `/summon ${entity} ${coords} ${nbt}` : `/summon ${entity} ${coords}`;
    }
    case 'effect': {
      const effect = input.itemOrEntity.trim() || 'minecraft:speed';
      const sec = Math.max(1, Number(input.amountOrDuration) || 30);
      const amp = Math.max(0, Math.min(255, Number(input.amplifierOrValue) || 1));
      return `/effect give ${target} ${effect} ${sec} ${amp}`;
    }
    case 'title': {
      const slot = input.itemOrEntity.trim() || 'title';
      const text = input.extraJson.trim() || 'SwxStudios Event';
      return `/title ${target} ${slot} {"text":"${text.replace(/"/g, '\\"')}"}`;
    }
    case 'tp': {
      const coords = input.coords.trim() || '0 100 0';
      return `/tp ${target} ${coords}`;
    }
    case 'gamerule': {
      const rule = input.itemOrEntity.trim() || 'keepInventory';
      const val = input.amplifierOrValue.trim() || 'true';
      return `/gamerule ${rule} ${val}`;
    }
  }
}

export interface MalwareFinding {
  severity: 'high' | 'medium' | 'low';
  pattern: string;
  reason: string;
  matches: number;
}

export interface JarAuditResult {
  fileName: string;
  byteSize: number;
  isZipContainer: boolean;
  classEntriesCount: number;
  riskLevel: 'Clean' | 'Review Recommended' | 'High Risk';
  findings: MalwareFinding[];
}

const MALWARE_SIGNATURES: Array<{
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
}> = [
  {
    pattern: 'Runtime.getRuntime',
    severity: 'high',
    reason: 'Direct OS command execution capability (java.lang.Runtime)',
  },
  {
    pattern: 'ProcessBuilder',
    severity: 'high',
    reason: 'Spawns external system processes outside the JVM',
  },
  {
    pattern: 'discord.com/api/webhooks',
    severity: 'high',
    reason: 'Hardcoded Discord webhook URL (common token/IP exfiltration vector)',
  },
  {
    pattern: 'setOp',
    severity: 'high',
    reason: 'Programmatic OP escalation call inside plugin bytecode',
  },
  {
    pattern: 'URLClassLoader',
    severity: 'medium',
    reason: 'Dynamic remote class loading at runtime',
  },
  {
    pattern: 'Base64',
    severity: 'low',
    reason: 'Base64 encoding/decoding strings detected (verify not obfuscating payloads)',
  },
];

export function inspectJarBytesForPatterns(
  bytes: Uint8Array,
  fileName: string
): JarAuditResult {
  const isZipContainer =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05);

  const decoder = new TextDecoder('latin1');
  const rawText = decoder.decode(bytes);
  const classMatches = rawText.match(/\.class/g);
  const classEntriesCount = classMatches ? classMatches.length : 0;

  const findings: MalwareFinding[] = [];
  for (const sig of MALWARE_SIGNATURES) {
    let count = 0;
    let idx = 0;
    const hay = rawText;
    while (idx !== -1) {
      idx = hay.indexOf(sig.pattern, idx);
      if (idx !== -1) {
        count++;
        idx += sig.pattern.length;
      }
    }
    if (count > 0) {
      findings.push({
        severity: sig.severity,
        pattern: sig.pattern,
        reason: sig.reason,
        matches: count,
      });
    }
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  const hasMedium = findings.some((f) => f.severity === 'medium');

  return {
    fileName,
    byteSize: bytes.length,
    isZipContainer,
    classEntriesCount,
    riskLevel: hasHigh ? 'High Risk' : hasMedium ? 'Review Recommended' : 'Clean',
    findings,
  };
}

export interface MaterialEntryResult {
  name: string;
  count: number;
  shulkers: number;
  stacks: number;
  remainder: number;
}

export function parseMaterialList(raw: string): {
  entries: MaterialEntryResult[];
  totalItems: number;
  totalShulkers: number;
  totalDoubleChests: number;
} {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries: MaterialEntryResult[] = [];
  let totalItems = 0;

  for (const line of lines) {
    // Support "Stone Bricks: 1200", "1200 Stone Bricks", or "Stone Bricks x1200"
    let name = line;
    let count = 64;
    const colonMatch = line.match(/^(.+?)[:=]\s*(\d+)$/);
    const prefixMatch = line.match(/^(\d+)\s+(.+)$/);
    const xMatch = line.match(/^(.+?)\s+[xX](\d+)$/);
    if (colonMatch) {
      name = colonMatch[1].trim();
      count = Number(colonMatch[2]);
    } else if (prefixMatch) {
      count = Number(prefixMatch[1]);
      name = prefixMatch[2].trim();
    } else if (xMatch) {
      name = xMatch[1].trim();
      count = Number(xMatch[2]);
    }

    const safeCount = Math.max(0, Math.floor(count));
    totalItems += safeCount;
    const calc = calculateShulkersAndStacks(safeCount, 64);
    entries.push({
      name: name || 'Material',
      count: safeCount,
      shulkers: calc.shulkers,
      stacks: calc.stacks,
      remainder: calc.remainder,
    });
  }

  const totalCalc = calculateShulkersAndStacks(totalItems, 64);
  return {
    entries,
    totalItems,
    totalShulkers: Math.ceil(totalItems / (27 * 64)),
    totalDoubleChests: totalCalc.doubleChests,
  };
}

export function calculateElytraFlight(
  distanceBlocks: number,
  rocketDuration: 1 | 2 | 3
): {
  distance: number;
  flightSeconds: number;
  rocketsNeeded: number;
  speedBlocksPerSec: number;
} {
  const dist = Math.max(0, Number.isFinite(distanceBlocks) ? distanceBlocks : 0);
  const speed = 33.5; // Practical level firework elytra cruise (m/s)
  const blocksPerRocket = rocketDuration === 1 ? 55 : rocketDuration === 2 ? 95 : 135;
  const flightSeconds = Math.round((dist / speed) * 10) / 10;
  const rocketsNeeded = dist === 0 ? 0 : Math.ceil(dist / blocksPerRocket);
  return {
    distance: dist,
    flightSeconds,
    rocketsNeeded,
    speedBlocksPerSec: speed,
  };
}

export interface TravelModeResult {
  mode: string;
  speedBps: number;
  seconds: number;
  formatted: string;
}

export function formatSecondsCompact(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${rem}s`;
  const hrs = Math.floor(mins / 60);
  const remM = mins % 60;
  return `${hrs}h ${remM}m`;
}

export function calculateTravelTimes(distanceBlocks: number): TravelModeResult[] {
  const dist = Math.max(0, Number.isFinite(distanceBlocks) ? distanceBlocks : 0);
  const modes = [
    { mode: 'Walking', speedBps: 4.317 },
    { mode: 'Sprinting', speedBps: 5.612 },
    { mode: 'Sprint-Jumping', speedBps: 7.127 },
    { mode: 'Boat (Water) / Minecart', speedBps: 8.0 },
    { mode: 'Elytra (Firework Cruise)', speedBps: 33.5 },
    { mode: 'Packed Ice Boat', speedBps: 40.0 },
    { mode: 'Blue Ice Boat', speedBps: 72.7 },
    { mode: 'Nether Highway (Blue Ice 8:1)', speedBps: 581.6 },
  ];
  return modes.map((m) => {
    const seconds = dist / m.speedBps;
    return {
      mode: m.mode,
      speedBps: m.speedBps,
      seconds: Math.round(seconds * 10) / 10,
      formatted: formatSecondsCompact(seconds),
    };
  });
}

export function calculateVillagerTrade(
  baseEmeraldCost: number,
  cures: number,
  heroLevel: number,
  tradeQuantity: number
): {
  pricePerTrade: number;
  totalEmeralds: number;
  totalSaved: number;
} {
  const base = Math.max(1, Math.min(64, Math.floor(baseEmeraldCost || 1)));
  const safeCures = Math.max(0, Math.min(5, Math.floor(cures || 0)));
  const safeHero = Math.max(0, Math.min(5, Math.floor(heroLevel || 0)));
  const qty = Math.max(1, Math.floor(tradeQuantity || 1));

  // Cure reduces permanent minor_positive (-5 emeralds per major cure in modern MC; cured cap = 1)
  const afterCure = Math.max(1, base - safeCures * 5);
  const heroPct = safeHero === 0 ? 0 : 0.3 + (safeHero - 1) * 0.0625;
  const pricePerTrade = Math.max(1, Math.floor(afterCure * (1 - heroPct)));
  const totalEmeralds = pricePerTrade * qty;
  const totalSaved = Math.max(0, base * qty - totalEmeralds);

  return { pricePerTrade, totalEmeralds, totalSaved };
}

export type EnchantableGearType =
  | 'Sword'
  | 'Pickaxe'
  | 'Axe'
  | 'Bow'
  | 'Armor'
  | 'Boots'
  | 'Helmet'
  | 'Trident';

export interface EnchantOption {
  id: string;
  label: string;
  maxLevel: number;
  costPerLevel: number;
  items: EnchantableGearType[];
  exclusiveGroup?: string;
}

export const ENCHANT_CATALOG: EnchantOption[] = [
  { id: 'mending', label: 'Mending I', maxLevel: 1, costPerLevel: 2, items: ['Sword', 'Pickaxe', 'Axe', 'Bow', 'Armor', 'Boots', 'Helmet', 'Trident'], exclusiveGroup: 'bow_infinity' },
  { id: 'unbreaking', label: 'Unbreaking III', maxLevel: 3, costPerLevel: 1, items: ['Sword', 'Pickaxe', 'Axe', 'Bow', 'Armor', 'Boots', 'Helmet', 'Trident'] },
  { id: 'sharpness', label: 'Sharpness V', maxLevel: 5, costPerLevel: 1, items: ['Sword', 'Axe'], exclusiveGroup: 'damage' },
  { id: 'smite', label: 'Smite V', maxLevel: 5, costPerLevel: 1, items: ['Sword', 'Axe'], exclusiveGroup: 'damage' },
  { id: 'bane', label: 'Bane of Arthropods V', maxLevel: 5, costPerLevel: 1, items: ['Sword', 'Axe'], exclusiveGroup: 'damage' },
  { id: 'looting', label: 'Looting III', maxLevel: 3, costPerLevel: 2, items: ['Sword'] },
  { id: 'sweeping', label: 'Sweeping Edge III', maxLevel: 3, costPerLevel: 2, items: ['Sword'] },
  { id: 'efficiency', label: 'Efficiency V', maxLevel: 5, costPerLevel: 1, items: ['Pickaxe', 'Axe'] },
  { id: 'fortune', label: 'Fortune III', maxLevel: 3, costPerLevel: 2, items: ['Pickaxe', 'Axe'], exclusiveGroup: 'mining_drop' },
  { id: 'silk_touch', label: 'Silk Touch I', maxLevel: 1, costPerLevel: 4, items: ['Pickaxe', 'Axe'], exclusiveGroup: 'mining_drop' },
  { id: 'power', label: 'Power V', maxLevel: 5, costPerLevel: 1, items: ['Bow'] },
  { id: 'infinity', label: 'Infinity I', maxLevel: 1, costPerLevel: 4, items: ['Bow'], exclusiveGroup: 'bow_infinity' },
  { id: 'flame', label: 'Flame I', maxLevel: 1, costPerLevel: 2, items: ['Bow'] },
  { id: 'protection', label: 'Protection IV', maxLevel: 4, costPerLevel: 1, items: ['Armor', 'Boots', 'Helmet'], exclusiveGroup: 'armor_prot' },
  { id: 'fire_prot', label: 'Fire Protection IV', maxLevel: 4, costPerLevel: 1, items: ['Armor', 'Boots', 'Helmet'], exclusiveGroup: 'armor_prot' },
  { id: 'blast_prot', label: 'Blast Protection IV', maxLevel: 4, costPerLevel: 1, items: ['Armor', 'Boots', 'Helmet'], exclusiveGroup: 'armor_prot' },
  { id: 'feather_falling', label: 'Feather Falling IV', maxLevel: 4, costPerLevel: 1, items: ['Boots'] },
  { id: 'depth_strider', label: 'Depth Strider III', maxLevel: 3, costPerLevel: 2, items: ['Boots'], exclusiveGroup: 'boot_walk' },
  { id: 'frost_walker', label: 'Frost Walker II', maxLevel: 2, costPerLevel: 2, items: ['Boots'], exclusiveGroup: 'boot_walk' },
  { id: 'respiration', label: 'Respiration III', maxLevel: 3, costPerLevel: 2, items: ['Helmet'] },
  { id: 'aqua_affinity', label: 'Aqua Affinity I', maxLevel: 1, costPerLevel: 2, items: ['Helmet'] },
  { id: 'loyalty', label: 'Loyalty III', maxLevel: 3, costPerLevel: 1, items: ['Trident'], exclusiveGroup: 'trident_move' },
  { id: 'riptide', label: 'Riptide III', maxLevel: 3, costPerLevel: 2, items: ['Trident'], exclusiveGroup: 'trident_move' },
];

export function evaluateEnchantments(
  itemType: EnchantableGearType,
  selectedIds: string[]
): {
  conflicts: string[];
  estimatedAnvilLevels: number;
} {
  const chosen = ENCHANT_CATALOG.filter(
    (e) => e.items.includes(itemType) && selectedIds.includes(e.id)
  );
  const byGroup = new Map<string, EnchantOption[]>();
  for (const e of chosen) {
    if (!e.exclusiveGroup) continue;
    // Mending & Infinity conflict only applies on Bow
    if (e.exclusiveGroup === 'bow_infinity' && itemType !== 'Bow') continue;
    const list = byGroup.get(e.exclusiveGroup) || [];
    list.push(e);
    byGroup.set(e.exclusiveGroup, list);
  }

  const conflicts: string[] = [];
  for (const [, groupList] of byGroup.entries()) {
    if (groupList.length > 1) {
      conflicts.push(groupList.map((g) => g.label).join(' conflicts with '));
    }
  }

  let baseCost = 0;
  chosen.forEach((e, idx) => {
    baseCost += e.maxLevel * e.costPerLevel + idx;
  });

  return {
    conflicts,
    estimatedAnvilLevels: baseCost,
  };
}

export type ArmorMaterial = 'None' | 'Leather' | 'Chainmail' | 'Iron' | 'Gold' | 'Diamond' | 'Netherite';

export function calculateGearStats(params: {
  helmet: ArmorMaterial;
  chestplate: ArmorMaterial;
  leggings: ArmorMaterial;
  boots: ArmorMaterial;
  protectionLevelPerPiece: number;
}): {
  armorPoints: number;
  toughness: number;
  knockbackResistancePct: number;
  epf: number;
  damageReductionPct: number;
} {
  const pointsMap: Record<ArmorMaterial, [number, number, number, number]> = {
    None: [0, 0, 0, 0],
    Leather: [1, 3, 2, 1],
    Chainmail: [2, 5, 4, 1],
    Iron: [2, 6, 5, 2],
    Gold: [2, 5, 3, 1],
    Diamond: [3, 8, 6, 3],
    Netherite: [3, 8, 6, 3],
  };
  const armorPoints =
    pointsMap[params.helmet][0] +
    pointsMap[params.chestplate][1] +
    pointsMap[params.leggings][2] +
    pointsMap[params.boots][3];

  const pieceMats = [params.helmet, params.chestplate, params.leggings, params.boots];
  const equippedPieces = pieceMats.filter((m) => m !== 'None').length;
  const toughness = pieceMats.reduce(
    (sum, m) => sum + (m === 'Diamond' ? 2 : m === 'Netherite' ? 3 : 0),
    0
  );
  const knockbackResistancePct =
    pieceMats.filter((m) => m === 'Netherite').length * 10;

  const epf = Math.min(20, equippedPieces * Math.max(0, Math.min(4, params.protectionLevelPerPiece)));
  // Standard Minecraft base armor reduction against a 10-damage (5 heart) hit + EPF 4% per point
  const armorFactor = Math.min(20, Math.max(armorPoints / 5, armorPoints - 10 / (2 + toughness / 4)));
  const baseArmorRatio = armorFactor / 25;
  const totalRatio = 1 - (1 - baseArmorRatio) * (1 - epf * 0.04);

  return {
    armorPoints,
    toughness,
    knockbackResistancePct,
    epf,
    damageReductionPct: Math.round(totalRatio * 1000) / 10,
  };
}

export function calculateFarmingYield(
  width: number,
  length: number,
  crop: 'Wheat' | 'Carrots' | 'Potatoes' | 'Beetroot' | 'Nether Wart'
): {
  totalBlocks: number;
  waterBlocksNeeded: number;
  farmlandBlocks: number;
  expectedHarvest: number;
  boneMealForFullGrowth: number;
} {
  const w = Math.max(1, Math.min(256, Math.floor(width || 1)));
  const l = Math.max(1, Math.min(256, Math.floor(length || 1)));
  const totalBlocks = w * l;
  const waterBlocksNeeded = crop === 'Nether Wart' ? 0 : Math.ceil(w / 9) * Math.ceil(l / 9);
  const farmlandBlocks = Math.max(0, totalBlocks - waterBlocksNeeded);
  const yieldPerPlant = crop === 'Wheat' || crop === 'Beetroot' ? 1 : 2.75;
  const expectedHarvest = Math.round(farmlandBlocks * yieldPerPlant);
  const boneMealForFullGrowth = crop === 'Nether Wart' ? 0 : farmlandBlocks * 3;
  return {
    totalBlocks,
    waterBlocksNeeded,
    farmlandBlocks,
    expectedHarvest,
    boneMealForFullGrowth,
  };
}

export function calculateMobFarmYield(params: {
  killsPerHour: number;
  baseDropPerKill: number;
  lootingLevel: 0 | 1 | 2 | 3;
  xpPerKill: number;
  sessionHours: number;
}): {
  itemsPerHour: number;
  totalItems: number;
  totalXp: number;
  shulkersNeeded: number;
} {
  const kph = Math.max(0, params.killsPerHour || 0);
  const drop = Math.max(0, params.baseDropPerKill || 0);
  const lootMultiplier = 1 + params.lootingLevel * 0.5;
  const hrs = Math.max(0, params.sessionHours || 0);

  const itemsPerHour = Math.round(kph * drop * lootMultiplier);
  const totalItems = Math.round(itemsPerHour * hrs);
  const totalXp = Math.round(kph * (params.xpPerKill || 0) * hrs);
  const shulkersNeeded = Math.ceil(totalItems / (27 * 64));

  return { itemsPerHour, totalItems, totalXp, shulkersNeeded };
}

export interface SparkAnalysisResult {
  tpsOneMin: number | null;
  msptMean: number | null;
  memoryUsedPct: number | null;
  severity: 'Healthy' | 'Warning' | 'Critical';
  recommendations: string[];
}

export function analyzeSparkReport(rawText: string): SparkAnalysisResult {
  const text = rawText.trim();
  const tpsMatch = text.match(/TPS[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
  const msptMatch = text.match(/MSPT[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
  const memMatch = text.match(/(\d+(?:\.\d+)?)%\s*(?:memory|ram|heap|used)/i);

  const tps = tpsMatch ? Number(tpsMatch[1]) : null;
  const mspt = msptMatch ? Number(msptMatch[1]) : null;
  const memPct = memMatch ? Number(memMatch[1]) : null;

  const recs: string[] = [];
  if (tps !== null && tps < 18.0) {
    recs.push('TPS is below 18.0 — inspect tick-duration plugins, redstone clocks, and hopper checks.');
  } else if (tps !== null && tps < 19.5) {
    recs.push('Minor TPS dip detected — consider tightening entity activation ranges in spigot.yml.');
  }
  if (mspt !== null && mspt > 50) {
    recs.push(`Mean MSPT (${mspt}ms) exceeds the 50ms budget per tick — reduce view-distance or simulation-distance.`);
  }
  if (memPct !== null && memPct > 85) {
    recs.push(`Heap memory at ${memPct}% — verify Aikar/G1GC flags and inspect plugins with large caches.`);
  }
  if (/hopper|tileentity/i.test(text)) {
    recs.push('Hopper / TileEntity tick load detected — enable hopper.disable-move-event in paper-world.yml.');
  }
  if (/entity|villager|mob/i.test(text)) {
    recs.push('High entity tick overhead — enable DAB (Dynamic Activation of Brain) in Purpur/Paper.');
  }
  if (recs.length === 0 && text.length > 0) {
    recs.push('Server tick profile looks healthy. Keep monitoring MSPT spikes during peak player count.');
  }

  const severity: SparkAnalysisResult['severity'] =
    (tps !== null && tps < 17) || (mspt !== null && mspt > 50)
      ? 'Critical'
      : (tps !== null && tps < 19.4) || (memPct !== null && memPct > 85)
      ? 'Warning'
      : 'Healthy';

  return {
    tpsOneMin: tps,
    msptMean: mspt,
    memoryUsedPct: memPct,
    severity,
    recommendations: recs,
  };
}

export function buildTabAnimationsYaml(
  animationName: string,
  intervalMs: number,
  framesText: string
): string {
  const cleanName = animationName.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'swx_header';
  const safeInterval = Math.max(50, Math.min(10000, Math.floor(intervalMs || 250)));
  const frames = framesText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const effectiveFrames = frames.length > 0 ? frames : ['&f&lSWXSTUDIOS', '&b&lSWXSTUDIOS'];
  const yamlFrames = effectiveFrames
    .map((f) => `    - "${f.replace(/"/g, '\\"')}"`)
    .join('\n');

  return `${cleanName}:\n  change-interval: ${safeInterval}\n  texts:\n${yamlFrames}`;
}

export interface PotionRecipeEntry {
  name: string;
  base: string;
  ingredient: string;
  effect: string;
  baseDuration: string;
  redstoneDuration: string;
  glowstoneTier: string;
  category: 'Positive' | 'Negative' | 'Utility';
}

export const POTION_RECIPES: PotionRecipeEntry[] = [
  { name: 'Speed', base: 'Awkward Potion', ingredient: 'Sugar', effect: '+20% speed (+40% II)', baseDuration: '3:00', redstoneDuration: '8:00', glowstoneTier: 'Speed II (1:30)', category: 'Positive' },
  { name: 'Strength', base: 'Awkward Potion', ingredient: 'Blaze Powder', effect: '+3 melee dmg (+6 II)', baseDuration: '3:00', redstoneDuration: '8:00', glowstoneTier: 'Strength II (1:30)', category: 'Positive' },
  { name: 'Regeneration', base: 'Awkward Potion', ingredient: 'Ghast Tear', effect: 'Heals HP over time', baseDuration: '0:45', redstoneDuration: '1:30', glowstoneTier: 'Regen II (0:22)', category: 'Positive' },
  { name: 'Healing', base: 'Awkward Potion', ingredient: 'Glistering Melon', effect: 'Instant +4 HP (+8 II)', baseDuration: 'Instant', redstoneDuration: 'N/A', glowstoneTier: 'Instant Health II', category: 'Positive' },
  { name: 'Fire Resistance', base: 'Awkward Potion', ingredient: 'Magma Cream', effect: 'Immunity to fire & lava', baseDuration: '3:00', redstoneDuration: '8:00', glowstoneTier: 'N/A', category: 'Positive' },
  { name: 'Night Vision', base: 'Awkward Potion', ingredient: 'Golden Carrot', effect: 'Bright underwater & cave vision', baseDuration: '3:00', redstoneDuration: '8:00', glowstoneTier: 'N/A', category: 'Utility' },
  { name: 'Invisibility', base: 'Night Vision', ingredient: 'Fermented Spider Eye', effect: 'Hides player model', baseDuration: '3:00', redstoneDuration: '8:00', glowstoneTier: 'N/A', category: 'Utility' },
  { name: 'Water Breathing', base: 'Awkward Potion', ingredient: 'Pufferfish', effect: 'No oxygen loss underwater', baseDuration: '3:00', redstoneDuration: '8:00', glowstoneTier: 'N/A', category: 'Utility' },
  { name: 'Slow Falling', base: 'Awkward Potion', ingredient: 'Phantom Membrane', effect: 'Zero fall damage & glide', baseDuration: '1:30', redstoneDuration: '4:00', glowstoneTier: 'N/A', category: 'Utility' },
  { name: 'Turtle Master', base: 'Awkward Potion', ingredient: 'Turtle Shell', effect: 'Resistance III/IV + Slowness', baseDuration: '0:20', redstoneDuration: '0:40', glowstoneTier: 'Resistance IV (0:20)', category: 'Positive' },
  { name: 'Weakness', base: 'Water Bottle', ingredient: 'Fermented Spider Eye', effect: '-4 melee dmg (used to cure villagers)', baseDuration: '1:30', redstoneDuration: '4:00', glowstoneTier: 'N/A', category: 'Negative' },
  { name: 'Poison', base: 'Awkward Potion', ingredient: 'Spider Eye', effect: 'Drains HP to 1/2 heart', baseDuration: '0:45', redstoneDuration: '1:30', glowstoneTier: 'Poison II (0:21)', category: 'Negative' },
];

export function seedToNumber(seedInput: string): bigint {
  const trimmed = seedInput.trim();
  if (/^-?\d+$/.test(trimmed)) {
    try {
      return BigInt(trimmed);
    } catch {
      // Fall through to Java hashCode
    }
  }
  // Exact Java String.hashCode() for non-numeric world seeds
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (Math.imul(31, hash) + trimmed.charCodeAt(i)) | 0;
  }
  return BigInt(hash);
}

// Authentic Java Edition Slime Chunk formula via BigInt LCG
export function isSlimeChunk(seed: bigint, chunkX: number, chunkZ: number): boolean {
  const x = BigInt(chunkX);
  const z = BigInt(chunkZ);
  const mixed =
    seed +
    BigInt.asIntN(32, x * x * 0x4c1906n) +
    BigInt.asIntN(32, x * 0x5ac0dbn) +
    BigInt.asIntN(32, z * z) * 0x4307a7n +
    BigInt.asIntN(32, z * 0x5f24fn);
  const rnd = (mixed ^ 0x5deece66dn) & ((1n << 48n) - 1n);
  const next = (rnd * 0x5deece66dn + 0xbn) & ((1n << 48n) - 1n);
  const bits = Number((next >> 17n) & 0x7fffffffn);
  return bits % 10 === 0;
}

export function sampleBiomeAtChunk(
  seed: bigint,
  chunkX: number,
  chunkZ: number
): { name: string; color: string; isVillageCandidate: boolean } {
  const s = Number(BigInt.asIntN(32, seed)) * 0.000137;
  const temp =
    Math.sin(chunkX * 0.14 + s) * 0.55 +
    Math.cos(chunkZ * 0.12 - s * 1.3) * 0.45;
  const moist =
    Math.cos(chunkX * 0.11 - s * 0.7) * 0.55 +
    Math.sin(chunkZ * 0.15 + s * 1.1) * 0.45;

  const isVillageCandidate =
    Math.abs((chunkX * 73856093) ^ (chunkZ * 19349663) ^ Number(BigInt.asIntN(32, seed))) % 29 === 0;

  if (temp < -0.45) return { name: 'Snowy Taiga', color: '#cbd5e1', isVillageCandidate: false };
  if (moist < -0.55) return { name: 'Ocean', color: '#1d4ed8', isVillageCandidate: false };
  if (temp > 0.48 && moist < 0.05) return { name: 'Desert', color: '#d97706', isVillageCandidate };
  if (temp > 0.35 && moist >= 0.05) return { name: 'Jungle', color: '#15803d', isVillageCandidate: false };
  if (moist > 0.45) return { name: 'Dark Forest', color: '#166534', isVillageCandidate: false };
  if (temp < -0.1) return { name: 'Mountains / Windswept', color: '#64748b', isVillageCandidate: false };
  return { name: 'Plains / Forest', color: '#4d7c0f', isVillageCandidate };
}

export type FancyFontStyleId =
  | 'small-caps'
  | 'bold-sans'
  | 'italic-serif'
  | 'bold-italic'
  | 'double-struck'
  | 'script'
  | 'monospace'
  | 'circled'
  | 'fullwidth'
  | 'gothic';

export interface FancyFontStyleMeta {
  id: FancyFontStyleId;
  label: string;
  sample: string;
  description: string;
}

export const FANCY_FONT_STYLES: FancyFontStyleMeta[] = [
  { id: 'small-caps', label: 'Small Caps', sample: 'ꜱᴡxꜱᴛᴜᴅɪᴏꜱ', description: 'Clean server MOTD, TAB & rank prefix style' },
  { id: 'bold-sans', label: 'Bold Sans', sample: '𝐒𝐰𝐱𝐒𝐭𝐮𝐝𝐢𝐨𝐬', description: 'Heavy high-contrast chat & announcement text' },
  { id: 'italic-serif', label: 'Italic Serif', sample: '𝑆𝑤𝑥𝑆𝑡𝑢𝑑𝑖𝑜𝑠', description: 'Classic editorial item lore & book styling' },
  { id: 'bold-italic', label: 'Bold Italic', sample: '𝑺𝒘𝒙𝑺𝒕𝒖𝒅𝒊𝒐𝒔', description: 'Dynamic event & crate reward titles' },
  { id: 'double-struck', label: 'Double-Struck', sample: '𝕊𝕨𝕩𝕊𝕥𝕦𝕕𝕚𝕠𝕤', description: 'Geometric hollow-stroke prestige tag font' },
  { id: 'script', label: 'Script / Cursive', sample: '𝓢𝔀𝔁𝓢𝓽𝓾𝓭𝓲𝓸𝓼', description: 'Ornate custom boss & relic item lore font' },
  { id: 'monospace', label: 'Typewriter Mono', sample: '𝚂𝚠𝚡𝚂𝚝𝚞𝚍𝚒𝚘𝚜', description: 'Fixed-width scoreboard & developer aesthetic' },
  { id: 'circled', label: 'Circled Badges', sample: 'ⓈⓦⓧⓈⓣⓤⓓⓘⓞⓢ', description: 'Distinct badge lettering for chat & holograms' },
  { id: 'fullwidth', label: 'Wide Aesthetic', sample: 'ＳｗｘＳｔｕｄｉｏｓ', description: 'Fullwidth CJK-spaced server banner typography' },
  { id: 'gothic', label: 'Gothic Fraktur', sample: '𝕾𝖜𝖝𝕾𝖙𝖚𝖉𝖎𝖔𝖘', description: 'Medieval RPG, dungeon & faction guild titles' },
];

const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

function mapCodePointRange(
  char: string,
  upperStart: number,
  lowerStart: number,
  digitStart?: number,
  overrides?: Record<string, string>
): string {
  if (overrides && overrides[char]) return overrides[char];
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return String.fromCodePoint(upperStart + (code - 65));
  }
  if (code >= 97 && code <= 122) {
    return String.fromCodePoint(lowerStart + (code - 97));
  }
  if (digitStart !== undefined && code >= 48 && code <= 57) {
    return String.fromCodePoint(digitStart + (code - 48));
  }
  return char;
}

const CIRCLED_DIGITS = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

export function convertFancyTextFont(input: string, style: FancyFontStyleId): string {
  if (!input) return '';
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    // Preserve Minecraft formatting tokens (&c, §l, &#rrggbb) intact
    if ((ch === '&' || ch === '§') && i + 1 < input.length) {
      if (input[i + 1] === '#' && /^#[0-9a-fA-F]{6}/.test(input.slice(i + 1, i + 8))) {
        out += input.slice(i, i + 8);
        i += 7;
        continue;
      }
      if (/^[0-9a-fklmnorxA-FKLMNORX]$/.test(input[i + 1])) {
        out += input.slice(i, i + 2);
        i += 1;
        continue;
      }
    }

    switch (style) {
      case 'small-caps': {
        out += SMALL_CAPS_MAP[ch.toLowerCase()] ?? ch;
        break;
      }
      case 'bold-sans':
        out += mapCodePointRange(ch, 0x1d400, 0x1d41a, 0x1d7ce);
        break;
      case 'italic-serif':
        out += mapCodePointRange(ch, 0x1d434, 0x1d44e, undefined, { h: 'ℎ' });
        break;
      case 'bold-italic':
        out += mapCodePointRange(ch, 0x1d468, 0x1d482);
        break;
      case 'double-struck':
        out += mapCodePointRange(ch, 0x1d538, 0x1d552, 0x1d7d8, {
          C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ',
        });
        break;
      case 'script':
        out += mapCodePointRange(ch, 0x1d4d0, 0x1d4ea);
        break;
      case 'monospace':
        out += mapCodePointRange(ch, 0x1d670, 0x1d68a, 0x1d7f6);
        break;
      case 'circled':
        if (ch >= '0' && ch <= '9') {
          out += CIRCLED_DIGITS[Number(ch)];
        } else {
          out += mapCodePointRange(ch, 0x24b6, 0x24d0);
        }
        break;
      case 'fullwidth':
        if (ch === ' ') {
          out += ' ';
        } else if (ch.charCodeAt(0) >= 33 && ch.charCodeAt(0) <= 126) {
          out += String.fromCodePoint(ch.charCodeAt(0) + 0xfee0);
        } else {
          out += ch;
        }
        break;
      case 'gothic':
        out += mapCodePointRange(ch, 0x1d56c, 0x1d586);
        break;
    }
  }
  return out;
}

