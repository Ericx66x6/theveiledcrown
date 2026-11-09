import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
let qa = false;
try {
  await access('.qa/enabled');
  qa = true;
} catch {}
if (!qa) {
  await import('../server/index.mjs');
} else {
  const { build } = await import('esbuild');
  const { previewFixture } = await import('../tests/preview/fixture.mjs');
  const { previewRepository } = await import('../tests/preview/repository.mjs');
  const { createPortalServer } = await import('../server/app.mjs');
  await import('./build.mjs');
  const { root, identities } = await previewFixture();
  const out = resolve('.qa/static');
  await mkdir(out, { recursive: true });
  await cp('dist', out, { recursive: true });
  await writeFile(
    resolve(out, 'identities.js'),
    'window.COROA_QA_IDENTITIES=' + JSON.stringify(identities) + ';'
  );
  const html = await readFile('dist/index.html', 'utf8');
  for (const role of ['admin', 'player']) {
    await build({
      stdin: {
        contents: `import {startApp} from './client/app.js';import {api,initialize,saveSession} from './client/api.js';(async()=>{const identity=window.COROA_QA_IDENTITIES.${role};await initialize();saveSession(identity);await api('/auth/me');await startApp({identity});})();`,
        resolveDir: process.cwd(),
        sourcefile: 'preview-entry.js'
      },
      bundle: true,
      format: 'iife',
      outfile: resolve(out, role + '.js'),
      target: 'es2022',
      external: ['/assets/scripts/geographic.js']
    });
    await writeFile(
      resolve(out, role + '.html'),
      html.replace(
        '<script src="assets/scripts/app.js" defer></script>',
        `<script src="identities.js" defer></script><script src="${role}.js" defer></script>`
      )
    );
  }
  await writeFile(
    resolve(out, 'mobile.html'),
    `<!doctype html><html><head><meta charset="utf-8"><title>QA mobile · Online</title><style>body{margin:0;background:#120a0f;color:#f2c2d6;font:13px system-ui;display:flex;flex-direction:column;align-items:center;padding:16px;gap:14px}button{padding:10px;border:1px solid #77324e;background:#2c1422;color:#ffd1e3}iframe{width:390px;height:844px;border:1px solid #70314b;max-width:100%}</style><script src="mobile.js" defer></script></head><body><header>QA online <button data-width="360">360px</button><button data-width="390">390px</button><button data-page="admin">Narrador</button><button data-page="player">Jogador</button></header><iframe src="admin.html" title="Portal online em celular"></iframe></body></html>`
  );
  await writeFile(
    resolve(out, 'mobile.js'),
    `document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>document.querySelector('iframe').style.width=b.dataset.width+'px');document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>document.querySelector('iframe').src=b.dataset.page+'.html');`
  );
  const { repository, close } = await previewRepository(root);
  // Optional disposable QA latency, never loaded by npm start.
  let saveDelay = 0;
  try {
    saveDelay = Math.min(
      5000,
      Math.max(0, Number(await readFile('.qa/save-delay-ms', 'utf8')) || 0)
    );
  } catch {}
  if (saveDelay) {
    const save = repository.save.bind(repository);
    repository.save = async (...args) => {
      await new Promise((r) => setTimeout(r, saveDelay));
      return save(...args);
    };
  }
  const server = createPortalServer({
    repository,
    bootstrapToken: 'instalacao-ficticia-da-previa-0123456789',
    staticDir: out,
    allowSameOriginFrames: true
  });
  server.on('close', close);
  server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () =>
    console.log('Prévia HTTP com dados fictícios.')
  );
}
