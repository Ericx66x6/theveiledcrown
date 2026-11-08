import { characterChanges } from './character-audit.js';
import { characterRewards } from './reward-events.js';
import { notification } from './notifications.js';
import { upgradeQuote, gameSettings, validateSettings } from './settings.js';
import {
  stats,
  collections,
  clone,
  fail,
  number,
  text,
  recordId,
  newId,
  normalize,
  blank,
  validateGame,
  validatePlayer,
  publicPlayer,
  publicAccount,
  credentials,
  revision,
  timestamp,
  backup,
  validateBackup,
  xpCost
} from './model.js';
import { hashPassword, checkPassword } from './passwords.js';
const EDITABLE = new Set([
  ...collections.filter((k) => k !== 'goals'),
  'status',
  'biography',
  'profilepicture',
  'portrait_frame',
  'aspirations'
]);
export function accountRecord(data, passwordHash) {
  return {
    id: newId(),
    username: credentials(data.username, data.password),
    display_name: text(data.display_name || data.username, 'Nome', 100, true),
    role: data.role || 'player',
    character_ids: [],
    _campaign_member: true,
    avatar: '',
    bio: '',
    preferences: {
      audio_enabled: true,
      music_enabled: true,
      audio_defaults_version: 2,
      sfx_volume: 80,
      music_volume: 35,
      animations: true,
      social_mood: 'chat',
      social_note: ''
    },
    active: true,
    session_version: 0,
    password_hash: passwordHash
  };
}
function find(doc, id) {
  const p = doc.characters.find((p) => p.id === Number(id));
  if (!p) fail('Personagem não encontrado.', 404);
  return p;
}
function admin(a) {
  if (a.role !== 'admin') fail('Esta ação pertence ao narrador.', 403);
}
function scope(a, id) {
  if (a.role !== 'admin' && !a.character_ids.includes(Number(id)))
    fail('Esta ficha não está vinculada ao seu login.', 403);
}
function links(doc, ids) {
  if (!Array.isArray(ids) || ids.length > 100 || new Set(ids).size !== ids.length)
    fail('Lista de fichas inválida.');
  ids.forEach((id) => {
    number(id, 'ID', 0, 999999);
    find(doc, id);
  });
  return clone(ids);
}
function snap(doc, kind, data, id = null) {
  doc.snapshots ??= [];
  doc.snapshots.push({ id: newId(), at: timestamp(), kind, character_id: id, data: clone(data) });
  doc.snapshots = doc.snapshots.slice(-30);
}
export function commit(doc, previous, data, actor, action, details = '') {
  const next = validatePlayer(data, doc.game);
  snap(doc, 'character', previous, previous.id);
  next._revision = previous._revision + 1;
  next.updated_at = timestamp();
  next.history = [
    ...(previous.history || []),
    {
      id: newId(),
      at: next.updated_at,
      actor: actor.display_name,
      actor_id: actor.id,
      action,
      details
    }
  ];
  characterRewards(doc, previous, next, actor, action, details);
  if (next.xp > previous.xp && action !== 'Missão concluída') {
    const owner = doc.accounts.find(
      (a) => a.role === 'player' && a.character_ids.includes(next.id)
    );
    if (owner)
      notification(doc, {
        audience: 'account',
        recipient_id: owner.id,
        title: `${next.char} recebeu ${next.xp - previous.xp} XP`,
        message: details || action,
        kind: 'xp',
        target: String(next.id),
        created_by: actor.id
      });
  }
  doc.characters[doc.characters.findIndex((p) => p.id === next.id)] = next;
  return publicPlayer(next);
}
export class CharacterService {
  constructor(store) {
    this.store = store;
    this.attempts = new Map();
  }
  auth(doc, token) {
    const session = doc.sessions?.find(
      (s) => s.token === token && (s.expires === null || s.expires > Date.now())
    );
    const account =
      session &&
      doc.accounts.find(
        (a) => a.id === session.account && a.active && a.session_version === session.version
      );
    if (!account) fail('Entre com seu login e senha.', 401);
    return account;
  }
  session(doc, account) {
    const token = newId() + newId();
    doc.sessions = (doc.sessions || [])
      .filter((s) => s.expires === null || s.expires > Date.now())
      .slice(-(this.maxSessions || 30));
    doc.sessions.push({
      token,
      account: account.id,
      version: account.session_version,
      expires: null,
      created_at: timestamp()
    });
    return { token, account: publicAccount(account), mode: 'online' };
  }
  async write(token, change, { publicAction = false, ephemeral = false } = {}) {
    let response;
    await this.store.transact(
      (doc) => {
        const account = publicAction ? null : this.auth(doc, token);
        response = change(doc, account);
        doc.revision++;
        doc.updated_at = timestamp();
        return doc;
      },
      { dirty: !ephemeral }
    );
    return clone(response);
  }
  async request(path, { method = 'GET', data, token } = {}) {
    if (path === '/auth/bootstrap') {
      const username = credentials(data?.username, data?.password),
        hash = await hashPassword(data.password);
      return this.write(
        null,
        (doc) => {
          if (doc.accounts.length) fail('Esta mesa já tem contas. Entre com seu login.', 409);
          const a = accountRecord({ ...data, username, role: 'admin' }, hash);
          doc.accounts.push(a);
          return this.session(doc, a);
        },
        { publicAction: true }
      );
    }
    if (path === '/auth/login') {
      const username = typeof data?.username === 'string' ? data.username.trim().toLowerCase() : '';
      const times = (this.attempts.get(username) || []).filter((t) => t > Date.now() - 60000);
      if (times.length >= 10) fail('Muitas tentativas. Aguarde um minuto.', 429);
      times.push(Date.now());
      this.attempts.set(username, times);
      const before = await this.store.get(),
        found = before.accounts.find(
          (a) => a.username === username && (a.active || a.registration?.status === 'pending')
        );
      if (!found || !(await checkPassword(data?.password, found.password_hash)))
        fail('Login ou senha incorretos.', 401);
      if (!found.active) fail('Seu cadastro está aguardando aprovação do narrador.', 403);
      return this.write(
        null,
        (doc) => {
          const a = doc.accounts.find(
            (a) => a.id === found.id && a.active && a.session_version === found.session_version
          );
          if (!a || a.password_hash.hash !== found.password_hash.hash)
            fail('O acesso foi alterado. Entre novamente.', 401);
          this.attempts.delete(username);
          return this.session(doc, a);
        },
        { publicAction: true, ephemeral: true }
      );
    }
    const document = await this.store.get(),
      account = this.auth(document, token);
    if (path === '/auth/me') return { account: publicAccount(account) };
    if (path === '/auth/logout')
      return this.write(
        token,
        (doc, a) => {
          a.session_version++;
          doc.sessions = doc.sessions.filter((s) => s.account !== a.id);
          return { status: 'signed_out' };
        },
        { ephemeral: true }
      );
    if (path === '/auth/password') {
      if (!(await checkPassword(data?.current_password, account.password_hash)))
        fail('Senha atual incorreta.', 403);
      credentials(account.username, data?.password);
      const hash = await hashPassword(data.password);
      return this.write(token, (doc, a) => {
        a.password_hash = hash;
        a.session_version++;
        return this.session(doc, a);
      });
    }
    if (path === '/api/admin/snapshots') {
      admin(account);
      return clone(document.snapshots || []);
    }
    if (path === '/api/admin/snapshots/restore' && method === 'POST')
      return this.write(token, (doc, a) => {
        admin(a);
        const entry = doc.snapshots.find((s) => s.id === data.id);
        if (!entry) fail('Backup não encontrado.');
        if (entry.kind === 'character') {
          const previous = find(doc, entry.character_id);
          revision(previous, data.revision);
          return commit(doc, previous, entry.data, a, 'Revisão restaurada', entry.at);
        }
        fail('Exporte a revisão do livro e importe pelo painel de regras.');
      });
    if (path === '/api/game') {
      if (method === 'GET') return clone(document.game);
      return this.write(token, (doc, a) => {
        admin(a);
        if (data._expected_revision !== undefined && data._expected_revision !== doc.game._revision)
          fail('O livro mudou. Reabra a edição antes de salvar.', 409);
        const source = clone(data);
        delete source._expected_revision;
        const game = validateSettings(gameSettings(validateGame(source)));
        game._revision = doc.game._revision + 1;
        const additions = Object.fromEntries(
          stats.map((key) => [
            key,
            game[key]
              .filter((entry) => !doc.game[key].some((old) => old.id === entry.id))
              .map((entry) => entry.id)
          ])
        );
        const withNewTraits = (p) => {
          const next = clone(p);
          let changed = false;
          for (const key of stats)
            for (const id of additions[key])
              if (!next[key].some((e) => e.id === id)) {
                next[key].push({ id, value: 0 });
                changed = true;
              }
          try {
            validatePlayer(next, game);
          } catch (error) {
            fail(
              `O livro não é compatível com ${p.char} (#${p.id}): ${error.message} Confira os IDs e limites do catálogo antes de importar. Nenhuma ficha foi alterada.`
            );
          }
          return { next, changed };
        };
        const characters = doc.characters.map((p) => ({ previous: p, ...withNewTraits(p) }));
        const proposals = (doc.submissions || [])
          .filter((s) => !['approved', 'rejected'].includes(s.status))
          .map((s) => ({ record: s, ...withNewTraits(s.character) }));
        snap(doc, 'game', doc.game);
        doc.game = game;
        for (const { previous, next, changed } of characters)
          if (changed)
            commit(
              doc,
              previous,
              next,
              a,
              'Catálogo ampliado',
              'Novos traços disponíveis com nível zero.'
            );
        for (const { record, next, changed } of proposals)
          if (changed) {
            record.character = next;
            record._revision++;
            record.review_revision++;
            record.updated_at = timestamp();
          }
        return { status: 'saved' };
      });
    }
    if (path === '/api/characters/new-id') {
      admin(account);
      return { id: recordId(document) };
    }
    if (path === '/api/admin/characters' && method === 'POST') {
      admin(account);
      let loginHash;
      if (data.access?.password) {
        credentials(data.access.username, data.access.password);
        loginHash = await hashPassword(data.access.password);
      }
      return this.write(token, (doc, a) => {
        admin(a);
        const p = validatePlayer(data.character, doc.game);
        if (doc.characters.some((x) => x.id === p.id))
          fail('Este ID já está em uso. Gere outro ID no formulário.', 409);
        if (data.access) {
          if (!loginHash) fail('Preencha a senha inicial.');
          const user = accountRecord(
            { ...data.access, display_name: p.player, role: 'player' },
            loginHash
          );
          if (doc.accounts.some((x) => x.username === user.username))
            fail('Esse login já existe. Escolha outro ou desmarque a criação de acesso.', 409);
          user.character_ids = [p.id];
          doc.accounts.push(user);
        }
        p._revision = 0;
        p.created_at = timestamp();
        p.history = [
          {
            at: timestamp(),
            actor: a.display_name,
            action: 'Ficha cadastrada',
            details: 'Transcrição pelo narrador'
          }
        ];
        doc.characters.push(p);
        return publicPlayer(p);
      });
    }
    if (path.startsWith('/api/admin/accounts')) {
      admin(account);
      if (method === 'GET') return document.accounts.map(publicAccount);
      let hash;
      if (data?.password) {
        credentials(method === 'POST' ? data.username : account.username, data.password);
        hash = await hashPassword(data.password);
      }
      return this.write(token, (doc, a) => {
        admin(a);
        let target;
        if (method === 'POST') {
          if (!hash) fail('Preencha a senha.');
          target = accountRecord(data, hash);
          if (doc.accounts.some((x) => x.username === target.username))
            fail('Esse login já existe.', 409);
          doc.accounts.push(target);
        } else {
          target = doc.accounts.find((x) => x.id === path.split('/').pop());
          if (!target) fail('Conta não encontrada.', 404);
          if (target.registration && target.registration.status !== 'approved')
            fail('Use Avaliar cadastros para aprovar esta entrada.', 409);
          target.session_version++;
        }
        if (data.role !== undefined) {
          if (!['admin', 'player'].includes(data.role)) fail('Permissão inválida.');
          target.role = data.role;
        }
        if (data.display_name !== undefined)
          target.display_name = text(data.display_name, 'Nome', 100, true);
        if (data.character_ids !== undefined) {
          target.character_ids = links(doc, data.character_ids);
          target._campaign_member = true;
        }
        if (target.role === 'admin') {
          target.character_ids = [];
          target.memberships = Object.fromEntries(
            Object.keys(target.memberships || {}).map((id) => [id, []])
          );
        } else if (data.character_ids !== undefined) {
          for (const other of doc.accounts)
            if (other.id !== target.id)
              other.character_ids = other.character_ids.filter(
                (id) => !target.character_ids.includes(id)
              );
          for (const id of target.character_ids) {
            const p = doc.characters.find((p) => p.id === id);
            p.owner_id = target.id;
            p.player = target.display_name;
          }
        }
        if (data.campaign_access === false && target.role === 'player') {
          target.character_ids = [];
          target._campaign_member = false;
          target._revoke_campaign = true;
        } else if (data.campaign_access === true) target._campaign_member = true;
        for (const p of doc.characters) {
          const owner = doc.accounts.find(
            (u) => u.role === 'player' && u.character_ids.includes(p.id)
          );
          p.owner_id = owner?.id || '';
          if (owner) p.player = owner.display_name;
        }
        if (data.active !== undefined) {
          if (typeof data.active !== 'boolean') fail('Estado de acesso inválido.');
          target.active = data.active;
        }
        if (hash) target.password_hash = hash;
        if (!doc.accounts.some((x) => x.role === 'admin' && x.active))
          fail('Mantenha um narrador ativo.');
        return publicAccount(target);
      });
    }
    if (path.split('?')[0] === '/api/characters' && method === 'GET')
      return document.characters
        .filter(
          (p) =>
            (account.role === 'admin' || account.character_ids.includes(p.id)) &&
            (!p.archived || (account.role === 'admin' && path.includes('archived=1')))
        )
        .map(publicPlayer);
    if (path === '/api/characters/import' && method === 'POST')
      return this.write(token, (doc, a) => {
        admin(a);
        const p = validatePlayer(data.character, doc.game),
          existing = doc.characters.find((x) => x.id === p.id);
        if (existing) {
          if (data.replace !== true)
            fail(
              'Já existe uma ficha com esse ID. Escolha substituir explicitamente para preservá-la em backup.',
              409
            );
          revision(existing, data.revision);
          return commit(doc, existing, p, a, 'Ficha importada');
        }
        p._revision = 0;
        p.history = [];
        doc.characters.push(p);
        return publicPlayer(p);
      });
    const match = path.match(/^\/api\/characters\/(\d+)(?:\/(\w+))?$/);
    if (!match) fail('Recurso não encontrado.', 404);
    const id = Number(match[1]),
      action = match[2];
    scope(account, id);
    const current = find(document, id);
    if (method === 'GET') return publicPlayer(current);
    return this.write(token, (doc, a) => {
      scope(a, id);
      const p = find(doc, id);
      revision(p, data.revision);
      if (p.archived && action !== 'archive') fail('Restaure a ficha antes de editar.', 409);
      const next = clone(p);
      let label = 'Ficha atualizada',
        details = '';
      if (action === 'aspiration') {
        if (method !== 'POST' || data.confirmed !== true)
          fail('Confirme antes de encerrar este objetivo.');
        if (
          !['ambition', 'desire'].includes(data.kind) ||
          !['complete', 'abandon'].includes(data.outcome)
        )
          fail('Objetivo inválido.');
        const previous = next.aspirations[data.kind];
        if (!previous) fail('Este objetivo já está vazio.', 409);
        next.aspirations[data.kind] = '';
        label = `${data.kind === 'ambition' ? 'Ambição' : 'Desejo'} ${data.outcome === 'complete' ? (data.kind === 'ambition' ? 'concluída' : 'concluído') : data.kind === 'ambition' ? 'abandonada' : 'abandonado'}`;
        details = previous;
      } else if (action === 'upgrade') {
        const quote = upgradeQuote(next, gameSettings(doc.game), data.key, data.id, data.target);
        if (!quote.affordable) fail(`XP insuficiente. São necessários ${quote.cost} XP.`);
        if (doc.game.progression?.require_confirmation !== false && data.confirmed !== true)
          fail('Confirme a evolução antes de gastar XP.');
        if (data.quoted_cost !== quote.cost)
          fail('O custo mudou. Revise a evolução e confirme novamente.', 409);
        const key = data.key,
          field =
            key === 'bloodpotency' ? 'bloodpotency' : key === 'disciplines' ? 'nivel' : 'value';
        let entry = key === 'bloodpotency' ? next : next[key].find((x) => x.id === data.id);
        if (!entry) {
          entry = { id: data.id, [field]: 0 };
          next[key].push(entry);
        }
        entry[field] = data.target;
        if (key === 'disciplines') {
          for (const [parent, primary] of Object.entries(next.primary_paths || {})) {
            if (Number(parent) !== data.id && primary !== data.id) continue;
            for (const linked of [Number(parent), primary]) {
              const row = next.disciplines.find((d) => d.id === linked);
              if (row) row.nivel = data.target;
            }
          }
        }
        next.xp -= quote.cost;
        label = 'Evolução';
        const name =
          key === 'bloodpotency'
            ? 'Potência do sangue'
            : doc.game[key].find((e) => e.id === data.id).name;
        details = `${name}: ${quote.from} → ${data.target} · −${quote.cost} XP · saldo ${next.xp} XP.`;
      } else if (action === 'xp') {
        admin(a);
        const amount = number(data.amount, 'XP', -100000, 100000);
        next.xp = number(next.xp + amount, 'Saldo de XP');
        label = 'XP do narrador';
        details = `${amount >= 0 ? '+' : ''}${amount} XP · ${text(data.reason || 'Sessão', 'Motivo', 200)}`;
      } else if (action === 'archive') {
        admin(a);
        if (typeof data.archived !== 'boolean') fail('Estado de arquivamento inválido.');
        next.archived = data.archived;
        label = next.archived ? 'Personagem arquivado' : 'Personagem restaurado';
      } else if (action === 'full') {
        admin(a);
        const full = validatePlayer(data.character, doc.game);
        if (full.id !== p.id) fail('O ID de uma ficha existente não pode ser alterado.');
        Object.assign(next, full);
        label = 'Transcrição revisada';
      } else if (!action && method === 'PATCH') {
        if (!data.patch || typeof data.patch !== 'object' || Array.isArray(data.patch))
          fail('Alteração inválida.');
        const allowed =
          a.role === 'admin'
            ? new Set([
                ...EDITABLE,
                ...stats,
                'char',
                'player',
                'cla',
                'generation',
                'bloodpotency',
                'disciplines',
                'rituals',
                'caracteristics',
                'moralityes'
              ])
            : EDITABLE;
        if (Object.keys(data.patch).some((k) => !allowed.has(k)))
          fail('Este campo é exclusivo do narrador.', 403);
        Object.assign(next, clone(data.patch));
        details = Object.keys(data.patch).join(', ');
      } else fail('Ação não encontrada.', 404);
      if (action === 'full' || (!action && method === 'PATCH'))
        details = characterChanges(p, next, doc.game) || details;
      if (a.role === 'admin' && data.log_message)
        details += (details ? ' · ' : '') + text(data.log_message, 'Mensagem do histórico', 2000);
      return commit(doc, p, next, a, label, details);
    });
  }
}
