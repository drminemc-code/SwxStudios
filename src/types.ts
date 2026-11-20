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
  | 'tiers'
  | 'ranks'
  | 'stats'
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

export type PaymentMethod = 'gcash' | 'paypal';

export type MembershipOrderPlan = 'premium' | 'ultimate' | 'package';

export type MembershipOrderStatus = 'pending' | 'approved' | 'declined';

export interface MembershipOrder {
  id: string;
  userId: string;
  buyerName: string;
  plan: MembershipOrderPlan;
  resourceId?: string;
  resourceTitle?: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  senderAccount: string;
  amountLabel: string;
  status: MembershipOrderStatus;
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteSettings {
  announcementVisible: boolean;
  announcementLabel: string;
  announcementText: string;
  communityEnabled: boolean;
  heroHeadline?: string;
  gcashNumber?: string;
  gcashName?: string;
  paypalEmail?: string;
  paypalLink?: string;
}

export interface SiteMetricsState {
  visits: number;
  updatedAt?: string;
}

export type ServerRankId =
  | 'owner'
  | 'admin'
  | 'staff'
  | 'support'
  | 'member'
  | 'ultimate'
  | 'paid'
  | 'free';

export type FriendAvailabilityStatus = 'online' | 'away' | 'offline';

export interface PublicMemberProfile {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  role: 'member' | 'admin' | 'owner';
  serverRank?: ServerRankId;
  serverRoles?: ServerRankId[];
  membershipTier: MembershipTier;
  xp: number;
  presenceStatus?: FriendAvailabilityStatus;
  joinedAt?: string;
  updatedAt?: string;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface FriendshipRecord {
  id: string;
  users: [string, string];
  requesterUid: string;
  requesterName: string;
  requesterAvatar?: string;
  recipientUid: string;
  recipientName: string;
  recipientAvatar?: string;
  status: FriendshipStatus;
  blockedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PlayerSuggestionStatus = 'pending' | 'approved' | 'declined';

export interface PlayerSuggestionRecord {
  id: string;
  ign: string;
  suggestedRank?: ServerRankId;
  suggestedMode?: string;
  note?: string;
  suggestedBy: string;
  suggestedByName: string;
  status: PlayerSuggestionStatus;
  reviewedBy?: string;
  createdAt?: string;
  updatedAt?: string;
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

export type ProbeRegionId = 'asia' | 'global' | 'na' | 'eu';

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
  probeRegion?: string;
  probeLocation?: string;
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

