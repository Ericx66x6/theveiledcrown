// JSON repository port: no browser database or Web Storage.
import { clone, newId, timestamp, fail } from './model.js';
import { gameSettings } from './settings.js';
import { normalizeRoot, normalizeCampaign } from './campaign-shape.js';
export function campaignRecord(game, data = {}) {
  return {
    id: data.id || newId(),
    title: data.title || 'A Coroa Velada',
    cover: data.cover || '',
    _revision: 0,
    description: data.description || 'Uma crônica entre o sangue e o poder.',
    status: data.status || 'active',
    accent: data.accent || '#d92343',
    game: gameSettings(game),
    characters: [],
    notes: [],
    social: [],
    intel: [],
    quests: [],
    maps: [],
    submissions: [],
    notifications: [],
    deleted_characters: [],
    deleted_maps: [],
    retired_roster: [],
    network: { nodes: [], links: [] },
    snapshots: [],
    revision: 0,
    updated_at: timestamp(),
    ...data
  };
}
export function workspaceFromLegacy(doc) {
  if (doc.format === 'coroa-hub-v2') return normalizeRoot(doc);
  const id = newId(),
    c = campaignRecord(doc.game, {
      id,
      characters: clone(doc.characters || []),
      snapshots: clone(doc.snapshots || [])
    });
  return {
    format: 'coroa-hub-v2',
    schema_version: 9,
    revision: 0,
    updated_at: timestamp(),
    active_campaign_id: id,
    accounts: (doc.accounts || []).map((a) => ({
      ...clone(a),
      avatar: a.avatar || '',
      memberships: { [id]: clone(a.character_ids || []) }
    })),
    campaigns: [c],
    sessions: clone(doc.sessions || [])
  };
}
export class CampaignStore {
  constructor(seed) {
    this.root = normalizeRoot(workspaceFromLegacy(seed));
    this.mode = 'json-memory';
    this.cleanRevision = this.root.revision;
    this.queue = Promise.resolve();
  }
  async open() {
    return this;
  }
  get dirty() {
    return this.root.revision !== this.cleanRevision;
  }
  current() {
    return (
      this.root.campaigns.find((c) => c.id === this.root.active_campaign_id) ||
      this.root.campaigns[0] ||
      campaignRecord(this.root.default_game, { id: 'no-campaign', title: 'Escolha uma campanha' })
    );
  }
  async workspace() {
    return clone(this.root);
  }
  project() {
    const c = this.current();
    return {
      ...clone(c),
      format: 'coroa-offline-v1',
      accounts: this.root.accounts.map((a) => ({
        ...clone(a),
        character_ids: clone(a.memberships?.[c.id] || []),
        _campaign_member: Object.hasOwn(a.memberships || {}, c.id)
      })),
      sessions: clone(this.root.sessions || [])
    };
  }
  async get() {
    return this.project();
  }
  async transact(change, { dirty = true } = {}) {
    return this.atomic(
      (root) => {
        const c =
          root.campaigns.find((c) => c.id === root.active_campaign_id) ||
          root.campaigns[0] ||
          campaignRecord(root.default_game, { id: 'no-campaign', title: 'Escolha uma campanha' });
        const doc = {
          ...clone(c),
          format: 'coroa-offline-v1',
          accounts: root.accounts.map((a) => ({
            ...clone(a),
            character_ids: clone(a.memberships?.[c.id] || []),
            _campaign_member: Object.hasOwn(a.memberships || {}, c.id)
          })),
          sessions: clone(root.sessions || [])
        };
        const changed = change(doc) ?? doc;
        if (changed?.then) throw new Error('A transação precisa ser síncrona.');
        const { accounts, sessions, format, ...campaign } = changed;
        if (root.campaigns.some((x) => x.id === c.id))
          root.campaigns[root.campaigns.findIndex((x) => x.id === c.id)] = {
            ...c,
            ...campaign,
            id: c.id,
            game: gameSettings(campaign.game)
          };
        root.accounts = accounts.map((a) => {
          const previous = root.accounts.find((x) => x.id === a.id),
            memberships = clone(a.memberships || previous?.memberships || {});
          if (a._revoke_campaign) delete memberships[c.id];
          else if (a._campaign_member || a.character_ids?.length || !previous)
            if (c.id !== 'no-campaign') memberships[c.id] = clone(a.character_ids || []);
          const result = { ...a, memberships };
          delete result.character_ids;
          delete result._campaign_member;
          delete result._revoke_campaign;
          return result;
        });
        root.sessions = sessions || [];
        return root;
      },
      { dirty }
    );
  }
  async atomic(change, { dirty = true } = {}) {
    let output;
    const run = this.queue.then(() => {
      const copy = clone(this.root);
      const result = change(copy) ?? copy;
      if (result?.then) throw new Error('A transação precisa ser síncrona.');
      result.revision = this.root.revision + (dirty ? 1 : 0);
      result.updated_at = timestamp();
      this.root = result;
      output = clone(result);
      return output;
    });
    this.queue = run.catch(() => {});
    await run;
    return output;
  }
  async select(id) {
    await this.atomic(
      (root) => {
        if (!root.campaigns.some((c) => c.id === id)) fail('Mesa não encontrada.', 404);
        root.active_campaign_id = id;
        return root;
      },
      { dirty: false }
    );
    return this.get();
  }
  async replace(document) {
    this.root = normalizeRoot(document);
    this.root.sessions = [];
    this.root.revision = (this.root.revision || 0) + 1;
    return this.workspace();
  }
  markExported(revision = this.root.revision) {
    this.cleanRevision = revision;
  }
  close() {}
}
