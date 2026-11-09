import { creationConstraints } from '../core/character-creation.js';
import { skillKeys } from '../core/creation-config.js';
import { normalizedName } from '../core/creation-config.js';
export function traitRestriction(wizard, definition) {
  const effects = definition.creation_effects || {};
  const clan = normalizedName(wizard.p.cla);
  if (effects.requires_clans?.length && !effects.requires_clans.map(normalizedName).includes(clan))
    return `Disponível para ${effects.requires_clans.join(', ')}. Escolha outra característica para o seu clã.`;
  if (effects.forbidden_clans?.map(normalizedName).includes(clan))
    return `Esta característica não está disponível para ${wizard.p.cla}.`;
  return '';
}
export function allocationControl(wizard, key, id, bonus) {
  const c = wizard.game.character_creation.guided;
  const effects = creationConstraints(wizard.plan, wizard.game);
  const family = skillKeys.includes(key) ? 'skills' : key;
  const initial = wizard.plan.initial[key][id] ?? (key === 'atributes' ? c.attribute_base : 0);
  const extra = wizard.plan.bonus[key][id] || 0;
  const fixed = key === 'atributes' ? effects.attribute_set[id] : undefined;
  const grants = key === 'disciplines' ? effects.discipline_grants[id] || 0 : 0;
  const value = fixed ?? (bonus ? initial + extra + grants : initial);
  const cap = Math.min(
    bonus ? c.max_level : c.initial_max[family],
    key === 'atributes'
      ? (effects.attribute_caps[id] ?? 5)
      : key === 'disciplines'
        ? (effects.discipline_caps[id] ?? 5)
        : 5
  );
  const remaining =
    wizard.report.totals[bonus ? 'bonus' : family].budget -
    wizard.report.totals[bonus ? 'bonus' : family].used;
  const cost = bonus ? c.bonus_costs[family] : 1;
  const minimum = key === 'atributes' ? c.attribute_base : 0;
  let reason = '';
  const definition = wizard.game[key].find((d) => d.id === id);
  const clanName =
    wizard.game.character_creation.guided.clans.find((c) => c.id === wizard.plan.clan)?.name ||
    wizard.source?.cla ||
    '';
  if (
    key === 'precedents' &&
    definition.allowed_clans?.length &&
    !definition.allowed_clans.map(normalizedName).includes(normalizedName(clanName))
  )
    reason = `Este antecedente está disponível para ${definition.allowed_clans.join(', ')}. Escolha outro vínculo para a sua história.`;
  else if (
    key === 'precedents' &&
    wizard.plan.clan === 'caitiff' &&
    normalizedName(definition.name) === 'status'
  )
    reason =
      'Caitiff não começa com Status. Use estes pontos em outros antecedentes, como Recursos, Contatos ou Aliados.';
  else if (fixed !== undefined)
    reason =
      wizard.plan.clan === 'nosferatu'
        ? 'Fraqueza Nosferatu: Aparência permanece em 0, inclusive nos bônus e na evolução com XP.'
        : 'Esta característica fixa o valor deste atributo. Ele não recebe pontos adicionais.';
  else if (value >= cap)
    reason = bonus
      ? `Você chegou ao limite ${cap} deste traço na criação.`
      : `O limite desta primeira distribuição é ${cap}. Primeiro todos montam uma base equilibrada; na etapa de pontos bônus você poderá chegar até ${Math.min(c.max_level, key === 'atributes' ? (effects.attribute_caps[id] ?? 5) : key === 'disciplines' ? (effects.discipline_caps[id] ?? 5) : 5)}.`;
  else if (remaining < cost)
    reason = bonus
      ? `Este nível custa ${cost} PB e você tem ${remaining}. Continue para outra categoria ou devolva uma compra para reorganizar seus bônus.`
      : 'Você já distribuiu todos os pontos desta etapa. Toque em Continuar ou devolva um ponto para reorganizar.';
  return {
    initial,
    extra,
    value,
    cap,
    fixed,
    grants,
    cost,
    remaining,
    canIncrease: !reason,
    canDecrease: fixed === undefined && (bonus ? extra > 0 : initial > minimum),
    reason
  };
}
