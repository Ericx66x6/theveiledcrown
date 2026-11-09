import { isImageSource } from '../core/media-reference.js';
import {
  recapsPage,
  recapEditorPage,
  recapDetailPage,
  feedbackPage,
  documentsPage,
  documentDetailPage,
  chronicleAction,
  bindChronicle
} from './chronicle.js';
import {
  achievementsPage,
  achievementAction,
  bindAchievements,
  loadGallery
} from './achievements.js';
import { bloodBondsPage, bloodBondAction } from './blood-bonds.js';
import { NavigationTrail } from './navigation.js';
import { queueExperience, disposeExperience, animatePage } from './game-experience.js';
import { loyaltyPage, loyaltyAction } from './loyalty.js';
import { registrationsPage, registrationAction } from './registrations.js';
import { jsonDestinationError } from '../core/json-kind.js';
import { playerTestAction, playerTestBanner } from './player-test.js';
import { aspirationsPage, aspirationAction } from './aspirations.js';
import { portraitDialog, portraitStyle } from './portrait.js';
import {
  consultationPage,
  consultationAction,
  openConsultation,
  bindConsultation
} from './consultation.js';
import { intelPage, legaciesPage, commerceAction, bindCommerce } from './commerce.js';
import { configureSound, soundButton, renderSoundControls, playSound } from './audio.js';
import { applyCampaignTheme } from './campaign-theme.js';
import { searchAction } from './search.js';
import { powerAction } from './power-pool.js';
import { socialPage, communityAction, bindCommunity } from './community.js';
import { lifecycleAction } from './lifecycle.js';
import { xpDistribution } from './xp.js';
import { SheetEditor } from './editor.js';
import { CreationWizard } from './creation-wizard.js';
import { storageView, fileAction, exportPlayer, compactSyncLabel } from './files.js';
import {
  $,
  esc,
  crown,
  icon,
  button,
  dots,
  empty,
  date,
  field,
  area,
  select,
  toast,
  modal,
  closeModal,
  download
} from '../shared/ui.js';
import { api, session, saveSession, clearSession, isDemo, store } from './api.js';
import { labels, limits, newId } from '../shared/rules.js';
import {
  loadFeatureState,
  refreshViewCache,
  campaignHub,
  notesPage,
  questsPage,
  profilePage,
  ruleConfig,
  featureAction,
  bindFeatureViews
} from './features.js';
import { mapPage, networkPage, bindCanvas, canvasAction } from './canvas.js';
import { readImage, currency, animateMoney, diceSound } from './media.js';
import {
  traitsPage,
  evolutionPage,
  openEvolution,
  evolutionAction,
  bindEvolution,
  disposeEvolution
} from './evolution.js';
import {
  narratorDashboard,
  myCharactersView,
  submissionsView,
  reviewSubmissionView,
  notificationsView,
  trashView,
  administrationAction
} from './administration.js';
import { rulebookPage, rulebookAction, bindRulebook } from './rulebook.js';
const stats = ['atributes', 'talents', 'expertises', 'knowledges', 'precedents'];
const worldTypes = {
  domains: {
    label: 'Domínios',
    singular: 'domínio',
    icon: 'world',
    description: 'Territórios, refúgios e lugares onde a sua influência alcança.',
    fields: [
      ['type', 'Tipo'],
      ['location', 'Localização'],
      ['status', 'Situação']
    ]
  },
  allies: {
    label: 'Aliados',
    singular: 'aliado',
    icon: 'characters',
    description: 'Pessoas em quem você confia. Favores raramente são gratuitos.',
    fields: [
      ['role', 'Ocupação'],
      ['faction', 'Facção'],
      ['status', 'Relação']
    ]
  },
  contacts: {
    label: 'Contatos',
    singular: 'contato',
    icon: 'chronicle',
    description: 'Informação é poder. Saiba a quem recorrer quando a noite apertar.',
    fields: [
      ['sphere', 'Área de influência'],
      ['location', 'Localização'],
      ['contact', 'Como encontrar']
    ]
  },
  retainers: {
    label: 'Lacaios',
    singular: 'lacaio',
    icon: 'accounts',
    description: 'Aqueles que servem ao seu domínio e conhecem parte dos seus segredos.',
    fields: [
      ['role', 'Função'],
      ['nature', 'Natureza'],
      ['status', 'Lealdade']
    ]
  }
};
worldTypes.favours = {
  label: 'Favores',
  singular: 'favor',
  icon: 'favour',
  description: 'Promessas que você carrega. Dívidas que a noite ainda vai cobrar.',
  fields: [
    ['direction', 'Devo / tenho a receber'],
    ['person', 'Com quem'],
    ['status', 'Situação'],
    ['type', 'Importância']
  ]
};
const nav = [
  ['overview', 'Visão geral'],
  ['aspirations', 'Ambição e desejo'],
  ['attributes', 'Atributos e habilidades'],
  ['powers', 'Sangue e poderes'],
  ['blood-bonds', 'Laços de sangue'],
  ['world', 'Influência e favores'],
  ['possessions', 'Inventário e dinheiro'],
  ['notes', 'Anotações'],
  ['recaps', 'Onde paramos?'],
  ['documents', 'Documentos da crônica'],
  ['feedbacks', 'Voz da mesa'],
  ['quests', 'Missões'],
  ['map', 'Mapa da campanha'],
  ['social', 'Salão da campanha'],
  ['intel', 'Ecos do Véu'],
  ['legacies', 'Legados do Sangue'],
  ['network', 'Círculos de relações'],
  ['chronicle', 'Histórico da ficha'],
  ['dice', 'Rolagem de dados']
];
const sharedNav = [
  ['achievements', 'Galeria da eternidade'],
  ['campaigns', 'Minhas campanhas'],
  ['my-characters', 'Meus personagens'],
  ['profile', 'Meu perfil'],
  ['notifications', 'Notificações'],
  ['submissions', 'Propostas de personagens'],
  ['rewards', 'Presença na crônica']
];
const adminNav = [
  ['dashboard', 'Conselho do narrador'],
  ['characters', 'Personagens'],
  ['new-player', 'Cadastrar ficha'],
  ['submissions', 'Avaliar fichas'],
  ['accounts', 'Jogadores e acesso'],
  ['registrations', 'Avaliar cadastros'],
  ['rules', 'Livro de regras'],
  ['storage', 'Arquivos e backups'],
  ['trash', 'Lixeira']
];
const internalNav = [
  ['recap-write', 'Escrever onde parei'],
  ['recap-detail', 'Memória do personagem'],
  ['document-detail', 'Documento da crônica'],
  ['evolution', 'Evoluir personagem'],
  ['power-detail', 'Consultar poder'],
  ['proposal-editor', 'Criar proposta'],
  ['review-submission', 'Avaliar proposta']
];
const sheetViews = [
  'blood-bonds',
  'overview',
  'aspirations',
  'attributes',
  'powers',
  'world',
  'possessions',
  'chronicle',
  'dice',
  'evolution',
  'network'
];
const state = {
  account: null,
  game: null,
  players: [],
  player: null,
  accounts: [],
  view: 'campaigns',
  world: 'domains',
  query: '',
  archived: false,
  rolls: [],
  editor: null,
  storageMarkup: ''
};
let busy = false,
  pendingStatus = null,
  statusTimer,
  confirmationTimer;
const displayedStatus = () => pendingStatus?.next || player()?.status;
function clearPending(redraw = false) {
  clearTimeout(statusTimer);
  pendingStatus = null;
  delete document.body.dataset.pendingStatus;
  if (redraw) render();
}

const admin = () => state.account?.role === 'admin';
const player = () => state.player;
const value = (key, id) =>
  player()?.[key]?.find((x) => x.id === id)?.[key === 'disciplines' ? 'nivel' : 'value'] || 0;
const sectionHead = (title, description, action = '') =>
  `<div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`;
