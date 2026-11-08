import { beginLoading } from './loading.js';
import { RemoteClient } from './transport.js';
let activeSession = null,
  transport;
export const session = () => activeSession;
export const setViewCache = (value) => {
  if (transport) transport.viewCache = value;
};
export const takePortalState = (request) => transport?.takePortalState(request) || null;
export const store = {
  drafts: {},
  remoteRevision: 0,
  current: () => ({ id: transport?.campaignId || 'portal' })
};
export const saveSession = (data) => {
  activeSession = data;
  if (transport) {
    transport.playerTestId = data?.player_test?.id || null;
    if (data && Object.hasOwn(data, 'campaign_id')) transport.campaignId = data.campaign_id;
  }
  if (transport && data?.token) {
    transport.token = data.token;
    transport.campaignId = data.campaign_id || transport.campaignId;
  }
};
export const clearSession = () => {
  activeSession = null;
  transport?.clear();
  store.drafts = {};
};
export const isDemo = () => false;
export async function initialize() {
  if (globalThis.location && !['http:', 'https:'].includes(location.protocol))
    throw new Error('Abra a Coroa Velada pelo endereço publicado da campanha.');
  transport = new RemoteClient(globalThis.COROA_CONFIG?.apiBase || location.origin);
  return store;
}
export async function api(
  path,
  { method = 'GET', data, allowUnauthorized = false, silent = false, blocking } = {}
) {
  if (!transport) throw new Error('A conexão da campanha ainda não foi inicializada.');
  const controller = new AbortController();
  const done = silent
    ? () => {}
    : beginLoading(
        method === 'GET'
          ? 'Carregando a crônica…'
          : path === '/api/media/portable'
            ? 'Preparando seu download…'
            : 'Salvando na crônica…',
        () => controller.abort(),
        {
          blocking:
            blocking ??
            (!document.querySelector('#main-content') ||
              /\/api\/(json\/|exchange\/import|admin\/reset|campaigns\/[^/]+\/select|media\/portable)/.test(
                path
              ))
        }
      );
  try {
    const result = await transport.request(path, {
      method,
      data,
      token: activeSession?.token,
      signal: controller.signal
    });
    store.remoteRevision = transport.store.remoteRevision;
    if (method !== 'GET' && path !== '/api/media/portable')
      window.dispatchEvent(new CustomEvent('portal:saved'));
    return result;
  } catch (error) {
    if (error.code === 'PLAYER_TEST_EXPIRED')
      window.dispatchEvent(new CustomEvent('player-test:expired'));
    if (
      !allowUnauthorized &&
      error.status === 401 &&
      !['/auth/login', '/auth/bootstrap'].includes(path)
    ) {
      clearSession();
      window.dispatchEvent(new CustomEvent('session:expired'));
    }
    throw error;
  } finally {
    done();
  }
}
