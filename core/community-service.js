import { clone, fail, newId, text, timestamp } from './model.js';
import { notification } from './management-service.js';

export function campaignMembers(root, campaignId) {
  return root.accounts.filter(
    (a) => a.active && (a.role === 'admin' || Object.hasOwn(a.memberships || {}, campaignId))
  );
}
export function publicMember(account, campaign, full = false) {
  const ids = account.memberships?.[campaign.id] || [];
  return {
    id: account.id,
    display_name: account.display_name,
    avatar: account.avatar || '',
    bio: account.bio || '',
    role: account.role,
    characters: campaign.characters
      .filter((p) => ids.includes(p.id) && !p.archived)
      .map((p) => ({
        id: p.id,
        char: p.char,
        cla: p.cla,
        profilepicture: full && p.profilepicture?.startsWith('data:image/') ? p.profilepicture : ''
      }))
  };
}
export const socialVisible = (post, account) =>
  !post.hidden_by?.includes(account.id) &&
  (!post.to || post.to === account.id || post.created_by === account.id);
export function socialSnapshot(root, campaign, account) {
  return {
    members: campaignMembers(root, campaign.id).map((a) => publicMember(a, campaign)),
    posts: (campaign.social || [])
      .filter((p) => socialVisible(p, account))
      .map((p) => ({
        ...clone(p),
        author: (() => {
          const a = root.accounts.find((a) => a.id === p.created_by);
          return a
            ? { id: a.id, display_name: a.display_name, avatar: '', role: a.role }
            : p.author || { id: p.created_by, display_name: 'Acesso removido', avatar: '' };
        })()
      }))
  };
}
export async function communityRequest(service, path, method, data, token, doc, actor, root) {
  const members = campaignMembers(root, doc.id);
  if (path.startsWith('/api/members/')) {
    const member = members.find((a) => a.id === path.split('/')[3]);
    if (!member) fail('Esse perfil não está disponível nesta campanha.', 404);
    return publicMember(member, doc, true);
  }
  if (method === 'GET') return socialSnapshot(root, doc, actor);
  if (!root.campaigns.some((c) => c.id === doc.id))
    fail('Entre em uma campanha para interagir.', 409);
  return service.write(token, (d, a) => {
    d.social ??= [];
    const id = path.split('/')[3];
    if (method === 'DELETE') {
      const post = d.social.find((p) => p.id === id && socialVisible(p, a));
      if (!post) fail('Recado não encontrado.', 404);
      if (post.created_by === a.id || (a.role === 'admin' && !post.to))
        d.social = d.social.filter((p) => p.id !== id);
      else if (post.to === a.id) post.hidden_by = [...new Set([...(post.hidden_by || []), a.id])];
      else fail('Você não pode apagar esse recado.', 403);
      return { status: 'deleted' };
    }
    const kind = data.kind || 'message';
    if (!['message', 'reminder', 'poke'].includes(kind)) fail('Interação inválida.');
    const to = data.to || null;
    if (to && (!members.some((m) => m.id === to) || to === a.id))
      fail('Escolha outro participante desta campanha.');
    if (kind === 'poke' && !to) fail('Escolha quem deseja cutucar.');
    if (
      kind === 'poke' &&
      d.social.some(
        (p) =>
          p.kind === 'poke' &&
          p.created_by === a.id &&
          p.to === to &&
          Date.parse(p.created_at) > Date.now() - 60000
      )
    )
      fail('Espere um minuto antes de cutucar essa pessoa de novo.', 429);
    const due = data.due_at || '';
    if (due && !Number.isFinite(Date.parse(due))) fail('Data de lembrete inválida.');
    const post = {
      id: newId(),
      kind,
      to,
      created_by: a.id,
      created_at: timestamp(),
      _revision: 0,
      author: { id: a.id, display_name: a.display_name, avatar: '', role: a.role },
      title: text(
        data.title ||
          (kind === 'poke'
            ? 'Um toque do outro lado do véu'
            : kind === 'reminder'
              ? 'Lembrete da mesa'
              : ''),
        'Título',
        200
      ),
      content:
        kind === 'poke'
          ? 'cutucou você. A noite está chamando.'
          : text(data.content, 'Recado', 5000, true),
      due_at: due,
      hidden_by: []
    };
    d.social.unshift(post);
    d.social = d.social.slice(0, 500);
    for (const recipient of members.filter((m) => m.id !== a.id && (!to || m.id === to)))
      notification(d, {
        audience: 'account',
        recipient_id: recipient.id,
        title:
          kind === 'poke'
            ? a.display_name + ' cutucou você'
            : (to ? 'Recado de ' : 'Na mesa: ') + a.display_name,
        message: post.content.slice(0, 500),
        kind: 'social',
        target: post.id,
        created_by: a.id
      });
    return clone(post);
  });
}
