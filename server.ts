import 'dotenv/config';
import crypto from 'crypto';
import dns from 'dns';
import fs from 'fs';
import net from 'net';
import path from 'path';
import zlib from 'zlib';
import express, { type Request, type Response } from 'express';
import {
  DEFAULT_CHALLENGE_DIFFICULTY,
  generateRayId,
  verifyChallengeProof,
} from './src/utils/botVerifyLogic';

type OAuthProviderId = 'discord' | 'github' | 'twitch';

interface OAuthProfile {
  provider: OAuthProviderId;
  providerUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  connectedAt: string;
}

interface OAuthSessionData {
  primaryProvider: OAuthProviderId | null;
  connections: Partial<Record<OAuthProviderId, OAuthProfile>>;
}

interface ProviderConfig {
  id: OAuthProviderId;
  label: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  portalUrl: string;
  envPrefix: string;
}

const PORT = 3000;
const OWNER_EMAILS = new Set(['randellemupas@gmail.com', 'drminemc@gmail.com']);
const ALLOWED_ARCHIVE_EXTENSIONS = new Set(['jar', 'zip', 'rar', '7z', 'gz', 'tar']);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const TELEMETRY_FILE = path.join(UPLOADS_DIR, 'server-telemetry.json');

interface ServerTelemetryRecord {
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

const telemetryStore = new Map<string, ServerTelemetryRecord>();
try {
  if (fs.existsSync(TELEMETRY_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8')) as ServerTelemetryRecord[];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item?.serverKey) {
          telemetryStore.set(item.serverKey.toLowerCase(), item);
        }
      }
    }
  }
} catch {
  // Start with empty telemetry store if file is unreadable
}

function saveTelemetryStore(): void {
  try {
    fs.writeFileSync(
      TELEMETRY_FILE,
      JSON.stringify(Array.from(telemetryStore.values()), null, 2),
      'utf8'
    );
  } catch {
    // Non-fatal persistence error
  }
}

interface SlpPlayerSample {
  uuid: string;
  name: string;
}

interface UnifiedMcStatusPayload {
  online: boolean;
  host: string;
  resolvedHost: string | null;
  ip: string | null;
  port: number;
  edition: 'java' | 'bedrock';
  version: string | null;
  software: string | null;
  pingMs: number | null;
  probeRegion: string;
  probeLocation: string;
  playersOnline: number;
  playersMax: number;
  playerSample: SlpPlayerSample[];
  motdLines: string[];
  iconBase64: string | null;
  checkedAt: string;
}

function resolveServerProbeRegion(raw?: string): {
  id: 'asia' | 'global' | 'na' | 'eu';
  location: string;
} {
  const norm = (raw || '').trim().toLowerCase();
  switch (norm) {
    case 'global':
      return { id: 'global', location: 'Global Anycast' };
    case 'na':
      return { id: 'na', location: 'North America' };
    case 'eu':
      return { id: 'eu', location: 'Europe' };
    case 'asia':
    default:
      return { id: 'asia', location: 'Asia (Singapore)' };
  }
}

const mcStatusCache = new Map<string, { expiresAt: number; payload: UnifiedMcStatusPayload }>();

const MC_NAMED_COLORS: Record<string, string> = {
  black: '§0',
  dark_blue: '§1',
  dark_green: '§2',
  dark_aqua: '§3',
  dark_red: '§4',
  dark_purple: '§5',
  gold: '§6',
  gray: '§7',
  dark_gray: '§8',
  blue: '§9',
  green: '§a',
  aqua: '§b',
  red: '§c',
  light_purple: '§d',
  yellow: '§e',
  white: '§f',
  reset: '§r',
};

function flattenChatComponent(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenChatComponent).join('');
  if (!node || typeof node !== 'object') return '';

  const obj = node as Record<string, unknown>;
  let prefix = '';
  if (typeof obj.color === 'string') {
    if (MC_NAMED_COLORS[obj.color]) {
      prefix += MC_NAMED_COLORS[obj.color];
    } else if (/^#[0-9a-fA-F]{6}$/.test(obj.color)) {
      prefix += `&#${obj.color.slice(1)}`;
    }
  }
  if (obj.bold) prefix += '§l';
  if (obj.italic) prefix += '§o';
  if (obj.underlined) prefix += '§n';
  if (obj.strikethrough) prefix += '§m';

  let out = prefix + (typeof obj.text === 'string' ? obj.text : '');
  if (Array.isArray(obj.extra)) {
    out += obj.extra.map(flattenChatComponent).join('');
  }
  return out;
}

