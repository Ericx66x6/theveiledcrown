import { playSound } from '../client/audio.js';
export const $ = (selector, root = document) => root.querySelector(selector);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const crown = `<svg viewBox="0 0 80 64" fill="none" aria-hidden="true"><path d="M13 19l9 31h36l9-31-18 14-9-23-9 23-18-14zM23 56h34" stroke="currentColor" stroke-width="2"/><path d="M40 2v5M5 13l5 3M75 13l-5 3M40 32v12" stroke="currentColor"/><circle cx="13" cy="17" r="2" fill="currentColor"/><circle cx="40" cy="8" r="2" fill="currentColor"/><circle cx="67" cy="17" r="2" fill="currentColor"/></svg>`;
const paths = {
 intel:'M3 4h18v16H3zM7 8h10M7 12h6M7 16h4',
 legacies:'M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z',
 social:'M3 4h18v12H9l-6 5zM7 8h10M7 12h6',
 map:'M3 7l6-3 6 3 6-3v16l-6 2-6-3-6 3zM9 4v15M15 7v15',quests:'M5 3h14v18H5zM8 7h8M8 11l2 2 5-5M8 17h8',notes:'M4 3h16v18H4zM8 8h8M8 12h8M8 16h5',network:'M7 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0M23 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0M15 20a3 3 0 1 0-6 0 3 3 0 0 0 6 0M7 7h10M5 9l5 8M19 9l-5 8',profile:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 8 0 0 1 16 0v2',blood:'M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z',test:'M4 5h16v14H4zM8 10l3 3 5-6',clock:'M12 8v5l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',pin:'M12 22s7-8 7-13a7 7 0 0 0-14 0c0 5 7 13 7 13zM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',favour:'M3 12l5 6 4-3 4 3 5-6-5-5-4 2-4-2-5 5z',volume:'M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14',
 overview:'M3 10l9-7 9 7v10H3zM9 20v-7h6v7', attributes:'M5 4v16M12 4v16M19 4v16M2 8h6M9 16h6M16 10h6',
 powers:'M12 2l-7 11h7l-1 9 8-12h-7z', world:'M3 7l6-3 6 3 6-3v16l-6 2-6-3-6 3zM9 4v15M15 7v15',
 possessions:'M4 8h16v13H4zM8 8V4h8v4M4 13h16M10 13v3h4v-3', chronicle:'M4 3h13l3 3v16H4zM8 8h7M8 12h8M8 16h6',
 dice:'M8 2h8l6 6v8l-6 6H8l-6-6V8zM8 2l-6 6h20M2 16h20M8 22l4-14 4 14',
 characters:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M18 8a3 3 0 0 1 0 6M22 21v-3a4 4 0 0 0-3-4M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
 accounts:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6', rules:'M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4zM12 6v16',
 plus:'M12 5v14M5 12h14', arrow:'M4 12h16M14 6l6 6-6 6', search:'M21 21l-6-6M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
 logout:'M9 4H4v16h5M9 12h12M17 8l4 4-4 4', edit:'M4 16l12-12 4 4L8 20H4zM14 6l4 4', close:'M6 6l12 12M18 6L6 18',
 save:'M4 3h13l4 4v14H3V3zM8 3v6h8V3M7 21v-8h10v8', download:'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',
 refresh:'M20 8a8 8 0 1 0 0 8M20 3v6h-6', lock:'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3', menu:'M3 6h18M3 12h18M3 18h18',
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.overview}"/></svg>`;
export const button = (label, action, extra = '', cls = 'button') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
export const dots = (value, max = 5) => `<span class="dots" aria-label="Nível ${esc(value)} de ${max}">${Array.from({length:max}, (_, i) => `<i class="${i < value ? 'filled' : ''}"></i>`).join('')}</span>`;
export const empty = (title, description, action = '') => `<div class="empty"><div class="empty-symbol">${icon('world')}</div><h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
export const date = value => value ? new Date(value).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}) : 'Ainda sem alterações';
export const field = (name, label, value = '', type = 'text', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const area = (name, label, value = '', extra = '') => `<label class="field full"><span>${label}</span><textarea name="${name}" rows="5" ${extra}>${esc(value)}</textarea></label>`;
export const select = (name, label, options, value = '') => `<label class="field"><span>${label}</span><select name="${name}">${options.map(o => `<option value="${esc(o.value ?? o)}" ${String(o.value ?? o) === String(value) ? 'selected' : ''}>${esc(o.label ?? o)}</option>`).join('')}</select></label>`;
export function toast(message, error = false) {
  playSound(error?'error':'success');
  const host = $('#toasts');
  const node = document.createElement('div');
  node.className = `toast ${error ? 'error' : ''}`;
  node.setAttribute('role', error ? 'alert' : 'status');
  node.textContent = message;
  host.append(node);
  setTimeout(() => node.remove(), 6500);
}
let opener,cancelCallback=null;
export function closeModal(confirmed=false) { const cb=cancelCallback;cancelCallback=null;$('#modal').close();if(!confirmed)cb?.();opener?.focus(); }
export function modal(title, content, submit, {wide = false, saveLabel = 'Salvar alterações',onCancel=null} = {}) {
  const dialog = $('#modal');
  if (dialog.open) closeModal();
  cancelCallback=onCancel;
  dialog.oncancel=event=>{event.preventDefault();closeModal();};
  opener = document.activeElement;
  dialog.className = wide ? 'wide' : '';
  dialog.innerHTML = `<form id="dialog-form"><div class="modal-head"><div><span class="eyebrow">A COROA VELADA</span><h2 id="dialog-title">${esc(title)}</h2></div><button type="button" class="icon-button" data-close aria-label="Fechar">${icon('close')}</button></div><div class="modal-body">${content}</div><p class="form-error" id="dialog-error" role="alert"></p><footer class="modal-footer"><button type="button" class="button ghost" data-close>Fechar</button>${submit ? `<button class="button primary" type="submit">${icon('save')} ${esc(saveLabel)}</button>` : ''}</footer></form>`;
  dialog.querySelectorAll('[data-close]').forEach(el => el.onclick = ()=>closeModal());
  $('#dialog-form').onsubmit = async event => {
    event.preventDefault();
    const control = event.submitter||event.target.querySelector('[type=submit]');
    if (!submit || control.disabled) return;
    control.disabled = true;
    $('#dialog-error').textContent = '';
    try { await submit(new FormData(event.target), event.target); closeModal(true); }
    catch (error) { $('#dialog-error').textContent = error.message; }
    finally { control.disabled = false; }
  };
  dialog.showModal();
  playSound('open');
}
export function download(name, data) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
  link.href = url; link.download = name; link.hidden = true; document.body.appendChild(link); link.click();
  setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 10000);
}
