import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import useStore from '../store/useStore.js';
import { useAISStream } from '../hooks/useAISStream.js';
import { ChokepointMarkers } from './ChokepointMarker.jsx';
import MapFilter, { VESSEL_TYPE_CONFIG, ALL_VESSEL_TYPES } from './MapFilter.jsx';
import { PortMarkers } from './PortMarker.jsx';
import { WeatherMarkers } from './WeatherMarker.jsx';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const VESSEL_COLORS = [
  'match', ['get', 'vessel_type'],
  'Container Ship', '#3B82F6',
  'Tanker',         '#EF4444',
  'Bulk Carrier',   '#EAB308',
  'LNG Carrier',    '#14B8A6',
  'Passenger',      '#F97316',
  'Fishing',        '#22C55E',
  'Special Craft',  '#8B5CF6',
  '#9CA3AF',
];

const MAP_STYLES = [
  { id: 'dark',      label: 'Dark',      url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'ocean',     label: 'Ocean',     url: 'mapbox://styles/mapbox/navigation-night-v1' },
];

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const portMarkersRef = useRef(null);
  const weatherMarkersRef = useRef(null);
  const { setSelectedShip, selectedShip, selectedRegion, mapCenter, mapZoom, mapFilters, shipTrack } = useStore();
  const [activeStyle, setActiveStyle] = useState('dark');
  const [mapError, setMapError] = useState(false);

  useAISStream(mapRef);

  function setupShipsLayer(map) {
    if (map.getSource('ships')) return;

    map.addSource('ships', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // 선박 아이콘 이미지 (SDF 모드 — icon-color 적용 필수)
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size, size);
    ctx.lineTo(size / 2, size * 0.7);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();
    map.addImage('ship-arrow', { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data }, { sdf: true });

    // 베이스 원형 레이어 — SDF가 아니라 어느 줌에서도 또렷(저줌 가시성 보장). 화살표보다 먼저 add.
    map.addLayer({
      id: 'ships-dot',
      type: 'circle',
      source: 'ships',
      paint: {
        'circle-color': VESSEL_COLORS,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.2, 6, 3.2, 12, 5],
        'circle-opacity': 0.9,
        'circle-stroke-width': 0.6,
        'circle-stroke-color': 'rgba(0,0,0,0.5)',
      },
    });

    // 화살표 심볼 — 고줌(≥6)에서만 방향 표시용으로 점 위에 겹쳐 그림.
    // (SDF 아이콘은 저줌 축소 시 거리장 픽셀 부족으로 사라지므로 minzoom으로 제한)
    map.addLayer({
      id: 'ships-layer',
      type: 'symbol',
      source: 'ships',
      minzoom: 6,
      layout: {
        'icon-image': 'ship-arrow',
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 10, 1.0],
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': VESSEL_COLORS,
        'icon-opacity': 0.9,
      },
    });

    // 클릭·호버 — 점·화살표 두 레이어 모두에 등록(저줌에서 점 클릭도 동작)
    const onShipClick = (e) => {
      if (!e.features.length) return;
      const props = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates;
      setSelectedShip({ ...props, lat: coords[1], lng: coords[0] });
    };
    ['ships-dot', 'ships-layer'].forEach((id) => {
      map.on('click', id, onShipClick);
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    // ChokepointMarker 및 PortMarker 초기화
    if (markersRef.current) markersRef.current.destroy?.();
    markersRef.current = new ChokepointMarkers(map);

    if (portMarkersRef.current) portMarkersRef.current.destroy?.();
    portMarkersRef.current = new PortMarkers(map);

    if (weatherMarkersRef.current) weatherMarkersRef.current.destroy?.();
    weatherMarkersRef.current = new WeatherMarkers(map);

    // 선박 경로 소스 (초기 빈 LineString)
    if (!map.getSource('ship-track')) {
      map.addSource('ship-track', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      });
      map.addLayer({
        id: 'ship-track-line',
        type: 'line',
        source: 'ship-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#60A5FA',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1],
        },
      });
    }

    // 항적 시작점/현재 위치 점 소스 (초기 빈 FeatureCollection)
    if (!map.getSource('ship-track-points')) {
      map.addSource('ship-track-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'ship-track-points-layer',
        type: 'circle',
        source: 'ship-track-points',
        paint: {
          'circle-radius': ['match', ['get', 'role'], 'current', 7, 4],
          'circle-color': ['match', ['get', 'role'], 'current', '#60A5FA', '#94A3B8'],
          'circle-opacity': ['match', ['get', 'role'], 'current', 1, 0.7],
          'circle-stroke-width': ['match', ['get', 'role'], 'current', 2, 1],
          'circle-stroke-color': '#FFFFFF',
        },
      });
    }
  }

  useEffect(() => {
    // WebGL 미지원·Mapbox 초기화 실패 시 앱 전체가 크래시하지 않도록 방어 (에러 바운더리 부재)
    let map;
    try {
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLES[0].url,
        center: [131.0, 36.5], // 한국(좌)·일본(우)이 함께 보이는 초기 뷰 (store 초기값과 일치)
        zoom: 4.6,
        antialias: true,
      });
    } catch (e) {
      console.error('[MapView] 지도 초기화 실패 (WebGL 미지원 가능):', e?.message);
      setMapError(true);
      return;
    }

    mapRef.current = map;
    map.on('error', () => {}); // 타일 로드 등 비치명적 에러는 무시 (콘솔 스팸 방지)
    map.on('load', () => setupShipsLayer(map));
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    return () => map.remove();
  }, []);

  // 스타일 전환
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = MAP_STYLES.find(s => s.id === activeStyle);
    if (!style) return;
    const currentData = map.getSource('ships')?._data;
    const currentTrack = map.getSource('ship-track')?._data;
    const currentTrackPoints = map.getSource('ship-track-points')?._data;
    map.setStyle(style.url);
    map.once('style.load', () => {
      setupShipsLayer(map);
      if (currentData) map.getSource('ships')?.setData(currentData);
      if (currentTrack) map.getSource('ship-track')?.setData(currentTrack);
      if (currentTrackPoints) map.getSource('ship-track-points')?.setData(currentTrackPoints);
    });
  }, [activeStyle]);

  // mapCenter / mapZoom flyTo
  const prevCenterRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const key = mapCenter.join(',') + ':' + mapZoom;
    if (prevCenterRef.current === key) return;
    prevCenterRef.current = key;
    // 좌측 상세 패널(선박/지역, w-26rem)이 열려 있으면 대상이 패널에 가리지 않도록
    // 화면 중심에서 우측으로 패널 폭의 절반(~210px)만큼 보정해 우측 영역 중앙에 오게 함
    const panelOpen = selectedShip || selectedRegion;
    mapRef.current.flyTo({
      center: mapCenter,
      zoom: mapZoom,
      duration: 1500,
      offset: panelOpen ? [210, 0] : [0, 0],
    });
  }, [mapCenter, mapZoom]);

  // 지도 필터 적용
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('ships-dot')) return;

    const { vesselTypes, flagCountries, speedMax } = mapFilters;
    const filterParts = ['all'];

    if (vesselTypes.length < ALL_VESSEL_TYPES.length) {
      filterParts.push(['in', ['get', 'vessel_type'], ['literal', vesselTypes]]);
    }
    if (flagCountries.length > 0) {
      filterParts.push(['in', ['get', 'flag_country'], ['literal', flagCountries]]);
    }
    if (speedMax < 30) {
      filterParts.push(['<=', ['to-number', ['get', 'speed'], 0], speedMax]);
    }

    map.setFilter('ships-dot', filterParts);
    if (map.getLayer('ships-layer')) map.setFilter('ships-layer', filterParts);
  }, [mapFilters]);

  // 선박 경로 표시 (선 + 시작/현재 점 + 자동 화면 맞춤)
  useEffect(() => {
    const map = mapRef.current;
    const lineSrc = map?.getSource('ship-track');
    const pointSrc = map?.getSource('ship-track-points');
    if (!lineSrc || !pointSrc) return;

    const coords = shipTrack.map(p => [p.lng, p.lat]);

    lineSrc.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
    });

    // shipTrack: 오래된→최신 순. [0]=출발점, [마지막]=현재 위치
    const pointFeatures = [];
    if (coords.length > 0) {
      if (coords.length > 1) {
        pointFeatures.push({
          type: 'Feature',
          properties: { role: 'start' },
          geometry: { type: 'Point', coordinates: coords[0] },
        });
      }
      pointFeatures.push({
        type: 'Feature',
        properties: { role: 'current' },
        geometry: { type: 'Point', coordinates: coords[coords.length - 1] },
      });
    }
    pointSrc.setData({ type: 'FeatureCollection', features: pointFeatures });

    // 항적 전체가 보이도록 화면 맞춤 (좌측 카드에 가리지 않게 패딩)
    if (coords.length >= 2) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
      );
      map.fitBounds(bounds, {
        padding: { left: 360, right: 60, top: 60, bottom: 60 },
        maxZoom: 9,
        duration: 1200,
      });
    }
  }, [shipTrack]);

  return (
    <div className="relative flex-1 h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ background: '#0A0E1A' }}
      />
      {mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 pointer-events-none">
          <span className="text-3xl">🛰️</span>
          <p className="text-sm text-white/70">지도를 표시할 수 없습니다</p>
          <p className="text-[11px] text-white/40">브라우저에서 WebGL이 비활성화되어 있거나 지원되지 않습니다.<br/>하드웨어 가속을 켜거나 최신 브라우저에서 다시 시도해 주세요.</p>
        </div>
      )}
      {/* 맵 스타일 토글 — 선박 선택 시 좌측 카드에 가리지 않게 오른쪽으로 이동 */}
      <div className={`absolute top-3 left-3 flex gap-1 z-10 transition-all duration-300 ${(selectedShip || selectedRegion) ? 'md:left-[27.5rem]' : 'md:left-3'}`}>
        {MAP_STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveStyle(s.id)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
              activeStyle === s.id
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-black/60 border-white/20 text-white/70 hover:border-white/50 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 컬러 범례 */}
      <div className="absolute top-3 right-3 z-10 bg-black/70 border border-white/15 rounded-lg px-2 py-1.5 space-y-0.5">
        {VESSEL_TYPE_CONFIG.map(({ id, label, color }) => (
          <div key={id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
            <span className="text-[9px] text-white/70">{label}</span>
          </div>
        ))}
      </div>

      {/* 필터 UI */}
      <MapFilter />
    </div>
  );
}
