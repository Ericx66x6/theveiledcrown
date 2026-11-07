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
import { $, esc, field, area, select, icon, button, modal, toast, download } from '../shared/ui.js';
import { labels } from '../shared/rules.js';
import { store } from './api.js';
import { realMoney, showRuleContent, effectDescriptions } from './rule-content.js';
const steps = ['Identidade', 'Pontos iniciais', 'Pontos bônus', 'Conferir e enviar'];
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
    this.category = 'atributes';
    this.bonusCategory = 'atributes';
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
  render() {
    this.update();
    const totals = this.report.totals;
    return `<section class="page-intro creation-intro"><span class="eyebrow">UM PERSONAGEM. UMA NOVA NÃO-VIDA.</span><h1>Do primeiro traço ao véu.</h1><p>Construa sua ficha em duas distribuições. O narrador confere e aprova antes de você jogar.</p></section><nav class="creation-steps" aria-label="Etapas da criação">${steps.map((name, index) => `<button type="button" data-create-step="${index}" aria-current="${index === this.step ? 'step' : 'false'}"><span>${index + 1}</span><strong>${name}</strong></button>`).join('')}</nav><form id="creation-wizard" novalidate><div class="creation-context"><span>${esc(this.p.char || 'Seu personagem')}<small>${esc(this.p.cla || 'Escolha o clã')}</small></span><span>${this.p.generation}ª geração<small>${realMoney(this.p.money)} iniciais</small></span></div><section class="creation-screen">${this.step === 0 ? this.identity() : this.step === 1 ? this.allocation(false) : this.step === 2 ? this.allocation(true) : this.review()}</section><p class="form-error" id="creation-error" role="alert">${esc(this.error)}</p><footer class="creation-footer"><span>Rascunho nesta aba · #${this.p.id}</span><div>${button('Cancelar', 'creation-cancel', '', 'button ghost')}${this.step ? button('Voltar', 'creation-prev', '', 'button ghost') : ''}${this.step < 3 ? button('Continuar ' + icon('arrow'), 'creation-next', '', 'button primary') : `<button type="submit" class="button primary">${icon('save')} Enviar ao narrador</button>`}</div></footer></form>`;
  }
  identity() {
    const c = this.game.character_creation.guided,
      custom = this.plan.clan === 'custom';
    return `<header class="creation-section-heading"><span class="eyebrow">01 · QUEM ATRAVESSA O VÉU?</span><h2>Um nome e uma linhagem.</h2><p>Os clãs usam as combinações definidas pela sua mesa. Um clã personalizado sempre passa pela sua avaliação com o narrador.</p></header><div class="form-grid">${field('char', 'Nome do personagem', this.source.char, 'text', 'required maxlength="150" autocomplete="off"')}${select('clan', 'Clã', [{ value: '', label: 'Escolha seu clã' }, ...c.clans.map((row) => ({ value: row.id, label: row.name })), { value: 'custom', label: 'Clã personalizado' }], this.plan.clan)}${custom ? field('cla', 'Nome do clã personalizado', this.source.cla || '', 'text', 'required maxlength="80"') : ''}</div>${custom ? `<section class="creation-custom-clan"><h3>Escolha três disciplinas <small>${this.plan.disciplines.length}/3</small></h3><p class="hint">Selecione entre as disciplinas cadastradas. As linhas iniciais são escolhidas abaixo quando necessário.</p><label class="search-field">${icon('search')}<input type="search" data-creation-search="custom" aria-label="Buscar disciplinas para o clã" placeholder="Buscar disciplina" value="${esc(this.query)}"></label><div id="creation-custom-list">${this.customDisciplineList()}</div></section>` : ''}${
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
      category = bonus ? this.bonusCategory : this.category,
      total = bonus ? this.report.totals.bonus : this.report.totals[category],
      available = total.budget - total.used;
    return `<header class="creation-section-heading"><span class="eyebrow">${bonus ? '03 · UM PREÇO PARA CADA ESCOLHA' : '02 · A BASE DO PERSONAGEM'}</span><h2>${bonus ? 'Pontos bônus. Mais possibilidades.' : 'Distribua seus pontos iniciais.'}</h2><p>${bonus ? `Cada aumento custa pontos bônus. Qualidades gastam; defeitos concedem pontos. Todos os traços podem chegar ao nível ${c.max_level}, respeitando limitações pessoais.` : `Atributos partem de ${c.attribute_base}. Talentos, perícias e conhecimentos dividem uma única reserva de ${c.initial.skills} pontos. Antecedentes e disciplinas têm reservas próprias.`}</p></header>${
      bonus
        ? `<div class="creation-budget-bonus"><div><span>PONTOS BÔNUS RESTANTES</span><strong class="${available < 0 ? 'expense' : ''}">${available}</strong></div><p>${c.bonus_points} iniciais + ${this.report.totals.bonus.flaws} de defeitos − ${total.used} gastos</p></div><div class="creation-costs">${Object.entries(
            c.bonus_costs
          )
            .map(([key, cost]) => `<span>${names[key]}<strong>${cost} por +1</strong></span>`)
            .join('')}</div>`
        : `<div class="creation-initial-budgets">${Object.entries(this.report.totals)
            .filter(([k]) => k !== 'bonus')
            .map(
              ([key, total]) =>
                `<span class="${total.used === total.budget ? 'complete' : total.used > total.budget ? 'warning' : ''}">${names[key]}<strong>${total.used}/${total.budget}</strong></span>`
            )
            .join('')}</div>`
    }<nav class="creation-categories" aria-label="${bonus ? 'Compras com bônus' : 'Distribuição inicial'}">${Object.entries(
      { ...categories, ...(bonus ? { traits: 'Qualidades e defeitos' } : {}) }
    )
      .map(
        ([key, label]) =>
          `<button type="button" data-creation-category="${key}" aria-pressed="${category === key}">${label}</button>`
      )
      .join(
        ''
      )}</nav>${category === 'traits' ? this.traits() : `<section class="creation-allocation"><div class="section-heading"><h3>${categories[category]}</h3><span class="tag ${available < 0 ? 'red' : ''}">${bonus ? available + ' bônus disponíveis' : available + ' ponto(s) restantes'}</span></div>${category === 'skills' ? `<nav class="creation-categories" aria-label="Grupo de habilidades">${skillKeys.map((key) => `<button type="button" data-creation-skill="${key}" aria-pressed="${key === this.skillCategory}">${labels[key]}</button>`).join('')}</nav><p class="hint">A reserva de ${c.initial.skills} pontos é compartilhada pelos três grupos.</p>` : ''}${(category === 'skills' ? [this.skillCategory] : [category]).map((key) => `<section class="creation-trait-group">${category === 'skills' ? `<h4>${labels[key]}</h4>` : ''}<div class="creation-trait-grid">${this.rows(key, bonus)}</div></section>`).join('')}</section>`}${
      this.step === 2 && this.report.issues.some((i) => i.stage === 'bonus')
        ? `<div class="creation-attention" role="status">${this.report.issues
            .filter((i) => i.stage === 'bonus')
            .map((i) => `<p>${esc(i.message)}</p>`)
            .join('')}</div>`
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
        return `<article class="creation-trait-card"><div class="creation-trait-title"><strong>${esc(d.name)}</strong>${button(icon('rules'), 'creation-read', `data-key="${key}" data-id="${d.id}" aria-label="Consultar ${esc(d.name)}"`, 'icon-button')}</div><div class="creation-points" aria-label="Nível ${value} de ${d.name}">${Array.from({ length: 5 }, (_, i) => `<i class="${i < value ? (i >= initial ? 'bonus' : 'filled') : ''}"></i>`).join('')}</div><div class="creation-trait-controls"><button type="button" data-creation-change="-1" data-key="${key}" data-id="${d.id}" aria-label="Diminuir ${esc(d.name)}" ${forced || (bonus ? extra <= 0 : initial <= min) ? 'disabled' : ''}>−</button><output>${value}</output><button type="button" data-creation-change="1" data-key="${key}" data-id="${d.id}" aria-label="Aumentar ${esc(d.name)}" ${forced || value >= cap || remaining < cost ? 'disabled' : ''}>+</button></div><small>${forced ? 'Valor fixado por característica' : bonus ? `${initial} inicial + ${extra} comprado${key === 'disciplines' && e.discipline_grants[d.id] ? ' + ' + e.discipline_grants[d.id] + ' de qualidade' : ''} · ${cost} bônus por ponto` : 'Limite inicial ' + cap}${key === 'precedents' && d.creation_effect === 'generation' ? ` · ${c.generation_base - amount(this.p, key, d.id)}ª geração` : key === 'precedents' && d.creation_effect === 'capital' ? ' · ' + realMoney(c.capital_by_level[amount(this.p, key, d.id)]) : ''}</small></article>`;
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
    return `<header class="creation-section-heading"><span class="eyebrow">04 · ANTES DO ABRAÇO</span><h2>Confira sua nova história.</h2><p>O envio cria uma proposta. Só o narrador pode aprovar o personagem e liberar sua ficha.</p></header><div class="creation-review-highlights"><span>GERAÇÃO<strong>${derived.generation}ª</strong></span><span>CAPITAL INICIAL<strong>${realMoney(derived.money)}</strong></span><span>BÔNUS UTILIZADOS<strong>${totals.bonus.used}/${totals.bonus.budget}</strong></span></div>${issues.length ? `<div class="creation-attention"><h3>Ajuste antes de enviar</h3>${issues.map((i) => `<p>${esc(i.message)}</p>`).join('')}</div>` : '<p class="creation-pass">' + icon('test') + ' Distribuição conferida. Tudo pronto para a avaliação.</p>'}<div class="creation-review-grid">${Object.entries(
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
    host.innerHTML = this.render();
    this.bind();
    if (top) host.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  changeStep(index) {
    this.error = '';
    this.step = Math.max(0, Math.min(3, index));
    this.query = '';
    this.draw({ top: true });
  }
  bind() {
    const form = $('#creation-wizard');
    document
      .querySelectorAll('[data-create-step]')
      .forEach((b) => (b.onclick = () => this.changeStep(Number(b.dataset.createStep))));
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
        const stage = this.step === 2 ? 'bonus' : 'initial',
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
      } else if (b.dataset.creationCategory) {
        if (this.step === 2) this.bonusCategory = b.dataset.creationCategory;
        else this.category = b.dataset.creationCategory;
        this.query = '';
        this.draw();
      } else if (b.dataset.creationTrait) {
        const id = Number(b.dataset.creationTrait);
        if (this.plan.traits.some((r) => r.id === id))
          this.plan.traits = this.plan.traits.filter((r) => r.id !== id);
        else this.plan.traits.push({ id, notes: '' });
        this.plan = reconcileCreation(this.plan, this.game);
        this.saveDraft();
        this.draw();
      } else if (b.dataset.action === 'creation-read')
        showRuleContent(
          this.game[b.dataset.key].find((d) => d.id === Number(b.dataset.id)),
          b.dataset.key,
          this.game
        );
      else if (b.dataset.action === 'creation-next') this.changeStep(this.step + 1);
      else if (b.dataset.action === 'creation-prev') this.changeStep(this.step - 1);
      else if (b.dataset.action === 'creation-cancel') {
        delete document.body.dataset.pendingEditor;
        this.onCancel();
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.busy) return;
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
        `<p><strong>${esc(this.p.char)}</strong> · ${esc(this.p.cla)} · ${this.p.generation}ª geração</p><p>Capital inicial: ${realMoney(this.p.money)}. A ficha só será liberada depois da aprovação do narrador.</p>${this.report.totals.bonus.remaining ? `<p class="creation-attention">Restam ${this.report.totals.bonus.remaining} pontos bônus. Ao enviar assim, você aceita encerrar a criação sem usá-los; eles não viram XP.</p>` : ''}<label class="checkbox"><input type="checkbox" name="confirmed" required> Conferi os pontos e quero enviar esta ficha.</label>`,
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
