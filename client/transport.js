export class RemoteClient {
  constructor(base) {
    const url = new URL(base, globalThis.location?.href || base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Endereço de API inválido.');
    this.base = url.origin;
    this.token = null;
    this.campaignId = null;
    this.playerTestId = null;
    this.store = { remoteRevision: 0 };
    this.viewCache = null;
    this.pendingState = null;
    this.epoch = 0;
    this.protocol = 0;
    this.revisionScope = null;
  }
  clear() {
    this.epoch++;
    this.protocol = 0;
    this.revisionScope = null;
    this.store.remoteRevision = 0;
    this.viewCache = null;
    this.pendingState = null;
    this.token = null;
    this.campaignId = null;
    this.playerTestId = null;
  }

  async request(path, { method = 'GET', data, token, signal } = {}) {
    const playerTestId = this.playerTestId,
      campaignId = this.campaignId,
      epoch = this.epoch;
    const url = new URL(this.base + path);
    if (method === 'GET' && data) url.searchParams.set('data', JSON.stringify(data));
    const headers = {
      'Content-Type': 'application/json',
      'X-Coroa-Client': '10',
      ...(globalThis.location ? { 'X-Portal-Session': 'cookie' } : {})
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (this.campaignId) headers['X-Campaign-ID'] = this.campaignId;
    if (playerTestId) headers['X-Player-Test'] = playerTestId;
    const withView =
      this.protocol === 10 &&
      method !== 'GET' &&
      path.startsWith('/api/') &&
      this.viewCache &&
      !playerTestId &&
      !/\/api\/(media\/portable|json\/replace|admin\/reset|campaigns|player-test|admin\/snapshots\/restore)/.test(
        path
      );
    const body = withView ? { ...data, __portal_view: this.viewCache } : data;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
          : AbortSignal.timeout(90000)
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
    if (
      this.playerTestId !== playerTestId ||
      this.epoch !== epoch ||
      this.campaignId !== campaignId
    )
      throw Object.assign(new Error('A visão do portal foi alterada.'), {
        code: 'PLAYER_TEST_CONTEXT_CHANGED'
      });
    if (!response.ok) {
      const error = new Error(result.error || 'Não foi possível concluir a ação.');
      error.status = response.status;
      error.code = result.code;
      throw error;
    }
    this.protocol = response.headers.get('X-Coroa-Protocol') === '10' ? 10 : 0;
    const revision = Number(response.headers.get('X-Portal-Revision'));
    if (Number.isSafeInteger(revision)) {
      const scope = [epoch, campaignId, playerTestId].join('|');
      this.store.remoteRevision =
        this.revisionScope === scope ? Math.max(this.store.remoteRevision, revision) : revision;
      this.revisionScope = scope;
    }
    if (result?._coroa_update === 10) {
      if (!this.pendingState || revision >= this.pendingState.revision)
        this.pendingState = { payload: result.state, view: result.view, revision };
      result = result.result;
    }
    if (result?.token) {
      this.token = result.token;
      this.campaignId = result.campaign_id || null;
    }
    if (result && Object.hasOwn(result, 'campaign_id'))
      this.campaignId = result.campaign_id || null;
    if (path.endsWith('/select') && result.campaign) {
      this.campaignId = result.campaign;
      this.viewCache = null;
      this.pendingState = null;
    }
    return result;
  }
  takePortalState(request) {
    const pending = this.pendingState;
    this.pendingState = null;
    if (
      !pending ||
      pending.payload.account.id !== request.known_account_id ||
      pending.payload.campaign.id !== request.known_campaign_id ||
      pending.view.character_id !== request.character_id ||
      pending.view.archived !== request.archived
    )
      return null;
    return pending.payload;
  }
}
