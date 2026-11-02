import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zipSync, unzipSync, strFromU8 } from 'fflate';
import { CampaignStore } from '../../core/store.js';
import { PortalService as CampaignService } from '../../core/portal-service.js';
import { workspaceDocuments, assembleDocuments } from '../../core/documents.js';
import { documentSeed, blank, clone, recordId, validatePlayer, backup } from '../../core/model.js';
import {
  gameSettings,
  upgradeQuote,
  mechanics,
  parseDelta,
  rollPool
} from '../../core/settings.js';
import { validateWorkspace, workspaceExport, playerExport } from '../../core/workspace.js';
import { hashPassword, checkPassword } from '../../core/passwords.js';
import { zipDocuments, parseFile } from '../../client/files.js';
import { traitsPage } from '../../client/evolution.js';
const originalGame = JSON.parse(
    await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8')
  ),
  game = gameSettings(originalGame),
  example = JSON.parse(
    await readFile(new URL('../fixtures/character.json', import.meta.url), 'utf8')
  );
const image = 'data:image/jpeg;base64,/9j/2Q==';
test('catálogo oferece ajuste ao narrador e saldo de evolução apenas ao jogador', () => {
  const p = blank(game, 234567);
  p.xp = 65;
  const ctx = { state: { game }, player: () => p, admin: () => true };
  const narrator = traitsPage(ctx);
  assert.match(narrator, /Distribuir XP/);
  assert.match(narrator, /CONSULTAR E AJUSTAR/);
  assert.doesNotMatch(narrator, /XP DISPONÍVEIS|PRÓXIMO NÍVEL/);
  const participant = traitsPage({ ...ctx, admin: () => false });
  assert.match(participant, /65<small>XP DISPONÍVEIS/);
  assert.match(participant, /PRÓXIMO NÍVEL/);
  assert.doesNotMatch(participant, /Distribuir XP|CONSULTAR E AJUSTAR/);
});
async function fixture() {
  const store = await new CampaignStore(documentSeed(game)).open(),
    service = new CampaignService(store),
    auth = await service.request('/auth/bootstrap', {
      method: 'POST',
      data: { display_name: 'Narrador', username: 'narrador', password: 'teste-narrador-123' }
    });
  const request = (path, method = 'GET', data = {}, token = auth.token) =>
    service.request(path, { method, data, token });
  return { store, service, auth, request };
}
function character(id = 234567) {
  const p = blank(game, id);
  Object.assign(p, {
    char: 'Helena Vesper',
    player: 'Marina',
    cla: 'Clã manual',
    xp: 65,
    money: 1250
  });
  p.atributes[0].value = 3;
  p.atributes[1].value = 2;
  return p;
}
async function enroll(f, id = 234567, username = 'jogador') {
  return f.request('/api/admin/characters', 'POST', {
    character: character(id),
    access: { username, password: 'teste-jogador-123' }
  });
}
async function login(f, username = 'jogador', password = 'teste-jogador-123') {
  return f.service.request('/auth/login', { method: 'POST', data: { username, password } });
}
const rejects = (fn, status) => assert.rejects(fn, (e) => e.status === status);
const notes = (f, title = 'Uma pista', visibility = 'campaign', token = f.auth.token) =>
  f.request('/api/notes', 'POST', { title, content: 'Texto da anotação', visibility }, token);
const quest = (f, data = {}, token = f.auth.token) =>
  f.request(
    '/api/quests',
    'POST',
    {
      title: 'A página perdida',
      description: 'Recuperar o livro',
      assignees: [234567],
      xp_reward: 8,
      money_reward: 250,
      items: [{ name: 'Chave', quantity: 1, description: 'Ferro frio' }],
      ...data
    },
    token
  );

