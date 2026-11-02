import { clone, fail, number, text, timestamp } from './model.js';
import { requireAdmin, notification } from './management-service.js';
import { commit } from './service.js';
export async function distributeXp(service, data, token) {
  return service.write(token, (doc, actor) => {
    requireAdmin(actor);
    if (data.confirmed !== true) fail('Confirme a distribuição de XP.');
    const id = text(data.request_id, 'Identificador da distribuição', 100, true);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) fail('Identificador da distribuição inválido.');
    const amount = number(data.amount, 'XP por personagem', 1, 100000);
    const reason = text(data.reason, 'Motivo', 500, true);
    const ids = data.character_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
      fail('Selecione personagens diferentes para receber XP.');
    doc.xp_distributions ??= [];
    const fingerprint = JSON.stringify({ ids: [...ids].sort((a, b) => a - b), amount, reason });
    const previous = doc.xp_distributions.find((entry) => entry.id === id);
    if (previous) {
      if (previous.actor !== actor.id || previous.fingerprint !== fingerprint)
        fail('Identificador já utilizado.', 409);
      return clone(previous.result);
    }
    const changes = ids.map((id) => {
      const p = doc.characters.find((p) => p.id === id && !p.archived);
      if (!p) fail('Uma das fichas não existe ou está arquivada.', 409);
      if (data.revisions?.[id] !== p._revision)
        fail('Uma ficha mudou. Atualize a distribuição.', 409);
      const next = clone(p);
      next.xp = number(p.xp + amount, 'XP acumulado');
      return [p, next];
    });
    for (const [p, next] of changes) {
      commit(doc, p, next, actor, 'XP distribuído', `+${amount} XP · ${reason}`);
      const owner = doc.accounts.find((a) => a.role === 'player' && a.character_ids.includes(p.id));
      if (owner)
        notification(doc, {
          audience: 'account',
          recipient_id: owner.id,
          kind: 'xp',
          title: `${p.char} recebeu ${amount} XP`,
          message: reason
        });
    }
    const result = { amount, character_ids: clone(ids), count: ids.length, reason };
    doc.xp_distributions.push({ id, actor: actor.id, fingerprint, at: timestamp(), result });
    return result;
  });
}
