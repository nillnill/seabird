import { create } from 'zustand';

const useStore = create((set) => ({
  // 지도 상태
  selectedShip: null,
  mapCenter: [127.0, 35.0],
  mapZoom: 4,
  setSelectedShip: (ship) => set({ selectedShip: ship }),
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
  setSelectedRegion: (region) => set({ selectedRegion: region }),

  // 피드 상태
  reports: [],
  feedFilters: {
    agents: ['PORT_ANALYST', 'CHOKEPOINT_WATCHER', 'CARGO_ESTIMATOR', 'GEOPOLITICAL_LINKER'],
    severities: ['INFO', 'WARNING', 'CRITICAL'],
    timeRange: '24h',
  },
  addReport: (report) =>
    set((state) => ({
      reports: [report, ...state.reports].slice(0, 100),
    })),
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
}));

export default useStore;
