let preferences = { audio_enabled: true, music_enabled: false, sfx_volume: 80, music_volume: 35 },
  context,
  sfx,
  music,
  compressor,
  installed = false,
  savePreference = null,
  musicTimer = null,
  nextBar = 0,
  bar = 0;
const musicNodes = new Set(),
  last = new Map();
const clamp = (n, fallback) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback);
export function soundEnabled() {
  return preferences.audio_enabled;
}
function unlock() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!sfx) {
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 16;
      compressor.ratio.value = 6;
      compressor.connect(context.destination);
      sfx = context.createGain();
      sfx.connect(compressor);
      music = context.createGain();
      music.connect(compressor);
      applyVolumes();
    }
    if (context.state === 'suspended')
      context
        .resume()
        .then(ensureMusic)
        .catch(() => {});
    else ensureMusic();
  } catch {}
}
function applyVolumes() {
  if (!context) return;
  sfx.gain.setTargetAtTime(
    preferences.audio_enabled ? preferences.sfx_volume / 100 : 0,
    context.currentTime,
    0.025
  );
  music.gain.setTargetAtTime(
    preferences.music_enabled ? (preferences.music_volume / 100) * 0.5 : 0,
    context.currentTime,
    0.25
  );
}
export function configureSound(value, onChange) {
  if (typeof value === 'boolean') preferences.audio_enabled = value;
  else if (value && typeof value === 'object')
    preferences = {
      ...preferences,
      ...value,
      sfx_volume: clamp(value.sfx_volume, preferences.sfx_volume),
      music_volume: clamp(value.music_volume, preferences.music_volume)
    };
  if (onChange !== undefined) {
    savePreference = onChange;
    if (onChange === null) {
      preferences.music_enabled = false;
      stopMusic();
    }
  }
  applyVolumes();
  if (!preferences.music_enabled) stopMusic();
  else ensureMusic();
  renderSoundControls();
}
function tone(frequency, at, duration, gain = 0.18, type = 'sine', end = null, bus = sfx) {
  const o = context.createOscillator(),
    g = context.createGain();
  o.type = type;
  o.frequency.setValueAtTime(frequency, at);
  if (end) o.frequency.exponentialRampToValueAtTime(end, at + duration);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.009);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + duration + 0.04);
  if (bus === music) {
    musicNodes.add(o);
    o.onended = () => musicNodes.delete(o);
  }
  return o;
}
function noise(at, duration = 0.35, gain = 0.16, bus = sfx, center = 620) {
  const b = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const source = context.createBufferSource(),
    filter = context.createBiquadFilter(),
    g = context.createGain();
  source.buffer = b;
  filter.type = 'bandpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(150, at);
  filter.frequency.exponentialRampToValueAtTime(center, at + duration * 0.65);
  filter.frequency.exponentialRampToValueAtTime(90, at + duration);
  g.gain.value = gain;
  source.connect(filter).connect(g).connect(bus);
  source.start(at);
  if (bus === music) {
    musicNodes.add(source);
    source.onended = () => musicNodes.delete(source);
  }
}
export function playSound(kind = 'tick') {
  if (!preferences.audio_enabled || !context || context.state !== 'running') return;
  const now = performance.now();
  if (now - (last.get(kind) || -1000) < (kind === 'tick' ? 45 : 100)) return;
  last.set(kind, now);
  const at = context.currentTime;
  try {
    if (['swoosh', 'open', 'navigate'].includes(kind)) {
      noise(at, 0.38, 0.22);
      tone(110, at, 0.32, 0.15, 'sine', 55);
      tone(440, at + 0.04, 0.28, 0.06, 'triangle', 140);
      return;
    }
    if (kind === 'tick') {
      tone(180, at, 0.11, 0.23, 'triangle', 55);
      tone(1200, at, 0.055, 0.055, 'sine', 310);
      return;
    }
    if (kind === 'dice') {
      for (let i = 0; i < 7; i++) {
        tone(250 + Math.random() * 1200, at + i * 0.04, 0.08, 0.16, 'triangle', 100);
        noise(at + i * 0.04, 0.055, 0.08, sfx, 1600);
      }
      return;
    }
    if (kind === 'victory') {
      [65.4, 130.8, 196, 261.6, 392, 523.2, 784].forEach((f, i) =>
        tone(f, at + i * 0.11, 1.8, 0.14, i < 2 ? 'triangle' : 'sine')
      );
      noise(at, 0.95, 0.25);
      for (let i = 0; i < 14; i++) tone(700 + i * 71, at + 0.45 + i * 0.07, 0.5, 0.045);
      return;
    }
    if (kind === 'surrender') {
      noise(at, 0.8, 0.2, sfx, 900);
      [196, 155.56, 130.8, 65.4].forEach((f, i) =>
        tone(f, at + i * 0.18, 0.8, 0.22, 'triangle', f * 0.7)
      );
      return;
    }
    const notes =
      kind === 'success'
        ? [130.8, 196, 261.6, 392]
        : kind === 'purchase'
          ? [65.4, 130.8, 196, 261.6, 523.2]
          : kind === 'confirm'
            ? [98, 146.8, 196]
            : kind === 'error'
              ? [130.8, 92.5, 65.4]
              : kind === 'notify'
                ? [523.2, 392, 587.3]
                : kind === 'loading'
                  ? [65.4, 98]
                  : [196, 293.7];
    notes.forEach((f, i) =>
      tone(
        f,
        at + i * 0.075,
        kind === 'error' ? 0.4 : 0.5,
        0.17,
        kind === 'error' ? 'triangle' : 'sine'
      )
    );
    if (kind === 'purchase') noise(at, 0.4, 0.14);
  } catch {}
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
  for (const node of musicNodes) {
    try {
      node.stop();
    } catch {}
  }
  musicNodes.clear();
}
function ensureMusic() {
  if (
    !context ||
    context.state !== 'running' ||
    !preferences.music_enabled ||
    document.hidden ||
    musicTimer
  )
    return;
  nextBar = context.currentTime + 0.1;
  bar = 0;
  const schedule = () => {
    if (!preferences.music_enabled || document.hidden) {
      stopMusic();
      return;
    }
    while (nextBar < context.currentTime + 10) {
      const root = [65.406, 65.406, 51.913, 58.27][Math.floor(bar / 2) % 4];
      for (const ratio of [1, 1.5, 2, 2.3784]) {
        const o = tone(root * ratio, nextBar, 8.3, ratio === 1 ? 0.2 : 0.045, 'sine', null, music);
        o.detune.value = ratio === 1 ? -3 : 4;
      }
      for (let i = 0; i < 4; i++) {
        tone(root / 2, nextBar + i * 2, 0.8, 0.28, 'sine', root / 3, music);
        if (i % 2) noise(nextBar + i * 2 + 0.4, 0.8, 0.035, music, 500);
      }
      tone(root * 4, nextBar + 1.8, 3, 0.025, 'triangle', root * 3, music);
      nextBar += 8;
      bar++;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 2000);
}
export function soundButton() {
  return '<button type="button" class="icon-button global-sound" data-sound-toggle aria-label="Ajustar áudio" title="Áudio: efeitos e trilha"></button>';
}
export function renderSoundControls() {
  if (!globalThis.document) return;
  for (const b of document.querySelectorAll('[data-sound-toggle]')) {
    const on = preferences.audio_enabled || preferences.music_enabled;
    b.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h4l5-5v16l-5-5H3z"/>${on ? '<path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 6 6m0-6-6 6"/>'}</svg>`;
    b.classList.toggle('muted', !on);
    b.title = `Efeitos ${preferences.audio_enabled ? 'ativados' : 'desativados'} · trilha ${preferences.music_enabled ? 'ativada' : 'desativada'} · ajustar áudio`;
  }
}
async function audioDialog() {
  const { modal, $, field, button, toast } = await import('../shared/ui.js');
  const before = { ...preferences };
  const persist = async (next) => {
    configureSound(next);
    unlock();
    try {
      await savePreference?.({ ...preferences });
      toast('Áudio ajustado.');
    } catch (error) {
      configureSound(before);
      throw error;
    }
  };
  modal(
    'O som da sua noite',
    `<div class="audio-hero"><span aria-hidden="true">♫</span><div><span class="eyebrow">PESO, TENSÃO E PRESENÇA</span><h3>Você dita o clima.</h3><p>Efeitos marcantes nos toques. Uma trilha instrumental escura para ficar no fundo.</p></div></div><div class="audio-settings"><label class="audio-switch"><span><strong>Efeitos sonoros</strong><small>Toques, dados, confirmações e conquistas</small></span><input type="checkbox" name="audio_enabled" ${preferences.audio_enabled ? 'checked' : ''}></label>${field('sfx_volume', 'Volume dos efeitos', preferences.sfx_volume, 'range', 'min="0" max="100" step="1"')}<label class="audio-switch"><span><strong>Trilha ambiente</strong><small>Pulso grave, drones e tensão · sem vozes</small></span><input type="checkbox" name="music_enabled" ${preferences.music_enabled ? 'checked' : ''}></label>${field('music_volume', 'Volume da trilha', preferences.music_volume, 'range', 'min="0" max="100" step="1"')}<button type="button" class="button ghost" id="audio-preview">Ouvir efeito</button>${button('Silenciar tudo', 'audio-mute-all', '', 'text-button danger')}<p class="hint">A trilha começa com a sua escolha e pausa quando esta aba fica oculta. ${savePreference ? 'Preferências salvas na sua conta.' : 'Entre para salvar suas preferências na conta.'}</p></div>`,
    async (form) => {
      await persist({
        audio_enabled: form.has('audio_enabled'),
        music_enabled: form.has('music_enabled'),
        sfx_volume: Number(form.get('sfx_volume')),
        music_volume: Number(form.get('music_volume'))
      });
    },
    { saveLabel: 'Salvar áudio' }
  );
  $('#audio-preview').onclick = () => {
    unlock();
    if (!context) return;
    const bus = context.createGain();
    bus.gain.value = Number($('#dialog-form [name=sfx_volume]').value) / 100;
    bus.connect(compressor);
    [65.4, 130.8, 196, 261.6, 523.2].forEach((f, i) =>
      tone(f, context.currentTime + i * 0.075, 0.5, 0.17, 'sine', null, bus)
    );
    setTimeout(() => bus.disconnect(), 1300);
  };
  $('[data-action=audio-mute-all]').onclick = async () => {
    const b = $('[data-action=audio-mute-all]');
    b.disabled = true;
    try {
      await persist({ audio_enabled: false, music_enabled: false });
      $('#modal').close();
    } catch (error) {
      toast(error.message, true);
      b.disabled = false;
    }
  };
}
export function installSound() {
  if (installed || !globalThis.document) return;
  installed = true;
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener(
    'click',
    (event) => {
      if (event.target.closest('[data-sound-toggle]')) {
        event.stopPropagation();
        audioDialog();
        return;
      }
      if (
        event.target.closest(
          'button,a,summary,label,select,input[type=checkbox],input[type=radio],[role=button]'
        )
      )
        playSound('tick');
    },
    true
  );
  document.addEventListener('change', (event) => {
    if (event.target.matches('select,input[type=checkbox],input[type=radio]')) playSound('tick');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMusic();
    else ensureMusic();
  });
}
