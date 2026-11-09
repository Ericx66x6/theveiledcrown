import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blank, clone, documentSeed, validatePlayer } from '../../core/model.js';
import { gameSettings, validateSettings, upgradeQuote } from '../../core/settings.js';
import {
  emptyCreation,
  chooseClan,
  evaluateCreation,
  creationReport,
  reconcileCreation
} from '../../core/character-creation.js';
import { catalogId, normalizedName } from '../../core/creation-config.js';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { workspaceExport, validateWorkspace } from '../../core/workspace.js';
import { creationSource } from './creation-fixture.mjs';
import { rulebookPage } from '../../client/rulebook.js';
import { ruleContent } from '../../client/rule-content.js';
import { CreationWizard } from '../../client/creation-wizard.js';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
const background = (name) => catalogId(game, 'precedents', name);
const trait = (name) =>
  game.caracteristics.find((d) => normalizedName(d.name) === normalizedName(name)).id;
const rejected = (fn, status = 400) => assert.rejects(fn, (e) => e.status === status);
async function fixture() {
  const store = new CampaignStore(documentSeed(game)),
    service = new PortalService(store);
  const admin = await service.request('/auth/bootstrap', {
    method: 'POST',
    data: { username: 'narrador', display_name: 'Narrador', password: 'teste-ficticio-123' }
  });
  const request = (path, method = 'GET', data = {}, token = admin.token) =>
    service.request(path, { method, data, token });
  await request('/api/admin/accounts', 'POST', {
    username: 'jogador',
    display_name: 'Jogador',
    password: 'teste-ficticio-123',
    role: 'player',
    character_ids: [],
    campaign_access: true
  });
  const player = await request('/auth/login', 'POST', {
    username: 'jogador',
    password: 'teste-ficticio-123'
  });
  return { store, request, admin, player };
}
test('criação: regras exatas da mesa, os treze clãs e Caitiff, incluindo combinações personalizadas', () => {
  const c = game.character_creation.guided;
  assert.deepEqual(c.initial, { atributes: 15, skills: 27, precedents: 5, disciplines: 3 });
  assert.deepEqual(c.bonus_costs, { atributes: 4, skills: 2, disciplines: 6, precedents: 1 });
  assert.equal(c.attribute_base, 1);
  assert.equal(c.max_flaws, 4);
  assert.equal(c.clans.length, 14);
  assert.deepEqual(c.clans.find((c) => c.id === 'toreador').disciplines, [0, 1, 5]);
  assert.deepEqual(c.clans.find((c) => c.id === 'ravnos').disciplines, [11, 4, 14]);
  assert.deepEqual(c.clans.find((c) => c.id === 'tzimisce').disciplines, [11, 2, 25]);
  for (const clan of c.clans) {
    const { character, report } = evaluateCreation(creationSource(game, clan.id), game);
    assert.deepEqual(report.issues, [], clan.name);
    assert.doesNotThrow(() => validatePlayer(character, game));
    assert.deepEqual(creationReport(character, game).issues, []);
    assert.equal(report.totals.bonus.used, 15);
  }
});
test('v9.2: valores iniciais e bônus separados, habilidades compartilham 27 e podem chegar a cinco', () => {
  const source = creationSource(game),
    result = evaluateCreation(source, game);
  assert.equal(result.character.atributes[0].value, 5);
  assert.equal(result.character.talents[0].value, 4);
  assert.deepEqual(result.report.totals.skills, { used: 27, budget: 27 });
  assert.equal(result.character.xp, 0);
  source.creation.initial.talents[0] = 4;
  assert.ok(evaluateCreation(source, game).report.issues.some((i) => i.stage === 'initial'));
  source.creation.initial.talents[0] = 3;
  source.creation.bonus.atributes[0] = 2;
  assert.ok(
    evaluateCreation(source, game).report.issues.some((i) => i.message.includes('limite final'))
  );
});
test('v9.2: disciplina no nível zero é mantida; linha primária acompanha sem consumir o pool duas vezes', () => {
  const source = creationSource(game, 'giovanni');
  source.creation.bonus.disciplines = {};
  source.creation.bonus.precedents[background('Aliados')] = 5;
  source.creation.bonus.precedents[background('Contatos')] = 4;
  const { character, report } = evaluateCreation(source, game);
  assert.equal(character.disciplines.find((d) => d.id === 5).nivel, 0);
  assert.equal(character.disciplines.find((d) => d.id === 18).nivel, 1);
  assert.equal(character.disciplines.find((d) => d.id === character.primary_paths[18]).nivel, 1);
  assert.equal(report.totals.disciplines.used, 3);
  assert.equal(report.issues.length, 0);
  delete source.creation.primary_paths[18];
  assert.ok(evaluateCreation(source, game).report.issues.some((i) => i.stage === 'identity'));
  source.creation.primary_paths[18] = 22;
  assert.throws(() => evaluateCreation(source, game), /não pertence/);
});
test('v9.2: geração varia de treze a oito, e recursos finais são capital aplicado uma única vez', () => {
  const source = creationSource(game);
  source.creation.initial.precedents = { [background('Geração')]: 5 };
  source.creation.bonus.precedents = { [background('Recursos')]: 3 };
  let r = evaluateCreation(source, game);
  assert.equal(r.character.generation, 8);
  assert.equal(r.character.money, 50000);
  assert.equal(r.report.issues.length, 0);
  source.creation.initial.precedents = { [background('Recursos')]: 5 };
  source.creation.bonus.precedents = {};
  r = evaluateCreation(source, game);
  assert.equal(r.character.generation, 13);
  assert.equal(r.character.money, 5000000);
  assert.equal(evaluateCreation(r.character, game).character.money, 5000000);
  for (const [level, capital] of Object.entries(game.character_creation.guided.capital_by_level)) {
    source.creation.initial.precedents = {
      [background('Recursos')]: Number(level),
      [background('Aliados')]: 5 - Number(level)
    };
    assert.equal(evaluateCreation(source, game).character.money, capital);
  }
});
test('v9.2: defeitos concedem bônus e qualidades debitam preço do catálogo; sem XP e sem duplicar versões', () => {
  const source = creationSource(game);
  source.creation.traits = [
    { id: trait('Vingança'), notes: 'Uma disputa antiga.' },
    { id: trait('Concentração'), notes: '' }
  ];
  let r = evaluateCreation(source, game);
  assert.equal(r.report.totals.bonus.budget, 17);
  assert.equal(r.report.totals.bonus.used, 16);
  assert.equal(r.character.xp, 0);
  source.creation.traits = [
    trait('Vingança'),
    trait('Tique Nervoso'),
    trait('Toque de Congelamento'),
    trait('Vulnerabilidade a Prata'),
    trait('Brisa Frígida')
  ].map((id) => ({ id }));
  assert.ok(
    evaluateCreation(source, game).report.issues.some((i) => i.message.includes('Máximo de 4'))
  );
  source.creation.traits = [
    { id: trait('Dívida de Gratidão — 1 Ponto') },
    { id: trait('Dívida de Gratidão — 2 Pontos') }
  ];
  assert.ok(
    evaluateCreation(source, game).report.issues.some((i) =>
      i.message.includes('apenas uma versão')
    )
  );
  source.creation.traits = [{ id: 4 }, { id: 4 }];
  assert.throws(() => evaluateCreation(source, game), /repetidos/);
});
test('v9.2: clã personalizado aceita exatamente três disciplinas e exige revisão narrativa', () => {
  const source = creationSource(game);
  source.cla = 'Os Sem-Coroa';
  source.creation.clan = 'custom';
  const r = evaluateCreation(source, game);
  assert.equal(r.character.cla, 'Os Sem-Coroa');
  assert.equal(r.report.issues.length, 0);
  assert.ok(r.report.warnings.some((w) => w.includes('Clã personalizado')));
  source.creation.disciplines = [0, 0, 1];
  assert.throws(() => evaluateCreation(source, game), /diferentes/);
  source.creation.disciplines = [0, 1];
  assert.ok(evaluateCreation(source, game).report.issues.length);
});
test('v9.2: monstruoso fixa aparência, criança exige estatura e qualidades conferem requisitos', () => {
  const source = creationSource(game);
  source.creation.traits = [{ id: trait('Monstruoso') }];
  source.creation = reconcileCreation(source.creation, game);
  let r = evaluateCreation(source, game);
  assert.equal(r.character.atributes.find((d) => d.id === 5).value, 0);
  source.creation.traits = [{ id: trait('Criança') }];
  r = evaluateCreation(source, game);
  assert.ok(r.report.issues.some((i) => i.message.includes('ESTATURA BAIXA')));
  assert.ok(r.report.issues.some((i) => i.message.includes('limite final 2')));
  source.creation.traits = [{ id: trait('Líder Nato') }];
  source.creation.initial.atributes[3] = 1;
  assert.ok(
    evaluateCreation(source, game).report.issues.some((i) => i.message.includes('CARISMA 3'))
  );
});
test('v9.2: Beijo de Procuração concede pontos reais, mas não cobra pool inicial por essas concessões', () => {
  const source = creationSource(game, 'giovanni');
  source.creation.bonus = Object.fromEntries(
    Object.keys(source.creation.bonus).map((k) => [k, {}])
  );
  source.creation.traits = [{ id: trait('Beijo de Procuração — 8 Pontos') }];
  source.creation.bonus.atributes[0] = 1;
  source.creation.bonus.precedents[background('Aliados')] = 3;
  const r = evaluateCreation(source, game);
  assert.equal(r.report.issues.length, 0);
  assert.equal(r.character.disciplines.find((d) => d.id === 5).nivel, 1);
  assert.equal(r.character.disciplines.find((d) => d.id === 3).nivel, 1);
  assert.equal(r.report.totals.bonus.used, 15);
  assert.equal(r.report.totals.bonus.merits, 8);
  assert.equal(r.report.totals.disciplines.used, 3);
  assert.equal(r.character.disciplines.length, 5);
});
test('v9.2: API recalcula tudo, impede estouros e aprovação conserva capital sem duplicação', async () => {
  const f = await fixture(),
    source = creationSource(game);
  source.generation = 4;
  source.xp = 9999;
  source.money = 9999999;
  source.status.humanity = 0;
  const s = await f.request('/api/submissions', 'POST', { character: source }, f.player.token);
  assert.equal(s.character.generation, 11);
  assert.equal(s.character.money, 50000);
  assert.equal(s.character.xp, 0);
  assert.equal(s.character.status.humanity, 5);
  assert.equal(s.report.issues.length, 0);
  const approved = await f.request('/api/submissions/' + s.id + '/approve', 'POST', {
    revision: s._revision
  });
  assert.equal(approved.character.money, 50000);
  await rejected(
    () =>
      f.request('/api/submissions/' + s.id + '/approve', 'POST', { revision: approved._revision }),
    409
  );
  assert.equal((await f.request('/api/characters/' + approved.character.id)).money, 50000);
  const bad = creationSource(game, 'brujah', 678901);
  bad.creation.bonus.knowledges[0] = 5;
  await rejected(() => f.request('/api/submissions', 'POST', { character: bad }, f.player.token));
  const legacy = blank(game, 678901);
  Object.assign(legacy, { char: 'Legado', player: 'Jogador', cla: 'Livre' });
  await rejected(() =>
    f.request('/api/submissions', 'POST', { character: legacy }, f.player.token)
  );
  assert.ok(creationReport(legacy, game).issues.some((i) => i.key === 'creation'));
});
test('v9.2: pontos, linhas e antecedentes sobrevivem aos documentos JSON separados', async () => {
  const f = await fixture(),
    source = creationSource(game, 'tremere');
  const s = await f.request('/api/submissions', 'POST', { character: source }, f.player.token);
  await f.request('/api/submissions/' + s.id + '/approve', 'POST', { revision: s._revision });
  const root = workspaceExport(f.store.root),
    packet = workspaceDocuments(root),
    again = assembleDocuments(packet);
  assert.doesNotThrow(() => validateWorkspace(again));
  const p = again.campaigns[0].characters[0];
  assert.deepEqual(p.creation, s.character.creation);
  assert.deepEqual(p.primary_paths, s.character.primary_paths);
  assert.equal(p.money, 50000);
});
test('v9.2: evolução de disciplina e linha inicial cobra uma vez e mantém ambas sincronizadas', async () => {
  const f = await fixture(),
    source = creationSource(game, 'tremere');
  const s = await f.request('/api/submissions', 'POST', { character: source }, f.player.token);
  const approved = await f.request('/api/submissions/' + s.id + '/approve', 'POST', {
    revision: s._revision
  });
  let p = await f.request('/api/characters/' + approved.character.id);
  p = await f.request('/api/characters/' + p.id + '/xp', 'POST', {
    amount: 100,
    reason: 'Teste',
    revision: p._revision
  });
  const quote = await f.request(
    '/api/characters/' + p.id + '/upgrade-preview',
    'GET',
    { key: 'disciplines', id: 8, target: 3 },
    f.player.token
  );
  p = await f.request(
    '/api/characters/' + p.id + '/upgrade',
    'POST',
    {
      key: 'disciplines',
      id: 8,
      target: 3,
      revision: p._revision,
      confirmed: true,
      quoted_cost: quote.cost
    },
    f.player.token
  );
  assert.equal(p.xp, 100 - quote.cost);
  assert.equal(p.disciplines.find((d) => d.id === 8).nivel, 3);
  assert.equal(p.disciplines.find((d) => d.id === p.primary_paths[8]).nivel, 3);
});
test('v9.2: configurações recusam custos inválidos e antecedentes apagados não reaparecem', async () => {
  const g = clone(game);
  g.character_creation.guided.bonus_costs.disciplines = 0;
  assert.throws(() => validateSettings(g), /Custo/);
  const f = await fixture(),
    before = await f.request('/api/game'),
    id = background('Recursos');
  await f.request('/api/rulebook/catalog/precedents/' + id, 'DELETE', {
    revision: before._revision,
    confirmation: 'RECURSOS',
    remove_references: true
  });
  assert.equal(
    (await f.request('/api/game')).precedents.some((d) => d.id === id),
    false
  );
});
test('v9.2: livro abre em consulta, leitura mostra texto integral e gerenciamento exige troca de modo', () => {
  const state = { game },
    ctx = { state };
  let html = rulebookPage(ctx);
  assert.ok(html.includes('data-action="rule-view"'));
  assert.ok(!html.includes('data-action="rule-edit"'));
  assert.ok(!html.includes('data-action="rule-delete"'));
  state.ruleEditing = true;
  html = rulebookPage(ctx);
  assert.ok(html.includes('data-action="rule-edit"'));
  const entry = { ...game.disciplines[0], description: 'Um texto completo. '.repeat(60) };
  const reader = ruleContent(entry, 'disciplines', game);
  assert.ok(reader.includes(entry.description));
  assert.ok(!reader.includes('<input'));
  assert.ok(reader.includes('Poderes e níveis'));
});
test('v9.2: assistente começa com atributos em um, identidade sem geração livre e narrativas opcionais', () => {
  const wizard = new CreationWizard({
    game,
    id: 123456,
    accountId: 'test',
    accountName: 'Jogador'
  });
  assert.ok(wizard.p.atributes.every((d) => d.value === 1));
  assert.equal(wizard.p.generation, 13);
  assert.ok(!wizard.render().includes('name="generation"'));
  wizard.step = 1;
  assert.ok(wizard.render().includes('data-creation-change="1"'));
  wizard.step = 10;
  assert.ok(wizard.render().includes('História do personagem'));
  assert.ok(wizard.render().includes('Ambição (opcional)'));
});
test('v9.2: renomear Geração/Recursos preserva cálculo pelo efeito e não recria o catálogo', () => {
  const renamed = clone(game);
  renamed.precedents.find((d) => d.id === background('Geração')).name = 'Pureza do sangue';
  renamed.precedents.find((d) => d.id === background('Recursos')).name = 'Patrimônio';
  const normalized = gameSettings(renamed),
    result = evaluateCreation(creationSource(game), normalized);
  assert.equal(normalized.precedents.length, game.precedents.length);
  assert.equal(result.character.generation, 11);
  assert.equal(result.character.money, 50000);
  assert.equal(result.report.issues.length, 0);
});
test('v9.2: limites permanentes das características também são respeitados na evolução com XP', () => {
  const source = creationSource(game);
  source.creation.traits = [{ id: trait('Monstruoso') }];
  source.creation = reconcileCreation(source.creation, game);
  const p = evaluateCreation(source, game).character;
  p.xp = 1000;
  assert.throws(() => upgradeQuote(p, game, 'atributes', 5, 1));
});
test('criação obrigatória: API recusa reservas incompletas, descarte de bônus e retirada do plano', async () => {
  const f = await fixture();
  for (const [key, family] of [
    ['atributes', 'atributes'],
    ['talents', 'talents'],
    ['precedents', 'precedents'],
    ['disciplines', 'disciplines']
  ]) {
    const source = creationSource(game);
    source.creation.initial[family][Object.keys(source.creation.initial[family])[0]]--;
    await rejected(() =>
      f.request('/api/submissions', 'POST', { character: source }, f.player.token)
    );
  }
  const source = creationSource(game);
  source.creation.bonus.precedents[background('Aliados')]--;
  await rejected(() =>
    f.request('/api/submissions', 'POST', { character: source }, f.player.token)
  );
  source.creation.bonus.precedents[background('Aliados')]++;
  const s = await f.request('/api/submissions', 'POST', { character: source }, f.player.token);
  source.creation.bonus.precedents[background('Aliados')]--;
  await rejected(() =>
    f.request(
      '/api/submissions/' + s.id,
      'PATCH',
      { character: source, revision: s._revision },
      f.player.token
    )
  );
  delete source.creation;
  await rejected(() =>
    f.request(
      '/api/submissions/' + s.id,
      'PATCH',
      { character: source, revision: s._revision },
      f.player.token
    )
  );
  const unchanged = await f.request('/api/submissions/' + s.id, 'GET', {}, f.player.token);
  assert.equal(unchanged._revision, s._revision);
  assert.equal(unchanged.report.totals.bonus.remaining, 0);
});
