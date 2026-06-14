import useStore from '../store/useStore.js';

// 에이전트 on/off는 카테고리 탭(FeedTabs.jsx)이 담당 → 여기는 심각도·기간만.
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

  function toggleSeverity(s) {
    const cur = feedFilters.severities;
    setFeedFilter('severities', cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  return (
    <div className="px-3 py-2 border-b border-sea-border">
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
