import { newId, timestamp } from './model.js';
export function rewardEvent(doc, account, data) {
  if (!account || account.role !== 'player') return;
  account.reward_events ??= [];
  const event = {
    ...data,
    id: newId(),
    campaign_id: doc.id,
    created_at: timestamp(),
    seen_at: null
  };
  account.reward_events.push(event);
  // Keep pending celebrations first; old acknowledged receipts are expendable.
  const pending = account.reward_events.filter((e) => !e.seen_at).slice(-500);
  const seen = account.reward_events.filter((e) => e.seen_at).slice(-50);
  account.reward_events = [...seen, ...pending];
  return event;
}
export function characterRewards(doc, previous, next, actor, action, details) {
  const owner = doc.accounts.find((a) => a.role === 'player' && a.character_ids.includes(next.id));
  if (!owner) return;
  const base = { character_id: next.id, character_name: next.char, reason: details || action };
  if (next.xp > previous.xp)
    rewardEvent(doc, owner, {
      ...base,
      kind: 'xp',
      amount: next.xp - previous.xp,
      balance_after: next.xp
    });
  const changes = [];
  if (next.bloodpotency > previous.bloodpotency)
    changes.push({
      key: 'bloodpotency',
      id: 0,
      name: 'Potência do Sangue',
      from: previous.bloodpotency,
      to: next.bloodpotency,
      learned: false
    });
  for (const key of [
    'atributes',
    'talents',
    'expertises',
    'knowledges',
    'precedents',
    'disciplines'
  ])
    for (const row of next[key] || []) {
      const before = previous[key]?.find((r) => r.id === row.id),
        field = key === 'disciplines' ? 'nivel' : 'value';
      if ((!before && key === 'disciplines') || row[field] > (before?.[field] || 0))
        changes.push({
          key,
          id: row.id,
          name: doc.game[key].find((d) => d.id === row.id)?.name || 'Novo traço',
          from: before?.[field] || 0,
          to: row[field],
          learned: !before && key === 'disciplines'
        });
    }
  if (changes.length)
    rewardEvent(doc, owner, {
      ...base,
      kind: changes.some((c) => c.learned) ? 'discipline' : 'upgrade',
      changes: changes.slice(0, 50)
    });
}
