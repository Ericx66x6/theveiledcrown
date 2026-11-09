import { creationReport } from '../core/submissions-service.js';
import { esc, field, area, icon, button, select, toast, modal, download } from '../shared/ui.js';
import { labels } from '../shared/rules.js';
import { blank, clone, stats, validatePlayer } from '../core/model.js';
import { api, store } from './api.js';
export class SheetEditor {
  constructor({
    game,
    character,
    id,
    accountId,
    onSaved,
    onCancel,
    mode = 'admin',
    accountName = '',
    onSubmit = null,
    draftKey = ''
  }) {
    this.mode = mode;
    this.logMessage = '';
    this.submitOverride = onSubmit;
    this.game = game;
    this.existing = !!character;
    this.original = character ? clone(character) : null;
    this.p = character ? clone(character) : blank(game, id);
    this.key = `${store.current().id}.${accountId}.${mode}.${draftKey}`;
    this.makeAccount = mode === 'admin' && !character;
    if (mode === 'proposal') {
      this.p.player = accountName;
      this.p.xp = game.character_creation.starting_xp;
      this.p.money = game.character_creation.starting_money;
    }
    this.username = '';
    this.password = '';
    this.onSaved = onSaved;
    this.onCancel = onCancel;
    this.draftLoaded = false;
    if (!character) {
      try {
        const draft = store.drafts[this.key];
        if (draft?.p) {
          this.p = draft.p;
          this.username = draft.username || '';
          this.makeAccount = draft.makeAccount !== false;
          this.draftLoaded = true;
        }
      } catch {}
    }
    if (mode === 'proposal') {
      this.p.player = accountName;
      this.p.xp = game.character_creation.starting_xp;
      this.p.money = game.character_creation.starting_money;
    }
  }
  budgetMarkup() {
    const report = creationReport(this.p, this.game),
      entries = Object.entries(report.totals).filter(([key, v]) => v.budget !== null);
    return entries.length
      ? `<div class="creation-budget-live">${entries.map(([key, v]) => `<div class="${v.used > v.budget ? 'warning' : ''}"><span>${labels[key]}</span><strong>${v.used} / ${v.budget}</strong></div>`).join('')}</div>`
      : '';
  }
  render() {
    const p = this.p,
      max = this.game.maxvalue_generation[p.generation] || 5;
    const step = (n, title, description, content, id, open = true) =>
      `<details class="editor-section panel" id="${id}" ${open ? 'open' : ''}><summary><span class="editor-step">${n}</span><span><strong>${title}</strong><small>${description}</small></span><span class="section-chevron">+</span></summary><div class="editor-section-body">${content}</div></details>`;
    return `<div class="page-intro editor-intro"><span class="eyebrow">${this.mode === 'proposal' ? 'CRIE SEU PERSONAGEM' : this.mode === 'review' ? 'AVALIAÇÃO DO NARRADOR' : 'CONSELHO DO NARRADOR · TRANSCRIÇÃO DE FICHA'}</span><h1>${this.mode === 'proposal' ? 'Uma nova história começa com você.' : this.mode === 'review' ? 'Prepare a ficha para a mesa.' : this.existing ? 'Cada detalhe, no seu lugar.' : 'Do papel para a eternidade.'}</h1><p>${this.mode === 'proposal' ? 'Monte sua ficha e envie para o narrador. Ela fica pendente até ser aprovada.' : 'Preencha os valores da ficha. O JSON é gerado automaticamente.'}</p></div><div class="editor-tip">${icon('edit')}<span>${this.existing ? 'Editando a ficha #' + p.id + '. A versão anterior será preservada no histórico.' : this.draftLoaded ? 'Seu rascunho anterior foi recuperado. A senha deve ser preenchida novamente.' : 'Você escolhe cada valor. O ID aleatório e o arquivo JSON ficam por nossa conta.'}</span></div><div id="creation-budget-live">${this.mode !== 'admin' ? this.budgetMarkup() : ''}</div><div class="editor-jumps" aria-label="Seções do cadastro"><button type="button" data-editor-jump="editor-identity">01 Identidade</button><button type="button" data-editor-jump="editor-traits">02 Traços</button><button type="button" data-editor-jump="editor-powers">03 Poderes</button><button type="button" data-editor-jump="editor-story">04 História</button></div><form id="sheet-editor" novalidate>
    ${step('01', 'Identidade e acesso', 'Nome do personagem, jogador e linhagem.', `<div class="editor-id"><div><span class="eyebrow">ID ${this.existing ? 'DA FICHA' : 'ALEATÓRIO'}</span><strong id="draft-id">#${p.id}</strong></div>${!this.existing ? button(icon('refresh') + ' Gerar outro', 'editor-random', '', 'button ghost') : ''}</div><div class="form-grid">${field('char', 'Nome do personagem', p.char, 'text', 'required maxlength="150" placeholder="Ex.: Lucien Moreau"')}${field('player', 'Nome do jogador', p.player, 'text', 'required maxlength="150" placeholder="Nome de quem vai jogar"')}${field('cla', 'Nome do clã — texto livre', p.cla, 'text', 'required maxlength="80" placeholder="Escreva o clã"')}${field('generation', 'Geração', p.generation, 'number', 'required min="4" max="13" step="1" inputmode="numeric"')}${field('bloodpotency', 'Potência do sangue', p.bloodpotency, 'number', `required min="${this.game.bloodpotency_generation[p.generation]?.min || 0}" max="${this.game.bloodpotency_generation[p.generation]?.max || 10}" step="1" inputmode="numeric"`)}${field('xp', 'XP disponível', p.xp, 'number', 'required min="0" max="1000000" step="1" inputmode="numeric"')}${field('money', 'Recursos em reais', p.money, 'number', 'required min="0" max="1000000000" step="0.01" inputmode="decimal"')}</div>${this.mode === 'admin' && !this.existing ? `<div class="editor-access"><label class="checkbox"><input name="create_access" type="checkbox" ${this.makeAccount ? 'checked' : ''}><span><strong>Criar login para este jogador</strong><small>A conta ficará vinculada à nova ficha.</small></span></label><div class="form-grid" id="editor-access-fields" ${this.makeAccount ? '' : 'hidden'}>${field('username', 'Login do jogador', this.username, 'text', `${this.makeAccount ? 'required' : 'disabled'} minlength="3" maxlength="40" pattern="[a-zA-Z0-9_.-]+" autocomplete="off" autocapitalize="none" placeholder="Ex.: lucien"`)}${field('password', 'Senha inicial', this.password, 'password', `${this.makeAccount ? 'required' : 'disabled'} minlength="10" maxlength="128" autocomplete="new-password" placeholder="No mínimo 10 caracteres"`)}</div></div>` : '<p class="hint">O narrador gerencia os acessos e os vínculos da campanha.</p>'}`, 'editor-identity')}
    ${step(
      '02',
      'Atributos e habilidades',
      'Digite os níveis diretamente: Força 3, Destreza 2…',
      `<div class="editor-limit">Limite por geração: <strong id="editor-level-limit">${max}</strong><span>Valores inteiros, de 0 até o limite da linhagem.</span></div>${stats.map((key) => `<section class="editor-stat-group"><h3>${labels[key]}</h3><div class="editor-number-grid ${key === 'atributes' ? 'attributes-numbers' : ''}">${this.game[key].map((def) => field(`stat:${key}:${def.id}`, esc(def.name), p[key].find((x) => x.id === def.id)?.value || 0, 'number', `required min="0" max="${max}" step="1" inputmode="numeric" data-stat-input aria-label="${esc(labels[key] + ': ' + def.name)}"`)).join('')}</div></section>`).join('')}<section class="editor-stat-group"><h3>Estado inicial</h3><div class="editor-number-grid">${Object.entries(
        this.game.status_rules
      )
        .map(([key, rule]) =>
          field(
            `status:${key}`,
            labels[key],
            p.status[key] || 0,
            'number',
            `required min="${rule.min}" max="${rule.max}" step="1" inputmode="numeric"`
          )
        )
        .join('')}</div></section>`,
      'editor-traits'
    )}
    ${step(
      '03',
      'Dons, rituais e traços únicos',
      'Selecione os poderes que fazem parte deste personagem.',
      `${['disciplines', 'rituals', 'caracteristics']
        .map(
          (key) =>
            `<section class="editor-stat-group"><h3>${labels[key]}</h3><input class="catalog-search" data-catalog-filter="${key}" type="search" placeholder="Buscar ${labels[key].toLowerCase()}…" aria-label="Buscar ${labels[key].toLowerCase()}"><div class="catalog-list" data-catalog="${key}">${this.game[
              key
            ]
              .map((def) => {
                const entry = p[key].find((x) => x.id === def.id);
                return `<div class="catalog-row" data-catalog-name="${esc(def.name.toLowerCase())}"><label class="checkbox"><input name="power:${key}:${def.id}" type="checkbox" ${entry ? 'checked' : ''}><span><strong>${esc(def.name)}</strong><small>${esc(def.type || def.short_description || def.description?.slice(0, 110) || '')}${key === 'rituals' ? ' · Nível ' + def.nivel : ''}</small></span></label>${key === 'disciplines' ? `<label class="power-level-input"><span>Nível</span><input type="number" name="power-level:${def.id}" value="${entry?.nivel ?? 0}" min="0" max="${max}" step="1" inputmode="numeric" aria-label="Nível de ${esc(def.name)}" ${entry ? '' : 'disabled'}></label>` : ''}</div>`;
              })
              .join('')}</div></section>`
        )
        .join('')}`,
      'editor-powers',
      false
    )}
    ${step('04', 'História e convicções', 'Os campos narrativos, do seu jeito.', `${area('biography', 'História do personagem', p.biography, 'maxlength="30000" placeholder="Origem, aparência, personalidade e segredos…"')}${area('ambition', 'Ambição', p.aspirations?.ambition || '', 'maxlength="30000"')}${area('desire', 'Desejo', p.aspirations?.desire || '', 'maxlength="30000"')}${area('convictions', 'Convicções pessoais — uma por linha', p.moralityes.map((x) => x.description).join('\n'), 'maxlength="10000"')}<p class="hint">Domínios, aliados, contatos, lacaios e inventário podem ser preenchidos na ficha depois do cadastro.</p>`, 'editor-story', false)}
    ${this.mode === 'admin' && this.existing ? `<section class="panel edit-commit"><span class="eyebrow">MENSAGEM DO NARRADOR</span><h3>O que mudou nesta ficha?</h3>${area('log_message', 'Comentário no histórico (opcional)', this.logMessage, 'maxlength="2000" placeholder="Ex.: Ajustei Destreza para 3 após revisar a ficha de papel."')}</section>` : ''}
    <p class="form-error editor-error" id="editor-error" role="alert"></p><div class="editor-savebar"><div><span class="save-dot"></span><span id="draft-state">${this.existing ? 'Ajustes diretos do narrador' : this.draftLoaded ? 'Rascunho recuperado nesta sessão' : 'Rascunho nesta aba · cadastre para exportar'}</span></div><div>${button('Cancelar', 'editor-cancel', '', 'button ghost')}${button('Prévia JSON', 'editor-preview', '', 'button ghost')}<button class="button primary" type="submit">${icon('save')} ${this.mode === 'proposal' ? 'Enviar para avaliação' : this.mode === 'review' ? 'Salvar ajustes da proposta' : this.existing ? 'Salvar ficha' : 'Cadastrar jogador'}</button></div></div></form>`;
  }
  saveDraft() {
    document.body.dataset.pendingEditor = 'true';
    if (this.existing) return;
    try {
      store.drafts[this.key] = clone({
        p: this.p,
        username: this.username,
        makeAccount: this.makeAccount
      });
      const label = document.querySelector('#draft-state');
      if (label) label.textContent = 'Rascunho nesta aba · cadastre para exportar';
    } catch {
      const label = document.querySelector('#draft-state');
      if (label) label.textContent = 'Rascunho nesta aba · armazenamento indisponível';
    }
  }
  async clearDraft() {
    delete document.body.dataset.pendingEditor;
    if (this.existing) return;
    try {
      delete store.drafts[this.key];
    } catch {}
  }
  updateField(input) {
    const name = input.name;
    if (!name) return;
    if (name === 'log_message') {
      this.logMessage = input.value;
      return;
    }
    if (name === 'create_access') {
      this.makeAccount = input.checked;
      const container = document.querySelector('#editor-access-fields');
      container.hidden = !input.checked;
      container.querySelectorAll('input').forEach((i) => {
        i.disabled = !input.checked;
        i.required = input.checked;
      });
    } else if (name === 'username') this.username = input.value;
    else if (name === 'password') this.password = input.value;
    else if (name.startsWith('stat:')) {
      const [, key, id] = name.split(':');
      let entry = this.p[key].find((x) => x.id === Number(id));
      if (!entry) {
        entry = { id: Number(id), value: 0 };
        this.p[key].push(entry);
      }
      entry.value = input.value === '' ? NaN : Number(input.value);
    } else if (name.startsWith('status:')) this.p.status[name.split(':')[1]] = Number(input.value);
    else if (name.startsWith('power:')) {
      const [, key, id] = name.split(':'),
        entry = this.p[key].find((x) => x.id === Number(id));
      if (input.checked && !entry)
        this.p[key].push({ id: Number(id), ...(key === 'disciplines' ? { nivel: 1 } : {}) });
      if (!input.checked) this.p[key] = this.p[key].filter((x) => x.id !== Number(id));
      if (key === 'disciplines') {
        const level = document.querySelector(`[name="power-level:${id}"]`);
        level.disabled = !input.checked;
        level.required = input.checked;
        if (input.checked) this.p[key].find((x) => x.id === Number(id)).nivel = Number(level.value);
      }
    } else if (name.startsWith('power-level:')) {
      const entry = this.p.disciplines.find((x) => x.id === Number(name.split(':')[1]));
      if (entry) entry.nivel = Number(input.value);
    } else if (name === 'ambition' || name === 'desire') {
      this.p.aspirations[name] = input.value;
    } else if (name === 'convictions')
      this.p.moralityes = input.value
        .split('\n')
        .filter((x) => x.trim())
        .map((description, id) => ({ id, description }));
    else this.p[name] = input.type === 'number' ? Number(input.value) : input.value;
    if (name === 'generation' && this.game.bloodpotency_generation[this.p.generation]) {
      const range = this.game.bloodpotency_generation[this.p.generation],
        bp = document.querySelector('[name="bloodpotency"]');
      bp.min = range.min;
      bp.max = range.max;
      if (this.p.bloodpotency < range.min || this.p.bloodpotency > range.max) {
        this.p.bloodpotency = range.min;
        bp.value = range.min;
      }
      const maximum = this.game.maxvalue_generation[this.p.generation];
      document.querySelector('#editor-level-limit').textContent = maximum;
      document
        .querySelectorAll('[data-stat-input],.power-level-input input')
        .forEach((input) => (input.max = maximum));
    }
    if (name !== 'password') this.saveDraft();
    const budgets = document.querySelector('#creation-budget-live');
    if (budgets && this.mode !== 'admin') budgets.innerHTML = this.budgetMarkup();
  }
  bind() {
    const form = document.querySelector('#sheet-editor');
    form.oninput = (event) => {
      const input = event.target;
      if (input.dataset.catalogFilter) {
        const key = input.dataset.catalogFilter;
        form
          .querySelectorAll(`[data-catalog="${key}"] [data-catalog-name]`)
          .forEach(
            (row) => (row.hidden = !row.dataset.catalogName.includes(input.value.toLowerCase()))
          );
        return;
      }
      this.updateField(input);
    };
    if (this.mode === 'proposal') {
      for (const name of ['player', 'xp', 'money']) {
        const input = form.querySelector(`[name="${name}"]`);
        if (input) input.readOnly = true;
      }
    }
    document.querySelectorAll('[data-editor-jump]').forEach(
      (control) =>
        (control.onclick = () => {
          const section = document.getElementById(control.dataset.editorJump);
          section.open = true;
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
    );
    form.querySelector('[data-action="editor-cancel"]').onclick = (event) => {
      event.stopPropagation();
      delete document.body.dataset.pendingEditor;
      this.onCancel();
    };
    form.querySelector('[data-action="editor-preview"]').onclick = (event) => {
      event.stopPropagation();
      try {
        const p = validatePlayer(this.p, this.game);
        modal(
          'Prévia do JSON',
          area(
            'json',
            'Ficha gerada automaticamente',
            JSON.stringify(p, null, 2),
            'readonly spellcheck="false"'
          ),
          async () => download(`${p.id}.json`, p),
          { wide: true, saveLabel: 'Baixar JSON' }
        );
      } catch (error) {
        toast(error.message, true);
      }
    };
    const random = form.querySelector('[data-action="editor-random"]');
    if (random)
      random.onclick = async (event) => {
        event.stopPropagation();
        try {
          const result = await api('/api/characters/new-id');
          this.p.id = result.id;
          document.querySelector('#draft-id').textContent = '#' + result.id;
          this.saveDraft();
        } catch (error) {
          toast(error.message, true);
        }
      };
    form.onsubmit = async (event) => {
      event.preventDefault();
      const invalid = Array.from(form.elements).find((i) => i.willValidate && !i.checkValidity());
      if (invalid) {
        const parent = invalid.closest('details');
        if (parent) parent.open = true;
        invalid.reportValidity();
        return;
      }
      const submit = event.submitter;
      if (submit.disabled) return;
      submit.disabled = true;
      document.querySelector('#editor-error').textContent = '';
      try {
        const p = validatePlayer(this.p, this.game);
        const access = this.makeAccount
          ? { username: this.username, password: this.password }
          : null;
        const result = this.submitOverride
          ? await this.submitOverride(p)
          : await api(this.existing ? `/api/characters/${p.id}/full` : '/api/admin/characters', {
              method: this.existing ? 'PUT' : 'POST',
              data: this.existing
                ? { revision: this.original._revision, character: p, log_message: this.logMessage }
                : { character: p, access }
            });
        await this.clearDraft();
        await this.onSaved(result, access?.username);
      } catch (error) {
        document.querySelector('#editor-error').textContent = error.message;
        document
          .querySelector('#editor-error')
          .scrollIntoView({ behavior: 'smooth', block: 'center' });
      } finally {
        submit.disabled = false;
      }
    };
  }
}
