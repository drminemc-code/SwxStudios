import {
  ArchiveExtension,
  ArtworkTheme,
  CategoryId,
  ResourceItem,
  ResourceTier,
  ResourceUpdateEntry,
} from '../types';
import { clampString } from './authLogic';

export const OWNER_EMAIL = 'randellemupas@gmail.com';
export const OWNER_EMAILS = ['randellemupas@gmail.com', 'drminemc@gmail.com'] as const;

export const ALLOWED_ARCHIVE_EXTENSIONS: ArchiveExtension[] = [
  'jar',
  'zip',
  'rar',
  '7z',
  'gz',
  'tar',
];

export const ARCHIVE_ACCEPT_ATTR = '.jar,.zip,.rar,.7z,.gz,.tar';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export const ARTWORK_OPTIONS: { value: ArtworkTheme; label: string; accent: string }[] = [
  { value: 'lifesteal', label: 'Crimson / Lifesteal Core', accent: '#e11d48' },
  { value: 'earth', label: 'Emerald / Survival Setup', accent: '#10b981' },
  { value: 'duels', label: 'Violet / Practice & Arena', accent: '#8b5cf6' },
  { value: 'shop', label: 'Amber / Economy & Crates', accent: '#f59e0b' },
  { value: 'obsidian_ac', label: 'Slate / AntiCheat Engine', accent: '#64748b' },
  { value: 'ender', label: 'Purple / 3D Boss Models', accent: '#a855f7' },
  { value: 'galactic', label: 'Indigo / HUD & UI Packs', accent: '#6366f1' },
  { value: 'skyblock', label: 'Cyan / Skyblock Core', accent: '#06b6d4' },
  { value: 'bot', label: 'Discord / Bot Integration', accent: '#5865f2' },
  { value: 'source', label: 'Blue / Java Source Code', accent: '#3b82f6' },
];

export const TIER_OPTIONS: { value: ResourceTier; label: string; summary: string }[] = [
  { value: 'free', label: 'Free', summary: 'Open download for all members' },
  { value: 'paid', label: 'Paid', summary: 'Standalone paid resource' },
  { value: 'premium', label: 'Premium', summary: 'Included in Premium & Ultimate' },
  { value: 'ultimate', label: 'Ultimate', summary: 'Top-tier Ultimate Vault release' },
];

export const SOFTWARE_OPTIONS = [
  'Bukkit',
  'Spigot',
  'Paper',
  'Purpur',
  'Folia',
  'Velocity',
  'BungeeCord',
  'Fabric',
  'Forge',
] as const;

export const RESOURCE_TYPE_OPTIONS = [
  'Plugin',
  'World',
  'Config',
  'Setup',
  'Model',
  'Skript',
  'Client',
  'Bot',
  'Source',
] as const;

export function defaultResourceTypeForCategory(category: CategoryId): string {
  switch (category) {
    case 'plugins':
      return 'Plugin';
    case 'configs':
      return 'Config';
    case 'setups':
      return 'Setup';
    case 'models':
      return 'Model';
    case 'maps':
      return 'World';
    case 'skripts':
      return 'Skript';
    case 'clients':
      return 'Client';
    case 'bots':
      return 'Bot';
    case 'source':
      return 'Source';
    default:
      return 'Plugin';
  }
}

export function isOwnerAccount(
  email: string | null | undefined,
  emailVerified: boolean
): boolean {
  if (!emailVerified || !email) return false;
  return (OWNER_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

export function extractArchiveExtension(fileName: string): ArchiveExtension | null {
  const lower = fileName.trim().toLowerCase();
  if (!lower) return null;
  if (lower.endsWith('.tar.gz')) return 'gz';
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === lower.length - 1) return null;
  const ext = lower.slice(dotIdx + 1);
  if ((ALLOWED_ARCHIVE_EXTENSIONS as string[]).includes(ext)) {
    return ext as ArchiveExtension;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function parseTagList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const clean = clampString(part, 40).toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 10) break;
  }
  return out;
}

