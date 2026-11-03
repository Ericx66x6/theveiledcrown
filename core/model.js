import { imageData } from './image-data.js';
import { limits, xpCost, newId } from '../shared/rules.js';
export { limits, xpCost, newId };
export const stats = ['atributes', 'talents', 'expertises', 'knowledges', 'precedents'];
export const collections = [
  'domains',
  'allies',
  'contacts',
  'retainers',
  'items',
  'notes',
  'goals',
  'favours'
];
export const clone = (value) => structuredClone(value);
export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function number(value, label, min = 0, max = 1000000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(`${label}: informe um inteiro entre ${min} e ${max}.`);
  return value;
}
export function text(value, label, max = 10000, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail(`${label}: preencha um texto válido (até ${max} caracteres).`);
  return value.trim();
}
export function recordId(doc) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
    else bytes[0] = Math.floor(Math.random() * 4294967296);
    const id = 100000 + (bytes[0] % 900000);
    if (!doc.characters.some((p) => p.id === id)) return id;
  }
  fail('Não foi possível gerar um ID livre. Tente novamente.');
}
export function normalize(source) {
  if (!source || Array.isArray(source) || typeof source !== 'object')
    fail('A ficha precisa ser um objeto JSON.');
  const p = clone(source);
  for (const key of [
    ...stats,
    'disciplines',
    'rituals',
    'caracteristics',
    'moralityes',
    ...collections,
    'history',
    'transactions',
    'rolls'
  ]) {
    p[key] ??= [];
    if (!Array.isArray(p[key])) fail(`A lista ${key} é inválida.`);
  }
  p.status = { ...Object.fromEntries(Object.keys(limits).map((k) => [k, 0])), ...p.status };
  p.xp ??= 0;
  p.money ??= 0;
  p.bloodpotency ??= 1;
  p.biography ??= '';
  p.profilepicture ??= '';
  p._revision ??= 0;
  p.schema_version = 6;
  return p;
}
export function blank(game, id) {
  return normalize({
    id,
    char: '',
    player: '',
    cla: '',
    generation: 10,
    bloodpotency: game.bloodpotency_generation['10'].min,
    xp: 0,
    money: 0,
    status: Object.fromEntries(
      Object.keys(limits).map((k) => [
        k,
        Math.max(
          game.status_rules?.[k]?.min ?? 0,
          Math.min(
            game.status_rules?.[k]?.max ?? limits[k],
            k === 'humanity' ? 5 : k === 'willpower' ? 10 : 0
          )
        )
      ])
    ),
    ...Object.fromEntries(
      stats.map((k) => [k, game[k].map((x) => ({ id: x.id, value: k === 'atributes' ? 1 : 0 }))])
    )
  });
}
export function validateGame(game) {
  if (!game || typeof game !== 'object' || Array.isArray(game)) fail('game_data inválido.');
  for (const key of [...stats, 'disciplines', 'rituals', 'caracteristics']) {
    if (!Array.isArray(game[key])) fail(`game_data: lista ${key} ausente.`);
    const ids = new Set();
    for (const row of game[key]) {
      number(row?.id, 'ID');
      text(row?.name, 'Nome', 200, true);
      if (row.description !== undefined) text(row.description, 'Descrição', 30000);
      if (row.short_description !== undefined) text(row.short_description, 'Resumo', 2000);
      if (key === 'disciplines') {
        if (!Array.isArray(row.nivels) || row.nivels.length > 100)
          fail('Poderes da disciplina inválidos.');
        for (const level of row.nivels) {
          number(level.nivel, 'Nível do poder', 1, 20);
          text(level.subname, 'Nome do poder', 200);
          text(level.description, 'Descrição do poder', 30000);
        }
      }
      if (ids.has(row.id)) fail(`ID repetido em ${key}.`);
      ids.add(row.id);
    }
  }
  for (const key of [...stats, 'disciplines', 'bloodpotency'])
    number(game.xp_cost?.[key], `Custo de ${key}`, 1, 1000);
  for (let gen = 4; gen <= 13; gen++) {
    number(game.maxvalue_generation?.[gen], 'Limite da geração', 1, 10);
    const range = game.bloodpotency_generation?.[gen];
    number(range?.min, 'Potência mínima', 0, 10);
    number(range?.max, 'Potência máxima', range.min, 10);
  }
  if (!Array.isArray(game.bloodpotency)) fail('Potências de sangue ausentes.');
  return game;
}
export function validatePlayer(source, game) {
  const p = normalize(source);
  number(p.id, 'ID', 0, 999999);
  p.char = text(p.char, 'Nome do personagem', 150, true);
  p.player = text(p.player, 'Nome do jogador', 150, true);
  p.cla = text(p.cla, 'Clã', 80, true);
  number(p.generation, 'Geração', 4, 13);
  number(p.xp, 'XP');
  if (
    typeof p.money !== 'number' ||
    !Number.isFinite(p.money) ||
    p.money < 0 ||
    p.money > 1e9 ||
    Math.abs(p.money * 100 - Math.round(p.money * 100)) > 0.00001
  )
    fail('Saldo inválido.');
  number(p._revision, 'Revisão');
  const max = game.maxvalue_generation[p.generation],
    range = game.bloodpotency_generation[p.generation];
  number(p.bloodpotency, 'Potência de sangue', range.min, range.max);
  for (const [k, v] of Object.entries(p.status)) {
    if (!(k in limits)) fail('Status desconhecido.');
    number(v, k, game.status_rules?.[k]?.min ?? 0, game.status_rules?.[k]?.max ?? limits[k]);
  }
  for (const key of [...stats, 'disciplines', 'rituals', 'caracteristics']) {
    const ids = new Set(),
      known = new Set(game[key].map((x) => x.id));
    for (const row of p[key]) {
      if (!row || !known.has(row.id) || ids.has(row.id))
        fail(`Traço desconhecido ou repetido em ${key}.`);
      ids.add(row.id);
      if (stats.includes(key) || key === 'disciplines')
        number(row[key === 'disciplines' ? 'nivel' : 'value'], key, 0, max);
    }
  }
  for (const key of collections) {
    if (p[key].length > 300) fail(`Máximo de 300 registros em ${key}.`);
    const ids = new Set();
    for (const row of p[key]) {
      if (!row || !['string', 'number'].includes(typeof row.id) || ids.has(String(row.id)))
        fail(`ID inválido ou repetido em ${key}.`);
      ids.add(String(row.id));
      for (const [field, value] of Object.entries(row)) {
        if (field === 'id') continue;
        if (['rating', 'level'].includes(field)) number(value, field, 0, 5);
        else if (field === 'image') imageData(value);
        else if (field === 'quantity') number(value, field, 0, 9999);
        else if (field === 'completed') {
          if (typeof value !== 'boolean') fail('Estado de conclusão inválido.');
        } else text(value, field, 10000);
      }
    }
  }
  if (p.moralityes.length > 30) fail('Máximo de 30 convicções.');
  for (const row of p.moralityes) {
    number(row?.id, 'ID da convicção');
    text(row?.description, 'Convicção');
  }
  text(p.biography, 'História', 30000);
  text(p.profilepicture, 'Retrato', 2000000);
  if (
    p.profilepicture &&
    !p.profilepicture.startsWith('data:image/') &&
    !p.profilepicture.startsWith('https://') &&
    p.profilepicture !== 'image_link'
  )
    fail('O retrato precisa ser uma imagem local.');
  return p;
}
export function publicPlayer(p) {
  const result = clone(p);
  delete result.token;
  delete result.password;
  delete result.password_hash;
  return result;
}
export function publicAccount(a) {
  const result = Object.fromEntries(
    [
      'id',
      'username',
      'display_name',
      'role',
      'character_ids',
      'active',
      'avatar',
      'bio',
      'preferences'
    ].map((k) => [
      k,
      a[k] === undefined
        ? k === 'preferences'
          ? {}
          : k === 'character_ids'
            ? []
            : ''
        : clone(a[k])
    ])
  );
  result.campaign_access = a.role === 'admin' || !!a._campaign_member;
  return result;
}
export function credentials(username, password) {
  const login = text(username, 'Login', 40, true).toLowerCase();
  if (!/^[a-z0-9_.-]{3,40}$/.test(login))
    fail('O login precisa ter de 3 a 40 letras, números, pontos, traços ou sublinhados.');
  if (typeof password !== 'string' || password.length < 6 || password.length > 128)
    fail('Use uma senha de 6 a 128 caracteres.');
  return login;
}
export function revision(p, value) {
  number(value, 'Revisão');
  if (p._revision !== value)
    fail(
      'Esta ficha mudou em outra janela. Atualize antes de salvar. Seu formulário continua aberto.',
      409
    );
}
export const timestamp = () => new Date().toISOString();
export function documentSeed(game) {
  return {
    format: 'coroa-offline-v1',
    revision: 0,
    updated_at: timestamp(),
    game: clone(game),
    characters: [],
    accounts: [],
    sessions: [],
    snapshots: []
  };
}
export function backup(doc) {
  const copy = clone(doc);
  delete copy.sessions;
  return copy;
}
export function validateBackup(input) {
  if (!input || input.format !== 'coroa-offline-v1') fail('Selecione um backup completo da mesa.');
  const doc = clone(input);
  validateGame(doc.game);
  if (!Array.isArray(doc.characters) || !Array.isArray(doc.accounts) || !doc.accounts.length)
    fail('Backup sem fichas ou contas válidas.');
  const ids = new Set();
  doc.characters = doc.characters.map((source) => {
    const p = validatePlayer(source, doc.game);
    if (ids.has(p.id)) fail('O backup tem IDs de personagens repetidos.');
    ids.add(p.id);
    return p;
  });
  const names = new Set(),
    accountIds = new Set();
  for (const a of doc.accounts) {
    text(a.id, 'ID da conta', 100, true);
    if (accountIds.has(a.id)) fail('Conta repetida no backup.');
    accountIds.add(a.id);
    text(a.display_name, 'Nome', 100, true);
    const name = text(a.username, 'Login', 40, true);
    if (!/^[a-z0-9_.-]{3,40}$/.test(name) || names.has(name))
      fail('Login inválido ou repetido no backup.');
    names.add(name);
    if (
      !['admin', 'player'].includes(a.role) ||
      typeof a.active !== 'boolean' ||
      !Array.isArray(a.character_ids) ||
      a.character_ids.some((id) => !ids.has(id))
    )
      fail('Vínculos de conta inválidos no backup.');
    const h = a.password_hash;
    if (
      !h ||
      h.algorithm !== 'pbkdf2-sha256' ||
      !Number.isInteger(h.iterations) ||
      h.iterations < 10000 ||
      h.iterations > 1000000 ||
      !/^\p{ASCII}+$/u.test(h.salt) ||
      !/^[a-f0-9]{32}$/.test(h.salt) ||
      !/^[a-f0-9]{64}$/.test(h.hash)
    )
      fail('Senha de backup incompatível.');
    a.session_version = number(a.session_version ?? 0, 'Versão da sessão');
  }
  if (!doc.accounts.some((a) => a.active)) fail('O backup precisa ter uma conta ativa.');
  doc.sessions = [];
  if (!Array.isArray(doc.snapshots)) doc.snapshots = [];
  if (doc.snapshots.length > 30) fail('O backup excede o limite de revisões locais.');
  const snapshotIds = new Set();
  for (const entry of doc.snapshots) {
    if (
      !entry ||
      !['game', 'character'].includes(entry.kind) ||
      !entry.data ||
      typeof entry.data !== 'object' ||
      Array.isArray(entry.data)
    )
      fail('Revisão de backup inválida.');
    text(entry.id, 'ID da revisão', 100, true);
    text(entry.at, 'Data da revisão', 100, true);
    if (snapshotIds.has(entry.id)) fail('Revisão repetida no backup.');
    snapshotIds.add(entry.id);
    if (entry.kind === 'character') number(entry.character_id, 'ID da ficha', 0, 999999);
  }
  doc.revision = 0;
  return doc;
}
