import { readFile } from 'node:fs/promises';
import { CampaignStore } from '../../core/store.js';
import { PortalService } from '../../core/portal-service.js';
import { documentSeed, blank } from '../../core/model.js';
import { gameSettings } from '../../core/settings.js';
export const image = 'data:image/jpeg;base64,/9j/2Q==';
export async function portalFixture() {
  const game = gameSettings(
    JSON.parse(await readFile(new URL('../../data/game_data.json', import.meta.url), 'utf8'))
  );
  const store = new CampaignStore(documentSeed(game)),
    service = new PortalService(store);
  const admin = await service.request('/auth/bootstrap', {
    method: 'POST',
    data: { username: 'narrador', display_name: 'Narrador', password: 'senha-teste-123' }
  });
  const call = (path, method = 'GET', data = {}, token = admin.token) =>
    service.request(path, { method, data, token });
  const users = [];
  for (const [id, username, name] of [
    [234567, 'primeiro', 'Marina'],
    [345678, 'segundo', 'Theo']
  ]) {
    const p = blank(game, id);
    Object.assign(p, { char: 'Personagem ' + id, player: name, cla: 'Livre', xp: 80, money: 1200 });
    p.atributes[0].value = 3;
    p.atributes[7].value = 2;
    p.expertises.find((e) => e.id === 4).value = 2;
    p.knowledges.find((e) => e.id === 8).value = 1;
    await call('/api/admin/characters', 'POST', {
      character: p,
      access: { username, password: 'senha-teste-123' }
    });
    users.push(await call('/auth/login', 'POST', { username, password: 'senha-teste-123' }));
  }
  return {
    game,
    store,
    service,
    admin,
    one: users[0],
    two: users[1],
    call,
    campaign: store.root.active_campaign_id,
    player: (id = 234567, token = admin.token) => call('/api/characters/' + id, 'GET', {}, token),
    intel: (data = {}) =>
      call('/api/intel', 'POST', {
        title: 'Um nome escondido',
        teaser: 'Alguém conhece o caminho.',
        category: 'Pista',
        xp_cost: 7,
        money_cost: 200,
        secret: 'SEGREDO_INACESSIVEL_734: a rainha mantém o arquivo na torre.',
        images: [image],
        ...data
      }),
    map: (data = {}) =>
      call('/api/maps', 'POST', {
        title: 'A cidade',
        image,
        width: 1000,
        height: 500,
        player_access: true,
        ...data
      })
  };
}
