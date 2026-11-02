export class RemoteClient {
  constructor(base) {
    const url = new URL(base, globalThis.location?.href || base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Endereço de API inválido.');
    this.base = url.origin;
    this.token = null;
    this.campaignId = null;
    this.store = { remoteRevision: 0 };
  }
  clear() {
    this.token = null;
    this.campaignId = null;
  }

  async request(path, { method = 'GET', data, token } = {}) {
    const url = new URL(this.base + path);
    if (method === 'GET' && data) url.searchParams.set('data', JSON.stringify(data));
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (this.campaignId) headers['X-Campaign-ID'] = this.campaignId;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(data || {}),
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(90000)
      });
    } catch {
      throw new Error(
        'Conexão indisponível. Atualize antes de repetir uma alteração para conferir se ela foi salva.'
      );
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('A API retornou uma resposta incompatível.');
    }
    if (!response.ok) {
      const error = new Error(result.error || 'Não foi possível concluir a ação.');
      error.status = response.status;
      throw error;
    }
    const revision = Number(response.headers.get('X-Portal-Revision'));
    if (Number.isSafeInteger(revision)) this.store.remoteRevision = revision;
    if (result?.token) {
      this.token = result.token;
      this.campaignId = result.campaign_id || null;
    }
    if (path.endsWith('/select') && result.campaign) this.campaignId = result.campaign;
    return result;
  }
}
