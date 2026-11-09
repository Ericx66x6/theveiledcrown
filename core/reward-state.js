import { fail, number, text } from './model.js';
export function validateRewardAccount(account) {
  const stamp = (value, label, optional = false) => {
    if (optional && value === null) return;
    if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value)))
      fail(label + ' inválida.');
  };
  const list = (value, label, max) => {
    if (
      !Array.isArray(value) ||
      value.length > max ||
      value.some((v) => !v || typeof v !== 'object') ||
      new Set(value.map((v) => v.id)).size !== value.length
    )
      fail(label + ' inválidos.');
    for (const item of value) text(item.id, 'ID de recompensa', 100, true);
    return value;
  };
  if (account.registration) {
    const r = account.registration;
    if (!['pending', 'approved', 'rejected'].includes(r.status))
      fail('Estado de cadastro inválido.');
    if (
      r.status !== 'approved' &&
      (account.active || account.role !== 'player' || Object.keys(account.memberships || {}).length)
    )
      fail('Cadastro não aprovado não pode ter acesso.');
    number(r._revision, 'Revisão de cadastro', 1);
    stamp(r.requested_at, 'Data de cadastro');
    if (r.reviewed_at) stamp(r.reviewed_at, 'Data de avaliação');
    text(r.note || '', 'Parecer', 2000);
  }
  if (account.login_rewards !== undefined) {
    const records = account.login_rewards;
    if (
      !records ||
      typeof records !== 'object' ||
      Array.isArray(records) ||
      Object.keys(records).length > 1000
    )
      fail('Presenças de campanhas inválidas.');
    for (const [id, t] of Object.entries(records)) {
      text(id, 'Campanha da presença', 100, true);
      if (!t || typeof t !== 'object') fail('Sequência de presença inválida.');
      number(t.streak, 'Sequência', 0);
      number(t.best, 'Melhor sequência', t.streak);
      number(t.progress, 'Progresso', 0, 60);
      text(t.rule, 'Regra da presença', 200, true);
      if (
        t.last_day !== null &&
        (typeof t.last_day !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(t.last_day) ||
          !Number.isFinite(Date.parse(t.last_day)))
      )
        fail('Dia de presença inválido.');
      for (const c of list(t.credits, 'Créditos de presença', 10000)) {
        number(c.xp, 'XP de presença', 1, 10000);
        number(c.days, 'Dias de presença', 1, 60);
        stamp(c.earned_at, 'Data de conquista');
        stamp(c.claimed_at, 'Data de resgate', true);
        if (c.claimed_at) number(c.character_id, 'Personagem da recompensa', 0, 999999);
      }
    }
  }
  if (account.reward_events !== undefined) {
    for (const e of list(account.reward_events, 'Recibos de recompensa', 550)) {
      if (
        ![
          'xp',
          'upgrade',
          'discipline',
          'check-in',
          'streak-break',
          'achievement',
          'blood-bond'
        ].includes(e.kind)
      )
        fail('Tipo de recibo inválido.');
      text(e.campaign_id, 'Campanha do recibo', 100, true);
      stamp(e.created_at, 'Data do recibo');
      stamp(e.seen_at, 'Data de leitura', true);
      if (e.character_id !== undefined) number(e.character_id, 'Personagem do recibo', 0, 999999);
      if (e.kind === 'xp') number(e.amount, 'XP recebido', 1);
      if (e.kind === 'achievement') {
        text(e.name, 'Conquista', 300, true);
        text(e.icon, 'Ícone', 24, true);
        text(e.achievement_id, 'Conquista', 100, true);
      }
      if (e.kind === 'blood-bond') {
        text(e.subject, 'Vínculo', 150, true);
        number(e.level, 'Nível do vínculo', 0, 5);
        if (
          !['bound', 'dominion', 'release', 'loss'].includes(e.polarity) ||
          !['bound_to', 'holds'].includes(e.direction)
        )
          fail('Recibo de laço inválido.');
      }
      if (
        ['discipline', 'upgrade'].includes(e.kind) &&
        (!Array.isArray(e.changes) || e.changes.length > 50)
      )
        fail('Evoluções do recibo inválidas.');
    }
  }
}
