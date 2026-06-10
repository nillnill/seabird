import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore.js';
import { toGeoJSONFeature } from '../utils/aisParser.js';

const BUFFER_INTERVAL_MS = 500;
const PROXY_WS_URL = import.meta.env.VITE_PROXY_URL
  ? import.meta.env.VITE_PROXY_URL.replace(/^http/, 'ws') + '/relay'
  : 'ws://localhost:3001/relay';

export function useAISStream(mapRef) {
  const bufferRef = useRef([]);
  const shipMapRef = useRef(new Map()); // mmsi → feature (최신 위치 유지)
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const { setWsStatus, setShipCount } = useStore.getState();

  const flushBuffer = useCallback(() => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource('ships');
    if (!source) return;

    if (bufferRef.current.length === 0) return;

    bufferRef.current.forEach((f) => shipMapRef.current.set(f.properties.mmsi, f));
    bufferRef.current = [];

    const features = Array.from(shipMapRef.current.values());
    source.setData({ type: 'FeatureCollection', features });
    setShipCount(features.length);
  }, [mapRef, setShipCount]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('CONNECTING');
    const ws = new WebSocket(PROXY_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus('CONNECTED');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.MessageType === 'PositionReport') {
          const m = msg.Message.PositionReport;
          const heading = m.TrueHeading !== 511 ? m.TrueHeading : m.Cog ?? 0;
          const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [m.Longitude, m.Latitude] },
            properties: {
              mmsi: String(m.UserID),
              ship_name: '',
              vessel_type: 'Other',
              speed: m.Sog ?? 0,
              heading,
            },
          };
          // 이미 존재하는 선박이면 vessel_type 등 정적 데이터 유지
          const existing = shipMapRef.current.get(String(m.UserID));
          if (existing) {
            feature.properties.ship_name = existing.properties.ship_name;
            feature.properties.vessel_type = existing.properties.vessel_type;
            feature.properties.destination = existing.properties.destination;
          }
          bufferRef.current.push(feature);
        } else if (msg.MessageType === 'ShipStaticData') {
          const m = msg.Message.ShipStaticData;
          const mmsi = String(m.UserID);
          const existing = shipMapRef.current.get(mmsi);
          if (existing) {
            existing.properties.ship_name = m.Name?.trim() ?? '';
            existing.properties.destination = m.Destination?.trim() ?? '';
            // vessel_type 업데이트는 서버가 처리하므로 여기서는 생략
          }
        }
      } catch {
        // 파싱 실패는 무시
      }
    };

    ws.onerror = () => setWsStatus('ERROR');

    ws.onclose = () => {
      setWsStatus('DISCONNECTED');
      // 5초 후 재연결
      setTimeout(connect, 5000);
    };
  }, [setWsStatus]);

  useEffect(() => {
    connect();
    intervalRef.current = setInterval(flushBuffer, BUFFER_INTERVAL_MS);

    return () => {
      wsRef.current?.close();
      clearInterval(intervalRef.current);
    };
  }, [connect, flushBuffer]);
}
