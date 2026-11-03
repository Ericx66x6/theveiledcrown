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
    if (key === 'disciplines')
      g.discipline_market.allowed_ids = g.discipline_market.allowed_ids.filter((x) => x !== id);
    g._revision++;
    d.game = validateSettings(gameSettings(g));
    d.snapshots.push({ id: newId(), at: timestamp(), kind: 'game', data: previous });
    for (const p of affected) {
      const next = clone(p);
      next[key] = next[key].filter((e) => e.id !== id);
      commit(d, p, next, a, 'Regra removida pelo narrador', entry.name);
    }
    for (const s of pending) {
      s.character[key] = s.character[key].filter((e) => e.id !== id);
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
