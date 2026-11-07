import { guardedMarker } from './map-gesture.js';
import { straightDistanceKm } from '../core/map-state.js';
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
  pickState = null,
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
  return `<div class="page-intro"><span class="eyebrow">ATLAS DA CAMPANHA</span><h1>Há histórias em cada esquina.</h1><p>Explore, aproxime e descubra os lugares que guardam os segredos da crônica.</p></div><div class="atlas-heading"><span>${maps.length} ${maps.length === 1 ? 'mapa' : 'mapas'} ${ctx.admin() ? 'na campanha' : 'disponíveis'}</span>${button(icon('map') + ' Ver mapa', 'map-jump', '', 'button ghost mobile-map-jump')}${ctx.admin() ? button(icon('plus') + ' Adicionar mapa', 'map-upload', '', 'button primary') : ''}</div>${
    m
      ? `<div class="mobile-map-switcher">${select(
          'mobile-map',
          'Mapa aberto',
          maps.map((item) => ({ value: item.id, label: item.title })),
          m.id
        )}</div><div class="map-gallery" aria-label="Mapas da campanha">${maps.map((item) => `<button type="button" class="map-gallery-card ${item.id === m.id ? 'selected' : ''}" data-action="map-select" data-id="${item.id}" aria-pressed="${item.id === m.id}">${item.mode === 'geographic' ? '<span class="geographic-thumb">' + icon('map') + '</span>' : `<img src="${esc(item.image)}" alt="">`}<span><strong>${esc(item.title)}</strong><small>${item.mode === 'geographic' ? 'MAPA GEOGRÁFICO' : 'MUNDO DA CAMPANHA'} · ${ctx.admin() ? (item.player_access ? 'COMPARTILHADO' : 'NARRADOR') : item.pins.length + ' LOCAIS'}</small></span>${item.id === m.id ? icon('test') : ''}</button>`).join('')}</div><section class="atlas-map-heading"><div><span class="eyebrow">${m.mode === 'geographic' ? 'AS RUAS DO MUNDO REAL' : 'CARTOGRAFIA DA CRÔNICA'}</span><h2>${esc(m.title)}</h2><p>${esc(m.description)}</p></div>${ctx.admin() ? button(icon('edit') + ' Configurar mapa', 'map-edit', `data-id="${m.id}"`, 'button ghost') : ''}</section><div class="canvas-toolbar">${button(icon('pin') + ' Marcar local', 'map-place', '', 'button primary')}<label class="map-location-search">${icon('search')}<input type="search" id="map-location-search" aria-label="Buscar locais cadastrados" placeholder="Buscar locais cadastrados"></label><div class="canvas-zoom">${button('−', 'canvas-zoom-out', 'aria-label="Diminuir zoom"', 'icon-button')}${button('Enquadrar', 'canvas-fit', '', 'button ghost')}${button('+', 'canvas-zoom-in', 'aria-label="Aumentar zoom"', 'icon-button')}</div></div><div class="map-tools-toggle">${button(icon('profile') + ' Posição e distância', 'map-tools', `aria-expanded="${!!ctx.state.mapToolsOpen}"`, 'button ghost')}</div><div class="map-tools ${ctx.state.mapToolsOpen ? 'is-open' : ''}">${personalMapPanel(ctx, m)}</div><div id="map-measurement" hidden></div><div class="atlas-stage"><p class="map-status-note" id="map-status-note" role="status" hidden></p><div id="atlas-map" class="atlas-leaflet ${m.mode === 'geographic' ? 'geographic' : 'illustrated'}" role="region" aria-label="Mapa interativo da campanha"></div></div><p class="atlas-instructions">Arraste para explorar · aproxime com dois dedos · toque para consultar · para mover um marcador, dê dois toques e arraste no segundo.</p><div class="location-directory">${m.pins.map((p) => `<article class="location-card" data-location-search="${esc((p.title + ' ' + (p.domain || '') + ' ' + (p.address || '')).toLowerCase())}"><button type="button" class="location-card-main" data-action="map-focus" data-id="${p.id}"><div class="location-cover">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : `<span>${pinSymbol(p)}</span>`}<span class="tag">${esc(typeName(p))}</span></div><div><h3>${esc(p.title)}</h3><p>${esc(p.address || p.domain || 'Um lugar na história da campanha.')}</p><span class="location-meta">${(p.npcs || []).length} NPCs · ${(p.images || []).length} imagens</span></div></button><footer>${button('Dossiê do local', 'map-detail', `data-id="${p.id}"`, 'button ghost')}${canEdit(ctx, p) ? button('Editar', 'map-pin-edit', `data-id="${p.id}"`, 'text-button') : ''}</footer></article>`).join('') || empty('O primeiro lugar espera por um nome.', 'Toque em Marcar local e escolha uma posição no mapa.')}</div>`
      : empty(
          ctx.admin() ? 'Seu atlas começa aqui.' : 'Nenhum mapa foi liberado ainda.',
          ctx.admin()
            ? 'Use uma imagem da sua campanha ou um mapa geográfico navegável.'
            : 'O narrador escolhe os mapas disponíveis nesta campanha.',
          ctx.admin() ? button('Adicionar primeiro mapa', 'map-upload', '', 'button primary') : ''
        )
  }`;
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
  if (m?.pins.length || m?.character_markers?.length) {
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
      )}</div><h3>O que sabemos deste lugar</h3><p class="prose">${esc(p.description || 'Os detalhes deste lugar ainda aguardam a primeira descoberta.')}</p><h3>Rostos que você pode encontrar</h3><div class="location-npc-grid">${(p.npcs || []).map((npc) => `<article>${npc.image ? `<img src="${esc(npc.image)}" alt="${esc(npc.name)}">` : `<span class="npc-initial">${esc(npc.name.slice(0, 1))}</span>`}<div><h4>${esc(npc.name)}</h4><span class="eyebrow">${esc(npc.role)}</span><p class="prose">${esc(npc.description)}</p></div></article>`).join('') || '<p class="muted">Nenhum NPC registrado por aqui.</p>'}</div>${canEdit(ctx, p) ? `<div class="location-detail-actions">${button('Editar local', 'map-pin-edit', `data-id="${p.id}"`, 'button primary')}${button('Mudar posição por toque', 'map-pin-reposition', `data-id="${p.id}"`, 'button ghost')}${button('Apagar local', 'map-remove', `data-id="${p.id}"`, 'text-button danger')}</div>` : ''}</div>`,
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
  constructor(ctx, m, options) {
    this.ctx = ctx;
    this.data = m;
    this.options = options;
    this.markers = new Map();
    this.events = new AbortController();
    this.key = ctx.state.campaign.id + '|' + m.id;
    const reduced = ctx.state.account.preferences?.animations === false;
    this.map = L.map('atlas-map', {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: !reduced,
      fadeAnimation: !reduced,
      minZoom: -5,
      maxZoom: 4,
      preferCanvas: false,
      doubleClickZoom: false
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
    for (const point of options.points) this.addMarker(point);
    this.map.on('click', (event) => {
      if (!this.placing) return;
      this.placing = false;
      this.map.getContainer().classList.remove('placing');
      options.onPlace(this.position(event.latlng));
    });
  }
  addMarker(point) {
    const personal = !!point.personal;
    const marker = L.marker(this.latLng(point), {
      title: point.title,
      alt: point.title,
      draggable: false,
      icon: L.divIcon({
        className: 'atlas-marker' + (personal ? ' character-map-marker' : ''),
        html: this.options.markerHTML(point),
        iconSize: personal ? [48, 58] : [36, 42],
        iconAnchor: personal ? [24, 50] : [18, 40],
        popupAnchor: [0, personal ? -50 : -38]
      })
    }).addTo(this.map);
    marker.bindPopup(this.options.popupHTML(point), { maxWidth: 280, minWidth: 190 });
    marker.off('click');
    this.markers.set(point.id, marker);
    guardedMarker(marker.getElement(), {
      editable: () => this.options.editable(point),
      signal: this.events.signal,
      onTap: () => {
        if (!this.options.onPoint(point)) marker.openPopup();
      },
      onStart: () => {
        this.map.dragging.disable();
        marker.closePopup();
        this.notice('Posição liberada. Arraste o marcador e solte para salvar.');
      },
      onMove: (event) => marker.setLatLng(this.map.mouseEventToLatLng(event)),
      onEnd: (moved) => {
        this.map.dragging.enable();
        this.notice('');
        if (moved)
          this.ctx.safe(async () => {
            try {
              await this.options.onMove(point, this.position(marker.getLatLng()));
            } catch (error) {
              marker.setLatLng(this.latLng(point));
              throw error;
            }
          });
      },
      onCancel: () => {
        marker.setLatLng(this.latLng(point));
        this.map.dragging.enable();
        this.notice('');
      }
    });
  }
  latLng(p) {
    return [(1 - p.y) * this.data.height, p.x * this.data.width];
  }
  position(p) {
    return {
      x: Math.max(0, Math.min(1, p.lng / this.data.width)),
      y: Math.max(0, Math.min(1, 1 - p.lat / this.data.height))
    };
  }
  notice(text) {
    const e = $('#map-status-note');
    if (e) {
      e.textContent = text;
      e.hidden = !text;
    }
  }
  fit() {
    this.map.fitBounds(this.bounds, { padding: [20, 20] });
  }
  focus(id) {
    const marker = this.markers.get(id);
    if (!marker) return;
    this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 0));
    marker.openPopup();
    $('#atlas-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  setMeasurement(a, b, label) {
    this.clearMeasurement();
    const points = [this.latLng(a), this.latLng(b)];
    this.line = L.polyline(points, {
      color:
        getComputedStyle(document.documentElement).getPropertyValue('--campaign-accent').trim() ||
        '#d92343',
      weight: 3,
      dashArray: '8 8',
      interactive: false
    }).addTo(this.map);
    this.lineLabel = L.marker(
      L.latLng((points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2),
      {
        interactive: false,
        icon: L.divIcon({
          className: 'map-distance-label',
          html: `<span>${esc(label)}</span>`,
          iconSize: [140, 32],
          iconAnchor: [70, 16]
        })
      }
    ).addTo(this.map);
  }
  clearMeasurement() {
    if (this.line) this.map.removeLayer(this.line);
    if (this.lineLabel) this.map.removeLayer(this.lineLabel);
    this.line = null;
    this.lineLabel = null;
  }
  destroy() {
    this.events.abort();
    this.map.remove();
  }
}
function markerHTML(p) {
  if (p.personal)
    return `<span class="character-pin-face">${p.character.profilepicture?.startsWith('data:image/') ? `<img src="${esc(p.character.profilepicture)}" alt="">` : esc(p.title.slice(0, 1))}</span><small class="character-pin-name">${esc(p.title)}</small>`;
  const color = /^#[a-f\d]{6}$/i.test(p.color || '') ? p.color : '#df345b';
  return `<span style="--pin-color:${color}">${pinSymbol(p)}</span>`;
}
function popupHTML(p, ctx) {
  if (p.personal)
    return `<div class="character-point-popup"><span class="eyebrow">PERSONAGEM NO MAPA</span><h3>${esc(p.title)}</h3><p>${esc(p.character.player)}</p><small>${p.visibility === 'campaign' ? 'Posição compartilhada com a mesa' : 'Posição reservada ao jogador e narrador'}</small>${canMoveCharacter(ctx, p.character_id) ? button('Mover personagem', 'map-character-position', `data-character-id="${p.character_id}"`, 'button primary') : ''}${button('Medir distância a partir daqui', 'map-distance-from', `data-id="${p.id}"`, 'button ghost')}</div>`;

  return `<div class="location-popup">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.title)}">` : ''}<span class="eyebrow">${esc(typeName(p))}</span><h3>${esc(p.title)}</h3><p>${esc((p.description || p.address || p.domain || 'Um lugar na história.').slice(0, 180))}</p><small>${(p.npcs || []).length} NPCs · ${(p.images || []).length} imagens</small>${button('Abrir dossiê', 'map-detail', `data-id="${p.id}"`, 'button primary')}${button('Medir distância a partir daqui', 'map-distance-from', `data-id="${p.id}"`, 'button ghost')}</div>`;
}
export function bindAtlas(ctx) {
  const version = ++generation;
  pickState = null;
  atlas?.destroy();
  atlas = null;
  if (ctx.state.view === 'map' && $('#atlas-map')) {
    const m = selected(ctx);
    if (m.mode === 'geographic') {
      withLoading(async () => {
        const { createGeographic } = await import('/assets/scripts/geographic.js');
        if (version !== generation) return;
        const instance = createGeographic(ctx, m, atlasOptions(ctx, m));
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
    } else atlas = new Atlas(ctx, m, atlasOptions(ctx, m));
  }
  const mobileMap = $('[name=mobile-map]');
  if (mobileMap)
    mobileMap.onchange = () => {
      ctx.state.mapId = mobileMap.value;
      ctx.draw();
    };
  const character = $('[name=map-character]');
  if (character)
    character.onchange = () => {
      ctx.state.mapCharacterId = Number(character.value);
      ctx.draw();
    };
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
  if (await personalMapAction(action, data, ctx)) return true;
  if (action === 'map-jump') {
    $('#atlas-map')?.scrollIntoView({
      block: 'start',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
    return true;
  }
  if (action === 'map-tools') {
    ctx.state.mapToolsOpen = !ctx.state.mapToolsOpen;
    ctx.draw();
    return true;
  }
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
    pickState = null;
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
    const point = mapPoints(selected(ctx)).find((p) => p.id === data.id);
    if (pickState && point) pickMapPoint(ctx, point);
    else atlas?.focus(data.id);
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

function mapPoints(m) {
  return [
    ...m.pins,
    ...(m.character_markers || []).map((p) => ({
      ...p,
      id: 'character-' + p.character_id,
      personal: true,
      title: p.character.char
    }))
  ];
}
function ownMapCharacter(ctx) {
  const owned = ctx.state.players.filter((p) => !p.archived);
  return (
    owned.find((p) => p.id === ctx.state.mapCharacterId) ||
    owned.find((p) => p.id === ctx.player()?.id) ||
    owned[0]
  );
}
function canMoveCharacter(ctx, id) {
  return ctx.admin() || ctx.state.account.character_ids.includes(id);
}
function personalMapPanel(ctx, m) {
  const character = ownMapCharacter(ctx),
    my = (m.character_markers || []).find((p) => p.character_id === character?.id);
  const people = m.character_markers || [];
  return `<section class="panel personal-map-panel"><div class="personal-map-heading"><div><span class="eyebrow">PRESENÇAS NA CIDADE</span><h3>${ctx.admin() ? 'Os personagens, no mapa.' : 'Onde a sua história está agora?'}</h3><p>Posições informadas pelos jogadores. O mapa mede só a linha reta; o caminho faz parte do roleplay.</p></div>${button(icon('map') + ' Medir distância', 'map-distance', '', 'button ghost')}${ctx.admin() && m.mode !== 'geographic' ? button('Calibrar escala', 'map-calibrate', '', 'button ghost') : ''}</div>${
    character
      ? `<div class="personal-map-controls">${select(
          'map-character',
          ctx.admin() ? 'Personagem para posicionar' : 'Seu personagem',
          ctx.state.players.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.char })),
          character.id
        )}${button(my ? (ctx.admin() ? 'Mudar posição' : 'Mudar minha posição') : ctx.admin() ? 'Marcar posição' : 'Marcar minha posição', 'map-my-position', '', 'button primary')}${my ? (!ctx.admin() ? button(my.visibility === 'campaign' ? 'Ocultar dos outros jogadores' : 'Compartilhar com os jogadores', 'map-share-position', '', 'button ghost') : '') + button('Remover posição', 'map-remove-position', '', 'text-button danger') : ''}</div><p class="hint">${ctx.admin() ? 'Escolha o personagem e toque no mapa para posicioná-lo. A decisão de compartilhar a posição continua com o jogador.' : my?.visibility === 'campaign' ? 'Sua posição está visível para toda a campanha.' : 'Sua posição fica reservada a você e ao narrador até você compartilhar.'}</p>`
      : ''
  }<div class="map-character-roster">${people.map((p) => button(`<span class="avatar small">${p.character.profilepicture?.startsWith('data:image/') ? `<img src="${esc(p.character.profilepicture)}" alt="">` : esc(p.character.char.slice(0, 1))}</span><span><strong>${esc(p.character.char)}</strong><small>${p.visibility === 'private' ? 'RESERVADO' : 'COMPARTILHADO'}</small></span>`, 'map-focus', `data-id="character-${p.character_id}"`, 'map-character-card')).join('') || '<span class="hint">Nenhum personagem marcou sua posição neste mapa ainda.</span>'}</div>${m.mode === 'geographic' ? '<p class="map-scale-hint">Base geográfica · distâncias pelas coordenadas.</p>' : m.scale ? `<p class="map-scale-hint">Escala: ${m.scale.pixels.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pixels da imagem = ${m.scale.meters.toLocaleString('pt-BR')} metros.</p>` : '<p class="map-scale-hint">O narrador precisa calibrar a escala da imagem para medir quilômetros.</p>'}</section>`;
}
function atlasOptions(ctx, m) {
  return {
    points: mapPoints(m),
    markerHTML,
    popupHTML: (p) => popupHTML(p, ctx),
    editable: (p) => (p.personal ? canMoveCharacter(ctx, p.character_id) : canEdit(ctx, p)),
    onPoint: (p) => {
      if (!pickState) return false;
      pickMapPoint(ctx, p);
      return true;
    },
    onPlace: (p) => {
      if (pickState) pickMapPoint(ctx, p);
      else pinDialog(ctx, null, p);
    },
    onMove: async (p, position) => {
      await api(
        '/api/maps/' + m.id + (p.personal ? '/characters/' + p.character_id : '/pins/' + p.id),
        { method: 'PATCH', data: { ...position, revision: p._revision } }
      );
      await ctx.refresh();
    }
  };
}
function showMeasureHTML(html, closeLabel = 'Fechar medição') {
  const box = $('#map-measurement');
  if (box) {
    box.hidden = false;
    box.innerHTML = `<div class="measurement-info">${html}${button(closeLabel, 'map-measure-close', '', 'button ghost')}</div>`;
  }
}
function beginMapPick(kind, message, extras = {}) {
  if (!atlas) throw new Error('Aguarde o mapa terminar de carregar.');
  pickState = { kind, ...extras };
  atlas.placing = true;
  atlas.map.getContainer().classList.add('placing');
  atlas.notice(message);
  atlas.map.closePopup?.();
  if (atlas.popup) atlas.popup.hidden = true;
  showMeasureHTML(
    `<span>${icon('pin')} ${esc(message)}</span>`,
    ['position', 'reposition'].includes(kind) ? 'Cancelar posicionamento' : 'Cancelar medição'
  );
  $('#atlas-map')?.scrollIntoView({
    block: 'center',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  });
}
function clearMapPick() {
  pickState = null;
  atlas?.clearMeasurement?.();
  if (atlas) {
    atlas.placing = false;
    atlas.map.getContainer().classList.remove('placing');
    atlas.notice('');
  }
  const box = $('#map-measurement');
  if (box) {
    box.hidden = true;
    box.innerHTML = '';
  }
}
function pickMapPoint(ctx, point) {
  const task = pickState,
    m = selected(ctx);
  if (!task) return;
  if (task.kind === 'distance-start') {
    beginMapPick('distance-end', 'Agora toque no destino, em um marcador ou em qualquer posição.', {
      from: point
    });
    return;
  }
  if (task.kind === 'distance-end') {
    const km = straightDistanceKm(m, task.from, point);
    if (km === null) {
      clearMapPick();
      throw new Error('O narrador precisa calibrar a escala deste mapa.');
    }
    const label = km.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' km';
    pickState = null;
    atlas.placing = false;
    atlas.map.getContainer().classList.remove('placing');
    atlas.notice('');
    atlas.setMeasurement(task.from, point, label);
    showMeasureHTML(
      `<div><span class="eyebrow">DISTÂNCIA EM LINHA RETA</span><strong>${label}</strong><small>${esc(task.from.title || 'Origem')} → ${esc(point.title || 'Destino')} · o trajeto real é definido no roleplay.</small></div>`
    );
    return;
  }
  if (task.kind === 'calibrate-start') {
    beginMapPick('calibrate-end', 'Toque no segundo ponto da referência.', { from: point });
    return;
  }
  if (task.kind === 'calibrate-end') {
    const pixels = Math.hypot(
      (point.x - task.from.x) * m.width,
      (point.y - task.from.y) * m.height
    );
    if (pixels < 1) {
      beginMapPick('calibrate-end', 'Escolha outro ponto, mais distante da origem.', {
        from: task.from
      });
      return;
    }
    pickState = null;
    atlas.placing = false;
    atlas.map.getContainer().classList.remove('placing');
    atlas.notice('');
    atlas.setMeasurement(task.from, point, 'Referência da escala');
    modal(
      'Quanto mede essa referência?',
      `<p>A linha marcada tem ${pixels.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pixels na imagem original. Informe a distância real entre os pontos.</p>${field('meters', 'Distância em metros', 1000, 'number', 'required min="0.1" max="40000000" step="any"')}<p class="hint">A escala continua correta quando você aproxima ou afasta o mapa.</p>`,
      async (form) => {
        await api('/api/maps/' + m.id, {
          method: 'PATCH',
          data: { revision: m._revision, scale: { pixels, meters: Number(form.get('meters')) } }
        });
        clearMapPick();
        await ctx.refresh();
        toast('Escala calibrada. O mapa agora mede quilômetros.');
      },
      { saveLabel: 'Salvar escala', onCancel: clearMapPick }
    );
    return;
  }
  if (task.kind === 'position' || task.kind === 'reposition') {
    const old =
      task.kind === 'position'
        ? (m.character_markers || []).find((p) => p.character_id === task.characterId)
        : m.pins.find((p) => p.id === task.pinId);
    clearMapPick();
    ctx.safe(async () => {
      await api(
        '/api/maps/' +
          m.id +
          (task.kind === 'position' ? '/characters/' + task.characterId : '/pins/' + task.pinId),
        {
          method: task.kind === 'position' ? 'PUT' : 'PATCH',
          data: {
            x: point.x,
            y: point.y,
            ...(m.mode === 'geographic' ? { lat: point.lat, lng: point.lng } : {}),
            revision: old?._revision || 0,
            ...(task.kind === 'position' && !ctx.admin()
              ? { visibility: old?.visibility || 'private' }
              : {})
          }
        }
      );
      await ctx.refresh();
      toast('Posição salva no mapa.');
    });
  }
}
async function personalMapAction(action, data, ctx) {
  if (
    ![
      'map-distance',
      'map-distance-from',
      'map-calibrate',
      'map-my-position',
      'map-character-position',
      'map-share-position',
      'map-remove-position',
      'map-measure-close',
      'map-pin-reposition'
    ].includes(action)
  )
    return false;
  const m = selected(ctx);
  if (!m) throw new Error('Abra um mapa primeiro.');
  if (action === 'map-measure-close') {
    clearMapPick();
    return true;
  }
  if (action === 'map-calibrate') {
    if (!ctx.admin() || m.mode === 'geographic')
      throw new Error('A escala é configurada pelo narrador nos mapas por imagem.');
    clearMapPick();
    beginMapPick('calibrate-start', 'Toque no primeiro ponto de uma distância conhecida.');
    return true;
  }
  if (action === 'map-distance' || action === 'map-distance-from') {
    if (m.mode !== 'geographic' && !m.scale)
      throw new Error('O narrador precisa calibrar a escala da imagem antes de medir.');
    const character = ownMapCharacter(ctx),
      from =
        action === 'map-distance-from'
          ? mapPoints(m).find((p) => p.id === data.id)
          : !ctx.admin()
            ? mapPoints(m).find((p) => p.personal && p.character_id === character?.id)
            : null;
    clearMapPick();
    beginMapPick(
      from ? 'distance-end' : 'distance-start',
      from
        ? 'Toque no destino, em um marcador ou em qualquer posição.'
        : 'Toque no ponto de origem da medição.',
      from ? { from } : {}
    );
    return true;
  }
  if (action === 'map-pin-reposition') {
    const point = m.pins.find((p) => p.id === data.id);
    if (!point || !canEdit(ctx, point)) throw new Error('Você não controla este marcador.');
    $('#modal')?.close();
    beginMapPick('reposition', 'Toque na nova posição de ' + point.title + '.', {
      pinId: point.id
    });
    return true;
  }
  const character =
    action === 'map-character-position'
      ? ctx.state.players.find((p) => p.id === Number(data.characterId) && !p.archived)
      : ownMapCharacter(ctx);
  if (!character || !canMoveCharacter(ctx, character.id))
    throw new Error('Escolha um personagem que você possa posicionar.');
  const position = (m.character_markers || []).find((p) => p.character_id === character.id);
  if (action === 'map-my-position' || action === 'map-character-position') {
    clearMapPick();
    beginMapPick('position', 'Toque onde ' + character.char + ' está neste mapa.', {
      characterId: character.id
    });
    return true;
  }
  if (!position) throw new Error('Marque sua posição primeiro.');
  if (action === 'map-share-position') {
    if (ctx.admin()) throw new Error('O jogador decide se a posição é compartilhada.');
    await api('/api/maps/' + m.id + '/characters/' + character.id, {
      method: 'PATCH',
      data: {
        revision: position._revision,
        visibility: position.visibility === 'campaign' ? 'private' : 'campaign'
      }
    });
    await ctx.refresh();
    toast(
      position.visibility === 'campaign'
        ? 'Sua posição ficou reservada.'
        : 'Sua posição foi compartilhada com a mesa.'
    );
    return true;
  }
  modal(
    ctx.admin() ? 'Remover a posição deste personagem?' : 'Remover sua posição?',
    `<p>O marcador de ${esc(character.char)} sai deste mapa. Você pode posicioná-lo novamente depois.</p>`,
    async () => {
      await api('/api/maps/' + m.id + '/characters/' + character.id, {
        method: 'DELETE',
        data: { revision: position._revision }
      });
      await ctx.refresh();
    },
    { saveLabel: 'Remover posição' }
  );
  return true;
}
