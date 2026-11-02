import { clone, fail, number } from './model.js';
export const traitKeys = [
  'atributes',
  'talents',
  'expertises',
  'knowledges',
  'precedents',
  'disciplines',
  'bloodpotency'
];
const statusMax = {
  hunger: 6,
  humanity: 5,
  sdamage: 10,
  adamage: 10,
  willpower: 10,
  inspiration: 1
};
export function mechanics(description, explicit = {}) {
  let body = description || '',
    rouse = null,
    test = null;
  const prefix = body.match(/^\s*\[([^\]]+)\]\s*/);
  if (prefix && /(?:rouse|house)\s*check|teste?\s*:/i.test(prefix[1])) {
    for (const part of prefix[1].split(/\|\||\||;/)) {
      const match = part.match(/(?:rouse|house)\s*check\s*:\s*(.*)/i);
      if (match) rouse = /^sim|^yes/i.test(match[1].trim());
      const t = part.match(/teste?\s*:\s*(.*)/i);
      if (t && !/^(nenhum|não|nao|none)$/i.test(t[1].trim())) test = t[1].trim();
    }
    body = body.slice(prefix[0].length);
  }
  return {
    description: body,
    mechanics: {
      rouse_check: Object.hasOwn(explicit, 'rouse_check') ? explicit.rouse_check : rouse,
      test: explicit.test === undefined ? test : explicit.test
    }
  };
}
export function gameSettings(source) {
  const g = clone(source);
  g.schema_version = 6;
  g._revision ??= 0;
  g.status_rules ??= {};
  for (const [key, max] of Object.entries(statusMax))
    g.status_rules[key] = { min: 0, max, ...g.status_rules[key] };
  g.progression ??= {};
  g.progression.confirmation_seconds ??= 1;
  g.progression.require_confirmation ??= true;
  g.progression.categories ??= {};
  for (const key of traitKeys)
    g.progression.categories[key] = {
      enabled: key !== 'precedents',
      basis: 'current',
      multiplier: g.xp_cost[key] || 5,
      zero_level_cost: 1,
      max_level: null,
      allow_new: false,
      ...g.progression.categories[key]
    };
  g.interface = {
    status_confirmation_seconds: 2,
    animations: true,
    sound: false,
    hunger_warning: 4,
    ...g.interface
  };
  g.dice = { sides: 10, success_on: 6, highlight_hunger: true, max_pool: 40, ...g.dice };
  g.quests = {
    max_xp_reward: 10000,
    max_money_reward: 1000000,
    require_narrator_completion: true,
    ...g.quests
  };
  g.character_creation = {
    enabled: true,
    require_approval: true,
    starting_xp: 0,
    starting_money: 0,
    max_characters_per_player: 12,
    budgets: {
      atributes: null,
      talents: null,
      expertises: null,
      knowledges: null,
      precedents: null,
      disciplines: null
    },
    ...g.character_creation
  };
  g.character_creation.budgets = {
    atributes: null,
    talents: null,
    expertises: null,
    knowledges: null,
    precedents: null,
    disciplines: null,
    ...g.character_creation.budgets
  };
  g.rulebook ??= [];
  g.labels ??= {};
  g.disciplines = (g.disciplines || []).map((d) => ({
    ...d,
    nivels: (d.nivels || []).map((level) => ({
      ...level,
      ...mechanics(level.description, level.mechanics)
    }))
  }));
  return g;
}
export function validateSettings(g) {
  number(g._revision, 'Revisão das regras');
  if (
    typeof g.character_creation.enabled !== 'boolean' ||
    g.character_creation.require_approval !== true
  )
    fail('Criação de personagem deve exigir aprovação do narrador.');
  number(g.character_creation.starting_xp, 'XP inicial', 0, 1000000);
  moneyValue(g.character_creation.starting_money, 'Dinheiro inicial');
  if (g.character_creation.starting_money < 0) fail('Dinheiro inicial inválido.');
  number(g.character_creation.max_characters_per_player, 'Personagens por jogador', 1, 100);
  for (const budget of Object.values(g.character_creation.budgets))
    if (budget !== null) number(budget, 'Orçamento de criação', 0, 1000);
  if (!Array.isArray(g.rulebook) || g.rulebook.length > 100) fail('Capítulos do livro inválidos.');
  const ids = new Set();
  for (const section of g.rulebook) {
    if (typeof section.id !== 'string' || !section.id || ids.has(section.id))
      fail('Capítulo repetido ou inválido.');
    ids.add(section.id);
    if (typeof section.title !== 'string' || !section.title.trim() || section.title.length > 200)
      fail('Nome de capítulo inválido.');
    if (!Array.isArray(section.entries) || section.entries.length > 500)
      fail('Conteúdos do livro inválidos.');
    const entries = new Set();
    for (const entry of section.entries) {
      if (typeof entry.id !== 'string' || !entry.id || entries.has(entry.id))
        fail('Entrada de livro inválida.');
      entries.add(entry.id);
      if (
        typeof entry.title !== 'string' ||
        !entry.title.trim() ||
        entry.title.length > 200 ||
        typeof entry.body !== 'string' ||
        entry.body.length > 50000
      )
        fail('Texto do livro inválido.');
    }
  }

  number(g.interface.status_confirmation_seconds, 'Espera de confirmação', 0, 30);
  number(g.interface.hunger_warning, 'Alerta de fome', 0, g.status_rules.hunger.max);
  number(g.progression.confirmation_seconds, 'Espera da evolução', 0, 15);
  for (const [key, s] of Object.entries(g.status_rules)) {
    number(s.min, 'Mínimo de ' + key, 0, 100);
    number(s.max, 'Máximo de ' + key, s.min, 100);
  }
  for (const rule of Object.values(g.progression.categories)) {
    if (!['current', 'target', 'fixed'].includes(rule.basis)) fail('Base de custo de XP inválida.');
    if (typeof rule.enabled !== 'boolean' || typeof rule.allow_new !== 'boolean')
      fail('Regra de evolução inválida.');
    number(rule.multiplier, 'Multiplicador', 1, 10000);
    number(rule.zero_level_cost, 'Custo do nível zero', 1, 10000);
    if (rule.max_level !== null) number(rule.max_level, 'Limite fixo', 1, 20);
  }
  number(g.dice.sides, 'Faces dos dados', 2, 100);
  number(g.dice.success_on, 'Dificuldade', 1, g.dice.sides);
  number(g.dice.max_pool, 'Limite de dados', 1, 100);
  number(g.quests.max_xp_reward, 'XP máximo de missão', 0, 1000000);
  number(g.quests.max_money_reward, 'Dinheiro máximo de missão', 0, 1000000000);
  if (g.quests.require_narrator_completion !== true)
    fail('A entrega das recompensas precisa continuar sob confirmação do narrador.');
  for (const d of g.disciplines)
    for (const level of d.nivels) {
      const m = level.mechanics;
      if (m.rouse_check !== null && typeof m.rouse_check !== 'boolean')
        fail('Teste de Despertar inválido.');
      if (m.test !== null && (typeof m.test !== 'string' || m.test.length > 300))
        fail('Teste de habilidade inválido.');
    }
  return g;
}
export function upgradeQuote(p, g, key, id, target) {
  const rule = g.progression.categories[key];
  if (!rule?.enabled) fail('Este traço não está habilitado para evolução com XP.');
  const entry = key === 'bloodpotency' ? p : p[key]?.find((x) => x.id === id);
  if (!entry && !rule.allow_new) fail('O narrador precisa conceder este traço antes de evoluir.');
  if (key !== 'bloodpotency' && !g[key]?.some((d) => d.id === id)) fail('Traço desconhecido.');
  const field = key === 'bloodpotency' ? 'bloodpotency' : key === 'disciplines' ? 'nivel' : 'value',
    current = entry?.[field] || 0;
  const generationMax =
    key === 'bloodpotency'
      ? g.bloodpotency_generation[p.generation].max
      : g.maxvalue_generation[p.generation];
  const max = Math.min(generationMax, rule.max_level ?? generationMax);
  number(target, 'Nível desejado', current + 1, max);
  const steps = [];
  let cost = 0;
  for (let level = current; level < target; level++) {
    const factor =
      rule.basis === 'fixed'
        ? 1
        : rule.basis === 'target'
          ? level + 1
          : Math.max(level, rule.zero_level_cost);
    const amount = factor * rule.multiplier;
    steps.push({ from: level, to: level + 1, cost: amount });
    cost += amount;
  }
  return {
    key,
    id: key === 'bloodpotency' ? null : id,
    from: current,
    target,
    max,
    cost,
    steps,
    available: p.xp,
    remaining: p.xp - cost,
    affordable: p.xp >= cost,
    revision: p._revision
  };
}
export function moneyValue(value, label = 'Valor') {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > 1e9 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
  )
    fail(`${label}: use um valor com até duas casas decimais.`);
  return Math.round(value * 100) / 100;
}
export function parseDelta(input) {
  let raw = String(input ?? '')
    .trim()
    .replace(/\s|R\$/g, '');
  if (!/^[+-]?\d+(?:[.,]\d+)*$/.test(raw)) fail('Digite um valor como -133, +2500 ou -133,50.');
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  const amount = moneyValue(Number(raw));
  if (!amount) fail('Informe um valor diferente de zero.');
  return amount;
}
export function rollPool(pool, hunger, g, random = Math.random) {
  number(pool, 'Parada', 1, g.dice.max_pool);
  const dice = Array.from({ length: pool }, (_, i) => ({
    value: Math.floor(random() * g.dice.sides) + 1,
    hunger: g.dice.highlight_hunger && i < Math.min(hunger, pool)
  }));
  return {
    dice,
    successes: dice.filter((d) => d.value >= g.dice.success_on).length,
    threshold: g.dice.success_on,
    sides: g.dice.sides,
    at: new Date().toISOString()
  };
}
