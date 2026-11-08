import { esc, icon, button, field, select, modal, toast, empty } from '../shared/ui.js';
import { api } from './api.js';
import { queueExperience } from './game-experience.js';

export function presenceWidget(ctx) {
  const r = ctx.state.rewards;
  if (ctx.admin() || !r || (!r.enabled && !r.pending.length)) return '';
  const pending = r.pending.reduce((sum, c) => sum + c.xp, 0);
  return `<section class="presence-strip"><span class="presence-strip-icon">${icon('blood')}</span><div><strong>${pending ? pending + ' XP aguardam você' : r.streak + ' dia(s) deixando sua marca'}</strong><small>${r.enabled ? `${r.progress}/${r.days} no ciclo · ${r.xp} XP a cada sequência completa` : 'Recompensas conquistadas continuam disponíveis.'}</small></div>${button(pending ? 'Receber recompensa' : 'Ver minha presença', 'nav-rewards', '', 'button ghost')}</section>`;
}
export function loyaltyPage(ctx) {
  const s = ctx.state,
    r = s.rewards;
  if (ctx.admin()) {
    const rule = s.game.login_rewards;
    return `<div class="page-intro"><span class="eyebrow">RITMO DA COMUNIDADE</span><h1>A presença deixa sua marca.</h1><p>Uma pequena recompensa por voltar à crônica. Cada conta mantém a própria sequência nesta campanha.</p></div><section class="panel loyalty-settings"><span class="tag red">CONFIGURAÇÃO DO NARRADOR</span><h2>Um motivo a mais para atravessar o véu.</h2><p>Hoje: <strong>${rule.xp} XP</strong> a cada <strong>${rule.days} dias consecutivos</strong>. ${rule.enabled ? 'Recompensas ativadas.' : 'Novas presenças desativadas.'}</p><p>O jogador escolhe um personagem aprovado para receber cada recompensa. Um acesso diário conta por campanha, mesmo com várias fichas.</p>${button(icon('edit') + ' Configurar recompensa', 'configure-login-rewards', '', 'button primary')}<div class="loyalty-rules"><p>◇ O dia vira à meia-noite em <strong>${esc(rule.time_zone)}</strong>, usando a data do servidor.</p><p>◇ Perder um dia reinicia o ciclo. XP já conquistado permanece guardado.</p><p>◇ Alterar os dias, o XP ou o fuso inicia um novo ciclo no próximo dia válido; créditos anteriores mantêm seu valor.</p></div></section>`;
  }
  if (!r) return empty('Escolha sua campanha.', 'As recompensas de presença ficam na sua mesa.');
  const total = r.pending.reduce((n, c) => n + c.xp, 0),
    pct = Math.round((r.progress / r.days) * 100);
  return `<div class="page-intro"><span class="eyebrow">A NOITE LEMBRA DE VOCÊ</span><h1>Deixe sua marca. Volte amanhã.</h1><p>Um encontro por dia com a sua crônica. Uma recompensa para o seu legado.</p></div><section class="loyalty-journey panel"><div class="loyalty-orbit" style="--progress:${pct}%"><span><strong>${r.progress}<small>/${r.days}</small></strong><small>DIAS DO CICLO</small></span></div><div class="loyalty-copy"><span class="tag ${r.checked_today ? 'red' : ''}">${!r.enabled ? 'PAUSADO' : r.checked_today ? 'PRESENÇA DE HOJE REGISTRADA' : 'A NOITE ESPERA POR VOCÊ'}</span><h2>${r.xp} XP a cada ${r.days} dias consecutivos.</h2><p>Entre uma vez por dia para alimentar a sequência. Ao completar o ciclo, escolha qual dos seus personagens recebe o XP.</p><div class="loyalty-records"><span><strong>${r.streak}</strong>dias seguidos</span><span><strong>${r.best}</strong>melhor sequência</span><span><strong>${total}</strong>XP para receber</span></div>${r.enabled && !r.checked_today ? button('Registrar presença de hoje ' + icon('arrow'), 'check-in', '', 'button primary') : ''}<small class="hint">Dias contados à meia-noite · ${esc(r.time_zone)}. Perdeu um dia? O ciclo reinicia; o que você já conquistou fica guardado.</small></div></section><div class="section-heading"><div><span class="eyebrow">SEU ESFORÇO VIROU PODER</span><h2>Recompensas conquistadas</h2></div></div><div class="login-credit-grid">${r.pending.map((c) => `<article class="panel login-credit"><span>${icon('powers')}</span><div><strong>+${c.xp} <small>XP</small></strong><p>${c.days} dias honrando a crônica.</p></div>${button('Escolher personagem', 'claim-login-reward', `data-id="${esc(c.id)}"`, 'button primary')}</article>`).join('') || empty('O próximo marco espera por você.', 'Complete um ciclo para guardar sua primeira recompensa.')}</div>`;
}
export async function loyaltyAction(action, data, ctx) {
  const s = ctx.state;
  if (action === 'check-in') {
    s.rewards = await api('/api/rewards/check-in', { method: 'POST', data: {} });
    ctx.draw();
    queueExperience(ctx);
    return true;
  }
  if (action === 'claim-login-reward') {
    const credit = s.rewards.pending.find((c) => c.id === data.id),
      characters = s.players.filter((p) => !p.archived);
    if (!credit) throw new Error('Atualize suas recompensas antes de continuar.');
    if (!characters.length) {
      modal(
        'Seu XP está guardado.',
        '<p>Você precisa de um personagem ativo e aprovado nesta campanha. Termine sua ficha e envie ao narrador; sua recompensa continuará aqui.</p>'
      );
      return true;
    }
    modal(
      'Quem recebe este legado?',
      `<div class="claim-summary">${icon('powers')}<strong>+${credit.xp} XP</strong><p>Uma recompensa, um personagem. Depois de receber, não é possível transferir este resgate.</p></div>${select(
        'character_id',
        'Personagem',
        characters.map((p) => ({ value: p.id, label: p.char + ' · ' + p.xp + ' XP disponíveis' })),
        characters.some((p) => p.id === s.player?.id) ? s.player.id : characters[0].id
      )}`,
      async (form) => {
        const p = characters.find((p) => p.id === Number(form.get('character_id')));
        await api('/api/rewards/claim', {
          method: 'POST',
          data: { credit_id: credit.id, character_id: p.id, revision: p._revision, confirmed: true }
        });
        await ctx.refresh();
      },
      { saveLabel: 'Confirmar e receber XP' }
    );
    return true;
  }
  if (action === 'configure-login-rewards' && ctx.admin()) {
    const rule = s.game.login_rewards;
    modal(
      'Recompensa de presença',
      `<div class="form-grid"><label class="checkbox full"><input type="checkbox" name="enabled" ${rule.enabled ? 'checked' : ''}> Ativar novas recompensas nesta campanha</label>${field('days', 'Dias consecutivos', rule.days, 'number', 'min="1" max="60" required step="1"')}${field('xp', 'XP por ciclo', rule.xp, 'number', 'min="1" max="10000" required step="1"')}${field('time_zone', 'Fuso horário', rule.time_zone, 'text', 'required maxlength="80" placeholder="America/Sao_Paulo"')}<p class="hint full">Use um fuso IANA. Alterações iniciam um novo ciclo no próximo dia válido. Recompensas conquistadas mantêm o valor anterior.</p></div>`,
      async (form) => {
        await api('/api/game', {
          method: 'PUT',
          data: {
            ...s.game,
            _expected_revision: s.game._revision,
            login_rewards: {
              enabled: form.has('enabled'),
              days: Number(form.get('days')),
              xp: Number(form.get('xp')),
              time_zone: form.get('time_zone').trim()
            }
          }
        });
        await ctx.refresh();
        toast('O próximo ciclo já tem novas regras.');
      }
    );
    return true;
  }
  return false;
}
