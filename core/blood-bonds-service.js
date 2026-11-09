import { clone, fail, newId, number, text, timestamp, revision } from './model.js';
import { commit } from './service.js';
import { imageData } from './image-data.js';
import { rewardEvent } from './reward-events.js';
import { bloodStages } from './blood-bond-state.js';
export async function bloodBondsRequest(service, path, { method = 'GET', data = {}, token } = {}) {
  const match = path.match(
    /^\/api\/characters\/(\d+)\/blood-bonds(?:\/([^/]+))?(?:\/(renew|weaken))?$/
  );
  if (!match) fail('Laço não encontrado.', 404);
  const [, charId, id, action] = match,
    doc = await service.store.get(),
    actor = service.auth(doc, token);
  const scoped = (d, a) => {
    const p = d.characters.find((p) => p.id === Number(charId));
    if (!p) fail('Personagem não encontrado.', 404);
    if (a.role !== 'admin' && !a.character_ids.includes(p.id))
      fail('Este laço pertence a outro personagem.', 403);
    return p;
  };
  const p = scoped(doc, actor);
  if (method === 'GET') return clone(p.blood_bonds || []);
  if (doc.status === 'closed') fail('A campanha está encerrada.', 409);
  return service.write(token, (d, a) => {
    const previous = scoped(d, a);
    if (previous.archived) fail('A ficha está arquivada.', 409);
    revision(previous, data.character_revision);
    const next = clone(previous);
    next.blood_bonds ??= [];
    let bond = id ? next.blood_bonds.find((b) => b.id === id) : null;
    if ((id || action || method === 'DELETE') && !bond) fail('Laço não encontrado.', 404);
    if (bond && bond._revision !== data.revision)
      fail('O laço mudou. Revise antes de continuar.', 409);
    if (data.confirmed !== true) fail('Confirme a alteração do laço de sangue.');
    const before = bond ? clone(bond) : null;
    if (method === 'DELETE') {
      next.blood_bonds = next.blood_bonds.filter((b) => b.id !== id);
      return commit(d, previous, next, a, 'Laço de sangue removido', bond.name);
    }
    if (action) {
      if (method !== 'POST') fail('Operação inválida.', 405);
      if (action === 'renew') {
        bond.stage = 'fervor';
        bond.last_scene = text(data.last_scene ?? bond.last_scene, 'Último contato', 3000);
        if (data.strengthen === true) bond.level = Math.min(5, bond.level + 1);
        if (bond.level === 0) fail('Marque reforçar para reatar um vínculo rompido.');
      } else {
        if (bond.stage !== 'fading' || bond.level < 1)
          fail('Marque o vínculo à beira da ruptura antes de enfraquecê-lo.');
        bond.level--;
        bond.stage = bond.level ? 'distant' : 'fading';
      }
    } else {
      if (!['POST', 'PATCH'].includes(method) || (!id && method !== 'POST'))
        fail('Operação inválida.', 405);
      if (
        !['bound_to', 'holds'].includes(data.direction) ||
        !bloodStages.some((s) => s.id === data.stage)
      )
        fail('Escolha direção e estado do vínculo.');
      const fields = {
        name: text(data.name, 'Nome', 150, true),
        description: text(data.description || '', 'Descrição', 15000),
        last_scene: text(data.last_scene || '', 'Último contato', 3000),
        image: imageData(data.image || ''),
        level: number(data.level, 'Nível', 0, 5),
        stage: data.stage,
        direction: data.direction
      };
      if (bond) Object.assign(bond, fields);
      else {
        bond = { id: newId(), ...fields, _revision: 0, created_by: a.id, created_at: timestamp() };
        next.blood_bonds.push(bond);
      }
    }
    bond._revision++;
    bond.updated_at = timestamp();
    const saved = commit(
      d,
      previous,
      next,
      a,
      action === 'weaken'
        ? 'Laço enfraquecido'
        : action === 'renew'
          ? 'Sangue renovado'
          : before
            ? 'Laço de sangue atualizado'
            : 'Laço de sangue registrado',
      `${bond.name} · nível ${before?.level ?? 0} → ${bond.level} · ${bloodStages.find((s) => s.id === bond.stage).name}`
    );
    const owner = d.accounts.find(
      (a) => a.role === 'player' && a.character_ids.includes(previous.id)
    );
    const raised =
      bond.level > 0 &&
      (!before ||
        bond.level > before.level ||
        action === 'renew' ||
        bond.direction !== before.direction);
    const lowered = before && bond.level < before.level;
    if (owner && (raised || lowered))
      rewardEvent(d, owner, {
        kind: 'blood-bond',
        character_id: previous.id,
        character_name: previous.char,
        subject: bond.name,
        level: bond.level,
        direction: bond.direction,
        polarity: raised
          ? bond.direction === 'bound_to'
            ? 'bound'
            : 'dominion'
          : bond.direction === 'bound_to'
            ? 'release'
            : 'loss'
      });
    return saved;
  });
}
