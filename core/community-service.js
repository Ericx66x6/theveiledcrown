import { clone, fail, newId, text, timestamp } from './model.js';
import { notification } from './notifications.js';
import {
  socialVisible,
  publicSocialPost,
  socialKinds,
  gestures,
  rpsWinner
} from './social-state.js';
export { socialVisible } from './social-state.js';
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
    mood: account.preferences?.social_mood || 'chat',
    social_note: account.preferences?.social_note || '',
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
export function socialSnapshot(root, campaign, actor) {
  return {
    members: campaignMembers(root, campaign.id).map((a) => publicMember(a, campaign)),
    posts: (campaign.social || [])
      .filter((p) => socialVisible(p, actor))
      .map((p) => {
        const a = root.accounts.find((a) => a.id === p.created_by);
        return {
          ...publicSocialPost(p, actor),
          author: a
            ? { id: a.id, display_name: a.display_name, avatar: '', role: a.role }
            : p.author || { id: p.created_by, display_name: 'Acesso removido', avatar: '' }
        };
      })
  };
}
export async function communityRequest(service, path, method, data, token, doc, actor, root) {
  const members = campaignMembers(root, doc.id);
  if (path.startsWith('/api/members/')) {
    if (method !== 'GET') fail('Perfil público disponível apenas para leitura.', 405);
    const member = members.find((a) => a.id === path.split('/')[3]);
    if (!member) fail('Esse perfil não está disponível nesta campanha.', 404);
    return publicMember(member, doc, true);
  }
  if (method === 'GET') return socialSnapshot(root, doc, actor);
  if (!root.campaigns.some((c) => c.id === doc.id))
    fail('Entre em uma campanha para interagir.', 409);
  return service.write(token, (d, a) => {
    d.social ??= [];
    const id = path.split('/')[3],
      action = path.split('/')[4];
    if (action === 'respond') {
      if (method !== 'POST') fail('Operação de desafio inválida.', 405);
      const post = d.social.find(
        (p) => p.id === id && socialVisible(p, a) && p.kind === 'challenge'
      );
      if (!post) fail('Desafio não encontrado.', 404);
      if (post.to !== a.id) fail('Só quem recebeu o desafio pode responder.', 403);
      if (!gestures.includes(data.choice)) fail('Escolha pedra, papel ou tesoura.');
      if (post.status === 'completed') {
        if (post.choices[a.id] === data.choice) return publicSocialPost(post, a);
        fail('O desafio já foi encerrado.', 409);
      }
      if (Date.parse(post.expires_at) < Date.now())
        fail('Esse desafio expirou. Envie outro convite.', 409);
      post.choices[a.id] = data.choice;
      post.result = rpsWinner(post.choices[post.created_by], data.choice);
      post.status = 'completed';
      post.completed_at = timestamp();
      for (const recipient_id of [post.created_by, post.to])
        notification(d, {
          audience: 'account',
          recipient_id,
          kind: 'challenge',
          title: 'Saiu o resultado do desafio!',
          message:
            post.result === 'draw'
              ? 'Deu empate! O destino pediu revanche.'
              : 'Uma rodada de pedra, papel e tesoura terminou no salão.',
          target: post.id,
          created_by: a.id
        });
      return publicSocialPost(post, a);
    }
    if (method === 'DELETE') {
      const post = d.social.find((p) => p.id === id && socialVisible(p, a));
      if (!post) fail('Interação não encontrada.', 404);
      if (post.created_by === a.id) d.social = d.social.filter((p) => p.id !== id);
      else if (post.to === a.id) post.hidden_by = [...new Set([...(post.hidden_by || []), a.id])];
      else fail('Você não pode apagar esta interação.', 403);
      return { status: 'deleted' };
    }
    if (method !== 'POST' || id) fail('Operação social inválida.', 405);
    const kind = data.kind || 'message',
      to = data.to;
    if (!socialKinds.includes(kind)) fail('Interação inválida.');
    if (!to || to === a.id || !members.some((m) => m.id === to))
      fail('Escolha outro participante da campanha. Os recados públicos ficam nas anotações.');
    if (
      ['poke', 'kudos', 'icebreaker'].includes(kind) &&
      d.social.some(
        (p) =>
          p.kind === kind &&
          p.created_by === a.id &&
          p.to === to &&
          Date.now() - Date.parse(p.created_at) < 60000
      )
    )
      fail('O chamado já chegou. Aguarde um minuto para enviar outro.', 429);
    if (
      kind === 'challenge' &&
      d.social.some(
        (p) =>
          p.kind === 'challenge' &&
          p.status === 'pending' &&
          ((p.created_by === a.id && p.to === to) || (p.to === a.id && p.created_by === to)) &&
          Date.parse(p.expires_at) > Date.now()
      )
    )
      fail('Já existe um desafio pendente entre vocês.', 409);
    const preset =
      kind === 'poke'
        ? ['Um toque do outro lado do véu', 'cutucou você. Vem dar um oi!']
        : kind === 'kudos'
          ? ['Um brinde para você!', 'Seu jeito de jogar faz a mesa melhor. Receba este brinde!']
          : kind === 'challenge'
            ? [
                'Pedra, papel ou tesoura?',
                'Um desafio rápido, só pela resenha. Sem XP, sem apostas.'
              ]
            : null;
    const post = {
      id: newId(),
      kind,
      to,
      title: preset?.[0] || text(data.title || 'Uma mensagem para você', 'Título', 200),
      content: preset?.[1] || text(data.content, 'Mensagem', 5000, true),
      created_by: a.id,
      created_at: timestamp(),
      hidden_by: []
    };
    if (kind === 'reminder') {
      if (
        data.due_at &&
        (!Number.isFinite(Date.parse(data.due_at)) || String(data.due_at).length > 50)
      )
        fail('Data inválida.');
      post.due_at = data.due_at || null;
    }
    if (kind === 'challenge') {
      if (!gestures.includes(data.choice)) fail('Escolha seu gesto para começar.');
      Object.assign(post, {
        game: 'rps',
        status: 'pending',
        choices: { [a.id]: data.choice },
        expires_at: new Date(Date.now() + 48 * 3600000).toISOString()
      });
    }
    d.social.unshift(post);
    notification(d, {
      audience: 'account',
      recipient_id: to,
      kind: kind === 'message' ? 'private-message' : kind,
      title:
        kind === 'poke'
          ? a.display_name + ' cutucou você'
          : kind === 'kudos'
            ? a.display_name + ' fez um brinde a você'
            : kind === 'challenge'
              ? a.display_name + ' desafiou você'
              : a.display_name + ': ' + post.title,
      message: post.content,
      target: post.id,
      created_by: a.id
    });
    return publicSocialPost(post, a);
  });
}
