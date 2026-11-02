import { distributeXp } from './xp-service.js';
import { deleteCatalogEntry } from './rulebook-service.js';
import { CampaignService } from './campaign-service.js';
import { clone, fail, recordId } from './model.js';
import { notificationVisible } from './workspace.js';
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
    if (a.role !== 'admin' && !a._campaign_member)
      fail('Escolha uma campanha vinculada ao seu acesso.', 403);
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
        const id = path.split('/')[3],
          n = d.notifications.find((n) => n.id === id && notificationVisible(n, actor));
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
    if (method !== 'GET' && doc.status === 'closed')
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
