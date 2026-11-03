import { clone, fail, newId, timestamp, validatePlayer, publicPlayer } from './model.js';
import { commit } from './service.js';
export const requireAdmin = (a) => {
  if (a.role !== 'admin') fail('Ação exclusiva do narrador.', 403);
};
export function notification(
  doc,
  {
    audience = 'gm',
    recipient_id = null,
    title,
    message = '',
    target = '',
    kind = 'submission',
    created_by = null
  }
) {
  const n = {
    id: newId(),
    audience,
    recipient_id,
    title,
    message,
    target,
    kind,
    created_by,
    hidden_by: [],
    created_at: timestamp(),
    read_by: []
  };
  doc.notifications.unshift(n);
  doc.notifications = doc.notifications.slice(0, 500);
  return n;
}
export function assertRevision(item, data) {
  if (data.revision !== item._revision) fail('O registro mudou. Atualize antes de continuar.', 409);
}
export async function assignCharacter(service, id, data, token) {
  return service.write(token, (d, a) => {
    requireAdmin(a);
    const p = d.characters.find((p) => p.id === id);
    if (!p) fail('Ficha não encontrada.', 404);
    assertRevision(p, data);
    const target = data.account_id
      ? d.accounts.find((x) => x.id === data.account_id && x.role === 'player' && x.active)
      : null;
    if (data.account_id && !target) fail('Escolha uma conta de jogador ativa.');
    for (const other of d.accounts)
      other.character_ids = other.character_ids.filter((pid) => pid !== id);
    if (target) {
      target.character_ids.push(id);
      target._campaign_member = true;
    }
    const next = clone(p);
    next.owner_id = target?.id || '';
    if (target) next.player = target.display_name;
    return commit(
      d,
      p,
      next,
      a,
      'Controle da ficha alterado',
      target ? 'Transferida para ' + target.display_name : 'Sem jogador responsável'
    );
  });
}
export async function deleteCharacter(service, id, data, token) {
  return service.write(token, (d, a) => {
    requireAdmin(a);
    const p = d.characters.find((p) => p.id === id);
    if (!p) fail('Ficha não encontrada.', 404);
    assertRevision(p, data);
    if (data.confirmation?.trim() !== p.char) fail('Digite o nome do personagem para remover.');
    const links = d.accounts.filter((a) => a.character_ids.includes(id)).map((a) => a.id);
    d.deleted_characters.push({
      id: newId(),
      character: clone(p),
      account_ids: links,
      deleted_at: timestamp(),
      deleted_by: a.id
    });
    d.characters = d.characters.filter((x) => x.id !== id);
    for (const account of d.accounts)
      account.character_ids = account.character_ids.filter((pid) => pid !== id);
    d.retired_roster = d.retired_roster.filter((p) => p.id !== id);
    d.retired_roster.push({ id, char: p.char, deleted: true });
    for (const q of d.quests)
      if (!['completed', 'cancelled'].includes(q.status) && q.assignees.includes(id)) {
        q.assignees = q.assignees.filter((pid) => pid !== id);
        if (!q.assignees.length) q.status = 'cancelled';
        q._revision++;
        q.updated_at = timestamp();
      }
    for (const m of d.maps)
      for (const pin of m.pins)
        if (pin.character_id === id) {
          pin.character_id = null;
          pin._revision++;
        }
    return { status: 'deleted', id };
  });
}
export async function deleteAccount(service, id, data, token) {
  let result;
  await service.store.atomic((root) => {
    const actor = service.auth(root, token);
    requireAdmin(actor);
    const target = root.accounts.find((a) => a.id === id);
    if (!target) fail('Jogador não encontrado.', 404);
    if (target.id === actor.id) fail('Use o reset do portal para remover seu próprio acesso.');
    if (
      target.role === 'admin' &&
      !root.accounts.some((a) => a.id !== id && a.role === 'admin' && a.active)
    )
      fail('Mantenha ao menos um narrador ativo.');
    if (data.confirmation?.trim() !== target.username)
      fail('Digite o login do jogador para remover.');
    root.deleted_accounts.push({
      id: newId(),
      account: clone(target),
      deleted_at: timestamp(),
      deleted_by: actor.id
    });
    root.accounts = root.accounts.filter((a) => a.id !== id);
    root.sessions = root.sessions.filter((s) => s.account !== id);
    for (const c of root.campaigns) {
      for (const p of c.characters) if (p.owner_id === id) p.owner_id = '';
      for (const s of c.submissions)
        if (s.created_by === id && !['approved', 'rejected'].includes(s.status)) {
          s.status = 'rejected';
          s.review_note = 'Conta removida pelo narrador.';
          s.review_revision++;
          s._revision++;
        }
    }
    result = { status: 'deleted', id };
    return root;
  });
  return result;
}
export function trashList(root, campaign) {
  return {
    characters: campaign.deleted_characters.map((r) => ({
      id: r.id,
      title: r.character.char,
      detail: r.character.player,
      deleted_at: r.deleted_at
    })),
    maps: campaign.deleted_maps.map((r) => ({
      id: r.id,
      title: r.map.title,
      detail: 'Mapa',
      deleted_at: r.deleted_at
    })),
    accounts: root.deleted_accounts.map((r) => ({
      id: r.id,
      title: r.account.display_name,
      detail: r.account.username,
      deleted_at: r.deleted_at
    }))
  };
}
export async function restoreTrash(service, type, id, token) {
  let result;
  await service.store.atomic((root) => {
    const a = service.auth(root, token);
    requireAdmin(a);
    const c = root.campaigns.find((c) => c.id === root.active_campaign_id);
    if (type === 'accounts') {
      const entry = root.deleted_accounts.find((r) => r.id === id);
      if (!entry) fail('Conta removida não encontrada.', 404);
      const account = clone(entry.account);
      if (root.accounts.some((a) => a.id === account.id || a.username === account.username))
        fail('Já existe uma conta com este login ou ID.', 409);
      account.session_version++;
      for (const [cid, ids] of Object.entries(account.memberships)) {
        const campaign = root.campaigns.find((c) => c.id === cid);
        if (!campaign) {
          delete account.memberships[cid];
          continue;
        }
        account.memberships[cid] = ids.filter(
          (id) =>
            campaign.characters.some((p) => p.id === id) &&
            !root.accounts.some((a) => a.memberships?.[cid]?.includes(id))
        );
      }
      root.accounts.push(account);
      root.deleted_accounts = root.deleted_accounts.filter((r) => r.id !== id);
      result = { status: 'restored' };
      return root;
    }
    if (c.status === 'closed') fail('Reabra a campanha antes de restaurar registros.', 409);
    if (type === 'characters') {
      const entry = c.deleted_characters.find((r) => r.id === id);
      if (!entry) fail('Ficha removida não encontrada.', 404);
      if (c.characters.some((p) => p.id === entry.character.id))
        fail('O ID desta ficha já foi usado por outro personagem.', 409);
      const p = validatePlayer(entry.character, c.game);
      p._revision++;
      p.updated_at = timestamp();
      p.history.push({
        at: p.updated_at,
        actor: a.display_name,
        action: 'Ficha restaurada',
        details: ''
      });
      c.characters.push(p);
      const owner = root.accounts.find(
        (a) => entry.account_ids.includes(a.id) && a.active && a.role === 'player'
      );
      if (owner) {
        owner.memberships[c.id] ??= [];
        owner.memberships[c.id].push(p.id);
        p.owner_id = owner.id;
        p.player = owner.display_name;
      } else p.owner_id = '';
      c.deleted_characters = c.deleted_characters.filter((r) => r.id !== id);
      c.retired_roster = c.retired_roster.filter((r) => r.id !== p.id);
      result = publicPlayer(p);
    } else if (type === 'maps') {
      const entry = c.deleted_maps.find((r) => r.id === id);
      if (!entry) fail('Mapa removido não encontrado.', 404);
      if (c.maps.some((m) => m.id === entry.map.id)) fail('Já existe um mapa com este ID.', 409);
      c.maps.push(clone(entry.map));
      c.deleted_maps = c.deleted_maps.filter((r) => r.id !== id);
      result = { status: 'restored' };
    } else fail('Tipo de registro inválido.');
    return root;
  });
  return result;
}
