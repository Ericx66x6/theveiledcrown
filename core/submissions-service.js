import {
  clone,
  fail,
  newId,
  timestamp,
  validatePlayer,
  publicPlayer,
  recordId,
  number,
  text
} from './model.js';
import { notification, requireAdmin, assertRevision } from './management-service.js';
import { creationReport, evaluateCreation } from './character-creation.js';
export { creationReport };
function own(s, a) {
  if (a.role !== 'admin' && s.created_by !== a.id)
    fail('Esta proposta pertence a outro jogador.', 403);
}
function sanitizeCharacter(source, d, account, narrator = false) {
  if (source?.creation && !narrator) {
    const result = evaluateCreation({ ...source, player: account.display_name }, d.game);
    if (result.report.issues.length) fail(result.report.issues[0].message);
    source = result.character;
  }
  const p = validatePlayer(source, d.game);
  p.player = account.display_name;
  if (!narrator) {
    p.xp = d.game.character_creation.starting_xp;
    if (!p.creation) p.money = d.game.character_creation.starting_money;
  }
  p.archived = false;
  p.owner_id = account.id;
  p.history = [];
  p.transactions = [];
  p.rolls = [];
  p._revision = 0;
  delete p.token;
  delete p.password;
  delete p.password_hash;
  return p;
}
const author = (d, id) => {
  const a = d.accounts.find(
    (a) => a.id === id && a.active && a.role === 'player' && a._campaign_member
  );
  if (!a) fail('O autor precisa ser um jogador ativo desta campanha.');
  return a;
};
function validateCount(d, a, except) {
  const count =
    d.characters.filter((p) => a.character_ids.includes(p.id)).length +
    d.submissions.filter(
      (s) =>
        s.created_by === a.id && !['approved', 'rejected'].includes(s.status) && s.id !== except
    ).length;
  if (count >= d.game.character_creation.max_characters_per_player)
    fail('Limite de personagens e propostas atingido nesta campanha.');
}
export async function submissionsRequest(service, path, method, data, token, doc, account) {
  const [, , , id, action] = path.split('/');
  if (method === 'GET') {
    const rows = doc.submissions
      .filter((s) => account.role === 'admin' || s.created_by === account.id)
      .map((s) => ({
        ...clone(s),
        report: creationReport(s.character, doc.game),
        author_name:
          doc.accounts.find((a) => a.id === s.created_by)?.display_name || 'Jogador removido'
      }));
    if (id) {
      const s = rows.find((s) => s.id === id);
      if (!s) fail('Proposta não encontrada.', 404);
      return s;
    }
    return rows;
  }
  return service.write(token, (d, a) => {
    let s = id ? d.submissions.find((s) => s.id === id) : null;
    if (id && !s) fail('Proposta não encontrada.', 404);
    if (s) {
      own(s, a);
      assertRevision(s, data);
    }
    if (s && ['approved', 'rejected'].includes(s.status))
      fail('Esta avaliação já foi encerrada.', 409);
    if (action === 'approve') {
      requireAdmin(a);
      const owner = author(d, s.created_by);
      validateCount(d, owner, s.id);
      const p = validatePlayer(s.character, d.game),
        report = creationReport(p, d.game);
      if (report.issues.length && (!data.override || !data.reason?.trim()))
        fail('Ajuste os pontos ou informe uma justificativa para aprovar a exceção.');
      if (d.characters.some((c) => c.id === p.id)) p.id = recordId(d);
      p.player = owner.display_name;
      p.owner_id = owner.id;
      p._revision = 0;
      p.created_at = timestamp();
      p.history = [
        {
          at: p.created_at,
          actor: a.display_name,
          action: 'Ficha aprovada',
          details: data.reason || 'Avaliação do narrador'
        }
      ];
      owner.character_ids.push(p.id);
      owner._campaign_member = true;
      d.characters.push(p);
      s.character = clone(p);
      s.status = 'approved';
      s.approved_character_id = p.id;
      s.review_note = text(data.reason || data.note || 'Personagem aprovado.', 'Parecer', 5000);
      s.review_revision++;
      s._revision++;
      s.updated_at = timestamp();
      notification(d, {
        audience: 'account',
        recipient_id: owner.id,
        title: 'Seu personagem foi aprovado',
        message: p.char + ' está disponível para jogar.',
        target: s.id
      });
      return clone(s);
    }
    if (action === 'review') {
      requireAdmin(a);
      if (!['changes_requested', 'rejected'].includes(data.status))
        fail('Escolha solicitar ajustes ou recusar.');
      s.status = data.status;
      s.review_note = text(data.note, 'Parecer do narrador', 5000, true);
      s.review_revision++;
      s._revision++;
      s.updated_at = timestamp();
      notification(d, {
        audience: 'account',
        recipient_id: s.created_by,
        title:
          s.status === 'changes_requested' ? 'Ajustes solicitados na ficha' : 'Avaliação encerrada',
        message: s.review_note,
        target: s.id
      });
      return clone(s);
    }
    if (!d.game.character_creation.enabled && a.role !== 'admin')
      fail('A criação de personagens está desativada pelo narrador.', 403);
    const owner = s ? author(d, s.created_by) : author(d, a.id);
    validateCount(d, owner, s?.id);
    const p = sanitizeCharacter(data.character, d, owner, a.role === 'admin');
    if (!s) {
      if (d.submissions.length >= 500) fail('Máximo de 500 propostas nesta campanha.');
      if (
        d.characters.some((c) => c.id === p.id) ||
        d.submissions.some((s) => s.character.id === p.id)
      )
        p.id = recordId({
          characters: [...d.characters, ...d.submissions.map((s) => s.character)]
        });
      s = {
        id: newId(),
        created_by: owner.id,
        created_at: timestamp(),
        status: 'pending',
        character: p,
        review_note: '',
        review_revision: 0,
        submission_revision: 1,
        _revision: 1,
        updated_at: timestamp()
      };
      d.submissions.unshift(s);
      notification(d, {
        title: 'Nova ficha para avaliar',
        message: owner.display_name + ' enviou ' + p.char + '.',
        target: s.id
      });
    } else {
      s.character = p;
      s._revision++;
      s.updated_at = timestamp();
      if (a.role === 'admin') {
        s.review_revision++;
        s.review_note = text(data.note || s.review_note || '', 'Parecer', 5000);
      } else {
        s.submission_revision++;
        s.status = 'pending';
        notification(d, {
          title: 'Ficha atualizada pelo jogador',
          message: owner.display_name + ' reenviou ' + p.char + '.',
          target: s.id
        });
      }
    }
    return { ...clone(s), report: creationReport(p, d.game) };
  });
}
export function submissionPackage(doc, s, a) {
  own(s, a);
  return {
    format: 'coroa-submission-v4',
    campaign_id: doc.id,
    campaign_title: doc.title,
    author_id: s.created_by,
    base_review_revision: s.review_revision,
    submission: clone(s)
  };
}
export async function importSubmission(service, data, token) {
  return service.write(token, (d, a) => {
    requireAdmin(a);
    const packet = data.document;
    if (packet?.format !== 'coroa-submission-v4' || packet.campaign_id !== d.id)
      fail('Selecione uma solicitação JSON desta campanha.');
    const source = packet.submission;
    if (!source || typeof source.id !== 'string' || !/^[a-zA-Z0-9_-]{5,100}$/.test(source.id))
      fail('Solicitação inválida.');
    const owner = author(d, data.author_id || packet.author_id),
      existing = d.submissions.find((s) => s.id === source.id);
    if (existing) {
      if (existing.created_by !== owner.id)
        fail('O autor não corresponde à proposta existente.', 409);
      if (['approved', 'rejected'].includes(existing.status))
        fail('Esta proposta já foi avaliada.', 409);
      if (packet.base_review_revision !== existing.review_revision)
        fail(
          'O narrador já alterou esta proposta. Envie um pacote atualizado ao jogador antes de receber outra versão.',
          409
        );
      if (source.submission_revision <= existing.submission_revision)
        return { status: 'already_received', id: existing.id };
    }
    validateCount(d, owner, existing?.id);
    const p = sanitizeCharacter(source.character, d, owner);
    let s;
    if (existing) {
      s = existing;
      s.character = p;
      s.submission_revision = number(source.submission_revision, 'Revisão de envio', 1);
      s._revision++;
      s.status = 'pending';
    } else {
      if (d.submissions.length >= 500) fail('Máximo de 500 propostas nesta campanha.');
      if (
        d.characters.some((c) => c.id === p.id) ||
        d.submissions.some((s) => s.character.id === p.id)
      )
        p.id = recordId({
          characters: [...d.characters, ...d.submissions.map((s) => s.character)]
        });
      s = {
        id: source.id,
        created_by: owner.id,
        created_at: timestamp(),
        character: p,
        status: 'pending',
        review_note: '',
        review_revision: 0,
        submission_revision: number(source.submission_revision, 'Revisão de envio', 1),
        _revision: 1
      };
      d.submissions.unshift(s);
    }
    s.updated_at = timestamp();
    notification(d, {
      title: 'Solicitação JSON recebida',
      message: owner.display_name + ' enviou ' + p.char + '.',
      target: s.id
    });
    return clone(s);
  });
}
