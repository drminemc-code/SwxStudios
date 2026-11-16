import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response } from 'express';

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
  app.use(express.json());

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
