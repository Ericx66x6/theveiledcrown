import { powerPool } from './power-pool.js';
import { fold } from '../core/power-tests.js';
import { $, esc, icon, button, dots, empty, modal, field, area, toast } from '../shared/ui.js';
import { labels } from '../shared/rules.js';
import { api } from './api.js';
import { upgradeQuote, mechanics } from '../core/settings.js';
import { uiSound } from './media.js';
const categories = ['atributes', 'talents', 'expertises', 'knowledges', 'precedents'];
let timer;
const sounds = (ctx) => ctx.state.account.preferences?.audio_enabled !== false;
const currentLevel = (p, key, id) =>
  key === 'bloodpotency'
    ? p.bloodpotency
    : p[key]?.find((e) => e.id === id)?.[key === 'disciplines' ? 'nivel' : 'value'] || 0;
function definition(ctx, key, id) {
  return key === 'bloodpotency'
    ? { name: 'Potência do sangue', description: ctx.state.game.bloodpotency[0]?.description || '' }
    : ctx.state.game[key]?.find((d) => d.id === id);
}
function compute(ctx, u) {
  try {
    u.quote = upgradeQuote(ctx.player(), ctx.state.game, u.key, u.id, u.target);
    u.error = '';
  } catch (e) {
    u.quote = null;
    u.error = e.message;
  }
}
export function traitsPage(ctx) {
  const s = ctx.state,
    p = ctx.player(),
    categories = ['atributes', 'talents', 'expertises', 'knowledges', 'precedents'],
    key = s.traitCategory || 'atributes',
    max = s.game.maxvalue_generation[p.generation],
    query = s.traitQuery || '';
  const heading = ctx.admin()
    ? `<div><span class="eyebrow">AJUSTE DO NARRADOR</span><h1>Os traços desta história.</h1><p>Consulte as habilidades ou ajuste os níveis da ficha.</p></div>${button('Distribuir XP', 'distribute-xp', '', 'button primary')}`
    : `<div><span class="eyebrow">CONSTRUA A SUA LENDA</span><h1>O próximo nível tem a sua marca.</h1><p>Escolha um traço, planeje a evolução e confirme o investimento.</p></div><div class="xp-wallet">${icon('powers')}<strong>${p.xp}<small>XP DISPONÍVEIS</small></strong></div>`;
  return `<section class="advancement-header">${heading}</section><div class="advancement-tabs" role="tablist" aria-label="Categorias de traços">${categories.map((k) => `<button type="button" role="tab" aria-selected="${k === key}" class="${k === key ? 'active' : ''}" data-action="trait-category" data-key="${k}">${labels[k]}<span>${s.game[k].length}</span></button>`).join('')}</div><div class="advancement-toolbar"><label class="search-field">${icon('search')}<input type="search" id="trait-catalog-search" aria-label="Buscar traço em todas as categorias" placeholder="Pesquisar em todos os atributos e habilidades" value="${esc(query)}"></label><span data-trait-result-label>${query ? 'RESULTADOS DE TODAS AS CATEGORIAS' : 'Limite da geração ' + max}</span></div> <div class="advancement-grid" id="trait-results">${traitResults(ctx)}</div>`;
}

