import { CampaignStore, campaignRecord } from '../core/store.js';
import { PortalService } from '../core/portal-service.js';
import { accountRecord } from '../core/service.js';
import {
  blank,
  clone,
  fail,
  newId,
  number,
  publicAccount,
  publicPlayer,
  recordId,
  timestamp,
  validatePlayer
} from '../core/model.js';
import { moneyValue } from '../core/settings.js';
import { hashPassword } from '../core/passwords.js';

// These disposable JSON workspaces never reach the production repository.
// Every request still authenticates the narrator's real session at the HTTP boundary.
export class PlayerTestSessions {
  constructor({ now = Date.now, maxSessions = 4, idleMs = 30 * 60 * 1000 } = {}) {
    this.now = now;
    this.maxSessions = maxSessions;
    this.idleMs = idleMs;
    this.sessions = new Map();
  }

  prune() {
    for (const [id, session] of this.sessions)
      if (this.now() - session.lastUsed >= this.idleMs) this.sessions.delete(id);
  }

  requireNarrator(actor) {
    if (actor?.role !== 'admin') fail('Somente narradores podem iniciar testes de jogador.', 403);
  }

  session(id, actor, token) {
    this.requireNarrator(actor);
    this.prune();
    const session = this.sessions.get(id);
    if (!session) {
      const error = new Error('O teste foi encerrado. Você está voltando ao narrador.');
      throw Object.assign(error, { status: 410, code: 'PLAYER_TEST_EXPIRED' });
    }
    if (session.owner !== actor.id || session.ownerToken !== token)
      fail('Este teste pertence a outro acesso.', 403);
    session.lastUsed = this.now();
    return session;
  }

