// Availability belongs to the opened character, including a discipline learned at level zero.
export function powerAccess(character, key, definition, power = definition) {
  if (!character) return { state: 'reference', available: false, current: null, required: null };
  const learned = character[key]?.find((entry) => entry.id === definition.id);
  const current = key === 'disciplines' ? (learned?.nivel ?? 0) : learned ? 1 : 0;
  const required = key === 'disciplines' ? power.nivel : 1;
  const available = !!learned && current >= required;
  return { state: available ? 'available' : 'locked', available, current, required };
}
