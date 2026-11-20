import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { generateRayId, solveChallengeProof } from '../utils/botVerifyLogic';

const LOGO_URL = '/assets/aistudio/Gemini_Generated_Image_m1vgo5m1vgo5m1vg_2bbe67cb.jpeg';

export type VerifyWidgetStatus = 'idle' | 'verifying' | 'verified' | 'error';

interface ChallengeResponse {
  challengeToken: string;
  nonce: string;
  difficulty: number;
  rayId: string;
}

interface TurnstileVerifyWidgetProps {
  verified: boolean;
  onVerified: (info: { rayId: string; verifiedAt?: string }) => void;
  compact?: boolean;
  rayIdHint?: string;
}

export const TurnstileVerifyWidget: React.FC<TurnstileVerifyWidgetProps> = ({
  verified,
  onVerified,
  compact = false,
  rayIdHint,
}) => {
  const [status, setStatus] = useState<VerifyWidgetStatus>(verified ? 'verified' : 'idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rayId, setRayId] = useState<string>(() => rayIdHint || generateRayId('swx-init'));
  const mountedAtRef = useRef<number>(Date.now());
  const busyRef = useRef(false);

  useEffect(() => {
    if (verified) {
      setStatus('verified');
      setErrorMsg(null);
    } else {
      setStatus((prev) => (prev === 'verified' ? 'idle' : prev));
    }
  }, [verified]);

  useEffect(() => {
    if (rayIdHint) setRayId(rayIdHint);
  }, [rayIdHint]);

  const handleRunVerify = useCallback(async () => {
    if (busyRef.current || status === 'verified') return;
    busyRef.current = true;
    setStatus('verifying');
    setErrorMsg(null);

    try {
      const challengeRes = await fetch('/api/verify/challenge', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!challengeRes.ok) {
        throw new Error('Could not initialize verification challenge.');
      }
      const challenge = (await challengeRes.json()) as ChallengeResponse;
      if (challenge.rayId) setRayId(challenge.rayId);

      // Authentic brief Turnstile inspection delay + client PoW computation
      const [solved] = await Promise.all([
        Promise.resolve(solveChallengeProof(challenge.nonce, challenge.difficulty)),
        new Promise((r) => window.setTimeout(r, 420)),
      ]);

      if (!solved) {
        throw new Error('Verification check timed out. Please retry.');
      }

      const submitRes = await fetch('/api/verify/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: challenge.challengeToken,
          counter: solved.counter,
          humanInteraction: true,
          elapsedMs: Math.max(120, Date.now() - mountedAtRef.current),
        }),
      });

      const result = (await submitRes.json()) as {
        ok?: boolean;
        verified?: boolean;
        rayId?: string;
        verifiedAt?: string;
        error?: string;
      };

      if (!submitRes.ok || !result.verified) {
        throw new Error(result.error || 'Bot check rejected. Please try again.');
      }

      const finalRay = result.rayId || challenge.rayId || rayId;
      setRayId(finalRay);
      setStatus('verified');
      onVerified({ rayId: finalRay, verifiedAt: result.verifiedAt });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed. Retry.');
    } finally {
      busyRef.current = false;
    }
  }, [onVerified, rayId, status]);

  return (
    <div
      className={`rounded-md border bg-[#141418] text-zinc-100 transition-colors ${
        status === 'verified'
          ? 'border-emerald-500/40'
          : status === 'error'
          ? 'border-red-500/40'
          : 'border-zinc-700/90'
      } ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={status === 'verified'}
          aria-label={
            status === 'verified'
              ? 'Human verification complete'
              : status === 'verifying'
              ? 'Verifying you are human'
              : 'Verify you are human'
          }
          disabled={status === 'verifying' || status === 'verified'}
          onClick={() => void handleRunVerify()}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 rounded"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
              status === 'verified'
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                : status === 'verifying'
                ? 'border-zinc-600 bg-zinc-900 text-rose-400'
                : status === 'error'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-zinc-500 bg-[#0b0b0e] group-hover:border-rose-400'
            }`}
          >
            {status === 'verified' ? (
              <Check className="h-4 w-4 stroke-[2.75]" aria-hidden="true" />
            ) : status === 'verifying' ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : status === 'error' ? (
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            ) : null}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-100">
              {status === 'verified'
                ? 'Success!'
                : status === 'verifying'
                ? 'Verifying...'
                : status === 'error'
                ? 'Verification failed — Click to retry'
                : 'Verify you are human'}
            </p>
            {!compact && (
              <p className="text-[10px] text-zinc-400">
                {status === 'verified'
                  ? 'Connection verified · Proceeding'
                  : status === 'verifying'
                  ? 'Checking browser integrity & proof'
                  : 'Complete anti-bot check to continue'}
              </p>
            )}
          </div>
        </button>

        {/* Right Turnstile-style Security Badge */}
        <div className="flex shrink-0 flex-col items-end text-right">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-rose-400" aria-hidden="true" />
            <span className="font-display text-[11px] font-bold tracking-tight text-zinc-200">
              SwxShield
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-display-mono text-[9px] text-zinc-500">
            <span>Turnstile</span>
            <span aria-hidden="true">·</span>
            <span>{rayId.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <p role="alert" className="mt-2 text-[11px] text-red-300">
          {errorMsg}
        </p>
      )}
    </div>
  );
};

interface BotVerifyGateProps {
  rayId: string;
  onPassed: (info: { rayId: string }) => void;
}

export const BotVerifyGate: React.FC<BotVerifyGateProps> = ({ rayId, onPassed }) => {
  const [verified, setVerified] = useState(false);

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto mt-10 w-full max-w-[540px] sm:mt-20">
        {/* Domain / Security Header */}
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="SwaxtuMC Studios logo"
            className="h-9 w-9 rounded-md border border-zinc-800 bg-black object-cover"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-extrabold tracking-tight text-white">
                swxstudios.net
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-display-mono text-[10px] text-zinc-400">
                <Lock className="h-2.5 w-2.5 text-emerald-400" aria-hidden="true" />
                <span>TLS</span>
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Checking if the site connection is secure
            </p>
          </div>
        </div>

        {/* Main Turnstile Prompt Box */}
        <div className="mt-7 rounded-xl border border-zinc-800/90 bg-[#0d0d11] p-6 shadow-2xl">
          <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
            Verify you are human by completing the action below.
          </h1>

          <div className="mt-5 max-w-[360px]">
            <TurnstileVerifyWidget
              verified={verified}
              rayIdHint={rayId}
              onVerified={({ rayId: nextRay }) => {
                setVerified(true);
                window.setTimeout(() => {
                  onPassed({ rayId: nextRay });
                }, 420);
              }}
            />
          </div>

          <p className="mt-6 text-xs leading-relaxed text-zinc-400">
            SwxStudios needs to review the security of your connection before proceeding to
            plugins, tools, live server status pings, and the 3D skin viewer.
          </p>
        </div>
      </div>

      {/* Cloudflare-style Diagnostic Ray ID Footer */}
      <footer className="mx-auto mt-12 w-full max-w-[540px] border-t border-zinc-800/80 pt-4 text-center font-display-mono text-[11px] text-zinc-500">
        <p>
          Ray ID: <span className="text-zinc-300">{rayId}</span>
        </p>
        <p className="mt-1 text-zinc-500">
          Performance &amp; security by <span className="text-zinc-300">SwxShield</span>
        </p>
      </footer>
    </div>
  );
};
