import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { portalFixture, image } from '../domain/fixture-v8.mjs';
import { createPortalServer } from '../../server/app.mjs';
import { MemoryRepository } from '../../server/repository.mjs';
import { RemoteClient } from '../../client/transport.js';
import { newId } from '../../core/model.js';
test('HTTP v9: compras, ambição, enquadramento, posição, desafio e edição completa atravessam a API HTTP', async (t) => {
  const f = await portalFixture(),
    server = createPortalServer({
      repository: new MemoryRepository(await f.store.workspace()),
      bootstrapToken: 'instalacao-ficticia-testes-http-123456789'
    });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const client = new RemoteClient('http://127.0.0.1:' + server.address().port);
  client.campaignId = f.campaign;
  const gm = (path, method = 'GET', data) =>
      client.request(path, { method, data, token: f.admin.token }),
    pc = (path, method = 'GET', data) => client.request(path, { method, data, token: f.one.token });
  const entry = await gm('/api/intel', 'POST', {
    title: 'Pista pelo HTTP',
    category: 'Pista',
    xp_cost: 7,
    money_cost: 200,
    secret: 'Somente após investigar.',
    images: []
  });
  assert.equal((await pc('/api/intel/' + entry.id)).secret, undefined);
  let p = await pc('/api/characters/234567');
  const purchase = {
    character_id: p.id,
    character_revision: p._revision,
    revision: entry._revision,
    quoted_xp: 7,
    quoted_money: 200,
    request_id: newId(),
    confirmed: true
  };
  const bought = await pc('/api/intel/' + entry.id + '/purchase', 'POST', purchase);
  assert.equal(bought.character.xp, 73);
  assert.equal(bought.character.money, 1000);
  assert.equal((await pc('/api/intel/' + entry.id + '/purchase', 'POST', purchase)).replayed, true);
  const g = await gm('/api/game');
  g.discipline_market.allowed_ids = [0];
  g._expected_revision = g._revision;
  await gm('/api/game', 'PUT', g);
  p = await pc('/api/characters/234567');
  assert.equal(
    (
      await pc('/api/discipline-market/0/acquire', 'POST', {
        character_id: p.id,
        character_revision: p._revision,
        quoted_cost: 10,
        confirmed: true,
        request_id: newId()
      })
    ).character.disciplines[0].nivel,
    0
  );
  const map = await gm('/api/maps', 'POST', {
    title: 'Mapa HTTP',
    image,
    width: 1000,
    height: 500,
    player_access: true
  });
  await pc(`/api/maps/${map.id}/characters/234567`, 'PUT', { revision: 0, x: 0.3, y: 0.4 });
  assert.equal((await gm('/api/maps/' + map.id)).character_markers.length, 1);
  const challenge = await pc('/api/social', 'POST', {
    kind: 'challenge',
    to: f.admin.account.id,
    choice: 'rock'
  });
  const pending = await gm('/api/social');
  assert.equal(pending.posts[0].choices, undefined);
  assert.equal(
    (await gm('/api/social/' + challenge.id + '/respond', 'POST', { choice: 'paper' })).result,
    'recipient'
  );
  p = await pc('/api/characters/234567');
  p.atributes[0].value = 4;
  const full = await gm('/api/characters/234567/full', 'PUT', {
    revision: p._revision,
    character: p,
    log_message: 'Revisão por HTTP.'
  });
  assert.match(full.history.at(-1).details, /FORÇA: 3 → 4/);
  assert.match(full.history.at(-1).details, /Revisão por HTTP/);
  p = await pc('/api/characters/234567');
  p = await pc('/api/characters/234567', 'PATCH', {
    revision: p._revision,
    patch: {
      aspirations: { ambition: 'Ganhar a corte', desire: 'Ler a carta' },
      portrait_frame: { x: 20, y: 70, zoom: 1.4 }
    }
  });
  const resolved = await pc('/api/characters/234567/aspiration', 'POST', {
    revision: p._revision,
    kind: 'desire',
    outcome: 'complete',
    confirmed: true
  });
  assert.equal(resolved.aspirations.desire, '');
  assert.equal(resolved.aspirations.ambition, 'Ganhar a corte');
  assert.equal(resolved.portrait_frame.zoom, 1.4);
});
