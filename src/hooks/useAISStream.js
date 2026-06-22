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
// Supabase prefetch — PostgREST max-rows(1000)를 range 페이지네이션으로 우회해 더 많은 선박을 지도에 즉시 채운다.
// ※ 이건 콜드스타트용 'DB 시드'일 뿐이다. 서버가 떠 있으면 relay full 스냅샷이 추적 중인 전 선박을 캡 없이 보낸다.
//   updated_at 최신순이라 캡 안에서 가장 신선한 선박부터 채워진다(오래된 유령선·localStorage 한도·egress 균형).
const PREFETCH_MAX = 50000;  // 지도에 미리 올릴 최대 선박 수(크게 — DB의 가용 선박 대부분을 시드)
const PREFETCH_PAGE = 1000;  // PostgREST 단일 응답 상한(이 프로젝트 max-rows)
const PREFETCH_BATCH = 10;   // 전체 prefetch 시 동시 요청 페이지 수(27s 순차 → 수초로 단축)
const LS_MAX_FEATURES = 8000; // localStorage 캐시 상한(초과 시 직렬화 skip — ~5MB 쿼터·CPU 낭비 방지, relay가 복원)
// 방치 탭 대역폭 절감: 백그라운드 탭은 즉시, 포그라운드라도 N분 무활동이면 relay를 끊는다.
// 다시 보거나 활동하면 자동 재연결(서버가 접속 시 full 스냅샷을 다시 줘 즉시 복구).
const IDLE_DISCONNECT_MS = 10 * 60 * 1000;   // 10분 무활동 → relay 종료
const IDLE_CHECK_INTERVAL_MS = 60 * 1000;    // 1분마다 유휴 점검

