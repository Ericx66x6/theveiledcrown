import { readFile } from 'node:fs/promises';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { blank, documentSeed } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
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
  const campaign_id = store.root.active_campaign_id;
  return {
    root: await store.workspace(),
    identities: { admin: { ...admin, campaign_id }, player: { ...player, campaign_id } }
  };
}
