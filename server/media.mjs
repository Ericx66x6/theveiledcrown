import { createHash } from 'node:crypto';
const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const pathPattern = /^portal-v6\/media\/([a-f0-9]{64})\.(jpg|png|webp)$/;
function failure(message) {
  return Object.assign(new Error(message), { status: 503 });
}
function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function info(data) {
  const match = data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match || data.length > 45000000) throw failure('Imagem incompatível com o armazenamento.');
  const mime = MIME[match[1]],
    bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 45 * 1024 * 1024)
    throw failure('Imagem maior que o limite do armazenamento.');
  const valid =
    mime === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216
      : mime === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid) throw failure('O conteúdo da imagem não corresponde ao formato informado.');
  const sha = digest(bytes);
  return {
    bytes,
    ref: { path: `portal-v6/media/${sha}.${EXT[mime]}`, sha256: sha, mime, size: bytes.length }
  };
}
function reference(value) {
  return value && typeof value === 'object' && Object.hasOwn(value, '_coroa_media');
}
function validateRef(ref) {
  if (
    !ref ||
    !pathPattern.test(ref.path || '') ||
    !EXT[ref.mime] ||
    pathPattern.exec(ref.path)[1] !== ref.sha256 ||
    !ref.path.endsWith('.' + EXT[ref.mime]) ||
    !Number.isInteger(ref.size) ||
    ref.size < 1 ||
    ref.size > 45 * 1024 * 1024
  )
    throw failure('Referência de imagem inválida.');
}
export class SupabaseMedia {
  constructor({ url, key, bucket = 'coroa-imagens', fetcher = fetch }) {
    this.url = new URL(url).origin;
    this.key = key;
    this.bucket = bucket;
    this.fetcher = fetcher;
    this.cache = new Map();
    this.cacheBytes = 0;
    if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(bucket)) throw new Error('Nome de bucket inválido.');
  }
  headers() {
    return {
      apikey: this.key,
      ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + this.key })
    };
  }
  async send(path, options = {}) {
    try {
      return await this.fetcher(this.url + '/storage/v1/' + path, {
        ...options,
        headers: { ...this.headers(), ...options.headers },
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      throw failure('Não foi possível acessar as imagens da campanha.');
    }
  }
  async checkBucket() {
    const r = await this.send('bucket/' + encodeURIComponent(this.bucket));
    if (!r.ok) throw failure('Crie o bucket privado coroa-imagens com o SQL de instalação.');
    const bucket = await r.json();
    if (bucket.public !== false) throw failure('O bucket de imagens precisa ser privado.');
  }
  remember(ref, data) {
    const before = this.cache.get(ref.path);
    if (before) this.cacheBytes -= before.bytes;
    this.cache.delete(ref.path);
    this.cache.set(ref.path, { data, bytes: data.length });
    this.cacheBytes += data.length;
    while (this.cacheBytes > 64 * 1024 * 1024 || this.cache.size > 256) {
      const key = this.cache.keys().next().value;
      this.cacheBytes -= this.cache.get(key).bytes;
      this.cache.delete(key);
    }
  }
  async put(data) {
    const { bytes, ref } = info(data);
    if (!this.cache.has(ref.path)) {
      const response = await this.send(
        'object/' + encodeURIComponent(this.bucket) + '/' + ref.path,
        { method: 'POST', headers: { 'Content-Type': ref.mime, 'x-upsert': 'true' }, body: bytes }
      );
      if (!response.ok)
        throw failure('Não foi possível salvar a imagem. Confira o bucket e seus limites.');
      this.remember(ref, data);
    }
    return ref;
  }
  async get(ref) {
    validateRef(ref);
    const cached = this.cache.get(ref.path);
    if (cached) {
      this.cache.delete(ref.path);
      this.cache.set(ref.path, cached);
      return cached.data;
    }
    const response = await this.send('object/' + encodeURIComponent(this.bucket) + '/' + ref.path);
    if (!response.ok) throw failure('Uma imagem da campanha não foi encontrada.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== ref.size || digest(bytes) !== ref.sha256)
      throw failure('A imagem armazenada não corresponde à referência.');
    const data = `data:${ref.mime};base64,${bytes.toString('base64')}`;
    this.remember(ref, data);
    return data;
  }
}
export async function externalizeMedia(value, media) {
  if (typeof value === 'string' && value.startsWith('data:image/'))
    return { _coroa_media: await media.put(value) };
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) result.push(await externalizeMedia(item, media));
    return result;
  }
  if (value && typeof value === 'object') {
    const result = Object.create(null);
    for (const [key, item] of Object.entries(value))
      result[key] = await externalizeMedia(item, media);
    return result;
  }
  return value;
}
export async function hydrateMedia(value, media) {
  if (reference(value)) {
    validateRef(value._coroa_media);
    return media.get(value._coroa_media);
  }
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) result.push(await hydrateMedia(item, media));
    return result;
  }
  if (value && typeof value === 'object') {
    const result = Object.create(null);
    for (const [key, item] of Object.entries(value)) result[key] = await hydrateMedia(item, media);
    return result;
  }
  return value;
}
