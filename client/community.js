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
const moods = {
  chat: 'No clima de conversar',
  chill: 'De boa por aqui',
  busy: 'Passando rapidinho'
};
const hands = { rock: '✊ Pedra', paper: '✋ Papel', scissors: '✌️ Tesoura' };
const prompts = [
  'Qual foi a cena de filme que você mais queria esquecer para assistir de novo?',
  'Qual jogo você defenderia num tribunal sem pensar duas vezes?',
  'Qual personagem de ficção seria um péssimo colega de apartamento?',
  'Se a nossa mesa virasse um filme, quem você escolheria para o elenco?',
  'Qual música descreve sua semana até agora?',
  'Qual foi a coisa mais aleatória que fez você rir recentemente?',
  'Se pudesse dominar uma habilidade amanhã, qual seria?',
  'Qual comida você pediria para a última sessão da humanidade?',
  'Qual seria seu nome artístico se você virasse uma pessoa famosa amanhã?',
  'Qual jogo de tabuleiro você levaria para uma ilha com todos da mesa?'
];
export const face = (a, extra = '') =>
  `<span class="avatar ${extra}">${a?.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc((a?.display_name || '?').slice(0, 1))}</span>`;
export function authorByline(author, createdAt, originalDate = null) {
  const a = author || { display_name: 'Acesso removido' };
  return `<div class="author-byline">${a.id ? `<button type="button" class="author-profile" data-action="visit-profile" data-id="${esc(a.id)}" aria-label="Ver perfil de ${esc(a.display_name)}">${face(a, 'small')}<span><strong>${esc(a.display_name)}</strong><small>${originalDate ? 'Criada em ' + esc(originalDate) : createdAt ? 'Criada em ' + date(createdAt) : 'Participante da mesa'}</small></span></button>` : `<span>${esc(a.display_name)}</span>`}</div>`;
}
function gameResult(post, ctx) {
  if (post.status !== 'completed')
    return post.created_by === ctx.state.account.id
      ? 'Você já escolheu. Agora é com a outra pessoa.'
      : 'Alguém chamou você para uma rodada!';
  if (post.result === 'draw') return 'Empatou! A resenha pede revanche.';
  const winner = post.result === 'sender' ? post.created_by : post.to;
  return winner === ctx.state.account.id
    ? 'Você levou essa rodada!'
    : 'A outra pessoa levou essa. Bora uma revanche?';
}
function challengeCard(ctx, p) {
  const me = ctx.state.account.id,
    other = ctx.state.social.members.find(
      (m) => m.id === (p.created_by === me ? p.to : p.created_by)
    ),
    expired = p.status !== 'completed' && Date.parse(p.expires_at) < Date.now();
  return `<article class="social-game-card"><div class="social-game-symbol">✊ ✋ ✌️</div><span class="eyebrow">${expired ? 'CONVITE EXPIRADO' : p.status === 'completed' ? 'RODADA ENCERRADA' : 'DESAFIO RELÂMPAGO'}</span><h3>Você & ${esc(other?.display_name || 'Participante')}</h3><p>${expired ? 'Uma nova rodada pode começar a qualquer hora.' : gameResult(p, ctx)}</p><div>${button(p.status === 'completed' ? 'Ver resultado' : p.to === me && !expired ? 'Responder ao desafio' : 'Abrir rodada', 'challenge-view', `data-id="${p.id}"`, 'button ' + (p.to === me && !expired && p.status !== 'completed' ? 'primary' : 'ghost'))}${button('Apagar', 'delete-social', `data-id="${p.id}"`, 'text-button danger')}</div></article>`;
}
export function socialPage(ctx) {
  const s = ctx.state,
    social = s.social || { members: [], posts: [] },
    members = social.members,
    me = s.account;
  const games = social.posts.filter((p) => p.kind === 'challenge'),
    privateCount = s.notifications.filter(
      (n) =>
        ['private-message', 'poke', 'kudos', 'icebreaker', 'challenge'].includes(n.kind) &&
        !n.read_by.includes(me.id)
    ).length;
  return `<section class="chapter-hero social-hero"><div><span class="eyebrow">DÊ UM TEMPO PARA O PERSONAGEM</span><h1>Do lado de cá do véu.</h1><p>Aqui é gente conversando com gente. Um oi, uma provocação amigável, uma pergunta inesperada. Sem gastar XP, sem sair da sua campanha.</p><div class="chapter-metrics"><span><strong>${members.filter((m) => m.online).length}</strong> por aqui agora</span><span><strong>${members.length}</strong> pessoas na mesa</span></div></div><div class="chapter-sigil" aria-hidden="true">${icon('social')}<i></i><i></i></div></section><section class="panel social-mood-panel"><div><span class="eyebrow">SEU CLIMA HOJE</span><h2>Como você chegou por aqui?</h2></div><form id="social-mood-form">${select(
    'social_mood',
    'Hoje eu estou…',
    Object.entries(moods).map(([value, label]) => ({ value, label })),
    me.preferences?.social_mood || 'chat'
  )}${field('social_note', 'Uma frase sobre seu dia (opcional)', me.preferences?.social_note || '', 'text', 'maxlength="120" placeholder="Café na mão e ideias demais."')}<button type="submit" class="button ghost">Atualizar</button></form></section><div class="social-section-heading"><div><span class="eyebrow">QUEM DIVIDE ESSA MESA COM VOCÊ</span><h2>Chama alguém para a resenha.</h2></div>${button(icon('notes') + ' Suas notificações' + (privateCount ? ' · ' + privateCount : ''), 'nav-notifications', '', 'button ghost')}</div><div class="social-people-grid">${[
    ...members
  ]
    .sort((a, b) => Number(b.online) - Number(a.online))
    .map(
      (m) =>
        `<article class="social-person-card"><button type="button" class="social-person-profile" data-action="visit-profile" data-id="${m.id}">${face(m, 'large')}<i class="presence-dot ${m.online ? 'online' : ''}"></i><h3>${esc(m.display_name)}</h3><span>${m.role === 'admin' ? 'NARRADOR' : 'JOGADOR'}${m.id === me.id ? ' · VOCÊ' : ''}</span></button><div class="social-mood"><span>${esc(moods[m.mood] || moods.chat)}</span><p>${esc(m.social_note || m.bio?.slice(0, 120) || 'Uma boa conversa pode começar com um oi.')}</p></div>${m.id === me.id ? '<p class="hint">Sua presença fica visível enquanto a campanha está aberta.</p>' : `<div class="social-person-actions">${button(icon('social') + ' Mensagem', 'social-message', `data-id="${m.id}"`, 'button primary')}${button('◇ Cutucar', 'send-poke', `data-id="${m.id}"`, 'button ghost')}${button('🥂 Um brinde', 'social-kudos', `data-id="${m.id}"`, 'button ghost')}${button('✊ Desafiar', 'social-challenge', `data-id="${m.id}"`, 'button ghost')}${button('✦ Puxar assunto', 'social-prompt', `data-id="${m.id}"`, 'text-button full')}</div>`}</article>`
    )
    .join(
      ''
    )}</div><div class="social-section-heading"><div><span class="eyebrow">SÓ PELA RESENHA</span><h2>Uma rodada entre pessoas.</h2></div><span class="hint">Pedra, papel e tesoura · sem recompensas no jogo</span></div><div class="social-games-grid">${games.map((p) => challengeCard(ctx, p)).join('') || empty('Um desafio rápido quebra o gelo.', 'Escolha alguém acima e chame para uma rodada de pedra, papel e tesoura.')}</div><section class="social-boundary panel"><span>${icon('lock')}</span><div><h3>Uma mensagem tem destino.</h3><p>Mensagens, brindes e cutucadas chegam pela notificação de quem você escolheu. As anotações compartilhadas da campanha continuam em seu próprio caderno.</p></div>${button('Abrir anotações', 'nav-notes', '', 'button ghost')}</section>`;
}
export async function memberProfile(ctx, id) {
  const member = await api('/api/members/' + id);
  modal(
    member.display_name,
    `<div class="member-profile-hero">${face(member, 'large')}<div><span class="eyebrow">${member.role === 'admin' ? 'NARRADOR' : 'JOGADOR'} DA CAMPANHA</span><h2>${esc(member.display_name)}</h2><p class="prose">${esc(member.bio || 'Uma história que ainda está sendo escrita.')}</p></div></div><div class="member-characters">${member.characters.map((p) => `<article>${p.profilepicture ? `<img src="${esc(p.profilepicture)}" alt="${esc(p.char)}">` : '<span>◇</span>'}<div><strong>${esc(p.char)}</strong><small>${esc(p.cla)}</small></div></article>`).join('')}</div><div class="profile-social-actions">${member.id === ctx.state.account.id ? button('Editar meu perfil', 'nav-profile', '', 'button primary') : button('Mandar mensagem', 'social-message', `data-id="${member.id}"`, 'button primary') + button('◇ Cutucar', 'send-poke', `data-id="${member.id}"`, 'button ghost')}</div>`,
    null,
    { wide: true }
  );
}
function compose(ctx, id) {
  const m = ctx.state.social.members.find((m) => m.id === id);
  if (!m) throw new Error('Participante não encontrado nesta campanha.');
  modal(
    'Uma mensagem para ' + m.display_name,
    `<div class="private-recipient">${face(m, 'small')}<span>Somente você e ${esc(m.display_name)} veem esta mensagem.</span></div><div class="form-grid">${field('title', 'Assunto (opcional)', '', 'text', 'maxlength="200"')}${area('content', 'Sua mensagem', '', 'required maxlength="5000" placeholder="Ei, o que você achou…?"')}</div>`,
    async (form) => {
      await api('/api/social', {
        method: 'POST',
        data: {
          kind: 'message',
          to: id,
          title: form.get('title') || 'Uma mensagem para você',
          content: form.get('content')
        }
      });
      await ctx.refresh();
      toast('Mensagem entregue nas notificações de ' + m.display_name + '.');
    },
    { saveLabel: 'Enviar mensagem' }
  );
}
function handFields() {
  return `<fieldset class="rps-options"><legend>Faça sua escolha</legend>${Object.entries(hands)
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="choice" value="${value}" required><span>${label}</span></label>`
    )
    .join('')}</fieldset>`;
}
export async function showChallenge(ctx, id) {
  let p = ctx.state.social.posts.find((p) => p.id === id);
  if (!p) {
    await ctx.refresh();
    p = ctx.state.social.posts.find((p) => p.id === id);
  }
  if (!p) throw new Error('Essa rodada não está mais disponível.');
  const me = ctx.state.account.id,
    other = ctx.state.social.members.find(
      (m) => m.id === (p.created_by === me ? p.to : p.created_by)
    ),
    expired = p.status !== 'completed' && Date.parse(p.expires_at) < Date.now();
  const canPlay = p.to === me && p.status === 'pending' && !expired;
  modal(
    'Pedra, papel e tesoura',
    `<div class="rps-duel"><span class="eyebrow">VOCÊ & ${esc(other?.display_name || 'PARTICIPANTE')}</span><h3>${expired ? 'O convite expirou.' : gameResult(p, ctx)}</h3>${p.status === 'completed' ? `<div class="rps-result"><span>${hands[p.choices[me]]}<small>VOCÊ</small></span><i>×</i><span>${hands[p.choices[other?.id]] || '—'}<small>${esc(other?.display_name || 'PARTICIPANTE')}</small></span></div>` : p.own_choice ? `<p>Sua escolha: <strong>${hands[p.own_choice]}</strong>. Ela fica em segredo até a resposta.</p>` : '<p>A escolha da outra pessoa está selada. Escolha a sua para revelar o resultado.</p>'}${canPlay ? handFields() : ''}<p class="hint">Sem XP, dinheiro ou apostas. Só uma desculpa para conversar.</p></div>`,
    canPlay
      ? async (form) => {
          await api('/api/social/' + p.id + '/respond', {
            method: 'POST',
            data: { choice: form.get('choice') }
          });
          await ctx.refresh();
          setTimeout(() => ctx.safe(() => showChallenge(ctx, id)), 0);
        }
      : null,
    { wide: true, saveLabel: 'Revelar a rodada' }
  );
}
export async function communityAction(action, data, ctx) {
  if (action === 'visit-profile') {
    await memberProfile(ctx, data.id);
    return true;
  }
  if (action === 'social-message' || action === 'compose-to') {
    compose(ctx, data.id);
    return true;
  }
  if (action === 'challenge-view') {
    await showChallenge(ctx, data.id);
    return true;
  }
  if (['send-poke', 'social-kudos'].includes(action)) {
    await api('/api/social', {
      method: 'POST',
      data: { kind: action === 'send-poke' ? 'poke' : 'kudos', to: data.id }
    });
    closeModal();
    await ctx.refresh();
    toast(action === 'send-poke' ? 'Seu chamado chegou do outro lado.' : 'Um brinde foi entregue!');
    return true;
  }
  if (action === 'social-challenge') {
    const member = ctx.state.social.members.find((m) => m.id === data.id);
    modal(
      'Uma rodada com ' + member.display_name,
      `<p>Escolha seu gesto em segredo. ${esc(member.display_name)} recebe um convite e só vê a sua escolha depois de responder.</p>${handFields()}<p class="hint">O convite fica disponível por 48 horas. Nenhum recurso do personagem é usado.</p>`,
      async (form) => {
        await api('/api/social', {
          method: 'POST',
          data: { kind: 'challenge', to: data.id, choice: form.get('choice') }
        });
        await ctx.refresh();
        toast('O desafio foi enviado. Sua escolha está selada.');
      },
      { saveLabel: 'Enviar desafio' }
    );
    return true;
  }
  if (action === 'social-prompt') {
    const member = ctx.state.social.members.find((m) => m.id === data.id),
      prompt = prompts[Math.floor(Math.random() * prompts.length)];
    modal(
      'Um assunto inesperado',
      `<span class="eyebrow">PARA ${esc(member.display_name)}</span><blockquote class="social-icebreaker">${esc(prompt)}</blockquote><p>Essa pergunta chega como mensagem particular. A conversa é de vocês.</p>`,
      async () => {
        await api('/api/social', {
          method: 'POST',
          data: {
            kind: 'icebreaker',
            to: data.id,
            title: 'Uma pergunta fora do roteiro',
            content: prompt
          }
        });
        await ctx.refresh();
        toast('A pergunta chegou. Que comece a resenha.');
      },
      { saveLabel: 'Mandar essa pergunta' }
    );
    return true;
  }
  if (action === 'delete-social') {
    const p = ctx.state.social.posts.find((p) => p.id === data.id);
    modal(
      'Apagar esta interação?',
      `<p>${p.created_by === ctx.state.account.id ? 'A interação será removida.' : 'A interação será ocultada para você.'}</p>`,
      async () => {
        await api('/api/social/' + p.id, { method: 'DELETE' });
        await ctx.refresh();
      },
      { saveLabel: 'Apagar interação' }
    );
    return true;
  }
  return false;
}
export function bindCommunity(ctx) {
  const form = $('#social-mood-form');
  if (form)
    form.onsubmit = (event) => {
      event.preventDefault();
      ctx.safe(async () => {
        await api('/api/profile', {
          method: 'PATCH',
          data: { preferences: Object.fromEntries(new FormData(form)) }
        });
        form.dataset.dirty = 'false';
        await ctx.refresh();
        toast('Seu clima foi atualizado.');
      });
    };
}
