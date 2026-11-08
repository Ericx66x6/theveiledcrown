import { esc, crown, icon, dots } from '../shared/ui.js';
import { api } from './api.js';
import { playSound } from './audio.js';

let identity = '',
  context,
  queue = [],
  known = new Set(),
  timer,
  active,
  animation;
const reduced = () =>
  document.body.classList.contains('reduce-effects') ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;
export function groupRewards(events) {
  const groups = [];
  for (const event of events) {
    const previous = groups.at(-1);
    if (
      event.kind === 'xp' &&
      previous?.kind === 'xp' &&
      previous.character_id === event.character_id
    ) {
      previous.amount += event.amount;
      previous.ids.push(event.id);
      previous.reason = 'Recompensas acumuladas do personagem.';
    } else if (event.kind === 'check-in' && previous?.kind === 'streak-break') {
      previous.restart = event;
      previous.ids.push(event.id);
    } else groups.push({ ...event, ids: [event.id] });
  }
  return groups;
}
export function queueExperience(ctx) {
  if (ctx.state.account?.role !== 'player') return;
  const key = ctx.state.account.id + ':' + ctx.state.campaign.id;
  if (identity !== key) {
    disposeExperience();
    identity = key;
  }
  context = ctx;
  const fresh = (ctx.state.rewards?.events || []).filter((e) => !known.has(e.id));
  fresh.forEach((e) => known.add(e.id));
  queue.push(...groupRewards(fresh));
  if (!timer && !active && queue.length) timer = setTimeout(flush, 450);
}
export function disposeExperience() {
  clearTimeout(timer);
  timer = null;
  cancelAnimationFrame(animation);
  if (active) {
    active.onclose = null;
    active.close();
    active.remove();
    active = null;
  }
  queue = [];
  known = new Set();
  identity = '';
  context = null;
  document.body.classList.remove('game-finale-open');
}
function flush() {
  timer = null;
  if (!queue.length || !context || active) return;
  if (
    document.hidden ||
    document.querySelector('#modal[open],#portal-loading[open],.aspiration-finale') ||
    document.activeElement?.matches('input,textarea,select')
  ) {
    timer = setTimeout(flush, 600);
    return;
  }
  show(queue.shift());
}
function seals(progress, days) {
  return `<div class="presence-seals" aria-label="${progress} de ${days} dias">${Array.from({ length: Math.min(days, 12) }, (_, i) => `<i class="${i < progress ? 'lit' : ''}" style="--i:${i}">${i < progress ? icon('test') : i + 1}</i>`).join('')}${days > 12 ? `<span>… ${days}</span>` : ''}</div>`;
}
function show(event) {
  const dialog = document.createElement('dialog'),
    opener = document.activeElement;
  const broken = event.kind === 'streak-break',
    check = event.kind === 'check-in',
    xp = event.kind === 'xp',
    learned = event.kind === 'discipline';
  const title = broken
    ? 'A corrente se partiu.'
    : check
      ? event.completed
        ? 'Você honrou a noite.'
        : 'Mais uma marca na eternidade.'
      : xp
        ? 'Seu legado cresceu.'
        : learned
          ? 'O sangue revelou um segredo.'
          : 'Você ultrapassou seus limites.';
  const subtitle = broken
    ? 'A noite não espera. A sua história continua.'
    : check
      ? 'Sua presença faz parte desta crônica.'
      : xp
        ? 'Cada escolha deixa poder em suas mãos.'
        : learned
          ? 'Um novo dom agora faz parte de você.'
          : 'Seu esforço deixou uma nova marca no sangue.';
  const liveCharacter = context.state.players.find((p) => p.id === event.character_id);
  let body;
  if (xp)
    body = `<div class="reward-number"><span aria-hidden="true" data-count>+0</span><span class="sr-only">+${event.amount}</span><small>XP RECEBIDOS</small></div><p class="reward-character">${esc(event.character_name)}</p><p class="reward-reason">${esc(event.reason)}</p>${liveCharacter ? `<span class="reward-balance">SALDO ATUAL <strong>${liveCharacter.xp} XP</strong></span>` : ''}`;
  else if (check)
    body = `${seals(event.progress, event.days)}<div class="reward-number"><span>${event.progress}<em> / ${event.days}</em></span><small>DIAS DO CICLO</small></div><p class="reward-reason">${event.completed ? `Você conquistou <strong>${event.xp} XP</strong>. Escolha um personagem em Presença na crônica para receber.` : `A cada ${event.days} dias consecutivos, ${event.xp} XP esperam por um personagem seu.`}</p>`;
  else if (broken)
    body = `<div class="broken-chain" aria-hidden="true"><i></i><b>◇</b><i></i></div><p class="reward-character">${event.previous} dia(s) de presença ficaram na história.</p><p class="reward-reason">Seu novo ciclo começa em ${event.restart?.progress || 1}/${event.restart?.days || context.state.rewards.days}. Recompensas já conquistadas continuam guardadas.</p>`;
  else
    body = `<div class="reward-upgrades">${(event.changes || [])
      .slice(0, 6)
      .map(
        (c) =>
          `<div style="--i:${event.changes.indexOf(c)}"><span>${esc(c.name)}<small>${c.learned ? 'NOVA DISCIPLINA' : 'NÍVEL ' + c.from + ' → ' + c.to}</small></span>${dots(c.to)}</div>`
      )
      .join(
        ''
      )}</div><p class="reward-character">${esc(event.character_name)}</p>${learned ? '<p class="reward-reason">O dom foi aprendido. Use XP para desenvolver os níveis que ainda não possui.</p>' : ''}`;
  dialog.className = `game-finale ${broken ? 'chain-broken' : check ? 'presence-finale' : xp ? 'xp-finale' : 'ascension-finale'} ${reduced() ? 'still' : ''}`;
  dialog.setAttribute('aria-labelledby', 'reward-title');
  dialog.setAttribute('aria-describedby', 'reward-description');
  dialog.innerHTML = `<div class="reward-scene" aria-hidden="true"><div class="reward-halo"></div><div class="reward-ring"></div><div class="reward-ring outer"></div>${reduced() ? '' : Array.from({ length: 36 }, (_, i) => `<i class="reward-spark" style="--i:${i};--angle:${i * 137.5}deg;--travel:${70 + (i % 7) * 25}px"></i>`).join('')}</div><div class="reward-content"><span class="reward-crest">${crown}</span><span class="eyebrow">${broken ? 'UM NOVO COMEÇO' : check ? 'PRESENÇA NA CRÔNICA' : 'A NOITE RECONHECE VOCÊ'}</span><h2 id="reward-title">${title}</h2><p id="reward-description">${subtitle}</p>${body}<button type="button" class="button primary reward-continue">Continuar ${icon('arrow')}</button><span class="reward-footnote">${xp ? 'O XP já está salvo na sua ficha.' : check ? 'Um registro por dia · horário da campanha.' : 'Sua história fica registrada.'}</span></div>`;
  active = dialog;
  document.body.append(dialog);
  document.body.classList.add('game-finale-open');
  dialog.onclose = () => {
    cancelAnimationFrame(animation);
    dialog.remove();
    active = null;
    document.body.classList.remove('game-finale-open');
    if (opener?.isConnected) opener.focus();
    const ctx = context;
    api('/api/rewards/ack', { method: 'POST', data: { ids: event.ids }, silent: true })
      .then(() => {
        if (context === ctx && ctx?.state.rewards)
          ctx.state.rewards.events = ctx.state.rewards.events.filter(
            (e) => !event.ids.includes(e.id)
          );
      })
      .catch(() => {});
    timer = setTimeout(flush, 350);
  };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.showModal();
  playSound(
    broken
      ? 'surrender'
      : check
        ? event.completed
          ? 'victory'
          : 'confirm'
        : xp
          ? 'xp-gain'
          : learned
            ? 'discipline-learn'
            : 'level-up'
  );
  if (xp) {
    const node = dialog.querySelector('[data-count]'),
      start = performance.now();
    const frame = (now) => {
      const p = reduced() ? 1 : Math.min(1, (now - start) / 1600);
      node.textContent = '+' + Math.round(event.amount * (1 - Math.pow(1 - p, 3)));
      if (p < 1) animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
  }
}
export function animatePage() {
  const page = document.querySelector('#main-content');
  if (!page || reduced()) return;
  page.classList.remove('game-page-enter');
  void page.offsetWidth;
  page.classList.add('game-page-enter');
}
