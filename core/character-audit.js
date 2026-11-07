import { labels } from '../shared/rules.js';
export function characterChanges(before, after, game) {
  const changes = [];
  for (const [key, label] of [
    ['char', 'Nome'],
    ['cla', 'Clã'],
    ['generation', 'Geração'],
    ['bloodpotency', 'Potência do sangue'],
    ['xp', 'XP'],
    ['money', 'Dinheiro']
  ])
    if (before[key] !== after[key]) changes.push(`${label}: ${before[key]} → ${after[key]}`);
  for (const key of [
    'atributes',
    'talents',
    'expertises',
    'knowledges',
    'precedents',
    'disciplines'
  ]) {
    if (!Array.isArray(after[key])) continue;
    const field = key === 'disciplines' ? 'nivel' : 'value';
    for (const next of after[key]) {
      const old = before[key].find((e) => e.id === next.id),
        name = game[key].find((e) => e.id === next.id)?.name || String(next.id);
      if (!old) changes.push(`${name}: concedida no nível ${next[field]}`);
      else if (old[field] !== next[field]) changes.push(`${name}: ${old[field]} → ${next[field]}`);
    }
    for (const old of before[key])
      if (!after[key].some((e) => e.id === old.id))
        changes.push(`${game[key].find((e) => e.id === old.id)?.name || old.id}: removido`);
  }
  for (const key of ['allies', 'domains', 'contacts', 'retainers', 'favours', 'items']) {
    if (!Array.isArray(after[key])) continue;
    for (const item of after[key]) {
      const old = before[key].find((e) => String(e.id) === String(item.id));
      if (!old) changes.push(`${labels[key] || key}: ${item.name || 'registro'} adicionado`);
      else if (JSON.stringify(old) !== JSON.stringify(item))
        changes.push(`${labels[key] || key}: ${item.name || 'registro'} atualizado`);
    }
    for (const old of before[key])
      if (!after[key].some((e) => String(e.id) === String(old.id)))
        changes.push(`${labels[key] || key}: ${old.name || 'registro'} removido`);
  }
  for (const [key, value] of Object.entries(after.status || {}))
    if (before.status?.[key] !== value)
      changes.push(`${labels[key] || key}: ${before.status?.[key]} → ${value}`);
  if (before.biography !== after.biography) changes.push('História atualizada');
  for (const key of ['ambition', 'desire'])
    if (before.aspirations?.[key] !== after.aspirations?.[key])
      changes.push(`${key === 'ambition' ? 'Ambição' : 'Desejo'} atualizado`);
  if (JSON.stringify(before.portrait_frame) !== JSON.stringify(after.portrait_frame))
    changes.push('Enquadramento do retrato atualizado');
  if (before.profilepicture !== after.profilepicture) changes.push('Retrato atualizado');
  if (JSON.stringify(before.moralityes) !== JSON.stringify(after.moralityes))
    changes.push('Convicções atualizadas');
  return changes.slice(0, 100).join(' · ');
}