function renderNavigation() {
  const p = player(),
    campaignViews = [
      ...nav.filter(([k]) => !sheetViews.includes(k)),
      ['rewards', admin() ? 'Recompensas de login' : 'Presença na crônica']
    ];
  const personal = !state.campaigns?.length
    ? []
    : admin()
      ? [
          ['dashboard', 'Conselho do narrador'],
          ['achievements', 'Galeria dos jogadores']
        ]
      : [
          ['my-characters', 'Meus personagens'],
          ['achievements', 'Galeria da eternidade'],
          ['submissions', 'Minhas propostas']
        ];
  const navButtons = (items) =>
    items
      .map(
        ([key, label]) =>
          `<button type="button" data-view="${key}">${icon(key === 'rewards' ? 'blood' : key === 'registrations' ? 'accounts' : key === 'my-characters' ? 'characters' : key === 'submissions' ? 'notes' : key === 'campaigns' ? 'world' : key === 'dashboard' ? 'accounts' : key === 'notifications' ? 'notes' : key)}<span>${label}${key === 'registrations' && state.registrations?.some((a) => a.registration.status === 'pending') ? ' · ' + state.registrations.filter((a) => a.registration.status === 'pending').length : ''}</span></button>`
      )
      .join('');
  $('[data-nav-root]').innerHTML =
    `<nav class="portal-navigation" aria-label="Portal">${navButtons([...personal, ['campaigns', 'Minhas campanhas']])}</nav>${admin() ? `<div class="narrator-test-control">${button(icon('dice') + ' Testar como jogador', 'player-test-start', '', 'button ghost')}</div>` : ''}${admin() && !p ? '<div class="narrator-sidebar-note">Abra uma ficha em Personagens para consultar os dados do jogador.</div>' : `<div class="sidebar-caption">${admin() ? 'FICHA DE JOGADOR ABERTA' : 'SEU PERSONAGEM'}</div><div class="character-select"><select id="character-select" aria-label="Selecionar personagem"></select>${admin() ? button('Fechar ficha', 'close-character', '', 'text-button') : ''}</div>`}${p ? `<div class="sidebar-caption">FICHA DE ${esc(p.char)}</div><nav aria-label="Ficha do personagem">${navButtons(nav.filter(([k]) => sheetViews.includes(k) && (k !== 'network' || !admin())))}</nav>` : ''}${state.campaigns?.length ? `<div class="sidebar-caption">A CAMPANHA</div><nav aria-label="Ferramentas da campanha">${navButtons(campaignViews)}</nav>` : ''}${admin() ? `<div class="sidebar-caption admin-caption">ADMINISTRAÇÃO</div><nav aria-label="Administração">${navButtons(adminNav.filter(([k]) => k !== 'dashboard' && (state.campaigns?.length || ['storage', 'trash', 'registrations'].includes(k))))}</nav>` : ''}`;
  updateSelect();
  const select = $('#character-select');
  if (session()?.player_test)
    $('[data-nav-root]').insertAdjacentHTML(
      'afterbegin',
      `<div class="narrator-test-control">${button('Voltar ao narrador', 'player-test-end', '', 'button ghost')}</div>`
    );
  if (select)
    select.onchange = (event) =>
      run(async () => {
        clearPending();
        if (!event.target.value) {
          state.player = null;
          await go(admin() ? 'dashboard' : 'my-characters');
          return;
        }
        await loadPlayer(Number(event.target.value));
        await go('overview');
      });
  const bottom = admin()
    ? p
      ? [
          ['overview', 'Ficha'],
          ['characters', 'Personagens'],
          ['map', 'Mapas'],
          ['submissions', 'Avaliar']
        ]
      : [
          ['dashboard', 'Conselho'],
          ['characters', 'Personagens'],
          ['submissions', 'Avaliar'],
          ['map', 'Mapas']
        ]
    : [
        ['overview', 'Ficha'],
        ['quests', 'Missões'],
        ['map', 'Mapas'],
        ['notes', 'Notas']
      ];
  $('.mobile-bottom').innerHTML =
    bottom
      .map(
        ([v, l]) =>
          `<button type="button" data-view="${v}">${icon(v === 'dashboard' ? 'accounts' : v === 'submissions' ? 'notes' : v)}<span>${l}</span></button>`
      )
      .join('') +
    `<button type="button" data-action="menu">${icon('menu')}<span>Mais</span></button>`;
}
function initShell() {
  document.body.classList.remove('login-page');
  document.querySelector('.skip-link')?.setAttribute('href', '#main-content');
  $('#app').innerHTML =
    `<aside id="sidebar" class="sidebar"><a href="#campaigns" class="brand"><span class="brand-crest">${crown}</span><span>A COROA VELADA<small>ONDE AS HISTÓRIAS VIVEM</small></span></a><button type="button" data-action="close-menu" class="icon-button drawer-close" aria-label="Fechar navegação">${icon('close')}</button><div data-nav-root></div><div class="sidebar-footer"><p>O sangue lembra.<br><span>A noite nunca esquece.</span></p><span class="version">PORTAL ONLINE · V10.1 OFICIAL</span></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><button data-action="menu" class="icon-button mobile-menu" aria-label="Abrir navegação">${icon('menu')}</button><span class="campaign-breadcrumb"></span><i>/</i><strong id="breadcrumb-current"></strong></div><div class="topbar-right">${button(icon('search'), 'global-search', 'aria-label="Pesquisar em toda a campanha" title="Pesquisar"', 'icon-button')}${soundButton()}${button(icon('download') + ' <span>Salvar JSON</span>', 'backup-table', 'aria-label="Salvar JSONs do portal"', 'button ghost top-export')}<button type="button" class="icon-button notification-button" data-action="nav-notifications" aria-label="Notificações">${icon('notes')}<span data-notification-count hidden></span></button><button type="button" class="user-button" data-action="nav-profile" aria-label="Abrir meu perfil" title="Meu perfil"><span class="avatar small" data-user-avatar></span><span data-user-name></span></button><button class="icon-button" data-action="logout" aria-label="Sair">${icon('logout')}</button></div></header><div class="connection-banner"><span>${icon('save')} <span data-sync-label></span></span><span>Atualização automática da campanha</span></div><div class="route-toolbar" aria-label="Navegação da página"><button type="button" class="button ghost" data-action="route-back"><span class="back-arrow">${icon('arrow')}</span> Voltar</button><span data-route-label></span><button type="button" class="text-button" data-action="route-home">Início</button></div><div id="xp-hud"></div><main id="main-content" tabindex="-1"></main><footer class="app-footer"><span>A COROA VELADA</span><span>Suas histórias, além do véu.</span><span>◇</span></footer></div><button type="button" class="drawer-backdrop" data-action="close-menu" aria-label="Fechar menu"></button><nav class="mobile-bottom" aria-label="Navegação principal"></nav>`;
  document.addEventListener('click', handleClick, { signal: events.signal });
  document.querySelector('.route-toolbar').insertAdjacentHTML('beforebegin', playerTestBanner());
  document.addEventListener('submit', handleSubmit, { signal: events.signal });
  document.addEventListener(
    'change',
    (e) => {
      if (e.target.closest('#dice-form')) captureDice(e.target.closest('form'));
    },
    { signal: events.signal }
  );
  document.addEventListener(
    'input',
    (event) => {
      const form = event.target.closest('form');
      if (form) form.dataset.dirty = 'true';
      if (form?.id === 'dice-form') captureDice(form);
    },
    { signal: events.signal }
  );
}
let events = new AbortController();
function updateSelect() {
  const control = $('#character-select');
  if (!control) return;
  control.innerHTML =
    `<option value="">${admin() ? 'Selecione uma ficha de jogador' : 'Escolha um personagem'}</option>` +
    state.players
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === player()?.id ? 'selected' : ''}>${esc(p.char)}${p.archived ? ' · arquivado' : ''}</option>`
      )
      .join('');
}
async function loadPlayers() {
  state.players = await api(`/api/characters${admin() && state.archived ? '?archived=1' : ''}`);
}
async function loadPlayer(id) {
  state.player = await api(`/api/characters/${id}`);
  if (!admin()) state.campaign.network = await api('/api/network?character_id=' + id);
  updateSelect();
}
async function run(task) {
  try {
    await task();
  } catch (error) {
    if (error.code !== 'PLAYER_TEST_CONTEXT_CHANGED') toast(error.message, true);
  }
}
async function mutate(path, data, method = 'POST') {
  if (busy) throw new Error('Aguarde o salvamento em andamento.');
  busy = true;
  document.body.classList.add('saving');
  try {
    const result = await api(path, { method, data });
    if (result?.id === player()?.id && result?.status && typeof result.status === 'object')
      state.player = result;
    try {
      await loadFeatureState(state, { silent: true });
    } catch {
      toast('A alteração foi salva. A lista de personagens não pôde ser atualizada agora.', true);
    }
    updateSelect();
    render();
    toast('Alteração salva na campanha.');
    return result;
  } finally {
    busy = false;
    document.body.classList.remove('saving');
  }
}
const patch = (data, revision = player()._revision, logMessage = '') =>
  mutate(
    `/api/characters/${player().id}`,
    {
      revision,
      patch: data,
      log_message: logMessage || (admin() ? $('#dialog-form [name=log_message]')?.value : '') || ''
    },
    'PATCH'
  );
function context() {
  return {
    state,
    admin,
    player,
    recordCard,
    refresh: refreshAll,
    safe: run,
    restartPortal,
    go,
    back: async (fallback) => {
      if (trail.canBack) history.back();
      else await go(fallback || 'campaigns');
    },
    reloadCampaign,
    draw: render,
    editProposal
  };
}
async function refreshAll({ silent = false } = {}) {
  const mapVersion = state.campaign?.maps?.map((m) => m.id + ':' + m._revision).join('|');
  const knownNotifications = new Set((state.notifications || []).map((n) => n.id));
  await loadFeatureState(state, { silent });
  if (state.view === 'achievements') await loadGallery(context(), { silent });
  queueExperience(context());
  if (
    silent &&
    state.notifications.some(
      (n) => !knownNotifications.has(n.id) && !n.read_by.includes(state.account.id)
    )
  )
    playSound('notify');
  if (
    silent &&
    state.view === 'map' &&
    mapVersion === state.campaign?.maps?.map((m) => m.id + ':' + m._revision).join('|')
  ) {
    const counter = $('[data-notification-count]');
    const count = state.notifications.filter((n) => !n.read_by.includes(state.account.id)).length;
    counter.textContent = count;
    counter.hidden = !count;
    return;
  }
  if (state.view === 'storage') state.storageMarkup = await storageView();
  if (state.view === 'trash') state.trash = await api('/api/admin/trash', { silent });
  updateSelect();
  render();
}
async function reloadCampaign() {
  clearPending();
  state.recapDraft = null;
  state.recapId = null;
  state.documentId = null;
  state.recapCharacter = '';
  state.galleryAccountId = null;
  state.openGallery = null;
  state.player = null;
  state.editor = null;
  state.archived = false;
  await refreshAll();
  await go(
    !state.campaigns.length
      ? 'campaigns'
      : admin()
        ? 'dashboard'
        : player()
          ? 'overview'
          : 'my-characters'
  );
  registerPresence();
}
let presenceFlight;
function registerPresence() {
  const r = state.rewards;
  if (admin() || !r?.enabled || document.hidden) return;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: r.time_zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const part = (key) => parts.find((p) => p.type === key).value;
  const day = part('year') + '-' + part('month') + '-' + part('day');
  if (r.checked_today && r.today === day) return;
  const scope = state.account.id + ':' + state.campaign.id,
    signal = events.signal;
  if (presenceFlight?.scope === scope) return presenceFlight.promise;
  const flight = { scope };
  presenceFlight = flight;
  flight.promise = api('/api/rewards/check-in', { method: 'POST', data: {}, silent: true })
    .then((rewards) => {
      if (signal.aborted || state.account.id + ':' + state.campaign.id !== scope) return;
      state.rewards = rewards;
      queueExperience(context());
      if (
        ['rewards', 'my-characters'].includes(state.view) &&
        !state.editor &&
        !document.querySelector('#modal[open]') &&
        !document.activeElement?.matches('input,textarea,select')
      )
        render();
    })
    .catch(() => {})
    .finally(() => {
      if (presenceFlight === flight) presenceFlight = null;
    });
  return flight.promise;
}
function render() {
  refreshViewCache(state);
  if (
    !state.campaigns?.length &&
    ![
      'campaigns',
      'profile',
      'storage',
      'trash',
      'notifications',
      'registrations',
      'achievements'
    ].includes(state.view)
  )
    state.view = 'campaigns';
  if (admin() && state.view === 'network') state.view = 'dashboard';
  const allowed = [...sharedNav, ...nav, ...internalNav, ...(admin() ? adminNav : [])];
  if (admin() && !player() && sheetViews.includes(state.view)) state.view = 'dashboard';
  if (!admin() && !player() && sheetViews.includes(state.view)) state.view = 'my-characters';
  if (!admin() && adminNav.some(([k]) => k === state.view) && state.view !== 'submissions')
    state.view = 'my-characters';
  renderNavigation();
  if (!allowed.some(([k]) => k === state.view)) state.view = 'campaigns';
  $('#breadcrumb-current').textContent =
    allowed.find(([k]) => k === state.view)?.[1] || 'Campanhas';
  $('.campaign-breadcrumb').textContent = state.campaign?.title || 'O portal';
  $('[data-user-avatar]').innerHTML = state.account.avatar
    ? `<img src="${esc(state.account.avatar)}" alt="">`
    : esc(state.account.display_name.slice(0, 1));
  $('[data-user-name]').innerHTML =
    `${esc(state.account.display_name)}<small>${admin() ? 'Narrador' : 'Jogador'}</small>`;
  document.body.dataset.page = state.view;
  applyCampaignTheme(state.campaign);
  configureSound(state.account.preferences || {}, async (preferences) => {
    const account = await api('/api/profile', {
      method: 'PATCH',
      data: { preferences },
      silent: true
    });
    state.account = account;
    saveSession({ ...session(), account });
  });
  renderSoundControls();
  $('#xp-hud').innerHTML =
    !admin() &&
    player() &&
    !['proposal-editor', 'review-submission', 'new-player'].includes(state.view)
      ? `<div class="xp-hud"><span>${icon('powers')}<span>SEU XP DISPONÍVEL<small>${esc(player().char)}</small></span></span><strong>${player().xp}<small>XP</small></strong>${button('Evoluir ' + icon('arrow'), 'nav-attributes', '', 'button ghost')}</div>`
      : '';
  document.body.classList.toggle(
    'reduce-effects',
    state.account.preferences?.animations === false || state.game.interface.animations === false
  );
  document.querySelectorAll('[data-view]').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === state.view);
    if (el.dataset.view === state.view) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  closeMenu();
  const unread = (state.notifications || []).filter(
    (n) => !n.read_by.includes(state.account.id)
  ).length;
  const counter = $('[data-notification-count]');
  counter.textContent = unread;
  counter.hidden = !unread;
  document
    .querySelectorAll('[data-sync-label]')
    .forEach((el) => (el.textContent = compactSyncLabel()));
  const ctx = context(),
    featureViews = {
      recaps: recapsPage,
      'recap-write': recapEditorPage,
      'recap-detail': recapDetailPage,
      feedbacks: feedbackPage,
      documents: documentsPage,
      'document-detail': documentDetailPage,
      achievements: achievementsPage,
      'blood-bonds': bloodBondsPage,
      campaigns: campaignHub,
      rewards: loyaltyPage,
      registrations: registrationsPage,
      social: socialPage,
      intel: intelPage,
      legacies: legaciesPage,
      notes: notesPage,
      quests: questsPage,
      profile: profilePage,
      map: mapPage,
      network: networkPage,
      attributes: traitsPage,
      evolution: evolutionPage,
      aspirations: aspirationsPage,
      'power-detail': consultationPage,
      dashboard: narratorDashboard,
      'my-characters': myCharactersView,
      submissions: submissionsView,
      'review-submission': reviewSubmissionView,
      notifications: notificationsView,
      trash: trashView
    };
  const headings = {
    attributes: ['Traços de uma existência.', 'Cada habilidade conta um capítulo da sua história.'],
    powers: ['O poder corre no sangue.', 'Disciplinas, rituais e os dons que o tornam único.'],
    world: ['O preço da influência.', 'Domínios, relações e favores que a noite ainda vai cobrar.'],
    possessions: ['O que a noite lhe deu.', 'Seu inventário e cada moeda da sua jornada.'],
    chronicle: [
      'Os rastros da sua história.',
      'Cada mudança fica registrada. Somente o narrador pode apagar o histórico.'
    ],
    dice: ['Deixe o destino falar.', 'Sua próxima decisão está a uma rolagem de distância.'],
    characters: ['Os nomes da crônica.', 'Conduza as histórias daqueles que atravessaram o véu.'],
    accounts: [
      'Quem atravessa o véu.',
      'Crie acessos e vincule cada jogador às fichas desta mesa.'
    ],
    rules: [
      'As regras da sua mesa.',
      'Personalize os custos, os limites e os poderes do seu universo.'
    ]
  };
  let html = '';
  if (featureViews[state.view]) html = featureViews[state.view](ctx);
  else if (state.view === 'new-player' || state.view === 'proposal-editor')
    html = state.editor?.render() || empty('Abrindo o cadastro…', '');
  else if (state.view === 'storage') html = state.storageMarkup;
  else if (state.view === 'overview')
    html = player()
      ? overview()
      : empty(
          'Sua história ainda não começou.',
          'Peça ao narrador para vincular uma ficha ao seu login.',
          admin() ? button('Cadastrar jogador', 'create-character', '', 'button primary') : ''
        );
  else if (state.view === 'rules') html = rulebookPage(ctx);
  else {
    const [title, description] = headings[state.view];
    html = `<div class="page-intro"><span class="eyebrow">${adminNav.some(([k]) => k === state.view) ? 'CONSELHO DO NARRADOR' : 'A SUA CRÔNICA'}</span><h1>${title}</h1><p>${description}</p></div>`;
    const views = {
      attributes,
      powers,
      world,
      possessions,
      chronicle,
      dice,
      characters: characterList,
      accounts: accountsView,
      rules: rulesView
    };
    html +=
      !player() && !adminNav.some(([k]) => k === state.view)
        ? empty('Nenhum personagem selecionado.', 'Selecione uma ficha para continuar.')
        : views[state.view]();
  }
  $('#main-content').innerHTML = html.replace(
    /<img\b(?![^>]*\bloading=)/g,
    '<img loading="lazy" decoding="async"'
  );
  queueExperience(context());
  if (state.view === 'characters') bindSearch();
  if (state.view === 'new-player' || state.view === 'proposal-editor') state.editor?.bind();
  if (state.view === 'power-detail') bindConsultation();
  if (state.view === 'dice' && state.diceDraft?.character === player()?.id) {
    const form = $('#dice-form');
    for (const [name, value] of Object.entries(state.diceDraft.fields)) {
      const el = form?.elements[name];
      if (el) {
        if (el.type === 'checkbox') el.checked = !!value;
        else el.value = value;
      }
    }
  }
  bindEvolution(ctx);
  bindRulebook(ctx);
  bindFeatureViews(ctx);
  bindChronicle(ctx);
  bindAchievements(ctx);
  bindCommunity(ctx);
  bindCommerce(ctx);
  bindCanvas(ctx);
  document.title = `${state.campaign?.title || 'Portal'} · A Coroa Velada`;
  if (!navigating && trail.current) trail.update(routePoint());
  updateRouteControls();
}
function overview() {
  const p = player();
  const experience = admin()
    ? `<span class="metric-label">RECOMPENSAS DA MESA</span>${button('Distribuir XP ' + icon('arrow'), 'distribute-xp', '', 'button primary')}<p class="hint">Escolha vários personagens e conceda a recompensa de uma vez.</p>`
    : `<span class="metric-label">Experiência disponível</span><strong>${p.xp}<small>XP</small></strong>${button('Evoluir traços ' + icon('arrow'), 'nav-attributes', '', 'text-button')}`;
  return `<div class="welcome-row"><span class="eyebrow">O LIVRO DA NOITE · FICHA #${p.id}</span><span class="save-state">${icon('save')} ${p.updated_at ? 'Salvo em ' + date(p.updated_at) : 'Ficha carregada'} ${button(icon('refresh'), 'refresh', 'aria-label="Atualizar ficha"', 'icon-button')}</span></div><section class="character-hero"><div class="hero-lines" aria-hidden="true"></div><div class="character-avatar" data-action="view-portrait" role="button" tabindex="0" aria-label="Ver retrato ampliado">${isImageSource(p.profilepicture) ? `<img loading="eager" decoding="async" fetchpriority="high" src="${esc(p.profilepicture)}" alt="Retrato de ${esc(p.char)}" style="${portraitStyle(p)}" loading="lazy" referrerpolicy="no-referrer">` : `<span>${esc(p.char.slice(0, 1))}</span>`}<span class="portrait-caption">RETRATO DO PERSONAGEM</span><span class="avatar-diamond">◇</span></div><div class="character-identity"><div class="hero-tags"><span class="tag red">${esc(p.cla)}</span><span class="tag">${p.generation}ª GERAÇÃO</span>${p.archived ? '<span class="tag red">ARQUIVADO</span>' : ''}</div><h1>${esc(p.char)}</h1><p>Interpretado por <strong>${esc(p.player)}</strong></p></div><div class="hero-emblem" aria-hidden="true">${crown}</div><div class="hero-actions">${button(icon('edit') + ' Retrato', 'portrait', '', 'button ghost')}${button(icon('download') + ' Salvar JSON', 'export', '', 'button ghost')}${admin() ? button(icon('edit') + ' Editar ficha', 'identity', '', 'button ghost') : ''}</div></section><div class="overview-grid"><section class="panel vitae-panel"><div class="panel-heading"><span class="eyebrow">A ESSÊNCIA DO PERSONAGEM</span><span class="tiny-diamond">◇</span></div><div class="vitae-numbers"><div>${experience}</div><div><span class="metric-label">Potência do sangue</span><strong>${p.bloodpotency}<small>NÍVEL</small></strong>${dots(p.bloodpotency, 10)}</div></div><div class="panel-bottom">A experiência molda o monstro. O sangue revela seu poder.</div></section><section class="panel ambition-panel"><span class="eyebrow">SEU CADERNO DA CRÔNICA</span><h2>As pistas ficam. As histórias continuam.</h2><p>Anotações pessoais e compartilhadas, reunidas em um único lugar.</p>${button('Abrir anotações ' + icon('arrow'), 'nav-notes', '', 'text-button')}${button('Ambição e desejo ' + icon('arrow'), 'nav-aspirations', '', 'button ghost')}</section></div>${sectionHead('Entre a humanidade e a besta', 'Ajuste os recursos. A confirmação aparece após uma breve pausa.')}${pendingStatus ? `<div class="pending-status" role="status">${icon('clock')} Prévia de alteração · aguardando confirmação ${button('Desfazer', 'cancel-status', '', 'button ghost compact')}</div>` : ''}<div class="status-grid">${Object.entries(
    state.game.status_rules
  )
    .map(([key, rule]) => {
      const max = rule.max;
      return `<section class="status-card ${key === 'hunger' ? 'hunger' : ''} ${key === 'hunger' && displayedStatus()[key] >= state.game.interface.hunger_warning ? 'ravenous' : ''} ${pendingStatus && displayedStatus()[key] !== p.status[key] ? 'pending' : ''}"><div class="status-card-top"><span>${esc(state.game.labels?.[key] || labels[key])}</span><span class="status-symbol">${key === 'hunger' ? '◈' : key === 'humanity' ? '◇' : '✧'}</span></div><div class="status-value"><strong>${displayedStatus()[key]}</strong><span>/ ${max}</span></div><div class="status-track" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < displayedStatus()[key] ? 'filled' : ''}"></i>`).join('')}</div><div class="status-controls">${button('−', 'status', `data-key="${key}" data-delta="-1" aria-label="Diminuir ${esc(state.game.labels?.[key] || labels[key])}" ${displayedStatus()[key] <= rule.min || p.archived ? 'disabled' : ''}`, 'step-button')}<span>${key.includes('damage') ? 'Marcas de dano' : 'Controle de recurso'}</span>${button('+', 'status', `data-key="${key}" data-delta="1" aria-label="Aumentar ${esc(state.game.labels?.[key] || labels[key])}" ${displayedStatus()[key] >= max || p.archived ? 'disabled' : ''}`, 'step-button')}</div></section>`;
    })
    .join(
      ''
    )}</div><div class="overview-bottom"><section class="panel biography">${sectionHead('Sob o véu', 'A história por trás do nome.', button(icon('edit'), 'bio', 'aria-label="Editar história"', 'icon-button'))}<p class="prose">${esc(p.biography || 'Ainda há páginas em branco nesta história. Registre aqui a origem, os vínculos e os segredos do personagem.')}</p></section><section class="panel network-summary">${sectionHead('Sua influência', 'Os fios que sustentam o seu poder.')}<div class="network-tiles">${Object.entries(
    worldTypes
  )
    .map(
      ([key, w]) =>
        `<button data-action="open-world" data-key="${key}">${icon(w.icon)}<strong>${p[key]?.length || 0}</strong><span>${w.label}</span>${icon('arrow')}</button>`
    )
    .join('')}</div></section></div>`;
}
function attributes() {
  return traitsPage(context());
}
function powers() {
  const p = player(),
    bp = state.game.bloodpotency.find((x) => x.nivel === p.bloodpotency) || {};
  return `<section class="panel blood-panel"><div><span class="eyebrow">O LEGADO DA SUA LINHAGEM</span><h2>Potência do sangue <span class="gold">${p.bloodpotency}</span></h2><p>${esc(state.game.bloodpotency[0]?.description)}</p>${button((admin() ? 'Ajustar potência ' : 'Evoluir potência ') + icon('arrow'), 'trait', 'data-key="bloodpotency"', 'button ghost')}</div><div class="blood-facts">${[
    ['Surto de sangue', bp.bloodsurge],
    ['Cura superficial', bp.sheal],
    ['Cura agravada', bp.aheal],
    ['Dados de fome', bp.hungerdices]
  ]
    .map(([label, v]) => `<div><span>${label}</span><strong>${v ?? '—'}</strong></div>`)
    .join('')}<p>Sangue consumível: ${esc(bp.consumablebloods || '—')}</p></div></section>${[
    'disciplines',
    'rituals',
    'caracteristics'
  ]
    .map(
      (key) =>
        sectionHead(
          labels[key],
          key === 'disciplines'
            ? 'Os dons que fazem a noite se curvar.'
            : key === 'rituals'
              ? 'O oculto tem suas próprias regras.'
              : 'Marcas que tornam sua história única.',
          admin()
            ? button(icon('plus') + ' Conceder', 'grant', `data-key="${key}"`, 'button ghost')
            : key === 'disciplines'
              ? button(icon('blood') + ' Legados do Sangue', 'nav-legacies', '', 'button ghost')
              : ''
        ) +
        `<div class="card-grid">${
          p[key].length
            ? p[key]
                .map((entry) => {
                  const d = state.game[key].find((x) => x.id === entry.id);
                  return d
                    ? `<button class="lore-card" data-action="lore" data-key="${key}" data-id="${d.id}"><span class="eyebrow">${key === 'disciplines' ? 'DISCIPLINA' : key === 'rituals' ? 'RITUAL · NÍVEL ' + d.nivel : esc(d.type)}</span><h3>${esc(d.name)}</h3><p>${esc(d.short_description || d.description)}</p><div class="lore-card-bottom">${key === 'disciplines' ? dots(entry.nivel, state.game.maxvalue_generation[p.generation]) : dots(d.value || d.nivel || 1)}<span>Consultar ${icon('arrow')}</span></div></button>`
                    : '';
                })
                .join('')
            : empty(
                'Nenhum registro concedido.',
                'O narrador pode adicionar estes traços à sua ficha.'
              )
        }</div>`
    )
    .join('')}`;
}
function world() {
  const key = state.world,
    w = worldTypes[key];
  return `<div class="tabs" role="tablist" aria-label="Relações e territórios">${Object.entries(
    worldTypes
  )
    .map(
      ([k, v]) =>
        `<button role="tab" aria-selected="${k === key}" class="${k === key ? 'active' : ''}" data-action="world-tab" data-key="${k}">${icon(v.icon)} ${v.label}<span>${player()[k]?.length || 0}</span></button>`
    )
    .join(
      ''
    )}</div>${sectionHead(w.label, w.description, button(icon('plus') + ' Adicionar ' + w.singular, 'edit-record', `data-key="${key}"`, 'button primary'))}<div class="card-grid">${
    player()[key]?.length
      ? player()
          [key].map((row) => recordCard(key, row))
          .join('')
      : empty(
          `Nenhum ${w.singular} registrado.`,
          w.description,
          button('Criar primeiro registro', 'edit-record', `data-key="${key}"`, 'button ghost')
        )
  }</div><p class="hint">Os registros detalham sua história. Os pontos de Antecedentes continuam sendo controlados pelo narrador.</p>`;
}
function recordCard(key, row) {
  const fields = worldTypes[key]?.fields || [];
  return `<article class="record-card">${row.image ? `<img class="record-photo" src="${esc(row.image)}" alt="${esc(row.name || 'Imagem')}" loading="lazy">` : ''}<div class="record-top"><span class="record-icon">${icon(worldTypes[key]?.icon || 'chronicle')}</span>${button(icon('edit'), 'edit-record', `data-key="${key}" data-record="${esc(row.id)}" aria-label="Editar ${esc(row.name || row.description)}"`, 'icon-button')}</div><h3>${esc(row.name || row.description)}</h3>${row.rating !== undefined ? dots(row.rating) : ''}<div class="record-meta">${fields
    .filter(([k]) => row[k])
    .map(([k, label]) => `<div><span>${label}</span><strong>${esc(row[k])}</strong></div>`)
    .join(
      ''
    )}</div><p class="prose">${esc(row.description)}</p>${key === 'items' ? `<span class="tag">QUANTIDADE ${row.quantity ?? 1}</span>` : ''}<div class="record-footer"><span>${key === 'notes' ? esc((row.date || '') + ' ' + (row.time || '')) : worldTypes[key]?.label || 'Inventário'}</span>${button('Remover', 'remove-record', `data-key="${key}" data-record="${esc(row.id)}"`, 'text-button danger')}</div></article>`;
}
function possessions() {
  const p = player();
  return `<section class="panel money-panel"><div><span class="eyebrow">RECURSOS FINANCEIROS</span><h2 data-money-balance>${currency(p.money)}</h2><p>Ganhos, gastos e pequenas fortunas.</p></div>${button(icon('plus') + ' Movimentar saldo', 'money', '', 'button primary')}</section>${sectionHead('Pertences e relíquias', 'Tudo o que você carrega para dentro da noite.', button(icon('plus') + ' Adicionar item', 'edit-record', 'data-key="items"', 'button primary'))}<div class="card-grid">${p.items.length ? p.items.map((x) => recordCard('items', x)).join('') : empty('Seu inventário está vazio.', 'Adicione seus equipamentos, relíquias e outros pertences.')}</div>${sectionHead('Movimentações', 'Cada ganho e gasto, com o seu motivo.', admin() ? button('Limpar registros', 'delete-log', 'data-key="transactions" data-index="all"', 'text-button danger') : '')}<section class="panel transaction-list">${(p.transactions || []).map((t, index) => `<article><span class="transaction-sign ${t.amount > 0 ? 'income' : 'expense'}">${t.amount > 0 ? '+' : '−'}</span><div><strong>${esc(t.reason)}</strong><small>${date(t.at)}</small></div><strong class="${t.amount > 0 ? 'income' : 'expense'}">${t.amount > 0 ? '+' : ''}${currency(t.amount)}</strong>${admin() ? button('Apagar', 'delete-log', `data-key="transactions" data-index="${index}"`, 'text-button danger') : ''}</article>`).join('') || '<p class="muted">Nenhum lançamento. Experimente −133 ou +2500.</p>'}</section>`;
}
function chronicle() {
  const p = player();
  return `${sectionHead('Princípios e convicções', 'As linhas que você ainda se recusa a atravessar.', admin() ? button(icon('edit') + ' Editar', 'morality', '', 'button ghost') : '')}<section class="panel morality-list">${p.moralityes.map((x, i) => `<div><span class="gold">${String(i + 1).padStart(2, '0')}</span><p>${esc(x.description)}</p></div>`).join('') || '<p class="muted">O narrador ainda não registrou convicções.</p>'}</section>${sectionHead('Rastros na noite', 'Alterações, evoluções e mensagens do narrador, preservadas nesta ficha.', admin() ? button('Limpar histórico', 'delete-log', 'data-key="history" data-index="all"', 'text-button danger') : '')}<section class="panel history">${
    [...(p.history || [])]
      .reverse()
      .slice(0, state.historyLimit || 40)
      .map(
        (x, index) =>
          `<div><span class="timeline-dot"></span><div><strong>${esc(x.action)}</strong><p>${esc(x.details)}</p><small>${esc(x.actor)} · ${date(x.at)}</small>${admin() ? button('Apagar', 'delete-log', `data-key="history" data-index="${p.history.length - 1 - index}"`, 'text-button danger') : ''}</div></div>`
      )
      .join('') || '<p class="muted">As próximas alterações serão registradas aqui.</p>'
  }</section>${p.history.length > (state.historyLimit || 40) ? button('Carregar mais alterações', 'history-more', '', 'button ghost') : ''}`;
}
function dice() {
  const preset = state.preparedRoll;
  const options = stats.slice(1, 4).flatMap((key) =>
    state.game[key].map((x) => ({
      value: `${key}:${x.id}`,
      label: `${x.name} (${value(key, x.id)})`
    }))
  );
  return `<div class="list-toolbar">${button('Limpar rolagens', 'delete-log', 'data-key="rolls" data-index="all"', 'text-button danger')}</div><div class="dice-layout"><section class="panel dice-builder"><span class="eyebrow">ORÁCULO DA NOITE</span><h2>Monte sua parada.</h2><p class="muted">D${state.game.dice.sides} com dificuldade configurável. Cada dado que alcança a dificuldade conta um sucesso; não há regras adicionais de crítico ou falha automática.</p>${preset ? `<div class="prepared-power"><strong>${esc(preset.label)}</strong><span>${preset.pool} dados preparados da sua ficha</span>${button('Limpar teste preparado', 'dice-clear-preset', '', 'text-button')}</div>` : ''}<form id="dice-form" class="form-grid">${preset ? `<input type="hidden" name="prepared_pool" value="${preset.pool}"><input type="hidden" name="prepared_label" value="${esc(preset.label)}">` : ''}${select('attribute', 'Atributo', [{ value: 'none', label: 'Sem atributo' }, ...state.game.atributes.map((x) => ({ value: x.id, label: `${x.name} (${value('atributes', x.id)})` }))])}${select('skill', 'Habilidade', [{ value: 'none', label: 'Sem habilidade' }, ...options])}${field('modifier', 'Modificador', 0, 'number', 'min="-20" max="20" step="1" required')}${field('difficulty', 'Dificuldade por dado', state.game.dice.success_on, 'number', `min="1" max="${state.game.dice.sides}" step="1" required`)}<label class="checkbox full"><input type="checkbox" name="hunger" checked> Destacar dados de fome (máximo: ${player().status.hunger})</label><button class="button primary full" type="submit">${icon('dice')} Rolar os dados</button></form><p class="hint">Até 30 rolagens acompanham o JSON da ficha. O som é controlado pelo botão geral no topo.</p></section><section class="dice-results" aria-live="polite">${
    player().rolls?.length
      ? player()
          .rolls.map(
            (r, i) =>
              `<article class="panel roll-result ${i === 0 ? 'latest' : ''}"><div class="roll-result-heading"><span class="eyebrow">${esc(r.label)}</span><span>${date(r.at)}</span></div><h2>${r.successes} <span>${r.successes === 1 ? 'sucesso' : 'sucessos'}</span></h2><div class="dice-faces">${r.dice.map((d) => `<span class="die ${d.hunger ? 'hunger' : ''} ${d.value >= r.threshold ? 'success' : ''}" aria-label="${d.hunger ? 'Dado de fome' : 'Dado comum'}: ${d.value}">${d.value}</span>`).join('')}</div><p>${r.dice.length} D${r.sides || 10} · Dificuldade ${r.threshold} · Vermelho indica fome</p>${button('Apagar rolagem', 'delete-log', `data-key="rolls" data-index="${i}"`, 'text-button danger')}</article>`
          )
          .join('')
      : empty('A noite espera sua decisão.', 'Escolha seus traços e faça a primeira rolagem.')
  }</section></div>`;
}
function characterList() {
  return `<div class="list-toolbar"><label class="search-field">${icon('search')}<input id="character-search" placeholder="Buscar personagem, jogador ou clã" aria-label="Buscar personagem" value="${esc(state.query)}"></label><label class="checkbox"><input id="show-archived" type="checkbox" ${state.archived ? 'checked' : ''}> Mostrar arquivados</label>${button(icon('plus') + ' Cadastrar jogador', 'create-character', '', 'button primary')}${button(icon('download') + ' Importar JSON', 'import-character', '', 'button ghost')}${button(icon('plus') + ' Distribuir XP', 'distribute-xp', '', 'button primary')}</div><div class="admin-stats"><div><span>PERSONAGENS</span><strong>${state.players.filter((p) => !p.archived).length}</strong></div><div><span>CLÃS NA CRÔNICA</span><strong>${new Set(state.players.filter((p) => !p.archived).map((p) => p.cla)).size}</strong></div></div><div id="character-results">${characterRows()}</div>`;
}
function characterRows() {
  const q = state.query.toLowerCase(),
    matches = state.players.filter((p) =>
      `${p.char} ${p.player} ${p.cla}`.toLowerCase().includes(q)
    );
  return matches.length
    ? `<div class="admin-character-grid">${matches.map((p) => `<article class="admin-character-card ${p.archived ? 'archived' : ''}"><div class="admin-character-top"><span class="character-initial">${isImageSource(p.profilepicture) ? `<img src="${esc(p.profilepicture)}" alt="${esc(p.char)}">` : esc(p.char.slice(0, 1))}</span><div><span class="eyebrow">FICHA #${p.id}${p.archived ? ' · ARQUIVADA' : ''}</span><h3>${esc(p.char)}</h3><p>${esc(p.player)}</p></div><span class="xp-pill">${p.xp} XP</span></div><div class="admin-character-meta"><span class="tag red">${esc(p.cla)}</span><span>${p.generation}ª geração</span></div><div class="admin-character-actions">${button('Abrir ficha', 'open-character', `data-id="${p.id}"`, 'button primary')}${button(icon('edit') + ' Editar', 'edit-full', `data-id="${p.id}" ${p.archived ? 'disabled' : ''}`, 'button ghost')}${button('Conceder XP', 'xp', `data-id="${p.id}" ${p.archived ? 'disabled' : ''}`, 'button ghost')}${button('Transferir controle', 'assign-character', `data-id="${p.id}"`, 'button ghost')}${button(icon('download') + ' Download', 'player-package', `data-id="${p.id}"`, 'button ghost')}${button('Remover', 'delete-character', `data-id="${p.id}"`, 'text-button danger')}${button(p.archived ? 'Restaurar' : 'Arquivar', 'archive', `data-id="${p.id}"`, 'text-button danger')}</div></article>`).join('')}</div>`
    : empty(
        'A próxima história começa aqui.',
        'Cadastre o jogador e transcreva a ficha de papel. O arquivo JSON e o acesso serão criados para você.',
        button(
          icon('plus') + ' Cadastrar primeiro jogador',
          'create-character',
          '',
          'button primary'
        )
      );
}
function bindSearch() {
  $('#character-search').oninput = (event) => {
    state.query = event.target.value;
    $('#character-results').innerHTML = characterRows();
  };
  $('#show-archived').onchange = (event) =>
    run(async () => {
      state.archived = event.target.checked;
      await loadPlayers();
      updateSelect();
      render();
    });
}
function accountsView() {
  return `${sectionHead('Quem tem as chaves da mesa.', 'Cada jogador pode ter vários personagens. A conta do narrador administra a campanha.', button(icon('plus') + ' Criar acesso', 'create-account', '', 'button primary'))}<div class="account-grid">${state.accounts
    .filter(
      (a) =>
        !state.registrations?.some((r) => r.id === a.id && r.registration.status !== 'approved')
    )
    .map(
      (a) =>
        `<article class="panel account-card"><div class="account-card-header"><span class="avatar small">${a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc(a.display_name.slice(0, 1))}</span><div><h3>${esc(a.display_name)}</h3><p>@${esc(a.username)}</p></div><span class="tag ${a.active ? 'red' : ''}">${a.active ? 'ATIVO' : 'INATIVO'}</span></div><p class="account-role">${a.role === 'admin' ? 'Narrador · administra sem personagem' : a.campaign_access ? 'Jogador com acesso à campanha' : 'Sem acesso a esta campanha'}</p><div class="account-linked">${a.role === 'admin' ? '<span class="muted">Pode administrar todas as fichas.</span>' : a.character_ids.map((id) => `<span class="tag">${esc(state.players.find((p) => p.id === id)?.char || '#' + id)}</span>`).join('') || '<span class="muted">Pode criar propostas quando tiver acesso à campanha.</span>'}</div>${button('Gerenciar acesso e personagens', 'edit-account', `data-id="${a.id}"`, 'button ghost')}${a.role === 'player' && a.campaign_access ? button(icon('download') + ' Download do acesso (JSON)', 'export-account', `data-id="${a.id}"`, 'button ghost') : ''}${a.id !== state.account.id ? button(a.role === 'admin' ? 'Remover narrador' : 'Remover jogador', 'delete-account', `data-id="${a.id}"`, 'text-button danger') : ''}</article>`
    )
    .join('')}</div>`;
}
function rulesView() {
  return rulebookPage(context());
}
function recordForm(key, recordId) {
  if (['notes', 'goals'].includes(key)) {
    go('notes');
    return;
  }
  const p = player(),
    revision = p._revision,
    row = p[key].find((x) => String(x.id) === String(recordId)),
    def = worldTypes[key],
    title = def?.singular || 'item';
  const content = `<div class="form-grid">${field('name', 'Nome', row?.name || '', 'text', 'required maxlength="150"')}${def ? def.fields.map(([k, label]) => field(k, label, row?.[k] || '', 'text', 'maxlength="300"')).join('') + select('rating', 'Nível / influência', [0, 1, 2, 3, 4, 5], row?.rating ?? 1) : ''}${key === 'items' ? field('quantity', 'Quantidade', row?.quantity ?? 1, 'number', 'min="0" max="9999" step="1" required') : ''}${area('description', 'Descrição e observações', row?.description || '', 'maxlength="10000"')}<label class="field full"><span>Imagem (opcional)</span><input type="file" name="image_file" accept="image/png,image/jpeg,image/webp"></label>${row?.image ? `<img class="record-image-preview" src="${esc(row.image)}" alt="Imagem atual"><label class="checkbox full"><input type="checkbox" name="remove_image"> Remover imagem atual</label>` : ''}${admin() ? area('log_message', 'Mensagem no histórico (opcional)', '', 'maxlength="2000"') : ''}</div>`;
  modal(`${row ? 'Editar' : 'Adicionar'} ${title}`, content, async (data) => {
    const body = Object.fromEntries(data),
      file = data.get('image_file');
    delete body.image_file;
    delete body.remove_image;
    delete body.log_message;
    const item = { ...row, id: row?.id ?? newId(), ...body };
    if (data.has('remove_image')) item.image = '';
    if (file?.size) item.image = (await readImage(file)).image;
    if (data.has('rating')) item.rating = Number(data.get('rating'));
    if (data.has('quantity')) item.quantity = Number(data.get('quantity'));
    const list = structuredClone(p[key]);
    if (row) list[list.findIndex((x) => String(x.id) === String(row.id))] = item;
    else list.push(item);
    await patch({ [key]: list }, revision, data.get('log_message') || '');
  });
}
function queueStatus(key, delta) {
  if (player().archived) throw new Error('Esta ficha está arquivada.');
  if (!pendingStatus)
    pendingStatus = {
      id: player().id,
      revision: player()._revision,
      before: structuredClone(player().status),
      next: structuredClone(player().status)
    };
  const rule = state.game.status_rules[key];
  pendingStatus.next[key] = Math.max(rule.min, Math.min(rule.max, pendingStatus.next[key] + delta));
  clearTimeout(statusTimer);
  if (
    Object.keys(pendingStatus.next).every((k) => pendingStatus.next[k] === pendingStatus.before[k])
  ) {
    clearPending(true);
    return;
  }
  document.body.dataset.pendingStatus = 'true';
  render();
  statusTimer = setTimeout(() => {
    const pending = pendingStatus;
    if (!pending) return;
    const changes = Object.keys(pending.next).filter((k) => pending.next[k] !== pending.before[k]);
    modal(
      'Confirmar o estado do personagem?',
      `<p class="hint">Confira o que mudou. Fechar ou cancelar preserva os valores anteriores.</p><div class="status-confirm-list">${changes.map((k) => `<div><span>${labels[k]}</span><strong>${pending.before[k]} ${icon('arrow')} ${pending.next[k]}</strong></div>`).join('')}</div>`,
      async () => {
        await api(`/api/characters/${pending.id}`, {
          method: 'PATCH',
          data: { revision: pending.revision, patch: { status: pending.next } }
        });
        clearPending();
        await refreshAll();
        toast('Estado confirmado.');
      },
      { saveLabel: 'Confirmar alterações', onCancel: () => clearPending(true) }
    );
  }, state.game.interface.status_confirmation_seconds * 1000);
}

