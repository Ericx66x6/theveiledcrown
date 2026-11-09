import { $, esc, icon, button, field, area, modal } from '../shared/ui.js';
import { clanArt, guideForClan, convictionExamples } from '../core/clan-guide.js';
import { normalizedName } from '../core/creation-config.js';
import { showRuleContent } from './rule-content.js';

export function selectedClan(w) {
  return w.game.character_creation.guided.clans.find((c) => c.id === w.plan.clan);
}
export function clanWeakness(clan, detail = '', creation = false) {
  const g = guideForClan(clan);
  if (!clan && !creation) return '';
  const hints = {
    ventrue: 'Que tipo de mortal alimenta você? Ex.: pessoas que lideram uma comunidade.',
    malkavian: 'Qual perturbação foi combinada com o narrador e como ela aparece?',
    ravnos: 'Qual tentação coloca seu autocontrole à prova? Combine uma que funcione na mesa.',
    tzimisce: 'De qual lugar vem a terra que você leva para descansar?',
    nosferatu: 'Como o Abraço marcou sua aparência e como você se apresenta ao mundo?'
  };
  return `<details class="creation-clan-curse"><summary>${icon('blood')}<strong>Fraqueza ${clan ? 'de ' + esc(clan.name) : 'do seu clã'}</strong><span>Um detalhe importante</span></summary><p>${esc(g.weakness || 'Descreva com o narrador a fraqueza desta linhagem personalizada.')}</p><small>Acompanha o clã e não concede pontos bônus.</small>${creation ? area('clan_flaw_detail', 'Como isso aparece no seu personagem? (opcional)', detail, `maxlength="3000" rows="2" placeholder="${esc(hints[clan?.id] || 'Uma particularidade para lembrar durante o jogo…')}"`) : detail ? `<p class="prose clan-flaw-personal">${esc(detail)}</p>` : ''}</details>`;
}
function previewClan(w) {
  return (
    w.game.character_creation.guided.clans.find((c) => c.id === w.previewClan) ||
    selectedClan(w) ||
    w.game.character_creation.guided.clans[0]
  );
}
export function clanRail(w) {
  return (
    w.game.character_creation.guided.clans
      .map((c) => {
        const g = guideForClan(c);
        return `<button type="button" class="clan-portrait-card ${w.previewClan === c.id ? 'previewing' : ''} ${w.plan.clan === c.id ? 'chosen' : ''}" data-clan-preview="${esc(c.id)}" aria-label="Conhecer ${esc(c.name)}" aria-pressed="${w.previewClan === c.id}"><img src="${clanArt(c.id)}" alt="" loading="lazy" width="640" height="853"><span>${w.plan.clan === c.id ? '<small>SEU CLÃ</small>' : ''}<strong>${esc(c.name)}</strong><small>${esc(g.epithet || 'Uma linhagem da crônica')}</small></span></button>`;
      })
      .join('') +
    `<button type="button" class="clan-portrait-card custom ${w.previewClan === 'custom' ? 'previewing' : ''}" data-clan-preview="custom" aria-label="Conhecer Clã personalizado" aria-pressed="${w.previewClan === 'custom'}"><span class="custom-clan-crest">${icon('edit')}</span><span><strong>Personalizado</strong><small>Para jogadores experientes</small></span></button>`
  );
}
export function clanSpotlight(w) {
  if (w.previewClan === 'custom')
    return `<section class="clan-spotlight custom"><div class="clan-spotlight-art"><img src="${clanArt('custom')}" alt="Uma cidade sob o véu" width="640" height="853"></div><div class="clan-spotlight-body"><span class="eyebrow">ALÉM DAS LINHAGENS CONHECIDAS</span><h2>Um sangue que pede outra história.</h2><p>Você escolhe o nome e três disciplinas cadastradas. Essa combinação exige experiência e uma conversa prévia com o narrador.</p><aside class="clan-caution">${icon('notes')} A ficha pode ser recusada. Combine o conceito, os poderes e a fraqueza antes de montar o personagem.</aside>${button(w.plan.clan === 'custom' ? 'Clã personalizado escolhido' : 'Quero criar um clã personalizado', 'creation-clan-select', 'data-clan-id="custom" ' + (w.plan.clan === 'custom' ? 'disabled' : ''), 'button primary')}</div></section>`;
  const c = previewClan(w);
  if (!c) return '';
  const g = guideForClan(c),
    tab = w.clanTab || 'overview';
  const powers = c.discipline_choices || c.disciplines.filter((id) => id !== null);
  const tabs = [
    ['overview', 'Conheça o clã'],
    ['ideology', 'Ideologia'],
    ['powers', 'Disciplinas'],
    ['weakness', 'Fraqueza']
  ];
  let content;
  if (tab === 'ideology')
    content = `<h3>Um jeito de olhar a não-vida.</h3><p>${esc(g.ideology || 'Construa esta visão com o narrador.')}</p><span class="eyebrow">PERFIS PARA SE INSPIRAR</span><div class="clan-archetypes">${(g.archetypes || []).map((a) => `<span>${esc(a)}</span>`).join('')}</div><p class="hint">Use estas ideias como ponto de partida para criar a sua própria personalidade.</p>`;
  else if (tab === 'powers')
    content = `<h3>${c.discipline_choices ? 'Escolha três dons comuns.' : 'Os dons desta linhagem.'}</h3><p class="hint">Disciplinas são seus poderes sobrenaturais. Você distribuirá três pontos entre os dons escolhidos; algum pode começar no nível zero.</p><div class="clan-power-previews">${powers
      .map((id) => {
        const d = w.game.disciplines.find((d) => d.id === id);
        return d
          ? `<button type="button" data-clan-power="${id}"><strong>${esc(d.name)}</strong><span>${esc((d.description || 'Consulte os poderes desta disciplina.').slice(0, 160))}</span><small>Conhecer este dom ${icon('arrow')}</small></button>`
          : '';
      })
      .join('')}</div>`;
  else if (tab === 'weakness')
    content = `<span class="eyebrow">A MALDIÇÃO DO SANGUE · 3ª EDIÇÃO</span><h3>${c.id === 'caitiff' ? 'Sem uma fraqueza herdada de clã.' : 'Todo sangue cobra um preço.'}</h3><p class="clan-weakness-text">${esc(g.weakness || 'Combine a fraqueza desta linhagem com o narrador.')}</p><p class="hint">A fraqueza acompanha a linhagem e não concede pontos bônus. As consequências na cena são acompanhadas pelo narrador.</p>${c.id === 'nosferatu' ? '<p class="clan-rule-callout">Aparência fica em 0 na criação e não pode receber pontos bônus ou evolução com XP.</p>' : ''}`;
  else
    content = `<p class="clan-description">${esc(g.description || 'Uma linhagem da sua campanha.')}</p><div class="clan-beginner-tip"><span>${icon('characters')}</span><div><strong>${esc(g.beginner_level || 'Conheça com o narrador')}</strong><p>${esc(g.beginner_reason || 'Converse sobre o conceito que você quer jogar.')}</p></div></div><p class="clan-first-question">${esc(g.story_hook || 'Que história você quer contar?')}</p>`;
  return `<section class="clan-spotlight" data-clan-showing="${esc(c.id)}"><div class="clan-spotlight-art"><img src="${clanArt(c.id)}" alt="Arte ilustrativa de ${esc(c.name)}" width="640" height="853"><span class="clan-art-caption">UMA LINHAGEM. INÚMERAS HISTÓRIAS.</span></div><div class="clan-spotlight-body"><span class="eyebrow">${esc(g.epithet || 'O SEU LEGADO DE SANGUE')}</span><div class="clan-name-row"><h2>${esc(c.name)}</h2>${w.plan.clan === c.id ? '<span class="clan-selected-seal">' + icon('test') + ' SEU CLÃ</span>' : ''}</div><div class="clan-guide-tabs" role="tablist" aria-label="Conhecer ${esc(c.name)}">${tabs.map(([key, name]) => `<button type="button" id="clan-tab-${key}" role="tab" aria-selected="${tab === key}" aria-controls="clan-guide-panel" data-clan-tab="${key}">${name}</button>`).join('')}</div><div id="clan-guide-panel" class="clan-guide-panel" role="tabpanel" aria-labelledby="clan-tab-${tab}">${content}</div><div class="clan-choice-actions">${button(w.plan.clan === c.id ? 'Clã escolhido' : 'Escolher ' + esc(c.name), 'creation-clan-select', `data-clan-id="${esc(c.id)}" ${w.plan.clan === c.id ? 'disabled' : ''}`, 'button primary')}<span>${w.plan.clan === c.id ? 'Agora dê um nome à sua história.' : 'Você pode explorar os outros antes de decidir.'}</span></div></div></section>`;
}
export function clanAttributeHint(w, category, bonus) {
  const clan = selectedClan(w),
    g = guideForClan(clan);
  const tips = category === 'skills' ? g.skill_tips : g.attribute_tips;
  const entries =
    category === 'disciplines'
      ? [
          'Escolha um dom para ser seu ponto forte ou distribua os três pontos entre eles.',
          'Nível 0 mantém a disciplina na ficha para desenvolver depois.'
        ]
      : category === 'precedents'
        ? [
            'Recursos define seu capital inicial; Geração reduz sua geração de 13 até 8.',
            'Aliados e Contatos podem ligar seu personagem à cidade desde o início.'
          ]
        : (tips || [])
            .map((name) => {
              const definition = (
                category === 'skills' ? ['talents', 'expertises', 'knowledges'] : ['atributes']
              )
                .flatMap((key) => w.game[key])
                .find((d) => normalizedName(d.name) === normalizedName(name));
              return definition ? name : null;
            })
            .filter(Boolean);
  return `<aside class="creation-clan-coach"><img src="${clanArt(w.plan.clan)}" alt="" width="640" height="853"><div><span class="eyebrow">${clan ? 'UM PONTO DE PARTIDA PARA ' + esc(clan.name) : 'SEU CONCEITO GUIA AS ESCOLHAS'}</span><p>${category === 'atributes' ? 'Atributos são suas capacidades: força do corpo, presença social e clareza da mente.' : category === 'skills' ? 'Habilidades são coisas que você aprendeu. Escolha o que fazia na vida mortal e o que precisou aprender para sobreviver.' : category === 'disciplines' ? 'Os dons dão forma ao jeito como você enfrenta a noite.' : 'Antecedentes são os vínculos e recursos que já fazem parte da sua história.'}</p><div class="creation-suggestion-chips">${entries.map((t) => `<span>${esc(t)}</span>`).join('')}</div>${category === 'atributes' || category === 'skills' ? `<small>${bonus ? 'Agora os bônus permitem avançar até o limite final.' : 'Comece pelo que combina com sua história; ' + (category === 'atributes' ? '3 indica um ponto forte, enquanto 1 é a sua base.' : '1 indica familiaridade, 2 prática e 3 um destaque na criação.')} ${esc(g.beginner_tip || 'Seu narrador pode ajudar a escolher.')}</small>` : ''}</div></aside>`;
}
export function moralPrinciple(campaign) {
  return `<aside class="creation-moral-principle"><span>${icon('rules')}</span><div><span class="eyebrow">PRINCÍPIO COMPARTILHADO DA CRÔNICA</span><p>${esc(campaign?.moral_principle || 'Sua mesa ainda vai escolher o princípio em conjunto.')}</p><small>Uma regra moral para toda a campanha, combinada entre todos. O narrador registra o acordo; as suas convicções pessoais ficam abaixo.</small></div></aside>`;
}
export function narrativeFields(w) {
  const g = guideForClan(selectedClan(w));
  return `<section class="creation-character-story"><div class="section-heading"><div><span class="eyebrow">A PESSOA POR TRÁS DO SANGUE</span><h3>Quem você era. Quem você quer ser.</h3></div><span class="tag">Opcional</span></div><p>Uma história curta já ajuda a começar. Pense na vida mortal, no Abraço que tornou você vampiro e em algo que ainda importa.</p>${g.story_hook ? `<blockquote>${esc(g.story_hook)}</blockquote>` : ''}${button('Me ajude a começar a história', 'creation-story-help', '', 'button ghost')}${area('biography', 'História do personagem', w.source.biography || '', 'maxlength="30000" rows="5" placeholder="Antes do Abraço eu… Minha vida mudou quando… Ainda me importo com… Agora procuro…"')}${moralPrinciple(w.campaign)}<div class="creation-convictions"><h3>As suas convicções</h3><p>São regras morais pessoais, como “não matar inocentes”. Quebrá-las afeta a Humanidade; o narrador acompanha as consequências na história.</p><p class="hint">Escolha as que fazem sentido ou escreva as suas. Cada personagem pode ter convicções diferentes.</p><div class="conviction-examples">${convictionExamples.map((text, i) => `<button type="button" data-conviction-example="${i}">${icon('plus')}${esc(text)}</button>`).join('')}</div>${area('convictions', 'Minhas convicções — uma por linha', (w.source.moralityes || []).map((r) => r.description).join('\n'), 'maxlength="10000" rows="4" placeholder="Ex.: Não trair quem confia em mim."')}</div></section>`;
}
export function storyHelper(w) {
  const g = guideForClan(selectedClan(w));
  modal(
    'Um começo para a sua história',
    `<p>Responda do seu jeito. Vamos juntar suas ideias em um primeiro rascunho que você pode reescrever.</p>${field('before', 'Como era a sua vida mortal?', '', 'text', 'required maxlength="700" placeholder="Ex.: Eu era um fotógrafo que documentava a vida do bairro."')}${field('embrace', 'Como o vampirismo entrou na sua vida?', '', 'text', 'required maxlength="700" placeholder="Ex.: Fui Abraçado depois de registrar algo que não devia."')}${field('anchor', 'O que você ainda quer proteger?', '', 'text', 'maxlength="700" placeholder="Ex.: Minha irmã e as pessoas que aparecem nas minhas fotos."')}${field('goal', 'O que você procura nesta cidade?', '', 'text', 'maxlength="700" placeholder="Ex.: Descobrir quem me transformou e por quê."')}<p class="hint">${esc(g.beginner_tip || 'Uma pessoa, um problema e uma vontade já criam um bom começo.')}</p>${w.source.biography ? '<p class="clan-caution">Seu texto atual será substituído por este rascunho ao confirmar.</p>' : ''}`,
    async (form) => {
      const values = ['before', 'embrace', 'anchor', 'goal']
        .map((k) => String(form.get(k) || '').trim())
        .filter(Boolean);
      w.source.biography = values.join('\n\n');
      w.saveDraft();
      w.draw();
    },
    { wide: true, saveLabel: 'Usar como rascunho da história' }
  );
}
export function disciplineIntro(w, id) {
  const d = w.game.disciplines.find((d) => d.id === id);
  if (!d) return;
  modal(
    'Conheça ' + d.name,
    `<span class="eyebrow">UM DOM DO SEU SANGUE</span><p class="prose">${esc(d.description || 'Conheça os poderes desta disciplina no livro.')}</p>${
      d.nivels?.length
        ? `<h3>Os primeiros sinais do dom</h3><div class="clan-power-levels">${d.nivels
            .slice(0, 3)
            .map((n) => `<div><span>${n.nivel}</span><strong>${esc(n.subname)}</strong></div>`)
            .join('')}</div>`
        : ''
    }<p class="hint">Você distribuirá os pontos na etapa Disciplinas. Consultar um poder não escolhe nem compra níveis.</p>${button('Abrir todos os poderes no livro', 'creation-open-full-power', '', 'button primary')}`,
    null,
    { wide: true }
  );
  $('#modal [data-action=creation-open-full-power]').onclick = () =>
    showRuleContent(d, 'disciplines', w.game);
}
