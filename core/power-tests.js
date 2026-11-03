export const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
export function resolvePowerTest(player, game, test, { disciplineId = null } = {}) {
  if (!test || /^(nenhum|nao|não|none)$/i.test(test.trim()) || !player) return null;
  const split = test.split(/\s+(?:vs\.?|versus|contra|resistid[oa](?:\s+por)?)\s+/i);
  const source = split[0].replace(/^teste\s*:\s*/i, '').trim();
  const defs = [
    'atributes',
    'talents',
    'expertises',
    'knowledges',
    'precedents',
    'disciplines'
  ].flatMap((key) =>
    (game[key] || []).map((d) => ({
      key,
      id: d.id,
      name: d.name,
      value:
        player[key]?.find((e) => e.id === d.id)?.[key === 'disciplines' ? 'nivel' : 'value'] || 0
    }))
  );
  defs.push(
    { key: 'bloodpotency', id: null, name: 'Potência do sangue', value: player.bloodpotency || 0 },
    { key: 'willpower', id: null, name: 'Força de vontade', value: player.status?.willpower || 0 }
  );
  const special = player.disciplines?.find((d) => d.id === disciplineId);
  const parts = source.split(/\s*\+\s*/).map((raw) => {
    const normalized = fold(raw.replace(/\s*\((?:dif|dificuldade|sucesso|minimo|mínimo).*$/i, ''));
    if (/^\d+$/.test(normalized))
      return { name: raw.trim(), value: Number(normalized), key: 'fixed', id: null };
    if (
      ['nivel da disciplina', 'disciplina', 'nivel do poder'].includes(normalized) &&
      disciplineId !== null
    )
      return {
        key: 'disciplines',
        id: disciplineId,
        name: 'Nível da disciplina',
        value: special?.nivel || 0
      };
    const alternatives = normalized
      .split(/\s+ou\s+|\s+or\s+/)
      .map((term) => defs.find((d) => fold(d.name) === term));
    if (alternatives.length > 1 && alternatives.every(Boolean))
      return { name: raw.trim(), value: null, alternatives };
    const exact = defs.find((d) => fold(d.name) === normalized);
    return exact ? { ...exact } : { name: raw.trim(), value: null, unresolved: true };
  });
  const complete = parts.length > 0 && parts.every((p) => p.value !== null);
  return {
    source,
    opposition: split.slice(1).join(' vs ') || null,
    parts,
    complete,
    total: complete ? parts.reduce((s, p) => s + p.value, 0) : null
  };
}
