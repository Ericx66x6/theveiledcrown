import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { documentSeed, blank } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
import { workspaceExport, validateWorkspace } from '../../core/workspace.js';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
);
const image = 'data:image/jpeg;base64,/9j/2Q==';
const rejected = (fn, status) => assert.rejects(fn, (e) => e.status === status);
async function fixture() {
  const store = new CampaignStore(documentSeed(game)),
    service = new PortalService(store);
  const admin = await service.request('/auth/bootstrap', {
    method: 'POST',
    data: { username: 'narrador', display_name: 'Narrador', password: 'senha-teste-123' }
  });
  const call = (path, method = 'GET', data = {}, token = admin.token) =>
    service.request(path, { method, data, token });
  const players = [];
  for (const [id, username, name] of [
    [234567, 'primeiro', 'Marina'],
    [345678, 'segundo', 'Theo']
  ]) {
    const p = blank(game, id);
    Object.assign(p, {
      char: 'Personagem ' + id,
      player: name,
      cla: 'Clã manual',
      xp: 10,
      money: 100
    });
    await call('/api/admin/characters', 'POST', {
      character: p,
      access: { username, password: 'senha-teste-123' }
    });
    players.push(await call('/auth/login', 'POST', { username, password: 'senha-teste-123' }));
  }
  return {
    store,
    service,
    admin,
    one: players[0],
    two: players[1],
    call,
    campaign: store.root.active_campaign_id
  };
}
test('v7: sessão permanece válida sem expiração curta e é revogada no logout', async () => {
  const f = await fixture();
  assert.equal(f.store.root.sessions.find((s) => s.token === f.one.token).expires, null);
  const rebuilt = new PortalService(new CampaignStore(await f.store.workspace()));
  assert.equal(
    (await rebuilt.request('/auth/me', { token: f.one.token })).account.id,
    f.one.account.id
  );
  await f.call('/auth/logout', 'POST', {}, f.one.token);
  await rejected(() => f.call('/auth/me', 'GET', {}, f.one.token), 401);
});
test('v7: dados públicos da campanha e snapshot não incluem credenciais', async () => {
  const f = await fixture();
  await f.call(
    '/api/notes',
    'POST',
    { title: 'Diário', content: 'Pista', visibility: 'campaign' },
    f.one.token
  );
  for (const path of ['/api/campaign', '/api/portal-state']) {
    const response = await f.call(path, 'GET', {}, f.two.token),
      encoded = JSON.stringify(response);
    assert.doesNotMatch(encoded, /"password_hash"|"session_version"|"sessions"|"token"/);
  }
  const edited = await f.call('/api/campaigns/' + f.campaign, 'PATCH', {
    description: 'Uma nova descrição'
  });
  assert.equal(edited.network, undefined);
  assert.equal(edited.notes, undefined);
  assert.equal(edited.characters, undefined);
  const snapshot = await f.call('/api/portal-state', 'GET', {}, f.one.token);
  assert.equal(snapshot.players.length, 1);
  assert.deepEqual(snapshot.accounts, []);
});
test('v7: anotações preservam autoria e criação, exibem perfil e só autor ou GM apaga', async () => {
  const f = await fixture();
  const note = await f.call(
    '/api/notes',
    'POST',
    { title: 'Encontro no cais', content: 'Uma pista', visibility: 'campaign' },
    f.one.token
  );
  let view = (await f.call('/api/notes', 'GET', {}, f.two.token))[0];
  assert.equal(view.author.display_name, f.one.account.display_name);
  assert.equal(view.author.id, f.one.account.id);
  assert.equal(view.created_at, note.created_at);
  await rejected(
    () => f.call('/api/notes/' + note.id, 'DELETE', { revision: note._revision }, f.two.token),
    403
  );
  await f.call('/api/notes/' + note.id, 'PATCH', { revision: note._revision, title: 'Nova pista' });
  view = (await f.call('/api/notes', 'GET', {}, f.one.token))[0];
  assert.equal(view.created_at, note.created_at);
  assert.equal(view.created_by, f.one.account.id);
  await f.call('/api/notes/' + note.id, 'DELETE', { revision: view._revision });
  assert.equal((await f.call('/api/notes')).length, 0);
});
test('v7: nota pessoal não é visível nem editável pelo narrador', async () => {
  const f = await fixture(),
    note = await f.call(
      '/api/notes',
      'POST',
      { title: 'Só eu', content: 'Minha teoria', visibility: 'private' },
      f.one.token
    );
  assert.equal((await f.call('/api/notes')).length, 0);
  await rejected(
    () => f.call('/api/notes/' + note.id, 'DELETE', { revision: note._revision }),
    404
  );
  await f.call('/api/notes/' + note.id, 'DELETE', { revision: note._revision }, f.one.token);
});
test('v8: mensagens sociais têm destinatário e autor verificável', async () => {
  const f = await fixture();
  await f.call(
    '/api/social',
    'POST',
    {
      kind: 'message',
      to: f.two.account.id,
      content: 'A pista está na praia.',
      created_by: f.admin.account.id
    },
    f.one.token
  );
  const social = await f.call('/api/social', 'GET', {}, f.two.token);
  assert.equal(social.posts[0].created_by, f.one.account.id);
  assert.equal(social.posts[0].author.display_name, f.one.account.display_name);
  assert.equal(social.members.length, 3);
  assert.doesNotMatch(JSON.stringify(social), /password_hash|sessions/);
});
test('v7: recado privado fica entre participantes; destinatário pode ocultá-lo só para si', async () => {
  const f = await fixture();
  const post = await f.call(
    '/api/social',
    'POST',
    { kind: 'message', to: f.two.account.id, content: 'Teoria privada' },
    f.one.token
  );
  assert.equal((await f.call('/api/social')).posts.length, 0);
  assert.equal((await f.call('/api/social', 'GET', {}, f.two.token)).posts.length, 1);
  await rejected(() => f.call('/api/social/' + post.id, 'DELETE'), 404);
  await f.call('/api/social/' + post.id, 'DELETE', {}, f.two.token);
  assert.equal((await f.call('/api/social', 'GET', {}, f.two.token)).posts.length, 0);
  assert.equal((await f.call('/api/social', 'GET', {}, f.one.token)).posts.length, 1);
  await f.call('/api/social/' + post.id, 'DELETE', {}, f.one.token);
  assert.equal((await f.call('/api/social', 'GET', {}, f.one.token)).posts.length, 0);
});
test('v7: cutucada gera notificação, respeita destinatário e possui intervalo', async () => {
  const f = await fixture();
  await f.call('/api/social', 'POST', { kind: 'poke', to: f.two.account.id }, f.one.token);
  const notices = await f.call('/api/notifications', 'GET', {}, f.two.token);
  assert.equal(notices[0].kind, 'poke');
  assert.match(notices[0].title, /cutucou/);
  await rejected(
    () => f.call('/api/social', 'POST', { kind: 'poke', to: f.two.account.id }, f.one.token),
    429
  );
  await rejected(
    () => f.call('/api/social', 'POST', { kind: 'poke', to: f.one.account.id }, f.one.token),
    400
  );
});
test('v7: perfis e interações não atravessam campanhas', async () => {
  const f = await fixture();
  const second = await f.call('/api/campaigns', 'POST', { title: 'Outra mesa' });
  await f.call('/api/campaigns/' + second.id + '/select', 'POST');
  await rejected(() => f.call('/api/members/' + f.one.account.id), 404);
  await rejected(
    () => f.call('/api/social', 'POST', { content: 'Fora da mesa', to: f.one.account.id }),
    400
  );
  await rejected(() => f.call('/api/social', 'GET', {}, f.one.token), 403);
  assert.equal((await f.call('/api/social')).posts.length, 0);
});
test('v7: apagar notificações não altera a caixa dos demais narradores', async () => {
  const f = await fixture();
  await f.call('/api/admin/accounts', 'POST', {
    username: 'co-narrador',
    display_name: 'Segundo narrador',
    password: 'senha-teste-123',
    role: 'admin'
  });
  const other = await f.call('/auth/login', 'POST', {
    username: 'co-narrador',
    password: 'senha-teste-123'
  });
  const p = blank(game, 456789);
  Object.assign(p, { char: 'Proposta', player: 'Marina', cla: 'Livre' });
  await f.call('/api/submissions', 'POST', { character: p }, f.one.token);
  const notice = (await f.call('/api/notifications'))[0];
  await rejected(() => f.call('/api/notifications/' + notice.id, 'DELETE', {}, f.two.token), 404);
  await f.call('/api/notifications/' + notice.id, 'DELETE');
  assert.equal((await f.call('/api/notifications')).length, 0);
  assert.equal((await f.call('/api/notifications', 'GET', {}, other.token)).length, 1);
});
test('v7: entrega usa recompensa final e mantém a previsão original', async () => {
  const f = await fixture(),
    q = await f.call('/api/quests', 'POST', {
      title: 'Uma conquista',
      assignees: [234567],
      xp_reward: 7,
      money_reward: 2000
    });
  const done = await f.call('/api/quests/' + q.id + '/complete', 'POST', {
    revision: q._revision,
    xp_reward: 11,
    money_reward: 5000,
    items: [{ name: 'Selo', quantity: 2 }],
    completion_note: 'Vitória inesperada.'
  });
  assert.equal(done.xp_reward, 7);
  assert.equal(done.money_reward, 2000);
  assert.equal(done.delivered_rewards.xp_reward, 11);
  const p = await f.call('/api/characters/234567');
  assert.equal(p.xp, 21);
  assert.equal(p.money, 5100);
  assert.equal(p.items[0].quantity, 2);
  await rejected(
    () =>
      f.call('/api/quests/' + q.id + '/complete', 'POST', {
        revision: done._revision,
        xp_reward: 100
      }),
    409
  );
  assert.equal((await f.call('/api/characters/234567')).xp, 21);
});
test('v7: apagar missão não remove recompensas já entregues e só narrador pode fazê-lo', async () => {
  const f = await fixture(),
    q = await f.call('/api/quests', 'POST', {
      title: 'Encerramento',
      assignees: [234567],
      xp_reward: 3
    });
  const done = await f.call('/api/quests/' + q.id + '/complete', 'POST', { revision: q._revision });
  await rejected(
    () => f.call('/api/quests/' + q.id, 'DELETE', { revision: done._revision }, f.one.token),
    403
  );
  await f.call('/api/quests/' + q.id, 'DELETE', { revision: done._revision });
  assert.equal((await f.call('/api/quests')).length, 0);
  assert.equal((await f.call('/api/characters/234567')).xp, 13);
});
test('v7: mapa geográfico funciona sem imagem, com detalhes, fotos e NPCs', async () => {
  const f = await fixture(),
    m = await f.call('/api/maps', 'POST', {
      title: 'Ruas da cidade',
      mode: 'geographic',
      center: { lat: -23.55, lng: -46.63, zoom: 12 },
      player_access: true
    });
  const p = await f.call(
    '/api/maps/' + m.id + '/pins',
    'POST',
    {
      title: 'Refúgio',
      x: 0.5,
      y: 0.5,
      lat: -23.55,
      lng: -46.63,
      images: [image],
      npcs: [
        { id: 'npc-1', name: 'Isadora', role: 'Guardiã', description: 'Sabe o caminho.', image }
      ],
      address: 'Praça da cidade',
      visibility: 'campaign'
    },
    f.one.token
  );
  const view = await f.call('/api/maps/' + m.id, 'GET', {}, f.two.token);
  assert.equal(view.mode, 'geographic');
  assert.equal(view.image, '');
  assert.equal(view.pins[0].npcs[0].name, 'Isadora');
  const root = validateWorkspace(assembleDocuments(workspaceDocuments(await f.store.workspace())));
  assert.equal(root.campaigns[0].maps[0].pins[0].images[0], image);
  await rejected(
    () =>
      f.call(
        '/api/maps/' + m.id + '/pins/' + p.id,
        'PATCH',
        { title: 'Outro', revision: p._revision },
        f.two.token
      ),
    403
  );
  await rejected(
    () =>
      f.call('/api/maps/' + m.id, 'PATCH', {
        mode: 'image',
        revision: m._revision + 1,
        image,
        width: 10,
        height: 10
      }),
    400
  );
});
test('v7: mapas rejeitam coordenadas, galeria e NPCs inválidos', async () => {
  const f = await fixture(),
    m = await f.call('/api/maps', 'POST', {
      title: 'Mundo',
      mode: 'geographic',
      player_access: true
    });
  for (const extra of [
    { lat: 100, lng: 0 },
    { lat: 0, lng: 0, images: Array(7).fill(image) },
    {
      lat: 0,
      lng: 0,
      npcs: [
        { id: 'x', name: 'A' },
        { id: 'x', name: 'B' }
      ]
    }
  ])
    await rejected(
      () =>
        f.call('/api/maps/' + m.id + '/pins', 'POST', {
          title: 'Inválido',
          x: 0.5,
          y: 0.5,
          ...extra
        }),
      400
    );
  assert.equal((await f.call('/api/maps/' + m.id)).pins.length, 0);
});
test('v7: apagar a última campanha deixa um portal utilizável e não apaga contas', async () => {
  const f = await fixture(),
    c = (await f.call('/api/campaigns'))[0];
  await f.call('/api/campaigns/' + c.id, 'DELETE', { confirmation: c.title });
  assert.equal(f.store.root.accounts.length, 3);
  assert.equal((await f.call('/api/portal-state')).campaigns.length, 0);
  assert.equal((await f.call('/api/portal-state', 'GET', {}, f.one.token)).campaigns.length, 0);
  assert.equal(
    validateWorkspace(assembleDocuments(workspaceDocuments(await f.store.workspace()))).campaigns
      .length,
    0
  );
  await f.call('/api/campaigns', 'POST', { title: 'Uma nova história' });
  assert.equal((await f.call('/api/campaigns')).length, 1);
});
test('v7: reset exige narrador e confirmação e devolve a instalação inicial', async () => {
  const f = await fixture();
  await rejected(
    () => f.call('/api/admin/reset', 'POST', { confirmation: 'ZERAR PORTAL' }, f.one.token),
    403
  );
  await rejected(() => f.call('/api/admin/reset', 'POST', { confirmation: 'sim' }), 400);
  await f.call('/api/admin/reset', 'POST', { confirmation: 'ZERAR PORTAL' });
  assert.equal(f.store.root.accounts.length, 0);
  assert.equal(f.store.root.sessions.length, 0);
  assert.equal(f.store.root.campaigns[0].characters.length, 0);
  await rejected(() => f.call('/auth/me'), 401);
  const newAdmin = await f.call('/auth/bootstrap', 'POST', {
    username: 'novo-narrador',
    password: 'senha-teste-123'
  });
  assert.equal(newAdmin.account.role, 'admin');
});
test('v7: apagar log financeiro não muda saldo e respeita revisão e permissão', async () => {
  const f = await fixture(),
    before = await f.call('/api/characters/234567');
  await f.call('/api/characters/234567/money', 'POST', {
    revision: before._revision,
    delta: '+250',
    reason: 'Teste'
  });
  const p = await f.call('/api/characters/234567');
  await rejected(
    () =>
      f.call(
        '/api/characters/234567/logs/transactions',
        'DELETE',
        { revision: p._revision, index: 0 },
        f.one.token
      ),
    403
  );
  const updated = await f.call('/api/characters/234567/logs/transactions', 'DELETE', {
    revision: p._revision,
    index: 0
  });
  assert.equal(updated.money, 350);
  assert.equal(updated.transactions.length, 0);
  await rejected(
    () =>
      f.call('/api/characters/234567/logs/history', 'DELETE', {
        revision: p._revision,
        confirmation: 'LIMPAR'
      }),
    409
  );
  const clean = await f.call('/api/characters/234567/logs/history', 'DELETE', {
    revision: updated._revision,
    confirmation: 'LIMPAR'
  });
  assert.deepEqual(clean.history, []);
  assert.equal(clean.money, 350);
});
test('v7: proposta pode ser apagada pelo autor sem remover ficha aprovada', async () => {
  const f = await fixture(),
    p = blank(game, 456789);
  Object.assign(p, { char: 'Nova pessoa', player: 'Marina', cla: 'Livre' });
  const proposal = await f.call('/api/submissions', 'POST', { character: p }, f.one.token);
  await rejected(
    () =>
      f.call(
        '/api/submissions/' + proposal.id,
        'DELETE',
        { revision: proposal._revision },
        f.two.token
      ),
    404
  );
  const approved = await f.call('/api/submissions/' + proposal.id + '/approve', 'POST', {
    revision: proposal._revision
  });
  await f.call(
    '/api/submissions/' + proposal.id,
    'DELETE',
    { revision: approved._revision },
    f.one.token
  );
  assert.equal((await f.call('/api/submissions')).length, 0);
  assert.equal((await f.call('/api/characters')).length, 3);
});
test('v7: lixeira pode ser esvaziada sem afetar registros ativos', async () => {
  const f = await fixture(),
    p = await f.call('/api/characters/234567');
  await f.call('/api/characters/234567', 'DELETE', { revision: p._revision, confirmation: p.char });
  const trash = await f.call('/api/admin/trash');
  assert.equal(trash.characters.length, 1);
  await rejected(
    () =>
      f.call('/api/admin/trash/purge', 'DELETE', { confirmation: 'ESVAZIAR LIXEIRA' }, f.two.token),
    403
  );
  await f.call('/api/admin/trash/purge', 'DELETE', {
    confirmation: 'APAGAR',
    type: 'characters',
    id: trash.characters[0].id
  });
  assert.equal((await f.call('/api/admin/trash')).characters.length, 0);
  assert.equal((await f.call('/api/characters')).length, 1);
  assert.equal(validateWorkspace(workspaceExport(await f.store.workspace())).campaigns.length, 1);
});
