import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture, image } from './fixture-v8.mjs';
import { calendarDay } from '../../core/login-rewards.js';
import { workspaceExport, validateWorkspace } from '../../core/workspace.js';
import { CampaignStore } from '../../core/store.js';
import { upgradeQuote } from '../../core/settings.js';
import { groupRewards } from '../../client/game-experience.js';
const bad = (fn, status) => assert.rejects(fn, (e) => e.status === status);
const clock = (f, day) => {
  f.service.now = () => new Date(`2026-11-${String(day).padStart(2, '0')}T15:00:00Z`);
};
const check = (f) => f.call('/api/rewards/check-in', 'POST', {}, f.one.token);
test('presença: calendário de São Paulo, um registro diário e recompensa a cada cinco dias', async () => {
  assert.equal(calendarDay(new Date('2026-11-09T02:59:00Z'), 'America/Sao_Paulo'), '2026-11-08');
  const f = await portalFixture();
  for (let day = 1; day <= 10; day++) {
    clock(f, day);
    const a = await check(f),
      b = await check(f);
    assert.equal(a.streak, day);
    assert.deepEqual(a, b);
    assert.equal(a.pending.length, Math.floor(day / 5));
  }
  assert.equal((await f.player()).xp, 80, 'crédito aguarda escolha explícita do personagem');
});
test('presença: dia perdido quebra o ciclo, conserva créditos e avisa só uma vez', async () => {
  const f = await portalFixture();
  for (let d = 1; d <= 6; d++) {
    clock(f, d);
    await check(f);
  }
  clock(f, 8);
  const r = await check(f);
  assert.equal(r.streak, 1);
  assert.equal(r.progress, 1);
  assert.equal(r.best, 6);
  assert.equal(r.pending.length, 1);
  assert.equal(r.events.filter((e) => e.kind === 'streak-break').length, 1);
  await check(f);
  assert.equal((await check(f)).events.filter((e) => e.kind === 'streak-break').length, 1);
});
test('presença: resgate exige confirmação, propriedade e revisão; repetição não duplica XP', async () => {
  const f = await portalFixture();
  for (let d = 1; d <= 5; d++) {
    clock(f, d);
    await check(f);
  }
  const r = await check(f),
    p = await f.player(),
    data = {
      credit_id: r.pending[0].id,
      character_id: p.id,
      revision: p._revision,
      confirmed: true
    };
  await bad(
    () => f.call('/api/rewards/claim', 'POST', { ...data, confirmed: false }, f.one.token),
    400
  );
  await bad(() => f.call('/api/rewards/claim', 'POST', data, f.two.token), 404);
  await bad(
    () => f.call('/api/rewards/claim', 'POST', { ...data, character_id: 345678 }, f.one.token),
    403
  );
  await bad(
    () => f.call('/api/rewards/claim', 'POST', { ...data, revision: -1 }, f.one.token),
    409
  );
  await Promise.all([
    f.call('/api/rewards/claim', 'POST', data, f.one.token),
    f.call('/api/rewards/claim', 'POST', data, f.one.token)
  ]);
  assert.equal((await f.player()).xp, 81);
  assert.equal(
    (await f.player()).history.filter((h) => h.action === 'Recompensa de presença').length,
    1
  );
  assert.equal((await check(f)).pending.length, 0);
});
test('presença: mudanças nas regras só afetam próximos créditos; créditos salvos continuam resgatáveis', async () => {
  const f = await portalFixture();
  for (let d = 1; d <= 5; d++) {
    clock(f, d);
    await check(f);
  }
  const g = await f.call('/api/game');
  g.login_rewards = { enabled: false, days: 3, xp: 4, time_zone: 'America/Sao_Paulo' };
  await f.call('/api/game', 'PUT', { ...g, _expected_revision: g._revision });
  clock(f, 6);
  const r = await check(f);
  assert.equal(r.enabled, false);
  assert.equal(r.pending[0].xp, 1);
  const p = await f.player();
  await f.call(
    '/api/rewards/claim',
    'POST',
    { credit_id: r.pending[0].id, character_id: p.id, revision: p._revision, confirmed: true },
    f.one.token
  );
  assert.equal((await f.player()).xp, 81);
});
test('XP offline: recibo privado persiste até reconhecimento e não apaga histórico', async () => {
  const f = await portalFixture(),
    p = await f.player();
  await f.call('/api/admin/xp/distribute', 'POST', {
    request_id: 'test_offline_xp',
    amount: 7,
    reason: 'Boa interpretação',
    character_ids: [p.id],
    revisions: { [p.id]: p._revision },
    confirmed: true
  });
  const r = await f.call('/api/rewards', 'GET', {}, f.one.token),
    event = r.events.find((e) => e.kind === 'xp');
  assert.equal(event.amount, 7);
  assert.equal(event.character_id, p.id);
  assert.equal((await f.call('/api/rewards', 'GET', {}, f.two.token)).events.length, 0);
  await bad(() => f.call('/api/rewards/ack', 'POST', { ids: [event.id] }, f.two.token), 404);
  const portal = await f.call('/api/portal-state', 'GET', {}, f.one.token);
  assert.equal(portal.account.reward_events, undefined);
  assert.ok(portal.rewards.events.some((e) => e.id === event.id));
  const restored = validateWorkspace(workspaceExport(await f.store.workspace()));
  assert.ok(
    restored.accounts
      .find((a) => a.id === f.one.account.id)
      .reward_events.some((e) => e.id === event.id)
  );
  await f.call('/api/rewards/ack', 'POST', { ids: [event.id] }, f.one.token);
  assert.equal((await f.call('/api/rewards', 'GET', {}, f.one.token)).events.length, 0);
  assert.ok((await f.player()).history.some((h) => h.details.includes('Boa interpretação')));
});
test('cadastro público: pendente não entra; só narrador pode aprovar e vincular campanhas', async () => {
  const f = await portalFixture(),
    data = {
      username: 'novato',
      password: 'senha-forte-123',
      display_name: 'Novato',
      avatar: image
    };
  const result = await f.call('/auth/register', 'POST', data, undefined);
  assert.equal(result.status, 'pending');
  assert.equal(result.token, undefined);
  await bad(() => f.call('/auth/login', 'POST', data), 403);
  await bad(() => f.call('/auth/register', 'POST', data), 409);
  await bad(() => f.call('/api/admin/registrations', 'GET', {}, f.one.token), 403);
  const pending = (await f.call('/api/admin/registrations')).find(
    (a) => a.username === data.username
  );
  assert.equal(pending.active, false);
  assert.equal(pending.password_hash, undefined);
  await bad(
    () =>
      f.call(`/api/admin/registrations/${pending.id}/approve`, 'POST', {
        revision: 1,
        campaign_ids: []
      }),
    400
  );
  await f.call(`/api/admin/registrations/${pending.id}/approve`, 'POST', {
    revision: 1,
    campaign_ids: [f.campaign]
  });
  const login = await f.call('/auth/login', 'POST', data);
  assert.equal(login.account.role, 'player');
  assert.deepEqual(login.account.character_ids, []);
  const state = await f.call('/api/portal-state', 'GET', {}, login.token);
  assert.equal(state.campaign.id, f.campaign);
  assert.equal(state.players.length, 0);
  assert.equal(login.account.preferences.music_enabled, true);
});
test('cadastro público: rejeição não concede acesso; senha curta é recusada', async () => {
  const f = await portalFixture(),
    data = { username: 'recusado', password: 'senha-forte-123', display_name: 'Pessoa' };
  await bad(() => f.call('/auth/register', 'POST', { ...data, password: 'curta' }), 400);
  await f.call('/auth/register', 'POST', data);
  const a = (await f.call('/api/admin/registrations')).find((a) => a.username === data.username);
  await f.call(`/api/admin/registrations/${a.id}/reject`, 'POST', {
    revision: 1,
    note: 'Confirme seu nome com a mesa.'
  });
  await bad(() => f.call('/auth/login', 'POST', data), 401);
  await bad(
    () =>
      f.call(`/api/admin/registrations/${a.id}/approve`, 'POST', {
        revision: 1,
        campaign_ids: [f.campaign]
      }),
    409
  );
});
test('evolução e aprendizado criam celebrações persistentes, sem registrar custo como ganho de XP', async () => {
  const f = await portalFixture(),
    p = await f.player(),
    q = upgradeQuote(p, f.game, 'atributes', 0, 4);
  await f.call(
    '/api/characters/234567/upgrade',
    'POST',
    {
      revision: p._revision,
      key: 'atributes',
      id: 0,
      target: 4,
      quoted_cost: q.cost,
      confirmed: true
    },
    f.one.token
  );
  let r = await f.call('/api/rewards', 'GET', {}, f.one.token);
  assert.equal(r.events.at(-1).kind, 'upgrade');
  assert.equal(r.events.at(-1).changes[0].to, 4);
  assert.equal(
    r.events.some((e) => e.kind === 'xp'),
    false
  );
  const game = await f.call('/api/game');
  game.discipline_market.allowed_ids = [0];
  await f.call('/api/game', 'PUT', { ...game, _expected_revision: game._revision });
  const next = await f.player();
  await f.call(
    '/api/discipline-market/0/acquire',
    'POST',
    {
      character_id: next.id,
      character_revision: next._revision,
      quoted_cost: game.discipline_market.default_cost,
      confirmed: true,
      request_id: 'test_learn_discipline'
    },
    f.one.token
  );
  r = await f.call('/api/rewards', 'GET', {}, f.one.token);
  assert.equal(r.events.at(-1).kind, 'discipline');
  assert.equal(r.events.at(-1).changes[0].to, 0);
  assert.equal(
    r.events.some((e) => e.kind === 'xp'),
    false
  );
});
test('configuração de presença valida limites e fuso; jogador não altera as regras', async () => {
  const f = await portalFixture(),
    g = await f.call('/api/game');
  for (const badRule of [
    { days: 0 },
    { days: 61 },
    { xp: 0 },
    { xp: 1.5 },
    { enabled: 'sim' },
    { time_zone: 'fuso-inventado' }
  ]) {
    await bad(
      () =>
        f.call('/api/game', 'PUT', {
          ...g,
          _expected_revision: g._revision,
          login_rewards: { ...g.login_rewards, ...badRule }
        }),
      400
    );
  }
  await bad(
    () => f.call('/api/game', 'PUT', { ...g, _expected_revision: g._revision }, f.one.token),
    403
  );
  await bad(() => f.call('/api/rewards/check-in', 'POST'), 403);
});
test('presença é independente por campanha; entrar em outra mesa não transfere a sequência', async () => {
  const f = await portalFixture();
  clock(f, 1);
  await check(f);
  clock(f, 2);
  await check(f);
  const c = await f.call('/api/campaigns', 'POST', {
    title: 'Outra crônica',
    description: 'Uma campanha isolada.',
    accent: '#882244'
  });
  await f.store.select(c.id);
  await f.call('/api/admin/accounts/' + f.one.account.id, 'PATCH', {
    character_ids: [],
    campaign_access: true
  });
  f.one = await f.call('/auth/login', 'POST', {
    username: 'primeiro',
    password: 'senha-teste-123'
  });
  assert.equal((await check(f)).streak, 1);
  await f.store.select(f.campaign);
  assert.equal((await check(f)).streak, 2);
  const root = validateWorkspace(workspaceExport(await f.store.workspace()));
  assert.equal(
    Object.keys(root.accounts.find((a) => a.id === f.one.account.id).login_rewards).length,
    2
  );
});
test('áudio: migração ativa trilha uma vez, preserva silêncio geral e escolhas posteriores', async () => {
  const f = await portalFixture(),
    root = await f.store.workspace();
  const a = root.accounts.find((a) => a.id === f.one.account.id),
    b = root.accounts.find((a) => a.id === f.two.account.id);
  a.preferences = { audio_enabled: true, music_enabled: false };
  b.preferences = { audio_enabled: false, music_enabled: false };
  const migrated = await new CampaignStore(root).workspace();
  assert.equal(migrated.accounts.find((x) => x.id === a.id).preferences.music_enabled, true);
  assert.equal(migrated.accounts.find((x) => x.id === b.id).preferences.music_enabled, false);
  migrated.accounts.find((x) => x.id === a.id).preferences.music_enabled = false;
  assert.equal(
    (await new CampaignStore(migrated).workspace()).accounts.find((x) => x.id === a.id).preferences
      .music_enabled,
    false
  );
});
test('recibos agrupam XP acumulado e unem quebra/recomeço, preservando IDs para reconhecimento', () => {
  const events = [
    { id: 'a', kind: 'xp', character_id: 1, amount: 2 },
    { id: 'b', kind: 'xp', character_id: 1, amount: 3 },
    { id: 'c', kind: 'xp', character_id: 2, amount: 1 },
    { id: 'd', kind: 'streak-break', previous: 4 },
    { id: 'e', kind: 'check-in', progress: 1, days: 5 }
  ];
  const result = groupRewards(events);
  assert.equal(result.length, 3);
  assert.equal(result[0].amount, 5);
  assert.deepEqual(result[0].ids, ['a', 'b']);
  assert.deepEqual(result[2].ids, ['d', 'e']);
  assert.equal(result[2].restart.progress, 1);
  assert.equal(events[0].amount, 2);
});
