export const limits = {
  hunger: 6,
  humanity: 5,
  sdamage: 10,
  adamage: 10,
  willpower: 10,
  inspiration: 1
};
export const labels = {
  skills: 'Habilidades',
  bonus: 'Pontos bônus',
  creation: 'Criação',
  clan: 'Clã',
  hunger: 'Fome',
  humanity: 'Humanidade',
  sdamage: 'Dano superficial',
  adamage: 'Dano agravado',
  willpower: 'Força de vontade',
  inspiration: 'Inspiração',
  atributes: 'Atributos',
  talents: 'Talentos',
  expertises: 'Perícias',
  knowledges: 'Conhecimentos',
  precedents: 'Antecedentes',
  disciplines: 'Disciplinas',
  rituals: 'Rituais',
  caracteristics: 'Qualidades e defeitos'
};
export function xpCost(current, target, multiplier) {
  let total = 0;
  for (let level = current; level < target; level++) total += Math.max(level, 1) * multiplier;
  return total;
}
export function rollD10(pool, hunger = 0, threshold = 6, random = Math.random) {
  const dice = Array.from({ length: pool }, (_, i) => ({
    value: Math.floor(random() * 10) + 1,
    hunger: i < Math.min(hunger, pool)
  }));
  return {
    dice,
    successes: dice.filter((d) => d.value >= threshold).length,
    threshold,
    at: new Date().toISOString()
  };
}

// Record IDs are identifiers, never authentication credentials. Works in HTTP previews too.
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
