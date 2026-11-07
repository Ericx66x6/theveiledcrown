import { fold } from '../core/power-tests.js';
import { labels } from '../shared/rules.js';
import { $, esc, icon, button, modal, closeModal, empty } from '../shared/ui.js';
import { openEvolution } from './evolution.js';
import { openConsultation } from './consultation.js';
const catalogs = [
  'atributes',
  'talents',
  'expertises',
  'knowledges',
  'precedents',
  'disciplines',
  'rituals',
  'caracteristics'
];
export function searchEntries(state, query) {
  const q = fold(query);
  if (!q) return [];
  const rows = catalogs.flatMap((key) =>
    (state.game[key] || []).map((e) => ({
      id: e.id,
      key,
      kind: 'catalog',
      category: labels[key],
      title: e.name,
      body: e.description || e.short_description || '',
      search: (e.nivels || []).map((n) => n.subname + ' ' + n.description).join(' ')
    }))
  );
  for (const d of state.game.disciplines || [])
    for (const [index, n] of (d.nivels || []).entries())
      rows.push({
        id: d.id,
        key: 'disciplines',
        index,
        kind: 'power',
        category: d.name + ' · nível ' + n.nivel,
        title: n.subname,
        body: n.description
      });
  for (const c of state.game.rulebook || [])
    for (const e of c.entries)
      rows.push({
        id: e.id,
        key: c.id,
        kind: 'chapter',
        category: c.title,
        title: e.title,
        body: e.body
      });
  for (const n of state.notes || [])
    rows.push({
      id: n.id,
      kind: 'note',
      category: n.visibility === 'private' ? 'Anotação pessoal' : 'Anotação da mesa',
      title: n.title,
      body: n.content
    });
  for (const e of state.quests || [])
    rows.push({ id: e.id, kind: 'quest', category: 'Missão', title: e.title, body: e.description });
  for (const e of state.campaign?.intel || [])
    rows.push({
      id: e.id,
      kind: 'intel',
      category: 'Ecos do Véu',
      title: e.title,
      body: e.teaser + (e.revealed ? ' ' + e.secret : '')
    });
  for (const m of state.campaign?.maps || [])
    for (const p of m.pins)
      rows.push({
        id: p.id,
        key: m.id,
        kind: 'map',
        category: 'Local · ' + m.title,
        title: p.title,
        body: p.description
      });
  for (const p of state.players || [])
    rows.push({
      id: p.id,
      kind: 'character',
      category: 'Personagem',
      title: p.char,
      body: p.player + ' · ' + p.cla
    });
  return rows
    .map((row) => ({
      ...row,
      score:
        fold(row.title) === q
          ? 0
          : fold(row.title).startsWith(q)
            ? 1
            : fold(row.title).includes(q)
              ? 2
              : 3
    }))
    .filter((row) => fold(row.title + ' ' + row.body + ' ' + (row.search || '')).includes(q))
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, 'pt-BR'))
    .slice(0, 70);
}
function resultHTML(state, query) {
  const results = searchEntries(state, query);
  return (
    results
      .map((r) =>
        button(
          `<span>${icon(r.kind === 'catalog' ? 'rules' : r.kind === 'map' ? 'map' : r.kind === 'character' ? 'profile' : 'search')}</span><span><small>${esc(r.category)}</small><strong>${esc(r.title)}</strong><p>${esc((r.body || 'Consultar informações').slice(0, 160))}</p></span>${icon('arrow')}`,
          'search-open',
          `data-kind="${r.kind}" data-index="${r.index ?? ''}" data-id="${esc(r.id)}" data-key="${esc(r.key || '')}"`,
          'search-result'
        )
      )
      .join('') ||
    (query
      ? empty('Nada apareceu por aqui.', 'Tente outro nome, termo ou uma parte da descrição.')
      : '<div class="search-welcome"><span>⌕</span><h3>Um nome abre muitas portas.</h3><p>Pesquise atributos, habilidades, poderes, regras, notas, missões e locais. A busca atravessa as seções da campanha.</p></div>')
  );
}
export async function searchAction(action, data, ctx) {
  if (action === 'global-search') {
    modal(
      'Pesquisar na campanha',
      `<label class="search-field global-search-input">${icon('search')}<input id="global-query" type="search" aria-label="Pesquisar em todas as seções" placeholder="Força, Auspícios, uma pista…" autocomplete="off"></label><div class="global-search-results" data-search-results>${resultHTML(ctx.state, '')}</div>`,
      null,
      { wide: true }
    );
    const input = $('#global-query');
    input.oninput = () => {
      $('[data-search-results]').innerHTML = resultHTML(ctx.state, input.value);
    };
    input.focus();
    return true;
  }
  if (action !== 'search-open') return false;
  closeModal();
  const s = ctx.state;
  if (data.kind === 'power') {
    await openConsultation(ctx, 'disciplines', data.id, data.index);
    return true;
  }
  if (data.kind === 'catalog') {
    const e = s.game[data.key].find((e) => e.id === Number(data.id));
    if (['disciplines', 'rituals', 'caracteristics'].includes(data.key)) {
      await openConsultation(ctx, data.key, e.id);
      return true;
    }
    if (ctx.player() && !['rituals', 'caracteristics'].includes(data.key)) {
      await openEvolution(
        ctx,
        data.key,
        e.id,
        data.key === 'disciplines' ? 'powers' : 'attributes'
      );
      return true;
    }
    modal(
      e.name,
      `<span class="eyebrow">${esc(labels[data.key])}</span><p class="prose">${esc(e.description || e.short_description || '')}</p>${(e.nivels || []).map((n) => `<h3>${n.nivel} · ${esc(n.subname)}</h3><p class="prose">${esc(n.description)}</p>`).join('')}`,
      null,
      { wide: true }
    );
    return true;
  }
  if (data.kind === 'chapter') {
    const e = s.game.rulebook.find((c) => c.id === data.key).entries.find((e) => e.id === data.id);
    modal(e.title, `<p class="prose">${esc(e.body)}</p>`, null, { wide: true });
    return true;
  }
  if (data.kind === 'note') {
    const e = s.notes.find((e) => e.id === data.id);
    modal(e.title, `<p class="prose">${esc(e.content)}</p>`, null, { wide: true });
    return true;
  }
  if (data.kind === 'quest') {
    await ctx.go('quests');
    return true;
  }
  if (data.kind === 'intel') {
    await ctx.go('intel');
    return true;
  }
  if (data.kind === 'map') {
    s.mapId = data.key;
    await ctx.go('map');
    return true;
  }
  if (data.kind === 'character') {
    s.player = s.players.find((p) => p.id === Number(data.id));
    await ctx.go('overview');
    return true;
  }
  return true;
}
