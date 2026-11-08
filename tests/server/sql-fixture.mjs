import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export async function sqlFixture({ latencyMs = 0 } = {}) {
  const db = new PGlite();
  const calls = [];
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for (const file of ['202611010001_portal_json.sql', '202611080001_incremental_v10.sql'])
    await db.exec(
      await readFile(new URL('../../supabase/migrations/' + file, import.meta.url), 'utf8')
    );
  await db.exec('set role service_role');
  const fetcher = async (url, options) => {
    const name = new URL(url).pathname.split('/').at(-1),
      args = JSON.parse(options.body);
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    try {
      let q;
      if (name === 'coroa_poll_state')
        q = await db.query('select public.coroa_poll_state($1) as result', [args.p_known_revision]);
      else if (name === 'coroa_commit_documents')
        q = await db.query(
          'select public.coroa_commit_documents($1,$2::jsonb,$3::jsonb) as result',
          [
            args.p_expected_revision,
            JSON.stringify(args.p_upserts),
            JSON.stringify(args.p_deleted_paths)
          ]
        );
      else if (name === 'coroa_save_state')
        q = await db.query('select public.coroa_save_state($1,$2::jsonb) as result', [
          args.p_expected_revision,
          JSON.stringify(args.p_documents)
        ]);
      else if (name === 'coroa_load_state')
        q = await db.query('select public.coroa_load_state() as result');
      else throw new Error('Unexpected RPC ' + name);
      const body = JSON.stringify(q.rows[0].result);
      calls.push({
        name,
        args,
        upload: Buffer.byteLength(options.body),
        download: Buffer.byteLength(body)
      });
      return new Response(body, { status: 200 });
    } catch (e) {
      calls.push({ name, error: e.code });
      return Response.json({ code: e.code || 'unknown', message: e.message }, { status: 500 });
    }
  };
  return { db, calls, fetcher, close: () => db.close() };
}