export function parseCommaList(raw: string, maxItems = 10, maxLen = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const clean = clampString(part, maxLen);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function parseFeatureList(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const clean = clampString(line, 160);
    if (!clean) continue;
    out.push(clean);
    if (out.length >= 10) break;
  }
  return out;
}

export function parseChangelogText(
  raw: string,
  fallbackVersion: string,
  fallbackDate: string
): ResourceUpdateEntry[] {
  const entries: ResourceUpdateEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      entries.push({
        version: clampString(parts[0], 40) || fallbackVersion,
        date: clampString(parts[1], 40) || fallbackDate,
        notes: clampString(parts.slice(2).join(' | '), 240),
      });
    } else if (parts.length === 2) {
      entries.push({
        version: clampString(parts[0], 40) || fallbackVersion,
        date: fallbackDate,
        notes: clampString(parts[1], 240),
      });
    } else {
      entries.push({
        version: fallbackVersion,
        date: fallbackDate,
        notes: clampString(trimmed, 240),
      });
    }
    if (entries.length >= 20) break;
  }
  return entries;
}

export interface ResourceDraftInput {
  title: string;
  subtitle: string;
  description: string;
  category: CategoryId;
  version: string;
  mcVersions: string;
  fileSize: string;
  author: string;
  popular: boolean;
  exclusive: boolean;
  tier?: ResourceTier;
  priceLabel?: string;
  openSource?: boolean;
  drmFree?: boolean;
  unobfuscated?: boolean;
  aiMarketing?: boolean;
  aiProduct?: boolean;
  resourceType?: string;
  gameModesText?: string;
  supportedSoftware?: string[];
  supportedVersionsText?: string;
  supportedLanguagesText?: string;
  dependenciesText?: string;
  changelogText?: string;
  demoVideoUrl?: string;
  tagsText: string;
  featuresText: string;
  artwork: ArtworkTheme;
  fileName: string;
  downloadUrl: string;
}

export function validateResourceDraft(draft: ResourceDraftInput): string | null {
  const title = draft.title.trim();
  if (title.length < 2 || title.length > 100) {
    return 'Title must be between 2 and 100 characters.';
  }
  const subtitle = draft.subtitle.trim();
  if (subtitle.length < 2 || subtitle.length > 160) {
    return 'Short subtitle must be between 2 and 160 characters.';
  }
  const description = draft.description.trim();
  if (description.length < 3 || description.length > 3000) {
    return 'Description must be between 3 and 3000 characters.';
  }
  const version = draft.version.trim();
  if (!version || version.length > 40) {
    return 'Enter a package version (up to 40 characters).';
  }
  const mcVersions = draft.mcVersions.trim();
  if (!mcVersions || mcVersions.length > 60) {
    return 'Enter supported Minecraft versions (e.g. 1.20.4 - 1.21.4).';
  }
  const fileName = draft.fileName.trim();
  if (!fileName || fileName.length > 160) {
    return 'Upload an archive file (.jar, .zip, .rar, .7z, .gz, .tar).';
  }
  const ext = extractArchiveExtension(fileName);
  if (!ext) {
    return 'Unsupported file type. Allowed formats: .jar, .zip, .rar, .7z, .gz, .tar.';
  }
  if (!draft.downloadUrl.trim() || draft.downloadUrl.trim().length > 500) {
    return 'Missing uploaded file URL. Please upload a file first.';
  }
  if (draft.priceLabel && draft.priceLabel.trim().length > 24) {
    return 'Price label must be 24 characters or fewer.';
  }
  if (draft.demoVideoUrl && draft.demoVideoUrl.trim().length > 500) {
    return 'Demo video URL must be 500 characters or fewer.';
  }
  return null;
}