export function useAISStream(mapRef) {
  const bufferRef = useRef([]);
  const shipMapRef = useRef(new Map()); // mmsi → feature (최신 위치 유지)
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const lastSaveRef = useRef(0); // localStorage 마지막 저장 시각
  const intentionalCloseRef = useRef(false); // 유휴/숨김으로 의도 종료 시 자동 재연결 억제
  const lastActivityRef = useRef(Date.now()); // 마지막 사용자 활동 시각(유휴 판정용)
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
    await enrichFromSupabase(true); // 최초 1회 전체 prefetch(시드)
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
  // fullPrefetch=true(최초 로드): PREFETCH_MAX까지 전체 시드(병렬). false(3분 주기): 화면 선박 보강 +
  // 최신 1페이지 top-up만 — 매번 5만 재조회로 Supabase IO 예산을 태우지 않도록(이슈 #20).
  const enrichFromSupabase = useCallback(async (fullPrefetch = false) => {
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

    // 2) prefetch — 지도에 선박을 시드. updated_at 최신순(신선한 선박부터).
    //    ⚠️ Supabase(PostgREST) max-rows가 1000이라 .limit(N>1000)이 1000으로 잘린다(지도가 ~1000척에서 멈추던 원인).
    //    range로 1000씩 페이지네이션해 끌어온다. (ships 테이블은 수만 행)
    const fetchPage = (from) => supabase
      .from('ships').select(SELECT_COLS).not('lat', 'is', null)
      .order('updated_at', { ascending: false })
      .range(from, from + PREFETCH_PAGE - 1)
      .then(({ data }) => data ?? []);

    if (fullPrefetch) {
      // 전체 시드 — PREFETCH_BATCH개씩 병렬로(순차 27s → 수초). 마지막 페이지 도달 시 중단.
      let stop = false;
      for (let base = 0; base < PREFETCH_MAX && !stop; base += PREFETCH_PAGE * PREFETCH_BATCH) {
        const offsets = [];
        for (let i = 0; i < PREFETCH_BATCH && base + i * PREFETCH_PAGE < PREFETCH_MAX; i++) offsets.push(base + i * PREFETCH_PAGE);
        const pages = await Promise.all(offsets.map(fetchPage));
        pages.forEach((p) => applyRows(p));
        if (pages.length && pages[pages.length - 1].length < PREFETCH_PAGE) stop = true; // 더 없음
      }
    } else {
      // 주기 갱신 — 최신 1페이지 top-up만(전체 재조회로 IO 예산 소모 방지). 화면 선박 보강은 위 (1)에서 이미 처리.
      applyRows(await fetchPage(0));
    }

    // 지도 갱신 + localStorage 갱신
    const source = mapRef.current?.getSource('ships');
    const features = Array.from(shipMapRef.current.values());
    if (source) { source.setData({ type: 'FeatureCollection', features }); setShipCount(features.length); }
    try {
      const now = Date.now();
      // 너무 크면 직렬화 skip(쿼터·CPU 낭비 방지) — 캐시 못 써도 relay·prefetch가 복원
      if (features.length <= LS_MAX_FEATURES) localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ ts: now, features }));
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

    // 라이브 위치로 localStorage 캐시를 따뜻하게 유지 (최대 60초마다 1회, 너무 크면 skip)
    const now = Date.now();
    if (now - lastSaveRef.current > 60_000 && features.length <= LS_MAX_FEATURES) {
      lastSaveRef.current = now;
      try {
        localStorage.setItem(LS_CACHE_KEY, JSON.stringify({ ts: now, features }));
      } catch { /* 용량 초과 등 무시 */ }
    }
  }, [mapRef, setShipCount]);

  const connect = useCallback(() => {
    const rs = wsRef.current?.readyState;
    if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return;
    intentionalCloseRef.current = false; // 새 연결 시작 → 자동 재연결 다시 허용

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
      if (intentionalCloseRef.current) return; // 유휴/숨김 종료 — 재연결은 활동·복귀 시에만
      setWsStatus('DISCONNECTED');
      // 5초 후 재연결
      setTimeout(connect, 5000);
    };
  }, [setWsStatus]);

  // 유휴/백그라운드 → relay 종료 (egress 절감). 자동 재연결은 억제.
  const disconnect = useCallback((status) => {
    intentionalCloseRef.current = true;
    wsRef.current?.close();
    setWsStatus(status);
  }, [setWsStatus]);

  useEffect(() => {
    loadCache();
    connect();
    intervalRef.current = setInterval(flushBuffer, BUFFER_INTERVAL_MS);
    // 3분마다 Supabase에서 선종·국적 보강 → 지도 색상이 시간이 지날수록 채워짐 (숨김 탭은 skip)
    const enrichTimer = setInterval(() => { if (!document.hidden) enrichFromSupabase(); }, 3 * 60 * 1000);

    // 사용자 활동 기록 + 유휴로 끊겼던 보이는 탭이면 즉시 재연결
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      const rs = wsRef.current?.readyState;
      if (!document.hidden && rs !== WebSocket.OPEN && rs !== WebSocket.CONNECTING) connect();
    };
    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'];
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));

    // 탭 가시성: 백그라운드면 즉시 종료, 복귀하면 재연결
    const onVisibility = () => {
      if (document.hidden) {
        disconnect('PAUSED');
      } else {
        lastActivityRef.current = Date.now();
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 포그라운드라도 N분 무활동이면 종료
    const idleTimer = setInterval(() => {
      if (document.hidden) return; // 숨김은 visibility 핸들러가 이미 처리
      if (wsRef.current?.readyState === WebSocket.OPEN
          && Date.now() - lastActivityRef.current > IDLE_DISCONNECT_MS) {
        disconnect('PAUSED');
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      intentionalCloseRef.current = true; // 언마운트 종료가 재연결 트리거 안 하도록
      wsRef.current?.close();
      clearInterval(intervalRef.current);
      clearInterval(enrichTimer);
      clearInterval(idleTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActivity));
    };
  }, [connect, disconnect, flushBuffer, loadCache, enrichFromSupabase]);
}
