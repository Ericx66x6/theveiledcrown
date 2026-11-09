import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFixture, image } from './fixture-v8.mjs';
import { recapQuality } from '../../core/chronicle-state.js';
import { upgradeQuote } from '../../core/settings.js';
import { normalizeRoot } from '../../core/campaign-shape.js';
const story = {
  title: 'A carta sob o cais',
  scene:
    'Parei na saída do armazém do porto, acompanhando Isadora enquanto a guarda procurava uma testemunha que desapareceu.',
  events:
    'Negociei acesso ao arquivo oferecendo um favor futuro. Descobri que as remessas eram financiadas por alguém do conselho, mas ainda não conheço seu nome. Escolhi esconder a carta original no meu refúgio e entregar uma cópia para a informante. Essa decisão fez a guarda desconfiar de mim e colocou minha promessa anterior em risco.',
  pending:
    'Ainda preciso descobrir quem retirou a página do livro e cumprir o favor prometido. Também devo explicar ao meu aliado por que abandonei nosso encontro.',
  next: 'Quero procurar o barqueiro antes que ele deixe a cidade e comparar os símbolos da carta com os registros antigos.',
  cast: 'Isadora, barqueiro e guarda do cais'
};
test('Onde paramos: rascunho livre, estrutura obrigatória, privacidade, avaliação e +1 XP único', async () => {
  const f = await portalFixture(),
    id = 234567;
  let entry = await f.call(
    '/api/recaps',
    'POST',
    { character_id: id, title: 'Rascunho', scene: 'Fui ao porto' },
    f.one.token
  );
  await assert.rejects(
    () =>
      f.call(
        '/api/recaps/' + entry.id + '/submit',
        'POST',
        { revision: entry._revision },
        f.one.token
      ),
    /quatro tópicos/
  );
  assert.equal((await f.call('/api/recaps', 'GET', {}, f.two.token)).length, 0);
  await assert.rejects(
    () => f.call('/api/recaps/' + entry.id, 'GET', {}, f.two.token),
    (e) => e.status === 404
  );
  entry = await f.call(
    '/api/recaps/' + entry.id,
    'PATCH',
    { ...story, revision: entry._revision },
    f.one.token
  );
  assert.equal(recapQuality(entry).complete, true);
  entry = await f.call(
    '/api/recaps/' + entry.id + '/submit',
    'POST',
    { revision: entry._revision },
    f.one.token
  );
  await assert.rejects(
    () =>
      f.call(
        '/api/recaps/' + entry.id,
        'PATCH',
        { ...story, revision: entry._revision },
        f.one.token
      ),
    (e) => e.status === 409
  );
  await assert.rejects(
    () =>
      f.call(
        '/api/recaps/' + entry.id + '/review',
        'POST',
        { outcome: 'reward', revision: entry._revision },
        f.one.token
      ),
    (e) => e.status === 403
  );
  let p = await f.player(id);
  const before = p.xp;
  await assert.rejects(
    () =>
      f.call('/api/recaps/' + entry.id + '/review', 'POST', {
        outcome: 'reward',
        revision: entry._revision,
        character_revision: p._revision + 1,
        confirmed: true
      }),
    (e) => e.status === 409
  );
  assert.equal((await f.player(id)).xp, before);
  const oldRev = entry._revision;
  entry = await f.call('/api/recaps/' + entry.id + '/review', 'POST', {
    outcome: 'reward',
    revision: entry._revision,
    character_revision: p._revision,
    confirmed: true,
    note: 'As consequências e o próximo passo ficaram claros.'
  });
  assert.equal(entry.reward.xp, 1);
  p = await f.player(id);
  assert.equal(p.xp, before + 1);
  assert.match(p.history.at(-1).action, /Relato/);
  await assert.rejects(
    () =>
      f.call('/api/recaps/' + entry.id + '/review', 'POST', {
        outcome: 'reward',
        revision: oldRev,
        character_revision: p._revision,
        confirmed: true
      }),
    (e) => e.status === 409
  );
  assert.equal((await f.player(id)).xp, before + 1);
  const duplicate = await f.call(
    '/api/recaps',
    'POST',
    { ...story, character_id: id },
    f.one.token
  );
  await assert.rejects(
    () =>
      f.call(
        '/api/recaps/' + duplicate.id + '/submit',
        'POST',
        { revision: duplicate._revision },
        f.one.token
      ),
    /já foi registrado/
  );
});
test('Onde paramos: narrador pede complemento sem premiar nem reescrever; reenvio mantém a história', async () => {
  const f = await portalFixture();
  let r = await f.call('/api/recaps', 'POST', { ...story, character_id: 234567 }, f.one.token);
  r = await f.call(
    '/api/recaps/' + r.id + '/submit',
    'POST',
    { revision: r._revision },
    f.one.token
  );
  r = await f.call('/api/recaps/' + r.id + '/review', 'POST', {
    outcome: 'changes',
    revision: r._revision,
    note: 'Explique o favor prometido.'
  });
  assert.equal(r.status, 'changes_requested');
  assert.equal(r.reward, undefined);
  await assert.rejects(
    () => f.call('/api/recaps/' + r.id, 'PATCH', { ...story, revision: r._revision }),
    (e) => e.status === 403
  );
  r = await f.call(
    '/api/recaps/' + r.id,
    'PATCH',
    {
      ...story,
      events:
        story.events +
        ' Prometi abrir os registros do meu domínio para Isadora, quando ela precisasse.',
      revision: r._revision
    },
    f.one.token
  );
  assert.match(r.review_note, /favor/);
  r = await f.call(
    '/api/recaps/' + r.id + '/submit',
    'POST',
    { revision: r._revision },
    f.one.token
  );
  assert.equal(r.status, 'submitted');
});
test('Relato de personagem transferido não premia o novo dono pelo texto de outro jogador', async () => {
  const f = await portalFixture();
  let entry = await f.call('/api/recaps', 'POST', { ...story, character_id: 234567 }, f.one.token);
  entry = await f.call(
    '/api/recaps/' + entry.id + '/submit',
    'POST',
    {
      revision: entry._revision
    },
    f.one.token
  );
  const before = await f.player();
  await f.call('/api/characters/234567/assign', 'POST', {
    revision: before._revision,
    account_id: f.two.account.id
  });
  const transferred = await f.player();
  await assert.rejects(
    () =>
      f.call('/api/recaps/' + entry.id + '/review', 'POST', {
        revision: entry._revision,
        character_revision: transferred._revision,
        outcome: 'reward',
        confirmed: true
      }),
    (e) => e.status === 409
  );
  assert.equal((await f.player()).xp, before.xp);
  const fresh = await f.call('/api/recaps/' + entry.id);
  assert.equal(fresh.status, 'submitted');
  assert.equal(fresh.reward, undefined);
});
test('Dois personagens do mesmo jogador mantêm relatos e avaliações independentes', async () => {
  const f = await portalFixture();
  const second = await f.player(345678);
  await f.call('/api/characters/345678/assign', 'POST', {
    revision: second._revision,
    account_id: f.one.account.id
  });
  let first = await f.call('/api/recaps', 'POST', { ...story, character_id: 234567 }, f.one.token);
  let other = await f.call(
    '/api/recaps',
    'POST',
    {
      ...story,
      title: 'Outra história',
      character_id: 345678
    },
    f.one.token
  );
  first = await f.call(
    '/api/recaps/' + first.id + '/submit',
    'POST',
    { revision: first._revision },
    f.one.token
  );
  other = await f.call(
    '/api/recaps/' + other.id + '/submit',
    'POST',
    { revision: other._revision },
    f.one.token
  );
  assert.equal((await f.call('/api/recaps', 'GET', {}, f.one.token)).length, 2);
  const p = await f.player();
  await f.call('/api/recaps/' + first.id + '/review', 'POST', {
    revision: first._revision,
    outcome: 'reward',
    character_revision: p._revision,
    confirmed: true
  });
  assert.equal((await f.player()).xp, p.xp + 1);
  assert.equal((await f.player(345678)).xp, second.xp);
  assert.equal((await f.call('/api/recaps/' + other.id)).status, 'submitted');
});
test('Feedback: só autor e narrador leem; recompensa variável vai à ficha do autor uma vez', async () => {
  const f = await portalFixture();
  let e = await f.call(
    '/api/feedbacks',
    'POST',
    {
      kind: 'bug',
      title: 'O mapa fechou',
      content: 'Ao trocar de mapa no meu celular, a seleção voltou ao primeiro.',
      impact: 'Precisei abrir o local novamente.',
      suggestion: 'Manter a seleção.'
    },
    f.one.token
  );
  assert.equal((await f.call('/api/feedbacks', 'GET', {}, f.two.token)).length, 0);
  await assert.rejects(
    () =>
      f.call('/api/feedbacks/' + e.id + '/review', 'POST', {
        revision: e._revision,
        xp: 2,
        character_id: 345678,
        character_revision: 0,
        confirmed: true
      }),
    /pertença ao autor/
  );
  const p = await f.player();
  const args = {
    revision: e._revision,
    xp: 2,
    character_id: p.id,
    character_revision: p._revision,
    confirmed: true,
    reply: 'Boa descrição: consegui reproduzir o problema.'
  };
  e = await f.call('/api/feedbacks/' + e.id + '/review', 'POST', args);
  assert.equal(e.reward.xp, 2);
  assert.equal((await f.player()).xp, p.xp + 2);
  await assert.rejects(
    () => f.call('/api/feedbacks/' + e.id + '/review', 'POST', args),
    (e) => e.status === 409
  );
  await assert.rejects(
    () => f.call('/api/feedbacks/' + e.id, 'DELETE', { revision: e._revision }, f.one.token),
    (e) => e.status === 403
  );
});
test('Documentos: seleção por jogador, conteúdo privado fora do portal, leitura e mudança de acesso', async () => {
  const f = await portalFixture();
  let d = await f.call('/api/documents', 'POST', {
    title: 'Carta reservada',
    kind: 'letter',
    body: 'O informante estará no arquivo vermelho.',
    issuer: 'A corte',
    image,
    access: 'restricted',
    account_ids: [f.one.account.id]
  });
  assert.equal((await f.call('/api/documents', 'GET', {}, f.two.token)).length, 0);
  await assert.rejects(
    () => f.call('/api/documents/' + d.id, 'GET', {}, f.two.token),
    (e) => e.status === 404
  );
  const state = await f.call('/api/portal-state', 'GET', {}, f.two.token);
  assert.equal(JSON.stringify(state).includes('arquivo vermelho'), false);
  let visible = await f.call('/api/documents/' + d.id, 'GET', {}, f.one.token);
  assert.equal(visible.account_ids, undefined);
  visible = await f.call('/api/documents/' + d.id + '/read', 'POST', {}, f.one.token);
  assert.equal(visible.read, true);
  await assert.rejects(
    () =>
      f.call(
        '/api/documents/' + d.id,
        'PATCH',
        { ...d, revision: d._revision, access: 'campaign' },
        f.one.token
      ),
    (e) => e.status === 403
  );
  d = await f.call('/api/documents/' + d.id, 'PATCH', {
    ...d,
    revision: d._revision,
    access: 'campaign',
    account_ids: []
  });
  assert.equal((await f.call('/api/documents', 'GET', {}, f.two.token)).length, 1);
});
test('Galeria pertence à conta: evolução automática, feito manual, recibo persistente e entrega idempotente', async () => {
  const f = await portalFixture();
  const p = await f.player(),
    g = await f.call('/api/game'),
    q = upgradeQuote(p, g, 'atributes', 0, 4);
  await f.call(
    '/api/characters/' + p.id + '/upgrade',
    'POST',
    {
      key: 'atributes',
      id: 0,
      target: 4,
      revision: p._revision,
      quoted_cost: q.cost,
      confirmed: true
    },
    f.one.token
  );
  let gal = await f.call('/api/achievements', 'GET', {}, f.one.token);
  assert.equal(gal.entries.length, 1);
  assert.match(gal.entries[0].description, /nível 3 ao 4/);
  await assert.rejects(
    () => f.call('/api/achievements', 'POST', { account_id: f.one.account.id }, f.one.token),
    (e) => e.status === 403
  );
  const args = {
    account_id: f.one.account.id,
    request_id: 'feito_primeira_cacada',
    name: 'A noite tem seu nome',
    icon: '👑',
    description: 'Você sustentou a história até o último momento.',
    confirmed: true
  };
  const awarded = await f.call('/api/achievements', 'POST', args);
  assert.equal((await f.call('/api/achievements', 'POST', args)).id, awarded.id);
  gal = await f.call('/api/achievements', 'GET', {}, f.one.token);
  assert.equal(gal.entries.length, 2);
  assert.equal(gal.events.length, 1);
  assert.equal(gal.entries[1].character_name, '');
  await f.call('/api/achievements/ack', 'POST', { ids: gal.events.map((e) => e.id) }, f.one.token);
  assert.equal((await f.call('/api/achievements', 'GET', {}, f.one.token)).events.length, 0);
  await f.call('/api/achievements/' + awarded.id, 'DELETE', {
    account_id: f.one.account.id,
    confirmed: true
  });
  assert.equal((await f.call('/api/achievements', 'GET', {}, f.one.token)).entries.length, 1);
});
test('Galeria continua na conta sem campanhas e remoção não reaparece na normalização', async () => {
  const f = await portalFixture();
  const p = await f.player(),
    quote = upgradeQuote(p, f.game, 'atributes', 0, 4);
  await f.call(
    '/api/characters/' + p.id + '/upgrade',
    'POST',
    {
      key: 'atributes',
      id: 0,
      target: 4,
      revision: p._revision,
      quoted_cost: quote.cost,
      confirmed: true
    },
    f.one.token
  );
  let gallery = await f.call('/api/achievements', 'GET', {}, f.one.token);
  const deleted = gallery.entries[0].id;
  await f.call('/api/achievements/' + deleted, 'DELETE', {
    account_id: f.one.account.id,
    confirmed: true
  });
  const normalized = normalizeRoot(await f.store.workspace());
  assert.equal(normalized.accounts.find((a) => a.id === f.one.account.id).achievements.length, 0);
  const award = await f.call('/api/achievements', 'POST', {
    account_id: f.one.account.id,
    request_id: 'sem-ficha-feito',
    name: 'A testemunha da noite',
    icon: '🌙',
    description: 'Um título da pessoa.',
    confirmed: true
  });
  await f.call('/api/admin/accounts/' + f.one.account.id, 'PATCH', { campaign_access: false });
  const login = await f.call('/auth/login', 'POST', {
    username: 'primeiro',
    password: 'senha-teste-123'
  });
  gallery = await f.call('/api/achievements', 'GET', {}, login.token);
  assert.equal(gallery.entries.length, 1);
  assert.equal(gallery.entries[0].id, award.id);
  assert.equal(gallery.events.length, 1);
  await f.call(
    '/api/achievements/ack',
    'POST',
    { ids: gallery.events.map((e) => e.id) },
    login.token
  );
  assert.equal((await f.call('/api/achievements', 'GET', {}, login.token)).events.length, 0);
});
test('Laços de sangue: propriedade, níveis 0–5, estágio narrativo, desgaste confirmado e animações por direção', async () => {
  const f = await portalFixture();
  let p = await f.player();
  const args = {
    name: 'Isadora',
    direction: 'bound_to',
    level: 3,
    stage: 'fervor',
    description: 'Uma promessa que o sangue tornou perigosa.',
    last_scene: 'Depois do encontro no cais',
    image,
    character_revision: p._revision,
    confirmed: true
  };
  await assert.rejects(
    () => f.call('/api/characters/' + p.id + '/blood-bonds', 'POST', args, f.two.token),
    (e) => e.status === 403
  );
  p = await f.call('/api/characters/' + p.id + '/blood-bonds', 'POST', args, f.one.token);
  let b = p.blood_bonds[0];
  let events = (await f.call('/api/rewards', 'GET', {}, f.one.token)).events;
  assert.equal(events.find((e) => e.kind === 'blood-bond').polarity, 'bound');
  await assert.rejects(
    () =>
      f.call(
        `/api/characters/${p.id}/blood-bonds/${b.id}/weaken`,
        'POST',
        { revision: b._revision, character_revision: p._revision, confirmed: true },
        f.one.token
      ),
    /beira da ruptura/
  );
  p = await f.call(
    `/api/characters/${p.id}/blood-bonds/${b.id}`,
    'PATCH',
    {
      ...b,
      stage: 'fading',
      revision: b._revision,
      character_revision: p._revision,
      confirmed: true
    },
    f.one.token
  );
  b = p.blood_bonds[0];
  const weaken = { revision: b._revision, character_revision: p._revision, confirmed: true };
  p = await f.call(
    `/api/characters/${p.id}/blood-bonds/${b.id}/weaken`,
    'POST',
    weaken,
    f.one.token
  );
  assert.equal(p.blood_bonds[0].level, 2);
  assert.equal(p.blood_bonds[0].stage, 'distant');
  await assert.rejects(
    () => f.call(`/api/characters/${p.id}/blood-bonds/${b.id}/weaken`, 'POST', weaken, f.one.token),
    (e) => e.status === 409
  );
  p = await f.call(
    '/api/characters/' + p.id + '/blood-bonds',
    'POST',
    { ...args, name: 'O guardião', direction: 'holds', level: 1, character_revision: p._revision },
    f.one.token
  );
  events = (await f.call('/api/rewards', 'GET', {}, f.one.token)).events;
  assert.ok(events.some((e) => e.kind === 'blood-bond' && e.polarity === 'dominion'));
  assert.ok(events.some((e) => e.kind === 'blood-bond' && e.polarity === 'release'));
  assert.equal(
    (await f.player()).blood_bonds[0].level,
    2,
    'tempo real e leituras não envelhecem o vínculo'
  );
});
