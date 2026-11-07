import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture, image } from './fixture-v8.mjs';
import { clone, newId, validatePlayer } from '../../core/model.js';
import { gameSettings, validateSettings } from '../../core/settings.js';
import { workspaceExport, validateWorkspace } from '../../core/workspace.js';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { CampaignStore } from '../../core/store.js';
import { searchEntries } from '../../client/search.js';
import { consultationPage } from '../../client/consultation.js';
import { NavigationTrail } from '../../client/navigation.js';
import { publicOrigin, socialMetadata } from '../../tools/site-metadata.mjs';
const reject = (fn, status) => assert.rejects(fn, (e) => e.status === status);
const patch = async (f, data, token = f.one.token) => {
  const p = await f.player(234567, token);
  return f.call('/api/characters/234567', 'PATCH', { revision: p._revision, patch: data }, token);
};
const goals = {
  ambition: 'Conquistar um lugar na corte.',
  desire: 'Encontrar a chave do arquivo.'
};
const setupMarket = async (f, default_cost = 17, costs = { 0: 24, 1: 0 }) => {
  const g = await f.call('/api/game');
  g.discipline_market = { allowed_ids: [0, 1, 2], default_cost, costs };
  await f.call('/api/game', 'PUT', { ...g, _expected_revision: g._revision });
};
const acquire = async (f, id, cost, extra = {}) => {
  const p = await f.player();
  return f.call(
    `/api/discipline-market/${id}/acquire`,
    'POST',
    {
      character_id: p.id,
      character_revision: p._revision,
      quoted_cost: cost,
      confirmed: true,
      request_id: newId(),
      ...extra
    },
    f.one.token
  );
};

