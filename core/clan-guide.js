import guide from '../data/clan_guide.json' with { type: 'json' };

export const clanGuides = guide.clans;
export const commonDisciplineNames = [
  'Animalismo',
  'Auspícios',
  'Rapidez',
  'Dominação',
  'Fortitude',
  'Ofuscação',
  'Potência',
  'Presença'
];
export const convictionExamples = [
  'Não matar inocentes.',
  'Proteger quem depende de mim.',
  'Não trair quem confia em mim.',
  'Honrar acordos feitos livremente.',
  'Não usar crueldade como diversão.',
  'Não entregar alguém à tortura.'
];
export function guideForClan(clan) {
  return { ...clanGuides.find((g) => g.id === clan?.id), ...clan?.guide };
}
export function clanArt(id) {
  return clanGuides.some((g) => g.id === id)
    ? '/assets/images/clans/' + id + '.webp'
    : '/assets/images/coroa-night.jpg';
}
