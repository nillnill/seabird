import useStore from '../store/useStore.js';
import { COUNTRY_LIST } from '../data/countryData.js';

// 국가 포인트 (Civ '수도' 스타일) — GL circle+symbol 레이어. 🌐 지정학 모드에서만 표시.
// 클릭 → setSelectedCountry → CountryFulcrumPanel.
const GEOJSON = {
  type: 'FeatureCollection',
  features: COUNTRY_LIST.map((c, i) => ({
    type: 'Feature',
    id: i,
    geometry: { type: 'Point', coordinates: [c.coords[0], c.coords[1]] },
    properties: { code: c.code, name: c.name, flag: c.flagEmoji, lng: c.coords[0], lat: c.coords[1] },
  })),
};

export class CountryMarkers {
  constructor(map) {
    this.map = map;
    this._onClick = this._onClick.bind(this);
    this._onEnter = () => { this.map.getCanvas().style.cursor = 'pointer'; };
    this._onLeave = () => { this.map.getCanvas().style.cursor = ''; };
    this._init();
  }

  _init() {
    if (!this.map.getSource('countries')) this.map.addSource('countries', { type: 'geojson', data: GEOJSON });

    // 후광(큰 원) — Civ 수도 느낌
    this.map.addLayer({
      id: 'countries-glow', type: 'circle', source: 'countries',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 18],
        'circle-color': '#A855F7', 'circle-opacity': 0.18,
        'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(168,85,247,0.5)',
      },
    });
    this.map.addLayer({
      id: 'countries-core', type: 'circle', source: 'countries',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 6, 7],
        'circle-color': '#C084FC', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF',
      },
    });
    // 라벨: 국기 + 국가명 (항상 표시)
    this.map.addLayer({
      id: 'countries-label', type: 'symbol', source: 'countries',
      layout: {
        'text-field': ['concat', ['get', 'flag'], '  ', ['get', 'name']],
        'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 0.8],
        'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'], 'text-optional': true,
      },
      paint: { 'text-color': '#EDE9FE', 'text-halo-color': 'rgba(20,0,40,0.95)', 'text-halo-width': 1.6 },
    });

    for (const id of ['countries-core', 'countries-glow']) {
      this.map.on('click', id, this._onClick);
      this.map.on('mouseenter', id, this._onEnter);
      this.map.on('mouseleave', id, this._onLeave);
    }
  }

  _onClick(e) {
    if (!e.features?.length) return;
    const { code, name, lat, lng } = e.features[0].properties;
    useStore.getState().setSelectedCountry({ code, name, lat: Number(lat), lng: Number(lng) });
  }

  destroy() {
    for (const id of ['countries-core', 'countries-glow']) {
      this.map.off('click', id, this._onClick);
      this.map.off('mouseenter', id, this._onEnter);
      this.map.off('mouseleave', id, this._onLeave);
    }
    for (const id of ['countries-label', 'countries-core', 'countries-glow']) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    if (this.map.getSource('countries')) this.map.removeSource('countries');
  }
}
