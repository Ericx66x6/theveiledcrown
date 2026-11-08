import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { portalFixture } from '../domain/fixture-v8.mjs';
import { createPortalServer } from '../../server/app.mjs';
import { MemoryRepository } from '../../server/repository.mjs';
test('HTTP: cadastro sem sessão, aprovação restrita e presença persistem entre requisições', async (t) => {
  const f = await portalFixture(),
    repo = new MemoryRepository(await f.store.workspace()),
    server = createPortalServer({
      repository: repo,
      bootstrapToken: 'chave-ficticia-testes-0123456789'
    });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, method = 'GET', data, token) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token, 'X-Campaign-ID': f.campaign } : {})
      },
      body: method === 'GET' ? undefined : JSON.stringify(data || {})
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')
    };
  };
  const data = {
    username: 'novo-http',
    display_name: 'Novo jogador',
    password: 'senha-ficticia-123'
  };
  assert.equal((await request('/auth/status')).body.registration_open, true);
  const registered = await request('/auth/register', 'POST', data);
  assert.equal(registered.status, 200);
  assert.equal(registered.cookie, null);
  assert.equal(registered.body.status, 'pending');
  assert.equal((await request('/auth/login', 'POST', data)).status, 403);
  assert.equal((await request('/api/admin/registrations')).status, 401);
  const row = (await request('/api/admin/registrations', 'GET', null, f.admin.token)).body.find(
    (a) => a.username === data.username
  );
  assert.equal(
    (
      await request(
        `/api/admin/registrations/${row.id}/approve`,
        'POST',
        { revision: 1, campaign_ids: [f.campaign] },
        f.one.token
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request(
        `/api/admin/registrations/${row.id}/approve`,
        'POST',
        { revision: 1, campaign_ids: [f.campaign] },
        f.admin.token
      )
    ).status,
    200
  );
  const login = await request('/auth/login', 'POST', data);
  assert.equal(login.status, 200);
  assert.match(login.cookie, /HttpOnly/);
  const token = login.body.token;
  const first = await request('/api/rewards/check-in', 'POST', {}, token),
    again = await request('/api/rewards/check-in', 'POST', {}, token);
  assert.equal(first.status, 200);
  assert.equal(first.body.streak, 1);
  assert.equal(again.body.streak, 1);
  const ids = first.body.events.map((e) => e.id);
  assert.ok(ids.length);
  assert.equal((await request('/api/rewards/ack', 'POST', { ids }, token)).status, 200);
  assert.equal((await request('/api/rewards', 'GET', null, token)).body.events.length, 0);
  const root = (await repo.load()).root;
  assert.equal(root.accounts.find((a) => a.id === row.id).registration.status, 'approved');
  assert.equal(root.accounts.find((a) => a.id === row.id).login_rewards[f.campaign].streak, 1);
});
