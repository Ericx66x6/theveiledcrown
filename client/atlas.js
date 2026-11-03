import L from 'leaflet';
import { $, esc, icon, button, field, area, select, modal, toast, empty } from '../shared/ui.js';
import { api } from './api.js';
import { readImage } from './media.js';
import { withLoading } from './loading.js';
import { newId } from '../core/model.js';
const types = [
  { value: 'location', label: 'Local importante' },
  { value: 'domain', label: 'Domínio' },
  { value: 'character', label: 'Personagem' },
  { value: 'clue', label: 'Pista' },
  { value: 'danger', label: 'Perigo' }
];
const cameras = new Map();
let atlas,
  generation = 0;
const selected = (ctx) =>
  ctx.state.campaign.maps.find((m) => m.id === ctx.state.mapId) || ctx.state.campaign.maps[0];
const canEdit = (ctx, p) => ctx.admin() || p.created_by === ctx.state.account.id;
const base = (ctx) => '/api/maps/' + selected(ctx).id;
const typeName = (p) => types.find((t) => t.value === p.type)?.label || 'Local importante';
const pinSymbol = (p) =>
  icon(
    p.type === 'character'
      ? 'profile'
      : p.type === 'domain'
        ? 'world'
        : p.type === 'danger'
          ? 'blood'
          : 'pin'
  );
