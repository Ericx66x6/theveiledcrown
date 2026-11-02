import { externalizeMedia, hydrateMedia } from './media.mjs';
import { workspaceDocuments, assembleDocuments } from '../core/documents.js';
import { validateWorkspace } from '../core/workspace.js';
import { normalizeRoot } from '../core/campaign-shape.js';
const copy = (v) => structuredClone(v);
export class Conflict extends Error {
  constructor() {
    super('A campanha mudou em outra conexão. Atualize antes de repetir a ação.');
    this.status = 409;
  }
}
export class MemoryRepository {
  constructor(seed) {
    this.value = { revision: 0, root: copy(seed) };
  }
  async load() {
    return copy(this.value);
  }
  async save(root, expected) {
    if (this.value.revision !== expected) throw new Conflict();
    this.value = { revision: expected + 1, root: copy(root) };
    return expected + 1;
  }
}
export class SupabaseRepository {
  constructor({ url, key, seed, media, fetcher = fetch }) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/'
    )
      throw new Error('SUPABASE_URL deve ser a origem HTTPS do projeto.');
    if (!key || key.startsWith('sb_publishable_'))
      throw new Error('Configure a chave privada do Supabase no servidor.');
    this.url = parsed.origin;
    this.key = key;
    this.seed = seed;
    this.media = media;
    this.fetcher = fetcher;
  }
  async rpc(name, body = {}) {
    let response;
    try {
      response = await this.fetcher(this.url + '/rest/v1/rpc/' + name, {
        method: 'POST',
        headers: {
          apikey: this.key,
          ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + this.key }),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      const e = new Error(
        'Não foi possível confirmar o salvamento no banco. Atualize a página antes de repetir.'
      );
      e.status = 503;
      throw e;
    }
    if (!response.ok) {
      let detail;
      try {
        detail = await response.json();
      } catch {}
      if (detail?.code === '40001') throw new Conflict();
      const e = new Error(
        'O banco não respondeu como esperado. Confira a configuração e a migração SQL.'
      );
      e.status = 503;
      throw e;
    }
    return response.json();
  }
  async load() {
    const value = await this.rpc('coroa_load_state');
    if (!value || !Number.isSafeInteger(value.revision))
      throw new Error('Resposta de banco incompatível.');
    if (!value.documents?.['portal.json'])
      return { revision: value.revision, root: copy(this.seed) };
    const documents = this.media
      ? await hydrateMedia(value.documents, this.media)
      : value.documents;
    const assembled = assembleDocuments(documents);
    const root = assembled.accounts.length
      ? validateWorkspace(assembled)
      : normalizeRoot(assembled);
    root.sessions = copy(value.documents['__server/sessions.json']?.sessions || []);
    return { revision: value.revision, root };
  }
  async save(root, expected) {
    const raw = workspaceDocuments(root);
    const documents = this.media ? await externalizeMedia(raw, this.media) : raw;
    documents['__server/sessions.json'] = { sessions: root.sessions || [] };
    const revision = await this.rpc('coroa_save_state', {
      p_expected_revision: expected,
      p_documents: documents
    });
    if (!Number.isSafeInteger(revision)) throw new Error('Revisão de banco incompatível.');
    return revision;
  }
}
