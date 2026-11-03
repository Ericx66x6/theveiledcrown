let enabled = true,
  context,
  master,
  installed = false,
  savePreference = null;
const last = new Map();
function unlock() {
  if (!enabled) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!master) {
      master = context.createGain();
      master.gain.value = enabled ? 0.45 : 0;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch {}
}
function tone(frequency, at, duration, gain = 0.06, type = 'sine', end = null) {
  const o = context.createOscillator(),
    g = context.createGain();
  o.type = type;
  o.frequency.setValueAtTime(frequency, at);
  if (end) o.frequency.exponentialRampToValueAtTime(end, at + duration);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + duration + 0.03);
}
function whoosh(at, duration = 0.23) {
  const b = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const s = context.createBufferSource(),
    f = context.createBiquadFilter(),
    g = context.createGain();
  s.buffer = b;
  f.type = 'bandpass';
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(180, at);
  f.frequency.exponentialRampToValueAtTime(2100, at + duration * 0.6);
  f.frequency.exponentialRampToValueAtTime(350, at + duration);
  g.gain.value = 0.09;
  s.connect(f).connect(g).connect(master);
  s.start(at);
}
export function soundEnabled() {
  return enabled;
}
export function configureSound(value, onChange) {
  if (typeof value === 'boolean') enabled = value;
  if (onChange !== undefined) savePreference = onChange;
  if (master) master.gain.setTargetAtTime(enabled ? 0.45 : 0, context.currentTime, 0.012);
  renderSoundControls();
}
export function playSound(kind = 'tick') {
  if (!enabled || !context || context.state !== 'running') return;
  const now = performance.now(),
    delay = kind === 'tick' ? 55 : 110;
  if (now - (last.get(kind) || 0) < delay) return;
  last.set(kind, now);
  try {
    const at = context.currentTime;
    if (['swoosh', 'open', 'navigate'].includes(kind)) {
      whoosh(at);
      return;
    }
    if (kind === 'dice') {
      for (let i = 0; i < 5; i++)
        tone(400 + Math.random() * 1200, at + i * 0.035, 0.055, 0.06, 'triangle', 180);
      return;
    }
    const notes =
      kind === 'success'
        ? [261.6, 392, 523.3]
        : kind === 'purchase'
          ? [196, 293.7, 392, 587.3]
          : kind === 'confirm'
            ? [220, 330]
            : kind === 'error'
              ? [196, 146.8]
              : kind === 'notify'
                ? [659.3, 523.3]
                : kind === 'loading'
                  ? [174.6, 220]
                  : kind === 'loaded'
                    ? [392]
                    : [420];
    notes.forEach((f, i) =>
      tone(
        f,
        at + i * 0.065,
        kind === 'tick' ? 0.06 : 0.24,
        kind === 'tick' ? 0.035 : 0.055,
        kind === 'error' ? 'triangle' : 'sine'
      )
    );
  } catch {}
}
export function soundButton() {
  return '<button type="button" class="icon-button global-sound" data-sound-toggle aria-label="Desativar som geral" title="Som geral" aria-pressed="true"></button>';
}
export function renderSoundControls() {
  if (!globalThis.document) return;
  for (const b of document.querySelectorAll('[data-sound-toggle]')) {
    b.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h4l5-5v16l-5-5H3z"/>${enabled ? '<path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 6 6m0-6-6 6"/>'}</svg>`;
    b.setAttribute('aria-pressed', String(enabled));
    b.setAttribute('aria-label', enabled ? 'Desativar som geral' : 'Ativar som geral');
    b.title = enabled ? 'Som ativado · desativar tudo' : 'Som desativado · ativar';
    b.classList.toggle('muted', !enabled);
  }
}
export function installSound() {
  if (installed || !globalThis.document) return;
  installed = true;
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener(
    'click',
    async (event) => {
      const toggle = event.target.closest('[data-sound-toggle]');
      if (toggle) {
        event.stopPropagation();
        const before = enabled;
        configureSound(!enabled);
        unlock();
        playSound('confirm');
        try {
          await savePreference?.(enabled);
        } catch (error) {
          configureSound(before);
          window.dispatchEvent(new CustomEvent('audio:save-error', { detail: error.message }));
        }
        return;
      }
      if (event.target.closest('button,a,summary')) playSound('tick');
    },
    true
  );
  document.addEventListener('change', (event) => {
    if (event.target.matches('select,input[type=checkbox],input[type=radio]')) playSound('tick');
  });
}