test('primeiro narrador, transcrição manual e login por senha', async () => {
  const f = await fixture(),
    p = await enroll(f),
    a = await login(f);
  assert.equal(p.atributes[0].value, 3);
  assert.equal(p.atributes[1].value, 2);
  assert.equal(p.cla, 'Clã manual');
  assert.deepEqual(a.account.character_ids, [234567]);
  assert.equal((await f.store.workspace()).accounts[0].password_hash.algorithm, 'pbkdf2-sha256');
  assert.ok(!(await f.store.workspace()).accounts[0].password_hash.hash.includes('teste-narrador'));
  await rejects(
    () =>
      f.service.request('/auth/bootstrap', { data: { username: 'outra', password: 'teste-123' } }),
    409
  );
});
test('não há persistência implícita ao abrir uma instância nova', async () => {
  const f = await fixture();
  await enroll(f);
  const newStore = new CampaignStore(documentSeed(game));
  assert.equal((await newStore.get()).accounts.length, 0);
  assert.equal((await newStore.get()).characters.length, 0);
  assert.equal(f.store.mode, 'json-memory');
});
test('JSON completo atravessa serialização e restaura contas e campanhas', async () => {
  const f = await fixture();
  await enroll(f);
  const exported = await f.request('/api/json/workspace');
  assert.equal(exported.sessions, undefined);
  const restored = new CampaignStore(validateWorkspace(JSON.parse(JSON.stringify(exported)))),
    service = new CampaignService(restored),
    a = await service.request('/auth/login', {
      data: { username: 'jogador', password: 'teste-jogador-123' }
    });
  assert.equal(
    (await service.request('/api/characters/234567', { token: a.token })).char,
    'Helena Vesper'
  );
});
test('importa backup da edição anterior e migra regras', async () => {
  const f = await fixture();
  await enroll(f);
  const old = backup(await f.store.get()),
    migrated = validateWorkspace(old);
  assert.equal(migrated.format, 'coroa-hub-v2');
  assert.equal(migrated.campaigns[0].game.interface.status_confirmation_seconds, 2);
  assert.equal(migrated.accounts[1].memberships[migrated.campaigns[0].id][0], 234567);
});
test('ficha original de ID zero continua importável', async () => {
  const f = await fixture();
  const p = await f.request('/api/characters/import', 'POST', { character: example });
  assert.equal(p.id, 0);
  assert.equal((await f.request('/api/characters/0')).id, 0);
});
test('cadastro com login duplicado reverte também a ficha', async () => {
  const f = await fixture();
  await enroll(f);
  await rejects(() => enroll(f, 345678), 409);
  assert.equal((await f.store.get()).characters.length, 1);
});
test('IDs aleatórios são numéricos e livres', () => {
  const doc = { characters: [] };
  for (let i = 0; i < 1000; i++) {
    const id = recordId(doc);
    assert.ok(id >= 100000 && id <= 999999);
    assert.ok(!doc.characters.some((p) => p.id === id));
    doc.characters.push({ id });
  }
});
test('jogador tem escopo de ficha e não altera XP por PATCH', async () => {
  const f = await fixture();
  await enroll(f);
  await enroll(f, 345678, 'segundo');
  const a = await login(f);
  assert.equal((await f.request('/api/characters', 'GET', {}, a.token)).length, 1);
  await rejects(() => f.request('/api/characters/345678', 'GET', {}, a.token), 403);
  for (const k of ['money', 'xp', 'atributes', 'id', 'history'])
    await rejects(
      () =>
        f.request('/api/characters/234567', 'PATCH', { revision: 0, patch: { [k]: 99 } }, a.token),
      403
    );
});
test('campanhas isolam ficha de mesmo ID, notas e regras', async () => {
  const f = await fixture();
  await enroll(f);
  await notes(f);
  const first = (await f.store.get()).id,
    c = await f.request('/api/campaigns', 'POST', { title: 'Segunda mesa', system: 'RPG próprio' });
  await f.request('/api/campaigns/' + c.id + '/select', 'POST');
  assert.equal((await f.request('/api/characters')).length, 0);
  assert.equal((await f.request('/api/notes')).length, 0);
  const p = character();
  p.char = 'Outro universo';
  await f.request('/api/admin/characters', 'POST', { character: p });
  await f.request('/api/campaigns/' + first + '/select', 'POST');
  assert.equal((await f.request('/api/characters/234567')).char, 'Helena Vesper');
  assert.equal((await f.request('/api/notes')).length, 1);
});
test('jogador não entra em outra campanha sem vínculo', async () => {
  const f = await fixture();
  await enroll(f);
  const a = await login(f),
    c = await f.request('/api/campaigns', 'POST', { title: 'Sem acesso', system: 'RPG' });
  await rejects(() => f.request('/api/campaigns/' + c.id + '/select', 'POST', {}, a.token), 403);
  assert.equal((await f.request('/api/campaigns', 'GET', {}, a.token)).length, 1);
});
test('mesa encerrada é somente leitura e pode ser reaberta', async () => {
  const f = await fixture();
  await enroll(f);
  const id = (await f.store.get()).id;
  await f.request('/api/campaigns/' + id, 'PATCH', { status: 'closed' });
  await rejects(() => notes(f), 409);
  assert.equal((await f.request('/api/characters')).length, 1);
  await f.request('/api/campaigns/' + id, 'PATCH', { status: 'active' });
  assert.equal((await notes(f)).title, 'Uma pista');
});
test('evolução requer confirmação e custo cotado', async () => {
  const f = await fixture();
  await enroll(f);
  const q = await f.request('/api/characters/234567/upgrade-preview', 'GET', {
    key: 'atributes',
    id: 0,
    target: 4
  });
  assert.equal(q.cost, 15);
  await rejects(
    () =>
      f.request('/api/characters/234567/upgrade', 'POST', {
        revision: 0,
        key: 'atributes',
        id: 0,
        target: 4,
        quoted_cost: 15
      }),
    400
  );
  await rejects(
    () =>
      f.request('/api/characters/234567/upgrade', 'POST', {
        revision: 0,
        key: 'atributes',
        id: 0,
        target: 4,
        confirmed: true,
        quoted_cost: 16
      }),
    409
  );
  const p = await f.request('/api/characters/234567/upgrade', 'POST', {
    ...q,
    confirmed: true,
    quoted_cost: q.cost
  });
  assert.equal(p.xp, 50);
  assert.equal(p.atributes[0].value, 4);
  assert.equal(p._revision, 1);
});
test('custo de múltiplos níveis respeita cada passo e as três bases', () => {
  const p = character();
  for (const [basis, cost] of [
    ['current', 35],
    ['target', 45],
    ['fixed', 10]
  ]) {
    const g = clone(game);
    g.progression.categories.atributes.basis = basis;
    const q = upgradeQuote(p, g, 'atributes', 0, 5);
    assert.equal(q.cost, cost);
    assert.equal(q.steps.length, 2);
  }
});
test('XP insuficiente, limite e geração são validados', async () => {
  const f = await fixture(),
    p = character();
  p.xp = 0;
  await f.request('/api/admin/characters', 'POST', { character: p });
  for (const target of [4, 6, -1, 3.5])
    await rejects(
      () =>
        f.request('/api/characters/234567/upgrade', 'POST', {
          revision: 0,
          key: 'atributes',
          id: 0,
          target,
          confirmed: true,
          quoted_cost: 15
        }),
      400
    );
  assert.equal((await f.request('/api/characters/234567')).xp, 0);
});
test('configuração permite aprender traço novo com custo do nível zero', () => {
  const p = character(),
    g = clone(game),
    id = g.disciplines[0].id;
  assert.throws(() => upgradeQuote(p, g, 'disciplines', id, 1));
  g.progression.categories.disciplines.allow_new = true;
  const q = upgradeQuote(p, g, 'disciplines', id, 1);
  assert.equal(q.from, 0);
  assert.equal(q.cost, g.xp_cost.disciplines);
});
test('mudanças concorrentes não sobrescrevem revisão', async () => {
  const f = await fixture();
  await enroll(f);
  const r = await Promise.allSettled([
    f.request('/api/characters/234567/money', 'POST', { revision: 0, delta: '+100' }),
    f.request('/api/characters/234567/money', 'POST', { revision: 0, delta: '+200' })
  ]);
  assert.equal(r.filter((v) => v.status === 'fulfilled').length, 1);
  assert.equal(r.find((v) => v.status === 'rejected').reason.status, 409);
});
test('game-data permite limites e os aplica à ficha', async () => {
  const f = await fixture();
  await enroll(f);
  const g = clone(game);
  g.status_rules.hunger.max = 12;
  g.progression.categories.atributes.multiplier = 7;
  await f.request('/api/game', 'PUT', g);
  const p = await f.request('/api/characters/234567', 'PATCH', {
    revision: 0,
    patch: { status: { ...character().status, hunger: 11 } }
  });
  assert.equal(p.status.hunger, 11);
  assert.equal(
    (
      await f.request('/api/characters/234567/upgrade-preview', 'GET', {
        key: 'atributes',
        id: 0,
        target: 4
      })
    ).cost,
    21
  );
  await rejects(
    () =>
      f.request('/api/characters/234567', 'PATCH', {
        revision: 1,
        patch: { status: { ...p.status, hunger: 13 } }
      }),
    400
  );
});
test('mecânicas de disciplinas removem colchetes preservando o teste', () => {
  const m = mechanics('[House Check: Sim || Teste: Força + Briga] Texto do poder');
  assert.equal(m.description, 'Texto do poder');
  assert.equal(
    mechanics('[Uma lembrança] Texto do poder').description,
    '[Uma lembrança] Texto do poder'
  );
  assert.deepEqual(m.mechanics, { rouse_check: true, test: 'Força + Briga' });
  assert.equal(mechanics('[Rouse Check: Não || Teste: Nenhum] Texto').mechanics.test, null);
});
test('movimentação aceita ganho, gasto e centavos sem saldo negativo', async () => {
  const f = await fixture();
  await enroll(f);
  let p = await f.request('/api/characters/234567/money', 'POST', {
    revision: 0,
    delta: '-133,50',
    reason: 'Equipamento'
  });
  assert.equal(p.money, 1116.5);
  p = await f.request('/api/characters/234567/money', 'POST', {
    revision: 1,
    delta: '+2500',
    reason: 'Recompensa'
  });
  assert.equal(p.money, 3616.5);
  assert.equal(p.transactions.length, 2);
  assert.equal(p.transactions[0].before, 1116.5);
  await rejects(
    () => f.request('/api/characters/234567/money', 'POST', { revision: 2, delta: '-9999' }),
    400
  );
  assert.equal((await f.request('/api/characters/234567')).money, 3616.5);
});
test('parser financeiro lida com formato brasileiro e recusa lixo', () => {
  assert.equal(parseDelta('+2.500,50'), 2500.5);
  assert.equal(parseDelta('-133'), -133);
  assert.equal(parseDelta('+2500'), 2500);
  for (const s of ['0', 'dinheiro', 'Infinity', '--5', '1e5', '1,001'])
    assert.throws(() => parseDelta(s));
});
test('anotações pessoais e do narrador respeitam a visibilidade', async () => {
  const f = await fixture();
  await enroll(f);
  const a = await login(f);
  await notes(f, 'Pública');
  await notes(f, 'Do narrador', 'gm');
  const own = await notes(f, 'Minha', 'private', a.token);
  await notes(f, 'Privada GM', 'private');
  assert.deepEqual(
    (await f.request('/api/notes', 'GET', {}, a.token)).map((n) => n.title),
    ['Pública', 'Minha']
  );
  assert.deepEqual(
    (await f.request('/api/notes')).map((n) => n.title),
    ['Pública', 'Do narrador', 'Privada GM']
  );
  await rejects(
    () =>
      f.request(
        '/api/notes/' + own.id,
        'PATCH',
        { title: 'Inválida', visibility: 'gm', revision: 1 },
        a.token
      ),
    403
  );
});
test('outro jogador não edita anotação alheia', async () => {
  const f = await fixture();
  await enroll(f);
  await enroll(f, 345678, 'segundo');
  const a = await login(f),
    b = await login(f, 'segundo'),
    n = await notes(f, 'Pista', 'campaign', a.token);
  await rejects(
    () =>
      f.request('/api/notes/' + n.id, 'PATCH', { title: 'Roubo', revision: n._revision }, b.token),
    403
  );
});
test('jogador solicita conclusão mas não cria missão nem entrega recompensas', async () => {
  const f = await fixture();
  await enroll(f);
  const a = await login(f);
  await rejects(() => quest(f, {}, a.token), 403);
  const q = await quest(f);
  await rejects(
    () => f.request('/api/quests/' + q.id + '/complete', 'POST', { revision: 1 }, a.token),
    403
  );
  await f.request(
    '/api/quests/' + q.id + '/request-completion',
    'POST',
    { revision: 1, completion_note: 'Objetivo alcançado.' },
    a.token
  );
  assert.equal((await f.request('/api/characters/234567')).xp, 65);
  assert.equal((await f.request('/api/quests'))[0].status, 'review');
});
test('concluir missão entrega XP, dinheiro e itens exatamente uma vez', async () => {
  const f = await fixture();
  await enroll(f);
  const q = await quest(f);
  await f.request('/api/quests/' + q.id + '/complete', 'POST', { revision: q._revision });
  const p = await f.request('/api/characters/234567');
  assert.equal(p.xp, 73);
  assert.equal(p.money, 1500);
  assert.equal(p.items[0].name, 'Chave');
  assert.equal(p.history.at(-1).action, 'Missão concluída');
  await rejects(() => f.request('/api/quests/' + q.id + '/complete', 'POST', { revision: 2 }), 409);
  assert.equal((await f.request('/api/characters/234567')).xp, 73);
});
test('somente narrador altera recompensas e pode concluir sem solicitação', async () => {
  const f = await fixture();
  await enroll(f);
  const a = await login(f),
    q = await quest(f);
  await rejects(
    () => f.request('/api/quests/' + q.id, 'PATCH', { revision: 1, xp_reward: 40 }, a.token),
    403
  );
  const edited = await f.request('/api/quests/' + q.id, 'PATCH', { revision: 1, xp_reward: 40 });
  await f.request('/api/quests/' + q.id + '/complete', 'POST', { revision: edited._revision });
  assert.equal((await f.request('/api/characters/234567')).xp, 105);
});
test('recompensas de múltiplos participantes são atômicas', async () => {
  const f = await fixture();
  await enroll(f);
  await enroll(f, 345678, 'segundo');
  const q = await quest(f, { assignees: [234567, 345678] });
  await f.store.transact((d) => {
    d.characters[1].xp = 1000000;
    return d;
  });
  await rejects(() => f.request('/api/quests/' + q.id + '/complete', 'POST', { revision: 1 }), 400);
  assert.equal((await f.request('/api/characters/234567')).xp, 65);
  assert.equal((await f.request('/api/quests'))[0].status, 'active');
});
test('mapa e posição do personagem pertencem ao JSON da campanha', async () => {
  const f = await fixture();
  await enroll(f);
  const a = await login(f);
  await f.request('/api/map/image', 'POST', { image, width: 3000, height: 2000 });
  const p = await f.request(
    '/api/map/pins',
    'POST',
    {
      title: 'Meu refúgio',
      x: 0.2,
      y: 0.7,
      type: 'domain',
      color: '#e03060',
      character_id: 234567
    },
    a.token
  );
  assert.equal((await f.request('/api/map')).pins[0].id, p.id);
  await f.request('/api/map/pins/' + p.id, 'PATCH', { revision: 1, x: 0.3, y: 0.8 }, a.token);
  assert.equal((await f.request('/api/map')).pins[0].x, 0.3);
  await rejects(
    () => f.request('/api/map/pins/' + p.id, 'PATCH', { revision: 2, x: 2, y: 0 }, a.token),
    400
  );
  await rejects(
    () => f.request('/api/map/image', 'POST', { image, width: 1, height: 1 }, a.token),
    403
  );
});
test('marcadores privados não aparecem para outros jogadores', async () => {
  const f = await fixture();
  await enroll(f);
  await enroll(f, 345678, 'segundo');
  await f.request('/api/map/image', 'POST', { image, width: 2000, height: 1000 });
  const a = await login(f),
    b = await login(f, 'segundo');
  const pin = await f.request(
    '/api/map/pins',
    'POST',
    { title: 'Segredo', x: 0.5, y: 0.5, visibility: 'private' },
    a.token
  );
  assert.equal((await f.request('/api/map', 'GET', {}, b.token)).pins.length, 0);
  await rejects(
    () => f.request('/api/map/pins/' + pin.id, 'PATCH', { revision: 1, title: 'Roubo' }, b.token),
    403
  );
});
test('mural pessoal conecta NPCs e remove vínculos órfãos', async () => {
  const f = await fixture();
  await enroll(f);
  const user = await login(f);
  const req = (path, method = 'GET', data = {}) =>
    f.request(path, method, { ...data, character_id: 234567 }, user.token);
  const a = await req('/api/network/nodes', 'POST', {
    name: 'Isadora',
    x: 0.2,
    y: 0.3,
    image,
    theories: 'Ela sabe mais.'
  });
  const b = await req('/api/network/nodes', 'POST', { name: 'Baltazar', x: 0.7, y: 0.5 });
  const e = await req('/api/network/links', 'POST', {
    from: a.id,
    to: b.id,
    label: 'Deve um favor'
  });
  assert.equal((await req('/api/network')).links[0].id, e.id);
  await req('/api/network/nodes/' + a.id, 'DELETE', { revision: a._revision });
  assert.equal((await req('/api/network')).links.length, 0);
  assert.equal((await req('/api/network')).nodes.length, 1);
});
test('perfil e fotos sobrevivem ao ciclo de exportação e importação', async () => {
  const f = await fixture();
  await enroll(f);
  await f.request('/api/profile', 'PATCH', {
    display_name: 'Eric',
    avatar: image,
    bio: 'Narrador de histórias',
    preferences: { sound: true, animations: false }
  });
  const root = validateWorkspace(await f.request('/api/json/workspace'));
  assert.equal(root.accounts[0].avatar, image);
  assert.equal(root.accounts[0].preferences.sound, true);
});
test('favores e campos extras permanecem na ficha', async () => {
  const f = await fixture(),
    p = character();
  p.custom = { lore: 'preservado' };
  await f.request('/api/admin/characters', 'POST', { character: p });
  const next = await f.request('/api/characters/234567', 'PATCH', {
    revision: 0,
    patch: {
      favours: [
        {
          id: 'one',
          name: 'Um segredo',
          direction: 'Devo',
          person: 'Isadora',
          description: 'Uma promessa'
        }
      ]
    }
  });
  assert.deepEqual(next.custom, p.custom);
  assert.equal(next.favours[0].direction, 'Devo');
});
test('controle de sessão e relógio do mundo foram removidos', async () => {
  const f = await fixture();
  assert.equal('universe' in (await f.request('/api/campaign')), false);
  await rejects(
    () => f.request('/api/universe', 'POST', { date: 'Noite 1', session: 9, time: '22:00' }),
    404
  );
});
test('pacote do jogador exclui outras contas, fichas e segredos', async () => {
  const f = await fixture();
  await enroll(f);
  await enroll(f, 345678, 'segundo');
  await notes(f, 'Segredo do narrador', 'gm');
  await quest(f, { assignees: [234567, 345678] });
  const a = await login(f),
    pack = await f.request('/api/json/player', 'GET', {}, a.token);
  assert.equal(pack.accounts.length, 1);
  assert.equal(pack.accounts[0].role, 'player');
  assert.equal(pack.campaigns[0].characters.length, 1);
  assert.equal(pack.campaigns[0].notes.length, 0);
  assert.equal(pack.campaigns[0].snapshots.length, 0);
  assert.equal(pack.sessions, undefined);
  assert.equal(validateWorkspace(pack).campaigns[0].quests[0].assignees.length, 2);
});
test('importação valida referências, duplicatas e caminho de campanha', async () => {
  const f = await fixture();
  await enroll(f);
  const root = await f.request('/api/json/workspace');
  for (const mutate of [
    (r) => (r.campaigns[0].id = '../fora'),
    (r) => r.accounts.push(r.accounts[0]),
    (r) => r.campaigns[0].characters.push(r.campaigns[0].characters[0]),
    (r) => (r.accounts[1].memberships[r.campaigns[0].id] = [999999])
  ]) {
    const r = clone(root);
    mutate(r);
    assert.throws(() => validateWorkspace(r));
  }
});
test('ZIP contém portal, regras e fichas JSON independentes', async () => {
  const f = await fixture();
  await enroll(f);
  const root = await f.request('/api/json/workspace'),
    zip = unzipSync(zipDocuments(root)),
    id = root.campaigns[0].id;
  assert.ok(zip['portal.json']);
  assert.ok(zip['accounts.json']);
  assert.ok(zip[`campaigns/${id}/game_data.json`]);
  assert.equal(
    JSON.parse(strFromU8(zip[`campaigns/${id}/characters/234567.json`])).char,
    'Helena Vesper'
  );
  assert.equal(
    validateWorkspace(
      assembleDocuments(
        Object.fromEntries(Object.entries(zip).map(([k, v]) => [k, JSON.parse(strFromU8(v))]))
      )
    ).campaigns.length,
    1
  );
});
test('sessão em memória não marca o arquivo como alterado só por login', async () => {
  const f = await fixture();
  await enroll(f);
  f.store.markExported();
  await login(f);
  assert.equal(f.store.dirty, false);
  await notes(f);
  assert.equal(f.store.dirty, true);
});
test('troca de senha e inativação revogam acessos antigos', async () => {
  const f = await fixture();
  await enroll(f);
  const a = await login(f),
    changed = await f.request(
      '/auth/password',
      'POST',
      { current_password: 'teste-jogador-123', password: 'nova-senha-teste' },
      a.token
    );
  await rejects(() => f.request('/auth/me', 'GET', {}, a.token), 401);
  await f.request('/api/admin/accounts/' + a.account.id, 'PATCH', { active: false });
  await rejects(() => f.request('/auth/me', 'GET', {}, changed.token), 401);
});
test('senha usa salt único e recusa senha errada', async () => {
  const a = await hashPassword('mesma-senha'),
    b = await hashPassword('mesma-senha');
  assert.notEqual(a.salt, b.salt);
  assert.equal(await checkPassword('mesma-senha', a), true);
  assert.equal(await checkPassword('outra', a), false);
});
test('dado configurável conta sucessos e destaca fome sem criar regra de crítico', () => {
  const g = clone(game);
  g.dice.sides = 20;
  g.dice.success_on = 12;
  const roll = rollPool(4, 2, g, () => 0.9);
  assert.equal(roll.successes, 4);
  assert.equal(roll.dice[0].value, 19);
  assert.equal(roll.dice.filter((d) => d.hunger).length, 2);
});
test('rolagem é registrada na ficha e acompanha JSON', async () => {
  const f = await fixture();
  await enroll(f);
  const r = await f.request('/api/characters/234567/roll', 'POST', {
    pool: 6,
    hunger: true,
    label: 'Força + Briga',
    threshold: 7
  });
  assert.equal(r.dice.length, 6);
  assert.equal((await f.request('/api/characters/234567')).rolls[0].label, 'Força + Briga');
});
test('frontend só online usa HTTP e não inclui execução local ou dados de QA', async () => {
  const html = await readFile(new URL('../../dist/index.html', import.meta.url), 'utf8'),
    app = await readFile(new URL('../../dist/assets/scripts/app.js', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /runtime-config.js/);
  assert.doesNotMatch(
    app,
    /localStorage|sessionStorage|indexedDB|showDirectoryPicker|json-memory|COROA_QA_IDENTITIES|EDIÇÃO OFFLINE/
  );
  for (const [, path] of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g))
    assert.ok((await readFile(new URL('../../dist/' + path, import.meta.url))).length);
});
