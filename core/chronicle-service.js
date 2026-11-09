import { clone, fail, newId, number, text, timestamp, revision } from './model.js';
import { commit } from './service.js';
import { notification } from './notifications.js';
import { rewardEvent } from './reward-events.js';
import { requireAdmin, assertRevision } from './management-service.js';
import { imageData } from './image-data.js';
import {
  recapFields,
  recapQuality,
  recapFingerprint,
  feedbackKinds,
  documentKinds,
  documentVisible,
  publicDocument,
  galleryState
} from './chronicle-state.js';

export const isChroniclePath = (path) =>
  /^\/api\/(recaps|feedbacks|documents|achievements)(?:\/|$)/.test(path);
function character(d, a, id, { author = false } = {}) {
  const p = d.characters.find((p) => p.id === id && !p.archived);
  if (!p) fail('Escolha um personagem ativo.', 404);
  if ((author && a.role !== 'player') || (a.role !== 'admin' && !a.character_ids.includes(id)))
    fail('Esta história pertence a outro personagem.', 403);
  return p;
}
function reviewedReward(d, actor, entry, data, xp, reason, ownerId) {
  if (entry.reward) fail('Esta contribuição já foi recompensada.', 409);
  if (data.confirmed !== true) fail('Confirme a recompensa.');
  const p = character(d, actor, data.character_id),
    owner = d.accounts.find(
      (a) => a.id === ownerId && a.active && a.role === 'player' && a.character_ids.includes(p.id)
    );
  if (!owner) fail('Escolha uma ficha ativa que pertença ao autor desta contribuição.', 409);
  revision(p, data.character_revision);
  const next = clone(p);
  next.xp = number(p.xp + xp, 'XP acumulado');
  commit(d, p, next, actor, reason, `+${xp} XP · ${entry.title}`);
  entry.reward = {
    xp,
    character_id: p.id,
    character_name: p.char,
    account_id: owner.id,
    at: timestamp(),
    by: actor.id
  };
  entry.status = 'rewarded';
}
const touch = (e) => {
  e._revision++;
  e.updated_at = timestamp();
};
function message(d, a, entry, title, kind, note = '') {
  notification(d, {
    audience: 'account',
    recipient_id: entry.created_by,
    title,
    message: note,
    kind,
    target: entry.id,
    created_by: a.id
  });
}
function recapRequest(service, path, method, data, token, doc, actor) {
  const [, id, action] = path.match(/^\/api\/recaps(?:\/([^/]+))?(?:\/(submit|review))?$/) || [];
  if (!/^\/api\/recaps(?:\/[^/]+)?(?:\/(submit|review))?$/.test(path))
    fail('Relato não encontrado.', 404);
  if (method === 'GET') {
    const visible = doc.recaps.filter(
      (r) => actor.role === 'admin' || actor.character_ids.includes(r.character_id)
    );
    const row = id ? visible.find((r) => r.id === id) : visible;
    if (id && !row) fail('Relato não encontrado.', 404);
    return clone(row);
  }
  return service.write(token, (d, a) => {
    let entry = id ? d.recaps.find((r) => r.id === id) : null;
    if ((id || action || method === 'DELETE') && !entry) fail('Relato não encontrado.', 404);
    if (entry && a.role !== 'admin' && !a.character_ids.includes(entry.character_id))
      fail('Relato não encontrado.', 404);
    if (method === 'DELETE') {
      if (a.role !== 'admin' && (entry.created_by !== a.id || entry.reward))
        fail('Somente o narrador remove relatos já recompensados.', 403);
      assertRevision(entry, data);
      d.recaps = d.recaps.filter((r) => r.id !== id);
      return { status: 'deleted' };
    }
    if (action === 'review') {
      requireAdmin(a);
      if (method !== 'POST') fail('Operação inválida.', 405);
      assertRevision(entry, data);
      if (!['submitted', 'reviewed'].includes(entry.status))
        fail('O relato precisa estar enviado para avaliação.', 409);
      const outcome = data.outcome;
      if (!['reward', 'changes', 'review'].includes(outcome)) fail('Avaliação inválida.');
      entry.review_note = text(data.note || '', 'Parecer', 5000, outcome === 'changes');
      if (outcome === 'reward') {
        const p = d.characters.find((p) => p.id === entry.character_id && !p.archived);
        if (!p) fail('O personagem não está mais ativo.', 409);
        reviewedReward(
          d,
          a,
          entry,
          { ...data, character_id: p.id },
          1,
          'Relato da crônica recompensado',
          entry.created_by
        );
      } else entry.status = outcome === 'changes' ? 'changes_requested' : 'reviewed';
      entry.reviewed_by = a.id;
      entry.reviewed_at = timestamp();
      touch(entry);
      message(
        d,
        a,
        entry,
        outcome === 'reward'
          ? 'Seu relato valeu +1 XP'
          : outcome === 'changes'
            ? 'Seu relato pode ganhar mais detalhes'
            : 'Seu relato foi lido',
        'recap',
        entry.review_note
      );
      return clone(entry);
    }
    if (a.role !== 'player')
      fail('O jogador escreve a própria história. Use a avaliação do narrador.', 403);
    const p = character(d, a, entry?.character_id ?? data.character_id, { author: true });
    if (entry) {
      if (entry.created_by !== a.id)
        fail('Este relato foi escrito por outro jogador. Crie um novo capítulo.', 403);
      assertRevision(entry, data);
      if (!['draft', 'changes_requested'].includes(entry.status))
        fail('Este relato já está em avaliação ou foi encerrado.', 409);
    }
    if (action === 'submit') {
      if (method !== 'POST') fail('Operação inválida.', 405);
      const quality = recapQuality(entry, d.game.chronicle.recap_min_words);
      if (!quality.complete)
        fail(
          `Complete os quatro tópicos com pelo menos ${quality.minimum} palavras e informações variadas antes de enviar.`
        );
      if (
        d.recaps.some(
          (r) => r.id !== entry.id && r.character_id === p.id && r.status === 'submitted'
        )
      )
        fail('Este personagem já tem um relato aguardando avaliação.', 409);
      if (
        d.recaps.some(
          (r) =>
            r.id !== entry.id &&
            r.character_id === p.id &&
            r.status !== 'draft' &&
            recapFingerprint(r) === recapFingerprint(entry)
        )
      )
        fail('Este conteúdo já foi registrado. Conte o que aconteceu de novo.', 409);
      entry.status = 'submitted';
      entry.submitted_at = timestamp();
      touch(entry);
      notification(d, {
        title: `${p.char} registrou onde parou`,
        message: 'Um novo relato aguarda sua leitura e pode receber +1 XP.',
        kind: 'recap',
        target: entry.id,
        created_by: a.id
      });
    } else {
      if (!['POST', 'PATCH'].includes(method) || (!id && method !== 'POST'))
        fail('Operação inválida.', 405);
      const fields = {
        title: text(data.title || 'Capítulo sem título', 'Título', 200, true),
        cast: text(data.cast || '', 'Envolvidos', 1500)
      };
      for (const f of recapFields) fields[f.key] = text(data[f.key] || '', f.label, f.max);
      if (entry) {
        Object.assign(entry, fields);
        touch(entry);
      } else {
        entry = {
          id: newId(),
          character_id: p.id,
          character_name: p.char,
          created_by: a.id,
          created_at: timestamp(),
          updated_at: timestamp(),
          _revision: 0,
          status: 'draft',
          review_note: '',
          ...fields
        };
        d.recaps.push(entry);
      }
    }
    return clone(entry);
  });
}
function feedbackRequest(service, path, method, data, token, doc, actor) {
  const match = path.match(/^\/api\/feedbacks(?:\/([^/]+))?(?:\/(review))?$/);
  if (!match) fail('Feedback não encontrado.', 404);
  const [, id, action] = match;
  if (method === 'GET') {
    const all = doc.feedbacks.filter((f) => actor.role === 'admin' || f.created_by === actor.id);
    const entry = id ? all.find((f) => f.id === id) : all;
    if (id && !entry) fail('Feedback não encontrado.', 404);
    return clone(entry);
  }
  return service.write(token, (d, a) => {
    const entry = id ? d.feedbacks.find((f) => f.id === id) : null;
    if (
      (id || action || method === 'DELETE') &&
      (!entry || (a.role !== 'admin' && entry.created_by !== a.id))
    )
      fail('Feedback não encontrado.', 404);
    if (method === 'DELETE') {
      if (a.role !== 'admin' && (entry.reward || entry.status !== 'submitted'))
        fail('Peça ao narrador para remover uma contribuição já avaliada.', 403);
      assertRevision(entry, data);
      d.feedbacks = d.feedbacks.filter((f) => f.id !== id);
      return { status: 'deleted' };
    }
    if (action === 'review') {
      requireAdmin(a);
      if (method !== 'POST') fail('Operação inválida.', 405);
      assertRevision(entry, data);
      const xp = number(data.xp ?? 0, 'XP da contribuição', 0, 100000);
      if (entry.reward) fail('Este feedback já foi recompensado.', 409);
      entry.reply = text(data.reply || '', 'Resposta do narrador', 5000);
      if (xp) reviewedReward(d, a, entry, data, xp, 'Feedback recompensado', entry.created_by);
      else entry.status = 'reviewed';
      entry.reviewed_by = a.id;
      entry.reviewed_at = timestamp();
      touch(entry);
      message(
        d,
        a,
        entry,
        xp ? `Seu feedback recebeu ${xp} XP` : 'O narrador respondeu seu feedback',
        'feedback',
        entry.reply
      );
      return clone(entry);
    }
    if (a.role !== 'player') fail('Esta área recebe as contribuições dos jogadores.', 403);
    if (!feedbackKinds.some(([k]) => k === data.kind)) fail('Escolha o assunto do feedback.');
    const fields = {
      kind: data.kind,
      title: text(data.title, 'Título', 200, true),
      content: text(data.content, 'O que você quer contar?', 15000, true),
      impact: text(data.impact || '', 'Impacto', 5000),
      suggestion: text(data.suggestion || '', 'Sugestão', 5000)
    };
    if (fields.content.length < 15)
      fail('Conte um pouco mais para o narrador entender o feedback.');
    if (id) {
      if (method !== 'PATCH') fail('Operação inválida.', 405);
      assertRevision(entry, data);
      if (entry.status !== 'submitted') fail('Este feedback já foi avaliado.', 409);
      Object.assign(entry, fields);
      touch(entry);
      return clone(entry);
    }
    if (method !== 'POST') fail('Operação inválida.', 405);
    const created = {
      id: newId(),
      created_by: a.id,
      created_at: timestamp(),
      updated_at: timestamp(),
      _revision: 0,
      status: 'submitted',
      reply: '',
      ...fields
    };
    d.feedbacks.push(created);
    notification(d, {
      title: `${a.display_name} enviou um feedback`,
      message: created.title,
      kind: 'feedback',
      target: created.id,
      created_by: a.id
    });
    return clone(created);
  });
}
function documentRequest(service, path, method, data, token, doc, actor) {
  const match = path.match(/^\/api\/documents(?:\/([^/]+))?(?:\/(read))?$/);
  if (!match) fail('Documento não encontrado.', 404);
  const [, id, action] = match;
  if (method === 'GET') {
    const list = doc.documents.filter((d) => documentVisible(d, actor));
    const entry = id ? list.find((d) => d.id === id) : list;
    if (id && !entry) fail('Documento não encontrado.', 404);
    return id ? publicDocument(entry, actor) : entry.map((d) => publicDocument(d, actor));
  }
  return service.write(token, (d, a) => {
    let entry = id ? d.documents.find((e) => e.id === id && documentVisible(e, a)) : null;
    if ((id || action || method === 'DELETE') && !entry) fail('Documento não encontrado.', 404);
    if (action === 'read') {
      if (method !== 'POST') fail('Operação inválida.', 405);
      if (!entry.read_by.includes(a.id)) entry.read_by.push(a.id);
      return publicDocument(entry, a);
    }
    requireAdmin(a);
    if (method === 'DELETE') {
      assertRevision(entry, data);
      d.documents = d.documents.filter((e) => e.id !== id);
      return { status: 'deleted' };
    }
    if (
      !documentKinds.some(([k]) => k === data.kind) ||
      !['campaign', 'restricted'].includes(data.access)
    )
      fail('Documento inválido.');
    if (
      !Array.isArray(data.account_ids) ||
      new Set(data.account_ids).size !== data.account_ids.length ||
      data.account_ids.some(
        (id) =>
          !d.accounts.some(
            (a) => a.id === id && a.role === 'player' && a.active && a._campaign_member
          )
      )
    )
      fail('Selecione jogadores ativos desta campanha.');
    const fields = {
      title: text(data.title, 'Título', 200, true),
      body: text(data.body || '', 'Conteúdo', 50000),
      issuer: text(data.issuer || '', 'Assinatura', 200),
      caption: text(data.caption || '', 'Descrição', 2000),
      image: imageData(data.image || ''),
      kind: data.kind,
      access: data.access,
      account_ids: data.access === 'restricted' ? clone(data.account_ids) : []
    };
    if (!fields.body && !fields.image) fail('Escreva o documento ou envie uma imagem.');
    const previous = entry ? clone(entry) : null;
    if (id) {
      if (method !== 'PATCH') fail('Operação inválida.', 405);
      assertRevision(entry, data);
      Object.assign(entry, fields);
      touch(entry);
    } else {
      if (method !== 'POST') fail('Operação inválida.', 405);
      entry = {
        id: newId(),
        ...fields,
        created_by: a.id,
        created_at: timestamp(),
        updated_at: timestamp(),
        _revision: 0,
        read_by: []
      };
      d.documents.push(entry);
    }
    for (const player of d.accounts.filter(
      (p) => p.active && p.role === 'player' && p._campaign_member && documentVisible(entry, p)
    ))
      if (!previous || !documentVisible(previous, player))
        notification(d, {
          audience: 'account',
          recipient_id: player.id,
          title: 'Um documento atravessou o véu',
          message: entry.title,
          kind: 'document',
          target: entry.id,
          created_by: a.id
        });
    return publicDocument(entry, a);
  });
}
function achievementRequest(service, path, method, data, token, doc, actor) {
  if (path === '/api/achievements/ack') {
    if (method !== 'POST') fail('Operação inválida.', 405);
    return service.write(token, (d, a) => {
      if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length > 50)
        fail('Recibos inválidos.');
      const events = data.ids.map((id) =>
        (a.reward_events || []).find((e) => e.id === id && e.kind === 'achievement')
      );
      if (events.some((e) => !e)) fail('Conquista não encontrada.', 404);
      for (const e of events) e.seen_at ??= timestamp();
      return { status: 'seen' };
    });
  }
  const match = path.match(/^\/api\/achievements(?:\/([^/]+))?$/);
  if (!match) fail('Conquista não encontrada.', 404);
  const [, id] = match;
  const targetId = data.account_id || actor.id;
  if (method === 'GET') {
    const target = doc.accounts.find((a) => a.id === targetId);
    if (!target) fail('Jogador não encontrado.', 404);
    if (target.id !== actor.id) requireAdmin(actor);
    if (target.id !== actor.id && !target._campaign_member)
      fail('Este jogador não pertence à campanha.', 403);
    return { ...galleryState(target), account_id: target.id, display_name: target.display_name };
  }
  return service.write(token, (d, a) => {
    requireAdmin(a);
    const target = d.accounts.find(
      (p) =>
        p.id === data.account_id &&
        p.role === 'player' &&
        (method === 'DELETE' || p.active) &&
        p._campaign_member
    );
    if (!target) fail('Selecione um jogador ativo desta campanha.');
    target.achievements ??= [];
    if (method === 'DELETE') {
      const entry = target.achievements.find((e) => e.id === id);
      if (!entry) fail('Conquista não encontrada.', 404);
      if (data.confirmed !== true) fail('Confirme a remoção da conquista.');
      target.achievements = target.achievements.filter((e) => e.id !== id);
      target.reward_events = (target.reward_events || []).filter((e) => e.achievement_id !== id);
      return { status: 'deleted' };
    }
    if (method !== 'POST' || id) fail('Operação inválida.', 405);
    const requestId = text(data.request_id, 'ID da entrega', 100, true);
    const previous = target.achievements.find(
      (e) => e.source_id === requestId && e.source === 'narrator'
    );
    if (previous) return clone(previous);
    if (data.confirmed !== true) fail('Confirme a entrega do feito.');
    const entry = {
      id: newId(),
      name: text(data.name, 'Nome do feito', 300, true),
      icon: text(data.icon || '👑', 'Ícone', 24, true),
      description: text(data.description || '', 'Descrição', 5000),
      earned_at: timestamp(),
      campaign_id: d.id,
      campaign_name: d.title,
      character_name: '',
      source: 'narrator',
      source_id: requestId,
      awarded_by: a.id
    };
    target.achievements.push(entry);
    rewardEvent(d, target, {
      kind: 'achievement',
      achievement_id: entry.id,
      name: entry.name,
      icon: entry.icon,
      description: entry.description
    });
    notification(d, {
      audience: 'account',
      recipient_id: target.id,
      title: 'Uma nova marca na sua eternidade',
      message: entry.name,
      kind: 'achievement',
      target: entry.id,
      created_by: a.id
    });
    return clone(entry);
  });
}
export async function chronicleRequest(service, path, { method = 'GET', data = {}, token } = {}) {
  const doc = await service.store.get(),
    actor = service.auth(doc, token);
  if (path.startsWith('/api/achievements'))
    return achievementRequest(service, path, method, data, token, doc, actor);
  if (actor.role !== 'admin' && !actor._campaign_member)
    fail('Entre em uma campanha vinculada à sua conta.', 403);
  if (
    method !== 'GET' &&
    doc.status === 'closed' &&
    !(actor.role === 'admin' && method === 'DELETE') &&
    !path.endsWith('/read')
  )
    fail('A campanha está encerrada.', 409);
  if (path.startsWith('/api/recaps'))
    return recapRequest(service, path, method, data, token, doc, actor);
  if (path.startsWith('/api/feedbacks'))
    return feedbackRequest(service, path, method, data, token, doc, actor);
  return documentRequest(service, path, method, data, token, doc, actor);
}
