import { resolvePowerTest } from '../core/power-tests.js';
import { esc, icon, button } from '../shared/ui.js';
import { mechanics } from '../core/settings.js';
import { powerAccess } from '../core/power-access.js';
export function powerPool(ctx, discipline, level, index, key = 'disciplines') {
  const p = ctx.player(),
    test = mechanics(level.description, level.mechanics).mechanics.test;
  const result = resolvePowerTest(p, ctx.state.game, test, { disciplineId: discipline.id });
  if (!result) return '';
  const known = powerAccess(p, key, discipline, level).available;
  return `<div class="automatic-pool"><span class="eyebrow">NA FICHA DE ${esc(p.char)}</span><div class="pool-parts">${result.parts.map((part) => `<span><small>${esc(part.name)}</small><strong>${part.value === null ? '?' : part.value}</strong></span>`).join('<i>+</i>')}</div>${result.complete ? `<div class="pool-total"><strong>${result.total}<small>DADOS</small></strong>${button(icon('dice') + ' Preparar rolagem', 'power-prepare-roll', `data-discipline="${discipline.id}" data-catalog="${key}" data-index="${index}" ${!known || result.total < 1 ? 'disabled' : ''}`, 'button ghost')}</div>` : '<p class="hint">Esta combinação tem uma escolha ou um termo não reconhecido. Confira o teste e monte a parada manualmente.</p>'}${result.opposition ? `<small class="pool-opposition">Oposição: ${esc(result.opposition)} · valores do alvo definidos pelo narrador.</small>` : ''}${!known ? '<small class="hint">Prévia dos valores. Este nível ainda não está na sua ficha.</small>' : ''}</div>`;
}
export async function powerAction(action, data, ctx) {
  if (action !== 'power-prepare-roll') return false;
  const key = data.catalog || 'disciplines',
    d = ctx.state.game[key]?.find((d) => d.id === Number(data.discipline)),
    level = key === 'disciplines' ? d?.nivels[Number(data.index)] : d;
  if (!level || !ctx.player()) throw new Error('Abra uma ficha para preparar este teste.');
  if (!powerAccess(ctx.player(), key, d, level).available)
    throw new Error(
      key === 'disciplines'
        ? `Este poder está bloqueado. Requer ${d.name} no nível ${level.nivel}.`
        : 'Este poder ainda não foi adquirido pelo personagem.'
    );
  const result = resolvePowerTest(
    ctx.player(),
    ctx.state.game,
    mechanics(level.description, level.mechanics).mechanics.test,
    {
      disciplineId: d.id
    }
  );
  if (!result?.complete || result.total < 1) throw new Error('Confira os traços deste teste.');
  if (result.total > ctx.state.game.dice.max_pool)
    throw new Error('A parada ultrapassa o limite de dados configurado.');
  ctx.state.diceDraft = null;
  ctx.state.preparedRoll = {
    pool: result.total,
    label:
      d.name +
      (level.subname ? ' · ' + level.subname : '') +
      ' · ' +
      result.source +
      (level.casting?.required_successes
        ? ` · Meta: ${level.casting.required_successes} sucessos em ${level.casting.success_on}+`
        : '')
  };
  await ctx.go('dice');
  return true;
}
