import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  out = resolve(root, 'dist');
let apiBase = '';
if (process.env.COROA_API_BASE) {
  const u = new URL(process.env.COROA_API_BASE);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.pathname !== '/' ||
    u.search ||
    u.hash
  )
    throw new Error('COROA_API_BASE deve ser a origem HTTPS da API no Render.');
  apiBase = u.origin;
}
if (process.env.VERCEL && !apiBase)
  throw new Error(
    'Configure COROA_API_BASE no Vercel com o endereço HTTPS do Render e refaça o deploy.'
  );
await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, 'assets/styles'), { recursive: true });
await mkdir(resolve(out, 'assets/scripts'), { recursive: true });
await cp(resolve(root, 'public/images'), resolve(out, 'assets/images'), { recursive: true });
for (const name of ['base', 'theme', 'hub', 'experience'])
  await cp(resolve(root, 'client', name + '.css'), resolve(out, 'assets/styles', name + '.css'));
await build({
  entryPoints: [resolve(root, 'client/main.js')],
  outfile: resolve(out, 'assets/scripts/app.js'),
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'safari16', 'firefox115'],
  minify: true,
  legalComments: 'eof',
  platform: 'browser'
});
await writeFile(
  resolve(out, 'runtime-config.js'),
  apiBase
    ? `window.COROA_CONFIG=${JSON.stringify({ apiBase })};\n`
    : 'window.COROA_CONFIG={apiBase:window.location.origin};\n'
);
const csp = `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${apiBase ? ' ' + apiBase : ''}; object-src 'none'; base-uri 'self'; form-action 'none'`;
const html = (await readFile(resolve(root, 'client/index.html'), 'utf8')).replace(
  '<meta name="description"',
  `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="description"`
);
await writeFile(resolve(out, 'index.html'), html);
console.log('Coroa Velada 6 online compilada em dist/.');
