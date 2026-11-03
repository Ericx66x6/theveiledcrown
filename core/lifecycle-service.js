import { clone, fail, publicPlayer, timestamp, documentSeed } from './model.js';
import { requireAdmin } from './management-service.js';
import { workspaceFromLegacy } from './store.js';

export async function deleteCampaign(service, id, data, token) {
  let result;
  await service.store.atomic((root) => {
    const actor = service.auth(service.store.project(), token);
    requireAdmin(actor);
    const campaign = root.campaigns.find((c) => c.id === id);
    if (!campaign) fail('Campanha não encontrada.', 404);
    if (data.confirmation !== campaign.title) fail('Digite o nome da campanha para apagar.');
    root.campaigns = root.campaigns.filter((c) => c.id !== id);
    for (const a of root.accounts) delete a.memberships[id];
    root.active_campaign_id = root.campaigns.some((c) => c.id === root.active_campaign_id)
      ? root.active_campaign_id
      : root.campaigns[0]?.id || null;
    for (const s of root.sessions || [])
      if (s.campaign_id === id) s.campaign_id = root.active_campaign_id;
    result = { status: 'deleted', campaign_id: root.active_campaign_id };
    return root;
  });
  return result;
}
export async function lifecycleRequest(service, path, method, data, token, doc, actor, root) {
  if (path === '/api/admin/reset') {
    requireAdmin(actor);
    if (data.confirmation !== 'ZERAR PORTAL') fail('Digite ZERAR PORTAL para confirmar.');
    const seed = workspaceFromLegacy(documentSeed(service.factoryGame || root.default_game));
    await service.store.replace(seed);
    return { status: 'reset' };
  }
  if (path === '/api/admin/trash/purge') {
    requireAdmin(actor);
    const one = !!data.id;
    if (data.confirmation !== (one ? 'APAGAR' : 'ESVAZIAR LIXEIRA'))
      fail('Confirme a exclusão da lixeira.');
    await service.store.atomic((r) => {
      if (one) {
        const key = {
          characters: 'deleted_characters',
          maps: 'deleted_maps',
          accounts: 'deleted_accounts'
        }[data.type];
        if (!key) fail('Tipo de registro inválido.');
        const target = data.type === 'accounts' ? r : r.campaigns.find((c) => c.id === doc.id);
        if (!target || !target[key].some((item) => item.id === data.id))
          fail('Registro removido não encontrado.', 404);
        target[key] = target[key].filter((item) => item.id !== data.id);
      } else {
        r.deleted_accounts = [];
        for (const c of r.campaigns) {
          c.deleted_characters = [];
          c.deleted_maps = [];
          c.snapshots = [];
        }
      }
      return r;
    });
    return { status: 'purged' };
  }
  if (path === '/api/admin/snapshots' && method === 'DELETE') {
    requireAdmin(actor);
    return service.write(token, (d) => {
      d.snapshots = data.id ? d.snapshots.filter((s) => s.id !== data.id) : [];
      return { status: 'deleted' };
    });
  }
  const submission = path.match(/^\/api\/submissions\/([^/]+)$/);
  if (submission && method === 'DELETE')
    return service.write(token, (d, a) => {
      const record = d.submissions.find((s) => s.id === submission[1]);
      if (!record || (a.role !== 'admin' && record.created_by !== a.id))
        fail('Proposta não encontrada.', 404);
      if (record._revision !== data.revision)
        fail('A proposta mudou. Atualize antes de apagar.', 409);
      d.submissions = d.submissions.filter((s) => s.id !== record.id);
      return { status: 'deleted' };
    });
  const logs = path.match(/^\/api\/characters\/(\d+)\/logs\/(history|transactions|rolls)$/);
  if (logs)
    return service.write(token, (d, a) => {
      const id = Number(logs[1]),
        key = logs[2];
      if (a.role !== 'admin' && (!a.character_ids.includes(id) || key !== 'rolls'))
        fail('Somente o narrador gerencia esse histórico.', 403);
      const p = d.characters.find((p) => p.id === id);
      if (!p) fail('Ficha não encontrada.', 404);
      if (p._revision !== data.revision) fail('A ficha mudou. Atualize antes de apagar.', 409);
      if (data.index === undefined) {
        if (data.confirmation !== 'LIMPAR') fail('Confirme a limpeza dos registros.');
        p[key] = [];
      } else {
        if (!Number.isInteger(data.index) || data.index < 0 || data.index >= p[key].length)
          fail('Registro não encontrado.', 404);
        p[key].splice(data.index, 1);
      }
      p._revision++;
      p.updated_at = timestamp();
      return publicPlayer(p);
    });
  fail('Operação não encontrada.', 404);
}
