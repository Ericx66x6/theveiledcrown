import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blank } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
import { powerAccess } from '../../core/power-access.js';
import { consultationPage } from '../../client/consultation.js';
import { powerAction } from '../../client/power-pool.js';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
function fixture(level = 2, index = 0) {
  const p = blank(game, 567890),
    d = game.disciplines[0];
  Object.assign(p, { char: 'Marina', player: 'Teste', cla: 'Toreador' });
  p.disciplines = [{ id: d.id, nivel: level }];
  p.knowledges.find((r) => r.id === 8).value = 2;
  p.expertises.find((r) => r.id === 4).value = 3;
  return {
    p,
    d,
    ctx: {
      state: { game, powerDetail: { key: 'disciplines', id: d.id, index } },
      player: () => p,
      admin: () => false
    }
  };
}
test('poderes: níveis adquiridos, bloqueados, nível zero e consulta sem ficha são distintos', () => {
  const { p, d } = fixture();
  assert.equal(powerAccess(p, 'disciplines', d, d.nivels[1]).available, true);
  assert.equal(powerAccess(p, 'disciplines', d, d.nivels[2]).state, 'locked');
  p.disciplines[0].nivel = 0;
  assert.ok(d.nivels.every((n) => powerAccess(p, 'disciplines', d, n).state === 'locked'));
  p.disciplines = [];
  assert.equal(powerAccess(p, 'disciplines', d, d.nivels[0]).state, 'locked');
  assert.equal(powerAccess(null, 'disciplines', d, d.nivels[0]).state, 'reference');
});
test('poderes: abas usam rótulos e ícones; bloqueados podem ser consultados com aviso explícito', () => {
  const { ctx, d } = fixture(2, 2),
    html = consultationPage(ctx);
  assert.ok(html.includes('2 de ' + d.nivels.length + ' poderes liberados'));
  assert.ok(html.includes('LIBERADO'));
  assert.ok(html.includes('BLOQUEADO'));
  assert.ok(html.includes('PODER BLOQUEADO'));
  assert.ok(html.includes('Sua ficha está no nível 2'));
  assert.ok(html.includes(d.nivels[2].description));
  assert.ok(html.includes('class="is-locked active"'));
  assert.ok(!html.includes('class="is-locked active" disabled'));
});
test('poderes: disponibilidade é recalculada após evolução e ao trocar a ficha', () => {
  const { ctx, p } = fixture(2, 2);
  assert.ok(consultationPage(ctx).includes('PODER BLOQUEADO'));
  p.disciplines[0].nivel = 3;
  assert.ok(consultationPage(ctx).includes('LIBERADO PARA USAR'));
  const another = blank(game, 678901);
  ctx.player = () => another;
  assert.ok(consultationPage(ctx).includes('0 de '));
  assert.ok(consultationPage(ctx).includes('PODER BLOQUEADO'));
});
test('poderes: não mostra bloqueio de personagem ao narrador sem uma ficha aberta', () => {
  const { ctx } = fixture();
  ctx.player = () => null;
  ctx.admin = () => true;
  const html = consultationPage(ctx);
  assert.ok(!html.includes('BLOQUEADO'));
  assert.ok(!html.includes('NÍVEL NA FICHA'));
  assert.ok(html.includes('CONSULTA'));
});
test('poderes: rolagem bloqueada é recusada também pelo manipulador; adquirida prepara o teste', async () => {
  const { ctx, d } = fixture(1);
  const moves = [];
  ctx.go = async (view) => moves.push(view);
  // Aura usa Percepção + Empatia; os níveis não adquiridos só oferecem prévia.
  const data = { catalog: 'disciplines', discipline: d.id, index: 1 };
  await assert.rejects(() => powerAction('power-prepare-roll', data, ctx), /bloqueado/);
  assert.deepEqual(moves, []);
  ctx.player().disciplines[0].nivel = 2;
  await powerAction('power-prepare-roll', data, ctx);
  assert.deepEqual(moves, ['dice']);
  assert.ok(ctx.state.preparedRoll.pool > 0);
});
test('poderes: rituais exigem presença na ficha, e não o nível de outra disciplina', () => {
  const { p } = fixture(5),
    ritual = game.rituals[0];
  assert.equal(powerAccess(p, 'rituals', ritual).state, 'locked');
  p.rituals = [{ id: ritual.id }];
  assert.equal(powerAccess(p, 'rituals', ritual).available, true);
});