function grantModal(key) {
  const p = player(),
    revision = p._revision;
  const owned = new Set(p[key].map((x) => x.id));
  const choices = state.game[key].filter((x) => !owned.has(x.id));
  const catalog = select(
    'id',
    'Traço para conceder',
    choices.map((d) => ({ value: d.id, label: d.name }))
  );
  const existing = p[key]
    .map((row) => {
      const d = state.game[key].find((x) => x.id === row.id);
      return `<div class="granted-row"><span>${esc(d?.name || row.id)}</span>${button('Remover', 'revoke', `data-key="${key}" data-id="${row.id}" data-revision="${revision}"`, 'text-button danger')}</div>`;
    })
    .join('');
  modal(
    `Gerenciar ${labels[key].toLowerCase()}`,
    `${existing ? '<div class="granted-list">' + existing + '</div>' : ''}${choices.length ? catalog + (key === 'disciplines' ? field('nivel', 'Nível inicial', 1, 'number', `min="1" max="${state.game.maxvalue_generation[p.generation]}" step="1" required`) : '') : '<p class="muted">Todos os traços do catálogo já foram concedidos.</p>'}${area('log_message', 'Mensagem no histórico (opcional)', '', 'maxlength="2000"')}`,
    choices.length
      ? async (data) => {
          const row = { id: Number(data.get('id')) };
          if (key === 'disciplines') row.nivel = Number(data.get('nivel'));
          await patch({ [key]: [...p[key], row] }, revision);
        }
      : null,
    { saveLabel: 'Conceder traço' }
  );
}
function identityModal() {
  const p = player(),
    revision = p._revision;
  modal(
    'Identidade do personagem',
    `<div class="form-grid">${field('char', 'Personagem', p.char, 'text', 'required maxlength="150"')}${field('player', 'Jogador', p.player, 'text', 'required maxlength="150"')}${field('cla', 'Clã', p.cla, 'text', 'required maxlength="80"')}${field('generation', 'Geração', p.generation, 'number', 'min="4" max="13" step="1" required')}${field('bloodpotency', 'Potência do sangue', p.bloodpotency, 'number', 'min="1" max="10" step="1" required')}${field('profilepicture', 'URL HTTPS do retrato', p.profilepicture === 'image_link' ? '' : p.profilepicture, 'url', 'maxlength="2000"')}</div><p class="hint">A potência do sangue e os traços precisam respeitar os limites da nova geração.</p>${area('log_message', 'Mensagem no histórico (opcional)', '', 'maxlength="2000"')}`,
    async (data) => {
      const result = Object.fromEntries(data);
      result.generation = Number(result.generation);
      result.bloodpotency = Number(result.bloodpotency);
      const message = result.log_message;
      delete result.log_message;
      await patch(result, revision, message);
    }
  );
}
function accountModal(account) {
  const existing = !!account;
  account ??= { role: 'player', character_ids: [], active: true, campaign_access: true };
  const options = `<div class="field full"><span>Fichas vinculadas</span><div class="checkbox-list">${state.players.map((p) => `<label class="checkbox"><input type="checkbox" name="character_ids" value="${p.id}" ${account.character_ids.includes(p.id) ? 'checked' : ''}> ${esc(p.char)} <small>#${p.id}</small></label>`).join('') || '<p class="muted">Crie um personagem antes de vincular uma ficha.</p>'}</div></div>`;
  modal(
    existing ? 'Gerenciar acesso' : 'Criar acesso de jogador',
    `<p class="hint">A senha fica em hash no JSON de contas. Uma conta pode controlar várias fichas. Vincular uma ficha transfere o controle dos acessos anteriores. Narradores administram sem personagem.</p><div class="form-grid">${field('display_name', 'Nome', account.display_name || '', 'text', 'required maxlength="100"')}${existing ? '' : field('username', 'Login', '', 'text', 'required minlength="3" maxlength="40" pattern="[a-zA-Z0-9_.-]+" autocomplete="off"')}${select(
      'role',
      'Permissão',
      [
        { value: 'player', label: 'Jogador' },
        { value: 'admin', label: 'Narrador' }
      ],
      account.role
    )}${field('password', existing ? 'Redefinir senha (opcional)' : 'Senha inicial', '', 'password', `${existing ? '' : 'required'} minlength="10" maxlength="128" autocomplete="new-password" placeholder="No mínimo 10 caracteres"`)}<label class="checkbox full"><input name="campaign_access" type="checkbox" ${account.campaign_access ? 'checked' : ''}> Acesso a esta campanha, mesmo sem ficha aprovada</label>${existing ? `<label class="checkbox full"><input name="active" type="checkbox" ${account.active ? 'checked' : ''}> Conta ativa</label>` : ''}${options}</div>`,
    async (data) => {
      const payload = {
        display_name: data.get('display_name'),
        role: data.get('role'),
        character_ids: data.get('role') === 'admin' ? [] : data.getAll('character_ids').map(Number),
        campaign_access: data.has('campaign_access')
      };
      if (data.get('password')) payload.password = data.get('password');
      if (existing) payload.active = data.has('active');
      else payload.username = data.get('username');
      await api(existing ? `/api/admin/accounts/${account.id}` : '/api/admin/accounts', {
        method: existing ? 'PATCH' : 'POST',
        data: payload
      });
      if (existing && account.id === state.account.id && !isDemo()) {
        clearSession();
        window.dispatchEvent(new CustomEvent('portal:signout'));
        return;
      }
      state.accounts = await api('/api/admin/accounts');
      render();
      toast('Acesso atualizado.');
    },
    { wide: true, saveLabel: existing ? 'Salvar acesso' : 'Criar acesso' }
  );
}
async function handleClick(event) {
  const view = event.target.closest('[data-view]');
  if (view) {
    if (view.dataset.view === 'new-player') state.editor = null;
    await run(() => go(view.dataset.view));
    return;
  }
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  const { action, key, id, record } = control.dataset;
  await run(async () => {
    if (await playerTestAction(action, control.dataset, context())) return;
    if (action.startsWith('nav-')) {
      closeModal();
      await go(action.slice(4));
      return;
    }
    if (action === 'route-back') {
      if ($('#modal').open) closeModal();
      else if (trail.canBack) history.back();
      return;
    }
    if (action === 'route-home') {
      await go(admin() ? 'dashboard' : 'my-characters');
      return;
    }
    if (await loyaltyAction(action, control.dataset, context())) return;
    if (await registrationAction(action, control.dataset, context())) return;
    if (await aspirationAction(action, control.dataset, context())) return;
    if (await consultationAction(action, control.dataset, context())) return;
    if (await searchAction(action, control.dataset, context())) return;
    if (await commerceAction(action, control.dataset, context())) return;
    if (await powerAction(action, control.dataset, context())) return;
    if (action === 'history-more') {
      state.historyLimit = (state.historyLimit || 40) + 40;
      render();
      return;
    }
    if (action === 'dice-clear-preset') {
      state.preparedRoll = null;
      state.diceDraft = null;
      render();
      return;
    }
    if (await lifecycleAction(action, control.dataset, context())) return;
    if (await communityAction(action, control.dataset, context())) return;
    if (await evolutionAction(action, control.dataset, context())) return;
    if (await administrationAction(action, control.dataset, context())) return;
    if (await rulebookAction(action, control.dataset, context())) return;
    if (await chronicleAction(action, control.dataset, context())) return;
    if (await achievementAction(action, control.dataset, context())) return;
    if (await bloodBondAction(action, control.dataset, context())) return;
    if (await featureAction(action, control.dataset, context())) return;
    if (await canvasAction(action, control.dataset, context())) return;
    switch (action) {
      case 'menu': {
        const opened = $('#sidebar').classList.toggle('open');
        $('#sidebar').inert = !opened && matchMedia('(max-width:800px)').matches;
        $('#sidebar').setAttribute(
          'aria-hidden',
          String(!opened && matchMedia('(max-width:800px)').matches)
        );
        document
          .querySelectorAll('[data-action=menu]')
          .forEach((el) => el.setAttribute('aria-expanded', String(opened)));
        document.body.classList.toggle('drawer-open', opened);
        break;
      }
      case 'close-menu':
        closeMenu();
        break;
      case 'logout':
        modal(
          'Encerrar sua sessão?',
          '<p>As alterações concluídas já estão salvas. Ao sair, este acesso será encerrado nos seus dispositivos; você poderá entrar novamente com login e senha.</p>',
          async () => {
            await api('/auth/logout', { method: 'POST', data: {} });
            clearSession();
            window.dispatchEvent(new CustomEvent('portal:signout'));
          },
          { saveLabel: 'Sair da crônica' }
        );
        break;
      case 'password':
        if (session()?.player_test) throw new Error('Volte ao narrador para alterar sua senha.');
        modal(
          'Alterar sua senha',
          field(
            'current_password',
            'Senha atual',
            '',
            'password',
            'required autocomplete="current-password"'
          ) +
            field(
              'password',
              'Nova senha',
              '',
              'password',
              'required minlength="10" maxlength="128" autocomplete="new-password"'
            ),
          async (data) => {
            const response = await api('/auth/password', {
              method: 'POST',
              data: Object.fromEntries(data)
            });
            saveSession(response);
            toast('Senha alterada e outras sessões encerradas.');
          }
        );
        break;
      case 'refresh':
        clearPending();
        await refreshAll();
        toast('Ficha atualizada.');
        break;
      case 'export':
        await download(`coroa-ficha-${player().id}.json`, player());
        toast('Ficha exportada sem credenciais.');
        break;
      case 'export-game':
        await download('game_data.json', state.game);
        break;
      case 'status':
        queueStatus(key, Number(control.dataset.delta));
        break;
      case 'cancel-status':
        clearPending(true);
        break;
      case 'open-world':
        state.world = key;
        await go('world');
        break;
      case 'world-tab':
        state.world = key;
        render();
        break;
      case 'bio': {
        const revision = player()._revision;
        modal(
          'A história sob o véu',
          area('biography', 'História e segredos', player().biography, 'maxlength="30000"'),
          async (data) => {
            await patch({ biography: data.get('biography') }, revision);
          }
        );
        break;
      }
      case 'portrait': {
        const revision = player()._revision;
        portraitDialog(player(), (data) => patch(data, revision));
        break;
      }
      case 'view-portrait':
        modal(
          player().char,
          isImageSource(player().profilepicture)
            ? `<img class="full-portrait" src="${esc(player().profilepicture)}" alt="${esc(player().char)}">`
            : '<p>Envie um retrato para dar um rosto à sua história.</p>',
          null,
          { wide: true }
        );
        break;
      case 'identity':
        await editFull(player());
        break;
      case 'edit-full':
        await editFull(await api(`/api/characters/${Number(id)}`));
        break;
      case 'player-package':
        await exportPlayer(Number(id));
        break;
      case 'backup-table':
      case 'export-jsons':
      case 'restore-table':
      case 'connect-folder':
      case 'reconnect-folder':
      case 'download-snapshot':
      case 'restore-snapshot':
        await fileAction(action, id);
        break;
      case 'edit-record':
        recordForm(key, record);
        break;
      case 'remove-record': {
        const p = player(),
          revision = p._revision,
          row = p[key].find((x) => String(x.id) === record);
        modal(
          'Remover este registro?',
          `<p class="prose">${esc(row?.name || row?.description || 'O registro será removido da ficha.')}</p><p class="hint">Uma cópia da ficha anterior fica no backup do narrador.</p>`,
          async () => {
            await patch({ [key]: p[key].filter((x) => String(x.id) !== record) }, revision);
          },
          { saveLabel: 'Remover registro' }
        );
        break;
      }
      case 'money': {
        const p = player(),
          before = p.money,
          revision = p._revision;
        modal(
          'O movimento da sua fortuna',
          `<div class="money-dialog"><span class="eyebrow">SALDO ATUAL</span><strong>${currency(p.money)}</strong></div>${field('delta', 'Quanto entrou ou saiu?', '', 'text', 'required inputmode="decimal" placeholder="−133 ou +2500" maxlength="30"')}${field('reason', 'Motivo', '', 'text', 'required maxlength="300" placeholder="Compra de equipamento, recompensa…"')}<p class="hint">Use − para gastar e + para receber. Ex.: −133,50 ou +2500.</p>`,
          async (data) => {
            await mutate(`/api/characters/${p.id}/money`, {
              revision,
              delta: data.get('delta').replace('−', '-'),
              reason: data.get('reason')
            });
            animateMoney(before, player().money, $('[data-money-balance]'));
          },
          { saveLabel: 'Confirmar movimentação' }
        );
        break;
      }
      case 'morality': {
        const p = player(),
          revision = p._revision;
        modal(
          'Princípios e convicções',
          area(
            'morality',
            'Uma convicção por linha',
            p.moralityes.map((x) => x.description).join('\n'),
            'maxlength="10000"'
          ),
          async (data) => {
            await patch(
              {
                moralityes: data
                  .get('morality')
                  .split('\n')
                  .filter((x) => x.trim())
                  .map((description, id) => ({ id, description }))
              },
              revision
            );
          }
        );
        break;
      }
      case 'trait':
        await openEvolution(context(), key, key === 'bloodpotency' ? null : Number(id));
        break;
      case 'learn-discipline': {
        const choices = state.game.disciplines.filter(
          (d) => !player().disciplines.some((e) => e.id === d.id)
        );
        if (!choices.length) {
          toast('Você já conhece as disciplinas disponíveis.');
          break;
        }
        modal(
          'Um novo dom do sangue',
          select(
            'id',
            'Disciplina',
            choices.map((d) => ({ value: d.id, label: d.name }))
          ),
          async (data) => {
            setTimeout(
              () =>
                run(() =>
                  openEvolution(context(), 'disciplines', Number(data.get('id')), 'powers')
                ),
              0
            );
          },
          { saveLabel: 'Ver níveis e custo de XP' }
        );
        break;
      }
      case 'direct-trait': {
        const input = $('[name="direct_level"]');
        if (!input.reportValidity()) break;
        const field = key === 'disciplines' ? 'nivel' : 'value';
        const rows = structuredClone(player()[key]);
        let entry = rows.find((x) => x.id === Number(id));
        if (!entry) {
          entry = { id: Number(id), [field]: 0 };
          rows.push(entry);
        }
        entry[field] = Number(input.value);
        await patch({ [key]: rows }, Number(control.dataset.revision));
        closeModal();
        break;
      }
      case 'lore':
        await openConsultation(context(), key, Number(id));
        break;
      case 'grant':
        grantModal(key);
        break;
      case 'revoke':
        await patch(
          { [key]: player()[key].filter((x) => x.id !== Number(id)) },
          Number(control.dataset.revision)
        );
        closeModal();
        break;
      case 'open-character':
        await loadPlayer(Number(id));
        await go('overview');
        break;
      case 'create-character':
        state.editor = null;
        await go('new-player');
        break;
      case 'xp': {
        const p = await api(`/api/characters/${Number(id)}`);
        modal(
          `Experiência · ${p.char}`,
          field(
            'amount',
            'Quantidade de XP (negativo para retirar)',
            5,
            'number',
            'required min="-100000" max="100000" step="1"'
          ) +
            field('reason', 'Motivo', 'XP da sessão', 'text', 'required maxlength="200"') +
            `<p class="hint">Saldo atual: ${p.xp} XP. O ajuste ficará registrado no histórico.</p>`,
          async (data) => {
            await mutate(`/api/characters/${p.id}/xp`, {
              revision: p._revision,
              amount: Number(data.get('amount')),
              reason: data.get('reason')
            });
          },
          { saveLabel: 'Aplicar XP' }
        );
        break;
      }
      case 'archive': {
        const p = await api(`/api/characters/${Number(id)}`);
        modal(
          p.archived ? 'Restaurar personagem?' : 'Arquivar personagem?',
          `<p>${esc(p.char)}</p><p class="hint">Personagens arquivados ficam preservados e podem ser restaurados pelo narrador.</p>`,
          async () => {
            await mutate(`/api/characters/${p.id}/archive`, {
              revision: p._revision,
              archived: !p.archived
            });
            if (player()?.id === p.id && p.archived !== true) {
              state.player = null;
              const active = state.players.find((p) => !p.archived);
              if (active) await loadPlayer(active.id);
              state.view = 'characters';
              render();
            }
          },
          { saveLabel: p.archived ? 'Restaurar' : 'Arquivar' }
        );
        break;
      }
      case 'distribute-xp':
        xpDistribution(context());
        break;
      case 'create-account':
        accountModal();
        break;
      case 'edit-account':
        accountModal(state.accounts.find((a) => a.id === id));
        break;
      case 'import-character':
        importModal(false);
        break;
      case 'import-game':
        importModal(true);
        break;
    }
  });
}
function importModal(game) {
  modal(
    game ? 'Importar livro de regras' : 'Importar personagem',
    `<label class="field"><span>Arquivo JSON</span><input type="file" name="file" accept=".json,application/json" required></label>${game ? '' : '<label class="checkbox"><input type="checkbox" name="replace"> Substituir ficha de mesmo ID, preservando a versão atual em backup</label>'}<p class="hint">${game ? 'A versão anterior será guardada em backup. As fichas existentes precisam continuar compatíveis.' : 'Importe uma ficha antiga ou receba de volta o JSON atualizado por um jogador.'}</p>`,
    async (data) => {
      const file = data.get('file');
      if (file.size > 30 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 30 MB.');
      let document;
      try {
        document = JSON.parse(await file.text());
      } catch {
        throw new Error('Este arquivo não contém JSON válido.');
      }
      const destinationError = jsonDestinationError(document, game ? 'game' : 'character');
      if (destinationError) throw new Error(destinationError);
      if (game) {
        await api('/api/game', { method: 'PUT', data: document });
        state.game = await api('/api/game');
        render();
        toast('Livro de regras atualizado.');
      } else {
        const payload = { character: document };
        if (data.has('replace')) {
          try {
            const current = await api(`/api/characters/${document.id}`);
            payload.replace = true;
            payload.revision = current._revision;
          } catch (error) {
            if (error.status !== 404) throw error;
          }
        }
        await mutate('/api/characters/import', payload);
        if (player()?.id === document.id) await loadPlayer(document.id);
        render();
      }
    },
    { saveLabel: 'Validar e importar' }
  );
}
function captureDice(form) {
  state.diceDraft = {
    character: player()?.id,
    fields: Object.fromEntries(
      ['attribute', 'skill', 'modifier', 'difficulty', 'hunger'].map((name) => [
        name,
        form.elements[name].type === 'checkbox'
          ? form.elements[name].checked
          : form.elements[name].value
      ])
    )
  };
}
function handleSubmit(event) {
  if (event.target.id !== 'dice-form') return;
  event.preventDefault();
  run(async () => {
    const form = event.target,
      control = event.submitter;
    if (control.disabled) return;
    const f = new FormData(form),
      attribute = f.get('attribute'),
      skill = f.get('skill'),
      [key, id] = skill.split(':'),
      a = attribute === 'none' ? 0 : value('atributes', Number(attribute)),
      b = skill === 'none' ? 0 : value(key, Number(id)),
      pool = Number(f.get('prepared_pool') || 0) + a + b + Number(f.get('modifier'));
    if (pool < 1 || pool > state.game.dice.max_pool)
      throw new Error(`A parada deve ter entre 1 e ${state.game.dice.max_pool} dados.`);
    const aName = state.game.atributes.find((x) => x.id === Number(attribute))?.name,
      bName = state.game[key]?.find((x) => x.id === Number(id))?.name,
      label =
        f.get('prepared_label') ||
        [attribute !== 'none' && aName, skill !== 'none' && bName].filter(Boolean).join(' + ') ||
        'Parada livre';
    control.disabled = true;
    diceSound(state.account.preferences?.sound ?? state.game.interface.sound);
    $('.dice-results').innerHTML =
      `<div class="panel dice-rolling" role="status"><div class="dice-faces">${Array.from({ length: Math.min(pool, 12) }, (_, i) => `<span class="die ${i < player().status.hunger && f.has('hunger') ? 'hunger' : ''}" style="--roll-delay:${i * 35}ms">◇</span>`).join('')}</div><p>O destino atravessa o véu…</p></div>`;
    try {
      await new Promise((resolve) =>
        setTimeout(resolve, state.account.preferences?.animations === false ? 0 : 760)
      );
      await api(`/api/characters/${player().id}/roll`, {
        method: 'POST',
        data: {
          pool,
          hunger: f.has('hunger'),
          threshold: Number(f.get('difficulty')),
          label: label.slice(0, 200)
        }
      });
      await loadPlayer(player().id);
      render();
      for (const [name, v] of f) {
        const input = $(`#dice-form [name="${name}"]`);
        if (input && input.type !== 'checkbox') input.value = v;
      }
      $('#dice-form [name="hunger"]').checked = f.has('hunger');
    } finally {
      if (control.isConnected) control.disabled = false;
    }
  });
}
function closeMenu() {
  const sidebar = document.querySelector('#sidebar');
  if (sidebar) {
    sidebar.classList.remove('open');
    const mobile = matchMedia('(max-width:800px)').matches;
    sidebar.inert = mobile;
    sidebar.setAttribute('aria-hidden', String(mobile));
  }
  document
    .querySelectorAll('[data-action=menu]')
    .forEach((el) => el.setAttribute('aria-expanded', 'false'));
  document.body.classList.remove('drawer-open');
}
async function makeEditor(character) {
  const id = character?.id ?? (await api('/api/characters/new-id')).id;
  state.editor = new SheetEditor({
    game: state.game,
    character,
    id,
    accountId: state.account.id,
    onCancel: () => go('characters'),
    onSaved: async (p, login) => {
      state.editor = null;
      await loadPlayers();
      await loadPlayer(p.id);
      await go('overview');
      toast(
        login
          ? `Ficha criada. Login do jogador: ${login}`
          : 'Ficha atualizada. Exporte os JSONs para guardar.'
      );
    }
  });
}
async function editProposal(record) {
  const id = record?.character.id ?? (await api('/api/characters/new-id')).id;
  const Editor =
    !admin() && state.game.character_creation.guided.enabled ? CreationWizard : SheetEditor;
  state.editor = new Editor({
    game: state.game,
    character: record?.character,
    id,
    accountId: state.account.id,
    accountName: state.account.display_name,
    mode: admin() ? 'review' : 'proposal',
    draftKey: record?.id || 'new',
    onCancel: () => go('submissions'),
    onSubmit: (p) =>
      api('/api/submissions' + (record ? '/' + record.id : ''), {
        method: record ? 'PATCH' : 'POST',
        data: { character: p, revision: record?._revision }
      }),
    onSaved: async (result) => {
      state.editor = null;
      state.reviewId = result.id;
      await refreshAll();
      await go('review-submission');
      toast(admin() ? 'Ajustes salvos na proposta.' : 'Ficha enviada para avaliação do narrador.');
    }
  });
  await go('proposal-editor');
}
async function editFull(p) {
  await makeEditor(p);
  await go('new-player');
}
const routeKeys = [
  'recapId',
  'recapDraft',
  'recapFilter',
  'recapCharacter',
  'documentId',
  'documentFilter',
  'feedbackFilter',
  'galleryAccountId',
  'achievementFilter',
  'bondFilter',
  'world',
  'query',
  'archived',
  'traitCategory',
  'traitQuery',
  'ruleCatalog',
  'ruleQuery',
  'rulePane',
  'powerDetail',
  'mapId',
  'mapCharacterId',
  'intelQuery',
  'intelFilter',
  'historyLimit',
  'reviewId',
  'evolution',
  'preparedRoll',
  'diceDraft'
];
let trail = new NavigationTrail(),
  navigating = false,
  restoring = false;
function routePoint() {
  return {
    view: state.view,
    campaign: state.campaign?.id,
    character: player()?.id,
    scroll: window.scrollY,
    editor: state.editor,
    route: Object.fromEntries(
      routeKeys.map((k) => [k, state[k] === undefined ? undefined : structuredClone(state[k])])
    )
  };
}
function updateRouteControls() {
  const back = $('[data-action=route-back]');
  if (back) {
    back.disabled = !trail.canBack;
    back.title = trail.canBack ? 'Voltar à tela anterior' : 'Você está no início desta navegação';
  }
  const label = $('[data-route-label]');
  if (label) label.textContent = $('#breadcrumb-current')?.textContent || '';
}
async function restoreRoute(point) {
  restoring = true;
  navigating = true;
  closeModal();
  try {
    if (point.campaign && point.campaign !== state.campaign?.id) {
      await api(`/api/campaigns/${point.campaign}/select`, { method: 'POST', data: {} });
      state.player = null;
      await loadFeatureState(state);
    }
    Object.assign(state, structuredClone(point.route));
    state.editor = point.editor;
    if (point.character) {
      try {
        await loadPlayer(point.character);
      } catch {
        state.player = null;
      }
    } else state.player = null;
    state.view = point.view;
    if (state.view === 'achievements') await loadGallery(context());
    clearPending();
    render();
    requestAnimationFrame(() => window.scrollTo({ top: point.scroll || 0, behavior: 'instant' }));
  } finally {
    navigating = false;
    restoring = false;
    updateRouteControls();
  }
}
function rememberRoutePosition() {
  if (trail.current) {
    trail.current.point.scroll = window.scrollY;
    for (const key of ['traitQuery', 'ruleQuery', 'intelQuery', 'query', 'diceDraft', 'recapDraft'])
      trail.current.point.route[key] = state[key];
  }
}
async function go(view, options = {}) {
  if (options === true) options = { replace: true };
  if (
    state.view === 'recap-write' &&
    view !== 'recap-write' &&
    $('#recap-editor')?.dataset.dirty === 'true'
  ) {
    const leave = await new Promise((resolve) =>
      modal(
        'Seu relato ainda não foi salvo.',
        '<p>Você pode voltar e salvar o rascunho antes de sair. Se continuar, o último texto salvo permanece no servidor.</p>',
        async () => resolve(true),
        { saveLabel: 'Continuar sem salvar', onCancel: () => resolve(false) }
      )
    );
    if (!leave) return;
  }
  rememberRoutePosition();
  const previousView = state.view;
  navigating = true;
  try {
    if (
      !state.campaigns?.length &&
      ![
        'campaigns',
        'profile',
        'storage',
        'trash',
        'notifications',
        'registrations',
        'achievements'
      ].includes(view)
    )
      view = 'campaigns';
    if (view !== state.view) clearPending();
    if (adminNav.some(([key]) => key === view) && !admin() && view !== 'submissions')
      view = 'my-characters';
    if (options.route) Object.assign(state, options.route);
    state.view = view;
    if (view === 'accounts') state.accounts = await api('/api/admin/accounts');
    if (view === 'social') state.social = await api('/api/social');
    if (view === 'storage') state.storageMarkup = await storageView();
    if (view === 'trash') state.trash = await api('/api/admin/trash');
    if (view === 'achievements') await loadGallery(context());
    if (view === 'new-player' && !state.editor) await makeEditor();
    closeModal();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (previousView !== state.view) animatePage();
    if (previousView !== state.view || options.route) {
      const marker = trail.push(routePoint());
      history[options.replace ? 'replaceState' : 'pushState'](marker, '', `#${state.view}`);
    } else {
      trail.update(routePoint());
      history.replaceState(trail.marker(), '', `#${state.view}`);
    }
  } finally {
    navigating = false;
    updateRouteControls();
  }
}

let syncTimer;
export function stopPortal() {
  disposeExperience();
  configureSound(undefined, null);
  clearInterval(syncTimer);
  delete document.body.dataset.pendingEditor;
  clearPending();
  disposeEvolution();
  events.abort();
  closeMenu();
  state.editor = null;
  state.player = null;
  state.players = [];
  state.accounts = [];
  state.rolls = [];
  state.diceDraft = null;
  state.preparedRoll = null;
  state.socialDraft = {};
  state.socialRecipient = '';
}
export async function restartPortal(view, nextSession) {
  stopPortal();
  closeModal();
  $('#app').innerHTML =
    '<main class="loading-screen" role="status"><div class="loading-orbit" aria-hidden="true"><i></i><span>◇</span></div><h1>Atravessando o véu…</h1></main>';
  if (nextSession) saveSession(nextSession);
  state.archived = false;
  state.mapCharacterId = null;
  state.mapToolsOpen = false;
  history.replaceState(null, '', '#' + view);
  try {
    await startPortal();
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (error) {
    $('#app').innerHTML =
      `<main class="loading-screen"><h1>Não foi possível trocar de visão.</h1><p>${esc(error.message)}</p><button type="button" class="button primary" id="reload-portal">Reabrir o portal</button></main>`;
    $('#reload-portal').onclick = () => location.reload();
    throw error;
  }
}
export async function startPortal() {
  state.game = null;
  state.campaign = null;
  state.rewards = null;
  state.recapDraft = null;
  state.recapId = null;
  state.documentId = null;
  state.openGallery = null;
  events.abort();
  events = new AbortController();
  state.editor = null;
  state.player = null;
  await loadFeatureState(state);
  saveSession({ ...session(), account: state.account });
  state.evolution = null;
  state.reviewId = null;
  state.mapId = null;
  state.view =
    location.hash.slice(1) ||
    (admin()
      ? 'dashboard'
      : state.players.length > 1
        ? 'my-characters'
        : player()
          ? 'overview'
          : 'my-characters');
  if (state.view === 'new-player' && admin()) await makeEditor();
  if (state.view === 'accounts' && admin()) state.accounts = await api('/api/admin/accounts');
  if (state.view === 'storage' && admin()) state.storageMarkup = await storageView();
  if (state.view === 'trash' && admin()) state.trash = await api('/api/admin/trash');
  if (state.view === 'achievements') await loadGallery(context());
  trail = new NavigationTrail();
  initShell();
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        !$('#modal').open
      ) {
        event.preventDefault();
        run(() => searchAction('global-search', {}, context()));
      }
    },
    { signal: events.signal }
  );
  updateSelect();
  render();
  registerPresence();
  {
    let seen = store.remoteRevision,
      checking = false;
    const synchronize = async () => {
      if (checking || document.hidden) return;
      registerPresence();
      checking = true;
      try {
        const status = await api('/api/sync', { silent: true });
        const editing =
          busy ||
          state.editor ||
          pendingStatus ||
          state.view === 'evolution' ||
          document.body.classList.contains('drawer-open') ||
          document.querySelector('dialog[open]') ||
          document.activeElement?.matches('input,textarea,select') ||
          document.querySelector('form[data-dirty="true"]');
        if (editing) return;
        if (status.revision !== seen) {
          await refreshAll({ silent: true });
          seen = store.remoteRevision;
        } else if (state.view === 'social') {
          state.social = await api('/api/social', { silent: true });
          render();
        }
      } catch (error) {
        if (
          error.status !== 401 &&
          !['PLAYER_TEST_CONTEXT_CHANGED', 'PLAYER_TEST_EXPIRED'].includes(error.code)
        )
          document
            .querySelectorAll('[data-sync-label]')
            .forEach((el) => (el.textContent = 'Sem atualização automática · confira sua conexão'));
      } finally {
        checking = false;
      }
    };
    clearInterval(syncTimer);
    syncTimer = setInterval(synchronize, 20000);
    const returnToPortal = async () => {
      await registerPresence();
      await synchronize();
    };
    window.addEventListener('focus', returnToPortal, { signal: events.signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) returnToPortal();
      },
      { signal: events.signal }
    );
  }
  matchMedia('(max-width:800px)').addEventListener('change', closeMenu, { signal: events.signal });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') closeMenu();
      if (event.key === 'Enter' && event.target.matches('.character-avatar')) event.target.click();
    },
    { signal: events.signal }
  );
  trail.start(routePoint());
  history.replaceState(trail.marker(), '', `#${state.view}`);
  updateRouteControls();
  window.addEventListener(
    'popstate',
    (event) =>
      run(async () => {
        rememberRoutePosition();
        const point = trail.select(event.state);
        if (point) await restoreRoute(point);
        else if (!restoring) await go(location.hash.slice(1) || 'campaigns', { replace: true });
      }),
    { signal: events.signal }
  );
  window.addEventListener(
    'hashchange',
    () => {
      const view = location.hash.slice(1);
      if (!restoring && view !== state.view && view !== 'main-content')
        run(() => go(view || 'campaigns', { replace: true }));
    },
    { signal: events.signal }
  );
  window.addEventListener(
    'portal:sync-state',
    () =>
      document
        .querySelectorAll('[data-sync-label]')
        .forEach((el) => (el.textContent = compactSyncLabel())),
    { signal: events.signal }
  );
  window.addEventListener('portal:refresh', () => run(refreshAll), { signal: events.signal });
}
