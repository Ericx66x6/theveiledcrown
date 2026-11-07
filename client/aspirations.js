import { $, esc, icon, button, area, modal } from '../shared/ui.js';
import { api } from './api.js';
import { playSound } from './audio.js';
const names = { ambition: 'Ambição', desire: 'Desejo' };
export function aspirationsPage(ctx) {
  return `<section class="page-intro"><span class="eyebrow">O QUE MOVE A SUA NOITE</span><h1>Entre a vontade e a fome.</h1><p>Uma ambição para a sua história. Um desejo para o próximo passo. Cada um segue seu próprio caminho.</p></section><div class="aspirations-grid">${Object.entries(
    names
  )
    .map(([key, name]) => aspirationCard(ctx, key, name))
    .join(
      ''
    )}</div><p class="hint">Concluir ou desistir limpa somente o objetivo escolhido e registra a decisão no histórico. Nenhum XP é concedido automaticamente.</p>`;
}
export function aspirationCard(ctx, key, name = names[key]) {
  const text = ctx.player().aspirations?.[key] || '';
  return `<article class="aspiration-card ${key}" data-aspiration="${key}"><span class="aspiration-sigil" aria-hidden="true">${key === 'ambition' ? '♛' : '✦'}</span><span class="eyebrow">${key === 'ambition' ? 'A HISTÓRIA QUE VOCÊ QUER CONSTRUIR' : 'O IMPULSO QUE TE MOVE AGORA'}</span><h2>${name}</h2><p class="prose ${text ? '' : 'muted'}">${esc(text || (key === 'ambition' ? 'Que marca você quer deixar na noite?' : 'O que você quer conquistar agora?'))}</p><footer>${button(icon('edit') + (text ? ' Alterar' : ' Definir ' + name.toLowerCase()), 'aspiration-edit', `data-kind="${key}"`, 'button ghost')}${text ? button('✦ Concluir', 'aspiration-resolve', `data-kind="${key}" data-outcome="complete"`, 'button primary') + button('Desistir', 'aspiration-resolve', `data-kind="${key}" data-outcome="abandon"`, 'text-button danger') : ''}</footer></article>`;
}
export async function aspirationAction(action, data, ctx) {
  if (!action.startsWith('aspiration-')) return false;
  const p = ctx.player(),
    kind = data.kind,
    name = names[kind];
  if (!p || !name) return true;
  const revision = p._revision;
  if (action === 'aspiration-edit') {
    modal(
      `Sua ${name.toLowerCase()}`,
      area(
        'content',
        name,
        p.aspirations?.[kind] || '',
        'maxlength="30000" placeholder="Escreva com suas palavras…"'
      ),
      async (form) => {
        await api(`/api/characters/${p.id}`, {
          method: 'PATCH',
          data: {
            revision,
            patch: { aspirations: { ...p.aspirations, [kind]: form.get('content') } }
          }
        });
        await ctx.refresh();
      },
      { saveLabel: 'Guardar ' + name.toLowerCase() }
    );
  } else {
    const complete = data.outcome === 'complete';
    modal(
      `${complete ? 'Concluir' : kind === 'ambition' ? 'Desistir da' : 'Desistir do'} ${name.toLowerCase()}?`,
      `<p class="prose">${esc(p.aspirations?.[kind])}</p><p class="hint">${complete ? 'A noite vai lembrar desta conquista.' : 'Mudar de caminho também faz parte da história.'} Só ${kind === 'ambition' ? 'a ambição será limpa' : 'o desejo será limpo'}. O outro objetivo permanece e esta decisão fica no histórico.</p>`,
      async () => {
        await api(`/api/characters/${p.id}/aspiration`, {
          method: 'POST',
          data: { revision, kind, outcome: data.outcome, confirmed: true }
        });
        await ctx.refresh();
        setTimeout(() => celebrate(kind, complete, ctx), 0);
      },
      {
        saveLabel: complete
          ? 'Concluir ' + name.toLowerCase()
          : (kind === 'ambition' ? 'Desistir da ' : 'Desistir do ') + name.toLowerCase()
      }
    );
  }
  return true;
}
function celebrate(kind, complete, ctx) {
  const reduce =
    ctx.state.account.preferences?.animations === false ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlay = document.createElement('div');
  overlay.className = `aspiration-finale ${complete ? 'triumph' : 'surrender'} ${reduce ? 'still' : ''}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', complete ? 'Objetivo conquistado' : 'Um novo caminho');
  const name = names[kind];
  overlay.innerHTML = `<div class="finale-vortex" aria-hidden="true"><i></i><i></i><i></i></div><div class="finale-particles" aria-hidden="true">${Array.from({ length: reduce ? 0 : 52 }, (_, i) => `<i style="--angle:${i * 137.508}deg;--reach:${120 + (i % 7) * 38}px;--delay:${(i % 9) * 0.055}s;--size:${3 + (i % 5)}px"></i>`).join('')}</div><div class="finale-content"><span class="finale-crown" aria-hidden="true">${complete ? '♛' : '♜'}</span><span class="eyebrow">${complete ? 'A NOITE TESTEMUNHOU. O SANGUE LEMBRA.' : 'A BESTA VIU ISSO. E VAI TE LEMBRAR. 😏'}</span><h2>${complete ? 'Você fez a noite se curvar.' : 'Ousou sonhar. Resolveu deixar pra lá.'}</h2><p>${name} ${complete ? (kind === 'ambition' ? 'conquistada' : 'conquistado') : kind === 'ambition' ? 'abandonada' : 'abandonado'}. ${complete ? 'Uma vontade virou história. Agora, qual é a próxima?' : 'Até os imortais recalculam a rota. Escolha seu próximo impulso.'}</p><button type="button" class="button primary" data-finale-close>${complete ? 'Receber a glória' : 'Voltar com dignidade'}</button></div>`;
  const previous = document.activeElement;
  const close = () => {
    overlay.remove();
    document.body.classList.remove('finale-open');
    document.removeEventListener('keydown', keyboard);
    if (previous?.isConnected) previous.focus();
    else $('#main-content')?.focus();
  };
  const keyboard = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      e.preventDefault();
      overlay.querySelector('button').focus();
    }
  };
  overlay.querySelector('button').onclick = close;
  document.addEventListener('keydown', keyboard);
  document.body.append(overlay);
  document.body.classList.add('finale-open');
  overlay.querySelector('button').focus();
  playSound(complete ? 'victory' : 'surrender');
}
