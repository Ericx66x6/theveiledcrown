import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { portalFixture } from '../domain/fixture-v8.mjs';
import { createPortalServer } from '../../server/app.mjs';
import { MemoryRepository } from '../../server/repository.mjs';
import { RemoteClient } from '../../client/transport.js';

async function fixture(t) {
  const f = await portalFixture();
  const map = await f.map();
  const source = await f.store.workspace();
  const repository = new MemoryRepository(source);
  const server = createPortalServer({
    repository,
    bootstrapToken: 'instalacao-ficticia-testes-v91-123456789'
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (
    path,
    { method = 'GET', data, token = f.admin.token, testId, campaign, cookie } = {}
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie
          ? { Cookie: cookie, Origin: base, 'X-Portal-Session': 'cookie' }
          : { Authorization: 'Bearer ' + token }),
        ...(testId ? { 'X-Player-Test': testId } : {}),
        ...(campaign ? { 'X-Campaign-ID': campaign } : {})
      },
      body: method === 'GET' ? undefined : JSON.stringify(data || {})
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return { ...f, map, source, repository, base, request };
}

test('HTTP 10.1: relatos, feedbacks e vínculos do jogador de testes não alteram a campanha real', async (t) => {
  const f = await fixture(t);
  await f.request('/api/feedbacks', {
    method: 'POST',
    token: f.one.token,
    data: {
      kind: 'idea',
      title: 'Feedback real reservado',
      content: 'Uma contribuição do jogador original para a campanha.'
    }
  });
  await f.request('/api/documents', {
    method: 'POST',
    data: {
      title: 'Carta reservada real',
      kind: 'letter',
      body: 'Conteúdo fora do teste.',
      access: 'restricted',
      account_ids: [f.one.account.id]
    }
  });
  const before = await f.repository.load();
  const started = await f.request('/api/player-test', {
    method: 'POST',
    data: { campaign_id: f.campaign, character_id: 234567 }
  });
  const scope = { testId: started.body.player_test.id, campaign: started.body.campaign_id };
  const portal = await f.request('/api/portal-state', scope);
  assert.deepEqual(portal.body.campaign.feedbacks, []);
  assert.deepEqual(portal.body.campaign.documents, []);
  assert.deepEqual(portal.body.campaign.recaps, []);
  for (const [path, data] of [
    ['/api/recaps', { character_id: 234567, scene: 'Uma lembrança somente de teste.' }],
    [
      '/api/feedbacks',
      {
        kind: 'bug',
        title: 'Teste isolado',
        content: 'Um relato fictício de problema no modo de testes.'
      }
    ],
    [
      '/api/characters/234567/blood-bonds',
      {
        name: 'Vínculo de testes',
        direction: 'holds',
        stage: 'fervor',
        level: 2,
        character_revision: 0,
        confirmed: true
      }
    ]
  ]) {
    const result = await f.request(path, { ...scope, method: 'POST', data });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  assert.equal((await f.request('/api/feedbacks', scope)).body.length, 1);
  assert.deepEqual(await f.repository.load(), before);
  await f.request('/api/player-test', { ...scope, method: 'DELETE' });
  assert.deepEqual(await f.repository.load(), before);
});

test('HTTP: modo jogador não grava no Supabase, usa permissões de jogador e restaura o narrador', async (t) => {
  const f = await fixture(t);
  const started = await f.request('/api/player-test', {
    method: 'POST',
    data: { campaign_id: f.campaign, character_id: 234567 }
  });
  assert.equal(started.status, 200);
  assert.equal(started.body.account.role, 'player');
  assert.equal(started.headers.get('set-cookie'), null);
  const testId = started.body.player_test.id,
    campaign = started.body.campaign_id;
  let state = await f.request('/api/portal-state', { testId, campaign });
  assert.equal(state.body.account.role, 'player');
  assert.equal(state.body.players[0].xp, 100);
  assert.equal((await f.request('/api/admin/accounts', { testId, campaign })).status, 403);
  assert.equal((await f.request('/api/characters/345678', { testId, campaign })).status, 403);
  assert.equal(
    (
      await f.request('/api/characters/234567/money', {
        method: 'POST',
        testId,
        campaign,
        data: { delta: '-133', revision: 0 }
      })
    ).body.money,
    867
  );
  assert.equal(
    (
      await f.request(`/api/maps/${f.map.id}/characters/234567`, {
        method: 'PUT',
        testId,
        campaign,
        data: { x: 0.7, y: 0.8, revision: 0 }
      })
    ).status,
    200
  );
  assert.deepEqual((await f.repository.load()).root, f.source);
  assert.equal((await f.repository.load()).revision, 0);
  const me = await f.request('/auth/me', { testId, campaign });
  assert.equal(me.body.account.role, 'player');
  assert.equal(me.body.campaign_id, campaign);
  const ended = await f.request('/api/player-test', {
    method: 'DELETE',
    testId,
    campaign,
    data: { campaign_id: f.campaign }
  });
  assert.equal(ended.body.account.role, 'admin');
  assert.equal(ended.body.account.character_ids.length, 0);
  assert.equal(ended.body.campaign_id, f.campaign);
  assert.equal(ended.headers.get('set-cookie'), null);
  const expired = await f.request('/api/portal-state', { testId, campaign });
  assert.equal(expired.status, 410);
  assert.equal(expired.body.code, 'PLAYER_TEST_EXPIRED');
  assert.equal((await f.request('/auth/me')).body.account.role, 'admin');
});

test('HTTP: cookie do narrador permanece no teste e sair encerra o acesso real', async (t) => {
  const f = await fixture(t);
  const cookie = 'coroa_session=' + f.admin.token;
  const started = await f.request('/api/player-test', { method: 'POST', cookie });
  assert.equal(started.status, 200);
  const testId = started.body.player_test.id,
    campaign = started.body.campaign_id;
  const me = await f.request('/auth/me', { cookie, testId, campaign });
  assert.equal(me.body.account.role, 'player');
  assert.match(me.headers.get('set-cookie'), new RegExp(f.admin.token));
  assert.equal(
    (
      await f.request('/auth/password', {
        method: 'POST',
        cookie,
        testId,
        campaign,
        data: { current_password: 'senha-teste-123', password: 'senha-diferente-123' }
      })
    ).status,
    403
  );
  const signedOut = await f.request('/auth/logout', { method: 'POST', cookie, testId, campaign });
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await f.request('/auth/me', { cookie })).status, 401);
});

