import { useEffect } from 'react';
import MapView from './components/MapView.jsx';
import CommandFeed from './components/CommandFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import ShipDetailPanel from './components/ShipDetailPanel.jsx';
import RegionIntelPanel from './components/RegionIntelPanel.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import IntroPage from './components/IntroPage.jsx';
import useStore from './store/useStore.js';

const INTRO_SEEN_KEY = 'seabird_intro_seen_v1';

export default function App() {
  const { selectedShip, selectedRegion, openIntro } = useStore();

  // 첫 방문 시 인트로 1회 자동 노출 (이후엔 GNB 버튼으로)
  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO_SEEN_KEY)) {
        openIntro();
        localStorage.setItem(INTRO_SEEN_KEY, '1');
      }
    } catch { /* localStorage 비활성 무시 */ }
  }, [openIntro]);

  return (
    <div className="flex flex-col h-screen bg-sea-bg overflow-hidden">
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <MapView />
          {selectedShip && <ShipDetailPanel />}
          {selectedRegion && <RegionIntelPanel />}
        </div>
        <CommandFeed />
      </div>
      <StatsDashboard />
      <IntroPage />
    </div>
  );
}
