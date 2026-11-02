import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseMedia, externalizeMedia, hydrateMedia } from '../../server/media.mjs';
const image = 'data:image/jpeg;base64,/9j/2Q==';
function fixture() {
  const objects = new Map(),
    calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, method: options.method || 'GET' });
    assert.equal(options.headers.apikey, 'sb_secret_test');
    assert.equal(options.headers.Authorization, undefined);
    const path = new URL(url).pathname;
    if (path.includes('/bucket/')) return Response.json({ id: 'coroa-imagens', public: false });
    if (options.method === 'POST') {
      objects.set(path, Buffer.from(options.body));
      return Response.json({ Key: path });
    }
    return objects.has(path) ? new Response(objects.get(path)) : new Response('', { status: 404 });
  };
  return {
    objects,
    calls,
    media: new SupabaseMedia({
      url: 'https://example.supabase.co',
      key: 'sb_secret_test',
      fetcher
    }),
    fetcher
  };
}
test('imagens são enviadas ao Storage privado e os documentos ficam com referências', async () => {
  const f = fixture();
  await f.media.checkBucket();
  const encoded = await externalizeMedia(
    { avatar: image, map: { image }, title: 'Campanha' },
    f.media
  );
  assert.equal(JSON.stringify(encoded).includes('data:image'), false);
  assert.match(encoded.avatar._coroa_media.path, /^portal-v6\/media\/[a-f0-9]{64}\.jpg$/);
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
  const cold = new SupabaseMedia({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    fetcher: f.fetcher
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await hydrateMedia(encoded, cold))), {
    avatar: image,
    map: { image },
    title: 'Campanha'
  });
});
test('bucket público é recusado e referências de caminho externo são bloqueadas', async () => {
  const publicMedia = new SupabaseMedia({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    fetcher: async () => Response.json({ public: true })
  });
  await assert.rejects(() => publicMedia.checkBucket(), /privado/);
  const f = fixture();
  await assert.rejects(
    () => hydrateMedia({ _coroa_media: { path: '../segredo' } }, f.media),
    /Referência/
  );
  assert.equal(f.calls.length, 0);
});
test('falha de upload e conteúdo incompatível não geram uma referência salva', async () => {
  const fail = new SupabaseMedia({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    fetcher: async () => new Response('', { status: 500 })
  });
  await assert.rejects(() => externalizeMedia(image, fail), /salvar/);
  await assert.rejects(() => externalizeMedia('data:image/png;base64,YWJj', fail), /conteúdo/);
});
test('imagem ausente ou com bytes alterados é recusada', async () => {
  const f = fixture(),
    encoded = await externalizeMedia(image, f.media),
    ref = encoded._coroa_media;
  const cold = new SupabaseMedia({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    fetcher: f.fetcher
  });
  f.objects.clear();
  await assert.rejects(() => cold.get(ref), /não foi encontrada/);
  f.objects.set('/storage/v1/object/coroa-imagens/' + ref.path, Buffer.from([255, 216, 0, 0]));
  await assert.rejects(() => cold.get(ref), /não corresponde/);
});
