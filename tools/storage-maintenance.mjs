import { readFile } from 'node:fs/promises';
import { SupabaseRepository } from '../server/repository.mjs';
import { SupabaseMedia } from '../server/media.mjs';
import { CampaignStore } from '../core/store.js';
import { documentSeed } from '../core/model.js';
import { gameSettings } from '../core/settings.js';
const action = process.argv[2];
if (!['migrate', 'legacy'].includes(action)) throw new Error('Use migrate ou legacy.');
if (process.env.COROA_MAINTENANCE !== '1')
  throw new Error('Ative COROA_MAINTENANCE=1 no servidor e neste terminal antes da conversão.');
if (action === 'legacy' && !process.argv.includes('--confirm-legacy'))
  throw new Error('Confirme a conversão para a versão anterior com --confirm-legacy.');
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    'Configure as variáveis existentes do Supabase no ambiente ou no .env local ignorado pelo Git.'
  );
const game = gameSettings(
  JSON.parse(await readFile(new URL('../data/game_data.json', import.meta.url), 'utf8'))
);
const seed = await new CampaignStore(documentSeed(game)).workspace();
const media = new SupabaseMedia({
  url,
  key,
  bucket: process.env.SUPABASE_IMAGE_BUCKET || 'coroa-imagens'
});
const repository = new SupabaseRepository({ url, key, seed, media });
await media.checkBucket();
const loaded = await repository.load({ fresh: true });
if (!loaded.root.accounts.length)
  throw new Error(
    'O portal não contém contas. Este comando é para atualizar uma instalação existente.'
  );
const revision =
  action === 'legacy'
    ? await repository.saveLegacy(loaded.root, loaded.revision)
    : await repository.save(loaded.root, loaded.revision);
console.log(
  JSON.stringify({
    status: 'concluido',
    format: action === 'legacy' ? 'v4 compatível com 9.3.1 e 10.0' : 'incremental v10.1',
    revision,
    campaigns: loaded.root.campaigns.length,
    characters: loaded.root.campaigns.reduce((n, c) => n + c.characters.length, 0),
    accounts: loaded.root.accounts.length
  })
);
if (action === 'legacy')
  console.log(
    'Publique o backend anterior compatível com v4 antes de desativar a manutenção. Nenhum ponto, personagem ou conta foi reiniciado.'
  );
