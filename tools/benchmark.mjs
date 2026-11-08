import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { portalFixture } from '../tests/domain/fixture-v8.mjs';
import { sqlFixture } from '../tests/server/sql-fixture.mjs';
const args = process.argv.slice(2),
  argument = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const latency = Number(argument('--latency', '10'));
if (!Number.isFinite(latency) || latency < 0 || latency > 1000)
  throw new Error('Use latência entre 0 e 1000 ms.');
const baseline = argument('--baseline'),
  out = argument('--out');
const f = await portalFixture(),
  seed = await f.store.workspace(),
  campaign = seed.campaigns[0];
const image =
  'data:image/jpeg;base64,' +
  (await readFile(new URL('../public/images/coroa-night.jpg', import.meta.url))).toString('base64');
for (let i = 0; i < 10; i++) {
  const p = structuredClone(campaign.characters[i % 2]);
  p.id = 700000 + i;
  p.char = 'Personagem de aferição ' + i;
  campaign.characters.push(p);
}
for (const p of campaign.characters) {
  p.profilepicture = image;
  p.history = Array.from({ length: 30 }, (_, i) => ({
    id: randomUUID(),
    at: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
    actor: 'Narrador fictício',
    actor_id: f.admin.account.id,
    action: 'História de teste',
    details: 'Um registro fictício para medir a transferência da ficha. '.repeat(5)
  }));
}
campaign.maps = Array.from({ length: 4 }, (_, i) => ({
  id: 'mapa-bench-' + i,
  title: 'Mapa ' + i,
  image,
  width: 1800,
  height: 900,
  mode: 'image',
  description: 'Mapa fictício',
  player_access: true,
  _revision: 0,
  scale: null,
  character_markers: [],
  pins: Array.from({ length: 8 }, (_, n) => ({
    id: 'pin-' + n,
    title: 'Lugar ' + n,
    x: 0.2,
    y: 0.3,
    visibility: 'campaign',
    description: 'Um local de teste.',
    images: [image],
    npcs: []
  }))
}));
campaign.snapshots = Array.from({ length: 30 }, (_, i) => ({
  id: randomUUID(),
  at: new Date().toISOString(),
  kind: 'character',
  character_id: campaign.characters[i % 12].id,
  data: structuredClone(campaign.characters[i % 12])
}));
for (const a of seed.accounts) a.avatar = image;
const samples = [];
async function run(label, source) {
  const module = (path) => import(pathToFileURL(resolve(source, path)).href);
  const [{ SupabaseRepository }, { SupabaseMedia }, { createPortalServer }] = await Promise.all([
    module('server/repository.mjs'),
    module('server/media.mjs'),
    module('server/app.mjs')
  ]);
  const sql = await sqlFixture({ latencyMs: latency }),
    objects = new Map();
  let mediaGets = 0;
  const makeMedia = () =>
    new SupabaseMedia({
      url: 'https://example.supabase.co',
      key: 'sb_secret_test',
      fetcher: async (url, options) => {
        const path = new URL(url).pathname;
        if (latency) await new Promise((r) => setTimeout(r, latency));
        if (options.method === 'POST') {
          objects.set(path, Buffer.from(options.body));
          return Response.json({ ok: true });
        }
        mediaGets++;
        return objects.has(path)
          ? new Response(objects.get(path))
          : new Response('', { status: 404 });
      }
    });
  const config = (media) => ({
    url: 'https://example.supabase.co',
    key: 'sb_secret_test',
    seed,
    media,
    fetcher: sql.fetcher
  });
  const setup = new SupabaseRepository(config(makeMedia()));
  await setup.load();
  await setup.save(seed, 0);
  const repository = new SupabaseRepository(config(makeMedia()));
  const server = createPortalServer({
    repository,
    bootstrapToken: 'chave-ficticia-benchmark-0123456789'
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, method = 'GET', data) => {
    const url = new URL(base + path);
    if (method === 'GET' && data) url.searchParams.set('data', JSON.stringify(data));
    const at = performance.now(),
      r = await fetch(url, {
        method,
        headers: {
          Authorization: 'Bearer ' + f.admin.token,
          'X-Campaign-ID': f.campaign,
          'X-Coroa-Client': '10',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip'
        },
        body: method === 'GET' ? undefined : JSON.stringify(data || {})
      });
    const text = await r.text();
    if (!r.ok) throw new Error(text);
    return {
      ms: performance.now() - at,
      body: JSON.parse(text),
      bytes: Number(r.headers.get('content-length')) || Buffer.byteLength(text)
    };
  };
  const startCalls = sql.calls.length,
    at = performance.now();
  let state = (await request('/api/portal-state')).body;
  const cold = performance.now() - at,
    coldImageRequests = mediaGets;
  const view = () => ({
    incremental: true,
    character_id: 234567,
    archived: false,
    known_campaign_id: f.campaign,
    known_account_id: f.admin.account.id,
    known_game_revision: state.game._revision,
    known_character_revisions: Object.fromEntries(state.players.map((p) => [p.id, p._revision]))
  });
  const initial = (await request('/api/portal-state')).bytes;
  const warm = [];
  let warmBytes = 0;
  for (let i = 0; i < 4; i++) {
    const r = await request('/api/portal-state', 'GET', view());
    warm.push(r.ms);
    warmBytes += r.bytes;
  }
  const saveAt = sql.calls.length,
    saves = [];
  let saveHttp = 0,
    saveResponseBytes = 0;
  for (let i = 0; i < 4; i++) {
    const p = state.players.find((p) => p.id === 234567),
      at = performance.now();
    const response = await request('/api/characters/234567/money', 'POST', {
      revision: p._revision,
      delta: 1,
      reason: 'Aferição fictícia',
      __portal_view: view()
    });
    saveHttp++;
    saveResponseBytes += response.bytes;
    if (response.body._coroa_update === 10) {
      const result = response.body.result,
        payload = response.body.state;
      state = {
        ...state,
        ...payload,
        game: payload.game || state.game,
        players: state.players.map((p) => payload.players.find((n) => n.id === p.id) || p)
      };
      if (result.money !== p.money + 1) throw new Error('Saldo não corresponde ao commit.');
    } else {
      const refreshed = await request('/api/characters');
      saveHttp++;
      saveResponseBytes += refreshed.bytes;
      state.players = refreshed.body;
    }
    saves.push(performance.now() - at);
  }
  const writes = sql.calls
    .slice(saveAt)
    .filter((c) => ['coroa_commit_documents', 'coroa_save_state'].includes(c.name));
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const syncAt = sql.calls.length,
    sync = [];
  for (let i = 0; i < 4; i++) sync.push((await request('/api/sync')).ms);
  const report = {
    version: label,
    fixture: {
      characters: 12,
      maps: 4,
      pins: 32,
      snapshots: 30,
      history_per_character: 30,
      portrait_bytes: Buffer.byteLength(image)
    },
    simulated_rpc_latency_ms: latency,
    cold_portal_ms: Math.round(cold),
    cold_image_downloads: coldImageRequests,
    warm_portal_median_ms: Math.round(median(warm)),
    warm_portal_average_wire_bytes: Math.round(warmBytes / 4),
    full_portal_wire_bytes: initial,
    save_and_refresh_median_ms: Math.round(median(saves)),
    save_average_database_upload_bytes: Math.round(
      writes.reduce((n, c) => n + c.upload, 0) / writes.length
    ),
    save_average_http_requests: saveHttp / 4,
    save_average_response_wire_bytes: Math.round(saveResponseBytes / 4),
    sync_median_ms: Math.round(median(sync)),
    sync_database_calls: sql.calls.length - syncAt,
    requests_measured: sql.calls.length - startCalls
  };
  await new Promise((r) => server.close(r));
  await sql.close();
  return report;
}
try {
  if (baseline) samples.push(await run('9.3.1', resolve(baseline)));
  samples.push(await run('10.0.0', resolve(import.meta.dirname, '..')));
  const report = {
    generated_at: new Date().toISOString(),
    method:
      'Aferição HTTP local com PostgreSQL PGlite e latência RPC/Storage simulada. Dados fictícios; tempos não preveem a produção ou cold start do Render.',
    samples
  };
  if (out) await writeFile(resolve(out), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
}
