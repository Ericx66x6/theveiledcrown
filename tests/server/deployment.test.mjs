import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
test('Vercel encaminha autenticação e API na mesma origem do site', async () => {
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {config} from './vercel.mjs';process.stdout.write(JSON.stringify(config));"
    ],
    {
      cwd: new URL('../..', import.meta.url),
      env: {
        PATH: process.env.PATH,
        VERCEL: '1',
        COROA_API_BASE: 'https://coroa-api.onrender.com'
      },
      encoding: 'utf8'
    }
  );
  assert.equal(child.status, 0, child.stderr);
  const config = JSON.parse(child.stdout);
  assert.deepEqual(config.rewrites, [
    { source: '/auth/:path*', destination: 'https://coroa-api.onrender.com/auth/:path*' },
    { source: '/api/:path*', destination: 'https://coroa-api.onrender.com/api/:path*' }
  ]);
  const runtime = await readFile(new URL('../../dist/runtime-config.js', import.meta.url), 'utf8');
  assert.match(runtime, /window.location.origin/);
  assert.doesNotMatch(runtime, /onrender|supabase|secret/);
  const geographic = await readFile(
    new URL('../../dist/assets/scripts/geographic.js', import.meta.url),
    'utf8'
  );
  assert.match(geographic, /tiles.openfreemap.org/);
  assert.doesNotMatch(geographic, /WebGL2 is required/);
});
