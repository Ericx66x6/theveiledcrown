// These rules are shared by the browser preview and the authoritative HTTP API.
export const characterIds = (account, campaignId) =>
  account.character_ids || account.memberships?.[campaignId] || [];
export const questVisible = (quest, account, campaignId) =>
  account.role === 'admin' ||
  quest.assignees.some((id) => characterIds(account, campaignId).includes(id));
export function personalNetwork(campaign, account, characterId) {
  if (account.role !== 'player') return { nodes: [], links: [] };
  const own = characterIds(account, campaign.id);
  const ids = characterId === undefined ? own : own.filter((id) => id === characterId);
  const nodes = campaign.network.nodes.filter((n) => ids.includes(n.character_id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    links: campaign.network.links.filter(
      (e) => ids.includes(e.character_id) && nodeIds.has(e.from) && nodeIds.has(e.to)
    )
  };
}
