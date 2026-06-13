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
  const lastSaveRef = useRef(0); // localStorage 마지막 저장 시각
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
    let cacheFresh = false;
    try {
      const raw = localStorage.getItem(LS_CACHE_KEY);
      if (raw) {
        const { ts, features } = JSON.parse(raw);
        if (Date.now() - ts < LS_CACHE_TTL_MS && Array.isArray(features) && features.length) {
          features.forEach(f => shipMapRef.current.set(f.properties.mmsi, f));
          trySetData();
          lastSaveRef.current = ts;
          cacheFresh = true;
        }
      }
    } catch { /* localStorage 비활성화 또는 파싱 실패 무시 */ }

    // 2) Supabase 보강 — 캐시 신선 여부와 무관하게 항상 실행.
    // (라이브 relay 선박은 vessel_type='Other'로만 들어오므로, 서버가 누적한 선종/국적을
    //  Supabase에서 끌어와 지도 색상(선종)을 채운다. 과거엔 캐시 신선 시 생략돼 거의 회색이었음.)
    await enrichFromSupabase();
  }, [mapRef, setShipCount]);

  // Supabase ships 테이블의 정적 데이터(선종·국적·선명·목적지)를 라이브 지도에 병합.
  // 주기적으로도 호출돼 서버가 선종을 더 받을수록 지도가 점점 색칠된다.
  const enrichFromSupabase = useCallback(async () => {
    // updated_at 최신순 — 지금 송신 중인(=지도에 떠 있는) 선박과 최대한 겹치게 해 선종 매칭률↑
    const { data: ships } = await supabase
      .from('ships')
      .select('mmsi, ship_name, vessel_type, lat, lng, speed, heading, destination, flag_country, nav_status, eta')
      .not('lat', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(6000);

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

    // 지도 갱신 + localStorage 갱신
    const source = mapRef.current?.getSource('ships');
    const features = Array.from(shipMapRef.current.values());
    if (source) { source.setData({ type: 'FeatureCollection', features }); setShipCount(features.length); }
    try {
      const now = Date.now();
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ ts: now, features }));
      lastSaveRef.current = now;
    } catch { /* 용량 초과 등 무시 */ }
  }, [mapRef, setShipCount]);

  const flushBuffer = useCallback(() => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource('ships');
    if (!source) return;

    let changed = false;
    if (bufferRef.current.length) {
      bufferRef.current.forEach((f) => shipMapRef.current.set(f.properties.mmsi, f));
      bufferRef.current = [];
      changed = true;
    }

    // 선택 선박 보강 오버라이드 적용 — 패널이 dbShip으로 알아낸 선종/국적을 마커에 즉시 반영
    const overrides = useStore.getState().shipOverrides;
    for (const mmsi in overrides) {
      const f = shipMapRef.current.get(mmsi);
      if (!f) continue;
      const p = overrides[mmsi];
      if (p.vessel_type && p.vessel_type !== 'Other' && f.properties.vessel_type !== p.vessel_type) {
        f.properties.vessel_type = p.vessel_type; changed = true;
      }
      if (p.flag_country && f.properties.flag_country !== p.flag_country) {
        f.properties.flag_country = p.flag_country; changed = true;
      }
    }

    if (!changed) return;

    const features = Array.from(shipMapRef.current.values());
    source.setData({ type: 'FeatureCollection', features });
    setShipCount(features.length);

    // 라이브 위치로 localStorage 캐시를 따뜻하게 유지 (최대 60초마다 1회)
    const now = Date.now();
    if (now - lastSaveRef.current > 60_000) {
      lastSaveRef.current = now;
      try {
        localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ ts: now, features }));
      } catch { /* 용량 초과 등 무시 */ }
    }
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
        } else if (msg.MessageType === 'ExtendedClassBPositionReport') {
          // Class B 확장 위치 — 위치 + 선종(Type) 동시 제공 (소형선 색상 확보)
          const m = msg.Message.ExtendedClassBPositionReport;
          if (m?.Latitude != null && m?.Longitude != null) {
            const mmsi = String(m.UserID);
            const th = (m.TrueHeading != null && m.TrueHeading >= 0 && m.TrueHeading <= 359) ? m.TrueHeading : (m.Cog ?? 0);
            const existing = shipMapRef.current.get(mmsi);
            const type = m.Type ? mapAISTypeToCategory(m.Type) : (existing?.properties.vessel_type ?? 'Other');
            shipMapRef.current.set(mmsi, {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [m.Longitude, m.Latitude] },
              properties: {
                mmsi,
                ship_name: m.Name?.trim() || existing?.properties.ship_name || '',
                vessel_type: type !== 'Other' ? type : (existing?.properties.vessel_type ?? 'Other'),
                speed: m.Sog ?? 0,
                heading: th,
                destination: existing?.properties.destination ?? '',
                flag_country: mmsiToFlag(mmsi) ?? '',
                nav_status: null,
                eta: null,
              },
            });
          }
        } else if (msg.MessageType === 'ShipStaticData' || msg.MessageType === 'StaticDataReport') {
          const isClassB = msg.MessageType === 'StaticDataReport';
          const m = isClassB ? msg.Message.StaticDataReport : msg.Message.ShipStaticData;
          if (!m) return;
          const mmsi = String(m.UserID);
          const existing = shipMapRef.current.get(mmsi);
          if (existing) {
            const name = isClassB ? m.ReportA?.Name : m.Name;
            const typeCode = isClassB ? m.ReportB?.ShipType : m.Type;
            if (name?.trim()) existing.properties.ship_name = name.trim();
            if (typeCode) { const t = mapAISTypeToCategory(typeCode); if (t !== 'Other') existing.properties.vessel_type = t; }
            existing.properties.flag_country = mmsiToFlag(mmsi) ?? existing.properties.flag_country ?? '';
            if (!isClassB) {
              if (m.Destination?.trim()) existing.properties.destination = m.Destination.trim();
              if (m.CallSign?.trim()) existing.properties.call_sign = m.CallSign.trim();
              if (m.ImoNumber) existing.properties.imo = String(m.ImoNumber).replace(/\D/g, '').slice(0, 7);
              if (m.MaximumStaticDraught) existing.properties.max_draught = m.MaximumStaticDraught;
              if (m.Eta) existing.properties.eta = m.Eta;
            }
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
    // 3분마다 Supabase에서 선종·국적 보강 → 지도 색상이 시간이 지날수록 채워짐
    const enrichTimer = setInterval(() => { enrichFromSupabase(); }, 3 * 60 * 1000);

    return () => {
      wsRef.current?.close();
      clearInterval(intervalRef.current);
      clearInterval(enrichTimer);
    };
  }, [connect, flushBuffer, loadCache, enrichFromSupabase]);
}
