import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.qa', { recursive: true });
await writeFile('.qa/enabled', 'Only for isolated development preview.');
console.log('Prévia fictícia habilitada para npm run dev; não altera npm start.');
