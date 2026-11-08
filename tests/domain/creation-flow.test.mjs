import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clone } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
import { creationKeys, catalogId } from '../../core/creation-config.js';
import { evaluateCreation, reconcileCreation } from '../../core/character-creation.js';
import { creationSource } from './creation-fixture.mjs';
import { CreationWizard } from '../../client/creation-wizard.js';
import {
  creationStages,
  creationStepProblems,
  nextCreationStep,
  canReturnToCreationStep
} from '../../client/creation-flow.js';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
const report = (s) => evaluateCreation(s, game).report;
const next = (s, step) => nextCreationStep(step, s, report(s));
const clearBonus = (s) => {
  s.creation.bonus = Object.fromEntries(creationKeys.map((key) => [key, {}]));
};
test('criação: cada reserva inicial tem gasto exato e só então libera a etapa seguinte', () => {
  for (const [step, key, subkey] of [
    [1, 'atributes', 'atributes'],
    [2, 'skills', 'talents'],
    [3, 'precedents', 'precedents'],
    [4, 'disciplines', 'disciplines']
  ]) {
    const s = creationSource(game);
    assert.equal(next(s, step).target, step + 1);
    const id = Object.keys(s.creation.initial[subkey])[0];
    s.creation.initial[subkey][id]--;
    const blocked = next(s, step);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.problems.some((p) => p.key === key));
    s.creation.initial[subkey][id] += 2;
    assert.equal(next(s, step).allowed, false, 'não aceita um ponto a mais');
  }
});
test('criação: ordem fixa, sem salto pelo menu, voltar preserva a distribuição', () => {
  assert.deepEqual(
    creationStages.map((s) => s.phase + (s.key ? ':' + s.key : '')),
    [
      'identity',
      'initial:atributes',
      'initial:skills',
      'initial:precedents',
      'initial:disciplines',
      'traits',
      'bonus:atributes',
      'bonus:skills',
      'bonus:precedents',
      'bonus:disciplines',
      'review'
    ]
  );
  const source = creationSource(game),
    before = clone(source);
  for (let step = 0; step < 10; step++) {
    assert.equal(next(source, step).target, step + 1);
    assert.equal(canReturnToCreationStep(step, step + 1), false);
    assert.equal(canReturnToCreationStep(step, 10), false);
    if (step) assert.equal(canReturnToCreationStep(step, step - 1), true);
  }
  assert.equal(canReturnToCreationStep(3, -1), false);
  assert.deepEqual(source, before);
  source.creation.initial.atributes[0]--;
  assert.equal(next(source, 1).allowed, false, 'voltar e retirar um ponto trava novamente');
});
test('criação: nome, clã e linha inicial são obrigatórios antes dos atributos', () => {
  const s = creationSource(game, 'tremere');
  s.char = '';
  assert.equal(next(s, 0).allowed, false);
  s.char = 'Teste';
  delete s.creation.primary_paths[8];
  assert.equal(next(s, 0).allowed, false);
});
test('criação: bônus percorrem categorias sem precisar gastar toda a reserva na primeira', () => {
  const s = creationSource(game);
  clearBonus(s);
  for (const step of [5, 6, 7, 8]) {
    assert.equal(next(s, step).allowed, true);
    assert.equal(next(s, step).target, step + 1);
  }
  assert.deepEqual(next(s, 9), { allowed: true, target: 6, problems: [], loop: true });
  assert.equal(next(s, 10).allowed, false);
  assert.ok(report(s).issues.some((i) => i.key === 'bonus'));
  assert.ok(!report(s).warnings.some((w) => /não utilizados/.test(w)));
});
test('criação: saldo ímpar retorna pelo ciclo e zera nos antecedentes, sem descarte', () => {
  const s = creationSource(game);
  s.creation.bonus.precedents[catalogId(game, 'precedents', 'Aliados')]--;
  assert.equal(report(s).totals.bonus.remaining, 1);
  assert.equal(next(s, 9).loop, true);
  s.creation.bonus.precedents[catalogId(game, 'precedents', 'Aliados')]++;
  assert.equal(next(s, 9).target, 10);
  assert.deepEqual(creationStepProblems(10, s, report(s)), []);
});
test('criação: requisitos de qualidades podem ser atendidos na categoria de bônus correta', () => {
  const s = creationSource(game);
  clearBonus(s);
  s.creation.initial.atributes[3] = 2;
  s.creation.initial.atributes[5] = 3;
  s.creation.traits = [{ id: catalogId(game, 'caracteristics', 'Líder Nato') }];
  assert.equal(next(s, 5).allowed, true);
  assert.equal(next(s, 6).allowed, false);
  s.creation.bonus.atributes[3] = 1;
  assert.equal(next(s, 6).allowed, true);
});
test('criação: característica que devolve pontos iniciais exige redistribuição antes dos bônus', () => {
  const s = creationSource(game);
  s.creation.initial.atributes[0] = 2;
  s.creation.initial.atributes[5] = 3;
  s.creation.bonus.atributes = {};
  s.creation.traits = [{ id: catalogId(game, 'caracteristics', 'Monstruoso') }];
  s.creation = reconcileCreation(s.creation, game);
  assert.equal(report(s).totals.atributes.used, 13);
  const gate = next(s, 5);
  assert.equal(gate.allowed, false);
  assert.ok(gate.problems.some((p) => p.step === 1));
  s.creation.initial.atributes[0] = 4;
  assert.equal(next(s, 5).allowed, true);
});
test('criação: limites de defeitos devolvem investimentos e não afetam disciplinas fora do clã', () => {
  const s = creationSource(game);
  s.creation.traits = [
    { id: catalogId(game, 'caracteristics', 'Criança') },
    { id: catalogId(game, 'caracteristics', 'Estatura Baixa') }
  ];
  s.creation = reconcileCreation(s.creation, game);
  assert.equal(s.creation.initial.atributes[0], 2);
  assert.equal(s.creation.bonus.atributes[0], 0);
  assert.equal(s.creation.initial.atributes[2], 2);
  assert.equal(next(s, 5).allowed, false);
  const offClan = creationSource(game);
  offClan.creation.traits = [{ id: catalogId(game, 'caracteristics', 'Taumaturgicamente Inapto') }];
  offClan.creation = reconcileCreation(offClan.creation, game);
  assert.ok(!Object.hasOwn(offClan.creation.initial.disciplines, 8));
});
test('criação: uma só categoria por tela, controles futuros bloqueados e envio só na revisão', () => {
  const source = creationSource(game);
  const wizard = new CreationWizard({
    game,
    character: source,
    accountId: 'flow-test',
    accountName: 'Teste'
  });
  wizard.step = 1;
  let html = wizard.render();
  assert.ok(html.includes('Distribua seus atributos.'));
  assert.ok(!html.includes('data-creation-change="1" data-key="talents"'));
  assert.ok(html.includes('data-create-step="2" disabled'));
  assert.ok(!html.includes('type="submit"'));
  wizard.step = 5;
  html = wizard.render();
  assert.ok(html.includes('Primeiro, suas qualidades e defeitos.'));
  assert.ok(!html.includes('data-creation-change'));
  wizard.step = 9;
  clearBonus(wizard.source);
  wizard.plan = wizard.source.creation;
  assert.ok(wizard.render().includes('Distribuir bônus restantes (15)'));
});
test('criação: proposta legada conserva textos e exige reconstruir os pontos pelo assistente', () => {
  const legacy = evaluateCreation(creationSource(game), game).character;
  legacy.biography = 'Uma história que precisa continuar na proposta.';
  delete legacy.creation;
  const wizard = new CreationWizard({
    game,
    character: legacy,
    accountId: 'legacy-flow',
    accountName: 'Teste'
  });
  assert.equal(wizard.source.char, legacy.char);
  assert.equal(wizard.source.biography, legacy.biography);
  assert.ok(wizard.p.atributes.every((r) => r.value === 1));
  assert.equal(wizard.report.totals.bonus.remaining, 15);
  assert.equal(nextCreationStep(0, wizard.currentSource(), wizard.report).allowed, false);
  assert.ok(wizard.render().includes('Esta proposta é anterior ao assistente.'));
});
