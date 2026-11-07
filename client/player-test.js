import { api, session } from './api.js';
import { button, field, icon, modal, select, toast } from '../shared/ui.js';

export function playerTestBanner() {
  if (!session()?.player_test) return '';
  return `<section class="player-test-banner" role="status"><div><strong>${icon('dice')} Visão de jogador · teste</strong><span>Ficha temporária. Suas alterações ficam só neste teste.</span></div>${button('Voltar ao narrador', 'player-test-end', '', 'button ghost')}</section>`;
}

export async function playerTestAction(action, data, ctx) {
  if (action === 'player-test-start') {
    if (!ctx.admin()) throw new Error('Este modo é exclusivo para narradores.');
    const active = ctx.state.players.filter((p) => !p.archived);
    modal(
      'Experimente como jogador',
      `<p>Use as regras da campanha em uma ficha temporária. Você pode criar uma ficha de teste ou copiar uma existente, sem alterar o original.</p><div class="form-grid">${select('character_id', 'Ficha para testar', [{ value: '', label: 'Criar personagem de testes' }, ...active.map((p) => ({ value: p.id, label: 'Cópia de ' + p.char }))], ctx.player()?.id ?? '')}${field('xp', 'XP para experimentar', 100, 'number', 'required min="0" max="1000000" step="1"')}${field('money', 'Dinheiro para experimentar', 1000, 'number', 'required min="0" max="1000000000" step="0.01"')}<label class="checkbox full"><input type="checkbox" name="include_maps" checked> Copiar mapas liberados para jogadores</label></div><p class="hint">Você entra com as permissões de jogador. Ficha, mensagens, compras e posições são descartadas ao sair. Recarregar a página também retorna ao narrador.</p>`,
      async (form) => {
        const campaignId = ctx.state.campaigns.some((c) => c.id === ctx.state.campaign?.id)
          ? ctx.state.campaign.id
          : null;
        const result = await api('/api/player-test', {
          method: 'POST',
          data: {
            ...(campaignId ? { campaign_id: campaignId } : {}),
            ...(form.get('character_id') !== ''
              ? { character_id: Number(form.get('character_id')) }
              : {}),
            xp: Number(form.get('xp')),
            money: Number(form.get('money')),
            include_maps: form.has('include_maps')
          }
        });
        await ctx.restartPortal('overview', { ...session(), ...result });
        toast('Teste iniciado. Nenhuma ficha real será alterada.');
      },
      { saveLabel: 'Entrar como jogador', wide: true }
    );
    return true;
  }
  if (action === 'player-test-end') {
    const test = session()?.player_test;
    if (!test) return true;
    modal(
      'Voltar ao narrador?',
      `<p>As alterações feitas na ficha temporária serão descartadas. Sua campanha e os personagens reais continuam preservados.</p>`,
      async () => {
        const result = await api('/api/player-test', {
          method: 'DELETE',
          data: { campaign_id: test.source_campaign_id }
        });
        await ctx.restartPortal('dashboard', { ...session(), ...result, player_test: null });
        toast('Você voltou ao narrador. O teste foi descartado.');
      },
      { saveLabel: 'Voltar ao narrador' }
    );
    return true;
  }
  return false;
}