function writeVarInt(val: number): Buffer {
  let v = val >>> 0;
  const bytes: number[] = [];
  do {
    let temp = v & 0x7f;
    v >>>= 7;
    if (v !== 0) temp |= 0x80;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buf: Buffer, offset: number): { val: number; next: number } | null {
  let num = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    num |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { val: num, next: pos };
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

function inferSoftwareFromVersion(versionText: string | null): string | null {
  if (!versionText) return null;
  const known = ['Paper', 'Purpur', 'Folia', 'Canvas', 'Pufferfish', 'Spigot', 'Bukkit', 'Velocity', 'Waterfall', 'BungeeCord', 'Fabric', 'Forge', 'NeoForge', 'Leaf'];
  const lower = versionText.toLowerCase();
  for (const sw of known) {
    if (lower.includes(sw.toLowerCase())) return sw;
  }
  return null;
}

async function directJavaSlpPing(rawHost: string): Promise<{
  online: boolean;
  resolvedHost: string;
  port: number;
  ip: string | null;
  pingMs: number;
  version: string | null;
  software: string | null;
  playersOnline: number;
  playersMax: number;
  playerSample: SlpPlayerSample[];
  motdLines: string[];
  iconBase64: string | null;
} | null> {
  const colonIdx = rawHost.lastIndexOf(':');
  let targetHost = colonIdx > 0 ? rawHost.slice(0, colonIdx) : rawHost;
  let targetPort = colonIdx > 0 ? Number(rawHost.slice(colonIdx + 1)) || 25565 : 25565;

  if (colonIdx === -1) {
    try {
      const srvRecords = await dns.promises.resolveSrv(`_minecraft._tcp.${targetHost}`);
      if (srvRecords && srvRecords.length > 0) {
        srvRecords.sort((a, b) => a.priority - b.priority);
        targetHost = srvRecords[0].name.replace(/\.$/, '');
        targetPort = srvRecords[0].port || 25565;
      }
    } catch {
      // No SRV record; proceed directly to A/AAAA lookup
    }
  }

  let resolvedIp: string | null = null;
  try {
    const lookup = await dns.promises.lookup(targetHost);
    resolvedIp = lookup.address;
  } catch {
    // Let socket handle resolution error
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: targetHost, port: targetPort, timeout: 4200 });
    let finished = false;
    let pongTimer: ReturnType<typeof setTimeout> | null = null;
    const done = (result: Awaited<ReturnType<typeof directJavaSlpPing>>) => {
      if (finished) return;
      finished = true;
      if (pongTimer) {
        clearTimeout(pongTimer);
        pongTimer = null;
      }
      socket.destroy();
      resolve(result);
    };

    let pingSentAt = 0;
    let tcpPingMs = 0;
    let parsedJson: {
      version?: { name?: string };
      players?: {
        online?: number;
        max?: number;
        sample?: Array<{ id?: string; name?: string }>;
      };
      description?: unknown;
      favicon?: string;
    } | null = null;

    let buf = Buffer.alloc(0);
    const connectStartedAt = performance.now();

    socket.on('connect', () => {
      tcpPingMs = Math.max(1, Math.round(performance.now() - connectStartedAt));
      const hostBuf = Buffer.from(targetHost, 'utf8');
      const handshakeBody = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(767),
        writeVarInt(hostBuf.length),
        hostBuf,
        Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff]),
        writeVarInt(1),
      ]);
      const handshakePacket = Buffer.concat([writeVarInt(handshakeBody.length), handshakeBody]);
      const statusRequest = Buffer.from([0x01, 0x00]);
      socket.write(Buffer.concat([handshakePacket, statusRequest]));
    });

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length > 0) {
        const pktLen = readVarInt(buf, 0);
        if (!pktLen || buf.length < pktLen.next + pktLen.val) break;

        const packet = buf.subarray(pktLen.next, pktLen.next + pktLen.val);
        buf = buf.subarray(pktLen.next + pktLen.val);

        const pktId = readVarInt(packet, 0);
        if (!pktId) continue;

        if (pktId.val === 0x00 && !parsedJson) {
          const strLen = readVarInt(packet, pktId.next);
          if (!strLen || packet.length < strLen.next + strLen.val) continue;
          const jsonText = packet.subarray(strLen.next, strLen.next + strLen.val).toString('utf8');
          try {
            parsedJson = JSON.parse(jsonText);
          } catch {
            done(null);
            return;
          }

          // Measure exact SLP Ping-Pong round-trip latency; resolve with TCP RTT if remote proxy ignores 0x01
          const pingPayload = Buffer.alloc(10);
          pingPayload[0] = 0x09;
          pingPayload[1] = 0x01;
          pingPayload.writeBigInt64BE(BigInt(Date.now()), 2);
          pingSentAt = performance.now();
          socket.write(pingPayload);
          if (!pongTimer) {
            pongTimer = setTimeout(() => {
              finalizePartial();
            }, 350);
          }
        } else if (pktId.val === 0x01 && parsedJson) {
          const rttMs = Math.max(1, Math.round(performance.now() - pingSentAt));
          const motdFull = flattenChatComponent(parsedJson.description);
          const motdLines = motdFull
            .split('\n')
            .map((l) => l.trimEnd())
            .filter(Boolean);
          const versionName = parsedJson.version?.name ? String(parsedJson.version.name) : null;
          const sample = Array.isArray(parsedJson.players?.sample)
            ? parsedJson.players!.sample
                .filter((p) => p && typeof p.name === 'string' && p.name.trim())
                .map((p) => ({
                  uuid: String(p.id || ''),
                  name: String(p.name).replace(/§./g, '').trim(),
                }))
                .filter((p) => p.name.length > 0)
            : [];

          done({
            online: true,
            resolvedHost: targetHost,
            port: targetPort,
            ip: resolvedIp,
            pingMs: rttMs || tcpPingMs,
            version: versionName,
            software: inferSoftwareFromVersion(versionName),
            playersOnline: typeof parsedJson.players?.online === 'number' ? parsedJson.players.online : 0,
            playersMax: typeof parsedJson.players?.max === 'number' ? parsedJson.players.max : 0,
            playerSample: sample,
            motdLines,
            iconBase64: typeof parsedJson.favicon === 'string' ? parsedJson.favicon : null,
          });
          return;
        }
      }
    });

    const finalizePartial = () => {
      if (parsedJson) {
        const motdFull = flattenChatComponent(parsedJson.description);
        const versionName = parsedJson.version?.name ? String(parsedJson.version.name) : null;
        const sample = Array.isArray(parsedJson.players?.sample)
          ? parsedJson.players!.sample
              .filter((p) => p && typeof p.name === 'string' && p.name.trim())
              .map((p) => ({
                uuid: String(p.id || ''),
                name: String(p.name).replace(/§./g, '').trim(),
              }))
              .filter((p) => p.name.length > 0)
          : [];
        done({
          online: true,
          resolvedHost: targetHost,
          port: targetPort,
          ip: resolvedIp,
          pingMs: tcpPingMs || 1,
          version: versionName,
          software: inferSoftwareFromVersion(versionName),
          playersOnline: typeof parsedJson.players?.online === 'number' ? parsedJson.players.online : 0,
          playersMax: typeof parsedJson.players?.max === 'number' ? parsedJson.players.max : 0,
          playerSample: sample,
          motdLines: motdFull ? motdFull.split('\n').filter(Boolean) : [],
          iconBase64: typeof parsedJson.favicon === 'string' ? parsedJson.favicon : null,
        });
      } else {
        done(null);
      }
    };

    socket.once('end', finalizePartial);
    socket.once('timeout', finalizePartial);
    socket.once('error', () => done(null));
  });
}

async function measureTcpRttMs(rawHost: string, defaultPort = 25565): Promise<number | null> {
  const colonIdx = rawHost.lastIndexOf(':');
  let targetHost = colonIdx > 0 ? rawHost.slice(0, colonIdx) : rawHost;
  let targetPort = colonIdx > 0 ? Number(rawHost.slice(colonIdx + 1)) || defaultPort : defaultPort;

  if (colonIdx === -1 && defaultPort === 25565) {
    try {
      const srvRecords = await dns.promises.resolveSrv(`_minecraft._tcp.${targetHost}`);
      if (srvRecords && srvRecords.length > 0) {
        srvRecords.sort((a, b) => a.priority - b.priority);
        targetHost = srvRecords[0].name.replace(/\.$/, '');
        targetPort = srvRecords[0].port || defaultPort;
      }
    } catch {
      // Ignore SRV lookup failures
    }
  }

  return new Promise((resolve) => {
    const started = performance.now();
    const sock = net.createConnection({ host: targetHost, port: targetPort, timeout: 1500 });
    let closed = false;
    const finish = (val: number | null) => {
      if (closed) return;
      closed = true;
      sock.destroy();
      resolve(val);
    };
    sock.once('connect', () => {
      finish(Math.max(1, Math.round(performance.now() - started)));
    });
    sock.once('timeout', () => finish(null));
    sock.once('error', () => finish(null));
  });
}

let FIREBASE_API_KEY = '';
try {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { apiKey?: string };
  FIREBASE_API_KEY = parsed.apiKey || '';
} catch {
  FIREBASE_API_KEY = '';
}

const SESSION_COOKIE_NAME = 'swx_oauth_session';
const STATE_COOKIE_NAME = 'swx_oauth_state';
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

function extractArchiveExtensionServer(fileName: string): string | null {
  const lower = fileName.trim().toLowerCase();
  if (!lower) return null;
  if (lower.endsWith('.tar.gz')) return 'gz';
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === lower.length - 1) return null;
  const ext = lower.slice(dotIdx + 1);
  return ALLOWED_ARCHIVE_EXTENSIONS.has(ext) ? ext : null;
}

