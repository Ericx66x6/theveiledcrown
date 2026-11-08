import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { SupabaseRepository, Conflict } from '../../server/repository.mjs';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { documentSeed } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
async function seed() {
  return new CampaignStore(documentSeed(game)).workspace();
}
test('SQL real: migração, permissões e transação de documentos com revisão', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const migration = await readFile(
    new URL('../../supabase/migrations/202611010001_portal_json.sql', import.meta.url),
    'utf8'
  );
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(
    `create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id text primary key,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects,storage.buckets to anon,authenticated,service_role;create policy legacy_all on storage.objects for all to anon,authenticated using(true) with check(true);`
  );
  const imageMigration = await readFile(
    new URL('../../supabase/migrations/202611020002_private_images.sql', import.meta.url),
    'utf8'
  );
  await db.exec(imageMigration);
  await db.exec(imageMigration);
  await db.exec(
    `insert into storage.objects values('protected','coroa-imagens'),('legacy','imagens-antigas');set role anon;`
  );
  assert.deepEqual((await db.query('select id from storage.objects')).rows, [{ id: 'legacy' }]);
  await assert.rejects(
    () => db.query("insert into storage.objects values('intruder','coroa-imagens')"),
    (e) => e.code === '42501'
  );
  await db.exec('reset role');
  const installer = await readFile(new URL('../../supabase/INSTALAR.sql', import.meta.url), 'utf8');
  await db.exec(installer);
  await db.exec(installer);

  const docs = {
    'portal.json': { format: 'test' },
    'accounts.json': { accounts: [] },
    'campaigns/uma/character.json': { xp: 5 }
  };
  await db.exec('set role service_role');
  const save = async (expected, value) =>
    Number(
      (
        await db.query('select public.coroa_save_state($1,$2::jsonb) as revision', [
          expected,
          JSON.stringify(value)
        ])
      ).rows[0].revision
    );
  assert.equal(await save(0, docs), 1);
  await assert.rejects(
    () => save(0, { ...docs, 'accounts.json': { corrupt: true } }),
    (e) => e.code === '40001'
  );
  const state = (await db.query('select public.coroa_load_state() as value')).rows[0].value;
  assert.equal(state.revision, 1);
  assert.deepEqual(state.documents['accounts.json'], { accounts: [] });
  assert.equal(await save(1, { 'portal.json': {}, 'accounts.json': {} }), 2);
  assert.equal(
    (await db.query('select count(*)::int as n from public.coroa_documents')).rows[0].n,
    2
  );
  for (const role of ['anon', 'authenticated']) {
    await db.exec('reset role; set role ' + role);
    await assert.rejects(
      () => db.query('select public.coroa_load_state()'),
      (e) => e.code === '42501'
    );
    await assert.rejects(
      () => db.query('select * from public.coroa_documents'),
      (e) => e.code === '42501'
    );
    await assert.rejects(
      () => save(2, docs),
      (e) => e.code === '42501'
    );
  }
});
test('adaptador Supabase atravessa as funções SQL e preserva contas, sessões e JSONs', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/202611010001_portal_json.sql', import.meta.url),
      'utf8'
    )
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/202611080001_incremental_v10.sql', import.meta.url),
      'utf8'
    )
  );
  await db.exec('set role service_role');
  const initial = await seed();
  const fetcher = async (url, options) => {
    assert.equal(options.headers.apikey, 'sb_secret_test');
    assert.equal(options.headers.Authorization, undefined);
    const args = JSON.parse(options.body);
    try {
      const name = new URL(url).pathname.split('/').at(-1);
      const q =
        name === 'coroa_poll_state'
          ? await db.query('select public.coroa_poll_state($1) as result', [args.p_known_revision])
          : name === 'coroa_commit_documents'
            ? await db.query(
                'select public.coroa_commit_documents($1,$2::jsonb,$3::jsonb) as result',
                [
                  args.p_expected_revision,
                  JSON.stringify(args.p_upserts),
                  JSON.stringify(args.p_deleted_paths)
                ]
              )
            : name === 'coroa_load_state'
              ? await db.query('select public.coroa_load_state() as result')
              : await db.query('select public.coroa_save_state($1,$2::jsonb) as result', [
                  args.p_expected_revision,
                  JSON.stringify(args.p_documents)
                ]);
      return new Response(JSON.stringify(q.rows[0].result), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ code: e.code }), {
        status: e.code === '40001' ? 409 : 500
      });
    }
  };
  const repository = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed: initial,
    fetcher
  });
  assert.equal((await repository.load()).root.accounts.length, 0);
  const store = new CampaignStore(initial),
    service = new PortalService(store);
  const auth = await service.request('/auth/bootstrap', {
    method: 'POST',
    data: { username: 'narrador', password: 'senha-de-teste-123', display_name: 'Narrador' }
  });
  const entry = await service.request('/api/intel', {
    method: 'POST',
    token: auth.token,
    data: {
      title: 'Uma pista persistida',
      teaser: 'Apresentação pública',
      category: 'Pista',
      xp_cost: 7,
      money_cost: 2.5,
      secret: 'Somente depois de investigar.',
      images: []
    }
  });
  const registration = {
    username: 'jogador-persistido',
    display_name: 'Pessoa de teste',
    password: 'senha-ficticia-123'
  };
  await service.request('/auth/register', { method: 'POST', data: registration });
  const pending = (await service.request('/api/admin/registrations', { token: auth.token }))[0];
  await service.request(`/api/admin/registrations/${pending.id}/approve`, {
    method: 'POST',
    token: auth.token,
    data: { revision: 1, campaign_ids: [store.root.active_campaign_id] }
  });
  const login = await service.request('/auth/login', { method: 'POST', data: registration });
  const book = await service.request('/api/game', { token: auth.token });
  await service.request('/api/game', {
    method: 'PUT',
    token: auth.token,
    data: {
      ...book,
      _expected_revision: book._revision,
      login_rewards: { ...book.login_rewards, days: 1, xp: 2 }
    }
  });
  await service.request('/api/rewards/check-in', { method: 'POST', token: login.token, data: {} });
  await service.request('/auth/register', {
    method: 'POST',
    data: { ...registration, username: 'aguardando-aprovacao' }
  });
  await repository.save(await store.workspace(), 0);
  const loaded = await repository.load();
  assert.equal(loaded.root.accounts[0].username, 'narrador');
  assert.equal(loaded.root.campaigns[0].intel[0].id, entry.id);
  assert.equal(loaded.root.campaigns[0].intel[0].secret, 'Somente depois de investigar.');
  assert.equal(loaded.root.sessions[0].token, auth.token);
  const persisted = loaded.root.accounts.find((a) => a.id === pending.id);
  assert.equal(persisted.registration.status, 'approved');
  const track = persisted.login_rewards[loaded.root.active_campaign_id];
  assert.equal(track.streak, 1);
  assert.equal(track.credits[0].xp, 2);
  assert.equal(track.credits[0].claimed_at, null);
  assert.equal(persisted.reward_events[0].kind, 'check-in');
  assert.equal(persisted.reward_events[0].seen_at, null);
  assert.equal(
    loaded.root.accounts.find((a) => a.username === 'aguardando-aprovacao').active,
    false
  );
  assert.equal(
    (
      await new PortalService(new CampaignStore(loaded.root)).request('/auth/me', {
        token: auth.token
      })
    ).account.role,
    'admin'
  );
  await assert.rejects(() => repository.save(loaded.root, 0), Conflict);
});
