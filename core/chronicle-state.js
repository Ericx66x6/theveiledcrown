import { clone, fail, number, text } from './model.js';
import { imageData } from './image-data.js';

export const recapFields = [
  {
    key: 'scene',
    label: 'A última cena',
    hint: 'Onde você estava, com quem e em qual situação a história parou?',
    min: 8,
    max: 3000
  },
  {
    key: 'events',
    label: 'O que aconteceu de importante?',
    hint: 'Conte decisões, descobertas e consequências. O que mudou para o personagem?',
    min: 25,
    max: 12000
  },
  {
    key: 'pending',
    label: 'O que ficou em aberto?',
    hint: 'Pistas, riscos, promessas, favores e assuntos que ainda precisam de resposta.',
    min: 8,
    max: 5000
  },
  {
    key: 'next',
    label: 'Seu próximo passo',
    hint: 'O que seu personagem pretende tentar quando a história continuar?',
    min: 5,
    max: 3000
  }
];
export const words = (value) =>
  String(value || '').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
const plain = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
export function recapQuality(entry, minWords = 80) {
  const sections = recapFields.map((f) => ({
    ...f,
    count: words(entry[f.key]).length,
    complete: words(entry[f.key]).length >= f.min
  }));
  const all = sections.flatMap((f) => words(entry[f.key]));
  const distinct = new Set(all.map(plain).filter((w) => w.length > 2)).size;
  const complete = sections.every((f) => f.complete) && all.length >= minWords && distinct >= 22;
  return {
    sections,
    total: all.length,
    minimum: minWords,
    distinct,
    complete,
    coverage: Math.round((100 * sections.filter((f) => f.complete).length) / sections.length)
  };
}
export const recapFingerprint = (entry) => recapFields.map((f) => plain(entry[f.key])).join('\n');
export const feedbackKinds = [
  ['narration', 'Narração'],
  ['story', 'História'],
  ['system', 'Sistema'],
  ['bug', 'Encontrei um bug'],
  ['idea', 'Sugestão'],
  ['praise', 'Algo que gostei']
];
export const documentKinds = [
  ['letter', 'Carta'],
  ['news', 'Notícia'],
  ['decree', 'Decreto'],
  ['evidence', 'Evidência'],
  ['lore', 'Registro da crônica']
];
export const achievementIcons = [
  '👑',
  '🩸',
  '⚔️',
  '⛓️',
  '🌙',
  '🔥',
  '📜',
  '💎',
  '🕯️',
  '🦇',
  '⚜️',
  '🗝️'
];
const list = (value, label, max = 100000) => {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((v) => !v || typeof v !== 'object') ||
    new Set(value.map((v) => v.id)).size !== value.length
  )
    fail(label + ': lista inválida.');
  for (const row of value) text(row.id, 'ID', 100, true);
  return value;
};
const stamp = (value) => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    fail('Data de registro inválida.');
};
export function validateChronicle(c) {
  for (const r of list(c.recaps || [], 'Relatos')) {
    number(r.character_id, 'Personagem', 0, 999999);
    text(r.character_name, 'Personagem', 150, true);
    text(r.created_by, 'Autor', 100, true);
    text(r.title, 'Título', 200, true);
    for (const f of recapFields) text(r[f.key] || '', f.label, f.max);
    text(r.cast || '', 'Envolvidos', 1500);
    if (!['draft', 'submitted', 'changes_requested', 'reviewed', 'rewarded'].includes(r.status))
      fail('Estado do relato inválido.');
    number(r._revision, 'Revisão', 0);
    stamp(r.created_at);
    stamp(r.updated_at);
    text(r.review_note || '', 'Parecer', 5000);
    if (r.reward) {
      number(r.reward.xp, 'XP do relato', 1, 1);
      number(r.reward.character_id, 'Personagem da recompensa', 0, 999999);
      stamp(r.reward.at);
    }
  }
  for (const f of list(c.feedbacks || [], 'Feedbacks')) {
    text(f.created_by, 'Autor', 100, true);
    text(f.title, 'Título', 200, true);
    text(f.content, 'Feedback', 15000, true);
    text(f.impact || '', 'Impacto', 5000);
    text(f.suggestion || '', 'Sugestão', 5000);
    text(f.reply || '', 'Resposta', 5000);
    if (
      !feedbackKinds.some(([k]) => k === f.kind) ||
      !['submitted', 'reviewed', 'rewarded'].includes(f.status)
    )
      fail('Feedback inválido.');
    number(f._revision, 'Revisão', 0);
    stamp(f.created_at);
    stamp(f.updated_at);
    if (f.reward) {
      number(f.reward.xp, 'XP do feedback', 1, 100000);
      number(f.reward.character_id, 'Personagem', 0, 999999);
      stamp(f.reward.at);
    }
  }
  for (const d of list(c.documents || [], 'Documentos')) {
    text(d.title, 'Título', 200, true);
    text(d.body || '', 'Documento', 50000);
    text(d.issuer || '', 'Assinatura', 200);
    text(d.caption || '', 'Descrição', 2000);
    imageData(d.image || '');
    if (
      !documentKinds.some(([k]) => k === d.kind) ||
      !['campaign', 'restricted'].includes(d.access) ||
      !Array.isArray(d.account_ids) ||
      d.account_ids.length > 1000 ||
      d.account_ids.some((id) => typeof id !== 'string')
    )
      fail('Acesso do documento inválido.');
    if (!Array.isArray(d.read_by) || d.read_by.some((id) => typeof id !== 'string'))
      fail('Leituras do documento inválidas.');
    number(d._revision, 'Revisão', 0);
    stamp(d.created_at);
    stamp(d.updated_at);
  }
}
export function documentVisible(d, a) {
  return (
    a.role === 'admin' ||
    (a._campaign_member !== false && (d.access === 'campaign' || d.account_ids?.includes(a.id)))
  );
}
export function publicDocument(d, a) {
  const result = clone(d);
  if (a.role !== 'admin') {
    result.read = !!d.read_by?.includes(a.id);
    delete result.account_ids;
    delete result.read_by;
  }
  return result;
}
export function chronicleVisibility(c, a) {
  return {
    recaps: (c.recaps || []).filter(
      (r) =>
        a.role === 'admin' ||
        (a.character_ids || a.memberships?.[c.id] || []).includes(r.character_id)
    ),
    feedbacks: (c.feedbacks || []).filter((f) => a.role === 'admin' || f.created_by === a.id),
    documents: (c.documents || [])
      .filter((d) => documentVisible(d, a))
      .map((d) => publicDocument(d, a))
  };
}
export function rememberProgress(account, event) {
  if (!['upgrade', 'discipline'].includes(event.kind)) return;
  account.achievements ??= [];
  for (const [index, change] of (event.changes || []).entries()) {
    const id = event.id + '_' + index;
    if (account.achievements.some((a) => a.id === id)) continue;
    account.achievements.push({
      id,
      name: (change.learned ? 'Novo legado: ' : 'Ascensão: ') + change.name,
      icon: change.learned ? '🩸' : '⚔️',
      description: change.learned
        ? `${event.character_name} aprendeu ${change.name}.`
        : `${event.character_name}: ${change.name} passou do nível ${change.from} ao ${change.to}.`,
      earned_at: event.created_at,
      campaign_id: event.campaign_id,
      character_name: event.character_name || '',
      source: 'progress',
      source_id: event.id,
      level: change.to
    });
  }
}
export function validateAchievements(account) {
  for (const a of list(account.achievements || [], 'Conquistas')) {
    text(a.name, 'Conquista', 300, true);
    text(a.icon, 'Ícone', 24, true);
    text(a.description || '', 'Descrição', 5000);
    text(a.campaign_id || '', 'Campanha', 100);
    text(a.character_name || '', 'Personagem', 150);
    if (!['progress', 'narrator'].includes(a.source)) fail('Origem de conquista inválida.');
    stamp(a.earned_at);
  }
}
export function galleryState(account, { summary = false } = {}) {
  return {
    count: (account.achievements || []).length,
    entries: summary ? [] : clone(account.achievements || []),
    recent: clone((account.achievements || []).slice(-3)),
    events: clone(
      (account.reward_events || [])
        .filter((e) => e.kind === 'achievement' && !e.seen_at)
        .slice(0, 25)
    )
  };
}
