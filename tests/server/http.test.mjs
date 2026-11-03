import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { CampaignStore } from '../../core/store.js';
import { documentSeed, blank } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
import { createPortalServer } from '../../server/app.mjs';
import { MemoryRepository } from '../../server/repository.mjs';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
const secret = 'instalacao-de-testes-0123456789-abcdef';
async function fixture(t, repository) {
  const root = await new CampaignStore(documentSeed(game)).workspace();
  const repo = repository || new MemoryRepository(root);
  const server = createPortalServer({
    repository: repo,
    bootstrapToken: secret,
    staticDir: new URL('../../dist', import.meta.url).pathname
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, { method = 'GET', data, token, campaign, origin, cookie } = {}) => {
    const url = new URL(base + path);
    if (method === 'GET' && data) url.searchParams.set('data', JSON.stringify(data));
    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(campaign ? { 'X-Campaign-ID': campaign } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: method === 'GET' ? undefined : JSON.stringify(data || {})
    });
    const content = await r.text();
    let body;
    try {
      body = JSON.parse(content);
    } catch {
      body = content;
    }
    return {
      status: r.status,
      body,
      revision: Number(r.headers.get('X-Portal-Revision')),
      headers: r.headers
    };
  };
  const call = async (path, options = {}) => {
    const r = await request(path, options);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const bootstrap = () =>
    call('/auth/bootstrap', {
      method: 'POST',
      data: {
        bootstrap_token: secret,
        display_name: 'Narrador',
        username: 'narrador',
        password: 'senha-teste-123'
      }
    });
  const create = async (admin, id, user) => {
    const p = blank(game, id);
    Object.assign(p, { char: 'Personagem ' + id, player: user, cla: 'Livre', xp: 20 });
    await call('/api/admin/characters', {
      method: 'POST',
      token: admin.token,
      data: { character: p, access: { username: user, password: 'senha-teste-123' } }
    });
    return call('/auth/login', {
      method: 'POST',
      data: { username: user, password: 'senha-teste-123' }
    });
  };
  return { request, call, bootstrap, create, repo, base };
}
test('HTTP: instalação protegida, autenticação e acesso revogado', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('/auth/status')).body.needs_bootstrap, true);
  assert.equal(
    (
      await f.request('/auth/bootstrap', {
        method: 'POST',
        data: { username: 'invasor', password: 'senha-teste-123' }
      })
    ).status,
    403
  );
  const admin = await f.bootstrap();
  assert.equal(admin.mode, 'online');
  assert.equal((await f.request('/auth/status')).body.needs_bootstrap, false);
  assert.equal((await f.request('/api/characters')).status, 401);
  assert.equal((await f.request('/auth/me', { token: admin.token })).body.account.role, 'admin');
  await f.call('/auth/logout', { method: 'POST', token: admin.token });
  assert.equal((await f.request('/auth/me', { token: admin.token })).status, 401);
});
test('HTTP: missões só chegam aos participantes e narrador conclui diretamente', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap();
  const player = await f.create(admin, 234567, 'jogador'),
    other = await f.create(admin, 345678, 'segundo');
  const q = await f.call('/api/quests', {
    method: 'POST',
    token: admin.token,
    data: { title: 'Segredo', assignees: [234567], xp_reward: 8 }
  });
  assert.equal((await f.call('/api/quests', { token: other.token })).length, 0);
  assert.equal((await f.call('/api/quests', { token: player.token })).length, 1);
  assert.equal(
    (
      await f.request('/api/quests', {
        method: 'POST',
        token: player.token,
        data: { title: 'Fraude', assignees: [234567] }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await f.request('/api/quests/' + q.id, {
        method: 'PATCH',
        token: player.token,
        data: { revision: 1, xp_reward: 100 }
      })
    ).status,
    403
  );
  await f.call('/api/quests/' + q.id + '/complete', {
    method: 'POST',
    token: admin.token,
    data: { revision: q._revision }
  });
  assert.equal((await f.call('/api/characters/234567', { token: player.token })).xp, 28);
  assert.equal(
    (
      await f.request('/api/quests/' + q.id + '/complete', {
        method: 'POST',
        token: admin.token,
        data: { revision: 2 }
      })
    ).status,
    409
  );
});
test('HTTP: jogador não dispõe de pedido de conclusão', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap(),
    player = await f.create(admin, 234567, 'jogador');
  const q = await f.call('/api/quests', {
    method: 'POST',
    token: admin.token,
    data: { title: 'Uma pista', assignees: [234567], xp_reward: 8 }
  });
  assert.equal(
    (
      await f.request('/api/quests/' + q.id + '/request-completion', {
        method: 'POST',
        token: player.token,
        data: { revision: q._revision }
      })
    ).status,
    404
  );
  assert.equal((await f.call('/api/characters/234567', { token: player.token })).xp, 20);
});
test('HTTP: relações privadas por personagem; narrador e outro jogador são recusados', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap(),
    p = await f.create(admin, 234567, 'jogador'),
    other = await f.create(admin, 345678, 'segundo');
  const node = await f.call('/api/network/nodes', {
    method: 'POST',
    token: p.token,
    data: { character_id: 234567, name: 'Uma teoria' }
  });
  assert.equal(
    (await f.request('/api/network?character_id=234567', { token: admin.token })).status,
    403
  );
  assert.equal(
    (await f.request('/api/network?character_id=234567', { token: other.token })).status,
    403
  );
  assert.equal(
    (await f.call('/api/network?character_id=234567', { token: p.token })).nodes[0].id,
    node.id
  );
  assert.equal((await f.call('/api/campaign', { token: other.token })).network.nodes.length, 0);
});
test('HTTP: XP em lote não duplica com solicitações concorrentes', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap();
  await f.create(admin, 234567, 'jogador');
  await f.create(admin, 345678, 'segundo');
  const data = {
    request_id: 'http-lote-unico',
    confirmed: true,
    amount: 5,
    reason: 'Conquista',
    character_ids: [234567, 345678],
    revisions: { 234567: 0, 345678: 0 }
  };
  const responses = await Promise.all([
    f.request('/api/admin/xp/distribute', { method: 'POST', token: admin.token, data }),
    f.request('/api/admin/xp/distribute', { method: 'POST', token: admin.token, data })
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200]
  );
  assert.deepEqual(
    (await f.call('/api/characters', { token: admin.token })).map((p) => p.xp),
    [25, 25]
  );
});
test('HTTP: seleção de campanha é independente entre conexões', async (t) => {
  const f = await fixture(t),
    a = await f.bootstrap(),
    b = await f.call('/auth/login', {
      method: 'POST',
      data: { username: 'narrador', password: 'senha-teste-123' }
    });
  const original = await f.call('/api/campaign', { token: a.token });
  const c = await f.call('/api/campaigns', {
    method: 'POST',
    token: a.token,
    data: { title: 'Outra mesa' }
  });
  await f.call('/api/campaigns/' + c.id + '/select', { method: 'POST', token: a.token });
  assert.equal((await f.call('/api/campaign', { token: a.token })).id, c.id);
  assert.equal((await f.call('/api/campaign', { token: b.token })).id, original.id);
  assert.equal(
    (await f.request('/api/campaign', { token: b.token, campaign: 'nao-existe' })).status,
    403
  );
});
test('HTTP: persistência mantém login após recriar servidor', async (t) => {
  const f = await fixture(t),
    a = await f.bootstrap();
  await f.create(a, 234567, 'jogador');
  const second = await fixture(t, f.repo);
  assert.equal((await second.call('/api/characters', { token: a.token })).length, 1);
});
test('HTTP: arquivos privados, origem indevida e controle de tempo são recusados', async (t) => {
  const f = await fixture(t),
    a = await f.bootstrap();
  assert.equal((await f.request('/api/universe', { token: a.token })).status, 404);
  assert.equal(
    (await f.request('/api/campaign', { token: a.token, origin: 'https://intruso.invalid' }))
      .status,
    403
  );
  assert.equal((await f.request('/.env')).status, 404);
  assert.equal((await f.request('/server/index.mjs')).status, 404);
  assert.equal((await f.request('/auth/logout', { token: a.token })).status, 405);
  assert.equal(
    (await f.request('/api/offline/import-player', { method: 'POST', data: {} })).status,
    404
  );
});
test('HTTP: frontend compilado é a versão 8 online', async (t) => {
  const f = await fixture(t),
    r = await f.request('/');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-Frame-Options'), 'DENY');
  assert.match(r.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.match(r.body, /runtime-config.js/);
  const js = await f.request('/assets/scripts/app.js');
  assert.equal(js.status, 200);
  assert.match(js.body, /PORTAL ONLINE/);
});

test('cliente online usa API real para login, consulta e evolução', async (t) => {
  const { RemoteClient } = await import('../../client/transport.js');
  const f = await fixture(t),
    admin = await f.bootstrap();
  await f.create(admin, 234567, 'jogador');
  // HTTP fixture exposes the origin through an authenticated response-independent server address.
  const serverAddress = (await f.request('/api/health')).body.status;
  assert.equal(serverAddress, 'ok');
  const repository = f.repo;
  const server = createPortalServer({ repository, bootstrapToken: secret });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const client = new RemoteClient('http://127.0.0.1:' + server.address().port);
  const login = await client.request('/auth/login', {
    method: 'POST',
    data: { username: 'jogador', password: 'senha-teste-123' }
  });
  const p = await client.request('/api/characters/234567', { token: login.token });
  const quote = await client.request('/api/characters/234567/upgrade-preview', {
    token: login.token,
    data: { key: 'atributes', id: p.atributes[0].id, target: 2 }
  });
  assert.equal(quote.cost, 5);
  await client.request('/api/characters/234567/upgrade', {
    method: 'POST',
    token: login.token,
    data: {
      key: 'atributes',
      id: p.atributes[0].id,
      target: 2,
      quoted_cost: quote.cost,
      confirmed: true,
      revision: p._revision
    }
  });
  assert.equal((await client.request('/api/characters/234567', { token: login.token })).xp, 15);
  const campaign = await client.request('/api/campaign', { token: admin.token });
  await client.request('/api/campaigns/' + client.campaignId, {
    method: 'DELETE',
    token: admin.token,
    data: { confirmation: campaign.title }
  });
  assert.equal(client.campaignId, null);
  const hub = await client.request('/api/portal-state', { token: admin.token });
  assert.equal(hub.campaign.id, 'no-campaign');
  assert.deepEqual(hub.campaigns, []);
});

test('HTTP: cookie persistente restaura acesso e logout o revoga', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap();
  const login = await f.request('/auth/login', {
    method: 'POST',
    data: { username: 'narrador', password: 'senha-teste-123' }
  });
  const set = login.headers.get('set-cookie');
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  assert.match(set, /Max-Age=34560000/);
  const cookie = set.split(';')[0];
  assert.equal((await f.call('/auth/me', { cookie })).account.id, admin.account.id);
  const saved = await f.repo.load();
  assert.equal(saved.root.sessions.find((s) => s.token === login.body.token).expires, null);
  assert.equal((await f.request('/auth/logout', { method: 'POST', cookie })).status, 403);
  const logout = await f.request('/auth/logout', { method: 'POST', cookie, origin: f.base });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await f.request('/auth/me', { cookie })).status, 401);
});
test('HTTP: snapshot de jogador não traz credenciais nem registros de outros acessos', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap(),
    player = await f.create(admin, 234567, 'jogador');
  const payload = await f.call('/api/portal-state', { token: player.token });
  const encoded = JSON.stringify(payload);
  assert.doesNotMatch(encoded, /"password_hash"|"sessions"|"token"|"session_version"/);
  assert.deepEqual(payload.accounts, []);
  assert.equal(payload.players.length, 1);
  const campaign = await f.call('/api/campaign', { token: player.token });
  assert.equal(campaign.accounts, undefined);
  assert.equal(campaign.sessions, undefined);
});

