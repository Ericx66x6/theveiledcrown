import {
  $,
  esc,
  icon,
  crown,
  button,
  field,
  area,
  modal,
  toast,
  date,
  empty
} from '../shared/ui.js';
import { api } from './api.js';
import { readImage } from './media.js';

export function openRegistration() {
  modal(
    'Seu lugar à mesa começa aqui.',
    `<div class="registration-intro"><span>${crown}</span><p>Crie seu acesso e apresente-se à Coroa. O narrador precisa aprovar sua entrada antes do primeiro login.</p></div><div class="form-grid">${field('display_name', 'Como a mesa conhece você?', '', 'text', 'required maxlength="100" autocomplete="name"')}${field('username', 'Seu login', '', 'text', 'required minlength="3" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false"')}<label class="field full"><span>Foto de perfil (opcional · JPG, PNG ou WebP)</span><input type="file" name="avatar_file" accept="image/jpeg,image/png,image/webp"><span class="registration-photo" data-registration-photo aria-hidden="true">${icon('profile')}</span></label>${field('password', 'Crie uma senha', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password" placeholder="Pelo menos 10 caracteres"')}${field('password_confirmation', 'Repita a senha', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')}<p class="hint full">O login aceita letras, números, ponto, hífen e sublinhado. A foto será reduzida para o retrato da conta.</p></div>`,
    async (form) => {
      if (form.get('password') !== form.get('password_confirmation'))
        throw new Error('As senhas precisam ser iguais.');
      const file = form.get('avatar_file');
      await api('/auth/register', {
        method: 'POST',
        data: {
          display_name: form.get('display_name'),
          username: form.get('username'),
          password: form.get('password'),
          avatar: file?.size ? (await readImage(file, { thumbnail: true })).image : ''
        }
      });
      const pending = $('#registration-status');
      if (pending) {
        pending.hidden = false;
        pending.innerHTML = `${icon('test')}<div><strong>Seu pedido atravessou o véu.</strong><p>Aguarde a aprovação do narrador para entrar com seu login e senha.</p></div>`;
      }
      toast('Cadastro enviado para aprovação do narrador.');
    },
    { wide: true, saveLabel: 'Enviar meu cadastro' }
  );
  const input = $('#dialog-form [name=avatar_file]');
  let photoVersion = 0;
  input.onchange = async () => {
    const version = ++photoVersion;
    try {
      if (!input.files[0]) return;
      const result = await readImage(input.files[0], { thumbnail: true });
      if (version === photoVersion && input.isConnected)
        $('[data-registration-photo]').innerHTML =
          `<img src="${esc(result.image)}" alt="Sua foto de perfil">`;
    } catch (e) {
      $('#dialog-error').textContent = e.message;
    }
  };
}
const labels = { pending: 'AGUARDA AVALIAÇÃO', approved: 'APROVADO', rejected: 'RECUSADO' };
export function registrationsPage(ctx) {
  const rows = ctx.state.registrations || [],
    pending = rows.filter((a) => a.registration.status === 'pending');
  return `<div class="page-intro"><span class="eyebrow">A ENTRADA DA COROA</span><h1>Novos rostos à sua porta.</h1><p>${pending.length} cadastro(s) aguardando sua decisão. Aprovar libera o acesso às campanhas que você escolher; cada personagem ainda passa pela avaliação da ficha.</p></div><div class="registration-grid">${
    [
      ...pending,
      ...rows
        .filter((a) => a.registration.status !== 'pending')
        .slice(-20)
        .reverse()
    ]
      .map(
        (a) =>
          `<article class="panel registration-card"><div class="account-card-header"><span class="avatar small">${a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : esc(a.display_name.slice(0, 1))}</span><div><h2>${esc(a.display_name)}</h2><p>@${esc(a.username)}</p></div></div><span class="tag ${a.registration.status === 'pending' ? 'red' : ''}">${labels[a.registration.status]}</span><small>Solicitado em ${date(a.registration.requested_at)}</small>${a.registration.note ? `<p class="prose">${esc(a.registration.note)}</p>` : ''}<div class="registration-actions">${a.registration.status === 'pending' ? button('Aprovar entrada', 'approve-registration', `data-id="${esc(a.id)}"`, 'button primary') + button('Recusar', 'reject-registration', `data-id="${esc(a.id)}"`, 'button ghost') : button('Jogadores e acesso', 'nav-accounts', '', 'button ghost')}${button('Remover cadastro', 'delete-account', `data-id="${esc(a.id)}"`, 'text-button danger')}</div></article>`
      )
      .join('') ||
    empty('Nenhum cadastro aguardando.', 'A opção Criar minha conta já está na página de entrada.')
  }</div>`;
}
export async function registrationAction(action, data, ctx) {
  if (!['approve-registration', 'reject-registration'].includes(action)) return false;
  if (!ctx.admin()) throw new Error('Somente o narrador avalia os acessos.');
  const a = ctx.state.registrations.find((a) => a.id === data.id);
  if (!a || a.registration.status !== 'pending') throw new Error('Atualize a fila de cadastros.');
  const approve = action === 'approve-registration',
    campaigns = ctx.state.campaigns.filter((c) => c.status === 'active');
  modal(
    approve ? 'Abra a porta para ' + a.display_name : 'Recusar entrada?',
    `${approve ? '<p>Escolha pelo menos uma campanha. O jogador terá acesso a ela e poderá enviar uma ficha para sua aprovação.</p><div class="registration-campaigns">' + campaigns.map((c) => `<label class="checkbox"><input name="campaign_ids" type="checkbox" value="${esc(c.id)}" ${c.id === ctx.state.campaign.id ? 'checked' : ''}> ${esc(c.title)}</label>`).join('') + '</div>' : '<p>Este cadastro continuará sem acesso ao portal. Você pode remover o pedido depois, se precisar liberar o login para outro cadastro.</p>'}${area('note', 'Parecer interno (opcional)', '', 'maxlength="2000"')}`,
    async (form) => {
      const campaign_ids = form.getAll('campaign_ids');
      if (approve && !campaign_ids.length)
        throw new Error('Selecione pelo menos uma campanha aberta.');
      await api(`/api/admin/registrations/${a.id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        data: { revision: a.registration._revision, campaign_ids, note: form.get('note') }
      });
      await ctx.refresh();
      toast(approve ? 'A porta está aberta. O jogador já pode entrar.' : 'Cadastro recusado.');
    },
    { saveLabel: approve ? 'Confirmar aprovação' : 'Confirmar recusa' }
  );
  return true;
}