test('HTTP: jogador não inicia ou usa teste alheio; a aba normal continua narrador', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request('/api/player-test', { method: 'POST', token: f.one.token })).status,
    403
  );
  const r = await f.request('/api/player-test', { method: 'POST' });
  const testId = r.body.player_test.id;
  assert.equal((await f.request('/api/portal-state', { testId, token: f.one.token })).status, 403);
  const secondLogin = await f.request('/auth/login', {
    method: 'POST',
    data: { username: 'narrador', password: 'senha-teste-123' }
  });
  assert.equal(
    (await f.request('/api/portal-state', { testId, token: secondLogin.body.token })).status,
    403
  );
  assert.equal((await f.request('/api/portal-state')).body.account.role, 'admin');
  assert.equal((await f.request('/api/portal-state')).body.players.length, 2);
});

test('HTTP: transporte envia contexto separado e sair não troca a sessão autenticada', async (t) => {
  const f = await fixture(t),
    client = new RemoteClient(f.base);
  client.campaignId = f.campaign;
  const call = (path, method = 'GET', data) =>
    client.request(path, { method, data, token: f.admin.token });
  const started = await call('/api/player-test', 'POST', { character_id: 234567 });
  client.playerTestId = started.player_test.id;
  assert.equal((await call('/auth/me')).account.role, 'player');
  assert.equal((await call('/api/portal-state')).players[0].xp, 100);
  await call('/api/player-test', 'DELETE', { campaign_id: f.campaign });
  client.playerTestId = null;
  assert.equal((await call('/auth/me')).account.role, 'admin');
  assert.equal((await call('/api/characters/234567')).xp, 80);
});

test('transporte: resposta antiga não pode restaurar contexto depois de trocar de visão', async (t) => {
  let finish;
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const client = new RemoteClient('https://coroa.example');
  client.playerTestId = 'teste-antigo';
  client.campaignId = 'campanha-antiga';
  const pending = client.request('/auth/me');
  client.playerTestId = null;
  client.campaignId = 'campanha-real';
  finish(
    new Response(JSON.stringify({ account: { role: 'player' }, campaign_id: 'campanha-antiga' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Portal-Revision': '999' }
    })
  );
  await assert.rejects(pending, (e) => e.code === 'PLAYER_TEST_CONTEXT_CHANGED');
  assert.equal(client.campaignId, 'campanha-real');
  assert.equal(client.store.remoteRevision, 0);
});
