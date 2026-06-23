import { create } from 'zustand';

const useStore = create((set) => ({
  // 지도 상태
  selectedShip: null,
  mapCenter: [131.0, 36.5], // 한국(좌)·일본(우)이 함께 보이는 초기 뷰
  mapZoom: 4.6,
  // 선박 보강 오버라이드 { mmsi: { vessel_type, flag_country } } — 패널이 dbShip으로 알아낸 값을
  // 지도 마커에 즉시 반영(useAISStream.flushBuffer가 적용). 클릭 즉시 색상 일치.
  shipOverrides: {},
  setShipOverride: (mmsi, patch) =>
    set((state) => ({ shipOverrides: { ...state.shipOverrides, [mmsi]: { ...(state.shipOverrides[mmsi] || {}), ...patch } } })),
  // 모바일 하단 탭 (지도/피드 전환) — md 미만에서만 의미. 선박·지역 선택 시 지도로 자동 전환.
  mobileView: 'map',
  setMobileView: (v) => set({ mobileView: v }),
  // 선박·지역 카드는 좌측에서 상호 배타 (하나 열면 다른 하나 닫힘)
  setSelectedShip: (ship) => set(ship ? { selectedShip: ship, selectedRegion: null, mobileView: 'map' } : { selectedShip: null }),
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
  // 지역 선택 시 그 위치로 맵 자동 센터링(선박처럼). 초크포인트는 넓게(zoom 6), 항만은 가깝게(9).
  setSelectedRegion: (region) => set(region
    ? {
        selectedRegion: region,
        selectedShip: null,
        mobileView: 'map',
        ...(Number.isFinite(region.lat) && Number.isFinite(region.lng)
          ? { mapCenter: [region.lng, region.lat], mapZoom: region.type === 'chokepoint' ? 6 : 9 }
          : {}),
      }
    : { selectedRegion: null }),

  // 피드 상태
  reports: [],
  feedFilters: {
    // 에이전트 on/off는 이제 카테고리 탭(feedTab)이 담당 → severities·timeRange만 공통 필터로 유지
    severities: ['INFO', 'WARNING', 'CRITICAL'],
    timeRange: '24h',
  },
  feedTab: 'all', // 활성 카테고리 탭 (FeedTabs.jsx의 TABS id)
  feedCollapsed: false, // 데스크톱에서 커맨드 피드 접기(지도 넓게 보기)
  toggleFeed: () => set((state) => ({ feedCollapsed: !state.feedCollapsed })),
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
  setFeedTab: (tab) => set({ feedTab: tab }),

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

  // 서비스 소개 발표자료(PDF) 모달
  showDeck: false,
  toggleDeck: () => set((state) => ({ showDeck: !state.showDeck })),
  openDeck: () => set({ showDeck: true }), // /소개 경로 등에서 idempotent 오픈

  // 발표 슬라이드(이미지 1~5) 풀스크린 뷰어
  showSlides: false,
  toggleSlides: () => set((state) => ({ showSlides: !state.showSlides })),
  openSlides: () => set({ showSlides: true }), // /발표 경로 등에서 idempotent 오픈

  // X Capital 투자 인텔리전스 공간
  showXCapital: false,
  toggleXCapital: () => set((state) => ({ showXCapital: !state.showXCapital })),

  // 인트로 페이지 (첫 방문 자동 + GNB 버튼)
  showIntro: false,
  openIntro: () => set({ showIntro: true }),
  closeIntro: () => set({ showIntro: false }),

  // 신규 사용자 가이드 투어 (GNB '?' 버튼으로 수동 실행)
  showGuide: false,
  openGuide: () => set({ showGuide: true }),
  closeGuide: () => set({ showGuide: false }),

  // 날씨 마커 (WeatherMarkers용) — 감시 지점별 이모지/심각도
  weatherMarkers: [],
  setWeatherMarkers: (points) => set({ weatherMarkers: points }),

  // ── 지정학 Fulcrum (국가 레이어 + 패널 + 공급루트) ──
  showCountryLayer: false, // 🌐 '지정학' 모드 토글 (국가 포인트 표시)
  toggleCountryLayer: () => set((state) => {
    const on = !state.showCountryLayer;
    return on ? { showCountryLayer: true } : { showCountryLayer: false, selectedCountry: null, activeSupplyRoute: null };
  }),
  selectedCountry: null, // { code, name, lat, lng }
  setSelectedCountry: (c) => set(c
    ? { selectedCountry: c, selectedShip: null, selectedRegion: null, mobileView: 'map',
        ...(Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { mapCenter: [c.lng, c.lat], mapZoom: 4 } : {}) }
    : { selectedCountry: null, activeSupplyRoute: null }),
  // 활성 공급 루트(품목 클릭 시 지도에 그릴 대상) { code, commodity }
  activeSupplyRoute: null,
  setActiveSupplyRoute: (r) => set({ activeSupplyRoute: r }),
}));

export default useStore;
