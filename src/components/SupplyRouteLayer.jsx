// 에너지·광물 공급 루트 지도 레이어 — 품목 클릭 시 공급원별 해상 항로(LineString) + % 라벨 +
// 루트가 지나는 초크포인트 위험포인트(라이브 severity 색). /api/supply-routes 응답을 setData로 받음.
import { koCountry } from '../data/countryData.js';

const COMMODITY_COLOR = {
  crude: '#F59E0B', refined: '#FB923C', lng: '#38BDF8', coal: '#64748B',
  iron_ore: '#FB7185', copper: '#F97316', nickel: '#A3E635', rare_earth: '#C084FC', grain: '#FACC15',
};
// 7개 초크포인트 좌표 [lng,lat] (chokepointWatcher와 동기)
const CHOKEPOINT_COORDS = {
  suez: [32.36, 30.42], malacca: [100.98, 2.88], hormuz: [56.5, 26.5], panama: [-79.9, 9.1],
  dover: [1.5, 51.0], korea_strait: [129.5, 34.2], bab_el_mandeb: [43.5, 12.5],
};
const CHOKEPOINT_KO = {
  suez: '수에즈', malacca: '말라카', hormuz: '호르무즈', panama: '파나마',
  dover: '도버', korea_strait: '대한해협', bab_el_mandeb: '바브엘만데브',
};
const SEV_COLOR = { CRITICAL: '#EF4444', WARNING: '#F59E0B', INFO: '#22D3EE' };

const EMPTY = { type: 'FeatureCollection', features: [] };

export class SupplyRouteLayer {
  constructor(map) {
    this.map = map;
    this._init();
  }

  _init() {
    if (!this.map.getSource('supply-routes')) this.map.addSource('supply-routes', { type: 'geojson', data: EMPTY });
    if (!this.map.getSource('supply-risks')) this.map.addSource('supply-risks', { type: 'geojson', data: EMPTY });

    this.map.addLayer({
      id: 'supply-routes-line', type: 'line', source: 'supply-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['get', 'pct'], 0, 1.5, 60, 7], // % 클수록 굵게
        'line-opacity': 0.85,
      },
    });
    this.map.addLayer({
      id: 'supply-routes-label', type: 'symbol', source: 'supply-routes',
      layout: {
        'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-size': 12,
        'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(0,0,0,0.95)', 'text-halo-width': 1.6 },
    });
    // 위험포인트(초크포인트)
    this.map.addLayer({
      id: 'supply-risks-circle', type: 'circle', source: 'supply-risks',
      paint: {
        'circle-radius': 9, 'circle-color': ['get', 'color'], 'circle-opacity': 0.85,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF',
      },
    });
    this.map.addLayer({
      id: 'supply-risks-label', type: 'symbol', source: 'supply-risks',
      layout: {
        'text-field': ['concat', '⚠ ', ['get', 'name']], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 1],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      },
      paint: { 'text-color': '#FECACA', 'text-halo-color': 'rgba(0,0,0,0.95)', 'text-halo-width': 1.4 },
    });
  }

  // payload: { routes:[{commodity,supplier_code,share_pct,route_geojson,chokepoints}], chokepoint_status:{id:{severity}} }
  setData(payload) {
    const routes = (payload?.routes ?? []).filter(r => r.route_geojson?.geometry);
    const color = COMMODITY_COLOR[payload?.commodity] ?? '#A855F7';
    const lineFeatures = routes.map(r => ({
      type: 'Feature',
      geometry: r.route_geojson.geometry,
      properties: { color, pct: r.share_pct ?? 0, label: `${koCountry(r.supplier_code)} ${r.share_pct ?? '?'}%` },
    }));
    this.map.getSource('supply-routes')?.setData({ type: 'FeatureCollection', features: lineFeatures });

    // 루트들이 지나는 초크포인트 집합 → 위험포인트 마커(라이브 severity 색)
    const cpSet = new Set();
    routes.forEach(r => (r.chokepoints ?? []).forEach(id => cpSet.add(id)));
    const status = payload?.chokepoint_status ?? {};
    const riskFeatures = [...cpSet].filter(id => CHOKEPOINT_COORDS[id]).map(id => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: CHOKEPOINT_COORDS[id] },
      properties: { name: CHOKEPOINT_KO[id] ?? id, color: SEV_COLOR[status[id]?.severity] ?? SEV_COLOR.INFO },
    }));
    this.map.getSource('supply-risks')?.setData({ type: 'FeatureCollection', features: riskFeatures });
  }

  clear() {
    this.map.getSource('supply-routes')?.setData(EMPTY);
    this.map.getSource('supply-risks')?.setData(EMPTY);
  }

  destroy() {
    for (const id of ['supply-routes-label', 'supply-routes-line', 'supply-risks-label', 'supply-risks-circle']) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    if (this.map.getSource('supply-routes')) this.map.removeSource('supply-routes');
    if (this.map.getSource('supply-risks')) this.map.removeSource('supply-risks');
  }
}
