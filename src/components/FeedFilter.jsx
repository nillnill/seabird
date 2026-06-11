import useStore from '../store/useStore.js';

const AGENT_OPTIONS = [
  { id: 'PORT_ANALYST',        label: '🏗️ Port' },
  { id: 'CHOKEPOINT_WATCHER',  label: '🚢 Choke' },
  { id: 'CARGO_ESTIMATOR',     label: '📦 Cargo' },
  { id: 'GEOPOLITICAL_LINKER', label: '🌐 Geo' },
  { id: 'WEATHER_AGENT',       label: '🌪️ Weather' },
  { id: 'COMMODITY_ANALYST',   label: '💹 Commodity' },
];

const SEVERITY_OPTIONS = ['CRITICAL', 'WARNING', 'INFO'];
const SEVERITY_COLORS = { CRITICAL: 'text-red-400', WARNING: 'text-yellow-400', INFO: 'text-green-400' };
const TIME_OPTIONS = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
];

export default function FeedFilter() {
  const { feedFilters, setFeedFilter } = useStore();

  function toggleAgent(id) {
    const cur = feedFilters.agents;
    setFeedFilter('agents', cur.includes(id) ? cur.filter((a) => a !== id) : [...cur, id]);
  }

  function toggleSeverity(s) {
    const cur = feedFilters.severities;
    setFeedFilter('severities', cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  return (
    <div className="px-3 py-2 border-t border-sea-border space-y-2">
      <div className="flex flex-wrap gap-1">
        {AGENT_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => toggleAgent(id)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              feedFilters.agents.includes(id)
                ? 'border-blue-500/60 bg-blue-900/20 text-blue-300'
                : 'border-sea-border text-sea-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {SEVERITY_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => toggleSeverity(s)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              feedFilters.severities.includes(s)
                ? `border-current ${SEVERITY_COLORS[s]} bg-black/20`
                : 'border-sea-border text-sea-muted'
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {TIME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFeedFilter('timeRange', value)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                feedFilters.timeRange === value
                  ? 'border-white/40 text-white'
                  : 'border-sea-border text-sea-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
