import { esc, icon } from '../shared/ui.js';
export function ritualDetails(ritual) {
  if (!ritual.casting) return '';
  const c = ritual.casting,
    label =
      ritual.origin === 'original'
        ? 'ORIGINAL DA COROA'
        : ritual.origin === 'adapted'
          ? 'ADAPTAÇÃO DA MESA'
          : 'RITUAL DA MESA';
  return `<section class="ritual-casting"><div><span class="tag red">${label}</span><strong>${icon('test')} Meta: ${esc(c.required_successes)} sucesso(s) em ${esc(c.success_on)}+</strong></div><dl><div><dt>Preparo</dt><dd>${esc(c.preparation)}</dd></div><div><dt>Duração</dt><dd>${esc(c.duration)}</dd></div><div><dt>Materiais</dt><dd>${esc(c.materials)}</dd></div></dl>${ritual.requires_narrator_approval ? '<p class="hint">Ritual excepcional: exige aprovação prévia do narrador.</p>' : ''}<p class="hint">Efeitos e custos são resolvidos na cena. A consulta não altera fome, mapa ou outros dados da ficha.</p></section>`;
}
