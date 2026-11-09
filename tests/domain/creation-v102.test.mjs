import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gameSettings, validateSettings, upgradeQuote } from '../../core/settings.js';
import { chooseClan, emptyCreation, evaluateCreation } from '../../core/character-creation.js';
import { catalogId, normalizedName } from '../../core/creation-config.js';
import { commonDisciplineNames } from '../../core/clan-guide.js';
import { creationSource } from './creation-fixture.mjs';
import { portalFixture, image } from './fixture-v8.mjs';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { validateWorkspace } from '../../core/workspace.js';
import { allocationControl, traitRestriction } from '../../client/creation-controls.js';
const raw = JSON.parse(
  await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8')
);
const game = gameSettings(raw);
const expectedCommon = commonDisciplineNames.map((name) => catalogId(game, 'disciplines', name));

test('10.2: campanhas anteriores ganham Caitiff e apresentação sem substituir regras personalizadas', () => {
  const old = structuredClone(raw);
  delete old.character_creation.clan_guide_version;
  old.character_creation.guided.clans = old.character_creation.guided.clans.filter(
    (c) => c.id !== 'caitiff'
  );
  old.character_creation.guided.clans[0].name = 'Assamita da minha mesa';
  old.character_creation.guided.initial.atributes = 16;
  const updated = validateSettings(gameSettings(old));
  assert.equal(updated.character_creation.guided.initial.atributes, 16);
  assert.equal(updated.character_creation.guided.clans[0].name, 'Assamita da minha mesa');
  assert.deepEqual(
    updated.character_creation.guided.clans.find((c) => c.id === 'caitiff').discipline_choices,
    expectedCommon
  );
  assert.equal(
    gameSettings(updated).character_creation.guided.clans.filter((c) => c.id === 'caitiff').length,
    1
  );
  const edited = structuredClone(updated);
  edited.character_creation.guided.clans[0].guide.description = 'Minha descrição personalizada.';
  assert.equal(
    gameSettings(edited).character_creation.guided.clans[0].guide.description,
    'Minha descrição personalizada.'
  );
  assert.deepEqual(updated.disciplines, game.disciplines);
  assert.deepEqual(
    updated.character_creation.guided.clans.find((c) => c.id === 'toreador').disciplines,
    [0, 1, 5]
  );
});

test('10.2: Caitiff escolhe exatamente três dons comuns, sem disciplinas exclusivas nem compra de níveis gratuita', async () => {
  const f = await portalFixture();
  const empty = chooseClan(emptyCreation(f.game), 'caitiff', f.game);
  assert.deepEqual(empty.disciplines, []);
  const source = creationSource(f.game, 'caitiff', 567890);
  const built = evaluateCreation(source, f.game);
  assert.deepEqual(built.report.issues, []);
  assert.equal(built.report.totals.disciplines.used, 3);
  assert.equal(built.character.xp, 0);
  const candidate = await f.call(
    '/api/submissions',
    'POST',
    { character: built.character },
    f.one.token
  );
  assert.equal(candidate.status, 'pending');
  assert.equal(
    (await f.call('/api/characters', 'GET', {}, f.one.token)).some((p) => p.id === 567890),
    false
  );
  const forbidden = structuredClone(source);
  forbidden.id = 567891;
  forbidden.creation.disciplines[2] = catalogId(f.game, 'disciplines', 'Demência');
  const invalid = evaluateCreation(forbidden, f.game);
  assert.ok(invalid.report.issues.some((i) => i.stage === 'identity' && i.key === 'disciplines'));
  await assert.rejects(
    () => f.call('/api/submissions', 'POST', { character: invalid.character }, f.one.token),
    (e) => e.status === 400
  );
});

test('10.2: fraqueza Nosferatu fixa Aparência em zero, preserva os 15 pontos e bloqueia XP só onde aplicável', () => {
  const source = creationSource(game, 'nosferatu');
  const { character, report } = evaluateCreation(source, game);
  const appearance = catalogId(game, 'atributes', 'Aparência');
  assert.equal(character.atributes.find((d) => d.id === appearance).value, 0);
  assert.deepEqual(report.issues, []);
  assert.equal(report.totals.atributes.used, 15);
  character.xp = 1000;
  assert.throws(() => upgradeQuote(character, game, 'atributes', appearance, 1), /valor fixo/);
  const tampered = structuredClone(source);
  tampered.creation.bonus.atributes[appearance] = 1;
  assert.ok(
    evaluateCreation(tampered, game).report.issues.some((i) =>
      i.message.includes('permanecer em 0')
    )
  );
  const legacy = structuredClone(character);
  delete legacy.creation;
  legacy.atributes.find((d) => d.id === appearance).value = 1;
  assert.equal(upgradeQuote(legacy, game, 'atributes', appearance, 2).target, 2);
});

