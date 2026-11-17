export type CategoryId =
  | 'plugins'
  | 'configs'
  | 'setups'
  | 'models'
  | 'maps'
  | 'skripts'
  | 'clients'
  | 'bots'
  | 'source';

export type NavTab =
  | 'home'
  | 'tools'
  | 'servers'
  | 'guides'
  | 'community'
  | 'downloads'
  | 'exclusive'
  | 'levels'
  | 'admin';

export type ArchiveExtension = 'jar' | 'zip' | 'rar' | '7z' | 'gz' | 'tar';

export type SortOption = 'downloads' | 'rating' | 'newest';

export type ArtworkTheme =
  | 'lifesteal'
  | 'earth'
  | 'duels'
  | 'shop'
  | 'ender'
  | 'galactic'
  | 'beach'
  | 'reaper'
  | 'tab'
  | 'werewolf'
  | 'anticheat'
  | 'obsidian_ac'
  | 'rtp'
  | 'crates'
  | 'skyblock'
  | 'prison'
  | 'bot'
  | 'client'
  | 'source'
  | 'skript';

export type ResourceTier = 'free' | 'paid' | 'premium' | 'ultimate';

export type ResourceTierFilter = 'all' | 'free' | 'paid' | 'popular' | 'premium' | 'ultimate';

export type MembershipTier = 'free' | 'premium' | 'ultimate';

export interface ResourceUpdateEntry {
  version: string;
  date: string;
  notes: string;
}

export interface SiteSettings {
  announcementVisible: boolean;
  announcementLabel: string;
  announcementText: string;
  communityEnabled: boolean;
  heroHeadline?: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: CategoryId;
  downloads: number;
  views?: number;
  rating: number;
  ratingCount: number;
  version: string;
  mcVersions: string;
  fileSize: string;
  author: string;
  publishedAt?: string;
  updatedAt: string;
  popular?: boolean;
  exclusive?: boolean;
  tier?: ResourceTier;
  priceLabel?: string;
  openSource?: boolean;
  drmFree?: boolean;
  unobfuscated?: boolean;
  aiMarketing?: boolean;
  aiProduct?: boolean;
  resourceType?: string;
  gameModes?: string[];
  supportedSoftware?: string[];
  supportedVersions?: string[];
  supportedLanguages?: string[];
  dependencies?: string[];
  changelog?: ResourceUpdateEntry[];
  demoVideoUrl?: string;
  tags: string[];
  artwork: ArtworkTheme;
  accentColor: string;
  features: string[];
  fileName: string;
  fileExtension?: ArchiveExtension;
  downloadUrl?: string;
  createdBy?: string;
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  baseCount: number;
  description: string;
}

export interface ThreadReply {
  id: string;
  author: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface CommunityThread {
  id: string;
  title: string;
  author: string;
  role: string;
  topic: 'Plugins Help' | 'Server Setups' | 'Showcase' | 'Requests';
  body: string;
  upvotes: number;
  upvotedByMe?: boolean;
  createdAt: string;
  replies: ThreadReply[];
}

export interface LevelTier {
  level: number;
  name: string;
  minXp: number;
  perks: string;
}

export type AuthProviderId = 'google' | 'discord' | 'github' | 'microsoft' | 'twitch';

export interface ConnectedAccountInfo {
  provider: AuthProviderId;
  providerUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  connectedAt: string;
  source: 'firebase' | 'oauth' | 'firestore';
}

export interface OAuthProviderStatus {
  id: 'discord' | 'github' | 'twitch';
  label: string;
  configured: boolean;
  callbackUrl: string;
  portalUrl: string;
  envVars: string[];
}

export interface DisplayIdentity {
  isSignedIn: boolean;
  uid: string | null;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  initials: string;
  emailVerified: boolean;
  isFirebaseUser: boolean;
  primaryProvider: AuthProviderId | 'email' | null;
}

export type ServerEdition = 'Java' | 'Bedrock' | 'Crossplay';

export interface LiveServerPlayerSample {
  uuid: string;
  name: string;
}

export interface LiveServerStatus {
  loading: boolean;
  online: boolean | null;
  host?: string;
  resolvedHost?: string | null;
  ip?: string | null;
  port?: number;
  version?: string | null;
  software?: string | null;
  pingMs?: number | null;
  playersOnline: number;
  playersMax: number;
  playerSample?: LiveServerPlayerSample[];
  motdLines?: string[];
  iconBase64?: string | null;
  checkedAt?: string;
  error?: string;
}

export interface ServerTelemetrySnapshot {
  serverKey: string;
  address: string;
  tps: number | null;
  mspt: number | null;
  avgPingMs: number | null;
  playersOnline: number | null;
  playersMax: number | null;
  topPlayers: Array<{ name: string; stat: string }>;
  source: string;
  updatedAt: string;
}

export interface MinecraftServerListing {
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
  createdAt?: string;
  isBaselineLive?: boolean;
}

