import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { CampaignStore } from '../core/store.js';
import { PortalService } from '../core/portal-service.js';
import { publicAccount } from '../core/model.js';
import { PlayerTestSessions } from './player-test.mjs';
import { Conflict } from './repository.mjs';
import { allowedMedia, assertMediaInput } from './media-access.mjs';
import { hydrateMedia, compactMediaResult } from './media.mjs';
import { isMediaURL } from '../core/media-reference.js';
const compress = promisify(gzip);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};
const routes = [
  [/^\/api\/recaps$/, ['GET', 'POST']],
  [/^\/api\/recaps\/[^/]+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/recaps\/[^/]+\/(submit|review)$/, ['POST']],
  [/^\/api\/feedbacks$/, ['GET', 'POST']],
  [/^\/api\/feedbacks\/[^/]+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/feedbacks\/[^/]+\/review$/, ['POST']],
  [/^\/api\/documents$/, ['GET', 'POST']],
  [/^\/api\/documents\/[^/]+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/documents\/[^/]+\/read$/, ['POST']],
  [/^\/api\/achievements$/, ['GET', 'POST']],
  [/^\/api\/achievements\/ack$/, ['POST']],
  [/^\/api\/achievements\/[^/]+$/, ['DELETE']],
  [/^\/api\/characters\/\d+\/blood-bonds$/, ['GET', 'POST']],
  [/^\/api\/characters\/\d+\/blood-bonds\/[^/]+$/, ['PATCH', 'DELETE']],
  [/^\/api\/characters\/\d+\/blood-bonds\/[^/]+\/(renew|weaken)$/, ['POST']],
  [/^\/api\/media\/portable$/, ['POST']],
  [/^\/api\/media\/[a-f0-9]{64}\.(jpg|png|webp)$/, ['GET', 'HEAD']],
  [/^\/auth\/(bootstrap|login|logout|password|register)$/, ['POST']],
  [/^\/api\/admin\/registrations$/, ['GET']],
  [/^\/api\/admin\/registrations\/[^/]+\/(approve|reject)$/, ['POST']],
  [/^\/api\/rewards$/, ['GET']],
  [/^\/api\/rewards\/(check-in|claim|ack)$/, ['POST']],
  [/^\/auth\/me$/, ['GET']],
  [/^\/api\/campaigns$/, ['GET', 'POST']],
  [/^\/api\/campaigns\/[^/]+\/select$/, ['POST']],
  [/^\/api\/campaigns\/[^/]+$/, ['PATCH', 'DELETE']],
  [/^\/api\/campaign$/, ['GET']],
  [/^\/api\/portal-state$/, ['GET']],
  [/^\/api\/player-test$/, ['POST', 'DELETE']],
  [/^\/api\/members\/[^/]+$/, ['GET']],
  [/^\/api\/social$/, ['GET', 'POST']],
  [/^\/api\/social\/[^/]+\/respond$/, ['POST']],
  [/^\/api\/social\/[^/]+$/, ['DELETE']],
  [/^\/api\/intel$/, ['GET', 'POST']],
  [/^\/api\/intel\/[^/]+\/purchase$/, ['POST']],
  [/^\/api\/intel\/[^/]+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/discipline-market\/\d+\/acquire$/, ['POST']],
  [/^\/api\/admin\/reset$/, ['POST']],
  [/^\/api\/admin\/trash\/purge$/, ['DELETE']],
  [/^\/api\/characters\/\d+\/logs\/(history|transactions|rolls)$/, ['DELETE']],
  [/^\/api\/game$/, ['GET', 'PUT']],
  [/^\/api\/profile$/, ['GET', 'PATCH']],
  [/^\/api\/characters$/, ['GET']],
  [/^\/api\/characters\/import$/, ['POST']],
  [/^\/api\/characters\/\d+$/, ['GET', 'PATCH', 'DELETE']],
  [/^\/api\/characters\/\d+\/upgrade-preview$/, ['GET']],
  [/^\/api\/characters\/\d+\/full$/, ['POST', 'PUT']],
  [/^\/api\/characters\/\d+\/(upgrade|xp|full|archive|money|roll|assign|aspiration)$/, ['POST']],
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
  [/^\/api\/maps\/[^/]+\/characters\/\d+$/, ['PUT', 'PATCH', 'DELETE']],
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
  maintenance = false,
  allowSameOriginFrames = false,
  maxBytes = 100 * 1024 * 1024
}) {
  if (!bootstrapToken || bootstrapToken.length < 32)
    throw new Error('BOOTSTRAP_TOKEN precisa ter pelo menos 32 caracteres.');
  const directory = staticDir && resolve(staticDir);
  const presence = new Map();
  const mediaPermissions = new Map();
  let mediaRevision;
  const playerTests = new PlayerTestSessions();
  const attempts = new Map(),
    limits = new Map();
  let queue = Promise.resolve();
  const run = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const server = createServer(async (req, res) => {
    const started = performance.now();
    let databaseMs = 0,
      commitMs = 0;
    const origin = req.headers.origin;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Coroa-Protocol', '10');
    res.setHeader('X-Frame-Options', allowSameOriginFrames ? 'SAMEORIGIN' : 'DENY');
    const url = new URL(req.url, 'http://local.invalid');
    const api = url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
    const respond = async (status, data) => {
      let bytes = Buffer.from(JSON.stringify(data));
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      };
      if (
        bytes.length > 2048 &&
        /(?:^|[,\s])gzip(?:[,\s]|$)/.test(req.headers['accept-encoding'] || '')
      ) {
        bytes = await compress(bytes, { level: 5 });
        headers['Content-Encoding'] = 'gzip';
        res.setHeader(
          'Vary',
          [res.getHeader('Vary'), 'Accept-Encoding'].filter(Boolean).join(', ')
        );
      }
      res.setHeader(
        'Server-Timing',
        `db;dur=${databaseMs.toFixed(1)}, commit;dur=${commitMs.toFixed(1)}, app;dur=${(performance.now() - started).toFixed(1)}`
      );
      res.writeHead(status, {
        ...headers,
        'Content-Length': bytes.length
      });
      res.end(bytes);
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
          'Authorization, Content-Type, X-Campaign-ID, X-Portal-Session, X-Player-Test, X-Coroa-Client'
        );
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Expose-Headers',
          'X-Portal-Revision, Server-Timing, X-Coroa-Protocol'
        );
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
          'Content-Security-Policy': `default-src 'none'; manifest-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self'; media-src blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${allowSameOriginFrames ? "'self'" : "'none'"}; form-action 'self'`
        });
        res.end(req.method === 'HEAD' ? undefined : data);
        return;
      }
      if (url.pathname === '/api/health') {
        await respond(200, {
          status: 'ok',
          version: '10.1.0',
          storage: 'incremental-v10.1',
          maintenance
        });
        return;
      }
      if (maintenance)
        throw Object.assign(
          error(
            'O portal está sendo atualizado pelo narrador. Tente novamente em alguns minutos.',
            503
          ),
          { code: 'MAINTENANCE' }
        );
      const ip = trustProxy
        ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
            .split(',')
            .at(-1)
            .trim()
        : req.socket.remoteAddress;
      const rateKey =
        ip +
        (url.pathname.startsWith('/auth/')
          ? ':auth'
          : isMediaURL(url.pathname)
            ? ':media'
            : ':api');
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
      if (
        window.count >
        (url.pathname.startsWith('/auth/') ? 40 : isMediaURL(url.pathname) ? 1200 : 400)
      )
        throw error('Muitas solicitações. Aguarde um minuto.', 429);
      const data =
        req.method === 'GET' && url.searchParams.has('data')
          ? JSON.parse(url.searchParams.get('data'))
          : await body(
              req,
              url.pathname === '/auth/register'
                ? Math.min(maxBytes, 512 * 1024)
                : url.pathname.startsWith('/auth/')
                  ? Math.min(maxBytes, 16384)
                  : maxBytes
            );
      const view = data.__portal_view;
      delete data.__portal_view;
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
      const mutation =
        !['GET', 'HEAD'].includes(req.method) && url.pathname !== '/api/media/portable';
      const execute = async () => {
        const loadStarted = performance.now();
        const loaded = await repository.load({
          fresh: mutation || url.pathname.startsWith('/auth/') || isMediaURL(url.pathname),
          readOnly: true
        });
        databaseMs += performance.now() - loadStarted;
        if (url.pathname === '/auth/status') {
          const session = loaded.root.sessions.find(
            (s) => s.token === bearer && (s.expires === null || s.expires > Date.now())
          );
          const actor =
            session &&
            loaded.root.accounts.find(
              (a) => a.id === session.account && a.active && a.session_version === session.version
            );
          const permitted = actor
            ? loaded.root.campaigns.filter(
                (c) => actor.role === 'admin' || Object.hasOwn(actor.memberships || {}, c.id)
              )
            : [];
          const campaign = permitted.find((c) => c.id === session?.campaign_id) || permitted[0];
          return {
            response: {
              needs_bootstrap: !loaded.root.accounts.length,
              registration_open: loaded.root.accounts.some((a) => a.role === 'admin' && a.active),
              remote: true,
              ...(actor
                ? {
                    session: {
                      account: publicAccount({
                        ...actor,
                        character_ids: actor.memberships?.[campaign?.id] || [],
                        _campaign_member: !!campaign
                      }),
                      campaign_id: campaign?.id || null,
                      mode: 'online'
                    }
                  }
                : {})
            },
            revision: loaded.revision
          };
        }
        const liveSession = loaded.root.sessions.find(
          (s) => s.token === bearer && (s.expires === null || s.expires > Date.now())
        );
        const liveAccount =
          liveSession &&
          loaded.root.accounts.find(
            (a) =>
              a.id === liveSession.account && a.active && a.session_version === liveSession.version
          );
        if (url.pathname === '/api/sync' && !req.headers['x-player-test']) {
          if (!liveAccount) throw error('Entre com seu login e senha.', 401);
          const requested = req.headers['x-campaign-id'] || liveSession.campaign_id;
          const permitted = loaded.root.campaigns.filter(
            (c) =>
              liveAccount.role === 'admin' || Object.hasOwn(liveAccount.memberships || {}, c.id)
          );
          if (req.headers['x-campaign-id'] && !permitted.some((c) => c.id === requested))
            throw error('Você não pertence a esta campanha.', 403);
          const current = permitted.find((c) => c.id === requested) || permitted[0];
          if (current) presence.set(current.id + '|' + liveAccount.id, Date.now());
          return { response: { revision: loaded.revision }, revision: loaded.revision };
        }
        if (url.pathname === '/api/media/portable' || isMediaURL(url.pathname)) {
          if (!liveAccount) throw error('Entre com seu login e senha.', 401);
          if (mediaRevision !== loaded.revision) {
            mediaPermissions.clear();
            mediaRevision = loaded.revision;
          }
          let allowed = mediaPermissions.get(liveAccount.id);
          if (!allowed) {
            allowed = allowedMedia(loaded.root, liveAccount);
            mediaPermissions.set(liveAccount.id, allowed);
          }
          if (url.pathname === '/api/media/portable') {
            if (!data.document || typeof data.document !== 'object')
              throw error('Escolha um documento JSON para exportar.');
            assertMediaInput(data.document, loaded.root, liveAccount);
            return { response: data.document, revision: loaded.revision, portable: true };
          }
          if (!repository.media || !allowed.has(url.pathname))
            throw error('Esta imagem não está disponível para o seu acesso.', 403);
          return { media: repository.media.resolve(url.pathname), revision: loaded.revision };
        }
        if (mutation) assertMediaInput(data, loaded.root, liveAccount);
        const baseline = mutation ? JSON.stringify(loaded.root) : null,
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
        const testId = req.headers['x-player-test'];
        if (url.pathname === '/api/player-test') {
          const actor = service.auth(await store.get(), bearer);
          playerTests.requireNarrator(actor);
          if (req.method === 'POST')
            return {
              response: await playerTests.start(
                loaded.root,
                user,
                bearer,
                data,
                testId ? active.campaign_id : req.headers['x-campaign-id'] || active.campaign_id
              ),
              revision: 0
            };
          playerTests.end(testId, actor, bearer);
          const requested = data.campaign_id || active.campaign_id;
          const selected =
            store.root.campaigns.find((c) => c.id === requested) || store.root.campaigns[0];
          if (selected) store.root.active_campaign_id = selected.id;
          return {
            response: {
              account: publicAccount(service.auth(await store.get(), bearer)),
              campaign_id: selected?.id || null,
              mode: 'online',
              player_test: null
            },
            revision: loaded.revision
          };
        }
        if (testId && url.pathname !== '/auth/logout') {
          const actor = service.auth(await store.get(), bearer);
          return playerTests.request(
            testId,
            actor,
            bearer,
            url.pathname +
              (url.searchParams.has('character_id')
                ? '?character_id=' + encodeURIComponent(url.searchParams.get('character_id'))
                : ''),
            { method: req.method, data, campaignId: req.headers['x-campaign-id'] }
          );
        }
        if (url.pathname === '/auth/logout' && user) playerTests.endOwner(user.id);
        if (user) {
          const requested =
            url.pathname === '/auth/logout'
              ? active.campaign_id
              : req.headers['x-campaign-id'] || active.campaign_id;
          const permitted = store.root.campaigns.filter(
            (c) => user.role === 'admin' || Object.hasOwn(user.memberships, c.id)
          );
          if (
            url.pathname !== '/auth/logout' &&
            req.headers['x-campaign-id'] &&
            !permitted.some((c) => c.id === requested)
          )
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
        const requestCampaign = store.root.campaigns.find(
          (c) => c.id === store.root.active_campaign_id
        );
        if (store.root.campaigns.some((c) => c.id === originalCampaign))
          store.root.active_campaign_id = originalCampaign;
        const presentUser =
          user ||
          (response?.account && store.root.accounts.find((a) => a.id === response.account.id));
        const currentCampaign = requestCampaign;
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
        let viewState = null;
        if (
          mutation &&
          view &&
          !req.headers['x-player-test'] &&
          !/\/auth\/|\/api\/(json\/replace|admin\/reset|campaigns|player-test|admin\/snapshots\/restore)/.test(
            url.pathname
          )
        ) {
          try {
            // Restore the caller's selected campaign for the response projection only.
            const prior = store.root.active_campaign_id;
            if (requestCampaign) store.root.active_campaign_id = requestCampaign.id;
            viewState = await service.request('/api/portal-state', { token: bearer, data: view });
            for (const member of viewState.social?.members || []) {
              const at = presence.get(requestCampaign.id + '|' + member.id);
              member.online = !!at && Date.now() - at < 90000;
              member.last_seen = at ? new Date(at).toISOString() : null;
            }
            store.root.active_campaign_id = prior;
          } catch {
            viewState = null;
            store.root.active_campaign_id = originalCampaign;
          }
        }
        let revision = loaded.revision;
        if (mutation && JSON.stringify(store.root) !== baseline) {
          const commitStarted = performance.now();
          revision = await repository.save(store.root, loaded.revision);
          commitMs += performance.now() - commitStarted;
        }
        return {
          response: viewState
            ? {
                _coroa_update: 10,
                result: response,
                state: viewState,
                view: { character_id: view.character_id, archived: !!view.archived }
              }
            : response,
          revision
        };
      };
      const retry = async () => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await execute();
          } catch (e) {
            if (!(e instanceof Conflict) || attempt >= 2) throw e;
          }
        }
      };
      // Reads and image downloads never wait behind another player's upload or save.
      const result = mutation ? await run(retry) : await execute();
      if (result.response?._coroa_update === 10)
        result.response.state._portal_revision = result.revision;
      else if (url.pathname === '/api/portal-state' && result.response)
        result.response._portal_revision = result.revision;
      if (result.media) {
        const ref = result.media,
          etag = '"' + ref.sha256 + '"';
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('Vary', 'Cookie, Authorization');
        res.setHeader('ETag', etag);
        res.setHeader('Content-Type', ref.mime);
        res.setHeader('X-Portal-Revision', String(result.revision));
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304);
          res.end();
          return;
        }
        const bytes = await repository.media.getBytes(ref);
        res.setHeader('Content-Length', bytes.length);
        res.writeHead(200);
        res.end(req.method === 'HEAD' ? undefined : bytes);
        return;
      }
      const portable =
        result.portable ||
        req.headers['x-coroa-client'] !== '10' ||
        (req.method === 'GET' &&
          /^\/api\/(json\/(workspace|player)|exchange\/submission)$/.test(url.pathname));
      if (repository.media)
        result.response = portable
          ? await hydrateMedia(result.response, repository.media)
          : compactMediaResult(result.response, repository.media);
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
      else if (
        (url.pathname === '/auth/me' ||
          (url.pathname === '/auth/status' && result.response?.session)) &&
        bearer
      )
        res.setHeader('Set-Cookie', cookie(bearer, 34560000));
      if (req.headers['x-portal-session'] === 'cookie' && result.response?.token)
        delete result.response.token;
      res.setHeader('X-Portal-Revision', String(result.revision));
      await respond(200, result.response);
    } catch (e) {
      if (e.status === 401)
        res.setHeader('Set-Cookie', 'coroa_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      if (!res.headersSent)
        await respond(e.status || 500, {
          error: e.status ? e.message : 'Não foi possível concluir a operação.',
          ...(['PLAYER_TEST_EXPIRED', 'MIGRATION_REQUIRED', 'MAINTENANCE'].includes(e.code)
            ? { code: e.code }
            : {})
        });
      else res.end();
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  server.on('close', () => playerTests.clear());
  return server;
}
