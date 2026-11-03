import { soundButton, renderSoundControls, configureSound } from './audio.js';
import { applyCampaignTheme } from './campaign-theme.js';
import { $, esc, crown, icon, field, modal, toast } from '../shared/ui.js';
import { api, saveSession } from './api.js';
import { heroImage } from './media.js';
export async function showLogin(onLogin) {
  configureSound(undefined, null);
  applyCampaignTheme(null);
  const status = await api('/auth/status');
  const first = status.needs_bootstrap;
  document.body.classList.add('login-page');
  document.querySelector('.skip-link')?.setAttribute('href', '#login-root');
  document.title = 'A Coroa Velada · Suas histórias, além do véu';
  $('#app').innerHTML =
    `<main id="login-root" class="landing" tabindex="-1"><header class="landing-header"><a class="brand" href="#inicio"><span class="brand-crest">${crown}</span><span>A COROA VELADA<small>UM GRUPO. INFINITAS HISTÓRIAS.</small></span></a>${soundButton()}<nav aria-label="Apresentação"><a href="#sobre">Nossa coroa</a><a href="#cronicas">As crônicas</a><a class="button ghost" href="#acesso">Entrar ${icon('arrow')}</a></nav></header><section id="inicio" class="landing-hero" style="--hero-image:url('${heroImage()}')"><div class="landing-hero-art" aria-hidden="true"></div><div class="hero-dust" aria-hidden="true"></div><div class="landing-hero-copy"><span class="eyebrow"><i></i> PARA QUEM VIVE MAIS DE UMA VIDA</span><h1>Algumas histórias<br>merecem a <em>eternidade.</em></h1><p>Somos A Coroa Velada. Um grupo de RPG que transforma encontros em lendas, escolhas em consequências e noites comuns em mundos inteiros.</p><div class="landing-actions"><a class="button primary" href="#acesso">Entre na sua crônica ${icon('arrow')}</a><a class="landing-link" href="#sobre">Conheça a Coroa <span>↓</span></a></div><div class="landing-hero-caption"><span>O SANGUE LEMBRA.</span><span>A NOITE NUNCA ESQUECE.</span></div></div><span class="hero-edition">CRÔNICAS DE SANGUE & OUTROS UNIVERSOS &nbsp; ◇</span></section><section id="sobre" class="landing-about"><div><span class="eyebrow">MAIS QUE UMA MESA</span><h2>A coroa é feita<br>de <em>quem se senta junto.</em></h2></div><div><p>Do primeiro dado à última reviravolta, o que nos reúne é a vontade de contar boas histórias. Aqui, cada personagem deixa uma marca. Cada vínculo pode mudar o rumo da campanha.</p><p>Este é o nosso refúgio entre as sessões: um lugar para guardar rostos, territórios, promessas e tudo o que ainda não foi revelado.</p><span class="about-signature">A história é sua. A noite é nossa.</span></div></section><section id="cronicas" class="landing-features"><div class="landing-section-title"><span class="eyebrow">UM UNIVERSO AO SEU ALCANCE</span><h2>Seu próximo capítulo começa aqui.</h2></div><div class="landing-feature-grid">${[
      [
        'overview',
        '01',
        'Uma identidade. Uma lenda.',
        'Sua ficha, retrato, habilidades e evolução, reunidos no livro do personagem.'
      ],
      [
        'map',
        '02',
        'Um mundo para descobrir.',
        'Territórios, lugares secretos e os caminhos que a sua mesa vai percorrer.'
      ],
      [
        'network',
        '03',
        'Ninguém atravessa sozinho.',
        'Aliados, rivais e conexões. Um mural para as certezas e para todas as teorias.'
      ],
      [
        'quests',
        '04',
        'Toda escolha deixa rastros.',
        'Missões, recompensas e um diário que mantém a história viva entre os encontros.'
      ]
    ]
      .map(
        ([i, n, t, p]) =>
          `<article><div class="feature-number">${icon(i)}<span>${n}</span></div><h3>${t}</h3><p>${p}</p></article>`
      )
      .join(
        ''
      )}</div></section><section id="acesso" class="landing-access"><div class="access-story"><span class="eyebrow">SEU LUGAR ESTÁ À MESA</span><h2>Atravesse<br>o <em>véu.</em></h2><p>Entre com o acesso criado pelo narrador. Seus personagens e as novidades da campanha esperam por você.</p><div class="json-explanation">${icon('save')}<div><strong>A sua campanha viaja em JSON.</strong><p>As alterações são salvas automaticamente na campanha. Você também pode exportar seus JSONs como backup.</p></div></div></div><div class="access-card"><div class="access-card-top"><span>O LIVRO DA NOITE</span>${crown}</div><div class="login-emblem">${icon('lock')}</div><span class="eyebrow">${first ? 'PRIMEIRA NOITE' : 'BEM-VINDO DE VOLTA'}</span><h3>${first ? 'Abra a sua crônica.' : 'A sua história continua.'}</h3><p>${first ? 'Crie o primeiro acesso do narrador.' : 'Use o acesso criado pelo narrador.'}</p><form id="portal-login">${first ? field('display_name', 'Nome do narrador', '', 'text', 'required maxlength="100" autocomplete="name" placeholder="Como a mesa conhece você?"') : ''}${field('username', first ? 'Crie o login do narrador' : 'Login', '', 'text', 'required minlength="3" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Seu nome nas sombras"')}${first ? field('bootstrap_token', 'Chave de instalação', '', 'password', 'required minlength="32" autocomplete="off"') : ''}${field('password', first ? 'Crie uma senha' : 'Senha', '', 'password', `required ${first ? `minlength="10" autocomplete="new-password"` : 'autocomplete="current-password"'} maxlength="128" placeholder="${first ? 'No mínimo 10 caracteres' : 'Sua chave para o véu'}"`)}<p class="form-error" id="login-error" role="alert"></p><button class="button primary login-submit" type="submit">${first ? 'Criar portal e entrar' : 'Atravessar o véu'} ${icon('arrow')}</button></form><p class="access-help">${first ? 'Depois, cadastre jogadores e transcreva as fichas pelo painel.' : 'O narrador gerencia os acessos e personagens.'}</p><span class="access-connected"><i></i> PORTAL ONLINE · VERSÃO 8</span></div></section><footer class="landing-footer"><a class="brand" href="#inicio"><span class="brand-crest">${crown}</span><span>A COROA VELADA</span></a><span>Feita de histórias. Mantida por quem joga.</span><a href="#acesso">A noite espera por você ${icon('arrow')}</a></footer></main>`;
  renderSoundControls();
  $('#portal-login').onsubmit = async (event) => {
    event.preventDefault();
    const submit = event.submitter || event.target.querySelector('[type=submit]');
    submit.disabled = true;
    $('#login-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(event.target));
      saveSession(
        await api(first ? '/auth/bootstrap' : '/auth/login', { method: 'POST', data: values })
      );
      await onLogin();
    } catch (error) {
      const target = $('#login-error');
      if (target) target.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
}
