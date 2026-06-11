import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import useStore from '../store/useStore.js';
import { useAISStream } from '../hooks/useAISStream.js';
import { ChokepointMarkers } from './ChokepointMarker.jsx';
import MapFilter, { VESSEL_TYPE_CONFIG, ALL_VESSEL_TYPES } from './MapFilter.jsx';
import { PortMarkers } from './PortMarker.jsx';

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
  const { setSelectedShip, mapCenter, mapZoom, mapFilters, shipTrack } = useStore();
  const [activeStyle, setActiveStyle] = useState('dark');

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

    // 선박 레이어
    map.addLayer({
      id: 'ships-layer',
      type: 'symbol',
      source: 'ships',
      layout: {
        'icon-image': 'ship-arrow',
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 8, 0.8],
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': VESSEL_COLORS,
        'icon-opacity': 0.9,
      },
    });

    map.on('click', 'ships-layer', (e) => {
      if (!e.features.length) return;
      const props = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates;
      setSelectedShip({ ...props, lat: coords[1], lng: coords[0] });
    });
    map.on('mouseenter', 'ships-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'ships-layer', () => { map.getCanvas().style.cursor = ''; });

    // ChokepointMarker 및 PortMarker 초기화
    if (markersRef.current) markersRef.current.destroy?.();
    markersRef.current = new ChokepointMarkers(map);

    if (portMarkersRef.current) portMarkersRef.current.destroy?.();
    portMarkersRef.current = new PortMarkers(map);

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
        paint: {
          'line-color': '#60A5FA',
          'line-width': 2,
          'line-opacity': 0.75,
          'line-dasharray': [2, 1],
        },
      });
    }
  }

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[0].url,
      center: [127.0, 35.0],
      zoom: 4,
      antialias: true,
    });

    mapRef.current = map;
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
    map.setStyle(style.url);
    map.once('style.load', () => {
      setupShipsLayer(map);
      if (currentData) map.getSource('ships')?.setData(currentData);
      if (currentTrack) map.getSource('ship-track')?.setData(currentTrack);
    });
  }, [activeStyle]);

  // mapCenter / mapZoom flyTo
  const prevCenterRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const key = mapCenter.join(',') + ':' + mapZoom;
    if (prevCenterRef.current === key) return;
    prevCenterRef.current = key;
    mapRef.current.flyTo({ center: mapCenter, zoom: mapZoom, duration: 1500 });
  }, [mapCenter, mapZoom]);

  // 지도 필터 적용
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('ships-layer')) return;

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

    map.setFilter('ships-layer', filterParts);
  }, [mapFilters]);

  // 선박 경로 표시
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('ship-track');
    if (!src) return;
    const coords = shipTrack.map(p => [p.lng, p.lat]);
    src.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
    });
  }, [shipTrack]);

  return (
    <div className="relative flex-1 h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ background: '#0A0E1A' }}
      />
      {/* 맵 스타일 토글 */}
      <div className="absolute top-3 left-3 flex gap-1 z-10">
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
