export function legacyCost(game, id) {
  return game.discipline_market.costs?.[id] ?? game.discipline_market.default_cost ?? 10;
}
