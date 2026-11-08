import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gameSettings, validateSettings } from '../../core/settings.js';
import { validateGame, blank } from '../../core/model.js';
import { resolvePowerTest } from '../../core/power-tests.js';
test('catálogo: IDs e níveis antigos preservados, 22 originais, metas em 6+ e testes reconhecidos', async () => {
  const g = gameSettings(
    validateGame(
      JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
    )
  );
  validateSettings(g);
  assert.equal(g.rituals.length, 44);
  assert.equal(g.rituals.filter((r) => r.origin === 'original').length, 22);
  assert.equal(g.rituals.filter((r) => r.origin === 'adapted').length, 8);
  const originalLevels = [2, 2, 2, 2, 4, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 5];
  for (const [id, nivel] of originalLevels.entries())
    assert.equal(g.rituals.find((r) => r.id === id).nivel, nivel);
  const p = blank(g, 123456);
  for (const ritual of g.rituals) {
    assert.equal(ritual.casting.success_on, 6);
    assert.ok(ritual.casting.required_successes >= 1);
    assert.equal(typeof ritual.mechanics.rouse_check, 'boolean');
    assert.ok(resolvePowerTest(p, g, ritual.mechanics.test).complete);
    assert.ok(ritual.description.length < 1200);
  }
});
