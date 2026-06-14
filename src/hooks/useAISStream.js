import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore.js';
import { supabase } from '../utils/supabaseClient.js';

const BUFFER_INTERVAL_MS = 500;
const LS_CACHE_KEY = 'seabird_ships_v1';
const LS_CACHE_TTL_MS = 10 * 60 * 1000; // 10분
const PROXY_WS_URL = import.meta.env.VITE_PROXY_URL
  ? import.meta.env.VITE_PROXY_URL.replace(/^http/, 'ws') + '/relay'
  : 'ws://localhost:3001/relay';
const SELECT_COLS = 'mmsi, ship_name, vessel_type, lat, lng, speed, heading, destination, flag_country, nav_status, eta';

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

  // ships 행을 shipMapRef에 병합 (라이브 위치는 유지, 정적 데이터만 보강)
  const applyRows = useCallback((ships) => {
    ships.forEach((ship) => {
      const existing = shipMapRef.current.get(ship.mmsi);
      if (existing) {
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
  }, []);

  // Supabase ships 테이블의 정적 데이터(선종·국적·선명·목적지)를 라이브 지도에 병합.
  // 주기적으로도 호출돼 서버가 선종을 더 받을수록 지도가 점점 색칠된다.
  const enrichFromSupabase = useCallback(async () => {
    // 1) 화면 우선 보강 — 지금 지도에 떠 있으면서 아직 선종 미상('Other')이거나 국적 없는 선박을
    //    MMSI로 직접 조회. 6000 제한과 무관하게 '화면에 보이는 선박'을 100% 커버한다.
    //    (과거엔 updated_at 최신 6000척만 끌어와, 6000 바깥 선박은 클릭해야만 선종이 보였음.)
    const needIds = [];
    for (const [mmsi, f] of shipMapRef.current) {
      if (!f.properties.vessel_type || f.properties.vessel_type === 'Other' || !f.properties.flag_country) {
        needIds.push(mmsi);
      }
    }
    if (needIds.length) {
      const CHUNK = 300; // PostgREST URL 길이 한계 회피
      const chunks = [];
      for (let i = 0; i < needIds.length; i += CHUNK) chunks.push(needIds.slice(i, i + CHUNK));
      const results = await Promise.all(
        chunks.map((c) => supabase.from('ships').select(SELECT_COLS).in('mmsi', c).then(({ data }) => data ?? []))
      );
      results.forEach((rows) => applyRows(rows));
    }

    // 2) prefetch — 아직 지도에 없는(곧 들어올) 최신 선박. updated_at 최신순 6000척.
    const { data: ships } = await supabase
      .from('ships')
      .select(SELECT_COLS)
      .not('lat', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(6000);

    if (ships?.length) applyRows(ships);

    // 지도 갱신 + localStorage 갱신
    const source = mapRef.current?.getSource('ships');
    const features = Array.from(shipMapRef.current.values());
    if (source) { source.setData({ type: 'FeatureCollection', features }); setShipCount(features.length); }
    try {
      const now = Date.now();
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ ts: now, features }));
      lastSaveRef.current = now;
    } catch { /* 용량 초과 등 무시 */ }
  }, [mapRef, setShipCount, applyRows]);

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
        // 서버가 2초마다 보내는 compact 배치 스냅샷: { type:'snapshot', ships:[{mmsi,lat,lng,...}] }
        // (과거엔 raw aisstream 메시지를 1건씩 중계 → Render egress 폭증. 이제 변경분만 압축 묶음으로 수신)
        if (msg.type !== 'snapshot' || !Array.isArray(msg.ships)) return;
        for (const s of msg.ships) {
          const mmsi = String(s.mmsi);
          const existing = shipMapRef.current.get(mmsi);
          // 기존 정적 데이터 유지 + 새 값으로 갱신 (없는 필드는 그대로 둠)
          const props = existing
            ? { ...existing.properties }
            : { mmsi, ship_name: '', vessel_type: 'Other', speed: 0, heading: 0,
                destination: '', flag_country: '', nav_status: null, eta: null };
          if (s.speed != null) props.speed = s.speed;
          if (s.heading != null) props.heading = s.heading;
          if ('nav_status' in s) props.nav_status = s.nav_status;
          if (s.vessel_type && s.vessel_type !== 'Other') props.vessel_type = s.vessel_type;
          if (s.ship_name) props.ship_name = s.ship_name;
          if (s.flag_country) props.flag_country = s.flag_country;
          if (s.destination) props.destination = s.destination;
          if (s.eta) props.eta = s.eta;

          const lng = s.lng != null ? s.lng : existing?.geometry.coordinates[0];
          const lat = s.lat != null ? s.lat : existing?.geometry.coordinates[1];
          if (lng == null || lat == null) continue;

          bufferRef.current.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: props,
          });
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