test('10.2: controles explicam limites iniciais, saldo insuficiente e fraqueza sem permitir gastar pontos', () => {
  const source = creationSource(game, 'brujah');
  source.creation.bonus = Object.fromEntries(
    Object.keys(source.creation.bonus).map((k) => [k, {}])
  );
  let evaluated = evaluateCreation(source, game);
  const w = { game, plan: source.creation, source, report: evaluated.report };
  let state = allocationControl(w, 'atributes', 0, false);
  assert.equal(state.value, 4);
  assert.equal(state.canIncrease, false);
  assert.match(state.reason, /bônus/);
  state = allocationControl(w, 'talents', game.talents[0].id, false);
  assert.equal(state.cap, 3);
  assert.equal(state.canIncrease, false);
  state = allocationControl(w, 'atributes', 0, true);
  assert.equal(state.cap, 5);
  assert.equal(state.canIncrease, true);
  source.creation.bonus.precedents[catalogId(game, 'precedents', 'Aliados')] = 5;
  source.creation.bonus.precedents[catalogId(game, 'precedents', 'Contatos')] = 5;
  source.creation.bonus.precedents[catalogId(game, 'precedents', 'Mentor')] = 4;
  w.report = evaluateCreation(source, game).report;
  state = allocationControl(w, 'atributes', 0, true);
  assert.equal(state.remaining, 1);
  assert.equal(state.canIncrease, false);
  assert.match(state.reason, /4 PB/);
  const n = creationSource(game, 'nosferatu');
  const fixed = allocationControl(
    { game, plan: n.creation, source: n, report: evaluateCreation(n, game).report },
    'atributes',
    catalogId(game, 'atributes', 'Aparência'),
    false
  );
  assert.equal(fixed.fixed, 0);
  assert.equal(fixed.canIncrease, false);
  assert.match(fixed.reason, /Nosferatu/);
  const monstrous = game.caracteristics.find((d) => normalizedName(d.name) === 'monstruoso');
  assert.match(traitRestriction({ p: { cla: 'Nosferatu' } }, monstrous), /não está disponível/);
  assert.equal(traitRestriction({ p: { cla: 'Brujah' } }, monstrous), '');
});

test('10.2: um princípio por campanha, convicções pessoais e escopo protegido no servidor', async () => {
  const f = await portalFixture();
  const campaign = await f.call('/api/campaign');
  await f.call('/api/campaigns/' + f.campaign, 'PATCH', {
    revision: campaign._revision,
    moral_principle: 'Não sacrificar inocentes para proteger nossos segredos.'
  });
  await assert.rejects(
    () =>
      f.call(
        '/api/campaigns/' + f.campaign,
        'PATCH',
        { moral_principle: 'Só eu decido.' },
        f.one.token
      ),
    (e) => e.status === 403
  );
  const p = await f.player();
  await f.call(
    '/api/characters/' + p.id,
    'PATCH',
    {
      revision: p._revision,
      patch: { moralityes: [{ id: 0, description: 'Honrar acordos feitos livremente.' }] }
    },
    f.one.token
  );
  const state = await f.call('/api/portal-state', 'GET', {}, f.one.token);
  assert.equal(
    state.campaign.moral_principle,
    'Não sacrificar inocentes para proteger nossos segredos.'
  );
  assert.equal(state.players[0].moralityes[0].description, 'Honrar acordos feitos livremente.');
  await assert.rejects(
    async () =>
      f.call(
        '/api/characters/345678',
        'PATCH',
        { revision: (await f.player(345678))._revision, patch: { moralityes: [] } },
        f.one.token
      ),
    (e) => e.status === 403
  );
  const fresh = await f.call('/api/campaigns', 'POST', { title: 'Outra crônica' });
  assert.equal(fresh.moral_principle, '');
  assert.equal((await f.call('/api/campaign')).moral_principle, state.campaign.moral_principle);
});

test('10.2: retrato, enquadramento, história, fraqueza e convicções chegam à avaliação e ao backup', async () => {
  const f = await portalFixture();
  const source = creationSource(f.game, 'ventrue', 567892);
  Object.assign(source, {
    profilepicture: image,
    portrait_frame: { x: 32, y: 44, zoom: 1.4 },
    biography: 'Eu protegia o bairro. Agora protejo os seus segredos.',
    clan_flaw_detail: 'Mortais que lideram uma comunidade.',
    moralityes: [{ id: 0, description: 'Não trair quem confia em mim.' }]
  });
  const candidate = await f.call(
    '/api/submissions',
    'POST',
    { character: evaluateCreation(source, f.game).character },
    f.one.token
  );
  assert.equal(candidate.character.biography, source.biography);
  assert.equal(candidate.character.clan_flaw_detail, source.clan_flaw_detail);
  await f.call('/api/submissions/' + candidate.id + '/approve', 'POST', {
    revision: candidate._revision
  });
  const p = await f.player(567892);
  for (const key of [
    'profilepicture',
    'portrait_frame',
    'biography',
    'clan_flaw_detail',
    'moralityes'
  ])
    assert.deepEqual(p[key], source[key]);
  const root = await f.call('/api/json/workspace');
  const restored = validateWorkspace(assembleDocuments(workspaceDocuments(root)));
  assert.equal(
    restored.campaigns[0].characters.find((p) => p.id === 567892).clan_flaw_detail,
    source.clan_flaw_detail
  );
  assert.equal(Object.hasOwn(p, 'moral_principle'), false);
});

test('10.2: remover um dom do livro remove a opção Caitiff sem recriar o catálogo', async () => {
  const f = await portalFixture();
  const g = await f.call('/api/game'),
    id = catalogId(g, 'disciplines', 'Auspícios'),
    d = g.disciplines.find((d) => d.id === id);
  await f.call('/api/rulebook/catalog/disciplines/' + id, 'DELETE', {
    revision: g._revision,
    confirmation: d.name,
    remove_references: true
  });
  const updated = await f.call('/api/game');
  assert.equal(
    updated.disciplines.some((d) => d.id === id),
    false
  );
  assert.equal(
    updated.character_creation.guided.clans
      .find((c) => c.id === 'caitiff')
      .discipline_choices.includes(id),
    false
  );
  assert.equal(
    updated.character_creation.guided.clans.find((c) => c.id === 'caitiff').discipline_choices
      .length,
    7
  );
});
