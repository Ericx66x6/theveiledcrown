import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { CampaignStore } from '../core/store.js';
import { PortalService } from '../core/portal-service.js';
import { publicAccount } from '../core/model.js';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};
const routes = [
  [/^\/auth\/(bootstrap|login|logout|password)$/, ['POST']],
  [/^\/auth\/me$/, ['GET']],
  [/^\/api\/campaigns$/, ['GET', 'POST']],
  [/^\/api\/campaigns\/[^/]+\/select$/, ['POST']],
  [/^\/api\/campaigns\/[^/]+$/, ['PATCH', 'DELETE']],
  [/^\/api\/campaign$/, ['GET']],
  [/^\/api\/portal-state$/, ['GET']],
  [/^\/api\/members\/[^/]+$/, ['GET']],
  [/^\/api\/social$/, ['GET', 'POST']],
  [/^\/api\/social\/[^/]+$/, ['DELETE']],
  [/^\/api\/admin\/reset$/, ['POST']],
  [/^\/api\/admin\/trash\/purge$/, ['DELETE']],
  [/^\/api\/characters\/\d+\/logs\/(history|transactions|rolls)$/, ['DELETE']],
  [/^\/api\/game$/, ['GET', 'PUT']],
  [/^\/api\/profile$/, ['GET', 'PATCH']],
  [/^\/api\/characters$/, ['GET']],
  [/^\/api\/characters\/import$/, ['POST']],
  [/^\/api\/characters\/\d+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/characters\/\d+\/upgrade-preview$/, ['GET']],
  [/^\/api\/characters\/\d+\/(upgrade|xp|full|archive|money|roll|assign)$/, ['POST']],
  [/^\/api\/admin\/accounts$/, ['GET', 'POST']],
  [/^\/api\/admin\/accounts\/[^/]+$/, ['PATCH', 'DELETE']],
  [/^\/api\/admin\/xp\/distribute$/, ['POST']],
  [/^\/api\/admin\/trash$/, ['GET']],
  [/^\/api\/admin\/trash\/[^/]+\/[^/]+\/restore$/, ['POST']],
  [/^\/api\/notes(?:\/[^/]+)?$/, ['GET', 'POST', 'PATCH', 'DELETE']],
  [/^\/api\/quests(?:\/[^/]+)?$/, ['GET', 'POST', 'PATCH', 'DELETE']],
  [/^\/api\/quests\/[^/]+\/(complete)$/, ['POST']],
  [/^\/api\/maps$/, ['GET', 'POST']],
  [/^\/api\/maps\/[^/]+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/maps\/[^/]+\/pins(?:\/[^/]+)?$/, ['POST', 'PATCH', 'DELETE']],
  [/^\/api\/network(?:\/(nodes|links)(?:\/[^/]+)?)?$/, ['GET', 'POST', 'PATCH', 'DELETE']],
  [/^\/api\/submissions(?:\/[^/]+)?$/, ['GET', 'POST', 'PATCH', 'DELETE']],
  [/^\/api\/submissions\/[^/]+\/(approve|review)$/, ['POST']],
  [/^\/api\/notifications$/, ['GET', 'DELETE']],
  [/^\/api\/notifications\/[^/]+\/read$/, ['POST']],
  [/^\/api\/notifications\/read-all$/, ['POST']],
  [/^\/api\/notifications\/[^/]+$/, ['DELETE']],
  [/^\/api\/rulebook\/catalog\/[^/]+\/\d+$/, ['DELETE']],
  [/^\/api\/json\/(workspace|player)$/, ['GET']],
  [/^\/api\/json\/replace$/, ['POST']],
  [/^\/api\/exchange\/submission$/, ['GET']],
  [/^\/api\/exchange\/import$/, ['POST']],
  [/^\/api\/characters\/new-id$/, ['GET']],
  [/^\/api\/admin\/characters$/, ['POST']],
  [/^\/api\/admin\/snapshots$/, ['GET', 'DELETE']],
  [/^\/api\/admin\/snapshots\/restore$/, ['POST']]
];
function error(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function constant(a, b) {
  const x = Buffer.from(a || ''),
    y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
async function body(req, maxBytes) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return {};
  if (!String(req.headers['content-type'] || '').startsWith('application/json'))
    throw error('Envie JSON.', 415);
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw error('Arquivo maior que o limite da API.', 413);
    chunks.push(chunk);
  }
  if (!length) return {};
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw 0;
    return data;
  } catch {
    throw error('JSON inválido.');
  }
}
export function createPortalServer({
  repository,
  bootstrapToken,
  staticDir,
  allowedOrigins = [],
  trustProxy = false,
  allowSameOriginFrames = false,
  maxBytes = 100 * 1024 * 1024
}) {
  if (!bootstrapToken || bootstrapToken.length < 32)
    throw new Error('BOOTSTRAP_TOKEN precisa ter pelo menos 32 caracteres.');
  const directory = staticDir && resolve(staticDir);
  const presence = new Map();
  const attempts = new Map(),
    limits = new Map();
  let queue = Promise.resolve();
  const run = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', allowSameOriginFrames ? 'SAMEORIGIN' : 'DENY');
    const url = new URL(req.url, 'http://local.invalid');
    const api = url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
    const respond = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (origin) {
        const forwarded = trustProxy
          ? String(req.headers['x-forwarded-proto'] || '')
              .split(',')
              .at(-1)
              .trim()
          : '';
        const own = (forwarded === 'https' ? 'https' : 'http') + '://' + req.headers.host;
        if (origin !== own && !allowedOrigins.includes(origin))
          throw error('Origem não autorizada.', 403);
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Authorization, Content-Type, X-Campaign-ID, X-Portal-Session'
        );
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Expose-Headers', 'X-Portal-Revision');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (!api) {
        if (!directory || !['GET', 'HEAD'].includes(req.method))
          throw error('Página não encontrada.', 404);
        const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        if (pathname.split('/').some((part) => part.startsWith('.')))
          throw error('Página não encontrada.', 404);
        const file = resolve(directory, '.' + pathname);
        if (!file.startsWith(directory + sep) || !MIME[extname(file)])
          throw error('Página não encontrada.', 404);
        let data;
        try {
          if (!(await stat(file)).isFile()) throw 0;
          data = await readFile(file);
        } catch {
          throw error('Página não encontrada.', 404);
        }
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)],
          'Cache-Control': 'no-cache',
          'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self'; media-src blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${allowSameOriginFrames ? "'self'" : "'none'"}; form-action 'self'`
        });
        res.end(req.method === 'HEAD' ? undefined : data);
        return;
      }
      if (url.pathname === '/api/health') {
        respond(200, { status: 'ok', version: '7.0.0' });
        return;
      }
      const ip = trustProxy
        ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
            .split(',')
            .at(-1)
            .trim()
        : req.socket.remoteAddress;
      const rateKey = ip + (url.pathname.startsWith('/auth/') ? ':auth' : ':api');
      const now = Date.now(),
        window = limits.get(rateKey) || { start: now, count: 0 };
      if (now - window.start > 60000) {
        window.start = now;
        window.count = 0;
      }
      window.count++;
      limits.set(rateKey, window);
      if (limits.size > 10000)
        for (const [key, value] of limits) if (now - value.start > 60000) limits.delete(key);
      if (window.count > (url.pathname.startsWith('/auth/') ? 40 : 400))
        throw error('Muitas solicitações. Aguarde um minuto.', 429);
      const data =
        req.method === 'GET' && url.searchParams.has('data')
          ? JSON.parse(url.searchParams.get('data'))
          : await body(
              req,
              url.pathname.startsWith('/auth/') ? Math.min(maxBytes, 16384) : maxBytes
            );
      if (url.pathname !== '/auth/status' && url.pathname !== '/api/sync') {
        const route = routes.find(([pattern]) => pattern.test(url.pathname));
        if (!route) throw error('Recurso não encontrado.', 404);
        if (!route[1].includes(req.method)) throw error('Método não permitido.', 405);
      } else if (req.method !== 'GET') throw error('Método não permitido.', 405);
      if (url.pathname === '/auth/bootstrap') {
        if (!constant(data.bootstrap_token, bootstrapToken))
          throw error('Chave de instalação incorreta.', 403);
        delete data.bootstrap_token;
      }
      if (
        (url.pathname === '/auth/bootstrap' ||
          url.pathname === '/auth/password' ||
          /^\/api\/admin\/accounts/.test(url.pathname)) &&
        data.password !== undefined &&
        data.password.length < 10
      )
        throw error('Use uma senha com pelo menos 10 caracteres.');
      const bearerHeader = String(req.headers.authorization || '').match(
        /^Bearer ([A-Za-z0-9_-]+)$/
      )?.[1];
      const cookieToken = String(req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('coroa_session='))
        ?.slice('coroa_session='.length);
      const bearer =
        bearerHeader ||
        (/^[A-Za-z0-9_-]{20,200}$/.test(cookieToken || '') ? cookieToken : undefined);
      if (!bearerHeader && cookieToken && !['GET', 'HEAD'].includes(req.method) && !origin)
        throw error('Origem obrigatória para alterações autenticadas.', 403);
      const result = await run(async () => {
        const loaded = await repository.load();
        if (url.pathname === '/auth/status')
          return {
            response: { needs_bootstrap: !loaded.root.accounts.length, remote: true },
            revision: loaded.revision
          };
        const baseline = JSON.stringify(loaded.root),
          store = await new CampaignStore(loaded.root).open(),
          service = new PortalService(store);
        service.attempts = attempts;
        service.maxSessions = 2000;
        service.factoryGame = repository.seed?.default_game || loaded.root.default_game;
        const originalCampaign = store.root.active_campaign_id;
        const active = store.root.sessions.find(
          (s) => s.token === bearer && (s.expires === null || s.expires > Date.now())
        );
        const user =
          active &&
          store.root.accounts.find(
            (a) => a.id === active.account && a.active && a.session_version === active.version
          );
        if (user) {
          const requested = req.headers['x-campaign-id'] || active.campaign_id;
          const permitted = store.root.campaigns.filter(
            (c) => user.role === 'admin' || Object.hasOwn(user.memberships, c.id)
          );
          if (req.headers['x-campaign-id'] && !permitted.some((c) => c.id === requested))
            throw error('Você não pertence a esta campanha.', 403);
          const selected = permitted.find((c) => c.id === requested) || permitted[0];
          if (selected) store.root.active_campaign_id = selected.id;
        }
        let response;
        if (url.pathname === '/api/sync') {
          service.auth(await store.get(), bearer);
          response = { revision: loaded.revision };
        } else
          response = await service.request(
            url.pathname +
              (url.searchParams.has('character_id')
                ? '?character_id=' + encodeURIComponent(url.searchParams.get('character_id'))
                : url.searchParams.get('archived') === '1'
                  ? '?archived=1'
                  : ''),
            { method: req.method, data, token: bearer }
          );
        if (response?.token && response?.account) {
          response.mode = 'online';
          const account = store.root.accounts.find((a) => a.id === response.account.id);
          const c = store.root.campaigns.find(
            (c) => account.role === 'admin' || Object.hasOwn(account.memberships, c.id)
          );
          const s = store.root.sessions.find((s) => s.token === response.token);
          if (s && c) {
            s.campaign_id = c.id;
            store.root.active_campaign_id = c.id;
            response.campaign_id = c.id;
            response.account = publicAccount(service.auth(await store.get(), response.token));
          }
        }
        if (url.pathname === '/auth/me')
          response.campaign_id =
            user && store.root.campaigns.some((c) => c.id === store.root.active_campaign_id)
              ? store.root.active_campaign_id
              : null;
        if (url.pathname.endsWith('/select') && active) {
          const s = store.root.sessions.find((s) => s.token === bearer);
          if (s) s.campaign_id = store.root.active_campaign_id;
        }
        if (store.root.campaigns.some((c) => c.id === originalCampaign))
          store.root.active_campaign_id = originalCampaign;
        const presentUser =
          user ||
          (response?.account && store.root.accounts.find((a) => a.id === response.account.id));
        const currentCampaign = store.root.campaigns.find(
          (c) => c.id === store.root.active_campaign_id
        );
        if (presentUser && currentCampaign && url.pathname !== '/auth/logout')
          presence.set(currentCampaign.id + '|' + presentUser.id, Date.now());
        if (url.pathname === '/auth/logout' && presentUser)
          for (const key of presence.keys())
            if (key.endsWith('|' + presentUser.id)) presence.delete(key);
        const members =
          response?.social?.members || (url.pathname === '/api/social' ? response?.members : null);
        if (members && currentCampaign)
          for (const member of members) {
            const at = presence.get(currentCampaign.id + '|' + member.id);
            member.online = !!at && Date.now() - at < 90000;
            member.last_seen = at ? new Date(at).toISOString() : null;
          }
        if (presence.size > 10000)
          for (const [key, at] of presence) if (Date.now() - at > 3600000) presence.delete(key);
        let revision = loaded.revision;
        if (JSON.stringify(store.root) !== baseline)
          revision = await repository.save(store.root, loaded.revision);
        return { response, revision };
      });
      const forwardedSecure =
        trustProxy &&
        String(req.headers['x-forwarded-proto'] || '')
          .split(',')
          .at(-1)
          .trim() === 'https';
      const cookie = (value, maxAge) =>
        `coroa_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${forwardedSecure || req.socket.encrypted || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
      if (['/auth/logout', '/api/admin/reset'].includes(url.pathname))
        res.setHeader('Set-Cookie', cookie('', 0));
      else if (result.response?.token)
        res.setHeader('Set-Cookie', cookie(result.response.token, 34560000));
      else if (url.pathname === '/auth/me' && bearer)
        res.setHeader('Set-Cookie', cookie(bearer, 34560000));
      if (req.headers['x-portal-session'] === 'cookie' && result.response?.token)
        delete result.response.token;
      res.setHeader('X-Portal-Revision', String(result.revision));
      respond(200, result.response);
    } catch (e) {
      if (e.status === 401)
        res.setHeader('Set-Cookie', 'coroa_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      if (!res.headersSent)
        respond(e.status || 500, {
          error: e.status ? e.message : 'Não foi possível concluir a operação.'
        });
      else res.end();
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  return server;
}
