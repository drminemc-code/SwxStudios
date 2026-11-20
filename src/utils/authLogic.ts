import { AuthProviderId, ConnectedAccountInfo, DisplayIdentity } from '../types';

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 80,
  EMAIL_MIN: 3,
  EMAIL_MAX: 254,
  USERNAME_MAX: 100,
  URL_MAX: 500,
  THREAD_TITLE_MIN: 3,
  THREAD_TITLE_MAX: 160,
  THREAD_BODY_MIN: 3,
  THREAD_BODY_MAX: 3000,
  REPLY_MAX: 2000,
  PASSWORD_MIN: 6,
} as const;

export interface ProviderMetadata {
  id: AuthProviderId;
  label: string;
  shortLabel: string;
  mechanism: 'firebase' | 'oauth_popup';
  description: string;
  accentHex: string;
}

export const AUTH_PROVIDERS: ProviderMetadata[] = [
  {
    id: 'google',
    label: 'Google',
    shortLabel: 'Google',
    mechanism: 'firebase',
    description: 'Sign in & sync cloud profile',
    accentHex: '#ffffff',
  },
  {
    id: 'discord',
    label: 'Discord',
    shortLabel: 'Discord',
    mechanism: 'oauth_popup',
    description: 'Connect Discord handle & avatar',
    accentHex: '#5865F2',
  },
  {
    id: 'github',
    label: 'GitHub',
    shortLabel: 'GitHub',
    mechanism: 'oauth_popup',
    description: 'Link developer profile & repos',
    accentHex: '#e4e4e7',
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    shortLabel: 'Microsoft',
    mechanism: 'firebase',
    description: 'Minecraft & Xbox identity',
    accentHex: '#00A4EF',
  },
  {
    id: 'twitch',
    label: 'Twitch',
    shortLabel: 'Twitch',
    mechanism: 'oauth_popup',
    description: 'Creator & streamer badge sync',
    accentHex: '#9146FF',
  },
];

export function clampString(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function isValidFirestoreId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_LIMITS.ID_MAX &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

export function validateEmail(email: string): string | null {
  const clean = email.trim();
  if (clean.length < BLUEPRINT_LIMITS.EMAIL_MIN || clean.length > BLUEPRINT_LIMITS.EMAIL_MAX) {
    return 'Enter a valid email address.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return 'Enter a valid email address format.';
  }
  return null;
}

export function validateSignUpInput(input: {
  displayName: string;
  email: string;
  password: string;
}): string | null {
  const name = input.displayName.trim();
  if (name.length < 2) {
    return 'Username must be at least 2 characters.';
  }
  if (name.length > BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) {
    return `Username must be ${BLUEPRINT_LIMITS.DISPLAY_NAME_MAX} characters or fewer.`;
  }
  const emailErr = validateEmail(input.email);
  if (emailErr) return emailErr;
  if (input.password.length < BLUEPRINT_LIMITS.PASSWORD_MIN) {
    return `Password must be at least ${BLUEPRINT_LIMITS.PASSWORD_MIN} characters.`;
  }
  return null;
}

export function validateSignInInput(input: {
  email: string;
  password: string;
}): string | null {
  const emailErr = validateEmail(input.email);
  if (emailErr) return emailErr;
  if (!input.password) {
    return 'Please enter your password.';
  }
  return null;
}

export function computeInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'SW';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function mapFirebaseProviderId(firebaseProviderId: string): AuthProviderId | null {
  switch (firebaseProviderId) {
    case 'google.com':
      return 'google';
    case 'microsoft.com':
      return 'microsoft';
    case 'github.com':
      return 'github';
    default:
      return null;
  }
}

export interface FirebaseProviderSnapshot {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export function mergeConnectedAccounts(params: {
  firebaseProviders: FirebaseProviderSnapshot[];
  oauthConnections: Partial<Record<AuthProviderId, ConnectedAccountInfo>>;
  firestoreConnections: Partial<Record<AuthProviderId, ConnectedAccountInfo>>;
}): Partial<Record<AuthProviderId, ConnectedAccountInfo>> {
  const merged: Partial<Record<AuthProviderId, ConnectedAccountInfo>> = {
    ...params.firestoreConnections,
    ...params.oauthConnections,
  };

  for (const fp of params.firebaseProviders) {
    const mapped = mapFirebaseProviderId(fp.providerId);
    if (!mapped) continue;
    const usernameFallback = fp.email ? fp.email.split('@')[0] : fp.displayName || mapped;
    merged[mapped] = {
      provider: mapped,
      providerUserId: clampString(fp.uid || mapped, BLUEPRINT_LIMITS.ID_MAX) || mapped,
      username: clampString(usernameFallback, BLUEPRINT_LIMITS.USERNAME_MAX) || mapped,
      displayName: clampString(fp.displayName || usernameFallback, BLUEPRINT_LIMITS.USERNAME_MAX),
      email: fp.email ? clampString(fp.email, BLUEPRINT_LIMITS.EMAIL_MAX) : null,
      avatarUrl: fp.photoURL ? clampString(fp.photoURL, BLUEPRINT_LIMITS.URL_MAX) : null,
      profileUrl: null,
      connectedAt: merged[mapped]?.connectedAt || new Date().toISOString(),
      source: 'firebase',
    };
  }

  return merged;
}

export function resolveDisplayIdentity(params: {
  firebaseUser: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    providerData: FirebaseProviderSnapshot[];
  } | null;
  primaryOAuth: ConnectedAccountInfo | null;
  preferredMcAvatarUrl?: string | null;
}): DisplayIdentity {
  const { firebaseUser, primaryOAuth, preferredMcAvatarUrl } = params;
  const cleanPreferred = preferredMcAvatarUrl
    ? clampString(preferredMcAvatarUrl, BLUEPRINT_LIMITS.URL_MAX)
    : null;

  if (firebaseUser) {
    const fallbackName =
      firebaseUser.displayName ||
      (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'SwxMember');
    const firstProvider = firebaseUser.providerData[0]?.providerId;
    const mappedPrimary = firstProvider ? mapFirebaseProviderId(firstProvider) : null;

    return {
      isSignedIn: true,
      uid: firebaseUser.uid,
      displayName: clampString(fallbackName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'SwxMember',
      email: firebaseUser.email,
      avatarUrl: firebaseUser.photoURL || cleanPreferred || null,
      initials: computeInitials(fallbackName),
      emailVerified: firebaseUser.emailVerified,
      isFirebaseUser: true,
      primaryProvider: mappedPrimary ?? 'email',
    };
  }

  if (primaryOAuth) {
    const name = primaryOAuth.displayName || primaryOAuth.username;
    return {
      isSignedIn: true,
      uid: null,
      displayName: clampString(name, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || primaryOAuth.provider,
      email: primaryOAuth.email,
      avatarUrl: cleanPreferred || primaryOAuth.avatarUrl,
      initials: computeInitials(name),
      emailVerified: false,
      isFirebaseUser: false,
      primaryProvider: primaryOAuth.provider,
    };
  }

  return {
    isSignedIn: false,
    uid: null,
    displayName: 'Guest',
    email: null,
    avatarUrl: null,
    initials: 'SW',
    emailVerified: false,
    isFirebaseUser: false,
    primaryProvider: null,
  };
}
