import { clone, fail, publicPlayer } from './model.js';
// Record files are independent; the manifest is their index for an export transaction.
export function workspaceDocuments(root) {
  const revision = root.revision,
    docs = Object.create(null),
    manifest = {
      format: 'coroa-document-set-v4',
      schema_version: 8,
      revision,
      default_game: clone(root.default_game),
      active_campaign_id: root.active_campaign_id,
      accounts_file: 'accounts.json',
      campaign_files: []
    };
  docs['accounts.json'] = {
    format: 'coroa-accounts-v4',
    _export_revision: revision,
    accounts: clone(root.accounts),
    deleted_accounts: clone(root.deleted_accounts || [])
  };
  for (const c of root.campaigns) {
    const base = `campaigns/${c.id}/`,
      meta = clone(c),
      refs = {
        game: base + 'game_data.json',
        characters: [],
        maps: [],
        notes: base + 'notes.json',
        social: base + 'social.json',
        intel: base + 'intel.json',
        quests: base + 'quests.json',
        network: base + 'network.json',
        submissions: base + 'submissions.json',
        notifications: base + 'notifications.json',
        archive: base + 'archive.json'
      };
    docs[refs.game] = {
      ...clone(c.game),
      _campaign_id: c.id,
      _export_revision: revision,
      _document_type: 'game'
    };
    for (const p of c.characters) {
      const path = base + `characters/${p.id}.json`;
      refs.characters.push(path);
      docs[path] = {
        ...publicPlayer(p),
        _campaign_id: c.id,
        _export_revision: revision,
        _document_type: 'character'
      };
    }
    for (const map of c.maps) {
      const path = base + `maps/${map.id}.json`;
      refs.maps.push(path);
      docs[path] = {
        ...clone(map),
        _campaign_id: c.id,
        _export_revision: revision,
        _document_type: 'map'
      };
    }
    for (const key of [
      'notes',
      'quests',
      'network',
      'submissions',
      'notifications',
      'social',
      'intel'
    ])
      docs[refs[key]] = {
        format: 'coroa-' + key + '-v4',
        _campaign_id: c.id,
        _export_revision: revision,
        [key]: clone(c[key])
      };
    docs[refs.archive] = {
      format: 'coroa-archive-v4',
      _campaign_id: c.id,
      _export_revision: revision,
      snapshots: clone(c.snapshots || []),
      deleted_characters: clone(c.deleted_characters || []),
      deleted_maps: clone(c.deleted_maps || [])
    };
    for (const key of [
      'game',
      'characters',
      'maps',
      'notes',
      'social',
      'intel',
      'quests',
      'network',
      'submissions',
      'notifications',
      'snapshots',
      'deleted_characters',
      'deleted_maps',
      'map'
    ])
      delete meta[key];
    meta.format = 'coroa-campaign-record-v4';
    meta._export_revision = revision;
    meta.files = refs;
    docs[base + 'campaign.json'] = meta;
    manifest.campaign_files.push(base + 'campaign.json');
  }
  docs['portal.json'] = manifest;
  return docs;
}
function strip(record) {
  const result = clone(record);
  for (const key of ['_campaign_id', '_export_revision', '_document_type']) delete result[key];
  if (result.format === 'coroa-campaign-record-v4') {
    delete result.format;
    delete result.files;
  }
  return result;
}
export function assembleDocuments(documents) {
  const keys = Object.keys(documents),
    manifestKey =
      keys.find((k) => k === 'portal.json') || keys.find((k) => k.endsWith('/portal.json'));
  if (!manifestKey) fail('O pacote precisa conter portal.json.');
  const base = manifestKey.slice(0, -'portal.json'.length),
    manifest = documents[manifestKey];
  if (manifest.format === 'coroa-hub-v2' || manifest.format === 'coroa-offline-v1') return manifest;
  if (manifest.format !== 'coroa-document-set-v4' || !Array.isArray(manifest.campaign_files))
    fail('Índice de JSONs inválido.');
  const get = (path) => {
    if (
      typeof path !== 'string' ||
      path.split('/').includes('..') ||
      !Object.hasOwn(documents, base + path)
    )
      fail('O pacote está incompleto: ' + String(path));
    const doc = documents[base + path];
    if (doc._export_revision !== manifest.revision)
      fail('Há arquivos de exportações diferentes. Exporte o conjunto completo novamente.');
    return doc;
  };
  const accounts = get(manifest.accounts_file),
    root = {
      format: 'coroa-hub-v2',
      schema_version: 8,
      revision: manifest.revision,
      default_game: clone(manifest.default_game),
      active_campaign_id: manifest.active_campaign_id,
      accounts: clone(accounts.accounts),
      deleted_accounts: clone(accounts.deleted_accounts || []),
      campaigns: []
    };
  for (const path of manifest.campaign_files) {
    const meta = get(path),
      f = meta.files;
    if (!f || !Array.isArray(f.characters) || !Array.isArray(f.maps))
      fail('Referências de campanha inválidas.');
    const local = (path) => {
      const record = get(path);
      if (record._campaign_id !== meta.id) fail('Documento de outra campanha no pacote.');
      return record;
    };
    const c = strip(meta);
    c.game = strip(local(f.game));
    c.characters = f.characters.map((path) => strip(local(path)));
    c.maps = f.maps.map((path) => strip(local(path)));
    for (const key of ['notes', 'quests', 'network', 'submissions', 'notifications'])
      c[key] = clone(local(f[key])[key]);
    c.social = f.social ? clone(local(f.social).social) : [];
    c.intel = f.intel ? clone(local(f.intel).intel) : [];
    const archive = local(f.archive);
    c.snapshots = clone(archive.snapshots);
    c.deleted_characters = clone(archive.deleted_characters);
    c.deleted_maps = clone(archive.deleted_maps);
    root.campaigns.push(c);
  }
  return root;
}
