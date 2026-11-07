import { blank, clone, fail, number, text } from './model.js';
import { catalogId, creationKeys, skillKeys, normalizedName } from './creation-config.js';
const family = (key) => (skillKeys.includes(key) ? 'skills' : key);
const valueField = (key) => (key === 'disciplines' ? 'nivel' : 'value');
const sum = (map) => Object.values(map || {}).reduce((s, v) => s + v, 0);
export const traitKind = (d) =>
  normalizedName(d.type) === 'defeito'
    ? 'flaw'
    : normalizedName(d.type) === 'qualidade'
      ? 'merit'
      : null;
export const traitPrice = (d) => Math.abs(Number(d.value || 0));
export function emptyCreation(game) {
  const c = game.character_creation.guided;
  return {
    version: 1,
    clan: '',
    disciplines: [],
    primary_paths: {},
    traits: [],
    initial: Object.fromEntries(
      creationKeys.map((k) => [
        k,
        Object.fromEntries(k === 'atributes' ? game[k].map((d) => [d.id, c.attribute_base]) : [])
      ])
    ),
    bonus: Object.fromEntries(creationKeys.map((k) => [k, {}]))
  };
}
export function chooseClan(plan, clanId, game) {
  const next = clone(plan),
    clan = game.character_creation.guided.clans.find((c) => c.id === clanId);
  next.clan = clanId;
  next.disciplines = clan?.disciplines.filter((id) => id !== null) || [];
  next.initial.disciplines = Object.fromEntries(next.disciplines.map((id) => [id, 0]));
  next.bonus.disciplines = {};
  next.primary_paths = {};
  return next;
}
export function selectedTraits(plan, game) {
  return (plan.traits || [])
    .map((row) => ({ ...row, definition: game.caracteristics.find((d) => d.id === row.id) }))
    .filter((row) => row.definition);
}
export function creationConstraints(plan, game) {
  const effects = selectedTraits(plan, game).map((r) => r.definition.creation_effects || {});
  const result = {
    attribute_set: {},
    attribute_caps: {},
    discipline_grants: {},
    discipline_caps: {}
  };
  for (const effect of effects)
    for (const key of Object.keys(result))
      for (const row of effect[key] || []) {
        if (key === 'discipline_grants')
          result[key][row.id] = (result[key][row.id] || 0) + row.value;
        else if (key.endsWith('_caps'))
          result[key][row.id] = Math.min(result[key][row.id] ?? 5, row.value);
        else result[key][row.id] = row.value;
      }
  return result;
}
export function reconcileCreation(plan, game) {
  const next = clone(plan),
    e = creationConstraints(next, game),
    c = game.character_creation.guided;
  for (const d of game.atributes) {
    const forced = e.attribute_set[d.id];
    if (forced !== undefined) {
      next.initial.atributes[d.id] = forced;
      next.bonus.atributes[d.id] = 0;
    } else if (next.initial.atributes[d.id] < c.attribute_base)
      next.initial.atributes[d.id] = c.attribute_base;
  }
  return next;
}
function cleanPlan(source, game) {
  if (!source || source.version !== 1)
    fail('Use o assistente de criação para detalhar os pontos iniciais e bônus.');
  const plan = emptyCreation(game);
  plan.clan = text(source.clan, 'Clã da criação', 60);
  if (
    !Array.isArray(source.disciplines) ||
    source.disciplines.length > 3 ||
    new Set(source.disciplines).size !== source.disciplines.length
  )
    fail('Selecione três disciplinas diferentes.');
  plan.disciplines = source.disciplines.map((id) => {
    number(id, 'Disciplina');
    if (!game.disciplines.some((d) => d.id === id)) fail('Disciplina não cadastrada.');
    return id;
  });
  for (const stage of ['initial', 'bonus']) {
    if (!source[stage] || typeof source[stage] !== 'object' || Array.isArray(source[stage]))
      fail('Distribuição da criação inválida.');
    if (Object.keys(source[stage]).some((k) => !creationKeys.includes(k)))
      fail('Categoria de criação desconhecida.');
    for (const key of creationKeys) {
      const values = source[stage][key] || {};
      if (
        typeof values !== 'object' ||
        Array.isArray(values) ||
        Object.keys(values).length > game[key].length
      )
        fail('Distribuição de pontos inválida.');
      plan[stage][key] = {};
      for (const [id, value] of Object.entries(values)) {
        if (!game[key].some((d) => String(d.id) === id)) fail('Traço de criação não cadastrado.');
        plan[stage][key][id] = number(value, 'Pontos de criação', 0, 5);
      }
    }
  }
  if (
    !source.primary_paths ||
    typeof source.primary_paths !== 'object' ||
    Array.isArray(source.primary_paths) ||
    Object.keys(source.primary_paths).length > 3
  )
    fail('Linhas iniciais inválidas.');
  for (const [id, path] of Object.entries(source.primary_paths)) {
    if (!plan.disciplines.includes(Number(id)))
      fail('A linha inicial precisa pertencer a uma das disciplinas do clã.');
    number(path, 'Linha inicial');
    if (
      !game.disciplines.some((d) => d.id === path && d.parent_discipline_ids?.includes(Number(id)))
    )
      fail('Esta linha não pertence à disciplina selecionada.');
    plan.primary_paths[id] = path;
  }
  if (
    !Array.isArray(source.traits) ||
    source.traits.length > 100 ||
    new Set(source.traits.map((t) => t.id)).size !== source.traits.length
  )
    fail('Qualidades ou defeitos repetidos ou inválidos.');
  plan.traits = source.traits.map((row) => {
    const def = game.caracteristics.find((d) => d.id === row.id);
    if (!def || !traitKind(def) || def.availability === 'filtered')
      fail('Qualidade ou defeito indisponível.');
    number(traitPrice(def), 'Custo da qualidade ou defeito', 0, 20);
    return { id: def.id, notes: text(row.notes || '', 'Detalhes da qualidade ou defeito', 3000) };
  });
  return plan;
}
export function evaluateCreation(source, game) {
  const c = game.character_creation.guided,
    plan = cleanPlan(source.creation, game),
    effects = creationConstraints(plan, game),
    issues = [],
    warnings = [],
    issue = (key, message, stage = 'review') => issues.push({ key, message, stage });
  const clan = c.clans.find((row) => row.id === plan.clan);
  if (!clan && plan.clan !== 'custom')
    issue('clan', 'Escolha um clã ou a opção Clã personalizado.', 'identity');
  if (plan.disciplines.length !== 3)
    issue('disciplines', 'Escolha as três disciplinas do clã.', 'identity');
  if (
    clan &&
    (clan.disciplines.some((id) => id === null) ||
      clan.disciplines.some((id) => !plan.disciplines.includes(id)))
  )
    issue(
      'disciplines',
      'As disciplinas precisam corresponder ao clã. Para outra combinação, use Clã personalizado.',
      'identity'
    );
  const clanName = clan?.name || source.cla || '',
    clanKey = normalizedName(clanName);
  if (plan.clan === 'custom')
    warnings.push(
      'Clã personalizado: nome, disciplinas e combinação precisam da aprovação manual do narrador.'
    );
  const p = blank(game, source.id);
  p.char = source.char || '';
  p.player = source.player || '';
  p.cla = clanName;
  for (const key of ['biography', 'profilepicture', 'portrait_frame', 'aspirations', 'moralityes'])
    if (source[key] !== undefined) p[key] = clone(source[key]);
  p.creation = plan;
  const used = { atributes: 0, skills: 0, precedents: 0, disciplines: 0 };
  let bonusUsed = 0;
  for (const key of creationKeys) {
    const definitions =
      key === 'disciplines' ? game[key].filter((d) => plan.disciplines.includes(d.id)) : game[key];
    const rows = [];
    for (const d of definitions) {
      const initial = plan.initial[key][d.id] ?? (key === 'atributes' ? c.attribute_base : 0),
        bonus = plan.bonus[key][d.id] || 0,
        forced = key === 'atributes' ? effects.attribute_set[d.id] : undefined,
        initialMax = c.initial_max[family(key)];
      if (
        initial > initialMax ||
        (key === 'atributes' && forced === undefined && initial < c.attribute_base)
      )
        issue(
          key,
          `${d.name}: nível inicial fora do limite ${key === 'atributes' ? c.attribute_base : 0}–${initialMax}.`,
          'initial'
        );
      if (forced !== undefined && (initial !== forced || bonus))
        issue(
          key,
          `${d.name}: deve permanecer em ${forced} por causa de uma qualidade ou defeito.`,
          'bonus'
        );
      const grants = key === 'disciplines' ? effects.discipline_grants[d.id] || 0 : 0;
      const total = forced ?? initial + bonus + grants;
      const cap = Math.min(
        c.max_level,
        key === 'atributes'
          ? (effects.attribute_caps[d.id] ?? c.max_level)
          : key === 'disciplines'
            ? (effects.discipline_caps[d.id] ?? c.max_level)
            : c.max_level
      );
      if (total > cap) issue(key, `${d.name}: limite final ${cap}; você marcou ${total}.`, 'bonus');
      used[family(key)] += key === 'atributes' ? Math.max(0, initial - c.attribute_base) : initial;
      bonusUsed += bonus * c.bonus_costs[family(key)];
      rows.push({ id: d.id, [valueField(key)]: total });
    }
    if (key === 'disciplines')
      for (const stage of ['initial', 'bonus'])
        if (
          Object.keys(plan[stage].disciplines).some((id) => !plan.disciplines.includes(Number(id)))
        )
          issue(key, 'Distribua pontos somente nas três disciplinas selecionadas.', stage);
    p[key] = rows;
  }
  for (const [id, amount] of Object.entries(effects.discipline_grants)) {
    if (!p.disciplines.some((d) => d.id === Number(id)))
      p.disciplines.push({ id: Number(id), nivel: amount });
  }
  p.primary_paths = {};
  for (const id of plan.disciplines) {
    const def = game.disciplines.find((d) => d.id === id);
    if (!def.is_path_parent) continue;
    const pathId = plan.primary_paths[id];
    if (pathId === undefined) {
      issue(
        'disciplines',
        `Escolha a linha inicial de ${def.name}, mesmo que comece no nível 0.`,
        'identity'
      );
      continue;
    }
    if (plan.disciplines.includes(pathId) || Object.values(p.primary_paths).includes(pathId)) {
      issue(
        'disciplines',
        'A linha inicial não pode ocupar outro dos três lugares de disciplina.',
        'identity'
      );
      continue;
    }
    p.primary_paths[id] = pathId;
    p.disciplines.push({ id: pathId, nivel: p.disciplines.find((d) => d.id === id).nivel });
  }
  const traits = selectedTraits(plan, game),
    groups = new Set();
  let flawPoints = 0,
    flaws = 0,
    meritPoints = 0;
  for (const row of traits) {
    const d = row.definition,
      kind = traitKind(d),
      e = d.creation_effects || {};
    if (kind === 'flaw') {
      flaws++;
      flawPoints += traitPrice(d);
    } else meritPoints += traitPrice(d);
    const group = d.mutually_exclusive_group;
    if (group && groups.has(group))
      issue('caracteristics', 'Escolha apenas uma versão de ' + d.name + '.', 'bonus');
    if (group) groups.add(group);
    for (const id of e.requires_traits || [])
      if (!plan.traits.some((t) => t.id === id))
        issue(
          'caracteristics',
          `${d.name} exige ${game.caracteristics.find((x) => x.id === id)?.name || 'outra característica'}.`,
          'bonus'
        );
    for (const id of e.excludes || [])
      if (plan.traits.some((t) => t.id === id))
        issue(
          'caracteristics',
          `${d.name} é incompatível com ${game.caracteristics.find((x) => x.id === id)?.name}.`,
          'bonus'
        );
    if (e.requires_clans?.length && !e.requires_clans.map(normalizedName).includes(clanKey))
      issue('caracteristics', d.name + ' não está disponível para este clã.', 'bonus');
    if (e.forbidden_clans?.map(normalizedName).includes(clanKey))
      issue('caracteristics', d.name + ' não concede pontos ou vantagens para este clã.', 'bonus');
    if (e.humanity_min !== undefined && p.status.humanity < e.humanity_min)
      issue('caracteristics', `${d.name} exige Humanidade ${e.humanity_min}.`, 'bonus');
    for (const r of e.minimums || [])
      if ((p[r.key]?.find((x) => x.id === r.id)?.[valueField(r.key)] || 0) < r.value)
        issue(
          'caracteristics',
          `${d.name} exige ${game[r.key].find((x) => x.id === r.id)?.name} ${r.value}.`,
          'bonus'
        );
    for (const id of e.forbidden_disciplines || [])
      if ((p.disciplines.find((d) => d.id === id)?.nivel || 0) > 0)
        issue('caracteristics', d.name + ' impede o aprendizado desta disciplina.', 'bonus');
    if (!Object.keys(e).length)
      warnings.push(
        `${d.name}: efeitos condicionais e narrativos devem ser conferidos pelo narrador.`
      );
  }
  if (flaws > c.max_flaws)
    issue('caracteristics', `Máximo de ${c.max_flaws} defeitos por ficha.`, 'bonus');
  const pairs = [
    ['sono leve', 'sono pesado'],
    ['visao tenebrosa controlavel', 'visao tenebrosa incontrolavel']
  ];
  for (const names of pairs)
    if (names.every((name) => traits.some((t) => normalizedName(t.definition.name) === name)))
      issue('caracteristics', 'Qualidades e defeitos incompatíveis selecionados.', 'bonus');
  const generationId =
      game.precedents.find((d) => d.creation_effect === 'generation')?.id ??
      catalogId(game, 'precedents', 'Geração'),
    resourcesId =
      game.precedents.find((d) => d.creation_effect === 'capital')?.id ??
      catalogId(game, 'precedents', 'Recursos'),
    generationPoints = p.precedents.find((r) => r.id === generationId)?.value || 0,
    resources = p.precedents.find((r) => r.id === resourcesId)?.value || 0;
  p.generation = c.generation_base - generationPoints;
  if (p.generation < c.generation_min)
    issue('precedents', `A menor geração inicial é ${c.generation_min}ª.`, 'bonus');
  p.bloodpotency = game.bloodpotency_generation[p.generation]?.min ?? 0;
  const capital = c.capital_by_level[resources] ?? 0;
  p.money = game.character_creation.starting_money + capital;
  p.xp = game.character_creation.starting_xp;
  p.caracteristics = plan.traits.map((r) => ({ ...r }));
  for (const row of p.precedents) {
    const d = game.precedents.find((d) => d.id === row.id);
    if (
      row.value &&
      d.allowed_clans?.length &&
      !d.allowed_clans.map(normalizedName).includes(clanKey)
    )
      issue('precedents', d.name + ' exige o clã ' + d.allowed_clans.join(', ') + '.', 'initial');
    if (row.value && normalizedName(d.name) === 'status' && clanKey === 'caitiff')
      issue('precedents', 'Caitiff não adquire Status na criação.', 'initial');
  }
  const available = c.bonus_points + flawPoints;
  bonusUsed += meritPoints;
  const totals = Object.fromEntries(
    Object.keys(used).map((k) => [k, { used: used[k], budget: c.initial[k] }])
  );
  for (const [key, total] of Object.entries(totals))
    if (total.used !== total.budget)
      issue(
        key,
        `${key === 'skills' ? 'Habilidades' : { atributes: 'Atributos', precedents: 'Antecedentes', disciplines: 'Disciplinas' }[key]}: distribua ${total.budget} pontos iniciais; foram usados ${total.used}.`,
        'initial'
      );
  totals.bonus = {
    used: bonusUsed,
    budget: available,
    base: c.bonus_points,
    flaws: flawPoints,
    merits: meritPoints,
    remaining: available - bonusUsed
  };
  if (bonusUsed > available)
    issue(
      'bonus',
      `Faltam ${bonusUsed - available} pontos bônus. Reduza compras ou escolha um defeito válido.`,
      'bonus'
    );
  // Keeping unused bonus points is explicit and never converts them into XP.
  if (bonusUsed < available)
    warnings.push(
      `${available - bonusUsed} ponto(s) bônus não utilizados. Eles não viram XP e não poderão ser gastos depois da aprovação.`
    );
  const report = {
    guided: true,
    issues,
    warnings,
    totals,
    derived: {
      generation: p.generation,
      capital,
      money: p.money,
      resources,
      flaws,
      primary_paths: p.primary_paths
    }
  };
  return { character: p, report };
}
export function creationReport(character, game) {
  if (character.creation) {
    try {
      const { character: expected, report } = evaluateCreation(character, game);
      for (const key of [
        ...creationKeys,
        'caracteristics',
        'primary_paths',
        'generation',
        'money',
        'xp',
        'bloodpotency'
      ])
        if (JSON.stringify(character[key] ?? null) !== JSON.stringify(expected[key] ?? null)) {
          report.issues.push({
            key,
            message:
              'A ficha foi ajustada fora do cálculo do assistente. Confira ' +
              key +
              ' antes de aprovar.',
            stage: 'review'
          });
        }
      return report;
    } catch (e) {
      return {
        guided: true,
        issues: [{ key: 'creation', message: e.message, stage: 'review' }],
        warnings: [],
        totals: {}
      };
    }
  }
  const issues = [],
    totals = {};
  if (game.character_creation.guided.enabled)
    issues.push({
      key: 'creation',
      message:
        'Ficha sem etapas de criação registradas. Confira a distribuição e justifique a aprovação manual.',
      stage: 'review'
    });
  for (const [key, budget] of Object.entries(game.character_creation.budgets)) {
    const used = (character[key] || []).reduce((s, row) => s + (row[valueField(key)] || 0), 0);
    totals[key] = { used, budget };
    if (budget !== null && used > budget)
      issues.push({ key, message: `${key}: ${used} pontos para um limite de ${budget}.` });
  }
  return {
    issues,
    totals,
    warnings: [
      'Ficha sem etapas de criação registradas: a distribuição exige conferência manual do narrador.'
    ],
    guided: false
  };
}
