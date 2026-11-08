// One screen per allocation. Forward navigation always passes through nextCreationStep.
export const creationStages = [
  { phase: 'identity', label: 'Identidade' },
  { phase: 'initial', key: 'atributes', label: 'Atributos' },
  { phase: 'initial', key: 'skills', label: 'Habilidades' },
  { phase: 'initial', key: 'precedents', label: 'Antecedentes' },
  { phase: 'initial', key: 'disciplines', label: 'Disciplinas' },
  { phase: 'traits', label: 'Qualidades e defeitos' },
  { phase: 'bonus', key: 'atributes', label: 'Bônus em atributos' },
  { phase: 'bonus', key: 'skills', label: 'Bônus em habilidades' },
  { phase: 'bonus', key: 'precedents', label: 'Bônus em antecedentes' },
  { phase: 'bonus', key: 'disciplines', label: 'Bônus em disciplinas' },
  { phase: 'review', label: 'Conferir e enviar' }
];
const family = (key) => (['talents', 'expertises', 'knowledges'].includes(key) ? 'skills' : key);
const group = (issue) => family(issue.key);
export function creationIssueStep(issue) {
  if (issue.stage === 'identity') return 0;
  if (issue.stage === 'initial')
    return creationStages.findIndex((s) => s.phase === 'initial' && s.key === group(issue));
  if (issue.key === 'caracteristics' && !issue.requires) return 5;
  if (issue.key === 'bonus') return 9;
  const category = issue.requires || group(issue);
  const target = creationStages.findIndex((s) => s.phase === 'bonus' && s.key === category);
  return target < 0 ? 5 : target;
}
export function creationStepProblems(step, source, report) {
  const current = creationStages[step];
  if (!current) return [{ message: 'Etapa de criação inválida.' }];
  const problems = report.issues.filter((issue) => {
    if (current.phase === 'review') return true;
    const target = creationIssueStep(issue);
    // The shared bonus reserve only has to be empty at the end of its cycle.
    if (issue.key === 'bonus' && report.totals.bonus.remaining > 0) return false;
    if (issue.key === 'bonus' && step >= 5) return true;
    if (current.phase === 'initial') return target === step || target === 0;
    if (current.phase === 'identity') return target === 0;
    // Requirements bought in a later bonus category remain visible, but do not trap the player here.
    return target <= step;
  });
  if (!source.char?.trim())
    problems.unshift({ message: 'Preencha o nome do personagem.', step: 0 });
  if (source.creation.clan === 'custom' && !source.cla?.trim())
    problems.unshift({ message: 'Preencha o nome do clã personalizado.', step: 0 });
  return problems.map((p) => ({ ...p, step: p.step ?? creationIssueStep(p) }));
}
export function nextCreationStep(step, source, report) {
  const problems = creationStepProblems(step, source, report);
  if (problems.length) return { allowed: false, target: step, problems };
  if (step === 9 && report.totals.bonus.remaining > 0)
    return { allowed: true, target: 6, problems: [], loop: true };
  return { allowed: step < 10, target: Math.min(10, step + 1), problems: [] };
}
export function canReturnToCreationStep(current, target) {
  return Number.isInteger(target) && target >= 0 && target < current;
}
