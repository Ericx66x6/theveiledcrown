import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture, image } from './fixture-v8.mjs';
import { clone, newId } from '../../core/model.js';
import { upgradeQuote } from '../../core/settings.js';
import { workspaceExport, validateWorkspace, playerExport } from '../../core/workspace.js';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { straightDistanceKm } from '../../core/map-state.js';
import { resolvePowerTest } from '../../core/power-tests.js';
import { searchEntries } from '../../client/search.js';
import { themeCSS, themeVariables } from '../../tools/theme-css.mjs';
const denied = (task, status) => assert.rejects(task, (e) => e.status === status);
async function buy(f, item, { id = 234567, token = f.one.token, ...extra } = {}) {
  const p = await f.player(id, token);
  return f.call(
    '/api/intel/' + item.id + '/purchase',
    'POST',
    {
      character_id: id,
      character_revision: p._revision,
      revision: item._revision,
      quoted_xp: item.xp_cost,
      quoted_money: item.money_cost,
      confirmed: true,
      request_id: newId(),
      ...extra
    },
    token
  );
}

test('v8: capa e cor da campanha persistem sem campo de sistema; revisão protege edição', async () => {
  const f = await portalFixture(),
    c = (await f.call('/api/campaigns'))[0];
  assert.equal(c.system, undefined);
  const edited = await f.call('/api/campaigns/' + c.id, 'PATCH', {
    accent: '#2266bb',
    cover: image,
    revision: c._revision
  });
  assert.equal(edited.cover, image);
  assert.equal(edited.accent, '#2266bb');
  assert.equal(edited.system, undefined);
  await denied(
    () => f.call('/api/campaigns/' + c.id, 'PATCH', { title: 'Conflito', revision: c._revision }),
    409
  );
  const root = validateWorkspace(assembleDocuments(workspaceDocuments(await f.store.workspace())));
  assert.equal(root.campaigns[0].cover, image);
  assert.equal(root.campaigns[0].system, undefined);
});
test('v8: som geral e status social são preferências parciais e sobrevivem ao JSON', async () => {
  const f = await portalFixture();
  await f.call(
    '/api/profile',
    'PATCH',
    { preferences: { audio_enabled: false, animations: false } },
    f.one.token
  );
  await f.call(
    '/api/profile',
    'PATCH',
    { preferences: { social_mood: 'chill', social_note: 'Um café e uma conversa.' } },
    f.one.token
  );
  const root = validateWorkspace(workspaceExport(await f.store.workspace()));
  const a = root.accounts.find((a) => a.id === f.one.account.id);
  assert.equal(a.preferences.audio_enabled, false);
  assert.equal(a.preferences.animations, false);
  assert.equal(a.preferences.social_mood, 'chill');
  await denied(
    () => f.call('/api/profile', 'PATCH', { preferences: { audio_enabled: 'sim' } }, f.one.token),
    400
  );
});
test('v8: conteúdo e imagens de informação velada não saem em nenhuma resposta de jogador', async () => {
  const f = await portalFixture(),
    item = await f.intel();
  assert.match(item.secret, /SEGREDO/);
  for (const path of [
    '/api/intel',
    '/api/intel/' + item.id,
    '/api/campaign',
    '/api/portal-state',
    '/api/json/player'
  ]) {
    const response = await f.call(path, 'GET', {}, f.one.token),
      encoded = JSON.stringify(response);
    assert.doesNotMatch(encoded, /SEGREDO_INACESSIVEL_734/);
    if (path.startsWith('/api/intel')) assert.doesNotMatch(encoded, /"images"|"secret"/);
  }
});
test('v8: um personagem paga os custos completos e revela a descoberta para toda a mesa', async () => {
  const f = await portalFixture(),
    item = await f.intel(),
    result = await buy(f, item);
  assert.equal(result.character.xp, 73);
  assert.equal(result.character.money, 1000);
  assert.equal((await f.player(345678)).xp, 80);
  const view = await f.call('/api/intel/' + item.id, 'GET', {}, f.two.token);
  assert.match(view.secret, /SEGREDO_INACESSIVEL/);
  assert.equal(view.images[0], image);
  assert.equal(view.purchase.character_id, 234567);
  assert.equal(view.purchase.account_name, 'Marina');
  assert.equal(view.purchase.xp_paid, 7);
  assert.equal(view.purchase.money_paid, 200);
  assert.equal(result.character.history.at(-1).action, 'Investigação concluída');
  assert.equal((await f.call('/api/notifications', 'GET', {}, f.two.token))[0].kind, 'intel');
});
test('v8: informação não admite divisão de custo, saldo insuficiente ou personagem alheio', async () => {
  const f = await portalFixture(),
    expensive = await f.intel({ xp_cost: 81 });
  await denied(() => buy(f, expensive), 400);
  const money = await f.intel({ money_cost: 1200.01 });
  await denied(() => buy(f, money), 400);
  await denied(() => buy(f, money, { id: 345678 }), 403);
  assert.equal((await f.player()).xp, 80);
  assert.equal((await f.player()).money, 1200);
  assert.equal((await f.call('/api/intel/' + money.id, 'GET', {}, f.one.token)).revealed, false);
});
test('v8: repetição da mesma compra é idempotente e duas contas concorrentes não pagam duas vezes', async () => {
  const f = await portalFixture(),
    item = await f.intel(),
    p = await f.player(),
    request_id = newId();
  const body = {
    character_id: p.id,
    character_revision: p._revision,
    revision: item._revision,
    quoted_xp: 7,
    quoted_money: 200,
    confirmed: true,
    request_id
  };
  const [a, b] = await Promise.all([
    f.call('/api/intel/' + item.id + '/purchase', 'POST', body, f.one.token),
    f.call('/api/intel/' + item.id + '/purchase', 'POST', body, f.one.token)
  ]);
  assert.equal([a, b].filter((r) => r.replayed).length, 1);
  assert.equal((await f.player()).xp, 73);
  const other = await f.intel(),
    race = await Promise.allSettled([
      buy(f, other),
      buy(f, other, { id: 345678, token: f.two.token })
    ]);
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await f.player()).xp + (await f.player(345678)).xp, 146);
});
test('v8: custo, confirmação e revisão são conferidos antes da cobrança', async () => {
  const f = await portalFixture(),
    item = await f.intel();
  await denied(() => buy(f, item, { confirmed: false }), 400);
  await denied(() => buy(f, item, { quoted_xp: 0 }), 409);
  await denied(() => buy(f, item, { character_revision: 999 }), 409);
  await f.call('/api/intel/' + item.id, 'PATCH', { xp_cost: 9, revision: item._revision });
  await denied(() => buy(f, item), 409);
  assert.equal((await f.player()).xp, 80);
});
test('v8: apenas narrador cadastra, edita e apaga informações; exclusão não estorna pagamentos', async () => {
  const f = await portalFixture(),
    e = await f.intel();
  await denied(() => f.call('/api/intel', 'POST', { title: 'Fraude' }, f.one.token), 403);
  await denied(
    () => f.call('/api/intel/' + e.id, 'DELETE', { revision: e._revision }, f.one.token),
    403
  );
  const result = await buy(f, e);
  await f.call('/api/intel/' + e.id, 'DELETE', { revision: result.information._revision });
  assert.equal((await f.player()).xp, 73);
  assert.equal((await f.call('/api/intel')).length, 0);
});
test('v8: informação e aquisição respeitam campanhas encerradas e isolamento entre mesas', async () => {
  const f = await portalFixture(),
    e = await f.intel();
  await f.call('/api/campaigns/' + f.campaign, 'PATCH', { status: 'closed' });
  await denied(() => buy(f, e), 409);
  const c = await f.call('/api/campaigns', 'POST', { title: 'Outra mesa' });
  await f.call('/api/campaigns/' + c.id + '/select', 'POST');
  assert.equal((await f.call('/api/intel')).length, 0);
  await denied(() => f.call('/api/intel/' + e.id), 404);
  await denied(() => f.call('/api/intel', 'GET', {}, f.one.token), 403);
});
async function allowLegacy(f, id = 0) {
  const g = await f.call('/api/game');
  g.discipline_market.allowed_ids = [id];
  g._expected_revision = g._revision;
  await f.call('/api/game', 'PUT', g);
  return id;
}
async function acquire(f, id = 0, extra = {}) {
  const p = await f.player();
  return f.call(
    '/api/discipline-market/' + id + '/acquire',
    'POST',
    {
      character_id: p.id,
      character_revision: p._revision,
      quoted_cost: 10,
      confirmed: true,
      request_id: newId(),
      ...extra
    },
    f.one.token
  );
}
test('v8: legado liberado custa exatamente 10 XP, entra no nível zero e depois evolui normalmente', async () => {
  const f = await portalFixture(),
    id = await allowLegacy(f),
    r = await acquire(f, id);
  assert.equal(r.character.xp, 70);
  assert.equal(r.character.disciplines.find((d) => d.id === id).nivel, 0);
  const q = await f.call(
    '/api/characters/234567/upgrade-preview',
    'GET',
    { key: 'disciplines', id, target: 1 },
    f.one.token
  );
  const p = await f.call(
    '/api/characters/234567/upgrade',
    'POST',
    {
      key: 'disciplines',
      id,
      target: 1,
      confirmed: true,
      quoted_cost: q.cost,
      revision: r.character._revision
    },
    f.one.token
  );
  assert.equal(p.xp, 70 - q.cost);
  assert.match(p.history.at(-1).details, /AUSPÍCIOS: 0 → 1/);
});
test('v8: disciplina não liberada ou sem saldo é recusada; não há atalho por evolução de traço novo', async () => {
  const f = await portalFixture();
  await denied(() => acquire(f), 403);
  const g = await f.call('/api/game');
  g.progression.categories.disciplines.allow_new = true;
  g.discipline_market.allowed_ids = [0];
  g._expected_revision = g._revision;
  await f.call('/api/game', 'PUT', g);
  await denied(
    () =>
      f.call(
        '/api/characters/234567/upgrade-preview',
        'GET',
        { key: 'disciplines', id: 0, target: 1 },
        f.one.token
      ),
    400
  );
  const p = await f.player();
  await f.call('/api/characters/234567/xp', 'POST', {
    revision: p._revision,
    amount: -75,
    reason: 'Teste'
  });
  await denied(() => acquire(f), 400);
  assert.equal((await f.player()).disciplines.length, 0);
});
test('v8: aquisição de disciplina é idempotente e já conhecida não é comprada novamente', async () => {
  const f = await portalFixture();
  await allowLegacy(f);
  const p = await f.player(),
    request_id = newId();
  const body = { character_revision: p._revision, request_id };
  await acquire(f, 0, body);
  const retry = await acquire(f, 0, body);
  assert.equal(retry.replayed, true);
  await denied(() => acquire(f), 409);
  assert.equal((await f.player()).xp, 70);
});
test('v8: histórico de evolução não é truncado e só narrador pode apagar; ajustes têm comentário', async () => {
  const f = await portalFixture();
  await f.store.transact((d) => {
    d.characters[0].history = Array.from({ length: 120 }, (_, i) => ({
      action: 'Registro ' + i,
      at: '2026-01-01T00:00:00Z',
      actor: 'Narrador',
      details: ''
    }));
    return d;
  });
  let p = await f.player();
  p = await f.call('/api/characters/234567', 'PATCH', {
    revision: p._revision,
    patch: { cla: 'Novo clã' },
    log_message: 'Revisão da ficha em papel.'
  });
  assert.equal(p.history.length, 121);
  assert.match(p.history.at(-1).details, /Revisão da ficha em papel/);
  await denied(
    () =>
      f.call(
        '/api/characters/234567/logs/history',
        'DELETE',
        { revision: p._revision, confirmation: 'LIMPAR' },
        f.one.token
      ),
    403
  );
  await f.call('/api/characters/234567/logs/history', 'DELETE', {
    revision: p._revision,
    index: 120
  });
  assert.equal((await f.player()).history.length, 120);
});
test('v8: todo ganho administrativo de XP notifica a conta responsável', async () => {
  const f = await portalFixture(),
    p = await f.player();
  await f.call('/api/characters/234567/xp', 'POST', {
    revision: p._revision,
    amount: 6,
    reason: 'Investigação criativa'
  });
  const n = (await f.call('/api/notifications', 'GET', {}, f.one.token)).find(
    (n) => n.kind === 'xp'
  );
  assert.match(n.title, /6 XP/);
  assert.match(n.message, /Investigação criativa/);
  assert.equal(
    (await f.call('/api/notifications', 'GET', {}, f.two.token)).filter((n) => n.kind === 'xp')
      .length,
    0
  );
});
test('v8: marcador pessoal é privado inicialmente, narrador vê todos e jogador decide compartilhar', async () => {
  const f = await portalFixture(),
    m = await f.map();
  await f.call(
    `/api/maps/${m.id}/characters/234567`,
    'PUT',
    { x: 0.2, y: 0.4, revision: 0 },
    f.one.token
  );
  assert.equal(
    (await f.call('/api/maps/' + m.id, 'GET', {}, f.one.token)).character_markers.length,
    1
  );
  assert.equal((await f.call('/api/maps/' + m.id)).character_markers.length, 1);
  assert.equal(
    (await f.call('/api/maps/' + m.id, 'GET', {}, f.two.token)).character_markers.length,
    0
  );
  await denied(
    () =>
      f.call(`/api/maps/${m.id}/characters/234567`, 'PATCH', { x: 0.8, revision: 1 }, f.two.token),
    403
  );
  await f.call(`/api/maps/${m.id}/characters/234567`, 'PATCH', { x: 0.8, revision: 1 });
  assert.equal((await f.call('/api/maps/' + m.id)).character_markers[0].visibility, 'private');
  await f.call(
    `/api/maps/${m.id}/characters/234567`,
    'PATCH',
    { visibility: 'campaign', revision: 2 },
    f.one.token
  );
  const marker = (await f.call('/api/campaign', 'GET', {}, f.two.token)).maps[0]
    .character_markers[0];
  assert.equal(marker.character.char, 'Personagem 234567');
  assert.equal(marker.character.xp, undefined);
});
test('v8: posição pessoal respeita revisão, limite e exportação privada; remover personagem limpa marcador', async () => {
  const f = await portalFixture(),
    m = await f.map();
  await denied(
    () =>
      f.call(
        `/api/maps/${m.id}/characters/234567`,
        'PUT',
        { x: 2, y: 0.3, revision: 0 },
        f.one.token
      ),
    400
  );
  await f.call(
    `/api/maps/${m.id}/characters/234567`,
    'PUT',
    { x: 0.2, y: 0.3, revision: 0 },
    f.one.token
  );
  await denied(
    () =>
      f.call(`/api/maps/${m.id}/characters/234567`, 'PATCH', { x: 0.4, revision: 0 }, f.one.token),
    409
  );
  const exported = await f.call('/api/json/player', 'GET', {}, f.one.token);
  assert.equal(exported.campaigns[0].maps[0].character_markers.length, 1);
  const p = await f.player();
  await f.call('/api/characters/234567', 'DELETE', { revision: p._revision, confirmation: p.char });
  const root = validateWorkspace(workspaceExport(await f.store.workspace()));
  assert.equal(root.campaigns[0].maps[0].character_markers.length, 0);
});
test('v8: distância de imagem usa largura e altura originais e escala; mapa geográfico usa coordenadas', () => {
  const m = { mode: 'image', width: 1000, height: 500, scale: { pixels: 100, meters: 1000 } };
  assert.equal(straightDistanceKm(m, { x: 0, y: 0 }, { x: 0.3, y: 0.8 }), 5);
  assert.equal(straightDistanceKm({ ...m, zoom: 10 }, { x: 0, y: 0 }, { x: 0.3, y: 0.8 }), 5);
  assert.equal(straightDistanceKm({ ...m, scale: null }, { x: 0, y: 0 }, { x: 0.3, y: 0.8 }), null);
  assert.ok(
    Math.abs(
      straightDistanceKm({ mode: 'geographic' }, { lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.19508
    ) < 0.001
  );
  assert.ok(
    Math.abs(
      straightDistanceKm({ mode: 'geographic' }, { lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }) -
        22.239
    ) < 0.002
  );
});
test('v8: notas antigas, ambições e recados públicos migram uma vez, com autoria e privacidade', async () => {
  const f = await portalFixture(),
    root = await f.store.workspace(),
    c = root.campaigns[0],
    at = '2026-01-01T12:00:00Z';
  c.characters[0].notes = [
    { id: 'a', name: 'Meu segredo', description: 'Conteúdo pessoal', created_at: at }
  ];
  c.characters[0].goals = [{ id: 0, description: 'Uma ambição antiga' }];
  c.social.push({
    id: 'post-antigo',
    created_by: f.two.account.id,
    created_at: at,
    kind: 'message',
    content: 'Um recado público antigo'
  });
  const migrated = new CampaignStore(root),
    service = new PortalService(migrated),
    root2 = await migrated.workspace();
  assert.equal(root2.campaigns[0].characters[0].notes.length, 0);
  assert.equal(root2.campaigns[0].social.length, 0);
  assert.equal(root2.campaigns[0].characters[0].aspirations.ambition, 'Uma ambição antiga');
  assert.equal(root2.campaigns[0].notes.filter((n) => n.id.startsWith('legacy-')).length, 2);
  const own = await service.request('/api/notes', { token: f.one.token }),
    gm = await service.request('/api/notes', { token: f.admin.token });
  assert.equal(own.find((n) => n.content === 'Conteúdo pessoal').created_at, at);
  assert.equal(own.find((n) => n.content === 'Conteúdo pessoal').created_by, f.one.account.id);
  assert.ok(!gm.some((n) => n.content === 'Conteúdo pessoal'));
  assert.ok(gm.some((n) => n.content === 'Um recado público antigo'));
  const twice = new CampaignStore(root2);
  assert.equal(
    (await twice.workspace()).campaigns[0].notes.length,
    root2.campaigns[0].notes.length
  );
});
test('v8: salão envia mensagens particulares como notificações e recusa publicação pública', async () => {
  const f = await portalFixture();
  await denied(
    () => f.call('/api/social', 'POST', { kind: 'message', content: 'Público' }, f.one.token),
    400
  );
  const p = await f.call(
    '/api/social',
    'POST',
    { kind: 'message', to: f.two.account.id, content: 'Oi, vamos conversar?' },
    f.one.token
  );
  assert.equal(
    (await f.call('/api/notifications', 'GET', {}, f.two.token))[0].kind,
    'private-message'
  );
  assert.equal((await f.call('/api/social')).posts.length, 0);
  assert.equal((await f.call('/api/social', 'GET', {}, f.two.token)).posts[0].id, p.id);
});
test('v8: desafio mantém gestos em segredo até ambos jogarem e não muda recursos da ficha', async () => {
  const f = await portalFixture(),
    before = await f.player();
  const post = await f.call(
    '/api/social',
    'POST',
    { kind: 'challenge', to: f.two.account.id, choice: 'rock' },
    f.one.token
  );
  assert.equal(post.own_choice, 'rock');
  assert.equal(post.choices, undefined);
  for (const path of ['/api/social', '/api/campaign', '/api/portal-state']) {
    const r = await f.call(path, 'GET', {}, f.two.token);
    assert.doesNotMatch(JSON.stringify(r), /"rock"|"choices"/);
  }
  await denied(
    () => f.call('/api/social/' + post.id + '/respond', 'POST', { choice: 'paper' }, f.one.token),
    403
  );
  const result = await f.call(
    '/api/social/' + post.id + '/respond',
    'POST',
    { choice: 'paper' },
    f.two.token
  );
  assert.equal(result.result, 'recipient');
  assert.equal(result.choices[f.one.account.id], 'rock');
  const replay = await f.call(
    '/api/social/' + post.id + '/respond',
    'POST',
    { choice: 'paper' },
    f.two.token
  );
  assert.equal(replay.result, 'recipient');
  await denied(
    () =>
      f.call('/api/social/' + post.id + '/respond', 'POST', { choice: 'scissors' }, f.two.token),
    409
  );
  assert.equal((await f.player()).xp, before.xp);
  assert.equal((await f.player()).money, before.money);
});
test('v8: imagem em aliados, domínios e favores atravessa validação e documentos', async () => {
  const f = await portalFixture();
  let p = await f.player();
  for (const key of ['allies', 'domains', 'contacts', 'favours', 'items']) {
    p = await f.call(
      '/api/characters/234567',
      'PATCH',
      {
        revision: p._revision,
        patch: { [key]: [{ id: key, name: 'Registro ' + key, description: 'Exemplo', image }] }
      },
      f.one.token
    );
  }
  const root = validateWorkspace(assembleDocuments(workspaceDocuments(await f.store.workspace())));
  for (const key of ['allies', 'domains', 'contacts', 'favours', 'items'])
    assert.equal(root.campaigns[0].characters[0][key][0].image, image);
});
test('v8: informações, posições, recibos e catálogo sobrevivem ao conjunto de JSONs', async () => {
  const f = await portalFixture(),
    e = await f.intel(),
    m = await f.map();
  await buy(f, e);
  await allowLegacy(f);
  await acquire(f);
  await f.call(
    `/api/maps/${m.id}/characters/234567`,
    'PUT',
    { x: 0.2, y: 0.3, revision: 0 },
    f.one.token
  );
  const docs = workspaceDocuments(await f.store.workspace()),
    root = validateWorkspace(assembleDocuments(docs));
  assert.ok(docs[`campaigns/${f.campaign}/intel.json`]);
  assert.equal(root.campaigns[0].intel[0].purchase.xp_paid, 7);
  assert.equal(root.campaigns[0].characters[0].disciplines[0].nivel, 0);
  assert.equal(root.campaigns[0].maps[0].character_markers.length, 1);
});
test('v8: teste de disciplina resolve atributos e habilidades pelo nome e exclui a oposição', async () => {
  const f = await portalFixture(),
    p = await f.player();
  const r = resolvePowerTest(p, f.game, 'Raciocínio + Empatia vs Força de Vontade');
  assert.equal(r.total, 4);
  assert.equal(r.parts.length, 2);
  assert.equal(r.opposition, 'Força de Vontade');
  assert.equal(resolvePowerTest(p, f.game, 'Percepcao + EMPATIA').total, 3);
  assert.equal(resolvePowerTest(p, f.game, 'Força + Termo desconhecido').complete, false);
  assert.equal(resolvePowerTest(p, f.game, 'Força ou Destreza + Briga').complete, false);
  assert.equal(resolvePowerTest(p, f.game, 'Nenhum'), null);
});
test('v8: pesquisa atravessa catálogos e não indexa conteúdo ainda velado', async () => {
  const f = await portalFixture(),
    e = await f.intel(),
    s = await f.call('/api/portal-state', 'GET', {}, f.one.token);
  s.traitCategory = 'expertises';
  assert.equal(searchEntries(s, 'forca')[0].key, 'atributes');
  assert.equal(searchEntries(s, 'força')[0].title, 'FORÇA');
  assert.equal(searchEntries(s, 'SEGREDO_INACESSIVEL_734').length, 0);
  assert.ok(searchEntries(s, 'Um nome escondido').some((r) => r.kind === 'intel'));
});
test('v8: paleta deriva cores da campanha sem alterar branco neutro ou imagens', () => {
  const output = themeCSS(
    '.a{background:#311120;border:1px solid #d92343;color:#ffffff;background-image:url("image.jpg")}'
  );
  assert.match(output, /var\(--t-311120\)/);
  assert.match(output, /var\(--t-d92343\)/);
  assert.match(output, /#ffffff/);
  assert.match(output, /url\("image.jpg"\)/);
  assert.match(themeVariables(), /var\(--brand-hue\)/);
});

test('v8: reimportar anotação alterada não perde o novo texto na migração', async () => {
  const f = await portalFixture();
  let root = await f.store.workspace();
  root.campaigns[0].characters[0].notes = [
    {
      id: 'mesmo-id',
      name: 'Título antigo',
      description: 'Texto antigo',
      date: '01/11/2026',
      time: '18:30'
    }
  ];
  const first = new CampaignStore(root);
  root = await first.workspace();
  root.campaigns[0].characters[0].notes = [
    {
      id: 'mesmo-id',
      name: 'Título novo',
      description: 'Texto revisado',
      date: '02/11/2026',
      time: '19:15'
    }
  ];
  const second = new CampaignStore(root),
    notes = (await second.workspace()).campaigns[0].notes;
  assert.ok(notes.some((n) => n.content === 'Texto antigo'));
  assert.equal(notes.find((n) => n.content === 'Texto revisado').title, 'Título novo');
  assert.equal(
    notes.find((n) => n.content === 'Texto revisado').legacy_date_label,
    '02/11/2026 · 19:15'
  );
});
