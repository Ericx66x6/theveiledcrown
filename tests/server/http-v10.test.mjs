import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { portalFixture } from '../domain/fixture-v8.mjs';
import { sqlFixture } from './sql-fixture.mjs';
import { SupabaseRepository } from '../../server/repository.mjs';
import { SupabaseMedia } from '../../server/media.mjs';
import { createPortalServer } from '../../server/app.mjs';
import { RemoteClient } from '../../client/transport.js';
import { validateWorkspace } from '../../core/workspace.js';

async function fixture(t, options = {}) {
  const f = await portalFixture(),
    sql = await sqlFixture(),
    objects = new Map(),
    storageCalls = [];
  t.after(() => sql.close());
  const media = new SupabaseMedia({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    fetcher: async (url, options) => {
      const path = new URL(url).pathname;
      storageCalls.push({ path, method: options.method || 'GET' });
      if (options.method === 'POST') {
        objects.set(path, Buffer.from(options.body));
        return Response.json({ ok: true });
      }
      return objects.has(path)
        ? new Response(objects.get(path))
        : new Response('', { status: 404 });
    }
  });
  const privateImage =
    'data:image/jpeg;base64,' + Buffer.from([255, 216, 1, 2, 255, 217]).toString('base64');
  const map = await f.map({ title: 'Mapa reservado', player_access: false, image: privateImage });
  const root = await f.store.workspace();
  const repo = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed: root,
    media,
    fetcher: sql.fetcher
  });
  await repo.load();
  await repo.save(root, 0);
  storageCalls.length = 0;
  const server = createPortalServer({
    repository: repo,
    bootstrapToken: 'chave-ficticia-desempenho-0123456789',
    ...options
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const req = async (path, { token = f.one.token, method = 'GET', data, headers = {} } = {}) => {
    const url = new URL(base + path);
    if (method === 'GET' && data) url.searchParams.set('data', JSON.stringify(data));
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Coroa-Client': '10',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers
      },
      body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(data || {})
    });
  };
  return { ...f, repo, sql, req, base, map, privateImage, storageCalls };
}
test('v10 HTTP: mapa privado exige permissão; copiar seu URL para perfil é recusado; exportação continua portátil', async (t) => {
  const f = await fixture(t);
  const gm = await (await f.req('/api/maps/' + f.map.id, { token: f.admin.token })).json(),
    url = gm.image;
  assert.match(url, /^\/api\/media\/[a-f0-9]{64}\.jpg$/);
  assert.equal((await f.req(url)).status, 403);
  assert.equal((await f.req(url, { token: null })).status, 401);
  assert.equal(
    (await f.req('/api/profile', { method: 'PATCH', data: { avatar: url } })).status,
    403
  );
  const image = await f.req(url, { token: f.admin.token });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  const etag = image.headers.get('etag');
  assert.ok(etag);
  assert.match(image.headers.get('vary'), /Cookie/);
  assert.equal(
    (await f.req(url, { token: f.admin.token, headers: { 'If-None-Match': etag } })).status,
    304
  );
  const packet = await (await f.req('/api/json/workspace', { token: f.admin.token })).json();
  assert.equal(packet.campaigns[0].maps[0].image, f.privateImage);
  assert.ok(validateWorkspace(packet));
  assert.equal(
    (await f.req('/api/media/portable', { method: 'POST', data: { document: { image: url } } }))
      .status,
    403
  );
  assert.equal(
    (
      await f.req('/api/media/portable', {
        method: 'POST',
        data: { document: { nested: [{ _coroa_media: f.repo.media.resolve(url) }] } }
      })
    ).status,
    403,
    'referências internas também exigem autorização, mesmo em JSON arbitrário'
  );
});
test('v10 HTTP: revogar mapa bloqueia novas leituras mesmo quando a imagem está em cache', async (t) => {
  const f = await fixture(t);
  await f.req('/api/maps/' + f.map.id, {
    method: 'PATCH',
    token: f.admin.token,
    data: { revision: f.map._revision, player_access: true }
  });
  let map = await (await f.req('/api/maps/' + f.map.id)).json();
  assert.equal((await f.req(map.image)).status, 200);
  await f.req('/api/maps/' + map.id, {
    method: 'PATCH',
    token: f.admin.token,
    data: { revision: map._revision, player_access: false }
  });
  assert.equal((await f.req(map.image)).status, 403);
});
test('v10 HTTP: salvar devolve delta, atualiza saldo real e evita nova leitura do livro e das fichas intactas', async (t) => {
  const f = await fixture(t),
    c = new RemoteClient(f.base);
  c.campaignId = f.campaign;
  const initial = await c.request('/api/portal-state', { token: f.one.token });
  const p = initial.players[0];
  c.viewCache = {
    incremental: true,
    character_id: p.id,
    archived: false,
    known_campaign_id: f.campaign,
    known_account_id: f.one.account.id,
    known_game_revision: initial.game._revision,
    known_character_revisions: Object.fromEntries(initial.players.map((p) => [p.id, p._revision]))
  };
  const before = f.sql.calls.length;
  const result = await c.request('/api/characters/' + p.id + '/money', {
    method: 'POST',
    token: f.one.token,
    data: { revision: p._revision, delta: 25, reason: 'Ganho confirmado' }
  });
  assert.equal(result.money, p.money + 25);
  const cached = c.takePortalState(c.viewCache);
  assert.ok(cached);
  assert.equal(cached.game, null);
  assert.equal(cached.players.length, 1);
  assert.equal(cached.players[0].money, p.money + 25);
  assert.equal(
    f.sql.calls.length - before,
    2,
    'um poll pequeno e um commit, sem segunda carga para atualizar a tela'
  );
  assert.ok(f.sql.calls.at(-1).upload < 50000);
  const response = await f.req('/api/portal-state', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  assert.match(response.headers.get('server-timing'), /db;dur=/);
  const restored = await (await f.req('/api/json/player')).json();
  assert.ok(validateWorkspace(restored));
});
test('v10 HTTP: status restaura sessão sem expor token ou hash e sincronização não toca em imagens', async (t) => {
  const f = await fixture(t),
    r = await f.req('/auth/status'),
    status = await r.json();
  assert.equal(status.session.account.id, f.one.account.id);
  assert.equal(status.session.account.password_hash, undefined);
  assert.equal(status.session.token, undefined);
  assert.equal(status.session.campaign_id, f.campaign);
  const before = f.storageCalls.length;
  for (let i = 0; i < 5; i++) assert.equal((await f.req('/api/sync')).status, 200);
  assert.equal(f.storageCalls.length, before);
  const guest = await (await f.req('/auth/status', { token: null })).json();
  assert.equal(guest.session, undefined);
});
test('v10 HTTP: leituras continuam disponíveis enquanto uma gravação aguarda confirmação', async (t) => {
  const f = await fixture(t),
    p = await (await f.req('/api/characters/234567')).json();
  let release, markStarted;
  const gate = new Promise((r) => (release = r)),
    started = new Promise((r) => (markStarted = r)),
    save = f.repo.save.bind(f.repo);
  f.repo.save = async (...args) => {
    markStarted();
    await gate;
    return save(...args);
  };
  const writing = f.req('/api/characters/234567/money', {
    method: 'POST',
    data: { revision: p._revision, delta: 1, reason: 'Gravação em andamento' }
  });
  try {
    await started;
    const response = await fetch(f.base + '/api/sync', {
      headers: { Authorization: 'Bearer ' + f.one.token, 'X-Coroa-Client': '10' },
      signal: AbortSignal.timeout(3000)
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await f.repo.load()).root.campaigns[0].characters[0].money,
      p.money,
      'cache ainda mostra o valor confirmado anterior'
    );
  } finally {
    release();
  }
  assert.equal((await writing).status, 200);
});
test('v10 HTTP: manutenção deixa health disponível e impede leituras e alterações', async (t) => {
  const f = await fixture(t, { maintenance: true }),
    before = f.sql.calls.length;
  const health = await (await f.req('/api/health', { token: null })).json();
  assert.equal(health.version, '10.2.0');
  assert.equal(health.maintenance, true);
  for (const [path, method] of [
    ['/auth/status', 'GET'],
    ['/api/profile', 'PATCH']
  ]) {
    const r = await f.req(path, {
      method,
      data: method === 'PATCH' ? { bio: 'não gravar' } : undefined
    });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).code, 'MAINTENANCE');
  }
  assert.equal(f.sql.calls.length, before);
});
test('v10 HTTP: cliente anterior continua recebendo imagens portáteis', async (t) => {
  const f = await fixture(t),
    r = await f.req('/api/maps/' + f.map.id, {
      token: f.admin.token,
      headers: { 'X-Coroa-Client': '9' }
    });
  assert.equal((await r.json()).image, f.privateImage);
});