  async start(root, actor, token, data = {}, selectedCampaignId) {
    this.requireNarrator(actor);
    this.prune();
    const previous = [...this.sessions.entries()].find(([, s]) => s.owner === actor.id);
    if (!previous && this.sessions.size >= this.maxSessions)
      fail('Há outros testes abertos. Encerre um deles ou tente novamente em alguns minutos.', 409);
    const sourceId = data.campaign_id || selectedCampaignId || root.active_campaign_id;
    const source = root.campaigns.find((c) => c.id === sourceId);
    if (data.campaign_id && !source) fail('Campanha não encontrada.', 404);
    const game = clone(source?.game || root.default_game);
    let original;
    if (data.character_id !== undefined && data.character_id !== null) {
      number(data.character_id, 'Personagem de referência', 0, 999999);
      original = source?.characters.find((p) => p.id === data.character_id && !p.archived);
      if (!original) fail('Escolha uma ficha ativa desta campanha para copiar.', 404);
    }
    const character = original
      ? publicPlayer(original)
      : blank(game, recordId({ characters: source?.characters || [] }));
    Object.assign(character, {
      char: original ? original.char.slice(0, 138) + ' · teste' : 'Personagem de testes',
      player: 'Jogador de testes',
      cla: original?.cla || 'Livre',
      xp: number(data.xp ?? 100, 'XP para testes', 0, 1000000),
      money: moneyValue(data.money ?? 1000),
      archived: false,
      _revision: 0,
      history: [],
      rolls: [],
      transactions: [],
      notes: [],
      goals: []
    });
    if (character.money < 0) fail('O saldo de testes não pode ser negativo.');
    validatePlayer(character, game);
    const password = newId() + newId();
    const hash = await hashPassword(password);
    const player = accountRecord(
      { username: 'jogador-teste', password, display_name: 'Jogador de testes' },
      hash
    );
    const companion = accountRecord(
      { username: 'companhia-teste', password, display_name: 'Companheiro de testes' },
      hash
    );
    player.avatar = actor.avatar || '';
    player.preferences = { ...player.preferences, ...clone(actor.preferences || {}) };
    player.bio = 'Acesso temporário para testar a experiência de jogador.';
    const campaign = campaignRecord(game, {
      title: ('Testes · ' + (source?.title || 'A Coroa Velada')).slice(0, 150),
      description: 'Ambiente temporário: tudo que você alterar aqui será descartado ao sair.',
      accent: source?.accent || '#d92343',
      cover: source?.cover || '',
      characters: [character],
      maps:
        data.include_maps === false
          ? []
          : (source?.maps || [])
              .filter((m) => m.player_access)
              .map((m) => ({
                ...clone(m),
                character_markers: [],
                pins: (m.pins || [])
                  .filter((p) => !p.visibility || p.visibility === 'campaign')
                  .map((p) => ({ ...clone(p), character_id: null }))
              })),
      intel: [
        {
          id: newId(),
          title: 'Uma pista para experimentar',
          category: 'Pista',
          teaser: 'Compre esta investigação para conferir o desconto e a revelação.',
          xp_cost: 5,
          money_cost: 10,
          secret: 'Esta é uma descoberta fictícia. Nenhum segredo da campanha real foi usado.',
          cover: '',
          images: [],
          purchase: null,
          _revision: 0,
          created_by: companion.id,
          created_at: timestamp()
        }
      ],
      quests: [
        {
          id: newId(),
          title: 'Conhecer o outro lado do véu',
          description:
            'Uma missão fictícia para consultar na visão de jogador. Somente o narrador entrega recompensas.',
          status: 'active',
          assignees: [character.id],
          xp_reward: 5,
          money_reward: 100,
          items: [],
          created_by: companion.id,
          created_at: timestamp(),
          _revision: 0
        }
      ]
    });
    player.memberships = { [campaign.id]: [character.id] };
    companion.memberships = { [campaign.id]: [] };
    const internalToken = newId() + newId();
    const testRoot = {
      format: 'coroa-hub-v2',
      schema_version: 9,
      revision: 0,
      default_game: game,
      active_campaign_id: campaign.id,
      accounts: [player, companion],
      campaigns: [campaign],
      sessions: [{ token: internalToken, account: player.id, version: 0, expires: null }]
    };
    if (JSON.stringify(testRoot).length > 24 * 1024 * 1024)
      fail(
        'Os mapas são grandes demais para o teste. Desmarque a cópia dos mapas e tente novamente.',
        413
      );
    const store = new CampaignStore(testRoot);
    const service = new PortalService(store);
    const id = newId() + newId();
    const session = {
      owner: actor.id,
      ownerToken: token,
      token: internalToken,
      service,
      store,
      sourceCampaignId: source?.id || null,
      lastUsed: this.now()
    };
    if (previous) this.sessions.delete(previous[0]);
    this.sessions.set(id, session);
    return {
      account: publicAccount(service.auth(await store.get(), internalToken)),
      campaign_id: campaign.id,
      player_test: { id, source_campaign_id: source?.id || null, isolated: true },
      mode: 'player-test'
    };
  }

  async request(id, actor, ownerToken, path, { method = 'GET', data = {}, campaignId } = {}) {
    const session = this.session(id, actor, ownerToken);
    if (campaignId && campaignId !== session.store.root.active_campaign_id)
      fail('Este teste usa somente a campanha temporária.', 403);
    if (path.startsWith('/auth/') && path !== '/auth/me')
      fail('Saia do modo de teste para alterar o seu acesso.', 403);
    const response =
      path === '/api/sync'
        ? { revision: session.store.root.revision }
        : await session.service.request(path, { method, data, token: session.token });
    if (path === '/auth/me') {
      response.campaign_id = session.store.root.active_campaign_id;
      response.player_test = { id, source_campaign_id: session.sourceCampaignId, isolated: true };
      response.mode = 'player-test';
    }
    return { response, revision: session.store.root.revision };
  }

  end(id, actor, token) {
    this.requireNarrator(actor);
    const session = this.sessions.get(id);
    if (session && (session.owner !== actor.id || session.ownerToken !== token))
      fail('Este teste pertence a outro acesso.', 403);
    this.sessions.delete(id);
  }

  endOwner(id) {
    for (const [key, session] of this.sessions) if (session.owner === id) this.sessions.delete(key);
  }

  clear() {
    this.sessions.clear();
  }
}
