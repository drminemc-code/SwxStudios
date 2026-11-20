import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  Gauge,
  Globe,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Star,
  ThumbsUp,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react';
import {
  LiveServerStatus,
  MinecraftServerListing,
  ProbeRegionId,
  ServerEdition,
  ServerTelemetrySnapshot,
} from '../types';
import {
  classifyPingHealth,
  classifyTpsHealth,
  parseTopPlayerEntry,
  PROBE_REGIONS,
  resolveProbeRegionInfo,
  ServerDraftInput,
  type ServerSortMode,
  sortServerListings,
  validateServerDraft,
} from '../utils/mcToolsLogic';
import { buildMinecraftHeadAvatarUrl } from '../utils/skinLogic';
import { ExploreMapModal } from './ExploreMapModal';
import { MinecraftFormattedText } from './MinecraftTextPreview';
import { ServerDetailModal } from './ServerDetailModal';

interface ServersViewProps {
  servers: MinecraftServerListing[];
  liveStatusMap: Record<string, LiveServerStatus>;
  telemetryMap: Record<string, ServerTelemetrySnapshot>;
  probeRegion?: ProbeRegionId;
  onProbeRegionChange?: (region: ProbeRegionId) => void;
  canPost: boolean;
  isOwner: boolean;
  currentUid?: string | null;
  initialSelectedServerId?: string | null;
  onClearInitialSelected?: () => void;
  onRequireAuth: () => void;
  onCheckLiveStatus: (srv: MinecraftServerListing, fresh?: boolean) => Promise<void>;
  onRefreshAllLive: (targets: MinecraftServerListing[], fresh?: boolean) => Promise<void>;
  onCreateServer: (draft: ServerDraftInput) => Promise<void>;
  onUpdateServerTelemetry: (
    srv: MinecraftServerListing,
    updates: {
      tps?: number;
      mspt?: number;
      pingMs?: number;
      topPlayers?: string[];
    }
  ) => Promise<void>;
  onVoteServer: (serverId: string) => Promise<void>;
  onUpdateServerFlags: (
    serverId: string,
    updates: { approved?: boolean; featured?: boolean }
  ) => Promise<void>;
  onDeleteServer: (serverId: string) => Promise<void>;
  onCopyAddress: (address: string) => void;
}

const SERVER_CATEGORIES = [
  'All Categories',
  'Survival SMP',
  'Lifesteal',
  'Crystal PvP',
  'Factions',
  'Skyblock',
  'Bedwars',
  'KitPvP',
  'Economy',
  'Prison',
  'Anarchy',
  'Minigames',
  'Creative',
  'Roleplay',
  'Other',
] as const;

const SORT_MODE_LABELS: Record<ServerSortMode, string> = {
  featured: 'Featured',
  votes: 'Most Voted',
  tps: 'Highest TPS',
  ping: 'Lowest Ping',
  players: 'Most Players Online',
  newest: 'Recently Added',
};

const EMPTY_DRAFT: ServerDraftInput = {
  name: '',
  address: '',
  edition: 'Java',
  version: '1.21.4',
  motd: '&f&lMy Server &8| &7Survival & Custom Plugins',
  gameModesText: 'Survival SMP, Lifesteal',
  description: '',
  bedrockAddress: '',
  tpsText: '',
  msptText: '',
  pingMsText: '',
  topPlayersText: '',
};

