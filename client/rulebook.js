import { fold } from '../core/power-tests.js';
import { $, esc, icon, button, field, area, select, modal, toast, empty } from '../shared/ui.js';
import { labels } from '../shared/rules.js';
import { api } from './api.js';
import { clone, newId } from '../core/model.js';
import { ruleConfig } from './features.js';
import { showRuleContent } from './rule-content.js';
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
const paneLabels = {
  catalog: 'Catálogos do jogo',
  chapters: 'Capítulos e conteúdo livre',
  settings: 'Regras e criação de fichas'
};
export function rulebookPage(ctx) {
  const s = ctx.state,
    g = s.game,
    pane = s.rulePane || 'catalog',
    key = s.ruleCatalog || 'disciplines';
  let content = '';
  if (pane === 'catalog') content = ruleCatalog(ctx, key);
  else if (pane === 'chapters')
    content = `<div class="list-toolbar"><p class="muted">História do mundo, facções, regras da casa ou qualquer assunto da sua campanha.</p>${s.ruleEditing ? button(icon('plus') + ' Novo capítulo', 'rule-chapter-add', '', 'button primary') : ''}</div><div class="rulebook-chapters">${g.rulebook.map((section) => `<section class="panel rulebook-chapter"><header><div><span class="eyebrow">CAPÍTULO DA CAMPANHA</span><h2>${esc(section.title)}</h2><p>${esc(section.description || '')}</p></div>${s.ruleEditing ? button('Editar capítulo', 'rule-chapter-edit', `data-id="${section.id}"`, 'button ghost') + button('Remover', 'rule-chapter-delete', `data-id="${section.id}"`, 'text-button danger') : ''}</header><div class="rulebook-free-entries">${section.entries.map((e) => `<article><h3>${esc(e.title)}</h3><p class="prose">${esc(e.body)}</p>${s.ruleEditing ? `<footer>${button('Editar', 'rule-text-edit', `data-chapter="${section.id}" data-id="${e.id}"`, 'text-button')}${button('Remover', 'rule-text-delete', `data-chapter="${section.id}" data-id="${e.id}"`, 'text-button danger')}</footer>` : ''}</article>`).join('') || '<p class="muted">Este capítulo está pronto para receber seu primeiro texto.</p>'}</div>${s.ruleEditing ? button(icon('plus') + ' Acrescentar informação', 'rule-text-add', `data-chapter="${section.id}"`, 'button ghost') : ''}</section>`).join('') || empty('O livro também é seu.', 'Crie capítulos livres e acrescente tudo o que a campanha precisar.', s.ruleEditing ? button('Criar primeiro capítulo', 'rule-chapter-add', '', 'button primary') : '')}</div>`;
  else
    content = s.ruleEditing ? `${creationSettings(ctx)}${ruleConfig(ctx)}` : creationSummary(ctx);
  return `<div class="page-intro"><span class="eyebrow">O CONHECIMENTO DA CAMPANHA</span><h1>${s.ruleEditing ? 'Escreva as regras do seu universo.' : 'O livro da sua crônica.'}</h1><p>${s.ruleEditing ? 'Crie, edite e organize o conteúdo da campanha.' : 'Consulte poderes, antecedentes e características sem abrir a edição.'}</p></div><div class="rulebook-view-switch">${button('Consultar', 'rule-mode', `data-mode="read" aria-pressed="${!s.ruleEditing}"`, 'button ' + (!s.ruleEditing ? 'primary' : 'ghost'))}${button(icon('edit') + ' Gerenciar livro', 'rule-mode', `data-mode="edit" aria-pressed="${!!s.ruleEditing}"`, 'button ' + (s.ruleEditing ? 'primary' : 'ghost'))}</div><div class="rulebook-panes">${Object.entries(
    paneLabels
  )
    .map(([id, label]) =>
      button(
        label,
        'rule-pane',
        `data-pane="${id}" aria-pressed="${id === pane}"`,
        'button ' + (id === pane ? 'primary' : 'ghost')
      )
    )
    .join(
      ''
    )}</div>${content}<div class="rulebook-advanced panel"><div><h2>Ferramentas do game-data</h2><p>O livro inteiro continua em JSON, com importação e edição dos campos avançados.</p></div>${button(icon('download') + ' Exportar', 'export-game', '', 'button ghost')}${s.ruleEditing ? button('Importar game-data', 'import-game', '', 'button ghost') + button('Editar JSON completo', 'rule-game-json', '', 'button ghost') : ''}</div>`;
}
function creationSummary(ctx) {
  const c = ctx.state.game.character_creation,
    r = c.guided;
  return `<section class="panel"><span class="eyebrow">CRIAÇÃO DE PERSONAGENS · CONSULTA</span><h2>As regras para chegar à mesa.</h2><div class="creation-policy-summary"><p>Atributos começam em ${r.attribute_base}: distribua mais ${r.initial.atributes}, até ${r.initial_max.atributes}.</p><p>Habilidades compartilham ${r.initial.skills} pontos, até ${r.initial_max.skills}. Antecedentes: ${r.initial.precedents}. Disciplinas: ${r.initial.disciplines} entre os três dons do clã.</p><p>${r.bonus_points} pontos bônus. Custos por nível: atributo ${r.bonus_costs.atributes}, habilidade ${r.bonus_costs.skills}, disciplina ${r.bonus_costs.disciplines}, antecedente ${r.bonus_costs.precedents}. Limite final ${r.max_level}; até ${r.max_flaws} defeitos.</p><p>Geração: ${r.generation_base} menos os pontos no antecedente, até a ${r.generation_min}ª. Recursos define o capital inicial. Todas as propostas precisam da aprovação do narrador.</p></div><details><summary>Disciplinas dos clãs</summary><div class="creation-policy-summary">${r.clans.map((c) => `<p><strong>${esc(c.name)}</strong>: ${esc(c.disciplines.map((id) => ctx.state.game.disciplines.find((d) => d.id === id)?.name || 'Disciplina não cadastrada').join(', '))}</p>`).join('')}</div></details></section>`;
}
function creationSettings(ctx) {
  const c = ctx.state.game.character_creation,
    r = c.guided;
  return `<section class="panel creation-config"><span class="eyebrow">PORTA DE ENTRADA DA MESA</span><h2>Criação de personagens pelos jogadores</h2><p class="hint">Pontos iniciais e bônus são reservas separadas. Alterações não refazem fichas já aprovadas. As propostas sempre exigem aprovação.</p><form id="creation-config" class="form-grid"><label class="checkbox full"><input name="enabled" type="checkbox" ${c.enabled ? 'checked' : ''}> Permitir novas propostas</label><label class="checkbox full"><input name="guided" type="checkbox" ${r.enabled ? 'checked' : ''}> Usar criação guiada com conferência de pontos</label>${field('starting_xp', 'XP inicial após a criação', c.starting_xp, 'number', 'required min="0" max="1000000" step="1"')}${field('starting_money', 'Dinheiro extra além de Recursos', c.starting_money, 'number', 'required min="0" max="1000000000" step="0.01"')}${field('max_characters', 'Máximo de personagens e propostas por jogador', c.max_characters_per_player, 'number', 'required min="1" max="100" step="1"')}${field('bonus_points', 'Pontos bônus iniciais', r.bonus_points, 'number', 'required min="0" max="100" step="1"')}${field('max_flaws', 'Máximo de defeitos por ficha', r.max_flaws, 'number', 'required min="0" max="10" step="1"')}${Object.entries(
    r.initial
  )
    .map(([key, value]) =>
      field(
        'initial:' + key,
        'Pontos iniciais · ' + (labels[key] || key),
        value,
        'number',
        'required min="0" max="200" step="1"'
      )
    )
    .join('')}${Object.entries(r.initial_max)
    .map(([key, value]) =>
      field(
        'initial_max:' + key,
        'Limite inicial · ' + (labels[key] || key),
        value,
        'number',
        'required min="0" max="5" step="1"'
      )
    )
    .join('')}${Object.entries(r.bonus_costs)
    .map(([key, value]) =>
      field(
        'bonus_costs:' + key,
        'Custo por nível · ' + (labels[key] || key),
        value,
        'number',
        'required min="1" max="100" step="1"'
      )
    )
    .join(
      ''
    )}<details class="full"><summary>Limites para fichas sem assistente</summary><p class="hint">Aplicados às propostas antigas ou de transcrição manual. Campos vazios deixam a conferência ao narrador.</p><div class="form-grid">${Object.entries(
    c.budgets
  )
    .map(([key, value]) =>
      field(
        'budget:' + key,
        'Total · ' + labels[key],
        value ?? '',
        'number',
        'min="0" max="1000" step="1"'
      )
    )
    .join(
      ''
    )}</div></details><button type="submit" class="button primary full">${icon('save')} Salvar regras de criação</button></form></section>`;
}
async function saveGame(ctx, g) {
  await api('/api/game', { method: 'PUT', data: { ...g, _expected_revision: g._revision } });
  await ctx.refresh();
  toast('Livro da campanha atualizado.');
}
function powerRow(level = {}, index = 0) {
  return `<fieldset class="catalog-power-row" data-power-row><legend>Poder da disciplina</legend><div class="form-grid">${field('level:' + index, 'Nível', level.nivel || 1, 'number', 'required min="1" max="20" step="1"')}${field('power-name:' + index, 'Nome do poder', level.subname || '', 'text', 'maxlength="200" placeholder="Poder em desenvolvimento"')}${select(
    'rouse:' + index,
    'Teste de Despertar',
    [
      { value: 'yes', label: 'Necessário' },
      { value: 'no', label: 'Não necessário' },
      { value: 'unknown', label: 'Não informado' }
    ],
    level.mechanics?.rouse_check === true
      ? 'yes'
      : level.mechanics?.rouse_check === false
        ? 'no'
        : 'unknown'
  )}${field('test:' + index, 'Teste de habilidade', level.mechanics?.test || '', 'text', 'maxlength="300"')}${area('power-description:' + index, 'Descrição do poder', level.description || '', 'maxlength="30000"')}</div><button type="button" class="text-button danger" data-remove-power>Remover este poder</button></fieldset>`;
}
function catalogDialog(ctx, key, entry) {
  const g = clone(ctx.state.game),
    id = entry?.id ?? Math.max(-1, ...g[key].map((d) => d.id)) + 1;
  modal(
    entry ? 'Editar ' + entry.name : 'Novo conteúdo · ' + labels[key],
    `<div class="form-grid">${field('name', 'Nome', entry?.name || '', 'text', 'required maxlength="200"')}${key === 'rituals' ? field('nivel', 'Nível do ritual', entry?.nivel || 1, 'number', 'required min="1" max="20" step="1"') : ''}${key === 'caracteristics' ? field('type', 'Tipo', entry?.type || 'Qualidade', 'text', 'maxlength="100"') + field('value', 'Valor em pontos', entry?.value || 0, 'number', 'required min="-20" max="20" step="1"') : ''}${key === 'disciplines' ? field('short_description', 'Resumo da disciplina', entry?.short_description || '', 'text', 'maxlength="2000"') : ''}${area('description', 'Descrição', entry?.description || '', 'maxlength="30000"')}</div>${key === 'disciplines' ? `<div class="catalog-powers-editor"><h3>Poderes e níveis</h3><div id="catalog-power-rows">${(entry?.nivels || []).map(powerRow).join('')}</div><button type="button" class="button ghost" data-add-power>${icon('plus')} Adicionar poder</button></div>` : ''}`,
    async (form, element) => {
      const next = { ...entry, id, name: form.get('name'), description: form.get('description') };
      if (key === 'disciplines') {
        next.short_description = form.get('short_description');
        next.nivels = [...element.querySelectorAll('[data-power-row]')]
          .map((row) => {
            const inputs = row.querySelectorAll('[name]'),
              values = Object.fromEntries(
                [...inputs].map((el) => [el.name.split(':')[0], el.value])
              );
            return {
              ...entry?.nivels?.[Number(inputs[0].name.split(':')[1])],
              nivel: Number(values.level),
              subname: values['power-name'],
              description: values['power-description'],
              mechanics: {
                rouse_check: values.rouse === 'unknown' ? null : values.rouse === 'yes',
                test: values.test.trim() || null
              }
            };
          })
          .sort((a, b) => a.nivel - b.nivel);
      }
      if (key === 'rituals') next.nivel = Number(form.get('nivel'));
      if (key === 'caracteristics') {
        next.type = form.get('type');
        next.value = Number(form.get('value'));
        next.point_values = [Math.abs(next.value)];
      }
      const index = g[key].findIndex((e) => e.id === id);
      if (index < 0) g[key].push(next);
      else g[key][index] = next;
      await saveGame(ctx, g);
    },
    { wide: true, saveLabel: entry ? 'Salvar conteúdo' : 'Criar conteúdo' }
  );
  const rows = $('#catalog-power-rows');
  let nextIndex = entry?.nivels?.length || 0;
  if (rows) {
    $('#dialog-form').addEventListener('click', (event) => {
      if (event.target.closest('[data-add-power]'))
        rows.insertAdjacentHTML('beforeend', powerRow({}, nextIndex++));
      const remove = event.target.closest('[data-remove-power]');
      if (remove) remove.closest('[data-power-row]').remove();
    });
  }
}
export async function rulebookAction(action, data, ctx) {
  if (!action.startsWith('rule-')) return false;
  const s = ctx.state,
    key = data.key,
    g = clone(s.game),
    chapter = g.rulebook.find((c) => c.id === (data.chapter || data.id));
  if (action === 'rule-mode') {
    s.ruleEditing = data.mode === 'edit';
    ctx.draw();
    return true;
  }
  if (action === 'rule-view') {
    const entry = g[key]?.find((d) => d.id === Number(data.id));
    if (!entry) throw new Error('Conteúdo não encontrado.');
    showRuleContent(entry, key, s.game);
    return true;
  }
  if (action === 'rule-pane') {
    s.rulePane = data.pane;
    ctx.draw();
    return true;
  }
  if (action === 'rule-add' || action === 'rule-edit') {
    catalogDialog(
      ctx,
      key,
      g[key].find((d) => d.id === Number(data.id))
    );
    return true;
  }
  if (action === 'rule-json' || action === 'rule-game-json') {
    const entry = action === 'rule-json' ? g[key].find((d) => d.id === Number(data.id)) : g;
    modal(
      action === 'rule-json' ? 'Editar campos do conteúdo' : 'Editar game-data completo',
      `<p class="hint">Os dados serão validados antes de aplicar. Referências das fichas existentes devem continuar válidas.</p>${area('json', 'JSON', JSON.stringify(entry, null, 2), 'required spellcheck="false" class="json-editor"')}`,
      async (form) => {
        let next;
        try {
          next = JSON.parse(form.get('json'));
        } catch {
          throw new Error('O texto não contém JSON válido.');
        }
        if (action === 'rule-json') {
          if (next.id !== entry.id)
            throw new Error('O ID de um conteúdo existente deve ser preservado.');
          g[key][g[key].findIndex((d) => d.id === entry.id)] = next;
          await saveGame(ctx, g);
        } else await saveGame(ctx, { ...next, _revision: g._revision });
      },
      { wide: true, saveLabel: 'Validar e aplicar JSON' }
    );
    return true;
  }
  if (action === 'rule-delete') {
    const entry = g[key].find((d) => d.id === Number(data.id)),
      used = s.players.filter((p) => p[key].some((e) => e.id === entry.id)).length;
    modal(
      'Remover conteúdo do catálogo?',
      `<h3>${esc(entry.name)}</h3><p class="hint">Se o conteúdo estiver em fichas ou propostas, sua remoção também precisa ser autorizada.</p>${field('confirmation', 'Digite o nome do conteúdo', '', 'text', 'required maxlength="200"')}<label class="checkbox"><input type="checkbox" name="remove_references" ${used ? 'required' : ''}> Remover os vínculos deste conteúdo nas fichas e propostas</label>`,
      async (form) => {
        await api(`/api/rulebook/catalog/${key}/${entry.id}`, {
          method: 'DELETE',
          data: {
            revision: g._revision,
            confirmation: form.get('confirmation'),
            remove_references: form.has('remove_references')
          }
        });
        await ctx.refresh();
        toast('Conteúdo removido do livro.');
      },
      { saveLabel: 'Remover conteúdo' }
    );
    return true;
  }
  if (action === 'rule-chapter-add' || action === 'rule-chapter-edit') {
    modal(
      chapter ? 'Editar capítulo' : 'Novo capítulo da campanha',
      field(
        'title',
        'Título do capítulo',
        chapter?.title || '',
        'text',
        'required maxlength="200"'
      ) + area('description', 'Apresentação', chapter?.description || '', 'maxlength="5000"'),
      async (form) => {
        if (chapter) {
          chapter.title = form.get('title');
          chapter.description = form.get('description');
        } else
          g.rulebook.push({
            id: newId(),
            title: form.get('title'),
            description: form.get('description'),
            entries: []
          });
        await saveGame(ctx, g);
      }
    );
    return true;
  }
  if (action === 'rule-text-add' || action === 'rule-text-edit') {
    const entry = chapter.entries.find((e) => e.id === data.id);
    modal(
      entry ? 'Editar informação' : 'Nova informação · ' + chapter.title,
      field('title', 'Título', entry?.title || '', 'text', 'required maxlength="200"') +
        area('body', 'Conteúdo', entry?.body || '', 'required maxlength="50000"'),
      async (form) => {
        if (entry) {
          entry.title = form.get('title');
          entry.body = form.get('body');
        } else
          chapter.entries.push({ id: newId(), title: form.get('title'), body: form.get('body') });
        await saveGame(ctx, g);
      },
      { wide: true }
    );
    return true;
  }
  if (action === 'rule-chapter-delete' || action === 'rule-text-delete') {
    const entry =
      action === 'rule-text-delete' ? chapter.entries.find((e) => e.id === data.id) : chapter;
    modal(
      'Remover ' + esc(entry.title) + '?',
      '<p>Este conteúdo sairá do livro da campanha.</p>',
      async () => {
        if (action === 'rule-text-delete')
          chapter.entries = chapter.entries.filter((e) => e.id !== entry.id);
        else g.rulebook = g.rulebook.filter((c) => c.id !== chapter.id);
        await saveGame(ctx, g);
      },
      { saveLabel: 'Remover conteúdo' }
    );
    return true;
  }
  return true;
}
export function bindRulebook(ctx) {
  const catalog = $('[name="rule-catalog"]');
  if (catalog)
    catalog.onchange = () => {
      ctx.state.ruleCatalog = catalog.value;
      ctx.state.ruleQuery = '';
      ctx.draw();
    };
  const search = $('#rulebook-search');
  if (search)
    search.oninput = () => {
      ctx.state.ruleQuery = search.value;
      const markup = ruleCatalog(ctx, ctx.state.ruleCatalog || 'disciplines');
      const template = document.createElement('template');
      template.innerHTML = markup;
      $('.rulebook-catalog-grid').innerHTML =
        template.content.querySelector('.rulebook-catalog-grid').innerHTML;
    };
  const creation = $('#creation-config');
  if (creation)
    creation.onsubmit = (event) => {
      event.preventDefault();
      ctx.safe(async () => {
        const f = new FormData(creation),
          g = clone(ctx.state.game);
        g.character_creation.enabled = f.has('enabled');
        const guide = g.character_creation.guided;
        guide.enabled = f.has('guided');
        guide.bonus_points = Number(f.get('bonus_points'));
        guide.max_flaws = Number(f.get('max_flaws'));
        for (const group of ['initial', 'initial_max', 'bonus_costs'])
          for (const key of Object.keys(guide[group]))
            guide[group][key] = Number(f.get(group + ':' + key));
        g.character_creation.starting_xp = Number(f.get('starting_xp'));
        g.character_creation.starting_money = Number(f.get('starting_money'));
        g.character_creation.max_characters_per_player = Number(f.get('max_characters'));
        for (const key of Object.keys(g.character_creation.budgets))
          g.character_creation.budgets[key] =
            f.get('budget:' + key) === '' ? null : Number(f.get('budget:' + key));
        await saveGame(ctx, g);
      });
    };
}

