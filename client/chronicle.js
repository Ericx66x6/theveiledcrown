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
  date,
  empty
} from '../shared/ui.js';
import { api } from './api.js';
import { readImage } from './media.js';
import { withLoading } from './loading.js';
import {
  recapFields,
  recapQuality,
  feedbackKinds,
  documentKinds
} from '../core/chronicle-state.js';

const statusLabels = {
  draft: 'Rascunho',
  submitted: 'Aguardando leitura',
  changes_requested: 'Completar o relato',
  reviewed: 'Lido pelo narrador',
  rewarded: 'Recompensado'
};
const author = (ctx, id) =>
  ctx.state.social?.members?.find((a) => a.id === id) ||
  ctx.state.accounts?.find((a) => a.id === id) || { display_name: 'Jogador removido' };
function byline(ctx, entry) {
  const a = author(ctx, entry.created_by);
  return `<div class="chronicle-byline"><span class="avatar small">${a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc(a.display_name.slice(0, 1))}</span><span>${esc(a.display_name)}<small>${date(entry.created_at)}</small></span></div>`;
}
const intro = (eyebrow, title, description) =>
  `<header class="page-intro chronicle-intro"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></header>`;
const tag = (entry) =>
  `<span class="chronicle-status ${entry.status}">${statusLabels[entry.status]}</span>`;
