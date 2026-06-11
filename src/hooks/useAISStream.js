import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore.js';
import { mapAISTypeToCategory, mmsiToFlag } from '../utils/aisParser.js';
import { supabase } from '../utils/supabaseClient.js';

const BUFFER_INTERVAL_MS = 500;
const LS_CACHE_KEY = 'seabird_ships_v1';
const LS_CACHE_TTL_MS = 10 * 60 * 1000; // 10분
const PROXY_WS_URL = import.meta.env.VITE_PROXY_URL
  ? import.meta.env.VITE_PROXY_URL.replace(/^http/, 'ws') + '/relay'
  : 'ws://localhost:3001/relay';

export function useAISStream(mapRef) {
  const bufferRef = useRef([]);
  const shipMapRef = useRef(new Map()); // mmsi → feature (최신 위치 유지)
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const { setWsStatus, setShipCount } = useStore.getState();

  const loadCache = useCallback(async () => {
    const trySetData = () => {
      const source = mapRef.current?.getSource('ships');
      if (source) {
        const features = Array.from(shipMapRef.current.values());
        source.setData({ type: 'FeatureCollection', features });
        setShipCount(features.length);
      } else {
        setTimeout(trySetData, 300);
      }
    };

    // 1) localStorage 즉시 복원 (~0ms) — 지도 소스 준비되면 바로 렌더링
    try {
      const raw = localStorage.getItem(LS_CACHE_KEY);
      if (raw) {
        const { ts, features } = JSON.parse(raw);
        if (Date.now() - ts < LS_CACHE_TTL_MS && Array.isArray(features)) {
          features.forEach(f => shipMapRef.current.set(f.properties.mmsi, f));
          trySetData();
        }
      }
    } catch { /* localStorage 비활성화 또는 파싱 실패 무시 */ }

    // 2) Supabase에서 최신 데이터 로드 (백그라운드)
    const { data: ships } = await supabase
      .from('ships')
      .select('mmsi, ship_name, vessel_type, lat, lng, speed, heading, destination, flag_country, nav_status, eta')
      .not('lat', 'is', null)
      .limit(5000);

    if (!ships?.length) return;

    ships.forEach((ship) => {
      const existing = shipMapRef.current.get(ship.mmsi);
      if (existing) {
        // 라이브 스트림 위치는 유지하되 정적 데이터만 보강
        if (ship.ship_name) existing.properties.ship_name = ship.ship_name;
        if (ship.vessel_type && ship.vessel_type !== 'Other') existing.properties.vessel_type = ship.vessel_type;
        if (ship.destination) existing.properties.destination = ship.destination;
        if (ship.flag_country) existing.properties.flag_country = ship.flag_country;
        if (ship.nav_status != null) existing.properties.nav_status = ship.nav_status;
        if (ship.eta) existing.properties.eta = ship.eta;
      } else {
        shipMapRef.current.set(ship.mmsi, {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [ship.lng, ship.lat] },
          properties: {
            mmsi: ship.mmsi,
            ship_name: ship.ship_name ?? '',
            vessel_type: ship.vessel_type ?? 'Other',
            speed: ship.speed ?? 0,
            heading: ship.heading ?? 0,
            destination: ship.destination ?? '',
            flag_country: ship.flag_country ?? '',
            nav_status: ship.nav_status ?? null,
            eta: ship.eta ?? null,
          },
        });
      }
    });

    trySetData();

    // 3) localStorage 갱신 (다음 새로고침에서 즉시 사용)
    try {
      const features = Array.from(shipMapRef.current.values());
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ ts: Date.now(), features }));
    } catch { /* 용량 초과 등 무시 */ }
  }, [mapRef, setShipCount]);

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
          const navStatus = (m.NavigationStatus != null && m.NavigationStatus !== 15) ? m.NavigationStatus : null;
          const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [m.Longitude, m.Latitude] },
            properties: {
              mmsi: String(m.UserID),
              ship_name: '',
              vessel_type: 'Other',
              speed: m.Sog ?? 0,
              heading,
              nav_status: navStatus,
              eta: null,
            },
          };
          // 이미 존재하는 선박이면 정적 데이터 유지
          const existing = shipMapRef.current.get(String(m.UserID));
          if (existing) {
            feature.properties.ship_name = existing.properties.ship_name;
            feature.properties.vessel_type = existing.properties.vessel_type;
            feature.properties.destination = existing.properties.destination;
            feature.properties.flag_country = existing.properties.flag_country ?? '';
          }
          bufferRef.current.push(feature);
        } else if (msg.MessageType === 'ShipStaticData') {
          const m = msg.Message.ShipStaticData;
          const mmsi = String(m.UserID);
          const existing = shipMapRef.current.get(mmsi);
          if (existing) {
            if (m.Name?.trim()) existing.properties.ship_name = m.Name.trim();
            if (m.Destination?.trim()) existing.properties.destination = m.Destination.trim();
            if (m.CallSign?.trim()) existing.properties.call_sign = m.CallSign.trim();
            if (m.ImoNumber) existing.properties.imo = String(m.ImoNumber).replace(/\D/g, '').slice(0, 7);
            if (m.MaximumStaticDraught) existing.properties.max_draught = m.MaximumStaticDraught;
            if (m.Type) existing.properties.vessel_type = mapAISTypeToCategory(m.Type);
            existing.properties.flag_country = mmsiToFlag(mmsi);
            if (m.Destination?.trim()) existing.properties.destination = m.Destination.trim();
            if (m.Eta) existing.properties.eta = m.Eta;
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
    loadCache();
    connect();
    intervalRef.current = setInterval(flushBuffer, BUFFER_INTERVAL_MS);

    return () => {
      wsRef.current?.close();
      clearInterval(intervalRef.current);
    };
  }, [connect, flushBuffer, loadCache]);
}
