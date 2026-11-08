import { isMediaURL, mediaURL } from '../core/media-reference.js';
import { publicCampaign } from '../core/workspace.js';
import { campaignMembers, publicMember } from '../core/community-service.js';
export function mediaReferences(value, result = new Set()) {
  if (isMediaURL(value)) result.add(value);
  else if (value && typeof value === 'object' && Object.hasOwn(value, '_coroa_media')) {
    const ref = value._coroa_media;
    if (!ref || typeof ref.path !== 'string' || !isMediaURL(mediaURL(ref)))
      throw Object.assign(
        new Error('Referência de imagem inválida. Use um backup com as imagens incluídas.'),
        { status: 400 }
      );
    result.add(mediaURL(ref));
  } else if (Array.isArray(value)) for (const v of value) mediaReferences(v, result);
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) mediaReferences(v, result);
  return result;
}
// Use the same visibility models as the JSON endpoints: hidden maps, private notes,
// other characters' relationship walls and unrevealed intel cannot leak through images.
export function allowedMedia(root, account) {
  if (account.role === 'admin') return mediaReferences(root);
  const allowed = mediaReferences({ avatar: account.avatar, game: root.default_game });
  for (const c of root.campaigns) {
    if (!Object.hasOwn(account.memberships || {}, c.id)) continue;
    const a = { ...account, character_ids: account.memberships[c.id] };
    mediaReferences(publicCampaign(c, a), allowed);
    mediaReferences(
      c.characters.filter((p) => a.character_ids.includes(p.id)),
      allowed
    );
    mediaReferences(c.game, allowed);
    for (const member of campaignMembers(root, c.id))
      mediaReferences(publicMember(member, c, true), allowed);
  }
  return allowed;
}
export function assertMediaInput(data, root, account) {
  const refs = mediaReferences(data);
  if (!refs.size) return;
  if (!account)
    throw Object.assign(new Error('Envie uma nova imagem pelo seu cadastro.'), { status: 403 });
  const allowed = allowedMedia(root, account);
  for (const ref of refs)
    if (!allowed.has(ref))
      throw Object.assign(new Error('Esta imagem não está disponível para o seu acesso.'), {
        status: 403
      });
}
