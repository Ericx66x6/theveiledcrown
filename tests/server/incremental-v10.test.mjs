import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture } from '../domain/fixture-v8.mjs';
import { storageDocuments, assembleStorage } from '../../server/storage-documents.mjs';
import { SupabaseRepository, Conflict } from '../../server/repository.mjs';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { sqlFixture } from './sql-fixture.mjs';
test('v10: registros separados remontam contas, sessões, mapas e históricos sem perda', async () => {
  const f = await portalFixture();
  const p = await f.player();
  await f.call(
    '/api/characters/' + p.id + '/money',
    'POST',
    { revision: p._revision, delta: 10, reason: 'teste' },
    f.one.token
  );
  const root = await f.store.workspace();
  assert.deepEqual(assembleStorage(storageDocuments(root), root.revision), root);
});
test('v10: migração preserva v4; alterações enviam só registros diferentes e sobrevivem a reinício', async (t) => {
  const f = await portalFixture(),
    s = await sqlFixture();
  t.after(() => s.close());
  const root = await f.store.workspace(),
    legacy = workspaceDocuments(root);
  legacy['__server/sessions.json'] = { sessions: root.sessions };
  await s.db.query('select public.coroa_save_state($1,$2::jsonb)', [0, JSON.stringify(legacy)]);
  const repo = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed: root,
    fetcher: s.fetcher
  });
  const loaded = await repo.load();
  assert.equal(loaded.root.accounts.length, 3);
  await repo.save(loaded.root, loaded.revision);
  const next = await repo.load();
  const store = new CampaignStore(next.root),
    service = new PortalService(store);
  const p = store.root.campaigns[0].characters[0];
  await service.request('/api/characters/' + p.id + '/money', {
    method: 'POST',
    token: f.one.token,
    data: { revision: p._revision, delta: 10, reason: 'Uma pequena mudança' }
  });
  await repo.save(await store.workspace(), next.revision);
  const write = s.calls.filter((c) => c.name === 'coroa_commit_documents').at(-1);
  assert.ok(write.upload < 50000, `${write.upload} bytes para uma alteração simples`);
  assert.equal(
    Object.keys(write.args.p_upserts).some(
      (k) => k.includes('game_data') || k === 'default_game.json'
    ),
    false
  );
  const cold = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed: root,
    fetcher: s.fetcher
  });
  const restored = await cold.load();
  assert.equal(restored.root.campaigns[0].characters[0].money, p.money + 10);
  assert.equal(restored.root.sessions[0].token, root.sessions[0].token);
  await assert.rejects(() => cold.save(restored.root, 0), Conflict);
  const before = s.calls.length;
  await cold.load();
  assert.equal(s.calls.length, before, 'leitura aquecida não baixa o portal novamente');
  await cold.load({ fresh: true });
  const poll = s.calls.at(-1);
  assert.ok(poll.download < 100);
});
test('v10: outra instância observa patches e exclusões, e gravação com revisão antiga é recusada', async (t) => {
  const f = await portalFixture(),
    s = await sqlFixture();
  t.after(() => s.close());
  const seed = await f.store.workspace();
  const make = () =>
    new SupabaseRepository({
      url: 'https://example.supabase.co',
      key: 'sb_secret_test',
      seed,
      fetcher: s.fetcher,
      cacheMs: 0
    });
  const a = make(),
    b = make();
  await a.load();
  await a.save(seed, 0);
  const initial = await b.load();
  const changed = structuredClone(initial.root);
  changed.campaigns[0].notes.push({
    id: 'a-note',
    title: 'Nova nota',
    content: 'teste',
    visibility: 'campaign',
    tags: '',
    created_by: f.admin.account.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _revision: 1
  });
  await a.save(changed, initial.revision);
  await assert.rejects(() => b.save(initial.root, initial.revision), Conflict);
  const after = await b.load({ fresh: true });
  assert.equal(after.root.campaigns[0].notes[0].id, 'a-note');
  after.root.campaigns[0].notes = [];
  await b.save(after.root, after.revision);
  assert.equal((await a.load({ fresh: true })).root.campaigns[0].notes.length, 0);
});
test('v10: RPCs de desempenho continuam bloqueadas para anon e authenticated; migração é idempotente', async (t) => {
  const s = await sqlFixture();
  t.after(() => s.close());
  const { readFile } = await import('node:fs/promises');
  await s.db.exec('reset role');
  await s.db.exec(
    await readFile(
      new URL('../../supabase/migrations/202611080001_incremental_v10.sql', import.meta.url),
      'utf8'
    )
  );
  for (const role of ['anon', 'authenticated']) {
    await s.db.exec('reset role;set role ' + role);
    for (const query of [
      'select public.coroa_poll_state(-1)',
      `select public.coroa_commit_documents(0,'{}','[]')`,
      'select * from public.coroa_deleted_documents'
    ])
      await assert.rejects(
        () => s.db.query(query),
        (e) => e.code === '42501'
      );
  }
});
test('v10: primeira gravação após reinício não reenvia regras por causa da ordem das chaves JSONB', async (t) => {
  const f = await portalFixture(),
    s = await sqlFixture();
  t.after(() => s.close());
  const seed = await f.store.workspace();
  const make = () =>
    new SupabaseRepository({
      url: 'https://example.supabase.co',
      key: 'sb_secret_test',
      seed,
      fetcher: s.fetcher
    });
  const a = make();
  await a.load();
  await a.save(seed, 0);
  const b = make(),
    loaded = await b.load();
  loaded.root.campaigns[0].characters[0].money += 1;
  await b.save(loaded.root, loaded.revision);
  const write = s.calls.at(-1);
  assert.equal(write.name, 'coroa_commit_documents');
  assert.equal(
    Object.keys(write.args.p_upserts).some(
      (p) => p.includes('game_data') || p === 'default_game.json'
    ),
    false
  );
  assert.ok(write.upload < 20000);
});
test('v10: falha antes do commit não confirma gravação; resposta perdida não repete crédito', async (t) => {
  const f = await portalFixture(),
    s = await sqlFixture();
  t.after(() => s.close());
  const seed = await f.store.workspace();
  let failure;
  const fetcher = async (url, options) => {
    if (url.endsWith('/coroa_commit_documents') && failure) {
      const kind = failure;
      failure = null;
      if (kind === 'after') await s.fetcher(url, options);
      throw new Error('rede interrompida');
    }
    return s.fetcher(url, options);
  };
  const repo = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed,
    fetcher
  });
  await repo.load();
  await repo.save(seed, 0);
  const initial = await repo.load(),
    changed = structuredClone(initial.root),
    balance = changed.campaigns[0].characters[0].money;
  changed.campaigns[0].characters[0].money += 50;
  failure = 'before';
  await assert.rejects(
    () => repo.save(changed, initial.revision),
    (e) => e.status === 503
  );
  assert.equal((await repo.load()).root.campaigns[0].characters[0].money, balance);
  failure = 'after';
  await assert.rejects(
    () => repo.save(changed, initial.revision),
    (e) => e.status === 503
  );
  const recovered = await repo.load();
  assert.equal(recovered.root.campaigns[0].characters[0].money, balance + 50);
  assert.equal(recovered.revision, initial.revision + 1);
  await assert.rejects(() => repo.save(changed, initial.revision), Conflict);
});
test('v10: conversão de retorno preserva dados mais recentes e sessões no formato anterior', async (t) => {
  const f = await portalFixture(),
    s = await sqlFixture();
  t.after(() => s.close());
  const seed = await f.store.workspace();
  const repo = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed,
    fetcher: s.fetcher
  });
  await repo.load();
  await repo.save(seed, 0);
  const loaded = await repo.load();
  loaded.root.campaigns[0].characters[0].money += 123;
  await repo.save(loaded.root, loaded.revision);
  const latest = await repo.load();
  await repo.saveLegacy(latest.root, latest.revision);
  const raw = (await s.db.query('select public.coroa_load_state() as state')).rows[0].state;
  assert.notEqual(raw.documents['portal.json'].format, 'coroa-storage-v10');
  const restored = assembleDocuments(raw.documents);
  assert.equal(
    restored.campaigns[0].characters[0].money,
    latest.root.campaigns[0].characters[0].money
  );
  assert.deepEqual(raw.documents['__server/sessions.json'].sessions, latest.root.sessions);
  assert.equal(
    (await repo.load()).root.campaigns[0].characters[0].money,
    latest.root.campaigns[0].characters[0].money
  );
});
test('v10: instalação sem a nova RPC recebe instrução de migração, sem criar dados vazios', async () => {
  const repo = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed: {},
    fetcher: async () => Response.json({ code: 'PGRST202' }, { status: 404 })
  });
  await assert.rejects(
    () => repo.load(),
    (e) => e.code === 'MIGRATION_REQUIRED' && e.status === 503
  );
  assert.equal(repo.cache, null);
});
