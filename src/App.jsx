import { useEffect, useRef } from 'react';
import MapView from './components/MapView.jsx';
import CommandFeed from './components/CommandFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import ShipDetailPanel from './components/ShipDetailPanel.jsx';
import { startChokepointWatcher } from './agents/chokepointWatcher.js';
import { startPortAnalyst } from './agents/portAnalyst.js';
import { startAnomalyDetector } from './agents/anomalyDetector.js';
import { startGeopoliticalLinker } from './agents/geopoliticalLinker.js';

export default function App() {
  const agentIntervalsRef = useRef([]);

  useEffect(() => {
    // 에이전트 폴링 시작 (500ms 간격으로 stagger — API rate limit 방지)
    const timers = [
      setTimeout(() => agentIntervalsRef.current.push(startChokepointWatcher()), 0),
      setTimeout(() => agentIntervalsRef.current.push(startPortAnalyst()), 500),
      setTimeout(() => agentIntervalsRef.current.push(startAnomalyDetector()), 1000),
      setTimeout(() => agentIntervalsRef.current.push(startGeopoliticalLinker()), 1500),
    ];

    return () => {
      timers.forEach(clearTimeout);
      agentIntervalsRef.current.forEach(clearInterval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-sea-bg overflow-hidden">
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <MapView />
          <ShipDetailPanel />
        </div>
        <CommandFeed />
      </div>
    </div>
  );
}
