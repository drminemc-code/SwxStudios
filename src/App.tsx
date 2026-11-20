import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  linkWithPopup,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  unlink,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AccountModal } from './components/AccountModal';
import { AdminPanelView } from './components/AdminPanelView';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { AuthModal } from './components/AuthModal';
import { BotVerifyGate } from './components/BotVerifyWidget';
import { CommandSearchModal } from './components/CommandSearchModal';
import { CommunityView } from './components/CommunityView';
import { DownloadsView } from './components/DownloadsView';
import { ExclusiveView } from './components/ExclusiveView';
import { Footer } from './components/Footer';
import { GuidesView } from './components/GuidesView';
import { HeroSection } from './components/HeroSection';
import { LevelsView } from './components/LevelsView';
import { Navbar, WorkspaceSidebar } from './components/Navbar';
import { PremiumModal } from './components/PremiumModal';
import { RanksAndFriendsView } from './components/RanksAndFriendsView';
import { ResourceCard } from './components/ResourceCard';
import { ResourceModal } from './components/ResourceModal';
import { ServersView } from './components/ServersView';
import { SiteStatsHomeStrip, SiteStatsView } from './components/SiteStatsView';
import { SponsorModal } from './components/SponsorModal';
import { TiersView } from './components/TiersView';
import { TOOL_DIRECTORY, ToolsView, type ToolId } from './components/ToolsView';
import { CATEGORIES, INITIAL_RESOURCES, INITIAL_THREADS } from './data/catalog';
import { BASELINE_LIVE_SERVERS } from './data/liveServers';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  mapFirebaseAuthError,
  microsoftProvider,
  OperationType,
  testFirestoreConnection,
} from './lib/firebase';
import {
  ArchiveExtension,
  AuthProviderId,
  CategoryId,
  CommunityThread,
  ConnectedAccountInfo,
  FriendshipRecord,
  LiveServerStatus,
  MembershipOrder,
  MembershipOrderPlan,
  MembershipTier,
  MinecraftServerListing,
  NavTab,
  OAuthProviderStatus,
  PaymentMethod,
  PlayerSuggestionRecord,
  ProbeRegionId,
  PublicMemberProfile,
  ResourceItem,
  ResourceTierFilter,
  ServerRankId,
  ServerTelemetrySnapshot,
  SiteSettings,
} from './types';
import {
  buildResourceIdFromTitle,
  buildValidatedResourceRecord,
  isOwnerAccount,
  type ResourceDraftInput,
} from './utils/adminLogic';
import {
  BLUEPRINT_LIMITS,
  clampString,
  isValidFirestoreId,
  mergeConnectedAccounts,
  resolveDisplayIdentity,
} from './utils/authLogic';
import { generateRayId } from './utils/botVerifyLogic';
import {
  applyUserRating,
  buildResourceManifest,
  canAccessResource,
  countByCategory,
  countByTier,
  filterResources,
  getEffectiveResourceTier,
  pickRandomResource,
} from './utils/catalogLogic';
import {
  buildServerRecord,
  filterActiveServerListings,
  resolveProbeRegionInfo,
  type ServerDraftInput,
} from './utils/mcToolsLogic';
import {
  buildMembershipOrderId,
  buildMembershipOrderRecord,
  canSelfSwitchTier,
  PAYMENT_BLUEPRINT_LIMITS,
  resolveApprovedTierUpdate,
  validateMembershipOrderInput,
} from './utils/paymentLogic';
import {
  calculateTierPoints,
  canExecuteTierCommand,
  normalizeTierPlayerId,
  normalizeTierRegion,
  parseTierCommand,
  pickHigherTierRank,
  sanitizeRanksMap,
  TIER_BLUEPRINT_LIMITS,
  type TierAdminRecord,
  type TierCommandLogEntry,
  type TierModeId,
  type TierPlayerRecord,
  type TierRank,
  type TierRanksMap,
  type TierRegion,
} from './utils/tiersLogic';
import {
  buildStudioStatsOverview,
  sanitizePublicMemberFields,
} from './utils/siteStatsLogic';
import {
  buildDeterministicFriendshipId,
  categorizeFriendships,
  isValidServerRankId,
  RANKS_FRIENDS_LIMITS,
  sanitizeServerRolesList,
  validatePlayerSuggestionInput,
} from './utils/ranksAndFriendsLogic';

const STORAGE_KEY = 'swxstudios_state_v2';

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  announcementVisible: true,
  announcementLabel: 'Premium & Ultimate',
  announcementText:
    'Free, Paid, Popular, Premium, and Ultimate releases verified for Minecraft servers.',
  communityEnabled: true,
  heroHeadline: '',
  gcashNumber: '',
  gcashName: 'SwxStudios Owner',
  paypalEmail: 'randellemupas@gmail.com',
  paypalLink: '',
};

interface PersistedState {
  resources: ResourceItem[];
  threads: CommunityThread[];
  downloadedIds: string[];
  bookmarkedIds: string[];
  purchasedIds: string[];
  isPremium: boolean;
  membershipTier: MembershipTier;
  xp: number;
  threadsCreatedCount: number;
  bannerDismissed: boolean;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (Array.isArray(parsed.resources)) {
        return {
          resources: parsed.resources,
          threads: Array.isArray(parsed.threads) ? parsed.threads : INITIAL_THREADS,
          downloadedIds: Array.isArray(parsed.downloadedIds) ? parsed.downloadedIds : [],
          bookmarkedIds: Array.isArray(parsed.bookmarkedIds) ? parsed.bookmarkedIds : [],
          purchasedIds: [],
          isPremium: false,
          membershipTier: 'free',
          xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
          threadsCreatedCount:
            typeof parsed.threadsCreatedCount === 'number' ? parsed.threadsCreatedCount : 0,
          bannerDismissed: Boolean(parsed.bannerDismissed),
        };
      }
    }
  } catch {
    // Fallback to clean seed data if storage is unavailable
  }
  return {
    resources: INITIAL_RESOURCES,
    threads: INITIAL_THREADS,
    downloadedIds: [],
    bookmarkedIds: [],
    purchasedIds: [],
    isPremium: false,
    membershipTier: 'free',
    xp: 0,
    threadsCreatedCount: 0,
    bannerDismissed: false,
  };
}

interface OAuthSessionResponse {
  primaryProvider: 'discord' | 'github' | 'twitch' | null;
  primaryProfile: ConnectedAccountInfo | null;
  connections: Partial<Record<'discord' | 'github' | 'twitch', ConnectedAccountInfo>>;
}