export function mapPage(ctx) {
  const maps = ctx.state.campaign.maps,
    m = selected(ctx);
  if (m) ctx.state.mapId = m.id;
  return `<div class="page-intro"><span class="eyebrow">ATLAS DA CAMPANHA</span><h1>Há histórias em cada esquina.</h1><p>Explore, aproxime e descubra os lugares que guardam os segredos da crônica.</p></div><div class="atlas-heading"><span>${maps.length} ${maps.length === 1 ? 'mapa' : 'mapas'} ${ctx.admin() ? 'na campanha' : 'disponíveis'}</span>${ctx.admin() ? button(icon('plus') + ' Adicionar mapa', 'map-upload', '', 'button primary') : ''}</div>${m ? `<div class="map-gallery" aria-label="Mapas da campanha">${maps.map((item) => `<button type="button" class="map-gallery-card ${item.id === m.id ? 'selected' : ''}" data-action="map-select" data-id="${item.id}" aria-pressed="${item.id === m.id}">${item.mode === 'geographic' ? '<span class="geographic-thumb">' + icon('map') + '</span>' : `<img src="${esc(item.image)}" alt="">`}<span><strong>${esc(item.title)}</strong><small>${item.mode === 'geographic' ? 'MAPA GEOGRÁFICO' : 'MUNDO DA CAMPANHA'} · ${ctx.admin() ? (item.player_access ? 'COMPARTILHADO' : 'NARRADOR') : item.pins.length + ' LOCAIS'}</small></span>${item.id === m.id ? icon('test') : ''}</button>`).join('')}</div><section class="atlas-map-heading"><div><span class="eyebrow">${m.mode === 'geographic' ? 'AS RUAS DO MUNDO REAL' : 'CARTOGRAFIA DA CRÔNICA'}</span><h2>${esc(m.title)}</h2><p>${esc(m.description)}</p></div>${ctx.admin() ? button(icon('edit') + ' Configurar mapa', 'map-edit', `data-id="${m.id}"`, 'button ghost') : ''}</section><div class="canvas-toolbar">${button(icon('pin') + ' Marcar local', 'map-place', '', 'button primary')}<label class="map-location-search">${icon('search')}<input type="search" id="map-location-search" aria-label="Buscar locais cadastrados" placeholder="Buscar locais cadastrados"></label><div class="canvas-zoom">${button('−', 'canvas-zoom-out', 'aria-label="Diminuir zoom"', 'icon-button')}${button('Enquadrar', 'canvas-fit', '', 'button ghost')}${button('+', 'canvas-zoom-in', 'aria-label="Aumentar zoom"', 'icon-button')}</div></div><p class="map-status-note" id="map-status-note" role="status" hidden></p><div id="atlas-map" class="atlas-leaflet ${m.mode === 'geographic' ? 'geographic' : 'illustrated'}" role="region" aria-label="Mapa interativo da campanha"></div><p class="atlas-instructions">Arraste para explorar · aproxime com dois dedos · toque nos marcadores para abrir a bolha do local.</p><div class="location-directory">${m.pins.map((p) => `<article class="location-card" data-location-search="${esc((p.title + ' ' + (p.domain || '') + ' ' + (p.address || '')).toLowerCase())}"><button type="button" class="location-card-main" data-action="map-focus" data-id="${p.id}"><div class="location-cover">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : `<span>${pinSymbol(p)}</span>`}<span class="tag">${esc(typeName(p))}</span></div><div><h3>${esc(p.title)}</h3><p>${esc(p.address || p.domain || 'Um lugar na história da campanha.')}</p><span class="location-meta">${(p.npcs || []).length} NPCs · ${(p.images || []).length} imagens</span></div></button><footer>${button('Dossiê do local', 'map-detail', `data-id="${p.id}"`, 'button ghost')}${canEdit(ctx, p) ? button('Editar', 'map-pin-edit', `data-id="${p.id}"`, 'text-button') : ''}</footer></article>`).join('') || empty('O primeiro lugar espera por um nome.', 'Toque em Marcar local e escolha uma posição no mapa.')}</div>` : empty(ctx.admin() ? 'Seu atlas começa aqui.' : 'Nenhum mapa foi liberado ainda.', ctx.admin() ? 'Use uma imagem da sua campanha ou um mapa geográfico navegável.' : 'O narrador escolhe os mapas disponíveis nesta campanha.', ctx.admin() ? button('Adicionar primeiro mapa', 'map-upload', '', 'button primary') : '')}`;
}
function mapDialog(ctx, m) {
  const mode = m?.mode || 'image',
    center = m?.center || { lat: -23.5505, lng: -46.6333, zoom: 11 };
  modal(
    m ? 'Configurar mapa' : 'Abra um novo mapa',
    `<div class="map-mode-explanation"><h3>Escolha como explorar.</h3><p>Imagem para mundos próprios. Mapa geográfico para navegar por ruas e regiões reais, com navegação vetorial e detalhes de ruas.</p></div><div class="form-grid">${field('title', 'Nome do mapa', m?.title || '', 'text', 'required maxlength="150"')}${select(
      'mode',
      'Tipo de mapa',
      [
        { value: 'image', label: 'Imagem da campanha' },
        { value: 'geographic', label: 'Mapa geográfico · OpenFreeMap' }
      ],
      mode
    )}${area('description', 'Sobre este mapa', m?.description || '', 'maxlength="5000"')}<label class="field full" data-map-mode="image"><span>${m ? 'Trocar imagem (opcional)' : 'Imagem do mapa'} · JPG, PNG ou WebP, até 30 MB</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp"></label><div class="form-grid full" data-map-mode="geographic">${field('lat', 'Latitude do centro', center.lat, 'number', 'min="-85.05" max="85.05" step="any"')}${field('lng', 'Longitude do centro', center.lng, 'number', 'min="-180" max="180" step="any"')}${field('zoom', 'Aproximação inicial', center.zoom, 'number', 'min="2" max="19" step="1"')}<p class="hint full">Você pode navegar livremente a partir do centro. O mapa inicial usa São Paulo; altere as coordenadas para outra região.</p></div><label class="checkbox full"><input type="checkbox" name="player_access" ${m?.player_access ? 'checked' : ''}> Liberar este mapa aos jogadores</label></div>${m ? button('Remover mapa', 'map-delete', `data-id="${m.id}"`, 'text-button danger') : ''}`,
    async (form) => {
      const data = {
        title: form.get('title'),
        description: form.get('description'),
        mode: form.get('mode'),
        player_access: form.has('player_access'),
        revision: m?._revision
      };
      const file = form.get('file');
      if (data.mode === 'image') {
        if (!m?.image && !file?.size) throw new Error('Selecione a imagem do mapa.');
        if (file?.size)
          Object.assign(
            data,
            await withLoading(() => readImage(file, { map: true }), 'Preparando a imagem do mapa…')
          );
      } else
        data.center = {
          lat: Number(form.get('lat')),
          lng: Number(form.get('lng')),
          zoom: Number(form.get('zoom'))
        };
      const result = await api('/api/maps' + (m ? '/' + m.id : ''), {
        method: m ? 'PATCH' : 'POST',
        data
      });
      ctx.state.mapId = result.id;
      cameras.delete(ctx.state.campaign.id + '|' + result.id);
      await ctx.refresh();
      toast('Mapa salvo no atlas.');
    },
    { wide: true, saveLabel: m ? 'Salvar mapa' : 'Criar mapa' }
  );
  const form = $('#dialog-form'),
    input = form.elements.mode;
  if (m?.pins.length) {
    input.disabled = true;
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'mode';
    hidden.value = mode;
    form.appendChild(hidden);
  }
  const update = () => {
    for (const section of form.querySelectorAll('[data-map-mode]')) {
      section.hidden = section.dataset.mapMode !== input.value;
      for (const el of section.querySelectorAll('input')) el.disabled = section.hidden;
    }
  };
  input.onchange = update;
  update();
}
function locationDetail(ctx, p) {
  modal(
    p.title,
    `<div class="location-detail"><header><span class="tag red">${esc(typeName(p))}</span>${p.domain ? `<span class="tag">${esc(p.domain)}</span>` : ''}</header>${p.images?.length ? `<div class="location-gallery">${p.images.map((image, i) => `<img src="${esc(image)}" alt="${esc(p.title)} · imagem ${i + 1}" loading="lazy">`).join('')}</div>` : ''}<div class="location-facts">${[
      ['Endereço', p.address],
      ['Atmosfera', p.atmosphere],
      ['Perigo', p.danger],
      [
        'Personagem',
        ctx.state.players.find((a) => a.id === p.character_id)?.char ||
          ctx.state.campaign.roster?.find((a) => a.id === p.character_id)?.char
      ]
    ]
      .filter(([, v]) => v)
      .map(([key, value]) => `<div><span>${key}</span><strong>${esc(value)}</strong></div>`)
      .join(
        ''
      )}</div><h3>O que sabemos deste lugar</h3><p class="prose">${esc(p.description || 'Os detalhes deste lugar ainda aguardam a primeira descoberta.')}</p><h3>Rostos que você pode encontrar</h3><div class="location-npc-grid">${(p.npcs || []).map((npc) => `<article>${npc.image ? `<img src="${esc(npc.image)}" alt="${esc(npc.name)}">` : `<span class="npc-initial">${esc(npc.name.slice(0, 1))}</span>`}<div><h4>${esc(npc.name)}</h4><span class="eyebrow">${esc(npc.role)}</span><p class="prose">${esc(npc.description)}</p></div></article>`).join('') || '<p class="muted">Nenhum NPC registrado por aqui.</p>'}</div>${canEdit(ctx, p) ? `<div class="location-detail-actions">${button('Editar local', 'map-pin-edit', `data-id="${p.id}"`, 'button primary')}${button('Apagar local', 'map-remove', `data-id="${p.id}"`, 'text-button danger')}</div>` : ''}</div>`,
    null,
    { wide: true }
  );
}
function pinDialog(ctx, p, position) {
  const point = p || position;
  let photos = [...(p?.images || [])],
    npcs = structuredClone(p?.npcs || []);
  modal(
    p ? 'Editar este lugar' : 'Um novo lugar na história',
    `<div class="form-grid">${field('title', 'Nome do local', p?.title || '', 'text', 'required maxlength="200"')}${select('type', 'Tipo', types, p?.type || 'location')}${field('domain', 'Domínio ou referência', p?.domain || '', 'text', 'maxlength="500"')}${field('address', 'Endereço ou como chegar', p?.address || '', 'text', 'maxlength="500"')}${field('atmosphere', 'Atmosfera', p?.atmosphere || '', 'text', 'maxlength="500" placeholder="Silencioso, decadente, território da corte…"')}${field('danger', 'Nível de perigo', p?.danger || '', 'text', 'maxlength="500" placeholder="Baixo, desconhecido, presença hostil…"')}${area('description', 'Descrição, informações e descobertas', p?.description || '', 'maxlength="30000"')}${select('character_id', 'Personagem ligado ao local', [{ value: '', label: 'Nenhum' }, ...ctx.state.players.map((p) => ({ value: p.id, label: p.char }))], p?.character_id ?? '')}${select('visibility', 'Quem pode ver', [{ value: 'campaign', label: 'Toda a campanha' }, { value: 'private', label: 'Só eu' }, ...(ctx.admin() ? [{ value: 'gm', label: 'Narradores' }] : [])], p?.visibility || 'campaign')}${field('color', 'Cor do marcador', p?.color || '#df345b', 'color')}</div><section class="location-editor-section"><h3>As imagens deste lugar</h3><p class="hint">Até seis imagens. Os jogadores veem as fotos na bolha e no dossiê.</p><div id="location-photo-preview" class="location-photo-preview"></div><label class="field"><span>Adicionar imagens</span><input type="file" id="location-photos" accept="image/jpeg,image/png,image/webp" multiple></label></section><section class="location-editor-section"><h3>Quem fica por aqui?</h3><p class="hint">Estes NPCs pertencem ao local compartilhado. Os murais pessoais dos personagens continuam separados.</p><div id="location-npc-editor"></div><button type="button" class="button ghost" id="location-add-npc">${icon('plus')} Adicionar NPC ao local</button></section>`,
    async (form) => {
      readNpcs();
      const data = {};
      for (const key of [
        'title',
        'type',
        'domain',
        'address',
        'atmosphere',
        'danger',
        'description',
        'visibility',
        'color'
      ])
        data[key] = form.get(key);
      data.character_id = form.get('character_id') === '' ? null : Number(form.get('character_id'));
      Object.assign(data, {
        x: point.x,
        y: point.y,
        lat: point.lat,
        lng: point.lng,
        images: photos,
        npcs,
        revision: p?._revision
      });
      await api(base(ctx) + '/pins' + (p ? '/' + p.id : ''), {
        method: p ? 'PATCH' : 'POST',
        data
      });
      await ctx.refresh();
      toast('O lugar ganhou uma nova página no atlas.');
    },
    { wide: true, saveLabel: 'Salvar local' }
  );
  function renderPhotos() {
    const el = $('#location-photo-preview');
    el.innerHTML = photos
      .map(
        (image, i) =>
          `<div><img src="${esc(image)}" alt="Imagem ${i + 1} do local"><button type="button" class="icon-button" data-photo-index="${i}" aria-label="Apagar imagem ${i + 1}">×</button></div>`
      )
      .join('');
    el.querySelectorAll('[data-photo-index]').forEach(
      (b) =>
        (b.onclick = () => {
          photos.splice(Number(b.dataset.photoIndex), 1);
          renderPhotos();
        })
    );
  }
  function readNpcs() {
    for (const row of document.querySelectorAll('[data-location-npc]')) {
      const npc = npcs.find((n) => n.id === row.dataset.locationNpc);
      for (const key of ['name', 'role', 'description'])
        npc[key] = row.querySelector(`[data-npc-field="${key}"]`).value;
    }
  }
  function renderNpcs() {
    const el = $('#location-npc-editor');
    el.innerHTML = npcs
      .map(
        (npc, index) =>
          `<article class="location-npc-edit" data-location-npc="${npc.id}"><div class="section-heading"><h4>NPC ${index + 1}</h4><button type="button" class="text-button danger" data-npc-delete="${npc.id}">Apagar NPC</button></div><div class="form-grid"><label class="field"><span>Nome do NPC</span><input data-npc-field="name" value="${esc(npc.name)}" required maxlength="150"></label><label class="field"><span>Papel ou ocupação</span><input data-npc-field="role" value="${esc(npc.role || '')}" maxlength="500"></label><label class="field full"><span>O que sabemos</span><textarea data-npc-field="description" maxlength="10000">${esc(npc.description || '')}</textarea></label><label class="field"><span>Retrato</span><input type="file" data-npc-photo="${npc.id}" accept="image/jpeg,image/png,image/webp"></label>${npc.image ? `<div class="npc-editor-photo"><img src="${esc(npc.image)}" alt="Retrato do NPC"><button type="button" class="text-button danger" data-npc-clear="${npc.id}">Apagar foto</button></div>` : ''}</div></article>`
      )
      .join('');
    el.querySelectorAll('[data-npc-delete]').forEach(
      (b) =>
        (b.onclick = () => {
          readNpcs();
          npcs = npcs.filter((n) => n.id !== b.dataset.npcDelete);
          renderNpcs();
        })
    );
    el.querySelectorAll('[data-npc-clear]').forEach(
      (b) =>
        (b.onclick = () => {
          readNpcs();
          npcs.find((n) => n.id === b.dataset.npcClear).image = '';
          renderNpcs();
        })
    );
    el.querySelectorAll('[data-npc-photo]').forEach(
      (input) =>
        (input.onchange = () =>
          ctx.safe(async () => {
            if (!input.files[0]) return;
            readNpcs();
            npcs.find((n) => n.id === input.dataset.npcPhoto).image = (
              await withLoading(() => readImage(input.files[0]))
            ).image;
            renderNpcs();
          }))
    );
  }
  $('#location-add-npc').onclick = () => {
    if (npcs.length >= 12) {
      toast('Use até doze NPCs por local.', true);
      return;
    }
    readNpcs();
    npcs.push({ id: newId(), name: '', role: '', description: '', image: '' });
    renderNpcs();
  };
  $('#location-photos').onchange = () =>
    ctx.safe(async () => {
      const files = [...$('#location-photos').files];
      if (files.length + photos.length > 6) throw new Error('Use até seis imagens por local.');
      await withLoading(async () => {
        for (const file of files) photos.push((await readImage(file)).image);
      });
      $('#location-photos').value = '';
      renderPhotos();
    });
  renderPhotos();
  renderNpcs();
}
class Atlas {
  constructor(ctx, m) {
    this.ctx = ctx;
    this.data = m;
    this.markers = new Map();
    this.key = ctx.state.campaign.id + '|' + m.id;
    const geographic = m.mode === 'geographic',
      reduced = ctx.state.account.preferences?.animations === false;
    this.map = L.map('atlas-map', {
      crs: geographic ? L.CRS.EPSG3857 : L.CRS.Simple,
      zoomControl: false,
      attributionControl: geographic,
      zoomAnimation: !reduced,
      fadeAnimation: !reduced,
      minZoom: geographic ? 2 : -5,
      maxZoom: geographic ? 19 : 4,
      preferCanvas: false
    });
    this.bounds = L.latLngBounds([
      [0, 0],
      [m.height, m.width]
    ]);
    L.imageOverlay(m.image, this.bounds, { alt: m.title, interactive: false }).addTo(this.map);
    this.map.fitBounds(this.bounds, { padding: [20, 20] });
    const camera = cameras.get(this.key);
    if (camera) this.map.setView(camera.center, camera.zoom, { animate: false });
    this.map.on('moveend', () =>
      cameras.set(this.key, { center: this.map.getCenter(), zoom: this.map.getZoom() })
    );
    for (const p of m.pins) {
      const color = /^#[a-f\d]{6}$/i.test(p.color || '') ? p.color : '#df345b';
      const marker = L.marker(this.latLng(p), {
        title: p.title,
        alt: p.title,
        draggable: canEdit(ctx, p),
        icon: L.divIcon({
          className: 'atlas-marker',
          html: `<span style="--pin-color:${color}">${pinSymbol(p)}</span>`,
          iconSize: [36, 42],
          iconAnchor: [18, 40],
          popupAnchor: [0, -38]
        })
      }).addTo(this.map);
      marker.bindPopup(popupHTML(p), { maxWidth: 280, minWidth: 190 });
      marker.on('dragend', () =>
        ctx.safe(async () => {
          const position = this.position(marker.getLatLng());
          try {
            await api(base(ctx) + '/pins/' + p.id, {
              method: 'PATCH',
              data: { ...position, revision: p._revision }
            });
            await ctx.refresh();
          } catch (error) {
            marker.setLatLng(this.latLng(p));
            throw error;
          }
        })
      );
      this.markers.set(p.id, marker);
    }
    this.map.on('click', (event) => {
      if (!this.placing) return;
      this.placing = false;
      this.map.getContainer().classList.remove('placing');
      this.notice('');
      pinDialog(ctx, null, this.position(event.latlng));
    });
  }
  latLng(p) {
    return this.data.mode === 'geographic'
      ? [p.lat, p.lng]
      : [(1 - p.y) * this.data.height, p.x * this.data.width];
  }
  position(point) {
    if (this.data.mode === 'geographic') {
      const p = point.wrap();
      return {
        lat: Math.max(-85.05, Math.min(85.05, p.lat)),
        lng: p.lng,
        x: (p.lng + 180) / 360,
        y: (90 - p.lat) / 180
      };
    }
    return {
      x: Math.max(0, Math.min(1, point.lng / this.data.width)),
      y: Math.max(0, Math.min(1, 1 - point.lat / this.data.height))
    };
  }
  notice(text) {
    const el = $('#map-status-note');
    if (el) {
      el.textContent = text;
      el.hidden = !text;
    }
  }
  fit() {
    if (this.bounds) this.map.fitBounds(this.bounds, { padding: [20, 20] });
    else
      this.map.setView(
        [this.data.center?.lat ?? -23.5505, this.data.center?.lng ?? -46.6333],
        this.data.center?.zoom ?? 11
      );
  }
  focus(id) {
    const marker = this.markers.get(id);
    if (!marker) return;
    this.map.setView(
      marker.getLatLng(),
      Math.max(this.map.getZoom(), this.data.mode === 'geographic' ? 15 : 0)
    );
    marker.openPopup();
    $('#atlas-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  destroy() {
    this.map.remove();
  }
}
function markerHTML(p) {
  const color = /^#[a-f\d]{6}$/i.test(p.color || '') ? p.color : '#df345b';
  return `<span style="--pin-color:${color}">${pinSymbol(p)}</span>`;
}
function popupHTML(p) {
  return `<div class="location-popup">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.title)}">` : ''}<span class="eyebrow">${esc(typeName(p))}</span><h3>${esc(p.title)}</h3><p>${esc((p.description || p.address || p.domain || 'Um lugar na história.').slice(0, 180))}</p><small>${(p.npcs || []).length} NPCs · ${(p.images || []).length} imagens</small>${button('Abrir dossiê', 'map-detail', `data-id="${p.id}"`, 'button primary')}</div>`;
}
export function bindAtlas(ctx) {
  const version = ++generation;
  atlas?.destroy();
  atlas = null;
  if (ctx.state.view === 'map' && $('#atlas-map')) {
    const m = selected(ctx);
    if (m.mode === 'geographic') {
      withLoading(async () => {
        const { createGeographic } = await import('/assets/scripts/geographic.js');
        if (version !== generation) return;
        const instance = createGeographic(ctx, m, {
          markerHTML,
          popupHTML,
          editable: (p) => canEdit(ctx, p),
          onPlace: (point) => pinDialog(ctx, null, point)
        });
        atlas = instance;
        try {
          await instance.ready;
        } catch (error) {
          if (version === generation) {
            instance.destroy();
            atlas = null;
            throw error;
          }
        }
      }, 'Abrindo as ruas da crônica…').catch((error) => {
        if (version !== generation) return;
        const notice = $('#map-status-note');
        if (notice) {
          notice.textContent = error.message;
          notice.hidden = false;
        }
        toast(error.message, true);
      });
    } else atlas = new Atlas(ctx, m);
  }
  const search = $('#map-location-search');
  if (search)
    search.oninput = () =>
      document
        .querySelectorAll('[data-location-search]')
        .forEach(
          (row) => (row.hidden = !row.dataset.locationSearch.includes(search.value.toLowerCase()))
        );
}
export async function atlasAction(action, data, ctx) {
  if (action === 'map-upload') {
    mapDialog(ctx);
    return true;
  }
  if (action === 'map-edit') {
    mapDialog(
      ctx,
      ctx.state.campaign.maps.find((m) => m.id === data.id)
    );
    return true;
  }
  if (action === 'map-select') {
    ctx.state.mapId = data.id;
    ctx.draw();
    return true;
  }
  if (action === 'map-delete') {
    const m = ctx.state.campaign.maps.find((m) => m.id === data.id);
    modal(
      'Remover este mapa?',
      `<p>O mapa e seus locais irão para a lixeira.</p>${field('confirmation', 'Digite o nome do mapa', '', 'text', 'required')}`,
      async (form) => {
        await api('/api/maps/' + m.id, {
          method: 'DELETE',
          data: { revision: m._revision, confirmation: form.get('confirmation') }
        });
        await ctx.refresh();
      },
      { saveLabel: 'Remover mapa' }
    );
    return true;
  }
  if (action === 'map-place') {
    if (atlas) {
      atlas.placing = !atlas.placing;
      atlas.map.getContainer().classList.toggle('placing', atlas.placing);
      atlas.notice(
        atlas.placing
          ? 'Toque em uma posição no mapa para criar o local. Toque em Marcar local novamente para cancelar.'
          : ''
      );
    }
    return true;
  }
  if (action === 'map-focus') {
    atlas?.focus(data.id);
    return true;
  }
  if (action === 'map-detail') {
    locationDetail(
      ctx,
      selected(ctx).pins.find((p) => p.id === data.id)
    );
    return true;
  }
  if (action === 'map-pin-edit') {
    pinDialog(
      ctx,
      selected(ctx).pins.find((p) => p.id === data.id)
    );
    return true;
  }
  if (action === 'map-remove') {
    const p = selected(ctx).pins.find((p) => p.id === data.id);
    modal(
      'Apagar este local?',
      `<p>${esc(p.title)}</p><p>As informações, imagens e NPCs deste marcador serão removidos do atlas.</p>`,
      async () => {
        await api(base(ctx) + '/pins/' + p.id, {
          method: 'DELETE',
          data: { revision: p._revision }
        });
        await ctx.refresh();
      },
      { saveLabel: 'Apagar local' }
    );
    return true;
  }
  if (ctx.state.view === 'map' && action === 'canvas-fit') {
    atlas?.fit();
    return true;
  }
  if (ctx.state.view === 'map' && ['canvas-zoom-in', 'canvas-zoom-out'].includes(action)) {
    atlas?.map.setZoom(atlas.map.getZoom() + (action === 'canvas-zoom-in' ? 1 : -1));
    return true;
  }
  return false;
}
