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
      biography: 'Uma história criada exclusivamente para conferir a interface.'
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
  await request('/api/social', 'POST', {
    title: 'Um caminho para seguir',
    content:
      'O porto guarda a próxima pista. Deixem por aqui as descobertas antes de visitar a corte.',
    kind: 'message'
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
      content: 'Anotei os nomes citados por Isadora. Tem alguém da corte nessa lista.',
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
  const campaign_id = store.root.active_campaign_id;
  return {
    root: await store.workspace(),
    identities: { admin: { ...admin, campaign_id }, player: { ...player, campaign_id } }
  };
}
