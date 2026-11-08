import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPortalState } from '../../client/view-state.js';
const payload = (extra = {}) => ({
  account: { id: 'one', role: 'player' },
  campaign: { id: 'campaign', notes: [], quests: [], notifications: [], submissions: [] },
  game: { _revision: 1 },
  players: [
    { id: 1, _revision: 1, xp: 3 },
    { id: 2, _revision: 1, xp: 5 }
  ],
  player_ids: [1, 2],
  campaigns: [],
  accounts: [],
  social: { members: [] },
  _portal_revision: 1,
  ...extra
});
test('v10 tela: mantém livro e fichas intactas, mas remove fichas que perderam autorização', () => {
  const state = {};
  applyPortalState(state, payload());
  const game = state.game;
  applyPortalState(
    state,
    payload({
      game: null,
      players: [{ id: 2, _revision: 2, xp: 9 }],
      player_ids: [2],
      _portal_revision: 2
    })
  );
  assert.equal(state.game, game);
  assert.equal(state.players.length, 1);
  assert.equal(state.player.id, 2);
  assert.equal(state.player.xp, 9);
});
test('v10 tela: leitura antiga não desfaz crédito confirmado; mudança de campanha ou teste pode usar outra revisão', () => {
  const state = {};
  applyPortalState(
    state,
    payload({ _portal_revision: 10, players: [{ id: 1, xp: 30 }], player_ids: [1] })
  );
  assert.equal(applyPortalState(state, payload({ _portal_revision: 9 })), false);
  assert.equal(state.player.xp, 30);
  assert.equal(applyPortalState(state, payload({ _portal_revision: 0 }), 'sandbox'), true);
  assert.equal(state.player.xp, 3);
  assert.equal(applyPortalState(state, payload({ _portal_revision: 11 })), true);
  assert.equal(
    applyPortalState(state, payload({ campaign: { id: 'other' }, _portal_revision: 1 })),
    true
  );
});
