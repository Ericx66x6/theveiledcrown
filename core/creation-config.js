import { clone, fail, number, text } from './model.js';
import { clanGuides, commonDisciplineNames } from './clan-guide.js';
export const creationKeys = [
  'atributes',
  'talents',
  'expertises',
  'knowledges',
  'precedents',
  'disciplines'
];
export const skillKeys = ['talents', 'expertises', 'knowledges'];
export const normalizedName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
const clanNames = {
  assamita: ['Assamita', 'Quietus', 'Ofuscação', 'Potência'],
  brujah: ['Brujah', 'Rapidez', 'Potência', 'Presença'],
  gangrel: ['Gangrel', 'Animalismo', 'Fortitude', 'Metamorfose'],
  giovanni: ['Giovanni', 'Dominação', 'Necromancia', 'Potência'],
  lasombra: ['Lasombra', 'Dominação', 'Potência', 'Tenebrosidade'],
  malkavian: ['Malkavian', 'Auspícios', 'Demência', 'Ofuscação'],
  nosferatu: ['Nosferatu', 'Animalismo', 'Ofuscação', 'Potência'],
  ravnos: ['Ravnos', 'Animalismo', 'Ofuscação', 'Quimerismo'],
  setita: ['Setita', 'Ofuscação', 'Presença', 'Serpentis'],
  toreador: ['Toreador', 'Auspícios', 'Rapidez', 'Potência'],
  tremere: ['Tremere', 'Taumaturgia', 'Auspícios', 'Dominação'],
  tzimisce: ['Tzimisce', 'Animalismo', 'Dominação', 'Vicissitude'],
  ventrue: ['Ventrue', 'Dominação', 'Fortitude', 'Presença']
};
export const catalogId = (g, key, name) =>
  g[key].find((d) => normalizedName(d.name) === normalizedName(name))?.id ?? null;
