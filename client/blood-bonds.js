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
  empty,
  dots
} from '../shared/ui.js';
import { api } from './api.js';
import { readImage } from './media.js';
import { withLoading } from './loading.js';
import { bloodStages } from '../core/blood-bond-state.js';
const directionName = (b) =>
  b.direction === 'bound_to' ? 'AS CORRENTES SOBRE MIM' : 'SOB MEU DOMÍNIO';
export function bloodBondsPage(ctx) {
  const p = ctx.player();
  if (!p)
    return empty(
      'Abra uma ficha de personagem.',
      'Os vínculos de sangue fazem parte de cada história.'
    );
  const filter = ctx.state.bondFilter || 'all',
    all = p.blood_bonds || [],
    entries = all.filter((b) => filter === 'all' || b.direction === filter);
  return `<header class="page-intro bonds-intro"><span class="eyebrow">VÍNCULOS DE SANGUE</span><h1>Há promessas que correm nas veias.</h1><p>Registre quem prende a sua vontade e quem está ligado a você. O tempo do vínculo acompanha o roleplay, marcado por você e ajustável pelo narrador.</p></header><section class="blood-bonds-banner"><div class="bond-banner-emblem">${icon('blood')}<span>⛓</span></div><div><span class="eyebrow">${esc(p.char)}</span><h2>O sangue cria suas próprias correntes.</h2><p>0 significa vínculo rompido. Os laços ativos vão de 1 a 5. Marque o desgaste quando a história justificar e confirme para perder um nível.</p></div>${button('Registrar vínculo ' + icon('plus'), 'bond-new', p.archived ? 'disabled' : '', 'button primary')}</section><div class="chronicle-filters">${[
    ['all', 'Todos os vínculos'],
    ['bound_to', 'Quem me prende'],
    ['holds', 'Quem eu prendo']
  ]
    .map(([k, l]) =>
      button(
        l,
        'bond-filter',
        `data-key="${k}" aria-pressed="${filter === k}"`,
        filter === k ? 'button primary' : 'button ghost'
      )
    )
    .join('')}</div><div class="blood-bonds-grid">${
    entries
      .map((b) => {
        const stage = bloodStages.find((s) => s.id === b.stage);
        return `<article class="blood-bond-card ${b.direction} ${b.level === 0 ? 'broken' : ''}"><div class="bond-portrait">${b.image ? `<img src="${esc(b.image)}" alt="${esc(b.name)}">` : `<span>${icon(b.direction === 'bound_to' ? 'lock' : 'accounts')}</span>`}<span class="bond-portrait-chain" aria-hidden="true">⛓</span><span class="tag">${b.level ? `LAÇO ${b.level} / 5` : 'VÍNCULO ROMPIDO'}</span></div><div class="bond-card-body"><span class="eyebrow">${directionName(b)}</span><h2>${esc(b.name)}</h2><div class="bond-level-display">${dots(b.level)}<span>${b.level ? `Nível ${b.level}` : 'Livre desta corrente'}</span></div><p class="memory-excerpt">${esc(b.description || 'Uma ligação que ainda precisa ter sua história contada.')}</p><div class="bond-state ${b.stage}"><span>${icon(b.stage === 'fading' ? 'clock' : 'blood')}</span><div><strong>${b.level ? stage.name : 'O sangue silenciou'}</strong><small>${b.level ? stage.plain : 'Você pode reatar o vínculo se a história permitir.'}</small></div></div>${b.last_scene ? `<p class="bond-last-scene"><span>ÚLTIMO CONTATO DE SANGUE</span>${esc(b.last_scene)}</p>` : ''}<div class="bond-card-actions">${button('Abrir vínculo', 'bond-open', `data-id="${b.id}"`, 'button ghost')}${button('Editar', 'bond-edit', `data-id="${b.id}" ${p.archived ? 'disabled' : ''}`, 'text-button')}</div></div></article>`;
      })
      .join('') ||
    empty(
      'Nem toda corrente é visível.',
      'Registre um vínculo para acompanhar sua força e o desgaste ao longo da história.'
    )
  }</div>`;
}
function editBond(ctx, entry) {
  const p = ctx.player();
  modal(
    entry ? 'A forma das suas correntes' : 'Um novo vínculo de sangue',
    `<div class="form-grid">${field('name', 'Com quem é o vínculo?', entry?.name || '', 'text', 'required maxlength="150" placeholder="Nome do personagem ou NPC"')}${select(
      'direction',
      'Quem está ligado a quem?',
      [
        { value: 'bound_to', label: 'Eu estou ligado a essa pessoa' },
        { value: 'holds', label: 'Essa pessoa está ligada a mim' }
      ],
      entry?.direction || 'bound_to'
    )}<label class="field"><span>Força do laço</span><select name="level">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === (entry?.level ?? 1) ? 'selected' : ''}>${n === 0 ? '0 · Vínculo rompido' : n + ' · ' + ['', 'O primeiro chamado', 'Uma presença persistente', 'Correntes no sangue', 'Uma vontade profunda', 'Domínio absoluto'][n]}</option>`).join('')}</select></label>${select(
      'stage',
      'Como o sangue está agora?',
      bloodStages.map((s) => ({ value: s.id, label: s.name + ' · ' + s.plain })),
      entry?.stage || 'fervor'
    )}${area('description', 'A história deste vínculo', entry?.description || '', 'maxlength="15000" placeholder="Como surgiu? O que você sente? Quais promessas e conflitos existem?"')}${area('last_scene', 'Último contato de sangue', entry?.last_scene || '', 'maxlength="3000" placeholder="Ex.: Depois da conversa no refúgio, antes da visita ao porto."')}<label class="field full"><span>Retrato (opcional)</span><input type="file" name="image_file" accept="image/jpeg,image/png,image/webp"></label>${entry?.image ? `<figure class="document-edit-image"><img src="${esc(entry.image)}" alt="Retrato atual"><label class="checkbox"><input type="checkbox" name="remove_image">Remover o retrato</label></figure>` : ''}</div><p class="hint">As palavras marcam o tempo narrativo. O relógio real não enfraquece o laço automaticamente.</p>`,
    async (form) => {
      await withLoading(async () => {
        const file = form.get('image_file'),
          image = file?.size
            ? (await readImage(file)).image
            : form.has('remove_image')
              ? ''
              : entry?.image || '';
        await api(`/api/characters/${p.id}/blood-bonds${entry ? '/' + entry.id : ''}`, {
          method: entry ? 'PATCH' : 'POST',
          data: {
            name: form.get('name'),
            direction: form.get('direction'),
            level: Number(form.get('level')),
            stage: form.get('stage'),
            description: form.get('description'),
            last_scene: form.get('last_scene'),
            image,
            character_revision: p._revision,
            ...(entry ? { revision: entry._revision } : {}),
            confirmed: true
          }
        });
        await ctx.refresh();
      }, 'Registrando o vínculo…');
      toast('Vínculo registrado na história.');
    },
    { wide: true, saveLabel: entry ? 'Confirmar alteração' : 'Firmar vínculo' }
  );
}
function openBond(ctx, b) {
  const stage = bloodStages.find((s) => s.id === b.stage);
  modal(
    b.name,
    `<article class="bond-detail ${b.direction}">${b.image ? `<img class="bond-detail-portrait" src="${esc(b.image)}" alt="${esc(b.name)}">` : ''}<span class="eyebrow">${directionName(b)}</span><div class="bond-detail-level"><strong>${b.level}</strong><span>NÍVEL DO LAÇO</span>${dots(b.level)}</div><p class="prose">${esc(b.description || 'A história desta ligação ainda não foi registrada.')}</p><section class="bond-stage-guide"><h3>${b.level ? stage.name : 'Vínculo rompido'}</h3><p>${b.level ? stage.description : 'A corrente perdeu sua força. Um novo encontro de sangue pode reatar o vínculo.'}</p><div class="bond-stage-track">${bloodStages.map((s) => `<button type="button" data-stage="${s.id}" class="${s.id === b.stage ? 'selected' : ''}" aria-pressed="${s.id === b.stage}"><i></i><strong>${s.name}</strong><small>${s.plain}</small></button>`).join('')}</div></section>${b.last_scene ? `<div class="memory-review-note"><strong>Último contato de sangue</strong><p class="prose">${esc(b.last_scene)}</p></div>` : ''}<div class="chronicle-actions">${button(b.level ? 'Renovar o sangue' : 'Reatar este vínculo', 'bond-modal-renew', '', 'button primary')}${b.level && b.stage === 'fading' ? button('Enfraquecer um nível', 'bond-modal-weaken', '', 'button ghost') : ''}${button('Editar registro', 'bond-modal-edit', '', 'button ghost')}${button('Apagar', 'bond-modal-delete', '', 'text-button danger')}</div></article>`,
    null,
    { wide: true }
  );
  if (ctx.player().archived) {
    $('#modal')
      .querySelectorAll('.bond-detail button')
      .forEach((b) => (b.disabled = true));
    return;
  }
  $('#modal')
    .querySelectorAll('[data-stage]')
    .forEach(
      (control) =>
        (control.onclick = () => {
          const selected = bloodStages.find((s) => s.id === control.dataset.stage);
          modal(
            'Marcar ' + selected.name + '?',
            `<p>${selected.description}</p><p>Esta marcação acompanha a história. O nível continua em ${b.level} até você confirmar um desgaste ou reforço.</p>`,
            async () => {
              await api(`/api/characters/${ctx.player().id}/blood-bonds/${b.id}`, {
                method: 'PATCH',
                data: {
                  ...b,
                  stage: selected.id,
                  revision: b._revision,
                  character_revision: ctx.player()._revision,
                  confirmed: true
                }
              });
              await ctx.refresh();
              toast('Estado do sangue atualizado.');
            },
            { saveLabel: 'Confirmar estado' }
          );
        })
    );
  $('#modal [data-action=bond-modal-edit]').onclick = () => editBond(ctx, b);
  $('#modal [data-action=bond-modal-renew]').onclick = () => renewBond(ctx, b);
  $('#modal [data-action=bond-modal-weaken]')?.addEventListener('click', () => weakenBond(ctx, b));
  $('#modal [data-action=bond-modal-delete]').onclick = () =>
    modal(
      'Apagar este vínculo?',
      '<p>O registro será removido da ficha. Uma entrada permanecerá no histórico para o narrador.</p>',
      async () => {
        await api(`/api/characters/${ctx.player().id}/blood-bonds/${b.id}`, {
          method: 'DELETE',
          data: {
            revision: b._revision,
            character_revision: ctx.player()._revision,
            confirmed: true
          }
        });
        await ctx.refresh();
        toast('Registro removido.');
      },
      { saveLabel: 'Apagar vínculo' }
    );
}
function renewBond(ctx, b) {
  modal(
    b.level ? 'O sangue volta a chamar.' : 'Reatar as correntes?',
    `${b.direction === 'bound_to' ? '<p>A presença dessa pessoa volta a ocupar o seu sangue.</p>' : '<p>Seu sangue reacende a ligação sobre essa pessoa.</p>'}${area('last_scene', 'Em que momento isso aconteceu?', b.last_scene || '', 'maxlength="3000" placeholder="Descreva o encontro, sem precisar contar dias."')}<label class="checkbox"><input type="checkbox" name="strengthen" ${b.level === 0 ? 'checked disabled' : ''}>${b.level === 0 ? 'Reatar no nível 1' : b.level < 5 ? 'Reforçar o laço em um nível' : 'O laço já está no nível máximo'}</label><p class="hint">O estado volta a Fervor rubro. Marque o reforço somente se ele aconteceu no roleplay.</p>`,
    async (f) => {
      await api(`/api/characters/${ctx.player().id}/blood-bonds/${b.id}/renew`, {
        method: 'POST',
        data: {
          revision: b._revision,
          character_revision: ctx.player()._revision,
          last_scene: f.get('last_scene'),
          strengthen: b.level === 0 || f.has('strengthen'),
          confirmed: true
        }
      });
      await ctx.refresh();
    },
    { saveLabel: 'Confirmar encontro de sangue' }
  );
}
function weakenBond(ctx, b) {
  modal(
    'As correntes estão cedendo.',
    `<div class="bond-weakening-preview"><strong>${b.level}</strong>${icon('arrow')}<strong>${b.level - 1}</strong></div><p>Confirme que o tempo narrativo sem beber desse sangue justifica perder um nível. ${b.level === 1 ? 'O vínculo ficará rompido.' : 'Depois, marque novamente o estado conforme a história continuar.'}</p>`,
    async () => {
      await api(`/api/characters/${ctx.player().id}/blood-bonds/${b.id}/weaken`, {
        method: 'POST',
        data: { revision: b._revision, character_revision: ctx.player()._revision, confirmed: true }
      });
      await ctx.refresh();
    },
    { saveLabel: 'Confirmar desgaste do laço' }
  );
}
export async function bloodBondAction(action, data, ctx) {
  if (!action.startsWith('bond-')) return false;
  if (action === 'bond-filter') {
    ctx.state.bondFilter = data.key;
    ctx.draw();
    return true;
  }
  if (action === 'bond-new') {
    editBond(ctx);
    return true;
  }
  const bond = ctx.player()?.blood_bonds?.find((b) => b.id === data.id);
  if (!bond) return true;
  if (action === 'bond-edit') editBond(ctx, bond);
  else if (action === 'bond-open') openBond(ctx, bond);
  return true;
}
