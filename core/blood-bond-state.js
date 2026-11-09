import { text, number, fail } from './model.js';
import { imageData } from './image-data.js';
export const bloodStages = [
  {
    id: 'fervor',
    name: 'Fervor rubro',
    plain: 'Recente',
    description: 'O sangue ainda pulsa. A presença do vínculo está viva.'
  },
  {
    id: 'echo',
    name: 'Eco nas veias',
    plain: 'Poucos dias',
    description: 'O encontro se afastou, mas o chamado continua próximo.'
  },
  {
    id: 'distant',
    name: 'Sangue distante',
    plain: 'Vários dias',
    description: 'A lembrança do sangue começa a perder intensidade.'
  },
  {
    id: 'ash',
    name: 'Fios de cinza',
    plain: 'Há muito tempo',
    description: 'A ligação se torna tênue. É hora de observar seu desgaste.'
  },
  {
    id: 'fading',
    name: 'À beira da ruptura',
    plain: 'Em risco de enfraquecer',
    description: 'Quando a história justificar, reduza um nível e registre o desgaste.'
  }
];
export function validateBloodBonds(value) {
  if (
    !Array.isArray(value) ||
    value.length > 1000 ||
    new Set(value.map((b) => b?.id)).size !== value.length
  )
    fail('Laços de sangue inválidos.');
  for (const b of value) {
    text(b?.id, 'ID do laço', 100, true);
    text(b.name, 'Nome', 150, true);
    text(b.description || '', 'Descrição', 15000);
    text(b.last_scene || '', 'Último contato', 3000);
    imageData(b.image || '');
    number(b.level, 'Nível do laço', 0, 5);
    number(b._revision, 'Revisão do laço', 0);
    if (!['bound_to', 'holds'].includes(b.direction) || !bloodStages.some((s) => s.id === b.stage))
      fail('Estado do laço inválido.');
    if (typeof b.updated_at !== 'string' || !Number.isFinite(Date.parse(b.updated_at)))
      fail('Data de registro do laço inválida.');
  }
  return value;
}
