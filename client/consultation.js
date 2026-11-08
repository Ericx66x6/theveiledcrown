import { $, esc, icon, button, empty } from '../shared/ui.js';
import { mechanics } from '../core/settings.js';
import { powerPool } from './power-pool.js';
import { openEvolution } from './evolution.js';
import { powerAccess } from '../core/power-access.js';
import { powerAccessLabel, powerAccessNotice } from './power-access.js';
export async function openConsultation(ctx, key, id, index = null) {
  await ctx.go('power-detail', {
    route: { powerDetail: { key, id: Number(id), index: index === null ? null : Number(index) } }
  });
}
export function consultationPage(ctx) {
  const detail = ctx.state.powerDetail;
  const d = detail && ctx.state.game[detail.key]?.find((d) => d.id === detail.id);
  if (!d)
    return empty(
      'Escolha um poder para consultar.',
      'Abra Sangue e poderes ou use a pesquisa.',
      button('Abrir poderes', 'nav-powers', '', 'button primary')
    );
  const p = ctx.player(),
    discipline = detail.key === 'disciplines',
    known = p?.[detail.key]?.find((e) => e.id === d.id),
    level = known?.nivel ?? 0;
  const levels = d.nivels || [];
  const index = Math.max(0, Math.min(detail.index ?? 0, Math.max(0, levels.length - 1))),
    n = levels[index];
  const availableCount = levels.filter((l) => powerAccess(p, detail.key, d, l).available).length;
  const access = powerAccess(p, detail.key, d, n || d);
  return `<section class="consultation-header"><div><span class="eyebrow">${discipline ? 'DISCIPLINA' : detail.key === 'rituals' ? 'RITUAL' : 'DOM DO PERSONAGEM'} ${p ? '· ' + esc(p.char) : ''}</span><h1>${esc(d.name)}</h1><p>${esc(d.short_description || '')}</p></div>${discipline && p ? `<span class="consultation-level">${level}<small>NÍVEL NA FICHA</small></span>` : ''}</section>${
    discipline
      ? `<details class="consultation-description"><summary>Sobre ${esc(d.name)}</summary><p class="prose">${esc(d.description || '')}</p></details>${p ? `<div class="power-access-summary"><strong>${availableCount} de ${levels.length} poderes liberados</strong><span>${icon('test')} Liberado para usar · ${icon('lock')} Bloqueado para uso</span></div>` : ''}<nav class="power-level-tabs" aria-label="Poderes de ${esc(d.name)}">${levels
          .map((l, i) => {
            const a = powerAccess(p, detail.key, d, l);
            return `<button type="button" data-action="consult-level" data-index="${i}" aria-pressed="${index === i}" aria-label="Nível ${l.nivel}: ${esc(l.subname)} — ${a.available ? 'Liberado para usar' : a.state === 'locked' ? 'Bloqueado para uso' : 'Consultar'}" class="is-${a.state} ${index === i ? 'active' : ''}"><span class="power-tab-level">NÍVEL ${l.nivel}</span>${powerAccessLabel(a)}<strong>${esc(l.subname)}</strong></button>`;
          })
          .join(
            ''
          )}</nav>${n ? `<article class="consultation-power is-${access.state}">${powerAccessNotice(access, d)}<header><span class="eyebrow">NÍVEL ${n.nivel}</span><h2>${esc(n.subname)}</h2></header>${badges(n)}${p ? powerPool(ctx, d, n, index) : ''}<p class="prose">${esc(n.description)}</p></article>` : empty('Sem poderes cadastrados.', 'O narrador pode completar esta disciplina no livro.')}`
      : `<article class="consultation-power is-${access.state}">${powerAccessNotice(access, d, detail.key)}${badges(d)}${p ? powerPool(ctx, d, d, 0, detail.key) : ''}<p class="prose">${esc(d.description || '')}</p></article>`
  }${discipline && p ? `<aside class="consultation-upgrade"><div><strong>${ctx.admin() ? 'Ajustar esta disciplina' : 'Quer ir além?'}</strong><p>${ctx.admin() ? 'O ajuste da ficha fica separado da consulta.' : known ? 'A evolução abre seu planejamento e pede confirmação antes de gastar XP.' : 'O narrador pode conceder este dom ou liberá-lo em Legados do Sangue.'}</p></div>${known || ctx.admin() ? button(icon('powers') + (ctx.admin() ? ' Ajustar nível' : ' Evoluir disciplina'), 'consult-evolve', `data-id="${d.id}"`, 'button primary') : button('Ver Legados do Sangue', 'nav-legacies', '', 'button ghost')}</aside>` : ''}`;
}
function badges(n) {
  const m = mechanics(n.description, n.mechanics).mechanics;
  return `<div class="power-badges"><span class="power-badge">${icon('blood')} ${m.rouse_check === null ? 'Despertar não informado' : m.rouse_check ? 'Teste de Despertar' : 'Sem despertar'}</span><span class="power-badge">${icon('test')} ${esc(m.test || 'Sem teste')}</span></div>`;
}
export function bindConsultation() {
  const tabs = $('.power-level-tabs'),
    active = tabs?.querySelector('[aria-pressed="true"]');
  if (!active) return;
  // Reveal the selected tab without scrolling the entire page away from the reader.
  const viewport = tabs.getBoundingClientRect(),
    selected = active.getBoundingClientRect();
  if (selected.left < viewport.left + 4) tabs.scrollLeft -= viewport.left + 4 - selected.left;
  else if (selected.right > viewport.right - 4)
    tabs.scrollLeft += selected.right - viewport.right + 4;
}
export async function consultationAction(action, data, ctx) {
  if (action === 'consult-level') {
    ctx.state.powerDetail.index = Number(data.index);
    ctx.draw();
    return true;
  }
  if (action === 'consult-evolve') {
    await openEvolution(ctx, 'disciplines', Number(data.id), 'power-detail');
    return true;
  }
  return false;
}
