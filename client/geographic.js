import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Overlay from 'ol/Overlay.js';
import DragPan from 'ol/interaction/DragPan.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { apply } from 'ol-mapbox-style';
import { api } from './api.js';
const cameras = new globalThis.Map();
const styleUrl = 'https://tiles.openfreemap.org/styles/dark';
export function createGeographic(ctx, data, options) {
  return new Geographic(ctx, data, options);
}
class Geographic {
  constructor(ctx, data, options) {
    this.ctx = ctx;
    this.data = data;
    this.options = options;
    this.markers = new globalThis.Map();
    this.key = ctx.state.campaign.id + '|' + data.id;
    this.loader = new AbortController();
    this.events = new AbortController();
    const camera = cameras.get(this.key);
    this.view = new View({
      center: fromLonLat(
        camera?.center || [data.center?.lng ?? -46.6333, data.center?.lat ?? -23.5505]
      ),
      zoom: camera?.zoom ?? data.center?.zoom ?? 11,
      minZoom: 2,
      maxZoom: 19
    });
    this.raw = new Map({ target: 'atlas-map', view: this.view, controls: [] });
    this.map = {
      getZoom: () => this.view.getZoom(),
      setZoom: (zoom) => this.view.animate({ zoom, duration: this.duration() }),
      getContainer: () => this.raw.getTargetElement()
    };
    this.raw.on('moveend', () =>
      cameras.set(this.key, { center: toLonLat(this.view.getCenter()), zoom: this.view.getZoom() })
    );
    this.popup = document.createElement('div');
    this.popup.className = 'location-popup-floating';
    this.popup.hidden = true;
    this.popup.setAttribute('role', 'dialog');
    this.popup.setAttribute('aria-label', 'Informações do local');
    this.popupOverlay = new Overlay({
      element: this.popup,
      positioning: 'bottom-center',
      offset: [0, -46],
      stopEvent: true,
      autoPan: { margin: 25, animation: { duration: 200 } }
    });
    this.raw.addOverlay(this.popupOverlay);
    for (const point of data.pins) this.addMarker(point);
    this.raw.on('singleclick', (event) => {
      if (!this.placing) {
        this.popup.hidden = true;
        return;
      }
      this.placing = false;
      this.map.getContainer().classList.remove('placing');
      this.notice('');
      options.onPlace(this.position(toLonLat(event.coordinate)));
    });
    const credit = document.createElement('div');
    credit.className = 'atlas-provider-credit';
    credit.innerHTML =
      '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
    this.map.getContainer().appendChild(credit);
    this.ready = this.load();
  }
  duration() {
    return this.ctx.state.account.preferences?.animations === false ? 0 : 300;
  }
  async load() {
    const deadline = setTimeout(() => this.loader.abort(), 25000);
    try {
      const response = await fetch(styleUrl, { credentials: 'omit', signal: this.loader.signal });
      if (!response.ok) throw new Error('Base geográfica indisponível.');
      const style = await response.json();
      // Canvas text uses local system fonts. No extra font/CDN dependency.
      style.layers = style.layers.filter((layer) =>
        ['background', 'fill', 'line', 'symbol', 'circle'].includes(layer.type)
      );
      for (const layer of style.layers)
        if (layer.layout?.['text-font']) layer.layout['text-font'] = ['Arial Regular'];
      await apply(this.raw, style, {
        styleUrl,
        transformRequest: (url) =>
          new Request(url, { credentials: 'omit', signal: this.loader.signal })
      });
      let failures = 0;
      for (const layer of this.raw.getLayers().getArray())
        layer.getSource?.()?.on('tileloaderror', () => {
          if (++failures > 2)
            this.notice(
              'Parte do mapa não carregou. Seus locais estão salvos; tente abrir o mapa novamente.'
            );
        });
      this.raw.updateSize();
    } catch (error) {
      if (this.destroyed) return;
      throw new Error(
        'Não foi possível carregar a base geográfica agora. Seus locais continuam salvos. Tente abrir o mapa novamente.'
      );
    } finally {
      clearTimeout(deadline);
    }
  }
  addMarker(point) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'atlas-marker vector-marker';
    element.innerHTML = this.options.markerHTML(point);
    element.setAttribute('aria-label', point.title);
    element.title = point.title;
    const overlay = new Overlay({
      element,
      position: fromLonLat([point.lng, point.lat]),
      positioning: 'bottom-center',
      stopEvent: true
    });
    this.raw.addOverlay(overlay);
    this.markers.set(point.id, { overlay, point });
    const opts = { signal: this.events.signal };
    element.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.openPopup(point);
        }
      },
      opts
    );
    let drag;
    element.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button && event.button !== 0) return;
        drag = { x: event.clientX, y: event.clientY, distance: 0 };
        element.setPointerCapture(event.pointerId);
        if (this.options.editable(point))
          this.raw.getInteractions().forEach((i) => {
            if (i instanceof DragPan) i.setActive(false);
          });
      },
      opts
    );
    element.addEventListener(
      'pointermove',
      (event) => {
        if (!drag || !this.options.editable(point)) return;
        drag.distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
        if (drag.distance > 5) {
          this.popup.hidden = true;
          overlay.setPosition(this.raw.getCoordinateFromPixel(this.raw.getEventPixel(event)));
        }
      },
      opts
    );
    const end = (event) => {
      if (!drag) return;
      const moved = drag.distance > 5;
      drag = null;
      this.raw.getInteractions().forEach((i) => {
        if (i instanceof DragPan) i.setActive(true);
      });
      if (event.type === 'pointercancel') {
        overlay.setPosition(fromLonLat([point.lng, point.lat]));
        return;
      }
      if (!moved) {
        this.openPopup(point);
        return;
      }
      const position = this.position(toLonLat(overlay.getPosition()));
      this.ctx.safe(async () => {
        try {
          await api('/api/maps/' + this.data.id + '/pins/' + point.id, {
            method: 'PATCH',
            data: { ...position, revision: point._revision }
          });
          await this.ctx.refresh();
        } catch (error) {
          overlay.setPosition(fromLonLat([point.lng, point.lat]));
          throw error;
        }
      });
    };
    element.addEventListener('pointerup', end, opts);
    element.addEventListener('pointercancel', end, opts);
  }
  openPopup(point) {
    this.popup.innerHTML =
      '<button type="button" class="location-popup-close" aria-label="Fechar informações do local">×</button>' +
      this.options.popupHTML(point);
    this.popup.querySelector('.location-popup-close').onclick = () => (this.popup.hidden = true);
    this.popup.hidden = false;
    this.popupOverlay.setPosition(fromLonLat([point.lng, point.lat]));
  }
  position(point) {
    const lng = ((((point[0] + 180) % 360) + 360) % 360) - 180,
      lat = Math.max(-85.05, Math.min(85.05, point[1]));
    return { lat, lng, x: (lng + 180) / 360, y: (90 - lat) / 180 };
  }
  notice(text) {
    const element = document.querySelector('#map-status-note');
    if (element) {
      element.textContent = text;
      element.hidden = !text;
    }
  }
  fit() {
    this.view.animate({
      center: fromLonLat([this.data.center?.lng ?? -46.6333, this.data.center?.lat ?? -23.5505]),
      zoom: this.data.center?.zoom ?? 11,
      rotation: 0,
      duration: this.duration()
    });
  }
  focus(id) {
    const marker = this.markers.get(id);
    if (!marker) return;
    this.view.animate({
      center: marker.overlay.getPosition(),
      zoom: Math.max(this.view.getZoom(), 15),
      duration: this.duration()
    });
    this.openPopup(marker.point);
    document.querySelector('#atlas-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  destroy() {
    this.destroyed = true;
    this.loader.abort();
    this.events.abort();
    this.raw.setTarget(undefined);
    this.raw.dispose();
  }
}
