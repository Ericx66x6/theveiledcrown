import { clone, newId, timestamp } from './model.js';
import { gameSettings } from './settings.js';
export const emptyMap = () => ({ image: '', width: 0, height: 0, pins: [] });
export function normalizeCampaign(source) {
  const c = clone(source);
  delete c.universe;
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
    player_access: false,
    _revision: 0,
    pins: [],
    ...m
  }));
  for (const key of [
    'notes',
    'quests',
    'submissions',
    'notifications',
    'deleted_characters',
    'deleted_maps',
    'retired_roster',
    'snapshots'
  ])
    c[key] ??= [];
  c.network ??= { nodes: [], links: [] };
  c.characters ??= [];
  return c;
}
export function normalizeRoot(source) {
  const root = clone(source);
  root.schema_version = 6;
  root.deleted_accounts ??= [];
  root.campaigns = root.campaigns.map(normalizeCampaign);
  for (const a of root.accounts) {
    a.preferences = { sound: false, ui_sound: true, animations: true, ...a.preferences };
    if (a.role === 'admin')
      a.memberships = Object.fromEntries(Object.keys(a.memberships || {}).map((id) => [id, []]));
  }
  for (const c of root.campaigns) {
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
