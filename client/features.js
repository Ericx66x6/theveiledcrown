import { authorByline } from './community.js';
import {
  $,
  esc,
  icon,
  crown,
  button,
  field,
  area,
  select,
  modal,
  closeModal,
  toast,
  date,
  dots,
  empty
} from '../shared/ui.js';
import { api, session, saveSession } from './api.js';
import { heroImage, readImage, currency } from './media.js';
import { clone } from '../core/model.js';
export async function loadFeatureState(state, { silent = false } = {}) {
  const payload = await api('/api/portal-state', {
    data: { character_id: state.player?.id, archived: state.archived === true },
    silent
  });
  const previousId = state.player?.id;
  state.account = payload.account;
  state.campaign = payload.campaign;
  state.game = payload.game;
  state.players = payload.players;
  state.player =
    state.players.find((p) => p.id === previousId) ||
    (state.account.role === 'player' ? state.players[0] || null : null);
  state.campaigns = payload.campaigns;
  state.notes = payload.campaign.notes;
  state.quests = payload.campaign.quests;
  state.submissions = payload.campaign.submissions;
  state.notifications = payload.campaign.notifications;
  state.accounts = payload.accounts;
  state.social = payload.social;
  state.rewards = payload.rewards || null;
  state.registrations = payload.registrations || [];
}
export function campaignHub(ctx) {
  const { state, admin } = ctx;
  return `<div class="page-intro hub-heading"><span class="eyebrow">A COROA VELADA · PORTAL DE RPG</span><h1>Toda mesa é um novo universo.</h1><p>Entre em uma crônica, continue sua história ou abra espaço para a próxima aventura.</p>${admin() ? button(icon('plus') + ' Criar campanha', 'create-campaign', '', 'button primary') : ''}</div><div class="campaign-grid">${state.campaigns.map((c) => `<article class="campaign-card ${c.status === 'closed' ? 'closed' : ''}" style="--campaign-accent:${esc(c.accent)}"><div class="campaign-card-art" style="background-image:linear-gradient(0deg,#11080efa,transparent),url('${esc(c.cover || heroImage())}')"><span class="tag ${c.status === 'active' ? 'red' : ''}">${c.status === 'active' ? 'MESA ABERTA' : 'ENCERRADA'}</span><div class="campaign-seal">${crown}</div><h2>${esc(c.title)}</h2></div><div class="campaign-card-body"><p>${esc(c.description)}</p><div class="campaign-stats"><span>${icon('characters')} ${c.characters} personagens</span><span>${icon('quests')} ${c.quests} missões abertas</span></div><div class="campaign-actions">${button('Entrar na campanha ' + icon('arrow'), 'select-campaign', `data-id="${esc(c.id)}"`, 'button primary')}${admin() ? button(icon('edit'), 'edit-campaign', `data-id="${esc(c.id)}" aria-label="Editar mesa"`, 'icon-button') + button('Apagar', 'delete-campaign', `data-id="${esc(c.id)}"`, 'text-button danger') : ''}</div></div></article>`).join('') || empty('Seu lugar na mesa está reservado.', 'O narrador precisa vincular você a uma campanha.')}</div><section class="panel hub-guidance"><span class="eyebrow">SEUS ARQUIVOS. SUAS HISTÓRIAS.</span><h2>Uma crônica não precisa apagar a outra.</h2><p>Fichas, anotações, missões, mapa e relacionamentos ficam separados em cada mesa. Suas alterações são salvas na campanha. Exporte um backup quando quiser.</p>${button(icon('download') + ' Salvar meus JSONs', 'backup-table', '', 'button ghost')}</section>`;
}
export function notesPage(ctx) {
  const { state, player, admin } = ctx;
  const filter = state.noteFilter || 'campaign';
  const notes = (state.notes || []).filter((n) => n.visibility === filter);
  return `<div class="page-intro"><span class="eyebrow">FRAGMENTOS DA CRÔNICA</span><h1>Nem todo segredo deve ser esquecido.</h1><p>Diário compartilhado, anotações pessoais e os detalhes que podem mudar tudo.</p></div><div class="list-toolbar"><label class="search-field">${icon('search')}<input type="search" data-note-search placeholder="Buscar por título, texto ou marcador" aria-label="Buscar anotações"></label>${button(icon('plus') + ' Nova anotação', 'create-note', '', 'button primary')}</div><div class="note-filters" role="tablist" aria-label="Tipos de anotações">${[['campaign', 'Diário da mesa'], ['private', 'Só minhas'], ...(admin() ? [['gm', 'Narradores']] : [])].map(([key, label]) => `<button type="button" class="button ${key === filter ? 'primary' : 'ghost'}" role="tab" aria-selected="${key === filter}" data-action="note-filter" data-key="${key}">${label}<span>${(state.notes || []).filter((n) => n.visibility === key).length}</span></button>`).join('')}</div><div class="notes-grid">${
    notes
      .map(
        (n) =>
          `<article class="note-card" data-note-text="${esc((n.title + ' ' + n.content + ' ' + n.tags).toLowerCase())}"><div class="note-card-top"><span class="tag ${n.visibility === 'gm' ? 'red' : ''}">${n.visibility === 'private' ? 'SÓ VOCÊ' : n.visibility === 'gm' ? 'NARRADORES' : 'DIÁRIO DA MESA'}</span><span>${n.updated_at !== n.created_at ? 'Editada ' + date(n.updated_at) : ''}</span></div>${authorByline({ ...n.author, avatar: state.social?.members?.find((a) => a.id === n.created_by)?.avatar || '' }, n.created_at, n.legacy_date_label)}<h3>${esc(n.title)}</h3><p class="prose">${esc(n.content)}</p><div class="note-tags">${(
            n.tags || ''
          )
            .split(',')
            .filter(Boolean)
            .map((t) => `<span>#${esc(t.trim())}</span>`)
            .join(
              ''
            )}</div>${n.created_by === state.account.id || admin() ? `<div class="note-actions">${button('Editar', 'edit-note', `data-id="${n.id}"`, 'text-button')}${button('Remover', 'delete-note', `data-id="${n.id}"`, 'text-button danger')}</div>` : ''}</article>`
      )
      .join('') ||
    empty(
      'Seu diário começa com uma linha.',
      'Guarde uma pista, uma teoria ou o que aconteceu na última sessão.',
      button('Escrever primeira anotação', 'create-note', '', 'button ghost')
    )
  }</div>`;
}

