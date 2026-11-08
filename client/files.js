import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { workspaceDocuments, assembleDocuments } from '../core/documents.js';
import { validateWorkspace } from '../core/workspace.js';
import { api, clearSession, session } from './api.js';
import { button, field, modal, download, toast } from '../shared/ui.js';
export async function parseFile(file) {
  if (!file || !file.size) throw new Error('Selecione um arquivo JSON.');
  if (file.size > 100 * 1024 * 1024) throw new Error('Use um arquivo de até 100 MB.');
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error('Este arquivo não é um JSON válido.');
  }
}
export function zipDocuments(root) {
  const files = Object.fromEntries(
    Object.entries(workspaceDocuments(root)).map(([path, doc]) => [
      path,
      strToU8(JSON.stringify(doc, null, 2))
    ])
  );
  return zipSync(files);
}
export async function parseWorkspaceFile(file) {
  if (!file || !file.size || file.size > 100 * 1024 * 1024)
    throw new Error('Selecione um JSON ou ZIP de dados de até 100 MB.');
  if (!/\.zip$/i.test(file.name || '')) return validateWorkspace(await parseFile(file));
  let total = 0;
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      if (!entry.name.endsWith('.json')) return false;
      total += entry.originalSize;
      if (total > 180 * 1024 * 1024 || entry.originalSize > 100 * 1024 * 1024)
        throw new Error('O conteúdo do ZIP é grande demais.');
      return true;
    }
  });
  const documents = Object.create(null);
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.split('/').includes('..')) throw new Error('Caminho inválido no pacote.');
    try {
      documents[path] = JSON.parse(strFromU8(bytes));
    } catch {
      throw new Error('JSON inválido em ' + path);
    }
  }
  return validateWorkspace(assembleDocuments(documents));
}
function downloadBlob(name, blob) {
  const link = document.createElement('a'),
    url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 10000);
}

export async function exportTable() {
  const root = await api(
    session()?.account.role === 'admin' ? '/api/json/workspace' : '/api/json/player'
  );
  download('coroa-portal.json', root);
  toast('Backup JSON gerado.');
}
export async function exportZip() {
  const root = await api('/api/json/workspace');
  downloadBlob('coroa-jsons.zip', new Blob([zipDocuments(root)], { type: 'application/zip' }));
  toast('Pacote de JSONs gerado.');
}
export async function exportPlayer(id) {
  download(
    `personagem-${id}-backup.json`,
    await api('/api/json/player', { data: { character_id: id } })
  );
  toast('Backup do jogador gerado.');
}
export function restoreDialog() {
  modal(
    'Importar backup do portal',
    `<p>A importação substitui as contas e campanhas salvas no servidor e encerra os acessos abertos. Baixe o backup atual antes de continuar.</p><label class="field"><span>Backup JSON ou ZIP de dados</span><input type="file" name="file" accept=".json,.zip,application/json,application/zip" required></label>${field('confirm', 'Digite IMPORTAR', '', 'text', 'required pattern="IMPORTAR"')}`,
    async (form) => {
      await api('/api/json/replace', {
        method: 'POST',
        data: {
          document: await parseWorkspaceFile(form.get('file')),
          confirmation: form.get('confirm')
        }
      });
      clearSession();
      window.dispatchEvent(new CustomEvent('portal:signout'));
    },
    { saveLabel: 'Importar backup' }
  );
}
export async function initializeFiles() {
  window.addEventListener('beforeunload', (event) => {
    if (
      document.body.dataset.pendingStatus === 'true' ||
      document.body.dataset.pendingEditor === 'true'
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
export const compactSyncLabel = () => 'Conectado · alterações salvas no servidor';
export async function storageView() {
  return `<div class="page-intro"><span class="eyebrow">ARQUIVOS DA CRÔNICA</span><h1>A campanha continua entre os encontros.</h1><p>As alterações são gravadas automaticamente. Seus backups continuam em JSON.</p></div><div class="storage-grid"><article class="panel storage-card"><h2>Backup completo</h2><p>Guarde contas, campanhas, fichas, mapas e regras em um arquivo.</p>${button('Baixar backup JSON', 'backup-table', '', 'button primary')}${button('Exportar JSONs em ZIP', 'export-jsons', '', 'button ghost')}</article><article class="panel storage-card"><h2>Trazer seus arquivos</h2><p>Escolha o tipo de arquivo: regras, ficha ou backup completo.</p>${button('Importar backup JSON ou ZIP', 'restore-table', '', 'button ghost')}${button('Importar ficha', 'import-character', '', 'button ghost')}${button('Importar game-data (regras)', 'import-game', '', 'button ghost')}</article></div><section class="panel danger-zone"><span class="eyebrow">CONTROLE DO NARRADOR</span><h2>Limpar e recomeçar.</h2><p>Baixe um backup antes de uma exclusão ampla. O reset completo volta à instalação inicial.</p><div class="dashboard-actions">${button('Apagar revisões desta campanha', 'clear-snapshots', '', 'button ghost')}${button('Abrir lixeira', 'nav-trash', '', 'button ghost')}${button('Zerar todo o portal', 'reset-portal', '', 'button danger')}</div></section>`;
}
export async function fileAction(action) {
  if (action === 'backup-table') return exportTable();
  if (action === 'export-jsons') return exportZip();
  if (action === 'restore-table') return restoreDialog();
}
