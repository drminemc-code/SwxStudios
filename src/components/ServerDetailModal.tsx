import React, { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  Gauge,
  Map as MapIcon,
  RefreshCw,
  Server,
  Star,
  Terminal,
  ThumbsUp,
  Trophy,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import {
  LiveServerStatus,
  MinecraftServerListing,
  ServerTelemetrySnapshot,
} from '../types';
import {
  classifyPingHealth,
  classifyTpsHealth,
  parseTopPlayerEntry,
} from '../utils/mcToolsLogic';
import { buildMinecraftHeadAvatarUrl } from '../utils/skinLogic';
import { MinecraftFormattedText } from './MinecraftTextPreview';

interface ServerDetailModalProps {
  server: MinecraftServerListing | null;
  liveStatus?: LiveServerStatus;
  telemetry?: ServerTelemetrySnapshot;
  canEditMetrics: boolean;
  onClose: () => void;
  onRefreshLive: (server: MinecraftServerListing) => Promise<void>;
  onVote: (serverId: string) => Promise<void>;
  onCopyAddress: (address: string) => void;
  onExploreMap?: (server: MinecraftServerListing) => void;
  onSaveTelemetry?: (
    server: MinecraftServerListing,
    updates: {
      tps?: number;
      mspt?: number;
      pingMs?: number;
      topPlayers?: string[];
    }
  ) => Promise<void>;
}

type DetailTab = 'overview' | 'telemetry' | 'players' | 'heartbeat';

export const ServerDetailModal: React.FC<ServerDetailModalProps> = ({
  server,
  liveStatus,
  telemetry,
  canEditMetrics,
  onClose,
  onRefreshLive,
  onVote,
  onCopyAddress,
  onExploreMap,
  onSaveTelemetry,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tpsInput, setTpsInput] = useState('');
  const [msptInput, setMsptInput] = useState('');
  const [pingInput, setPingInput] = useState('');
  const [topPlayersInput, setTopPlayersInput] = useState('');
  const [savingMetrics, setSavingMetrics] = useState(false);

  useEffect(() => {
    if (!server) return;
    setActiveTab('overview');
    const tpsVal = telemetry?.tps ?? server.tps;
    const msptVal = telemetry?.mspt ?? server.mspt;
    const pingVal = liveStatus?.pingMs ?? telemetry?.avgPingMs ?? server.pingMs;
    setTpsInput(typeof tpsVal === 'number' ? String(tpsVal) : '');
    setMsptInput(typeof msptVal === 'number' ? String(msptVal) : '');
    setPingInput(typeof pingVal === 'number' ? String(pingVal) : '');
    const mergedTop =
      telemetry?.topPlayers && telemetry.topPlayers.length > 0
        ? telemetry.topPlayers.map((p) => (p.stat ? `${p.name} | ${p.stat}` : p.name))
        : server.topPlayers || [];
    setTopPlayersInput(mergedTop.join('\n'));
  }, [server, telemetry, liveStatus?.pingMs]);

  useEffect(() => {
    if (!server) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [server, onClose]);

  if (!server) return null;

  const effectiveOnline = liveStatus?.online;
  const effectivePing = liveStatus?.pingMs ?? telemetry?.avgPingMs ?? server.pingMs ?? null;
  const effectiveTps = telemetry?.tps ?? server.tps ?? null;
  const effectiveMspt = telemetry?.mspt ?? server.mspt ?? null;
  const effectivePlayersOnline =
    liveStatus?.online && typeof liveStatus.playersOnline === 'number'
      ? liveStatus.playersOnline
      : telemetry?.playersOnline ?? 0;
  const effectivePlayersMax =
    liveStatus?.online && typeof liveStatus.playersMax === 'number'
      ? liveStatus.playersMax
      : telemetry?.playersMax ?? 0;
  const liveMotdLines =
    liveStatus?.motdLines && liveStatus.motdLines.length > 0
      ? liveStatus.motdLines
      : [server.motd];
  const samplePlayers = liveStatus?.playerSample || [];
  const topPlayersList =
    telemetry?.topPlayers && telemetry.topPlayers.length > 0
      ? telemetry.topPlayers
      : (server.topPlayers || []).map(parseTopPlayerEntry);

  const pingBadge = classifyPingHealth(effectivePing);
  const tpsBadge = classifyTpsHealth(effectiveTps);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = value;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      } catch {
        // Fallback handled by toast callback
      }
    }
    setCopiedKey(key);
    onCopyAddress(value);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  const handleSaveMetricsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveTelemetry) return;
    setSavingMetrics(true);
    try {
      const tps = tpsInput.trim() ? Number(tpsInput.trim()) : undefined;
      const mspt = msptInput.trim() ? Number(msptInput.trim()) : undefined;
      const pingMs = pingInput.trim() ? Number(pingInput.trim()) : undefined;
      const topPlayers = topPlayersInput
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 15);
      await onSaveTelemetry(server, { tps, mspt, pingMs, topPlayers });
    } finally {
      setSavingMetrics(false);
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://swxstudios.net';
  const curlSnippet = `curl -X POST "${originUrl}/api/mc/telemetry" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <FIREBASE_OWNER_TOKEN>" \\
  -d '{
    "serverKey": "${server.address}",
    "address": "${server.address}",
    "tps": 20.0,
    "mspt": 14.2,
    "avgPingMs": ${effectivePing ?? 32},
    "playersOnline": ${effectivePlayersOnline},
    "playersMax": ${effectivePlayersMax || 100},
    "topPlayers": [
      { "name": "Steve", "stat": "124h Playtime" }
    ]
  }'`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${server.name} server details`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0d0d11] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Server Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/90 bg-[#111114] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            {liveStatus?.iconBase64 ? (
              <img
                src={liveStatus.iconBase64}
                alt={`${server.name} icon`}
                className="h-14 w-14 shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-rose-400">
                <Server className="h-6 w-6" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-semibold text-zinc-200">
                  {server.edition}
                </span>
                <span className="font-display-mono text-zinc-400">
                  {liveStatus?.version || server.version}
                </span>
                {liveStatus?.software && (
                  <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300">
                    {liveStatus.software}
                  </span>
                )}
                {server.featured && (
                  <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300">
                    <Star className="h-3 w-3" />
                    <span>Featured</span>
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-display-mono font-semibold ${
                    liveStatus?.loading
                      ? 'bg-zinc-800 text-zinc-300'
                      : effectiveOnline
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : effectiveOnline === false
                      ? 'bg-red-500/15 text-red-300'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      liveStatus?.loading
                        ? 'bg-amber-400 animate-pulse'
                        : effectiveOnline
                        ? 'bg-emerald-400'
                        : 'bg-red-400'
                    }`}
                  />
                  {liveStatus?.loading
                    ? 'Connecting...'
                    : effectiveOnline
                    ? 'ONLINE'
                    : effectiveOnline === false
                    ? 'OFFLINE'
                    : 'UNCHECKED'}
                </span>
              </div>

              <h2 className="mt-1.5 truncate text-xl font-extrabold tracking-tight text-white">
                {server.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onExploreMap && (
              <button
                type="button"
                onClick={() => onExploreMap(server)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 hover:border-emerald-500/60 hover:text-emerald-200"
              >
                <MapIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>Explore Map</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void onRefreshLive(server)}
              disabled={liveStatus?.loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 hover:border-rose-500/60 hover:text-white disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-rose-400 ${liveStatus?.loading ? 'animate-spin' : ''}`}
              />
              <span>{liveStatus?.loading ? 'Pinging...' : 'Ping Live'}</span>
            </button>

            {!server.isBaselineLive && (
              <button
                type="button"
                onClick={() => void onVote(server.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-500"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>Vote ({server.votes})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close server details"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex flex-wrap gap-1 border-b border-zinc-800/80 bg-[#0b0b0f] px-5 pt-2 sm:px-6"
          role="tablist"
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'telemetry', label: 'Live Metrics (TPS / MSPT / Ping)' },
              { id: 'players', label: `Players & Top Players (${samplePlayers.length || topPlayersList.length})` },
              { id: 'heartbeat', label: 'Plugin Telemetry API' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-rose-500 text-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Primary Live Status Grid (always visible summary strip) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Activity className="h-3.5 w-3.5 text-rose-400" />
                <span>Status</span>
              </div>
              <p
                className={`mt-1 text-sm font-bold ${
                  effectiveOnline
                    ? 'text-emerald-300'
                    : effectiveOnline === false
                    ? 'text-red-300'
                    : 'text-zinc-300'
                }`}
              >
                {liveStatus?.loading
                  ? 'Connecting...'
                  : effectiveOnline
                  ? 'Online'
                  : effectiveOnline === false
                  ? 'Offline'
                  : 'Pending'}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Users className="h-3.5 w-3.5 text-sky-400" />
                <span>Players</span>
              </div>
              <p className="mt-1 font-display-mono text-sm font-bold text-white tabular-nums">
                {effectiveOnline ? `${effectivePlayersOnline} / ${effectivePlayersMax}` : '0 / 0'}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span>Ping Latency</span>
              </div>
              <p
                className={`mt-1 font-display-mono text-sm font-bold tabular-nums ${
                  pingBadge.tone === 'good'
                    ? 'text-emerald-300'
                    : pingBadge.tone === 'warn'
                    ? 'text-amber-300'
                    : pingBadge.tone === 'bad'
                    ? 'text-red-300'
                    : 'text-zinc-400'
                }`}
              >
                {pingBadge.label}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Gauge className="h-3.5 w-3.5 text-amber-400" />
                <span>TPS</span>
              </div>
              <p
                className={`mt-1 font-display-mono text-sm font-bold tabular-nums ${
                  tpsBadge.tone === 'good'
                    ? 'text-emerald-300'
                    : tpsBadge.tone === 'warn'
                    ? 'text-amber-300'
                    : tpsBadge.tone === 'bad'
                    ? 'text-red-300'
                    : 'text-zinc-400'
                }`}
              >
                {tpsBadge.label}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Activity className="h-3.5 w-3.5 text-purple-400" />
                <span>MSPT</span>
              </div>
              <p className="mt-1 font-display-mono text-sm font-bold text-white tabular-nums">
                {typeof effectiveMspt === 'number' ? `${effectiveMspt.toFixed(1)} ms` : '—'}
              </p>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Live MOTD Preview
                  </h3>
                  <div className="mt-2 rounded-lg border border-zinc-800 bg-[#08080a] p-4 font-display-mono text-xs space-y-1">
                    {liveMotdLines.map((line, i) => (
                      <div key={i}>
                        <MinecraftFormattedText text={line} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    About This Server
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {server.description ||
                      `${server.name} is a ${server.edition} Minecraft server running ${liveStatus?.version || server.version}.`}
                  </p>
                </div>

                {server.gameModes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Categories & Game Modes
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {server.gameModes.map((mode) => (
                        <span
                          key={mode}
                          className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200"
                        >
                          {mode}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Connection Addresses
                  </h3>

                  <div className="relative">
                    <span className="text-[11px] text-zinc-500">Java / Primary IP</span>
                    {copiedKey === 'java-ip' && (
                      <span
                        role="status"
                        className="pointer-events-none absolute right-2 top-0 inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                        <span>Copied!</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCopy('java-ip', server.address)}
                      className={`mt-1 flex w-full items-center justify-between rounded-md border px-3 py-2 font-display-mono text-xs transition-colors ${
                        copiedKey === 'java-ip'
                          ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
                          : 'border-zinc-700 bg-zinc-950 text-white hover:border-rose-500/60'
                      }`}
                    >
                      <span className="truncate">{server.address}</span>
                      {copiedKey === 'java-ip' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {server.bedrockAddress && (
                    <div className="relative">
                      <span className="text-[11px] text-zinc-500">Bedrock Address</span>
                      {copiedKey === 'bedrock-ip' && (
                        <span
                          role="status"
                          className="pointer-events-none absolute right-2 top-0 inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>Copied!</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopy('bedrock-ip', server.bedrockAddress!)}
                        className={`mt-1 flex w-full items-center justify-between rounded-md border px-3 py-2 font-display-mono text-xs transition-colors ${
                          copiedKey === 'bedrock-ip'
                            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
                            : 'border-zinc-700 bg-zinc-950 text-white hover:border-rose-500/60'
                        }`}
                      >
                        <span className="truncate">{server.bedrockAddress}</span>
                        {copiedKey === 'bedrock-ip' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  )}

                  {liveStatus?.resolvedHost && (
                    <div className="border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Resolved SRV / Host:</span>
                        <span className="font-display-mono text-zinc-200">
                          {liveStatus.resolvedHost}:{liveStatus.port || 25565}
                        </span>
                      </div>
                      {liveStatus.ip && (
                        <div className="flex justify-between">
                          <span>Node IP:</span>
                          <span className="font-display-mono text-zinc-200">{liveStatus.ip}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Probe Location:</span>
                        <span className="font-display-mono text-emerald-300">
                          {liveStatus.probeLocation || 'Asia (Singapore)'}
                        </span>
                      </div>
                      {liveStatus.checkedAt && (
                        <div className="flex justify-between">
                          <span>Checked:</span>
                          <span className="font-display-mono text-zinc-300">
                            {new Date(liveStatus.checkedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Top Players Preview */}
                <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Online / Top Players
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('players')}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-300"
                    >
                      View all
                    </button>
                  </div>

                  {samplePlayers.length === 0 && topPlayersList.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      No sample players reported by query. Add top players in Metrics or connect Plugin Heartbeat.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(topPlayersList.length > 0
                        ? topPlayersList.slice(0, 6).map((p) => p.name)
                        : samplePlayers.slice(0, 6).map((p) => p.name)
                      ).map((name) => (
                        <div
                          key={name}
                          className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                        >
                          <img
                            src={buildMinecraftHeadAvatarUrl(name, { size: 24 })}
                            alt=""
                            className="h-4 w-4 rounded-sm"
                          />
                          <span className="font-display-mono text-[11px]">{name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4">
                <h3 className="text-sm font-bold text-white">Real-Time Tick & Network Health</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Live ping latency, player capacity, and engine TPS / MSPT telemetry. Standard Minecraft query exposes online players, MOTD, and ping; TPS &amp; MSPT update from owner metrics or your live server plugin heartbeat.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Server Tick Rate (TPS)</span>
                      <span className="font-display-mono font-bold text-white">
                        {typeof effectiveTps === 'number' ? `${effectiveTps.toFixed(2)} / 20.00` : 'Not reported'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full transition-all ${
                          effectiveTps && effectiveTps >= 19
                            ? 'bg-emerald-500'
                            : effectiveTps && effectiveTps >= 16
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(4, ((effectiveTps || 0) / 20) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Tick Duration (MSPT vs 50ms budget)</span>
                      <span className="font-display-mono font-bold text-white">
                        {typeof effectiveMspt === 'number' ? `${effectiveMspt.toFixed(1)} ms` : 'Not reported'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full transition-all ${
                          effectiveMspt && effectiveMspt <= 35
                            ? 'bg-emerald-500'
                            : effectiveMspt && effectiveMspt <= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(4, ((effectiveMspt || 0) / 50) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {canEditMetrics && onSaveTelemetry && (
                <form
                  onSubmit={handleSaveMetricsSubmit}
                  className="rounded-lg border border-zinc-800 bg-[#111114] p-4 space-y-3"
                >
                  <h3 className="text-sm font-bold text-white">Update TPS, MSPT, Ping & Top Players</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="det-tps" className="block text-xs text-zinc-300">
                        TPS (0–20)
                      </label>
                      <input
                        id="det-tps"
                        type="number"
                        step="0.01"
                        min={0}
                        max={25}
                        value={tpsInput}
                        onChange={(e) => setTpsInput(e.target.value)}
                        placeholder="20.0"
                        className="mt-1 h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="det-mspt" className="block text-xs text-zinc-300">
                        MSPT (ms)
                      </label>
                      <input
                        id="det-mspt"
                        type="number"
                        step="0.1"
                        min={0}
                        max={5000}
                        value={msptInput}
                        onChange={(e) => setMsptInput(e.target.value)}
                        placeholder="14.5"
                        className="mt-1 h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="det-ping" className="block text-xs text-zinc-300">
                        Target Ping (ms)
                      </label>
                      <input
                        id="det-ping"
                        type="number"
                        min={0}
                        max={10000}
                        value={pingInput}
                        onChange={(e) => setPingInput(e.target.value)}
                        placeholder="28"
                        className="mt-1 h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="det-top-players" className="block text-xs text-zinc-300">
                      Top Players (one per line: Name | Stat)
                    </label>
                    <textarea
                      id="det-top-players"
                      rows={3}
                      value={topPlayersInput}
                      onChange={(e) => setTopPlayersInput(e.target.value)}
                      placeholder={'Waterwere | 142h Playtime\nDevJul | $4.8M Balance'}
                      className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingMetrics}
                      className="h-9 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
                    >
                      {savingMetrics ? 'Saving...' : 'Save Metrics & Leaderboard'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'players' && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Top Players Leaderboard */}
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Top Players Leaderboard</h3>
                </div>

                {topPlayersList.length === 0 ? (
                  <p className="py-4 text-xs text-zinc-500">
                    No top player leaderboard entries saved yet. Add top players in the form or push via Plugin Telemetry API.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {topPlayersList.map((entry, idx) => (
                      <li
                        key={`${entry.name}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-zinc-800/80 bg-zinc-950 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-display-mono w-5 text-zinc-500">#{idx + 1}</span>
                          <img
                            src={buildMinecraftHeadAvatarUrl(entry.name, { size: 24 })}
                            alt=""
                            className="h-6 w-6 rounded border border-zinc-700"
                          />
                          <span className="truncate font-semibold text-white">{entry.name}</span>
                        </div>
                        {entry.stat && (
                          <span className="shrink-0 font-display-mono text-[11px] text-rose-300">
                            {entry.stat}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Live Online Sample Players */}
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Live Online Players</h3>
                  </div>
                  <span className="font-display-mono text-xs text-zinc-400">
                    {effectiveOnline ? `${effectivePlayersOnline} online` : 'Offline'}
                  </span>
                </div>

                {samplePlayers.length === 0 ? (
                  <p className="py-4 text-xs text-zinc-500">
                    {effectiveOnline
                      ? 'This server hides individual usernames in its public status packet.'
                      : 'Server is offline or unreachable.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {samplePlayers.map((p) => (
                      <div
                        key={p.uuid || p.name}
                        className="flex items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200"
                      >
                        <img
                          src={buildMinecraftHeadAvatarUrl(p.name, { size: 24 })}
                          alt=""
                          className="h-5 w-5 rounded-sm"
                        />
                        <span className="truncate font-display-mono">{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'heartbeat' && (
            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">Live Plugin Heartbeat Endpoint</h3>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy('curl-telemetry', curlSnippet)}
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
                >
                  {copiedKey === 'curl-telemetry' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'curl-telemetry' ? 'Copied' : 'Copy Command'}</span>
                </button>
              </div>
              <p className="text-xs text-zinc-400">
                Configure your Paper, Purpur, Spigot, or Velocity server to post real TPS, MSPT, ping, and top player stats to SwxStudios every 60 seconds:
              </p>
              <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-[11px] text-emerald-300">
                {curlSnippet}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
