import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture } from './fixture-v8.mjs';

test('mapa: narrador cria, move e remove posições; só jogador altera o compartilhamento', async () => {
  const f = await portalFixture(),
    m = await f.map();
  const path = `/api/maps/${m.id}/characters/234567`;
  let result = await f.call(path, 'PUT', { x: 0.2, y: 0.3, revision: 0 });
  let marker = result.character_markers[0];
  assert.equal(marker.visibility, 'private');
  assert.equal(marker.updated_by, f.admin.account.id);
  assert.equal(
    (await f.call('/api/maps/' + m.id, 'GET', {}, f.two.token)).character_markers.length,
    0
  );
  result = await f.call(path, 'PATCH', { x: 0.7, y: 0.8, revision: marker._revision });
  marker = result.character_markers[0];
  assert.equal(marker.x, 0.7);
  assert.equal(marker.visibility, 'private');
  await assert.rejects(
    () => f.call(path, 'PATCH', { visibility: 'campaign', revision: marker._revision }),
    (e) => e.status === 403
  );
  await assert.rejects(
    () => f.call(path, 'PATCH', { x: 0.9, revision: 1 }),
    (e) => e.status === 409
  );
  result = await f.call(
    path,
    'PATCH',
    { visibility: 'campaign', revision: marker._revision },
    f.one.token
  );
  marker = result.character_markers[0];
  assert.equal(
    (await f.call('/api/maps/' + m.id, 'GET', {}, f.two.token)).character_markers.length,
    1
  );
  await assert.rejects(
    () => f.call(path, 'PATCH', { visibility: 'private', revision: marker._revision }),
    (e) => e.status === 403
  );
  await assert.rejects(
    () => f.call(path, 'DELETE', { revision: marker._revision }, f.two.token),
    (e) => e.status === 403
  );
  await f.call(path, 'DELETE', { revision: marker._revision });
  assert.equal((await f.call('/api/maps/' + m.id)).character_markers.length, 0);
  assert.ok((await f.call('/api/maps/' + m.id)).updated_at);
});

test('mapa: coordenadas geográficas e permissão do mapa continuam validadas', async () => {
  const f = await portalFixture();
  const m = await f.call('/api/maps', 'POST', {
    title: 'Ruas',
    mode: 'geographic',
    player_access: true
  });
  const path = `/api/maps/${m.id}/characters/345678`;
  const point = { x: 0.3, y: 0.6, lat: -23.55, lng: -46.63, revision: 0 };
  let result = await f.call(path, 'PUT', point);
  assert.equal(result.character_markers[0].lat, point.lat);
  await assert.rejects(
    () => f.call(path, 'PATCH', { lat: 91, revision: 1 }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => f.call(path, 'PATCH', { x: 0.5, revision: 1 }, f.one.token),
    (e) => e.status === 403
  );
  result = await f.call(path, 'PATCH', { lat: -24, lng: -47, revision: 1 }, f.two.token);
  assert.equal(result.character_markers[0].lat, -24);
  const current = await f.call('/api/maps/' + m.id);
  await f.call('/api/maps/' + m.id, 'PATCH', { player_access: false, revision: current._revision });
  await assert.rejects(
    () => f.call(path, 'PATCH', { x: 0.5, revision: 2 }, f.two.token),
    (e) => e.status === 403
  );
  await f.call(path, 'PATCH', { x: 0.5, revision: 2 });
});