export function questsPage(ctx) {
  const { state, admin, player } = ctx;
  const quests = (state.quests || []).filter(
    (q) => admin() || !player() || q.assignees.includes(player().id)
  );
  const active = quests.filter((q) => !['completed', 'cancelled'].includes(q.status));
  return `<div class="page-intro"><span class="eyebrow">O CHAMADO DA AVENTURA</span><h1>Cada conquista muda a história.</h1><p>As recompensas são uma previsão. O narrador decide e confirma os valores na entrega.</p></div><div class="quest-overview"><div><strong>${active.length}</strong><span>MISSÕES EM ABERTO</span></div><div><strong>${quests.filter((q) => q.status === 'completed').length}</strong><span>HISTÓRIAS CONCLUÍDAS</span></div><div><strong>${active.reduce((sum, q) => sum + q.xp_reward, 0)}</strong><span>PREVISÃO DE XP</span></div>${admin() ? button(icon('plus') + ' Nova missão', 'create-quest', '', 'button primary') : ''}</div><div class="quest-grid">${
    quests
      .map((q) => {
        const done = q.status === 'completed',
          rewards = done ? q.delivered_rewards || q : q;
        return `<article class="quest-card ${q.status}"><div class="quest-card-ornament">${icon(done ? 'test' : 'quests')}</div><div class="quest-card-header"><span class="eyebrow">${esc(q.category)}</span><span class="tag ${done ? '' : 'red'}">${done ? 'CONCLUÍDA' : q.status === 'cancelled' ? 'CANCELADA' : 'EM ANDAMENTO'}</span></div><h2>${esc(q.title)}</h2><p class="quest-description prose">${esc(q.description)}</p><div class="quest-participants">${q.assignees.map((id) => `<span>${esc(state.players.find((p) => p.id === id)?.char || state.campaign.roster?.find((p) => p.id === id)?.char || 'Ficha #' + id)}</span>`).join('')}</div><span class="reward-label">${done ? 'RECOMPENSA ENTREGUE' : 'RECOMPENSA PREVISTA'}</span><div class="quest-rewards"><div class="xp-reward"><strong>+${rewards.xp_reward}</strong><span>XP POR PARTICIPANTE</span></div><div><strong>${currency(rewards.money_reward)}</strong><span>POR PARTICIPANTE</span></div></div>${rewards.items?.length ? `<p class="quest-items">${icon('possessions')} ${rewards.items.map((i) => esc(i.name) + ' × ' + i.quantity).join(' · ')}</p>` : ''}${done && q.delivered_rewards ? `<p class="hint">Previsão original: ${q.xp_reward} XP · ${currency(q.money_reward)}.</p>` : ''}${q.completion_note ? `<blockquote class="prose">${esc(q.completion_note)}</blockquote>` : ''}<div class="quest-footer"><span>${esc(q.difficulty)}</span>${admin() ? `${!done ? button('Editar', 'edit-quest', `data-id="${q.id}"`, 'button ghost') : ''}${!done && q.status !== 'cancelled' ? button('Entregar recompensa', 'complete-quest', `data-id="${q.id}"`, 'button primary') : ''}${button('Apagar missão', 'delete-quest', `data-id="${q.id}"`, 'text-button danger')}` : done ? '<span class="completed-seal">' + icon('test') + ' ENTREGUE PELO NARRADOR</span>' : '<span class="hint">A entrega é feita pelo narrador.</span>'}</div></article>`;
      })
      .join('') ||
    empty(
      'O próximo capítulo ainda não foi escrito.',
      admin()
        ? 'Envie uma missão às fichas dos participantes.'
        : 'As missões atribuídas pelo narrador aparecerão aqui.'
    )
  }</div>`;
}
export function profilePage(ctx) {
  const a = ctx.state.account;
  return `<div class="page-intro"><span class="eyebrow">SEU LUGAR NA COROA</span><h1>Por trás de cada personagem, uma história.</h1><p>Organize seu perfil e os detalhes do seu acesso.</p></div><section class="panel profile-panel"><div class="profile-portrait">${a.avatar ? `<img src="${esc(a.avatar)}" alt="Foto de ${esc(a.display_name)}">` : `<span>${esc(a.display_name.slice(0, 1))}</span>`}<span class="profile-role">${a.role === 'admin' ? 'NARRADOR' : 'JOGADOR'}</span></div><form id="profile-form" class="form-grid">${field('display_name', 'Como quer ser chamado', a.display_name, 'text', 'required maxlength="100"')}<label class="field"><span>Foto de perfil</span><input type="file" name="avatar" accept="image/png,image/jpeg,image/webp"></label>${area('bio', 'Sobre você', a.bio || '', 'maxlength="2000" placeholder="Jogos favoritos, estilo de personagem, uma frase…"')}<label class="checkbox full"><input type="checkbox" name="remove_avatar"> Apagar minha foto de perfil</label><p class="hint full">O botão de som no topo controla todos os efeitos do portal.</p><label class="checkbox"><input type="checkbox" name="animations" ${a.preferences?.animations !== false ? 'checked' : ''}> Animações da interface</label><div class="full profile-form-actions"><button type="submit" class="button primary">${icon('save')} Salvar perfil</button>${button('Trocar senha', 'password', '', 'button ghost')}</div></form></section><p class="hint">Seu perfil e a foto acompanham os arquivos JSON exportados.</p>`;
}
export function ruleConfig(ctx) {
  const g = ctx.state.game;
  return `<section class="panel config-panel"><div class="section-heading"><div><span class="eyebrow">CONFIGURAÇÃO DA CAMPANHA</span><h2>As regras pertencem à sua mesa.</h2><p>Esses ajustes são salvos dentro do game_data.</p></div></div><form id="game-config-form"><div class="config-group"><h3>Evolução e XP</h3><p class="hint">Base atual mantém o custo da campanha anterior; base desejada usa o nível que será adquirido.</p><div class="config-traits">${Object.entries(
    g.progression.categories
  )
    .map(
      ([key, r]) =>
        `<div class="config-trait"><strong>${esc({ atributes: 'Atributos', talents: 'Talentos', expertises: 'Perícias', knowledges: 'Conhecimentos', precedents: 'Antecedentes', disciplines: 'Disciplinas', bloodpotency: 'Potência de sangue' }[key])}</strong><label class="checkbox"><input name="enabled:${key}" type="checkbox" ${r.enabled ? 'checked' : ''}> Permitir XP</label>${select(
          'basis:' + key,
          'Base',
          [
            { value: 'current', label: 'Nível atual' },
            { value: 'target', label: 'Nível desejado' },
            { value: 'fixed', label: 'Custo fixo' }
          ],
          r.basis
        )}${field('multiplier:' + key, 'Multiplicador', r.multiplier, 'number', 'required min="1" max="10000" step="1"')}${field('limit:' + key, 'Limite fixo (vazio = geração)', r.max_level ?? '', 'number', 'min="1" max="20" step="1"')}<label class="checkbox"><input name="new:${key}" type="checkbox" ${r.allow_new ? 'checked' : ''}> Aprender traço novo</label></div>`
    )
    .join(
      ''
    )}</div></div><div class="config-group"><h3>Estado e confirmação</h3><div class="form-grid">${field('status_wait', 'Confirmar estado após pausa de (segundos)', g.interface.status_confirmation_seconds, 'number', 'required min="0" max="30" step="1"')}${field('upgrade_wait', 'Espera antes de confirmar evolução (segundos)', g.progression.confirmation_seconds, 'number', 'required min="0" max="15" step="1"')}${Object.entries(
    g.status_rules
  )
    .map(([key, r]) =>
      field(
        'statusmax:' + key,
        `Máximo · ${{ hunger: 'Fome', humanity: 'Humanidade', sdamage: 'Dano superficial', adamage: 'Dano agravado', willpower: 'Força de vontade', inspiration: 'Inspiração' }[key]}`,
        r.max,
        'number',
        'required min="1" max="100" step="1"'
      )
    )
    .join(
      ''
    )}${field('hunger_warning', 'Alerta visual de fome a partir de', g.interface.hunger_warning, 'number', 'required min="0" max="100" step="1"')}</div></div><div class="config-group"><h3>Dados e recompensas</h3><div class="form-grid">${field('dice_sides', 'Faces dos dados', g.dice.sides, 'number', 'required min="2" max="100" step="1"')}${field('dice_threshold', 'Sucesso a partir de', g.dice.success_on, 'number', 'required min="1" max="100" step="1"')}${field('quest_xp', 'Máximo de XP por missão', g.quests.max_xp_reward, 'number', 'required min="0" max="1000000" step="1"')}${field('quest_money', 'Máximo em dinheiro por missão', g.quests.max_money_reward, 'number', 'required min="0" max="1000000000" step="1"')}</div></div><div class="config-save"><button type="submit" class="button primary">${icon('save')} Aplicar regras ao game-data</button></div></form></section><section class="panel power-config"><h2>Mecânicas das disciplinas</h2><p class="hint">Edite o Teste de Despertar e o teste de cada poder. Eles serão apresentados por ícones e marcadores.</p><form id="power-config-form" class="form-grid">${select(
    'discipline',
    'Disciplina',
    g.disciplines.map((d) => ({ value: d.id, label: d.name }))
  )}<label class="field"><span>Poder / nível</span><select name="level"></select></label>${select(
    'rouse',
    'Teste de Despertar',
    [
      { value: 'yes', label: 'Necessário' },
      { value: 'no', label: 'Não necessário' },
      { value: 'unknown', label: 'Não informado' }
    ]
  )}${field('test', 'Teste de habilidade (vazio = nenhum)', '', 'text', 'maxlength="300"')}${area('description', 'Descrição do poder', '', 'maxlength="30000"')}<button type="submit" class="button primary">Salvar mecânica do poder</button></form></section>`;
}
function noteDialog(ctx, n) {
  modal(
    n ? 'Editar anotação' : 'Uma nova página na crônica',
    `<div class="form-grid">${field('title', 'Título', n?.title || '', 'text', 'required maxlength="200"')}${select('visibility', 'Quem pode ler', [{ value: 'campaign', label: 'Toda a mesa' }, { value: 'private', label: 'Somente eu' }, ...(ctx.admin() ? [{ value: 'gm', label: 'Narradores' }] : [])], n?.visibility || 'campaign')}${area('content', 'Anotação', n?.content || '', 'maxlength="30000"')}${field('tags', 'Marcadores separados por vírgula', n?.tags || '', 'text', 'maxlength="500"')}</div>`,
    async (data) => {
      await api('/api/notes' + (n ? '/' + n.id : ''), {
        method: n ? 'PATCH' : 'POST',
        data: { ...Object.fromEntries(data), revision: n?._revision }
      });
      await ctx.refresh();
      toast('Anotação registrada no JSON da campanha.');
    },
    { wide: true }
  );
}
function questDialog(ctx, q) {
  if (!ctx.admin()) throw new Error('Somente o narrador cria missões.');
  const p = ctx.state.players;
  modal(
    q ? 'Editar missão' : 'O próximo capítulo',
    `<div class="form-grid">${field('title', 'Título da missão', q?.title || '', 'text', 'required maxlength="200"')}${field('category', 'Categoria', q?.category || 'História principal', 'text', 'maxlength="100"')}${area('description', 'Descrição, pistas e objetivos', q?.description || '', 'maxlength="30000"')}${field('difficulty', 'Dificuldade', q?.difficulty || 'Desconhecida', 'text', 'maxlength="100"')}${field('xp_reward', 'XP previsto por participante', q?.xp_reward || 0, 'number', `required min="0" max="${ctx.state.game.quests.max_xp_reward}" step="1"`)}${field('money_reward', 'Dinheiro previsto por participante', q?.money_reward || 0, 'number', 'required min="0" max="1000000000" step="0.01"')}${select(
      'status',
      'Estado',
      [
        { value: 'active', label: 'Em andamento' },
        { value: 'cancelled', label: 'Cancelada' }
      ],
      q?.status || 'active'
    )}<div class="field full"><span>Participantes</span><div class="checkbox-list">${
      p
        .filter((p) => !p.archived)
        .map(
          (p) =>
            `<label class="checkbox"><input name="assignees" type="checkbox" value="${p.id}" ${q?.assignees.includes(p.id) ? 'checked' : ''}> ${esc(p.char)}</label>`
        )
        .join('') || 'Cadastre uma ficha antes de criar uma missão.'
    }</div></div>${area('items', 'Itens de recompensa — nome | quantidade | descrição por linha', (q?.items || []).map((i) => `${i.name} | ${i.quantity} | ${i.description || ''}`).join('\n'), 'maxlength="5000"')}</div>`,
    async (data) => {
      const body = Object.fromEntries(data);
      body.xp_reward = Number(body.xp_reward);
      body.money_reward = Number(body.money_reward);
      body.assignees = data.getAll('assignees').map(Number);
      body.items = body.items
        .split('\n')
        .filter((s) => s.trim())
        .map((line) => {
          const [name, quantity, description] = line.split('|');
          return {
            name: name.trim(),
            quantity: Number(quantity?.trim() || 1),
            description: description?.trim() || ''
          };
        });
      body.revision = q?._revision;
      await api('/api/quests' + (q ? '/' + q.id : ''), {
        method: q ? 'PATCH' : 'POST',
        data: body
      });
      await ctx.refresh();
      toast('Missão registrada.');
    },
    { wide: true, saveLabel: q ? 'Salvar missão' : 'Criar missão' }
  );
}
export async function featureAction(action, data, ctx) {
  const { state, admin } = ctx;
  if (action === 'create-campaign' || action === 'edit-campaign') {
    const c = state.campaigns.find((c) => c.id === data.id);
    modal(
      c ? 'Configurar campanha' : 'Abra uma nova mesa',
      `<div class="form-grid">${field('title', 'Nome da campanha', c?.title || '', 'text', 'required maxlength="150"')}${area('description', 'Sobre a campanha', c?.description || '', 'maxlength="2000"')}${field('accent', 'Cor de toda a campanha', c?.accent || '#d92343', 'color')}<label class="field full"><span>Capa da campanha</span><input type="file" name="cover_file" accept="image/png,image/jpeg,image/webp"></label>${c?.cover ? `<img class="campaign-edit-cover" src="${esc(c.cover)}" alt="Capa atual"><label class="checkbox full"><input type="checkbox" name="remove_cover"> Remover capa atual</label>` : ''}${
        c
          ? select(
              'status',
              'Estado',
              [
                { value: 'active', label: 'Aberta' },
                { value: 'closed', label: 'Encerrada (somente leitura)' }
              ],
              c.status
            )
          : ''
      }</div>`,
      async (form) => {
        const data = Object.fromEntries(form);
        delete data.cover_file;
        delete data.remove_cover;
        if (form.has('remove_cover')) data.cover = '';
        if (form.get('cover_file')?.size)
          data.cover = (await readImage(form.get('cover_file'))).image;
        if (c) data.revision = c._revision;
        await api('/api/campaigns' + (c ? '/' + c.id : ''), {
          method: c ? 'PATCH' : 'POST',
          data
        });
        await ctx.refresh();
        toast(
          c ? 'Campanha atualizada.' : 'Nova campanha criada, com suas próprias fichas e regras.'
        );
      },
      { wide: true }
    );
    return true;
  }
  if (action === 'select-campaign') {
    await api(`/api/campaigns/${data.id}/select`, { method: 'POST' });
    await ctx.reloadCampaign();
    return true;
  }
  if (action === 'create-note' || action === 'edit-note') {
    noteDialog(
      ctx,
      state.notes.find((n) => n.id === data.id)
    );
    return true;
  }
  if (action === 'delete-note') {
    const n = state.notes.find((n) => n.id === data.id);
    modal(
      'Remover esta anotação?',
      `<p>${esc(n.title)}</p>`,
      async () => {
        await api('/api/notes/' + n.id, { method: 'DELETE', data: { revision: n._revision } });
        await ctx.refresh();
      },
      { saveLabel: 'Remover' }
    );
    return true;
  }
  if (action === 'create-quest' || action === 'edit-quest') {
    questDialog(
      ctx,
      state.quests.find((q) => q.id === data.id)
    );
    return true;
  }
  if (action === 'note-filter') {
    state.noteFilter = data.key;
    ctx.draw();
    return true;
  }
  if (action === 'delete-quest') {
    const q = state.quests.find((q) => q.id === data.id);
    modal(
      'Apagar esta missão?',
      `<p>${esc(q.title)}</p><p class="hint">A missão será removida. Recompensas já entregues continuam nas fichas.</p>`,
      async () => {
        await api('/api/quests/' + q.id, { method: 'DELETE', data: { revision: q._revision } });
        await ctx.refresh();
      },
      { saveLabel: 'Apagar missão' }
    );
    return true;
  }
  if (action === 'complete-quest') {
    const q = state.quests.find((q) => q.id === data.id),
      game = state.game;
    modal(
      'Defina a recompensa desta conquista.',
      `<div class="reward-delivery-intro"><span class="eyebrow">${esc(q.title)}</span><h3>O desfecho pertence à sua mesa.</h3><p>Altere a previsão se o roleplay mudou a recompensa. Os valores abaixo serão entregues a cada um dos ${q.assignees.length} participantes.</p></div><div class="form-grid">${field('xp_reward', 'XP final por participante', q.xp_reward, 'number', `required min="0" max="${game.quests.max_xp_reward}" step="1"`)}${field('money_reward', 'Dinheiro final por participante', q.money_reward, 'number', `required min="0" max="${game.quests.max_money_reward}" step="0.01"`)}${area('items', 'Itens finais — nome | quantidade | descrição por linha', q.items.map((i) => i.name + ' | ' + i.quantity + ' | ' + (i.description || '')).join('\n'), 'maxlength="5000"')}${area('completion_note', 'Como esta missão terminou?', q.completion_note || '', 'maxlength="5000"')}<label class="checkbox full"><input type="checkbox" required> Conferi os participantes e confirmo a recompensa final.</label></div>`,
      async (form) => {
        const items = String(form.get('items') || '')
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const [name, quantity, description] = line.split('|');
            return {
              name: name.trim(),
              quantity: Number(quantity?.trim() || 1),
              description: description?.trim() || ''
            };
          });
        await api('/api/quests/' + q.id + '/complete', {
          method: 'POST',
          data: {
            revision: q._revision,
            xp_reward: Number(form.get('xp_reward')),
            money_reward: Number(form.get('money_reward')),
            items,
            completion_note: form.get('completion_note')
          }
        });
        await ctx.refresh();
        toast('Conquista registrada. Recompensas entregues!');
      },
      { wide: true, saveLabel: 'Confirmar e entregar' }
    );
    return true;
  }
  return false;
}
export function bindFeatureViews(ctx) {
  const profile = $('#profile-form');
  if (profile)
    profile.onsubmit = async (event) => {
      event.preventDefault();
      await ctx.safe(async () => {
        const f = new FormData(profile),
          data = {
            display_name: f.get('display_name'),
            bio: f.get('bio'),
            preferences: {
              animations: f.has('animations')
            }
          };
        if (f.has('remove_avatar')) data.avatar = '';
        const file = f.get('avatar');
        if (file?.size) data.avatar = (await readImage(file)).image;
        stateAccount(ctx, await api('/api/profile', { method: 'PATCH', data }));
        await ctx.refresh();
        toast('Perfil atualizado.');
      });
    };
  const search = $('[data-note-search]');
  if (search)
    search.oninput = () =>
      document
        .querySelectorAll('[data-note-text]')
        .forEach((n) => (n.hidden = !n.dataset.noteText.includes(search.value.toLowerCase())));
  const config = $('#game-config-form');
  if (config)
    config.onsubmit = async (event) => {
      event.preventDefault();
      await ctx.safe(async () => {
        const f = new FormData(config),
          g = clone(ctx.state.game);
        g.interface.status_confirmation_seconds = Number(f.get('status_wait'));
        g.interface.hunger_warning = Number(f.get('hunger_warning'));
        g.progression.confirmation_seconds = Number(f.get('upgrade_wait'));
        for (const [key, r] of Object.entries(g.progression.categories)) {
          r.enabled = f.has('enabled:' + key);
          r.basis = f.get('basis:' + key);
          r.multiplier = Number(f.get('multiplier:' + key));
          r.allow_new = f.has('new:' + key);
          r.max_level = f.get('limit:' + key) ? Number(f.get('limit:' + key)) : null;
        }
        for (const key of Object.keys(g.status_rules))
          g.status_rules[key].max = Number(f.get('statusmax:' + key));
        g.dice.sides = Number(f.get('dice_sides'));
        g.dice.success_on = Number(f.get('dice_threshold'));
        g.quests.max_xp_reward = Number(f.get('quest_xp'));
        g.quests.max_money_reward = Number(f.get('quest_money'));
        await api('/api/game', { method: 'PUT', data: g });
        await ctx.refresh();
        toast('Regras atualizadas no game-data.');
      });
    };
  const power = $('#power-config-form');
  if (power) {
    const load = () => {
      const d = ctx.state.game.disciplines.find(
          (d) => d.id === Number(power.elements.discipline.value)
        ),
        l = d.nivels[Number(power.elements.level.value)];
      if (!l) return;
      power.elements.description.value = l.description;
      power.elements.rouse.value =
        l.mechanics.rouse_check === null ? 'unknown' : l.mechanics.rouse_check ? 'yes' : 'no';
      power.elements.test.value = l.mechanics.test || '';
    };
    power.elements.discipline.onchange = () => {
      const d = ctx.state.game.disciplines.find(
        (d) => d.id === Number(power.elements.discipline.value)
      );
      power.elements.level.innerHTML = d.nivels
        .map((l, i) => `<option value="${i}">${l.nivel} · ${esc(l.subname)}</option>`)
        .join('');
      load();
    };
    power.elements.level.onchange = load;
    power.elements.discipline.onchange();
    power.onsubmit = async (event) => {
      event.preventDefault();
      await ctx.safe(async () => {
        const g = clone(ctx.state.game),
          d = g.disciplines.find((d) => d.id === Number(power.elements.discipline.value)),
          l = d.nivels[Number(power.elements.level.value)];
        l.description = power.elements.description.value;
        l.mechanics = {
          rouse_check:
            power.elements.rouse.value === 'unknown' ? null : power.elements.rouse.value === 'yes',
          test: power.elements.test.value.trim() || null
        };
        await api('/api/game', { method: 'PUT', data: g });
        await ctx.refresh();
        toast('Mecânica do poder salva.');
      });
    };
  }
}
function stateAccount(ctx, account) {
  ctx.state.account = account;
  const s = session();
  saveSession({ ...s, account });
}
