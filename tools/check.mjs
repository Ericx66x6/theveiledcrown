import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
let failures = 0;
async function check(dir) {
  for (const file of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const path = dir + '/' + file.name;
    if (file.isDirectory()) {
      await check(path);
      continue;
    }
    if (!/\.(js|mjs)$/.test(file.name)) continue;
    const result = spawnSync(process.execPath, ['--check', resolve(root, path)], {
      encoding: 'utf8'
    });
    if (result.status) {
      failures++;
      console.error(result.stderr);
    }
  }
}
for (const dir of ['client', 'core', 'shared', 'server', 'tools']) await check(dir);
for (const name of ['dist/index.html']) {
  const content = await readFile(resolve(root, name), 'utf8');
  for (const [, path] of content.matchAll(/(?:src|href)="((?:assets|runtime-config)[^\"]+)"/g)) {
    try {
      await readFile(resolve(root, name, '..', path));
    } catch {
      failures++;
      console.error('Asset ausente:', name, path);
    }
  }
}
if (failures) process.exit(1);
console.log('JavaScript e assets do portal online verificados.');
