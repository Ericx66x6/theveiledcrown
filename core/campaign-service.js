import { deleteCampaign } from './lifecycle-service.js';
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
  publicNote,
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
          cover: c.cover || '',
          accent: c.accent,
          _revision: c._revision,
          status: c.status,
          description: c.description,
          moral_principle: c.moral_principle || '',
          characters: c.characters.length,
          quests: c.quests.filter((q) => !['completed', 'cancelled'].includes(q.status)).length
        }));
    if (path === '/api/campaigns' && method === 'POST') {
      requireAdmin(account);
      let result;
      await this.store.atomic((r) => {
        const campaign = campaignRecord(validateSettings(gameSettings(data.game || doc.game)), {
          title: text(data.title, 'Nome', 150, true),
          cover: imageData(data.cover || ''),
          description: text(data.description || '', 'Descrição', 2000),
          moral_principle: text(
            data.moral_principle || '',
            'Princípio compartilhado da crônica',
            1000
          ),
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
      if (method === 'DELETE') return deleteCampaign(this, c.id, data, token);
      let result;
      await this.store.atomic((r) => {
        const target = r.campaigns.find((x) => x.id === c.id);
        for (const key of ['title', 'description'])
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
        if (data.revision !== undefined && data.revision !== target._revision)
          fail('A campanha mudou. Reabra a edição.', 409);
        if (data.cover !== undefined) target.cover = imageData(data.cover);
        if (data.moral_principle !== undefined)
          target.moral_principle = text(
            data.moral_principle,
            'Princípio compartilhado da crônica',
            1000
          );
        target._revision++;
        target.updated_at = timestamp();
        result = Object.fromEntries(
          [
            'id',
            'title',
            'cover',
            'description',
            'moral_principle',
            'status',
            'accent',
            '_revision',
            'updated_at'
          ].map((key) => [key, clone(target[key])])
        );
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
        if (data.preferences) {
          const preferences = data.preferences;
          a.preferences = { ...a.preferences };
          for (const key of ['audio_enabled', 'music_enabled', 'animations'])
            if (preferences[key] !== undefined) {
              if (typeof preferences[key] !== 'boolean') fail('Preferência inválida.');
              a.preferences[key] = preferences[key];
            }
          for (const key of ['sfx_volume', 'music_volume'])
            if (preferences[key] !== undefined)
              a.preferences[key] = number(preferences[key], 'Volume', 0, 100);
          if (preferences.social_mood !== undefined) {
            if (!['chat', 'chill', 'busy'].includes(preferences.social_mood))
              fail('Status social inválido.');
            a.preferences.social_mood = preferences.social_mood;
          }
          if (preferences.social_note !== undefined)
            a.preferences.social_note = text(preferences.social_note, 'Status', 120);
        }
        return publicAccount(a);
      });
    }
    if (
      method !== 'GET' &&
      !root.campaigns.some((c) => c.id === doc.id) &&
      !path.startsWith('/api/admin/accounts')
    )
      fail('Crie ou selecione uma campanha antes de alterar seus registros.', 409);
    if (account.role !== 'admin' && !Object.hasOwn(global.memberships, doc.id))
      fail('Escolha uma campanha vinculada à sua conta.', 403);
    if (path === '/api/campaign') return publicCampaign(doc, account);
    if (
      method !== 'GET' &&
      doc.status === 'closed' &&
      !(account.role === 'admin' && method === 'DELETE') &&
      !path.startsWith('/api/admin/')
    )
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
    if (method === 'GET')
      return doc.notes.filter((n) => visible(n, account)).map((n) => publicNote(n, doc));
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
        if (!note) fail('Anotação não encontrada.', 404);
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
        note = {
          id: newId(),
          created_by: a.id,
          created_at: timestamp(),
          author: { id: a.id, display_name: a.display_name, avatar: '', role: a.role },
          ...values
        };
        d.notes.push(note);
      }
      stamp(note, a);
      return clone(note);
    });
  }
  async quests(path, method, data, token, doc, account) {
    if (method === 'GET') return clone(doc.quests.filter((q) => questVisible(q, account, doc.id)));
    requireAdmin(account);
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) fail('Operação de missão inválida.', 405);
    const [, , , id, action] = path.split('/');
    if (action && action !== 'complete') fail('Operação de missão não disponível.', 404);
    return this.write(token, (d, a) => {
      requireAdmin(a);
      let q = id ? d.quests.find((q) => q.id === id) : null;
      if (id && !q) fail('Missão não encontrada.', 404);
      if (q) checkRevision(q, data);
      if (method === 'DELETE') {
        if (!q) fail('Escolha uma missão.', 404);
        d.quests = d.quests.filter((item) => item.id !== q.id);
        return { status: 'deleted' };
      }
      const reward = (source, fallback) => {
        const xp = number(
          source.xp_reward ?? fallback?.xp_reward ?? 0,
          'XP por participante',
          0,
          d.game.quests.max_xp_reward
        );
        const money = moneyValue(source.money_reward ?? fallback?.money_reward ?? 0);
        if (money < 0 || money > d.game.quests.max_money_reward)
          fail('Recompensa financeira inválida.');
        const items = clone(source.items ?? fallback?.items ?? []);
        if (!Array.isArray(items) || items.length > 20) fail('Lista de recompensas inválida.');
        for (const item of items) {
          item.name = text(item.name, 'Item', 150, true);
          item.quantity = number(item.quantity ?? 1, 'Quantidade', 1, 9999);
          item.description = text(item.description || '', 'Descrição', 10000);
        }
        return { xp_reward: xp, money_reward: money, items };
      };
      if (action === 'complete') {
        if (!q) fail('Missão não encontrada.', 404);
        if (q.rewarded_at || q.status === 'completed')
          fail('As recompensas já foram entregues.', 409);
        if (q.status === 'cancelled') fail('Reative a missão antes de entregar.');
        const actual = reward(data, q);
        const note = text(data.completion_note || '', 'Desfecho', 5000);
        for (const id of q.assignees) {
          const p = find(d, id);
          if (p.archived) fail('Restaure a ficha de ' + p.char + ' antes de entregar.');
          const next = clone(p);
          next.xp = number(next.xp + actual.xp_reward, 'XP acumulado');
          next.money = moneyValue(next.money + actual.money_reward);
          if (actual.money_reward)
            next.transactions = [
              {
                id: newId(),
                at: timestamp(),
                amount: actual.money_reward,
                before: p.money,
                after: next.money,
                reason: q.title,
                actor: a.id,
                source: 'quest'
              },
              ...(p.transactions || [])
            ].slice(0, 200);
          for (const item of actual.items) next.items.push({ id: newId(), ...clone(item) });
          validatePlayer(next, d.game);
          commit(
            d,
            p,
            next,
            a,
            'Missão concluída',
            q.title + ' · +' + actual.xp_reward + ' XP' + (note ? ' · ' + note : '')
          );
        }
        q.delivered_rewards = { ...actual, note, at: timestamp() };
        q.status = 'completed';
        q.rewarded_at = timestamp();
        q.completed_by = a.id;
        q.approved_rewards = true;
        q.completion_note = note;
        stamp(q, a);
        for (const owner of d.accounts.filter(
          (u) => u.role === 'player' && q.assignees.some((id) => u.character_ids.includes(id))
        ))
          notification(d, {
            audience: 'account',
            recipient_id: owner.id,
            title: 'Missão concluída: ' + q.title,
            message: '+' + actual.xp_reward + ' XP · recompensa entregue pelo narrador.',
            kind: 'quest',
            target: q.id,
            created_by: a.id
          });
        return clone(q);
      }
      if (q?.rewarded_at) fail('Uma missão já entregue não pode ser alterada.', 409);
      const wasNew = !q;
      const prior = new Set(q?.assignees || []);
      const assignees = clone(data.assignees ?? q?.assignees ?? []);
      if (
        !Array.isArray(assignees) ||
        !assignees.length ||
        new Set(assignees).size !== assignees.length
      )
        fail('Selecione ao menos um participante.');
      for (const id of assignees) find(d, id);
      const status = data.status ?? q?.status ?? 'active';
      if (!['active', 'cancelled'].includes(status)) fail('Use a entrega para concluir a missão.');
      const values = {
        title: text(data.title ?? q?.title, 'Título da missão', 200, true),
        description: text(data.description ?? q?.description ?? '', 'Descrição', 30000),
        category: text(data.category ?? q?.category ?? 'História principal', 'Categoria', 100),
        difficulty: text(data.difficulty ?? q?.difficulty ?? 'Desconhecida', 'Dificuldade', 100),
        ...reward(data, q),
        assignees,
        status,
        approved_rewards: true
      };
      if (q) Object.assign(q, values);
      else {
        q = { id: newId(), created_by: a.id, created_at: timestamp(), ...values };
        d.quests.push(q);
      }
      stamp(q, a);
      for (const owner of d.accounts.filter(
        (u) =>
          u.role === 'player' &&
          q.assignees.some((id) => u.character_ids.includes(id) && (wasNew || !prior.has(id)))
      ))
        notification(d, {
          audience: 'account',
          recipient_id: owner.id,
          title: 'Missão atribuída: ' + q.title,
          message: 'As recompensas exibidas são uma previsão do narrador.',
          kind: 'quest',
          target: q.id,
          created_by: a.id
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