test('v9: jogador altera ambição e desejo livremente sem transformar em anotações', async () => {
  const f = await portalFixture();
  await patch(f, { aspirations: goals });
  const p = await f.player();
  assert.deepEqual(p.aspirations, goals);
  assert.equal((await f.call('/api/notes', 'GET', {}, f.one.token)).length, 0);
  const next = await patch(f, { aspirations: { ...goals, desire: 'Abrir a carta.' } });
  assert.equal(next.aspirations.ambition, goals.ambition);
  assert.equal(next.aspirations.desire, 'Abrir a carta.');
});
test('v9: concluir limpa somente ambição, preserva desejo e saldo e registra conteúdo no histórico', async () => {
  const f = await portalFixture(),
    p = await patch(f, { aspirations: goals });
  const r = await f.call(
    '/api/characters/234567/aspiration',
    'POST',
    { revision: p._revision, kind: 'ambition', outcome: 'complete', confirmed: true },
    f.one.token
  );
  assert.equal(r.aspirations.ambition, '');
  assert.equal(r.aspirations.desire, goals.desire);
  assert.equal(r.xp, p.xp);
  assert.equal(r.history.at(-1).details, goals.ambition);
  assert.match(r.history.at(-1).action, /Ambição/);
  await reject(
    () =>
      f.call(
        '/api/characters/234567/aspiration',
        'POST',
        { revision: r._revision, kind: 'ambition', outcome: 'complete', confirmed: true },
        f.one.token
      ),
    409
  );
});
test('v9: desistir limpa só desejo; confirmação, revisão e propriedade são obrigatórias', async () => {
  const f = await portalFixture(),
    p = await patch(f, { aspirations: goals }),
    data = { revision: p._revision, kind: 'desire', outcome: 'abandon', confirmed: true };
  await reject(
    () =>
      f.call(
        '/api/characters/234567/aspiration',
        'POST',
        { ...data, confirmed: false },
        f.one.token
      ),
    400
  );
  await reject(() => f.call('/api/characters/234567/aspiration', 'POST', data, f.two.token), 403);
  await reject(
    () =>
      f.call(
        '/api/characters/234567/aspiration',
        'POST',
        { ...data, revision: p._revision - 1 },
        f.one.token
      ),
    409
  );
  const r = await f.call('/api/characters/234567/aspiration', 'POST', data, f.one.token);
  assert.deepEqual(r.aspirations, { ambition: goals.ambition, desire: '' });
  assert.match(r.history.at(-1).action, /abandon/);
});
test('v9: migração recupera goals e notas automáticas da v8 sem remover notas criadas pelo usuário', async () => {
  const f = await portalFixture(),
    root = await f.store.workspace(),
    c = root.campaigns[0],
    p = c.characters[0];
  delete p.aspiration_migration_v9;
  p.goals = [
    { id: 0, description: 'Minha primeira ambição' },
    { id: 1, description: 'Meu desejo' }
  ];
  c.notes.push(
    {
      id: `legacy-${p.id}-goals-abcdef`,
      character_id: p.id,
      title: 'Ambição · ' + p.char,
      content: 'Minha ambição revisada',
      created_by: f.one.account.id,
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
      _revision: 0,
      visibility: 'private'
    },
    {
      id: 'nota-manual',
      character_id: p.id,
      title: 'Ambição antiga',
      content: 'Uma anotação escrita por mim',
      created_by: f.one.account.id,
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
      _revision: 0,
      visibility: 'private'
    }
  );
  const migrated = new CampaignStore(root),
    a = await migrated.workspace();
  assert.deepEqual(a.campaigns[0].characters[0].aspirations, {
    ambition: 'Minha primeira ambição',
    desire: 'Meu desejo'
  });
  assert.equal(a.campaigns[0].notes.length, 1);
  assert.equal(a.campaigns[0].notes[0].id, 'nota-manual');
  assert.ok(
    a.campaigns[0].characters[0].history.some((h) => h.details.includes('Minha ambição revisada'))
  );
  assert.deepEqual((await new CampaignStore(a).workspace()).campaigns[0], a.campaigns[0]);
});
test('v9: preço individual prevalece; disciplina sem preço herda custo geral; zero é permitido', async () => {
  const f = await portalFixture();
  await setupMarket(f);
  const a = await acquire(f, 0, 24);
  assert.equal(a.character.xp, 56);
  assert.equal(a.character.disciplines[0].nivel, 0);
  const b = await acquire(f, 1, 0);
  assert.equal(b.character.xp, 56);
  const c = await acquire(f, 2, 17);
  assert.equal(c.character.xp, 39);
  assert.match(c.character.history.at(-1).details, /17 XP/);
});
test('v9: preço alterado recusa cotação anterior sem débito e repetição confirmada não paga de novo', async () => {
  const f = await portalFixture();
  await setupMarket(f);
  await reject(() => acquire(f, 0, 10), 409);
  assert.equal((await f.player()).xp, 80);
  const id = newId(),
    p = await f.player(),
    extra = { request_id: id, character_revision: p._revision };
  const first = await acquire(f, 0, 24, extra);
  const replay = await acquire(f, 0, 24, extra);
  assert.equal(first.character.xp, 56);
  assert.equal(replay.character.xp, 56);
  assert.equal(replay.replayed, true);
});
test('v9: regras recusam custo negativo, fracionário, exagerado ou disciplina inexistente', async () => {
  const f = await portalFixture();
  for (const market of [
    { default_cost: -1, costs: {} },
    { default_cost: 1.5, costs: {} },
    { default_cost: 1e9, costs: {} },
    { default_cost: 10, costs: { 999999: 10 } },
    { default_cost: 10, costs: { 0: -5 } },
    { default_cost: 10, costs: [] }
  ])
    assert.throws(() =>
      validateSettings(
        gameSettings({ ...clone(f.game), discipline_market: { allowed_ids: [], ...market } })
      )
    );
});
test('v9: enquadramento mantém a imagem original e sobrevive ao JSON, com limites validados', async () => {
  const f = await portalFixture(),
    frame = { x: 18, y: 74, zoom: 1.73 };
  await patch(f, { profilepicture: image, portrait_frame: frame, aspirations: goals });
  const r = validateWorkspace(
    assembleDocuments(workspaceDocuments(workspaceExport(await f.store.workspace())))
  );
  const p = r.campaigns[0].characters[0];
  assert.equal(p.profilepicture, image);
  assert.deepEqual(p.portrait_frame, frame);
  assert.deepEqual(p.aspirations, goals);
  for (const invalid of [
    { x: -1, y: 50, zoom: 1 },
    { x: 50, y: 101, zoom: 1 },
    { x: 50, y: 50, zoom: 0 },
    { x: 50, y: 50, zoom: 4 },
    { x: NaN, y: 50, zoom: 1 },
    { x: '50', y: 50, zoom: 1 }
  ])
    assert.throws(() => validatePlayer({ ...p, portrait_frame: invalid }, r.campaigns[0].game));
});
test('v9: áudio salva trilha, efeitos e volumes independentes e recusa valores inválidos', async () => {
  const f = await portalFixture();
  const a = await f.call(
    '/api/profile',
    'PATCH',
    {
      preferences: { audio_enabled: false, music_enabled: true, sfx_volume: 90, music_volume: 22 }
    },
    f.one.token
  );
  assert.equal(a.preferences.audio_enabled, false);
  assert.equal(a.preferences.music_enabled, true);
  const persisted = new CampaignStore(await f.store.workspace());
  assert.equal(
    (await persisted.workspace()).accounts.find((a) => a.id === f.one.account.id).preferences
      .music_volume,
    22
  );
  await reject(
    () => f.call('/api/profile', 'PATCH', { preferences: { music_volume: 101 } }, f.one.token),
    400
  );
  await reject(
    () => f.call('/api/profile', 'PATCH', { preferences: { music_enabled: 'true' } }, f.one.token),
    400
  );
});
test('v9: busca inclui poderes individuais e rituais com destino direto', async () => {
  const f = await portalFixture();
  const game = await f.call('/api/game'),
    d = game.disciplines[0],
    n = d.nivels[1];
  const rows = searchEntries({ game }, n.subname);
  assert.ok(rows.some((r) => r.kind === 'power' && r.id === d.id && r.index === 1));
  const ritual = game.rituals[0];
  assert.ok(
    searchEntries({ game }, ritual.name).some(
      (r) => r.kind === 'catalog' && r.key === 'rituals' && r.id === ritual.id
    )
  );
});
test('v9: consulta abre o poder escolhido, com rolagem disponível antes do convite para evoluir', async () => {
  const f = await portalFixture(),
    game = await f.call('/api/game'),
    p = await f.player(),
    d = game.disciplines[0];
  p.disciplines = [{ id: d.id, nivel: 5 }];
  const html = consultationPage({
    state: { game, powerDetail: { key: 'disciplines', id: d.id, index: 1 } },
    player: () => p,
    admin: () => false
  });
  assert.ok(html.indexOf(d.nivels[1].subname) >= 0);
  assert.ok(html.indexOf('consultation-power') < html.indexOf('consultation-upgrade'));
  assert.ok(!html.includes('evolution-workbench'));
});
test('v9: voltar e avançar conservam poder, filtros e posição; nova navegação descarta somente o futuro', () => {
  const n = new NavigationTrail(),
    a = n.start({ view: 'powers', scroll: 380 }),
    b = n.push({ view: 'power-detail', route: { index: 2 }, scroll: 220 }),
    c = n.push({ view: 'dice', scroll: 0 });
  assert.ok(n.canBack);
  assert.equal(n.select(b).route.index, 2);
  assert.equal(n.current.point.scroll, 220);
  assert.equal(n.select(a).scroll, 380);
  assert.equal(n.canBack, false);
  assert.equal(n.select(c).view, 'dice');
  n.select(b);
  n.push({ view: 'aspirations' });
  assert.equal(n.select(c), null);
  assert.equal(n.select({ coroaNav: 'outra-conta', entry: 1 }), null);
});
test('v9: compartilhamento usa origem pública de produção e domínio próprio tem prioridade', () => {
  assert.equal(
    publicOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'coroa.example', VERCEL_URL: 'preview.example' }),
    'https://coroa.example'
  );
  assert.equal(
    publicOrigin({
      COROA_SITE_URL: 'https://mesa.example/',
      VERCEL_PROJECT_PRODUCTION_URL: 'outro.example'
    }),
    'https://mesa.example'
  );
  assert.throws(() => publicOrigin({ COROA_SITE_URL: 'https://mesa.example/caminho' }));
  assert.throws(() => publicOrigin({ COROA_SITE_URL: 'http://mesa.example' }));
  const html = socialMetadata('https://mesa.example');
  assert.match(html, /og:image" content="https:\/\/mesa.example\/assets\/images\/coroa-share.jpg/);
  assert.match(html, /og:image:width" content="1200/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /canonical/);
});