async function verifyVerifiedUserToken(
  req: Request
): Promise<{ ok: boolean; status: number; error?: string; uid?: string; email?: string; isOwner?: boolean }> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token.' };
  }
  if (!FIREBASE_API_KEY) {
    return { ok: false, status: 500, error: 'Firebase API key is not configured.' };
  }

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: match[1] }),
      }
    );
    const data = (await verifyRes.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
      error?: { message?: string };
    };
    const user = data.users?.[0];
    if (!verifyRes.ok || !user) {
      return { ok: false, status: 401, error: data.error?.message || 'Invalid session token.' };
    }
    if (!user.emailVerified) {
      return { ok: false, status: 403, error: 'Verified email required.' };
    }
    const emailLower = (user.email || '').trim().toLowerCase();
    return {
      ok: true,
      status: 200,
      uid: user.localId,
      email: emailLower,
      isOwner: OWNER_EMAILS.has(emailLower),
    };
  } catch {
    return { ok: false, status: 502, error: 'Could not verify Firebase session.' };
  }
}

async function verifyOwnerToken(
  req: Request
): Promise<{ ok: boolean; status: number; error?: string; uid?: string }> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token.' };
  }
  if (!FIREBASE_API_KEY) {
    return { ok: false, status: 500, error: 'Firebase API key is not configured.' };
  }

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: match[1] }),
      }
    );
    const data = (await verifyRes.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
      error?: { message?: string };
    };
    const user = data.users?.[0];
    if (!verifyRes.ok || !user) {
      return { ok: false, status: 401, error: data.error?.message || 'Invalid session token.' };
    }
    if (!user.emailVerified || !OWNER_EMAILS.has((user.email || '').trim().toLowerCase())) {
      return { ok: false, status: 403, error: 'Owner admin access required.' };
    }
    return { ok: true, status: 200, uid: user.localId };
  } catch {
    return { ok: false, status: 502, error: 'Could not verify Firebase session.' };
  }
}

function getAppBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && raw !== 'MY_APP_URL' && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function getProviderConfig(provider: string): ProviderConfig | null {
  switch (provider) {
    case 'discord':
      return {
        id: 'discord',
        label: 'Discord',
        clientId: process.env.DISCORD_CLIENT_ID?.trim() || '',
        clientSecret: process.env.DISCORD_CLIENT_SECRET?.trim() || '',
        authorizeUrl: 'https://discord.com/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        scope: 'identify email',
        portalUrl: 'https://discord.com/developers/applications',
        envPrefix: 'DISCORD',
      };
    case 'github':
      return {
        id: 'github',
        label: 'GitHub',
        clientId: process.env.GITHUB_CLIENT_ID?.trim() || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || '',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'read:user user:email',
        portalUrl: 'https://github.com/settings/developers',
        envPrefix: 'GITHUB',
      };
    case 'twitch':
      return {
        id: 'twitch',
        label: 'Twitch',
        clientId: process.env.TWITCH_CLIENT_ID?.trim() || '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET?.trim() || '',
        authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
        tokenUrl: 'https://id.twitch.tv/oauth2/token',
        scope: 'user:read:email',
        portalUrl: 'https://dev.twitch.tv/console/apps',
        envPrefix: 'TWITCH',
      };
    default:
      return null;
  }
}

function getRedirectUri(provider: OAuthProviderId): string {
  return `${getAppBaseUrl()}/auth/callback/${provider}`;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function signToken(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken<T>(token: string | undefined): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function readOAuthSession(req: Request): OAuthSessionData {
  const cookies = parseCookies(req.headers.cookie);
  const parsed = verifyToken<OAuthSessionData>(cookies[SESSION_COOKIE_NAME]);
  if (parsed && typeof parsed === 'object' && parsed.connections) {
    return parsed;
  }
  return { primaryProvider: null, connections: {} };
}

function writeOAuthSession(res: Response, session: OAuthSessionData): void {
  res.cookie(SESSION_COOKIE_NAME, signToken(session), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearCookieIframeSafe(res: Response, name: string): void {
  res.clearCookie(name, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
}

function renderPopupResultHtml(payload: {
  ok: boolean;
  type: 'OAUTH_AUTH_SUCCESS' | 'OAUTH_AUTH_ERROR';
  provider: string;
  profile?: OAuthProfile;
  error?: string;
}): string {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const heading = payload.ok ? 'Account connected' : 'Connection failed';
  const subtext = payload.ok
    ? 'Returning to SwxStudios... You can close this window if it stays open.'
    : payload.error || 'Authentication could not be completed.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SwxStudios OAuth</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; display: grid; place-items: center; min-height: 100vh; padding: 24px; }
      .card { max-width: 380px; width: 100%; border: 1px solid #27272a; background: #111114; border-radius: 12px; padding: 24px; text-align: center; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      p { font-size: 13px; color: #a1a1aa; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${heading}</h1>
      <p>${subtext.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
    <script>
      (function () {
        var data = ${safeJson};
        try {
          if (window.opener) {
            window.opener.postMessage(data, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        } catch (err) {
          window.location.href = '/';
        }
      })();
    </script>
  </body>
</html>`;
}

async function exchangeDiscordCode(config: ProviderConfig, code: string, redirectUri: string): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || 'Failed to exchange Discord token.');
  }

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const user = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  if (!userRes.ok || !user.id) {
    throw new Error('Failed to fetch Discord profile.');
  }

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : null;

  return {
    provider: 'discord',
    providerUserId: String(user.id),
    username: user.username,
    displayName: user.global_name || user.username,
    email: user.email || null,
    avatarUrl,
    profileUrl: `https://discord.com/users/${user.id}`,
    connectedAt: new Date().toISOString(),
  };
}

async function exchangeGithubCode(config: ProviderConfig, code: string, redirectUri: string): Promise<OAuthProfile> {
  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || 'Failed to exchange GitHub token.');
  }

  const headers = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SwxStudios-OAuth',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    html_url?: string | null;
  };
  if (!userRes.ok || !user.id) {
    throw new Error('Failed to fetch GitHub profile.');
  }

  let resolvedEmail = user.email || null;
  if (!resolvedEmail) {
    try {
      const emailRes = await fetch('https://api.github.com/user/emails', { headers });
      if (emailRes.ok) {
        const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
        resolvedEmail = primary?.email || null;
      }
    } catch {
      // Ignore secondary email lookup failure
    }
  }

  return {
    provider: 'github',
    providerUserId: String(user.id),
    username: user.login,
    displayName: user.name || user.login,
    email: resolvedEmail,
    avatarUrl: user.avatar_url || null,
    profileUrl: user.html_url || `https://github.com/${user.login}`,
    connectedAt: new Date().toISOString(),
  };
}

async function exchangeTwitchCode(config: ProviderConfig, code: string, redirectUri: string): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; message?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.message || 'Failed to exchange Twitch token.');
  }

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'Client-Id': config.clientId,
    },
  });
  const userPayload = (await userRes.json()) as {
    data?: Array<{
      id: string;
      login: string;
      display_name: string;
      email?: string;
      profile_image_url?: string;
    }>;
  };
  const user = userPayload.data?.[0];
  if (!userRes.ok || !user) {
    throw new Error('Failed to fetch Twitch profile.');
  }

  return {
    provider: 'twitch',
    providerUserId: String(user.id),
    username: user.login,
    displayName: user.display_name || user.login,
    email: user.email || null,
    avatarUrl: user.profile_image_url || null,
    profileUrl: `https://twitch.tv/${user.login}`,
    connectedAt: new Date().toISOString(),
  };
}

