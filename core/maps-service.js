import { clone, fail, newId, number, text, timestamp } from './model.js';
import { imageData, coordinate, visible, validatePin } from './workspace.js';
import { emptyMap } from './campaign-shape.js';
const admin = (a) => {
  if (a.role !== 'admin') fail('Ação exclusiva do narrador.', 403);
};
function revision(item, data) {
  if (data.revision !== undefined && data.revision !== item._revision)
    fail('O mapa mudou. Atualize antes de salvar.', 409);
}
function access(m, a) {
  if (!m) fail('Mapa não encontrado.', 404);
  if (a.role !== 'admin' && !m.player_access)
    fail('Este mapa não foi liberado para jogadores.', 403);
  return m;
}
const publicMap = (m, a) => ({ ...clone(m), pins: m.pins.filter((p) => visible(p, a)).map(clone) });
export async function mapsRequest(service, path, method, data, token, doc, account) {
  const parts = path.split('/'),
    legacy = parts[2] === 'map',
    id = legacy ? null : parts[3],
    pins = legacy ? parts[3] === 'pins' : parts[4] === 'pins',
    pinId = legacy ? parts[4] : parts[5];
  let selected = id
    ? doc.maps.find((m) => m.id === id)
    : doc.maps.find((m) => account.role === 'admin' || m.player_access);
  if (method === 'GET') {
    if (!legacy && !id)
      return doc.maps
        .filter((m) => account.role === 'admin' || m.player_access)
        .map((m) => publicMap(m, account));
    if (!selected && !id) return emptyMap();
    selected = access(selected, account);
    return pins ? publicMap(selected, account).pins : publicMap(selected, account);
  }
  return service.write(token, (d, a) => {
    let m = id
      ? d.maps.find((m) => m.id === id)
      : d.maps.find((m) => a.role === 'admin' || m.player_access);
    const create = (!legacy && !id && !pins) || (legacy && parts[3] === 'image' && !m);
    if (create) {
      admin(a);
      if (d.maps.length >= 50) fail('Máximo de 50 mapas por campanha.');
      m = {
        id: newId(),
        title: text(data.title || 'Mapa da campanha', 'Nome do mapa', 150, true),
        description: text(data.description || '', 'Descrição', 5000),
        player_access: legacy ? true : data.player_access === true,
        mode: data.mode || 'image',
        center: { lat: -23.5505, lng: -46.6333, zoom: 11 },
        image: '',
        width: 0,
        height: 0,
        pins: [],
        _revision: 0,
        created_by: a.id,
        created_at: timestamp()
      };
      d.maps.push(m);
    }
    access(m, a);
    if (!pins) {
      admin(a);
      revision(m, data);
      if (method === 'DELETE') {
        if (data.confirmation !== m.title) fail('Digite o nome do mapa para remover.');
        d.deleted_maps.push({
          id: newId(),
          map: clone(m),
          deleted_at: timestamp(),
          deleted_by: a.id
        });
        d.maps = d.maps.filter((x) => x.id !== m.id);
        return { status: 'deleted' };
      }
      if (data.title !== undefined) m.title = text(data.title, 'Nome do mapa', 150, true);
      if (data.description !== undefined) m.description = text(data.description, 'Descrição', 5000);
      if (data.player_access !== undefined) {
        if (typeof data.player_access !== 'boolean') fail('Permissão de mapa inválida.');
        m.player_access = data.player_access;
      }
      const mode = data.mode ?? m.mode ?? 'image';
      if (!['image', 'geographic'].includes(mode)) fail('Tipo de mapa inválido.');
      if (mode !== (m.mode || 'image') && m.pins.length)
        fail('Crie outro mapa para mudar o tipo e preservar as posições.');
      m.mode = mode;
      if (data.center !== undefined) {
        const { lat, lng, zoom } = data.center;
        if (
          !Number.isFinite(lat) ||
          lat < -85.05 ||
          lat > 85.05 ||
          !Number.isFinite(lng) ||
          lng < -180 ||
          lng > 180 ||
          !Number.isInteger(zoom) ||
          zoom < 2 ||
          zoom > 19
        )
          fail('Centro geográfico inválido.');
        m.center = { lat, lng, zoom };
      }
      if (data.image !== undefined && mode === 'image') {
        imageData(data.image, 45000000);
        if (!data.image) fail('Selecione uma imagem de mapa.');
        m.image = data.image;
        m.width = number(data.width, 'Largura', 1, 20000);
        m.height = number(data.height, 'Altura', 1, 20000);
      }
      if (m.mode === 'image' && !m.image) fail('Envie uma imagem para o mapa.');
      m._revision++;
      m.updated_at = timestamp();
      return publicMap(m, a);
    }
    let pin = pinId ? m.pins.find((p) => p.id === pinId) : null;
    if (pinId && !pin) fail('Marcador não encontrado.', 404);
    if (pin) {
      if (!visible(pin, a)) fail('Marcador não encontrado.', 404);
      if (a.role !== 'admin' && pin.created_by !== a.id)
        fail('Só o autor ou narrador pode alterar o marcador.', 403);
      revision(pin, data);
    }
    if (method === 'DELETE') {
      m.pins = m.pins.filter((p) => p.id !== pinId);
      m._revision++;
      return { status: 'deleted' };
    }
    const characterId = data.character_id === undefined ? pin?.character_id : data.character_id;
    if (characterId !== null && characterId !== undefined) {
      if (!d.characters.some((p) => p.id === characterId)) fail('Ficha não encontrada.');
      if (a.role !== 'admin' && !a.character_ids.includes(characterId))
        fail('Esta ficha não está vinculada a você.', 403);
    }
    const visibility = data.visibility ?? pin?.visibility ?? 'campaign';
    if (
      !['campaign', 'private', 'gm'].includes(visibility) ||
      (visibility === 'gm' && a.role !== 'admin')
    )
      fail('Visibilidade inválida.', 403);
    const values = {
      x: coordinate(data.x ?? pin?.x),
      y: coordinate(data.y ?? pin?.y),
      character_id: characterId ?? null,
      visibility
    };
    if (m.mode === 'geographic') {
      values.lat = data.lat ?? pin?.lat;
      values.lng = data.lng ?? pin?.lng;
      if (
        !Number.isFinite(values.lat) ||
        values.lat < -85.05 ||
        values.lat > 85.05 ||
        !Number.isFinite(values.lng) ||
        values.lng < -180 ||
        values.lng > 180
      )
        fail('Posição geográfica inválida.');
    }
    if (data.images !== undefined) {
      if (!Array.isArray(data.images) || data.images.length > 6)
        fail('Use até seis imagens por local.');
      values.images = data.images.map((image) => imageData(image));
    }
    if (data.npcs !== undefined) {
      if (!Array.isArray(data.npcs) || data.npcs.length > 12) fail('Use até doze NPCs por local.');
      values.npcs = data.npcs.map((npc) => ({
        id: text(npc.id || newId(), 'ID', 100, true),
        name: text(npc.name, 'Nome do NPC', 150, true),
        role: text(npc.role || '', 'Papel', 500),
        description: text(npc.description || '', 'Descrição', 10000),
        image: imageData(npc.image || '')
      }));
    }
    for (const key of [
      'title',
      'description',
      'type',
      'domain',
      'color',
      'address',
      'atmosphere',
      'danger'
    ])
      if (data[key] !== undefined)
        values[key] = text(data[key], key, key === 'description' ? 30000 : 500);
    if (!values.title && !pin?.title) fail('Dê um nome ao marcador.');
    if (values.color && !/^#[a-f\d]{6}$/i.test(values.color)) fail('Cor inválida.');
    validatePin({ ...pin, ...values });
    if (pin) Object.assign(pin, values);
    else {
      pin = { id: newId(), created_by: a.id, created_at: timestamp(), _revision: 0, ...values };
      m.pins.push(pin);
    }
    pin._revision++;
    pin.updated_at = timestamp();
    m._revision++;
    m.updated_at = timestamp();
    return clone(pin);
  });
}
