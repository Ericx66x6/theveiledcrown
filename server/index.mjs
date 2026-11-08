import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CampaignStore } from '../core/store.js';
import { documentSeed } from '../core/model.js';
import { gameSettings } from '../core/settings.js';
import { SupabaseRepository } from './repository.mjs';
import { SupabaseMedia } from './media.mjs';
import { createPortalServer } from './app.mjs';
const game = gameSettings(
  JSON.parse(await readFile(new URL('../data/game_data.json', import.meta.url), 'utf8'))
);
const seed = await (await new CampaignStore(documentSeed(game)).open()).workspace();
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY no Render.');
const media = new SupabaseMedia({
  url,
  key,
  bucket: process.env.SUPABASE_IMAGE_BUCKET || 'coroa-imagens'
});
const repository = new SupabaseRepository({ url, key, seed, media });
await media.checkBucket();
const server = createPortalServer({
  repository,
  bootstrapToken: process.env.BOOTSTRAP_TOKEN,
  staticDir: resolve('dist'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1'
});
await repository.load();
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () =>
  console.log('A Coroa Velada 9.2.1 · servidor iniciado.')
);
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
