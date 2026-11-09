import { playSound } from './audio.js';
const pending = new Map();
let timer, noticeTimer;
function element() {
  let el = document.querySelector('#portal-loading');
  if (el) return el;
  el = document.createElement('dialog');
  el.id = 'portal-loading';
  el.setAttribute('aria-label', 'Carregando a campanha');
  el.addEventListener('cancel', (event) => event.preventDefault());
  el.className = 'portal-loading';
  el.hidden = true;
  el.innerHTML = `<div class="loading-orbit" aria-hidden="true"><i></i><span>◇</span></div><div role="status" aria-live="polite"><strong data-loading-title>Carregando a crônica…</strong><p data-loading-notice>Um instante. Estamos buscando seus registros.</p></div><button type="button" class="button ghost" data-loading-cancel hidden>Interromper espera</button>`;
  el.querySelector('[data-loading-cancel]').onclick = () => {
    for (const job of pending.values()) if (job.blocking) job.cancel?.();
  };
  document.body.appendChild(el);
  return el;
}
function activity() {
  let el = document.querySelector('#portal-activity');
  if (el) return el;
  el = document.createElement('aside');
  el.id = 'portal-activity';
  el.hidden = true;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML =
    '<span class="activity-spinner" aria-hidden="true"></span><span data-activity-title>Salvando…</span><button type="button" data-activity-cancel hidden>Interromper espera</button>';
  el.querySelector('button').onclick = () => {
    for (const job of pending.values()) if (!job.blocking) job.cancel?.();
  };
  document.body.appendChild(el);
  return el;
}
function update() {
  const blocking = [...pending.values()].filter((j) => j.blocking),
    inline = [...pending.values()].filter((j) => !j.blocking),
    small = document.querySelector('#portal-activity');
  if (inline.length) {
    const el = small || activity();
    el.hidden = blocking.length > 0;
    el.querySelector('[data-activity-title]').textContent = inline.at(-1).title;
  } else if (small) small.hidden = true;
  if (blocking.length) {
    const current = blocking.at(-1),
      shown = document.querySelector('#portal-loading[open]');
    if (shown) shown.querySelector('[data-loading-title]').textContent = current.title;
    else if (!timer)
      timer = setTimeout(() => {
        timer = null;
        const job = [...pending.values()].find((j) => j.blocking);
        if (!job) return;
        const el = element();
        el.hidden = false;
        el.querySelector('[data-loading-title]').textContent = job.title;
        el.querySelector('[data-loading-notice]').textContent =
          'Um instante. Estamos buscando seus registros.';
        el.querySelector('[data-loading-cancel]').hidden = true;
        el.showModal();
        playSound('loading');
        document.querySelector('#app')?.setAttribute('aria-busy', 'true');
      }, 90);
  } else {
    clearTimeout(timer);
    timer = null;
    const el = document.querySelector('#portal-loading');
    if (el) {
      if (el.open) {
        el.close();
        playSound('loaded');
      }
      el.hidden = true;
    }
    document.querySelector('#app')?.removeAttribute('aria-busy');
  }
  if (!pending.size) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
}
export function beginLoading(title = 'Carregando a crônica…', cancel, { blocking = true } = {}) {
  if (!globalThis.document) return () => {};
  if (!pending.size) {
    const button = document.querySelector('#portal-activity button');
    if (button) button.hidden = true;
  }
  const id = Symbol('loading');
  pending.set(id, { title, cancel, blocking });
  update();
  if (!noticeTimer)
    noticeTimer = setTimeout(() => {
      const el = document.querySelector('#portal-loading[open]');
      if (el) {
        el.querySelector('[data-loading-notice]').textContent =
          'Está demorando mais que o normal. O servidor ainda está respondendo. Se interromper uma gravação, confira o resultado antes de repeti-la.';
        el.querySelector('[data-loading-cancel]').hidden = ![...pending.values()].some(
          (j) => j.blocking && j.cancel
        );
      }
      const small = document.querySelector('#portal-activity');
      if (small && !small.hidden) {
        small.querySelector('[data-activity-title]').textContent =
          'Aguardando confirmação do servidor…';
        small.querySelector('button').hidden = ![...pending.values()].some(
          (j) => !j.blocking && j.cancel
        );
      }
    }, 10000);
  return () => {
    pending.delete(id);
    update();
  };
}
export async function withLoading(task, title = 'Preparando os arquivos…') {
  const done = beginLoading(title);
  try {
    return await task();
  } finally {
    done();
  }
}
