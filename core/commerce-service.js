import { clone, fail, newId, number, text, timestamp, revision, publicPlayer } from './model.js';
import { imageData } from './image-data.js';
import { commit } from './service.js';
import { publicIntel, validateIntel } from './intel-state.js';
import { notification, notifyCampaign } from './notifications.js';
import { legacyCost } from './legacy-cost.js';
const admin = (a) => {
  if (a.role !== 'admin') fail('Somente o narrador cadastra informações.', 403);
};
function payer(doc, actor, id) {
  if (actor.role !== 'player' || !actor.character_ids.includes(id))
    fail('Escolha um personagem do seu acesso.', 403);
  const p = doc.characters.find((p) => p.id === id && !p.archived);
  if (!p) fail('Personagem indisponível.', 404);
  return p;
}
function purchaseId(data) {
  if (data.confirmed !== true) fail('Confirme a compra antes de gastar seus recursos.');
  const id = text(data.request_id, 'Identificador da compra', 100, true);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) fail('Identificador de compra inválido.');
  return id;
}
export async function commerceRequest(service, path, method, data, token, doc, actor) {
  if (path.startsWith('/api/discipline-market')) {
    const match = path.match(/^\/api\/discipline-market\/(\d+)\/acquire$/);
    if (!match || method !== 'POST') fail('Operação de legado inválida.', 405);
    const disciplineId = Number(match[1]);
    return service.write(token, (d, a) => {
      const requestId = purchaseId(data),
        p = payer(d, a, data.character_id);
      const known = p.disciplines.find((e) => e.id === disciplineId);
      if (known) {
        if (known.acquisition_request_id === requestId && known.acquired_by === a.id)
          return { character: publicPlayer(p), replayed: true };
        fail('Esse personagem já conhece a disciplina.', 409);
      }
      if (!d.game.discipline_market.allowed_ids.includes(disciplineId))
        fail('O narrador não liberou este legado.', 403);
      const def = d.game.disciplines.find((e) => e.id === disciplineId);
      if (!def) fail('Disciplina não encontrada.', 404);
      revision(p, data.character_revision);
      const cost = legacyCost(d.game, disciplineId);
      if (data.quoted_cost !== cost)
        fail('O preço deste legado mudou. Confira o valor e confirme novamente.', 409);
      if (p.xp < cost) fail(`Você precisa de ${cost} XP para despertar este legado.`);
      const next = clone(p);
      next.xp -= cost;
      next.disciplines.push({
        id: disciplineId,
        nivel: 0,
        acquired_at: timestamp(),
        acquired_by: a.id,
        acquisition_request_id: requestId
      });
      const character = commit(
        d,
        p,
        next,
        a,
        'Legado desperto',
        `${def.name} adquirida no nível 0 · −${cost} XP · saldo ${next.xp} XP.`
      );
      notification(d, {
        audience: 'account',
        recipient_id: a.id,
        title: 'Um novo legado: ' + def.name,
        message: `${p.char} adquiriu a disciplina por ${cost} XP. Evolua o nível 0 usando as regras da campanha.`,
        kind: 'legacy',
        target: String(disciplineId),
        created_by: a.id
      });
      return { character, replayed: false };
    });
  }
  const match = path.match(/^\/api\/intel(?:\/([^/]+))?(?:\/(purchase))?$/);
  if (!match) fail('Informação não encontrada.', 404);
  const [, id, action] = match;
  if (method === 'GET') {
    if (!id) return (doc.intel || []).map((e) => publicIntel(e, actor));
    const entry = (doc.intel || []).find((e) => e.id === id);
    if (!entry) fail('Informação não encontrada.', 404);
    return publicIntel(entry, actor);
  }
  return service.write(token, (d, a) => {
    d.intel ??= [];
    let entry = id ? d.intel.find((e) => e.id === id) : null;
    if (id && !entry) fail('Informação não encontrada.', 404);
    if (action === 'purchase') {
      if (method !== 'POST') fail('Use a confirmação de compra.', 405);
      const requestId = purchaseId(data),
        p = payer(d, a, data.character_id);
      if (entry.purchase) {
        if (
          entry.purchase.request_id === requestId &&
          entry.purchase.account_id === a.id &&
          entry.purchase.character_id === p.id
        )
          return { information: publicIntel(entry, a), character: publicPlayer(p), replayed: true };
        fail('Essa informação já foi revelada para a mesa. Atualize o arquivo.', 409);
      }
      if (typeof entry.secret !== 'string' || !entry.secret.trim())
        fail('O narrador precisa completar o conteúdo desta informação.');
      if (data.revision !== entry._revision) fail('A informação mudou. Revise a compra.', 409);
      revision(p, data.character_revision);
      if (data.quoted_xp !== entry.xp_cost || data.quoted_money !== entry.money_cost)
        fail('O preço mudou. Revise os valores.', 409);
      if (p.xp < entry.xp_cost) fail('XP insuficiente para essa investigação.');
      if (Math.round(p.money * 100) < Math.round(entry.money_cost * 100))
        fail('Dinheiro insuficiente para essa investigação.');
      const next = clone(p);
      next.xp -= entry.xp_cost;
      next.money = Math.round((p.money - entry.money_cost) * 100) / 100;
      if (entry.money_cost)
        next.transactions = [
          {
            id: newId(),
            at: timestamp(),
            amount: -entry.money_cost,
            before: p.money,
            after: next.money,
            reason: 'Investigação: ' + entry.title,
            actor: a.id
          },
          ...(p.transactions || [])
        ];
      const at = timestamp();
      entry.purchase = {
        request_id: requestId,
        account_id: a.id,
        account_name: a.display_name,
        character_id: p.id,
        character_name: p.char,
        xp_paid: entry.xp_cost,
        money_paid: entry.money_cost,
        at
      };
      entry._revision++;
      entry.updated_at = at;
      const character = commit(
        d,
        p,
        next,
        a,
        'Investigação concluída',
        `${entry.title} · −${entry.xp_cost} XP · −${entry.money_cost.toFixed(2)} em recursos. Informação revelada para toda a mesa.`
      );
      notifyCampaign(d, a, {
        kind: 'intel',
        title: 'O véu se abriu: ' + entry.title,
        message: `${a.display_name}, com ${p.char}, revelou uma informação para a campanha.`,
        target: entry.id
      });
      return { information: publicIntel(entry, a), character, replayed: false };
    }
    admin(a);
    if (method === 'DELETE') {
      if (!entry) fail('Informação não encontrada.', 404);
      if (data.revision !== entry._revision)
        fail('A informação mudou. Atualize antes de apagar.', 409);
      d.intel = d.intel.filter((e) => e.id !== id);
      return { status: 'deleted' };
    }
    if ((!id && method !== 'POST') || (id && method !== 'PATCH'))
      fail('Operação de informação inválida.', 405);
    if (!entry && d.intel.length >= 500) fail('Máximo de 500 informações por campanha.');
    if (entry && data.revision !== entry._revision)
      fail('A informação mudou. Atualize antes de salvar.', 409);
    const previous = entry || {
      id: newId(),
      created_at: timestamp(),
      created_by: a.id,
      _revision: 0,
      purchase: null
    };
    const next = {
      ...previous,
      title: text(data.title ?? entry?.title, 'Título', 200, true),
      teaser: text(data.teaser ?? entry?.teaser ?? '', 'Apresentação', 3000),
      category: data.category ?? entry?.category ?? 'Pista',
      cover: imageData(data.cover ?? entry?.cover ?? ''),
      secret: text(data.secret ?? entry?.secret, 'Conteúdo', 30000, true),
      images: clone(data.images ?? entry?.images ?? []),
      xp_cost: data.xp_cost ?? entry?.xp_cost ?? 0,
      money_cost: data.money_cost ?? entry?.money_cost ?? 0,
      _revision: previous._revision + 1,
      updated_at: timestamp()
    };
    validateIntel(next);
    if (entry) d.intel[d.intel.findIndex((e) => e.id === id)] = next;
    else d.intel.unshift(next);
    return publicIntel(next, a);
  });
}
