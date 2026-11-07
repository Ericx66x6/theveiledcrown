import { clone, fail, newId, timestamp, validatePlayer } from './model.js';
import { gameSettings, validateSettings } from './settings.js';
import { commit } from './service.js';
import { requireAdmin } from './management-service.js';
const catalogs = [
  'atributes',
  'talents',
  'expertises',
  'knowledges',
  'precedents',
  'disciplines',
  'rituals',
  'caracteristics'
];
export async function deleteCatalogEntry(service, key, id, data, token) {
  return service.write(token, (d, a) => {
    requireAdmin(a);
    if (!catalogs.includes(key)) fail('Catálogo inválido.');
    const entry = d.game[key].find((e) => e.id === id);
    if (!entry) fail('Conteúdo não encontrado.', 404);
    if (data.confirmation?.trim() !== entry.name) fail('Digite o nome do conteúdo para remover.');
    if (data.revision !== d.game._revision)
      fail('O livro mudou. Reabra o conteúdo antes de remover.', 409);
    const affected = d.characters.filter((p) => p[key].some((e) => e.id === id)),
      pending = d.submissions.filter(
        (s) =>
          !['approved', 'rejected'].includes(s.status) && s.character[key].some((e) => e.id === id)
      );
    if ((affected.length || pending.length) && data.remove_references !== true)
      fail('Este conteúdo é usado em fichas. Confirme a remoção dos vínculos.');
    const previous = clone(d.game),
      g = clone(d.game);
    g[key] = g[key].filter((e) => e.id !== id);
    if (key === 'disciplines') {
      g.discipline_market.allowed_ids = g.discipline_market.allowed_ids.filter((x) => x !== id);
      delete g.discipline_market.costs[id];
      for (const clan of g.character_creation.guided.clans)
        clan.disciplines = clan.disciplines.map((x) => (x === id ? null : x));
      for (const d of g.disciplines)
        if (d.parent_discipline_ids)
          d.parent_discipline_ids = d.parent_discipline_ids.filter((x) => x !== id);
    }
    for (const d of g.caracteristics) {
      const e = d.creation_effects;
      if (!e) continue;
      if (key === 'caracteristics')
        for (const k of ['requires_traits', 'excludes'])
          if (e[k]) e[k] = e[k].filter((x) => x !== id);
      for (const k of key === 'atributes'
        ? ['attribute_set', 'attribute_caps']
        : key === 'disciplines'
          ? ['discipline_grants', 'discipline_caps']
          : [])
        if (e[k]) e[k] = e[k].filter((x) => x.id !== id);
      if (key === 'disciplines' && e.forbidden_disciplines)
        e.forbidden_disciplines = e.forbidden_disciplines.filter((x) => x !== id);
      if (e.minimums) e.minimums = e.minimums.filter((x) => x.key !== key || x.id !== id);
    }
    g._revision++;
    d.game = validateSettings(gameSettings(g));
    d.snapshots.push({ id: newId(), at: timestamp(), kind: 'game', data: previous });
    for (const p of affected) {
      const next = clone(p);
      next[key] = next[key].filter((e) => e.id !== id);
      if (key === 'disciplines' && next.primary_paths)
        next.primary_paths = Object.fromEntries(
          Object.entries(next.primary_paths).filter(
            ([parent, path]) => Number(parent) !== id && path !== id
          )
        );
      commit(d, p, next, a, 'Regra removida pelo narrador', entry.name);
    }
    for (const s of pending) {
      s.character[key] = s.character[key].filter((e) => e.id !== id);
      if (key === 'disciplines' && s.character.primary_paths)
        s.character.primary_paths = Object.fromEntries(
          Object.entries(s.character.primary_paths).filter(
            ([parent, path]) => Number(parent) !== id && path !== id
          )
        );
      s._revision++;
      s.review_revision++;
      s.updated_at = timestamp();
    }
    d.snapshots = d.snapshots.slice(-30);
    for (const p of d.characters) validatePlayer(p, d.game);
    return {
      status: 'deleted',
      affected_characters: affected.length,
      affected_submissions: pending.length
    };
  });
}
