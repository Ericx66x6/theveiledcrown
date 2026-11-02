import { $, esc, field, modal, toast } from '../shared/ui.js';
import { api } from './api.js';
import { newId } from '../core/model.js';
export function xpDistribution(ctx) {
  if (!ctx.admin()) throw new Error('A distribuição pertence ao narrador.');
  const players = ctx.state.players.filter((p) => !p.archived);
  const requestId = newId();
  modal(
    'Recompense as histórias da mesa.',
    `<p>Escolha quem recebe. O valor será acrescentado individualmente a cada personagem marcado.</p><div class="form-grid">${field('amount', 'XP por personagem', 5, 'number', 'required min="1" max="100000" step="1"')}${field('reason', 'Motivo da recompensa', '', 'text', 'required maxlength="500" placeholder="Participação, interpretação, conquista…"')}</div><div class="xp-select-tools"><button type="button" class="button ghost" id="xp-select-all">Marcar todos</button><button type="button" class="button ghost" id="xp-select-none">Limpar seleção</button></div><div class="xp-recipient-list">${players.map((p) => `<label class="xp-recipient"><input type="checkbox" name="characters" value="${p.id}"><span><strong>${esc(p.char)}</strong><small>${esc(p.player)} · ${p.xp} XP atuais</small></span></label>`).join('') || '<p>Cadastre um personagem antes de distribuir XP.</p>'}</div><div class="xp-distribution-preview" aria-live="polite" id="xp-distribution-preview"></div><label class="checkbox"><input type="checkbox" name="confirmed" required> Conferi os personagens e confirmo esta recompensa.</label>`,
    async (form) => {
      const ids = form.getAll('characters').map(Number);
      await api('/api/admin/xp/distribute', {
        method: 'POST',
        data: {
          request_id: requestId,
          character_ids: ids,
          amount: Number(form.get('amount')),
          reason: form.get('reason'),
          confirmed: form.has('confirmed'),
          revisions: Object.fromEntries(players.map((p) => [p.id, p._revision]))
        }
      });
      await ctx.refresh();
      toast(`XP entregue a ${ids.length} personagem(ns).`);
    },
    { wide: true, saveLabel: 'Distribuir XP' }
  );
  const form = $('#dialog-form');
  const boxes = [...form.querySelectorAll('[name=characters]')];
  const preview = () => {
    const count = boxes.filter((b) => b.checked).length,
      amount = Number(form.elements.amount.value) || 0;
    $('#xp-distribution-preview').textContent =
      `${count} personagem(ns) · +${amount} XP para cada um`;
  };
  $('#xp-select-all').onclick = () => {
    boxes.forEach((b) => (b.checked = true));
    preview();
  };
  $('#xp-select-none').onclick = () => {
    boxes.forEach((b) => (b.checked = false));
    preview();
  };
  form.addEventListener('input', preview);
  preview();
}
