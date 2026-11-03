import { commerceRequest } from './commerce-service.js';
import { communityRequest, socialSnapshot } from './community-service.js';
import { lifecycleRequest } from './lifecycle-service.js';
import { distributeXp } from './xp-service.js';
import { deleteCatalogEntry } from './rulebook-service.js';
import { CampaignService } from './campaign-service.js';
import { clone, fail, recordId, publicAccount, publicPlayer } from './model.js';
import { notificationVisible, publicCampaign } from './workspace.js';
import {
  assignCharacter,
  deleteCharacter,
  deleteAccount,
  requireAdmin,
  trashList,
  restoreTrash
} from './management-service.js';
import { submissionsRequest, submissionPackage, importSubmission } from './submissions-service.js';
export class PortalService extends CampaignService {
  async request(path, options = {}) {
    const { method = 'GET', data = {}, token } = options;
    const special =
      path === '/api/portal-state' ||
      path.startsWith('/api/intel') ||
      path.startsWith('/api/discipline-market') ||
      path.startsWith('/api/social') ||
      path.startsWith('/api/members/') ||
      path === '/api/admin/reset' ||
      path === '/api/admin/trash/purge' ||
      (path === '/api/admin/snapshots' && method === 'DELETE') ||
      /\/logs\/(history|transactions|rolls)$/.test(path) ||
      path === '/api/admin/xp/distribute' ||
      path.startsWith('/api/rulebook/catalog/') ||
      path.startsWith('/api/submissions') ||
      path.startsWith('/api/notifications') ||
      path.startsWith('/api/exchange/') ||
      path.startsWith('/api/admin/trash') ||
      path === '/api/characters/new-id' ||
      (method === 'DELETE' && /^\/api\/admin\/accounts\/[^/]+$/.test(path)) ||
      /^\/api\/characters\/\d+\/assign$/.test(path) ||
      (method === 'DELETE' && /^\/api\/characters\/\d+$/.test(path));
    if (!special) return super.request(path, options);
    const doc = await this.store.get(),
      a = this.auth(doc, token),
      root = await this.store.workspace();
    if (path === '/api/portal-state' && a.role !== 'admin' && !a._campaign_member)
      return {
        account: publicAccount(a),
        campaign: {
          id: 'no-campaign',
          title: 'Suas campanhas',
          notes: [],
          quests: [],
          maps: [],
          network: { nodes: [], links: [] },
          submissions: [],
          notifications: [],
          roster: []
        },
        game: clone(root.default_game),
        players: [],
        campaigns: [],
        accounts: [],
        social: { members: [], posts: [] }
      };
    if (a.role !== 'admin' && !a._campaign_member)
      fail('Escolha uma campanha vinculada ao seu acesso.', 403);
    if (path.startsWith('/api/intel') || path.startsWith('/api/discipline-market')) {
      if (!root.campaigns.some((c) => c.id === doc.id)) fail('Selecione uma campanha.', 409);
      if (
        method !== 'GET' &&
        doc.status === 'closed' &&
        !(a.role === 'admin' && method === 'DELETE')
      )
        fail('A campanha está encerrada.', 409);
      return commerceRequest(this, path, method, data, token, doc, a);
    }
    if (path === '/api/portal-state') {
      const campaign = publicCampaign(doc, a);
      delete campaign.social;
      campaign.submissions = await submissionsRequest(
        this,
        '/api/submissions',
        'GET',
        {},
        token,
        doc,
        a
      );
      const selected = Number(data.character_id);
      if (a.role === 'player' && a.character_ids.includes(selected)) {
        const { personalNetwork } = await import('./permissions.js');
        campaign.network = personalNetwork(doc, a, selected);
      }
      return {
        account: publicAccount(a),
        campaign,
        game: clone(doc.game),
        players: doc.characters
          .filter(
            (p) =>
              (a.role === 'admin' || a.character_ids.includes(p.id)) &&
              (data.archived || !p.archived)
          )
          .map(publicPlayer),
        campaigns: await super.request('/api/campaigns', { token }),
        accounts: a.role === 'admin' ? await super.request('/api/admin/accounts', { token }) : [],
        social: root.campaigns.some((c) => c.id === doc.id)
          ? socialSnapshot(root, doc, a)
          : { members: [], posts: [] }
      };
    }
    if (
      path.startsWith('/api/social') &&
      method !== 'GET' &&
      doc.status === 'closed' &&
      !(a.role === 'admin' && method === 'DELETE')
    )
      fail('A campanha está encerrada para novas interações.', 409);
    if (path.startsWith('/api/social') || path.startsWith('/api/members/'))
      return communityRequest(this, path, method, data, token, doc, a, root);
    if (
      path === '/api/admin/reset' ||
      path === '/api/admin/trash/purge' ||
      (path === '/api/admin/snapshots' && method === 'DELETE') ||
      /\/logs\/(history|transactions|rolls)$/.test(path) ||
      (method === 'DELETE' && /^\/api\/submissions\/[^/]+$/.test(path))
    )
      return lifecycleRequest(this, path, method, data, token, doc, a, root);
    if (path === '/api/characters/new-id') {
      if (a.role !== 'admin' && !doc.game.character_creation.enabled)
        fail('Criação de personagem desativada.', 403);
      return {
        id: recordId({
          characters: [...doc.characters, ...doc.submissions.map((s) => s.character)]
        })
      };
    }
    if (path.startsWith('/api/notifications')) {
      if (method === 'GET')
        return clone(doc.notifications.filter((n) => notificationVisible(n, a)));
      return this.write(token, (d, actor) => {
        const id = path.split('/')[3];
        const visible = d.notifications.filter((n) => notificationVisible(n, actor));
        if (method === 'DELETE') {
          const selected = id
            ? visible.filter((n) => n.id === id)
            : visible.filter((n) => (data.only_read ? n.read_by.includes(actor.id) : true));
          if (id && !selected.length) fail('Notificação não encontrada.', 404);
          for (const n of selected) n.hidden_by = [...new Set([...(n.hidden_by || []), actor.id])];
          return { status: 'deleted', count: selected.length };
        }
        if (id === 'read-all') {
          for (const n of visible) if (!n.read_by.includes(actor.id)) n.read_by.push(actor.id);
          return { status: 'read' };
        }
        const n = visible.find((n) => n.id === id);
        if (!n) fail('Notificação não encontrada.', 404);
        if (!n.read_by.includes(actor.id)) n.read_by.push(actor.id);
        return clone(n);
      });
    }
    if (path === '/api/admin/trash') {
      requireAdmin(a);
      return trashList(root, doc);
    }
    if (path.startsWith('/api/admin/trash/')) {
      const [, , , , type, id] = path.split('/');
      return restoreTrash(this, type, id, token);
    }
    if (method === 'DELETE' && path.startsWith('/api/admin/accounts/'))
      return deleteAccount(this, path.split('/')[4], data, token);
    if (method !== 'GET' && doc.status === 'closed' && !(a.role === 'admin' && method === 'DELETE'))
      fail('Reabra a campanha para alterar os registros.', 409);
    if (path === '/api/admin/xp/distribute') {
      if (method !== 'POST') fail('Operação inválida.', 405);
      return distributeXp(this, data, token);
    }
    if (path.startsWith('/api/rulebook/catalog/')) {
      const parts = path.split('/');
      if (method !== 'DELETE') fail('Operação de catálogo inválida.', 405);
      return deleteCatalogEntry(this, parts[4], Number(parts[5]), data, token);
    }
    if (path.startsWith('/api/submissions'))
      return submissionsRequest(this, path, method, data, token, doc, a);
    if (path === '/api/exchange/submission') {
      const s = doc.submissions.find((s) => s.id === data.id);
      if (!s) fail('Proposta não encontrada.', 404);
      return submissionPackage(doc, s, a);
    }
    if (path === '/api/exchange/import') return importSubmission(this, data, token);
    const id = Number(path.split('/')[3]);
    if (path.endsWith('/assign')) return assignCharacter(this, id, data, token);
    if (method === 'DELETE') return deleteCharacter(this, id, data, token);
    fail('Recurso não encontrado.', 404);
  }
}
