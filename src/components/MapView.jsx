import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import useStore from '../store/useStore.js';
import { useAISStream } from '../hooks/useAISStream.js';
import { ChokepointMarkers } from './ChokepointMarker.jsx';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const VESSEL_COLORS = [
  'match', ['get', 'vessel_type'],
  'Container Ship', '#3B82F6',
  'Tanker',         '#EF4444',
  'Bulk Carrier',   '#EAB308',
  'LNG Carrier',    '#14B8A6',
  '#FFFFFF',
];

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const { setSelectedShip, mapCenter, mapZoom, focusMap } = useStore();

  useAISStream(mapRef);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [127.0, 35.0],
      zoom: 4,
      antialias: true,
    });

    mapRef.current = map;

    map.on('load', () => {
      // 선박 GeoJSON 소스
      map.addSource('ships', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // 방향 삼각형 아이콘 생성
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
      map.addImage('ship-arrow', { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data });

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

      // 선박 클릭 이벤트
      map.on('click', 'ships-layer', (e) => {
        if (!e.features.length) return;
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates;
        setSelectedShip({ ...props, lat: coords[1], lng: coords[0] });
      });

      map.on('mouseenter', 'ships-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'ships-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // 초크포인트 마커 초기화
      markersRef.current = new ChokepointMarkers(map);
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    return () => map.remove();
  }, []);

  // mapCenter / mapZoom 변경 시 flyTo
  const prevCenterRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const key = mapCenter.join(',') + ':' + mapZoom;
    if (prevCenterRef.current === key) return;
    prevCenterRef.current = key;
    mapRef.current.flyTo({ center: mapCenter, zoom: mapZoom, duration: 1500 });
  }, [mapCenter, mapZoom]);

  return (
    <div
      ref={mapContainerRef}
      className="flex-1 h-full"
      style={{ background: '#0A0E1A' }}
    />
  );
}
