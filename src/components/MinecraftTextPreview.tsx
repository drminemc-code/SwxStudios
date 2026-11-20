import React, { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Server, Wifi } from 'lucide-react';
import { LiveServerStatus, MinecraftServerListing, ProbeRegionId } from '../types';
import {
  parseMinecraftFormattedSegments,
  resolveProbeRegionInfo,
} from '../utils/mcToolsLogic';

interface MinecraftFormattedTextProps {
  text: string;
  className?: string;
}

export const MinecraftFormattedText: React.FC<MinecraftFormattedTextProps> = ({
  text,
  className = '',
}) => {
  const segments = parseMinecraftFormattedSegments(text);
  if (segments.length === 0) {
    return <span className={className}>&nbsp;</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        const decorations: string[] = [];
        if (seg.underline) decorations.push('underline');
        if (seg.strikethrough) decorations.push('line-through');
        return (
          <span
            key={idx}
            style={{
              color: seg.color,
              fontWeight: seg.bold ? 700 : 400,
              fontStyle: seg.italic ? 'italic' : 'normal',
              textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </span>
  );
};

export const PingSignalBars: React.FC<{
  online: boolean | null;
  pingMs?: number | null;
}> = ({ online, pingMs }) => {
  const activeCount =
    online === false
      ? 0
      : typeof pingMs !== 'number'
      ? 5
      : pingMs <= 70
      ? 5
      : pingMs <= 130
      ? 4
      : pingMs <= 210
      ? 3
      : 2;

  const barColor =
    online === false
      ? 'bg-zinc-700'
      : activeCount >= 4
      ? 'bg-emerald-400'
      : activeCount === 3
      ? 'bg-amber-400'
      : 'bg-rose-400';

  return (
    <span
      aria-label={
        online === false
          ? 'Offline'
          : typeof pingMs === 'number'
          ? `${pingMs}ms latency`
          : 'Signal active'
      }
      className="inline-flex h-3 items-end gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          className={`w-0.5 transition-colors ${
            bar <= activeCount ? barColor : 'bg-zinc-700/60'
          }`}
          style={{ height: `${bar * 2 + 2}px` }}
        />
      ))}
    </span>
  );
};

interface LiveMotdCardProps {
  serverName?: string;
  address?: string;
  versionLabel?: string;
  playersOnline?: number;
  playersMax?: number;
  pingMs?: number | null;
  online?: boolean | null;
  line1: string;
  line2: string;
  iconUrl?: string | null;
  onEditMotd?: () => void;
}

export const LiveMotdCard: React.FC<LiveMotdCardProps> = ({
  serverName = 'SwxStudios Network',
  address = 'play.swxstudios.net',
  versionLabel = 'Paper 1.21.4',
  playersOnline = 24,
  playersMax = 100,
  pingMs = 28,
  online = true,
  line1,
  line2,
  iconUrl,
  onEditMotd,
}) => {
  return (
    <div className="rounded-lg border border-zinc-800/90 bg-[#0b0b0e] p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 text-[11px]">
        <span className="font-display-mono font-semibold uppercase tracking-wider text-zinc-400">
          LIVE MOTD PREVIEW
        </span>
        <span className="inline-flex items-center gap-1.5 font-display-mono text-zinc-400 tabular-nums">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              online === false ? 'bg-red-400' : 'bg-emerald-400'
            }`}
            aria-hidden="true"
          />
          <span>{versionLabel}</span>
        </span>
      </div>

      {/* Simulated Minecraft Multiplayer List Row */}
      <div className="mt-3 flex items-start gap-3 rounded-md border border-zinc-800/70 bg-[#141418] p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700/80 bg-zinc-950">
          <img
            src={
              iconUrl ||
              '/assets/aistudio/Gemini_Generated_Image_m1vgo5m1vgo5m1vg_2bbe67cb.jpeg'
            }
            alt={`${serverName} icon 64x64`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-display text-xs font-bold text-white">{serverName}</span>
            <div className="flex shrink-0 items-center gap-2 font-display-mono text-[11px] text-zinc-400 tabular-nums">
              <span>
                {playersOnline.toLocaleString()}/{playersMax.toLocaleString()}
              </span>
              <PingSignalBars online={online} pingMs={pingMs} />
            </div>
          </div>

          <div className="mt-1 space-y-0.5 font-mc-pixel text-[17px] leading-[1.1] tracking-wide">
            <div className="truncate">
              <MinecraftFormattedText text={line1} />
            </div>
            <div className="truncate">
              <MinecraftFormattedText text={line2} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="truncate font-display-mono">{address}</span>
        {onEditMotd && (
          <button
            type="button"
            onClick={onEditMotd}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-rose-400 hover:text-rose-300 focus-visible:outline-none focus-visible:underline"
          >
            <span>Edit this MOTD</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

interface InteractiveHeroServerCardProps {
  featuredServers: MinecraftServerListing[];
  liveStatusMap: Record<string, LiveServerStatus>;
  probeRegion?: ProbeRegionId;
  onRefreshServer: (srv: MinecraftServerListing) => void;
  onOpenServers: () => void;
  onOpenMotdTool: () => void;
}

export const InteractiveHeroServerCard: React.FC<InteractiveHeroServerCardProps> = ({
  featuredServers,
  liveStatusMap,
  probeRegion = 'asia',
  onRefreshServer,
  onOpenServers,
  onOpenMotdTool,
}) => {
  const regionMeta = resolveProbeRegionInfo(probeRegion);
  const [selectedId, setSelectedId] = useState<string>(
    featuredServers[0]?.id || 'custom-ping'
  );
  const [customIp, setCustomIp] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customStatus, setCustomStatus] = useState<{
    address: string;
    data: LiveServerStatus;
  } | null>(null);

  useEffect(() => {
    if (
      selectedId !== 'custom-ping' &&
      !featuredServers.some((s) => s.id === selectedId) &&
      featuredServers[0]
    ) {
      setSelectedId(featuredServers[0].id);
    }
  }, [featuredServers, selectedId]);

  const activeServer = featuredServers.find((s) => s.id === selectedId) || featuredServers[0];
  const showingCustom = selectedId === 'custom-ping' && customStatus !== null;
  const activeLive = showingCustom
    ? customStatus.data
    : activeServer
    ? liveStatusMap[activeServer.id]
    : undefined;

  const displayName = showingCustom
    ? customStatus.address
    : activeServer?.name || 'SwxStudios Network';
  const displayAddress = showingCustom
    ? customStatus.address
    : activeServer?.address || 'play.swxstudios.net';
  const displayVersion = activeLive?.online
    ? activeLive.software || activeLive.version || activeServer?.version || 'Java 1.21'
    : activeServer?.version || 'Paper 1.21.4';
  const displayLine1 =
    activeLive?.motdLines?.[0] ||
    activeServer?.motd ||
    '&f&lꜱᴡxꜱᴛᴜᴅɪᴏꜱ &8| &7Plugins, Models & Setups';
  const displayLine2 =
    activeLive?.motdLines?.[1] ||
    (activeLive?.online
      ? `&a${activeLive.playersOnline.toLocaleString()} online &8• &7${displayVersion}`
      : '&eLive Server Telemetry &8• &bFree, Premium & Ultimate');

  const handleQuickPing = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = customIp.trim();
    if (!target) return;

    const matched = featuredServers.find(
      (s) => s.address.trim().toLowerCase() === target.toLowerCase()
    );
    if (matched) {
      setSelectedId(matched.id);
      onRefreshServer(matched);
      return;
    }

    setCustomLoading(true);
    try {
      const res = await fetch(
        `/api/mc/status?host=${encodeURIComponent(target)}&edition=java&region=${encodeURIComponent(probeRegion)}&fresh=1`
      );
      const data = (await res.json()) as {
        online?: boolean;
        host?: string;
        port?: number;
        version?: string | null;
        software?: string | null;
        pingMs?: number | null;
        probeRegion?: string;
        probeLocation?: string;
        playersOnline?: number;
        playersMax?: number;
        motdLines?: string[];
        iconBase64?: string | null;
        error?: string;
      };
      setCustomStatus({
        address: target,
        data: {
          loading: false,
          online: res.ok ? Boolean(data.online) : false,
          host: data.host || target,
          port: data.port,
          version: data.version ?? null,
          software: data.software ?? null,
          pingMs: typeof data.pingMs === 'number' ? data.pingMs : null,
          probeRegion: data.probeRegion || probeRegion,
          probeLocation: data.probeLocation || regionMeta.label,
          playersOnline: typeof data.playersOnline === 'number' ? data.playersOnline : 0,
          playersMax: typeof data.playersMax === 'number' ? data.playersMax : 0,
          motdLines: Array.isArray(data.motdLines) ? data.motdLines : [],
          iconBase64: data.iconBase64 ?? null,
          error: !res.ok ? data.error : undefined,
        },
      });
      setSelectedId('custom-ping');
    } catch {
      setCustomStatus({
        address: target,
        data: {
          loading: false,
          online: false,
          playersOnline: 0,
          playersMax: 0,
          error: 'Could not reach server',
        },
      });
      setSelectedId('custom-ping');
    } finally {
      setCustomLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800/90 bg-[#0b0b0e] p-4 shadow-sm">
      {/* Header + Quick IP Connect Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-display-mono font-semibold uppercase tracking-wider text-zinc-300">
          <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>{regionMeta.shortLabel} · LIVE SLP</span>
        </span>
        <span
          className={`font-display-mono tabular-nums ${
            activeLive?.online === true && typeof activeLive.pingMs === 'number' && activeLive.pingMs <= 75
              ? 'text-emerald-300'
              : 'text-zinc-400'
          }`}
        >
          {activeLive?.loading || customLoading
            ? 'Pinging...'
            : activeLive?.online === true && typeof activeLive.pingMs === 'number'
            ? `${activeLive.pingMs} ms`
            : activeLive?.online === false
            ? 'Offline'
            : displayVersion}
        </span>
      </div>

      {/* Quick Server IP Ping Input */}
      <form onSubmit={handleQuickPing} className="mt-3 flex gap-1.5">
        <label htmlFor="hero-live-ip-input" className="sr-only">
          Ping any Minecraft server IP
        </label>
        <input
          id="hero-live-ip-input"
          type="text"
          value={customIp}
          onChange={(e) => setCustomIp(e.target.value)}
          placeholder="Ping any IP (e.g. donutsmp.net)"
          className="h-8 min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2.5 font-display-mono text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={customLoading}
          className="h-8 shrink-0 rounded bg-rose-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
        >
          {customLoading ? '...' : 'Ping'}
        </button>
      </form>

      {/* Selectable Featured Server Rows */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {featuredServers.slice(0, 4).map((srv) => {
          const st = liveStatusMap[srv.id];
          const isSelected = selectedId === srv.id;
          return (
            <button
              key={srv.id}
              type="button"
              onClick={() => setSelectedId(srv.id)}
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-rose-500/80 bg-rose-950/30 text-white'
                  : 'border-zinc-800/80 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    st?.loading
                      ? 'bg-amber-400 animate-pulse'
                      : st?.online === true
                      ? 'bg-emerald-400'
                      : st?.online === false
                      ? 'bg-red-400'
                      : 'bg-zinc-600'
                  }`}
                />
                <span className="truncate text-[11px] font-semibold">{srv.name}</span>
              </span>
              <span className="font-display-mono shrink-0 text-[10px] text-zinc-500 tabular-nums">
                {st?.online ? `${st.playersOnline}` : srv.edition}
              </span>
            </button>
          );
        })}
      </div>

      {/* Minecraft Multiplayer List Row Preview */}
      <div className="mt-3 flex items-start gap-3 rounded-md border border-zinc-800/80 bg-[#141418] p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700/80 bg-zinc-950">
          <img
            src={
              activeLive?.iconBase64 ||
              '/assets/aistudio/Gemini_Generated_Image_m1vgo5m1vgo5m1vg_2bbe67cb.jpeg'
            }
            alt={`${displayName} server icon`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-display text-xs font-bold text-white">
              {displayName}
            </span>
            <div className="flex shrink-0 items-center gap-1.5 font-display-mono text-[11px] text-zinc-300 tabular-nums">
              <span>
                {activeLive?.online
                  ? `${activeLive.playersOnline.toLocaleString()}/${activeLive.playersMax.toLocaleString()}`
                  : activeLive?.loading || customLoading
                  ? '...'
                  : '0/0'}
              </span>
              <PingSignalBars
                online={activeLive?.online ?? null}
                pingMs={activeLive?.pingMs}
              />
            </div>
          </div>

          <div className="mt-1 space-y-0.5 font-mc-pixel text-[16px] leading-[1.08] tracking-wide">
            <div className="truncate">
              <MinecraftFormattedText text={displayLine1} />
            </div>
            <div className="truncate">
              <MinecraftFormattedText text={displayLine2} />
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="truncate font-display-mono text-zinc-500">{displayAddress}</span>
        <div className="flex items-center gap-3">
          {activeServer && (
            <button
              type="button"
              onClick={() => onRefreshServer(activeServer)}
              className="inline-flex items-center gap-1 font-medium text-zinc-400 hover:text-white"
            >
              <RefreshCw
                className={`h-3 w-3 ${activeLive?.loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenServers}
            className="inline-flex items-center gap-1 font-medium text-zinc-300 hover:text-white"
          >
            <Server className="h-3 w-3 text-rose-400" aria-hidden="true" />
            <span>Servers</span>
          </button>
          <button
            type="button"
            onClick={onOpenMotdTool}
            className="inline-flex items-center gap-1 font-semibold text-rose-400 hover:text-rose-300"
          >
            <span>Edit MOTD</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
