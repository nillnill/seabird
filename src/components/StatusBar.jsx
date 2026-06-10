import useStore from '../store/useStore.js';

const STATUS_CONFIG = {
  CONNECTED:    { dot: 'bg-green-400', label: 'LIVE' },
  CONNECTING:   { dot: 'bg-yellow-400 animate-pulse', label: 'CONNECTING' },
  DISCONNECTED: { dot: 'bg-gray-500', label: 'OFFLINE' },
  ERROR:        { dot: 'bg-red-500 animate-pulse', label: 'ERROR' },
};

export default function StatusBar() {
  const { wsStatus, shipCount } = useStore();
  const { dot, label } = STATUS_CONFIG[wsStatus] ?? STATUS_CONFIG.DISCONNECTED;

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-sea-border bg-sea-panel shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-widest text-white">SEABIRD</span>
        <span className="text-xs text-sea-muted hidden sm:block">AI eyes on every ocean</span>
      </div>
      <div className="flex items-center gap-4 text-xs font-mono">
        <span className="text-sea-muted">
          <span className="text-white">{shipCount.toLocaleString()}</span> vessels
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-sea-muted">{label}</span>
        </div>
      </div>
    </header>
  );
}
