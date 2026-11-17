import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Mail,
  User,
  X,
} from 'lucide-react';
import { AuthProviderId, OAuthProviderStatus } from '../types';
import { validateSignInInput, validateSignUpInput } from '../utils/authLogic';
import {
  buildMinecraftHeadAvatarUrl,
  deriveMinecraftIgnSuggestion,
  normalizeMinecraftUsername,
} from '../utils/skinLogic';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';
import { ProviderIcon } from './ProviderIcon';

interface SetupGuideInfo {
  provider: 'discord' | 'github' | 'twitch';
  label: string;
  callbackUrl: string;
  portalUrl: string;
  envVars: string[];
}

interface AuthModalProps {
  open: boolean;
  initialMode?: 'signin' | 'signup';
  oauthStatuses: Partial<Record<'discord' | 'github' | 'twitch', OAuthProviderStatus>>;
  onClose: () => void;
  onEmailSignIn: (email: string, password: string, mcAvatarUrl?: string | null) => Promise<void>;
  onEmailSignUp: (
    displayName: string,
    email: string,
    password: string,
    mcAvatarUrl?: string | null
  ) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  onFirebaseProviderAuth: (provider: 'google' | 'microsoft') => Promise<void>;
  onOAuthPopupAuth: (provider: 'discord' | 'github' | 'twitch') => Promise<{
    ok: boolean;
    setupGuide?: SetupGuideInfo;
    error?: string;
  }>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'signin',
  oauthStatuses,
  onClose,
  onEmailSignIn,
  onEmailSignUp,
  onSendPasswordReset,
  onFirebaseProviderAuth,
  onOAuthPopupAuth,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [mcIgn, setMcIgn] = useState('');
  const [mcHeadStyle, setMcHeadStyle] = useState<'2d' | '3d'>('2d');
  const [useMcHeadAvatar, setUseMcHeadAvatar] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showMoreProviders, setShowMoreProviders] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [setupGuide, setSetupGuide] = useState<SetupGuideInfo | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const previewMcIgn = deriveMinecraftIgnSuggestion({
    mcUsername: mcIgn,
    displayName: mode === 'signup' ? displayName : '',
    email,
  });

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setErrorMsg(null);
      setInfoMsg(null);
      setSetupGuide(null);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSetupGuide(null);

    const validationError =
      mode === 'signup'
        ? validateSignUpInput({ displayName, email, password })
        : validateSignInInput({ email, password });

    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const explicitSignInIgn = normalizeMinecraftUsername(mcIgn);
    const computedAvatarUrl =
      mode === 'signup'
        ? useMcHeadAvatar
          ? buildMinecraftHeadAvatarUrl(previewMcIgn, {
              size: 128,
              style: mcHeadStyle,
              origin,
            })
          : null
        : useMcHeadAvatar && explicitSignInIgn
          ? buildMinecraftHeadAvatarUrl(explicitSignInIgn, {
              size: 128,
              style: mcHeadStyle,
              origin,
            })
          : null;

    setSubmitting('email');
    try {
      if (mode === 'signup') {
        await onEmailSignUp(displayName.trim(), email.trim(), password, computedAvatarUrl);
        setInfoMsg(
          'Account created! Check your inbox for the verification link to unlock cloud sync & community posting.'
        );
      } else {
        await onEmailSignIn(email.trim(), password, computedAvatarUrl);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(null);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg('Enter your email address above first so we can send a reset link.');
      return;
    }
    setSubmitting('reset');
    try {
      await onSendPasswordReset(email.trim());
      setInfoMsg('Password reset link sent if an account exists for that email.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleProviderClick = async (provider: AuthProviderId) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSetupGuide(null);
    setSubmitting(provider);

    try {
      if (provider === 'google' || provider === 'microsoft') {
        await onFirebaseProviderAuth(provider);
        onClose();
      } else {
        const res = await onOAuthPopupAuth(provider);
        if (res.ok) {
          onClose();
        } else if (res.setupGuide) {
          setSetupGuide(res.setupGuide);
        } else if (res.error) {
          setErrorMsg(res.error);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Provider authentication failed.');
    } finally {
      setSubmitting(null);
    }
  };

  const copyCallbackUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCallback(true);
      setTimeout(() => setCopiedCallback(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-[#0d0d10] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold tracking-tight text-white">
              {mode === 'signin' ? 'Sign in to SwxStudios' : 'Create your SwxStudios account'}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Sync downloads, track XP, post in Community, and connect external accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in modal"
            className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
              setInfoMsg(null);
              setSetupGuide(null);
            }}
            className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
              mode === 'signin'
                ? 'bg-white text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setInfoMsg(null);
              setSetupGuide(null);
            }}
            className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
              mode === 'signup'
                ? 'bg-white text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Social Providers */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleProviderClick('google')}
            className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-60"
          >
            <ProviderIcon provider="google" className="h-4 w-4 shrink-0" />
            <span>
              {submitting === 'google' ? 'Connecting Google...' : 'Continue with Google'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => handleProviderClick('discord')}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-[#141419] px-3 text-xs font-semibold text-zinc-100 transition-colors hover:border-indigo-500/60 hover:bg-zinc-900 disabled:opacity-60"
            >
              <ProviderIcon provider="discord" className="h-4 w-4 shrink-0" />
              <span>{submitting === 'discord' ? 'Opening...' : 'Discord'}</span>
            </button>

            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => handleProviderClick('github')}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-[#141419] px-3 text-xs font-semibold text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-900 disabled:opacity-60"
            >
              <ProviderIcon provider="github" className="h-4 w-4 shrink-0" />
              <span>{submitting === 'github' ? 'Opening...' : 'GitHub'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowMoreProviders((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
          >
            <span>{showMoreProviders ? 'Hide extra providers' : 'More providers (Microsoft, Twitch)'}</span>
            {showMoreProviders ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>

          {showMoreProviders && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => handleProviderClick('microsoft')}
                className="flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-[#141419] px-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-sky-500/50 hover:bg-zinc-900 disabled:opacity-60"
              >
                <ProviderIcon provider="microsoft" className="h-3.5 w-3.5 shrink-0" />
                <span>{submitting === 'microsoft' ? 'Opening...' : 'Microsoft'}</span>
              </button>
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => handleProviderClick('twitch')}
                className="flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-[#141419] px-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-purple-500/50 hover:bg-zinc-900 disabled:opacity-60"
              >
                <ProviderIcon provider="twitch" className="h-3.5 w-3.5 shrink-0" />
                <span>{submitting === 'twitch' ? 'Opening...' : 'Twitch'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Inline OAuth Setup Guidance if credentials are not configured yet */}
        {setupGuide && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="font-semibold text-amber-200">
              {setupGuide.label} OAuth credentials required
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/80">
              Register this Callback URI in your {setupGuide.label} developer app and set{' '}
              <code className="font-display-mono text-amber-200">
                {setupGuide.envVars.join(' & ')}
              </code>{' '}
              in environment secrets:
            </p>
            <div className="mt-2 flex items-center gap-1.5 rounded border border-amber-500/30 bg-zinc-950/90 px-2.5 py-1.5">
              <code className="min-w-0 flex-1 truncate font-display-mono text-[11px] text-zinc-200">
                {oauthStatuses[setupGuide.provider]?.callbackUrl || setupGuide.callbackUrl}
              </code>
              <button
                type="button"
                onClick={() =>
                  copyCallbackUrl(
                    oauthStatuses[setupGuide.provider]?.callbackUrl || setupGuide.callbackUrl
                  )
                }
                className="inline-flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-100 hover:bg-zinc-700"
              >
                {copiedCallback ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            or email
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
          {/* Live Minecraft Skin Head Face Avatar Card (works on both Sign In & Sign Up) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/90 p-3">
            <div className="flex items-center gap-3">
              <MinecraftHeadAvatar
                username={previewMcIgn}
                styleMode={mcHeadStyle}
                alt={`${previewMcIgn} Minecraft skin head`}
                className="h-12 w-12 shrink-0 rounded-md border border-zinc-700 bg-[#0b0b0e]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="auth-mc-ign"
                    className="block text-[11px] font-semibold text-zinc-200"
                  >
                    Minecraft Skin Head ({previewMcIgn})
                  </label>
                  <div className="inline-flex rounded border border-zinc-800 bg-[#0b0b0e] p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setMcHeadStyle('2d')}
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        mcHeadStyle === '2d'
                          ? 'bg-rose-600 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      2D Face
                    </button>
                    <button
                      type="button"
                      onClick={() => setMcHeadStyle('3d')}
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        mcHeadStyle === '3d'
                          ? 'bg-rose-600 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      3D Head
                    </button>
                  </div>
                </div>

                <input
                  id="auth-mc-ign"
                  type="text"
                  maxLength={16}
                  value={mcIgn}
                  onChange={(e) => setMcIgn(e.target.value)}
                  placeholder="Optional Java IGN (e.g. Notch, Dream)"
                  className="mt-1.5 h-8 w-full rounded border border-zinc-800 bg-[#0b0b0e] px-2.5 font-display-mono text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/60 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-zinc-400">
                <input
                  type="checkbox"
                  checked={useMcHeadAvatar}
                  onChange={(e) => setUseMcHeadAvatar(e.target.checked)}
                  className="h-3.5 w-3.5 accent-rose-600"
                />
                <span>
                  {mode === 'signup'
                    ? 'Use Minecraft head face as profile avatar'
                    : 'Sync typed IGN head on sign in'}
                </span>
              </label>

              <div className="flex items-center gap-1">
                {['Notch', 'Dream', 'Steve'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setMcIgn(sample)}
                    className="rounded border border-zinc-800 bg-[#0b0b0e] px-1.5 py-0.5 font-display-mono text-zinc-400 hover:border-rose-500/50 hover:text-white"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-username" className="block text-xs font-medium text-zinc-300">
                Username
              </label>
              <div className="relative mt-1">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id="auth-username"
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. SwxBuilder"
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300">
              Email address
            </label>
            <div className="relative mt-1">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                id="auth-email"
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative mt-1">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-200"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting !== null}
            className="h-10 w-full rounded-md bg-white text-xs font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-60"
          >
            {submitting === 'email'
              ? mode === 'signup'
                ? 'Creating account...'
                : 'Signing in...'
              : mode === 'signup'
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
