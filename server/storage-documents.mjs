import { createHash } from 'node:crypto';
import { assembleDocuments } from '../core/documents.js';
const clone = (value) => structuredClone(value);
// JSONB changes object-key order; comparisons and content addresses must not depend on it.
export const canonicalJSON = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((k) => [k, item[k]])
        )
      : item
  );
const digest = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const format = 'coroa-storage-v10';
const omit = (value, keys) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
const logKeys = ['history', 'transactions', 'rolls'];
const campaignLists = [
  'notes',
  'quests',
  'social',
  'intel',
  'submissions',
  'notifications',
  'snapshots',
  'deleted_characters',
  'deleted_maps'
];

// Database records have their own identities. Export revision stamps belong to portable backups,
// not to storage: an XP change must not mark every rulebook and photograph as modified.
export function storageDocuments(root) {
  const docs = Object.create(null);
  const recordList = (prefix, rows, encode = (x) => clone(x)) => {
    const items = [],
      seen = new Map();
    for (const row of rows || []) {
      const id = String(row?.id ?? row?.character_id ?? digest(row));
      const key = /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : digest(id);
      const occurrence = seen.get(key) || 0;
      seen.set(key, occurrence + 1);
      const path = prefix + '/' + key + (occurrence ? '_' + occurrence : '') + '.json';
      docs[path] = encode(row, path);
      items.push(path);
    }
    const path = prefix + '/index.json';
    docs[path] = { format: 'coroa-list-v10', items };
    return path;
  };
  const character = (p, path, prefix) => {
    const record = omit(p, logKeys),
      logs = {};
    for (const key of logKeys) {
      logs[key] = (p[key] || []).map((row) => {
        const path = prefix + '/' + key + '/' + digest(row) + '.json';
        docs[path] = clone(row);
        return path;
      });
    }
    return { ...record, _coroa_character_logs: logs };
  };
  docs['default_game.json'] = clone(root.default_game);
  docs['accounts.json'] = {
    format: 'coroa-account-index-v10',
    index: recordList('accounts', root.accounts)
  };
  const deleted = recordList('deleted_accounts', root.deleted_accounts);
  const sessions = recordList(
    '__server/sessions',
    root.sessions?.map((s) => ({ id: digest(s.token), session: clone(s) }))
  );
  const campaigns = [];
  for (const c of root.campaigns) {
    const base = 'campaigns/' + c.id,
      refs = {};
    refs.game = base + '/game_data.json';
    docs[refs.game] = clone(c.game);
    refs.characters = recordList(base + '/characters', c.characters, (p, path) =>
      character(p, path, base + '/character-logs/' + p.id)
    );
    refs.maps = recordList(base + '/maps', c.maps, (m, path) => {
      const prefix = path.slice(0, -5);
      return {
        ...omit(m, ['pins', 'character_markers']),
        _coroa_map_lists: {
          pins: recordList(prefix + '/pins', m.pins),
          character_markers: recordList(prefix + '/positions', m.character_markers)
        }
      };
    });
    for (const key of campaignLists)
      refs[key] = recordList(base + '/' + key, c[key], (row, path) => {
        if (key === 'snapshots' && row.kind === 'character' && row.data?.id !== undefined) {
          const ref = path.slice(0, -5) + '/character.json';
          docs[ref] = character(row.data, ref, base + '/character-logs/' + row.data.id);
          return { ...omit(row, ['data']), _coroa_snapshot_character: ref };
        }
        return clone(row);
      });
    refs.network = base + '/network.json';
    docs[refs.network] = clone(c.network);
    const path = base + '/campaign.json';
    docs[path] = {
      ...omit(c, ['game', 'characters', 'maps', 'network', ...campaignLists]),
      _coroa_files: refs
    };
    campaigns.push(path);
  }
  docs['portal.json'] = {
    format,
    meta: omit(root, [
      'campaigns',
      'accounts',
      'deleted_accounts',
      'sessions',
      'default_game',
      'revision'
    ]),
    game: 'default_game.json',
    accounts: 'accounts.json',
    deleted,
    sessions,
    campaigns
  };
  return docs;
}

export function assembleStorage(documents, revision) {
  if (documents['portal.json']?.format !== format) {
    const root = assembleDocuments(documents);
    root.sessions = clone(documents['__server/sessions.json']?.sessions || []);
    return root;
  }
  const get = (path) => {
    if (
      typeof path !== 'string' ||
      path.split('/').includes('..') ||
      !Object.hasOwn(documents, path)
    )
      throw new Error('Registro de campanha ausente: ' + String(path));
    return documents[path];
  };
  const list = (path, decode = (x) => clone(x)) => {
    const index = get(path);
    if (index.format !== 'coroa-list-v10' || !Array.isArray(index.items))
      throw new Error('Índice de registros incompatível.');
    return index.items.map((p) => decode(get(p)));
  };
  const character = (source) => {
    const p = omit(source, ['_coroa_character_logs']);
    for (const key of logKeys)
      p[key] = (source._coroa_character_logs?.[key] || []).map((path) => clone(get(path)));
    return p;
  };
  const m = get('portal.json');
  return {
    ...clone(m.meta),
    revision,
    default_game: clone(get(m.game)),
    accounts: list(get(m.accounts).index),
    deleted_accounts: list(m.deleted),
    sessions: list(m.sessions, (s) => clone(s.session)),
    campaigns: m.campaigns.map((path) => {
      const c = get(path),
        f = c._coroa_files;
      const result = {
        ...omit(c, ['_coroa_files']),
        game: clone(get(f.game)),
        characters: list(f.characters, character),
        maps: list(f.maps, (m) => ({
          ...omit(m, ['_coroa_map_lists']),
          pins: list(m._coroa_map_lists.pins),
          character_markers: list(m._coroa_map_lists.character_markers)
        })),
        network: clone(get(f.network))
      };
      for (const key of campaignLists)
        result[key] = list(f[key], (row) =>
          row._coroa_snapshot_character
            ? {
                ...omit(row, ['_coroa_snapshot_character']),
                data: character(get(row._coroa_snapshot_character))
              }
            : clone(row)
        );
      return result;
    })
  };
}
