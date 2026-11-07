import { legacyCost } from '../core/legacy-cost.js';
import { openConsultation } from './consultation.js';
import {
  $,
  esc,
  icon,
  button,
  field,
  area,
  select,
  modal,
  closeModal,
  toast,
  empty,
  date
} from '../shared/ui.js';
import { api } from './api.js';
import { currency, readImage } from './media.js';
import { clone, newId } from '../core/model.js';
import { intelCategories } from '../core/intel-state.js';
import { playSound } from './audio.js';
import { withLoading } from './loading.js';
import { openEvolution } from './evolution.js';
const activeCharacters = (ctx) => ctx.state.players.filter((p) => !p.archived);
function balance(p) {
  return `<strong>${p.xp} XP</strong><span>${currency(p.money)}</span>`;
}
function payerFields(ctx) {
  const players = activeCharacters(ctx),
    selected = ctx.player()?.id || players[0]?.id;
  return `${select(
    'character_id',
    'Personagem que vai pagar',
    players.map((p) => ({ value: p.id, label: p.char })),
    selected
  )}<div class="purchase-budget full" data-purchase-budget>${players.find((p) => p.id === selected) ? balance(players.find((p) => p.id === selected)) : ''}</div>`;
}
function bindPayer(ctx) {
  const input = $('#dialog-form [name=character_id]');
  if (input)
    input.onchange = () => {
      const p = activeCharacters(ctx).find((p) => p.id === Number(input.value));
      $('[data-purchase-budget]').innerHTML = balance(p);
    };
}
export function intelPage(ctx) {
  const s = ctx.state,
    entries = s.campaign.intel || [],
    filter = s.intelFilter || 'all',
    query = (s.intelQuery || '').toLocaleLowerCase('pt-BR');
  const shown = entries.filter(
    (e) =>
      (filter === 'all' ||
        (filter === 'revealed' && e.revealed) ||
        (filter === 'locked' && !e.revealed)) &&
      (!query ||
        (e.title + ' ' + e.teaser + ' ' + e.category).toLocaleLowerCase('pt-BR').includes(query))
  );
  return `<section class="chapter-hero intel-hero"><div><span class="eyebrow">INVESTIGAR É ESCOLHER ONDE GASTAR A ETERNIDADE</span><h1>Ecos do Véu</h1><p>Enquanto a cidade dorme, alguém escuta. Invista o tempo e os recursos de um personagem para revelar uma descoberta a toda a mesa.</p><div class="chapter-metrics"><span><strong>${entries.filter((e) => e.revealed).length}</strong> ecos revelados</span><span><strong>${entries.filter((e) => !e.revealed).length}</strong> por investigar</span></div></div><div class="chapter-sigil" aria-hidden="true">${icon('search')}<i></i><i></i></div></section><div class="list-toolbar"><label class="search-field">${icon('search')}<input type="search" data-intel-search aria-label="Pesquisar informações" placeholder="Pistas, pessoas, lugares…" value="${esc(s.intelQuery || '')}"></label>${ctx.admin() ? button(icon('plus') + ' Cadastrar informação', 'intel-create', '', 'button primary') : ''}</div><div class="market-tabs">${[
    ['all', 'Todos os ecos'],
    ['locked', 'Sob o véu'],
    ['revealed', 'Revelados para a mesa']
  ]
    .map(([id, label]) =>
      button(
        label,
        'intel-filter',
        `data-id="${id}" aria-pressed="${filter === id}"`,
        'button ' + (filter === id ? 'primary' : 'ghost')
      )
    )
    .join(
      ''
    )}</div><div class="intel-grid">${shown.map((e) => `<article class="intel-card ${e.revealed ? 'revealed' : 'sealed'}"><div class="intel-art">${e.cover ? `<img src="${esc(e.cover)}" alt="" loading="lazy">` : `<span class="intel-symbol">${icon(e.revealed ? 'test' : 'lock')}</span>`}<span class="tag">${esc(e.category)}</span><span class="intel-state">${e.revealed ? 'REVELADO' : 'SOB O VÉU'}</span></div><div class="intel-card-body"><h2>${esc(e.title)}</h2><p>${esc(e.teaser || 'Uma descoberta aguarda por quem decidir investigar.')}</p>${e.revealed ? `<div class="intel-patron">${icon('profile')}<span>Revelado por <strong>${esc(e.purchase.character_name)}</strong><small>${esc(e.purchase.account_name)} · ${date(e.purchase.at)}</small></span></div>` : `<div class="price-row"><span><strong>${e.xp_cost}</strong> XP</span>${e.money_cost ? `<span>${currency(e.money_cost)}</span>` : ''}</div>`}<div class="market-card-actions">${button(e.revealed ? 'Abrir descoberta' : ctx.admin() ? 'Ver conteúdo reservado' : 'Investigar e revelar', e.revealed || ctx.admin() ? 'intel-open' : 'intel-purchase', `data-id="${e.id}"`, 'button ' + (e.revealed ? 'ghost' : 'primary'))}${ctx.admin() ? button('Editar', 'intel-edit', `data-id="${e.id}"`, 'text-button') + button('Apagar', 'intel-delete', `data-id="${e.id}"`, 'text-button danger') : ''}</div></div></article>`).join('') || empty('O silêncio ainda guarda seus segredos.', ctx.admin() ? 'Cadastre a primeira informação para os jogadores investigarem.' : 'O narrador pode preparar descobertas para a campanha.')}</div>`;
}
function intelDialog(ctx, item) {
  const photos = [...(item?.images || [])];
  modal(
    item ? 'Editar um eco' : 'Cadastre um novo eco',
    `<p class="hint">Título, apresentação e capa são públicos. O conteúdo e as imagens reservadas só aparecem após a compra.</p><div class="form-grid">${field('title', 'Título', item?.title || '', 'text', 'required maxlength="200"')}${select('category', 'Categoria', intelCategories, item?.category || 'Pista')}${area('teaser', 'Apresentação pública', item?.teaser || '', 'maxlength="3000"')}${field('xp_cost', 'Custo em XP', item?.xp_cost || 0, 'number', 'required min="0" max="1000000" step="1"')}${field('money_cost', 'Custo em dinheiro', item?.money_cost || 0, 'number', 'required min="0" max="1000000000" step="0.01"')}<label class="field full"><span>Capa pública (opcional)</span><input type="file" name="cover_file" accept="image/png,image/jpeg,image/webp"></label>${item?.cover ? '<label class="checkbox full"><input type="checkbox" name="remove_cover"> Remover capa atual</label>' : ''}${area('secret', 'Conteúdo reservado · revelado para toda a mesa após a compra', item?.secret || '', 'required maxlength="30000"')}<div class="field full"><span>Imagens reservadas atuais</span><div class="intel-photo-edit">${photos.map((src, i) => `<label><img src="${esc(src)}" alt="Imagem reservada ${i + 1}"><span><input type="checkbox" name="remove_image" value="${i}"> Remover</span></label>`).join('') || '<p class="hint">Nenhuma imagem reservada.</p>'}</div></div><label class="field full"><span>Acrescentar imagens reservadas · até 6 no total</span><input type="file" name="secret_files" accept="image/png,image/jpeg,image/webp" multiple></label>${item?.purchase ? '<p class="hint full">Esta descoberta já foi paga. Editar não gera outra cobrança nem altera o recibo original.</p>' : ''}</div>`,
    async (form) => {
      const removed = new Set(form.getAll('remove_image').map(Number)),
        images = photos.filter((_, i) => !removed.has(i));
      const files = form.getAll('secret_files').filter((f) => f?.size);
      if (images.length + files.length > 6) throw new Error('Use até seis imagens reservadas.');
      let cover = form.has('remove_cover') ? '' : item?.cover || '';
      await withLoading(async () => {
        const file = form.get('cover_file');
        if (file?.size) cover = (await readImage(file)).image;
        for (const f of files) images.push((await readImage(f)).image);
      });
      await api('/api/intel' + (item ? '/' + item.id : ''), {
        method: item ? 'PATCH' : 'POST',
        data: {
          title: form.get('title'),
          category: form.get('category'),
          teaser: form.get('teaser'),
          xp_cost: Number(form.get('xp_cost')),
          money_cost: Number(form.get('money_cost')),
          secret: form.get('secret'),
          cover,
          images,
          revision: item?._revision
        }
      });
      await ctx.refresh();
      toast('O eco foi guardado no arquivo da campanha.');
    },
    { wide: true, saveLabel: item ? 'Salvar informação' : 'Cadastrar informação' }
  );
}
function openIntel(ctx, item) {
  modal(
    item.title,
    `<div class="intel-reveal ${item.revealed ? 'is-revealed' : ''}"><span class="eyebrow">${item.revealed ? 'UMA DESCOBERTA DA MESA' : 'PRÉVIA RESERVADA AO NARRADOR'}</span>${item.cover ? `<img class="intel-detail-cover" src="${esc(item.cover)}" alt="">` : ''}<p class="prose intel-secret">${esc(item.secret || 'O conteúdo está sob o véu.')}</p><div class="location-gallery">${(item.images || []).map((src) => `<img src="${esc(src)}" alt="Imagem da descoberta" loading="lazy">`).join('')}</div>${item.purchase ? `<footer class="intel-receipt"><strong>${esc(item.purchase.character_name)} revelou este eco.</strong><span>${esc(item.purchase.account_name)} · ${date(item.purchase.at)}</span><small>Investimento: ${item.purchase.xp_paid} XP · ${currency(item.purchase.money_paid)}. Disponível para toda a campanha.</small></footer>` : ''}</div>`,
    null,
    { wide: true }
  );
}
export function legaciesPage(ctx) {
  const s = ctx.state,
    allowed = s.game.discipline_market.allowed_ids,
    p = ctx.player(),
    defs = s.game.disciplines.filter((d) => ctx.admin() || allowed.includes(d.id));
  return `<section class="chapter-hero legacy-hero"><div><span class="eyebrow">UM DOM NÃO PRECISA SER UM DESTINO</span><h1>Legados do Sangue</h1><p>Há ecos de outras linhagens esperando para despertar. ${ctx.admin() ? 'Escolha quais disciplinas podem ser adquiridas pelos jogadores.' : 'Desperte um legado autorizado pelo narrador e faça dele parte da sua história.'}</p><div class="legacy-price"><strong>${s.game.discipline_market.default_cost}</strong><span>XP · CUSTO GERAL<small>Nível inicial 0 · evolução pelas regras da campanha</small></span></div></div><div class="chapter-sigil" aria-hidden="true">${icon('blood')}<i></i><i></i></div></section>${ctx.admin() ? `<p class="hint">Defina o custo geral e deixe o preço de uma disciplina vazio para herdar esse valor. Zero permite aquisição gratuita. A evolução dos níveis continua separada.</p><form id="legacy-catalog-form"><div class="legacy-default-cost">${field('default_cost', 'Custo geral em XP', s.game.discipline_market.default_cost, 'number', 'required min="0" max="1000000" step="1"')}<p>O preço individual tem prioridade sobre o custo geral.</p></div>` : ''}<div class="legacy-grid">${
    defs
      .map((d) => {
        const known = p?.disciplines.find((e) => e.id === d.id);
        return `<article class="legacy-card ${known ? 'known' : ''}"><div class="legacy-mark">${icon('powers')}</div><div><span class="eyebrow">${known ? 'LEGADO DESPERTO · NÍVEL ' + known.nivel : 'UMA NOVA HERANÇA'}</span><h2>${esc(d.name)}</h2><p>${esc(d.short_description || d.description?.slice(0, 220) || 'Um dom que pode abrir novos caminhos para o personagem.')}</p></div>${ctx.admin() ? `<label class="legacy-allow"><input type="checkbox" name="allowed" value="${d.id}" ${allowed.includes(d.id) ? 'checked' : ''}><span>Liberar aquisição</span></label>${field('cost:' + d.id, 'Preço individual em XP', s.game.discipline_market.costs[d.id] ?? '', 'number', `min="0" max="1000000" step="1" placeholder="Herdar custo geral"`)}` : known ? button('Consultar poderes', 'legacy-consult', `data-id="${d.id}"`, 'button ghost') : button('Despertar · ' + legacyCost(s.game, d.id) + ' XP', 'legacy-acquire', `data-id="${d.id}"`, 'button primary')}</article>`;
      })
      .join('') ||
    empty(
      'O sangue ainda guarda seus legados.',
      'O narrador escolhe quais disciplinas ficam disponíveis para aquisição.'
    )
  }</div>${ctx.admin() ? '<div class="catalog-save-bar"><button type="submit" class="button primary">' + icon('save') + ' Salvar legados permitidos</button></div></form>' : ''}`;
}
export async function commerceAction(action, data, ctx) {
  if (action === 'intel-filter') {
    ctx.state.intelFilter = data.id;
    ctx.draw();
    return true;
  }
  if (action === 'intel-create' || action === 'intel-edit') {
    intelDialog(
      ctx,
      ctx.state.campaign.intel.find((e) => e.id === data.id)
    );
    return true;
  }
  if (action === 'intel-open') {
    const e = ctx.state.campaign.intel.find((e) => e.id === data.id);
    if (e) openIntel(ctx, e);
    return true;
  }
  if (action === 'intel-delete') {
    const e = ctx.state.campaign.intel.find((e) => e.id === data.id);
    modal(
      'Apagar esta informação?',
      `<p>${esc(e.title)}</p><p class="hint">Pagamentos já registrados no histórico não são devolvidos.</p>`,
      async () => {
        await api('/api/intel/' + e.id, { method: 'DELETE', data: { revision: e._revision } });
        await ctx.refresh();
      },
      { saveLabel: 'Apagar informação' }
    );
    return true;
  }
  if (action === 'intel-purchase' || action === 'legacy-acquire') {
    if (ctx.admin()) throw new Error('A compra é feita pela conta do jogador.');
    if (!activeCharacters(ctx).length)
      throw new Error('Você precisa de um personagem aprovado para comprar.');
    const intel = action === 'intel-purchase',
      entry = intel
        ? ctx.state.campaign.intel.find((e) => e.id === data.id)
        : ctx.state.game.disciplines.find((d) => d.id === Number(data.id));
    if (intel && entry.revealed) {
      openIntel(ctx, entry);
      return true;
    }
    const requestId = newId();
    modal(
      intel ? 'Investigar este eco?' : 'Despertar este legado?',
      `<div class="purchase-heading">${icon(intel ? 'search' : 'blood')}<h3>${esc(intel ? entry.title : entry.name)}</h3><p>${intel ? 'Um único personagem paga o custo completo. A descoberta será revelada para toda a mesa.' : 'A disciplina entra na ficha com nível 0. Depois, você evolui normalmente com XP.'}</p><div class="price-row"><span><strong>${intel ? entry.xp_cost : legacyCost(ctx.state.game, entry.id)}</strong> XP</span>${intel && entry.money_cost ? `<span>${currency(entry.money_cost)}</span>` : ''}</div></div><div class="form-grid">${payerFields(ctx)}<label class="checkbox full"><input type="checkbox" required> Conferi o personagem e confirmo o gasto.</label></div>`,
      async (form) => {
        const p = activeCharacters(ctx).find((p) => p.id === Number(form.get('character_id')));
        const result = await api(
          intel ? `/api/intel/${entry.id}/purchase` : `/api/discipline-market/${entry.id}/acquire`,
          {
            method: 'POST',
            data: {
              character_id: p.id,
              character_revision: p._revision,
              revision: entry._revision,
              quoted_xp: entry.xp_cost,
              quoted_cost: intel ? undefined : legacyCost(ctx.state.game, entry.id),
              quoted_money: entry.money_cost,
              confirmed: true,
              request_id: requestId
            }
          }
        );
        await ctx.refresh();
        playSound('purchase');
        if (intel) setTimeout(() => openIntel(ctx, result.information), 0);
        else toast(entry.name + ' despertou no nível 0.');
      },
      {
        wide: true,
        saveLabel: intel
          ? 'Pagar e revelar para a mesa'
          : 'Despertar por ' + legacyCost(ctx.state.game, entry.id) + ' XP'
      }
    );
    bindPayer(ctx);
    return true;
  }
  if (action === 'legacy-consult') {
    await openConsultation(ctx, 'disciplines', data.id);
    return true;
  }
  if (action === 'legacy-evolve') {
    await openEvolution(ctx, 'disciplines', Number(data.id), 'legacies');
    return true;
  }
  return false;
}
export function bindCommerce(ctx) {
  const search = $('[data-intel-search]');
  if (search)
    search.oninput = () => {
      ctx.state.intelQuery = search.value;
      const cursor = search.selectionStart;
      ctx.draw();
      const fresh = $('[data-intel-search]');
      fresh.focus();
      try {
        fresh.setSelectionRange(cursor, cursor);
      } catch {}
    };
  const form = $('#legacy-catalog-form');
  if (form)
    form.onsubmit = (event) => {
      event.preventDefault();
      ctx.safe(async () => {
        const g = clone(ctx.state.game);
        const f = new FormData(form);
        g.discipline_market.allowed_ids = f.getAll('allowed').map(Number);
        g.discipline_market.default_cost = Number(f.get('default_cost'));
        g.discipline_market.costs = Object.fromEntries(
          g.disciplines
            .filter((d) => f.get('cost:' + d.id) !== '')
            .map((d) => [d.id, Number(f.get('cost:' + d.id))])
        );
        g._expected_revision = g._revision;
        await api('/api/game', { method: 'PUT', data: g });
        form.dataset.dirty = 'false';
        await ctx.refresh();
        toast('Os legados disponíveis foram atualizados.');
      });
    };
}
