import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { documentSeed, blank, clone } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
import { validateWorkspace, workspaceExport } from '../../core/workspace.js';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { zipDocuments, parseWorkspaceFile } from '../../client/files.js';
const game = gameSettings(
    JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
  ),
  image = 'data:image/jpeg;base64,/9j/2Q==';
async function fixture() {
  // This suite keeps covering the narrator-managed legacy proposal workflow.
  const legacy = clone(game);
  legacy.character_creation.guided.enabled = false;
  const store = new CampaignStore(documentSeed(legacy)),
    service = new PortalService(store),
    admin = await service.request('/auth/bootstrap', {
      method: 'POST',
      data: { username: 'narrador', display_name: 'Narrador', password: 'senha-de-teste' }
    }),
    request = (path, method = 'GET', data = {}, token = admin.token) =>
      service.request(path, { method, data, token });
  const account = await request('/api/admin/accounts', 'POST', {
      username: 'jogador',
      display_name: 'Jogador',
      password: 'senha-jogador',
      role: 'player',
      character_ids: [],
      campaign_access: true
    }),
    player = await service.request('/auth/login', {
      method: 'POST',
      data: { username: 'jogador', password: 'senha-jogador' }
    });
  return { store, service, admin, player, account, request };
}
function character(id = 234567) {
  const p = blank(game, id);
  Object.assign(p, { char: 'Helena', player: 'Jogador', cla: 'Clã livre', xp: 0, money: 0 });
  p.atributes[0].value = 3;
  p.atributes[1].value = 2;
  return p;
}
const rejected = (fn, status) => assert.rejects(fn, (e) => e.status === status);
async function proposal(f, id = 234567) {
  return f.request('/api/submissions', 'POST', { character: character(id) }, f.player.token);
}
async function approve(f, s) {
  return f.request('/api/submissions/' + s.id + '/approve', 'POST', { revision: s._revision });
}
async function active(f, id = 234567) {
  return approve(f, await proposal(f, id));
}
async function map(f, data = {}) {
  return f.request('/api/maps', 'POST', {
    title: 'Cidade',
    image,
    width: 2000,
    height: 1000,
    ...data
  });
}

