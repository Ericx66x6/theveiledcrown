export function heroImage() {
  return new URL('/assets/images/coroa-night.jpg', location.href).href;
}
export const currency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
export async function readImage(file, { map = false, thumbnail = false } = {}) {
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
  const limit = map ? 6000 : thumbnail ? 256 : 1100,
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
export { playSound } from './audio.js';
import { playSound } from './audio.js';
export function diceSound() {
  playSound('dice');
}
export function uiSound(kind = 'swoosh') {
  playSound(kind);
}