export function chronicleRows(ctx, key) {
  return ctx.state.campaign?.[key] || [];
}
function recap(ctx) {
  return chronicleRows(ctx, 'recaps').find((r) => r.id === ctx.state.recapId);
}
function doc(ctx) {
  return chronicleRows(ctx, 'documents').find((d) => d.id === ctx.state.documentId);
}
function ownCharacters(ctx, id = ctx.state.account.id) {
  if (!ctx.admin()) return ctx.state.players.filter((p) => !p.archived);
  const account = ctx.state.accounts.find((a) => a.id === id);
  return ctx.state.players.filter((p) => !p.archived && account?.character_ids.includes(p.id));
}
export function recapsPage(ctx) {
  const s = ctx.state,
    all = chronicleRows(ctx, 'recaps'),
    filter = s.recapFilter || 'all';
  const rows = all
    .filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!s.recapCharacter || String(r.character_id) === String(s.recapCharacter))
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const characters = ctx.admin() ? s.players : ownCharacters(ctx);
  return (
    intro(
      'ONDE PARAMOS?',
      'Toda história merece ser lembrada.',
      ctx.admin()
        ? 'Leia o caminho de cada personagem, peça mais contexto e reconheça os relatos que ajudam a continuar a crônica.'
        : 'Registre a sua última cena, as escolhas que importaram e o próximo passo. Cada personagem tem a própria memória.'
    ) +
    `<div class="chronicle-callout"><span class="chronicle-callout-icon">${icon('notes')}</span><div><strong>Memória que faz a história continuar.</strong><p>Um relato completo pode receber <b>+1 XP</b> na ficha, após a avaliação do narrador. Os quatro tópicos ajudam a contar o que aconteceu; a utilidade do conteúdo é avaliada na leitura.</p></div>${ctx.admin() ? button('Guia dos relatos', 'recap-settings', '', 'button ghost') : button('Registrar onde parei ' + icon('plus'), 'recap-new', characters.length ? '' : 'disabled', 'button primary')}</div><div class="chronicle-toolbar">${select('recap_character', 'História', [{ value: '', label: ctx.admin() ? 'Todos os personagens' : 'Minhas histórias' }, ...characters.map((p) => ({ value: p.id, label: p.char }))], s.recapCharacter || '')}<div class="chronicle-filters">${[
      ['all', 'Todos'],
      ['submitted', 'Para avaliar'],
      ['changes_requested', 'Complementar'],
      ['rewarded', 'Recompensados'],
      ['draft', 'Rascunhos']
    ]
      .map(([k, label]) =>
        button(
          label,
          'recap-filter',
          `data-key="${k}" aria-pressed="${filter === k}"`,
          filter === k ? 'button primary' : 'button ghost'
        )
      )
      .join(
        ''
      )}</div></div><div class="chronicle-grid">${rows.map((r) => `<article class="memory-card"><div class="memory-card-top"><span class="memory-number">${icon('notes')}</span>${tag(r)}</div><span class="eyebrow">${esc(r.character_name)}</span><h2>${esc(r.title)}</h2><p class="memory-excerpt">${esc(r.scene || 'Um capítulo ainda está ganhando forma.')}</p>${byline(ctx, r)}<footer><span class="memory-reward">${r.reward ? `+${r.reward.xp} XP concedido` : r.status === 'draft' ? 'Rascunho salvo' : `${recapQuality(r, s.game.chronicle.recap_min_words).total} palavras registradas`}</span>${button('Abrir relato ' + icon('arrow'), 'recap-open', `data-id="${r.id}"`, 'button ghost')}</footer></article>`).join('') || empty('A próxima lembrança começa aqui.', 'Registre a cena em que seu personagem parou e ajude a manter a história viva.')}</div>`
  );
}
function qualityMarkup(entry, ctx) {
  const q = recapQuality(entry, ctx.state.game.chronicle.recap_min_words);
  return `<div class="memory-guide-top"><strong>Seu relato ganha forma</strong><span>${q.total} / ${q.minimum} palavras</span></div><div class="memory-guide-bar"><i style="width:${Math.min(100, (q.total / q.minimum) * 100)}%"></i></div><ul>${q.sections.map((f) => `<li class="${f.complete ? 'complete' : ''}">${icon(f.complete ? 'test' : 'notes')} ${f.label}<small>${f.count}/${f.min}</small></li>`).join('')}</ul><p>${q.total >= q.minimum && q.distinct < 22 ? 'Inclua informações variadas; repetir as mesmas palavras não conta a história.' : 'O guia confere a estrutura. O narrador avalia os detalhes e decide sobre o XP.'}</p>`;
}
export function recapEditorPage(ctx) {
  const draft = ctx.state.recapDraft;
  if (!draft)
    return empty(
      'Escolha uma história.',
      'Abra um rascunho ou inicie um relato.',
      button('Ver relatos', 'nav-recaps', '', 'button primary')
    );
  return (
    intro('UM CAPÍTULO DA SUA MEMÓRIA', 'Onde sua história ficou?', esc(draft.character_name)) +
    `<form id="recap-editor" class="memory-editor" data-dirty="false"><div class="memory-fields">${field('title', 'Um nome para este capítulo', draft.title || '', 'text', 'maxlength="200" placeholder="A carta sob o cais"')}${recapFields.map((f, i) => `<section class="memory-question"><span class="memory-step">0${i + 1}</span><div><label for="recap-${f.key}">${f.label}</label><p>${f.hint}</p><textarea id="recap-${f.key}" name="${f.key}" rows="${f.key === 'events' ? 7 : 4}" maxlength="${f.max}" placeholder="${f.key === 'scene' ? 'Ex.: Na saída do armazém, com a informante, enquanto a guarda se aproximava…' : ''}">${esc(draft[f.key] || '')}</textarea><small>Mínimo de ${f.min} palavras neste tópico.</small></div></section>`).join('')}${field('cast', 'Pessoas envolvidas (opcional)', draft.cast || '', 'text', 'maxlength="1500" placeholder="Nomes que você vai querer lembrar"')}${draft.review_note ? `<aside class="memory-review-note"><strong>O narrador pediu mais contexto</strong><p class="prose">${esc(draft.review_note)}</p></aside>` : ''}<p class="form-error" id="recap-error" role="alert"></p></div><aside class="memory-guide"><div data-recap-quality>${qualityMarkup(draft, ctx)}</div><div class="memory-editor-actions"><button class="button ghost" type="submit" name="intent" value="draft">${icon('save')} Salvar rascunho</button><button class="button primary" type="submit" name="intent" value="submit" data-recap-submit ${recapQuality(draft, ctx.state.game.chronicle.recap_min_words).complete ? '' : 'disabled'}>${icon('arrow')} Enviar para leitura</button>${button('Voltar aos relatos', 'recap-editor-exit', '', 'text-button')}</div><p class="hint">Salve o rascunho para continuar depois, inclusive em outro dispositivo.</p></aside></form>`
  );
}
export function recapDetailPage(ctx) {
  const r = recap(ctx);
  if (!r)
    return empty(
      'Relato indisponível.',
      'Ele pode ter sido removido ou pertencer a outra história.',
      button('Voltar', 'nav-recaps', '', 'button ghost')
    );
  const canEdit =
    !ctx.admin() &&
    r.created_by === ctx.state.account.id &&
    ['draft', 'changes_requested'].includes(r.status);
  const canReview = ctx.admin() && ['submitted', 'reviewed'].includes(r.status);
  return `<article class="memory-document">${intro('MEMÓRIAS DE ' + esc(r.character_name), esc(r.title), 'Um registro para reencontrar o fio da história.')}<div class="chronicle-detail-meta">${byline(ctx, r)}${tag(r)}</div>${recapFields.map((f, i) => `<section class="memory-chapter"><span>0${i + 1}</span><div><h2>${f.label}</h2><p class="prose">${esc(r[f.key] || 'Ainda não registrado.')}</p></div></section>`).join('')}${r.cast ? `<section class="memory-cast"><span class="eyebrow">PESSOAS ENVOLVIDAS</span><p>${esc(r.cast)}</p></section>` : ''}${r.review_note ? `<aside class="memory-review-note"><strong>Palavras do narrador</strong><p class="prose">${esc(r.review_note)}</p></aside>` : ''}${r.reward ? `<div class="memory-reward-receipt">${icon('powers')}<div><strong>Uma boa memória merece reconhecimento.</strong><p>+1 XP entregue a ${esc(r.reward.character_name)} · ${date(r.reward.at)}</p></div></div>` : ''}<div class="chronicle-actions">${canEdit ? button('Continuar escrevendo', 'recap-edit', `data-id="${r.id}"`, 'button primary') : ''}${canReview ? button('Reconhecer com +1 XP', 'recap-review', `data-id="${r.id}" data-outcome="reward"`, 'button primary') + button('Pedir complemento', 'recap-review', `data-id="${r.id}" data-outcome="changes"`, 'button ghost') + button('Marcar como lido', 'recap-review', `data-id="${r.id}" data-outcome="review"`, 'button ghost') : ''}${ctx.admin() || (!r.reward && r.created_by === ctx.state.account.id) ? button('Apagar relato', 'recap-delete', `data-id="${r.id}"`, 'text-button danger') : ''}</div></article>`;
}
export function feedbackPage(ctx) {
  const all = chronicleRows(ctx, 'feedbacks'),
    filter = ctx.state.feedbackFilter || 'all';
  const rows = all
    .filter((f) => filter === 'all' || f.kind === filter)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    intro(
      'ECOS DA MESA',
      'A sua voz também molda a crônica.',
      ctx.admin()
        ? 'Leia o que funcionou, o que precisa mudar e reconheça contribuições úteis com XP.'
        : 'Conte o que você sentiu na história, o que gostou, uma ideia ou um problema que encontrou. Sua mensagem é reservada ao narrador.'
    ) +
    `<div class="chronicle-callout"><span class="chronicle-callout-icon">${icon('social')}</span><div><strong>Uma observação específica vale mais que um texto enorme.</strong><p>Conte o que aconteceu e por que isso importa. O narrador pode responder e conceder XP pela contribuição.</p></div>${!ctx.admin() ? button('Enviar feedback ' + icon('plus'), 'feedback-new', '', 'button primary') : ''}</div><div class="chronicle-filters">${[['all', 'Todos'], ...feedbackKinds].map(([k, l]) => button(l, 'feedback-filter', `data-key="${k}" aria-pressed="${filter === k}"`, filter === k ? 'button primary' : 'button ghost')).join('')}</div><div class="chronicle-grid">${rows.map((f) => `<article class="feedback-card"><div class="memory-card-top"><span class="tag">${feedbackKinds.find(([k]) => k === f.kind)?.[1] || 'Feedback'}</span>${tag(f)}</div><h2>${esc(f.title)}</h2><p class="memory-excerpt">${esc(f.content)}</p>${byline(ctx, f)}<footer><span class="memory-reward">${f.reward ? `+${f.reward.xp} XP reconhecidos` : f.reply ? 'Resposta do narrador' : 'Aguardando retorno'}</span>${button(ctx.admin() ? 'Ler e responder' : 'Abrir conversa', 'feedback-open', `data-id="${f.id}"`, 'button ghost')}</footer></article>`).join('') || empty('Uma mesa melhora quando todos participam.', 'Comece com algo que você gostou ou uma mudança que faria diferença.')}</div>`
  );
}
export function documentsPage(ctx) {
  const all = chronicleRows(ctx, 'documents'),
    filter = ctx.state.documentFilter || 'all';
  const rows = all
    .filter((d) => filter === 'all' || d.kind === filter)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    intro(
      'DOCUMENTOS DA CRÔNICA',
      'Alguns segredos deixam provas.',
      ctx.admin()
        ? 'Entregue cartas, notícias, decretos e registros. Escolha se a mesa inteira ou somente alguns jogadores podem abrir cada documento.'
        : 'Os registros que chegaram às suas mãos, reunidos para consulta.'
    ) +
    `<div class="list-toolbar">${ctx.admin() ? button('Criar documento ' + icon('plus'), 'document-new', '', 'button primary') : ''}<div class="chronicle-filters">${[['all', 'Todos'], ...documentKinds].map(([k, l]) => button(l, 'document-filter', `data-key="${k}" aria-pressed="${filter === k}"`, filter === k ? 'button primary' : 'button ghost')).join('')}</div></div><div class="chronicle-grid">${rows.map((d) => `<article class="chronicle-file ${d.kind}"><button class="document-cover" data-action="document-open" data-id="${d.id}" aria-label="Abrir ${esc(d.title)}">${d.image ? `<img src="${esc(d.image)}" alt="${esc(d.caption || d.title)}">` : `<span class="document-watermark">${icon(d.kind === 'decree' ? 'accounts' : 'notes')}</span><span class="document-cover-writing">${esc(d.issuer || 'Arquivo da crônica')}</span>`}<span class="document-wax">${icon('blood')}</span></button><div class="document-card-body"><div class="memory-card-top"><span class="eyebrow">${documentKinds.find(([k]) => k === d.kind)?.[1]}</span><span class="tag">${ctx.admin() ? (d.access === 'restricted' ? 'Acesso reservado' : 'Toda a mesa') : d.read ? 'Lido' : 'Novo'}</span></div><h2>${esc(d.title)}</h2><p>${esc(d.caption || d.body.slice(0, 130))}</p><footer>${button('Abrir documento ' + icon('arrow'), 'document-open', `data-id="${d.id}"`, 'button ghost')}${ctx.admin() ? button(icon('edit'), 'document-edit', `data-id="${d.id}" aria-label="Editar documento"`, 'icon-button') : ''}</footer></div></article>`).join('') || empty('O arquivo ainda está em silêncio.', ctx.admin() ? 'Crie o primeiro documento e escolha quem poderá recebê-lo.' : 'Os documentos liberados pelo narrador aparecerão aqui.')}</div>`
  );
}
export function documentDetailPage(ctx) {
  const d = doc(ctx);
  if (!d)
    return empty(
      'Documento indisponível.',
      'Seu acesso pode ter mudado ou o registro foi removido.',
      button('Voltar ao arquivo', 'nav-documents', '', 'button ghost')
    );
  return `<article class="chronicle-document ${d.kind}"><div class="document-heading"><span class="eyebrow">${documentKinds.find(([k]) => k === d.kind)?.[1]} · ARQUIVO DA CRÔNICA</span><span class="document-seal">${icon(d.kind === 'decree' ? 'accounts' : 'notes')}</span><h1>${esc(d.title)}</h1>${d.caption ? `<p>${esc(d.caption)}</p>` : ''}</div>${d.image ? `<a class="document-full-image" href="${esc(d.image)}" target="_blank" rel="noopener"><img src="${esc(d.image)}" alt="${esc(d.caption || d.title)}"><span>Toque para ampliar a imagem ${icon('arrow')}</span></a>` : ''}<div class="document-prose prose">${esc(d.body)}</div>${d.issuer ? `<footer class="document-signature"><span>◇</span>${esc(d.issuer)}</footer>` : ''}${ctx.admin() ? `<aside class="document-access-note">${icon('lock')} ${d.access === 'campaign' ? 'Disponível para toda a mesa.' : `Acesso reservado a ${d.account_ids.length} jogador(es).`} ${d.read_by.length} leitura(s) registrada(s).</aside><div class="chronicle-actions">${button('Editar documento', 'document-edit', `data-id="${d.id}"`, 'button ghost')}${button('Apagar documento', 'document-delete', `data-id="${d.id}"`, 'text-button danger')}</div>` : ''}</article>`;
}
function confirmDelete(ctx, path, entry, label) {
  modal(
    'Apagar ' + label + '?',
    `<p>Este registro será removido. ${entry.reward ? 'O XP já entregue permanece no histórico da ficha.' : 'Confira antes de confirmar.'}</p>`,
    async () => {
      await api(path + '/' + entry.id, { method: 'DELETE', data: { revision: entry._revision } });
      await ctx.refresh();
      await ctx.go(
        path.endsWith('recaps') ? 'recaps' : path.endsWith('documents') ? 'documents' : 'feedbacks'
      );
      toast('Registro removido.');
    },
    { saveLabel: 'Apagar registro' }
  );
}
function composeFeedback(ctx, entry) {
  modal(
    entry ? 'Editar contribuição' : 'Sua voz na crônica',
    `<div class="form-grid">${select(
      'kind',
      'Assunto',
      feedbackKinds.map(([value, label]) => ({ value, label })),
      entry?.kind || 'narration'
    )}${field('title', 'Um título', entry?.title || '', 'text', 'required maxlength="200"')}${area('content', 'O que você quer contar?', entry?.content || '', 'required maxlength="15000" placeholder="Conte uma situação específica, algo que você gostou ou um problema que aconteceu…"')}${area('impact', 'Por que isso fez diferença? (opcional)', entry?.impact || '', 'maxlength="5000"')}${area('suggestion', 'O que você sugere? (opcional)', entry?.suggestion || '', 'maxlength="5000"')}</div><p class="hint">Somente você e os narradores têm acesso a esta contribuição.</p>`,
    async (form) => {
      await api('/api/feedbacks' + (entry ? '/' + entry.id : ''), {
        method: entry ? 'PATCH' : 'POST',
        data: { ...Object.fromEntries(form), ...(entry ? { revision: entry._revision } : {}) }
      });
      await ctx.refresh();
      toast('Sua contribuição foi enviada.');
    },
    { wide: true, saveLabel: entry ? 'Salvar contribuição' : 'Enviar ao narrador' }
  );
}
function openFeedback(ctx, entry) {
  const fields = `${byline(ctx, entry)}<span class="tag">${feedbackKinds.find(([k]) => k === entry.kind)?.[1]}</span><section class="feedback-detail"><h3>O que aconteceu</h3><p class="prose">${esc(entry.content)}</p>${entry.impact ? `<h3>Por que importa</h3><p class="prose">${esc(entry.impact)}</p>` : ''}${entry.suggestion ? `<h3>Uma sugestão</h3><p class="prose">${esc(entry.suggestion)}</p>` : ''}</section>`;
  const chars = ownCharacters(ctx, entry.created_by);
  const review = ctx.admin() && !entry.reward;
  modal(
    entry.title,
    fields +
      (review
        ? `<div class="feedback-review-form">${area('reply', 'Sua resposta', entry.reply || '', 'maxlength="5000" placeholder="O que você aproveitou ou como pretende tratar essa contribuição?"')}<div class="form-grid">${field('xp', 'XP pela contribuição', 0, 'number', `min="0" max="100000" ${chars.length ? '' : 'readonly'}`)}${select('character_id', 'Ficha que recebe', chars.length ? chars.map((p) => ({ value: p.id, label: p.char })) : [{ value: '', label: 'O autor ainda não tem ficha ativa' }], chars[0]?.id || '')}</div><p class="hint">Use 0 para responder sem recompensa. Uma entrega de XP por feedback, sempre para uma ficha do autor.</p></div><div class="chronicle-actions">${button('Apagar', 'feedback-modal-delete', `data-id="${entry.id}"`, 'text-button danger')}</div>`
        : `${entry.reply ? `<aside class="memory-review-note"><strong>Resposta do narrador</strong><p class="prose">${esc(entry.reply)}</p></aside>` : ''}${entry.reward ? `<p class="memory-reward">+${entry.reward.xp} XP concedidos a ${esc(entry.reward.character_name)}.</p>` : ''}<div class="chronicle-actions">${!ctx.admin() && entry.status === 'submitted' ? button('Editar minha contribuição', 'feedback-modal-edit', `data-id="${entry.id}"`, 'button ghost') : ''}${ctx.admin() || entry.status === 'submitted' ? button('Apagar', 'feedback-modal-delete', `data-id="${entry.id}"`, 'text-button danger') : ''}</div>`),
    review
      ? async (form) => {
          const id = Number(form.get('character_id')),
            p = chars.find((p) => p.id === id);
          await api('/api/feedbacks/' + entry.id + '/review', {
            method: 'POST',
            data: {
              revision: entry._revision,
              reply: form.get('reply'),
              xp: Number(form.get('xp')),
              character_id: id,
              character_revision: p?._revision,
              confirmed: true
            }
          });
          await ctx.refresh();
          toast('Resposta registrada.');
        }
      : null,
    { wide: true, saveLabel: 'Registrar avaliação' }
  );
  $('#modal [data-action="feedback-modal-edit"]')?.addEventListener('click', () =>
    composeFeedback(ctx, entry)
  );
  $('#modal [data-action="feedback-modal-delete"]')?.addEventListener('click', () =>
    confirmDelete(ctx, '/api/feedbacks', entry, 'contribuição')
  );
}
function composeDocument(ctx, entry) {
  const members = ctx.state.accounts.filter(
    (a) => a.role === 'player' && a.active && a.campaign_access
  );
  modal(
    entry ? 'Editar documento' : 'Um registro para a crônica',
    `<div class="form-grid">${field('title', 'Título', entry?.title || '', 'text', 'required maxlength="200"')}${select(
      'kind',
      'Tipo',
      documentKinds.map(([value, label]) => ({ value, label })),
      entry?.kind || 'letter'
    )}${field('issuer', 'Assinado por', entry?.issuer || '', 'text', 'maxlength="200" placeholder="O príncipe, uma informante, um jornal…"')}${select(
      'access',
      'Quem pode abrir',
      [
        { value: 'campaign', label: 'Todos os jogadores da campanha' },
        { value: 'restricted', label: 'Somente jogadores selecionados' }
      ],
      entry?.access || 'campaign'
    )}${area('caption', 'Uma breve descrição', entry?.caption || '', 'maxlength="2000"')}${area('body', 'O documento', entry?.body || '', 'maxlength="50000" placeholder="Escreva a carta, notícia ou registro…"')}<div class="field full document-recipients"><span>Destinatários do acesso reservado</span><div class="recipient-grid">${members.map((a) => `<label class="checkbox"><input type="checkbox" name="account_ids" value="${a.id}" ${entry?.account_ids?.includes(a.id) ? 'checked' : ''}>${esc(a.display_name)}</label>`).join('') || '<p>Nenhum jogador ativo nesta campanha.</p>'}</div><p class="hint">Uma seleção vazia deixa o documento reservado aos narradores.</p></div><label class="field full"><span>Imagem do documento (opcional)</span><input type="file" name="image_file" accept="image/jpeg,image/png,image/webp"></label>${entry?.image ? `<figure class="document-edit-image"><img src="${esc(entry.image)}" alt="Imagem atual"><label class="checkbox"><input type="checkbox" name="remove_image">Remover a imagem atual</label></figure>` : ''}</div>`,
    async (form) => {
      await withLoading(async () => {
        const file = form.get('image_file'),
          image = file?.size
            ? (await readImage(file)).image
            : form.has('remove_image')
              ? ''
              : entry?.image || '';
        await api('/api/documents' + (entry ? '/' + entry.id : ''), {
          method: entry ? 'PATCH' : 'POST',
          data: {
            title: form.get('title'),
            kind: form.get('kind'),
            issuer: form.get('issuer'),
            access: form.get('access'),
            caption: form.get('caption'),
            body: form.get('body'),
            image,
            account_ids: form.getAll('account_ids'),
            ...(entry ? { revision: entry._revision } : {})
          }
        });
        await ctx.refresh();
      }, 'Guardando o documento…');
      toast('Documento salvo no arquivo.');
    },
    { wide: true, saveLabel: entry ? 'Salvar documento' : 'Entregar documento' }
  );
  const access = $('#dialog-form [name=access]'),
    recipients = $('#dialog-form .document-recipients');
  const toggle = () => {
    recipients.hidden = access.value !== 'restricted';
  };
  access.onchange = toggle;
  toggle();
}
export function bindChronicle(ctx) {
  const chooser = $('[name=recap_character]');
  if (chooser)
    chooser.onchange = () => {
      ctx.state.recapCharacter = chooser.value;
      ctx.draw();
    };
  const form = $('#recap-editor');
  if (!form) return;
  const update = () => {
    const value = Object.fromEntries(new FormData(form));
    Object.assign(ctx.state.recapDraft, value);
    form.dataset.dirty = 'true';
    const q = recapQuality(value, ctx.state.game.chronicle.recap_min_words);
    $('[data-recap-quality]').innerHTML = qualityMarkup(value, ctx);
    $('[data-recap-submit]').disabled = !q.complete;
  };
  form.oninput = update;
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (form.dataset.saving === 'true') return;
    const submit = event.submitter?.value === 'submit';
    form.dataset.saving = 'true';
    const controls = [...form.querySelectorAll('button[type=submit]')];
    controls.forEach((b) => (b.disabled = true));
    try {
      await withLoading(
        async () => {
          const draft = ctx.state.recapDraft,
            data = {
              ...Object.fromEntries(new FormData(form)),
              character_id: draft.character_id,
              ...(draft.id ? { revision: draft._revision } : {})
            };
          let saved = await api('/api/recaps' + (draft.id ? '/' + draft.id : ''), {
            method: draft.id ? 'PATCH' : 'POST',
            data
          });
          ctx.state.recapDraft = { ...saved };
          if (submit)
            saved = await api('/api/recaps/' + saved.id + '/submit', {
              method: 'POST',
              data: { revision: saved._revision }
            });
          ctx.state.recapId = saved.id;
          form.dataset.dirty = 'false';
          await ctx.refresh();
          await ctx.go(submit ? 'recap-detail' : 'recap-write');
        },
        submit ? 'Entregando sua memória…' : 'Salvando o rascunho…'
      );
      toast(
        submit ? 'Seu relato chegou ao narrador.' : 'Rascunho salvo. Você pode continuar depois.'
      );
    } catch (error) {
      const errorBox = $('#recap-error');
      if (errorBox) errorBox.textContent = error.message;
      else toast(error.message, true);
    } finally {
      form.dataset.saving = 'false';
      controls.forEach((b) => (b.disabled = false));
      if (form.isConnected)
        $('[data-recap-submit]').disabled = !recapQuality(
          ctx.state.recapDraft,
          ctx.state.game.chronicle.recap_min_words
        ).complete;
    }
  };
}
export async function chronicleAction(action, data, ctx) {
  if (!/^(recap-|feedback-|document-)/.test(action)) return false;
  if (action === 'recap-filter') {
    ctx.state.recapFilter = data.key;
    ctx.draw();
    return true;
  }
  if (action === 'feedback-filter') {
    ctx.state.feedbackFilter = data.key;
    ctx.draw();
    return true;
  }
  if (action === 'document-filter') {
    ctx.state.documentFilter = data.key;
    ctx.draw();
    return true;
  }
  if (action === 'recap-settings') {
    modal(
      'O guia das memórias',
      `${field('minimum', 'Palavras mínimas no relato', ctx.state.game.chronicle.recap_min_words, 'number', 'required min="50" max="600"')}<p>Os quatro tópicos continuam obrigatórios. O guia ajuda a organizar o relato; a decisão de conceder +1 XP é sua.</p>`,
      async (f) => {
        const game = structuredClone(ctx.state.game);
        game.chronicle.recap_min_words = Number(f.get('minimum'));
        game._expected_revision = game._revision;
        await api('/api/game', { method: 'PUT', data: game });
        await ctx.refresh();
        toast('Guia atualizado.');
      }
    );
    return true;
  }
  if (action === 'recap-new') {
    const chars = ownCharacters(ctx);
    const start = (p) => {
      ctx.state.recapDraft = {
        character_id: p.id,
        character_name: p.char,
        title: '',
        scene: '',
        events: '',
        pending: '',
        next: '',
        cast: ''
      };
      return ctx.go('recap-write');
    };
    const chosen =
      chars.find((p) => String(p.id) === String(ctx.state.recapCharacter)) || ctx.player();
    if (chosen && chars.some((p) => p.id === chosen.id)) await start(chosen);
    else if (chars.length === 1) await start(chars[0]);
    else
      modal(
        'Qual história você vai lembrar?',
        select(
          'character_id',
          'Personagem',
          chars.map((p) => ({ value: p.id, label: p.char })),
          chars[0]?.id
        ),
        async (f) => {
          const p = chars.find((p) => p.id === Number(f.get('character_id')));
          if (!p) throw new Error('Escolha um personagem.');
          await start(p);
        },
        { saveLabel: 'Começar o relato' }
      );
    return true;
  }
  if (action === 'recap-open') {
    ctx.state.recapId = data.id;
    await ctx.go('recap-detail');
    return true;
  }
  if (action === 'recap-edit') {
    const entry = chronicleRows(ctx, 'recaps').find((r) => r.id === data.id);
    if (!entry) throw new Error('Relato indisponível.');
    ctx.state.recapDraft = structuredClone(entry);
    await ctx.go('recap-write');
    return true;
  }
  if (action === 'recap-editor-exit') {
    await ctx.go('recaps');
    return true;
  }
  if (action === 'recap-delete') {
    const entry = chronicleRows(ctx, 'recaps').find((r) => r.id === data.id);
    if (entry) confirmDelete(ctx, '/api/recaps', entry, 'relato');
    return true;
  }
  if (action === 'recap-review') {
    const entry = chronicleRows(ctx, 'recaps').find((r) => r.id === data.id);
    if (!entry) throw new Error('Relato indisponível.');
    const outcome = data.outcome,
      p = ctx.state.players.find((p) => p.id === entry.character_id);
    modal(
      outcome === 'reward'
        ? 'Reconhecer esta memória com +1 XP?'
        : outcome === 'changes'
          ? 'O que precisa de mais detalhes?'
          : 'Marcar o relato como lido',
      `${outcome === 'reward' ? `<div class="memory-review-award">${icon('powers')}<strong>+1 XP</strong><span>Para ${esc(entry.character_name)}</span></div><p>Você considera este relato útil para retomar a história. A recompensa será registrada na ficha uma única vez.</p>` : ''}${area('note', outcome === 'changes' ? 'Seu pedido de complemento' : 'Seu comentário (opcional)', entry.review_note || '', `${outcome === 'changes' ? 'required ' : ''}maxlength="5000"`)}`,
      async (f) => {
        await api('/api/recaps/' + entry.id + '/review', {
          method: 'POST',
          data: {
            revision: entry._revision,
            outcome,
            note: f.get('note'),
            character_revision: p?._revision,
            confirmed: true
          }
        });
        await ctx.refresh();
        toast(outcome === 'reward' ? '+1 XP entregue pelo relato.' : 'Leitura registrada.');
      },
      {
        wide: true,
        saveLabel:
          outcome === 'reward'
            ? 'Conceder +1 XP'
            : outcome === 'changes'
              ? 'Pedir complemento'
              : 'Registrar leitura'
      }
    );
    return true;
  }
  if (action === 'feedback-new') {
    composeFeedback(ctx);
    return true;
  }
  if (action === 'feedback-open') {
    const entry = chronicleRows(ctx, 'feedbacks').find((r) => r.id === data.id);
    if (entry) openFeedback(ctx, entry);
    return true;
  }
  if (action === 'document-new') {
    composeDocument(ctx);
    return true;
  }
  if (action === 'document-edit') {
    const entry = chronicleRows(ctx, 'documents').find((r) => r.id === data.id);
    if (entry) composeDocument(ctx, entry);
    return true;
  }
  if (action === 'document-delete') {
    const entry = chronicleRows(ctx, 'documents').find((r) => r.id === data.id);
    if (entry) confirmDelete(ctx, '/api/documents', entry, 'documento');
    return true;
  }
  if (action === 'document-open') {
    ctx.state.documentId = data.id;
    await ctx.go('document-detail');
    const entry = doc(ctx);
    if (entry && !ctx.admin() && !entry.read) {
      await api('/api/documents/' + entry.id + '/read', { method: 'POST', silent: true });
      await ctx.refresh({ silent: true });
    }
    return true;
  }
  return false;
}
