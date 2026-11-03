import { esc, modal, field, toast } from '../shared/ui.js';
import { api, clearSession } from './api.js';
export async function lifecycleAction(action, data, ctx) {
  if (action === 'delete-campaign') {
    const c = ctx.state.campaigns.find((c) => c.id === data.id);
    modal(
      'Apagar esta campanha?',
      `<p><strong>${esc(c.title)}</strong></p><p>Isso apaga as fichas, mapas, missões, recados e anotações desta mesa. As outras campanhas e os acessos das contas permanecem.</p>${field('confirmation', 'Digite o nome da campanha', '', 'text', 'required maxlength="150"')}`,
      async (form) => {
        await api('/api/campaigns/' + c.id, {
          method: 'DELETE',
          data: { confirmation: form.get('confirmation') }
        });
        ctx.state.player = null;
        await ctx.reloadCampaign();
        await ctx.go('campaigns');
        toast('Campanha apagada.');
      },
      { saveLabel: 'Apagar campanha' }
    );
    return true;
  }
  if (action === 'reset-portal') {
    modal(
      'Recomeçar do estado zero?',
      `<div class="danger-explanation"><h3>Todo o portal será reiniciado.</h3><p>Contas, campanhas, personagens, anotações, missões, recados e históricos serão removidos. Você voltará à instalação inicial e precisará da BOOTSTRAP_TOKEN configurada no Render para criar o primeiro narrador.</p><p>Baixe um backup antes. As imagens sem referência permanecem no Storage; elas não aparecem no portal reiniciado.</p></div>${field('confirmation', 'Digite ZERAR PORTAL', '', 'text', 'required pattern="ZERAR PORTAL"')}`,
      async (form) => {
        await api('/api/admin/reset', {
          method: 'POST',
          data: { confirmation: form.get('confirmation') }
        });
        clearSession();
        window.dispatchEvent(new CustomEvent('portal:signout'));
      },
      { wide: true, saveLabel: 'Zerar todo o portal' }
    );
    return true;
  }
  if (action === 'purge-trash') {
    const one = !!data.id;
    modal(
      one ? 'Apagar definitivamente?' : 'Esvaziar toda a lixeira?',
      `<p>${one ? 'Este registro não poderá mais ser restaurado pelo portal.' : 'Remove contas, personagens, mapas da lixeira e as revisões de todas as campanhas. Os registros ativos permanecem.'}</p>${field('confirmation', one ? 'Digite APAGAR' : 'Digite ESVAZIAR LIXEIRA', '', 'text', 'required')}`,
      async (form) => {
        await api('/api/admin/trash/purge', {
          method: 'DELETE',
          data: { confirmation: form.get('confirmation'), type: data.type, id: data.id }
        });
        await ctx.refresh();
        toast('Lixeira atualizada.');
      },
      { saveLabel: one ? 'Apagar definitivamente' : 'Esvaziar lixeira' }
    );
    return true;
  }
  if (action === 'clear-snapshots') {
    modal(
      'Apagar as revisões salvas?',
      '<p>Remove as cópias anteriores das fichas e regras desta campanha. As versões atuais permanecem.</p>',
      async () => {
        await api('/api/admin/snapshots', { method: 'DELETE' });
        toast('Revisões apagadas.');
      },
      { saveLabel: 'Apagar revisões' }
    );
    return true;
  }
  if (action === 'delete-log') {
    const p = ctx.player(),
      key = data.key,
      all = data.index === 'all';
    modal(
      all ? 'Limpar estes registros?' : 'Apagar este registro?',
      `<p>${key === 'transactions' ? 'Apaga somente o registro da movimentação. O saldo atual não é alterado.' : key === 'history' ? 'O histórico selecionado será removido da ficha. Os valores atuais do personagem permanecem.' : 'A rolagem será removida do histórico.'}</p>`,
      async () => {
        await api(`/api/characters/${p.id}/logs/${key}`, {
          method: 'DELETE',
          data: {
            revision: p._revision,
            ...(all ? { confirmation: 'LIMPAR' } : { index: Number(data.index) })
          }
        });
        await ctx.refresh();
      },
      { saveLabel: all ? 'Limpar registros' : 'Apagar registro' }
    );
    return true;
  }
  if (action === 'delete-submission') {
    const record = ctx.state.submissions.find((r) => r.id === data.id);
    modal(
      'Apagar esta proposta?',
      `<p>${esc(record.character.char)}</p><p class="hint">O registro da proposta será removido. Um personagem já aprovado continua na campanha.</p>`,
      async () => {
        await api('/api/submissions/' + record.id, {
          method: 'DELETE',
          data: { revision: record._revision }
        });
        await ctx.refresh();
        await ctx.go('submissions');
      },
      { saveLabel: 'Apagar proposta' }
    );
    return true;
  }
  return false;
}
