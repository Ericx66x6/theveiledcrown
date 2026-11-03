import { guardedMarker } from './map-gesture.js';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import Text from 'ol/style/Text.js';
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js';
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
    this.raw = new Map({
      target: 'atlas-map',
      view: this.view,
      controls: [],
      interactions: defaultInteractions({ doubleClickZoom: false })
    });
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
    for (const point of options.points) this.addMarker(point);
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
  toggleDrag(enabled) {
    this.raw.getInteractions().forEach((i) => {
      if (i instanceof DragPan) i.setActive(enabled);
    });
  }
  addMarker(point) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className =
      'atlas-marker vector-marker' + (point.personal ? ' character-map-marker' : '');
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
    guardedMarker(element, {
      editable: () => this.options.editable(point),
      signal: this.events.signal,
      onTap: () => {
        if (!this.options.onPoint(point)) this.openPopup(point);
      },
      onStart: () => {
        this.toggleDrag(false);
        this.popup.hidden = true;
        this.notice('Posição liberada. Arraste o marcador e solte para salvar.');
      },
      onMove: (event) =>
        overlay.setPosition(this.raw.getCoordinateFromPixel(this.raw.getEventPixel(event))),
      onEnd: (moved) => {
        this.toggleDrag(true);
        this.notice('');
        if (moved)
          this.ctx.safe(async () => {
            try {
              await this.options.onMove(point, this.position(toLonLat(overlay.getPosition())));
            } catch (error) {
              overlay.setPosition(fromLonLat([point.lng, point.lat]));
              throw error;
            }
          });
      },
      onCancel: () => {
        overlay.setPosition(fromLonLat([point.lng, point.lat]));
        this.toggleDrag(true);
        this.notice('');
      }
    });
  }
  setMeasurement(a, b, label) {
    this.clearMeasurement();
    const points = [fromLonLat([a.lng, a.lat]), fromLonLat([b.lng, b.lat])],
      world = 40075016.6856;
    if (points[1][0] - points[0][0] > world / 2) points[1][0] -= world;
    if (points[0][0] - points[1][0] > world / 2) points[1][0] += world;
    const color =
      getComputedStyle(document.documentElement).getPropertyValue('--campaign-accent').trim() ||
      '#d92343';
    this.measurement = new VectorLayer({
      source: new VectorSource({ features: [new Feature(new LineString(points))] }),
      zIndex: 1000,
      style: new Style({
        stroke: new Stroke({ color, width: 3, lineDash: [8, 8] }),
        text: new Text({
          text: label,
          font: 'bold 14px system-ui',
          placement: 'line',
          offsetY: -15,
          fill: new Fill({ color: '#fff4f7' }),
          stroke: new Stroke({ color: '#160c14', width: 6 }),
          backgroundFill: new Fill({ color: '#160c14' }),
          padding: [5, 8, 5, 8]
        })
      })
    });
    this.raw.addLayer(this.measurement);
  }
  clearMeasurement() {
    if (this.measurement) {
      this.raw.removeLayer(this.measurement);
      this.measurement = null;
    }
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
