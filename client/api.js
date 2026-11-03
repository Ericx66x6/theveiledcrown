import { beginLoading } from './loading.js';
import { RemoteClient } from './transport.js';
let activeSession = null,
  transport;
export const session = () => activeSession;
export const store = {
  drafts: {},
  remoteRevision: 0,
  current: () => ({ id: transport?.campaignId || 'portal' })
};
export const saveSession = (data) => {
  activeSession = data;
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
  { method = 'GET', data, allowUnauthorized = false, silent = false } = {}
) {
  if (!transport) throw new Error('A conexão da campanha ainda não foi inicializada.');
  const controller = new AbortController();
  const done = silent
    ? () => {}
    : beginLoading(method === 'GET' ? 'Carregando a crônica…' : 'Salvando na crônica…', () =>
        controller.abort()
      );
  try {
    const result = await transport.request(path, {
      method,
      data,
      token: activeSession?.token,
      signal: controller.signal
    });
    store.remoteRevision = transport.store.remoteRevision;
    if (method !== 'GET') window.dispatchEvent(new CustomEvent('portal:saved'));
    return result;
  } catch (error) {
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
