import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { portalFixture, image } from '../domain/fixture-v8.mjs';
import { sqlFixture } from './sql-fixture.mjs';
import { SupabaseRepository } from '../../server/repository.mjs';
import { SupabaseMedia } from '../../server/media.mjs';
import { createPortalServer } from '../../server/app.mjs';
import { storageDocuments, assembleStorage } from '../../server/storage-documents.mjs';
import { validateWorkspace } from '../../core/workspace.js';
async function fixture(t) {
  const f = await portalFixture(),
    sql = await sqlFixture(),
    objects = new Map();
  t.after(() => sql.close());
  const storage = async (url, options) => {
    const path = new URL(url).pathname;
    if (options.method === 'POST') {
      objects.set(path, Buffer.from(options.body));
      return Response.json({ ok: true });
    }
    return objects.has(path) ? new Response(objects.get(path)) : new Response('', { status: 404 });
  };
  const media = () =>
    new SupabaseMedia({
      url: 'https://example.supabase.co',
      key: 'sb_secret_test',
      fetcher: storage
    });
  const seed = await f.store.workspace(),
    make = () =>
      new SupabaseRepository({
        url: 'https://example.supabase.co',
        key: 'sb_secret_test',
        seed,
        media: media(),
        fetcher: sql.fetcher
      });
  const repo = make();
  await repo.load();
  await repo.save(seed, 0);
  const server = createPortalServer({
    repository: repo,
    bootstrapToken: 'qa-cronica-ficticia-01234567890123456789'
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((r) => server.close(r)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, method = 'GET', data = {}, token = f.admin.token) => {
    const url = new URL(base + path);
    if (method === 'GET' && Object.keys(data).length)
      url.searchParams.set('data', JSON.stringify(data));
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Coroa-Client': '10',
        Authorization: 'Bearer ' + token,
        'X-Campaign-ID': f.campaign
      },
      body: method === 'GET' ? undefined : JSON.stringify(data)
    });
  };
  const call = async (...args) => {
    const r = await request(...args),
      body = await r.json();
    assert.equal(r.status, 200, JSON.stringify(body));
    return body;
  };
  return { ...f, repo, sql, make, request, call };
}
test('10.1 HTTP: documento restrito e imagem continuam privados; revogar bloqueia mesmo com cache', async (t) => {
  const f = await fixture(t);
  let d = await f.call('/api/documents', 'POST', {
    title: 'A carta escondida',
    kind: 'letter',
    body: 'SEGREDO_DOCUMENTAL_101: procure o livro no cais.',
    image,
    access: 'restricted',
    account_ids: [f.one.account.id]
  });
  assert.match(d.image, /^\/api\/media\//);
  assert.equal((await f.request('/api/documents/' + d.id, 'GET', {}, f.two.token)).status, 404);
  assert.equal((await f.request(d.image, 'GET', {}, f.two.token)).status, 403);
  assert.equal((await f.request(d.image, 'GET', {}, f.one.token)).status, 200);
  const other = await f.call('/api/portal-state', 'GET', {}, f.two.token);
  assert.equal(JSON.stringify(other).includes('SEGREDO_DOCUMENTAL_101'), false);
  const ref = f.repo.media.resolve(d.image);
  assert.equal(
    (
      await f.request(
        '/api/media/portable',
        'POST',
        { document: { _coroa_media: ref } },
        f.two.token
      )
    ).status,
    403
  );
  d = await f.call('/api/documents/' + d.id, 'PATCH', {
    ...d,
    revision: d._revision,
    account_ids: []
  });
  assert.equal((await f.request(d.image, 'GET', {}, f.one.token)).status, 403);
  const backup = await f.call('/api/json/workspace');
  assert.equal(backup.campaigns[0].documents[0].image, image);
  assert.ok(validateWorkspace(backup));
});
test('10.1 HTTP/SQL: feedback, laço e feito sobrevivem a reinício; backup de outro jogador exclui conteúdo alheio', async (t) => {
  const f = await fixture(t);
  let feedback = await f.call(
    '/api/feedbacks',
    'POST',
    {
      kind: 'idea',
      title: 'Sugestão reservada',
      content: 'FEEDBACK_PRIVADO_101: gostei das consequências da negociação.'
    },
    f.one.token
  );
  const p = await f.call('/api/characters/234567');
  feedback = await f.call('/api/feedbacks/' + feedback.id + '/review', 'POST', {
    revision: feedback._revision,
    xp: 3,
    character_id: p.id,
    character_revision: p._revision,
    confirmed: true,
    reply: 'Obrigado por explicar a consequência.'
  });
  const rewarded = await f.call('/api/characters/234567');
  await f.call(
    '/api/characters/234567/blood-bonds',
    'POST',
    {
      name: 'O guardião',
      direction: 'holds',
      stage: 'echo',
      level: 2,
      description: 'VÍNCULO_PRIVADO_101',
      image,
      character_revision: rewarded._revision,
      confirmed: true
    },
    f.one.token
  );
  const grant = {
    account_id: f.one.account.id,
    request_id: 'feito_http_101_unico',
    name: 'Uma voz na escuridão',
    icon: '👑',
    description: 'O jogador ajudou a mesa.',
    confirmed: true
  };
  await f.call('/api/achievements', 'POST', grant);
  await f.call('/api/achievements', 'POST', grant);
  const gallery = await f.call('/api/achievements', 'GET', {}, f.one.token);
  assert.equal(gallery.entries.length, 1);
  assert.equal(gallery.events.length, 1);
  const cold = await f.make().load({ fresh: true }),
    account = cold.root.accounts.find((a) => a.id === f.one.account.id);
  assert.equal(cold.root.campaigns[0].characters[0].xp, p.xp + 3);
  assert.equal(cold.root.campaigns[0].characters[0].blood_bonds[0].name, 'O guardião');
  assert.equal(account.achievements.length, 1);
  assert.equal(
    account.reward_events.some((e) => e.kind === 'achievement' && !e.seen_at),
    true
  );
  const own = await f.call('/api/json/player', 'GET', {}, f.one.token);
  assert.ok(validateWorkspace(own));
  assert.equal(own.campaigns[0].characters[0].blood_bonds[0].image, image);
  const other = await f.call('/api/json/player', 'GET', {}, f.two.token);
  const json = JSON.stringify(other);
  assert.equal(json.includes('FEEDBACK_PRIVADO_101'), false);
  assert.equal(json.includes('VÍNCULO_PRIVADO_101'), false);
  assert.equal(json.includes('Uma voz na escuridão'), false);
  await f.repo.saveLegacy(cold.root, cold.revision);
  const converted = await f.make().load({ fresh: true });
  assert.equal(converted.root.campaigns[0].feedbacks[0].reward.xp, 3);
  assert.equal(converted.root.campaigns[0].characters[0].blood_bonds[0].name, 'O guardião');
  assert.equal(
    converted.root.accounts.find((a) => a.id === f.one.account.id).achievements[0].name,
    'Uma voz na escuridão'
  );
  assert.ok(validateWorkspace(converted.root));
});
test('10.1 codec lê armazenamento 10.0 real e mantém novos registros com ID index sem colidir com índices', async () => {
  const old = JSON.parse(
      await readFile(new URL('../fixtures/storage-v10.json', import.meta.url), 'utf8')
    ),
    root = assembleStorage(old.documents, old.revision);
  assert.equal(root.accounts[0].display_name, 'Jogador anterior');
  assert.equal(root.sessions[0].token, old.root.sessions[0].token);
  assert.equal(root.campaigns[0].characters[0].xp, 17);
  assert.equal(root.campaigns[0].characters[0].history[0].details, 'Não perder esta memória.');
  root.campaigns[0].recaps = [
    { id: 'index', title: 'Não pode substituir um índice', character_id: 234567 }
  ];
  root.accounts[0].achievements = [{ id: 'index', name: 'Marca anterior' }];
  const next = assembleStorage(storageDocuments(root), 8);
  assert.equal(next.campaigns[0].recaps[0].title, 'Não pode substituir um índice');
  assert.equal(next.accounts[0].achievements[0].name, 'Marca anterior');
});
