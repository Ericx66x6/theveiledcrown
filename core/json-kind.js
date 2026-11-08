// Detect the destination; each destination still runs its full schema validation.
export function jsonKind(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return 'unknown';
  if (
    source.format === 'coroa-game-data-v1' ||
    (Array.isArray(source.disciplines) && Array.isArray(source.atributes) && source.xp_cost)
  )
    return 'game';
  if (
    ['coroa-hub-v2', 'coroa-campaign-v2', 'coroa-offline-v1', 'coroa-offline-player-v1'].includes(
      source.format
    ) ||
    (Array.isArray(source.campaigns) && Array.isArray(source.accounts))
  )
    return 'workspace';
  if (Number.isSafeInteger(source.id) && typeof source.char === 'string') return 'character';
  return 'unknown';
}
export function jsonDestinationError(source, destination) {
  const kind = jsonKind(source);
  if (kind === 'unknown' || kind === destination) return null;
  if (kind === 'game')
    return 'Este arquivo é um livro de regras (game-data). Importe em Livro de regras → Gerenciar livro → Importar game-data. Ele não é uma ficha nem um backup completo do portal.';
  if (kind === 'workspace')
    return 'Este arquivo é um backup de campanha ou portal. Use Arquivos da campanha → Importar backup JSON ou ZIP. Para atualizar somente as regras, selecione um game-data.';
  return 'Este arquivo é uma ficha de personagem. Use Personagens → Importar JSON ou Arquivos da campanha → Importar ficha.';
}
