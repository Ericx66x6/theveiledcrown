import { personalNetwork, questVisible } from './permissions.js';
import { notification } from './management-service.js';
import { mapsRequest } from './maps-service.js';
import { CharacterService, commit } from './service.js';
import {
  clone,
  fail,
  number,
  text,
  newId,
  timestamp,
  validatePlayer,
  publicPlayer,
  publicAccount
} from './model.js';
import { campaignRecord } from './store.js';
import {
  imageData,
  coordinate,
  visible,
  publicCampaign,
  workspaceExport,
  playerExport,
  validateWorkspace
} from './workspace.js';
import {
  gameSettings,
  validateSettings,
  upgradeQuote,
  moneyValue,
  parseDelta,
  rollPool
} from './settings.js';
function requireAdmin(a) {
  if (a.role !== 'admin') fail('Ação exclusiva do narrador.', 403);
}
function scope(a, id) {
  if (a.role !== 'admin' && !a.character_ids.includes(id))
    fail('Esta ficha não está vinculada a você.', 403);
}
function find(doc, id) {
  const p = doc.characters.find((x) => x.id === id);
  if (!p) fail('Ficha não encontrada.', 404);
  return p;
}
function own(item, a) {
  if (a.role !== 'admin' && item.created_by !== a.id)
    fail('Só o autor ou o narrador pode editar este registro.', 403);
}
function cleanEntity(data, fields) {
  const result = {};
  for (const key of fields)
    if (data[key] !== undefined)
      result[key] = text(
        data[key],
        key,
        key === 'content' || key === 'description' || key === 'theories' ? 30000 : 500
      );
  return result;
}
function checkRevision(item, data) {
  if (data.revision !== undefined && item._revision !== data.revision)
    fail('Este registro mudou. Atualize antes de editar.', 409);
}
function stamp(item, a) {
  item._revision = (item._revision || 0) + 1;
  item.updated_at = timestamp();
  item.updated_by = a.id;
  return item;
}
export class CampaignService extends CharacterService {
  async request(path, options = {}) {
    const { method = 'GET', data = {}, token } = options;
    if (path.startsWith('/auth/')) return super.request(path, options);
    const doc = await this.store.get(),
      account = this.auth(doc, token),
      root = await this.store.workspace(),
      global = root.accounts.find((a) => a.id === account.id);
    if (path === '/api/campaigns' && method === 'GET')
      return root.campaigns
        .filter((c) => account.role === 'admin' || Object.hasOwn(global.memberships, c.id))
        .map((c) => ({
          id: c.id,
          title: c.title,
          system: c.system,
          status: c.status,
          description: c.description,
          accent: c.accent,
          characters: c.characters.length,
          quests: c.quests.filter((q) => !['completed', 'cancelled'].includes(q.status)).length
        }));
    if (path === '/api/campaigns' && method === 'POST') {
      requireAdmin(account);
      let result;
      await this.store.atomic((r) => {
        const campaign = campaignRecord(validateSettings(gameSettings(data.game || doc.game)), {
          title: text(data.title, 'Nome', 150, true),
          system: text(data.system || 'RPG', 'Sistema', 100, true),
          description: text(data.description || '', 'Descrição', 2000),
          accent: data.accent || '#d92343'
        });
        if (!/^#[a-f\d]{6}$/i.test(campaign.accent)) fail('Cor inválida.');
        r.campaigns.push(campaign);
        result = campaign;
        return r;
      });
      return clone(result);
    }
    const campaignMatch = path.match(/^\/api\/campaigns\/([^/]+)(?:\/(select))?$/);
    if (campaignMatch) {
      const c = root.campaigns.find((c) => c.id === campaignMatch[1]);
      if (!c) fail('Mesa não encontrada.', 404);
      if (account.role !== 'admin' && !Object.hasOwn(global.memberships, c.id))
        fail('Você não pertence a essa mesa.', 403);
      if (campaignMatch[2] === 'select') {
        await this.store.select(c.id);
        return { status: 'selected', campaign: c.id };
      }
      requireAdmin(account);
      let result;
      await this.store.atomic((r) => {
        const target = r.campaigns.find((x) => x.id === c.id);
        for (const key of ['title', 'system', 'description'])
          if (data[key] !== undefined)
            target[key] = text(data[key], key, key === 'description' ? 2000 : 150, true);
        if (data.status !== undefined) {
          if (!['active', 'closed'].includes(data.status)) fail('Estado de mesa inválido.');
          target.status = data.status;
        }
        if (data.accent) {
          if (!/^#[a-f\d]{6}$/i.test(data.accent)) fail('Cor inválida.');
          target.accent = data.accent;
        }
        target.updated_at = timestamp();
        result = clone(target);
        return r;
      });
      return result;
    }
    if (path === '/api/json/workspace') {
      requireAdmin(account);
      return workspaceExport(root);
    }
    if (path === '/api/json/player') {
      if (account.role === 'admin') {
        const selected =
          root.accounts.find((a) => a.id === data.account_id) ||
          (data.character_id !== undefined
            ? root.accounts.find(
                (a) => a.role === 'player' && a.memberships?.[doc.id]?.includes(data.character_id)
              )
            : null);
        if (!selected || selected.role !== 'player')
          fail('Selecione uma conta de jogador para exportar o acesso.');
        return playerExport(root, selected);
      }
      return playerExport(root, global);
    }
    if (path === '/api/json/replace' && method === 'POST') {
      requireAdmin(account);
      if (data.confirmation !== 'IMPORTAR') fail('Digite IMPORTAR para substituir o portal.');
      const imported = validateWorkspace(data.document);
      await this.store.replace(imported);
      return { status: 'imported' };
    }
    if (path === '/api/profile') {
      if (method === 'GET')
        return { ...publicAccount(account), memberships: clone(global.memberships) };
      return this.write(token, (d, a) => {
        a.display_name = text(data.display_name ?? a.display_name, 'Nome', 100, true);
        a.bio = text(data.bio ?? a.bio ?? '', 'Biografia', 2000);
        if (data.avatar !== undefined) a.avatar = imageData(data.avatar);
        if (data.preferences)
          a.preferences = {
            sound: !!data.preferences.sound,
            ui_sound: data.preferences.ui_sound !== false,
            animations: data.preferences.animations !== false
          };
        return publicAccount(a);
      });
    }
    if (account.role !== 'admin' && !Object.hasOwn(global.memberships, doc.id))
      fail('Escolha uma campanha vinculada à sua conta.', 403);
    if (path === '/api/campaign') return publicCampaign(doc, account);
    if (method !== 'GET' && doc.status === 'closed' && !path.startsWith('/api/admin/'))
      fail('Esta mesa está encerrada. O narrador pode reabri-la no portal.', 409);
    const quoteMatch = path.match(/^\/api\/characters\/(\d+)\/upgrade-preview$/);
    if (quoteMatch) {
      const id = Number(quoteMatch[1]);
      scope(account, id);
      return upgradeQuote(find(doc, id), gameSettings(doc.game), data.key, data.id, data.target);
    }
    const moneyMatch = path.match(/^\/api\/characters\/(\d+)\/money$/);
    if (moneyMatch)
      return this.write(token, (d, a) => {
        const id = Number(moneyMatch[1]);
        scope(a, id);
        const p = find(d, id);
        if (p.archived) fail('Restaure a ficha antes de editar.');
        if (p._revision !== data.revision)
          fail('A ficha mudou. Atualize o saldo antes de lançar.', 409);
        const delta = parseDelta(data.delta),
          after = moneyValue(p.money + delta);
        if (after < 0) fail('O gasto ultrapassa o saldo disponível.');
        const next = clone(p);
        next.money = after;
        next.transactions = [
          {
            id: newId(),
            at: timestamp(),
            amount: delta,
            before: p.money,
            after,
            reason: text(data.reason || 'Movimentação', 'Motivo', 300),
            actor: a.id
          },
          ...(p.transactions || [])
        ].slice(0, 200);
        return commit(
          d,
          p,
          next,
          a,
          'Movimentação financeira',
          `${delta >= 0 ? '+' : ''}${delta} · ${data.reason || 'Movimentação'}`
        );
      });
    const rollMatch = path.match(/^\/api\/characters\/(\d+)\/roll$/);
    if (rollMatch)
      return this.write(token, (d, a) => {
        const id = Number(rollMatch[1]);
        scope(a, id);
        const p = find(d, id),
          g = gameSettings(d.game);
        const rolled = rollPool(
          number(data.pool, 'Parada', 1, g.dice.max_pool),
          data.hunger ? p.status.hunger : 0,
          {
            ...g,
            dice: {
              ...g.dice,
              success_on: number(
                data.threshold ?? g.dice.success_on,
                'Dificuldade',
                1,
                g.dice.sides
              )
            }
          }
        );
        rolled.label = text(data.label || 'Parada livre', 'Nome do teste', 200);
        p.rolls = [rolled, ...(p.rolls || [])].slice(0, 30);
        return rolled;
      });
    if (path.startsWith('/api/notes')) return this.notes(path, method, data, token, doc, account);
    if (path.startsWith('/api/quests')) return this.quests(path, method, data, token, doc, account);
    if (path.startsWith('/api/map')) return this.map(path, method, data, token, doc, account);
    if (path.split('?')[0].startsWith('/api/network'))
      return this.network(path, method, data, token, doc, account);
    return super.request(path, options);
  }
  async notes(path, method, data, token, doc, account) {
    if (method === 'GET') return clone(doc.notes.filter((n) => visible(n, account)));
    return this.write(token, (d, a) => {
      const id = path.split('/')[3];
      let note = id ? d.notes.find((n) => n.id === id) : null;
      if (id && !note) fail('Anotação não encontrada.', 404);
      if (note) {
        if (!visible(note, a)) fail('Anotação não encontrada.', 404);
        own(note, a);
        checkRevision(note, data);
      }
      if (method === 'DELETE') {
        d.notes = d.notes.filter((n) => n.id !== id);
        return { status: 'deleted' };
      }
      const visibility = data.visibility ?? note?.visibility ?? 'campaign';
      if (
        !['private', 'campaign', 'gm'].includes(visibility) ||
        (visibility === 'gm' && a.role !== 'admin')
      )
        fail('Visibilidade inválida.', 403);
      const values = {
        title: text(data.title ?? note?.title, 'Título', 200, true),
        content: text(data.content ?? note?.content ?? '', 'Anotação', 30000),
        tags: text(data.tags ?? note?.tags ?? '', 'Marcadores', 500),
        visibility,
        pinned: !!data.pinned
      };
      if (note) Object.assign(note, values);
      else {
        note = { id: newId(), created_by: a.id, created_at: timestamp(), ...values };
        d.notes.push(note);
      }
      stamp(note, a);
      return clone(note);
    });
  }
  async quests(path, method, data, token, doc, account) {
    if (method === 'GET') return clone(doc.quests.filter((q) => questVisible(q, account, doc.id)));
    if (!['POST', 'PATCH'].includes(method)) fail('Operação de missão inválida.', 405);
    return this.write(token, (d, a) => {
      const [, , , id, action] = path.split('/');
      let q = id ? d.quests.find((q) => q.id === id) : null;
      if (id && (!q || !questVisible(q, a, d.id))) fail('Missão não encontrada.', 404);
      if (q) checkRevision(q, data);
      if (action === 'complete') {
        requireAdmin(a);
        if (q.status === 'completed' || q.rewarded_at)
          fail('As recompensas desta missão já foram entregues.', 409);
        if (q.status === 'cancelled') fail('Reative a missão antes de concluir.');
        q.approved_rewards = true;
        const changes = q.assignees.map((id) => {
          const p = find(d, id);
          if (p.archived) fail('Restaure a ficha de ' + p.char + ' antes de entregar recompensas.');
          const next = clone(p);
          next.xp = number(next.xp + q.xp_reward, 'XP acumulado');
          next.money = moneyValue(next.money + q.money_reward);
          if (q.money_reward)
            next.transactions = [
              {
                id: newId(),
                at: timestamp(),
                amount: q.money_reward,
                before: p.money,
                after: next.money,
                reason: q.title,
                actor: a.id,
                source: 'quest'
              },
              ...(p.transactions || [])
            ].slice(0, 200);
          for (const item of q.items || [])
            next.items.push({
              id: newId(),
              name: item.name,
              description: item.description || '',
              quantity: item.quantity || 1
            });
          validatePlayer(next, d.game);
          return [p, next];
        });
        for (const [p, next] of changes)
          commit(d, p, next, a, 'Missão concluída', `${q.title} · +${q.xp_reward} XP`);
        q.status = 'completed';
        q.rewarded_at = timestamp();
        q.completed_by = a.id;
        stamp(q, a);
        return clone(q);
      }
      if (action === 'request-completion') {
        if (a.role !== 'player' || !q.assignees.some((id) => a.character_ids.includes(id)))
          fail('Somente um participante pode solicitar a conclusão.', 403);
        if (['completed', 'cancelled'].includes(q.status)) fail('Esta missão já foi encerrada.');
        q.status = 'review';
        q.completion_note = text(data.completion_note || '', 'Relato', 5000);
        q.requested_by = a.id;
        notification(d, {
          title: 'Conclusão solicitada: ' + q.title,
          message: q.completion_note,
          kind: 'quest',
          target: q.id
        });
        stamp(q, a);
        return clone(q);
      }
      if (action === 'approve') {
        requireAdmin(a);
        if (q.rewarded_at) fail('Missão já recompensada.', 409);
        q.approved_rewards = true;
        stamp(q, a);
        return clone(q);
      }
      if (action) fail('Operação de missão inválida.', 404);
      requireAdmin(a);
      if (q) {
        if (q.rewarded_at) fail('Uma missão recompensada não pode ser alterada.', 409);
      }
      let assignees = data.assignees ?? q?.assignees ?? [];
      if (
        !Array.isArray(assignees) ||
        !assignees.length ||
        new Set(assignees).size !== assignees.length
      )
        fail('Selecione ao menos um participante.');
      for (const id of assignees) {
        find(d, id);
        scope(a, id);
      }
      const xp = number(
          data.xp_reward ?? q?.xp_reward ?? 0,
          'XP por participante',
          0,
          d.game.quests.max_xp_reward
        ),
        money = moneyValue(data.money_reward ?? q?.money_reward ?? 0);
      if (money < 0 || money > d.game.quests.max_money_reward)
        fail('Recompensa financeira inválida.');
      const items = data.items ?? q?.items ?? [];
      if (!Array.isArray(items) || items.length > 20) fail('Lista de recompensas inválida.');
      for (const item of items) {
        text(item.name, 'Item', 150, true);
        number(item.quantity ?? 1, 'Quantidade', 1, 9999);
      }
      const status = data.status ?? q?.status ?? 'active';
      if (!['active', 'cancelled', 'review'].includes(status))
        fail('Use a confirmação de conclusão para entregar recompensas.');
      const values = {
        title: text(data.title ?? q?.title, 'Título da missão', 200, true),
        description: text(data.description ?? q?.description ?? '', 'Descrição', 30000),
        category: text(data.category ?? q?.category ?? 'História principal', 'Categoria', 100),
        difficulty: text(data.difficulty ?? q?.difficulty ?? 'Desconhecida', 'Dificuldade', 100),
        xp_reward: xp,
        money_reward: money,
        items: clone(items),
        assignees: clone(assignees),
        status,
        approved_rewards: a.role === 'admin'
      };
      if (q) Object.assign(q, values);
      else {
        q = { id: newId(), created_by: a.id, created_at: timestamp(), ...values };
        d.quests.push(q);
      }
      stamp(q, a);
      for (const owner of d.accounts.filter(
        (u) => u.role === 'player' && q.assignees.some((id) => u.character_ids.includes(id))
      ))
        notification(d, {
          audience: 'account',
          recipient_id: owner.id,
          title: 'Missão atribuída: ' + q.title,
          kind: 'quest',
          target: q.id
        });
      return clone(q);
    });
  }
  async map(path, method, data, token, doc, account) {
    return mapsRequest(this, path, method, data, token, doc, account);
  }
  async network(path, method, data, token, doc, account) {
    if (account.role !== 'player')
      fail('O círculo de relações pertence exclusivamente ao jogador.', 403);
    const url = new URL(path, 'https://local.invalid');
    const pid = Number(url.searchParams.get('character_id') ?? data.character_id);
    if (!Number.isInteger(pid) || !account.character_ids.includes(pid))
      fail('Selecione um personagem seu para abrir o mural.', 403);
    if (!doc.characters.some((p) => p.id === pid && !p.archived)) fail('Ficha indisponível.', 404);
    if (method === 'GET') return clone(personalNetwork(doc, account, pid));
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) fail('Operação de mural inválida.', 405);
    return this.write(token, (d, a) => {
      if (a.role !== 'player' || !a.character_ids.includes(pid))
        fail('Este mural não pertence a você.', 403);
      const type = url.pathname.split('/')[3],
        id = url.pathname.split('/')[4];
      if (!['nodes', 'links'].includes(type)) fail('Registro de mural inválido.');
      const rows = d.network[type];
      let item = id ? rows.find((x) => x.id === id && x.character_id === pid) : null;
      if (id && !item) fail('Registro não encontrado.', 404);
      if (item && item._revision !== data.revision)
        fail('O mural mudou. Atualize antes de editar.', 409);
      if (method === 'DELETE') {
        if (!item) fail('Selecione um registro.', 400);
        d.network[type] = rows.filter((x) => x.id !== id);
        if (type === 'nodes')
          d.network.links = d.network.links.filter((x) => x.from !== id && x.to !== id);
        return { status: 'deleted' };
      }
      let values;
      if (type === 'nodes') {
        values = {
          ...cleanEntity(data, ['name', 'role', 'faction', 'description', 'theories']),
          x: coordinate(data.x ?? item?.x ?? 0.5),
          y: coordinate(data.y ?? item?.y ?? 0.5),
          visibility: 'private'
        };
        if (!item && !values.name) fail('Preencha o nome do NPC.');
        if (data.image !== undefined) values.image = imageData(data.image);
      } else {
        const from = data.from ?? item?.from,
          to = data.to ?? item?.to;
        if (
          from === to ||
          ![from, to].every((id) =>
            d.network.nodes.some((n) => n.id === id && n.character_id === pid)
          )
        )
          fail('Selecione dois NPCs deste personagem.');
        values = { from, to, ...cleanEntity(data, ['label', 'description', 'attitude']) };
        if (!values.label && !item?.label) fail('Descreva a relação.');
      }
      if (item) Object.assign(item, values);
      else {
        item = {
          id: newId(),
          created_by: a.id,
          created_at: timestamp(),
          character_id: pid,
          ...values
        };
        rows.push(item);
      }
      stamp(item, a);
      return clone(item);
    });
  }
}
