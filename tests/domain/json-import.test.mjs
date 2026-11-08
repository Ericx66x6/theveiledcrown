import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blank, clone, validateGame, validatePlayer } from '../../core/model.js';
import { gameSettings, validateSettings } from '../../core/settings.js';
import { validateWorkspace, workspaceExport } from '../../core/workspace.js';
import { jsonKind } from '../../core/json-kind.js';
import { parseWorkspaceFile } from '../../client/files.js';
import { portalFixture } from './fixture-v8.mjs';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
test('JSON: regras sem marcador e com formato explícito continuam válidas', () => {
  assert.equal(jsonKind(game), 'game');
  const marked = { ...clone(game), format: 'coroa-game-data-v1' };
  assert.doesNotThrow(() => validateSettings(gameSettings(validateGame(marked))));
  assert.equal(jsonKind(marked), 'game');
});
test('JSON: importar regras como backup ou ficha informa o caminho correto', async () => {
  const file = new File([JSON.stringify(game)], 'game_data.json', { type: 'application/json' });
  await assert.rejects(
    () => parseWorkspaceFile(file),
    /Livro de regras → Gerenciar livro → Importar game-data/
  );
  assert.throws(() => validatePlayer(game, game), /livro de regras/);
  assert.throws(() => validateGame({ id: 123456, char: 'Uma ficha' }), /ficha de personagem/);
});
test('JSON: backup de portal continua aceito e não pode ser confundido com um livro', async () => {
  const f = await portalFixture(),
    root = workspaceExport(f.store.root);
  assert.equal(jsonKind(root), 'workspace');
  assert.doesNotThrow(() => validateWorkspace(root));
  assert.throws(() => validateGame(root), /backup de campanha ou portal/);
});
test('JSON: importação de regras mantém custos personalizados, capítulos e fichas', async () => {
  const f = await portalFixture(),
    source = await f.call('/api/game'),
    before = await f.player();
  source.format = 'coroa-game-data-v1';
  source.discipline_market.default_cost = 15;
  source.rulebook = [
    {
      id: 'regras-personalizadas',
      title: 'A mesa',
      entries: [{ id: 'aviso', title: 'Um registro', body: 'Texto mantido.' }]
    }
  ];
  assert.equal((await f.call('/api/game', 'PUT', source)).status, 'saved');
  const after = await f.call('/api/game');
  assert.equal(after.discipline_market.default_cost, 15);
  assert.deepEqual(after.rulebook, source.rulebook);
  assert.deepEqual(await f.player(), before);
});
test('JSON: incompatibilidade identifica a ficha e mantém livro e personagens intactos', async () => {
  const f = await portalFixture(),
    source = await f.call('/api/game'),
    before = await f.player();
  source.maxvalue_generation[before.generation] = 2;
  await assert.rejects(
    () => f.call('/api/game', 'PUT', source),
    (e) => /Personagem 234567/.test(e.message) && /Nenhuma ficha foi alterada/.test(e.message)
  );
  assert.deepEqual(await f.player(), before);
  assert.equal(
    (await f.call('/api/game')).maxvalue_generation[before.generation],
    game.maxvalue_generation[before.generation]
  );
});