function ruleCatalog(ctx, key) {
  const g = ctx.state.game,
    query = ctx.state.ruleQuery || '',
    entries = (query ? catalogs : [key])
      .flatMap((k) => g[k].map((d) => ({ ...d, key: k })))
      .filter(
        (d) =>
          !query ||
          fold(d.name + ' ' + d.description + ' ' + d.short_description).includes(fold(query))
      );
  return `<div class="rulebook-toolbar">${select(
    'rule-catalog',
    'Catálogo',
    catalogs.map((k) => ({ value: k, label: labels[k] })),
    key
  )}<label class="search-field">${icon('search')}<input type="search" id="rulebook-search" placeholder="Pesquisar em todos os catálogos" aria-label="Buscar conteúdo em todos os catálogos" value="${esc(query)}"></label>${ctx.state.ruleEditing ? button(icon('plus') + ' Novo conteúdo', 'rule-add', `data-key="${key}"`, 'button primary') : ''}</div>${query ? '<p class="hint">Resultados em todos os catálogos do livro.</p>' : ''}<div class="rulebook-catalog-grid">${entries.map((d) => `<article class="rulebook-entry"><div><span class="eyebrow">${labels[d.key]} ${d.nivel ? '· NÍVEL ' + d.nivel : ''}</span><h2>${esc(d.name)}</h2><p class="prose">${esc((d.description || d.short_description || 'Sem descrição.').slice(0, 500))}</p>${d.key === 'disciplines' ? `<span class="tag">${d.nivels.length} poderes cadastrados</span>` : ''}</div><footer>${button(icon('rules') + ' Visualizar', 'rule-view', `data-key="${d.key}" data-id="${d.id}"`, 'button primary')}${ctx.state.ruleEditing ? button(icon('edit') + ' Editar', 'rule-edit', `data-key="${d.key}" data-id="${d.id}"`, 'button ghost') + button('JSON', 'rule-json', `data-key="${d.key}" data-id="${d.id}"`, 'text-button') + button('Remover', 'rule-delete', `data-key="${d.key}" data-id="${d.id}"`, 'text-button danger') : ''}</footer></article>`).join('') || empty('Nada com esse nome.', 'Tente outra palavra ou acrescente conteúdo ao livro.')}</div>`;
}
