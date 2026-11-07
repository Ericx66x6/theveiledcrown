import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture } from './fixture-v8.mjs';
import { PlayerTestSessions } from '../../server/player-test.mjs';
import { validateWorkspace } from '../../core/workspace.js';
import { newId } from '../../core/model.js';

async function fixture(options = {}) {
  const f = await portalFixture();
  const manager = new PlayerTestSessions(options);
  const root = await f.store.workspace();
  const actor = root.accounts.find((a) => a.id === f.admin.account.id);
  return {
    ...f,
    manager,
    actor,
    root,
    start: (data = {}) => manager.start(root, actor, f.admin.token, data),
    request: (id, path, method = 'GET', data = {}) =>
      manager.request(id, actor, f.admin.token, path, { method, data })
  };
}

test('teste de jogador: ficha temporária usa regras reais sem vincular personagem ao narrador', async () => {
  const f = await fixture();
  const started = await f.start({ character_id: 234567, xp: 150, money: 2000 });
  assert.equal(started.account.role, 'player');
  assert.equal(started.player_test.isolated, true);
  const id = started.player_test.id;
  const state = (await f.request(id, '/api/portal-state')).response;
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].xp, 150);
  assert.equal(state.players[0].money, 2000);
  assert.equal(state.players[0].atributes[0].value, 3);
  assert.deepEqual(state.game, f.root.campaigns[0].game);
  assert.equal(state.accounts.length, 0);
  await f.request(id, '/api/characters/234567/money', 'POST', {
    delta: '-133',
    reason: 'Teste',
    revision: 0
  });
  assert.equal((await f.request(id, '/api/characters/234567')).response.money, 1867);
  assert.deepEqual(await f.store.workspace(), f.root);
  assert.deepEqual(
    f.root.accounts.find((a) => a.id === f.actor.id).memberships,
    f.actor.memberships
  );
  const sandbox = f.manager.sessions.get(id);
  assert.equal(validateWorkspace(await sandbox.store.workspace()).campaigns.length, 1);
});

test('teste de jogador: mapa, mural e mensagens são cópias isoladas e não contêm dados pessoais de terceiros', async () => {
  const f = await fixture();
  const shared = await f.map();
  await f.map({ player_access: false, title: 'MAPA_EXCLUSIVO_DO_NARRADOR' });
  await f.call(
    '/api/notes',
    'POST',
    { title: 'PRIVADO_991', content: 'SEGREDO_PESSOAL_991', visibility: 'private' },
    f.one.token
  );
  await f.call(
    '/api/network/nodes',
    'POST',
    { character_id: 234567, name: 'MURAL_PRIVADO_991' },
    f.one.token
  );
  const root = await f.store.workspace();
  const started = await f.manager.start(root, f.actor, f.admin.token, { character_id: 234567 });
  const id = started.player_test.id;
  const state = (await f.request(id, '/api/portal-state')).response;
  assert.equal(state.campaign.maps.length, 1);
  assert.equal(state.campaign.maps[0].id, shared.id);
  assert.doesNotMatch(
    JSON.stringify(state),
    /SEGREDO_PESSOAL_991|MURAL_PRIVADO_991|MAPA_EXCLUSIVO_DO_NARRADOR/
  );
  await f.request(id, `/api/maps/${shared.id}/characters/234567`, 'PUT', {
    x: 0.8,
    y: 0.3,
    revision: 0
  });
  await f.request(id, '/api/network/nodes', 'POST', { name: 'NPC de teste', character_id: 234567 });
  const to = state.social.members.find((m) => m.id !== started.account.id).id;
  await f.request(id, '/api/social', 'POST', { kind: 'poke', to });
  assert.deepEqual(await f.store.workspace(), root);
  assert.equal((await f.request(id, '/api/network?character_id=234567')).response.nodes.length, 1);
});

test('teste de jogador: usa permissões reais de jogador e só permite seu personagem', async () => {
  const f = await fixture(),
    started = await f.start({ character_id: 234567 });
  const id = started.player_test.id;
  for (const [path, method, data] of [
    ['/api/admin/accounts', 'GET', {}],
    ['/api/characters/345678', 'GET', {}],
    ['/api/game', 'PUT', f.game],
    ['/api/characters/234567/xp', 'POST', { revision: 0, amount: 100 }],
    ['/auth/password', 'POST', { password: 'qualquer-senha-falsa' }],
    ['/api/json/workspace', 'GET', {}]
  ])
    await assert.rejects(
      () => f.request(id, path, method, data),
      (e) => e.status === 403
    );
  const state = (await f.request(id, '/api/portal-state')).response;
  const item = (await f.request(id, '/api/intel')).response[0];
  assert.equal(item.secret, undefined);
  const result = (
    await f.request(id, '/api/intel/' + item.id + '/purchase', 'POST', {
      character_id: 234567,
      character_revision: 0,
      revision: item._revision,
      quoted_xp: 5,
      quoted_money: 10,
      confirmed: true,
      request_id: newId()
    })
  ).response;
  assert.equal(result.character.xp, 95);
  assert.match(result.information.secret, /fictícia/);
  assert.equal((await f.request(id, '/api/quests')).response[0].assignees[0], 234567);
  assert.equal(state.account.role, 'player');
});

test('teste de jogador: não pode ser iniciado por jogador ou usado em outro acesso', async () => {
  const f = await fixture();
  const player = f.root.accounts.find((a) => a.id === f.one.account.id);
  await assert.rejects(
    () => f.manager.start(f.root, player, f.one.token),
    (e) => e.status === 403
  );
  const started = await f.start();
  await assert.rejects(
    () => f.manager.request(started.player_test.id, f.actor, f.two.token, '/api/portal-state'),
    (e) => e.status === 403
  );
  await assert.rejects(
    () => f.manager.request(started.player_test.id, player, f.one.token, '/api/portal-state'),
    (e) => e.status === 403
  );
  await assert.rejects(
    () => f.request(started.player_test.id, '/api/characters/234567'),
    (e) => [403, 404].includes(e.status)
  );
});

test('teste de jogador: sair, reiniciar e expirar descartam alterações e liberam a memória', async () => {
  let now = 1000;
  const f = await fixture({ now: () => now, idleMs: 5000 });
  const first = await f.start({ character_id: 234567 });
  const second = await f.start({ character_id: 234567, xp: 30 });
  await assert.rejects(
    () => f.request(first.player_test.id, '/api/portal-state'),
    (e) => e.code === 'PLAYER_TEST_EXPIRED'
  );
  assert.equal((await f.request(second.player_test.id, '/api/characters/234567')).response.xp, 30);
  now += 5001;
  await assert.rejects(
    () => f.request(second.player_test.id, '/auth/me'),
    (e) => e.status === 410
  );
  const third = await f.start();
  f.manager.end(third.player_test.id, f.actor, f.admin.token);
  assert.equal(f.manager.sessions.size, 0);
  assert.deepEqual(await f.store.workspace(), f.root);
});
