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
export const face = (a, extra = '') =>
  `<span class="avatar ${extra}">${a?.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc((a?.display_name || '?').slice(0, 1))}</span>`;
export function authorByline(author, createdAt) {
  const a = author || { display_name: 'Acesso removido' };
  return `<div class="author-byline">${a.id ? `<button type="button" class="author-profile" data-action="visit-profile" data-id="${esc(a.id)}" aria-label="Ver perfil de ${esc(a.display_name)}">${face(a, 'small')}<span><strong>${esc(a.display_name)}</strong><small>${createdAt ? 'Criada em ' + date(createdAt) : 'Participante da mesa'}</small></span></button>` : `<span>${esc(a.display_name)}</span>`}</div>`;
}
export function socialPage(ctx) {
  const { state } = ctx,
    social = state.social || { members: [], posts: [] },
    draft = state.socialDraft || {};
  const members = social.members,
    online = members.filter((m) => m.online).length;
  return `<div class="page-intro"><span class="eyebrow">O SALÃO DA CRÔNICA</span><h1>A mesa continua entre os encontros.</h1><p>Presenças, recados e pequenos chamados. Tudo entre os participantes desta campanha.</p></div><div class="social-layout"><aside class="panel social-presence"><div class="section-heading"><div><span class="eyebrow">QUEM ESTÁ POR AQUI</span><h2>${online} ${online === 1 ? 'presença' : 'presenças'} na mesa</h2></div><span class="live-signal"></span></div><p class="hint">Presença atualizada enquanto a campanha está aberta.</p>${
    [...members]
      .sort((a, b) => Number(b.online) - Number(a.online))
      .map(
        (m) =>
          `<article class="member-row"><button type="button" class="member-identity" data-action="visit-profile" data-id="${m.id}">${face(m, 'small')}<span><strong>${esc(m.display_name)}</strong><small><i class="presence-dot ${m.online ? 'online' : ''}"></i>${m.online ? 'Na campanha agora' : m.last_seen ? 'Visto ' + date(m.last_seen) : 'Fora da campanha'}</small></span></button>${m.id !== state.account.id ? button('◇', 'send-poke', `data-id="${m.id}" aria-label="Cutucar ${esc(m.display_name)}" title="Cutucar"`, 'icon-button poke-button') : '<span class="tag">VOCÊ</span>'}</article>`
      )
      .join('') || '<p class="muted">Ainda não há outros participantes nesta mesa.</p>'
  }</aside><section class="social-feed"><form id="social-form" class="panel social-composer"><span class="eyebrow">DEIXE SUA MARCA</span><h2>Um recado do outro lado do véu.</h2><div class="form-grid">${select('to', 'Quem vai receber', [{ value: '', label: 'Toda a campanha' }, ...members.filter((m) => m.id !== state.account.id).map((m) => ({ value: m.id, label: m.display_name }))], draft.to || state.socialRecipient || '')}${select(
    'kind',
    'Tipo',
    [
      { value: 'message', label: 'Recado' },
      { value: 'reminder', label: 'Lembrete' }
    ],
    draft.kind || 'message'
  )}${field('title', 'Título (opcional)', draft.title || '', 'text', 'maxlength="200"')}${field('due_at', 'Data do lembrete (opcional)', draft.due_at || '', 'datetime-local')}${area('content', 'Seu recado', draft.content || '', 'required maxlength="5000" placeholder="Uma pista, um convite, algo para lembrar na próxima partida…"')}</div><div class="composer-footer"><p class="hint">Recados privados ficam entre remetente e destinatário. A data organiza o lembrete no mural.</p><button type="submit" class="button primary">${icon('arrow')} Enviar recado</button></div><p class="form-error" role="alert" data-social-error></p></form><div class="social-posts">${
    social.posts
      .map((p) => {
        const recipient = members.find((m) => m.id === p.to),
          mine = p.created_by === state.account.id;
        const canDelete = mine || p.to === state.account.id || (ctx.admin() && !p.to);
        return `<article class="panel social-post ${p.kind} ${mine ? 'own' : ''}"><header>${authorByline({ ...p.author, avatar: members.find((a) => a.id === p.created_by)?.avatar || '' }, p.created_at)}<span class="tag ${p.to ? 'red' : ''}">${p.to ? 'PRIVADO · ' + esc(mine ? recipient?.display_name || 'destinatário' : 'PARA VOCÊ') : 'DA CAMPANHA'}</span></header>${p.title ? `<h3>${esc(p.title)}</h3>` : ''}<p class="prose">${esc(p.content)}</p>${p.due_at ? `<div class="reminder-date ${Date.parse(p.due_at) < Date.now() ? 'due' : ''}">${icon('clock')} ${date(p.due_at)}</div>` : ''}<footer><span>${{ message: 'Recado', reminder: 'Lembrete', poke: 'Cutucada' }[p.kind]}</span>${canDelete ? button('Apagar', 'delete-social', `data-id="${p.id}"`, 'text-button danger') : ''}</footer></article>`;
      })
      .join('') ||
    empty('O salão ainda está em silêncio.', 'Escreva o primeiro recado da campanha.')
  }</div></section></div>`;
}
async function profile(ctx, id) {
  const member = await api('/api/members/' + id);
  modal(
    member.display_name,
    `<div class="member-profile-hero">${face(member, 'large')}<div><span class="eyebrow">${member.role === 'admin' ? 'NARRADOR' : 'JOGADOR'} DA CAMPANHA</span><h2>${esc(member.display_name)}</h2><p class="prose">${esc(member.bio || 'Uma história que ainda está sendo escrita.')}</p></div></div><div class="member-characters">${member.characters.map((p) => `<article>${p.profilepicture ? `<img src="${esc(p.profilepicture)}" alt="${esc(p.char)}">` : '<span>◇</span>'}<div><strong>${esc(p.char)}</strong><small>${esc(p.cla)}</small></div></article>`).join('')}</div><div class="profile-social-actions">${member.id === ctx.state.account.id ? button('Editar meu perfil', 'nav-profile', '', 'button primary') : button('Mandar recado', 'compose-to', `data-id="${member.id}"`, 'button primary') + button('◇ Cutucar', 'send-poke', `data-id="${member.id}"`, 'button ghost')}</div>`,
    null,
    { wide: true }
  );
}
export async function communityAction(action, data, ctx) {
  if (action === 'visit-profile') {
    await profile(ctx, data.id);
    return true;
  }
  if (action === 'compose-to') {
    closeModal();
    ctx.state.socialRecipient = data.id;
    ctx.state.socialDraft = { ...(ctx.state.socialDraft || {}), to: data.id };
    await ctx.go('social');
    $('#social-form textarea')?.focus();
    return true;
  }
  if (action === 'send-poke') {
    await api('/api/social', { method: 'POST', data: { kind: 'poke', to: data.id } });
    closeModal();
    await ctx.refresh();
    toast('Um chamado atravessou o véu.');
    return true;
  }
  if (action === 'delete-social') {
    const p = ctx.state.social.posts.find((p) => p.id === data.id);
    modal(
      'Apagar este recado?',
      `<p>${p.created_by === ctx.state.account.id || (ctx.admin() && !p.to) ? 'O recado será removido do mural dos participantes.' : 'O recado será ocultado para você.'}</p>`,
      async () => {
        await api('/api/social/' + p.id, { method: 'DELETE' });
        await ctx.refresh();
      },
      { saveLabel: 'Apagar recado' }
    );
    return true;
  }
  return false;
}
export function bindCommunity(ctx) {
  const form = $('#social-form');
  if (!form) return;
  const dateInput = form.elements.due_at;
  const updateType = () => {
    const reminder = form.elements.kind.value === 'reminder';
    dateInput.disabled = !reminder;
    dateInput.closest('.field').hidden = !reminder;
  };
  form.elements.kind.addEventListener('change', updateType);
  updateType();
  form.oninput = () => {
    ctx.state.socialDraft = Object.fromEntries(new FormData(form));
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      if (data.due_at) data.due_at = new Date(data.due_at).toISOString();
      await api('/api/social', { method: 'POST', data });
      ctx.state.socialDraft = {};
      ctx.state.socialRecipient = '';
      form.dataset.dirty = 'false';
      await ctx.refresh();
      toast('Recado enviado à campanha.');
    } catch (error) {
      form.querySelector('[data-social-error]').textContent = error.message;
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  };
}
