import { esc, icon, modal } from '../shared/ui.js';
import { mechanics } from '../core/settings.js';
import { traitKind, traitPrice } from '../core/character-creation.js';
export const realMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function effectDescriptions(d, game) {
  const e = d.creation_effects || {},
    lines = [];
  for (const [key, catalog, phrase] of [
    ['attribute_set', 'atributes', 'fica em'],
    ['attribute_caps', 'atributes', 'tem limite'],
    ['discipline_grants', 'disciplines', 'recebe'],
    ['discipline_caps', 'disciplines', 'tem limite inicial']
  ])
    for (const r of e[key] || [])
      lines.push(
        `${game[catalog].find((x) => x.id === r.id)?.name || r.id} ${phrase} ${r.value}${key === 'discipline_grants' ? ' ponto(s) extra(s)' : ''}.`
      );
  for (const r of e.minimums || [])
    lines.push(`Exige ${game[r.key].find((x) => x.id === r.id)?.name || r.id} ${r.value}.`);
  for (const id of e.requires_traits || [])
    lines.push('Exige ' + (game.caracteristics.find((x) => x.id === id)?.name || id) + '.');
  if (e.requires_clans?.length) lines.push('Disponível para: ' + e.requires_clans.join(', ') + '.');
  if (e.forbidden_clans?.length)
    lines.push('Não disponível para: ' + e.forbidden_clans.join(', ') + '.');
  for (const id of e.forbidden_disciplines || [])
    lines.push('Impede aprender ' + (game.disciplines.find((x) => x.id === id)?.name || id) + '.');
  if (e.humanity_min !== undefined) lines.push('Exige Humanidade ' + e.humanity_min + '.');
  return lines;
}
export function ruleContent(d, key, game) {
  const effects = effectDescriptions(d, game);
  const power = (n) => {
    const m = mechanics(n.description, n.mechanics);
    return `<div class="power-badges"><span class="power-badge">${icon('blood')} ${m.mechanics.rouse_check === null ? 'Despertar não informado' : m.mechanics.rouse_check ? 'Exige Despertar' : 'Sem Despertar'}</span><span class="power-badge">${icon('test')} ${esc(m.mechanics.test || 'Sem teste')}</span></div><p class="prose">${esc(m.description)}</p>`;
  };
  return `<div class="rule-reader"><div class="rule-reader-tags"><span class="tag">SOMENTE CONSULTA</span>${d.type ? `<span class="tag">${esc(d.type)}</span>` : ''}${traitKind(d) ? `<span class="tag red">${traitPrice(d)} ponto(s) ${traitKind(d) === 'flaw' ? 'recebidos' : 'de custo'}</span>` : ''}</div>${d.short_description ? `<p class="muted">${esc(d.short_description)}</p>` : ''}<p class="prose">${esc(d.description || 'Sem descrição cadastrada.')}</p>${d.levels?.length ? `<table class="background-levels"><thead><tr><th>Nível</th><th>O que representa</th></tr></thead><tbody>${d.levels.map((l) => `<tr><td>${l.level}</td><td>${esc(l.description)}</td></tr>`).join('')}</tbody></table>` : ''}${
    d.creation_effect === 'generation'
      ? '<p class="creation-effect-note">Na criação: 13ª geração − pontos em Geração, até a 8ª geração.</p>'
      : d.creation_effect === 'capital'
        ? `<p class="creation-effect-note">O capital inicial é calculado uma única vez na criação. Ganhos posteriores e renda ficam com o narrador.</p><div class="creation-resource-levels">${Object.entries(
            game.character_creation.guided.capital_by_level
          )
            .map(
              ([level, value]) =>
                `<span>${level} ponto(s)<strong>${realMoney(value)}</strong></span>`
            )
            .join('')}</div>`
        : ''
  }${effects.length ? `<section class="creation-effect-note"><h3>Efeitos conferidos na criação</h3><ul>${effects.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>` : ''}${traitKind(d) ? '<p class="hint">O custo usa pontos bônus, nunca XP. Efeitos ligados à situação da cena continuam dependendo da aplicação pelo narrador.</p>' : ''}${key === 'disciplines' ? `<section class="rule-reader-powers"><h3>Poderes e níveis</h3>${(d.nivels || []).map((n, i) => `<details ${i === 0 ? 'open' : ''}><summary><span class="tag">${n.nivel}</span> ${esc(n.subname || 'Poder sem nome')}</summary>${power(n)}</details>`).join('') || '<p class="hint">Esta disciplina usa linhas cadastradas separadamente.</p>'}</section>` : key === 'rituals' ? power(d) : ''}</div>`;
}
export function showRuleContent(d, key, game) {
  modal(d.name, ruleContent(d, key, game), null, { wide: true });
}
