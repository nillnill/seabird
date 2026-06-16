import { useEffect } from 'react';
import MapView from './components/MapView.jsx';
import CommandFeed from './components/CommandFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import ShipDetailPanel from './components/ShipDetailPanel.jsx';
import RegionIntelPanel from './components/RegionIntelPanel.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import XCapitalSpace from './components/XCapitalSpace.jsx';
import IntroPage from './components/IntroPage.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import DeckModal from './components/DeckModal.jsx';
import GuideTour from './components/GuideTour.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import useStore from './store/useStore.js';

const INTRO_SEEN_KEY = 'seabird_intro_seen_v1';
// 디폴트 선택 지역 — 인트로가 끝나면 바로 보이도록 부산항을 기본 선택
const DEFAULT_REGION = { id: 'busan', name: '부산항', type: 'port', lat: 35.1028, lng: 129.0403 };

export default function App() {
  const { selectedShip, selectedRegion, showXCapital, openIntro, setSelectedRegion, openDeck } = useStore();

  // 첫 방문 시 인트로 1회 자동 노출 + 부산항 디폴트 선택(맵도 부산으로 센터링)
  // /소개(또는 /deck) 경로로 접속하면 발표자료 뷰어를 자동으로 연다(공유 링크용).
  useEffect(() => {
    setSelectedRegion(DEFAULT_REGION);
    let path = window.location.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep raw */ }
    if (['/소개', '/deck', '/intro-deck'].includes(path)) {
      openDeck();
      return; // 소개 링크 접속 시 인트로 자동 노출은 생략
    }
    try {
      if (!localStorage.getItem(INTRO_SEEN_KEY)) {
        openIntro();
        localStorage.setItem(INTRO_SEEN_KEY, '1');
      }
    } catch { /* localStorage 비활성 무시 */ }
  }, [openIntro, setSelectedRegion, openDeck]);

  return (
    <div className="flex flex-col h-screen bg-sea-bg overflow-hidden">
      <StatusBar />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="relative flex-1" data-tour="map">
          <MapView />
          {selectedShip && <ShipDetailPanel />}
          {selectedRegion && <RegionIntelPanel />}
        </div>
        <CommandFeed />
      </div>
      <MobileTabBar />
      <StatsDashboard />
      {showXCapital && <XCapitalSpace />}
      <DeckModal />
      <GuideTour />
      <IntroPage />
      <LoadingScreen />
    </div>
  );
}
