import { clone, fail, newId, number, publicPlayer } from './model.js';
import { commit } from './service.js';
import { rewardEvent } from './reward-events.js';
export function calendarDay(now, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const value = (type) => parts.find((p) => p.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
const ordinal = (day) => Date.parse(day + 'T12:00:00Z') / 86400000;
const signature = (rule) => `${rule.days}:${rule.xp}:${rule.time_zone}`;
const currentTime = (service) => new Date(service.now ? service.now() : Date.now());
export function loginRewardState(doc, account, now) {
  const rule = doc.game.login_rewards,
    track = account.login_rewards?.[doc.id];
  const today = calendarDay(now, rule.time_zone),
    sameRule = track?.rule === signature(rule);
  return {
    enabled: rule.enabled && doc.status !== 'closed',
    days: rule.days,
    xp: rule.xp,
    time_zone: rule.time_zone,
    today,
    checked_today: track?.last_day === today,
    streak: track?.streak || 0,
    best: track?.best || 0,
    progress: sameRule ? track?.progress || 0 : 0,
    pending: clone((track?.credits || []).filter((c) => !c.claimed_at)),
    events: clone(
      (account.reward_events || [])
        .filter(
          (e) =>
            !e.seen_at &&
            e.kind !== 'achievement' &&
            e.campaign_id === doc.id &&
            (!e.character_id || account.character_ids.includes(e.character_id))
        )
        .slice(0, 25)
    )
  };
}
export async function rewardsRequest(service, path, method, data, token, doc, account) {
  if (account.role !== 'player') fail('As recompensas pertencem ao acesso de jogador.', 403);
  if (!account._campaign_member) fail('Entre em uma campanha vinculada à sua conta.', 403);
  const now = currentTime(service),
    rule = doc.game.login_rewards;
  if (path === '/api/rewards' && method === 'GET') return loginRewardState(doc, account, now);
  if (path === '/api/rewards/check-in' && method === 'POST') {
    const state = loginRewardState(doc, account, now);
    if (!state.enabled || state.checked_today) return state;
    return service.write(token, (d, a) => {
      const r = d.game.login_rewards,
        today = calendarDay(now, r.time_zone);
      if (!r.enabled || d.status === 'closed') return loginRewardState(d, a, now);
      a.login_rewards ??= {};
      const t = (a.login_rewards[d.id] ??= {
        streak: 0,
        best: 0,
        progress: 0,
        last_day: null,
        credits: [],
        rule: signature(r)
      });
      if (t.last_day === today) return loginRewardState(d, a, now);
      if (t.last_day && ordinal(today) < ordinal(t.last_day))
        fail('A data desta presença já foi contabilizada.', 409);
      const consecutive = t.last_day && ordinal(today) - ordinal(t.last_day) === 1,
        previous = t.streak;
      const broken = !!t.last_day && !consecutive;
      if (broken)
        rewardEvent(d, a, {
          kind: 'streak-break',
          previous,
          character_name: 'Sua presença na crônica'
        });
      if (!consecutive || t.rule !== signature(r)) t.progress = 0;
      t.streak = consecutive ? t.streak + 1 : 1;
      t.best = Math.max(t.best, t.streak);
      t.progress++;
      t.last_day = today;
      t.rule = signature(r);
      const completed = t.progress >= r.days;
      if (completed) {
        t.credits.push({
          id: newId(),
          xp: r.xp,
          days: r.days,
          earned_at: now.toISOString(),
          claimed_at: null
        });
        t.progress = 0;
      }
      rewardEvent(d, a, {
        kind: 'check-in',
        progress: completed ? r.days : t.progress,
        days: r.days,
        streak: t.streak,
        completed,
        xp: r.xp
      });
      return loginRewardState(d, a, now);
    });
  }
  if (path === '/api/rewards/claim' && method === 'POST')
    return service.write(token, (d, a) => {
      if (d.status === 'closed') fail('A campanha está encerrada.', 409);
      const t = a.login_rewards?.[d.id],
        credit = t?.credits.find((c) => c.id === data.credit_id);
      if (!credit) fail('Recompensa não encontrada.', 404);
      if (credit.claimed_at) {
        if (credit.character_id !== data.character_id)
          fail('Esta recompensa já foi entregue a outro personagem.', 409);
        return { status: 'claimed', xp: credit.xp, character_id: credit.character_id };
      }
      if (data.confirmed !== true) fail('Confirme o personagem que recebe a recompensa.');
      const p = d.characters.find(
        (p) => p.id === data.character_id && !p.archived && a.character_ids.includes(p.id)
      );
      if (!p) fail('Escolha um dos seus personagens ativos e aprovados.', 403);
      if (p._revision !== data.revision) fail('A ficha mudou. Atualize antes de resgatar.', 409);
      const next = clone(p);
      next.xp = number(p.xp + credit.xp, 'XP acumulado');
      const saved = commit(
        d,
        p,
        next,
        a,
        'Recompensa de presença',
        `+${credit.xp} XP · ${credit.days} dias consecutivos`
      );
      credit.claimed_at = now.toISOString();
      credit.character_id = p.id;
      t.credits = [
        ...t.credits.filter((c) => !c.claimed_at),
        ...t.credits.filter((c) => c.claimed_at).slice(-100)
      ];
      return {
        status: 'claimed',
        xp: credit.xp,
        character_id: p.id,
        character: publicPlayer(saved)
      };
    });
  if (path === '/api/rewards/ack' && method === 'POST')
    return service.write(token, (d, a) => {
      if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length > 50)
        fail('Recibos de animação inválidos.');
      const entries = data.ids.map((id) =>
        (a.reward_events || []).find((e) => e.id === id && e.campaign_id === d.id)
      );
      if (entries.some((e) => !e)) fail('Recibo não encontrado.', 404);
      for (const e of entries) e.seen_at ??= now.toISOString();
      return { status: 'seen' };
    });
  fail('Recurso de recompensa não encontrado.', 404);
}
