import {
  $,
  esc,
  icon,
  button,
  field,
  area,
  select,
  modal,
  toast,
  date,
  empty
} from '../shared/ui.js';
import { api } from './api.js';
import { newId } from '../shared/rules.js';
import { achievementIcons } from '../core/chronicle-state.js';
export async function loadGallery(ctx, { silent = false } = {}) {
  const members = ctx.state.accounts.filter((a) => a.role === 'player' && a.campaign_access);
  const target = ctx.admin()
    ? members.find((a) => a.id === ctx.state.galleryAccountId) || members[0]
    : ctx.state.account;
  if (!target) {
    ctx.state.openGallery = { entries: [], events: [], display_name: '', account_id: null };
    return;
  }
  ctx.state.galleryAccountId = target.id;
  ctx.state.openGallery = await api('/api/achievements', {
    data: { account_id: target.id },
    silent
  });
}
export function achievementsPage(ctx) {
  const s = ctx.state,
    g = s.openGallery || { entries: [] },
    filter = s.achievementFilter || 'all';
  const entries = g.entries
    .filter((a) => filter === 'all' || a.source === filter)
    .sort((a, b) => b.earned_at.localeCompare(a.earned_at));
  const members = s.accounts.filter((a) => a.role === 'player' && a.campaign_access);
  return `<header class="page-intro achievement-intro"><span class="eyebrow">GALERIA DA ETERNIDADE</span><h1>O sangue lembra.<br>O seu nome permanece.</h1><p>Feitos e títulos pertencem ao jogador. As marcas de todos os seus personagens se encontram aqui.</p></header><section class="achievement-banner"><span class="achievement-banner-crown">${icon('accounts')}</span><div><span class="eyebrow">${ctx.admin() ? 'O LEGADO DE UM JOGADOR' : 'A SUA JORNADA NA COROA'}</span><h2>${esc(g.display_name || s.account.display_name)}</h2><p>${g.entries.length} marca(s) na eternidade · ${g.entries.filter((a) => a.source === 'narrator').length} reconhecimento(s) do narrador</p></div>${ctx.admin() && g.account_id ? button('Conceder feito ' + icon('plus'), 'achievement-award', members.find((a) => a.id === g.account_id)?.active ? '' : 'disabled', 'button primary') : ''}</section><div class="chronicle-toolbar">${
    ctx.admin()
      ? select(
          'gallery_account',
          'Jogador',
          members.map((a) => ({ value: a.id, label: a.display_name })),
          s.galleryAccountId
        )
      : ''
  }<div class="chronicle-filters">${[
    ['all', 'Todas as marcas'],
    ['narrator', 'Feitos e títulos'],
    ['progress', 'Evoluções']
  ]
    .map(([k, l]) =>
      button(
        l,
        'achievement-filter',
        `data-key="${k}" aria-pressed="${filter === k}"`,
        filter === k ? 'button primary' : 'button ghost'
      )
    )
    .join(
      ''
    )}</div></div><div class="achievement-grid">${entries.map((a) => `<button type="button" class="achievement-card ${a.source}" data-action="achievement-open" data-id="${a.id}"><span class="achievement-card-rays" aria-hidden="true"></span><span class="achievement-medallion" aria-hidden="true">${esc(a.icon)}</span><span class="eyebrow">${a.source === 'narrator' ? 'RECONHECIDO PELO NARRADOR' : 'UMA NOVA ASCENSÃO'}</span><h2>${esc(a.name)}</h2><p>${esc(a.description)}</p><span class="achievement-date">${date(a.earned_at)}</span>${a.character_name ? `<span class="achievement-character">${esc(a.character_name)}</span>` : '<span class="achievement-character">Um feito do jogador</span>'}</button>`).join('') || empty('Seu nome ainda será escrito aqui.', ctx.admin() ? 'Reconheça um jogador com seu primeiro feito ou título.' : 'As próximas evoluções e os reconhecimentos do narrador vão formar a sua galeria.')}</div>`;
}
export function bindAchievements(ctx) {
  const chooser = $('[name=gallery_account]');
  if (chooser)
    chooser.onchange = () =>
      ctx.safe(async () => {
        ctx.state.galleryAccountId = chooser.value;
        await loadGallery(ctx);
        ctx.draw();
      });
}
export async function achievementAction(action, data, ctx) {
  if (!action.startsWith('achievement-')) return false;
  if (action === 'achievement-filter') {
    ctx.state.achievementFilter = data.key;
    ctx.draw();
    return true;
  }
  if (action === 'achievement-award') {
    const target = ctx.state.openGallery;
    if (!target?.account_id) return true;
    const requestId = newId();
    modal(
      'Uma marca na eternidade',
      `<div class="achievement-recipient"><span class="eyebrow">ESTE FEITO PERTENCE AO JOGADOR</span><strong>${esc(target.display_name)}</strong></div><div class="form-grid">${field('name', 'Nome do feito ou título', '', 'text', 'required maxlength="300" placeholder="A voz que desafiou a corte"')}${field('icon', 'Ícone (emoji)', '👑', 'text', 'required maxlength="24"')}<div class="achievement-icon-picker full" aria-label="Sugestões de ícones">${achievementIcons.map((i) => `<button type="button" data-achievement-icon="${esc(i)}" aria-label="Usar ${esc(i)}">${i}</button>`).join('')}</div>${area('description', 'Por que este jogador merece essa marca?', '', 'maxlength="5000" placeholder="O momento, a escolha ou o motivo do reconhecimento…"')}</div><p class="hint">Ele receberá uma celebração ao abrir o portal. O título fica na conta e acompanha o jogador entre personagens.</p>`,
      async (form) => {
        await api('/api/achievements', {
          method: 'POST',
          data: {
            account_id: target.account_id,
            request_id: requestId,
            name: form.get('name'),
            icon: form.get('icon'),
            description: form.get('description'),
            confirmed: true
          }
        });
        await ctx.refresh();
        toast('Feito entregue à galeria do jogador.');
      },
      { wide: true, saveLabel: 'Conceder feito' }
    );
    $('#modal')
      .querySelectorAll('[data-achievement-icon]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            $('#modal [name=icon]').value = b.dataset.achievementIcon;
          })
      );
    return true;
  }
  if (action === 'achievement-open') {
    const entry = ctx.state.openGallery?.entries.find((e) => e.id === data.id);
    if (!entry) return true;
    modal(
      entry.name,
      `<div class="achievement-detail"><span class="achievement-medallion">${esc(entry.icon)}</span><p class="prose">${esc(entry.description)}</p><span class="eyebrow">${entry.source === 'narrator' ? 'FEITO CONCEDIDO PELO NARRADOR' : 'EVOLUÇÃO REGISTRADA'}</span><p>${date(entry.earned_at)}</p>${entry.character_name ? `<p>Conquistado na história de <strong>${esc(entry.character_name)}</strong>.</p>` : ''}<p class="hint">Guardado na galeria de ${esc(ctx.state.openGallery.display_name)}.</p>${ctx.admin() ? button('Remover esta marca', 'achievement-remove', '', 'text-button danger') : ''}</div>`,
      null
    );
    $('#modal [data-action=achievement-remove]')?.addEventListener('click', () =>
      modal(
        'Remover esta marca?',
        '<p>O feito sairá da galeria. Os níveis e o histórico dos personagens permanecem como estão.</p>',
        async () => {
          await api('/api/achievements/' + entry.id, {
            method: 'DELETE',
            data: { account_id: ctx.state.openGallery.account_id, confirmed: true }
          });
          await ctx.refresh();
        },
        { saveLabel: 'Remover da galeria' }
      )
    );
    return true;
  }
  return false;
}
