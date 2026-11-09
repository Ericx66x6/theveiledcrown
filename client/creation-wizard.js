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
import { $, esc, field, area, select, icon, button, modal, toast } from '../shared/ui.js';
import { labels } from '../shared/rules.js';
import { store } from './api.js';
import { portraitDialog, portraitStyle } from './portrait.js';
import { clanArt, guideForClan, convictionExamples } from '../core/clan-guide.js';
import {
  clanRail,
  clanWeakness,
  clanSpotlight,
  clanAttributeHint,
  selectedClan,
  narrativeFields,
  storyHelper,
  disciplineIntro
} from './creation-guide.js';
import { allocationControl, traitRestriction } from './creation-controls.js';
import { playSound } from './audio.js';
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
    campaign = {},
    character,
    id,
    accountId,
    accountName,
    draftKey = 'new',
    onSaved,
    onSubmit,
    onCancel
  }) {
    Object.assign(this, { game, campaign, onSaved, onSubmit, onCancel });
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
    this.kind = 'merit';
    this.traitPage = 0;
    this.previewClan =
      this.plan.clan || this.game.character_creation.guided.clans[0]?.id || 'custom';
    this.clanTab = 'overview';
    const reconciled = reconcileCreation(this.plan, this.game);
    if (JSON.stringify(reconciled) !== JSON.stringify(this.plan))
      this.notice =
        'A fraqueza do clã ou uma característica ajustou os valores fixos. Confira os pontos devolvidos antes de enviar.';
    this.plan = reconciled;
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
    return `${this.step === 0 ? '<section class="page-intro creation-intro"><span class="eyebrow">CRIE SUA NÃO-VIDA</span><h1>A sua primeira noite começa aqui.</h1><p>Conheça as linhagens, imagine seu personagem e monte a ficha com ajuda. Cada etapa explica o que fazer; o narrador avalia antes de você jogar.</p></section>' : '<h1 class="creation-compact-title">Criação de personagem</h1>'}<nav class="creation-steps" aria-label="Fases da criação">${phases.map((phase, index) => `<button type="button" data-create-step="${phase.start}" ${phase.start >= this.step ? 'disabled' : ''} aria-current="${this.step >= phase.start && this.step <= phase.end ? 'step' : 'false'}"><span>${this.step > phase.end ? icon('test') : index + 1}</span><strong>${phase.label}</strong></button>`).join('')}</nav><div class="creation-progress"><span>PASSO ${this.step + 1} DE ${creationStages.length}<strong>${stage.label}</strong></span><div role="progressbar" aria-label="Progresso da criação" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div></div><form id="creation-wizard" novalidate data-creation-step="${this.step}"><div class="creation-context"><span>${esc(this.p.char || 'Seu personagem')}<small>${esc(this.p.cla || 'Escolha o clã')}</small></span><span>${this.p.generation}ª geração<small>${realMoney(this.p.money)} iniciais</small></span></div>${this.notice ? `<p class="creation-effect-note" role="status">${esc(this.notice)}</p>` : ''}<section class="creation-screen">${stage.phase === 'identity' ? this.identity() : stage.phase === 'review' ? this.review() : this.allocation(stage.phase === 'bonus' || stage.phase === 'traits')}</section><p class="form-error" id="creation-error" role="alert">${esc(this.error)}</p><div id="creation-navigation">${this.navigation()}</div></form>`;
  }
  navigation() {
    const stage = creationStages[this.step],
      next = nextCreationStep(this.step, this.currentSource(), this.report),
      problems = creationStepProblems(this.step, this.currentSource(), this.report),
      corrections = [...new Set(problems.filter((p) => p.step < this.step).map((p) => p.step))],
      remaining = this.report.totals.bonus.remaining,
      bonus = stage.phase === 'bonus' || stage.phase === 'traits',
      total = bonus ? this.report.totals.bonus : this.report.totals[stage.key],
      nextStage = creationStages[next.allowed ? next.target : Math.min(10, this.step + 1)];
    let label =
      'Continuar: ' + (nextStage.phase === 'bonus' ? categories[nextStage.key] : nextStage.label);
    if (next.loop) label = `Distribuir bônus restantes (${remaining})`;
    if (stage.phase === 'traits')
      label = this.plan.traits.length
        ? 'Continuar com estas escolhas'
        : 'Continuar sem qualidades e defeitos';
    if (this.step === 9 && !next.loop)
      label = remaining === 0 ? 'Tudo gasto · conferir ficha' : 'Conferir ficha';
    const help =
      stage.phase === 'initial'
        ? `Use todos os ${total.budget} pontos desta etapa.`
        : stage.phase === 'traits'
          ? 'Escolhas opcionais. Você pode seguir sem adicionar nenhuma.'
          : stage.phase === 'bonus'
            ? next.loop
              ? 'Ainda há bônus para distribuir. Vamos percorrer as categorias novamente.'
              : 'A mesma reserva passa por todas as categorias de bônus.'
            : 'A ficha só é liberada após a aprovação do narrador.';
    return `<footer class="creation-footer game-creation-footer"><div class="creation-footer-wallet">${total ? `<span>${bonus ? 'PONTOS BÔNUS' : categories[stage.key].toUpperCase()}<strong>${total.budget - total.used}<small>${bonus ? 'PB' : 'pontos'} restantes</small></strong></span>${bonus ? `<small>${total.base} iniciais <b>+${total.flaws}</b> defeitos <b>−${total.merits}</b> qualidades</small>` : `<small>${total.used} de ${total.budget} distribuídos</small>`}` : `<span>${this.step === 10 ? 'PRONTA PARA AVALIAÇÃO' : 'SEU PERSONAGEM'}<strong class="creation-footer-name">${esc(this.p.char || 'Uma nova história')}</strong></span>`}</div><div class="creation-footer-copy"><p role="status">${esc(problems[0]?.message || (total && total.budget === total.used ? 'Pontos desta etapa conferidos.' : help))}</p>${corrections.map((index) => button('Reajustar ' + creationStages[index].label, 'creation-fix', `data-step="${index}"`, 'text-button')).join('')}<small>${help}</small></div><div class="creation-footer-actions">${this.step ? button('Voltar', 'creation-prev', '', 'button ghost') : ''}${this.step === 10 ? `<button type="submit" class="button primary" ${problems.length ? 'disabled' : ''}>${icon('save')} Enviar para avaliação</button>` : button(label + icon('arrow'), 'creation-next', next.allowed ? '' : 'disabled', 'button primary')}</div></footer>`;
  }
  refreshNavigation() {
    this.update();
    $('#creation-navigation').innerHTML = this.navigation();
  }
  identity() {
    const c = this.game.character_creation.guided,
      clan = selectedClan(this),
      custom = this.plan.clan === 'custom',
      flexible = !!clan?.discipline_choices;
    return `<header class="creation-section-heading clan-introduction"><span class="eyebrow">01 · ESCOLHA A SUA LINHAGEM</span><h2 tabindex="-1">O sangue é só o começo.</h2><p>Um clã é uma linhagem de vampiros, com dons e uma fraqueza própria. Explore as imagens, conheça os estilos e escolha o que dá vontade de jogar.</p><div class="creation-start-tools"><span>${c.clans.length} linhagens para conhecer · deslize as cartas</span>${button('Sair da criação', 'creation-cancel', '', 'text-button')}</div></header><div id="creation-clan-rail" class="clan-portrait-rail" aria-label="Linhagens disponíveis">${clanRail(this)}</div><div id="creation-clan-spotlight">${clanSpotlight(this)}</div>${custom || flexible ? `<section class="creation-custom-clan ${flexible ? 'caitiff-choices' : ''}"><div class="section-heading"><div><span class="eyebrow">${flexible ? 'OS DONS QUE VOCÊ DESPERTOU' : 'COMBINAÇÃO PERSONALIZADA'}</span><h3>Escolha três disciplinas</h3></div><strong class="clan-choice-count">${this.plan.disciplines.length}<small>/3</small></strong></div><p>${flexible ? 'Caitiff escolhe três dons comuns diferentes. Disciplinas exclusivas de outros clãs não fazem parte desta escolha.' : 'Converse com o narrador sobre os três dons e a fraqueza dessa linhagem.'}</p>${custom ? field('cla', 'Nome do clã personalizado', this.source.cla || '', 'text', 'required maxlength="80"') : ''}<label class="search-field">${icon('search')}<input type="search" data-creation-search="custom" aria-label="Buscar disciplinas para o clã" placeholder="Buscar disciplina" value="${esc(this.query)}"></label><div id="creation-custom-list">${this.customDisciplineList()}</div></section>` : ''}${
      this.plan.disciplines.length
        ? `<section class="creation-clan-powers"><div class="section-heading"><h3>${this.plan.disciplines.length === 3 ? 'Os três dons do seu sangue' : 'Seus dons escolhidos'}</h3><span class="tag">3 pontos para distribuir depois</span></div>${this.plan.disciplines
            .map((id) => {
              const d = this.game.disciplines.find((d) => d.id === id),
                paths = this.game.disciplines.filter((row) =>
                  row.parent_discipline_ids?.includes(id)
                );
              return `<article><div><strong>${esc(d.name)}</strong><button type="button" class="text-button" data-clan-power="${id}">O que este dom faz?</button></div>${d.is_path_parent ? select('path:' + id, 'Linha inicial de ' + d.name, [{ value: '', label: 'Escolha uma linha inicial' }, ...paths.map((d) => ({ value: d.id, label: d.name }))], this.plan.primary_paths[id] ?? '') + '<p class="hint">A linha acompanha o nível da disciplina. Escolhê-la não gasta pontos extras.</p>' : '<p class="hint">Pode começar no nível 0 e se desenvolver depois.</p>'}</article>`;
            })
            .join('')}</section>`
        : ''
    }${this.plan.clan ? clanWeakness(clan, this.source.clan_flaw_detail, true) : ''}<section class="creation-character-identity"><div class="creation-character-photo"><div class="creation-photo-frame">${this.source.profilepicture ? `<img src="${esc(this.source.profilepicture)}" alt="Retrato do personagem" style="${portraitStyle(this.source)}">` : `<span>${icon('characters')}</span>`}</div>${button(this.source.profilepicture ? 'Trocar ou enquadrar retrato' : 'Escolher retrato', 'creation-portrait', '', 'button ghost')}<small>JPG, PNG ou WebP · até 5 MB · opcional</small></div><div class="creation-character-name"><span class="eyebrow">AGORA, A PESSOA POR TRÁS DO CLÃ</span><h3>Dê um nome à sua história.</h3>${field('char', 'Nome do personagem', this.source.char, 'text', 'required maxlength="150" autocomplete="off" placeholder="Ex.: Helena Vesper"')}<p class="hint">Você joga como ${esc(this.source.player)}. Este retrato e esta história pertencem ao personagem que está criando.</p><small>Rascunho nesta aba · #${this.p.id}</small></div></section>${narrativeFields(this)}`;
  }
  customDisciplineList() {
    const allowed = selectedClan(this)?.discipline_choices;
    const defs = this.game.disciplines.filter(
      (d) =>
        (!allowed || allowed.includes(d.id)) &&
        normalizedName(d.name + ' ' + d.description).includes(normalizedName(this.query))
    );
    return `<div class="creation-discipline-options">${defs.map((d) => `<article class="creation-discipline-choice ${this.plan.disciplines.includes(d.id) ? 'selected' : ''}"><label class="checkbox"><input type="checkbox" data-custom-discipline="${d.id}" ${this.plan.disciplines.includes(d.id) ? 'checked' : ''} ${!this.plan.disciplines.includes(d.id) && this.plan.disciplines.length >= 3 ? 'disabled' : ''}><span>${esc(d.name)}</span></label><button type="button" class="text-button" data-clan-power="${d.id}">Conhecer o dom</button></article>`).join('') || '<p>Nenhuma disciplina encontrada.</p>'}</div>`;
  }
  selectClan(id) {
    if (id === this.plan.clan) return;
    const changing =
      Object.values(this.plan.initial.disciplines).some(Boolean) ||
      Object.values(this.plan.bonus.disciplines).some(Boolean);
    const apply = () => {
      this.plan = chooseClan(this.plan, id, this.game);
      this.source.cla = id === 'custom' ? '' : selectedClan(this)?.name || '';
      this.previewClan = id;
      this.query = '';
      this.clanTab = 'overview';
      this.saveDraft();
      this.draw();
    };
    if (id === 'custom' || changing)
      modal(
        id === 'custom' ? 'Clã personalizado exige uma conversa.' : 'Trocar a sua linhagem?',
        `<p>${id === 'custom' ? 'Esta opção é para jogadores experientes. Converse com o narrador antes de escolher o nome, os dons e a fraqueza: a combinação pode ser recusada na avaliação.' : 'As escolhas do personagem permanecem, e os pontos de disciplinas serão devolvidos para você redistribuir.'}</p>${changing ? '<p>Você precisará escolher novamente os três dons e as linhas iniciais. A fraqueza da nova linhagem também será considerada.</p>' : ''}`,
        async () => apply(),
        {
          wide: true,
          saveLabel: id === 'custom' ? 'Entendi, quero continuar' : 'Trocar e devolver os pontos'
        }
      );
    else apply();
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
      atributes: `${this.plan.clan === 'nosferatu' ? 'Aparência permanece em 0 pela fraqueza Nosferatu. Os outros atributos começam em ' + c.attribute_base : 'Todos começam em ' + c.attribute_base}. Distribua mais ${c.initial.atributes} pontos; limite ${c.initial_max.atributes} nesta etapa.`,
      skills: `Distribua ${c.initial.skills} pontos entre talentos, perícias e conhecimentos. O limite inicial de cada habilidade é ${c.initial_max.skills}.`,
      precedents: `Distribua ${c.initial.precedents} pontos. Geração e Recursos já atualizam sua ficha automaticamente.`,
      disciplines: `Distribua exatamente ${c.initial.disciplines} pontos entre os três dons do seu clã. Uma disciplina pode ficar em zero.`
    };
    return `<header class="creation-section-heading"><span class="eyebrow">${bonus ? 'SEGUNDA DISTRIBUIÇÃO · BÔNUS' : 'PRIMEIRA DISTRIBUIÇÃO · BASE'}</span><h2 tabindex="-1">${traits ? 'Primeiro, suas qualidades e defeitos.' : bonus ? stage.label + '.' : 'Distribua seus ' + categories[category].toLowerCase() + '.'}</h2><p>${traits ? `Esta parte é opcional. Qualidades gastam bônus; defeitos acrescentam bônus e trazem consequências no jogo. Você pode seguir sem escolher nenhum.` : bonus ? `+1 nível custa ${c.bonus_costs[category]} PB. Limite ${c.max_level}, respeitando suas características. Você pode guardar bônus para a próxima categoria.` : instructions[category]}</p></header><ol class="creation-sequence" aria-label="Ordem desta distribuição">${sequence.map((s) => `<li ${s.index === this.step ? 'aria-current="step"' : ''}><button type="button" data-create-step="${s.index}" ${s.index >= this.step ? 'disabled' : ''}>${s.index < this.step ? icon('test') : `<span>${sequence.indexOf(s) + 1}</span>`}${s.phase === 'bonus' ? categories[s.key] : s.label}</button></li>`).join('')}</ol><div class="creation-budget ${available === 0 ? 'complete' : ''} ${available < 0 ? 'warning' : ''}"><div><span>${bonus ? 'BÔNUS RESTANTES NA RESERVA' : 'PONTOS RESTANTES NESTA ETAPA'}</span><strong>${available}</strong></div><div class="creation-budget-track" role="progressbar" aria-label="Pontos gastos" aria-valuemin="0" aria-valuemax="${total.budget}" aria-valuenow="${Math.min(total.budget, Math.max(0, total.used))}"><i style="width:${Math.min(100, total.budget ? (total.used / total.budget) * 100 : 100)}%"></i></div><p>${bonus ? `${c.bonus_points} iniciais + ${total.flaws} de defeitos − ${total.merits} em qualidades − ${total.used - total.merits} em níveis` : `${total.used} de ${total.budget} distribuídos · use todos para liberar a próxima etapa`}</p>${bonus && !traits ? `<small>Reserva única para atributos, habilidades, antecedentes e disciplinas.</small>` : ''}</div>${traits ? this.traits() : clanAttributeHint(this, category, bonus) + `<section class="creation-allocation"><div class="section-heading"><h3>${categories[category]}</h3><span class="tag">${bonus ? c.bonus_costs[category] + ' PB por +1' : 'Limite inicial ' + c.initial_max[category]}</span></div>${category === 'skills' ? `<nav class="creation-categories" aria-label="Grupo de habilidades">${skillKeys.map((key) => `<button type="button" data-creation-skill="${key}" aria-pressed="${key === this.skillCategory}">${labels[key]}</button>`).join('')}</nav><p class="hint">Talentos, perícias e conhecimentos usam a mesma reserva. ${bonus ? 'Todos podem chegar a ' + c.max_level + '.' : 'Os três grupos somam ' + c.initial.skills + ' pontos.'}</p>` : ''}${(category === 'skills' ? [this.skillCategory] : [category]).map((key) => `<section class="creation-trait-group"><div class="creation-trait-grid">${this.rows(key, bonus)}</div></section>`).join('')}</section>`}${
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
    const defs =
      key === 'disciplines'
        ? this.game[key].filter((d) => this.plan.disciplines.includes(d.id))
        : this.game[key];
    const g = guideForClan(selectedClan(this)),
      suggestions = key === 'atributes' ? g.attribute_tips : g.skill_tips;
    return defs
      .map((d) => {
        const v = allocationControl(this, key, d.id, bonus),
          suggested = suggestions?.some((name) => normalizedName(name) === normalizedName(d.name));
        return `<article class="creation-trait-card ${suggested ? 'suggested' : ''}"><div class="creation-trait-title"><strong>${esc(d.name)}</strong>${button(icon('rules'), 'creation-read', `data-key="${key}" data-id="${d.id}" aria-label="Consultar ${esc(d.name)}"`, 'icon-button')}</div>${suggested ? '<span class="creation-recommended">Um bom ponto de partida para este clã</span>' : ''}<p class="creation-trait-description">${esc((d.description || 'Consulte este traço para conhecer seu efeito.').slice(0, 150))}</p><div class="creation-points" aria-label="Nível ${v.value} de ${esc(d.name)}">${Array.from({ length: 5 }, (_, i) => `<i class="${i < v.value ? (i >= v.initial ? 'bonus' : 'filled') : ''} ${i >= v.cap ? 'beyond-base' : ''}"></i>`).join('')}</div><div class="creation-trait-controls"><button type="button" data-creation-change="-1" data-key="${key}" data-id="${d.id}" aria-label="Diminuir ${esc(d.name)}" ${v.canDecrease ? '' : 'disabled'}>−</button><output aria-live="polite">${v.value}</output><button type="button" data-creation-change="1" data-key="${key}" data-id="${d.id}" aria-label="Aumentar ${esc(d.name)}" aria-disabled="${!v.canIncrease}" aria-describedby="limit-${key}-${d.id}" class="${v.canIncrease ? '' : 'at-limit'}">+</button></div><small id="limit-${key}-${d.id}">${v.fixed !== undefined ? 'Valor fixo pela fraqueza ou característica.' : bonus ? `${v.initial} inicial + ${v.extra} comprado${v.grants ? ' + ' + v.grants + ' de qualidade' : ''} · ${v.cost} PB por nível` : `Até ${v.cap} nesta etapa · depois você poderá usar bônus.`}${key === 'precedents' && d.creation_effect === 'generation' ? ` · ${this.p.generation}ª geração` : key === 'precedents' && d.creation_effect === 'capital' ? ' · ' + realMoney(this.report.derived.capital) : ''}</small></article>`;
      })
      .join('');
  }
  traits() {
    const t = this.report.totals.bonus;
    return `<section class="creation-traits-shop"><div class="creation-optional-banner"><span class="tag">ESCOLHA OPCIONAL</span><h3>Uma personalidade não precisa de uma lista de vantagens.</h3><p>Escolha o que combina com a história. Se preferir, use “Continuar sem qualidades e defeitos” na barra abaixo.</p></div><div class="creation-trait-explanation"><button type="button" data-creation-kind="merit" aria-pressed="${this.kind === 'merit'}" class="merit"><span>${icon('powers')}</span><div><strong>Qualidades</strong><p>Vantagens que custam pontos bônus.</p></div><b>− PB</b></button><button type="button" data-creation-kind="flaw" aria-pressed="${this.kind === 'flaw'}" class="flaw"><span>${icon('blood')}</span><div><strong>Defeitos</strong><p>Limitações que rendem pontos e consequências.</p></div><b>+ PB</b></button></div><div class="creation-selected-traits"><div class="section-heading"><h3>Suas escolhas <small>${this.plan.traits.length}</small></h3><span>${this.report.derived.flaws}/${this.game.character_creation.guided.max_flaws} defeitos</span></div><p><strong>+${t.flaws} PB</strong> pelos defeitos · <strong>−${t.merits} PB</strong> pelas qualidades</p><div class="creation-chosen-chips">${
      this.plan.traits
        .map((row) => {
          const d = this.game.caracteristics.find((d) => d.id === row.id);
          return `<button type="button" class="${traitKind(d)}" data-creation-trait="${d.id}" aria-label="Retirar ${esc(d.name)}">${esc(d.name)} <b>${traitKind(d) === 'flaw' ? '+' : '−'}${traitPrice(d)}</b>${icon('close')}</button>`;
        })
        .join('') || '<span>Você ainda não escolheu nenhuma. Isso é permitido.</span>'
    }</div></div><div class="creation-trait-filters"><label class="search-field">${icon('search')}<input type="search" data-creation-search="traits" aria-label="Buscar qualidades e defeitos" placeholder="Pesquisar pelo nome ou efeito" value="${esc(this.query)}"></label><div class="creation-feature-tabs" role="tablist" aria-label="Tipo de característica">${[
      ['merit', 'Qualidades'],
      ['flaw', 'Defeitos'],
      ['selected', 'Escolhidos']
    ]
      .map(
        ([k, label]) =>
          `<button type="button" role="tab" aria-selected="${this.kind === k}" data-creation-kind="${k}">${label}</button>`
      )
      .join('')}</div></div><div id="creation-traits-list">${this.traitList()}</div></section>`;
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
    const size = 6,
      pages = Math.max(1, Math.ceil(entries.length / size));
    this.traitPage = Math.min(Math.max(0, this.traitPage), pages - 1);
    return `<div class="creation-catalog-summary"><span>${entries.length} ${this.kind === 'flaw' ? 'defeitos' : this.kind === 'merit' ? 'qualidades' : 'escolhas'} · página ${this.traitPage + 1}/${pages}</span><span>Saldo sempre visível na barra abaixo</span></div><div class="creation-trait-options">${
      entries
        .slice(this.traitPage * size, (this.traitPage + 1) * size)
        .map((d) => {
          const row = this.plan.traits.find((r) => r.id === d.id),
            flaw = traitKind(d) === 'flaw',
            cost = traitPrice(d),
            restriction = traitRestriction(this, d),
            locked =
              !row &&
              (restriction ||
                (flaw
                  ? this.report.derived.flaws >= this.game.character_creation.guided.max_flaws
                  : cost > remaining)),
            effects = effectDescriptions(d, this.game);
          return `<article class="creation-feature ${flaw ? 'flaw' : 'merit'} ${row ? 'selected' : ''}"><header><span class="creation-feature-type">${flaw ? icon('blood') + ' DEFEITO' : icon('powers') + ' QUALIDADE'}</span><span class="creation-feature-price">${flaw ? '+' : '−'}${cost}<small>PB</small></span><h4>${esc(d.name)}</h4></header><p>${esc(String(d.description || '').slice(0, 180))}${d.description?.length > 180 ? '…' : ''}</p>${effects.length ? '<small class="creation-automatic">' + icon('test') + ' Efeito aplicado na ficha</small>' : ''}<footer>${button('Entender o efeito', 'creation-read', `data-key="caracteristics" data-id="${d.id}"`, 'text-button')}<button type="button" class="button ${row ? 'ghost' : 'primary'}" data-creation-trait="${d.id}" ${locked ? 'disabled' : ''}>${row ? 'Retirar' : locked ? (restriction ? 'Indisponível para o clã' : flaw ? 'Limite de defeitos' : 'Faltam pontos') : flaw ? 'Assumir defeito' : 'Adicionar qualidade'}</button></footer>${locked ? `<small class="creation-feature-locked">${esc(restriction || (flaw ? 'Você já atingiu o máximo de defeitos por ficha.' : `Custa ${cost} PB e seu saldo é ${remaining} PB.`))}</small>` : ''}${row ? `<details class="creation-feature-details"><summary>Detalhar na história <small>Opcional</small></summary><label class="field"><span>Como isso aparece no personagem?</span><textarea data-creation-trait-notes="${d.id}" maxlength="3000" rows="2">${esc(row.notes)}</textarea></label></details>` : ''}</article>`;
        })
        .join('') ||
      '<div class="creation-empty-choices"><p>Nenhuma opção encontrada.</p><p class="hint">Tente outro termo ou continue sem escolher uma característica.</p></div>'
    }</div>${pages > 1 ? `<nav class="creation-catalog-pages" aria-label="Páginas de características"><button type="button" class="button ghost" data-trait-page="${this.traitPage - 1}" ${this.traitPage === 0 ? 'disabled' : ''}>Anterior</button><span>${this.traitPage + 1} de ${pages}</span><button type="button" class="button ghost" data-trait-page="${this.traitPage + 1}" ${this.traitPage === pages - 1 ? 'disabled' : ''}>Próximas opções ${icon('arrow')}</button></nav>` : ''}`;
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
    }</section>${clanWeakness(selectedClan(this), this.source.clan_flaw_detail, true)}${narrativeFields(this)}<details class="panel creation-narrative"><summary>Ambição e desejo <small>Opcional</small></summary><div class="form-grid">${area('ambition', 'Ambição (opcional)', this.source.aspirations?.ambition || '', 'maxlength="30000"')}${area('desire', 'Desejo (opcional)', this.source.aspirations?.desire || '', 'maxlength="30000"')}</div></details>${warnings.length ? `<details class="creation-warnings"><summary>Observações para você e o narrador (${warnings.length})</summary>${warnings.map((w) => `<p>${esc(w)}</p>`).join('')}</details>` : ''}`;
  }
  draw({ top = false } = {}) {
    const host = $('#main-content');
    const active = document.activeElement;
    const clanScroll = $('#creation-clan-rail')?.scrollLeft;
    const control = active?.dataset.creationChange
      ? { change: active.dataset.creationChange, key: active.dataset.key, id: active.dataset.id }
      : null;
    host.innerHTML = this.render();
    this.bind();
    if (clanScroll !== undefined && $('#creation-clan-rail'))
      $('#creation-clan-rail').scrollLeft = clanScroll;
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
        this.traitPage = 0;
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
      if (
        input.name === 'char' ||
        input.name === 'cla' ||
        input.name === 'biography' ||
        input.name === 'clan_flaw_detail'
      )
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
        this.selectClan(input.value);
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
        const bonus = creationStages[this.step].phase === 'bonus',
          key = b.dataset.key,
          id = Number(b.dataset.id),
          delta = Number(b.dataset.creationChange),
          v = allocationControl(this, key, id, bonus);
        if (delta > 0 && !v.canIncrease) {
          const note = $(`#limit-${key}-${id}`);
          if (note) {
            note.textContent = v.reason;
            note.classList.add('creation-limit-message');
          }
          toast(v.reason);
          playSound('error');
          return;
        }
        if (delta < 0 && !v.canDecrease) return;
        this.plan[bonus ? 'bonus' : 'initial'][key][id] = (bonus ? v.extra : v.initial) + delta;
        this.saveDraft();
        this.draw();
      } else if (b.dataset.creationSkill) {
        this.skillCategory = b.dataset.creationSkill;
        this.draw();
      } else if (b.dataset.clanPreview) {
        this.previewClan = b.dataset.clanPreview;
        this.clanTab = 'overview';
        const rail = $('#creation-clan-rail'),
          scroll = rail.scrollLeft;
        rail.innerHTML = clanRail(this);
        rail.scrollLeft = scroll;
        $('#creation-clan-spotlight').innerHTML = clanSpotlight(this);
      } else if (b.dataset.clanTab) {
        this.clanTab = b.dataset.clanTab;
        $('#creation-clan-spotlight').innerHTML = clanSpotlight(this);
        $(`[data-clan-tab="${this.clanTab}"]`)?.focus({ preventScroll: true });
      } else if (b.dataset.clanPower) {
        disciplineIntro(this, Number(b.dataset.clanPower));
      } else if (b.dataset.creationKind) {
        this.kind = b.dataset.creationKind;
        this.traitPage = 0;
        this.draw();
      } else if (b.dataset.traitPage !== undefined) {
        this.traitPage = Number(b.dataset.traitPage);
        $('#creation-traits-list').innerHTML = this.traitList();
        $('#creation-traits-list').scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (b.dataset.convictionExample !== undefined) {
        const text = convictionExamples[Number(b.dataset.convictionExample)];
        if (!this.source.moralityes.some((r) => r.description === text))
          this.source.moralityes.push({ id: this.source.moralityes.length, description: text });
        $('[name=convictions]').value = this.source.moralityes.map((r) => r.description).join('\n');
        this.saveDraft();
      } else if (b.dataset.action === 'creation-clan-select') {
        this.selectClan(b.dataset.clanId);
      } else if (b.dataset.action === 'creation-story-help') {
        storyHelper(this);
      } else if (b.dataset.action === 'creation-portrait') {
        portraitDialog(this.source, async (fields) => {
          Object.assign(this.source, fields);
          this.saveDraft();
          this.draw();
        });
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
