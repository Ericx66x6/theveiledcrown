import { socialVisible, publicSocialPost, socialKinds, gestures } from './social-state.js';
import { jsonDestinationError } from './json-kind.js';
import { personalNetwork, questVisible } from './permissions.js';
import {
  clone,
  normalize,
  fail,
  number,
  text,
  validatePlayer,
  validateGame,
  validateBackup,
  timestamp,
  publicPlayer
} from './model.js';
import { gameSettings, validateSettings } from './settings.js';
import { workspaceFromLegacy } from './store.js';
import { normalizeRoot, emptyMap } from './campaign-shape.js';
export { imageData } from './image-data.js';
import { imageData } from './image-data.js';
import { publicMap, validateScale, validateMapPosition } from './map-state.js';
import { publicIntel, validateIntel } from './intel-state.js';
import { validateRewardAccount } from './reward-state.js';
export function coordinate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
    fail('Posição fora do mapa.');
  return value;
}
function identifier(value, label = 'ID') {
  text(value, label, 100, true);
  if (!/^[A-Za-z0-9_.:-]+$/.test(value)) fail(label + ' inválido.');
  return value;
}
function list(value, label, max = 1000) {
  if (!Array.isArray(value) || value.length > max) fail('Lista de ' + label + ' inválida.');
  const ids = new Set();
  for (const item of value) {
    identifier(item?.id);
    if (ids.has(item.id)) fail('ID repetido em ' + label + '.');
    ids.add(item.id);
  }
  return value;
}
function visibility(item) {
  if (!['campaign', 'private', 'gm'].includes(item.visibility ?? 'campaign'))
    fail('Visibilidade inválida.');
}
export function validatePin(pin) {
  coordinate(pin.x);
  coordinate(pin.y);
  text(pin.title, 'Marcador', 200, true);
  for (const key of ['description', 'domain', 'type'])
    text(pin[key] ?? '', key, key === 'description' ? 30000 : 500);
  if (pin.lat !== undefined && (!Number.isFinite(pin.lat) || pin.lat < -85.05 || pin.lat > 85.05))
    fail('Latitude inválida.');
  if (pin.lng !== undefined && (!Number.isFinite(pin.lng) || pin.lng < -180 || pin.lng > 180))
    fail('Longitude inválida.');
  for (const key of ['address', 'atmosphere', 'danger']) text(pin[key] || '', key, 500);
  if (!Array.isArray(pin.images || []) || (pin.images || []).length > 6)
    fail('Imagens do local inválidas.');
  for (const image of pin.images || []) imageData(image);
  if (!Array.isArray(pin.npcs || []) || (pin.npcs || []).length > 12)
    fail('NPCs do local inválidos.');
  const npcIds = new Set();
  for (const npc of pin.npcs || []) {
    identifier(npc.id, 'ID de NPC');
    if (npcIds.has(npc.id)) fail('NPC repetido.');
    npcIds.add(npc.id);
    text(npc.name, 'NPC', 150, true);
    text(npc.role || '', 'Papel', 500);
    text(npc.description || '', 'Descrição', 10000);
    imageData(npc.image || '');
  }
  visibility(pin);
  if (pin.color && !/^#[a-f\d]{6}$/i.test(pin.color)) fail('Cor de marcador inválida.');
}
function historicalPlayer(source, game) {
  const p = normalize(source),
    historical = clone(game);
  for (const key of [
    'atributes',
    'talents',
    'expertises',
    'knowledges',
    'precedents',
    'disciplines',
    'rituals',
    'caracteristics'
  ]) {
    for (const row of p[key]) number(row?.id, 'ID de traço histórico');
    const ids = new Set(historical[key].map((d) => d.id));
    historical[key] = [
      ...historical[key],
      ...p[key]
        .filter((row) => !ids.has(row.id))
        .map((row) => ({ id: row.id, name: 'Conteúdo anterior' }))
    ];
  }
  for (let gen = 4; gen <= 13; gen++) {
    historical.maxvalue_generation[gen] = 100;
    historical.bloodpotency_generation[gen] = { min: 0, max: 100 };
  }
  for (const key of Object.keys(historical.status_rules))
    historical.status_rules[key] = { min: 0, max: 100 };
  return validatePlayer(p, historical);
}
export function validateWorkspace(source) {
  const destinationError = jsonDestinationError(source, 'workspace');
  if (destinationError) fail(destinationError);
  let input = source;
  if (source?.format === 'coroa-offline-player-v1') {
    if (source.account?.role !== 'player') fail('Pacote de jogador inválido.');
    input = {
      format: 'coroa-offline-v1',
      game: source.game,
      characters: source.characters,
      accounts: [source.account]
    };
  }
  if (input?.format === 'coroa-offline-v1') input = workspaceFromLegacy(validateBackup(input));
  if (input?.format === 'coroa-campaign-v2')
    input = {
      format: 'coroa-hub-v2',
      revision: 0,
      accounts: input.accounts,
      campaigns: [input.campaign],
      active_campaign_id: input.campaign.id
    };
  if (
    input?.format !== 'coroa-hub-v2' ||
    !Array.isArray(input.campaigns) ||
    input.campaigns.length > 100 ||
    !Array.isArray(input.accounts) ||
    !input.accounts.length
  )
    fail('Selecione um portal ou pacote JSON com campanhas e contas válidas.');
  const root = normalizeRoot(input),
    campaignIds = new Set(),
    userIds = new Set(),
    usernames = new Set();
  root.default_game = validateSettings(gameSettings(validateGame(root.default_game)));
  for (const c of root.campaigns) {
    identifier(c.id, 'ID da campanha');
    if (!/^[A-Za-z0-9_-]+$/.test(c.id) || campaignIds.has(c.id))
      fail('Campanha repetida ou ID inválido.');
    campaignIds.add(c.id);
    text(c.title, 'Nome da campanha', 150, true);
    imageData(c.cover || '');
    if (!['active', 'closed'].includes(c.status)) fail('Estado de campanha inválido.');
    if (!/^#[a-f\d]{6}$/i.test(c.accent || '#d92343')) fail('Cor de campanha inválida.');
    c.game = validateSettings(gameSettings(validateGame(c.game)));
    if (!Array.isArray(c.characters)) fail('Lista de fichas inválida.');
    const ids = new Set();
    c.characters = c.characters.map((p) => {
      const next = validatePlayer(p, c.game);
      if (ids.has(p.id)) fail('ID de ficha repetido.');
      ids.add(p.id);
      return next;
    });
    for (const n of list(c.notes, 'anotações')) {
      text(n.title, 'Título', 200, true);
      text(n.content, 'Anotação', 30000);
      text(n.tags ?? '', 'Marcadores', 500);
      visibility(n);
    }
    for (const m of list(c.maps, 'mapas', 50)) {
      text(m.title, 'Nome do mapa', 150, true);
      text(m.description ?? '', 'Descrição', 5000);
      if (typeof m.player_access !== 'boolean') fail('Permissão de mapa inválida.');
      if (!['image', 'geographic'].includes(m.mode || 'image')) fail('Tipo de mapa inválido.');
      if (m.mode === 'geographic') {
        const { lat, lng, zoom } = m.center || {};
        if (
          !Number.isFinite(lat) ||
          lat < -85.05 ||
          lat > 85.05 ||
          !Number.isFinite(lng) ||
          lng < -180 ||
          lng > 180 ||
          !Number.isInteger(zoom) ||
          zoom < 2 ||
          zoom > 19
        )
          fail('Centro geográfico inválido.');
      }
      imageData(m.image || '', 45000000);
      if (m.image) {
        number(m.width, 'Largura do mapa', 1, 20000);
        number(m.height, 'Altura do mapa', 1, 20000);
      }
      validateScale(m.scale);
      const positions = m.character_markers || [];
      if (
        !Array.isArray(positions) ||
        positions.length > 1000 ||
        new Set(positions.map((p) => p.character_id)).size !== positions.length
      )
        fail('Marcadores de personagens inválidos.');
      for (const p of positions) {
        number(p.character_id, 'Personagem', 0, 999999);
        validateMapPosition(p, m.mode);
        if (!ids.has(p.character_id)) fail('Marcador ligado a personagem inexistente.');
      }
      for (const pin of list(m.pins, 'marcadores')) {
        validatePin(pin);
        if (m.mode === 'geographic' && (pin.lat === undefined || pin.lng === undefined))
          fail('Coordenadas geográficas ausentes.');
      }
    }
    for (const node of list(c.network.nodes, 'NPCs')) {
      coordinate(node.x);
      coordinate(node.y);
      text(node.name, 'NPC', 150, true);
      imageData(node.image || '');
      for (const key of ['role', 'faction', 'description', 'theories'])
        text(node[key] ?? '', key, ['description', 'theories'].includes(key) ? 30000 : 500);
      visibility(node);
    }
    for (const edge of list(c.network.links, 'relações')) {
      text(edge.label, 'Relação', 500, true);
      text(edge.description ?? '', 'Descrição de relação', 30000);
      if (
        !c.network.nodes.some((n) => n.id === edge.from) ||
        !c.network.nodes.some((n) => n.id === edge.to)
      )
        fail('Relação ligada a um NPC inexistente.');
    }
    const known = (id) =>
      ids.has(id) ||
      (c.roster || []).some((p) => p.id === id) ||
      c.retired_roster.some((p) => p.id === id);
    for (const item of list(c.intel || [], 'informações', 500))
      validateIntel(item, { redacted: !Object.hasOwn(item, 'secret') });
    for (const q of list(c.quests, 'missões')) {
      if (
        !Array.isArray(q.assignees) ||
        (!q.assignees.length && q.status !== 'cancelled') ||
        q.assignees.some((id) => !known(id))
      )
        fail('Missão com participante desconhecido.');
      number(q.xp_reward, 'XP de missão', 0, c.game.quests.max_xp_reward);
      q.items ??= [];
      q.money_reward ??= 0;
      if (
        typeof q.money_reward !== 'number' ||
        q.money_reward < 0 ||
        q.money_reward > c.game.quests.max_money_reward
      )
        fail('Recompensa financeira inválida.');
      if (!Array.isArray(q.items) || q.items.length > 20) fail('Itens de missão inválidos.');
      if (q.delivered_rewards) {
        const reward = q.delivered_rewards;
        number(reward.xp_reward, 'XP entregue', 0, c.game.quests.max_xp_reward);
        if (
          typeof reward.money_reward !== 'number' ||
          reward.money_reward < 0 ||
          reward.money_reward > c.game.quests.max_money_reward
        )
          fail('Dinheiro entregue inválido.');
        if (!Array.isArray(reward.items) || reward.items.length > 20)
          fail('Itens entregues inválidos.');
        for (const item of reward.items) {
          text(item.name, 'Item entregue', 150, true);
          number(item.quantity, 'Quantidade', 1, 9999);
        }
      }
      for (const i of q.items) {
        text(i.name, 'Item', 150, true);
        number(i.quantity, 'Quantidade', 1, 9999);
      }
      text(q.title, 'Missão', 200, true);
      text(q.description ?? '', 'Descrição', 30000);
      if (!['active', 'review', 'completed', 'cancelled'].includes(q.status))
        fail('Estado de missão inválido.');
    }
    for (const post of list(c.social || [], 'recados', 100000)) {
      text(post.content, 'Recado', 5000, true);
      if (!socialKinds.includes(post.kind)) fail('Recado inválido.');
      if (
        post.kind === 'challenge' &&
        (!['pending', 'completed'].includes(post.status) ||
          !post.choices ||
          Object.values(post.choices).some((v) => !gestures.includes(v)) ||
          !Number.isFinite(Date.parse(post.expires_at)))
      )
        fail('Desafio inválido.');
      identifier(post.created_by, 'Autor');
      if (post.to) identifier(post.to, 'Destinatário');
      if (post.due_at && !Number.isFinite(Date.parse(post.due_at))) fail('Lembrete inválido.');
    }
    for (const s of list(c.submissions, 'solicitações')) {
      identifier(s.created_by, 'Autor');
      if (!['pending', 'changes_requested', 'approved', 'rejected'].includes(s.status))
        fail('Situação de solicitação inválida.');
      s.character = ['approved', 'rejected'].includes(s.status)
        ? historicalPlayer(s.character, c.game)
        : validatePlayer(s.character, c.game);
      number(s._revision ?? 0, 'Revisão');
      number(s.review_revision ?? 0, 'Revisão da avaliação');
      number(s.submission_revision ?? 1, 'Revisão da proposta', 1);
      text(s.review_note ?? '', 'Parecer', 5000);
    }
    for (const n of list(c.notifications, 'notificações', 100000)) {
      text(n.title, 'Notificação', 200, true);
      text(n.message ?? '', 'Notificação', 5000);
      if (!['gm', 'account'].includes(n.audience)) fail('Destinatário de notificação inválido.');
      if (!Array.isArray(n.read_by)) fail('Leituras de notificação inválidas.');
    }
    list(c.deleted_characters, 'fichas removidas');
    list(c.deleted_maps, 'mapas removidos');
  }
  for (const a of root.accounts) {
    identifier(a.id, 'ID de conta');
    text(a.display_name, 'Nome', 100, true);
    if (userIds.has(a.id) || usernames.has(a.username)) fail('Conta repetida.');
    userIds.add(a.id);
    usernames.add(a.username);
    if (
      !/^[a-z0-9_.-]{3,40}$/.test(a.username) ||
      !['admin', 'player'].includes(a.role) ||
      typeof a.active !== 'boolean'
    )
      fail('Conta inválida.');
    const h = a.password_hash;
    if (
      !h ||
      h.algorithm !== 'pbkdf2-sha256' ||
      !Number.isInteger(h.iterations) ||
      h.iterations < 10000 ||
      h.iterations > 1000000 ||
      !/^[a-f0-9]{32}$/.test(h.salt) ||
      !/^[a-f0-9]{64}$/.test(h.hash)
    )
      fail('Senha de conta incompatível.');
    imageData(a.avatar || '');
    a.avatar ??= '';
    a.bio ??= '';
    a.memberships ??= {};
    validateRewardAccount(a);
    for (const [id, ids] of Object.entries(a.memberships)) {
      const c = root.campaigns.find((c) => c.id === id);
      if (!c || !Array.isArray(ids) || ids.some((pid) => !c.characters.some((p) => p.id === pid)))
        fail('Vínculo de campanha inválido.');
    }
    a.session_version = number(a.session_version ?? 0, 'Versão da sessão');
    delete a.password;
    delete a.token;
  }
  if (!root.accounts.some((a) => a.active)) fail('O arquivo não contém contas ativas.');
  root.sessions = [];
  root.revision = number(root.revision ?? 0, 'Revisão');
  root.active_campaign_id = root.campaigns.some((c) => c.id === root.active_campaign_id)
    ? root.active_campaign_id
    : root.campaigns[0]?.id || null;
  return root;
}
export function visible(item, account) {
  return item.visibility === 'private'
    ? item.created_by === account.id
    : item.visibility === 'gm'
      ? account.role === 'admin'
      : true;
}
export function notificationVisible(n, a) {
  if (n.hidden_by?.includes(a.id)) return false;
  return n.audience === 'gm' ? a.role === 'admin' : n.recipient_id === a.id;
}
export function publicNote(note, doc) {
  const account = doc.accounts?.find((a) => a.id === note.created_by);
  return {
    ...clone(note),
    author: account
      ? { id: account.id, display_name: account.display_name, avatar: '', role: account.role }
      : note.author || { id: note.created_by, display_name: 'Acesso removido', avatar: '' }
  };
}
export function publicCampaign(c, a) {
  const result = clone(c);
  result.roster = c.roster || [
    ...c.characters.map((p) => ({ id: p.id, char: p.char })),
    ...(c.retired_roster || [])
  ];
  result.notes = result.notes.filter((n) => visible(n, a)).map((n) => publicNote(n, c));
  result.social = (result.social || [])
    .filter((p) => socialVisible(p, a))
    .map((p) => publicSocialPost(p, a));
  result.maps = result.maps
    .filter((m) => a.role === 'admin' || m.player_access)
    .map((m) =>
      publicMap(
        m,
        { ...a, character_ids: a.character_ids || a.memberships?.[c.id] || [] },
        c.characters
      )
    );
  result.intel = (c.intel || []).map((item) => publicIntel(item, a));
  result.map = result.maps[0] || emptyMap();
  result.network = personalNetwork(c, a);
  result.quests = result.quests.filter((q) => questVisible(q, a, c.id));
  result.submissions = result.submissions.filter(
    (s) => a.role === 'admin' || s.created_by === a.id
  );
  result.notifications = result.notifications.filter((n) => notificationVisible(n, a));
  for (const key of [
    'accounts',
    'sessions',
    'format',
    'snapshots',
    'characters',
    'game',
    'deleted_characters',
    'deleted_maps',
    'xp_distributions'
  ])
    delete result[key];
  return result;
}
export function workspaceExport(root) {
  const result = clone(root);
  delete result.sessions;
  for (const c of result.campaigns) {
    c.characters = c.characters.map(publicPlayer);
    c.snapshots = (c.snapshots || []).map((s) => ({
      ...s,
      data: s.kind === 'character' ? publicPlayer(s.data) : s.data
    }));
    delete c.map;
  }
  return result;
}
export function playerExport(root, account) {
  const memberships = account.memberships || {},
    campaigns = root.campaigns
      .filter((c) => Object.hasOwn(memberships, c.id))
      .map((c) => ({
        ...publicCampaign(c, account),
        game: clone(c.game),
        characters: c.characters.filter((p) => memberships[c.id].includes(p.id)).map(publicPlayer),
        deleted_characters: [],
        deleted_maps: [],
        snapshots: []
      }));
  for (const c of campaigns) delete c.map;
  const own = clone(account);
  own.role = 'player';
  own.memberships = Object.fromEntries(campaigns.map((c) => [c.id, memberships[c.id]]));
  return {
    format: 'coroa-hub-v2',
    schema_version: 9,
    revision: root.revision,
    updated_at: timestamp(),
    default_game: clone(root.default_game),
    active_campaign_id: campaigns.some((c) => c.id === root.active_campaign_id)
      ? root.active_campaign_id
      : campaigns[0]?.id,
    accounts: [own],
    campaigns
  };
}