function traitResults(ctx) {
  const s = ctx.state,
    p = ctx.player(),
    key = s.traitCategory || 'atributes',
    max = s.game.maxvalue_generation[p.generation],
    query = s.traitQuery || '';
  const entries = (query ? categories : [key])
    .flatMap((k) => s.game[k].map((d) => ({ ...d, key: k })))
    .filter((d) => !query || fold(d.name + ' ' + d.description).includes(fold(query)));
  return (
    entries
      .map((d) => {
        const key = d.key,
          level = currentLevel(p, key, d.id);
        let q;
        try {
          q = upgradeQuote(p, s.game, key, d.id, level + 1);
        } catch {}
        return `<button type="button" class="advancement-card ${!q ? 'maxed' : ''}" data-action="trait" data-key="${key}" data-id="${d.id}"><div class="advancement-card-heading"><span>${esc(d.name)}</span><span class="trait-level-emblem">${level}</span></div>${query ? `<span class="eyebrow">${labels[key]}</span>` : ''}<div class="advancement-dots">${dots(level, max)}</div><p>${esc((d.description || 'O que você aprende muda o que é possível.').slice(0, 155))}</p><div class="advancement-card-bottom"><span>${ctx.admin() ? 'CONSULTAR E AJUSTAR' : q ? `PRÓXIMO NÍVEL <strong>${q.cost} XP</strong>` : level >= max ? 'DOMÍNIO ALCANÇADO' : 'CONCESSÃO DO NARRADOR'}</span><span class="advancement-arrow">${icon('arrow')}</span></div></button>`;
      })
      .join('') ||
    empty('Nenhum traço com esse nome.', 'Tente outra palavra ou parte da descrição.')
  );
}
export async function openEvolution(ctx, key, id, returnView = 'attributes') {
  const p = ctx.player();
  if (!p) return;
  const d = definition(ctx, key, id);
  if (!d) return;
  const from = currentLevel(p, key, id),
    generationMax =
      key === 'bloodpotency'
        ? ctx.state.game.bloodpotency_generation[p.generation].max
        : ctx.state.game.maxvalue_generation[p.generation],
    max = Math.min(
      generationMax,
      ctx.state.game.progression.categories[key]?.max_level ?? generationMax
    );
  if (ctx.admin()) {
    const min =
      key === 'bloodpotency' ? ctx.state.game.bloodpotency_generation[p.generation].min : 0;
    modal(
      `Consultar e ajustar · ${d.name}`,
      `<p>Ficha de <strong>${esc(p.char)}</strong>. Este ajuste administrativo não gasta XP.</p>${field('level', 'Nível da ficha', from, 'number', `required min="${min}" max="${max}" step="1"`)}<p class="prose">${esc(d.description || '')}</p>${lore(ctx, { key, id })}${area('log_message', 'Mensagem no histórico (opcional)', '', 'maxlength="2000"')}`,
      async (form) => {
        const level = Number(form.get('level'));
        const fieldName = key === 'disciplines' ? 'nivel' : 'value';
        const rows = key === 'bloodpotency' ? null : structuredClone(p[key]);
        if (rows) {
          const row = rows.find((entry) => entry.id === id);
          if (row) row[fieldName] = level;
          else rows.push({ id, [fieldName]: level });
        }
        await api(`/api/characters/${p.id}`, {
          method: 'PATCH',
          data: {
            revision: p._revision,
            patch: { [key]: rows || level },
            log_message: form.get('log_message') || ''
          }
        });
        await ctx.refresh();
        toast('Nível ajustado pelo narrador.');
      },
      { saveLabel: 'Salvar ajuste', wide: key === 'disciplines' }
    );
    return;
  }
  ctx.state.evolution = {
    characterId: p.id,
    key,
    id,
    name: d.name,
    from,
    max,
    target: Math.min(from + 1, max),
    stage: 'plan',
    returnView,
    busy: false
  };
  compute(ctx, ctx.state.evolution);
  uiSound('swoosh', sounds(ctx));
  await ctx.go('evolution');
}
function lore(ctx, u) {
  const d = definition(ctx, u.key, u.id);
  if (!d) return '';
  return `<section class="panel evolution-lore"><details open><summary>Conheça ${esc(d.name.toLowerCase())}</summary><p class="prose">${esc(d.description || d.short_description || '')}</p>${(
    d.nivels || []
  )
    .map((n) => {
      const m = mechanics(n.description, n.mechanics).mechanics;
      return `<article class="evolution-power"><span class="power-level-number">${n.nivel}</span><div><h3>${esc(n.subname)}</h3><div class="power-badges"><span class="power-badge ${m.rouse_check ? 'required' : 'quiet'}">${icon('blood')} ${m.rouse_check === null ? 'Despertar não informado' : m.rouse_check ? 'Teste de Despertar' : 'Sem despertar'}</span><span class="power-badge">${icon('test')} ${esc(m.test || 'Sem teste')}</span></div>${powerPool(ctx, d, n, d.nivels.indexOf(n))}<p class="prose">${esc(n.description)}</p></div></article>`;
    })
    .join('')}</details></section>`;
}
export function evolutionPage(ctx) {
  const u = ctx.state.evolution,
    p = ctx.player();
  if (!u || !p || u.characterId !== p.id)
    return empty(
      'Escolha um traço para evoluir.',
      'Seu próximo nível começa no catálogo.',
      button('Abrir atributos e habilidades', 'nav-attributes', '', 'button primary')
    );
  const q = u.quote,
    review = u.stage === 'review',
    success = u.stage === 'success',
    wait = review
      ? Math.max(
          0,
          Math.ceil(
            (u.reviewOpenedAt +
              ctx.state.game.progression.confirmation_seconds * 1000 -
              Date.now()) /
              1000
          )
        )
      : 0;
  return `<section class="evolution-screen ${u.stage} ${u.busy ? 'channeling' : ''}"><header class="evolution-top"><button type="button" class="button ghost" data-action="evolution-back">${icon('arrow')} ${success ? 'Voltar' : 'Cancelar e voltar'}</button><div class="evolution-steps" aria-label="Etapas da evolução">${[
    ['plan', 'Planejar'],
    ['review', 'Confirmar'],
    ['success', 'Evoluir']
  ]
    .map(
      ([stage, label], i) =>
        `<span class="${u.stage === stage ? 'current' : success || (review && i === 0) ? 'done' : ''}"><i>${i + 1}</i>${label}</span>`
    )
    .join(
      ''
    )}</div></header><div class="evolution-title"><span class="eyebrow">${success ? 'UMA NOVA MARCA NA SUA HISTÓRIA' : review ? 'CONFIRME O SEU INVESTIMENTO' : 'PLANEJE A SUA ASCENSÃO'}</span><h1>${esc(u.name)}</h1><p>${esc(p.char)} · ${esc(labels[u.key])}</p></div>${
    success
      ? `<div class="evolution-victory"><div class="victory-rays" aria-hidden="true"></div><div class="victory-rune">${icon('powers')}<span>+${u.target - u.from}</span></div><span class="eyebrow">EVOLUÇÃO CONCLUÍDA</span><h2>Nível ${u.target} conquistado.</h2><p>Você investiu ${q.cost} XP. Sua história acaba de ganhar poder.</p><div class="victory-wallet"><strong>${p.xp}</strong><span>XP AINDA DISPONÍVEIS</span></div><div class="evolution-victory-actions">${button('Continuar evoluindo ' + icon('arrow'), 'nav-' + u.returnView, '', 'button primary')}${button('Voltar à ficha', 'nav-overview', '', 'button ghost')}</div></div>`
      : `<div class="evolution-layout"><section class="panel evolution-workbench"><span class="eyebrow">${review ? 'O PODER QUE VOCÊ ESTÁ PRESTES A CONQUISTAR' : 'ESCOLHA ATÉ ONDE QUER CHEGAR'}</span><div class="evolution-level-journey"><div><span>AGORA</span><strong>${u.from}</strong></div><span class="evolution-stream" aria-hidden="true">${icon('arrow')}<i></i></span><div class="target-level"><span>${review ? 'DEPOIS' : 'NÍVEL DESEJADO'}</span><strong>${u.target}</strong></div></div>${
          !review
            ? `<div class="level-selector" role="group" aria-label="Escolher nível desejado">${Array.from(
                { length: u.max + 1 },
                (_, level) => level
              )
                .filter((level) => level >= u.from)
                .map(
                  (level) =>
                    `<button type="button" data-action="evolution-level" data-level="${level}" class="${level === u.target ? 'selected' : ''} ${level <= u.from ? 'acquired' : ''}" aria-pressed="${level === u.target}" ${level <= u.from ? 'disabled' : ''}><span>${level === u.from ? 'ATUAL' : 'NÍVEL'}</span><strong>${level}</strong>${level <= u.from ? icon('test') : '<i></i>'}</button>`
                )
                .join(
                  ''
                )}</div><p class="evolution-limit">Toque em um nível para planejar. Limite atual: ${u.max}.</p>`
            : `<div class="evolution-review-message">${icon('lock')} <p>O nível só muda após sua confirmação. Confira o custo e o saldo antes de continuar.</p></div>`
        }${q ? `<div class="evolution-investment"><span>Investimento total</span><strong>${q.cost}<small>XP</small></strong></div><ol class="evolution-cost-path">${q.steps.map((step) => `<li><span class="path-level">${step.from} ${icon('arrow')} ${step.to}</span><span>${step.cost} XP</span></li>`).join('')}</ol>` : ''}${u.error ? `<p class="form-error evolution-error">${esc(u.error)}</p>` : ''}${ctx.admin() ? button('Ajuste direto do narrador', 'edit-full', `data-id="${p.id}"`, 'text-button') : ''}</section><aside class="panel evolution-summary"><span class="eyebrow">SEU SANGUE, SUA EVOLUÇÃO</span><h2>${review ? 'Tudo pronto?' : 'Cada ponto conta.'}</h2><div class="evolution-wallet-lines"><div><span>XP disponível</span><strong>${q?.available ?? p.xp}</strong></div><div class="investment"><span>Investimento</span><strong>−${q?.cost ?? 0}</strong></div><div class="remaining"><span>Você fica com</span><strong>${q?.remaining ?? p.xp}<small>XP</small></strong></div></div>${q && !q.affordable ? '<p class="evolution-insufficient">Você precisa de mais ' + (q.cost - q.available) + ' XP para este nível.</p>' : ''}<div class="evolution-confirm-area">${review ? `<p data-evolution-countdown>${wait ? 'Confirmação liberada em ' + wait + 's' : 'Revise os valores e confirme quando estiver pronto.'}</p><button type="button" class="button primary evolution-primary" data-action="evolution-confirm" ${!q?.affordable || u.busy || wait ? 'disabled' : ''}>${u.busy ? '<span class="loader"></span> Evoluindo…' : icon('powers') + ' <span data-confirm-label>' + (wait ? 'Aguarde ' + wait + 's' : 'Confirmar por ' + q?.cost + ' XP') + '</span>'}</button>${button('Voltar ao planejamento', 'evolution-plan', u.busy ? 'disabled' : '', 'button ghost')}` : `${button('Revisar evolução ' + icon('arrow'), 'evolution-review', !q?.affordable || p.archived ? 'disabled' : '', 'button primary evolution-primary')}<p>Nada será gasto nesta etapa.</p>`}</div></aside></div>${lore(ctx, u)}`
  }</section>`;
}
export function bindEvolution(ctx) {
  clearInterval(timer);
  const search = $('#trait-catalog-search');
  if (search)
    search.oninput = () => {
      ctx.state.traitQuery = search.value;
      $('#trait-results').innerHTML = traitResults(ctx);
      $('[data-trait-result-label]').textContent = search.value
        ? 'RESULTADOS DE TODAS AS CATEGORIAS'
        : 'Limite da geração ' + ctx.state.game.maxvalue_generation[ctx.player().generation];
    };
  const u = ctx.state.evolution;
  if (ctx.state.view !== 'evolution' || u?.stage !== 'review' || u.busy) return;
  const update = () => {
    const remaining = Math.max(
        0,
        Math.ceil(
          (u.reviewOpenedAt + ctx.state.game.progression.confirmation_seconds * 1000 - Date.now()) /
            1000
        )
      ),
      control = $('[data-action="evolution-confirm"]');
    if (!control) return;
    control.disabled = !!remaining || !u.quote?.affordable;
    $('[data-confirm-label]').textContent = remaining
      ? 'Aguarde ' + remaining + 's'
      : 'Confirmar por ' + u.quote.cost + ' XP';
    $('[data-evolution-countdown]').textContent = remaining
      ? 'Confirmação liberada em ' + remaining + 's'
      : 'Revise os valores e confirme quando estiver pronto.';
    if (!remaining) clearInterval(timer);
  };
  update();
  timer = setInterval(update, 150);
}
export async function evolutionAction(action, data, ctx) {
  const u = ctx.state.evolution;
  if (action === 'trait-category') {
    ctx.state.traitCategory = data.key;
    ctx.state.traitQuery = '';
    uiSound('tick', sounds(ctx));
    ctx.draw();
    return true;
  }
  if (action === 'trait') {
    await openEvolution(
      ctx,
      data.key,
      data.key === 'bloodpotency' ? null : Number(data.id),
      data.key === 'disciplines' || data.key === 'bloodpotency' ? 'powers' : 'attributes'
    );
    return true;
  }
  if (!action.startsWith('evolution-')) return false;
  if (!u) return true;
  if (u.busy) return true;
  if (action === 'evolution-back') {
    clearInterval(timer);
    uiSound('swoosh', sounds(ctx));
    await (ctx.back ? ctx.back(u.returnView) : ctx.go(u.returnView));
    return true;
  }
  if (action === 'evolution-level') {
    u.target = Number(data.level);
    compute(ctx, u);
    uiSound('tick', sounds(ctx));
    ctx.draw();
    return true;
  }
  if (action === 'evolution-plan') {
    u.stage = 'plan';
    compute(ctx, u);
    uiSound('swoosh', sounds(ctx));
    ctx.draw();
    return true;
  }
  if (action === 'evolution-review') {
    u.quote = await api(`/api/characters/${u.characterId}/upgrade-preview`, {
      data: { key: u.key, id: u.id, target: u.target }
    });
    if (!u.quote.affordable) throw new Error('XP insuficiente para esta evolução.');
    u.stage = 'review';
    u.reviewOpenedAt = Date.now();
    uiSound('swoosh', sounds(ctx));
    ctx.draw();
    return true;
  }
  if (action === 'evolution-confirm') {
    if (Date.now() < u.reviewOpenedAt + ctx.state.game.progression.confirmation_seconds * 1000)
      return true;
    u.busy = true;
    uiSound('confirm', sounds(ctx));
    ctx.draw();
    try {
      const result = await api(`/api/characters/${u.characterId}/upgrade`, {
        method: 'POST',
        data: {
          key: u.key,
          id: u.id,
          target: u.target,
          revision: u.quote.revision,
          confirmed: true,
          quoted_cost: u.quote.cost
        }
      });
      ctx.state.player = result;
      await new Promise((resolve) =>
        setTimeout(resolve, ctx.state.account.preferences?.animations === false ? 0 : 650)
      );
      u.stage = 'success';
      u.busy = false;
      uiSound('success', sounds(ctx));
      await ctx.refresh();
    } catch (error) {
      u.stage = 'plan';
      u.busy = false;
      await ctx.refresh();
      compute(ctx, u);
      u.error = error.message;
      ctx.draw();
      throw error;
    }
    return true;
  }
  return true;
}

export function disposeEvolution() {
  clearInterval(timer);
}