export const backgroundDefinitions = [
  [
    'ALIADOS',
    'Pessoas que oferecem apoio e esperam reciprocidade.',
    ['Um aliado', 'Dois aliados', 'Três aliados', 'Quatro aliados', 'Cinco aliados']
  ],
  [
    'CONTATOS',
    'Fontes de informação; detalhe seus contatos principais.',
    [
      'Um contato principal',
      'Dois contatos principais',
      'Três contatos principais',
      'Quatro contatos principais',
      'Cinco contatos principais'
    ]
  ],
  [
    'FAMA',
    'Reconhecimento público, com privilégios e exposição.',
    ['Grupo local', 'Cidade', 'Estado', 'País', 'Mundo']
  ],
  [
    'GERAÇÃO',
    'Sua geração inicial é 13 menos os pontos deste antecedente.',
    ['12ª geração', '11ª geração', '10ª geração', '9ª geração', '8ª geração']
  ],
  [
    'INFLUÊNCIA',
    'Alcance de suas conexões na sociedade mortal.',
    ['Municipal', 'Estadual', 'Regional', 'Nacional', 'Global']
  ],
  [
    'LACAIOS',
    'Servidores leais; descreva quem são e como são mantidos.',
    ['Um lacaio', 'Dois lacaios', 'Três lacaios', 'Quatro lacaios', 'Cinco lacaios']
  ],
  [
    'MENTOR',
    'Um patrono oferece orientação e pode cobrar contrapartidas.',
    ['Ancilla', 'Ancião', 'Primigênie', 'Príncipe', 'Justiçar']
  ],
  [
    'REBANHO',
    'Mortais disponíveis para alimentação, sujeitos à história.',
    ['3 fontes', '7 fontes', '15 fontes', '30 fontes', '60 fontes']
  ],
  [
    'RECURSOS',
    'Patrimônio convertido em capital inicial nesta mesa; renda exige decisão do narrador.',
    ['R$ 1.000', 'R$ 8.000', 'R$ 50.000', 'R$ 500.000', 'R$ 5.000.000']
  ],
  [
    'STATUS',
    'Posição reconhecida na sociedade vampírica.',
    ['Conhecido', 'Respeitado', 'Influente', 'Poderoso', 'Luminar']
  ],
  [
    'ESCRAVOS ESPIRITUAIS',
    'Giovanni: vínculos com fantasmas; narrador define capacidades.',
    ['Um vínculo', 'Dois vínculos', 'Três vínculos', 'Quatro vínculos', 'Cinco vínculos']
  ]
];
export function configureCreation(g) {
  const find = (key, name) => catalogId(g, key, name);
  // Stable IDs and existing text are preserved when normalizing an older campaign.
  for (const [name, description, levels] of backgroundDefinitions) {
    let row = g.precedents.find((d) => normalizedName(d.name) === normalizedName(name));
    if (!row && !g.character_creation.catalog_version) {
      row = { id: Math.max(-1, ...g.precedents.map((d) => d.id)) + 1, name, description };
      g.precedents.push(row);
    }
    if (!row) continue;
    row.levels ??= levels.map((description, i) => ({ level: i + 1, description }));
    row.creation_effect ??=
      name === 'GERAÇÃO' ? 'generation' : name === 'RECURSOS' ? 'capital' : 'narrative';
    if (name === 'ESCRAVOS ESPIRITUAIS') row.allowed_clans ??= ['giovanni'];
  }
  g.character_creation.catalog_version = 1;
  const old = g.character_creation.guided || {};
  g.character_creation.guided = {
    enabled: true,
    version: 1,
    attribute_base: 1,
    initial: { atributes: 15, skills: 27, precedents: 5, disciplines: 3, ...old.initial },
    initial_max: { atributes: 4, skills: 3, precedents: 5, disciplines: 3, ...old.initial_max },
    bonus_points: 15,
    max_level: 5,
    max_flaws: 4,
    bonus_costs: { atributes: 4, skills: 2, disciplines: 6, precedents: 1, ...old.bonus_costs },
    generation_base: 13,
    generation_min: 8,
    capital_by_level: { 0: 0, 1: 1000, 2: 8000, 3: 50000, 4: 500000, 5: 5000000 },
    clans: Object.entries(clanNames).map(([id, [name, ...disciplines]]) => ({
      id,
      name,
      disciplines: disciplines.map((name) => find('disciplines', name))
    })),
    ...old
  };
  for (const key of ['initial', 'initial_max', 'bonus_costs'])
    g.character_creation.guided[key] = {
      ...{
        initial: { atributes: 15, skills: 27, precedents: 5, disciplines: 3 },
        initial_max: { atributes: 4, skills: 3, precedents: 5, disciplines: 3 },
        bonus_costs: { atributes: 4, skills: 2, disciplines: 6, precedents: 1 }
      }[key],
      ...old[key]
    };
  const clans = g.character_creation.guided.clans;
  if (!g.character_creation.clan_guide_version) {
    if (!clans.some((c) => c.id === 'caitiff'))
      clans.push({
        id: 'caitiff',
        name: 'Caitiff',
        disciplines: [],
        discipline_choices: commonDisciplineNames
          .map((name) => find('disciplines', name))
          .filter((id) => id !== null)
      });
    g.character_creation.clan_guide_version = 1;
  }
  for (const clan of clans) {
    const preset = clanGuides.find((guide) => guide.id === clan.id);
    if (preset) {
      const { id, ...details } = preset;
      clan.guide = { ...clone(details), ...clan.guide };
    }
  }
  for (const [parent, paths] of [
    [
      'Taumaturgia',
      [
        'Sedução das Chamas',
        'Movimento da Mente',
        'Linha do Sangue',
        'Linha da Conjuração',
        'Mãos da Destruição'
      ]
    ],
    ['Necromancia', ['Linha do Sepulcro', 'Linha dos Ossos', 'Linha das Cinzas']]
  ]) {
    const parentId = find('disciplines', parent);
    if (parentId === null) continue;
    g.disciplines.find((d) => d.id === parentId).is_path_parent ??= true;
    for (const name of paths) {
      const path = g.disciplines.find((d) => normalizedName(d.name) === normalizedName(name));
      if (path) path.parent_discipline_ids ??= [parentId];
    }
  }
  const id = (key, name) => find(key, name);
  const effects = {
    monstruoso: {
      attribute_set: [{ id: id('atributes', 'Aparência'), value: 0 }],
      forbidden_clans: ['nosferatu']
    },
    crianca: {
      attribute_caps: [
        { id: id('atributes', 'Força'), value: 2 },
        { id: id('atributes', 'Vigor'), value: 2 }
      ],
      requires_traits: [id('caracteristics', 'Estatura Baixa')]
    },
    'lider nato': { minimums: [{ key: 'atributes', id: id('atributes', 'Carisma'), value: 3 }] },
    'tolerancia a dor': {
      minimums: [{ key: 'expertises', id: id('expertises', 'Coragem'), value: 3 }]
    },
    'consumo conspicuo': { requires_traits: [id('caracteristics', 'Ingerir Comida')] },
    'coracao mole': { humanity_min: 4 },
    'taumaturgicamente inapto': {
      requires_clans: ['tremere'],
      discipline_caps: [{ id: id('disciplines', 'Taumaturgia'), value: 1 }]
    },
    'resistencia a magia': {
      forbidden_clans: ['tremere'],
      forbidden_disciplines: [id('disciplines', 'Taumaturgia')]
    },
    'beijo de procuracao — 4 pontos': {
      requires_clans: ['giovanni'],
      discipline_grants: [{ id: id('disciplines', 'Potência'), value: 1 }]
    },
    'beijo de procuracao — 8 pontos': {
      requires_clans: ['giovanni'],
      discipline_grants: [
        { id: id('disciplines', 'Potência'), value: 1 },
        { id: id('disciplines', 'Fortitude'), value: 1 }
      ]
    }
  };
  for (const d of g.caracteristics) {
    const effect = effects[normalizedName(d.name)];
    if (effect && !d.creation_effects) d.creation_effects = clone(effect);
  }
  return g;
}
export function validateCreationConfig(g) {
  const c = g.character_creation.guided;
  if (typeof c.enabled !== 'boolean') fail('Ativação do assistente inválida.');
  number(c.attribute_base, 'Base dos atributos', 1, 3);
  number(c.bonus_points, 'Pontos bônus', 0, 100);
  number(c.max_flaws, 'Máximo de defeitos', 0, 10);
  number(c.max_level, 'Limite da criação', 1, 5);
  number(c.generation_base, 'Geração inicial', 8, 13);
  number(c.generation_min, 'Menor geração inicial', 8, c.generation_base);
  for (const key of ['atributes', 'skills', 'precedents', 'disciplines']) {
    number(c.initial[key], 'Pontos iniciais', 0, 200);
    number(
      c.initial_max[key],
      'Limite inicial',
      key === 'atributes' ? c.attribute_base : 0,
      c.max_level
    );
    number(c.bonus_costs[key], 'Custo em pontos bônus', 1, 100);
  }
  for (let i = 0; i <= 5; i++) number(c.capital_by_level[i], 'Capital inicial', 0, 1000000000);
  if (!Array.isArray(c.clans) || c.clans.length > 100) fail('Clãs da criação inválidos.');
  const ids = new Set();
  for (const clan of c.clans) {
    if (
      !/^[a-z0-9_-]{1,60}$/.test(clan.id) ||
      ids.has(clan.id) ||
      typeof clan.name !== 'string' ||
      !clan.name ||
      clan.name.length > 80
    )
      fail('Clã de criação inválido.');
    ids.add(clan.id);
    const flexible = Array.isArray(clan.discipline_choices);
    if (
      !Array.isArray(clan.disciplines) ||
      clan.disciplines.length !== (flexible ? 0 : 3) ||
      clan.disciplines.some((id) => id !== null && !g.disciplines.some((d) => d.id === id))
    )
      fail('Selecione três disciplinas cadastradas para o clã.');
    if (
      flexible &&
      (clan.discipline_choices.length > 100 ||
        new Set(clan.discipline_choices).size !== clan.discipline_choices.length ||
        clan.discipline_choices.some(
          (id) => !g.disciplines.some((d) => d.id === id && !d.parent_discipline_ids?.length)
        ))
    )
      fail('As opções do clã precisam ser disciplinas diferentes e cadastradas.');
    if (clan.guide) {
      for (const key of [
        'epithet',
        'description',
        'ideology',
        'beginner_level',
        'beginner_reason',
        'beginner_tip',
        'story_hook',
        'weakness',
        'source_url'
      ])
        if (clan.guide[key] !== undefined) text(clan.guide[key], 'Apresentação do clã', 3000);
      for (const key of ['archetypes', 'attribute_tips', 'skill_tips'])
        if (
          clan.guide[key] !== undefined &&
          (!Array.isArray(clan.guide[key]) ||
            clan.guide[key].length > 20 ||
            clan.guide[key].some((v) => typeof v !== 'string' || v.length > 300))
        )
          fail('Dicas do clã inválidas.');
    }
  }
  for (const d of g.caracteristics) {
    const e = d.creation_effects;
    if (!e) continue;
    if (typeof e !== 'object' || Array.isArray(e))
      fail('Efeitos de criação inválidos em ' + d.name);
    const arrays = [
      'attribute_set',
      'attribute_caps',
      'discipline_grants',
      'discipline_caps',
      'minimums',
      'requires_traits',
      'forbidden_disciplines',
      'requires_clans',
      'forbidden_clans',
      'excludes'
    ];
    if (Object.keys(e).some((k) => ![...arrays, 'humanity_min'].includes(k)))
      fail('Efeito de criação desconhecido em ' + d.name);
    for (const k of arrays)
      if (e[k] !== undefined && (!Array.isArray(e[k]) || e[k].length > 30))
        fail('Lista de efeitos inválida.');
    for (const [key, catalog] of [
      ['attribute_set', 'atributes'],
      ['attribute_caps', 'atributes'],
      ['discipline_grants', 'disciplines'],
      ['discipline_caps', 'disciplines'],
      ['minimums', null]
    ])
      for (const row of e[key] || []) {
        if (
          (!catalog && !creationKeys.includes(row.key)) ||
          !Array.isArray(g[catalog || row.key]) ||
          !g[catalog || row.key].some((x) => x.id === row.id)
        )
          fail('Traço do efeito não cadastrado: ' + d.name);
        number(row.value, 'Valor do efeito', 0, 5);
      }
    for (const [key, catalog] of [
      ['requires_traits', 'caracteristics'],
      ['excludes', 'caracteristics'],
      ['forbidden_disciplines', 'disciplines']
    ])
      if ((e[key] || []).some((id) => !g[catalog].some((x) => x.id === id)))
        fail('Referência de efeito não cadastrada: ' + d.name);
    for (const key of ['requires_clans', 'forbidden_clans'])
      if ((e[key] || []).some((x) => typeof x !== 'string' || x.length > 80))
        fail('Clã no efeito inválido.');
    if (e.humanity_min !== undefined) number(e.humanity_min, 'Humanidade mínima', 0, 5);
  }
}
