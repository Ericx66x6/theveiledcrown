import { externalizeMedia, referenceMedia } from './media.mjs';
import { workspaceDocuments } from '../core/documents.js';
import { validateWorkspace } from '../core/workspace.js';
import { normalizeRoot } from '../core/campaign-shape.js';
import { storageDocuments, assembleStorage, canonicalJSON } from './storage-documents.mjs';
const copy = (v) => structuredClone(v);
export class Conflict extends Error {
  constructor() {
    super('A campanha mudou em outra conexão. Atualize antes de repetir a ação.');
    this.status = 409;
  }
}
export class MemoryRepository {
  constructor(seed) {
    this.seed = copy(seed);
    this.value = { revision: 0, root: copy(seed) };
  }
  async load({ readOnly = false } = {}) {
    return readOnly ? this.value : copy(this.value);
  }
  async save(root, expected) {
    if (this.value.revision !== expected) throw new Conflict();
    this.value = { revision: expected + 1, root: copy(root) };
    return expected + 1;
  }
}
export class SupabaseRepository {
  constructor({ url, key, seed, media, fetcher = fetch, cacheMs = 750, now = Date.now }) {
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
    this.cacheMs = cacheMs;
    this.now = now;
    this.cache = null;
    this.documents = Object.create(null);
    this.encoded = new Map();
    this.checkedAt = 0;
    this.refreshing = null;
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
      if (detail?.code === 'PGRST202' || detail?.code === '42883')
        throw Object.assign(
          new Error(
            'A atualização SQL da versão 10.0 ainda não foi aplicada no Supabase. Execute a migração indicada no tutorial.'
          ),
          { status: 503, code: 'MIGRATION_REQUIRED' }
        );
      const e = new Error(
        'O banco não respondeu como esperado. Confira a configuração e a migração SQL.'
      );
      e.status = 503;
      throw e;
    }
    return response.json();
  }
  async refresh() {
    const known = this.cache?.revision ?? -1;
    const value = await this.rpc('coroa_poll_state', { p_known_revision: known });
    if (!value || !Number.isSafeInteger(value.revision))
      throw new Error('Resposta de banco incompatível.');
    // An earlier read may complete after our own durable commit. Never rewind it.
    if (this.cache && value.revision < this.cache.revision && !value.full) return;
    if (this.cache && value.revision === this.cache.revision) {
      this.checkedAt = this.now();
      return;
    }
    const documents = value.full
      ? Object.assign(Object.create(null), value.documents)
      : { ...this.documents, ...value.documents };
    for (const path of value.deleted || []) delete documents[path];
    if (!documents['portal.json']) {
      this.documents = documents;
      this.encoded = new Map();
      this.cache = { revision: value.revision, root: copy(this.seed) };
      this.checkedAt = this.now();
      return;
    }
    const assembled = assembleStorage(
      this.media ? referenceMedia(documents, this.media) : documents,
      value.revision
    );
    const sessions = copy(assembled.sessions || []);
    const root = assembled.accounts.length
      ? validateWorkspace(assembled)
      : normalizeRoot(assembled);
    root.sessions = sessions;
    root.revision = value.revision;
    this.documents = documents;
    this.encoded = new Map(
      Object.entries(documents).map(([path, doc]) => [path, canonicalJSON(doc)])
    );
    this.cache = { revision: value.revision, root };
    this.checkedAt = this.now();
  }
  async load({ fresh = false, readOnly = false } = {}) {
    if (!this.cache || fresh || this.now() - this.checkedAt >= this.cacheMs) {
      this.refreshing ??= this.refresh().finally(() => {
        this.refreshing = null;
      });
      await this.refreshing;
    }
    return readOnly ? this.cache : copy(this.cache);
  }
  async save(root, expected) {
    if (!this.cache) await this.load({ fresh: true });
    if (expected !== this.cache.revision) throw new Conflict();
    const raw = storageDocuments(root);
    const documents = this.media ? await externalizeMedia(raw, this.media) : raw;
    const upserts = Object.create(null),
      encoded = new Map();
    for (const [path, doc] of Object.entries(documents)) {
      const json = canonicalJSON(doc);
      encoded.set(path, json);
      if (json !== this.encoded.get(path)) upserts[path] = doc;
    }
    const removed = Object.keys(this.documents).filter((path) => !Object.hasOwn(documents, path));
    if (!Object.keys(upserts).length && !removed.length) return expected;
    let revision;
    try {
      revision = await this.rpc('coroa_commit_documents', {
        p_expected_revision: expected,
        p_upserts: upserts,
        p_deleted_paths: removed
      });
    } catch (error) {
      this.checkedAt = -Infinity;
      throw error;
    }
    if (!Number.isSafeInteger(revision)) throw new Error('Revisão de banco incompatível.');
    this.documents = documents;
    this.encoded = encoded;
    // Cache only a successful database commit, with compact image references.
    const saved = this.media ? referenceMedia(documents, this.media) : documents;
    const assembled = assembleStorage(saved, revision);
    this.cache = { revision, root: assembled };
    this.checkedAt = this.now();
    return revision;
  }
  async saveLegacy(root, expected) {
    const docs = workspaceDocuments(root);
    docs['__server/sessions.json'] = { sessions: root.sessions || [] };
    const documents = this.media ? await externalizeMedia(docs, this.media) : docs;
    const revision = await this.rpc('coroa_save_state', {
      p_expected_revision: expected,
      p_documents: documents
    });
    this.cache = null;
    this.checkedAt = 0;
    return revision;
  }
}