export default function App() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hash === '#admin' ||
        new URLSearchParams(window.location.search).get('admin') === '1'
      ) {
        return 'admin';
      }
    }
    return 'home';
  });

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#admin') {
        setActiveTab('admin');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Home Hero Search & Category Filter
  const [heroQuery, setHeroQuery] = useState('');
  const [heroCategory, setHeroCategory] = useState<CategoryId | 'all'>('all');
  const [heroTier, setHeroTier] = useState<ResourceTierFilter>('all');
  const [activeToolId, setActiveToolId] = useState<ToolId>('motd');
  const [toolsViewMode, setToolsViewMode] = useState<'grid' | 'workbench'>('grid');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Modals
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [pendingPurchaseResource, setPendingPurchaseResource] = useState<ResourceItem | null>(null);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // Cloudflare-style Turnstile bot verification checkpoint
  const [botVerifyStatus, setBotVerifyStatus] = useState<'checking' | 'required' | 'verified'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'verified';
    }
    return 'checking';
  });
  const [verifyRayId, setVerifyRayId] = useState<string>(() => generateRayId('swx'));

  // Firebase Auth + 3P OAuth state
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [, setAuthVersion] = useState(0);
  const [oauthStatuses, setOauthStatuses] = useState<
    Partial<Record<'discord' | 'github' | 'twitch', OAuthProviderStatus>>
  >({});
  const [oauthConnections, setOauthConnections] = useState<
    Partial<Record<'discord' | 'github' | 'twitch', ConnectedAccountInfo>>
  >({});
  const [primaryOAuthProfile, setPrimaryOAuthProfile] = useState<ConnectedAccountInfo | null>(null);
  const [preferredMcAvatarUrl, setPreferredMcAvatarUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem('swx_preferred_mc_avatar');
    } catch {
      return null;
    }
  });
  const [firestoreConnections, setFirestoreConnections] = useState<
    Partial<Record<AuthProviderId, ConnectedAccountInfo>>
  >({});
  const [cloudThreads, setCloudThreads] = useState<CommunityThread[]>([]);
  const [cloudResources, setCloudResources] = useState<ResourceItem[]>([]);
  const [cloudServers, setCloudServers] = useState<MinecraftServerListing[]>([]);
  const [membershipOrders, setMembershipOrders] = useState<MembershipOrder[]>([]);
  const [cloudTierPlayers, setCloudTierPlayers] = useState<TierPlayerRecord[]>([]);
  const [tierAdmins, setTierAdmins] = useState<TierAdminRecord[]>([]);
  const [selfIsTierAdmin, setSelfIsTierAdmin] = useState(false);
  const [tierCommandLogs, setTierCommandLogs] = useState<TierCommandLogEntry[]>([]);
  const [siteVisits, setSiteVisits] = useState<number>(0);
  const [metricsSynced, setMetricsSynced] = useState(false);
  const [publicMembers, setPublicMembers] = useState<PublicMemberProfile[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [playerSuggestions, setPlayerSuggestions] = useState<PlayerSuggestionRecord[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [probeRegion, setProbeRegion] = useState<ProbeRegionId>('asia');
  const [liveStatusMap, setLiveStatusMap] = useState<Record<string, LiveServerStatus>>({});
  const [telemetryMap, setTelemetryMap] = useState<Record<string, ServerTelemetrySnapshot>>({});
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const liveInFlightRef = useRef<Set<string>>(new Set());
  const homePingTriggeredRef = useRef<Set<string>>(new Set());

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const oauthResolverRef = useRef<((res: { ok: boolean; error?: string }) => void) | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  const fetchOAuthSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as OAuthSessionResponse;
      const nextConns: Partial<Record<'discord' | 'github' | 'twitch', ConnectedAccountInfo>> = {};
      for (const [k, v] of Object.entries(data.connections || {})) {
        if (v) {
          nextConns[k as 'discord' | 'github' | 'twitch'] = {
            ...v,
            source: 'oauth',
          };
        }
      }
      setOauthConnections(nextConns);
      setPrimaryOAuthProfile(
        data.primaryProfile ? { ...data.primaryProfile, source: 'oauth' } : null
      );
    } catch {
      // Ignore transient session fetch failure
    }
  }, []);

  const syncConnectionToFirestore = useCallback(
    async (user: FirebaseUser, info: ConnectedAccountInfo) => {
      if (!user.emailVerified || !isValidFirestoreId(user.uid) || !isValidFirestoreId(info.provider)) {
        return;
      }
      const path = `users/${user.uid}/connections/${info.provider}`;
      try {
        const payload: Record<string, unknown> = {
          uid: user.uid,
          provider: info.provider,
          providerUserId: clampString(info.providerUserId, BLUEPRINT_LIMITS.ID_MAX) || info.provider,
          username: clampString(info.username, BLUEPRINT_LIMITS.USERNAME_MAX) || info.provider,
          connectedAt: serverTimestamp(),
        };
        if (info.displayName) {
          payload.displayName = clampString(info.displayName, BLUEPRINT_LIMITS.USERNAME_MAX);
        }
        if (info.avatarUrl) {
          payload.avatarUrl = clampString(info.avatarUrl, BLUEPRINT_LIMITS.URL_MAX);
        }
        if (info.profileUrl) {
          payload.profileUrl = clampString(info.profileUrl, BLUEPRINT_LIMITS.URL_MAX);
        }
        await setDoc(doc(db, 'users', user.uid, 'connections', info.provider), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    []
  );

  // Boot checks & OAuth status/session listeners
  useEffect(() => {
    void testFirestoreConnection();
    void fetchOAuthSession();

    fetch('/api/oauth/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { providers?: Partial<Record<'discord' | 'github' | 'twitch', OAuthProviderStatus>> } | null) => {
        if (data?.providers) {
          setOauthStatuses(data.providers);
        }
      })
      .catch(() => {
        // Ignore offline status lookup
      });

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, [fetchOAuthSession]);

  // Verify human security checkpoint cookie on boot
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        setBotVerifyStatus('verified');
        return;
      }
    }

    let cancelled = false;
    fetch('/api/verify/status', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('status error');
        return (await res.json()) as { verified?: boolean; rayId?: string };
      })
      .then((data) => {
        if (cancelled) return;
        if (data.rayId) setVerifyRayId(data.rayId);
        setBotVerifyStatus(data.verified ? 'verified' : 'required');
      })
      .catch(() => {
        if (!cancelled) setBotVerifyStatus('required');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for OAuth popup completion messages
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }

      const data = event.data as {
        type?: string;
        provider?: 'discord' | 'github' | 'twitch';
        profile?: ConnectedAccountInfo;
        error?: string;
      } | null;

      if (!data || (data.type !== 'OAUTH_AUTH_SUCCESS' && data.type !== 'OAUTH_AUTH_ERROR')) {
        return;
      }

      if (data.type === 'OAUTH_AUTH_SUCCESS') {
        await fetchOAuthSession();
        if (data.profile && auth.currentUser?.emailVerified) {
          try {
            await syncConnectionToFirestore(auth.currentUser, {
              ...data.profile,
              source: 'oauth',
            });
          } catch {
            // Firestore error already logged structurally
          }
        }
        showToast(`Connected ${data.provider ?? 'account'} successfully.`);
        if (oauthResolverRef.current) {
          oauthResolverRef.current({ ok: true });
          oauthResolverRef.current = null;
        }
      } else {
        if (oauthResolverRef.current) {
          oauthResolverRef.current({
            ok: false,
            error: data.error || 'OAuth connection failed.',
          });
          oauthResolverRef.current = null;
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fetchOAuthSession, showToast, syncConnectionToFirestore]);

  // Firestore user profile + connections sync (gated behind authReady && emailVerified)
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) {
      setFirestoreConnections({});
      setMembershipOrders([]);
      setState((prev) =>
        prev.isPremium || prev.membershipTier !== 'free' || prev.purchasedIds.length > 0
          ? { ...prev, isPremium: false, membershipTier: 'free', purchasedIds: [] }
          : prev
      );
      return;
    }

    const uid = firebaseUser.uid;
    if (!isValidFirestoreId(uid)) return;

    const userDocRef = doc(db, 'users', uid);
    const privateDocRef = doc(db, 'users', uid, 'private', 'info');

    const ensureProfileDocs = async () => {
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          const fallbackName =
            firebaseUser.displayName ||
            (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'SwxMember');
          const createPayload: Record<string, unknown> = {
            uid,
            displayName: clampString(fallbackName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
            xp: Math.max(0, Math.min(1000000, state.xp)),
            isPremium: false,
            membershipTier: 'free',
            purchasedIds: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (firebaseUser.photoURL) {
            createPayload.avatarUrl = clampString(firebaseUser.photoURL, BLUEPRINT_LIMITS.URL_MAX);
          }
          await setDoc(userDocRef, createPayload);
        }

        if (firebaseUser.email) {
          await setDoc(privateDocRef, {
            uid,
            email: clampString(firebaseUser.email, BLUEPRINT_LIMITS.EMAIL_MAX),
            updatedAt: serverTimestamp(),
          });
        }

        // Sync zero-PII public member/staff roster entry
        const publicMemberRef = doc(db, 'publicMembers', uid);
        const publicSnap = await getDoc(publicMemberRef);
        const isCurrentOwnerUser = isOwnerAccount(
          firebaseUser.email,
          Boolean(firebaseUser.emailVerified)
        );
        const fallbackPublicName =
          firebaseUser.displayName ||
          (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'SwxMember');
        if (!publicSnap.exists()) {
          const sanitized = sanitizePublicMemberFields({
            uid,
            displayName: fallbackPublicName,
            avatarUrl: firebaseUser.photoURL,
            role: isCurrentOwnerUser ? 'owner' : 'member',
            membershipTier: 'free',
            xp: state.xp,
          });
          await setDoc(publicMemberRef, {
            ...sanitized,
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (isCurrentOwnerUser && publicSnap.data()?.role !== 'owner') {
          await updateDoc(publicMemberRef, {
            role: 'owner',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      }
    };

    void ensureProfileDocs();

    // Sync any currently active OAuth session connections into Firestore
    for (const conn of Object.values(oauthConnections)) {
      if (conn) {
        void syncConnectionToFirestore(firebaseUser, conn).catch(() => {});
      }
    }

    const unsubUser = onSnapshot(
      userDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          xp?: number;
          isPremium?: boolean;
          membershipTier?: MembershipTier;
          purchasedIds?: string[];
        };
        const cloudIsPremium = Boolean(data.isPremium);
        const cloudTier: MembershipTier =
          data.membershipTier === 'ultimate'
            ? 'ultimate'
            : data.membershipTier === 'premium' || cloudIsPremium
            ? 'premium'
            : 'free';
        const cloudPurchasedIds = Array.isArray(data.purchasedIds)
          ? data.purchasedIds.filter((id): id is string => typeof id === 'string')
          : [];
        const isCurrentOwner = isOwnerAccount(
          firebaseUser.email,
          Boolean(firebaseUser.emailVerified)
        );
        setState((prev) => ({
          ...prev,
          xp: typeof data.xp === 'number' ? Math.max(prev.xp, data.xp) : prev.xp,
          isPremium: isCurrentOwner ? prev.isPremium || cloudIsPremium : cloudIsPremium,
          membershipTier: isCurrentOwner
            ? prev.membershipTier !== 'free'
              ? prev.membershipTier
              : cloudTier
            : cloudTier,
          purchasedIds: cloudPurchasedIds,
        }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      }
    );

    const connectionsCol = collection(db, 'users', uid, 'connections');
    const unsubConnections = onSnapshot(
      connectionsCol,
      (snap) => {
        const map: Partial<Record<AuthProviderId, ConnectedAccountInfo>> = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data() as {
            provider?: AuthProviderId;
            providerUserId?: string;
            username?: string;
            displayName?: string;
            avatarUrl?: string;
            profileUrl?: string;
          };
          if (d.provider) {
            map[d.provider] = {
              provider: d.provider,
              providerUserId: d.providerUserId || docSnap.id,
              username: d.username || d.provider,
              displayName: d.displayName || d.username || d.provider,
              email: null,
              avatarUrl: d.avatarUrl || null,
              profileUrl: d.profileUrl || null,
              connectedAt: new Date().toISOString(),
              source: 'firestore',
            };
          }
        });
        setFirestoreConnections(map);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/connections`);
      }
    );

    return () => {
      unsubUser();
      unsubConnections();
    };
  }, [authReady, firebaseUser, oauthConnections, syncConnectionToFirestore]);

  // Listen to public community threads once Firebase is initialized
  useEffect(() => {
    if (!authReady) return;
    const threadsQuery = query(
      collection(db, 'threads'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      threadsQuery,
      (snap) => {
        const items: CommunityThread[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as {
            title: string;
            authorName: string;
            authorRole: string;
            topic: CommunityThread['topic'];
            body: string;
            upvotes: number;
          };
          items.push({
            id: docSnap.id,
            title: d.title,
            author: d.authorName,
            role: d.authorRole,
            topic: d.topic,
            body: d.body,
            upvotes: typeof d.upvotes === 'number' ? d.upvotes : 1,
            createdAt: 'Synced',
            replies: [],
          });
        });
        setCloudThreads(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'threads');
      }
    );
    return () => unsub();
  }, [authReady]);

  // Listen to owner-published resources catalog once Firebase is initialized
  useEffect(() => {
    if (!authReady) return;
    const resourcesQuery = query(
      collection(db, 'resources'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(
      resourcesQuery,
      (snap) => {
        const items: ResourceItem[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<ResourceItem> & {
            fileExtension?: ArchiveExtension;
            downloadUrl?: string;
            createdBy?: string;
          };
          if (!d.title || !d.fileName) return;
          items.push({
            id: docSnap.id,
            title: d.title,
            subtitle: d.subtitle || '',
            description: d.description || '',
            category: (d.category as CategoryId) || 'plugins',
            downloads: typeof d.downloads === 'number' ? d.downloads : 0,
            rating: typeof d.rating === 'number' ? d.rating : 0,
            ratingCount: typeof d.ratingCount === 'number' ? d.ratingCount : 0,
            version: d.version || 'v1.0.0',
            mcVersions: d.mcVersions || '1.21+',
            fileSize: d.fileSize || '1 KB',
            author: d.author || 'SwxStudios',
            updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
            popular: Boolean(d.popular),
            exclusive: Boolean(d.exclusive),
            tier: d.tier || (d.exclusive ? 'premium' : 'free'),
            priceLabel: typeof d.priceLabel === 'string' ? d.priceLabel : '',
            views: typeof d.views === 'number' ? d.views : undefined,
            publishedAt: typeof d.publishedAt === 'string' ? d.publishedAt : undefined,
            openSource: typeof d.openSource === 'boolean' ? d.openSource : undefined,
            drmFree: typeof d.drmFree === 'boolean' ? d.drmFree : undefined,
            unobfuscated: typeof d.unobfuscated === 'boolean' ? d.unobfuscated : undefined,
            aiMarketing: typeof d.aiMarketing === 'boolean' ? d.aiMarketing : undefined,
            aiProduct: typeof d.aiProduct === 'boolean' ? d.aiProduct : undefined,
            resourceType: typeof d.resourceType === 'string' ? d.resourceType : undefined,
            gameModes: Array.isArray(d.gameModes) ? d.gameModes : undefined,
            supportedSoftware: Array.isArray(d.supportedSoftware)
              ? d.supportedSoftware
              : undefined,
            supportedVersions: Array.isArray(d.supportedVersions)
              ? d.supportedVersions
              : undefined,
            supportedLanguages: Array.isArray(d.supportedLanguages)
              ? d.supportedLanguages
              : undefined,
            dependencies: Array.isArray(d.dependencies) ? d.dependencies : undefined,
            changelog: Array.isArray(d.changelog) ? d.changelog : undefined,
            demoVideoUrl: typeof d.demoVideoUrl === 'string' ? d.demoVideoUrl : undefined,
            tags: Array.isArray(d.tags) ? d.tags : [],
            artwork: d.artwork || 'lifesteal',
            accentColor: d.accentColor || '#e11d48',
            features: Array.isArray(d.features) ? d.features : [],
            fileName: d.fileName,
            fileExtension: d.fileExtension,
            downloadUrl: d.downloadUrl,
            createdBy: d.createdBy,
          });
        });
        setCloudResources(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'resources');
      }
    );
    return () => unsub();
  }, [authReady]);

  // Listen to public storefront settings document
  useEffect(() => {
    if (!authReady) return;
    const settingsRef = doc(db, 'settings', 'site');
    const unsub = onSnapshot(
      settingsRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as Partial<SiteSettings>;
        setSiteSettings({
          announcementVisible:
            typeof d.announcementVisible === 'boolean'
              ? d.announcementVisible
              : DEFAULT_SITE_SETTINGS.announcementVisible,
          announcementLabel:
            typeof d.announcementLabel === 'string' && d.announcementLabel.trim()
              ? d.announcementLabel
              : DEFAULT_SITE_SETTINGS.announcementLabel,
          announcementText:
            typeof d.announcementText === 'string' && d.announcementText.trim()
              ? d.announcementText
              : DEFAULT_SITE_SETTINGS.announcementText,
          communityEnabled:
            typeof d.communityEnabled === 'boolean'
              ? d.communityEnabled
              : DEFAULT_SITE_SETTINGS.communityEnabled,
          heroHeadline: typeof d.heroHeadline === 'string' ? d.heroHeadline : '',
          gcashNumber: typeof d.gcashNumber === 'string' ? d.gcashNumber : '',
          gcashName:
            typeof d.gcashName === 'string' && d.gcashName.trim()
              ? d.gcashName
              : DEFAULT_SITE_SETTINGS.gcashName,
          paypalEmail:
            typeof d.paypalEmail === 'string' && d.paypalEmail.trim()
              ? d.paypalEmail
              : DEFAULT_SITE_SETTINGS.paypalEmail,
          paypalLink: typeof d.paypalLink === 'string' ? d.paypalLink : '',
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/site');
      }
    );
    return () => unsub();
  }, [authReady]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const connectedAccounts = useMemo(
    () =>
      mergeConnectedAccounts({
        firebaseProviders: firebaseUser?.providerData || [],
        oauthConnections,
        firestoreConnections,
      }),
    [firebaseUser, oauthConnections, firestoreConnections]
  );

  const identity = useMemo(
    () =>
      resolveDisplayIdentity({
        firebaseUser: firebaseUser
          ? {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              emailVerified: firebaseUser.emailVerified,
              providerData: firebaseUser.providerData.map((p) => ({
                providerId: p.providerId,
                uid: p.uid,
                displayName: p.displayName,
                email: p.email,
                photoURL: p.photoURL,
              })),
            }
          : null,
        primaryOAuth: primaryOAuthProfile,
        preferredMcAvatarUrl,
      }),
    [firebaseUser, primaryOAuthProfile, preferredMcAvatarUrl]
  );

  const isOwner = useMemo(
    () => isOwnerAccount(firebaseUser?.email, Boolean(firebaseUser?.emailVerified)),
    [firebaseUser]
  );

  // Listen to Minecraft servers directory (filter approved=true for public so Firestore list rules match)
  useEffect(() => {
    if (!authReady) return;
    const serversQuery = isOwner
      ? query(collection(db, 'servers'), limit(100))
      : query(collection(db, 'servers'), where('approved', '==', true), limit(100));

    const unsub = onSnapshot(
      serversQuery,
      (snap) => {
        const items: MinecraftServerListing[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<MinecraftServerListing>;
          if (!d.name || !d.address) return;
          items.push({
            id: docSnap.id,
            name: d.name,
            address: d.address,
            edition: d.edition || 'Java',
            version: d.version || '1.21.4',
            motd: d.motd || '',
            description: typeof d.description === 'string' ? d.description : undefined,
            bedrockAddress: typeof d.bedrockAddress === 'string' ? d.bedrockAddress : undefined,
            tps: typeof d.tps === 'number' ? d.tps : undefined,
            mspt: typeof d.mspt === 'number' ? d.mspt : undefined,
            pingMs: typeof d.pingMs === 'number' ? d.pingMs : undefined,
            topPlayers: Array.isArray(d.topPlayers)
              ? d.topPlayers.filter((item): item is string => typeof item === 'string')
              : undefined,
            gameModes: Array.isArray(d.gameModes) ? d.gameModes : [],
            approved: Boolean(d.approved),
            featured: Boolean(d.featured),
            votes: typeof d.votes === 'number' ? d.votes : 0,
            submittedBy: d.submittedBy || '',
            submittedByName: d.submittedByName || 'Member',
          });
        });
        setCloudServers(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'servers');
      }
    );
    return () => unsub();
  }, [authReady, isOwner]);

  // Listen to GCash & PayPal membership orders (own orders for members; all orders for Owner)
  useEffect(() => {
    if (!authReady || !firebaseUser?.emailVerified) {
      setMembershipOrders([]);
      return;
    }
    const ordersQuery = isOwner
      ? query(collection(db, 'membershipOrders'), limit(60))
      : query(
          collection(db, 'membershipOrders'),
          where('userId', '==', firebaseUser.uid),
          limit(25)
        );
    const unsub = onSnapshot(
      ordersQuery,
      (snap) => {
        const items: MembershipOrder[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<MembershipOrder> & {
            createdAt?: { toMillis?: () => number };
          };
          if (!d.userId || !d.referenceCode) return;
          items.push({
            id: docSnap.id,
            userId: d.userId,
            buyerName: d.buyerName || 'SwxMember',
            plan: d.plan === 'ultimate' || d.plan === 'package' ? d.plan : 'premium',
            resourceId: typeof d.resourceId === 'string' ? d.resourceId : undefined,
            resourceTitle: typeof d.resourceTitle === 'string' ? d.resourceTitle : undefined,
            paymentMethod: d.paymentMethod === 'paypal' ? 'paypal' : 'gcash',
            referenceCode: d.referenceCode,
            senderAccount: d.senderAccount || '',
            amountLabel: d.amountLabel || '',
            status:
              d.status === 'approved' || d.status === 'declined' ? d.status : 'pending',
            adminNote: typeof d.adminNote === 'string' ? d.adminNote : undefined,
            createdAt:
              typeof d.createdAt?.toMillis === 'function'
                ? String(d.createdAt.toMillis())
                : undefined,
          });
        });
        items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        setMembershipOrders(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'membershipOrders');
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser, isOwner]);

  // Listen to Competitive PvP Tier List players (public read)
  useEffect(() => {
    if (!authReady) return;
    const tierPlayersQuery = query(collection(db, 'tierPlayers'), limit(200));
    const unsub = onSnapshot(
      tierPlayersQuery,
      (snap) => {
        const items: TierPlayerRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Record<string, unknown>;
          if (typeof d.ign !== 'string' || !d.ign.trim()) return;
          const ranks = sanitizeRanksMap(d.ranks);
          const peakRanks = sanitizeRanksMap(d.peakRanks);
          const region = normalizeTierRegion(typeof d.region === 'string' ? d.region : 'NA') ?? 'NA';
          items.push({
            id: docSnap.id,
            ign: d.ign,
            region,
            ranks,
            peakRanks: Object.keys(peakRanks).length > 0 ? peakRanks : undefined,
            points: typeof d.points === 'number' ? d.points : calculateTierPoints(ranks),
            updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
            updatedByName: typeof d.updatedByName === 'string' ? d.updatedByName : undefined,
          });
        });
        setCloudTierPlayers(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tierPlayers');
      }
    );
    return () => unsub();
  }, [authReady]);

  // Check whether current verified user holds Tier Admin status
  useEffect(() => {
    if (!authReady || !firebaseUser?.emailVerified) {
      setSelfIsTierAdmin(false);
      return;
    }
    const adminRef = doc(db, 'tierAdmins', firebaseUser.uid);
    const unsub = onSnapshot(
      adminRef,
      (snap) => {
        setSelfIsTierAdmin(snap.exists());
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `tierAdmins/${firebaseUser.uid}`);
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  // Owner listens to full Tier Admin roster
  useEffect(() => {
    if (!authReady || !isOwner) {
      setTierAdmins([]);
      return;
    }
    const adminsQuery = query(collection(db, 'tierAdmins'), limit(100));
    const unsub = onSnapshot(
      adminsQuery,
      (snap) => {
        const list: TierAdminRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<TierAdminRecord>;
          if (!d.uid) return;
          list.push({
            uid: d.uid,
            displayName: d.displayName || 'Tier Admin',
            grantedBy: d.grantedBy || '',
            grantedByName: d.grantedByName,
          });
        });
        setTierAdmins(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tierAdmins');
      }
    );
    return () => unsub();
  }, [authReady, isOwner]);

  // Owner & Tier Admins listen to Tier Command Audit Log
  useEffect(() => {
    if (!authReady || (!isOwner && !selfIsTierAdmin)) {
      setTierCommandLogs([]);
      return;
    }
    const logsQuery = query(collection(db, 'tierCommands'), orderBy('createdAt', 'desc'), limit(40));
    const unsub = onSnapshot(
      logsQuery,
      (snap) => {
        const list: TierCommandLogEntry[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<TierCommandLogEntry> & {
            createdAt?: { toMillis?: () => number };
          };
          if (!d.commandText || !d.action) return;
          list.push({
            id: docSnap.id,
            commandText: d.commandText,
            action: d.action,
            executorUid: d.executorUid || '',
            executorName: d.executorName || 'Staff',
            executorRole: d.executorRole === 'owner' ? 'owner' : 'admin',
            summary: d.summary || d.commandText,
            createdAt:
              typeof d.createdAt?.toMillis === 'function'
                ? String(d.createdAt.toMillis())
                : undefined,
          });
        });
        setTierCommandLogs(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tierCommands');
      }
    );
    return () => unsub();
  }, [authReady, isOwner, selfIsTierAdmin]);

  // Listen to public studio visit metrics & record 1 visit per browser session
  useEffect(() => {
    if (!authReady) return;
    const metricsRef = doc(db, 'metrics', 'site');
    const unsub = onSnapshot(
      metricsRef,
      (snap) => {
        setMetricsSynced(true);
        if (snap.exists()) {
          const data = snap.data() as { visits?: unknown };
          if (typeof data.visits === 'number' && Number.isFinite(data.visits)) {
            setSiteVisits(Math.max(0, Math.floor(data.visits)));
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'metrics/site');
      }
    );

    const recordVisit = async () => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage.getItem('swx_visit_recorded') === '1') {
          return;
        }
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(metricsRef);
          if (!snap.exists()) {
            tx.set(metricsRef, {
              visits: 1,
              updatedAt: serverTimestamp(),
            });
          } else {
            const current = Number(snap.data()?.visits) || 0;
            tx.update(metricsRef, {
              visits: current + 1,
              updatedAt: serverTimestamp(),
            });
          }
        });
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('swx_visit_recorded', '1');
        }
      } catch {
        // Non-fatal if offline or throttled
      }
    };

    void recordVisit();
    return () => unsub();
  }, [authReady]);

  // Listen to zero-PII public members & staff roster
  useEffect(() => {
    if (!authReady) return;
    const membersQuery = query(collection(db, 'publicMembers'), limit(200));
    const unsub = onSnapshot(
      membersQuery,
      (snap) => {
        const list: PublicMemberProfile[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<PublicMemberProfile>;
          if (!d.displayName) return;
          list.push({
            uid: docSnap.id,
            displayName: d.displayName,
            avatarUrl: typeof d.avatarUrl === 'string' ? d.avatarUrl : undefined,
            role: d.role === 'owner' || d.role === 'admin' ? d.role : 'member',
            serverRank: isValidServerRankId(d.serverRank) ? d.serverRank : undefined,
            serverRoles: Array.isArray(d.serverRoles)
              ? sanitizeServerRolesList(d.serverRoles)
              : undefined,
            membershipTier:
              d.membershipTier === 'ultimate' || d.membershipTier === 'premium'
                ? d.membershipTier
                : 'free',
            xp: typeof d.xp === 'number' ? d.xp : 0,
          });
        });
        setPublicMembers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'publicMembers');
      }
    );
    return () => unsub();
  }, [authReady]);

  // Listen to current verified user's friendships and friend requests
  useEffect(() => {
    if (!authReady || !firebaseUser?.emailVerified) {
      setFriendships([]);
      return;
    }
    const friendsQuery = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', firebaseUser.uid),
      limit(150)
    );
    const unsub = onSnapshot(
      friendsQuery,
      (snap) => {
        const list: FriendshipRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<FriendshipRecord>;
          if (!Array.isArray(d.users) || d.users.length !== 2 || !d.requesterUid || !d.recipientUid) {
            return;
          }
          list.push({
            id: docSnap.id,
            users: [d.users[0], d.users[1]],
            requesterUid: d.requesterUid,
            requesterName: d.requesterName || 'Member',
            requesterAvatar: typeof d.requesterAvatar === 'string' ? d.requesterAvatar : undefined,
            recipientUid: d.recipientUid,
            recipientName: d.recipientName || 'Member',
            recipientAvatar: typeof d.recipientAvatar === 'string' ? d.recipientAvatar : undefined,
            status:
              d.status === 'accepted' || d.status === 'declined' || d.status === 'blocked'
                ? d.status
                : 'pending',
            blockedBy: typeof d.blockedBy === 'string' ? d.blockedBy : undefined,
          });
        });
        setFriendships(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'friendships');
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  // Listen to community "Suggest Add This Player" queue
  useEffect(() => {
    if (!authReady) return;
    const suggestionsQuery = query(
      collection(db, 'playerSuggestions'),
      orderBy('createdAt', 'desc'),
      limit(80)
    );
    const unsub = onSnapshot(
      suggestionsQuery,
      (snap) => {
        const list: PlayerSuggestionRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Partial<PlayerSuggestionRecord>;
          if (!d.ign || !d.suggestedBy) return;
          list.push({
            id: docSnap.id,
            ign: d.ign,
            suggestedRank: isValidServerRankId(d.suggestedRank) ? d.suggestedRank : undefined,
            suggestedMode: typeof d.suggestedMode === 'string' ? d.suggestedMode : undefined,
            note: typeof d.note === 'string' ? d.note : undefined,
            suggestedBy: d.suggestedBy,
            suggestedByName: d.suggestedByName || 'Member',
            status:
              d.status === 'approved' || d.status === 'declined' ? d.status : 'pending',
            reviewedBy: typeof d.reviewedBy === 'string' ? d.reviewedBy : undefined,
          });
        });
        setPlayerSuggestions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'playerSuggestions');
      }
    );
    return () => unsub();
  }, [authReady]);

  // Fetch server telemetry snapshots (TPS / MSPT / Avg Ping / Top Players)
  useEffect(() => {
    fetch('/api/mc/telemetry')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { snapshots?: Record<string, ServerTelemetrySnapshot> } | null) => {
        if (data?.snapshots) {
          setTelemetryMap(data.snapshots);
        }
      })
      .catch(() => {
        // Ignore transient fetch failure
      });
  }, []);

  const allDirectoryServers = useMemo(() => {
    const activeCloudServers = filterActiveServerListings(cloudServers);
    const existingAddresses = new Set(
      activeCloudServers.map((s) => s.address.trim().toLowerCase())
    );
    const baselineExtras = BASELINE_LIVE_SERVERS.filter(
      (b) => !existingAddresses.has(b.address.trim().toLowerCase())
    );
    return [...activeCloudServers, ...baselineExtras];
  }, [cloudServers]);

  const checkServerLiveStatus = useCallback(
    async (srv: MinecraftServerListing, fresh = false, regionOverride?: ProbeRegionId) => {
      if (!srv.address) return;
      if (liveInFlightRef.current.has(srv.id) && !fresh) return;
      liveInFlightRef.current.add(srv.id);

      const targetRegion = regionOverride || probeRegion;
      const regionMeta = resolveProbeRegionInfo(targetRegion);

      setLiveStatusMap((prev) => ({
        ...prev,
        [srv.id]: {
          ...(prev[srv.id] || { online: null, playersOnline: 0, playersMax: 0 }),
          loading: true,
        },
      }));

      const apiEdition = srv.edition === 'Bedrock' ? 'bedrock' : 'java';
      try {
        const res = await fetch(
          `/api/mc/status?host=${encodeURIComponent(srv.address.trim())}&edition=${apiEdition}&region=${encodeURIComponent(targetRegion)}${
            fresh ? '&fresh=1' : ''
          }`
        );
        const data = (await res.json()) as {
          online?: boolean;
          host?: string;
          resolvedHost?: string | null;
          ip?: string | null;
          port?: number;
          version?: string | null;
          software?: string | null;
          pingMs?: number | null;
          probeRegion?: string;
          probeLocation?: string;
          playersOnline?: number;
          playersMax?: number;
          playerSample?: Array<{ uuid: string; name: string }>;
          motdLines?: string[];
          iconBase64?: string | null;
          checkedAt?: string;
          error?: string;
        };

        if (!res.ok) {
          setLiveStatusMap((prev) => ({
            ...prev,
            [srv.id]: {
              loading: false,
              online: false,
              probeRegion: targetRegion,
              probeLocation: regionMeta.label,
              playersOnline: 0,
              playersMax: 0,
              error: data.error || 'Could not reach server',
            },
          }));
          return;
        }

        setLiveStatusMap((prev) => ({
          ...prev,
          [srv.id]: {
            loading: false,
            online: Boolean(data.online),
            host: data.host || srv.address,
            resolvedHost: data.resolvedHost ?? null,
            ip: data.ip ?? null,
            port: data.port,
            version: data.version ?? null,
            software: data.software ?? null,
            pingMs: typeof data.pingMs === 'number' ? data.pingMs : null,
            probeRegion: data.probeRegion || targetRegion,
            probeLocation: data.probeLocation || regionMeta.label,
            playersOnline: typeof data.playersOnline === 'number' ? data.playersOnline : 0,
            playersMax: typeof data.playersMax === 'number' ? data.playersMax : 0,
            playerSample: Array.isArray(data.playerSample) ? data.playerSample : [],
            motdLines: Array.isArray(data.motdLines) ? data.motdLines : [],
            iconBase64: data.iconBase64 ?? null,
            checkedAt: data.checkedAt || new Date().toISOString(),
          },
        }));
      } catch {
        setLiveStatusMap((prev) => ({
          ...prev,
          [srv.id]: {
            loading: false,
            online: false,
            probeRegion: targetRegion,
            probeLocation: regionMeta.label,
            playersOnline: 0,
            playersMax: 0,
            error: 'Status check failed',
          },
        }));
      } finally {
        liveInFlightRef.current.delete(srv.id);
      }
    },
    [probeRegion]
  );

  const refreshAllServersLive = useCallback(
    async (targets: MinecraftServerListing[], fresh = false) => {
      const batchSize = 4;
      for (let i = 0; i < targets.length; i += batchSize) {
        const chunk = targets.slice(i, i + batchSize);
        await Promise.all(chunk.map((srv) => checkServerLiveStatus(srv, fresh)));
      }
    },
    [checkServerLiveStatus]
  );

  const activeThreads = cloudThreads.length > 0 ? cloudThreads : state.threads;
  const activeResources = cloudResources;
  const approvedServers = useMemo(() => {
    const priorityOrder = ['donutsmp.net', 'mcpvp.club', 'acersmp.xyz', 'mc.hypixel.net'];
    return allDirectoryServers
      .filter((s) => s.approved)
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        const aPrio = priorityOrder.indexOf(a.address.trim().toLowerCase());
        const bPrio = priorityOrder.indexOf(b.address.trim().toLowerCase());
        if (aPrio !== -1 || bPrio !== -1) {
          if (aPrio === -1) return 1;
          if (bPrio === -1) return -1;
          return aPrio - bPrio;
        }
        return b.votes - a.votes;
      });
  }, [allDirectoryServers]);

  const studioStatsOverview = useMemo(
    () =>
      buildStudioStatsOverview({
        visits: siteVisits,
        publicMembers,
        tierAdmins,
        resources: activeResources,
        servers: approvedServers,
        liveStatusMap,
        tierPlayers: cloudTierPlayers,
        threads: activeThreads,
        toolsCount: TOOL_DIRECTORY.length,
      }),
    [
      siteVisits,
      publicMembers,
      tierAdmins,
      activeResources,
      approvedServers,
      liveStatusMap,
      cloudTierPlayers,
      activeThreads,
    ]
  );

  // Auto-ping Homepage Featured Servers once when visible
  useEffect(() => {
    if (activeTab !== 'home') return;
    const featuredSubset = approvedServers.slice(0, 4);
    const pending = featuredSubset.filter((srv) => !homePingTriggeredRef.current.has(srv.id));
    if (pending.length === 0) return;
    pending.forEach((srv) => homePingTriggeredRef.current.add(srv.id));
    void refreshAllServersLive(pending, false);
  }, [activeTab, approvedServers, refreshAllServersLive]);

  const selectedResource = useMemo(
    () => activeResources.find((r) => r.id === selectedResourceId) ?? null,
    [activeResources, selectedResourceId]
  );

  const hasActiveHomeFilter =
    heroQuery.trim().length > 0 || heroCategory !== 'all' || heroTier !== 'all';

  const filteredHomeResults = useMemo(
    () =>
      filterResources(activeResources, {
        query: heroQuery,
        category: heroCategory,
        tierFilter: heroTier,
      }),
    [activeResources, heroQuery, heroCategory, heroTier]
  );

  const categoryCounts = useMemo(
    () => countByCategory(activeResources),
    [activeResources]
  );

  const tierCounts = useMemo(
    () => countByTier(activeResources),
    [activeResources]
  );

  const trendingResources = useMemo(
    () => activeResources.filter((r) => r.popular).slice(0, 4),
    [activeResources]
  );

  const latestPlugins = useMemo(
    () => activeResources.filter((r) => r.category === 'plugins').slice(0, 4),
    [activeResources]
  );

  const latestModels = useMemo(
    () => activeResources.filter((r) => r.category === 'models').slice(0, 4),
    [activeResources]
  );

  const latestConfigs = useMemo(
    () => activeResources.filter((r) => r.category === 'configs').slice(0, 4),
    [activeResources]
  );

  const persistUserMetrics = useCallback(
    async (updates: {
      xp?: number;
      displayName?: string;
      avatarUrl?: string;
    }) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) return;
      const uid = auth.currentUser.uid;
      try {
        await updateDoc(doc(db, 'users', uid), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        const publicUpdates: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };
        if (typeof updates.xp === 'number') {
          publicUpdates.xp = Math.max(0, Math.min(1000000, Math.round(updates.xp)));
        }
        if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
          publicUpdates.displayName = clampString(updates.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
        }
        if (typeof updates.avatarUrl === 'string' && updates.avatarUrl.trim()) {
          publicUpdates.avatarUrl = clampString(updates.avatarUrl, BLUEPRINT_LIMITS.URL_MAX);
        }
        await updateDoc(doc(db, 'publicMembers', uid), publicUpdates).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    },
    []
  );

  const openPremiumModal = useCallback((resource?: ResourceItem | null) => {
    setPendingPurchaseResource(resource ?? null);
    setPremiumOpen(true);
  }, []);

  const savePreferredMcAvatar = useCallback((avatarUrl?: string | null) => {
    const clean = avatarUrl ? clampString(avatarUrl, BLUEPRINT_LIMITS.URL_MAX) : '';
    setPreferredMcAvatarUrl(clean || null);
    if (typeof window !== 'undefined') {
      try {
        if (clean) {
          window.localStorage.setItem('swx_preferred_mc_avatar', clean);
        } else {
          window.localStorage.removeItem('swx_preferred_mc_avatar');
        }
      } catch {
        // Ignore storage failure
      }
    }
    return clean;
  }, []);

  // Auth Actions
  const handleEmailSignIn = async (
    email: string,
    password: string,
    mcAvatarUrl?: string | null,
    forceAvatar = false
  ) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const cleanAvatar = mcAvatarUrl ? clampString(mcAvatarUrl, BLUEPRINT_LIMITS.URL_MAX) : '';
      if (cleanAvatar && (forceAvatar || !cred.user.photoURL)) {
        savePreferredMcAvatar(cleanAvatar);
        await updateProfile(cred.user, { photoURL: cleanAvatar });
        setAuthVersion((v) => v + 1);
        if (cred.user.emailVerified) {
          void updateDoc(doc(db, 'users', cred.user.uid), {
            avatarUrl: cleanAvatar,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
      showToast(
        cred.user.emailVerified
          ? `Welcome back, ${cred.user.displayName || email}`
          : 'Signed in. Verify your email in Account settings to sync cloud data.'
      );
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const handleEmailSignUp = async (
    displayName: string,
    email: string,
    password: string,
    mcAvatarUrl?: string | null
  ) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const cleanName = clampString(displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
      const cleanAvatar = mcAvatarUrl ? clampString(mcAvatarUrl, BLUEPRINT_LIMITS.URL_MAX) : '';
      if (cleanAvatar) {
        savePreferredMcAvatar(cleanAvatar);
      }
      await updateProfile(cred.user, {
        displayName: cleanName,
        ...(cleanAvatar ? { photoURL: cleanAvatar } : {}),
      });
      await sendEmailVerification(cred.user);
      setAuthVersion((v) => v + 1);
      showToast('Account created — verification email sent.');
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const handleFirebaseProviderAuth = async (
    providerId: 'google' | 'microsoft',
    mcAvatarUrl?: string | null,
    forceAvatar = false
  ) => {
    const provider = providerId === 'google' ? googleProvider : microsoftProvider;
    try {
      const cred = await signInWithPopup(auth, provider);
      const cleanAvatar = mcAvatarUrl ? clampString(mcAvatarUrl, BLUEPRINT_LIMITS.URL_MAX) : '';
      if (cleanAvatar && (forceAvatar || !cred.user.photoURL)) {
        savePreferredMcAvatar(cleanAvatar);
        await updateProfile(cred.user, { photoURL: cleanAvatar });
        setAuthVersion((v) => v + 1);
        if (cred.user.emailVerified) {
          void updateDoc(doc(db, 'users', cred.user.uid), {
            avatarUrl: cleanAvatar,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
      showToast(`Signed in as ${cred.user.displayName || cred.user.email || providerId}`);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const handleOAuthPopupAuth = async (
    provider: 'discord' | 'github' | 'twitch',
    mcAvatarUrl?: string | null,
    forceAvatar = false
  ) => {
    if (mcAvatarUrl && (forceAvatar || !preferredMcAvatarUrl)) {
      savePreferredMcAvatar(mcAvatarUrl);
    }
    const res = await fetch(`/api/oauth/${provider}/url`, { credentials: 'include' });
    const data = (await res.json()) as {
      url?: string;
      setupRequired?: boolean;
      label?: string;
      callbackUrl?: string;
      portalUrl?: string;
      envVars?: string[];
      error?: string;
    };

    if (data.setupRequired) {
      return {
        ok: false,
        setupGuide: {
          provider,
          label: data.label || provider,
          callbackUrl: data.callbackUrl || `${window.location.origin}/auth/callback/${provider}`,
          portalUrl: data.portalUrl || '',
          envVars: data.envVars || [],
        },
      };
    }

    if (!res.ok) {
      return { ok: false, error: data.error || `Failed to start ${provider} OAuth.` };
    }

    if (!data.url) {
      return { ok: false, error: 'Missing OAuth authorization URL.' };
    }

    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const popup = window.open(data.url, 'swx_oauth_popup', 'width=560,height=720');
      if (!popup) {
        resolve({
          ok: false,
          error: 'Popup was blocked by your browser. Please allow popups for SwxStudios.',
        });
        return;
      }

      oauthResolverRef.current = resolve;
      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          if (oauthResolverRef.current) {
            oauthResolverRef.current({ ok: false });
            oauthResolverRef.current = null;
          }
        }
      }, 450);
    });
  };

  const handleConnectFromAccount = async (provider: AuthProviderId) => {
    if (provider === 'google' || provider === 'microsoft') {
      const targetProvider = provider === 'google' ? googleProvider : microsoftProvider;
      try {
        if (auth.currentUser) {
          await linkWithPopup(auth.currentUser, targetProvider);
          await reload(auth.currentUser);
          setAuthVersion((v) => v + 1);
        } else {
          await signInWithPopup(auth, targetProvider);
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: mapFirebaseAuthError(error) };
      }
    }
    return handleOAuthPopupAuth(provider);
  };

  const handleDisconnectProvider = async (provider: AuthProviderId) => {
    if (provider === 'discord' || provider === 'github' || provider === 'twitch') {
      await fetch(`/api/auth/disconnect/${provider}`, {
        method: 'POST',
        credentials: 'include',
      });
      await fetchOAuthSession();
    }

    if (auth.currentUser && (provider === 'google' || provider === 'microsoft')) {
      const firebaseProviderKey = provider === 'google' ? 'google.com' : 'microsoft.com';
      if (auth.currentUser.providerData.length <= 1) {
        throw new Error('Add another sign-in method before disconnecting your only login provider.');
      }
      try {
        await unlink(auth.currentUser, firebaseProviderKey);
        await reload(auth.currentUser);
        setAuthVersion((v) => v + 1);
      } catch (error) {
        throw new Error(mapFirebaseAuthError(error));
      }
    }

    if (auth.currentUser?.emailVerified && isValidFirestoreId(auth.currentUser.uid)) {
      try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'connections', provider));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${auth.currentUser.uid}/connections/${provider}`
        );
      }
    }

    showToast(`Disconnected ${provider}.`);
  };

  const handleSignOutAll = async () => {
    await Promise.allSettled([
      signOut(auth),
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }),
    ]);
    savePreferredMcAvatar(null);
    setOauthConnections({});
    setPrimaryOAuthProfile(null);
    setFirestoreConnections({});
    showToast('Signed out of SwxStudios.');
  };

  const handleDownloadResource = (resource: ResourceItem) => {
    const effectiveTier = getEffectiveResourceTier(resource);
    const unlocked = canAccessResource(resource, state.membershipTier, {
      isPremium: state.isPremium,
      purchasedIds: state.purchasedIds,
    });

    if (!unlocked) {
      openPremiumModal(resource);
      showToast(
        effectiveTier === 'ultimate'
          ? 'Ultimate required — Buy via GCash or PayPal to unlock.'
          : effectiveTier === 'paid'
          ? `Paid release (${resource.priceLabel || '$4.99'}) — Buy via GCash or PayPal to unlock.`
          : 'Premium required — Buy via GCash or PayPal to unlock.'
      );
      return;
    }

    try {
      if (resource.downloadUrl) {
        const anchor = document.createElement('a');
        anchor.href = resource.downloadUrl;
        anchor.download = resource.fileName;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else {
        const manifest = buildResourceManifest(resource);
        const blob = new Blob([manifest], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${resource.id}-manifest.yml`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Safe fallback
    }

    const xpGain = state.isPremium ? 50 : 25;
    const nextXp = state.xp + xpGain;
    setState((prev) => ({
      ...prev,
      downloadedIds: prev.downloadedIds.includes(resource.id)
        ? prev.downloadedIds
        : [resource.id, ...prev.downloadedIds],
      xp: nextXp,
    }));
    void updateDoc(doc(db, 'resources', resource.id), {
      downloads: (resource.downloads || 0) + 1,
    }).catch(() => {});
    void persistUserMetrics({ xp: nextXp }).catch(() => {});
    showToast(`Downloaded ${resource.fileName || resource.title} (+${xpGain} XP)`);
  };

  const handleToggleBookmark = (resourceId: string) => {
    setState((prev) => {
      const exists = prev.bookmarkedIds.includes(resourceId);
      return {
        ...prev,
        bookmarkedIds: exists
          ? prev.bookmarkedIds.filter((id) => id !== resourceId)
          : [resourceId, ...prev.bookmarkedIds],
      };
    });
  };

  const handleRateResource = (resourceId: string, score: number) => {
    const target = activeResources.find((item) => item.id === resourceId);
    const xpGain = state.isPremium ? 30 : 15;
    const nextXp = state.xp + xpGain;
    setState((prev) => ({
      ...prev,
      xp: nextXp,
    }));

    if (target && firebaseUser?.emailVerified) {
      const updated = applyUserRating(target, score);
      void updateDoc(doc(db, 'resources', resourceId), {
        rating: updated.rating,
        ratingCount: updated.ratingCount,
      }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `resources/${resourceId}`);
      });
    }

    void persistUserMetrics({ xp: nextXp }).catch(() => {});
    showToast(`Rating submitted (+${xpGain} XP)`);
  };

  const handleAdminUploadFile = async (file: File) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only the verified owner can upload files.');
    }
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });
    const data = (await res.json()) as {
      fileName?: string;
      fileExtension?: string;
      byteSize?: number;
      downloadUrl?: string;
      error?: string;
    };
    if (!res.ok || !data.fileName || !data.downloadUrl) {
      throw new Error(data.error || 'Archive upload failed.');
    }
    return {
      fileName: data.fileName,
      fileExtension: data.fileExtension || 'zip',
      byteSize: data.byteSize || file.size,
      downloadUrl: data.downloadUrl,
    };
  };

  const handleAdminPublishResource = async (
    draft: ResourceDraftInput,
    editingId?: string
  ) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only the verified owner can publish or edit resources.');
    }

    if (editingId) {
      const existing = activeResources.find((item) => item.id === editingId);
      const record = buildValidatedResourceRecord({
        id: editingId,
        draft,
        ownerUid: auth.currentUser.uid,
        existingDownloads: existing?.downloads ?? 0,
        existingViews: existing?.views ?? 0,
        existingPublishedAt: existing?.publishedAt || existing?.updatedAt,
        existingRating: existing?.rating ?? 0,
        existingRatingCount: existing?.ratingCount ?? 0,
      });

      try {
        await updateDoc(doc(db, 'resources', editingId), {
          title: record.title,
          subtitle: record.subtitle,
          description: record.description,
          category: record.category,
          version: record.version,
          mcVersions: record.mcVersions,
          fileSize: record.fileSize,
          author: record.author,
          publishedAt: record.publishedAt,
          updatedAt: record.updatedAt,
          popular: record.popular,
          exclusive: record.exclusive,
          tier: record.tier,
          priceLabel: record.priceLabel,
          openSource: record.openSource,
          drmFree: record.drmFree,
          unobfuscated: record.unobfuscated,
          aiMarketing: record.aiMarketing,
          aiProduct: record.aiProduct,
          resourceType: record.resourceType,
          gameModes: record.gameModes,
          supportedSoftware: record.supportedSoftware,
          supportedVersions: record.supportedVersions,
          supportedLanguages: record.supportedLanguages,
          dependencies: record.dependencies,
          changelog: record.changelog,
          demoVideoUrl: record.demoVideoUrl,
          tags: record.tags,
          artwork: record.artwork,
          accentColor: record.accentColor,
          features: record.features,
          fileName: record.fileName,
          fileExtension: record.fileExtension,
          downloadUrl: record.downloadUrl,
        });
        showToast(`Updated ${record.title}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `resources/${editingId}`);
        throw new Error('Could not update resource in Firestore.');
      }
      return;
    }

    const resourceId = buildResourceIdFromTitle(draft.title);
    const record = buildValidatedResourceRecord({
      id: resourceId,
      draft,
      ownerUid: auth.currentUser.uid,
    });

    try {
      await setDoc(doc(db, 'resources', resourceId), {
        ...record,
        createdAt: serverTimestamp(),
      });
      showToast(`Published ${record.title}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `resources/${resourceId}`);
      throw new Error('Could not save resource to Firestore.');
    }
  };

  const handleAdminDeleteResource = async (resource: ResourceItem) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only the verified owner can delete resources.');
    }

    try {
      await deleteDoc(doc(db, 'resources', resource.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `resources/${resource.id}`);
      throw new Error('Could not delete resource from Firestore.');
    }

    if (resource.downloadUrl?.startsWith('/api/files/')) {
      const parts = resource.downloadUrl.split('/');
      const storedName = parts[3];
      if (storedName) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          await fetch(`/api/admin/files/${storedName}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${idToken}` },
          });
        } catch {
          // Non-fatal file cleanup failure
        }
      }
    }

    if (selectedResourceId === resource.id) {
      setSelectedResourceId(null);
    }
    showToast(`Deleted ${resource.title}`);
  };

  const handleSaveSiteSettings = async (nextSettings: SiteSettings) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only the verified owner can update site controls.');
    }
    try {
      await setDoc(doc(db, 'settings', 'site'), {
        announcementVisible: Boolean(nextSettings.announcementVisible),
        announcementLabel: clampString(nextSettings.announcementLabel, 60) || 'SwxStudios',
        announcementText:
          clampString(nextSettings.announcementText, 240) ||
          DEFAULT_SITE_SETTINGS.announcementText,
        communityEnabled: nextSettings.communityEnabled !== false,
        heroHeadline: clampString(nextSettings.heroHeadline || '', 120),
        gcashNumber: clampString(
          nextSettings.gcashNumber || '',
          PAYMENT_BLUEPRINT_LIMITS.GCASH_NUMBER_MAX
        ),
        gcashName: clampString(
          nextSettings.gcashName || '',
          PAYMENT_BLUEPRINT_LIMITS.GCASH_NAME_MAX
        ),
        paypalEmail: clampString(
          nextSettings.paypalEmail || '',
          PAYMENT_BLUEPRINT_LIMITS.PAYPAL_EMAIL_MAX
        ),
        paypalLink: clampString(
          nextSettings.paypalLink || '',
          PAYMENT_BLUEPRINT_LIMITS.PAYPAL_LINK_MAX
        ),
        updatedBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      showToast('Site controls updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/site');
      throw new Error('Could not save site controls to Firestore.');
    }
  };

  const handleSubmitMembershipOrder = async (input: {
    plan: MembershipOrderPlan;
    paymentMethod: PaymentMethod;
    referenceCode: string;
    senderAccount: string;
    resource?: ResourceItem | null;
  }) => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      throw new Error('Please sign in and verify your email first.');
    }
    const validation = validateMembershipOrderInput(input);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    const orderId = buildMembershipOrderId(auth.currentUser.uid);
    const record = buildMembershipOrderRecord({
      orderId,
      userId: auth.currentUser.uid,
      buyerName: identity.displayName || 'SwxMember',
      input,
    });
    try {
      await setDoc(doc(db, 'membershipOrders', orderId), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(
        `${input.paymentMethod === 'gcash' ? 'GCash' : 'PayPal'} payment submitted — pending owner verification.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `membershipOrders/${orderId}`);
      throw new Error('Could not submit payment verification.');
    }
  };

  const handleResolveMembershipOrder = async (
    order: MembershipOrder,
    decision: 'approved' | 'declined'
  ) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only verified owners can approve or decline orders.');
    }
    try {
      await updateDoc(doc(db, 'membershipOrders', order.id), {
        status: decision,
        updatedAt: serverTimestamp(),
      });
      if (decision === 'approved' && isValidFirestoreId(order.userId)) {
        const userRef = doc(db, 'users', order.userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const userData = snap.data() as {
            isPremium?: boolean;
            membershipTier?: MembershipTier;
            purchasedIds?: string[];
          };
          const currentTier: MembershipTier =
            userData.membershipTier === 'ultimate'
              ? 'ultimate'
              : userData.membershipTier === 'premium' || userData.isPremium
              ? 'premium'
              : 'free';
          const nextTierState = resolveApprovedTierUpdate(currentTier, order.plan);
          const existingPurchased = Array.isArray(userData.purchasedIds)
            ? userData.purchasedIds
            : [];
          const nextPurchased =
            order.plan === 'package' &&
            order.resourceId &&
            !existingPurchased.includes(order.resourceId)
              ? [order.resourceId, ...existingPurchased].slice(0, 200)
              : existingPurchased;

          await updateDoc(userRef, {
            isPremium: nextTierState.isPremium,
            membershipTier: nextTierState.membershipTier,
            purchasedIds: nextPurchased,
            updatedAt: serverTimestamp(),
          });
          await updateDoc(doc(db, 'publicMembers', order.userId), {
            membershipTier: nextTierState.membershipTier,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
      showToast(
        decision === 'approved'
          ? `Approved ${order.buyerName}'s ${order.paymentMethod.toUpperCase()} order.`
          : `Declined ${order.buyerName}'s order.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `membershipOrders/${order.id}`);
      throw new Error('Could not update payment order status.');
    }
  };

  const handleAdminDeleteThread = async (threadId: string) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only the verified owner can remove community threads.');
    }
    try {
      await deleteDoc(doc(db, 'threads', threadId));
      showToast('Community thread removed.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `threads/${threadId}`);
      throw new Error('Could not delete community thread.');
    }
  };

  const handleOpenResourceDetail = useCallback((resource: ResourceItem) => {
    setSelectedResourceId(resource.id);
    if (isValidFirestoreId(resource.id)) {
      const nextViews = (resource.views ?? Math.max((resource.downloads || 0) * 4, 0)) + 1;
      void updateDoc(doc(db, 'resources', resource.id), {
        views: nextViews,
      }).catch(() => {});
    }
  }, []);

  const handleSurpriseMe = () => {
    const picked = pickRandomResource(activeResources, selectedResourceId ?? undefined);
    if (picked) {
      handleOpenResourceDetail(picked);
    } else {
      showToast('No resources added yet.');
    }
  };

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectPopularTerm = (term: string) => {
    setHeroQuery(term);
    setHeroCategory('all');
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  const handleHeroCategoryChange = (cat: CategoryId | 'all') => {
    setHeroCategory(cat);
    if (cat !== 'all') {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 30);
    }
  };

  const handleHeroTierChange = (tier: ResourceTierFilter) => {
    setHeroTier(tier);
    if (tier !== 'all') {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 30);
    }
  };

  const handleCreateThread = async (input: {
    title: string;
    topic: CommunityThread['topic'];
    body: string;
  }) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      showToast('Sign in with a verified account to publish threads.');
      return;
    }

    const threadId = `thread-${Date.now()}`;
    const xpGain = state.isPremium ? 60 : 30;
    const nextXp = state.xp + xpGain;

    try {
      await setDoc(doc(db, 'threads', threadId), {
        authorId: firebaseUser.uid,
        authorName: clampString(identity.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
        authorRole: state.isPremium ? 'Premium Member' : 'Member',
        title: clampString(input.title, BLUEPRINT_LIMITS.THREAD_TITLE_MAX),
        topic: input.topic,
        body: clampString(input.body, BLUEPRINT_LIMITS.THREAD_BODY_MAX),
        upvotes: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setState((prev) => ({
        ...prev,
        threadsCreatedCount: prev.threadsCreatedCount + 1,
        xp: nextXp,
      }));
      void persistUserMetrics({ xp: nextXp }).catch(() => {});
      showToast(`Thread published (+${xpGain} XP)`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `threads/${threadId}`);
    }
  };

  const handleToggleUpvote = async (threadId: string) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      showToast('Sign in with a verified account to upvote threads.');
      return;
    }
    const target = activeThreads.find((t) => t.id === threadId);
    if (!target) return;
    const nextUpvotes = target.upvotes + 1;
    try {
      await updateDoc(doc(db, 'threads', threadId), {
        upvotes: nextUpvotes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `threads/${threadId}`);
    }
  };

  const handleAddReply = async (threadId: string, content: string) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      showToast('Sign in with a verified account to reply.');
      return;
    }
    const replyId = `reply-${Date.now()}`;
    const nextXp = state.xp + 10;
    try {
      await setDoc(doc(db, 'threads', threadId, 'replies', replyId), {
        threadId,
        authorId: firebaseUser.uid,
        authorName: clampString(identity.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
        authorRole: state.isPremium ? 'Premium Member' : 'Member',
        content: clampString(content, BLUEPRINT_LIMITS.REPLY_MAX),
        createdAt: serverTimestamp(),
      });
      setState((prev) => ({ ...prev, xp: nextXp }));
      void persistUserMetrics({ xp: nextXp }).catch(() => {});
      showToast('Reply posted (+10 XP)');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `threads/${threadId}/replies/${replyId}`);
    }
  };

  const handleCreateServer = async (draft: ServerDraftInput) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      showToast('Sign in with a verified account to submit a server.');
      return;
    }

    const serverId = `srv-${Date.now()}`;
    const record = buildServerRecord({
      id: serverId,
      draft,
      submittedBy: firebaseUser.uid,
      submittedByName: identity.displayName || 'Member',
      isOwner,
    });

    try {
      await setDoc(doc(db, 'servers', serverId), {
        ...record,
        createdAt: serverTimestamp(),
      });
      showToast(
        isOwner
          ? `Published ${record.name} to Featured Servers.`
          : `Submitted ${record.name} for owner approval.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `servers/${serverId}`);
      throw new Error('Could not save server listing.');
    }
  };

  const handleVoteServer = async (serverId: string) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      showToast('Sign in with a verified account to vote for servers.');
      return;
    }
    const target = cloudServers.find((s) => s.id === serverId);
    if (!target || !target.approved) return;
    try {
      await updateDoc(doc(db, 'servers', serverId), {
        votes: target.votes + 1,
      });
      showToast(`Voted for ${target.name}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `servers/${serverId}`);
    }
  };

  const handleUpdateServerFlags = async (
    serverId: string,
    updates: { approved?: boolean; featured?: boolean }
  ) => {
    if (!auth.currentUser || !isOwner) {
      throw new Error('Only owners can approve or feature servers.');
    }
    try {
      await updateDoc(doc(db, 'servers', serverId), updates);
      showToast('Server listing updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `servers/${serverId}`);
      throw new Error('Could not update server listing.');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'servers', serverId));
      showToast('Server listing removed.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `servers/${serverId}`);
    }
  };

  const handleUpdateServerTelemetry = async (
    srv: MinecraftServerListing,
    updates: {
      tps?: number;
      mspt?: number;
      pingMs?: number;
      topPlayers?: string[];
    }
  ) => {
    const canPersistCloud =
      !srv.isBaselineLive &&
      Boolean(auth.currentUser) &&
      (isOwner || srv.submittedBy === auth.currentUser?.uid);

    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      throw new Error('Sign in with a verified account to update server metrics.');
    }

    const cleanUpdates: Record<string, unknown> = {};
    if (typeof updates.tps === 'number') cleanUpdates.tps = updates.tps;
    if (typeof updates.mspt === 'number') cleanUpdates.mspt = updates.mspt;
    if (typeof updates.pingMs === 'number') cleanUpdates.pingMs = updates.pingMs;
    if (Array.isArray(updates.topPlayers)) cleanUpdates.topPlayers = updates.topPlayers;

    if (canPersistCloud && Object.keys(cleanUpdates).length > 0) {
      try {
        await updateDoc(doc(db, 'servers', srv.id), cleanUpdates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `servers/${srv.id}`);
        throw new Error('Could not save server metrics to Firestore.');
      }
    }

    try {
      const idToken = await auth.currentUser.getIdToken();
      const topPlayersStructured = (updates.topPlayers || []).map((line) => {
        const idx = line.indexOf(':');
        if (idx === -1) return { name: line.trim(), stat: '' };
        return { name: line.slice(0, idx).trim(), stat: line.slice(idx + 1).trim() };
      });
      const res = await fetch('/api/mc/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          address: srv.address,
          tps: updates.tps,
          mspt: updates.mspt,
          avgPingMs: updates.pingMs,
          topPlayers: topPlayersStructured,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { snapshot?: ServerTelemetrySnapshot };
        if (data.snapshot) {
          setTelemetryMap((prev) => ({
            ...prev,
            [data.snapshot!.serverKey]: data.snapshot!,
          }));
        }
      }
    } catch {
      // Telemetry endpoint update is non-blocking if Firestore succeeded
    }

    showToast(`Updated live metrics for ${srv.name}.`);
  };

  const logTierCommandExecution = useCallback(
    async (params: { commandText: string; action: string; summary: string }) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) return;
      const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'tierCommands', commandId), {
          id: commandId,
          commandText: clampString(params.commandText, TIER_BLUEPRINT_LIMITS.COMMAND_MAX),
          action: clampString(params.action, 40),
          executorUid: auth.currentUser.uid,
          executorName:
            clampString(identity.displayName, TIER_BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'Staff',
          executorRole: isOwner ? 'owner' : 'admin',
          summary: clampString(params.summary, TIER_BLUEPRINT_LIMITS.SUMMARY_MAX),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `tierCommands/${commandId}`);
      }
    },
    [identity.displayName, isOwner]
  );

  const handleExecuteTierCommand = useCallback(
    async (rawCommand: string): Promise<{ ok: boolean; message: string }> => {
      const parsed = parseTierCommand(rawCommand);
      if (!parsed.ok) {
        return { ok: false, message: parsed.error };
      }

      const cmd = parsed.command;
      if (cmd.type === 'help') {
        return {
          ok: true,
          message:
            'Commands: /tier set <ign> <mode> <HT1..LT5> [region] | /tier remove <ign> <mode> | /tier peak <ign> <mode> <rank> | /tier region <ign> <NA|EU|AS|OCE|SA> | /tier delete <ign> | /tier admin add/remove <uid> | /tier seed',
        };
      }

      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        return { ok: false, message: 'Sign in with a verified account first.' };
      }

      const perm = canExecuteTierCommand(cmd, { isOwner, isTierAdmin: selfIsTierAdmin });
      if (!perm.allowed) {
        return { ok: false, message: perm.reason || 'Permission denied.' };
      }

      const actorUid = auth.currentUser.uid;
      const actorName =
        clampString(identity.displayName, TIER_BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'Staff';
      const activeList = cloudTierPlayers;

      const findExisting = (ign: string) => {
        const lower = ign.trim().toLowerCase();
        return activeList.find(
          (p) => p.ign.toLowerCase() === lower || p.id === normalizeTierPlayerId(ign)
        );
      };

      if (cmd.type === 'set') {
        const existing = findExisting(cmd.ign);
        const playerId = existing?.id || normalizeTierPlayerId(cmd.ign);
        const nextRanks: TierRanksMap = { ...(existing?.ranks || {}), [cmd.mode]: cmd.rank };
        const nextPeakRanks: TierRanksMap = { ...(existing?.peakRanks || {}) };
        const bestPeak = pickHigherTierRank(nextPeakRanks[cmd.mode], cmd.rank);
        if (bestPeak) nextPeakRanks[cmd.mode] = bestPeak;
        const nextRegion: TierRegion = cmd.region || existing?.region || 'NA';
        const nextPoints = calculateTierPoints(nextRanks);

        const docRef = doc(db, 'tierPlayers', playerId);
        try {
          const snap = await getDoc(docRef);
          const payload = {
            id: playerId,
            ign: clampString(existing?.ign || cmd.ign, TIER_BLUEPRINT_LIMITS.IGN_MAX),
            region: nextRegion,
            ranks: nextRanks,
            peakRanks: nextPeakRanks,
            points: nextPoints,
            updatedBy: actorUid,
            updatedByName: actorName,
            updatedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await updateDoc(docRef, payload);
          } else {
            await setDoc(docRef, { ...payload, createdAt: serverTimestamp() });
          }
          const summary = `Set ${payload.ign} ${cmd.mode} to ${cmd.rank} (${nextRegion}) · ${nextPoints} pts`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'set', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `tierPlayers/${playerId}`);
          return { ok: false, message: 'Failed to save tier rank update.' };
        }
      }

      if (cmd.type === 'remove') {
        const existing = findExisting(cmd.ign);
        if (!existing) {
          return { ok: false, message: `Player "${cmd.ign}" not found.` };
        }
        const playerId = existing.id;
        const nextRanks: TierRanksMap = { ...existing.ranks };
        delete nextRanks[cmd.mode];
        const nextPoints = calculateTierPoints(nextRanks);
        const docRef = doc(db, 'tierPlayers', playerId);
        try {
          const snap = await getDoc(docRef);
          const payload = {
            id: playerId,
            ign: existing.ign,
            region: existing.region,
            ranks: nextRanks,
            ...(existing.peakRanks ? { peakRanks: existing.peakRanks } : {}),
            points: nextPoints,
            updatedBy: actorUid,
            updatedByName: actorName,
            updatedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await updateDoc(docRef, payload);
          } else {
            await setDoc(docRef, { ...payload, createdAt: serverTimestamp() });
          }
          const summary = `Cleared ${cmd.mode} rank for ${existing.ign} (${nextPoints} pts)`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'remove', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tierPlayers/${playerId}`);
          return { ok: false, message: 'Failed to remove mode tier.' };
        }
      }

      if (cmd.type === 'peak') {
        const existing = findExisting(cmd.ign);
        if (!existing) {
          return { ok: false, message: `Player "${cmd.ign}" not found.` };
        }
        const playerId = existing.id;
        const nextPeakRanks: TierRanksMap = { ...(existing.peakRanks || {}), [cmd.mode]: cmd.rank };
        const docRef = doc(db, 'tierPlayers', playerId);
        try {
          const snap = await getDoc(docRef);
          const payload = {
            id: playerId,
            ign: existing.ign,
            region: existing.region,
            ranks: existing.ranks,
            peakRanks: nextPeakRanks,
            points: existing.points,
            updatedBy: actorUid,
            updatedByName: actorName,
            updatedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await updateDoc(docRef, payload);
          } else {
            await setDoc(docRef, { ...payload, createdAt: serverTimestamp() });
          }
          const summary = `Recorded peak ${cmd.mode} ${cmd.rank} for ${existing.ign}`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'peak', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tierPlayers/${playerId}`);
          return { ok: false, message: 'Failed to record peak tier.' };
        }
      }

      if (cmd.type === 'region') {
        const existing = findExisting(cmd.ign);
        if (!existing) {
          return { ok: false, message: `Player "${cmd.ign}" not found.` };
        }
        const playerId = existing.id;
        const docRef = doc(db, 'tierPlayers', playerId);
        try {
          const snap = await getDoc(docRef);
          const payload = {
            id: playerId,
            ign: existing.ign,
            region: cmd.region,
            ranks: existing.ranks,
            ...(existing.peakRanks ? { peakRanks: existing.peakRanks } : {}),
            points: existing.points,
            updatedBy: actorUid,
            updatedByName: actorName,
            updatedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await updateDoc(docRef, payload);
          } else {
            await setDoc(docRef, { ...payload, createdAt: serverTimestamp() });
          }
          const summary = `Updated region for ${existing.ign} to ${cmd.region}`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'region', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tierPlayers/${playerId}`);
          return { ok: false, message: 'Failed to update player region.' };
        }
      }

      if (cmd.type === 'delete') {
        const playerId = findExisting(cmd.ign)?.id || normalizeTierPlayerId(cmd.ign);
        try {
          await deleteDoc(doc(db, 'tierPlayers', playerId));
          const summary = `Deleted ${cmd.ign} from Tier List`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'delete', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `tierPlayers/${playerId}`);
          return { ok: false, message: 'Failed to delete player entry.' };
        }
      }

      if (cmd.type === 'admin_add') {
        try {
          await setDoc(doc(db, 'tierAdmins', cmd.targetUid), {
            uid: cmd.targetUid,
            displayName: clampString(cmd.displayName, TIER_BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'Tier Admin',
            grantedBy: actorUid,
            grantedByName: actorName,
            createdAt: serverTimestamp(),
          });
          const publicMemberRef = doc(db, 'publicMembers', cmd.targetUid);
          const publicMemberSnap = await getDoc(publicMemberRef);
          if (publicMemberSnap.exists()) {
            await updateDoc(publicMemberRef, {
              role: publicMemberSnap.data()?.role === 'owner' ? 'owner' : 'admin',
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          } else {
            const sanitizedAdmin = sanitizePublicMemberFields({
              uid: cmd.targetUid,
              displayName: cmd.displayName || 'Tier Admin',
              role: 'admin',
              membershipTier: 'free',
              xp: 0,
            });
            await setDoc(publicMemberRef, {
              ...sanitizedAdmin,
              joinedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          const summary = `Authorized Tier Admin ${cmd.displayName} (${cmd.targetUid})`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'admin_add', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `tierAdmins/${cmd.targetUid}`);
          return { ok: false, message: 'Failed to authorize Tier Admin.' };
        }
      }

      if (cmd.type === 'admin_remove') {
        try {
          await deleteDoc(doc(db, 'tierAdmins', cmd.targetUid));
          const publicMemberRef = doc(db, 'publicMembers', cmd.targetUid);
          const publicMemberSnap = await getDoc(publicMemberRef);
          if (publicMemberSnap.exists() && publicMemberSnap.data()?.role === 'admin') {
            await updateDoc(publicMemberRef, {
              role: 'member',
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          const summary = `Revoked Tier Admin role for UID ${cmd.targetUid}`;
          await logTierCommandExecution({ commandText: rawCommand, action: 'admin_remove', summary });
          showToast(summary);
          return { ok: true, message: summary };
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `tierAdmins/${cmd.targetUid}`);
          return { ok: false, message: 'Failed to revoke Tier Admin.' };
        }
      }

      if (cmd.type === 'seed') {
        return {
          ok: false,
          message: 'Starter player seeding is disabled. Add real players using /tier set <ign> <mode> <HT1..LT5> [region].',
        };
      }

      return { ok: false, message: 'Unsupported command.' };
    },
    [cloudTierPlayers, identity.displayName, isOwner, logTierCommandExecution, selfIsTierAdmin, showToast]
  );

  const handleQuickSetTier = useCallback(
    async (params: {
      ign: string;
      mode: TierModeId;
      rank: TierRank | 'REMOVE';
      region: TierRegion;
    }) => {
      const cleanIgn = params.ign.trim();
      if (params.rank === 'REMOVE') {
        return handleExecuteTierCommand(`/tier remove ${cleanIgn} ${params.mode}`);
      }
      return handleExecuteTierCommand(
        `/tier set ${cleanIgn} ${params.mode} ${params.rank} ${params.region}`
      );
    },
    [handleExecuteTierCommand]
  );

  const handleGrantTierAdmin = useCallback(
    async (uid: string, displayName: string) => {
      const cleanUid = uid.trim();
      const cleanName = displayName.trim() || 'Tier Admin';
      return handleExecuteTierCommand(`/tier admin add ${cleanUid} ${cleanName}`);
    },
    [handleExecuteTierCommand]
  );

  const handleRevokeTierAdmin = useCallback(
    async (uid: string) => {
      return handleExecuteTierCommand(`/tier admin remove ${uid.trim()}`);
    },
    [handleExecuteTierCommand]
  );

  const pendingFriendRequestsCount = useMemo(
    () => categorizeFriendships(friendships, firebaseUser?.uid).incomingRequests.length,
    [friendships, firebaseUser?.uid]
  );

  const handleSendFriendRequest = useCallback(
    async (target: PublicMemberProfile) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Sign in with a verified account to send friend requests.');
      }
      const pair = buildDeterministicFriendshipId(auth.currentUser.uid, target.uid);
      if (!pair) {
        throw new Error('Invalid recipient user ID.');
      }
      const existing = friendships.find((f) => f.id === pair.id);
      if (existing?.status === 'blocked') {
        throw new Error('Cannot send a friend request while this user is blocked.');
      }
      if (existing?.status === 'accepted') {
        showToast(`Already friends with ${target.displayName}.`);
        return;
      }
      if (existing?.status === 'pending') {
        showToast(`Friend request already pending with ${target.displayName}.`);
        return;
      }
      if (existing?.status === 'declined') {
        await deleteDoc(doc(db, 'friendships', pair.id));
      }
      const payload: Record<string, unknown> = {
        id: pair.id,
        users: pair.users,
        requesterUid: auth.currentUser.uid,
        requesterName:
          clampString(identity.displayName, RANKS_FRIENDS_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
        recipientUid: target.uid,
        recipientName:
          clampString(target.displayName, RANKS_FRIENDS_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (identity.avatarUrl) {
        payload.requesterAvatar = clampString(identity.avatarUrl, RANKS_FRIENDS_LIMITS.URL_MAX);
      }
      if (target.avatarUrl) {
        payload.recipientAvatar = clampString(target.avatarUrl, RANKS_FRIENDS_LIMITS.URL_MAX);
      }
      try {
        await setDoc(doc(db, 'friendships', pair.id), payload);
        showToast(`Friend request sent to ${target.displayName}.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `friendships/${pair.id}`);
        throw new Error('Could not send friend request.');
      }
    },
    [friendships, identity.avatarUrl, identity.displayName, showToast]
  );

  const handleRespondFriendRequest = useCallback(
    async (friendship: FriendshipRecord, decision: 'accepted' | 'declined') => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Sign in with a verified account first.');
      }
      try {
        await updateDoc(doc(db, 'friendships', friendship.id), {
          status: decision,
          updatedAt: serverTimestamp(),
        });
        showToast(
          decision === 'accepted'
            ? `Accepted friend request from ${friendship.requesterName}.`
            : `Declined friend request from ${friendship.requesterName}.`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `friendships/${friendship.id}`);
        throw new Error('Could not update friend request.');
      }
    },
    [showToast]
  );

  const handleRemoveFriendship = useCallback(
    async (friendship: FriendshipRecord) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Sign in with a verified account first.');
      }
      try {
        await deleteDoc(doc(db, 'friendships', friendship.id));
        showToast(
          friendship.status === 'blocked'
            ? 'Player unblocked.'
            : 'Friendship / request removed.'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `friendships/${friendship.id}`);
        throw new Error('Could not remove friendship.');
      }
    },
    [showToast]
  );

  const handleBlockFriend = useCallback(
    async (friendship: FriendshipRecord) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Sign in with a verified account first.');
      }
      const blockedName =
        friendship.requesterUid === auth.currentUser.uid
          ? friendship.recipientName
          : friendship.requesterName;
      try {
        await updateDoc(doc(db, 'friendships', friendship.id), {
          status: 'blocked',
          blockedBy: auth.currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        showToast(`Blocked ${blockedName}.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `friendships/${friendship.id}`);
        throw new Error('Could not block player.');
      }
    },
    [showToast]
  );

  const handleSuggestPlayer = useCallback(
    async (input: {
      ign: string;
      suggestedRank?: ServerRankId;
      suggestedMode?: TierModeId | '';
      note?: string;
    }) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Sign in with a verified account to suggest a player.');
      }
      const validation = validatePlayerSuggestionInput(input);
      if (!validation.ok) {
        throw new Error(validation.error);
      }
      const suggestionId = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const payload: Record<string, unknown> = {
        id: suggestionId,
        ign: validation.ign,
        suggestedBy: auth.currentUser.uid,
        suggestedByName:
          clampString(identity.displayName, RANKS_FRIENDS_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (validation.suggestedRank) payload.suggestedRank = validation.suggestedRank;
      if (validation.suggestedMode) payload.suggestedMode = validation.suggestedMode;
      if (validation.note) payload.note = validation.note;

      try {
        await setDoc(doc(db, 'playerSuggestions', suggestionId), payload);
        showToast(`Suggested adding player ${validation.ign}.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `playerSuggestions/${suggestionId}`);
        throw new Error('Could not submit player suggestion.');
      }
    },
    [identity.displayName, showToast]
  );

  const handleResolveSuggestion = useCallback(
    async (
      suggestion: PlayerSuggestionRecord,
      decision: 'approved' | 'declined',
      alsoAddToTierList = false
    ) => {
      if (!auth.currentUser || (!isOwner && !selfIsTierAdmin)) {
        throw new Error('Only Owners or Tier Admins can review player suggestions.');
      }
      try {
        await updateDoc(doc(db, 'playerSuggestions', suggestion.id), {
          status: decision,
          reviewedBy: auth.currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        if (decision === 'approved' && alsoAddToTierList && suggestion.suggestedMode) {
          const alreadyListed = cloudTierPlayers.some(
            (p) => p.ign.trim().toLowerCase() === suggestion.ign.trim().toLowerCase()
          );
          if (!alreadyListed) {
            await handleExecuteTierCommand(
              `/tier set ${suggestion.ign} ${suggestion.suggestedMode} LT5 NA`
            );
          }
        }
        showToast(
          decision === 'approved'
            ? `Approved player suggestion: ${suggestion.ign}.`
            : `Declined player suggestion: ${suggestion.ign}.`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `playerSuggestions/${suggestion.id}`);
        throw new Error('Could not update player suggestion.');
      }
    },
    [cloudTierPlayers, handleExecuteTierCommand, isOwner, selfIsTierAdmin, showToast]
  );

  const handleDeleteSuggestion = useCallback(
    async (suggestionId: string) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        throw new Error('Sign in with a verified account first.');
      }
      try {
        await deleteDoc(doc(db, 'playerSuggestions', suggestionId));
        showToast('Player suggestion removed.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `playerSuggestions/${suggestionId}`);
        throw new Error('Could not delete player suggestion.');
      }
    },
    [showToast]
  );

  const handleAssignMemberServerRoles = useCallback(
    async (targetUid: string, serverRank: ServerRankId, serverRoles: ServerRankId[]) => {
      if (!auth.currentUser || !isOwner) {
        throw new Error('Only the verified Studio Owner can assign Discord server ranks.');
      }
      const cleanRoles = sanitizeServerRolesList([serverRank, ...serverRoles]);
      try {
        await updateDoc(doc(db, 'publicMembers', targetUid), {
          serverRank,
          serverRoles: cleanRoles,
          updatedAt: serverTimestamp(),
        });
        showToast('Updated Discord server rank & roles.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `publicMembers/${targetUid}`);
        throw new Error('Could not update member server roles.');
      }
    },
    [isOwner, showToast]
  );

  const openTool = (toolId: ToolId, mode: 'grid' | 'workbench' = 'workbench') => {
    setActiveToolId(toolId);
    setToolsViewMode(mode);
    setActiveTab('tools');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTab = (tab: NavTab) => {
    if (tab === 'tools') {
      setToolsViewMode('grid');
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setMobileDrawerOpen((prev) => !prev);
    }
  };

  const openCategoryInDirectory = (cat: CategoryId | 'all') => {
    setHeroCategory(cat);
    setActiveTab('downloads');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (botVerifyStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] px-4 text-zinc-300">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#0d0d11] px-4 py-3 text-xs font-medium">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-rose-400" />
          <span>Checking connection security...</span>
        </div>
      </div>
    );
  }

  if (botVerifyStatus === 'required') {
    return (
      <BotVerifyGate
        rayId={verifyRayId}
        onPassed={({ rayId }) => {
          setVerifyRayId(rayId);
          setBotVerifyStatus('verified');
          showToast('Connection verified by SwxShield.');
        }}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen bg-[#08080a] text-zinc-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        sidebarCollapsed={sidebarCollapsed}
        mobileDrawerOpen={mobileDrawerOpen}
        onToggleSidebar={handleToggleSidebar}
        onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
        onSelectTab={navigateTab}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenPremium={() => openPremiumModal(null)}
        onOpenAuth={(mode = 'signin') => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onOpenAccount={() => setAccountModalOpen(true)}
        identity={identity}
        isOwner={isOwner}
        isPremium={state.isPremium}
        membershipTier={state.membershipTier}
        downloadCount={state.downloadedIds.length}
        pendingFriendRequestsCount={pendingFriendRequestsCount}
      />

      <div className="flex flex-1 min-w-0">
        <WorkspaceSidebar
          activeTab={activeTab}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
          onSelectTab={navigateTab}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenPremium={() => openPremiumModal(null)}
          onOpenAuth={(mode = 'signin') => {
            setAuthModalMode(mode);
            setAuthModalOpen(true);
          }}
          onOpenAccount={() => setAccountModalOpen(true)}
          identity={identity}
          isOwner={isOwner}
          downloadCount={state.downloadedIds.length}
          pendingFriendRequestsCount={pendingFriendRequestsCount}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 min-w-0">
            {activeTab === 'home' && (
              <>
                <AnnouncementBanner
                  visible={!state.bannerDismissed && siteSettings.announcementVisible}
                  label={siteSettings.announcementLabel}
                  message={siteSettings.announcementText}
                  onDismiss={() => setState((prev) => ({ ...prev, bannerDismissed: true }))}
                  onSeeExclusive={() => setActiveTab('exclusive')}
                />

                <HeroSection
                  query={heroQuery}
                  selectedCategory={heroCategory}
                  selectedTier={heroTier}
                  totalResourcesCount={activeResources.length}
                  threadsCount={activeThreads.length}
                  listedServersCount={approvedServers.length}
                  featuredServers={approvedServers.slice(0, 4)}
                  liveStatusMap={liveStatusMap}
                  probeRegion={probeRegion}
                  categoryCounts={categoryCounts}
                  tierCounts={tierCounts}
                  onQueryChange={setHeroQuery}
                  onCategoryChange={handleHeroCategoryChange}
                  onTierChange={handleHeroTierChange}
                  onSearchSubmit={handleHeroSearchSubmit}
                  onSelectPopularTerm={handleSelectPopularTerm}
                  onSurpriseMe={handleSurpriseMe}
                  onBrowseEverything={() => openCategoryInDirectory('all')}
                  onRefreshServer={(srv) => void checkServerLiveStatus(srv, true)}
                  onOpenServers={() => navigateTab('servers')}
                  onOpenMotdTool={() => openTool('motd', 'workbench')}
                />

                <SiteStatsHomeStrip
                  overview={studioStatsOverview}
                  cloudConnected={metricsSynced}
                  onOpenFullStats={() => navigateTab('stats')}
                />

            {/* Active Search / Category Filter Results */}
            {hasActiveHomeFilter && (
              <section
                ref={resultsRef}
                aria-label="Filtered search results"
                className="mx-auto mt-8 max-w-[1200px] px-4 sm:px-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {heroTier !== 'all' && heroCategory === 'all'
                        ? `${heroTier.charAt(0).toUpperCase() + heroTier.slice(1)} Resources`
                        : heroCategory !== 'all'
                        ? `${CATEGORIES.find((c) => c.id === heroCategory)?.label ?? heroCategory} Results`
                        : 'Search Results'}
                      <span className="ml-2 text-sm font-normal text-zinc-400 tabular-nums">
                        ({filteredHomeResults.length})
                      </span>
                    </h2>
                    {heroQuery.trim() && (
                      <p className="text-xs text-zinc-400">
                        Matching &ldquo;{heroQuery.trim()}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHeroQuery('');
                        setHeroCategory('all');
                        setHeroTier('all');
                      }}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
                    >
                      Clear filter
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('downloads')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-200 hover:text-white"
                    >
                      <span>Open directory</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {filteredHomeResults.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-[#111114] p-8 text-center">
                    <p className="text-sm font-semibold text-zinc-200">
                      No matching resources found.
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Try another tier, category, or keyword like lifesteal or skyblock.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {filteredHomeResults.map((item, idx) => (
                      <ResourceCard
                        key={item.id}
                        resource={item}
                        variant="catalog"
                        rankIndex={idx + 1}
                        isPremium={state.isPremium}
                        membershipTier={state.membershipTier}
                        purchasedIds={state.purchasedIds}
                        onSelect={handleOpenResourceDetail}
                        onDownload={handleDownloadResource}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Most Downloaded */}
            <section className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Most downloaded
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Popular plugins and server setups this week.
                  </p>
                </div>
              </div>

              {trendingResources.length === 0 ? (
                <div className="py-5 text-xs text-zinc-500">
                  No trending packages yet.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {trendingResources.map((item) => (
                    <ResourceCard
                      key={item.id}
                      resource={item}
                      variant="trending"
                      isPremium={state.isPremium}
                      membershipTier={state.membershipTier}
                      purchasedIds={state.purchasedIds}
                      onSelect={handleOpenResourceDetail}
                      onDownload={handleDownloadResource}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Sponsor Ad Slot */}
            <section className="mx-auto mt-6 max-w-[1200px] px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setSponsorOpen(true)}
                className="flex w-full items-center justify-between gap-4 rounded-md border border-dashed border-zinc-800 bg-[#0c0c10] px-4 py-3 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <span>
                  Sponsored placement available for server hosts and studios
                </span>
                <span className="font-display-mono shrink-0 font-semibold text-zinc-200 tabular-nums">
                  $3.00 / wk
                </span>
              </button>
            </section>

            {/* Latest Plugins */}
            <section className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Latest plugins
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Paper, Spigot, and Folia jars ordered by recent updates.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openCategoryInDirectory('plugins')}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-300 whitespace-nowrap hover:text-white"
                >
                  <span>View all</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {latestPlugins.length === 0 ? (
                <div className="py-5 text-xs text-zinc-500">
                  0 plugins added yet.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {latestPlugins.map((item, idx) => (
                    <ResourceCard
                      key={item.id}
                      resource={item}
                      variant="catalog"
                      rankIndex={idx + 1}
                      isPremium={state.isPremium}
                      membershipTier={state.membershipTier}
                      purchasedIds={state.purchasedIds}
                      onSelect={handleOpenResourceDetail}
                      onDownload={handleDownloadResource}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Latest Models */}
            <section className="mx-auto mt-8 max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Latest models
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Custom item packs, boss models, and HUD resource bundles.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openCategoryInDirectory('models')}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-300 whitespace-nowrap hover:text-white"
                >
                  <span>View all</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {latestModels.length === 0 ? (
                <div className="py-5 text-xs text-zinc-500">
                  0 models added yet.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {latestModels.map((item, idx) => (
                    <ResourceCard
                      key={item.id}
                      resource={item}
                      variant="catalog"
                      rankIndex={idx + 1}
                      isPremium={state.isPremium}
                      membershipTier={state.membershipTier}
                      purchasedIds={state.purchasedIds}
                      onSelect={handleOpenResourceDetail}
                      onDownload={handleDownloadResource}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Latest Configs */}
            <section className="mx-auto mt-8 max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Latest configs
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Drop-in server configurations, menus, and crates setups.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openCategoryInDirectory('configs')}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-300 whitespace-nowrap hover:text-white"
                >
                  <span>View all</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {latestConfigs.length === 0 ? (
                <div className="py-5 text-xs text-zinc-500">
                  0 configs added yet.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {latestConfigs.map((item, idx) => (
                    <ResourceCard
                      key={item.id}
                      resource={item}
                      variant="catalog"
                      rankIndex={idx + 1}
                      isPremium={state.isPremium}
                      membershipTier={state.membershipTier}
                      purchasedIds={state.purchasedIds}
                      onSelect={handleOpenResourceDetail}
                      onDownload={handleDownloadResource}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Minecraft Server & Developer Tools Strip */}
            <section className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight text-white">
                    Server utilities &amp; calculators
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {TOOL_DIRECTORY.length} interactive Minecraft tools: MOTD &amp; Text Font generators, Command builder, Seed map, JAR scanner, Skin viewer, and Spark analyzer.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('guides');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-400 whitespace-nowrap hover:text-rose-300"
                  >
                    <span>Server Guides</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTool('motd', 'grid')}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-400 whitespace-nowrap hover:text-rose-300"
                  >
                    <span>All {TOOL_DIRECTORY.length} tools</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TOOL_DIRECTORY.slice(0, 6).map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => openTool(tool.id)}
                    className="group rounded-lg border border-zinc-800/90 bg-[#111114] p-4 text-left transition-colors hover:border-rose-500/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white group-hover:text-rose-200">
                        {tool.title}
                      </span>
                      <span className="font-display-mono text-[10px] text-rose-400/90">
                        {tool.categoryLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">
                      {tool.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Featured Servers Strip */}
            <section className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Featured servers
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Community-submitted and studio-verified Java, Bedrock, and Crossplay servers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('servers');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-300 whitespace-nowrap hover:text-white"
                >
                  <span>Server directory</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {approvedServers.length === 0 ? (
                <div className="py-5 text-xs text-zinc-500">
                  0 servers listed yet — submit yours in the Server Directory.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {approvedServers.slice(0, 4).map((srv) => {
                    const live = liveStatusMap[srv.id];
                    const telemetry = telemetryMap[srv.address.trim().toLowerCase()];
                    const livePing =
                      live?.online && typeof live.pingMs === 'number'
                        ? live.pingMs
                        : typeof telemetry?.avgPingMs === 'number'
                        ? telemetry.avgPingMs
                        : srv.pingMs;
                    const liveTps =
                      typeof telemetry?.tps === 'number' ? telemetry.tps : srv.tps;

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => {
                          setSelectedServerId(srv.id);
                          setActiveTab('servers');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="rounded-lg border border-zinc-800/90 bg-[#111114] p-4 text-left transition-colors hover:border-zinc-600"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-200">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                live?.loading
                                  ? 'bg-amber-400 animate-pulse'
                                  : live?.online === true
                                  ? 'bg-emerald-400'
                                  : live?.online === false
                                  ? 'bg-red-400'
                                  : 'bg-zinc-500'
                              }`}
                            />
                            {live?.loading
                              ? 'Pinging'
                              : live?.online === true
                              ? 'Online'
                              : live?.online === false
                              ? 'Offline'
                              : srv.edition}
                          </span>
                          <span className="font-display-mono text-zinc-400 tabular-nums">
                            {live?.online
                              ? `${live.playersOnline.toLocaleString()}/${live.playersMax.toLocaleString()}`
                              : srv.version}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-2.5">
                          {live?.iconBase64 && (
                            <img
                              src={live.iconBase64}
                              alt={`${srv.name} icon`}
                              className="h-7 w-7 shrink-0 rounded border border-zinc-800"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{srv.name}</p>
                            <p className="truncate font-display-mono text-[11px] text-zinc-400">
                              {srv.address}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/70 pt-2 font-display-mono text-[11px] text-zinc-400 tabular-nums">
                          <span>
                            {typeof livePing === 'number' ? `${livePing}ms ping` : srv.edition}
                          </span>
                          <span>
                            {typeof liveTps === 'number' ? `${liveTps.toFixed(1)} TPS` : srv.version}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'tools' && (
          <ToolsView
            initialTool={activeToolId}
            initialMode={toolsViewMode}
            onNotify={showToast}
          />
        )}

        {activeTab === 'servers' && (
          <ServersView
            servers={allDirectoryServers}
            liveStatusMap={liveStatusMap}
            telemetryMap={telemetryMap}
            probeRegion={probeRegion}
            onProbeRegionChange={(nextRegion) => {
              setProbeRegion(nextRegion);
              homePingTriggeredRef.current.clear();
              void Promise.all(
                allDirectoryServers.map((srv) => checkServerLiveStatus(srv, true, nextRegion))
              );
            }}
            canPost={Boolean(firebaseUser?.emailVerified)}
            isOwner={isOwner}
            currentUid={firebaseUser?.uid ?? null}
            initialSelectedServerId={selectedServerId}
            onClearInitialSelected={() => setSelectedServerId(null)}
            onRequireAuth={() => {
              if (firebaseUser && !firebaseUser.emailVerified) {
                setAccountModalOpen(true);
              } else {
                setAuthModalMode('signin');
                setAuthModalOpen(true);
              }
            }}
            onCheckLiveStatus={checkServerLiveStatus}
            onRefreshAllLive={refreshAllServersLive}
            onCreateServer={handleCreateServer}
            onUpdateServerTelemetry={handleUpdateServerTelemetry}
            onVoteServer={handleVoteServer}
            onUpdateServerFlags={handleUpdateServerFlags}
            onDeleteServer={handleDeleteServer}
            onCopyAddress={(address) => showToast(`Copied server IP: ${address}`)}
          />
        )}

        {activeTab === 'tiers' && (
          <TiersView
            players={cloudTierPlayers}
            publicMembers={publicMembers}
            tierAdmins={tierAdmins}
            commandLogs={tierCommandLogs}
            isOwner={isOwner}
            isTierAdmin={selfIsTierAdmin}
            isSignedIn={Boolean(firebaseUser)}
            emailVerified={Boolean(firebaseUser?.emailVerified)}
            currentUid={firebaseUser?.uid ?? null}
            currentDisplayName={identity.displayName}
            usingCloudData={cloudTierPlayers.length > 0}
            onRequireAuth={() => {
              if (firebaseUser && !firebaseUser.emailVerified) {
                setAccountModalOpen(true);
              } else {
                setAuthModalMode('signin');
                setAuthModalOpen(true);
              }
            }}
            onOpenRanks={() => navigateTab('ranks')}
            onExecuteCommand={handleExecuteTierCommand}
            onQuickSetTier={handleQuickSetTier}
            onGrantAdmin={handleGrantTierAdmin}
            onRevokeAdmin={handleRevokeTierAdmin}
          />
        )}

        {activeTab === 'ranks' && (
          <RanksAndFriendsView
            members={publicMembers}
            tierAdmins={tierAdmins}
            tierPlayers={cloudTierPlayers}
            friendships={friendships}
            suggestions={playerSuggestions}
            isSignedIn={Boolean(firebaseUser)}
            emailVerified={Boolean(firebaseUser?.emailVerified)}
            isOwner={isOwner}
            isTierAdmin={selfIsTierAdmin}
            currentUid={firebaseUser?.uid ?? null}
            currentDisplayName={identity.displayName}
            onRequireAuth={() => {
              if (firebaseUser && !firebaseUser.emailVerified) {
                setAccountModalOpen(true);
              } else {
                setAuthModalMode('signin');
                setAuthModalOpen(true);
              }
            }}
            onSendFriendRequest={handleSendFriendRequest}
            onRespondFriendRequest={handleRespondFriendRequest}
            onRemoveFriendship={handleRemoveFriendship}
            onBlockFriend={handleBlockFriend}
            onSuggestPlayer={handleSuggestPlayer}
            onResolveSuggestion={handleResolveSuggestion}
            onDeleteSuggestion={handleDeleteSuggestion}
            onAssignMemberServerRoles={handleAssignMemberServerRoles}
            onOpenTiers={() => navigateTab('tiers')}
          />
        )}

        {activeTab === 'guides' && <GuidesView onNotify={showToast} />}

        {activeTab === 'stats' && (
          <SiteStatsView
            overview={studioStatsOverview}
            cloudConnected={metricsSynced}
            isSignedIn={Boolean(firebaseUser)}
            onSelectTab={navigateTab}
            onOpenCategory={(cat) => openCategoryInDirectory(cat)}
            onRequireAuth={() => {
              if (firebaseUser && !firebaseUser.emailVerified) {
                setAccountModalOpen(true);
              } else {
                setAuthModalMode('signin');
                setAuthModalOpen(true);
              }
            }}
          />
        )}

        {activeTab === 'downloads' && (
          <DownloadsView
            resources={activeResources}
            downloadedIds={state.downloadedIds}
            bookmarkedIds={state.bookmarkedIds}
            isPremium={state.isPremium}
            membershipTier={state.membershipTier}
            purchasedIds={state.purchasedIds}
            initialCategory={heroCategory}
            initialTier={heroTier}
            initialQuery={heroQuery}
            onSelectResource={handleOpenResourceDetail}
            onDownloadResource={handleDownloadResource}
          />
        )}

        {activeTab === 'exclusive' && (
          <ExclusiveView
            resources={activeResources}
            isPremium={state.isPremium}
            membershipTier={state.membershipTier}
            purchasedIds={state.purchasedIds}
            onSelectResource={handleOpenResourceDetail}
            onDownloadResource={handleDownloadResource}
            onOpenPremium={() => openPremiumModal(null)}
          />
        )}

        {activeTab === 'community' && (
          <CommunityView
            threads={activeThreads}
            canPost={Boolean(firebaseUser?.emailVerified)}
            communityEnabled={siteSettings.communityEnabled}
            onRequireAuth={() => {
              if (firebaseUser && !firebaseUser.emailVerified) {
                setAccountModalOpen(true);
              } else {
                setAuthModalMode('signin');
                setAuthModalOpen(true);
              }
            }}
            onCreateThread={handleCreateThread}
            onToggleUpvote={handleToggleUpvote}
            onAddReply={handleAddReply}
          />
        )}

        {activeTab === 'levels' && (
          <LevelsView
            xp={state.xp}
            downloadedCount={state.downloadedIds.length}
            threadsCreatedCount={state.threadsCreatedCount}
            isPremium={state.isPremium}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanelView
            isOwner={isOwner}
            isSignedIn={Boolean(firebaseUser)}
            ownerDisplayName={identity.displayName}
            ownerEmail={firebaseUser?.email}
            resources={activeResources}
            threads={activeThreads}
            servers={cloudServers}
            membershipOrders={membershipOrders}
            siteSettings={siteSettings}
            onRequireSignIn={() => {
              setAuthModalMode('signin');
              setAuthModalOpen(true);
            }}
            onReturnHome={() => {
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenTiersConsole={() => navigateTab('tiers')}
            onUploadFile={handleAdminUploadFile}
            onPublishResource={handleAdminPublishResource}
            onDeleteResource={handleAdminDeleteResource}
            onDownloadResource={handleDownloadResource}
            onSaveSiteSettings={handleSaveSiteSettings}
            onDeleteThread={handleAdminDeleteThread}
            onUpdateServerFlags={handleUpdateServerFlags}
            onDeleteServer={handleDeleteServer}
            onResolveMembershipOrder={handleResolveMembershipOrder}
          />
        )}
      </main>

      <Footer
        onSelectTab={navigateTab}
        onOpenSponsor={() => setSponsorOpen(true)}
        verifyRayId={verifyRayId}
        onResetBotVerify={async () => {
          try {
            await fetch('/api/verify/reset', { method: 'POST', credentials: 'include' });
          } catch {
            // Proceed to show challenge gate locally even on transient error
          }
          setVerifyRayId(generateRayId('swx-reset'));
          setBotVerifyStatus('required');
        }}
      />
        </div>
      </div>

      {/* Modals */}
      <ResourceModal
        resource={selectedResource}
        isPremium={state.isPremium}
        membershipTier={state.membershipTier}
        purchasedIds={state.purchasedIds}
        isBookmarked={
          selectedResource ? state.bookmarkedIds.includes(selectedResource.id) : false
        }
        hasDownloaded={
          selectedResource ? state.downloadedIds.includes(selectedResource.id) : false
        }
        onClose={() => setSelectedResourceId(null)}
        onDownload={handleDownloadResource}
        onToggleBookmark={handleToggleBookmark}
        onRate={handleRateResource}
        onOpenPremium={() => {
          const current = selectedResource;
          setSelectedResourceId(null);
          openPremiumModal(current);
        }}
      />

      <CommandSearchModal
        open={searchOpen}
        resources={activeResources}
        onClose={() => setSearchOpen(false)}
        onSelectResource={handleOpenResourceDetail}
        onSelectTool={(id) => openTool(id, 'workbench')}
        onOpenTiers={() => navigateTab('tiers')}
        onOpenRanks={() => navigateTab('ranks')}
        onOpenStats={() => navigateTab('stats')}
      />

      <PremiumModal
        open={premiumOpen}
        isPremium={state.isPremium}
        membershipTier={state.membershipTier}
        isOwner={isOwner}
        isSignedIn={Boolean(firebaseUser)}
        emailVerified={Boolean(firebaseUser?.emailVerified)}
        siteSettings={siteSettings}
        pendingResource={pendingPurchaseResource}
        orders={membershipOrders.filter((ord) => ord.userId === firebaseUser?.uid)}
        onClose={() => {
          setPremiumOpen(false);
          setPendingPurchaseResource(null);
        }}
        onSubmitOrder={handleSubmitMembershipOrder}
        onRequireSignIn={() => {
          setAuthModalMode('signin');
          setAuthModalOpen(true);
        }}
        onOpenAccount={() => setAccountModalOpen(true)}
        onSelectMembershipTier={(tier) => {
          if (!canSelfSwitchTier(isOwner)) return;
          const active = tier !== 'free';
          setState((prev) => ({
            ...prev,
            membershipTier: tier,
            isPremium: active,
          }));
          showToast(
            tier === 'ultimate'
              ? 'Owner Preview: Ultimate unlocked.'
              : tier === 'premium'
              ? 'Owner Preview: Premium unlocked.'
              : 'Owner Preview: Switched to Free tier.'
          );
        }}
        onTogglePremium={(active) => {
          if (!canSelfSwitchTier(isOwner)) return;
          const nextTier: MembershipTier = active ? 'premium' : 'free';
          setState((prev) => ({
            ...prev,
            membershipTier: nextTier,
            isPremium: active,
          }));
          showToast(
            active
              ? 'Owner Preview: Premium unlocked.'
              : 'Owner Preview: Switched to Free tier.'
          );
        }}
      />

      <SponsorModal open={sponsorOpen} onClose={() => setSponsorOpen(false)} />

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        oauthStatuses={oauthStatuses}
        botVerified={botVerifyStatus === 'verified'}
        onBotVerified={({ rayId }) => {
          setVerifyRayId(rayId);
          setBotVerifyStatus('verified');
        }}
        onClose={() => setAuthModalOpen(false)}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
        onSendPasswordReset={handleSendPasswordReset}
        onFirebaseProviderAuth={handleFirebaseProviderAuth}
        onOAuthPopupAuth={handleOAuthPopupAuth}
      />

      <AccountModal
        open={accountModalOpen}
        identity={identity}
        connectedAccounts={connectedAccounts}
        oauthStatuses={oauthStatuses}
        xp={state.xp}
        isPremium={state.isPremium}
        onClose={() => setAccountModalOpen(false)}
        onSignOut={handleSignOutAll}
        onResendVerification={async () => {
          if (!auth.currentUser) return;
          try {
            await sendEmailVerification(auth.currentUser);
          } catch (error) {
            throw new Error(mapFirebaseAuthError(error));
          }
        }}
        onRefreshVerification={async () => {
          if (!auth.currentUser) return;
          await reload(auth.currentUser);
          setAuthVersion((v) => v + 1);
          if (auth.currentUser.emailVerified) {
            showToast('Email verified — Cloud sync enabled.');
          } else {
            showToast('Email is not verified yet.');
          }
        }}
        onUpdateDisplayName={async (nextName) => {
          if (!auth.currentUser) return;
          const clean = clampString(nextName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
          await updateProfile(auth.currentUser, { displayName: clean });
          setAuthVersion((v) => v + 1);
          await persistUserMetrics({ displayName: clean });
          showToast('Display name saved.');
        }}
        onUpdateAvatarUrl={async (nextAvatarUrl) => {
          const cleanAvatar = savePreferredMcAvatar(nextAvatarUrl);
          if (!auth.currentUser || !cleanAvatar) return;
          await updateProfile(auth.currentUser, { photoURL: cleanAvatar });
          setAuthVersion((v) => v + 1);
          await persistUserMetrics({ avatarUrl: cleanAvatar });
          showToast('Minecraft skin head avatar saved.');
        }}
        onOpenSkinViewer={() => {
          setAccountModalOpen(false);
          openTool('skin', 'workbench');
        }}
        onConnectProvider={handleConnectFromAccount}
        onDisconnectProvider={handleDisconnectProvider}
        isOwner={isOwner}
        onOpenAdminPanel={() => {
          setAccountModalOpen(false);
          setActiveTab('admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Subtle Action Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-100 shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