test('narrador possui acesso administrativo sem vínculo de personagem', async () => {
  const f = await fixture();
  await active(f);
  assert.deepEqual((await f.request('/auth/me')).account.character_ids, []);
  const root = await f.store.workspace();
  assert.deepEqual(
    root.accounts.find((a) => a.role === 'admin').memberships[root.active_campaign_id],
    []
  );
});
test('jogador sem ficha aprovada pode entrar e enviar uma proposta', async () => {
  const f = await fixture();
  assert.deepEqual(await f.request('/api/characters', 'GET', {}, f.player.token), []);
  const id = (await f.request('/api/characters/new-id', 'GET', {}, f.player.token)).id,
    p = character(id);
  p.player = 'Nome falsificado';
  p.xp = 999;
  p.money = 9000;
  const s = await f.request('/api/submissions', 'POST', { character: p }, f.player.token);
  assert.equal(s.status, 'pending');
  assert.equal(s.character.player, 'Jogador');
  assert.equal(s.character.xp, 0);
  assert.equal(s.character.money, 0);
  assert.equal((await f.request('/api/characters')).length, 0);
  assert.equal((await f.request('/api/notifications'))[0].target, s.id);
});
test('propostas de terceiros não aparecem para outro jogador', async () => {
  const f = await fixture(),
    s = await proposal(f);
  await f.request('/api/admin/accounts', 'POST', {
    username: 'segundo',
    display_name: 'Segundo',
    password: 'outra-senha',
    role: 'player',
    character_ids: []
  });
  const second = await f.service.request('/auth/login', {
    method: 'POST',
    data: { username: 'segundo', password: 'outra-senha' }
  });
  assert.deepEqual(await f.request('/api/submissions', 'GET', {}, second.token), []);
  await rejected(() => f.request('/api/submissions/' + s.id, 'GET', {}, second.token), 404);
  await rejected(
    () =>
      f.request(
        '/api/submissions/' + s.id,
        'PATCH',
        { revision: 1, character: character() },
        second.token
      ),
    403
  );
});
test('somente narrador aprova e a aprovação não duplica a ficha', async () => {
  const f = await fixture(),
    s = await proposal(f);
  await rejected(
    () =>
      f.request('/api/submissions/' + s.id + '/approve', 'POST', { revision: 1 }, f.player.token),
    403
  );
  const result = await approve(f, s);
  assert.equal(result.status, 'approved');
  assert.deepEqual((await f.request('/auth/me', 'GET', {}, f.player.token)).account.character_ids, [
    234567
  ]);
  await rejected(
    () =>
      f.request('/api/submissions/' + s.id + '/approve', 'POST', { revision: result._revision }),
    409
  );
  assert.equal((await f.request('/api/characters')).length, 1);
});
test('uma conta pode ter vários personagens aprovados', async () => {
  const f = await fixture();
  await active(f);
  await active(f, 345678);
  assert.equal((await f.request('/api/characters', 'GET', {}, f.player.token)).length, 2);
});
test('narrador ajusta a proposta antes de aprovar', async () => {
  const f = await fixture(),
    s = await proposal(f),
    p = clone(s.character);
  p.char = 'Helena revisada';
  p.atributes[0].value = 2;
  p.xp = 15;
  const next = await f.request('/api/submissions/' + s.id, 'PATCH', { revision: 1, character: p });
  assert.equal(next.review_revision, 1);
  await approve(f, next);
  const result = await f.request('/api/characters/234567');
  assert.equal(result.char, 'Helena revisada');
  assert.equal(result.xp, 15);
  assert.equal(result.atributes[0].value, 2);
});
test('pedir ajustes notifica o jogador e permite reenviar', async () => {
  const f = await fixture(),
    s = await proposal(f);
  const returned = await f.request('/api/submissions/' + s.id + '/review', 'POST', {
    revision: 1,
    status: 'changes_requested',
    note: 'Reduza um ponto em Força.'
  });
  const notes = await f.request('/api/notifications', 'GET', {}, f.player.token);
  assert.equal(notes[0].message, 'Reduza um ponto em Força.');
  const p = clone(returned.character);
  p.atributes[0].value = 2;
  const resent = await f.request(
    '/api/submissions/' + s.id,
    'PATCH',
    { revision: returned._revision, character: p },
    f.player.token
  );
  assert.equal(resent.status, 'pending');
  assert.equal(resent.submission_revision, 2);
});
test('orçamentos de criação exigem ajuste ou exceção justificada', async () => {
  const f = await fixture(),
    g = await f.request('/api/game');
  g.character_creation.budgets.atributes = 10;
  await f.request('/api/game', 'PUT', g);
  const s = await proposal(f);
  assert.equal(s.report.issues.length, 1);
  await rejected(() => approve(f, s), 400);
  const result = await f.request('/api/submissions/' + s.id + '/approve', 'POST', {
    revision: 1,
    override: true,
    reason: 'Exceção acordada na sessão zero.'
  });
  assert.equal(result.status, 'approved');
});
test('criação desativada e limite por jogador são respeitados', async () => {
  const f = await fixture(),
    g = await f.request('/api/game');
  g.character_creation.max_characters_per_player = 1;
  await f.request('/api/game', 'PUT', g);
  await active(f);
  await rejected(() => proposal(f, 345678), 400);
  const next = await f.request('/api/game');
  next.character_creation.enabled = false;
  await f.request('/api/game', 'PUT', next);
  await rejected(() => f.request('/api/characters/new-id', 'GET', {}, f.player.token), 403);
});
test('notificações têm recibo individual e não revelam mensagens alheias', async () => {
  const f = await fixture();
  await proposal(f);
  const gm = (await f.request('/api/notifications'))[0];
  assert.equal((await f.request('/api/notifications', 'GET', {}, f.player.token)).length, 0);
  await rejected(
    () => f.request('/api/notifications/' + gm.id + '/read', 'POST', {}, f.player.token),
    404
  );
  await f.request('/api/notifications/' + gm.id + '/read', 'POST');
  assert.ok((await f.request('/api/notifications'))[0].read_by.includes(f.admin.account.id));
});
test('solicitação JSON atravessa aparelhos e chega à caixa do narrador', async () => {
  const f = await fixture(),
    original = workspaceExport(await f.store.workspace()),
    otherStore = new CampaignStore(validateWorkspace(original)),
    other = new PortalService(otherStore),
    auth = await other.request('/auth/login', {
      method: 'POST',
      data: { username: 'jogador', password: 'senha-jogador' }
    });
  const s = await other.request('/api/submissions', {
      method: 'POST',
      token: auth.token,
      data: { character: character() }
    }),
    packet = await other.request('/api/exchange/submission', {
      token: auth.token,
      data: { id: s.id }
    });
  const received = await f.request('/api/exchange/import', 'POST', {
    document: JSON.parse(JSON.stringify(packet))
  });
  assert.equal(received.character.char, 'Helena');
  assert.equal((await f.request('/api/notifications')).length, 1);
  const duplicate = await f.request('/api/exchange/import', 'POST', { document: packet });
  assert.equal(duplicate.status, 'already_received');
  assert.equal((await f.request('/api/submissions')).length, 1);
});
test('solicitação antiga não sobrescreve ajuste feito pelo narrador', async () => {
  const f = await fixture(),
    s = await proposal(f),
    packet = await f.request('/api/exchange/submission', 'GET', { id: s.id }, f.player.token);
  await f.request('/api/submissions/' + s.id, 'PATCH', {
    revision: 1,
    character: s.character,
    note: 'Avaliada'
  });
  packet.submission.submission_revision++;
  await rejected(() => f.request('/api/exchange/import', 'POST', { document: packet }), 409);
});
test('transferência remove o controle anterior e mantém vários personagens no destino', async () => {
  const f = await fixture();
  await active(f);
  await active(f, 345678);
  const second = await f.request('/api/admin/accounts', 'POST', {
    username: 'segundo',
    display_name: 'Segundo',
    password: 'outra-senha',
    role: 'player',
    character_ids: []
  });
  for (const id of [234567, 345678]) {
    const p = await f.request('/api/characters/' + id);
    await f.request('/api/characters/' + id + '/assign', 'POST', {
      revision: p._revision,
      account_id: second.id
    });
  }
  await rejected(() => f.request('/api/characters/234567', 'GET', {}, f.player.token), 403);
  const accounts = await f.request('/api/admin/accounts');
  assert.deepEqual(accounts.find((a) => a.id === second.id).character_ids, [234567, 345678]);
  assert.equal((await f.request('/api/characters/234567')).player, 'Segundo');
});
test('gestão de acessos pode revogar só a campanha', async () => {
  const f = await fixture();
  await active(f);
  await f.request('/api/admin/accounts/' + f.account.id, 'PATCH', { campaign_access: false });
  await rejected(() => f.request('/auth/me', 'GET', {}, f.player.token), 401);
  const revoked = await f.service.request('/auth/login', {
    method: 'POST',
    data: { username: 'jogador', password: 'senha-jogador' }
  });
  assert.equal((await f.request('/api/campaigns', 'GET', {}, revoked.token)).length, 0);
  await rejected(() => f.request('/api/characters', 'GET', {}, revoked.token), 403);
  await f.request('/api/admin/accounts/' + f.account.id, 'PATCH', { campaign_access: true });
  const auth = await f.service.request('/auth/login', {
    method: 'POST',
    data: { username: 'jogador', password: 'senha-jogador' }
  });
  assert.equal((await f.request('/api/campaigns', 'GET', {}, auth.token)).length, 1);
});
test('excluir ficha exige confirmação, desvincula acessos e é restaurável', async () => {
  const f = await fixture();
  await active(f);
  const p = await f.request('/api/characters/234567');
  await rejected(
    () =>
      f.request('/api/characters/234567', 'DELETE', {
        revision: p._revision,
        confirmation: 'incorreto'
      }),
    400
  );
  await f.request('/api/characters/234567', 'DELETE', {
    revision: p._revision,
    confirmation: p.char
  });
  assert.equal((await f.request('/api/characters')).length, 0);
  assert.equal(
    (await f.request('/auth/me', 'GET', {}, f.player.token)).account.character_ids.length,
    0
  );
  const trash = await f.request('/api/admin/trash');
  await f.request('/api/admin/trash/characters/' + trash.characters[0].id + '/restore', 'POST');
  assert.equal((await f.request('/api/characters', 'GET', {}, f.player.token)).length, 1);
});
test('remoção de ficha conserva coerência de missões e do backup', async () => {
  const f = await fixture();
  await active(f);
  await f.request('/api/quests', 'POST', {
    title: 'Missão',
    assignees: [234567],
    xp_reward: 1,
    money_reward: 0,
    items: []
  });
  const p = await f.request('/api/characters/234567');
  await f.request('/api/characters/234567', 'DELETE', {
    revision: p._revision,
    confirmation: p.char
  });
  assert.equal((await f.request('/api/quests'))[0].status, 'cancelled');
  assert.doesNotThrow(() => validateWorkspace(workspaceExport(f.store.root)));
});
test('excluir jogador revoga sessões e preserva suas fichas', async () => {
  const f = await fixture();
  await active(f);
  await f.request('/api/admin/accounts/' + f.account.id, 'DELETE', {
    confirmation: f.account.username
  });
  await rejected(() => f.request('/auth/me', 'GET', {}, f.player.token), 401);
  assert.equal((await f.request('/api/characters')).length, 1);
  assert.equal((await f.request('/api/characters/234567')).owner_id, '');
  const trash = await f.request('/api/admin/trash');
  await f.request('/api/admin/trash/accounts/' + trash.accounts[0].id + '/restore', 'POST');
  const auth = await f.service.request('/auth/login', {
    method: 'POST',
    data: { username: 'jogador', password: 'senha-jogador' }
  });
  assert.equal((await f.request('/api/characters', 'GET', {}, auth.token)).length, 1);
});
test('jogador não remove contas, fichas nem registros da lixeira', async () => {
  const f = await fixture();
  await active(f);
  const p = await f.request('/api/characters/234567');
  await rejected(
    () =>
      f.request(
        '/api/characters/234567',
        'DELETE',
        { revision: p._revision, confirmation: p.char },
        f.player.token
      ),
    403
  );
  await rejected(
    () =>
      f.request(
        '/api/admin/accounts/' + f.account.id,
        'DELETE',
        { confirmation: f.account.username },
        f.player.token
      ),
    403
  );
  await rejected(() => f.request('/api/admin/trash', 'GET', {}, f.player.token), 403);
});
test('vários mapas têm permissões e marcadores independentes', async () => {
  const f = await fixture(),
    city = await map(f, { player_access: true }),
    secret = await map(f, { title: 'Subsolo secreto' });
  assert.equal((await f.request('/api/maps')).length, 2);
  assert.deepEqual(
    (await f.request('/api/maps', 'GET', {}, f.player.token)).map((m) => m.id),
    [city.id]
  );
  await rejected(() => f.request('/api/maps/' + secret.id, 'GET', {}, f.player.token), 403);
  await f.request(
    '/api/maps/' + city.id + '/pins',
    'POST',
    { title: 'Ponto', x: 0.5, y: 0.5 },
    f.player.token
  );
  assert.equal((await f.request('/api/maps/' + secret.id)).pins.length, 0);
  const updated = await f.request('/api/maps/' + secret.id, 'PATCH', {
    revision: secret._revision,
    player_access: true
  });
  assert.equal((await f.request('/api/maps', 'GET', {}, f.player.token)).length, 2);
  await f.request('/api/maps/' + secret.id, 'PATCH', {
    revision: updated._revision,
    player_access: false
  });
  assert.equal((await f.request('/api/campaign', 'GET', {}, f.player.token)).maps.length, 1);
});
test('jogador não cria mapa nem libera o próprio acesso', async () => {
  const f = await fixture(),
    m = await map(f);
  await rejected(
    () =>
      f.request(
        '/api/maps',
        'POST',
        { title: 'Inválido', image, width: 1, height: 1 },
        f.player.token
      ),
    403
  );
  await rejected(
    () =>
      f.request(
        '/api/maps/' + m.id,
        'PATCH',
        { revision: m._revision, player_access: true },
        f.player.token
      ),
    403
  );
});
test('mapa removido pode voltar com seus marcadores', async () => {
  const f = await fixture(),
    m = await map(f);
  await f.request('/api/maps/' + m.id + '/pins', 'POST', { title: 'Arquivo', x: 0.2, y: 0.3 });
  const updated = await f.request('/api/maps/' + m.id);
  await f.request('/api/maps/' + m.id, 'DELETE', {
    revision: updated._revision,
    confirmation: m.title
  });
  assert.equal((await f.request('/api/maps')).length, 0);
  const trash = await f.request('/api/admin/trash');
  await f.request('/api/admin/trash/maps/' + trash.maps[0].id + '/restore', 'POST');
  assert.equal((await f.request('/api/maps/' + m.id)).pins[0].title, 'Arquivo');
});
test('capítulos livres e novos poderes persistem no game-data', async () => {
  const f = await fixture(),
    g = await f.request('/api/game');
  g.rulebook.push({
    id: 'lore',
    title: 'A cidade',
    description: 'Conhecimento',
    entries: [{ id: 'pacto', title: 'O pacto', body: 'Uma informação criada pelo narrador.' }]
  });
  const id = Math.max(...g.disciplines.map((d) => d.id)) + 1;
  g.disciplines.push({
    id,
    name: 'Poder criado',
    description: 'Novo legado',
    short_description: 'Livre',
    nivels: [
      {
        nivel: 1,
        subname: 'Primeiro dom',
        description: 'Efeito',
        mechanics: { rouse_check: true, test: 'Força + Briga' }
      }
    ]
  });
  await f.request('/api/game', 'PUT', { ...g, _expected_revision: g._revision });
  const after = await f.request('/api/game');
  assert.equal(after.rulebook[0].entries[0].title, 'O pacto');
  assert.equal(after.disciplines.at(-1).name, 'Poder criado');
});
test('livro recusa edição desatualizada e remoção silenciosa de traço usado', async () => {
  const f = await fixture();
  await active(f);
  const g = await f.request('/api/game');
  await f.request('/api/game', 'PUT', { ...g, _expected_revision: g._revision });
  await rejected(
    () => f.request('/api/game', 'PUT', { ...g, _expected_revision: g._revision }),
    409
  );
  const current = await f.request('/api/game'),
    entry = current.atributes[0];
  await rejected(
    () =>
      f.request('/api/rulebook/catalog/atributes/' + entry.id, 'DELETE', {
        revision: current._revision,
        confirmation: entry.name
      }),
    400
  );
  await f.request('/api/rulebook/catalog/atributes/' + entry.id, 'DELETE', {
    revision: current._revision,
    confirmation: entry.name,
    remove_references: true
  });
  assert.equal(
    (await f.request('/api/characters/234567')).atributes.some((e) => e.id === entry.id),
    false
  );
});
test('mapa da edição anterior migra sem perder imagem ou marcadores', async () => {
  const f = await fixture(),
    root = workspaceExport(await f.store.workspace());
  root.schema_version = 3;
  const c = root.campaigns[0];
  delete c.maps;
  c.map = {
    image,
    width: 3000,
    height: 2000,
    pins: [{ id: 'old-pin', title: 'Lugar', x: 0.2, y: 0.3, visibility: 'campaign' }]
  };
  c.universe = { date: 'Noite 2', time: '22:00', session: 9 };
  const next = validateWorkspace(root);
  assert.equal(next.campaigns[0].maps.length, 1);
  assert.equal(next.campaigns[0].maps[0].pins[0].title, 'Lugar');
  assert.equal('universe' in next.campaigns[0], false);
});
test('exportação separa fichas, mapas e coleções e reconstitui a campanha', async () => {
  const f = await fixture();
  await active(f);
  await map(f, { player_access: true });
  const root = workspaceExport(await f.store.workspace()),
    docs = workspaceDocuments(root),
    cid = root.campaigns[0].id;
  assert.equal(docs['portal.json'].format, 'coroa-document-set-v4');
  assert.equal(docs[`campaigns/${cid}/campaign.json`].characters, undefined);
  assert.ok(Object.keys(docs).some((k) => k.includes('/maps/')));
  const restored = validateWorkspace(assembleDocuments(docs));
  assert.equal(restored.campaigns[0].characters[0].char, 'Helena');
  assert.equal(restored.campaigns[0].maps[0].image, image);
});
test('upload do ZIP de dados funciona e conjunto incompleto é recusado', async () => {
  const f = await fixture();
  await active(f);
  const root = workspaceExport(await f.store.workspace()),
    bytes = zipDocuments(root),
    file = {
      name: 'coroa-jsons.zip',
      size: bytes.length,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
  assert.equal((await parseWorkspaceFile(file)).campaigns[0].characters[0].char, 'Helena');
  const docs = workspaceDocuments(root);
  delete docs['accounts.json'];
  assert.throws(() => assembleDocuments(docs));
});
test('pacote de jogador não leva mapas secretos, lixeira nem propostas alheias', async () => {
  const f = await fixture();
  await active(f);
  await map(f, { title: 'segredo' });
  const visibleMap = await map(f, { title: 'público', player_access: true });
  const pack = await f.request('/api/json/player', 'GET', {}, f.player.token);
  assert.deepEqual(
    pack.campaigns[0].maps.map((m) => m.id),
    [visibleMap.id]
  );
  assert.equal(pack.campaigns[0].deleted_maps.length, 0);
  assert.equal(pack.deleted_accounts, undefined);
  assert.doesNotThrow(() => validateWorkspace(pack));
});

test('pacote de acesso sem ficha permite criar o primeiro personagem em outro aparelho', async () => {
  const f = await fixture(),
    pack = await f.request('/api/json/player', 'GET', { account_id: f.account.id }),
    root = validateWorkspace(pack);
  assert.equal(root.campaigns[0].characters.length, 0);
  assert.equal(root.accounts[0].role, 'player');
  const other = new PortalService(new CampaignStore(root)),
    auth = await other.request('/auth/login', {
      method: 'POST',
      data: { username: 'jogador', password: 'senha-jogador' }
    }),
    p = character();
  const result = await other.request('/api/submissions', {
    method: 'POST',
    token: auth.token,
    data: { character: p }
  });
  assert.equal(result.status, 'pending');
  await rejected(
    () => f.request('/api/json/player', 'GET', { account_id: f.admin.account.id }),
    400
  );
});

test('habilidade acrescentada ao livro aparece com nível zero nas fichas existentes', async () => {
  const f = await fixture();
  await active(f);
  const g = await f.request('/api/game'),
    id = Math.max(...g.talents.map((t) => t.id)) + 1;
  g.talents.push({ id, name: 'Habilidade criada', description: 'Um recurso novo da campanha.' });
  await f.request('/api/game', 'PUT', { ...g, _expected_revision: g._revision });
  let p = await f.request('/api/characters/234567');
  assert.equal(p.talents.find((e) => e.id === id).value, 0);
  p = await f.request('/api/characters/234567/xp', 'POST', {
    revision: p._revision,
    amount: 10,
    reason: 'Teste de evolução'
  });
  const quote = await f.request(
    '/api/characters/234567/upgrade-preview',
    'GET',
    { key: 'talents', id, target: 1 },
    f.player.token
  );
  const after = await f.request(
    '/api/characters/234567/upgrade',
    'POST',
    { ...quote, confirmed: true, quoted_cost: quote.cost },
    f.player.token
  );
  assert.equal(after.talents.find((e) => e.id === id).value, 1);
});

test('propostas encerradas conservam o histórico quando um conteúdo é retirado do livro', async () => {
  const f = await fixture();
  await active(f);
  const p = await f.request('/api/characters/234567');
  await f.request('/api/characters/234567', 'DELETE', {
    revision: p._revision,
    confirmation: p.char
  });
  const g = await f.request('/api/game'),
    entry = g.atributes[0];
  await f.request('/api/rulebook/catalog/atributes/' + entry.id, 'DELETE', {
    revision: g._revision,
    confirmation: entry.name,
    remove_references: true
  });
  const root = validateWorkspace(workspaceExport(await f.store.workspace()));
  assert.ok(
    root.campaigns[0].submissions[0].character.atributes.some((row) => row.id === entry.id)
  );
});

test('XP em lote é individual, atômico e idempotente', async () => {
  const f = await fixture();
  await active(f);
  await active(f, 345678);
  const payload = {
    request_id: 'distribuicao-123',
    character_ids: [234567, 345678],
    revisions: { 234567: 0, 345678: 0 },
    amount: 7,
    reason: 'Interpretação',
    confirmed: true
  };
  const result = await f.request('/api/admin/xp/distribute', 'POST', payload);
  assert.equal(result.count, 2);
  await f.request('/api/admin/xp/distribute', 'POST', payload);
  assert.deepEqual(
    (await f.request('/api/characters')).map((p) => p.xp),
    [7, 7]
  );
  await rejected(
    () =>
      f.request('/api/admin/xp/distribute', 'POST', {
        ...payload,
        request_id: 'outro-lote-123',
        revisions: { 234567: 1, 345678: 0 }
      }),
    409
  );
  assert.deepEqual(
    (await f.request('/api/characters')).map((p) => p.xp),
    [7, 7]
  );
  assert.doesNotThrow(() => validateWorkspace(workspaceExport(f.store.root)));
});
test('jogador não distribui XP nem sem confirmação', async () => {
  const f = await fixture();
  await active(f);
  const payload = {
    request_id: 'lote-permissoes',
    character_ids: [234567],
    revisions: { 234567: 0 },
    amount: 8,
    reason: 'Recompensa',
    confirmed: true
  };
  await rejected(() => f.request('/api/admin/xp/distribute', 'POST', payload, f.player.token), 403);
  await rejected(
    () => f.request('/api/admin/xp/distribute', 'POST', { ...payload, confirmed: false }),
    400
  );
  assert.equal((await f.request('/api/characters/234567')).xp, 0);
});
test('mural é isolado por personagem e indisponível ao narrador', async () => {
  const f = await fixture();
  await active(f);
  await active(f, 345678);
  const first = await f.request(
    '/api/network/nodes',
    'POST',
    { character_id: 234567, name: 'Um segredo' },
    f.player.token
  );
  assert.equal(
    (await f.request('/api/network?character_id=345678', 'GET', {}, f.player.token)).nodes.length,
    0
  );
  await rejected(() => f.request('/api/network?character_id=234567'), 403);
  await rejected(
    () =>
      f.request('/api/network/nodes/' + first.id, 'PATCH', {
        character_id: 234567,
        revision: 1,
        name: 'Interferência'
      }),
    403
  );
  await rejected(
    () =>
      f.request(
        '/api/network/nodes/' + first.id,
        'PATCH',
        { character_id: 345678, revision: 1, name: 'Outro mural' },
        f.player.token
      ),
    404
  );
  assert.equal((await f.request('/api/campaign')).network.nodes.length, 0);
  const packet = await f.request('/api/json/player', 'GET', {}, f.player.token);
  assert.equal(packet.campaigns[0].network.nodes[0].id, first.id);
});
test('transferir personagem também transfere o acesso ao seu mural', async () => {
  const f = await fixture();
  await active(f);
  await f.request(
    '/api/network/nodes',
    'POST',
    { character_id: 234567, name: 'Contato de Helena' },
    f.player.token
  );
  const other = await f.request('/api/admin/accounts', 'POST', {
    username: 'outro',
    display_name: 'Outro',
    role: 'player',
    password: 'senha-outro-123',
    character_ids: []
  });
  await f.request('/api/characters/234567/assign', 'POST', { revision: 0, account_id: other.id });
  await rejected(
    () => f.request('/api/network?character_id=234567', 'GET', {}, f.player.token),
    403
  );
  const auth = await f.service.request('/auth/login', {
    method: 'POST',
    data: { username: 'outro', password: 'senha-outro-123' }
  });
  assert.equal(
    (await f.request('/api/network?character_id=234567', 'GET', {}, auth.token)).nodes.length,
    1
  );
});
