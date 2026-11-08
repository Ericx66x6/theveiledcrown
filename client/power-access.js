import { esc, icon } from '../shared/ui.js';
export function powerAccessLabel(access) {
  const label =
    access.state === 'available'
      ? 'LIBERADO'
      : access.state === 'locked'
        ? 'BLOQUEADO'
        : 'CONSULTA';
  return `<span class="power-access-label ${access.state}">${icon(access.available ? 'test' : access.state === 'locked' ? 'lock' : 'rules')}${label}</span>`;
}
export function powerAccessNotice(access, definition, key = 'disciplines') {
  if (access.state === 'reference') return '';
  return `<div class="power-access-notice ${access.state}" role="note">${icon(access.available ? 'test' : 'lock')}<div><strong>${access.available ? 'LIBERADO PARA USAR' : 'PODER BLOQUEADO'}</strong><p>${
    access.available
      ? 'Este poder já pertence ao personagem.'
      : key === 'disciplines'
        ? `Requer ${esc(definition.name)} no nível ${access.required}. Sua ficha está no nível ${access.current}. Você pode consultar, mas ainda não pode usar este poder.`
        : 'Você pode consultar a descrição, mas este poder ainda não foi adquirido.'
  }</p></div></div>`;
}
