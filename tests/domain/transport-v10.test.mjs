import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteClient } from '../../client/transport.js';
test('v10 transporte: só inclui visão incremental depois de negociar com backend compatível', async (t) => {
  const original = globalThis.fetch,
    calls = [];
  t.after(() => (globalThis.fetch = original));
  let protocol = false;
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json(
      { ok: true },
      { headers: protocol ? { 'X-Coroa-Protocol': '10', 'X-Portal-Revision': '7' } : {} }
    );
  };
  const client = new RemoteClient('https://example.test');
  client.viewCache = { known_account_id: 'one' };
  await client.request('/api/game', { method: 'PUT', data: { name: 'Regras atuais' } });
  assert.deepEqual(calls[0], { name: 'Regras atuais' });
  protocol = true;
  await client.request('/api/game', { method: 'PUT', data: { name: 'Regras atuais' } });
  assert.equal(
    calls[1].__portal_view,
    undefined,
    'a negociação usa a resposta, sem presumir protocolo novo'
  );
  await client.request('/api/game', { method: 'PUT', data: { name: 'Regras atuais' } });
  assert.deepEqual(calls[2].__portal_view, client.viewCache);
  assert.equal(client.store.remoteRevision, 7);
});