async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  const BOT_VERIFY_COOKIE_NAME = 'swx_human_verified';

  // 0. Cloudflare-Style Turnstile Bot Verification Routes (HMAC cookie + proof-of-work)
  app.get('/api/verify/status', (req: Request, res: Response) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifyToken<{
      verified: boolean;
      rayId: string;
      verifiedAt: string;
      exp: number;
    }>(cookies[BOT_VERIFY_COOKIE_NAME]);

    if (session && session.verified && typeof session.exp === 'number' && Date.now() < session.exp) {
      res.json({
        verified: true,
        rayId: session.rayId,
        verifiedAt: session.verifiedAt,
        expiresAt: session.exp,
      });
      return;
    }

    res.json({
      verified: false,
      rayId: generateRayId(`${req.ip || 'client'}-${Date.now()}`),
      verifiedAt: null,
      expiresAt: null,
    });
  });

  app.get('/api/verify/challenge', (req: Request, res: Response) => {
    const nonce = crypto.randomBytes(12).toString('hex');
    const rayId = generateRayId(`${nonce}-${req.ip || 'swx'}`);
    const issuedAt = Date.now();
    const exp = issuedAt + 5 * 60_000;
    const difficulty = DEFAULT_CHALLENGE_DIFFICULTY;

    const challengeToken = signToken({
      nonce,
      rayId,
      difficulty,
      issuedAt,
      exp,
    });

    res.json({
      challengeToken,
      nonce,
      difficulty,
      rayId,
      issuedAt,
    });
  });

  app.post('/api/verify/submit', (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      challengeToken?: string;
      counter?: number;
      humanInteraction?: boolean;
      elapsedMs?: number;
    };

    const parsedChallenge = verifyToken<{
      nonce: string;
      rayId: string;
      difficulty: number;
      issuedAt: number;
      exp: number;
    }>(body.challengeToken);

    if (!parsedChallenge || Date.now() > parsedChallenge.exp) {
      res.status(400).json({ ok: false, verified: false, error: 'Verification challenge expired. Please retry.' });
      return;
    }

    if (body.humanInteraction !== true) {
      res.status(403).json({ ok: false, verified: false, error: 'Human interaction is required.' });
      return;
    }

    const counter = typeof body.counter === 'number' ? body.counter : Number(body.counter);
    if (!verifyChallengeProof(parsedChallenge.nonce, counter, parsedChallenge.difficulty)) {
      res.status(403).json({ ok: false, verified: false, error: 'Invalid verification proof. Please retry.' });
      return;
    }

    const verifiedAt = new Date().toISOString();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const sessionToken = signToken({
      verified: true,
      rayId: parsedChallenge.rayId,
      verifiedAt,
      exp: expiresAt,
    });

    res.cookie(BOT_VERIFY_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      ok: true,
      verified: true,
      rayId: parsedChallenge.rayId,
      verifiedAt,
      expiresAt,
    });
  });

  app.post('/api/verify/reset', (_req: Request, res: Response) => {
    clearCookieIframeSafe(res, BOT_VERIFY_COOKIE_NAME);
    res.json({ ok: true, verified: false });
  });

  // 1. OAuth configuration status & exact callback URLs
  app.get('/api/oauth/status', (_req: Request, res: Response) => {
    const ids: OAuthProviderId[] = ['discord', 'github', 'twitch'];
    const providers = ids.reduce<
      Record<
        string,
        {
          id: OAuthProviderId;
          label: string;
          configured: boolean;
          callbackUrl: string;
          portalUrl: string;
          envVars: string[];
        }
      >
    >((acc, id) => {
      const cfg = getProviderConfig(id)!;
      acc[id] = {
        id: cfg.id,
        label: cfg.label,
        configured: Boolean(cfg.clientId && cfg.clientSecret),
        callbackUrl: getRedirectUri(cfg.id),
        portalUrl: cfg.portalUrl,
        envVars: [`${cfg.envPrefix}_CLIENT_ID`, `${cfg.envPrefix}_CLIENT_SECRET`],
      };
      return acc;
    }, {});

    res.json({
      appUrl: getAppBaseUrl(),
      providers,
    });
  });

  // 2. Construct external provider authorize URL for direct popup open
  app.get('/api/oauth/:provider/url', (req: Request, res: Response) => {
    const providerParam = String(req.params.provider || '').toLowerCase();
    const cfg = getProviderConfig(providerParam);
    if (!cfg) {
      res.status(404).json({ error: 'Unsupported OAuth provider.' });
      return;
    }

    const redirectUri = getRedirectUri(cfg.id);
    if (!cfg.clientId || !cfg.clientSecret) {
      res.status(200).json({
        setupRequired: true,
        provider: cfg.id,
        label: cfg.label,
        callbackUrl: redirectUri,
        portalUrl: cfg.portalUrl,
        envVars: [`${cfg.envPrefix}_CLIENT_ID`, `${cfg.envPrefix}_CLIENT_SECRET`],
        error: `${cfg.label} OAuth credentials are not configured in server secrets yet.`,
      });
      return;
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const stateToken = signToken({
      provider: cfg.id,
      nonce,
      exp: Date.now() + 10 * 60 * 1000,
    });

    res.cookie(STATE_COOKIE_NAME, stateToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scope,
      state: nonce,
    });

    if (cfg.id === 'discord') {
      params.set('prompt', 'consent');
    }

    res.json({ url: `${cfg.authorizeUrl}?${params.toString()}` });
  });

  // 3. OAuth callback handler (supports with or without trailing slash)
  app.get(
    ['/auth/callback/:provider', '/auth/callback/:provider/'],
    async (req: Request, res: Response) => {
      const providerParam = String(req.params.provider || '').toLowerCase();
      const cfg = getProviderConfig(providerParam);
      if (!cfg) {
        res.status(404).send(
          renderPopupResultHtml({
            ok: false,
            type: 'OAUTH_AUTH_ERROR',
            provider: providerParam,
            error: 'Unknown OAuth provider.',
          })
        );
        return;
      }

      const errorParam = typeof req.query.error === 'string' ? req.query.error : null;
      const errorDesc =
        typeof req.query.error_description === 'string' ? req.query.error_description : null;
      if (errorParam) {
        res.status(400).send(
          renderPopupResultHtml({
            ok: false,
            type: 'OAUTH_AUTH_ERROR',
            provider: cfg.id,
            error: errorDesc || errorParam,
          })
        );
        return;
      }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';

      const cookies = parseCookies(req.headers.cookie);
      const parsedState = verifyToken<{ provider: string; nonce: string; exp: number }>(
        cookies[STATE_COOKIE_NAME]
      );
      clearCookieIframeSafe(res, STATE_COOKIE_NAME);

      if (
        !code ||
        !parsedState ||
        parsedState.provider !== cfg.id ||
        parsedState.nonce !== state ||
        Date.now() > parsedState.exp
      ) {
        res.status(400).send(
          renderPopupResultHtml({
            ok: false,
            type: 'OAUTH_AUTH_ERROR',
            provider: cfg.id,
            error: 'Invalid or expired OAuth state. Please try connecting again.',
          })
        );
        return;
      }

      if (!cfg.clientId || !cfg.clientSecret) {
        res.status(400).send(
          renderPopupResultHtml({
            ok: false,
            type: 'OAUTH_AUTH_ERROR',
            provider: cfg.id,
            error: `${cfg.label} OAuth credentials are missing on the server.`,
          })
        );
        return;
      }

      try {
        const redirectUri = getRedirectUri(cfg.id);
        let profile: OAuthProfile;
        if (cfg.id === 'discord') {
          profile = await exchangeDiscordCode(cfg, code, redirectUri);
        } else if (cfg.id === 'github') {
          profile = await exchangeGithubCode(cfg, code, redirectUri);
        } else {
          profile = await exchangeTwitchCode(cfg, code, redirectUri);
        }

        const currentSession = readOAuthSession(req);
        const nextSession: OAuthSessionData = {
          primaryProvider: currentSession.primaryProvider ?? cfg.id,
          connections: {
            ...currentSession.connections,
            [cfg.id]: profile,
          },
        };
        writeOAuthSession(res, nextSession);

        res.send(
          renderPopupResultHtml({
            ok: true,
            type: 'OAUTH_AUTH_SUCCESS',
            provider: cfg.id,
            profile,
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'OAuth exchange failed.';
        res.status(500).send(
          renderPopupResultHtml({
            ok: false,
            type: 'OAUTH_AUTH_ERROR',
            provider: cfg.id,
            error: message,
          })
        );
      }
    }
  );

  // 4. Current OAuth session & connected 3P accounts
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const session = readOAuthSession(req);
    const primaryProfile = session.primaryProvider
      ? session.connections[session.primaryProvider] ?? null
      : null;
    res.json({
      primaryProvider: session.primaryProvider,
      primaryProfile,
      connections: session.connections,
    });
  });

  // 5. Disconnect specific 3P OAuth account
  app.post('/api/auth/disconnect/:provider', (req: Request, res: Response) => {
    const providerParam = String(req.params.provider || '').toLowerCase() as OAuthProviderId;
    if (!['discord', 'github', 'twitch'].includes(providerParam)) {
      res.status(400).json({ error: 'Invalid provider.' });
      return;
    }

    const session = readOAuthSession(req);
    const nextConnections = { ...session.connections };
    delete nextConnections[providerParam];

    const remainingKeys = Object.keys(nextConnections) as OAuthProviderId[];
    const nextPrimary =
      session.primaryProvider === providerParam
        ? remainingKeys[0] ?? null
        : session.primaryProvider;

    const nextSession: OAuthSessionData = {
      primaryProvider: nextPrimary,
      connections: nextConnections,
    };
    writeOAuthSession(res, nextSession);
    res.json(nextSession);
  });

  // 6. Sign out OAuth session cookie
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearCookieIframeSafe(res, SESSION_COOKIE_NAME);
    res.json({ ok: true });
  });

  // 7. Owner-only binary archive upload (.jar, .zip, .rar, .7z, .gz, .tar)
  app.post(
    '/api/admin/upload',
    express.raw({ type: 'application/octet-stream', limit: '100mb' }),
    async (req: Request, res: Response) => {
      const authCheck = await verifyOwnerToken(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }

      const rawHeaderName = req.headers['x-file-name'];
      const headerName = typeof rawHeaderName === 'string' ? rawHeaderName : '';
      let decodedName = '';
      try {
        decodedName = decodeURIComponent(headerName).trim();
      } catch {
        decodedName = headerName.trim();
      }

      const safeOriginal = path.basename(decodedName).replace(/[^a-zA-Z0-9._\-() ]+/g, '_').slice(0, 140);
      const ext = extractArchiveExtensionServer(safeOriginal);
      if (!safeOriginal || !ext) {
        res.status(400).json({
          error: 'Invalid or unsupported archive extension. Allowed: .jar, .zip, .rar, .7z, .gz, .tar',
        });
        return;
      }

      const bodyBuffer = req.body;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
        res.status(400).json({ error: 'Uploaded file is empty.' });
        return;
      }

      const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeOriginal.replace(/\s+/g, '_')}`;
      const targetPath = path.join(UPLOADS_DIR, storedName);
      fs.writeFileSync(targetPath, bodyBuffer);

      res.json({
        fileName: safeOriginal,
        storedName,
        fileExtension: ext,
        byteSize: bodyBuffer.length,
        downloadUrl: `/api/files/${encodeURIComponent(storedName)}/${encodeURIComponent(safeOriginal)}`,
      });
    }
  );

  // 8. Public download endpoint for owner-uploaded package archives
  app.get('/api/files/:storedName/:downloadName?', (req: Request, res: Response) => {
    const storedName = path.basename(String(req.params.storedName || ''));
    if (!storedName || storedName.includes('..') || !extractArchiveExtensionServer(storedName)) {
      res.status(400).json({ error: 'Invalid file identifier.' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Requested file not found.' });
      return;
    }

    const downloadName = path.basename(String(req.params.downloadName || storedName));
    res.download(filePath, downloadName);
  });

  // 9. Owner-only archive file cleanup
  app.delete('/api/admin/files/:storedName', async (req: Request, res: Response) => {
    const authCheck = await verifyOwnerToken(req);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error });
      return;
    }

    const storedName = path.basename(String(req.params.storedName || ''));
    if (!storedName || storedName.includes('..')) {
      res.status(400).json({ error: 'Invalid file identifier.' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  });

  // 10. Real Minecraft Server Status lookup (Direct Java SLP TCP from Asia SG + mcstatus.io / mcsrvstat.us fallback)
  app.get('/api/mc/status', async (req: Request, res: Response) => {
    const rawHost = typeof req.query.host === 'string' ? req.query.host.trim() : '';
    const edition: 'java' | 'bedrock' = req.query.edition === 'bedrock' ? 'bedrock' : 'java';
    const regionInfo = resolveServerProbeRegion(
      typeof req.query.region === 'string' ? req.query.region : undefined
    );
    const bypassCache = req.query.fresh === '1';

    if (!rawHost || !/^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost) || rawHost.length > 120) {
      res.status(400).json({ error: 'Enter a valid server hostname or IP:port (e.g. donutsmp.net).' });
      return;
    }

    const cacheKey = `${edition}:${regionInfo.id}:${rawHost.toLowerCase()}`;
    const cached = mcStatusCache.get(cacheKey);
    if (!bypassCache && cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    try {
      let payload: UnifiedMcStatusPayload | null = null;

      if (edition === 'java') {
        const slp = await directJavaSlpPing(rawHost);
        if (slp && slp.online) {
          payload = {
            online: true,
            host: rawHost,
            resolvedHost: slp.resolvedHost,
            ip: slp.ip,
            port: slp.port,
            edition: 'java',
            version: slp.version,
            software: slp.software,
            pingMs: slp.pingMs,
            probeRegion: regionInfo.id,
            probeLocation: regionInfo.location,
            playersOnline: slp.playersOnline,
            playersMax: slp.playersMax,
            playerSample: slp.playerSample,
            motdLines: slp.motdLines,
            iconBase64: slp.iconBase64,
            checkedAt: new Date().toISOString(),
          };
        }
      }

      if (!payload) {
        const t0 = performance.now();
        const mcstatusUrl =
          edition === 'bedrock'
            ? `https://api.mcstatus.io/v2/status/bedrock/${encodeURIComponent(rawHost)}`
            : `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(rawHost)}`;
        const mcsrvUrl =
          edition === 'bedrock'
            ? `https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(rawHost)}`
            : `https://api.mcsrvstat.us/3/${encodeURIComponent(rawHost)}`;

        const [mcRes, srvRes, tcpRes] = await Promise.allSettled([
          fetch(mcstatusUrl, {
            headers: { 'User-Agent': 'SwxStudios/1.0' },
            signal: AbortSignal.timeout(6500),
          }),
          fetch(mcsrvUrl, {
            headers: { 'User-Agent': 'SwxStudios/1.0' },
            signal: AbortSignal.timeout(6500),
          }),
          measureTcpRttMs(rawHost, edition === 'bedrock' ? 19132 : 25565),
        ]);

        const fallbackLatency =
          tcpRes.status === 'fulfilled' && typeof tcpRes.value === 'number'
            ? tcpRes.value
            : Math.max(12, Math.round(performance.now() - t0));

        if (mcRes.status === 'fulfilled' && mcRes.value.ok) {
          const d = (await mcRes.value.json()) as {
            online?: boolean;
            host?: string;
            port?: number;
            ip_address?: string;
            srv_record?: { host?: string; port?: number } | null;
            version?: { name_clean?: string; name_raw?: string };
            software?: string;
            icon?: string;
            players?: {
              online?: number;
              max?: number;
              list?: Array<{ uuid?: string; name_clean?: string; name_raw?: string }>;
            };
            motd?: { raw?: string; clean?: string };
          };

          const versionStr = d.version?.name_clean || d.version?.name_raw || null;
          const playerSample: SlpPlayerSample[] = Array.isArray(d.players?.list)
            ? d.players!.list
                .map((p) => ({
                  uuid: String(p.uuid || ''),
                  name: String(p.name_clean || p.name_raw || '').trim(),
                }))
                .filter((p) => p.name.length > 0)
            : [];

          const motdText = d.motd?.raw || d.motd?.clean || '';
          payload = {
            online: Boolean(d.online),
            host: d.host || rawHost,
            resolvedHost: d.srv_record?.host || d.host || null,
            ip: d.ip_address || null,
            port: d.srv_record?.port || d.port || (edition === 'bedrock' ? 19132 : 25565),
            edition,
            version: versionStr,
            software: d.software || inferSoftwareFromVersion(versionStr),
            pingMs: d.online ? fallbackLatency : null,
            probeRegion: regionInfo.id,
            probeLocation: regionInfo.location,
            playersOnline: typeof d.players?.online === 'number' ? d.players.online : 0,
            playersMax: typeof d.players?.max === 'number' ? d.players.max : 0,
            playerSample,
            motdLines: motdText ? motdText.split('\n').filter(Boolean) : [],
            iconBase64: typeof d.icon === 'string' ? d.icon : null,
            checkedAt: new Date().toISOString(),
          };
        } else if (srvRes.status === 'fulfilled' && srvRes.value.ok) {
          const data = (await srvRes.value.json()) as {
            online?: boolean;
            hostname?: string;
            ip?: string;
            port?: number;
            version?: string;
            software?: string;
            icon?: string;
            players?: {
              online?: number;
              max?: number;
              list?: Array<{ name?: string; uuid?: string } | string>;
            };
            motd?: { raw?: string[]; clean?: string[] };
          };

          const playerSample: SlpPlayerSample[] = Array.isArray(data.players?.list)
            ? data.players!.list
                .map((item) =>
                  typeof item === 'string'
                    ? { uuid: '', name: item }
                    : { uuid: String(item.uuid || ''), name: String(item.name || '') }
                )
                .filter((p) => p.name.trim().length > 0)
            : [];

          payload = {
            online: Boolean(data.online),
            host: data.hostname || rawHost,
            resolvedHost: data.hostname || null,
            ip: data.ip || null,
            port: data.port || (edition === 'bedrock' ? 19132 : 25565),
            edition,
            version: data.version || null,
            software: data.software || inferSoftwareFromVersion(data.version || null),
            pingMs: data.online ? fallbackLatency : null,
            probeRegion: regionInfo.id,
            probeLocation: regionInfo.location,
            playersOnline: typeof data.players?.online === 'number' ? data.players.online : 0,
            playersMax: typeof data.players?.max === 'number' ? data.players.max : 0,
            playerSample,
            motdLines: Array.isArray(data.motd?.raw)
              ? data.motd.raw
              : Array.isArray(data.motd?.clean)
              ? data.motd.clean
              : [],
            iconBase64: typeof data.icon === 'string' ? data.icon : null,
            checkedAt: new Date().toISOString(),
          };
        }
      }

      if (!payload) {
        res.status(502).json({ error: 'Unable to reach Minecraft status providers.' });
        return;
      }

      mcStatusCache.set(cacheKey, {
        expiresAt: Date.now() + 12_000,
        payload,
      });

      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to query Minecraft server status.';
      res.status(502).json({ error: message });
    }
  });

  // 10b. Live Server Plugin Telemetry (TPS, MSPT, Ping, Players, Top Players)
  app.get('/api/mc/telemetry', (_req: Request, res: Response) => {
    const items = Array.from(telemetryStore.values());
    const snapshots: Record<string, ServerTelemetryRecord> = {};
    for (const [k, v] of telemetryStore.entries()) {
      snapshots[k] = v;
    }
    res.json({ items, snapshots });
  });

  app.get('/api/mc/telemetry/:serverKey', (req: Request, res: Response) => {
    const key = String(req.params.serverKey || '').trim().toLowerCase();
    const record = telemetryStore.get(key) || null;
    res.json({ telemetry: record });
  });

  app.post('/api/mc/telemetry', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      serverKey?: string;
      address?: string;
      tps?: number | null;
      mspt?: number | null;
      avgPingMs?: number | null;
      playersOnline?: number | null;
      playersMax?: number | null;
      topPlayers?: Array<{ name?: string; stat?: string }>;
      source?: string;
      pluginSecret?: string;
    };

    const expectedBridgeSecret = process.env.MC_TELEMETRY_SECRET?.trim();
    const hasBridgeSecret =
      Boolean(expectedBridgeSecret) && body.pluginSecret === expectedBridgeSecret;
    if (!hasBridgeSecret) {
      const authCheck = await verifyVerifiedUserToken(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }
    }

    const rawKey = (body.serverKey || body.address || '').trim().toLowerCase();
    if (!rawKey || rawKey.length > 120) {
      res.status(400).json({ error: 'Valid serverKey or address is required.' });
      return;
    }

    const numOrNull = (val: unknown, min: number, max: number): number | null => {
      if (typeof val !== 'number' || !Number.isFinite(val)) return null;
      return Math.round(Math.max(min, Math.min(max, val)) * 100) / 100;
    };

    const topPlayers = Array.isArray(body.topPlayers)
      ? body.topPlayers
          .slice(0, 15)
          .map((p) => ({
            name: String(p?.name || '').trim().slice(0, 24),
            stat: String(p?.stat || '').trim().slice(0, 40),
          }))
          .filter((p) => p.name.length > 0)
      : [];

    const record: ServerTelemetryRecord = {
      serverKey: rawKey,
      address: String(body.address || rawKey).trim().slice(0, 120),
      tps: numOrNull(body.tps, 0, 25),
      mspt: numOrNull(body.mspt, 0, 5000),
      avgPingMs: numOrNull(body.avgPingMs, 0, 10000),
      playersOnline: numOrNull(body.playersOnline, 0, 500000),
      playersMax: numOrNull(body.playersMax, 0, 500000),
      topPlayers,
      source: String(body.source || 'SwxStudios Heartbeat').slice(0, 60),
      updatedAt: new Date().toISOString(),
    };

    telemetryStore.set(rawKey, record);
    if (record.address && record.address.toLowerCase() !== rawKey) {
      telemetryStore.set(record.address.toLowerCase(), record);
    }
    saveTelemetryStore();
    res.json({ ok: true, telemetry: record });
  });

  // 11. Real Mojang UUID, Skin Texture & Head Avatar Proxy Routes
  const mcProfileCache = new Map<
    string,
    {
      expiresAt: number;
      profile: {
        name: string;
        rawUuid: string;
        dashedUuid: string;
        skinUrl: string | null;
        slim: boolean;
      } | null;
    }
  >();

  const mcSkinCache = new Map<string, { expiresAt: number; buffer: Buffer }>();
  const mcAvatarCache = new Map<string, { expiresAt: number; buffer: Buffer }>();

  const encodeRgbaToPng = (width: number, height: number, rgba: Uint8Array): Buffer => {
    const raw = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
      const rowOffset = y * (1 + width * 4);
      raw[rowOffset] = 0; // filter None
      const srcStart = y * width * 4;
      raw.set(rgba.subarray(srcStart, srcStart + width * 4), rowOffset + 1);
    }

    const crc32 = (buf: Buffer): number => {
      let crc = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let b = 0; b < 8; b++) {
          crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
      }
      return (crc ^ 0xffffffff) >>> 0;
    };

    const chunk = (type: string, data: Buffer): Buffer => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const typeBuf = Buffer.from(type, 'ascii');
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
      return Buffer.concat([len, typeBuf, data, crcBuf]);
    };

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  };

  let cachedFallbackSkinPng: Buffer | null = null;
  const getFallbackSteveSkinPng = (): Buffer => {
    if (cachedFallbackSkinPng) return cachedFallbackSkinPng;
    const rgba = new Uint8Array(64 * 64 * 4);
    const fillRect = (rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number, a = 255) => {
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          const i = (y * 64 + x) * 4;
          rgba[i] = r;
          rgba[i + 1] = g;
          rgba[i + 2] = b;
          rgba[i + 3] = a;
        }
      }
    };

    // Head base + hair + eyes + mouth
    fillRect(0, 0, 32, 16, 198, 150, 122);
    fillRect(8, 0, 8, 8, 63, 39, 24);
    fillRect(0, 8, 8, 3, 63, 39, 24);
    fillRect(8, 8, 8, 2, 63, 39, 24);
    fillRect(16, 8, 8, 3, 63, 39, 24);
    fillRect(24, 8, 8, 8, 63, 39, 24);
    fillRect(9, 12, 1, 1, 255, 255, 255);
    fillRect(14, 12, 1, 1, 255, 255, 255);
    fillRect(10, 12, 1, 1, 79, 70, 229);
    fillRect(13, 12, 1, 1, 79, 70, 229);
    fillRect(11, 13, 2, 1, 154, 100, 73);
    fillRect(10, 14, 4, 1, 107, 62, 40);

    // Torso (teal shirt)
    fillRect(16, 16, 24, 16, 14, 116, 144);

    // Arms (skin + teal sleeves)
    fillRect(40, 16, 16, 16, 198, 150, 122);
    fillRect(32, 48, 16, 16, 198, 150, 122);
    fillRect(40, 16, 16, 6, 14, 116, 144);
    fillRect(32, 48, 16, 6, 14, 116, 144);

    // Legs (indigo jeans + shoes)
    fillRect(0, 16, 16, 16, 49, 46, 129);
    fillRect(16, 48, 16, 16, 49, 46, 129);
    fillRect(0, 30, 16, 2, 82, 82, 91);
    fillRect(16, 62, 16, 2, 82, 82, 91);

    cachedFallbackSkinPng = encodeRgbaToPng(64, 64, rgba);
    return cachedFallbackSkinPng;
  };

  let cachedFallbackAvatarPng: Buffer | null = null;
  const getFallbackSteveHeadPng = (): Buffer => {
    if (cachedFallbackAvatarPng) return cachedFallbackAvatarPng;
    const rgba = new Uint8Array(64 * 64 * 4);
    const setBlock = (bx: number, by: number, r: number, g: number, b: number) => {
      for (let py = by * 8; py < (by + 1) * 8; py++) {
        for (let px = bx * 8; px < (bx + 1) * 8; px++) {
          const i = (py * 64 + px) * 4;
          rgba[i] = r;
          rgba[i + 1] = g;
          rgba[i + 2] = b;
          rgba[i + 3] = 255;
        }
      }
    };
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (y < 2 || ((x === 0 || x === 7) && y === 2)) {
          setBlock(x, y, 63, 39, 24);
        } else {
          setBlock(x, y, 198, 150, 122);
        }
      }
    }
    setBlock(1, 4, 255, 255, 255);
    setBlock(6, 4, 255, 255, 255);
    setBlock(2, 4, 79, 70, 229);
    setBlock(5, 4, 79, 70, 229);
    setBlock(3, 5, 154, 100, 73);
    setBlock(4, 5, 154, 100, 73);
    setBlock(2, 6, 107, 62, 40);
    setBlock(3, 6, 124, 71, 50);
    setBlock(4, 6, 124, 71, 50);
    setBlock(5, 6, 107, 62, 40);
    cachedFallbackAvatarPng = encodeRgbaToPng(64, 64, rgba);
    return cachedFallbackAvatarPng;
  };

  const isValidPngBuffer = (buf: Buffer): { valid: boolean; w: number; h: number } => {
    if (buf.length < 32) return { valid: false, w: 0, h: 0 };
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
      return { valid: false, w: 0, h: 0 };
    }
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { valid: w > 0 && h > 0, w, h };
  };

  const resolveMojangSessionProfile = async (
    username: string
  ): Promise<{
    name: string;
    rawUuid: string;
    dashedUuid: string;
    skinUrl: string | null;
    slim: boolean;
  } | null> => {
    const cacheKey = username.toLowerCase();
    const cached = mcProfileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    try {
      const profileRes = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
        {
          headers: { 'User-Agent': 'SwxStudios/1.0' },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (profileRes.ok && profileRes.status !== 204) {
        const pData = (await profileRes.json()) as { id?: string; name?: string };
        if (pData.id && pData.name) {
          const rawUuid = pData.id.toLowerCase();
          const dashedUuid = `${rawUuid.slice(0, 8)}-${rawUuid.slice(8, 12)}-${rawUuid.slice(
            12,
            16
          )}-${rawUuid.slice(16, 20)}-${rawUuid.slice(20)}`;

          let skinUrl: string | null = null;
          let slim = false;
          try {
            const sessRes = await fetch(
              `https://sessionserver.mojang.com/session/minecraft/profile/${encodeURIComponent(rawUuid)}`,
              {
                headers: { 'User-Agent': 'SwxStudios/1.0' },
                signal: AbortSignal.timeout(4000),
              }
            );
            if (sessRes.ok) {
              const sData = (await sessRes.json()) as {
                properties?: Array<{ name?: string; value?: string }>;
              };
              const texProp = sData.properties?.find(
                (prop) => prop.name === 'textures' && prop.value
              );
              if (texProp?.value) {
                const decoded = JSON.parse(
                  Buffer.from(texProp.value, 'base64').toString('utf-8')
                ) as {
                  textures?: {
                    SKIN?: {
                      url?: string;
                      metadata?: { model?: string };
                    };
                  };
                };
                skinUrl = decoded.textures?.SKIN?.url || null;
                slim = decoded.textures?.SKIN?.metadata?.model === 'slim';
              }
            }
          } catch {
            // Fall back to uuid-based lookup
          }

          const profile = { name: pData.name, rawUuid, dashedUuid, skinUrl, slim };
          mcProfileCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, profile });
          return profile;
        }
      }
    } catch {
      // Fall back to PlayerDB below
    }

    // Resilient fallback via PlayerDB if Mojang API rate-limits or times out
    try {
      const pdbRes = await fetch(
        `https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`,
        {
          headers: { 'User-Agent': 'SwxStudios/1.0' },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (pdbRes.ok) {
        const pdbData = (await pdbRes.json()) as {
          success?: boolean;
          data?: {
            player?: {
              id?: string;
              raw_id?: string;
              username?: string;
              skin_texture?: string;
              properties?: Array<{ name?: string; value?: string }>;
            };
          };
        };
        const p = pdbData.data?.player;
        if (pdbData.success && p?.raw_id && p?.username) {
          let skinUrl = p.skin_texture || null;
          let slim = false;
          const texProp = p.properties?.find((prop) => prop.name === 'textures' && prop.value);
          if (texProp?.value) {
            try {
              const decoded = JSON.parse(
                Buffer.from(texProp.value, 'base64').toString('utf-8')
              ) as {
                textures?: {
                  SKIN?: { url?: string; metadata?: { model?: string } };
                };
              };
              skinUrl = decoded.textures?.SKIN?.url || skinUrl;
              slim = decoded.textures?.SKIN?.metadata?.model === 'slim';
            } catch {
              // Ignore decode error
            }
          }
          const rawUuid = p.raw_id.toLowerCase();
          const dashedUuid =
            p.id ||
            `${rawUuid.slice(0, 8)}-${rawUuid.slice(8, 12)}-${rawUuid.slice(12, 16)}-${rawUuid.slice(
              16,
              20
            )}-${rawUuid.slice(20)}`;
          const profile = { name: p.username, rawUuid, dashedUuid, skinUrl, slim };
          mcProfileCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, profile });
          return profile;
        }
      }
    } catch {
      // Ignore fallback error
    }

    mcProfileCache.set(cacheKey, { expiresAt: Date.now() + 60_000, profile: null });
    return null;
  };

  app.get('/api/mc/uuid/:username', async (req: Request, res: Response) => {
    const username = String(req.params.username || '').trim();
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
      res.status(400).json({ error: 'Minecraft usernames must be 1–16 letters, numbers, or underscores.' });
      return;
    }

    try {
      const resolved = await resolveMojangSessionProfile(username);
      if (!resolved) {
        res.status(404).json({ error: `No Java Edition account found for "${username}".` });
        return;
      }

      res.json({
        name: resolved.name,
        rawUuid: resolved.rawUuid,
        dashedUuid: resolved.dashedUuid,
        slim: resolved.slim,
        avatarUrl: `/api/mc/avatar/${encodeURIComponent(resolved.name)}`,
        skinTextureUrl: `/api/mc/skin/${encodeURIComponent(resolved.name)}`,
        skinRenderUrl: `https://mc-heads.net/body/${encodeURIComponent(resolved.rawUuid)}/160`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach Mojang API.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/mc/skin/:username', async (req: Request, res: Response) => {
    const username = String(req.params.username || '').trim();
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
      res.status(400).json({ error: 'Invalid Minecraft username.' });
      return;
    }

    const cacheKey = username.toLowerCase();
    const cachedSkin = mcSkinCache.get(cacheKey);
    if (cachedSkin && cachedSkin.expiresAt > Date.now()) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(cachedSkin.buffer);
      return;
    }

    const candidates: string[] = [];
    try {
      const resolved = await resolveMojangSessionProfile(username);
      if (resolved?.skinUrl) {
        candidates.push(resolved.skinUrl);
      }
      if (resolved?.rawUuid) {
        candidates.push(`https://mc-heads.net/skin/${encodeURIComponent(resolved.rawUuid)}`);
      }
    } catch {
      // Continue to username-based fallbacks
    }

    candidates.push(
      `https://mc-heads.net/skin/${encodeURIComponent(username)}`,
      `https://minotar.net/skin/${encodeURIComponent(username)}`
    );

    try {
      const buffer = await Promise.any(
        candidates.map(async (targetUrl) => {
          const imgRes = await fetch(targetUrl, {
            headers: { 'User-Agent': 'SwxStudios/1.0' },
            signal: AbortSignal.timeout(4500),
          });
          if (!imgRes.ok) throw new Error('Non-200 response');
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const png = isValidPngBuffer(buf);
          // Only accept valid Minecraft skin aspect ratios (64x64, 64x32, 128x128)
          if (!png.valid || png.w < 64 || (png.h !== 32 && png.h !== 64 && png.h !== 128)) {
            throw new Error('Invalid skin dimensions');
          }
          return buf;
        })
      );

      mcSkinCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, buffer });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(buffer);
      return;
    } catch {
      const fallback = getFallbackSteveSkinPng();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Swx-Skin-Fallback', 'steve');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.send(fallback);
    }
  });

  app.get('/api/mc/avatar/:username', async (req: Request, res: Response) => {
    const username = String(req.params.username || '').trim();
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
      res.status(400).json({ error: 'Invalid Minecraft username.' });
      return;
    }

    const rawSize = Number(req.query.s);
    const size = Number.isFinite(rawSize) ? Math.max(16, Math.min(256, Math.round(rawSize))) : 128;
    const style = req.query.style === '3d' ? 'head' : 'avatar';

    const cacheKey = `${style}:${size}:${username.toLowerCase()}`;
    const cachedAvatar = mcAvatarCache.get(cacheKey);
    if (cachedAvatar && cachedAvatar.expiresAt > Date.now()) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(cachedAvatar.buffer);
      return;
    }

    const candidates =
      style === 'head'
        ? [
            `https://mc-heads.net/head/${encodeURIComponent(username)}/${size}`,
            `https://minotar.net/cube/${encodeURIComponent(username)}/${size}.png`,
          ]
        : [
            `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`,
            `https://minotar.net/helm/${encodeURIComponent(username)}/${size}.png`,
          ];

    try {
      const buffer = await Promise.any(
        candidates.map(async (targetUrl) => {
          const imgRes = await fetch(targetUrl, {
            headers: { 'User-Agent': 'SwxStudios/1.0' },
            signal: AbortSignal.timeout(4500),
          });
          if (!imgRes.ok) throw new Error('Non-200 response');
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const png = isValidPngBuffer(buf);
          if (!png.valid) throw new Error('Invalid PNG');
          return buf;
        })
      );

      mcAvatarCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, buffer });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(buffer);
      return;
    } catch {
      const fallback = getFallbackSteveHeadPng();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Swx-Avatar-Fallback', 'steve');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.send(fallback);
    }
  });

  // Vite middleware in development; static dist serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SwxStudios server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start SwxStudios server:', err);
  process.exit(1);
});
