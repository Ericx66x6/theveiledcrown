export function heroImage() {
  return new URL('/assets/images/coroa-night.jpg', location.href).href;
}
export const currency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
export async function readImage(file, { map = false } = {}) {
  if (!file || !file.size || file.size > (map ? 30 : 5) * 1024 * 1024)
    throw new Error(map ? 'Escolha uma imagem de até 30 MB.' : 'Escolha uma imagem de até 5 MB.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Use JPG, PNG ou WebP.');
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
  let bitmap;
  try {
    if (typeof createImageBitmap === 'function') bitmap = await createImageBitmap(file);
  } catch {}
  const img =
    bitmap ||
    (await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida.'));
      image.src = url;
    }));
  const limit = map ? 6000 : 1100,
    scale = Math.min(1, limit / Math.max(img.width, img.height)),
    canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  bitmap?.close?.();
  return {
    image: canvas.toDataURL('image/jpeg', map ? 0.9 : 0.86),
    width: canvas.width,
    height: canvas.height
  };
}
export function animateMoney(from, to, element) {
  if (!element) return;
  element.classList.add('money-animating');
  setTimeout(() => element.classList.remove('money-animating'), 900);
  const reduce =
    document.body.classList.contains('reduce-effects') ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now(),
    duration = reduce ? 0 : 850;
  function frame(t) {
    const p = duration ? Math.min(1, (t - start) / duration) : 1,
      ease = 1 - Math.pow(1 - p, 3);
    element.textContent = currency(from + (to - from) * ease);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
let audio;
export function diceSound(enabled) {
  if (!enabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const duration = 0.35,
      buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
    const source = audio.createBufferSource(),
      filter = audio.createBiquadFilter(),
      gain = audio.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    gain.gain.value = 0.18;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  } catch {}
}

export function uiSound(kind = 'swoosh', enabled = true) {
  if (!enabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const now = audio.currentTime;
    if (kind === 'swoosh') {
      const duration = 0.3,
        buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate),
        samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / samples.length);
      const source = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(2600, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start(now);
      return;
    }
    const notes =
      kind === 'success'
        ? [261.63, 392, 523.25, 783.99]
        : kind === 'confirm'
          ? [196, 293.66, 392]
          : [480];
    for (const [i, freq] of notes.entries()) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        at = now + i * (kind === 'success' ? 0.08 : 0.035);
      oscillator.type = kind === 'tick' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(freq, at);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 1.015, at + 0.2);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(
        kind === 'tick' ? 0.035 : 0.035 / Math.sqrt(notes.length),
        at + 0.012
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, at + (kind === 'tick' ? 0.09 : 0.65));
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + (kind === 'tick' ? 0.1 : 0.7));
    }
  } catch {}
}