export function buildResourceIdFromTitle(title: string, timestamp: number = Date.now()): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${slug || 'resource'}-${timestamp}`;
}

export function buildValidatedResourceRecord(params: {
  id: string;
  draft: ResourceDraftInput;
  ownerUid: string;
  existingDownloads?: number;
  existingViews?: number;
  existingPublishedAt?: string;
  existingRating?: number;
  existingRatingCount?: number;
}): Omit<ResourceItem, 'id'> & {
  id: string;
  fileExtension: ArchiveExtension;
  downloadUrl: string;
  createdBy: string;
} {
  const { draft } = params;
  const ext = extractArchiveExtension(draft.fileName) ?? 'zip';
  const artworkOpt = ARTWORK_OPTIONS.find((a) => a.value === draft.artwork) ?? ARTWORK_OPTIONS[0];
  const tags = parseTagList(draft.tagsText);
  const features = parseFeatureList(draft.featuresText);
  const today = new Date().toISOString().slice(0, 10);
  const cleanVersion = clampString(draft.version, 40) || 'v1.0.0';
  const cleanMcVersions = clampString(draft.mcVersions, 60) || '1.21+';

  const resolvedTier: ResourceTier =
    draft.tier ?? (draft.exclusive ? 'premium' : 'free');
  const resolvedPrice =
    resolvedTier === 'paid'
      ? clampString(draft.priceLabel || '$4.99', 24) || '$4.99'
      : resolvedTier === 'ultimate'
      ? clampString(draft.priceLabel || '', 24)
      : '';
  const isExclusive =
    resolvedTier === 'premium' || resolvedTier === 'ultimate' || Boolean(draft.exclusive);

  const gameModes = parseCommaList(draft.gameModesText || '', 10, 40);
  const supportedVersions = parseCommaList(draft.supportedVersionsText || '', 12, 32);
  const supportedLanguages = parseCommaList(draft.supportedLanguagesText || '', 12, 40);
  const dependencies = parseCommaList(draft.dependenciesText || '', 15, 80);
  const supportedSoftware = (draft.supportedSoftware || [])
    .map((s) => clampString(s, 40))
    .filter(Boolean)
    .slice(0, 10);
  const changelog = parseChangelogText(draft.changelogText || '', cleanVersion, today);

  return {
    id: clampString(params.id, 128),
    title: clampString(draft.title, 100),
    subtitle: clampString(draft.subtitle, 160),
    description: clampString(draft.description, 3000),
    category: draft.category,
    downloads: params.existingDownloads ?? 0,
    views: params.existingViews ?? 0,
    rating: params.existingRating ?? 0,
    ratingCount: params.existingRatingCount ?? 0,
    version: cleanVersion,
    mcVersions: cleanMcVersions,
    fileSize: clampString(draft.fileSize, 32) || '1 KB',
    author: clampString(draft.author, 80) || 'SwxStudios',
    publishedAt: params.existingPublishedAt || today,
    updatedAt: today,
    popular: Boolean(draft.popular),
    exclusive: isExclusive,
    tier: resolvedTier,
    priceLabel: resolvedPrice,
    openSource: Boolean(draft.openSource),
    drmFree: draft.drmFree !== false,
    unobfuscated: draft.unobfuscated !== false,
    aiMarketing: Boolean(draft.aiMarketing),
    aiProduct: Boolean(draft.aiProduct),
    resourceType:
      clampString(draft.resourceType || '', 40) ||
      defaultResourceTypeForCategory(draft.category),
    gameModes: gameModes.length > 0 ? gameModes : ['Survival'],
    supportedSoftware:
      supportedSoftware.length > 0 ? supportedSoftware : ['Bukkit', 'Spigot', 'Paper', 'Purpur'],
    supportedVersions:
      supportedVersions.length > 0
        ? supportedVersions
        : cleanMcVersions.split(/[\s,-]+/).filter(Boolean).slice(0, 6),
    supportedLanguages: supportedLanguages.length > 0 ? supportedLanguages : ['English'],
    dependencies,
    changelog:
      changelog.length > 0
        ? changelog
        : [{ version: cleanVersion, date: today, notes: 'Initial release published.' }],
    demoVideoUrl: clampString(draft.demoVideoUrl || '', 500),
    tags: tags.length > 0 ? tags : [draft.category, ext],
    artwork: draft.artwork,
    accentColor: artworkOpt.accent,
    features: features.length > 0 ? features : [`Verified ${ext.toUpperCase()} package`],
    fileName: clampString(draft.fileName, 160),
    fileExtension: ext,
    downloadUrl: clampString(draft.downloadUrl, 500),
    createdBy: clampString(params.ownerUid, 128),
  };
}
