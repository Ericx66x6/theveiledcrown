import { clone, fail } from './model.js';
export function validateScale(scale) {
  if (scale === null || scale === undefined) return null;
  if (
    !Number.isFinite(scale.pixels) ||
    scale.pixels <= 0 ||
    scale.pixels > 30000 ||
    !Number.isFinite(scale.meters) ||
    scale.meters <= 0 ||
    scale.meters > 4e7
  )
    fail('Escala inválida. Informe pixels e metros maiores que zero.');
  return { pixels: scale.pixels, meters: scale.meters };
}
export function validateMapPosition(p, mode) {
  for (const key of ['x', 'y'])
    if (!Number.isFinite(p[key]) || p[key] < 0 || p[key] > 1) fail('Posição fora do mapa.');
  if (
    mode === 'geographic' &&
    (!Number.isFinite(p.lat) ||
      Math.abs(p.lat) > 85.05 ||
      !Number.isFinite(p.lng) ||
      Math.abs(p.lng) > 180)
  )
    fail('Coordenadas geográficas inválidas.');
  if (!['private', 'campaign'].includes(p.visibility)) fail('Visibilidade do personagem inválida.');
}
export function publicMap(map, actor, characters = []) {
  const result = clone(map);
  const seesPin = (p) =>
    p.visibility === 'private'
      ? p.created_by === actor.id
      : p.visibility === 'gm'
        ? actor.role === 'admin'
        : true;
  result.pins = (map.pins || []).filter(seesPin).map(clone);
  result.character_markers = (map.character_markers || [])
    .filter(
      (p) =>
        characters.some((c) => c.id === p.character_id && !c.archived) &&
        (actor.role === 'admin' ||
          actor.character_ids?.includes(p.character_id) ||
          p.visibility === 'campaign')
    )
    .map((p) => {
      const c = characters.find((c) => c.id === p.character_id);
      return {
        ...clone(p),
        character: {
          id: c.id,
          char: c.char,
          player: c.player,
          profilepicture: c.profilepicture || ''
        }
      };
    });
  return result;
}
export function straightDistanceKm(map, from, to) {
  if (map.mode === 'geographic') {
    if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) return null;
    const rad = (x) => (x * Math.PI) / 180,
      dLat = rad(to.lat - from.lat),
      dLng = rad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  }
  if (!map.scale || !map.width || !map.height) return null;
  const pixels = Math.hypot((to.x - from.x) * map.width, (to.y - from.y) * map.height);
  return (pixels * map.scale.meters) / map.scale.pixels / 1000;
}
