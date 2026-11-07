import { publicOrigin, socialMetadata } from './site-metadata.mjs';
import { themeCSS, themeVariables } from './theme-css.mjs';
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
await cp(resolve(root, 'public/branding'), out, { recursive: true });
const siteOrigin = publicOrigin(process.env);
await writeFile(
  resolve(out, 'site.webmanifest'),
  JSON.stringify({
    id: '/',
    name: 'A Coroa Velada',
    short_name: 'Coroa Velada',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#08090c',
    theme_color: '#d92343',
    description: 'Suas campanhas e personagens, além do véu.',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  })
);
await writeFile(
  resolve(out, 'robots.txt'),
  'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n' +
    (siteOrigin ? 'Sitemap: ' + siteOrigin + '/sitemap.xml\n' : '')
);
if (siteOrigin)
  await writeFile(
    resolve(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteOrigin}/</loc></url></urlset>`
  );
for (const name of ['base', 'theme', 'hub', 'experience', 'updates', 'expansion', 'beta', 'creation'])
  await writeFile(
    resolve(out, 'assets/styles', name + '.css'),
    themeCSS(await readFile(resolve(root, 'client', name + '.css'), 'utf8'))
  );
await writeFile(resolve(out, 'assets/styles/theme-vars.css'), themeVariables());
await cp(
  resolve(root, 'node_modules/leaflet/dist/leaflet.css'),
  resolve(out, 'assets/styles/leaflet.css')
);
await cp(resolve(root, 'node_modules/leaflet/dist/images'), resolve(out, 'assets/styles/images'), {
  recursive: true
});
await cp(resolve(root, 'node_modules/ol/ol.css'), resolve(out, 'assets/styles/geographic.css'));
await build({
  entryPoints: [resolve(root, 'client/geographic.js')],
  outfile: resolve(out, 'assets/scripts/geographic.js'),
  bundle: true,
  format: 'esm',
  target: ['chrome110', 'safari16', 'firefox115'],
  minify: true,
  legalComments: 'eof',
  platform: 'browser'
});
await build({
  entryPoints: [resolve(root, 'client/main.js')],
  outfile: resolve(out, 'assets/scripts/app.js'),
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'safari16', 'firefox115'],
  minify: true,
  legalComments: 'eof',
  platform: 'browser',
  external: ['/assets/scripts/geographic.js']
});
await writeFile(
  resolve(out, 'runtime-config.js'),
  'window.COROA_CONFIG={apiBase:window.location.origin};\n'
);
const csp = `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`;
const html = (await readFile(resolve(root, 'client/index.html'), 'utf8'))
  .replace(/<meta name="description"[^>]*>/, socialMetadata(siteOrigin))
  .replace(
    '<meta name="description"',
    `<meta http-equiv="Content-Security-Policy" content="${csp}; manifest-src 'self'"><meta name="description"`
  );
await writeFile(resolve(out, 'index.html'), html);
console.log('Coroa Velada 9 online compilada em dist/.');
