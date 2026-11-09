import { readFile } from 'node:fs/promises';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { blank, documentSeed } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
import { upgradeQuote } from '../../core/settings.js';
import { creationSource } from '../domain/creation-fixture.mjs';
import { evaluateCreation } from '../../core/character-creation.js';
export async function previewFixture() {
  const game = gameSettings(
      JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
    ),
    store = new CampaignStore(documentSeed(game)),
    service = new PortalService(store);
  const admin = await service.request('/auth/bootstrap', {
    method: 'POST',
    data: { display_name: 'Narrador · QA', username: 'qa-narrador', password: 'senha-ficticia-123' }
  });
  const request = (path, method = 'GET', data = {}) =>
    service.request(path, { method, data, token: admin.token });
  for (const [id, name, xp] of [
    [234567, 'Helena Vesper', 65],
    [345678, 'Lucien Valmont', 32]
  ]) {
    const p = blank(game, id);
    Object.assign(p, {
      char: name,
      player: 'Marina · QA',
      cla: 'Sangue antigo',
      xp,
      money: 1200,
      biography: 'Uma história criada exclusivamente para conferir a interface.',
      aspirations: {
        ambition: 'Conquistar um lugar no conselho da cidade.',
        desire: 'Descobrir quem deixou a carta no refúgio.'
      }
    });
    p.atributes[0].value = 3;
    await request('/api/admin/characters', 'POST', {
      character: p,
      ...(id === 234567
        ? { access: { username: 'qa-jogador', password: 'senha-ficticia-123' } }
        : {})
    });
  }
  const a = (await request('/api/admin/accounts')).find((a) => a.role === 'player');
  await request('/api/admin/accounts/' + a.id, 'PATCH', { character_ids: [234567, 345678] });
  await request('/api/quests', 'POST', {
    title: 'Ecos do Livro Vermelho',
    description: 'Encontre a página desaparecida e descubra quem está apagando os nomes da corte.',
    assignees: [234567],
    xp_reward: 8,
    money_reward: 300
  });
  const image =
    'data:image/jpeg;base64,' +
    (await readFile(new URL('../../public/images/coroa-night.jpg', import.meta.url))).toString(
      'base64'
    );
  await request('/api/maps', 'POST', {
    title: 'A cidade sob o eclipse',
    image,
    width: 1800,
    height: 900,
    player_access: true
  });
  await request('/api/maps', 'POST', {
    title: 'Os segredos da corte',
    image,
    width: 1800,
    height: 900,
    player_access: false
  });
  const portrait = image;
  await request('/api/profile', 'PATCH', {
    avatar: portrait,
    bio: 'Narrador da crônica. Quem guarda os segredos do véu.'
  });
  await request('/api/admin/accounts', 'POST', {
    username: 'qa-segundo',
    display_name: 'Theo · QA',
    password: 'senha-ficticia-123',
    role: 'player',
    character_ids: [],
    campaign_access: true
  });
  const maps = await request('/api/maps');
  await request('/api/maps/' + maps[0].id + '/pins', 'POST', {
    title: 'O Porto Velho',
    description:
      'Armazéns fechados, luzes vermelhas e acordos que nunca chegam aos ouvidos do príncipe.',
    domain: 'Território disputado',
    address: 'Margem norte da cidade',
    atmosphere: 'Névoa, silêncio e cheiro de maresia',
    danger: 'Alto depois do anoitecer',
    x: 0.45,
    y: 0.55,
    type: 'domain',
    visibility: 'campaign',
    images: [image],
    npcs: [
      {
        id: 'isadora-porto',
        name: 'Isadora',
        role: 'A informante do cais',
        description: 'Conhece os barcos que chegam sem registro. Cobra favores, não moedas.',
        image: ''
      }
    ]
  });
  const geo = await request('/api/maps', 'POST', {
    title: 'As ruas da crônica',
    mode: 'geographic',
    center: { lat: -23.5505, lng: -46.6333, zoom: 13 },
    player_access: true
  });
  await request('/api/maps/' + geo.id + '/pins', 'POST', {
    title: 'O refúgio da Sé',
    description: 'Um ponto de encontro que parece esquecido pela cidade.',
    x: 0.37,
    y: 0.63,
    lat: -23.5505,
    lng: -46.6333,
    type: 'location',
    visibility: 'campaign'
  });
  await request('/api/notes', 'POST', {
    title: 'O silêncio da corte',
    content:
      'A informante do porto pode saber quem está apagando os nomes do livro. Não entreguem o original a ninguém.',
    tags: 'porto,livro,Isadora',
    visibility: 'campaign'
  });
  const player = await service.request('/auth/login', {
    method: 'POST',
    data: { username: 'qa-jogador', password: 'senha-ficticia-123' }
  });
  await service.request('/api/profile', {
    method: 'PATCH',
    token: player.token,
    data: { avatar: portrait, bio: 'Gosto de mistérios, personagens improváveis e boas teorias.' }
  });
  await service.request('/api/social', {
    method: 'POST',
    token: player.token,
    data: {
      content: 'Qual filme você recomenda para a próxima noite sem sessão?',
      title: 'Uma mensagem fora do jogo',
      to: admin.account.id,
      kind: 'message'
    }
  });
  await service.request('/api/network/nodes', {
    method: 'POST',
    token: player.token,
    data: {
      character_id: 234567,
      name: 'Isadora',
      role: 'Uma aliada de intenções incertas',
      theories: 'Sabe mais sobre o livro do que admite.'
    }
  });
  const active = store.root.active_campaign_id;
  await request('/api/campaigns/' + active, 'PATCH', { cover: image });
  const g = await request('/api/game');
  g.discipline_market.allowed_ids = g.disciplines
    .filter((d) => d.id !== 0)
    .slice(0, 3)
    .map((d) => d.id);
  g._expected_revision = g._revision;
  await request('/api/game', 'PUT', g);
  let pc = await request('/api/characters/234567');
  const attributes = pc.atributes.map((e) => (e.id === 7 ? { ...e, value: 2 } : e)),
    skills = pc.expertises.map((e) => (e.id === 4 ? { ...e, value: 3 } : e));
  await request('/api/characters/234567', 'PATCH', {
    revision: pc._revision,
    patch: {
      profilepicture: image,
      atributes: attributes,
      expertises: skills,
      disciplines: [{ id: 0, nivel: 2 }],
      allies: [
        {
          id: 'isadora-qa',
          name: 'Isadora',
          role: 'Informante',
          description: 'Uma aliança que nasceu no cais.',
          rating: 2,
          image
        }
      ],
      domains: [
        {
          id: 'porto-qa',
          name: 'O velho armazém',
          type: 'Refúgio',
          rating: 2,
          description: 'Uma porta para a cidade que acorda depois da meia-noite.',
          image
        }
      ]
    },
    log_message: 'Transcrição de uma ficha fictícia para validação da interface.'
  });
  let map = (await request('/api/maps'))[0];
  await request('/api/maps/' + map.id, 'PATCH', {
    revision: map._revision,
    scale: { pixels: 1000, meters: 10000 }
  });
  await service.request(`/api/maps/${map.id}/characters/234567`, {
    method: 'PUT',
    token: player.token,
    data: { x: 0.67, y: 0.4, revision: 0, visibility: 'private' }
  });
  for (const entry of [
    {
      title: 'Os nomes por trás do cais',
      category: 'Personagem',
      teaser: 'Uma informante conhece quem está comprando silêncio no porto.',
      xp_cost: 7,
      money_cost: 200,
      secret:
        'Isadora revelou que o guardião da corte financia os barcos clandestinos. O encontro acontece no armazém 9.'
    },
    {
      title: 'A porta que não aparece nos mapas',
      category: 'Lugar',
      teaser: 'Alguns caminhos só se abrem para quem sabe o nome certo.',
      xp_cost: 10,
      money_cost: 0,
      secret: 'Sob a capela abandonada existe uma passagem para o arquivo dos antigos.'
    },
    {
      title: 'Um sinal na última carta',
      category: 'Pista',
      teaser: 'Um detalhe quase invisível pode mudar a leitura de toda a história.',
      xp_cost: 4,
      money_cost: 0,
      secret: 'O selo da carta não pertence ao príncipe. É o símbolo de uma casa esquecida.'
    }
  ])
    await request('/api/intel', 'POST', { ...entry, cover: image, images: [image] });
  await service.request('/api/social', {
    method: 'POST',
    token: player.token,
    data: { kind: 'challenge', to: admin.account.id, choice: 'rock' }
  });
  // Persistent, fictional game-feel fixtures; never used by npm start.
  await service.request('/auth/register', {
    method: 'POST',
    data: {
      username: 'qa-convidada',
      password: 'senha-ficticia-123',
      display_name: 'Isadora · novo cadastro'
    }
  });
  const now = Date.now();
  for (let offset = 6; offset >= 2; offset--) {
    service.now = () => now - offset * 86400000;
    await service.request('/api/rewards/check-in', {
      method: 'POST',
      data: {},
      token: player.token
    });
  }
  const receipts = await service.request('/api/rewards', { token: player.token });
  await service.request('/api/rewards/ack', {
    method: 'POST',
    data: { ids: receipts.events.map((e) => e.id) },
    token: player.token
  });
  delete service.now;
  const before = await request('/api/characters/234567');
  await request('/api/admin/xp/distribute', 'POST', {
    request_id: 'qa_login_xp_93',
    amount: 7,
    reason: 'Uma ótima interpretação deixou marcas na corte.',
    character_ids: [before.id],
    revisions: { [before.id]: before._revision },
    confirmed: true
  });
  const campaign_id = store.root.active_campaign_id;
  const playerCall = (path, method = 'GET', data = {}) =>
    service.request(path, { method, data, token: player.token });
  let memory = await playerCall('/api/recaps', 'POST', {
    character_id: 234567,
    title: 'A carta sob o cais',
    scene:
      'Parei na saída do armazém do porto, acompanhando Isadora enquanto a guarda procurava uma testemunha que desapareceu.',
    events:
      'Negociei acesso ao arquivo oferecendo um favor futuro. Descobri que as remessas eram financiadas por alguém do conselho, mas ainda não conheço seu nome. Escolhi esconder a carta original no meu refúgio e entregar uma cópia para a informante. Essa decisão fez a guarda desconfiar de mim e colocou minha promessa anterior em risco.',
    pending:
      'Ainda preciso descobrir quem retirou a página do livro e cumprir o favor prometido. Também devo explicar ao meu aliado por que abandonei nosso encontro.',
    next: 'Quero procurar o barqueiro antes que ele deixe a cidade e comparar os símbolos da carta com os registros antigos.',
    cast: 'Isadora, o barqueiro e a guarda do cais'
  });
  await playerCall('/api/recaps/' + memory.id + '/submit', 'POST', { revision: memory._revision });
  await playerCall('/api/recaps', 'POST', {
    character_id: 345678,
    title: 'O silêncio do casarão',
    scene: 'Lucien está diante do portão do casarão, aguardando uma resposta do guardião.',
    events: 'A conversa com a corte mudou o rumo da investigação.',
    pending: 'Preciso descobrir por que o nome da família foi apagado.',
    next: 'Conversar com o guardião antes de entrar.',
    cast: 'O guardião do casarão'
  });
  await playerCall('/api/feedbacks', 'POST', {
    kind: 'story',
    title: 'As consequências no porto fizeram diferença',
    content:
      'Gostei de perceber que entregar uma cópia da carta mudou a atitude da guarda. Senti que a escolha realmente teve peso na história.',
    impact: 'Fiquei mais interessado em pensar nas consequências antes de decidir.',
    suggestion: 'Seria legal reencontrar a informante para descobrir o preço desse favor.'
  });
  const second = (await request('/api/admin/accounts')).find((a) => a.username === 'qa-segundo');
  await request('/api/documents', 'POST', {
    title: 'Decreto da corte',
    kind: 'decree',
    issuer: 'O Conselho sob o Véu',
    caption: 'Um selo vermelho. Uma ordem que atravessa a cidade.',
    body: 'Àqueles que caminham sob o véu,\n\nNenhum nome será apagado dos arquivos sem que a corte conheça o motivo. Aqueles que guardam cartas, testemunhas ou promessas devem preservar seus registros.\n\nA cidade tem memória. O sangue também.',
    access: 'campaign',
    account_ids: []
  });
  await request('/api/documents', 'POST', {
    title: 'A carta que não chegou ao porto',
    kind: 'letter',
    issuer: 'Uma mão desconhecida',
    caption: 'Um recado reservado a um único jogador.',
    body: 'O armazém nove estará vazio quando os sinos pararem. Procure o símbolo sob a porta.',
    image,
    access: 'restricted',
    account_ids: [second.id]
  });
  let current = await playerCall('/api/characters/234567');
  for (const [name, direction, level, stage] of [
    ['Isadora', 'bound_to', 2, 'echo'],
    ['Maurício, o vigia', 'holds', 1, 'distant']
  ]) {
    current = await playerCall('/api/characters/234567/blood-bonds', 'POST', {
      name,
      direction,
      level,
      stage,
      image,
      description:
        direction === 'bound_to'
          ? 'Uma ligação que nasceu de uma promessa no cais e se tornou difícil de ignorar.'
          : 'O vigia mantém uma lealdade que vai além das palavras.',
      last_scene: 'Depois do encontro no armazém, antes da visita à corte.',
      character_revision: current._revision,
      confirmed: true
    });
  }
  const quote = upgradeQuote(current, await request('/api/game'), 'talents', 0, 1);
  await playerCall('/api/characters/234567/upgrade', 'POST', {
    key: 'talents',
    id: 0,
    target: 1,
    revision: current._revision,
    quoted_cost: quote.cost,
    confirmed: true
  });
  const oldEffects = (await playerCall('/api/rewards')).events.filter((e) =>
    ['blood-bond', 'upgrade'].includes(e.kind)
  );
  if (oldEffects.length)
    await playerCall('/api/rewards/ack', 'POST', { ids: oldEffects.map((e) => e.id) });
  await request('/api/achievements', 'POST', {
    account_id: player.account.id,
    request_id: 'qa_feito_do_jogador_101',
    name: 'Seu nome atravessou o véu',
    icon: '👑',
    description: 'Por transformar escolhas em histórias que a mesa vai lembrar.',
    confirmed: true
  });
  const campaign = await request('/api/campaign');
  await request('/api/campaigns/' + campaign_id, 'PATCH', {
    revision: campaign._revision,
    moral_principle: 'Não sacrificar inocentes para proteger nossos segredos.'
  });
  const proposal = creationSource(game, 'brujah', 567890);
  Object.assign(proposal, {
    char: 'Dante, a primeira noite',
    biography:
      'Antes do Abraço eu organizava shows no bairro. Agora quero proteger quem ainda vive por lá.',
    profilepicture: image,
    moralityes: [{ id: 0, description: 'Não matar inocentes.' }]
  });
  await playerCall('/api/submissions', 'POST', {
    character: evaluateCreation(proposal, game).character
  });
  const pending = (await playerCall('/api/rewards')).events;
  if (pending.length)
    await playerCall('/api/rewards/ack', 'POST', { ids: pending.map((e) => e.id) });
  const marks = (await playerCall('/api/achievements')).events;
  if (marks.length)
    await playerCall('/api/achievements/ack', 'POST', { ids: marks.map((e) => e.id) });
  return {
    root: await store.workspace(),
    identities: { admin: { ...admin, campaign_id }, player: { ...player, campaign_id } }
  };
}
