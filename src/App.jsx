import MapView from './components/MapView.jsx';
import CommandFeed from './components/CommandFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import ShipDetailPanel from './components/ShipDetailPanel.jsx';
import RegionIntelPanel from './components/RegionIntelPanel.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import useStore from './store/useStore.js';

export default function App() {
  const { selectedShip, selectedRegion } = useStore();
  return (
    <div className="flex flex-col h-screen bg-sea-bg overflow-hidden">
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <MapView />
          {selectedShip && <ShipDetailPanel />}
        </div>
        <CommandFeed />
      </div>
      {selectedRegion && <RegionIntelPanel />}
      <StatsDashboard />
    </div>
  );
}
