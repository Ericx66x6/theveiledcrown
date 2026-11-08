import { blank, clone, validatePlayer } from '../core/model.js';
import { creationKeys, skillKeys, normalizedName } from '../core/creation-config.js';
import {
  emptyCreation,
  chooseClan,
  evaluateCreation,
  creationConstraints,
  reconcileCreation,
  selectedTraits,
  traitKind,
  traitPrice
} from '../core/character-creation.js';
import { $, esc, field, area, select, icon, button, modal } from '../shared/ui.js';
import { labels } from '../shared/rules.js';
import { store } from './api.js';
import { realMoney, showRuleContent, effectDescriptions } from './rule-content.js';
import {
  creationStages,
  creationStepProblems,
  nextCreationStep,
  canReturnToCreationStep
} from './creation-flow.js';
const categories = {
  atributes: 'Atributos',
  skills: 'Habilidades',
  precedents: 'Antecedentes',
  disciplines: 'Disciplinas'
};
const names = { ...labels, skills: 'Habilidades', bonus: 'Pontos bônus' };
const family = (k) => (skillKeys.includes(k) ? 'skills' : k);
const amount = (p, key, id) =>
  p[key].find((r) => r.id === id)?.[key === 'disciplines' ? 'nivel' : 'value'] || 0;
export class CreationWizard {
  constructor({
    game,
    character,
    id,
    accountId,
    accountName,
    draftKey = 'new',
    onSaved,
    onSubmit,
    onCancel
  }) {
    Object.assign(this, { game, onSaved, onSubmit, onCancel });
    this.key = `${store.current().id}.${accountId}.guided.${draftKey}`;
    const draft = !character && store.drafts[this.key];
    this.source = clone(character || draft?.source || blank(game, id));
    this.source.player = accountName;
    this.plan = clone(character?.creation || draft?.plan || emptyCreation(game));
    this.step = 0;
    this.notice =
      character && !character.creation
        ? 'Esta proposta é anterior ao assistente. Confira o clã e distribua os pontos no passo a passo. O nome e os textos foram preservados.'
        : '';
    this.skillCategory = 'talents';
    this.query = '';
    this.kind = 'all';
    this.error = '';
    this.busy = false;
    this.update();
  }
  update() {
    const result = evaluateCreation({ ...this.source, creation: this.plan }, this.game);
    this.p = result.character;
    this.report = result.report;
  }
  saveDraft() {
    document.body.dataset.pendingEditor = 'true';
    store.drafts[this.key] = clone({ source: this.source, plan: this.plan });
  }
  async clearDraft() {
    delete store.drafts[this.key];
    delete document.body.dataset.pendingEditor;
  }
  currentSource() {
    return { ...this.source, creation: this.plan };
  }
  render() {
    this.update();
    const stage = creationStages[this.step],
      progress = Math.round((this.step / (creationStages.length - 1)) * 100),
      phases = [
        { start: 0, end: 0, label: 'Identidade' },
        { start: 1, end: 4, label: 'Pontos iniciais' },
        { start: 5, end: 9, label: 'Pontos bônus' },
        { start: 10, end: 10, label: 'Revisão' }
      ];
    return `${this.step === 0 ? '<section class="page-intro creation-intro"><span class="eyebrow">CRIE SUA NÃO-VIDA</span><h1>Uma escolha de cada vez.</h1><p>Siga a ordem e use todos os pontos. Sua ficha passa pela aprovação do narrador.</p></section>' : '<h1 class="creation-compact-title">Criação de personagem</h1>'}<nav class="creation-steps" aria-label="Fases da criação">${phases.map((phase, index) => `<button type="button" data-create-step="${phase.start}" ${phase.start >= this.step ? 'disabled' : ''} aria-current="${this.step >= phase.start && this.step <= phase.end ? 'step' : 'false'}"><span>${this.step > phase.end ? icon('test') : index + 1}</span><strong>${phase.label}</strong></button>`).join('')}</nav><div class="creation-progress"><span>PASSO ${this.step + 1} DE ${creationStages.length}<strong>${stage.label}</strong></span><div role="progressbar" aria-label="Progresso da criação" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div></div><form id="creation-wizard" novalidate><div class="creation-context"><span>${esc(this.p.char || 'Seu personagem')}<small>${esc(this.p.cla || 'Escolha o clã')}</small></span><span>${this.p.generation}ª geração<small>${realMoney(this.p.money)} iniciais</small></span></div>${this.notice ? `<p class="creation-effect-note" role="status">${esc(this.notice)}</p>` : ''}<section class="creation-screen">${stage.phase === 'identity' ? this.identity() : stage.phase === 'review' ? this.review() : this.allocation(stage.phase === 'bonus' || stage.phase === 'traits')}</section><p class="form-error" id="creation-error" role="alert">${esc(this.error)}</p><div id="creation-navigation">${this.navigation()}</div></form>`;
  }
  navigation() {
    const stage = creationStages[this.step],
      next = nextCreationStep(this.step, this.currentSource(), this.report),
      problems = creationStepProblems(this.step, this.currentSource(), this.report),
      corrections = [...new Set(problems.filter((p) => p.step < this.step).map((p) => p.step))],
      remaining = this.report.totals.bonus.remaining,
      nextStage = creationStages[next.allowed ? next.target : Math.min(10, this.step + 1)];
    let label =
      'Continuar: ' + (nextStage.phase === 'bonus' ? categories[nextStage.key] : nextStage.label);
    if (next.loop) label = `Distribuir bônus restantes (${remaining})`;
    if (stage.phase === 'traits') label = 'Escolhas feitas · distribuir bônus';
    if (this.step === 9 && !next.loop)
      label = remaining === 0 ? 'Tudo gasto · conferir ficha' : 'Conferir ficha';
    const help =
      stage.phase === 'initial'
        ? `Use os ${this.report.totals[stage.key].budget} pontos desta etapa para continuar.`
        : stage.phase === 'traits'
          ? 'Qualidades e defeitos são opcionais. A reserva final de bônus precisa ser toda utilizada.'
          : stage.phase === 'bonus'
            ? next.loop
              ? 'Ainda há bônus na reserva. Faça outra volta para distribuí-los; o envio só libera com zero restante.'
              : 'A reserva de bônus é compartilhada. Você pode guardar pontos para a próxima categoria.'
            : '';
    return `<footer class="creation-footer"><div class="creation-step-feedback" aria-live="polite">${problems.length ? `<p>${esc(problems[0].message)}</p>${corrections.map((index) => button('Reajustar: ' + creationStages[index].label, 'creation-fix', `data-step="${index}"`, 'text-button')).join('')}` : stage.phase === 'initial' ? `<p class="creation-ready">${icon('test')} Todos os pontos desta etapa foram usados.</p>` : stage.phase === 'bonus' ? `<p>${remaining === 0 ? 'Reserva totalmente distribuída.' : remaining + ' PB para distribuir no ciclo.'}</p>` : ''}<small>${help}</small></div><div class="creation-footer-actions">${this.step ? button('Voltar', 'creation-prev', '', 'button ghost') : ''}${this.step === 10 ? `<button type="submit" class="button primary" ${problems.length ? 'disabled' : ''}>${icon('save')} Enviar ao narrador</button>` : button(label + icon('arrow'), 'creation-next', next.allowed ? '' : 'disabled', 'button primary')}</div><div class="creation-draft">${button('Sair da criação', 'creation-cancel', '', 'text-button')}<span>Rascunho nesta aba · #${this.p.id}</span></div></footer>`;
  }
  refreshNavigation() {
    this.update();
    $('#creation-navigation').innerHTML = this.navigation();
  }
  identity() {
    const c = this.game.character_creation.guided,
      custom = this.plan.clan === 'custom';
    return `<header class="creation-section-heading"><span class="eyebrow">01 · QUEM ATRAVESSA O VÉU?</span><h2 tabindex="-1">Um nome e uma linhagem.</h2><p>Os clãs usam as combinações definidas pela sua mesa. Um clã personalizado sempre passa pela sua avaliação com o narrador.</p></header><div class="form-grid">${field('char', 'Nome do personagem', this.source.char, 'text', 'required maxlength="150" autocomplete="off"')}${select('clan', 'Clã', [{ value: '', label: 'Escolha seu clã' }, ...c.clans.map((row) => ({ value: row.id, label: row.name })), { value: 'custom', label: 'Clã personalizado' }], this.plan.clan)}${custom ? field('cla', 'Nome do clã personalizado', this.source.cla || '', 'text', 'required maxlength="80"') : ''}</div>${custom ? `<section class="creation-custom-clan"><h3>Escolha três disciplinas <small>${this.plan.disciplines.length}/3</small></h3><p class="hint">Selecione entre as disciplinas cadastradas. As linhas iniciais são escolhidas abaixo quando necessário.</p><label class="search-field">${icon('search')}<input type="search" data-creation-search="custom" aria-label="Buscar disciplinas para o clã" placeholder="Buscar disciplina" value="${esc(this.query)}"></label><div id="creation-custom-list">${this.customDisciplineList()}</div></section>` : ''}${
      this.plan.disciplines.length
        ? `<section class="creation-clan-powers"><h3>Os três dons do seu sangue</h3>${this.plan.disciplines
            .map((id) => {
              const d = this.game.disciplines.find((d) => d.id === id),
                paths = this.game.disciplines.filter((row) =>
                  row.parent_discipline_ids?.includes(id)
                );
              return `<article><div><strong>${esc(d.name)}</strong>${button('Consultar', 'creation-read', `data-key="disciplines" data-id="${id}"`, 'text-button')}</div>${d.is_path_parent ? select('path:' + id, 'Linha inicial de ' + d.name, [{ value: '', label: 'Escolha uma linha inicial' }, ...paths.map((d) => ({ value: d.id, label: d.name }))], this.plan.primary_paths[id] ?? '') + '<p class="hint">A linha acompanha o nível desta disciplina na criação, sem gastar pontos adicionais.</p>' : '<p class="hint">Você pode começar com nível 0 e evoluir depois.</p>'}</article>`;
            })
            .join('')}</section>`
        : ''
    }<p class="hint">Nome do jogador: ${esc(this.source.player)}. Geração e capital são calculados pelos antecedentes. História, ambição, desejo e convicções são opcionais na última etapa.</p>`;
  }
  customDisciplineList() {
    return `<div class="creation-discipline-options">${
      this.game.disciplines
        .filter((d) => normalizedName(d.name).includes(normalizedName(this.query)))
        .map(
          (d) =>
            `<label class="checkbox"><input type="checkbox" data-custom-discipline="${d.id}" ${this.plan.disciplines.includes(d.id) ? 'checked' : ''} ${!this.plan.disciplines.includes(d.id) && this.plan.disciplines.length >= 3 ? 'disabled' : ''}><span>${esc(d.name)}</span></label>`
        )
        .join('') || '<p>Nenhuma disciplina encontrada.</p>'
    }</div>`;
  }
  allocation(bonus) {
    const c = this.game.character_creation.guided,
      stage = creationStages[this.step],
      category = stage.key,
      traits = stage.phase === 'traits',
      total = bonus ? this.report.totals.bonus : this.report.totals[category],
      available = total.budget - total.used,
      sequence = creationStages
        .map((s, index) => ({ ...s, index }))
        .filter((s) => (bonus ? ['traits', 'bonus'].includes(s.phase) : s.phase === 'initial'));
    const instructions = {
      atributes: `Todos começam em ${c.attribute_base}. Distribua mais ${c.initial.atributes} pontos; limite ${c.initial_max.atributes} nesta etapa.`,
      skills: `Distribua ${c.initial.skills} pontos entre talentos, perícias e conhecimentos. O limite inicial de cada habilidade é ${c.initial_max.skills}.`,
      precedents: `Distribua ${c.initial.precedents} pontos. Geração e Recursos já atualizam sua ficha automaticamente.`,
      disciplines: `Distribua exatamente ${c.initial.disciplines} pontos entre os três dons do seu clã. Uma disciplina pode ficar em zero.`
    };
    return `<header class="creation-section-heading"><span class="eyebrow">${bonus ? 'SEGUNDA DISTRIBUIÇÃO · BÔNUS' : 'PRIMEIRA DISTRIBUIÇÃO · BASE'}</span><h2 tabindex="-1">${traits ? 'Primeiro, suas qualidades e defeitos.' : bonus ? stage.label + '.' : 'Distribua seus ' + categories[category].toLowerCase() + '.'}</h2><p>${traits ? `Defeitos acrescentam pontos; qualidades consomem pontos. Escolha até ${c.max_flaws} defeitos e depois distribua a reserva entre os traços, na ordem.` : bonus ? `+1 nível custa ${c.bonus_costs[category]} PB. Limite ${c.max_level}, respeitando suas características. Você pode guardar bônus para a próxima categoria.` : instructions[category]}</p></header><ol class="creation-sequence" aria-label="Ordem desta distribuição">${sequence.map((s) => `<li ${s.index === this.step ? 'aria-current="step"' : ''}><button type="button" data-create-step="${s.index}" ${s.index >= this.step ? 'disabled' : ''}>${s.index < this.step ? icon('test') : `<span>${sequence.indexOf(s) + 1}</span>`}${s.phase === 'bonus' ? categories[s.key] : s.label}</button></li>`).join('')}</ol><div class="creation-budget ${available === 0 ? 'complete' : ''} ${available < 0 ? 'warning' : ''}"><div><span>${bonus ? 'BÔNUS RESTANTES NA RESERVA' : 'PONTOS RESTANTES NESTA ETAPA'}</span><strong>${available}</strong></div><div class="creation-budget-track" role="progressbar" aria-label="Pontos gastos" aria-valuemin="0" aria-valuemax="${total.budget}" aria-valuenow="${Math.min(total.budget, Math.max(0, total.used))}"><i style="width:${Math.min(100, total.budget ? (total.used / total.budget) * 100 : 100)}%"></i></div><p>${bonus ? `${c.bonus_points} iniciais + ${total.flaws} de defeitos − ${total.merits} em qualidades − ${total.used - total.merits} em níveis` : `${total.used} de ${total.budget} distribuídos · use todos para liberar a próxima etapa`}</p>${bonus && !traits ? `<small>Reserva única para atributos, habilidades, antecedentes e disciplinas.</small>` : ''}</div>${traits ? this.traits() : `<section class="creation-allocation"><div class="section-heading"><h3>${categories[category]}</h3><span class="tag">${bonus ? c.bonus_costs[category] + ' PB por +1' : 'Limite inicial ' + c.initial_max[category]}</span></div>${category === 'skills' ? `<nav class="creation-categories" aria-label="Grupo de habilidades">${skillKeys.map((key) => `<button type="button" data-creation-skill="${key}" aria-pressed="${key === this.skillCategory}">${labels[key]}</button>`).join('')}</nav><p class="hint">Talentos, perícias e conhecimentos usam a mesma reserva. ${bonus ? 'Todos podem chegar a ' + c.max_level + '.' : 'Os três grupos somam ' + c.initial.skills + ' pontos.'}</p>` : ''}${(category === 'skills' ? [this.skillCategory] : [category]).map((key) => `<section class="creation-trait-group"><div class="creation-trait-grid">${this.rows(key, bonus)}</div></section>`).join('')}</section>`}${
      bonus && this.report.issues.some((i) => i.stage === 'bonus' && i.key !== 'bonus')
        ? `<details class="creation-warnings"><summary>Conferir suas escolhas (${this.report.issues.filter((i) => i.stage === 'bonus' && i.key !== 'bonus').length})</summary>${this.report.issues
            .filter((i) => i.stage === 'bonus' && i.key !== 'bonus')
            .map((i) => `<p>${esc(i.message)}</p>`)
            .join(
              ''
            )}<p>Requisitos de atributos e habilidades podem ser atendidos durante a distribuição dos bônus.</p></details>`
        : ''
    }`;
  }
  rows(key, bonus) {
    const c = this.game.character_creation.guided,
      e = creationConstraints(this.plan, this.game),
      category = family(key),
      stage = bonus ? 'bonus' : 'initial';
    const defs =
      key === 'disciplines'
        ? this.game[key].filter((d) => this.plan.disciplines.includes(d.id))
        : this.game[key];
    return defs
      .map((d) => {
        const initial =
            this.plan.initial[key][d.id] ?? (key === 'atributes' ? c.attribute_base : 0),
          extra = this.plan.bonus[key][d.id] || 0,
          value = bonus ? amount(this.p, key, d.id) : initial,
          forced = key === 'atributes' && e.attribute_set[d.id] !== undefined,
          min = key === 'atributes' ? (forced ? e.attribute_set[d.id] : c.attribute_base) : 0,
          cap = Math.min(
            bonus ? c.max_level : c.initial_max[category],
            key === 'atributes'
              ? (e.attribute_caps[d.id] ?? 5)
              : key === 'disciplines'
                ? (e.discipline_caps[d.id] ?? 5)
                : 5
          ),
          remaining =
            this.report.totals[bonus ? 'bonus' : category].budget -
            this.report.totals[bonus ? 'bonus' : category].used,
          cost = bonus ? c.bonus_costs[category] : 1;
        return `<article class="creation-trait-card"><div class="creation-trait-title"><strong>${esc(d.name)}</strong>${button(icon('rules'), 'creation-read', `data-key="${key}" data-id="${d.id}" aria-label="Consultar ${esc(d.name)}"`, 'icon-button')}</div><div class="creation-points" aria-label="Nível ${value} de ${d.name}">${Array.from({ length: 5 }, (_, i) => `<i class="${i < value ? (i >= initial ? 'bonus' : 'filled') : ''}"></i>`).join('')}</div><div class="creation-trait-controls"><button type="button" data-creation-change="-1" data-key="${key}" data-id="${d.id}" aria-label="Diminuir ${esc(d.name)}" ${forced || (bonus ? extra <= 0 : initial <= min) ? 'disabled' : ''}>−</button><output aria-live="polite">${value}</output><button type="button" data-creation-change="1" data-key="${key}" data-id="${d.id}" aria-label="Aumentar ${esc(d.name)}" ${forced || value >= cap || remaining < cost ? 'disabled' : ''}>+</button></div><small>${forced ? 'Valor fixado por característica' : bonus ? `${initial} inicial + ${extra} comprado${key === 'disciplines' && e.discipline_grants[d.id] ? ' + ' + e.discipline_grants[d.id] + ' de qualidade' : ''} · ${cost} bônus por ponto` : 'Limite inicial ' + cap}${key === 'precedents' && d.creation_effect === 'generation' ? ` · ${c.generation_base - amount(this.p, key, d.id)}ª geração` : key === 'precedents' && d.creation_effect === 'capital' ? ' · ' + realMoney(c.capital_by_level[amount(this.p, key, d.id)]) : ''}</small></article>`;
      })
      .join('');
  }
  traits() {
    return `<section class="creation-traits-shop"><div class="section-heading"><h3>Marcas da sua história</h3><span class="tag">${this.report.derived.flaws}/${this.game.character_creation.guided.max_flaws} defeitos</span></div><p class="hint">Os pontos são definidos pelo livro. Escolha apenas limitações que façam parte da história do personagem.</p><div class="creation-trait-filters"><label class="search-field">${icon('search')}<input type="search" data-creation-search="traits" aria-label="Buscar qualidades e defeitos" placeholder="Buscar qualidade ou defeito" value="${esc(this.query)}"></label>${select(
      'trait_kind',
      'Mostrar',
      [
        { value: 'all', label: 'Qualidades e defeitos' },
        { value: 'merit', label: 'Qualidades' },
        { value: 'flaw', label: 'Defeitos' },
        { value: 'selected', label: 'Já escolhidos' }
      ],
      this.kind
    )}</div><div id="creation-traits-list">${this.traitList()}</div></section>`;
  }
  traitList() {
    const remaining = this.report.totals.bonus.remaining;
    const entries = this.game.caracteristics.filter(
      (d) =>
        traitKind(d) &&
        d.availability !== 'filtered' &&
        normalizedName(d.name + ' ' + d.description).includes(normalizedName(this.query)) &&
        (this.kind === 'all' ||
          this.kind === traitKind(d) ||
          (this.kind === 'selected' && this.plan.traits.some((r) => r.id === d.id)))
    );
    return `<p class="hint">${entries.length} resultado(s)${entries.length > 60 ? ' · refine a busca para encontrar mais opções' : ''}</p><div class="creation-trait-options">${
      entries
        .slice(0, 60)
        .map((d) => {
          const row = this.plan.traits.find((r) => r.id === d.id),
            flaw = traitKind(d) === 'flaw',
            cost = traitPrice(d),
            locked =
              !row &&
              (flaw
                ? this.report.derived.flaws >= this.game.character_creation.guided.max_flaws
                : cost > remaining),
            effects = effectDescriptions(d, this.game);
          return `<article class="creation-feature ${row ? 'selected' : ''}"><header><span class="tag ${flaw ? 'red' : ''}">${flaw ? 'DEFEITO +' : 'QUALIDADE −'}${cost} PB</span><h4>${esc(d.name)}</h4></header><p>${esc(d.description.slice(0, 180))}${d.description.length > 180 ? '…' : ''}</p>${effects.length ? '<small class="creation-automatic">' + icon('test') + ' Efeito conferido na criação</small>' : ''}<footer>${button('Consultar', 'creation-read', `data-key="caracteristics" data-id="${d.id}"`, 'button ghost')}<button type="button" class="button ${row ? 'ghost' : 'primary'}" data-creation-trait="${d.id}" ${locked ? 'disabled' : ''}>${row ? 'Retirar' : 'Escolher'}</button></footer>${row ? `<label class="field"><span>Detalhes na história (opcional)</span><textarea data-creation-trait-notes="${d.id}" maxlength="3000" rows="2">${esc(row.notes)}</textarea></label>` : ''}</article>`;
        })
        .join('') || '<p>Nenhuma opção encontrada.</p>'
    }</div>`;
  }
  review() {
    const { totals, derived, issues, warnings } = this.report;
    return `<header class="creation-section-heading"><span class="eyebrow">04 · ANTES DO ABRAÇO</span><h2 tabindex="-1">Confira sua nova história.</h2><p>O envio cria uma proposta. Só o narrador pode aprovar o personagem e liberar sua ficha.</p></header><div class="creation-review-highlights"><span>GERAÇÃO<strong>${derived.generation}ª</strong></span><span>CAPITAL INICIAL<strong>${realMoney(derived.money)}</strong></span><span>BÔNUS UTILIZADOS<strong>${totals.bonus.used}/${totals.bonus.budget}</strong></span></div>${issues.length ? `<div class="creation-attention"><h3>Ajuste antes de enviar</h3>${issues.map((i) => `<p>${esc(i.message)}</p>`).join('')}</div>` : '<p class="creation-pass">' + icon('test') + ' Distribuição conferida. Tudo pronto para a avaliação.</p>'}<div class="creation-review-grid">${Object.entries(
      categories
    )
      .map(
        ([category, name]) =>
          `<details class="panel" ${category === 'disciplines' || category === 'precedents' ? 'open' : ''}><summary>${name}</summary>${(category === 'skills' ? skillKeys : [category]).flatMap((key) => this.p[key].filter((r) => key === 'disciplines' || r.value > 0).map((r) => `<p><span>${esc(this.game[key].find((d) => d.id === r.id)?.name)}</span><strong>${r[key === 'disciplines' ? 'nivel' : 'value']}</strong></p>`)).join('')}</details>`
      )
      .join(
        ''
      )}</div><section class="panel creation-review-features"><h3>Qualidades e defeitos</h3>${
      selectedTraits(this.plan, this.game)
        .map(
          (r) =>
            `<p><strong>${esc(r.definition.name)}</strong> · ${traitPrice(r.definition)} PB<br>${esc(r.notes || '')}</p>`
        )
        .join('') || '<p class="muted">Nenhum escolhido.</p>'
    }</section><details class="panel creation-narrative"><summary>História e motivações <small>Opcional</small></summary><div class="form-grid">${area('biography', 'História do personagem', this.source.biography || '', 'maxlength="30000"')}${area('ambition', 'Ambição (opcional)', this.source.aspirations?.ambition || '', 'maxlength="30000"')}${area('desire', 'Desejo (opcional)', this.source.aspirations?.desire || '', 'maxlength="30000"')}${area('convictions', 'Princípios e convicções — um por linha', (this.source.moralityes || []).map((r) => r.description).join('\n'), 'maxlength="10000"')}</div></details>${warnings.length ? `<details class="creation-warnings"><summary>Observações para você e o narrador (${warnings.length})</summary>${warnings.map((w) => `<p>${esc(w)}</p>`).join('')}</details>` : ''}`;
  }
  draw({ top = false } = {}) {
    const host = $('#main-content');
    const active = document.activeElement;
    const control = active?.dataset.creationChange
      ? { change: active.dataset.creationChange, key: active.dataset.key, id: active.dataset.id }
      : null;
    host.innerHTML = this.render();
    this.bind();
    if (control && !top)
      host
        .querySelector(
          `[data-creation-change="${control.change}"][data-key="${control.key}"][data-id="${control.id}"]`
        )
        ?.focus({ preventScroll: true });
    if (top) host.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  changeStep(index, { forward = false } = {}) {
    if (forward) {
      this.update();
      const next = nextCreationStep(this.step, this.currentSource(), this.report);
      if (!next.allowed || next.target !== index) return false;
      this.notice = next.loop
        ? 'Mais uma volta para gastar o restante. Suas escolhas estão mantidas.'
        : '';
    } else {
      if (!canReturnToCreationStep(this.step, index)) return false;
      this.notice = '';
    }
    this.error = '';
    this.step = index;
    this.query = '';
    this.skillCategory = 'talents';
    this.saveDraft();
    this.draw({ top: true });
    $('#creation-wizard h2')?.focus({ preventScroll: true });
    return true;
  }
  bind() {
    const form = $('#creation-wizard');
    document.querySelectorAll('[data-create-step]').forEach(
      (b) =>
        (b.onclick = (event) => {
          event.stopPropagation();
          this.changeStep(Number(b.dataset.createStep));
        })
    );
    form.oninput = (event) => {
      const input = event.target;
      if (input.dataset.creationSearch) {
        this.query = input.value;
        $(
          '#' +
            (input.dataset.creationSearch === 'traits'
              ? 'creation-traits-list'
              : 'creation-custom-list')
        ).innerHTML =
          input.dataset.creationSearch === 'traits'
            ? this.traitList()
            : this.customDisciplineList();
        return;
      }
      if (input.dataset.creationTraitNotes) {
        this.plan.traits.find((r) => r.id === Number(input.dataset.creationTraitNotes)).notes =
          input.value;
        this.saveDraft();
        return;
      }
      if (input.name === 'char' || input.name === 'cla' || input.name === 'biography')
        this.source[input.name] = input.value;
      if (input.name === 'ambition' || input.name === 'desire')
        this.source.aspirations[input.name] = input.value;
      if (input.name === 'convictions')
        this.source.moralityes = input.value
          .split('\n')
          .filter((t) => t.trim())
          .map((description, id) => ({ id, description }));
      this.saveDraft();
      this.refreshNavigation();
    };
    form.onchange = (event) => {
      const input = event.target;
      if (input.name === 'clan') {
        const apply = () => {
          this.plan = chooseClan(this.plan, input.value, this.game);
          this.query = '';
          this.saveDraft();
          this.draw();
        };
        if (
          Object.values(this.plan.initial.disciplines).some((v) => v) ||
          Object.values(this.plan.bonus.disciplines).some((v) => v)
        ) {
          const previous = this.plan.clan,
            next = input.value;
          input.value = previous;
          modal(
            'Trocar o clã?',
            '<p>Os pontos aplicados às disciplinas serão devolvidos e as linhas iniciais serão escolhidas novamente. Seus outros traços permanecem.</p>',
            async () => {
              input.value = next;
              apply();
            },
            { saveLabel: 'Trocar e devolver pontos' }
          );
        } else apply();
      } else if (input.name.startsWith('path:')) {
        const id = input.name.slice(5);
        if (input.value === '') delete this.plan.primary_paths[id];
        else this.plan.primary_paths[id] = Number(input.value);
        this.saveDraft();
        this.refreshNavigation();
      } else if (input.dataset.customDiscipline) {
        const id = Number(input.dataset.customDiscipline);
        if (input.checked && this.plan.disciplines.length < 3) this.plan.disciplines.push(id);
        if (!input.checked) {
          this.plan.disciplines = this.plan.disciplines.filter((x) => x !== id);
          delete this.plan.initial.disciplines[id];
          delete this.plan.bonus.disciplines[id];
          delete this.plan.primary_paths[id];
        }
        this.saveDraft();
        this.draw();
      } else if (input.name === 'trait_kind') {
        this.kind = input.value;
        this.draw();
      }
    };
    form.onclick = async (event) => {
      const b = event.target.closest('button');
      if (!b || b.disabled) return;
      event.stopPropagation();
      if (b.dataset.creationChange) {
        const stage = creationStages[this.step].phase === 'bonus' ? 'bonus' : 'initial',
          key = b.dataset.key,
          id = b.dataset.id;
        this.plan[stage][key][id] =
          (this.plan[stage][key][id] ??
            (stage === 'initial' && key === 'atributes'
              ? this.game.character_creation.guided.attribute_base
              : 0)) + Number(b.dataset.creationChange);
        this.saveDraft();
        this.draw();
      } else if (b.dataset.creationSkill) {
        this.skillCategory = b.dataset.creationSkill;
        this.draw();
      } else if (b.dataset.creationTrait) {
        const id = Number(b.dataset.creationTrait);
        if (this.plan.traits.some((r) => r.id === id))
          this.plan.traits = this.plan.traits.filter((r) => r.id !== id);
        else this.plan.traits.push({ id, notes: '' });
        const before = JSON.stringify(this.plan.initial);
        this.plan = reconcileCreation(this.plan, this.game);
        this.notice =
          before !== JSON.stringify(this.plan.initial)
            ? 'Esta característica devolveu pontos iniciais. Use Reajustar abaixo para redistribuí-los; as outras escolhas foram mantidas.'
            : '';
        this.saveDraft();
        this.draw();
      } else if (b.dataset.action === 'creation-read')
        showRuleContent(
          this.game[b.dataset.key].find((d) => d.id === Number(b.dataset.id)),
          b.dataset.key,
          this.game
        );
      else if (b.dataset.action === 'creation-next') {
        this.update();
        const next = nextCreationStep(this.step, this.currentSource(), this.report);
        this.changeStep(next.target, { forward: true });
      } else if (b.dataset.action === 'creation-fix') this.changeStep(Number(b.dataset.step));
      else if (b.dataset.action === 'creation-prev') this.changeStep(this.step - 1);
      else if (b.dataset.action === 'creation-cancel') {
        delete document.body.dataset.pendingEditor;
        this.onCancel();
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.busy || this.step !== 10) return;
      this.update();
      const problems = [...this.report.issues];
      if (!this.source.char?.trim())
        problems.unshift({ message: 'Preencha o nome do personagem.' });
      if (this.plan.clan === 'custom' && !this.source.cla?.trim())
        problems.unshift({ message: 'Preencha o nome do clã personalizado.' });
      if (problems.length) {
        this.error = problems[0].message;
        this.draw();
        $('#creation-error').scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      modal(
        'Enviar personagem para avaliação?',
        `<p><strong>${esc(this.p.char)}</strong> · ${esc(this.p.cla)} · ${this.p.generation}ª geração</p><p>Capital inicial: ${realMoney(this.p.money)}. A ficha só será liberada depois da aprovação do narrador.</p><p>Todos os pontos iniciais e bônus foram utilizados.</p><label class="checkbox"><input type="checkbox" name="confirmed" required> Conferi os pontos e quero enviar esta ficha.</label>`,
        async () => {
          if (this.busy) return;
          this.busy = true;
          try {
            const p = validatePlayer(this.p, this.game);
            const result = await this.onSubmit(p);
            await this.clearDraft();
            await this.onSaved(result);
          } finally {
            this.busy = false;
          }
        },
        { saveLabel: 'Enviar ao narrador' }
      );
    };
  }
}
