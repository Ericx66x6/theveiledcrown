import { clone, newId, timestamp } from './model.js';
import { gameSettings } from './settings.js';
import { migrateAspirations } from './aspirations.js';
import { rememberProgress } from './chronicle-state.js';
export const emptyMap = () => ({ image: '', width: 0, height: 0, pins: [] });
export function normalizeCampaign(source) {
  const c = clone(source);
  delete c.universe;
  delete c.system;
  c.cover ??= '';
  c.moral_principle ??= '';
  c._revision ??= 0;
  c.xp_distributions ??= [];
  c.game = gameSettings(c.game);
  if (!c.maps) {
    c.maps =
      c.map && (c.map.image || c.map.pins?.length)
        ? [
            {
              id: newId(),
              title: 'Mapa da campanha',
              description: '',
              player_access: true,
              _revision: 0,
              created_at: timestamp(),
              ...c.map
            }
          ]
        : [];
  }
  delete c.map;
  c.maps = c.maps.map((m) => ({
    description: '',
    mode: 'image',
    player_access: false,
    _revision: 0,
    pins: [],
    character_markers: [],
    scale: null,
    ...m
  }));
  for (const key of [
    'notes',
    'recaps',
    'feedbacks',
    'documents',
    'intel',
    'social',
    'quests',
    'submissions',
    'notifications',
    'deleted_characters',
    'deleted_maps',
    'retired_roster',
    'snapshots'
  ])
    c[key] ??= [];
  c.quests = c.quests.map((q) => (q.status === 'review' ? { ...q, status: 'active' } : q));
  c.network ??= { nodes: [], links: [] };
  c.characters ??= [];
  return c;
}
export function normalizeRoot(source) {
  const root = clone(source);
  root.schema_version = 9;
  root.deleted_accounts ??= [];
  root.default_game ??= clone(root.campaigns[0]?.game);
  root.active_campaign_id ??= root.campaigns[0]?.id || null;
  root.campaigns = root.campaigns.map(normalizeCampaign);
  for (const a of root.accounts) {
    a.achievements ??= [];
    if (a.achievement_schema !== 1) {
      for (const event of a.reward_events || []) rememberProgress(a, event);
      a.achievement_schema = 1;
    }
    const firstAudioUpdate = a.preferences?.audio_defaults_version !== 2;
    a.preferences = {
      audio_enabled: a.preferences?.ui_sound !== false,
      music_enabled: true,
      sfx_volume: 80,
      music_volume: 35,
      animations: true,
      social_mood: 'chat',
      social_note: '',
      ...a.preferences
    };
    if (firstAudioUpdate) {
      a.preferences.music_enabled = a.preferences.audio_enabled !== false;
      a.preferences.audio_defaults_version = 2;
    }
    delete a.preferences.sound;
    delete a.preferences.ui_sound;
    if (a.role === 'admin')
      a.memberships = Object.fromEntries(Object.keys(a.memberships || {}).map((id) => [id, []]));
  }
  for (const c of root.campaigns) {
    const imported = new Set(c.notes.map((n) => n.id));
    for (const p of c.characters) {
      migrateAspirations(p, c.notes);
      c.notes = c.notes.filter(
        (n) => !(n.id?.startsWith(`legacy-${p.id}-goals-`) && n.character_id === p.id)
      );
      const owner = root.accounts.find(
        (a) => a.role === 'player' && a.memberships?.[c.id]?.includes(p.id)
      );
      if (!owner) continue;
      for (const kind of ['notes']) {
        for (const [index, row] of (p[kind] || []).entries()) {
          const fingerprint = JSON.stringify([
            row.id ?? index,
            row.title,
            row.name,
            row.content || row.description || '',
            row.created_at || row.date || '',
            row.time || ''
          ]);
          const hash = [...fingerprint]
            .reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
            .toString(16);
          const id = `legacy-${p.id}-${kind}-${hash}`;
          if (imported.has(id)) continue;
          const content = row.content || row.description || '';
          if (content) {
            c.notes.push({
              id,
              title:
                row.title ||
                row.name ||
                (kind === 'goals' ? (index === 0 ? 'Ambição' : 'Desejo') : 'Anotação') +
                  ' · ' +
                  p.char,
              content,
              visibility: 'private',
              created_by: owner.id,
              created_at: row.created_at || p.created_at || c.updated_at || timestamp(),
              ...(row.date
                ? { legacy_date_label: String(row.date) + (row.time ? ' · ' + row.time : '') }
                : {}),
              updated_at: c.updated_at || timestamp(),
              _revision: 0,
              character_id: p.id,
              tags: 'Importada da ficha'
            });
            imported.add(id);
          }
        }
        p[kind] = [];
      }
    }
    const retained = [];
    for (const post of c.social) {
      if (post.to) {
        retained.push(post);
        continue;
      }
      const id = 'legacy-social-' + post.id;
      if (!imported.has(id)) {
        c.notes.push({
          id,
          title: post.title || 'Recado da mesa',
          content: post.content || '',
          created_by: post.created_by,
          created_at: post.created_at,
          updated_at: post.created_at,
          visibility: 'campaign',
          _revision: 0,
          tags: 'Importada do salão'
        });
        imported.add(id);
      }
    }
    c.social = retained;
    const orphaned = c.network.nodes.filter((n) => n.character_id === undefined);
    for (const n of orphaned) {
      const owner = root.accounts.find((a) => a.id === n.created_by && a.role === 'player');
      n.character_id = owner?.memberships?.[c.id]?.[0] ?? null;
    }
    for (const e of c.network.links) {
      if (e.character_id === undefined) {
        const from = c.network.nodes.find((n) => n.id === e.from);
        const to = c.network.nodes.find((n) => n.id === e.to);
        e.character_id =
          from?.character_id === to?.character_id ? (from?.character_id ?? null) : null;
      }
    }
    c.xp_distributions ??= [];
  }
  return root;
}
