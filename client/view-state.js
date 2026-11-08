// Merge only the server-authorized roster; an older in-flight read cannot undo
// a newer confirmed save. Test-player sandboxes have a separate revision scope.
export function applyPortalState(state, payload, playerTestId = '') {
  const scope = [payload.account.id, payload.campaign.id, playerTestId].join('|');
  if (Number.isSafeInteger(payload._portal_revision)) {
    if (state.portalRevisionScope === scope && payload._portal_revision < state.portalRevision)
      return false;
    state.portalRevisionScope = scope;
    state.portalRevision = payload._portal_revision;
  }
  const previousId = state.player?.id;
  state.account = payload.account;
  state.campaign = payload.campaign;
  if (payload.game) state.game = payload.game;
  if (payload.player_ids) {
    const players = new Map([...(state.players || []), ...payload.players].map((p) => [p.id, p]));
    state.players = payload.player_ids.map((id) => players.get(id)).filter(Boolean);
  } else state.players = payload.players;
  state.player =
    state.players.find((p) => p.id === previousId) ||
    (state.account.role === 'player' ? state.players[0] || null : null);
  state.campaigns = payload.campaigns;
  for (const key of ['notes', 'quests', 'submissions', 'notifications'])
    state[key] = payload.campaign[key];
  for (const key of ['accounts', 'social']) state[key] = payload[key];
  state.rewards = payload.rewards || null;
  state.registrations = payload.registrations || [];
  return true;
}
