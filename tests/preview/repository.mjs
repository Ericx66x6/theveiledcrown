// Development only: real incremental SQL adapter and authenticated image routes,
// backed by disposable PostgreSQL/Storage fixtures. npm start never imports this.
import { sqlFixture } from '../server/sql-fixture.mjs';
import { SupabaseRepository } from '../../server/repository.mjs';
import { SupabaseMedia } from '../../server/media.mjs';
export async function previewRepository(root) {
  const sql = await sqlFixture(),
    objects = new Map();
  const media = new SupabaseMedia({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    fetcher: async (url, options) => {
      const path = new URL(url).pathname;
      if (path.includes('/bucket/')) return Response.json({ public: false });
      if (options.method === 'POST') {
        objects.set(path, Buffer.from(options.body));
        return Response.json({ ok: true });
      }
      return objects.has(path)
        ? new Response(objects.get(path))
        : new Response('', { status: 404 });
    }
  });
  const repository = new SupabaseRepository({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed: root,
    media,
    fetcher: sql.fetcher
  });
  await repository.load();
  await repository.save(root, 0);
  return { repository, close: () => sql.close() };
}
