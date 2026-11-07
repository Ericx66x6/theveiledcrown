import { $, esc, field, modal } from '../shared/ui.js';
import { readImage } from './media.js';
export function portraitStyle(p) {
  const f = p.portrait_frame || { x: 50, y: 50, zoom: 1 };
  return `object-position:${f.x}% ${f.y}%;transform-origin:${f.x}% ${f.y}%;transform:scale(${f.zoom})`;
}
export function portraitDialog(p, onSave) {
  let image = p.profilepicture?.startsWith('data:image/') ? p.profilepicture : '',
    frame = { x: 50, y: 50, zoom: 1, ...p.portrait_frame },
    reading = false;
  modal(
    'Enquadre o seu personagem',
    `<div class="portrait-crop-layout"><div class="portrait-crop-stage" aria-label="Prévia do enquadramento"><img id="portrait-crop-image" src="${esc(image)}" alt="Prévia do seu retrato" ${image ? '' : 'hidden'}><span class="crop-guide" aria-hidden="true"></span></div><div class="portrait-crop-controls"><p>A foto inteira fica guardada. Ajuste a posição e a aproximação até o rosto ficar como você quer.</p><label class="field"><span>Trocar imagem · JPG, PNG ou WebP, até 5 MB</span><input name="portrait_file" type="file" accept="image/jpeg,image/png,image/webp"></label>${field('x', 'Posição horizontal', frame.x, 'range', 'min="0" max="100" step="1"')}${field('y', 'Posição vertical', frame.y, 'range', 'min="0" max="100" step="1"')}${field('zoom', 'Aproximação', frame.zoom, 'range', 'min="1" max="3" step="0.01"')}<button type="button" class="button ghost" id="portrait-center">Centralizar</button><label class="checkbox"><input name="remove_portrait" type="checkbox"> Remover o retrato</label><p class="hint" id="portrait-read-status" role="status">A prévia tem o mesmo formato do retrato na ficha.</p></div></div>`,
    async (form) => {
      if (reading) throw new Error('Aguarde a preparação da foto.');
      if (!image && !form.has('remove_portrait'))
        throw new Error('Escolha uma foto para enquadrar.');
      await onSave({
        profilepicture: form.has('remove_portrait') ? '' : image,
        portrait_frame: form.has('remove_portrait') ? { x: 50, y: 50, zoom: 1 } : frame
      });
    },
    { wide: true, saveLabel: 'Salvar enquadramento' }
  );
  const form = $('#dialog-form'),
    img = $('#portrait-crop-image');
  const draw = () => {
    img.style.cssText = portraitStyle({ portrait_frame: frame });
  };
  for (const key of ['x', 'y', 'zoom'])
    form.elements[key].oninput = (e) => {
      frame[key] = Number(e.target.value);
      draw();
    };
  $('#portrait-center').onclick = () => {
    frame = { x: 50, y: 50, zoom: 1 };
    for (const key of Object.keys(frame)) form.elements[key].value = frame[key];
    draw();
  };
  form.elements.portrait_file.onchange = async (e) => {
    reading = true;
    $('#portrait-read-status').textContent = 'Preparando sua foto…';
    try {
      image = (await readImage(e.target.files[0])).image;
      frame = { x: 50, y: 50, zoom: 1 };
      for (const key of Object.keys(frame)) form.elements[key].value = frame[key];
      img.src = image;
      img.hidden = false;
      draw();
      $('#portrait-read-status').textContent = 'Foto pronta. Ajuste o rosto na prévia e salve.';
    } catch (error) {
      $('#portrait-read-status').textContent = error.message;
    } finally {
      reading = false;
    }
  };
  draw();
}
