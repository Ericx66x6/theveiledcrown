import { blank } from '../../core/model.js';
import { emptyCreation, chooseClan, evaluateCreation } from '../../core/character-creation.js';
import { catalogId, skillKeys } from '../../core/creation-config.js';
export function creationSource(game, clan = 'brujah', id = 567890) {
  const source = blank(game, id);
  Object.assign(source, { char: 'Personagem da criação', player: 'Jogador de testes' });
  const plan = chooseClan(emptyCreation(game), clan, game);
  const options = game.character_creation.guided.clans.find(
    (c) => c.id === clan
  )?.discipline_choices;
  if (options) {
    plan.disciplines = options.slice(0, 3);
    plan.initial.disciplines = Object.fromEntries(plan.disciplines.map((id) => [id, 0]));
  }
  for (const d of game.atributes.slice(0, 5)) plan.initial.atributes[d.id] = 4;
  for (const [key, d] of skillKeys.flatMap((key) => game[key].map((d) => [key, d])).slice(0, 9))
    plan.initial[key][d.id] = 3;
  plan.initial.precedents[catalogId(game, 'precedents', 'Geração')] = 2;
  plan.initial.precedents[catalogId(game, 'precedents', 'Recursos')] = 3;
  plan.initial.disciplines[plan.disciplines[0]] = 2;
  plan.initial.disciplines[plan.disciplines[1]] = 1;
  for (const id of plan.disciplines)
    if (game.disciplines.find((d) => d.id === id)?.is_path_parent)
      plan.primary_paths[id] = game.disciplines.find((d) =>
        d.parent_discipline_ids?.includes(id)
      ).id;
  plan.bonus.atributes[game.atributes[0].id] = 1;
  plan.bonus.talents[game.talents[0].id] = 1;
  plan.bonus.disciplines[plan.disciplines[2]] = 1;
  plan.bonus.precedents[catalogId(game, 'precedents', 'Aliados')] = 3;
  source.creation = plan;
  return source;
}
export const createdCharacter = (game, clan = 'brujah', id) =>
  evaluateCreation(creationSource(game, clan, id), game).character;
