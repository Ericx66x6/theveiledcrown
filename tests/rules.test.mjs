import test from 'node:test';
import assert from 'node:assert/strict';
import { xpCost, rollD10 } from '../shared/rules.js';
test('custo da campanha preserva a evolução do nível atual', () => {
  assert.equal(xpCost(0, 1, 5), 5);
  assert.equal(xpCost(1, 3, 5), 15);
  assert.equal(xpCost(3, 4, 5), 15);
});
test('fome substitui dados comuns sem aumentar a parada', () => {
  const result = rollD10(3, 6, 6, () => 0.5);
  assert.equal(result.dice.length, 3);
  assert.equal(result.dice.filter((d) => d.hunger).length, 3);
  assert.equal(result.successes, 3);
});
test('dificuldade não adiciona críticos automáticos', () => {
  let values = [0, 0.9, 0.5, 0.4];
  const result = rollD10(4, 1, 6, () => values.shift());
  assert.deepEqual(
    result.dice.map((d) => d.value),
    [1, 10, 6, 5]
  );
  assert.equal(result.successes, 2);
  assert.equal(result.dice[0].hunger, true);
});
