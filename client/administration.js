import { isImageSource } from '../core/media-reference.js';
import { presenceWidget } from './loyalty.js';
import { showChallenge } from './community.js';
import { realMoney } from './rule-content.js';
import {
  $,
  esc,
  icon,
  crown,
  button,
  field,
  area,
  select,
  modal,
  toast,
  empty,
  date,
  dots,
  download
} from '../shared/ui.js';
import { api } from './api.js';
import { parseFile, exportTable } from './files.js';
import { labels } from '../shared/rules.js';
const statusLabels = {
  pending: 'AGUARDA AVALIAÇÃO',
  changes_requested: 'AJUSTES SOLICITADOS',
  approved: 'APROVADO',
  rejected: 'RECUSADO'
};
const cardPortrait = (p) =>
  isImageSource(p.profilepicture)
    ? `<img src="${esc(p.profilepicture)}" alt="${esc(p.char)}">`
    : `<span>${esc(p.char.slice(0, 1))}</span>`;
export function narratorDashboard(ctx) {
  const s = ctx.state,
    pending = s.submissions.filter((x) => x.status === 'pending'),
    players = s.accounts.filter((a) => a.role === 'player' && a.campaign_access);
  return `<div class="page-intro"><span class="eyebrow">CONSELHO DO NARRADOR</span><h1>Você conduz a história.</h1><p>Administre a campanha, acompanhe os jogadores e decida o que atravessa o véu.</p></div>${s.campaign.cover ? `<div class="campaign-dashboard-cover"><img src="${esc(s.campaign.cover)}" alt="Capa da campanha"></div>` : ''}<section class="narrator-welcome panel"><div><span class="eyebrow">CAMPANHA ATIVA</span><h2>${esc(s.campaign.title)}</h2><p>${esc(s.campaign.description)}</p><div class="dashboard-actions">${button(icon('plus') + ' Cadastrar ficha', 'create-character', '', 'button primary')}${button(icon('accounts') + ' Convidar jogador', 'create-account', '', 'button ghost')}</div></div><div class="narrator-seal" aria-hidden="true">${crown}</div></section><div class="dashboard-metrics"><button data-action="nav-characters"><strong>${s.players.length}</strong><span>PERSONAGENS</span>${icon('characters')}</button><button data-action="nav-accounts"><strong>${players.length}</strong><span>JOGADORES NESTA MESA</span>${icon('accounts')}</button><button data-action="nav-submissions" class="${pending.length ? 'attention' : ''}"><strong>${pending.length}</strong><span>FICHAS PARA AVALIAR</span>${icon('notes')}</button><button data-action="nav-map"><strong>${s.campaign.maps.length}</strong><span>MAPAS DA CAMPANHA</span>${icon('map')}</button></div><div class="dashboard-columns"><section class="panel"><div class="section-heading"><div><span class="eyebrow">PRÓXIMAS HISTÓRIAS</span><h2>Chegaram à sua mesa.</h2></div>${button('Ver todas', 'nav-submissions', '', 'text-button')}</div>${
    pending.length
      ? pending
          .slice(0, 4)
          .map(
            (r) =>
              `<button class="review-inbox-row" data-action="review-submission" data-id="${r.id}"><span class="mini-portrait">${cardPortrait(r.character)}</span><span><strong>${esc(r.character.char)}</strong><small>${esc(r.author_name)} · ${date(r.updated_at)}</small></span>${icon('arrow')}</button>`
          )
          .join('')
      : '<div class="dashboard-empty">Nenhuma ficha aguardando avaliação. Crie um acesso para o jogador montar seu próprio personagem.</div>'
  }${button(icon('download') + ' Receber solicitação JSON', 'import-submission', '', 'button ghost')}</section><section class="panel"><span class="eyebrow">FERRAMENTAS DO NARRADOR</span><div class="dashboard-shortcuts">${[
    [
      'registrations',
      'accounts',
      'Avaliar novos cadastros',
      (s.registrations || []).filter((a) => a.registration.status === 'pending').length +
        ' pedido(s) aguardando'
    ],
    ['rewards', 'blood', 'Recompensas de login', 'Configure dias consecutivos e XP por ciclo'],
    ['rules', 'rules', 'Editar o livro de regras', 'Catálogos, poderes e conteúdo livre'],
    ['notes', 'notes', 'Diário da campanha', 'Pistas, registros e notas reservadas'],
    ['quests', 'quests', 'Missões da mesa', 'Objetivos e recompensas'],
    ['storage', 'save', 'Arquivos da campanha', 'Salvar e carregar seus JSONs']
  ]
    .map(
      ([v, i, t, d]) =>
        `<button data-action="nav-${v}">${icon(i)}<span><strong>${t}</strong><small>${d}</small></span>${icon('arrow')}</button>`
    )
    .join(
      ''
    )}</div></section></div><p class="hint">Abra uma ficha em Personagens para consultar os dados de um jogador. O narrador administra a mesa sem possuir um personagem próprio.</p>`;
}
export function myCharactersView(ctx) {
  const s = ctx.state;
  return `${presenceWidget(ctx)}<div class="page-intro"><span class="eyebrow">AS SUAS HISTÓRIAS</span><h1>Escolha quem atravessa o véu.</h1><p>Uma conta, vários personagens. Cada ficha mantém sua própria história e evolução.</p></div><div class="list-toolbar">${s.game.character_creation.enabled ? button(icon('plus') + ' Criar personagem', 'propose-character', '', 'button primary') : ''}${button(icon('notes') + ' Minhas propostas', 'nav-submissions', '', 'button ghost')}</div><div class="player-character-grid">${s.players.map((p) => `<article class="player-character-card"><div class="player-character-portrait">${cardPortrait(p)}</div><div class="player-character-content"><span class="eyebrow">${esc(p.cla)}</span><h2>${esc(p.char)}</h2><p>${p.xp} XP disponíveis · ${p.generation}ª geração</p>${button('Abrir personagem ' + icon('arrow'), 'open-character', `data-id="${p.id}"`, 'button primary')}</div></article>`).join('') || empty('Seu próximo personagem começa aqui.', 'Monte a ficha e envie para avaliação do narrador.', s.game.character_creation.enabled ? button('Criar meu personagem', 'propose-character', '', 'button primary') : '')}</div>`;
}
export function submissionsView(ctx) {
  const s = ctx.state;
  return `<div class="page-intro"><span class="eyebrow">${ctx.admin() ? 'CONSELHO DO NARRADOR' : 'SUAS PRÓXIMAS HISTÓRIAS'}</span><h1>${ctx.admin() ? 'Toda história merece uma boa entrada.' : 'Do primeiro traço ao primeiro capítulo.'}</h1><p>${ctx.admin() ? 'Avalie as propostas, ajuste a ficha e libere o personagem para jogar.' : 'Monte seus personagens, acompanhe os pareceres e envie ajustes quando necessário.'}</p></div><div class="list-toolbar">${ctx.admin() ? button(icon('download') + ' Receber solicitação JSON', 'import-submission', '', 'button primary') : s.game.character_creation.enabled ? button(icon('plus') + ' Criar personagem', 'propose-character', '', 'button primary') : ''}<span class="hint">As propostas são enviadas diretamente ao narrador desta campanha.</span></div><div class="submission-grid">${s.submissions.map((r) => `<article class="submission-card"><div class="submission-card-top"><span class="mini-portrait">${cardPortrait(r.character)}</span><div><span class="tag ${r.status === 'pending' ? 'red' : ''}">${statusLabels[r.status]}</span><h2>${esc(r.character.char)}</h2><p>${esc(r.author_name)} · ${esc(r.character.cla)}</p></div></div><div class="submission-check ${r.report.issues.length ? 'warning' : 'ok'}">${icon(r.report.issues.length ? 'notes' : 'test')} ${r.report.issues.length ? r.report.issues.length + ' ponto(s) de atenção nas regras' : 'Valores compatíveis com os limites configurados'}</div>${r.review_note ? `<blockquote class="review-note"><strong>Parecer do narrador</strong><p>${esc(r.review_note)}</p></blockquote>` : ''}<div class="submission-actions">${button(ctx.admin() ? 'Avaliar ficha' : 'Ver proposta', 'review-submission', `data-id="${r.id}"`, 'button primary')}${!ctx.admin() && !['approved', 'rejected'].includes(r.status) ? button('Editar proposta', 'edit-submission', `data-id="${r.id}"`, 'button ghost') : ''}${!ctx.admin() && !['approved', 'rejected'].includes(r.status) ? button(icon('download') + ' Enviar JSON ao narrador', 'export-submission', `data-id="${r.id}"`, 'button ghost') : ''}${button('Apagar proposta', 'delete-submission', `data-id="${r.id}"`, 'text-button danger')}</div><small class="submission-date">${date(r.updated_at)}</small></article>`).join('') || empty('Nenhuma proposta por aqui.', ctx.admin() ? 'As fichas enviadas pelos jogadores aparecem neste painel.' : 'Crie seu primeiro personagem para começar.')}</div>`;
}
export function reviewSubmissionView(ctx) {
  const r = ctx.state.submissions.find((s) => s.id === ctx.state.reviewId);
  if (!r)
    return empty(
      'Proposta não encontrada.',
      'Volte para a lista.',
      button('Voltar', 'nav-submissions', '', 'button ghost')
    );
  const p = r.character,
    g = ctx.state.game,
    open = !['approved', 'rejected'].includes(r.status);
  return `<div class="review-navigation">${button(icon('arrow') + ' Voltar às propostas', 'nav-submissions', '', 'button ghost')}<span class="tag red">${statusLabels[r.status]}</span></div><div class="review-layout"><section><div class="review-character-hero panel"><span class="review-portrait">${cardPortrait(p)}</span><div><span class="eyebrow">PROPOSTA DE ${esc(r.author_name)}</span><h1>${esc(p.char)}</h1><p>${esc(p.cla)} · ${p.generation}ª geração</p><p>Capital inicial: ${realMoney(p.money)}</p></div></div><div class="review-stats">${['atributes', 'talents', 'expertises', 'knowledges', 'precedents'].map((key) => `<section class="panel"><h2>${labels[key]}</h2>${p[key].map((e) => `<div><span>${esc(g[key].find((d) => d.id === e.id)?.name || '#' + e.id)}</span><strong>${e.value}</strong></div>`).join('')}</section>`).join('')}</div><section class="panel review-story"><h2>Poderes e história</h2><div class="review-power-list">${p.disciplines.map((e) => `<span class="tag">${esc(g.disciplines.find((d) => d.id === e.id)?.name)} · ${e.nivel}</span>`).join('') || '<span class="muted">Sem disciplinas selecionadas.</span>'}</div><p class="prose">${esc(p.biography || 'Nenhuma história registrada.')}</p><h3>Qualidades e defeitos</h3>${p.caracteristics.map((row) => `<p><strong>${esc(g.caracteristics.find((d) => d.id === row.id)?.name || 'Traço removido')}</strong>${row.notes ? ' · ' + esc(row.notes) : ''}</p>`).join('') || '<p class="muted">Nenhum escolhido.</p>'}</section></section><aside class="panel review-verdict"><span class="eyebrow">AVALIAÇÃO DE ${esc(p.char)}</span><h2>Pronta para a mesa?</h2><div class="creation-budget-list">${Object.entries(
    r.report.totals
  )
    .map(
      ([key, v]) =>
        `<div><span>${labels[key]}</span><strong class="${v.budget !== null && v.used > v.budget ? 'expense' : ''}">${v.used}${v.budget === null ? '' : ' / ' + v.budget}</strong></div>`
    )
    .join(
      ''
    )}</div>${r.report.issues.length ? `<div class="review-issues">${r.report.issues.map((i) => `<p>${esc(i.message)}</p>`).join('')}</div>` : '<p class="review-pass">' + icon('test') + ' Limites configurados atendidos.</p>'}${r.report.warnings?.length ? `<details class="creation-warnings"><summary>Observações da criação (${r.report.warnings.length})</summary>${r.report.warnings.map((w) => `<p>${esc(w)}</p>`).join('')}</details>` : ''}<p class="hint">Pontos iniciais, bônus, clã, linhas, geração e capital são conferidos com o game-data. A aprovação final continua com o narrador.</p>${r.review_note ? `<blockquote class="review-note"><strong>Parecer</strong><p>${esc(r.review_note)}</p></blockquote>` : ''}${open ? (ctx.admin() ? `<div class="verdict-actions">${button(icon('edit') + ' Ajustar a ficha', 'edit-submission', `data-id="${r.id}"`, 'button ghost')}${button('Aprovar personagem', 'approve-submission', `data-id="${r.id}"`, 'button primary')}${button('Solicitar ajustes', 'return-submission', `data-id="${r.id}"`, 'button ghost')}${button('Recusar proposta', 'reject-submission', `data-id="${r.id}"`, 'text-button danger')}</div>` : `<div class="verdict-actions">${button('Editar proposta', 'edit-submission', `data-id="${r.id}"`, 'button primary')}${button(icon('download') + ' Exportar solicitação', 'export-submission', `data-id="${r.id}"`, 'button ghost')}</div>`) : r.status === 'approved' ? button('Abrir personagem', 'open-character', `data-id="${r.approved_character_id}"`, 'button primary') : ''}</aside></div>`;
}
export function notificationsView(ctx) {
  const s = ctx.state,
    unread = s.notifications.filter((n) => !n.read_by.includes(s.account.id)).length;
  return `<div class="page-intro"><span class="eyebrow">OS SUSSURROS DA MESA</span><h1>O véu tem novidades.</h1><p>${unread ? unread + ' novidade(s) esperando por você.' : 'Você está em dia com a campanha.'}</p></div><div class="list-toolbar">${button('Marcar todas como lidas', 'read-notifications', '', 'button ghost')}${button('Apagar lidas', 'delete-notifications', 'data-only-read="true"', 'button ghost')}${button('Apagar todas', 'delete-notifications', '', 'text-button danger')}</div><div class="notification-list">${
    s.notifications
      .map((n) => {
        const author = s.social?.members?.find((m) => m.id === n.created_by),
          read = n.read_by.includes(s.account.id),
          type =
            {
              social: 'social',
              'private-message': 'social',
              poke: 'social',
              kudos: 'favour',
              challenge: 'dice',
              icebreaker: 'social',
              intel: 'search',
              legacy: 'blood',
              quest: 'quests',
              xp: 'powers',
              submission: 'notes',
              registration: 'accounts'
            }[n.kind] || 'notes';
        return `<article class="notification-card ${read ? 'read' : 'unread'} ${n.kind}"><span class="notification-icon">${author?.avatar ? `<img src="${esc(author.avatar)}" alt="">` : icon(type)}</span><div class="notification-content"><span class="eyebrow">${read ? 'LIDA' : 'NOVA'} · ${date(n.created_at)}</span><h2>${esc(n.title)}</h2><p class="prose">${esc(n.message)}</p></div><div class="notification-actions">${button('Abrir', 'open-notification', `data-id="${n.id}"`, 'button ghost')}${button('Apagar', 'delete-notification', `data-id="${n.id}"`, 'text-button danger')}</div></article>`;
      })
      .join('') ||
    empty('Nenhum sussurro por aqui.', 'As novidades da campanha vão aparecer neste espaço.')
  }</div>`;
}
export function trashView(ctx) {
  const trash = ctx.state.trash || { characters: [], accounts: [], maps: [] };
  return `<div class="page-intro"><span class="eyebrow">REGISTROS REMOVIDOS</span><h1>Uma segunda chance para a história.</h1><p>Personagens, contas e mapas removidos ficam fora da mesa e podem ser restaurados.</p></div><div class="list-toolbar">${button('Esvaziar toda a lixeira', 'purge-trash', '', 'text-button danger')}</div>${[
    ['characters', 'Personagens'],
    ['accounts', 'Jogadores'],
    ['maps', 'Mapas']
  ]
    .map(
      ([type, label]) =>
        `<section class="panel trash-section"><h2>${label}</h2>${trash[type].map((r) => `<article><div><strong>${esc(r.title)}</strong><small>${esc(r.detail)} · ${date(r.deleted_at)}</small></div><div class="trash-actions">${button(icon('refresh') + ' Restaurar', 'restore-trash', `data-type="${type}" data-id="${r.id}"`, 'button ghost')}${button('Apagar definitivamente', 'purge-trash', `data-type="${type}" data-id="${r.id}"`, 'text-button danger')}</div></article>`).join('') || '<p class="muted">Nenhum registro removido.</p>'}</section>`
    )
    .join('')}`;
}
export async function administrationAction(action, data, ctx) {
  const s = ctx.state;
  if (action === 'close-character') {
    s.player = null;
    await ctx.go(ctx.admin() ? 'dashboard' : 'my-characters');
    return true;
  }
  if (action === 'propose-character') {
    await ctx.editProposal();
    return true;
  }
  if (action === 'review-submission') {
    s.reviewId = data.id;
    await ctx.go('review-submission');
    return true;
  }
  if (action === 'edit-submission') {
    await ctx.editProposal(s.submissions.find((r) => r.id === data.id));
    return true;
  }
  if (action === 'export-submission') {
    const packet = await api('/api/exchange/submission', { data: { id: data.id } });
    await download('solicitacao-' + packet.submission.character.id + '.json', packet);
    toast('Solicitação exportada. Envie o JSON ao narrador.');
    return true;
  }
  if (action === 'export-account') {
    const account = s.accounts.find((a) => a.id === data.id),
      packet = await api('/api/json/player', { data: { account_id: account.id } });
    await download('acesso-' + account.username + '-coroa.json', packet);
    toast('Download do acesso concluído.');
    return true;
  }
  if (action === 'import-submission') {
    modal(
      'Receber uma ficha de jogador',
      '<p class="hint">O jogador deve usar Exportar solicitação no painel de propostas. Esta operação recebe somente a proposta; seus outros personagens permanecem na campanha.</p><label class="field"><span>Solicitação JSON</span><input type="file" name="file" accept=".json,application/json" required></label>',
      async (form) => {
        const result = await api('/api/exchange/import', {
          method: 'POST',
          data: { document: await parseFile(form.get('file')) }
        });
        await ctx.refresh();
        s.reviewId = result.id;
        await ctx.go('review-submission');
        toast(
          result.status === 'already_received'
            ? 'Esta versão já foi recebida.'
            : 'Proposta recebida e adicionada à avaliação.'
        );
      },
      { saveLabel: 'Receber proposta' }
    );
    return true;
  }
  if (['approve-submission', 'return-submission', 'reject-submission'].includes(action)) {
    const r = s.submissions.find((r) => r.id === data.id),
      approve = action === 'approve-submission';
    modal(
      approve
        ? 'Liberar este personagem para jogar?'
        : action === 'return-submission'
          ? 'Solicitar ajustes na ficha'
          : 'Recusar esta proposta',
      `<div class="approval-identity"><strong>${esc(r.character.char)}</strong><span>${esc(r.author_name)}</span></div>${area('note', approve ? 'Comentário para o jogador (opcional)' : 'Parecer para o jogador', r.review_note || '', 'maxlength="5000" ' + (approve ? '' : 'required'))}${approve && r.report.issues.length ? '<label class="checkbox"><input type="checkbox" name="override" required> Autorizar uma exceção aos limites de pontos</label><p class="hint">Registre a justificativa no comentário acima.</p>' : ''}`,
      async (form) => {
        await api('/api/submissions/' + r.id + '/' + (approve ? 'approve' : 'review'), {
          method: 'POST',
          data: {
            revision: r._revision,
            status: action === 'return-submission' ? 'changes_requested' : 'rejected',
            note: form.get('note'),
            reason: form.get('note'),
            override: form.has('override')
          }
        });
        await ctx.refresh();
        toast(
          approve
            ? 'Personagem aprovado e vinculado ao jogador.'
            : 'Parecer registrado e notificação enviada.'
        );
      },
      { saveLabel: approve ? 'Aprovar personagem' : 'Enviar parecer' }
    );
    return true;
  }
  if (action === 'read-notifications') {
    await api('/api/notifications/read-all', { method: 'POST' });
    await ctx.refresh();
    return true;
  }
  if (action === 'delete-notification' || action === 'delete-notifications') {
    modal(
      action === 'delete-notification' ? 'Apagar esta notificação?' : 'Limpar suas notificações?',
      '<p>Essa ação altera somente a sua caixa de notificações nesta campanha.</p>',
      async () => {
        await api('/api/notifications' + (data.id ? '/' + data.id : ''), {
          method: 'DELETE',
          data: { only_read: data.onlyRead === 'true' }
        });
        await ctx.refresh();
      },
      { saveLabel: 'Apagar' }
    );
    return true;
  }
  if (action === 'open-notification') {
    const n = s.notifications.find((n) => n.id === data.id);
    await api('/api/notifications/' + n.id + '/read', { method: 'POST' });
    await ctx.refresh();
    if (n.kind === 'recap') {
      s.recapId = n.target;
      await ctx.go('recap-detail');
      return true;
    }
    if (n.kind === 'document') {
      s.documentId = n.target;
      await ctx.go('document-detail');
      return true;
    }
    if (n.kind === 'feedback') {
      await ctx.go('feedbacks');
      await chronicleAction('feedback-open', { id: n.target }, ctx);
      return true;
    }
    if (n.kind === 'achievement') {
      await ctx.go('achievements');
      return true;
    }
    if (n.kind === 'challenge') {
      await ctx.go('social');
      await showChallenge(ctx, n.target);
      return true;
    }
    if (['social', 'private-message', 'poke', 'kudos', 'icebreaker', 'reminder'].includes(n.kind)) {
      modal(
        n.title,
        `<p class="prose private-message-body">${esc(n.message)}</p><p class="hint">${date(n.created_at)} · Mensagem particular</p>${n.created_by && s.social.members.some((m) => m.id === n.created_by) ? button('Responder', 'social-message', `data-id="${n.created_by}"`, 'button primary') : ''}`,
        null,
        { wide: true }
      );
      return true;
    }
    if (n.kind === 'intel') {
      await ctx.go('intel');
      return true;
    }
    if (n.kind === 'registration' && ctx.admin()) {
      await ctx.go('registrations');
      return true;
    }
    if (n.kind === 'legacy') {
      await ctx.go('legacies');
      return true;
    }
    if (n.kind === 'quest') {
      await ctx.go('quests');
      return true;
    }
    if (n.kind === 'xp') {
      const p = s.players.find((p) => p.id === Number(n.target));
      if (p) {
        s.player = p;
        await ctx.go('chronicle');
      } else await ctx.go(ctx.admin() ? 'characters' : 'my-characters');
      return true;
    }
    if (s.submissions.some((r) => r.id === n.target)) {
      s.reviewId = n.target;
      await ctx.go('review-submission');
    } else await ctx.go('submissions');
    return true;
  }
  if (action === 'assign-character') {
    const p = await api('/api/characters/' + Number(data.id)),
      accounts = await api('/api/admin/accounts');
    modal(
      'Quem conduz este personagem?',
      `<p class="hint">Transferir a ficha retira o controle dos acessos anteriores. Cada jogador pode controlar várias fichas.</p><h3>${esc(p.char)}</h3>${select('account_id', 'Jogador responsável', [{ value: '', label: 'Sem jogador — somente o narrador' }, ...accounts.filter((a) => a.role === 'player' && a.active).map((a) => ({ value: a.id, label: a.display_name + ' · @' + a.username }))], p.owner_id || accounts.find((a) => a.character_ids.includes(p.id))?.id || '')}`,
      async (form) => {
        await api('/api/characters/' + p.id + '/assign', {
          method: 'POST',
          data: { revision: p._revision, account_id: form.get('account_id') }
        });
        await ctx.refresh();
        toast('Controle do personagem atualizado.');
      },
      { saveLabel: 'Confirmar responsável' }
    );
    return true;
  }
  if (action === 'delete-character') {
    const p = await api('/api/characters/' + Number(data.id));
    modal(
      'Remover personagem da campanha?',
      `<p>${esc(p.char)} sairá das fichas ativas e dos acessos dos jogadores. A lixeira permite restaurar a ficha.</p>${field('confirmation', 'Digite o nome do personagem', '', 'text', 'required maxlength="150"')}`,
      async (form) => {
        await api('/api/characters/' + p.id, {
          method: 'DELETE',
          data: { revision: p._revision, confirmation: form.get('confirmation') }
        });
        if (s.player?.id === p.id) s.player = null;
        await ctx.refresh();
        toast('Personagem movido para a lixeira.');
      },
      { saveLabel: 'Remover personagem' }
    );
    return true;
  }
  if (action === 'delete-account') {
    const account = s.accounts.find((a) => a.id === data.id);
    modal(
      'Remover este jogador?',
      `<p>A conta de ${esc(account.display_name)} perderá acesso ao portal. As fichas continuam sob administração do narrador e podem ser atribuídas a outro jogador.</p>${field('confirmation', 'Digite o login @' + esc(account.username), '', 'text', 'required maxlength="40"')}`,
      async (form) => {
        await api('/api/admin/accounts/' + account.id, {
          method: 'DELETE',
          data: { confirmation: form.get('confirmation') }
        });
        await ctx.refresh();
        toast('Jogador removido. As fichas foram preservadas.');
      },
      { saveLabel: 'Remover jogador' }
    );
    return true;
  }
  if (action === 'restore-trash') {
    modal(
      'Restaurar este registro?',
      '<p>O registro voltará a ficar disponível. Vínculos anteriores são recuperados quando ainda estiverem livres.</p>',
      async () => {
        await api(`/api/admin/trash/${data.type}/${data.id}/restore`, { method: 'POST' });
        await ctx.refresh();
        toast('Registro restaurado.');
      },
      { saveLabel: 'Restaurar' }
    );
    return true;
  }
  return false;
}
import { chronicleAction } from './chronicle.js';