export const ServersView: React.FC<ServersViewProps> = ({
  servers,
  liveStatusMap,
  telemetryMap,
  probeRegion = 'asia',
  onProbeRegionChange,
  canPost,
  isOwner,
  currentUid,
  initialSelectedServerId,
  onClearInitialSelected,
  onRequireAuth,
  onCheckLiveStatus,
  onRefreshAllLive,
  onCreateServer,
  onUpdateServerTelemetry,
  onVoteServer,
  onUpdateServerFlags,
  onDeleteServer,
  onCopyAddress,
}) => {
  const [editionFilter, setEditionFilter] = useState<ServerEdition | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [sortMode, setSortMode] = useState<ServerSortMode>('featured');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Auto-Connect Server IP probe bar
  const [quickIpInput, setQuickIpInput] = useState('');
  const [quickEdition, setQuickEdition] = useState<'java' | 'bedrock'>('java');
  const [quickProbe, setQuickProbe] = useState<LiveServerStatus | null>(null);
  const quickDebounceRef = useRef<number | null>(null);

  // Add Server form + live auto-connect preview
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [draft, setDraft] = useState<ServerDraftInput>(EMPTY_DRAFT);
  const [formProbe, setFormProbe] = useState<LiveServerStatus | null>(null);
  const formDebounceRef = useRef<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [detailServerId, setDetailServerId] = useState<string | null>(
    initialSelectedServerId ?? null
  );
  const [exploreMapServerId, setExploreMapServerId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedServerId) {
      setDetailServerId(initialSelectedServerId);
      onClearInitialSelected?.();
    }
  }, [initialSelectedServerId, onClearInitialSelected]);

  // Automatically connect and refresh all visible servers on mount and every 45s
  useEffect(() => {
    if (servers.length === 0) return;
    void onRefreshAllLive(servers, false);
    const interval = window.setInterval(() => {
      void onRefreshAllLive(servers, true);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [servers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const probeServerAddress = async (
    rawAddress: string,
    edition: 'java' | 'bedrock'
  ): Promise<LiveServerStatus> => {
    const clean = rawAddress.trim();
    if (!clean || !/^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(clean)) {
      return {
        loading: false,
        online: null,
        playersOnline: 0,
        playersMax: 0,
        error: 'Enter a valid server IP or domain (e.g. mc.hypixel.net).',
      };
    }

    const res = await fetch(
      `/api/mc/status?host=${encodeURIComponent(clean)}&edition=${edition}&region=${encodeURIComponent(probeRegion)}&fresh=1`
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

    const regionMeta = resolveProbeRegionInfo(probeRegion);

    if (!res.ok) {
      return {
        loading: false,
        online: false,
        host: clean,
        probeRegion,
        probeLocation: regionMeta.label,
        playersOnline: 0,
        playersMax: 0,
        error: data.error || 'Could not reach server.',
      };
    }

    return {
      loading: false,
      online: Boolean(data.online),
      host: data.host || clean,
      resolvedHost: data.resolvedHost || null,
      ip: data.ip || null,
      port: data.port,
      version: data.version || null,
      software: data.software || null,
      pingMs: typeof data.pingMs === 'number' ? data.pingMs : null,
      probeRegion: data.probeRegion || probeRegion,
      probeLocation: data.probeLocation || regionMeta.label,
      playersOnline: data.playersOnline ?? 0,
      playersMax: data.playersMax ?? 0,
      playerSample: Array.isArray(data.playerSample) ? data.playerSample : [],
      motdLines: Array.isArray(data.motdLines) ? data.motdLines : [],
      iconBase64: data.iconBase64 || null,
      checkedAt: data.checkedAt,
    };
  };

  // Auto-connect quick probe as the user types a valid IP/hostname
  useEffect(() => {
    if (quickDebounceRef.current) window.clearTimeout(quickDebounceRef.current);
    const trimmed = quickIpInput.trim();
    if (!trimmed) {
      setQuickProbe(null);
      return;
    }
    if (trimmed.length < 4 || !trimmed.includes('.') || /\s/.test(trimmed)) {
      return;
    }

    quickDebounceRef.current = window.setTimeout(async () => {
      setQuickProbe({ loading: true, online: null, host: trimmed, playersOnline: 0, playersMax: 0 });
      try {
        const result = await probeServerAddress(trimmed, quickEdition);
        setQuickProbe(result);
      } catch {
        setQuickProbe({
          loading: false,
          online: false,
          host: trimmed,
          playersOnline: 0,
          playersMax: 0,
          error: 'Connection timed out.',
        });
      }
    }, 450);

    return () => {
      if (quickDebounceRef.current) window.clearTimeout(quickDebounceRef.current);
    };
  }, [quickIpInput, quickEdition, probeRegion]);

  // Auto-connect & auto-fill Submit Server form whenever Server IP changes
  useEffect(() => {
    if (!showSubmitForm) return;
    if (formDebounceRef.current) window.clearTimeout(formDebounceRef.current);
    const trimmed = draft.address.trim();
    if (!trimmed) {
      setFormProbe(null);
      return;
    }
    if (trimmed.length < 4 || !trimmed.includes('.') || /\s/.test(trimmed)) {
      return;
    }

    const ed: 'java' | 'bedrock' = draft.edition === 'Bedrock' ? 'bedrock' : 'java';
    formDebounceRef.current = window.setTimeout(async () => {
      setFormProbe({ loading: true, online: null, host: trimmed, playersOnline: 0, playersMax: 0 });
      try {
        const result = await probeServerAddress(trimmed, ed);
        setFormProbe(result);
        if (result.online) {
          const hostLabel = trimmed.split(':')[0].split('.')[0];
          const prettyName =
            hostLabel.charAt(0).toUpperCase() + hostLabel.slice(1);
          setDraft((prev) => ({
            ...prev,
            name: prev.name.trim() ? prev.name : prettyName,
            version: result.version ? result.version.slice(0, 40) : prev.version,
            motd:
              result.motdLines && result.motdLines.length > 0
                ? result.motdLines.join(' ').slice(0, 240)
                : prev.motd,
            pingMsText:
              typeof result.pingMs === 'number' ? String(result.pingMs) : prev.pingMsText,
            topPlayersText:
              !prev.topPlayersText?.trim() && result.playerSample && result.playerSample.length > 0
                ? result.playerSample
                    .slice(0, 5)
                    .map((p) => `${p.name} | Online Now`)
                    .join('\n')
                : prev.topPlayersText,
          }));
        }
      } catch {
        setFormProbe({
          loading: false,
          online: false,
          host: trimmed,
          playersOnline: 0,
          playersMax: 0,
          error: 'Could not reach server IP.',
        });
      }
    }, 450);

    return () => {
      if (formDebounceRef.current) window.clearTimeout(formDebounceRef.current);
    };
  }, [draft.address, draft.edition, showSubmitForm]);

  const handleManualQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickDebounceRef.current) window.clearTimeout(quickDebounceRef.current);
    const trimmed = quickIpInput.trim();
    if (!trimmed) return;
    setQuickProbe({ loading: true, online: null, host: trimmed, playersOnline: 0, playersMax: 0 });
    try {
      const result = await probeServerAddress(trimmed, quickEdition);
      setQuickProbe(result);
    } catch {
      setQuickProbe({
        loading: false,
        online: false,
        host: trimmed,
        playersOnline: 0,
        playersMax: 0,
        error: 'Network error while connecting to server IP.',
      });
    }
  };

  const handleUseQuickConnectInForm = () => {
    if (!canPost) {
      onRequireAuth();
      return;
    }
    const cleanHost = quickIpInput.trim();
    const hostTitle = cleanHost.split(':')[0].split('.')[0] || 'My Server';
    const capitalized = hostTitle.charAt(0).toUpperCase() + hostTitle.slice(1);
    setDraft({
      ...EMPTY_DRAFT,
      name: capitalized,
      address: cleanHost,
      edition: quickEdition === 'bedrock' ? 'Bedrock' : 'Java',
      version: quickProbe?.version ? quickProbe.version.slice(0, 40) : '1.21.4',
      motd:
        quickProbe?.motdLines && quickProbe.motdLines.length > 0
          ? quickProbe.motdLines.join(' ').slice(0, 240)
          : EMPTY_DRAFT.motd,
      pingMsText: typeof quickProbe?.pingMs === 'number' ? String(quickProbe.pingMs) : '',
      topPlayersText:
        quickProbe?.playerSample && quickProbe.playerSample.length > 0
          ? quickProbe.playerSample
              .slice(0, 5)
              .map((p) => `${p.name} | Online Now`)
              .join('\n')
          : '',
    });
    setFormProbe(quickProbe);
    setShowSubmitForm(true);
  };

  const visibleServers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const catLower = categoryFilter.toLowerCase();
    const filtered = servers.filter((s) => {
      if (!isOwner && !s.approved) return false;
      if (editionFilter !== 'All' && s.edition !== editionFilter) return false;
      if (categoryFilter !== 'All Categories') {
        const modes = s.gameModes.map((m) => m.toLowerCase());
        const matchesCat =
          modes.some((m) => m.includes(catLower) || catLower.includes(m)) ||
          s.name.toLowerCase().includes(catLower);
        if (!matchesCat) return false;
      }
      if (onlineOnly) {
        const ping = liveStatusMap[s.id];
        if (!ping || ping.online !== true) return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.gameModes.some((m) => m.toLowerCase().includes(q))
      );
    });
    return sortServerListings(filtered, sortMode, liveStatusMap, telemetryMap);
  }, [
    servers,
    editionFilter,
    categoryFilter,
    sortMode,
    onlineOnly,
    liveStatusMap,
    telemetryMap,
    searchQuery,
    isOwner,
  ]);

  const liveAggregateStats = useMemo(() => {
    let onlineServers = 0;
    let totalPlayers = 0;
    for (const srv of visibleServers) {
      const st = liveStatusMap[srv.id];
      if (st?.online) {
        onlineServers++;
        totalPlayers += st.playersOnline || 0;
      }
    }
    return { onlineServers, totalPlayers };
  }, [visibleServers, liveStatusMap]);

  const detailServer = useMemo(
    () => servers.find((s) => s.id === detailServerId) ?? null,
    [servers, detailServerId]
  );

  const exploreMapServer = useMemo(
    () => servers.find((s) => s.id === exploreMapServerId) ?? null,
    [servers, exploreMapServerId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = validateServerDraft(draft);
    if (err) {
      setFormError(err);
      return;
    }

    setSubmitting(true);
    try {
      await onCreateServer(draft);
      setDraft(EMPTY_DRAFT);
      setFormProbe(null);
      setShowSubmitForm(false);
    } catch (submitErr) {
      setFormError(
        submitErr instanceof Error ? submitErr.message : 'Could not submit server listing.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (server: MinecraftServerListing) => {
    try {
      await navigator.clipboard.writeText(server.address);
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = server.address;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      } catch {
        // Ignore fallback clipboard restriction
      }
    }
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    setCopiedId(server.id);
    onCopyAddress(server.address);
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedId((prev) => (prev === server.id ? null : prev));
    }, 1800);
  };

  const handleRefreshDirectory = async () => {
    setRefreshingAll(true);
    try {
      await onRefreshAllLive(visibleServers, true);
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1200px] overflow-x-hidden px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-xs font-medium text-rose-400">
            <Server className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SwxStudios / Live Minecraft Server List</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Minecraft server list
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every listing connects live against its server IP for real-time Online status, Ping ms, TPS/MSPT, Players, and Top Players.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-[#111114] px-3 text-xs text-zinc-200">
            <Globe className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <label htmlFor="servers-probe-region" className="text-[11px] text-zinc-400">
              Location:
            </label>
            <select
              id="servers-probe-region"
              aria-label="Ping probe location"
              value={probeRegion}
              onChange={(e) => onProbeRegionChange?.(e.target.value as ProbeRegionId)}
              className="bg-transparent font-semibold text-emerald-300 focus:outline-none"
            >
              {PROBE_REGIONS.map((region) => (
                <option key={region.id} value={region.id} className="bg-zinc-950 text-zinc-100">
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleRefreshDirectory()}
            disabled={refreshingAll}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-[#111114] px-3.5 text-xs font-semibold text-zinc-200 hover:border-zinc-700 hover:text-white disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-emerald-400 ${refreshingAll ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{refreshingAll ? 'Checking Live...' : 'Refresh Live'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canPost) {
                onRequireAuth();
                return;
              }
              setShowSubmitForm((prev) => !prev);
            }}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{showSubmitForm ? 'Close Form' : 'List Your Server'}</span>
          </button>
        </div>
      </div>

      {/* Auto-Connect Any Server IP Live Monitor Bar */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-[#111114] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Wifi className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>Instant Auto-Connect Server IP ({resolveProbeRegionInfo(probeRegion).label})</span>
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Type any Java or Bedrock IP (e.g. <span className="font-display-mono text-zinc-300">donutsmp.net</span>, <span className="font-display-mono text-zinc-300">mcpvp.club</span>, or <span className="font-display-mono text-zinc-300">acersmp.xyz</span>) to connect automatically and inspect status, ping, players, and MOTD.
            </p>
          </div>

          <form
            onSubmit={handleManualQuickConnect}
            className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[460px]"
          >
            <input
              type="text"
              value={quickIpInput}
              onChange={(e) => setQuickIpInput(e.target.value)}
              placeholder="Enter server IP (e.g. donutsmp.net)..."
              aria-label="Connect server IP for live status"
              className="h-10 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
            />
            <select
              value={quickEdition}
              onChange={(e) => setQuickEdition(e.target.value as 'java' | 'bedrock')}
              aria-label="Quick connect edition"
              className="h-10 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200"
            >
              <option value="java">Java</option>
              <option value="bedrock">Bedrock</option>
            </select>
            <button
              type="submit"
              disabled={quickProbe?.loading}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{quickProbe?.loading ? 'Connecting...' : 'Connect IP'}</span>
            </button>
          </form>
        </div>

        {/* Live Auto-Connected Result Preview */}
        {quickProbe && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-[#0b0b0e] p-4">
            {quickProbe.loading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                <span className="font-display-mono">
                  Connecting to {quickProbe.host} ({quickEdition.toUpperCase()})...
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {quickProbe.iconBase64 ? (
                      <img
                        src={quickProbe.iconBase64}
                        alt="Live server icon"
                        className="h-11 w-11 rounded border border-zinc-700 bg-zinc-950"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-400">
                        <Server className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display-mono text-sm font-bold text-white">
                          {quickProbe.host}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-display-mono text-[11px] font-semibold ${
                            quickProbe.online
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-red-500/15 text-red-300'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              quickProbe.online ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                          />
                          {quickProbe.online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        {typeof quickProbe.pingMs === 'number' && (
                          <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-display-mono text-[11px] text-emerald-300">
                            {quickProbe.pingMs} ms ping
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {quickProbe.software || quickEdition.toUpperCase()} ·{' '}
                        {quickProbe.version || 'Unknown version'} · Port {quickProbe.port || 25565}
                        {quickProbe.resolvedHost && quickProbe.resolvedHost !== quickProbe.host
                          ? ` (${quickProbe.resolvedHost})`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {quickProbe.online && (
                      <span className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-display-mono text-xs font-semibold text-white tabular-nums">
                        {quickProbe.playersOnline.toLocaleString()} /{' '}
                        {quickProbe.playersMax.toLocaleString()} players
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleUseQuickConnectInForm}
                      className="h-8 rounded-md bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500"
                    >
                      Add to Directory
                    </button>
                  </div>
                </div>

                {quickProbe.motdLines && quickProbe.motdLines.length > 0 && (
                  <div className="rounded border border-zinc-800/80 bg-[#08080a] px-3 py-2 font-display-mono text-xs space-y-0.5">
                    {quickProbe.motdLines.map((line, i) => (
                      <div key={i}>
                        <MinecraftFormattedText text={line} />
                      </div>
                    ))}
                  </div>
                )}

                {quickProbe.playerSample && quickProbe.playerSample.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-zinc-500 mr-1">Online sample:</span>
                    {quickProbe.playerSample.slice(0, 10).map((p) => (
                      <span
                        key={p.uuid || p.name}
                        className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-display-mono text-[11px] text-zinc-200"
                      >
                        <img
                          src={buildMinecraftHeadAvatarUrl(p.name, { size: 20 })}
                          alt=""
                          className="h-3.5 w-3.5 rounded-sm"
                        />
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}

                {quickProbe.error && (
                  <p className="text-xs text-rose-300">{quickProbe.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Submit Server Form (with auto-connect + TPS, MSPT, Ping, Top Players) */}
      {showSubmitForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-zinc-800 bg-[#111114] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Add Minecraft Server Listing</h2>
              <p className="text-xs text-zinc-400">
                {isOwner
                  ? 'Owner submissions publish immediately. Typing your IP auto-connects status, version, ping, and MOTD.'
                  : 'Enter your server IP to auto-verify live status. Submissions appear after owner review.'}
              </p>
            </div>
            {formProbe && (
              <span
                className={`rounded px-2.5 py-1 font-display-mono text-[11px] font-semibold ${
                  formProbe.loading
                    ? 'bg-zinc-800 text-zinc-300'
                    : formProbe.online
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                {formProbe.loading
                  ? 'Connecting to IP...'
                  : formProbe.online
                  ? `Connected · ${formProbe.playersOnline}/${formProbe.playersMax} · ${formProbe.pingMs ?? '?'}ms`
                  : formProbe.error || 'Offline / Unreachable'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="srv-address" className="block text-xs font-medium text-zinc-300">
                Server IP / Address (Auto-Connects Live)
              </label>
              <input
                id="srv-address"
                type="text"
                maxLength={120}
                value={draft.address}
                onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                placeholder="play.example.net or mc.hypixel.net"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="srv-name" className="block text-xs font-medium text-zinc-300">
                Server Name
              </label>
              <input
                id="srv-name"
                type="text"
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. SwxSMP Network"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="srv-edition" className="block text-xs font-medium text-zinc-300">
                Edition
              </label>
              <select
                id="srv-edition"
                value={draft.edition}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, edition: e.target.value as ServerEdition }))
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
              >
                <option value="Java">Java Edition</option>
                <option value="Bedrock">Bedrock Edition</option>
                <option value="Crossplay">Crossplay (Java + Bedrock)</option>
              </select>
            </div>

            <div>
              <label htmlFor="srv-version" className="block text-xs font-medium text-zinc-300">
                Minecraft Version
              </label>
              <input
                id="srv-version"
                type="text"
                maxLength={40}
                value={draft.version}
                onChange={(e) => setDraft((p) => ({ ...p, version: e.target.value }))}
                placeholder="1.21.4"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="srv-motd" className="block text-xs font-medium text-zinc-300">
                Server MOTD (auto-filled from live IP, supports &amp; color codes)
              </label>
              <input
                id="srv-motd"
                type="text"
                maxLength={240}
                value={draft.motd}
                onChange={(e) => setDraft((p) => ({ ...p, motd: e.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>

            <div>
              <label htmlFor="srv-modes" className="block text-xs font-medium text-zinc-300">
                Game Modes / Categories (comma separated)
              </label>
              <input
                id="srv-modes"
                type="text"
                value={draft.gameModesText}
                onChange={(e) => setDraft((p) => ({ ...p, gameModesText: e.target.value }))}
                placeholder="Survival SMP, Lifesteal, Skyblock"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
              />
            </div>

            <div>
              <label htmlFor="srv-bedrock" className="block text-xs font-medium text-zinc-300">
                Bedrock IP:Port (optional)
              </label>
              <input
                id="srv-bedrock"
                type="text"
                maxLength={120}
                value={draft.bedrockAddress || ''}
                onChange={(e) => setDraft((p) => ({ ...p, bedrockAddress: e.target.value }))}
                placeholder="bedrock.example.net:19132"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>

            {/* Live Performance & Leaderboard Inputs (TPS, MSPT, Ping, Top Players) */}
            <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-zinc-800/80 bg-[#0b0b0e] p-3.5">
              <div>
                <label htmlFor="srv-tps" className="block text-[11px] font-medium text-zinc-300">
                  Server TPS (e.g. 20.0)
                </label>
                <input
                  id="srv-tps"
                  type="number"
                  step="0.01"
                  min={0}
                  max={25}
                  value={draft.tpsText || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, tpsText: e.target.value }))}
                  placeholder="20.0"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="srv-mspt" className="block text-[11px] font-medium text-zinc-300">
                  Server MSPT (ms)
                </label>
                <input
                  id="srv-mspt"
                  type="number"
                  step="0.1"
                  min={0}
                  max={5000}
                  value={draft.msptText || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, msptText: e.target.value }))}
                  placeholder="14.5"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="srv-ping" className="block text-[11px] font-medium text-zinc-300">
                  Baseline Ping (auto from IP)
                </label>
                <input
                  id="srv-ping"
                  type="number"
                  min={0}
                  max={10000}
                  value={draft.pingMsText || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, pingMsText: e.target.value }))}
                  placeholder="26"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="srv-top-players" className="block text-xs font-medium text-zinc-300">
                Top Players Leaderboard (optional, one per line: Username | Stat)
              </label>
              <textarea
                id="srv-top-players"
                rows={3}
                value={draft.topPlayersText || ''}
                onChange={(e) => setDraft((p) => ({ ...p, topPlayersText: e.target.value }))}
                placeholder={'Notch | 140h Playtime\nSteve | $2.4M Balance'}
                className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="srv-desc" className="block text-xs font-medium text-zinc-300">
                Server Description (optional)
              </label>
              <textarea
                id="srv-desc"
                rows={2}
                maxLength={1500}
                value={draft.description || ''}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe features, custom plugins, economy, or wipe schedule..."
                className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100"
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-xs text-rose-300">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSubmitForm(false)}
              className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-4 text-xs font-semibold text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {submitting ? 'Publishing...' : 'Save Server Listing'}
            </button>
          </div>
        </form>
      )}

      {/* Search, Sort & Edition Strip */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Server edition filter">
          {(['All', 'Java', 'Bedrock', 'Crossplay'] as const).map((ed) => {
            const active = editionFilter === ed;
            return (
              <button
                key={ed}
                type="button"
                onClick={() => setEditionFilter(ed)}
                aria-pressed={active}
                className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                {ed}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setOnlineOnly((o) => !o)}
            aria-pressed={onlineOnly}
            className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
              onlineOnly
                ? 'border-emerald-500/70 bg-emerald-500/20 text-emerald-300'
                : 'border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
            }`}
          >
            Online Only
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Sort servers"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as ServerSortMode)}
            className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 focus:border-rose-500 focus:outline-none"
          >
            <option value="featured">Sort: Featured</option>
            <option value="votes">Sort: Most Voted</option>
            <option value="tps">Sort: Highest TPS</option>
            <option value="ping">Sort: Lowest Ping</option>
            <option value="players">Sort: Most Players Online</option>
            <option value="newest">Sort: Recently Added</option>
          </select>

          <div className="relative w-full sm:w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IP or mode..."
              aria-label="Search listed servers"
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Category Filter Pills (Minevex 14 Modes) */}
      <div
        className="mt-3 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Server game mode categories"
      >
        {SERVER_CATEGORIES.map((cat) => {
          const active = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              aria-pressed={active}
              className={`h-7 rounded border px-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                  : 'border-zinc-800/80 bg-[#111114] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Live Aggregate Status Bar (Minevex parity) */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">
            {SORT_MODE_LABELS[sortMode]} · {visibleServers.length} server{visibleServers.length === 1 ? '' : 's'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-300 font-medium tabular-nums">
            {liveAggregateStats.onlineServers} online
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-display-mono text-zinc-200 tabular-nums">
            {liveAggregateStats.totalPlayers.toLocaleString()} players online
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          Click any server for full TPS, MSPT, ping, and top players view
        </span>
      </div>

      {/* Directory List */}
      {visibleServers.length === 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-[#111114] p-10 text-center">
          <Globe className="mx-auto h-7 w-7 text-zinc-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-zinc-200">
            No matching servers listed yet
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Try clearing filters or connect your Minecraft server IP above.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleServers.map((srv) => {
            const live = liveStatusMap[srv.id];
            const telemetry =
              telemetryMap[srv.address.toLowerCase()] || telemetryMap[srv.id.toLowerCase()];
            const pingMs = live?.pingMs ?? telemetry?.avgPingMs ?? srv.pingMs ?? null;
            const tps = telemetry?.tps ?? srv.tps ?? null;
            const mspt = telemetry?.mspt ?? srv.mspt ?? null;
            const pingHealth = classifyPingHealth(pingMs);
            const tpsHealth = classifyTpsHealth(tps);
            const playersOnline = live?.online
              ? live.playersOnline
              : telemetry?.playersOnline ?? 0;
            const playersMax = live?.online
              ? live.playersMax
              : telemetry?.playersMax ?? 0;
            const displayMotd =
              live?.motdLines && live.motdLines.length > 0 ? live.motdLines.join(' ') : srv.motd;
            const topPlayersPreview =
              telemetry?.topPlayers && telemetry.topPlayers.length > 0
                ? telemetry.topPlayers.slice(0, 4).map((p) => p.name)
                : srv.topPlayers && srv.topPlayers.length > 0
                ? srv.topPlayers.slice(0, 4).map((e) => parseTopPlayerEntry(e).name)
                : (live?.playerSample || []).slice(0, 4).map((p) => p.name);

            return (
              <article
                key={srv.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800/90 bg-[#111114] p-5 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {live?.iconBase64 ? (
                        <img
                          src={live.iconBase64}
                          alt={`${srv.name} icon`}
                          className="mt-0.5 h-11 w-11 shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 object-cover"
                        />
                      ) : (
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-rose-400">
                          <Server className="h-5 w-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-semibold text-zinc-200">
                            {srv.edition}
                          </span>
                          <span className="font-display-mono text-zinc-400">
                            {live?.version || srv.version}
                          </span>
                          {srv.featured && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300">
                              <Star className="h-3 w-3" />
                              <span>Featured</span>
                            </span>
                          )}
                          {!srv.approved && (
                            <span className="rounded bg-zinc-800 px-2 py-0.5 font-semibold text-zinc-300">
                              Pending
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailServerId(srv.id)}
                          className="mt-1.5 block max-w-full truncate text-left text-base font-bold text-white hover:text-rose-300 transition-colors"
                        >
                          {srv.name}
                        </button>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-display-mono text-[11px] font-semibold ${
                          live?.loading
                            ? 'bg-zinc-800 text-zinc-300'
                            : live?.online
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : live?.online === false
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            live?.loading
                              ? 'bg-amber-400 animate-pulse'
                              : live?.online
                              ? 'bg-emerald-400'
                              : 'bg-red-400'
                          }`}
                        />
                        {live?.loading
                          ? 'Connecting'
                          : live?.online
                          ? 'Online'
                          : live?.online === false
                          ? 'Offline'
                          : 'Live'}
                      </span>

                      {!srv.isBaselineLive && (
                        <button
                          type="button"
                          onClick={() => void onVoteServer(srv.id)}
                          className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60"
                        >
                          <ThumbsUp className="h-3 w-3 text-rose-400" aria-hidden="true" />
                          <span className="tabular-nums">{srv.votes}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Telemetry Strip: Players, Ping, TPS, MSPT */}
                  <div className="grid grid-cols-4 gap-2 rounded-lg border border-zinc-800/80 bg-[#0b0b0e] px-3 py-2 text-[11px]">
                    <div>
                      <span className="block text-[10px] text-zinc-500">Players</span>
                      <span className="font-display-mono font-semibold text-white tabular-nums">
                        {live?.online ? `${playersOnline}/${playersMax}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Ping</span>
                      <span
                        className={`font-display-mono font-semibold tabular-nums ${
                          pingHealth.tone === 'good'
                            ? 'text-emerald-300'
                            : pingHealth.tone === 'warn'
                            ? 'text-amber-300'
                            : pingHealth.tone === 'bad'
                            ? 'text-red-300'
                            : 'text-zinc-400'
                        }`}
                      >
                        {pingHealth.label}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">TPS</span>
                      <span
                        className={`font-display-mono font-semibold tabular-nums ${
                          tpsHealth.tone === 'good'
                            ? 'text-emerald-300'
                            : tpsHealth.tone === 'warn'
                            ? 'text-amber-300'
                            : tpsHealth.tone === 'bad'
                            ? 'text-red-300'
                            : 'text-zinc-400'
                        }`}
                      >
                        {typeof tps === 'number' ? tps.toFixed(1) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">MSPT</span>
                      <span className="font-display-mono font-semibold text-zinc-200 tabular-nums">
                        {typeof mspt === 'number' ? `${mspt.toFixed(1)}ms` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border border-zinc-800/80 bg-[#0b0b0e] p-2.5 font-display-mono text-xs truncate">
                    <MinecraftFormattedText text={displayMotd} />
                  </div>

                  {/* Top / Online Players Preview + Modes */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-400">
                      {srv.gameModes.slice(0, 3).map((mode) => (
                        <span
                          key={mode}
                          className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5"
                        >
                          {mode}
                        </span>
                      ))}
                    </div>

                    {topPlayersPreview.length > 0 && (
                      <div className="flex items-center gap-1" title={`Players: ${topPlayersPreview.join(', ')}`}>
                        <Users className="h-3 w-3 text-zinc-500 mr-0.5" />
                        {topPlayersPreview.map((pName) => (
                          <img
                            key={pName}
                            src={buildMinecraftHeadAvatarUrl(pName, { size: 24 })}
                            alt={pName}
                            title={pName}
                            className="h-5 w-5 rounded border border-zinc-700"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative inline-flex">
                      {copiedId === srv.id && (
                        <span
                          role="status"
                          className="pointer-events-none absolute -top-8 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border border-emerald-500/50 bg-emerald-950/95 px-2 py-0.5 text-[11px] font-bold text-emerald-300 shadow-lg"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>Copied!</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopy(srv)}
                        aria-label={`Copy server address ${srv.address}`}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-display-mono text-xs transition-colors ${
                          copiedId === srv.id
                            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-rose-500/60'
                        }`}
                      >
                        {copiedId === srv.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                        )}
                        <span>{srv.address}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailServerId(srv.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60 hover:text-white"
                    >
                      <Gauge className="h-3 w-3 text-rose-400" aria-hidden="true" />
                      <span>Details & Stats</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExploreMapServerId(srv.id)}
                      aria-label={`Explore Map for ${srv.name}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-emerald-500/60 hover:text-emerald-200"
                    >
                      <MapIcon className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                      <span>Explore Map</span>
                    </button>

                    <button
                      type="button"
                      disabled={live?.loading}
                      onClick={() => void onCheckLiveStatus(srv, true)}
                      aria-label={`Ping ${srv.name}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-white disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${live?.loading ? 'animate-spin text-rose-400' : ''}`}
                      />
                    </button>
                  </div>

                  {isOwner && !srv.isBaselineLive && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateServerFlags(srv.id, { approved: !srv.approved })
                        }
                        className="inline-flex h-8 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        <span>{srv.approved ? 'Unapprove' : 'Approve'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateServerFlags(srv.id, { featured: !srv.featured })
                        }
                        className="inline-flex h-8 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                      >
                        <Star className="h-3 w-3 text-amber-300" />
                        <span>{srv.featured ? 'Unfeature' : 'Feature'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteServer(srv.id)}
                        aria-label={`Delete ${srv.name}`}
                        className="inline-flex h-8 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detailed Server View Modal */}
      <ServerDetailModal
        server={detailServer}
        liveStatus={detailServer ? liveStatusMap[detailServer.id] : undefined}
        telemetry={
          detailServer
            ? telemetryMap[detailServer.address.toLowerCase()] ||
              telemetryMap[detailServer.id.toLowerCase()]
            : undefined
        }
        canEditMetrics={Boolean(
          detailServer &&
            (isOwner || (currentUid && detailServer.submittedBy === currentUid))
        )}
        onClose={() => setDetailServerId(null)}
        onRefreshLive={(srv) => onCheckLiveStatus(srv, true)}
        onVote={onVoteServer}
        onCopyAddress={onCopyAddress}
        onExploreMap={(srv) => {
          setDetailServerId(null);
          setExploreMapServerId(srv.id);
        }}
        onSaveTelemetry={onUpdateServerTelemetry}
      />

      {/* Explore Map World Preview Modal */}
      <ExploreMapModal
        server={exploreMapServer}
        onClose={() => setExploreMapServerId(null)}
      />
    </section>
  );
};
