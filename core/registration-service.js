import { clone, fail, text, credentials, publicAccount, timestamp } from './model.js';
import { imageData } from './image-data.js';
import { hashPassword } from './passwords.js';
import { accountRecord } from './service.js';
import { notification } from './notifications.js';
export async function registrationRequest(service, path, method, data, token) {
  if (path === '/auth/register' && method === 'POST') {
    const username = credentials(data.username, data.password);
    if (data.password.length < 10) fail('Use uma senha com pelo menos 10 caracteres.');
    const display_name = text(data.display_name, 'Seu nome', 100, true),
      avatar = imageData(data.avatar || '');
    const passwordHash = await hashPassword(data.password);
    let response;
    await service.store.atomic((root) => {
      if (!root.accounts.some((a) => a.role === 'admin' && a.active))
        fail('O narrador precisa concluir a instalação antes dos cadastros.', 409);
      if (root.accounts.some((a) => a.username === username))
        fail('Este login já está em uso. Escolha outro.', 409);
      if (root.accounts.filter((a) => a.registration?.status === 'pending').length >= 100)
        fail('A fila de cadastros está cheia. Aguarde o narrador.', 429);
      const a = accountRecord(
        { username, password: data.password, display_name, role: 'player' },
        passwordHash
      );
      delete a.character_ids;
      delete a._campaign_member;
      a.active = false;
      a.avatar = avatar;
      a.memberships = {};
      a.registration = { status: 'pending', requested_at: timestamp(), _revision: 1 };
      root.accounts.push(a);
      const c = root.campaigns.find((c) => c.id === root.active_campaign_id) || root.campaigns[0];
      if (c)
        notification(c, {
          title: 'Novo cadastro para avaliar',
          message: display_name + ' pediu acesso ao portal.',
          kind: 'registration',
          target: a.id
        });
      response = {
        status: 'pending',
        message: 'Cadastro enviado. Você poderá entrar depois da aprovação do narrador.'
      };
      return root;
    });
    return response;
  }
  const doc = await service.store.get(),
    actor = service.auth(doc, token);
  if (actor.role !== 'admin') fail('Somente o narrador avalia os cadastros.', 403);
  if (path === '/api/admin/registrations' && method === 'GET') {
    const root = await service.store.workspace();
    return root.accounts
      .filter((a) => a.registration)
      .map((a) => ({ ...publicAccount(a), registration: clone(a.registration) }));
  }
  const match = path.match(/^\/api\/admin\/registrations\/([^/]+)\/(approve|reject)$/);
  if (!match || method !== 'POST') fail('Operação de cadastro inválida.', 405);
  let result;
  await service.store.atomic((root) => {
    const a = root.accounts.find((a) => a.id === match[1]);
    if (!a?.registration) fail('Cadastro não encontrado.', 404);
    if (a.registration.status !== 'pending') fail('Este cadastro já foi avaliado.', 409);
    if (data.revision !== a.registration._revision)
      fail('O cadastro mudou. Atualize a avaliação.', 409);
    if (match[2] === 'approve') {
      if (
        !Array.isArray(data.campaign_ids) ||
        !data.campaign_ids.length ||
        new Set(data.campaign_ids).size !== data.campaign_ids.length ||
        data.campaign_ids.some(
          (id) => !root.campaigns.some((c) => c.id === id && c.status === 'active')
        )
      )
        fail('Escolha pelo menos uma campanha aberta.');
      a.memberships = Object.fromEntries(data.campaign_ids.map((id) => [id, []]));
      a.active = true;
      a.role = 'player';
      a.registration.status = 'approved';
    } else {
      a.active = false;
      a.registration.status = 'rejected';
    }
    a.registration.reviewed_at = timestamp();
    a.registration.reviewed_by = actor.id;
    a.registration.note = text(data.note || '', 'Parecer', 2000);
    a.registration._revision++;
    result = { ...publicAccount(a), registration: clone(a.registration) };
    return root;
  });
  return result;
}
