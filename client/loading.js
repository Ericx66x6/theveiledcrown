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
    for (const job of pending.values()) job.cancel?.();
  };
  document.body.appendChild(el);
  return el;
}
export function beginLoading(title = 'Carregando a crônica…', cancel) {
  if (!globalThis.document) return () => {};
  const id = Symbol('loading');
  pending.set(id, { title, cancel });
  if (pending.size === 1) {
    timer = setTimeout(() => {
      const el = element();
      el.hidden = false;
      playSound('loading');
      if (!el.open) el.showModal();
      el.querySelector('[data-loading-title]').textContent = title;
      el.querySelector('[data-loading-notice]').textContent =
        'Um instante. Estamos buscando seus registros.';
      el.querySelector('[data-loading-cancel]').hidden = true;
      document.querySelector('#app')?.setAttribute('aria-busy', 'true');
      noticeTimer = setTimeout(() => {
        el.querySelector('[data-loading-notice]').textContent =
          'Está demorando mais que o normal. O servidor ainda está respondendo. Se interromper uma gravação, confira o resultado antes de repeti-la.';
        el.querySelector('[data-loading-cancel]').hidden = ![...pending.values()].some(
          (job) => job.cancel
        );
      }, 10000);
    }, 160);
  }
  return () => {
    pending.delete(id);
    if (pending.size) return;
    clearTimeout(timer);
    clearTimeout(noticeTimer);
    const el = document.querySelector('#portal-loading');
    if (el) {
      if (el.open) {
        el.close();
        playSound('loaded');
      }
      el.hidden = true;
    }
    document.querySelector('#app')?.removeAttribute('aria-busy');
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
