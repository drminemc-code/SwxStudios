import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Unlink,
  UserSquare2,
  X,
} from 'lucide-react';
import {
  AuthProviderId,
  ConnectedAccountInfo,
  DisplayIdentity,
  OAuthProviderStatus,
} from '../types';
import { AUTH_PROVIDERS } from '../utils/authLogic';
import {
  buildMinecraftHeadAvatarUrl,
  deriveMinecraftIgnSuggestion,
  extractMinecraftUsernameFromAvatarUrl,
  isValidMinecraftUsername,
} from '../utils/skinLogic';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';
import { ProviderIcon } from './ProviderIcon';

interface SetupNotice {
  provider: 'discord' | 'github' | 'twitch';
  label: string;
  callbackUrl: string;
  envVars: string[];
}

interface AccountModalProps {
  open: boolean;
  identity: DisplayIdentity;
  connectedAccounts: Partial<Record<AuthProviderId, ConnectedAccountInfo>>;
  oauthStatuses: Partial<Record<'discord' | 'github' | 'twitch', OAuthProviderStatus>>;
  xp: number;
  isPremium: boolean;
  onClose: () => void;
  onSignOut: () => Promise<void>;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<void>;
  onUpdateDisplayName: (nextName: string) => Promise<void>;
  onUpdateAvatarUrl?: (nextAvatarUrl: string) => Promise<void>;
  onOpenSkinViewer?: (ign?: string) => void;
  onConnectProvider: (provider: AuthProviderId) => Promise<{
    ok: boolean;
    setupGuide?: SetupNotice;
    error?: string;
  }>;
  onDisconnectProvider: (provider: AuthProviderId) => Promise<void>;
  isOwner?: boolean;
  onOpenAdminPanel?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  identity,
  connectedAccounts,
  oauthStatuses,
  xp,
  isPremium,
  onClose,
  onSignOut,
  onResendVerification,
  onRefreshVerification,
  onUpdateDisplayName,
  onUpdateAvatarUrl,
  onOpenSkinViewer,
  onConnectProvider,
  onDisconnectProvider,
  isOwner = false,
  onOpenAdminPanel,
}) => {
  const existingMcIgn = extractMinecraftUsernameFromAvatarUrl(identity.avatarUrl);
  const [nameInput, setNameInput] = useState(identity.displayName);
  const [mcIgnInput, setMcIgnInput] = useState(
    existingMcIgn ||
      deriveMinecraftIgnSuggestion({
        displayName: identity.displayName,
        email: identity.email || undefined,
      })
  );
  const [headStyle, setHeadStyle] = useState<'2d' | '3d'>('2d');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [setupNotice, setSetupNotice] = useState<SetupNotice | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);

  useEffect(() => {
    if (open) {
      setNameInput(identity.displayName);
      setMcIgnInput(
        extractMinecraftUsernameFromAvatarUrl(identity.avatarUrl) ||
          deriveMinecraftIgnSuggestion({
            displayName: identity.displayName,
            email: identity.email || undefined,
          })
      );
      setFeedback(null);
      setSetupNotice(null);
    }
  }, [open, identity.displayName, identity.avatarUrl, identity.email]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const connectedCount = Object.keys(connectedAccounts).length;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setFeedback({ type: 'err', text: 'Display name must be between 2 and 80 characters.' });
      return;
    }
    setBusyAction('save-name');
    setFeedback(null);
    try {
      await onUpdateDisplayName(trimmed);
      setFeedback({ type: 'ok', text: 'Profile display name updated.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not update display name.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleConnect = async (provider: AuthProviderId) => {
    setBusyAction(`connect-${provider}`);
    setFeedback(null);
    setSetupNotice(null);
    try {
      const res = await onConnectProvider(provider);
      if (res.ok) {
        setFeedback({ type: 'ok', text: `${provider} account connected.` });
      } else if (res.setupGuide) {
        setSetupNotice(res.setupGuide);
      } else if (res.error) {
        setFeedback({ type: 'err', text: res.error });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : `Failed to connect ${provider}.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async (provider: AuthProviderId) => {
    setBusyAction(`disconnect-${provider}`);
    setFeedback(null);
    try {
      await onDisconnectProvider(provider);
      setFeedback({ type: 'ok', text: `${provider} account disconnected.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : `Could not disconnect ${provider}.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyUri = async (uri: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[540px] max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-[#0d0d10] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {identity.avatarUrl || existingMcIgn ? (
              <MinecraftHeadAvatar
                username={existingMcIgn}
                avatarUrl={identity.avatarUrl}
                styleMode={headStyle}
                alt={identity.displayName}
                initials={identity.initials}
                className="h-12 w-12 shrink-0 rounded-lg border border-zinc-700"
              />
            ) : (
              <MinecraftHeadAvatar
                username={deriveMinecraftIgnSuggestion({
                  displayName: identity.displayName,
                  email: identity.email || undefined,
                })}
                styleMode={headStyle}
                alt={identity.displayName}
                initials={identity.initials}
                className="h-12 w-12 shrink-0 rounded-lg border border-zinc-700"
              />
            )}
            <div className="min-w-0">
              <h2 id="account-modal-title" className="truncate text-base font-bold text-white">
                {identity.displayName}
              </h2>
              <p className="truncate text-xs text-zinc-400">
                {identity.email || `Signed in via ${identity.primaryProvider ?? 'OAuth'}`}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                <span className="tabular-nums font-medium text-zinc-200">{xp} XP</span>
                <span aria-hidden="true">·</span>
                <span>{isPremium ? 'Premium Active' : 'Standard Member'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{connectedCount} connected</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Email verification status */}
        {identity.isFirebaseUser && !identity.emailVerified && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-amber-200">Verify your email address</p>
                <p className="mt-0.5 text-[11px] text-amber-100/80">
                  Cloud profile sync and community posting require a verified email.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={async () => {
                      setBusyAction('resend-email');
                      try {
                        await onResendVerification();
                        setFeedback({ type: 'ok', text: 'Verification email sent.' });
                      } catch (err) {
                        setFeedback({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Failed to send email.',
                        });
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="rounded border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/30"
                  >
                    Resend email
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={async () => {
                      setBusyAction('refresh-email');
                      try {
                        await onRefreshVerification();
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>I verified — refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {identity.isFirebaseUser && identity.emailVerified && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                {isOwner
                  ? 'Verified Owner · Full admin & upload access'
                  : 'Verified account · Cloud Firestore sync active'}
              </span>
            </div>
            {isOwner && onOpenAdminPanel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-950 hover:bg-zinc-200"
              >
                <Shield className="h-3 w-3" aria-hidden="true" />
                <span>Open Admin Panel</span>
              </button>
            )}
          </div>
        )}

        {/* Display Name Update (for verified Firebase accounts) */}
        {identity.isFirebaseUser && (
          <form onSubmit={handleSaveName} className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="account-display-name" className="block text-xs font-medium text-zinc-400">
                Display Name
              </label>
              <input
                id="account-display-name"
                type="text"
                maxLength={80}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busyAction !== null}
              className="h-9 shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
            >
              {busyAction === 'save-name' ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        )}

        {/* Minecraft Skin Head Face Avatar Editor */}
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/90 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserSquare2 className="h-4 w-4 text-rose-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Minecraft Skin Head Avatar
              </h3>
            </div>
            <div className="inline-flex rounded border border-zinc-800 bg-[#0b0b0e] p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setHeadStyle('2d')}
                className={`rounded px-2 py-0.5 font-semibold ${
                  headStyle === '2d'
                    ? 'bg-rose-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                2D Head
              </button>
              <button
                type="button"
                onClick={() => setHeadStyle('3d')}
                className={`rounded px-2 py-0.5 font-semibold ${
                  headStyle === '3d'
                    ? 'bg-rose-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                3D Bust
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MinecraftHeadAvatar
              username={mcIgnInput || 'Steve'}
              styleMode={headStyle}
              alt={`${mcIgnInput || 'Steve'} skin head preview`}
              className="h-14 w-14 shrink-0 rounded-lg border border-zinc-700 bg-[#0b0b0e]"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={16}
                  value={mcIgnInput}
                  onChange={(e) => setMcIgnInput(e.target.value)}
                  placeholder="Enter Minecraft IGN (e.g. Notch)"
                  aria-label="Minecraft Java username for profile avatar"
                  className="h-9 min-w-0 flex-1 rounded-md border border-zinc-800 bg-[#0b0b0e] px-3 font-display-mono text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
                />
                {identity.isFirebaseUser && onUpdateAvatarUrl && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={async () => {
                      const clean = mcIgnInput.trim();
                      if (!isValidMinecraftUsername(clean)) {
                        setFeedback({
                          type: 'err',
                          text: 'Minecraft IGN must be 1–16 letters, numbers, or underscores.',
                        });
                        return;
                      }
                      setBusyAction('save-avatar');
                      setFeedback(null);
                      try {
                        const origin =
                          typeof window !== 'undefined' ? window.location.origin : '';
                        const avatarUrl = buildMinecraftHeadAvatarUrl(clean, {
                          size: 128,
                          style: headStyle,
                          origin,
                        });
                        await onUpdateAvatarUrl(avatarUrl);
                        setFeedback({
                          type: 'ok',
                          text: `Updated profile avatar to ${clean}'s Minecraft skin head.`,
                        });
                      } catch (err) {
                        setFeedback({
                          type: 'err',
                          text:
                            err instanceof Error
                              ? err.message
                              : 'Could not save Minecraft skin head.',
                        });
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="h-9 shrink-0 rounded-md bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    {busyAction === 'save-avatar' ? 'Saving...' : 'Apply Head'}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1">
                  {['Notch', 'Dream', 'Technoblade', 'Steve'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setMcIgnInput(sample)}
                      className="rounded border border-zinc-800 bg-[#0b0b0e] px-2 py-0.5 font-display-mono text-zinc-400 hover:border-rose-500/50 hover:text-white"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
                {onOpenSkinViewer && (
                  <button
                    type="button"
                    onClick={() => onOpenSkinViewer(mcIgnInput.trim() || 'Notch')}
                    className="font-semibold text-rose-400 hover:text-rose-300"
                  >
                    Open in 2D / 3D Skin Viewer &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className={`mt-4 flex items-start gap-2 rounded-md border p-2.5 text-xs ${
              feedback.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            {feedback.type === 'ok' ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Setup Guide for unconfigured 3P OAuth providers */}
        {setupNotice && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="font-semibold text-amber-200">
              {setupNotice.label} app credentials needed
            </p>
            <p className="mt-1 text-[11px] text-amber-100/80">
              Set <code className="font-display-mono">{setupNotice.envVars.join(' & ')}</code> and
              whitelist this Callback URL:
            </p>
            <div className="mt-2 flex items-center gap-1.5 rounded border border-amber-500/30 bg-zinc-950 px-2.5 py-1.5">
              <code className="min-w-0 flex-1 truncate font-display-mono text-[11px] text-zinc-200">
                {oauthStatuses[setupNotice.provider]?.callbackUrl || setupNotice.callbackUrl}
              </code>
              <button
                type="button"
                onClick={() =>
                  handleCopyUri(
                    oauthStatuses[setupNotice.provider]?.callbackUrl || setupNotice.callbackUrl
                  )
                }
                className="inline-flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-100"
              >
                {copiedUri ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedUri ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Connected Accounts Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Connected Accounts
            </h3>
            <span className="text-[11px] text-zinc-500">
              Link Discord, GitHub, Google &amp; more
            </span>
          </div>

          <div className="mt-2.5 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800 bg-[#111114]">
            {AUTH_PROVIDERS.map((provider) => {
              const connection = connectedAccounts[provider.id];
              const isConnecting = busyAction === `connect-${provider.id}`;
              const isDisconnecting = busyAction === `disconnect-${provider.id}`;

              return (
                <div
                  key={provider.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
                      <ProviderIcon provider={provider.id} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{provider.label}</p>
                      {connection ? (
                        <p className="truncate text-[11px] text-emerald-400">
                          Connected as @{connection.username}
                        </p>
                      ) : (
                        <p className="truncate text-[11px] text-zinc-500">
                          {provider.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {connection ? (
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleDisconnect(provider.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-300 hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
                    >
                      <Unlink className="h-3 w-3" />
                      <span>{isDisconnecting ? 'Removing...' : 'Disconnect'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleConnect(provider.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
                    >
                      <Link2 className="h-3 w-3" />
                      <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Sign Out */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <p className="text-[11px] text-zinc-500">
            Session cookies are httpOnly &amp; scoped to SwxStudios.
          </p>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={async () => {
              setBusyAction('signout');
              try {
                await onSignOut();
                onClose();
              } finally {
                setBusyAction(null);
              }
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
