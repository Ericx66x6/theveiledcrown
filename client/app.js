import { installSound } from './audio.js';
import { api, initialize, session, saveSession, clearSession } from './api.js';
import { showLogin } from './login.js';
import { startPortal, stopPortal, restartPortal } from './portal.js';
import { initializeFiles } from './files.js';
import { esc } from '../shared/ui.js';
export async function startApp({ identity } = {}) {
  installSound();
  window.addEventListener('audio:save-error', (event) => {
    document.querySelector('#toasts').textContent = event.detail;
  });

  async function enter() {
    document.body.classList.remove('login-page');
    await startPortal();
  }
  async function leave() {
    stopPortal();
    clearSession();
    document.querySelector('#modal')?.close();
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      location.hash = '';
    }
    await showLogin(enter);
  }
  window.addEventListener('portal:signout', leave);
  window.addEventListener('session:expired', leave);
  let restoringNarrator = false;
  window.addEventListener('player-test:expired', async () => {
    const current = session();
    if (restoringNarrator || !current?.player_test) return;
    restoringNarrator = true;
    try {
      await restartPortal('dashboard', {
        ...current,
        mode: 'online',
        player_test: null,
        campaign_id: current.player_test.source_campaign_id
      });
    } catch {
      // The blocked portal offers a reload; never retry a test mutation in the real campaign.
    } finally {
      restoringNarrator = false;
    }
  });
  try {
    await initialize();
    await initializeFiles();
    if (identity) saveSession(identity);
    else {
      try {
        saveSession(await api('/auth/me', { allowUnauthorized: true }));
      } catch (error) {
        if (error.status !== 401) throw error;
      }
    }
    if (session()) await enter();
    else await showLogin(enter);
  } catch (error) {
    document.querySelector('#app').innerHTML =
      `<main class="loading-screen"><h1>Não foi possível abrir o livro.</h1><p>${esc(error.message)}</p><p>Confira sua conexão com a campanha e tente novamente.</p><button type="button" class="button primary" id="retry-portal">Tentar novamente</button></main>`;
    document.querySelector('#retry-portal').onclick = () => location.reload();
  }
}
