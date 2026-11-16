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
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AccountModal } from './components/AccountModal';
import { AdminPanelView } from './components/AdminPanelView';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { AuthModal } from './components/AuthModal';
import { CommandSearchModal } from './components/CommandSearchModal';
import { CommunityView } from './components/CommunityView';
import { DownloadsView } from './components/DownloadsView';
import { ExclusiveView } from './components/ExclusiveView';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { LevelsView } from './components/LevelsView';
import { Navbar } from './components/Navbar';
import { PremiumModal } from './components/PremiumModal';
import { ResourceCard } from './components/ResourceCard';
import { ResourceModal } from './components/ResourceModal';
import { SponsorModal } from './components/SponsorModal';
import { CATEGORIES, INITIAL_RESOURCES, INITIAL_THREADS } from './data/catalog';
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
  MembershipTier,
  NavTab,
  OAuthProviderStatus,
  ResourceItem,
  ResourceTierFilter,
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

const STORAGE_KEY = 'swxstudios_state_v2';

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  announcementVisible: true,
  announcementLabel: 'Premium & Ultimate',
  announcementText:
    'Free, Paid, Popular, Premium, and Ultimate releases verified for Minecraft servers.',
  communityEnabled: true,
  heroHeadline: '',
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
        const legacyPremium = Boolean(parsed.isPremium);
        const resolvedMembership: MembershipTier =
          parsed.membershipTier === 'ultimate' ||
          parsed.membershipTier === 'premium' ||
          parsed.membershipTier === 'free'
            ? parsed.membershipTier
            : legacyPremium
            ? 'premium'
            : 'free';
        return {
          resources: parsed.resources,
          threads: Array.isArray(parsed.threads) ? parsed.threads : INITIAL_THREADS,
          downloadedIds: Array.isArray(parsed.downloadedIds) ? parsed.downloadedIds : [],
          bookmarkedIds: Array.isArray(parsed.bookmarkedIds) ? parsed.bookmarkedIds : [],
          purchasedIds: Array.isArray(parsed.purchasedIds) ? parsed.purchasedIds : [],
          isPremium: resolvedMembership !== 'free',
          membershipTier: resolvedMembership,
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

  // Modals
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [accountModalOpen, setAccountModalOpen] = useState(false);

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
  const [firestoreConnections, setFirestoreConnections] = useState<
    Partial<Record<AuthProviderId, ConnectedAccountInfo>>
  >({});
  const [cloudThreads, setCloudThreads] = useState<CommunityThread[]>([]);
  const [cloudResources, setCloudResources] = useState<ResourceItem[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

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
            isPremium: state.isPremium,
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
        const data = snap.data() as { xp?: number; isPremium?: boolean };
        setState((prev) => {
          const nextIsPremium =
            typeof data.isPremium === 'boolean' ? data.isPremium : prev.isPremium;
          const nextTier: MembershipTier = !nextIsPremium
            ? 'free'
            : prev.membershipTier === 'ultimate'
            ? 'ultimate'
            : 'premium';
          return {
            ...prev,
            xp: typeof data.xp === 'number' ? Math.max(prev.xp, data.xp) : prev.xp,
            isPremium: nextIsPremium,
            membershipTier: nextTier,
          };
        });
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
      }),
    [firebaseUser, primaryOAuthProfile]
  );

  const isOwner = useMemo(
    () => isOwnerAccount(firebaseUser?.email, Boolean(firebaseUser?.emailVerified)),
    [firebaseUser]
  );

  const activeThreads = cloudThreads.length > 0 ? cloudThreads : state.threads;
  const activeResources = cloudResources;

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
    async (updates: { xp?: number; isPremium?: boolean; displayName?: string }) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) return;
      const uid = auth.currentUser.uid;
      try {
        await updateDoc(doc(db, 'users', uid), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    },
    []
  );

  // Auth Actions
  const handleEmailSignIn = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      showToast(
        cred.user.emailVerified
          ? `Welcome back, ${cred.user.displayName || email}`
          : 'Signed in. Verify your email in Account settings to sync cloud data.'
      );
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const handleEmailSignUp = async (displayName: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, {
        displayName: clampString(displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
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

  const handleFirebaseProviderAuth = async (providerId: 'google' | 'microsoft') => {
    const provider = providerId === 'google' ? googleProvider : microsoftProvider;
    try {
      const cred = await signInWithPopup(auth, provider);
      showToast(`Signed in as ${cred.user.displayName || cred.user.email || providerId}`);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const handleOAuthPopupAuth = async (provider: 'discord' | 'github' | 'twitch') => {
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

    if (!unlocked && (effectiveTier === 'premium' || effectiveTier === 'ultimate')) {
      setPremiumOpen(true);
      return;
    }

    const newlyUnlockedPaid = !unlocked && effectiveTier === 'paid';

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
      purchasedIds: newlyUnlockedPaid
        ? [resource.id, ...prev.purchasedIds]
        : prev.purchasedIds,
      downloadedIds: prev.downloadedIds.includes(resource.id)
        ? prev.downloadedIds
        : [resource.id, ...prev.downloadedIds],
      xp: nextXp,
    }));
    void updateDoc(doc(db, 'resources', resource.id), {
      downloads: (resource.downloads || 0) + 1,
    }).catch(() => {});
    void persistUserMetrics({ xp: nextXp }).catch(() => {});
    showToast(
      newlyUnlockedPaid
        ? `Unlocked ${resource.priceLabel || 'Paid'} build — downloading ${resource.fileName || resource.title} (+${xpGain} XP)`
        : `Downloaded ${resource.fileName || resource.title} (+${xpGain} XP)`
    );
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
        updatedBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      showToast('Site controls updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/site');
      throw new Error('Could not save site controls to Firestore.');
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

  const openCategoryInDirectory = (cat: CategoryId | 'all') => {
    setHeroCategory(cat);
    setActiveTab('downloads');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div id="top" className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenPremium={() => setPremiumOpen(true)}
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
      />

      <main className="flex-1">
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
              categoryCounts={categoryCounts}
              tierCounts={tierCounts}
              onQueryChange={setHeroQuery}
              onCategoryChange={handleHeroCategoryChange}
              onTierChange={handleHeroTierChange}
              onSearchSubmit={handleHeroSearchSubmit}
              onSelectPopularTerm={handleSelectPopularTerm}
              onSurpriseMe={handleSurpriseMe}
              onBrowseEverything={() => openCategoryInDirectory('all')}
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
          </>
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
            onOpenPremium={() => setPremiumOpen(true)}
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
            siteSettings={siteSettings}
            onRequireSignIn={() => {
              setAuthModalMode('signin');
              setAuthModalOpen(true);
            }}
            onReturnHome={() => {
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onUploadFile={handleAdminUploadFile}
            onPublishResource={handleAdminPublishResource}
            onDeleteResource={handleAdminDeleteResource}
            onDownloadResource={handleDownloadResource}
            onSaveSiteSettings={handleSaveSiteSettings}
            onDeleteThread={handleAdminDeleteThread}
          />
        )}
      </main>

      <Footer
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSponsor={() => setSponsorOpen(true)}
      />

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
          setSelectedResourceId(null);
          setPremiumOpen(true);
        }}
      />

      <CommandSearchModal
        open={searchOpen}
        resources={activeResources}
        onClose={() => setSearchOpen(false)}
        onSelectResource={handleOpenResourceDetail}
      />

      <PremiumModal
        open={premiumOpen}
        isPremium={state.isPremium}
        membershipTier={state.membershipTier}
        onClose={() => setPremiumOpen(false)}
        onSelectMembershipTier={(tier) => {
          const active = tier !== 'free';
          setState((prev) => ({
            ...prev,
            membershipTier: tier,
            isPremium: active,
          }));
          void persistUserMetrics({ isPremium: active }).catch(() => {});
          showToast(
            tier === 'ultimate'
              ? 'SwxStudios Ultimate activated — Premium, Paid & Ultimate Vault unlocked.'
              : tier === 'premium'
              ? 'SwxStudios Premium activated — Premium vault unlocked.'
              : 'Switched back to Free tier.'
          );
        }}
        onTogglePremium={(active) => {
          const nextTier: MembershipTier = active ? 'premium' : 'free';
          setState((prev) => ({
            ...prev,
            membershipTier: nextTier,
            isPremium: active,
          }));
          void persistUserMetrics({ isPremium: active }).catch(() => {});
          showToast(
            active
              ? 'SwxStudios Premium activated — Exclusive vault unlocked.'
              : 'Premium preview deactivated.'
          );
        }}
      />

      <SponsorModal open={sponsorOpen} onClose={() => setSponsorOpen(false)} />

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        oauthStatuses={oauthStatuses}
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
