import { create } from 'zustand';

const useStore = create((set) => ({
  // 지도 상태
  selectedShip: null,
  mapCenter: [127.0, 35.0],
  mapZoom: 4,
  // 선박 보강 오버라이드 { mmsi: { vessel_type, flag_country } } — 패널이 dbShip으로 알아낸 값을
  // 지도 마커에 즉시 반영(useAISStream.flushBuffer가 적용). 클릭 즉시 색상 일치.
  shipOverrides: {},
  setShipOverride: (mmsi, patch) =>
    set((state) => ({ shipOverrides: { ...state.shipOverrides, [mmsi]: { ...(state.shipOverrides[mmsi] || {}), ...patch } } })),
  // 선박·지역 카드는 좌측에서 상호 배타 (하나 열면 다른 하나 닫힘)
  setSelectedShip: (ship) => set(ship ? { selectedShip: ship, selectedRegion: null } : { selectedShip: null }),
  focusMap: (lat, lng, zoom = 8) => set({ mapCenter: [lng, lat], mapZoom: zoom }),

  // 지도 필터 (선종·국기·속도)
  mapFilters: {
    vesselTypes: ['Container Ship', 'Tanker', 'Bulk Carrier', 'LNG Carrier', 'Passenger', 'Fishing', 'Special Craft', 'Other'],
    flagCountries: [],
    speedMax: 30,
  },
  setMapFilter: (key, val) =>
    set((state) => ({ mapFilters: { ...state.mapFilters, [key]: val } })),

  // 선박 이동 경로
  shipTrack: [],
  setShipTrack: (pts) => set({ shipTrack: pts }),
  clearShipTrack: () => set({ shipTrack: [] }),

  // 지역 인텔 패널 (항만 + 초크포인트 통합)
  selectedRegion: null,
  setSelectedRegion: (region) => set(region ? { selectedRegion: region, selectedShip: null } : { selectedRegion: null }),

  // 피드 상태
  reports: [],
  feedFilters: {
    agents: ['PORT_ANALYST', 'CHOKEPOINT_WATCHER', 'CARGO_ESTIMATOR', 'GEOPOLITICAL_LINKER', 'WEATHER_AGENT', 'COMMODITY_ANALYST'],
    severities: ['INFO', 'WARNING', 'CRITICAL'],
    timeRange: '24h',
  },
  addReport: (report) =>
    set((state) => {
      // id 중복 무시 (초기 로드 + Realtime + StrictMode 이중 마운트로 같은 보고가 중복 추가되는 것 방지)
      if (report?.id && state.reports.some((r) => r.id === report.id)) return state;
      return { reports: [report, ...state.reports].slice(0, 100) };
    }),
  setFeedFilter: (key, value) =>
    set((state) => ({
      feedFilters: { ...state.feedFilters, [key]: value },
    })),

  // Commander 상태
  commanderInput: '',
  isCommanderLoading: false,
  setCommanderInput: (text) => set({ commanderInput: text }),
  setCommanderLoading: (v) => set({ isCommanderLoading: v }),

  // WebSocket 상태
  wsStatus: 'DISCONNECTED',
  shipCount: 0,
  setWsStatus: (status) => set({ wsStatus: status }),
  setShipCount: (count) => set({ shipCount: count }),

  // 초크포인트 severity 캐시 (ChokepointMarker용)
  chokepointSeverities: {},
  setChokepointSeverity: (id, severity) =>
    set((state) => ({
      chokepointSeverities: { ...state.chokepointSeverities, [id]: severity },
    })),

  // 통계 대시보드
  showStatsDashboard: false,
  toggleStatsDashboard: () => set((state) => ({ showStatsDashboard: !state.showStatsDashboard })),

  // 날씨 마커 (WeatherMarkers용) — 감시 지점별 이모지/심각도
  weatherMarkers: [],
  setWeatherMarkers: (points) => set({ weatherMarkers: points }),
}));

export default useStore;
