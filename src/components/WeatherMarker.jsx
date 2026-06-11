import mapboxgl from 'mapbox-gl';
import useStore from '../store/useStore.js';

// 날씨 이모지 마커 — WEATHER_AGENT 보고의 raw_data.points를 지도에 렌더.
// store에 subscribeWithSelector 미들웨어가 없으므로 평범한 subscribe + 수동 diff 사용.
export class WeatherMarkers {
  constructor(map) {
    this.map = map;
    this.markers = {};  // id → { marker, el }

    this._render(useStore.getState().weatherMarkers);
    this.unsubscribe = useStore.subscribe((state, prev) => {
      if (state.weatherMarkers !== prev.weatherMarkers) this._render(state.weatherMarkers);
    });
  }

  _render(points) {
    const list = Array.isArray(points) ? points : [];
    const nextIds = new Set(list.map((p) => p.id));

    // 사라진 지점 제거
    for (const id of Object.keys(this.markers)) {
      if (!nextIds.has(id)) {
        this.markers[id].marker.remove();
        delete this.markers[id];
      }
    }

    // 추가 / 갱신
    list.forEach((p) => {
      const title = `${p.name}: ${p.desc} · 돌풍 ${p.gust}m/s`;
      const existing = this.markers[p.id];
      if (existing) {
        existing.el.textContent = p.emoji;
        existing.el.className = `weather-marker severity-${p.severity}`;
        existing.el.title = title;
      } else {
        const el = document.createElement('div');
        el.className = `weather-marker severity-${p.severity}`;
        el.textContent = p.emoji;
        el.title = title;
        const marker = new mapboxgl.Marker({ element: el, offset: [0, -20] })
          .setLngLat([p.lng, p.lat])
          .addTo(this.map);
        this.markers[p.id] = { marker, el };
      }
    });
  }

  destroy() {
    this.unsubscribe?.();
    Object.values(this.markers).forEach(({ marker }) => marker.remove());
    this.markers = {};
  }
}
