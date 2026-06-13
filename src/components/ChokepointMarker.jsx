import mapboxgl from 'mapbox-gl';
import useStore from '../store/useStore.js';

export const CHOKEPOINTS = [
  { id: 'suez',          name: '수에즈 운하',    lng: 32.36,  lat: 30.42 },
  { id: 'malacca',       name: '말라카 해협',    lng: 100.98, lat: 2.88 },
  { id: 'hormuz',        name: '호르무즈 해협',  lng: 56.5,   lat: 26.5 },
  { id: 'panama',        name: '파나마 운하',    lng: -79.9,  lat: 9.1  },
  { id: 'dover',         name: '영불 해협',      lng: 1.5,    lat: 51.0 },
  { id: 'korea_strait',  name: '대한해협',       lng: 129.5,  lat: 34.2 },
  { id: 'bab_el_mandeb', name: '바브엘만데브',   lng: 43.5,   lat: 12.5 },
];

export class ChokepointMarkers {
  constructor(map) {
    this.map = map;
    this.markers = {};
    this.unsubscribe = null;

    CHOKEPOINTS.forEach((cp) => this._addMarker(cp, 'INFO'));

    // Zustand 스토어 구독
    this.unsubscribe = useStore.subscribe(
      (state) => state.chokepointSeverities,
      (severities) => {
        Object.entries(severities).forEach(([id, severity]) => {
          this._updateMarker(id, severity);
        });
      }
    );
  }

  _addMarker(cp, severity) {
    const el = document.createElement('div');
    el.className = `chokepoint-marker severity-${severity}`;
    el.title = cp.name;

    el.addEventListener('click', () => {
      useStore.getState().setSelectedRegion({ id: cp.id, name: cp.name, type: 'chokepoint', lat: cp.lat, lng: cp.lng });
    });

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([cp.lng, cp.lat])
      .addTo(this.map);

    this.markers[cp.id] = { marker, el, cp };
  }

  _updateMarker(id, severity) {
    const entry = this.markers[id];
    if (!entry) return;
    entry.el.className = `chokepoint-marker severity-${severity}`;
  }

  destroy() {
    this.unsubscribe?.();
    Object.values(this.markers).forEach(({ marker }) => marker.remove());
  }
}
