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
import SlideDeck from './components/SlideDeck.jsx';
import GuideTour from './components/GuideTour.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import useStore from './store/useStore.js';

const INTRO_SEEN_KEY = 'seabird_intro_seen_v1';

export default function App() {
  const { selectedShip, selectedRegion, showXCapital, openIntro, openDeck, openSlides } = useStore();

  // 첫 방문 시 인트로 1회 자동 노출. (지역 디폴트 선택 없음 — 한·일이 보이는 전체 뷰로 시작)
  // /소개(또는 /deck) 경로로 접속하면 발표자료 뷰어를, /발표(또는 /slides) 경로면 슬라이드 뷰어를 자동으로 연다(공유 링크용).
  useEffect(() => {
    let path = window.location.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep raw */ }
    if (['/발표', '/slides', '/presentation'].includes(path)) {
      openSlides();
      return; // 슬라이드 링크 접속 시 인트로 자동 노출은 생략
    }
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
  }, [openIntro, openDeck, openSlides]);

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
      <SlideDeck />
      <GuideTour />
      <IntroPage />
      <LoadingScreen />
    </div>
  );
}