test('HTTP: cookie continua autorizado depois de recriar o servidor', async (t) => {
  const f = await fixture(t);
  const first = await f.request('/auth/bootstrap', {
    method: 'POST',
    data: { bootstrap_token: secret, username: 'narrador', password: 'senha-teste-123' }
  });
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const replacement = createPortalServer({ repository: f.repo, bootstrapToken: secret });
  replacement.listen(0, '127.0.0.1');
  await once(replacement, 'listening');
  t.after(() => new Promise((resolve) => replacement.close(resolve)));
  const response = await fetch('http://127.0.0.1:' + replacement.address().port + '/auth/me', {
    headers: { Cookie: cookie }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).account.id, first.body.account.id);
});
test('HTTP: presença informa só participantes da campanha', async (t) => {
  const f = await fixture(t),
    admin = await f.bootstrap(),
    player = await f.create(admin, 234567, 'jogador');
  const presence = await f.call('/api/social', { token: player.token });
  const me = presence.members.find((a) => a.id === player.account.id);
  assert.equal(me.online, true);
  assert.ok(Number.isFinite(Date.parse(me.last_seen)));
  const next = await f.call('/api/campaigns', {
    method: 'POST',
    token: admin.token,
    data: { title: 'Outra mesa' }
  });
  const isolated = await f.call('/api/social', { token: admin.token, campaign: next.id });
  assert.equal(isolated.members.length, 1);
  assert.equal(isolated.members[0].id, admin.account.id);
});
